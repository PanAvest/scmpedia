import './_runtime.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { loadAllPlans } from './_plans.js'

// Shared raffle core. Imported by BOTH the Vercel handler (api/admin/raffle.ts)
// and the Vite dev middleware (vite.config.ts) so the draw is computed by exactly
// the same code in dev and production — no drift between the two.

export const DRAW_SIZE = 30

export type RaffleEntry = {
  user_id: string
  name: string
  email: string
  university: string
  index_number: string
  index_masked: string
  programme: string
  plan: string
  paid_at: string
}

// --- Deterministic PRNG (mirrored in src/components/RaffleDrawMode.tsx) --------
function xmur3(str: string) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}
function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function seededOrder<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(xmur3(seed)())
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

export const maskIndex = (idx: string) => {
  const s = String(idx || '').trim()
  return s.length <= 4 ? s : '•••' + s.slice(-4)
}

// How many winners to draw — admin-chosen, defaulting to 30, capped for sanity.
export function normalizeDrawSize(n: unknown): number {
  const v = Math.floor(Number(n))
  return Number.isFinite(v) && v > 0 ? Math.min(v, 500) : DRAW_SIZE
}

// SHA-256 over the canonical, ordered entry list — the commit-reveal commitment.
export function commitmentOf(entries: RaffleEntry[]) {
  const canonical = entries.map((e) => `${e.user_id}|${e.index_number}|${e.plan}`).join('\n')
  return createHash('sha256').update(canonical).digest('hex')
}

export const publicEntry = (e: RaffleEntry) => ({
  user_id: e.user_id,
  name: e.name,
  email: e.email,
  university: e.university,
  programme: e.programme,
  plan: e.plan,
  index_number: e.index_number,
  index_masked: e.index_masked,
  paid_at: e.paid_at,
})

const isMissingTable = (error: any) => {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('scmpedia_payments') ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  )
}

// Build the frozen eligible pool: verified students who paid for a Student plan
// on or before the cutoff, one entry per person, optionally narrowed to a school.
//
// Eligibility is read primarily from each user's `scmpedia_subscription` (which the
// Paystack flow always writes on success), and — when present — enriched with the
// `scmpedia_payments` audit table for exact payment timestamps. The payments table
// is optional: if it hasn't been created, the draw still works off subscriptions.
export async function buildPool(
  service: SupabaseClient,
  opts: { cutoffIso: string; university: string },
): Promise<{
  entries: RaffleEntry[]
  excludedUnverified: number
  universities: { name: string; count: number }[]
  paymentsTableMissing: boolean
}> {
  const plans = await loadAllPlans(service)
  const studentPlanIds = new Set<string>(plans.filter((p) => p.tier === 'student').map((p) => p.id))
  studentPlanIds.add('student-monthly')
  studentPlanIds.add('student-annual')

  // 1. Optional: successful Student-plan payments (authoritative timestamps).
  const paidByUser = new Map<string, { plan: string; created_at: string }>()
  let paymentsTableMissing = false
  try {
    let query = service
      .from('scmpedia_payments')
      .select('user_id, plan, status, created_at')
      .eq('status', 'success')
      .in('plan', [...studentPlanIds])
    if (opts.cutoffIso) query = query.lte('created_at', opts.cutoffIso)
    const { data: payments, error } = await query
    if (error) {
      if (isMissingTable(error)) paymentsTableMissing = true
      else throw new Error(`Could not read payments: ${error.message}`)
    } else {
      for (const p of payments || []) {
        const uid = String((p as any).user_id || '')
        if (!uid) continue
        const created = String((p as any).created_at || '')
        const prev = paidByUser.get(uid)
        if (!prev || created < prev.created_at) paidByUser.set(uid, { plan: String((p as any).plan || ''), created_at: created })
      }
    }
  } catch (err) {
    if (isMissingTable(err)) paymentsTableMissing = true
    else throw err
  }

  // 2. Walk every user; a verified student who holds a Student-plan subscription
  //    (or has a payment row) and paid on/before the cutoff is eligible.
  const targetUni = String(opts.university || '').trim()
  const uniCounts = new Map<string, number>()
  let excludedUnverified = 0
  const all: RaffleEntry[] = []
  const perPage = 200
  for (let page = 1; page <= 50; page++) {
    const { data, error: listErr } = await service.auth.admin.listUsers({ page, perPage })
    if (listErr) throw new Error(`Could not list users: ${listErr.message}`)
    const users = data?.users || []
    for (const u of users) {
      const sub = (u.app_metadata as Record<string, any> | undefined)?.scmpedia_subscription
      const subPlan = String(sub?.plan || '')
      const paidRow = paidByUser.get(u.id)
      // Admin comps (source:'admin') never paid — keep them out of the paid raffle pool.
      const paidViaSub = studentPlanIds.has(subPlan) && sub?.source !== 'admin'
      if (!paidRow && !paidViaSub) continue // didn't pay for a Student plan

      const md = (u.user_metadata || {}) as Record<string, any>
      const university = String(md.student_university || '').trim()
      const indexNumber = String(md.student_index_number || '').trim()
      if (!university || !indexNumber) {
        excludedUnverified++ // paid, but hasn't completed student verification (no school)
        continue
      }

      const paidAt = paidRow?.created_at || String(sub?.updated_at || '') || String(md.student_verified_at || '') || String(u.created_at || '')
      if (opts.cutoffIso && paidAt && paidAt > opts.cutoffIso) continue // paid after the cutoff

      uniCounts.set(university, (uniCounts.get(university) || 0) + 1)
      all.push({
        user_id: u.id,
        name: String(md.full_name || u.email || '').trim(),
        email: String(u.email || ''),
        university,
        index_number: indexNumber,
        index_masked: maskIndex(indexNumber),
        programme: String(md.student_programme || ''),
        plan: paidRow?.plan || subPlan,
        paid_at: paidAt,
      })
    }
    if (users.length < perPage) break
  }

  const universities = [...uniCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  let entries = all
  if (targetUni && targetUni.toUpperCase() !== 'ALL') entries = all.filter((e) => e.university === targetUni)

  // Stable, unique canonical order (by user id) — same on every recompute.
  entries.sort((a, b) => (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0))
  return { entries, excludedUnverified, universities, paymentsTableMissing }
}

// Shared response builders so the handler and dev mirror return identical shapes.
export function poolResponse(
  built: {
    entries: RaffleEntry[]
    excludedUnverified: number
    universities: { name: string; count: number }[]
    paymentsTableMissing: boolean
  },
  cutoffIso: string,
  university: string,
  drawSize?: unknown,
) {
  const requested = normalizeDrawSize(drawSize)
  return {
    cutoff: cutoffIso,
    university: university || 'ALL',
    drawSize: requested,
    poolSize: built.entries.length,
    drawCount: Math.min(requested, built.entries.length),
    commitment: commitmentOf(built.entries),
    excludedUnverified: built.excludedUnverified,
    paymentsTableMissing: built.paymentsTableMissing,
    universities: built.universities,
    entries: built.entries.map(publicEntry),
  }
}

// Returns { status, body } — the reveal, with commitment binding + seed handling.
export async function drawResult(
  service: SupabaseClient,
  body: { seed?: unknown; cutoff?: unknown; university?: unknown; commitment?: unknown; drawSize?: unknown },
  drawnBy: string,
): Promise<{ status: number; body: any }> {
  const seed = String(body.seed || '').trim()
  if (!seed) return { status: 400, body: { error: 'Enter a public seed before drawing (e.g. a lottery result or block hash).' } }

  const cutoffIso = String(body.cutoff || '') || new Date().toISOString()
  const university = String(body.university || '')
  const { entries } = await buildPool(service, { cutoffIso, university })
  if (!entries.length) return { status: 400, body: { error: 'No eligible students to draw from for this selection yet.' } }

  const commitment = commitmentOf(entries)
  const expectedCommitment = String(body.commitment || '')
  if (expectedCommitment && expectedCommitment !== commitment) {
    return {
      status: 409,
      body: { error: 'The eligible pool changed since the commitment was published. Reload the pool, publish the new commitment, then draw.' },
    }
  }

  const drawCount = Math.min(normalizeDrawSize(body.drawSize), entries.length)
  const winners = seededOrder(entries, seed)
    .slice(0, drawCount)
    .map((e, i) => ({ rank: i + 1, ...publicEntry(e) }))

  // Best-effort immutable audit trail (run supabase-raffle.sql to enable).
  try {
    await service.from('scmpedia_raffle_draws').insert({
      seed,
      cutoff: cutoffIso,
      university: university || 'ALL',
      commitment,
      pool_size: entries.length,
      draw_size: drawCount,
      winners,
      drawn_by: drawnBy || 'admin',
      // A recorded draw is a published, provably-fair commitment — its winners become
      // protected from deletion. (Historical test draws default to false via migration.)
      published: true,
    })
  } catch {
    /* audit table optional */
  }

  return { status: 200, body: { cutoff: cutoffIso, university: university || 'ALL', seed, commitment, poolSize: entries.length, drawCount, winners } }
}
