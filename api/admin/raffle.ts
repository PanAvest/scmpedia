import type { VercelRequest, VercelResponse } from '../vercel-types'
import { createClient } from '@supabase/supabase-js'
import { getAdminIdentity } from '../server-auth.js'
import { buildPool, poolResponse, drawResult } from '../_raffle.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identity = getAdminIdentity(req)
  if (!identity) {
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

  try {
    // GET → freeze + commit: the eligible pool and its SHA-256 commitment.
    if (req.method === 'GET') {
      const cutoffIso =
        typeof req.query.cutoff === 'string' && req.query.cutoff ? String(req.query.cutoff) : new Date().toISOString()
      const university = typeof req.query.university === 'string' ? String(req.query.university) : ''
      const drawSize = typeof req.query.drawSize === 'string' ? req.query.drawSize : undefined
      const built = await buildPool(service, { cutoffIso, university })
      res.status(200).json(poolResponse(built, cutoffIso, university, drawSize))
      return
    }

    // POST → reveal: draw from (frozen list + public seed), bound to the commitment.
    if (req.method === 'POST') {
      const { status, body } = await drawResult(service, (req.body || {}) as Record<string, unknown>, identity.email)
      res.status(status).json(body)
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not run the raffle' })
  }
}
