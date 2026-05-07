import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const getSingle = (value: string | string[] | undefined) => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return String(value[0] || '').trim()
  return ''
}

const client =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!client) {
    res.status(500).json({ error: 'Missing Supabase service configuration' })
    return
  }

  const q = getSingle(req.query.q)
  const terms = getSingle(req.query.terms)
  const limit = Math.min(Math.max(Number(getSingle(req.query.limit)) || 8, 1), 25)

  try {
    let query = client
      .from('words')
      .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
      .order('term', { ascending: true })
      .limit(limit)

    if (terms) {
      const values = terms
        .split(',')
        .map((term) => term.trim())
        .filter(Boolean)
        .slice(0, 25)
      query = query.in('term', values)
    } else if (q) {
      query = query.or(`term.ilike.%${q}%,definition.ilike.%${q}%,tags.ilike.%${q}%`)
    } else {
      res.status(400).json({ error: 'Missing search query' })
      return
    }

    const { data, error } = await query
    if (error) throw error

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json({ words: data || [] })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to search words' })
  }
}
