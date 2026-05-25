import type { VercelRequest, VercelResponse } from '../vercel-types'
import { createAdminToken, hasConfiguredAdmin, validateAdminCredentials } from '../server-auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!hasConfiguredAdmin()) {
    res.status(500).json({ error: 'Admin credentials are not configured on the server' })
    return
  }

  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')
  if (!validateAdminCredentials(username, password)) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  res.status(200).json({ token: createAdminToken() })
}
