import type { VercelRequest, VercelResponse } from './vercel-types'
import { createClient } from '@supabase/supabase-js'
import { loadUniversityAdditions } from './_universities.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Public, read-only: the admin-approved additions to the university picker. The client
// merges these with the compiled seed list (src/data/universities.ts). Only the DB rows
// go over the wire — usually a handful — and the seed is never sent.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let service = null
  try {
    service = SUPABASE_URL && SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
      : null
  } catch {
    service = null // degrade to the seed list rather than 500
  }

  let additions: { country_code: string; name: string }[] = []
  try {
    if (service) {
      additions = (await loadUniversityAdditions(service)).map((u) => ({ country_code: u.country_code, name: u.name }))
    }
  } catch {
    additions = []
  }

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400')
  res.status(200).json({ additions })
}
