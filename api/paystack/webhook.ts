import { createHmac } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '../vercel-types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

const plans = {
  monthly: { amount: 2258, durationDays: 31 },
  annual: { amount: 22578, durationDays: 366 },
} as const

type PlanId = keyof typeof plans

const addDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

const rawBody = (body: unknown) => (typeof body === 'string' ? body : JSON.stringify(body || {}))

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PAYSTACK_SECRET_KEY) {
    res.status(500).json({ error: 'Missing webhook server configuration' })
    return
  }

  const bodyText = rawBody(req.body)
  const expected = createHmac('sha512', PAYSTACK_SECRET_KEY).update(bodyText).digest('hex')
  const actual = String(req.headers['x-paystack-signature'] || '')
  if (!actual || actual !== expected) {
    res.status(401).json({ error: 'Invalid webhook signature' })
    return
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  if (event.event !== 'charge.success') {
    res.status(200).json({ received: true })
    return
  }

  const payment = event.data || {}
  const metadata = payment.metadata || {}
  const planId = String(metadata.plan || '').toLowerCase() as PlanId
  const plan = plans[planId]
  const userId = String(metadata.user_id || '')
  const reference = String(payment.reference || '')
  if (!plan || !userId || !reference || Number(payment.amount) !== plan.amount) {
    res.status(200).json({ received: true, ignored: true })
    return
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const expiresAt = addDays(plan.durationDays)
  await admin.from('scmpedia_payments').upsert(
    {
      reference,
      user_id: userId,
      plan: planId,
      amount: Number(payment.amount),
      currency: String(payment.currency || 'GHS'),
      status: String(payment.status || 'success'),
      raw: payment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'reference' },
  )

  const { data: userData } = await admin.auth.admin.getUserById(userId)
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...(userData.user?.app_metadata || {}),
      scmpedia_subscription: {
        tier: 'premium',
        plan: planId,
        paystack_reference: reference,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
    },
  })

  res.status(200).json({ received: true })
}
