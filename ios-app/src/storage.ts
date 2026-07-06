import AsyncStorage from '@react-native-async-storage/async-storage'
import type { HistoryItem } from './types'

export const THEME_KEY = 'scmpedia-mobile-theme-v1'
export const AUTO_READ_AI_KEY = 'scmpedia-mobile-auto-read-ai-v1'
export const DICTIONARY_MODE_KEY = 'scmpedia-mobile-dictionary-mode-v1'
export const TTS_PROVIDER_KEY = 'scmpedia-mobile-tts-provider-v1'
export const FREE_USAGE_KEY = 'scmpedia-mobile-free-usage-v1'
export const HISTORY_KEY = 'scmpedia-mobile-recent-searches-v1'
export const SECTOR_HISTORY_KEY = 'scmpedia-mobile-sector-history-v1'

const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export async function writeJson<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value))
}

export const todayKey = () => new Date().toISOString().slice(0, 10)

export async function readFreeUsage() {
  const parsed = await readJson<{ day?: string; count?: number }>(FREE_USAGE_KEY, {})
  return parsed.day === todayKey() ? Number(parsed.count || 0) : 0
}

export async function writeFreeUsage(count: number) {
  await writeJson(FREE_USAGE_KEY, { day: todayKey(), count })
}

export async function readHistory(): Promise<HistoryItem[]> {
  const parsed = await readJson<any[]>(HISTORY_KEY, [])
  const cutoff = Date.now() - HISTORY_TTL_MS
  return parsed
    .map((item) => {
      if (typeof item === 'string') return { term: item, at: Date.now() }
      return { term: String(item?.term || ''), at: Number(item?.at || Date.now()) }
    })
    .filter((item) => item.term.trim() && item.at >= cutoff)
    .slice(0, 30)
}

export async function writeHistory(items: HistoryItem[]) {
  await writeJson(HISTORY_KEY, items.slice(0, 30))
}

export async function recordHistory(term: string) {
  const clean = term.trim()
  if (!clean) return readHistory()
  const current = await readHistory()
  const next = [{ term: clean, at: Date.now() }, ...current.filter((item) => item.term.toLowerCase() !== clean.toLowerCase())].slice(0, 30)
  await writeHistory(next)
  return next
}
