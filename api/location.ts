import type { VercelRequest, VercelResponse } from './vercel-types'
import { currencyForCountry } from './_currency.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const rawCountry = req.headers['x-vercel-ip-country']
  const country = String(Array.isArray(rawCountry) ? rawCountry[0] : rawCountry || '').trim().toUpperCase() || null
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.status(200).json({
    country,
    currency: currencyForCountry(country),
    detected: Boolean(country),
  })
}
