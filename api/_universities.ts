import './_runtime.js'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminIdentity = { email: string; role: string }
export type UniversityAddition = { id: string; country_code: string; name: string; name_key: string; created_at: string }

// Normalized dedupe key. MUST stay identical to normalizeUniversityName in
// src/data/universities.ts so the client merges seed + additions without duplicates.
const STOPWORDS = new Set(['the', 'of', 'and', 'at', 'for', 'in'])
export function normalizeUniversityName(name: string): string {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w))
    .join(' ')
    .trim()
}

const isMissingTable = (error: unknown) => {
  const err = error as { code?: unknown; message?: unknown } | null
  const code = String(err?.code || '')
  const message = String(err?.message || '').toLowerCase()
  return code === '42P01' || code === 'PGRST205' || message.includes('does not exist') || message.includes('schema cache')
}

// Every admin-approved addition. Missing table → empty (the client falls back to the
// compiled seed list), same tolerance as api/_plans.ts.
export async function loadUniversityAdditions(service: SupabaseClient): Promise<UniversityAddition[]> {
  const { data, error } = await service
    .from('scmpedia_universities')
    .select('id,country_code,name,name_key,created_at')
    .order('country_code', { ascending: true })
    .order('name', { ascending: true })
  if (error) {
    if (isMissingTable(error)) return []
    throw new Error(`Could not load universities: ${error.message}`)
  }
  return (data || []) as UniversityAddition[]
}

export async function addUniversity(
  service: SupabaseClient,
  identity: AdminIdentity,
  body: { country_code?: unknown; name?: unknown },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const countryCode = String(body.country_code || '').trim().toUpperCase()
  const name = String(body.name || '').trim().replace(/\s+/g, ' ')
  if (!countryCode) return { status: 400, body: { error: 'Pick a country' } }
  if (name.length < 2) return { status: 400, body: { error: 'Enter the full university name' } }
  if (name.length > 160) return { status: 400, body: { error: 'That name is too long' } }

  const nameKey = normalizeUniversityName(name)
  if (!nameKey) return { status: 400, body: { error: 'Enter a valid university name' } }

  const { error } = await service.from('scmpedia_universities').insert({
    country_code: countryCode,
    name,
    name_key: nameKey,
    created_by: identity.email,
  })
  if (error) {
    if (String((error as { code?: unknown }).code) === '23505') {
      return { status: 409, body: { error: 'That university is already in the list for this country.' } }
    }
    if (isMissingTable(error)) {
      return { status: 503, body: { error: 'Run supabase-admin-users.sql before adding universities.' } }
    }
    return { status: 500, body: { error: error.message } }
  }
  const universities = await loadUniversityAdditions(service)
  return { status: 200, body: { message: `Added "${name}" to the list.`, universities } }
}

export async function deleteUniversity(
  service: SupabaseClient,
  id: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!id) return { status: 400, body: { error: 'Missing id' } }
  const { error } = await service.from('scmpedia_universities').delete().eq('id', id)
  if (error) return { status: 500, body: { error: error.message } }
  const universities = await loadUniversityAdditions(service)
  return { status: 200, body: { message: 'Removed.', universities } }
}
