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

const editDistance = (a: string, b: string) => {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let before = previous[0]
    previous[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const tmp = previous[j]
      previous[j] =
        left[i - 1] === right[j - 1]
          ? before
          : Math.min(previous[j] + 1, previous[j - 1] + 1, before + 1)
      before = tmp
    }
  }
  return previous[right.length]
}

const fuzzyRankWords = (rows: any[], q: string, limit: number) => {
  const needle = q.trim().toLowerCase()
  const compactNeedle = needle.replace(/[^a-z0-9]/g, '')
  if (!compactNeedle) return []

  return [...rows]
    .map((row) => {
      const term = String(row?.term || '').toLowerCase()
      const compactTerm = term.replace(/[^a-z0-9]/g, '')
      const distance = Math.min(editDistance(term, needle), editDistance(compactTerm, compactNeedle))
      const prefixBonus = term[0] === needle[0] ? -1 : 0
      return { row, score: distance + prefixBonus }
    })
    .filter(({ row, score }) => {
      const termLength = String(row?.term || '').length
      const maxDistance = Math.max(2, Math.floor(Math.min(compactNeedle.length, termLength) * 0.35))
      return score <= maxDistance
    })
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      return String(a.row?.term || '').localeCompare(String(b.row?.term || ''))
    })
    .slice(0, limit)
    .map(({ row }) => row)
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
  const browse = getSingle(req.query.browse) === '1'
  const limit = Math.min(Math.max(Number(getSingle(req.query.limit)) || 8, 1), 25)
  const browseLimit = Math.min(Math.max(Number(getSingle(req.query.limit)) || 300, 50), 500)
  const offset = Math.max(Number(getSingle(req.query.offset)) || 0, 0)
  const searchLimit = terms ? limit : 100

  try {
    if (browse) {
      const { data, error, count } = await client
        .from('words')
        .select('id,term,definition,synonyms,tags,pronunciation,pos,examples', { count: 'exact' })
        .order('term', { ascending: true })
        .range(offset, offset + browseLimit - 1)
      if (error) throw error
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
      res.status(200).json({ words: data || [], nextOffset: offset + (data?.length || 0), count })
      return
    }

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
    let words = terms ? data || [] : rankWords(data || [], q, limit)
    if (!terms && q && !words.length) {
      const first = q.trim()[0] || ''
      const { data: candidates, error: candidateError } = await client
        .from('words')
        .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
        .ilike('term', `${first}%`)
        .order('term', { ascending: true })
        .limit(5000)
      if (candidateError) throw candidateError
      words = fuzzyRankWords(candidates || [], q, limit)
    }
    res.status(200).json({ words })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to search words' })
  }
}
