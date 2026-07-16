import type { VercelRequest, VercelResponse } from '../vercel-types'
import { getAdminIdentity } from '../server-auth.js'
import { collectPaystackFinance, hasPaystackConfig } from '../_finance.js'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

// Paginated Paystack pulls can take a moment.
export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identity = getAdminIdentity(req)
  if (!identity) {
    res.status(401).json({ error: 'Admin sign-in required' })
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!hasPaystackConfig(PAYSTACK_SECRET_KEY)) {
    res.status(503).json({ error: 'Paystack is not configured on the server.' })
    return
  }
  try {
    const finance = await collectPaystackFinance(PAYSTACK_SECRET_KEY as string)
    res.status(200).json({ finance })
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Could not reach Paystack' })
  }
}
