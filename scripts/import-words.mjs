import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const csvPath = process.argv[2] || path.join(root, 'data', 'scmpedia_full_UPDATED.csv')

try {
  const envText = await fs.readFile(path.join(root, '.env.local'), 'utf8')
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (!process.env[key]) process.env[key] = rawValue.replace(/^["']|["']$/g, '')
  }
} catch {
  // .env.local is optional; CI can provide environment variables directly.
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run with: SUPABASE_SERVICE_ROLE_KEY=... npm run import:words')
  process.exit(1)
}

const normalize = (row) => ({
  term: String(row.term || row.Term || '').trim(),
  definition: String(row.definition || row.Definition || '').trim(),
  synonyms: String(row.synonyms || row.Synonyms || ''),
  tags: String(row.tags || row.Tags || ''),
  pos: String(row.pos || row.Pos || ''),
  pronunciation: String(row.pronunciation || row.Pronunciation || ''),
  examples: String(row.examples || row.Examples || ''),
})

const getSourceKeyBase = (term) => term.trim().toLowerCase()

const chunk = (items, size) => {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const csv = await fs.readFile(csvPath, 'utf8')
const parsed = Papa.parse(csv, {
  header: true,
  skipEmptyLines: true,
})

if (parsed.errors.length) {
  console.warn(`CSV parsed with ${parsed.errors.length} warning(s). First warning:`)
  console.warn(parsed.errors[0])
}

const occurrenceByTerm = new Map()
const entries = []
for (const row of parsed.data) {
  const entry = normalize(row)
  if (!entry.term || !entry.definition) continue
  const keyBase = getSourceKeyBase(entry.term)
  const occurrence = (occurrenceByTerm.get(keyBase) || 0) + 1
  occurrenceByTerm.set(keyBase, occurrence)
  entries.push({
    source_key: occurrence === 1 ? keyBase : `${keyBase}::${occurrence}`,
    ...entry,
  })
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let uploaded = 0
for (const batch of chunk(entries, 500)) {
  const { error } = await supabase.from('words').upsert(batch, { onConflict: 'source_key' })
  if (error) {
    if (String(error.message || '').includes('source_key')) {
      console.error('The words table is missing the source_key import column.')
      console.error('Run supabase-allow-duplicate-words.sql in Supabase SQL Editor, then rerun this import.')
    }
    console.error(error)
    process.exit(1)
  }
  uploaded += batch.length
  console.log(`Uploaded ${uploaded}/${entries.length}`)
}

console.log(`Done. Imported ${uploaded} words from ${csvPath}`)
