import type { VercelRequest, VercelResponse } from './vercel-types'
import { loadCurrencyRates } from './_currency.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const payload = await loadCurrencyRates()
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400')
    res.status(200).json(payload)
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Exchange rates are temporarily unavailable.',
    })
  }
}
