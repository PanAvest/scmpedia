import type { VercelRequest, VercelResponse } from '../vercel-types'
import { createClient } from '@supabase/supabase-js'
import { getAdminIdentity } from '../server-auth.js'
import { collectStudents } from '../_students.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Read-only list of users who completed student verification, plus the custom
// university names they typed. Any valid admin may view it.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
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
    const { students, customUniversities } = await collectStudents(service)
    res.status(200).json({ students, customUniversities })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not load students' })
  }
}
