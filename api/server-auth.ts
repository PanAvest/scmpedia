import { createHmac, timingSafeEqual } from 'crypto'
import { createClient, type User } from '@supabase/supabase-js'
import type { VercelRequest } from './vercel-types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const ADMIN_USER = process.env.SCMPEDIA_ADMIN_USER
const ADMIN_PASS = process.env.SCMPEDIA_ADMIN_PASS
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const FREE_DAILY_WORD_LIMIT = 2

const base64Url = (value: string | Buffer) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

const adminSecret = () => process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ADMIN_PASS || ''

const sign = (payload: string) => base64Url(createHmac('sha256', adminSecret()).update(payload).digest())

const constantTimeEqual = (left: string, right: string) => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const hasConfiguredAdmin = () => Boolean(ADMIN_USER && ADMIN_PASS && adminSecret())

export const validateAdminCredentials = (username: string, password: string) =>
  hasConfiguredAdmin() && username === ADMIN_USER && password === ADMIN_PASS

export const createAdminToken = () => {
  const payload = base64Url(
    JSON.stringify({
      sub: 'scmpedia-admin',
      exp: Date.now() + ADMIN_TOKEN_TTL_MS,
    }),
  )
  return `${payload}.${sign(payload)}`
}

export const verifyAdminToken = (token: string) => {
  if (!token || !adminSecret()) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature || !constantTimeEqual(signature, sign(payload))) return false
  try {
    const parsed = JSON.parse(decodeBase64Url(payload))
    return parsed?.sub === 'scmpedia-admin' && Number(parsed?.exp || 0) > Date.now()
  } catch {
    return false
  }
}

export const getBearerToken = (header?: string | string[]) => {
  const match = String(header || '').match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

export const hasAdminAccess = (req: VercelRequest) => verifyAdminToken(getBearerToken(req.headers.authorization))

export const getRequestUser = async (req: VercelRequest) => {
  const token = getBearerToken(req.headers.authorization)
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export const isPremiumUser = (user: User | null) => {
  const subscription = user?.app_metadata?.scmpedia_subscription
  const expiresAt = typeof subscription?.expires_at === 'string' ? subscription.expires_at : ''
  return Boolean(subscription?.tier === 'premium' && (!expiresAt || new Date(expiresAt).getTime() > Date.now()))
}

const requestSubject = (req: VercelRequest, user: User | null) => {
  if (user?.id) return `user:${user.id}`
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim()
  const realIp = String(req.headers['x-real-ip'] || '').trim()
  return `ip:${forwarded || realIp || 'unknown'}`
}

const isUsageStorageMissing = (error: any) => {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('scmpedia_usage')
    || message.includes('does not exist')
    || message.includes('schema cache')
}

export const enforceDailyLimit = async (
  req: VercelRequest,
  serviceClient: any,
  scope = 'word-search',
  maxPerDay = FREE_DAILY_WORD_LIMIT,
) => {
  const user = await getRequestUser(req)
  if (isPremiumUser(user) || hasAdminAccess(req)) return { ok: true, user, remaining: null as number | null }

  const day = new Date().toISOString().slice(0, 10)
  const subject = requestSubject(req, user)
  const { data, error } = await serviceClient
    .from('scmpedia_usage')
    .select('id,count')
    .eq('subject', subject)
    .eq('scope', scope)
    .eq('day', day)
    .maybeSingle()

  if (error) {
    if (isUsageStorageMissing(error)) return { ok: true, user, remaining: null as number | null }
    return {
      ok: false,
      user,
      status: 500,
      error: 'Could not check usage limit.',
      remaining: 0,
    }
  }

  const currentCount = Number(data?.count || 0)
  if (currentCount >= maxPerDay) {
    return {
      ok: false,
      user,
      status: 429,
      error: `Free users can search ${maxPerDay} words per day. Upgrade for unlimited access.`,
      remaining: 0,
    }
  }

  const nextCount = currentCount + 1
  const payload = {
    subject,
    scope,
    day,
    count: nextCount,
    updated_at: new Date().toISOString(),
  }
  const write = data?.id
    ? await serviceClient.from('scmpedia_usage').update(payload).eq('id', data.id)
    : await serviceClient.from('scmpedia_usage').insert(payload)

  if (write.error) {
    if (isUsageStorageMissing(write.error)) return { ok: true, user, remaining: null as number | null }
    return { ok: false, user, status: 500, error: 'Could not update usage limit.', remaining: 0 }
  }

  return { ok: true, user, remaining: maxPerDay - nextCount }
}
