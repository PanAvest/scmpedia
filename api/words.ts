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

const rankWords = (rows: any[], q: string, limit: number) => {
  const needle = q.trim().toLowerCase()
  if (!needle) return rows.slice(0, limit)

  const score = (row: any) => {
    const term = String(row?.term || '').toLowerCase()
    const definition = String(row?.definition || '').toLowerCase()
    const tags = String(row?.tags || '').toLowerCase()
    if (term === needle) return 0
    if (term.startsWith(`${needle} `) || term.startsWith(`${needle}-`) || term.startsWith(needle)) return 1
    if (term.includes(needle)) return 2
    if (tags.includes(needle)) return 3
    if (definition.includes(needle)) return 4
    return 5
  }

  return [...rows]
    .sort((a, b) => {
      const scoreDiff = score(a) - score(b)
      if (scoreDiff) return scoreDiff
      return String(a?.term || '').localeCompare(String(b?.term || ''))
    })
    .slice(0, limit)
}

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
  const searchLimit = terms ? limit : 100

  try {
    let query = client
      .from('words')
      .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
      .limit(searchLimit)

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
    const words = terms ? data || [] : rankWords(data || [], q, limit)
    res.status(200).json({ words })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to search words' })
  }
}
