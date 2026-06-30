import type { VercelRequest, VercelResponse } from '../vercel-types'
import { createClient } from '@supabase/supabase-js'
import { getBearerToken } from '../server-auth.js'
import { loadPlan } from '../_plans.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PAYSTACK_SECRET_KEY) {
    res.status(500).json({ error: 'Missing payment server configuration' })
    return
  }

  const planId = String(req.body?.plan || '').toLowerCase()

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

  const planService = SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null
  const plan = await loadPlan(planService, planId)
  if (!plan || !plan.active) {
    res.status(400).json({ error: 'Invalid subscription plan' })
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
        amount: plan.amount,
        duration_days: plan.duration_days,
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
