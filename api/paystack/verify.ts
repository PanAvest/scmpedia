import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

const plans = {
  monthly: { amount: 2258, durationDays: 31 },
  annual: { amount: 22578, durationDays: 366 },
} as const

type PlanId = keyof typeof plans

const getBearerToken = (header?: string) => {
  const match = String(header || '').match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

const addDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY || !PAYSTACK_SECRET_KEY) {
    res.status(500).json({ error: 'Missing payment server configuration' })
    return
  }

  const reference = String(req.body?.reference || '').trim()
  if (!reference) {
    res.status(400).json({ error: 'Missing payment reference' })
    return
  }

  const token = getBearerToken(req.headers.authorization)
  if (!token) {
    res.status(401).json({ error: 'Sign in to verify payment' })
    return
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Could not verify signed-in user' })
    return
  }

  const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  })
  const payment = await paystackResponse.json().catch(() => ({}))
  if (!paystackResponse.ok || !payment?.status || payment?.data?.status !== 'success') {
    res.status(402).json({ error: payment?.message || 'Payment has not been completed' })
    return
  }

  const metadata = payment.data.metadata || {}
  const planId = String(metadata.plan || '').toLowerCase() as PlanId
  const plan = plans[planId]
  if (!plan || metadata.user_id !== userData.user.id || Number(payment.data.amount) !== plan.amount) {
    res.status(400).json({ error: 'Payment does not match this subscription' })
    return
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const expiresAt = addDays(plan.durationDays)
  const { error: updateError } = await admin.auth.admin.updateUserById(userData.user.id, {
    app_metadata: {
      ...(userData.user.app_metadata || {}),
      scmpedia_subscription: {
        tier: 'premium',
        plan: planId,
        paystack_reference: reference,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
    },
  })

  if (updateError) {
    res.status(500).json({ error: updateError.message || 'Could not activate subscription' })
    return
  }

  res.status(200).json({ tier: 'premium', plan: planId, expiresAt })
}
