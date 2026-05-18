import type { VercelRequest, VercelResponse } from '../vercel-types'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

const plans = {
  monthly: { amount: 2258, label: 'SCMPEDIA Monthly', durationDays: 31 },
  annual: { amount: 22578, label: 'SCMPEDIA Annual', durationDays: 366 },
} as const

type PlanId = keyof typeof plans

const getBearerToken = (header?: string | string[]) => {
  const match = String(header || '').match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PAYSTACK_SECRET_KEY) {
    res.status(500).json({ error: 'Missing payment server configuration' })
    return
  }

  const planId = String(req.body?.plan || '').toLowerCase() as PlanId
  const plan = plans[planId]
  if (!plan) {
    res.status(400).json({ error: 'Invalid subscription plan' })
    return
  }

  const token = getBearerToken(req.headers.authorization)
  if (!token) {
    res.status(401).json({ error: 'Sign in before subscribing' })
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user?.email) {
    res.status(401).json({ error: 'Could not verify signed-in user' })
    return
  }

  const subscription = userData.user.app_metadata?.scmpedia_subscription
  const expiresAt = typeof subscription?.expires_at === 'string' ? subscription.expires_at : ''
  if (subscription?.tier === 'premium' && (!expiresAt || new Date(expiresAt).getTime() > Date.now())) {
    res.status(409).json({ error: expiresAt ? `You are paid until ${new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. You can change plans after your current plan expires.` : 'You already have an active premium plan.' })
    return
  }

  const origin = String(req.headers.origin || `https://${req.headers.host}`)
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: plan.amount,
      email: userData.user.email,
      currency: 'GHS',
      callback_url: origin,
      metadata: {
        user_id: userData.user.id,
        plan: planId,
        duration_days: plan.durationDays,
        product: 'scmpedia-premium',
      },
    }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body?.status || !body?.data?.authorization_url) {
    res.status(502).json({ error: body?.message || 'Could not initialize checkout' })
    return
  }

  res.status(200).json({
    authorizationUrl: body.data.authorization_url,
    reference: body.data.reference,
  })
}
