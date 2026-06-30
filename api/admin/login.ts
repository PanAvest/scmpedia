import type { VercelRequest, VercelResponse } from '../vercel-types'
import { createClient } from '@supabase/supabase-js'
import { createAdminToken, validateAdminCredentials, verifyPassword } from '../server-auth.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' })
    return
  }

  // 1) Table-based admin accounts (looked up by email).
  if (SUPABASE_URL && SERVICE_ROLE_KEY) {
    try {
      const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data, error } = await service
        .from('scmpedia_admins')
        .select('email,password_hash,role')
        .eq('email', username.toLowerCase())
        .maybeSingle()
      if (!error && data && verifyPassword(password, String(data.password_hash))) {
        const role = data.role === 'master' ? 'master' : 'admin'
        res.status(200).json({ token: createAdminToken({ email: String(data.email), role }), email: String(data.email), role })
        return
      }
    } catch {
      // table missing or infra issue → fall through to the env bootstrap admin
    }
  }

  // 2) Env bootstrap admin (always a master, used to set up the first accounts).
  if (validateAdminCredentials(username, password)) {
    res.status(200).json({ token: createAdminToken({ email: username, role: 'master' }), email: username, role: 'master' })
    return
  }

  res.status(401).json({ error: 'Invalid credentials' })
}
