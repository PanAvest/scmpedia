import './_runtime.js'

// Pulls authoritative revenue straight from Paystack and separates SCMpedia subscription
// income from everything else on the account. This Paystack account is shared across
// products (courses, ebooks, SCMpedia), so Paystack's own "Revenue" figure is account-wide
// and will always be larger than SCMpedia-only income — that gap is the thing to explain,
// not a bug.
//
// SCMpedia checkouts are tagged in metadata.product = 'scmpedia-premium' (see
// api/paystack/initialize.ts), which is how we pick them out.

export type PlanBucket = { count: number; gross: number; fees: number }

export type FinanceSummary = {
  currency: string
  // SCMpedia subscription income only (product === 'scmpedia-premium')
  scmpedia: {
    gross: number // GHS the customers paid
    fees: number // Paystack's cut
    net: number // what actually settles to the bank
    count: number
    byPlan: Record<string, PlanBucket>
  }
  // The whole Paystack account, all products — this is what Paystack's dashboard shows.
  account: {
    gross: number
    fees: number
    net: number
    count: number
  }
  feeRatePct: number // effective Paystack fee % on SCMpedia income
  mode: 'live' | 'test' | 'unknown'
  fetchedPages: number
  truncated: boolean // true if we hit the page cap and there may be more
}

const PESEWAS = 100
const PER_PAGE = 100
const MAX_PAGES = 25 // 2,500 transactions — plenty of headroom; guards runaway loops

export const hasPaystackConfig = (secret?: string) => Boolean(secret)

export async function collectPaystackFinance(secretKey: string): Promise<FinanceSummary> {
  const summary: FinanceSummary = {
    currency: 'GHS',
    scmpedia: { gross: 0, fees: 0, net: 0, count: 0, byPlan: {} },
    account: { gross: 0, fees: 0, net: 0, count: 0 },
    feeRatePct: 0,
    mode: secretKey.startsWith('sk_live') ? 'live' : secretKey.startsWith('sk_test') ? 'test' : 'unknown',
    fetchedPages: 0,
    truncated: false,
  }
  const headers = { Authorization: `Bearer ${secretKey}` }

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `https://api.paystack.co/transaction?status=success&perPage=${PER_PAGE}&page=${page}`,
      { headers },
    )
    const body = (await res.json().catch(() => ({}))) as {
      status?: boolean
      data?: unknown[]
      meta?: { total?: number; pageCount?: number }
      message?: string
    }
    if (!res.ok || !body.status) {
      throw new Error(body.message || `Paystack request failed (HTTP ${res.status})`)
    }
    const rows = Array.isArray(body.data) ? body.data : []
    summary.fetchedPages = page

    for (const raw of rows) {
      const t = raw as {
        amount?: number
        fees?: number
        currency?: string
        metadata?: Record<string, unknown> | null
      }
      const gross = (Number(t.amount) || 0) / PESEWAS
      const fees = (Number(t.fees) || 0) / PESEWAS
      summary.account.gross += gross
      summary.account.fees += fees
      summary.account.count += 1

      const meta = (t.metadata || {}) as Record<string, unknown>
      if (String(meta.product || '') !== 'scmpedia-premium') continue

      summary.scmpedia.gross += gross
      summary.scmpedia.fees += fees
      summary.scmpedia.count += 1
      const plan = String(meta.plan || 'unknown')
      const bucket = summary.scmpedia.byPlan[plan] || { count: 0, gross: 0, fees: 0 }
      bucket.count += 1
      bucket.gross += gross
      bucket.fees += fees
      summary.scmpedia.byPlan[plan] = bucket
    }

    const pageCount = body.meta?.pageCount ?? (rows.length < PER_PAGE ? page : page + 1)
    if (rows.length < PER_PAGE || page >= pageCount) break
    if (page === MAX_PAGES) summary.truncated = true
  }

  summary.scmpedia.net = summary.scmpedia.gross - summary.scmpedia.fees
  summary.account.net = summary.account.gross - summary.account.fees
  summary.feeRatePct = summary.scmpedia.gross > 0 ? (summary.scmpedia.fees / summary.scmpedia.gross) * 100 : 0
  return summary
}
