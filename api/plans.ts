import type { VercelRequest, VercelResponse } from './vercel-types'
import { createClient } from '@supabase/supabase-js'
import { loadAllPlans } from './_plans.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Public, read-only pricing for the marketing/pricing page. Amounts are in pesewas;
// `price` is the same value in cedis for convenience.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const service = SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null

  const plans = (await loadAllPlans(service)).filter((p) => p.active)
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300')
  res.status(200).json({
    currency: 'GHS',
    plans: plans.map((p) => ({
      id: p.id,
      tier: p.tier,
      period: p.period,
      amount: p.amount,
      price: p.amount / 100,
      label: p.label,
    })),
  })
}
