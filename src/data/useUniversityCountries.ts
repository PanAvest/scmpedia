import { useEffect, useState } from 'react'
import { UNIVERSITY_COUNTRIES, normalizeUniversityName, type UniversityCountry } from './universities'

type Addition = { country_code: string; name: string }

// Merge the compiled seed list with admin-approved additions. Seed order is preserved
// (UMaT stays first in Ghana); additions are appended per country; the seed wins on a
// key collision so a duplicate add is a harmless no-op.
function mergeCountries(additions: Addition[]): UniversityCountry[] {
  if (!additions.length) return UNIVERSITY_COUNTRIES
  const byCountry = new Map<string, string[]>()
  for (const add of additions) {
    const code = String(add.country_code || '').toUpperCase()
    if (!code || !add.name) continue
    const list = byCountry.get(code) || []
    list.push(add.name)
    byCountry.set(code, list)
  }
  return UNIVERSITY_COUNTRIES.map((country) => {
    const extra = byCountry.get(country.code)
    if (!extra?.length) return country
    const seen = new Set(country.universities.map(normalizeUniversityName))
    const merged = [...country.universities]
    for (const name of extra.sort((a, b) => a.localeCompare(b))) {
      const key = normalizeUniversityName(name)
      if (key && !seen.has(key)) {
        seen.add(key)
        merged.push(name)
      }
    }
    return { ...country, universities: merged }
  })
}

// Module-level cache so the fetch runs once per page load, shared across mounts.
let cached: UniversityCountry[] | null = null
let inflight: Promise<UniversityCountry[]> | null = null

const SESSION_KEY = 'scmpedia-university-additions-v1'

function readSession(): Addition[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Addition[]) : null
  } catch {
    return null
  }
}

async function fetchMerged(): Promise<UniversityCountry[]> {
  try {
    const res = await fetch('/api/universities')
    if (!res.ok) throw new Error('bad status')
    const body = (await res.json()) as { additions?: Addition[] }
    const additions = Array.isArray(body.additions) ? body.additions : []
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(additions))
    } catch {
      /* private mode / quota — ignore */
    }
    cached = mergeCountries(additions)
    return cached
  } catch {
    cached = UNIVERSITY_COUNTRIES // fall back to the seed the user always had
    return cached
  }
}

// Returns the merged country list. Renders the seed (or a cached merge) synchronously
// on first paint, then upgrades once /api/universities answers. `active` gates the fetch
// so it only runs when the picker is actually open.
export function useUniversityCountries(active: boolean): UniversityCountry[] {
  const [countries, setCountries] = useState<UniversityCountry[]>(() => {
    if (cached) return cached
    const session = readSession()
    return session ? mergeCountries(session) : UNIVERSITY_COUNTRIES
  })

  useEffect(() => {
    if (!active || cached) return
    let cancelled = false
    inflight = inflight ?? fetchMerged()
    void inflight.then((merged) => {
      if (!cancelled) setCountries(merged)
    })
    return () => {
      cancelled = true
    }
  }, [active])

  return countries
}
