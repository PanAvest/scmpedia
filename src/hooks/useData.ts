import { useState, useEffect, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import type { Entry } from '../types'
import { cleanReplacementChars, getEntryTags, LOCAL_ENTRIES_KEY } from '../utils'

const DICTIONARY_CSV_SOURCES = ['/scmpedia_full_UPDATED.csv', '/scmpedia_full.csv']

const normalizeEntry = (r: any): Entry => {
  const entry = {
    id: r.id ? String(r.id) : undefined,
    term: cleanReplacementChars(String(r.term || r.Term || '')).trim(),
    definition: cleanReplacementChars(String(r.definition || r.Definition || '')).trim(),
    synonyms: cleanReplacementChars(String(r.synonyms || r.Synonyms || '')),
    tags: cleanReplacementChars(String(r.tags || r.Tags || '')),
    pos: cleanReplacementChars(String(r.pos || r.Pos || '')),
    pronunciation: cleanReplacementChars(String(r.pronunciation || r.Pronunciation || '')),
    examples: cleanReplacementChars(String(r.examples || r.Examples || '')),
  }
  return { ...entry, tags: getEntryTags(entry).join(', ') }
}

export function useData(accessToken?: string) {
  const [data, setData] = useState<Entry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading')
  const [serverBacked, setServerBacked] = useState(false)
  const fuseLibRef = useRef<any>(null)
  const fuseRef = useRef<any>(null)

  const readLocalEntries = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_ENTRIES_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.map(normalizeEntry).filter((e: Entry) => e.term && e.definition)
    } catch {
      return []
    }
  }, [])

  const parseCsvEntries = useCallback((csv: string) => {
    const parsed = Papa.parse<Record<string, unknown>>(csv, { header: true, skipEmptyLines: true })
    return parsed.data.map(normalizeEntry).filter((e: Entry) => e.term && e.definition)
  }, [])

  const applyEntries = useCallback((entries: Entry[]) => {
    if (entries.length) {
      setData(entries)
      if (fuseLibRef.current) {
        fuseRef.current = new fuseLibRef.current(entries, {
          keys: [
            { name: 'term', weight: 0.7 },
            { name: 'definition', weight: 0.3 },
            { name: 'tags', weight: 0.1 },
          ],
          threshold: 0.3,
          includeScore: true,
        })
      }
      setStatus('ready')
    } else {
      setStatus('empty')
    }
  }, [])

  const loadBundledWords = useCallback(async () => {
    for (const src of DICTIONARY_CSV_SOURCES) {
      try {
        const res = await fetch(src, { cache: 'no-store' })
        if (!res.ok) continue
        const entries = parseCsvEntries(await res.text())
        if (!entries.length) continue
        applyEntries(entries)
        return true
      } catch (error) {
        console.warn(`Bundled dictionary load failed for ${src}:`, error)
      }
    }
    return false
  }, [applyEntries, parseCsvEntries])

  const searchServerWords = useCallback(async (query: string, limit = 8, options?: { suggest?: boolean }) => {
    const q = query.trim()
    if (!q) return []
    const params = new URLSearchParams({ q, limit: String(limit) })
    if (options?.suggest) params.set('suggest', '1')
    const res = await fetch(`/api/words?${params.toString()}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.error || 'Word search failed')
    const entries = ((body?.words || []) as Entry[]).map(normalizeEntry).filter((e: Entry) => e.term && e.definition)
    if (entries.length) {
      setData((current) => {
        const byKey = new Map(current.map((entry) => [(entry.id || entry.term).toLowerCase(), entry]))
        for (const entry of entries) byKey.set((entry.id || entry.term).toLowerCase(), entry)
        const next = Array.from(byKey.values())
        if (fuseLibRef.current) {
          fuseRef.current = new fuseLibRef.current(next, {
            keys: [
              { name: 'term', weight: 0.7 },
              { name: 'definition', weight: 0.3 },
              { name: 'tags', weight: 0.1 },
            ],
            threshold: 0.3,
            includeScore: true,
          })
        }
        return next
      })
    }
    return entries
  }, [accessToken])

  const findServerWordBySlug = useCallback(async (slug: string) => {
    const query = slug.replace(/-/g, ' ')
    const words = await searchServerWords(query, 8)
    return words.find((entry) => entry.term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === slug) || null
  }, [searchServerWords])

  const fetchServerWordPage = useCallback(async (offset: number, limit = 1000) => {
    const res = await fetch(`/api/words?browse=1&limit=${limit}&offset=${offset}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    if (!res.ok) throw new Error('Word browse failed')
    const body = await res.json()
    return {
      words: ((body?.words || []) as Entry[]).map(normalizeEntry).filter((e: Entry) => e.term && e.definition),
      count: Number(body?.count || 0),
      nextOffset: Number(body?.nextOffset || offset),
    }
  }, [accessToken])

  const loadServerWords = useCallback(async () => {
    try {
      const entries: Entry[] = []
      let offset = 0
      let count = 0
      for (let page = 0; page < 30; page += 1) {
        const next = await fetchServerWordPage(offset, 1000)
        entries.push(...next.words)
        count = next.count || count
        offset = next.nextOffset
        if (!next.words.length || next.words.length < 1000 || (count && entries.length >= count)) break
      }
      if (!entries.length) throw new Error('No server words loaded')
      setServerBacked(true)
      applyEntries(entries)
      return true
    } catch (error) {
      console.warn('Server words fallback:', error)
      setServerBacked(false)
      return false
    }
  }, [applyEntries, fetchServerWordPage])

  useEffect(() => {
    const load = (src: string, g: string) =>
      new Promise((res) => {
        if ((window as any)[g]) return res((window as any)[g])
        const s = document.createElement('script')
        s.src = src
        s.onload = () => res((window as any)[g])
        document.head.appendChild(s)
      })

    Promise.all([
      load('https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.basic.min.js', 'Fuse'),
    ]).then(([F]) => {
      fuseLibRef.current = F
      const localEntries = readLocalEntries()
      if (localEntries.length) {
        applyEntries(localEntries)
        setServerBacked(true)
        return
      }
      setServerBacked(true)
      void loadBundledWords().then((loaded) => {
        if (!loaded) setStatus('ready')
      })
    })
  }, [applyEntries, loadBundledWords, readLocalEntries])

  useEffect(() => {
    const syncLocalEntries = (event?: StorageEvent) => {
      if (event && event.key !== LOCAL_ENTRIES_KEY) return
      const localEntries = readLocalEntries()
      if (localEntries.length) applyEntries(localEntries)
    }
    window.addEventListener('storage', syncLocalEntries)
    return () => window.removeEventListener('storage', syncLocalEntries)
  }, [applyEntries, readLocalEntries])

  return { data, status, fuseRef, serverBacked, searchServerWords, findServerWordBySlug, loadServerWords }
}
