import { createHmac, timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '../vercel-types'
import { loadPlan } from '../_plans.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

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
  const validSignature = /^[a-f0-9]{128}$/i.test(actual) && timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
  if (!validSignature) {
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
  const planId = String(metadata.plan || '').toLowerCase()
  const userId = String(metadata.user_id || '')
  const reference = String(payment.reference || '')

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const plan = await loadPlan(admin, planId)
  // Validate against the amount locked in at checkout time (metadata), not the current
  // (possibly admin-edited) price. Fall back to the plan amount for older references.
  const expectedAmount = Number(metadata.amount) > 0 ? Number(metadata.amount) : plan?.amount
  if (
    !plan ||
    !userId ||
    !reference ||
    Number(payment.amount) !== expectedAmount ||
    String(payment.currency || '').toUpperCase() !== 'GHS'
  ) {
    res.status(200).json({ received: true, ignored: true })
    return
  }

  const paidExpiry = addDays(plan.duration_days)
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  if (userError || !userData.user) {
    res.status(200).json({ received: true, ignored: true })
    return
  }
  // Keep the later end date; preserve a lifetime admin comp as lifetime.
  const existingSub = (userData.user?.app_metadata as Record<string, any> | undefined)?.scmpedia_subscription
  const existingExpiry = typeof existingSub?.expires_at === 'string' ? existingSub.expires_at : ''
  const existingActive = existingSub?.tier === 'premium' && (!existingExpiry || new Date(existingExpiry).getTime() > Date.now())
  const expiresAt = existingActive && !existingExpiry
    ? undefined
    : existingActive && existingExpiry && new Date(existingExpiry).getTime() > new Date(paidExpiry).getTime()
      ? existingExpiry
      : paidExpiry
  const { error: paymentError } = await admin.from('scmpedia_payments').upsert(
    {
      reference,
      user_id: userId,
      user_email: userData.user?.email || '',
      plan: planId,
      amount: Number(payment.amount),
      currency: String(payment.currency || 'GHS'),
      status: String(payment.status || 'success'),
      raw: payment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'reference' },
  )
  if (paymentError) {
    res.status(500).json({ error: 'Could not record payment' })
    return
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...(userData.user?.app_metadata || {}),
      scmpedia_subscription: {
        tier: 'premium',
        plan: planId,
        paystack_reference: reference,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
        updated_at: new Date().toISOString(),
      },
    },
  })
  if (updateError) {
    res.status(500).json({ error: 'Could not activate subscription' })
    return
  }

  res.status(200).json({ received: true })
}
