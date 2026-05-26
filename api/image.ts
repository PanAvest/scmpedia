import type { VercelRequest, VercelResponse } from './vercel-types'
import { createClient } from '@supabase/supabase-js'
import { enforceDailyLimit } from './server-auth.js'

const API_KEY = process.env.GOOGLE_CSE_API_KEY
const CX = process.env.GOOGLE_CSE_CX
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const serviceClient =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

const getQuery = (q: string | string[] | undefined) => {
  if (typeof q === 'string') return q.trim()
  if (Array.isArray(q)) return String(q[0] || '').trim()
  return ''
}

const SCM_CONTEXT = [
  'supply chain',
  'logistics',
  'procurement',
  'inventory',
  'warehouse',
  'operations management',
]

const STOP_WORDS = new Set(['the', 'and', 'that', 'with', 'from', 'this', 'their', 'are', 'for', 'used', 'into', 'more'])

const BAD_RESULT_PATTERN = /\b(song|songs|music|album|lyrics|soundcloud|spotify|stream|listen online|radio|mixtape|playlist|artist|drama|k-drama|kdrama|movie|movies|tv series|series|episode|episodes|cast|plot|boyfriend|girlfriend|celebrity|actor|actress|netflix|viki|soompi|asianwiki|school|schools|student|students|spring play|stage|theatre|theater|concert|embassy|training certificate|media training|ceremony)\b/

const VISUAL_CONTEXT_WORDS = [
  'ghana',
  'tricycle',
  'tricycles',
  'cargo',
  'carrier',
  'carriers',
  'waste',
  'goods',
  'truck',
  'vehicle',
  'motor',
  'warehouse',
  'forklift',
  'container',
  'port',
  'ship',
  'pallet',
  'inventory',
  'procurement',
  'factory',
  'supplier',
  'highway',
  'road',
  'roadway',
  'route',
  'routing',
  'transportation',
  'corridor',
  'corridors',
  'traffic',
]

const cleanText = (value: string) =>
  value
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const wordsFrom = (value: string) =>
  cleanText(value)
    .toLowerCase()
    .split(' ')
    .filter((word) => word.length > 2)

const domainHintsFor = (term: string, definition: string) => {
  const haystack = `${term} ${definition}`.toLowerCase()
  const cleanTerm = cleanText(term).toLowerCase()
  const hints: string[] = []

  if (
    cleanTerm === 'demand' ||
    /\bdemand\b/.test(haystack) ||
    /\brequirement\b.*\b(product|component)\b/.test(haystack)
  ) {
    hints.push(
      'demand planning',
      'demand forecasting',
      'customer demand',
      'product demand',
      'inventory planning'
    )
  }

  if (/\bforecast/.test(haystack)) hints.push('forecasting chart', 'demand forecast')
  if (/\binventory|stock|warehouse/.test(haystack)) hints.push('inventory management', 'warehouse operations')
  if (/\bprocurement|supplier|sourcing/.test(haystack)) hints.push('procurement supplier management')
  if (/\blogistics|transport|shipment|distribution/.test(haystack)) hints.push('logistics distribution')
  if (/\bproduction|manufacturing|factory/.test(haystack)) hints.push('production planning manufacturing')

  return Array.from(new Set(hints))
}

const expandedTermFromDefinition = (definition: string) => {
  const seeMatch = definition.match(/^\s*see\s*:\s*([^.;]+)/i)
  if (seeMatch?.[1]) return cleanText(seeMatch[1])
  const colonMatch = definition.match(/^\s*([^:]{4,90})\s*:/)
  if (colonMatch?.[1]) return cleanText(colonMatch[1])
  return ''
}

const buildImageQueries = (term: string, definition: string) => {
  const cleanTerm = cleanText(term)
  const expandedTerm = expandedTermFromDefinition(definition)
  const definitionWords = wordsFrom([expandedTerm, definition].filter(Boolean).join(' ')).filter((word) => !STOP_WORDS.has(word))
  const domainHints = domainHintsFor(cleanTerm, definition)
  const visualTerms = definitionWords
    .filter((word) => VISUAL_CONTEXT_WORDS.includes(word))
    .slice(0, 6)
  const fallbackTerms = definitionWords
    .filter((word) => !visualTerms.includes(word))
    .slice(0, 5)
    .join(' ')
  const hasContext = SCM_CONTEXT.some((context) => cleanTerm.toLowerCase().includes(context))
  const isPhysicalTerm = visualTerms.some((word) => ['ghana', 'tricycle', 'tricycles', 'cargo', 'carrier', 'vehicle', 'motor', 'truck'].includes(word))
  const isShortAcronym = /^[A-Z0-9]{2,5}$/.test(cleanTerm) && definitionWords.length > 0
  const isGenericTerm = wordsFrom(cleanTerm).length <= 2 && !hasContext && !isPhysicalTerm
  const contextual = [
    cleanTerm,
    domainHints.slice(0, 3).join(' '),
    visualTerms.slice(0, 4).join(' '),
    visualTerms.length ? '' : fallbackTerms,
    hasContext || isPhysicalTerm ? '' : 'supply chain logistics inventory operations',
  ]
    .filter(Boolean)
    .join(' ')
  const definitionContext = [
    isShortAcronym ? '' : cleanTerm,
    expandedTerm,
    domainHints.slice(0, 4).join(' '),
    fallbackTerms,
    'supply chain procurement logistics operations',
  ]
    .filter(Boolean)
    .join(' ')
  const conceptDiagram = [
    cleanTerm,
    domainHints.slice(0, 2).join(' '),
    'supply chain diagram process',
  ]
    .filter(Boolean)
    .join(' ')

  return Array.from(new Set([
    isShortAcronym ? definitionContext : contextual,
    definitionContext,
    conceptDiagram,
    isGenericTerm ? '' : cleanTerm,
  ].filter(Boolean)))
}

const scoreResult = (item: any, term: string, definition: string) => {
  const cleanTerm = cleanText(term)
  const expandedTerm = expandedTermFromDefinition(definition)
  const isShortAcronym = /^[A-Z0-9]{2,5}$/.test(cleanTerm) && Boolean(definition)
  const termWords = isShortAcronym ? [] : wordsFrom(term)
  const expandedWords = wordsFrom(expandedTerm).filter((word) => !STOP_WORDS.has(word))
  const definitionWords = wordsFrom([expandedTerm, definition].filter(Boolean).join(' ')).filter((word) => !STOP_WORDS.has(word))
  const visualTerms = definitionWords.filter((word) => VISUAL_CONTEXT_WORDS.includes(word))
  const domainHints = domainHintsFor(cleanTerm, definition)
  const isGenericTerm = termWords.length <= 2 && !SCM_CONTEXT.some((context) => cleanTerm.toLowerCase().includes(context))
  const haystack = [
    item?.title,
    item?.snippet,
    item?.displayLink,
    item?.link,
    item?.image?.contextLink,
    item?.image?.thumbnailLink,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const link = String(item?.link || '').toLowerCase()
  let score = 0
  for (const word of termWords) {
    if (haystack.includes(word)) score += isGenericTerm ? 7 : 18
  }
  if (haystack.includes(term.toLowerCase())) score += isGenericTerm ? 6 : 20
  for (const hint of domainHints) {
    if (haystack.includes(hint)) score += 34
    else {
      const hintHits = wordsFrom(hint).filter((word) => haystack.includes(word)).length
      if (hintHits >= 2) score += 20
    }
  }
  const definitionHits = definitionWords
    .filter((word) => !['requirement', 'particular', 'number', 'sources', 'internal', 'external'].includes(word))
    .filter((word) => haystack.includes(word)).length
  score += Math.min(18, definitionHits * 4)
  for (const word of visualTerms) {
    if (haystack.includes(word)) score += 12
  }
  for (const context of SCM_CONTEXT) {
    if (haystack.includes(context)) score += 6
  }
  if (/\b(diagram|infographic|concept|process|management|logistics|warehouse|procurement)\b/.test(haystack)) score += 5
  if (/\b(logo|icon|clipart|meme|wallpaper|template|ppt|pdf|book cover|headshot|portrait|scandal|political|politics)\b/.test(haystack)) score -= 25
  if (BAD_RESULT_PATTERN.test(haystack)) score -= 140
  if (visualTerms.length && !visualTerms.some((word) => haystack.includes(word))) score -= 35
  if (isShortAcronym) {
    const expandedHits = expandedWords.filter((word) => haystack.includes(word)).length
    if (expandedWords.length && expandedHits < Math.min(2, expandedWords.length)) score -= 90
    if (haystack.includes(cleanTerm.toLowerCase()) && expandedHits === 0) score -= 40
  }
  if (/\b(researchgate|gbcghanaonline|upfrica|alibaba|alamy|ghanabusinessnews|citinewsroom|graphic)\b/.test(haystack)) score += 14
  if (/\b(tiktok|instagram|facebook|lookaside|fbcdn)\b/.test(haystack)) score -= 16
  if (/\.(svg|gif)(\?|$)/.test(link)) score -= 10

  const pixels = Number(item?.image?.width || 0) * Number(item?.image?.height || 0)
  score += Math.min(6, Math.floor(pixels / 500000))
  return score
}

const isReliableResult = (item: any, term: string, definition: string, score: number) => {
  const cleanTerm = cleanText(term)
  const expandedTerm = expandedTermFromDefinition(definition)
  const isShortAcronym = /^[A-Z0-9]{2,5}$/.test(cleanTerm) && Boolean(definition)
  const termWords = wordsFrom(cleanTerm)
  const domainHints = domainHintsFor(cleanTerm, definition)
  const isGenericTerm = termWords.length <= 2 && !SCM_CONTEXT.some((context) => cleanTerm.toLowerCase().includes(context))
  const haystack = [
    item?.title,
    item?.snippet,
    item?.displayLink,
    item?.link,
    item?.image?.contextLink,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (BAD_RESULT_PATTERN.test(haystack)) {
    return false
  }
  if (isShortAcronym) {
    const expandedWords = wordsFrom(expandedTerm).filter((word) => !STOP_WORDS.has(word))
    const expandedHits = expandedWords.filter((word) => haystack.includes(word)).length
    return score >= 18 && (!expandedWords.length || expandedHits >= Math.min(2, expandedWords.length))
  }
  if (isGenericTerm) {
    const hasScmContext = SCM_CONTEXT.some((context) => haystack.includes(context))
    const hasDomainContext = domainHints.some((hint) => {
      if (haystack.includes(hint)) return true
      return wordsFrom(hint).filter((word) => haystack.includes(word)).length >= 2
    })
    const definitionWords = wordsFrom([expandedTerm, definition].filter(Boolean).join(' '))
      .filter((word) => !STOP_WORDS.has(word))
      .filter((word) => !['requirement', 'particular', 'number', 'sources', 'internal', 'external'].includes(word))
    const definitionHits = definitionWords.filter((word) => haystack.includes(word)).length
    return score >= 22 && (hasScmContext || hasDomainContext || definitionHits >= 2)
  }
  return score >= 10
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const query = getQuery(req.query.q)
  const definition = getQuery(req.query.definition)
  const exclude = getQuery(req.query.exclude)
  if (!query) {
    res.status(400).json({ error: 'Missing query' })
    return
  }

  if (!API_KEY || !CX) {
    res.status(500).json({ error: 'Missing Google CSE configuration' })
    return
  }

  try {
    if (serviceClient) {
      const usage = await enforceDailyLimit(req, serviceClient, 'image', 20)
      if (!usage.ok) {
        res.status(usage.status || 429).json({ error: usage.error || 'Daily image limit reached' })
        return
      }
    }
    const exactTerm = cleanText(query)
    const responses = await Promise.all(
      buildImageQueries(query, definition).map(async (imageQuery) => {
        const params = new URLSearchParams({
          key: API_KEY,
          cx: CX,
          q: imageQuery,
          searchType: 'image',
          num: '10',
          imgSize: 'large',
          safe: 'active',
        })
        params.set('excludeTerms', 'song lyrics album drama k-drama movie tv series cast plot boyfriend girlfriend celebrity actor actress netflix viki soompi asianwiki')
        if (wordsFrom(query).length <= 5 && !definition) params.set('exactTerms', exactTerm)
        const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`)
        const body = await response.text()
        if (!response.ok) throw new Error(body.slice(0, 500))
        try {
          return JSON.parse(body)
        } catch {
          throw new Error('Invalid response from Google')
        }
      })
    )

    const seen = new Set<string>()
    const items = responses
      .flatMap((data) => (Array.isArray(data?.items) ? data.items : []))
      .filter((item: any) => {
        const key = String(item?.link || item?.image?.thumbnailLink || '')
        if (!key || seen.has(key)) return false
        if (exclude && (String(item?.link || '') === exclude || String(item?.image?.thumbnailLink || '') === exclude)) return false
        seen.add(key)
        return true
      })
    const scoredItems = items
      .filter((result: any) => typeof result?.link === 'string' || typeof result?.image?.thumbnailLink === 'string')
      .map((result: any) => ({ result, score: scoreResult(result, query, definition) }))
      .filter(({ result, score }: any) => isReliableResult(result, query, definition, score))
      .sort((a: any, b: any) => b.score - a.score)
    const item = scoredItems[0]?.result
    const link = typeof item?.link === 'string' ? item.link : ''
    const thumbnail = typeof item?.image?.thumbnailLink === 'string' ? item.image.thumbnailLink : ''

    if (!link && !thumbnail) {
      res.status(404).json({ error: 'No image results' })
      return
    }

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      url: link || thumbnail,
      thumbnail,
      link,
      width: item?.image?.width || null,
      height: item?.image?.height || null,
      title: item?.title || '',
      contextLink: item?.image?.contextLink || '',
    })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to fetch image' })
  }
}
