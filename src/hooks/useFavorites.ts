import { useState, useEffect, useMemo, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Entry, FavoriteRow } from '../types'
import { supabase } from '../supabase'

export function useFavorites(user: User | null, allData: Entry[]) {
  const [favorites, setFavorites] = useState<FavoriteRow[]>([])
  const [remoteEntries, setRemoteEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [savingTerm, setSavingTerm] = useState<string | null>(null)

  const loadFavorites = useCallback(async () => {
    if (!supabase || !user) {
      setFavorites([])
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('id,user_id,word_id,term,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) {
        setFavorites([])
      } else {
        setFavorites(data || [])
      }
    } catch {
      setFavorites([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  const favoriteTerms = useMemo(
    () => new Set(favorites.map((f) => f.term.toLowerCase())),
    [favorites]
  )

  useEffect(() => {
    const terms = favorites.map((f) => f.term).filter(Boolean)
    if (!terms.length) {
      setRemoteEntries([])
      return
    }
    const params = new URLSearchParams({ terms: terms.join(','), limit: String(Math.min(terms.length, 25)) })
    void fetch(`/api/words?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { words: [] }))
      .then((body) => setRemoteEntries(Array.isArray(body?.words) ? body.words : []))
      .catch(() => setRemoteEntries([]))
  }, [favorites])

  const favoriteEntries = useMemo(() => {
    const byTerm = new Map([...allData, ...remoteEntries].map((e) => [e.term.toLowerCase(), e]))
    return favorites.map((f) => byTerm.get(f.term.toLowerCase())).filter(Boolean) as Entry[]
  }, [allData, favorites, remoteEntries])

  const toggleFavorite = async (entry: Entry) => {
    if (!supabase || !user) return { ok: false, needsAuth: true }
    const term = entry.term.trim()
    if (!term) return { ok: false, needsAuth: false }
    setSavingTerm(term)
    try {
      const existing = favorites.find((f) => f.term.toLowerCase() === term.toLowerCase())
      if (existing) {
        const { error } = await supabase.from('favorites').delete().eq('id', existing.id).eq('user_id', user.id)
        if (error) throw error
        setFavorites((c) => c.filter((f) => f.id !== existing.id))
        return { ok: true, needsAuth: false }
      }

      const { data, error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, word_id: entry.id || null, term })
        .select('id,user_id,word_id,term,created_at')
        .single()
      if (error) throw error
      if (data) setFavorites((c) => [data, ...c])
      return { ok: true, needsAuth: false }
    } catch (error) {
      console.error('Favorite save error', error)
      return { ok: false, needsAuth: false }
    } finally {
      setSavingTerm(null)
    }
  }

  return { favorites, favoriteEntries, favoriteTerms, loading, savingTerm, toggleFavorite, reload: loadFavorites }
}
