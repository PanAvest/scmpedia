import './_runtime.js'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { DEFAULT_PLANS } from './_plans.js'

export type AdminIdentity = { email: string; role: string }

// GoTrue has no bulk endpoints — deleteUser / updateUserById are one HTTP round trip
// each, so we loop. Keep batches inside the Vercel function timeout (10s Hobby).
const MAX_BULK_DELETE = 10
const MAX_BATCH_PREMIUM = 100
const CONCURRENCY = 4

// 'comp' = complimentary (admin-granted, not a paid plan). Deliberately NOT a student-*
// id: api/_raffle.ts keys raffle eligibility off the plan id, and comps must not win.
const COMP_PLAN = 'comp'
const GRANTABLE_PLANS = new Set([COMP_PLAN, ...Object.keys(DEFAULT_PLANS)])
const MAX_GRANT_DAYS = 366

// auth-js validates ids with this regex and THROWS (outside its try/catch) on a bad
// value, which would 500 the handler — so filter ourselves first.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

type Sub = { tier?: string; plan?: string; expires_at?: string; source?: string } & Record<string, unknown>

const subscriptionOf = (user: User): Sub | undefined =>
  (user.app_metadata as Record<string, unknown> | undefined)?.scmpedia_subscription as Sub | undefined

const isPremium = (sub?: Sub) => {
  if (sub?.tier !== 'premium') return false
  const expires = typeof sub.expires_at === 'string' ? sub.expires_at : ''
  return !expires || new Date(expires).getTime() > Date.now()
}

const isMissingTable = (error: unknown) => {
  const err = error as { code?: unknown; message?: unknown } | null
  const code = String(err?.code || '')
  const message = String(err?.message || '').toLowerCase()
  return code === '42P01' || code === 'PGRST205' || message.includes('does not exist') || message.includes('schema cache')
}

const addDaysFrom = (from: Date, days: number) => {
  const date = new Date(from.getTime())
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

const snapshot = (sub?: Sub) =>
  sub
    ? {
        plan: typeof sub.plan === 'string' ? sub.plan : '',
        expires_at: typeof sub.expires_at === 'string' ? sub.expires_at : '',
        paystack_reference: typeof sub.paystack_reference === 'string' ? sub.paystack_reference : '',
        source: typeof sub.source === 'string' ? sub.source : 'paystack',
      }
    : null

async function runPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await fn(items[index] as T)
    }
  })
  await Promise.all(workers)
  return results
}

async function listAllUsers(service: SupabaseClient): Promise<User[]> {
  const users: User[] = []
  const perPage = 200
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Could not list users: ${error.message}`)
    const batch = data?.users || []
    users.push(...batch)
    if (batch.length < perPage) break
  }
  return users
}

// Users appearing in any recorded draw. Deleting one means the commitment
// (sha256 over the live pool) can never be recomputed — the fairness proof breaks.
async function loadRaffleWinnerIds(service: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>()
  const { data, error } = await service.from('scmpedia_raffle_draws').select('winners')
  if (error) {
    if (isMissingTable(error)) return ids
    throw new Error(`Could not read raffle draws: ${error.message}`)
  }
  for (const draw of data || []) {
    for (const winner of ((draw as { winners?: unknown }).winners || []) as { user_id?: unknown }[]) {
      const id = String(winner?.user_id || '')
      if (id) ids.add(id)
    }
  }
  return ids
}

async function loadSuccessfulPaymentCounts(service: SupabaseClient): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  const { data, error } = await service.from('scmpedia_payments').select('user_id,status')
  if (error) {
    if (isMissingTable(error)) return counts
    throw new Error(`Could not read payments: ${error.message}`)
  }
  for (const row of (data || []) as { user_id?: unknown; status?: unknown }[]) {
    const id = String(row.user_id || '')
    if (!id || String(row.status) !== 'success') continue
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  return counts
}

async function loadAdminEmails(service: SupabaseClient): Promise<Set<string>> {
  const emails = new Set<string>()
  const { data, error } = await service.from('scmpedia_admins').select('email')
  if (error) {
    if (isMissingTable(error)) return emails
    throw new Error(`Could not read admin accounts: ${error.message}`)
  }
  for (const row of (data || []) as { email?: unknown }[]) emails.add(String(row.email || '').toLowerCase())
  return emails
}

// Deleting users is the most destructive admin action, so it re-verifies master role
// against the LIVE table rather than trusting the (12h-lived) token claim — a demoted
// admin's stale token cannot delete. The env-bootstrap admin (not in the table) is
// correctly denied.
async function isTableMaster(service: SupabaseClient, email: string): Promise<boolean> {
  const { data, error } = await service
    .from('scmpedia_admins')
    .select('role')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  if (error || !data) return false
  return data.role === 'master'
}

async function audit(
  service: SupabaseClient,
  table: 'scmpedia_admin_audit' | 'scmpedia_admin_grants',
  entry: Record<string, unknown>,
) {
  try {
    await service.from(table).insert(entry)
  } catch {
    /* audit tables are optional */
  }
}

export async function listUsersReport(service: SupabaseClient) {
  const [users, winnerIds, payCounts, adminEmails] = await Promise.all([
    listAllUsers(service),
    loadRaffleWinnerIds(service),
    loadSuccessfulPaymentCounts(service),
    loadAdminEmails(service),
  ])
  const rows = users.map((u) => {
    const meta = (u.user_metadata || {}) as Record<string, unknown>
    const sub = subscriptionOf(u)
    return {
      id: u.id,
      email: u.email || '',
      full_name: String(meta.full_name || ''),
      created_at: u.created_at || '',
      last_sign_in_at: u.last_sign_in_at || '',
      university: String(meta.student_university || ''),
      index_number: String(meta.student_index_number || ''),
      is_student: Boolean(meta.student_university && meta.student_index_number),
      premium: isPremium(sub),
      plan: String(sub?.plan || ''),
      expires_at: String(sub?.expires_at || ''),
      source: String(sub?.source || ''),
      payments: payCounts.get(u.id) || 0,
      raffle_winner: winnerIds.has(u.id),
      is_admin: adminEmails.has(String(u.email || '').toLowerCase()),
    }
  })
  rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  return { users: rows, total: rows.length }
}

type DeleteBody = { ids?: unknown; id?: unknown; confirm?: unknown; force?: unknown; dryRun?: unknown }

export async function deleteUsers(
  service: SupabaseClient,
  identity: AdminIdentity,
  body: DeleteBody,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (identity.role !== 'master' || !(await isTableMaster(service, identity.email))) {
    return { status: 403, body: { error: 'Only a master admin can delete users' } }
  }

  const raw: unknown[] = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : []
  const ids = [...new Set(raw.map((v) => String(v || '').trim().toLowerCase()))].filter(Boolean)
  if (!ids.length) return { status: 400, body: { error: 'Send an id, or an ids array, of the users to delete' } }

  const malformed = ids.filter((id) => !UUID_RE.test(id))
  if (malformed.length) return { status: 400, body: { error: `Not a valid user id: ${malformed[0]}` } }
  if (ids.length > MAX_BULK_DELETE) {
    return { status: 400, body: { error: `Delete at most ${MAX_BULK_DELETE} users per request (got ${ids.length}).` } }
  }

  const dryRun = body.dryRun === true
  // Typed confirmation (skipped for a dry run, which writes nothing).
  if (!dryRun && String(body.confirm || '') !== 'DELETE') {
    return { status: 400, body: { error: 'Confirmation required: send confirm: "DELETE"' } }
  }

  // The migration is a hard prerequisite: without the archive table a delete would be
  // an unrecoverable, silent loss of the account. Refuse rather than proceed.
  const { error: probe } = await service.from('scmpedia_deleted_users').select('id').limit(1)
  if (probe && isMissingTable(probe)) {
    return { status: 503, body: { error: 'Run supabase-admin-users.sql before deleting users — the archive table is missing.' } }
  }

  // force is the explicit set of ids the admin acknowledged as protected — NOT a
  // batch-wide boolean, so acknowledging one winner can't nuke the whole selection.
  const forceIds = new Set((Array.isArray(body.force) ? body.force : []).map((v) => String(v || '').toLowerCase()))

  const [winnerIds, payCounts, adminEmails] = await Promise.all([
    loadRaffleWinnerIds(service),
    loadSuccessfulPaymentCounts(service),
    loadAdminEmails(service),
  ])

  const targets = await runPool(ids, CONCURRENCY, async (id) => {
    const { data, error } = await service.auth.admin.getUserById(id)
    return { id, user: data?.user || null, error: error?.message || '' }
  })

  const missing = targets.filter((t) => !t.user)
  if (missing.length) {
    return {
      status: 404,
      body: {
        error: `${missing.length} of ${ids.length} user(s) no longer exist. Reload the list and try again.`,
        missing: missing.map((t) => t.id),
      },
    }
  }

  const reasonsFor = (t: { id: string; user: User | null }) => {
    const user = t.user as User
    const reasons: string[] = []
    if (adminEmails.has((user.email || '').toLowerCase())) reasons.push('is an admin account')
    if (winnerIds.has(t.id)) reasons.push('appears in a raffle draw (deleting breaks the draw commitment)')
    if ((payCounts.get(t.id) || 0) > 0) reasons.push(`has ${payCounts.get(t.id)} successful payment(s)`)
    return reasons
  }

  const blocked = targets
    .map((t) => ({ id: t.id, email: (t.user as User).email || '', reasons: reasonsFor(t) }))
    .filter((b) => b.reasons.length && !forceIds.has(b.id))
    .map((b) => ({ id: b.id, email: b.email, reason: b.reasons.join('; ') }))

  if (blocked.length) {
    return {
      status: 409,
      body: {
        error: 'Some accounts are protected. Review them, then resend with their ids in force[] to delete anyway.',
        blocked,
        requested: ids.length,
        deleted: [],
      },
    }
  }

  if (dryRun) {
    return {
      status: 200,
      body: {
        dryRun: true,
        wouldDelete: targets.map((t) => ({ id: t.id, email: (t.user as User).email || '' })),
        acknowledged: [...forceIds],
        message: `Dry run: ${targets.length} user(s) would be deleted. Nothing was changed.`,
      },
    }
  }

  const deleteOne = async (t: { id: string; user: User | null }) => {
    const id = t.id
    const user = t.user as User
    const email = user.email || ''

    // Snapshot payments (they SET NULL on delete, but keep the full row in the archive).
    let payments: unknown[] = []
    const { data: payRows, error: payErr } = await service.from('scmpedia_payments').select('*').eq('user_id', id)
    if (payErr && !isMissingTable(payErr)) {
      return { ok: false, row: { id, email, error: `Could not read payments before delete: ${payErr.message}` } }
    }
    payments = payRows || []

    // Archive first, FAIL CLOSED — an unrecoverable delete is worse than a failed one.
    const { error: archiveErr } = await service.from('scmpedia_deleted_users').insert({
      id,
      email,
      user_metadata: user.user_metadata || {},
      app_metadata: user.app_metadata || {},
      payments,
      raffle_winner: winnerIds.has(id),
      deleted_by: identity.email,
    })
    if (archiveErr) return { ok: false, row: { id, email, error: `Could not archive the account: ${archiveErr.message}` } }

    // Keep the money trail identifiable once user_id is nulled.
    if (payments.length && email) {
      await service.from('scmpedia_payments').update({ user_email: email }).eq('user_id', id)
    }

    // HARD delete. Soft delete leaves the row, nulls metadata, and skips cascades.
    const { error } = await service.auth.admin.deleteUser(id)
    if (error) return { ok: false, row: { id, email, error: error.message } }

    // scmpedia_usage has no FK — its key is the text `user:<id>`; clear it if present.
    await service.from('scmpedia_usage').delete().eq('subject', `user:${id}`).then(
      () => undefined,
      () => undefined,
    )

    await audit(service, 'scmpedia_admin_audit', {
      actor_email: identity.email,
      actor_role: identity.role,
      action: 'user.delete',
      target_id: id,
      target_email: email,
      details: { forced: forceIds.has(id), payments_archived: payments.length, raffle_winner: winnerIds.has(id) },
    })
    return { ok: true, row: { id, email } }
  }

  const results = await runPool(targets, CONCURRENCY, deleteOne)
  const deleted = results.filter((r) => r.ok).map((r) => r.row)
  const failed = results.filter((r) => !r.ok).map((r) => r.row)

  return {
    status: failed.length ? 207 : 200,
    body: {
      requested: ids.length,
      deleted,
      failed,
      message: failed.length
        ? `Deleted ${deleted.length} of ${ids.length}. ${failed.length} failed — the rest are gone.`
        : `Deleted ${deleted.length} user${deleted.length === 1 ? '' : 's'}.`,
    },
  }
}

type PremiumBody = {
  action?: unknown
  userIds?: unknown
  userId?: unknown
  plan?: unknown
  days?: unknown
  lifetime?: unknown
  extend?: unknown
}

export async function setPremium(
  service: SupabaseClient,
  identity: AdminIdentity,
  body: PremiumBody,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const action = String(body.action || '')
  if (action !== 'grant' && action !== 'revoke') {
    return { status: 400, body: { error: "action must be 'grant' or 'revoke'" } }
  }

  const raw: unknown[] = Array.isArray(body.userIds) ? body.userIds : body.userId ? [body.userId] : []
  const userIds = [...new Set(raw.map((v) => String(v || '').trim().toLowerCase()))].filter(Boolean)
  if (!userIds.length) return { status: 400, body: { error: 'Select at least one user' } }
  const malformed = userIds.filter((id) => !UUID_RE.test(id))
  if (malformed.length) return { status: 400, body: { error: `Not a valid user id: ${malformed[0]}` } }
  if (userIds.length > MAX_BATCH_PREMIUM) {
    return { status: 400, body: { error: `Select at most ${MAX_BATCH_PREMIUM} users at a time` } }
  }

  const nowIso = new Date().toISOString()

  if (action === 'revoke') {
    const results = await runPool(userIds, CONCURRENCY, async (id) => {
      const { data, error } = await service.auth.admin.getUserById(id)
      const user = data?.user
      if (error || !user) return { id, email: '', ok: false, error: error?.message || 'User not found' }
      const current = subscriptionOf(user)
      // Tombstone: tier:'free' reads as non-premium everywhere and reopens checkout.
      // The old plan id moves under `previous` so api/_raffle.ts stops counting it.
      const tombstone = {
        tier: 'free' as const,
        source: 'admin' as const,
        revoked_by: identity.email,
        revoked_at: nowIso,
        updated_at: nowIso,
        previous: snapshot(current),
      }
      const { error: updateError } = await service.auth.admin.updateUserById(id, {
        app_metadata: { ...(user.app_metadata || {}), scmpedia_subscription: tombstone },
      })
      if (updateError) return { id, email: user.email || '', ok: false, error: updateError.message }
      await audit(service, 'scmpedia_admin_grants', {
        actor: identity.email,
        action: 'revoke',
        user_id: id,
        email: user.email || '',
        detail: { previous: snapshot(current) },
      })
      return { id, email: user.email || '', ok: true, subscription: tombstone }
    })
    return { status: 200, body: { results, ok: results.every((r) => r.ok) } }
  }

  // GRANT
  const plan = String(body.plan || COMP_PLAN).toLowerCase()
  if (!GRANTABLE_PLANS.has(plan)) return { status: 400, body: { error: `Unknown plan '${plan}'` } }

  const lifetime = body.lifetime === true || String(body.days || '') === 'lifetime'
  if (lifetime && identity.role !== 'master') {
    return { status: 403, body: { error: 'Only a master admin can grant lifetime premium' } }
  }

  const defaultDays = DEFAULT_PLANS[plan]?.duration_days ?? 31
  const days =
    body.days === undefined || body.days === null || body.days === '' ? defaultDays : Math.round(Number(body.days))
  if (!lifetime && (!Number.isFinite(days) || days < 1 || days > MAX_GRANT_DAYS)) {
    return { status: 400, body: { error: `Enter a duration between 1 and ${MAX_GRANT_DAYS} days (or grant lifetime)` } }
  }

  const extend = body.extend !== false // default true: never shorten time a user already has

  const results = await runPool(userIds, CONCURRENCY, async (id) => {
    const { data, error } = await service.auth.admin.getUserById(id)
    const user = data?.user
    if (error || !user) return { id, email: '', ok: false, error: error?.message || 'User not found' }
    const current = subscriptionOf(user)
    const currentExpiry = typeof current?.expires_at === 'string' ? current.expires_at : ''
    const currentActive = isPremium(current)
    const currentLifetime = currentActive && !currentExpiry
    const base =
      extend && currentActive && currentExpiry && new Date(currentExpiry).getTime() > Date.now()
        ? new Date(currentExpiry)
        : new Date()
    const keepLifetime = extend && currentLifetime
    const expiresAt = lifetime || keepLifetime ? undefined : addDaysFrom(base, days)
    const next = {
      tier: 'premium' as const,
      plan,
      ...(expiresAt ? { expires_at: expiresAt } : {}),
      updated_at: new Date().toISOString(),
      source: 'admin' as const,
      granted_by: identity.email,
      granted_at: nowIso,
      ...(current ? { previous: snapshot(current) } : {}),
    }
    const { error: updateError } = await service.auth.admin.updateUserById(id, {
      app_metadata: { ...(user.app_metadata || {}), scmpedia_subscription: next },
    })
    if (updateError) return { id, email: user.email || '', ok: false, error: updateError.message }
    await audit(service, 'scmpedia_admin_grants', {
      actor: identity.email,
      action: 'grant',
      user_id: id,
      email: user.email || '',
      detail: { plan, days: expiresAt ? days : null, lifetime: !expiresAt, expires_at: expiresAt || null },
    })
    return { id, email: user.email || '', ok: true, subscription: next }
  })
  return { status: 200, body: { results, ok: results.every((r) => r.ok) } }
}
