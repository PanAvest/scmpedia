import type { VercelRequest, VercelResponse } from '../vercel-types'
import { createClient } from '@supabase/supabase-js'
import { getAdminIdentity, hashPassword } from '../server-auth.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TABLE_HELP = 'Has the scmpedia_admins table been created? Run supabase-admins.sql.'

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

// Admin account management. GET (any admin) lists accounts; POST/DELETE (master only)
// add/remove; PATCH changes a password (own for anyone, others for master).
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
  const listAll = () => service.from('scmpedia_admins').select('id,email,role,created_at').order('created_at', { ascending: true })

  if (req.method === 'GET') {
    const { data, error } = await listAll()
    if (error) {
      res.status(500).json({ error: `Could not load admins: ${error.message}. ${TABLE_HELP}` })
      return
    }
    res.status(200).json({ me: identity, admins: data || [] })
    return
  }

  if (req.method === 'POST') {
    if (identity.role !== 'master') {
      res.status(403).json({ error: 'Only a master admin can add accounts' })
      return
    }
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    const role = req.body?.role === 'master' ? 'master' : 'admin'
    if (!isEmail(email)) {
      res.status(400).json({ error: 'Enter a valid email address' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' })
      return
    }
    const { error } = await service
      .from('scmpedia_admins')
      .insert({ email, password_hash: hashPassword(password), role, updated_at: new Date().toISOString() })
    if (error) {
      if (String(error.code) === '23505') {
        res.status(409).json({ error: 'An admin with that email already exists' })
        return
      }
      res.status(500).json({ error: `Could not add admin: ${error.message}. ${TABLE_HELP}` })
      return
    }
    const { data } = await listAll()
    res.status(200).json({ me: identity, admins: data || [] })
    return
  }

  if (req.method === 'PATCH') {
    const targetEmail = String(req.body?.email || identity.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' })
      return
    }
    if (targetEmail !== identity.email.toLowerCase() && identity.role !== 'master') {
      res.status(403).json({ error: "Only a master admin can change another account's password" })
      return
    }
    const { data: rows, error } = await service
      .from('scmpedia_admins')
      .update({ password_hash: hashPassword(password), updated_at: new Date().toISOString() })
      .eq('email', targetEmail)
      .select('id')
    if (error) {
      res.status(500).json({ error: `Could not change password: ${error.message}. ${TABLE_HELP}` })
      return
    }
    if (!rows || !rows.length) {
      res.status(404).json({ error: "That account isn't in the database. The bootstrap admin/admin password is set in Vercel env vars, not here." })
      return
    }
    res.status(200).json({ ok: true })
    return
  }

  if (req.method === 'DELETE') {
    if (identity.role !== 'master') {
      res.status(403).json({ error: 'Only a master admin can delete accounts' })
      return
    }
    const id = String(req.body?.id || '')
    const email = String(req.body?.email || '').trim().toLowerCase()
    const lookup = id
      ? service.from('scmpedia_admins').select('id,email,role').eq('id', id).maybeSingle()
      : service.from('scmpedia_admins').select('id,email,role').eq('email', email).maybeSingle()
    const { data: target } = await lookup
    if (!target) {
      res.status(404).json({ error: 'Admin account not found' })
      return
    }
    if (String(target.email).toLowerCase() === identity.email.toLowerCase()) {
      res.status(400).json({ error: 'You cannot delete your own account' })
      return
    }
    if (target.role === 'master') {
      const { count } = await service.from('scmpedia_admins').select('id', { count: 'exact', head: true }).eq('role', 'master')
      if ((count || 0) <= 1) {
        res.status(400).json({ error: 'Cannot delete the last master admin' })
        return
      }
    }
    const { error } = await service.from('scmpedia_admins').delete().eq('id', target.id)
    if (error) {
      res.status(500).json({ error: `Could not delete admin: ${error.message}` })
      return
    }
    const { data } = await listAll()
    res.status(200).json({ me: identity, admins: data || [] })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
