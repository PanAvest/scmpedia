import type { VercelRequest, VercelResponse } from '../vercel-types'
import { createClient } from '@supabase/supabase-js'
import { hasAdminAccess } from '../server-auth.js'
import { DEFAULT_PLANS, loadAllPlans } from '../_plans.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Admin-only pricing management. GET lists every plan; PUT upserts new amounts.
// Only the price (and optional label) can change — tier/period/duration come from
// the known defaults, so the admin can't inject arbitrary plans.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!hasAdminAccess(req)) {
    res.status(401).json({ error: 'Admin sign-in required' })
    return
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Missing server configuration' })
    return
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (req.method === 'GET') {
    const plans = await loadAllPlans(service)
    res.status(200).json({ plans })
    return
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const updates = Array.isArray(req.body?.plans) ? req.body.plans : []
    if (!updates.length) {
      res.status(400).json({ error: 'No plan updates provided' })
      return
    }

    const rows: Array<Record<string, unknown>> = []
    for (const update of updates) {
      const id = String(update?.id || '')
      const base = DEFAULT_PLANS[id]
      if (!base) continue // ignore unknown plan ids
      const amount = Math.round(Number(update?.amount))
      if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ error: `Enter a valid price (greater than 0) for ${base.label}` })
        return
      }
      rows.push({
        id,
        tier: base.tier,
        period: base.period,
        amount,
        duration_days: base.duration_days,
        label: typeof update?.label === 'string' && update.label.trim() ? update.label.trim() : base.label,
        active: update?.active === undefined ? true : Boolean(update.active),
        updated_at: new Date().toISOString(),
      })
    }

    if (!rows.length) {
      res.status(400).json({ error: 'No valid plans to update' })
      return
    }

    const { error } = await service.from('scmpedia_plans').upsert(rows, { onConflict: 'id' })
    if (error) {
      res.status(500).json({
        error: error.message
          ? `Could not save prices: ${error.message}. Has the scmpedia_plans table been created?`
          : 'Could not save prices',
      })
      return
    }

    const plans = await loadAllPlans(service)
    res.status(200).json({ plans })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
