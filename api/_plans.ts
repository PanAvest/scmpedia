import type { SupabaseClient } from '@supabase/supabase-js'

// supabase-js builds a realtime client at construction, which needs a global WebSocket.
// Node < 22 has none; we only ever use HTTP (.from()) queries, never realtime. A stub
// keeps createClient() from throwing at construction (it is never instantiated). Every
// pricing/payment endpoint imports this module, so the guard runs before their createClient.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  ;(globalThis as { WebSocket?: unknown }).WebSocket = class {}
}

export type PlanPeriod = 'monthly' | 'annual'
export type PlanTier = 'student' | 'pro'

export type PlanRow = {
  id: string
  tier: PlanTier
  period: PlanPeriod
  amount: number // price in pesewas (GHS * 100)
  duration_days: number
  label: string
  active: boolean
}

// Single source of truth for default pricing. Used everywhere as a fallback so
// checkout keeps working even before the editable `scmpedia_plans` table exists.
export const DEFAULT_PLANS: Record<string, PlanRow> = {
  'student-monthly': { id: 'student-monthly', tier: 'student', period: 'monthly', amount: 500, duration_days: 31, label: 'SCMPEDIA Student · Monthly', active: true },
  'student-annual': { id: 'student-annual', tier: 'student', period: 'annual', amount: 5000, duration_days: 366, label: 'SCMPEDIA Student · Annual', active: true },
  'pro-monthly': { id: 'pro-monthly', tier: 'pro', period: 'monthly', amount: 1200, duration_days: 31, label: 'SCMPEDIA Professional · Monthly', active: true },
  'pro-annual': { id: 'pro-annual', tier: 'pro', period: 'annual', amount: 12000, duration_days: 366, label: 'SCMPEDIA Professional · Annual', active: true },
}

// Normalise a raw DB row into a fully-typed PlanRow, filling gaps from defaults.
const coerceRow = (id: string, row: Record<string, unknown> | null | undefined): PlanRow => {
  const fallback = DEFAULT_PLANS[id]
  const rawAmount = Number(row?.amount)
  const rawDuration = Number(row?.duration_days)
  return {
    id,
    tier: row?.tier === 'student' || row?.tier === 'pro' ? row.tier : fallback?.tier ?? 'pro',
    period: row?.period === 'monthly' || row?.period === 'annual' ? row.period : fallback?.period ?? 'monthly',
    amount: Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount) : fallback?.amount ?? 0,
    duration_days: Number.isFinite(rawDuration) && rawDuration > 0 ? Math.round(rawDuration) : fallback?.duration_days ?? 31,
    label: typeof row?.label === 'string' && row.label.trim() ? row.label.trim() : fallback?.label ?? id,
    active: row?.active === undefined || row?.active === null ? fallback?.active ?? true : Boolean(row.active),
  }
}

// Load a single plan, preferring the DB row and falling back to defaults when the
// table/row is missing or any error occurs (so payments never break on infra issues).
export async function loadPlan(service: SupabaseClient | null, id: string): Promise<PlanRow | null> {
  const fallback = DEFAULT_PLANS[id] ?? null
  if (!service) return fallback
  try {
    const { data, error } = await service.from('scmpedia_plans').select('*').eq('id', id).maybeSingle()
    if (error || !data) return fallback
    return coerceRow(id, data as Record<string, unknown>)
  } catch {
    return fallback
  }
}

// Load every plan, merging DB overrides on top of the defaults.
export async function loadAllPlans(service: SupabaseClient | null): Promise<PlanRow[]> {
  const merged: Record<string, PlanRow> = { ...DEFAULT_PLANS }
  if (service) {
    try {
      const { data, error } = await service.from('scmpedia_plans').select('*')
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const id = String((row as Record<string, unknown>)?.id ?? '')
          if (id) merged[id] = coerceRow(id, row as Record<string, unknown>)
        }
      }
    } catch {
      /* fall through to defaults */
    }
  }
  return Object.values(merged).sort((a, b) => a.amount - b.amount)
}
