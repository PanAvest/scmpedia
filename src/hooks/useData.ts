import { useState, useEffect, useRef, useCallback } from 'react'
import type { Entry } from '../types'
import { cleanReplacementChars, getEntryTags, LOCAL_ENTRIES_KEY } from '../utils'

export function useData() {
  const [data, setData] = useState<Entry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading')
  const [serverBacked, setServerBacked] = useState(false)
  const papaRef = useRef<any>(null)
  const fuseLibRef = useRef<any>(null)
  const fuseRef = useRef<any>(null)

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

  const processCSV = useCallback((csv: string) => {
    if (!papaRef.current) return
    try {
      const localEntries = readLocalEntries()
      if (localEntries.length) {
        applyEntries(localEntries)
        return
      }
      const res = papaRef.current.parse(csv, { header: true, skipEmptyLines: true })
      const entries = res.data.map(normalizeEntry).filter((e: Entry) => e.term && e.definition)
      applyEntries(entries)
    } catch {
      setStatus('error')
    }
  }, [applyEntries, readLocalEntries])

  const searchServerWords = useCallback(async (query: string, limit = 8) => {
    const q = query.trim()
    if (!q) return []
    const res = await fetch(`/api/words?q=${encodeURIComponent(q)}&limit=${limit}`)
    if (!res.ok) throw new Error('Word search failed')
    const body = await res.json()
    return ((body?.words || []) as Entry[]).map(normalizeEntry).filter((e: Entry) => e.term && e.definition)
  }, [])

  const fetchServerWordPage = useCallback(async (offset: number, limit = 1000) => {
    const res = await fetch(`/api/words?browse=1&limit=${limit}&offset=${offset}`)
    if (!res.ok) throw new Error('Word browse failed')
    const body = await res.json()
    return {
      words: ((body?.words || []) as Entry[]).map(normalizeEntry).filter((e: Entry) => e.term && e.definition),
      count: Number(body?.count || 0),
      nextOffset: Number(body?.nextOffset || offset),
    }
  }, [])

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

    const loadCsv = async () => {
      const sources = ['/scmpedia_full_UPDATED.csv', '/scmpedia_full.csv']
      for (const src of sources) {
        try {
          const r = await fetch(`${src}?v=${Date.now()}`, { cache: 'no-store' })
          if (!r.ok) continue
          const text = await r.text()
          if (!text) continue
          processCSV(text)
          return
        } catch {
          // try next
        }
      }
      const loadedFromServer = await loadServerWords()
      if (!loadedFromServer) setStatus('empty')
    }

    Promise.all([
      load('https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.basic.min.js', 'Fuse'),
      load('https://cdn.jsdelivr.net/npm/papaparse@5.3.0/papaparse.min.js', 'Papa'),
    ]).then(([F, P]) => {
      fuseLibRef.current = F
      papaRef.current = P
      loadCsv()
    })
  }, [loadServerWords, processCSV])

  useEffect(() => {
    const syncLocalEntries = (event?: StorageEvent) => {
      if (event && event.key !== LOCAL_ENTRIES_KEY) return
      const localEntries = readLocalEntries()
      if (localEntries.length) applyEntries(localEntries)
    }
    window.addEventListener('storage', syncLocalEntries)
    return () => window.removeEventListener('storage', syncLocalEntries)
  }, [applyEntries, readLocalEntries])

  return { data, status, processCSV, fuseRef, serverBacked, searchServerWords }
}
