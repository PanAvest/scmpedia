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

  // 1) Table-based admin accounts (looked up by email). Also tells us whether any
  //    admin exists at all, which gates the env bootstrap below.
  let adminTableReadable = false
  let adminCount = 0
  if (SUPABASE_URL && SERVICE_ROLE_KEY) {
    try {
      const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { count, error: countError } = await service
        .from('scmpedia_admins')
        .select('id', { count: 'exact', head: true })
      if (!countError) {
        adminTableReadable = true
        adminCount = count || 0
      }

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

  // 2) Env bootstrap admin. It mints a MASTER token, so it is only allowed to
  //    bootstrap the FIRST account — once any admin exists in the table, the
  //    static SCMPEDIA_ADMIN_USER/PASS credential is dead. This stops a leaked or
  //    guessed default (e.g. admin/admin) from being a permanent master backdoor.
  const bootstrapAllowed = !adminTableReadable || adminCount === 0
  if (bootstrapAllowed && validateAdminCredentials(username, password)) {
    res.status(200).json({ token: createAdminToken({ email: username, role: 'master' }), email: username, role: 'master' })
    return
  }

  res.status(401).json({ error: 'Invalid credentials' })
}
