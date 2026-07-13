import type { VercelRequest, VercelResponse } from '../vercel-types'
import { createClient } from '@supabase/supabase-js'
import { getAdminIdentity } from '../server-auth.js'
import { loadUniversityAdditions, addUniversity, deleteUniversity } from '../_universities.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Admin management of the university additions. Any admin may add/remove; the curated
// seed list in src/data/universities.ts is never touched.
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
    if (req.method === 'GET') {
      const universities = await loadUniversityAdditions(service)
      res.status(200).json({ universities })
      return
    }
    if (req.method === 'POST') {
      const out = await addUniversity(service, identity, req.body || {})
      res.status(out.status).json(out.body)
      return
    }
    if (req.method === 'DELETE') {
      const id = String((req.query as Record<string, unknown>)?.id || req.body?.id || '')
      const out = await deleteUniversity(service, id)
      res.status(out.status).json(out.body)
      return
    }
    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not complete the request' })
  }
}
