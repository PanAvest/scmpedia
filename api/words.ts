import type { VercelRequest, VercelResponse } from './vercel-types'
import { createClient } from '@supabase/supabase-js'
import { enforceDailyLimit, hasAdminAccess, isPremiumUser, getRequestUser } from './server-auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WORD_COLUMNS = 'id,term,definition,synonyms,tags,pronunciation,pos,examples'
const WORD_COLUMNS_WITH_SOURCE = `id,source_key,term,definition,synonyms,tags,pronunciation,pos,examples`
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

const isMissingSourceKeyError = (error: any) => String(error?.message || '').includes('source_key')

const withoutSourceKey = (rows: any[]) => rows.map(({ source_key, ...row }) => row)

const wordUpdatePayload = (row: any) => {
  const entry = normalizeWord(row)
  return {
    source_key: entry.source_key || undefined,
    term: entry.term,
    definition: entry.definition,
    synonyms: entry.synonyms,
    tags: entry.tags,
    pos: entry.pos,
    pronunciation: entry.pronunciation,
    examples: entry.examples,
    updated_at: new Date().toISOString(),
  }
}

const normalizeWord = (row: any) => ({
  id: row?.id ? String(row.id) : undefined,
  source_key: String(row?.source_key || row?.sourceKey || row?.SourceKey || '').trim(),
  term: String(row?.term || row?.Term || '').trim(),
  definition: String(row?.definition || row?.Definition || '').trim(),
  synonyms: String(row?.synonyms || row?.Synonyms || ''),
  tags: String(row?.tags || row?.Tags || ''),
  pos: String(row?.pos || row?.Pos || ''),
  pronunciation: String(row?.pronunciation || row?.Pronunciation || ''),
  examples: String(row?.examples || row?.Examples || ''),
})

const getSourceKeyBase = (term: string) => term.trim().toLowerCase()

const prepareImportRows = (rows: any[]) => {
  const occurrenceByTerm = new Map<string, number>()
  const prepared = []

  for (const row of rows) {
    const entry = normalizeWord(row)
    if (!entry.term || !entry.definition) continue

    const keyBase = entry.source_key || getSourceKeyBase(entry.term)
    const occurrence = (occurrenceByTerm.get(keyBase) || 0) + 1
    occurrenceByTerm.set(keyBase, occurrence)
    const sourceKey = entry.source_key || (occurrence === 1 ? keyBase : `${keyBase}::${occurrence}`)

    prepared.push({
      source_key: sourceKey,
      term: entry.term,
      definition: entry.definition,
      synonyms: entry.synonyms,
      tags: entry.tags,
      pos: entry.pos,
      pronunciation: entry.pronunciation,
      examples: entry.examples,
      updated_at: new Date().toISOString(),
    })
  }

  return prepared
}

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const normalizeSearchText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
const SEARCH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'about',
  'can',
  'could',
  'define',
  'describe',
  'does',
  'explain',
  'for',
  'from',
  'help',
  'how',
  'in',
  'is',
  'looking',
  'look',
  'mean',
  'meaning',
  'me',
  'need',
  'of',
  'please',
  'search',
  'show',
  'tell',
  'term',
  'the',
  'this',
  'to',
  'understand',
  'want',
  'what',
  'whats',
  'with',
  'word',
  'work',
  'works',
  'you',
])

const searchTokens = (value: string) =>
  normalizeSearchText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !SEARCH_STOP_WORDS.has(token))

const searchAcronym = (value: string) => {
  const tokens = normalizeSearchText(value)
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 2 &&
        ![
          'a',
          'an',
          'are',
          'about',
          'can',
          'could',
          'define',
          'describe',
          'does',
          'explain',
          'help',
          'how',
          'is',
          'looking',
          'look',
          'mean',
          'meaning',
          'me',
          'need',
          'please',
          'search',
          'show',
          'tell',
          'term',
          'the',
          'this',
          'to',
          'understand',
          'want',
          'what',
          'whats',
          'with',
          'word',
          'work',
          'works',
          'you',
        ].includes(token),
    )
  return tokens.length >= 3 ? tokens.map((token) => token[0]).join('') : ''
}

const uniqueSearchPhrases = (q: string) =>
  Array.from(new Set([q.trim(), searchTokens(q).join(' ')].map((phrase) => phrase.trim()).filter(Boolean)))

const collectSearchCandidates = async (q: string, maxRows = 5000) => {
  if (!client) return []
  const rows: any[] = []
  const add = (next: any[] | null) => rows.push(...(next || []))
  const run = async (query: any) => {
    const { data, error } = await query
    if (error) throw error
    add(data)
  }

  const phrases = uniqueSearchPhrases(q)
  const acronym = searchAcronym(q)
  for (const phrase of phrases) {
    await run(client.from('words').select(WORD_COLUMNS).ilike('term', phrase).limit(50))
    await run(client.from('words').select(WORD_COLUMNS).ilike('term', `${phrase}%`).order('term', { ascending: true }).limit(250))
    await run(client.from('words').select(WORD_COLUMNS).ilike('term', `%${phrase}%`).order('term', { ascending: true }).limit(250))
  }
  if (acronym) await run(client.from('words').select(WORD_COLUMNS).ilike('term', acronym).limit(50))

  for (const phrase of phrases) {
    await run(client.from('words').select(WORD_COLUMNS).ilike('definition', `%${phrase}%`).limit(250))
    await run(client.from('words').select(WORD_COLUMNS).ilike('tags', `%${phrase}%`).limit(100))
  }

  for (const token of searchTokens(q).slice(0, 5)) {
    await run(client.from('words').select(WORD_COLUMNS).ilike('term', `%${token}%`).order('term', { ascending: true }).limit(250))
    await run(client.from('words').select(WORD_COLUMNS).ilike('definition', `%${token}%`).limit(250))
  }

  return uniqueWords(rows).slice(0, maxRows)
}

const rankWords = (rows: any[], q: string, limit: number) => {
  const needle = q.trim().toLowerCase()
  if (!needle) return rows.slice(0, limit)
  const compactNeedle = needle.replace(/[^a-z0-9]/g, '')
  const tokens = searchTokens(needle)
  const acronym = searchAcronym(needle)
  const tokenPhrase = tokens.join(' ')

  const score = (row: any) => {
    const term = String(row?.term || '').toLowerCase()
    const definition = String(row?.definition || '').toLowerCase()
    const synonyms = String(row?.synonyms || '').toLowerCase()
    const tags = String(row?.tags || '').toLowerCase()
    const haystack = [term, definition, synonyms, tags].join(' ')
    const compactTerm = term.replace(/[^a-z0-9]/g, '')
    const compactDefinition = definition.replace(/[^a-z0-9]/g, '')
    const compactSynonyms = synonyms.replace(/[^a-z0-9]/g, '')
    if (term === needle) return 0
    if (compactTerm && compactTerm === compactNeedle) return 0.2
    if (acronym.length >= 2 && compactTerm === acronym && tokens.some((token) => definition.startsWith(token))) return 0.25
    if (tokenPhrase && term === tokenPhrase) return 0.3
    if (tokenPhrase && (term.startsWith(`${tokenPhrase} `) || term.startsWith(`${tokenPhrase}-`))) return 0.4
    if (tokenPhrase && (term.includes(tokenPhrase) || synonyms.includes(tokenPhrase))) return 0.8
    if (tokens.length > 1 && tokens.every((token) => term.includes(token))) return 1
    if (acronym.length >= 2 && compactTerm === acronym) return 1.5
    if (term.startsWith(`${needle} `) || term.startsWith(`${needle}-`) || term.startsWith(needle)) return 1
    if (term.includes(needle)) return 2
    if (synonyms === needle || compactSynonyms === compactNeedle) return 2.2
    if (tokens.some((token) => definition.startsWith(token))) return 2.3
    if (definition.startsWith(needle) || compactDefinition.startsWith(compactNeedle)) return 2.5
    if (synonyms.includes(needle) || compactSynonyms.includes(compactNeedle)) return 3
    if (tags.includes(needle)) return 4
    if (definition.includes(needle) || compactDefinition.includes(compactNeedle)) return 5
    if (tokens.length) {
      const matchedTokens = tokens.filter((token) => haystack.includes(token)).length
      if (matchedTokens === tokens.length) return 6
      if (matchedTokens) return 7 + (tokens.length - matchedTokens)
    }
    return 20
  }

  return [...rows]
    .sort((a, b) => {
      const scoreDiff = score(a) - score(b)
      if (scoreDiff) return scoreDiff
      return String(a?.term || '').localeCompare(String(b?.term || ''))
    })
    .slice(0, limit)
}

const uniqueWords = (rows: any[]) => {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = String(row?.source_key || row?.term || '')
      .trim()
      .toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const editDistance = (a: string, b: string) => {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let before = previous[0] ?? 0
    previous[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const tmp = previous[j] ?? 0
      previous[j] = left[i - 1] === right[j - 1] ? before : Math.min((previous[j] ?? 0) + 1, (previous[j - 1] ?? 0) + 1, before + 1)
      before = tmp
    }
  }
  return previous[right.length] ?? 0
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

const tokenRankWords = (rows: any[], q: string, limit: number) => {
  const tokens = searchTokens(q)
  if (!tokens.length) return []
  const acronym = searchAcronym(q)
  const tokenPhrase = tokens.join(' ')

  return [...rows]
    .map((row) => {
      const term = normalizeSearchText(String(row?.term || ''))
      const compactTerm = term.replace(/[^a-z0-9]/g, '')
      const definition = normalizeSearchText(String(row?.definition || ''))
      const synonyms = normalizeSearchText(String(row?.synonyms || ''))
      const tags = normalizeSearchText(String(row?.tags || ''))
      const haystack = [term, definition, synonyms, tags].join(' ')
      const haystackWords = haystack.split(/\s+/).filter(Boolean)
      const phraseScore =
        tokenPhrase && term === tokenPhrase
          ? -8
          : tokenPhrase && (term.startsWith(`${tokenPhrase} `) || term.startsWith(`${tokenPhrase}-`))
            ? -6
            : tokenPhrase && (term.includes(tokenPhrase) || synonyms.includes(tokenPhrase))
              ? -5
              : tokens.length > 1 && tokens.every((token) => term.includes(token))
                ? -3
                : tokens.some((token) => definition.startsWith(token)) && tokens.every((token) => haystack.includes(token))
                  ? -3
                  : tokenPhrase && definition.startsWith(tokenPhrase)
                    ? -2
                    : tokenPhrase && definition.includes(tokenPhrase)
                      ? -1
                      : 0
      const tokenScore = tokens.reduce((total, token) => {
        if (term === token || synonyms === token) return total
        if (term.includes(token) || synonyms.includes(token)) return total + 0.25
        if (definition.startsWith(token) || tags.includes(token)) return total + 0.5
        if (haystack.includes(token)) return total + 1
        const bestDistance = haystackWords.reduce((best, word) => Math.min(best, editDistance(token, word)), token.length)
        return total + Math.min(4, bestDistance + 1)
      }, 0)
      const acronymScore = acronym.length >= 2 && compactTerm === acronym ? -4 : 0
      const score = tokenScore + acronymScore + phraseScore
      return { row, score }
    })
    .filter(({ score }) => score <= Math.max(2, tokens.length * 2.5))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      return String(a.row?.term || '').localeCompare(String(b.row?.term || ''))
    })
    .slice(0, limit)
    .map(({ row }) => row)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!client) {
    res.status(500).json({ error: 'Missing Supabase service configuration' })
    return
  }

  if (req.method === 'POST') {
    if (!hasAdminAccess(req)) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const rows = Array.isArray(req.body?.words) ? req.body.words : []
    const singleRow = rows.length === 1 ? normalizeWord(rows[0]) : null
    if (singleRow?.id && singleRow.term && singleRow.definition) {
      try {
        const payload = wordUpdatePayload(rows[0])
        const { source_key, ...payloadWithoutSourceKey } = payload
        let update = await client.from('words').update(payload).eq('id', singleRow.id)
        if (isMissingSourceKeyError(update.error)) {
          update = await client.from('words').update(payloadWithoutSourceKey).eq('id', singleRow.id)
        }
        if (update.error) throw update.error
        res.setHeader('Cache-Control', 'no-store')
        res.status(200).json({ imported: 1, updated: true })
      } catch (error: any) {
        res.status(500).json({ error: error?.message || 'Failed to update word' })
      }
      return
    }

    const words = prepareImportRows(rows).slice(0, 10000)
    if (!words.length) {
      res.status(400).json({ error: 'No valid words to import' })
      return
    }

    try {
      let uploaded = 0
      for (const batch of chunk(words, 500)) {
        const { error } = await client.from('words').upsert(batch, { onConflict: 'source_key' })
        if (isMissingSourceKeyError(error)) {
          const fallback = await client.from('words').upsert(withoutSourceKey(batch), { onConflict: 'term' })
          if (fallback.error) throw fallback.error
          uploaded += batch.length
          continue
        }
        if (error) throw error
        uploaded += batch.length
      }
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ imported: uploaded })
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to import words' })
    }
    return
  }

  if (req.method === 'DELETE') {
    if (!hasAdminAccess(req)) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const id = getSingle(req.query.id)
    const sourceKey = getSingle(req.query.source_key)
    const term = getSingle(req.query.term)
    if (!id && !sourceKey && !term) {
      res.status(400).json({ error: 'Missing word identifier' })
      return
    }

    try {
      let query = client.from('words').delete()
      if (id) query = query.eq('id', id)
      else if (sourceKey) query = query.eq('source_key', sourceKey)
      else query = query.eq('term', term)
      const { error } = await query
      if (isMissingSourceKeyError(error) && sourceKey) {
        res.status(400).json({
          error: 'Delete by source_key is not supported by the current words table',
        })
        return
      }
      if (error) throw error
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ deleted: true })
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to delete word' })
    }
    return
  }

  const q = getSingle(req.query.q)
  const terms = getSingle(req.query.terms)
  const browse = getSingle(req.query.browse) === '1'
  const limit = Math.min(Math.max(Number(getSingle(req.query.limit)) || 8, 1), 25)
  const browseLimit = Math.min(Math.max(Number(getSingle(req.query.limit)) || 300, 50), 1000)
  const offset = Math.max(Number(getSingle(req.query.offset)) || 0, 0)
  const searchLimit = terms ? limit : 100
  const adminRequest = hasAdminAccess(req)

  try {
    if (browse) {
      const user = await getRequestUser(req)
      if (!adminRequest && !isPremiumUser(user)) {
        res.status(403).json({ error: 'Dictionary browsing is a premium feature.' })
        return
      }

      const response = await client
        .from('words')
        .select(WORD_COLUMNS_WITH_SOURCE, { count: 'exact' })
        .order('term', { ascending: true })
        .range(offset, offset + browseLimit - 1)
      let data: any[] | null = response.data
      let error: any = response.error
      let count = response.count
      if (isMissingSourceKeyError(error)) {
        const fallback = await client
          .from('words')
          .select(WORD_COLUMNS, { count: 'exact' })
          .order('term', { ascending: true })
          .range(offset, offset + browseLimit - 1)
        data = fallback.data
        error = fallback.error
        count = fallback.count
      }
      if (error) throw error
      res.setHeader('Cache-Control', adminRequest ? 'no-store' : 's-maxage=300, stale-while-revalidate=600')
      res.status(200).json({
        words: data || [],
        nextOffset: offset + (data?.length || 0),
        count,
      })
      return
    }

    let data: any[] | null = null
    let error: any = null
    if (terms) {
      const values = terms
        .split(',')
        .map((term) => term.trim())
        .filter(Boolean)
        .slice(0, 25)
      const response = await client.from('words').select(WORD_COLUMNS_WITH_SOURCE).limit(searchLimit).in('term', values)
      data = response.data
      error = response.error
      if (isMissingSourceKeyError(error)) {
        const fallback = await client.from('words').select(WORD_COLUMNS).limit(searchLimit).in('term', values)
        data = fallback.data
        error = fallback.error
      }
    } else if (q) {
      const usage = await enforceDailyLimit(req, client, 'word-search', 2)
      if (!usage.ok) {
        res.status(usage.status || 429).json({
          error: usage.error || 'Daily search limit reached',
          remaining: usage.remaining,
        })
        return
      }
      data = await collectSearchCandidates(q)
    } else {
      res.status(400).json({ error: 'Missing search query' })
      return
    }
    if (error) throw error

    res.setHeader('Cache-Control', adminRequest ? 'no-store' : 's-maxage=300, stale-while-revalidate=600')
    const rowsWithFallback = uniqueWords(data || [])
    let words = terms ? rowsWithFallback : rankWords(rowsWithFallback, q, limit)
    if (!terms && q && !words.length) {
      const tokens = searchTokens(q)
      const tokenFilters = tokens
        .slice(0, 5)
        .flatMap((token) => [`term.ilike.%${token}%`, `definition.ilike.%${token}%`, `tags.ilike.%${token}%`])
      if (tokenFilters.length) {
        const { data: tokenCandidates, error: tokenCandidateError } = await client
          .from('words')
          .select(WORD_COLUMNS)
          .or(tokenFilters.join(','))
          .limit(5000)
        if (tokenCandidateError) throw tokenCandidateError
        words = tokenRankWords(tokenCandidates || [], q, limit)
      }
    }
    if (!terms && q && !words.length) {
      const first = q.trim()[0] || ''
      const { data: candidates, error: candidateError } = await client
        .from('words')
        .select(WORD_COLUMNS)
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
