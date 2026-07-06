import AsyncStorage from '@react-native-async-storage/async-storage'
import { SECTOR_HISTORY_KEY, readJson, writeJson } from './storage'
import type { Entry, SubscriptionState } from './types'

export const FREE_DAILY_LIMIT = 2

export const SCMPEDIA_SECTORS = [
  'chemical',
  'oil',
  'mining',
  'financial services',
  'food and beverages',
  'electronics',
  'healthcare',
  'tourism',
  'agriculture',
  'construction',
]

export const uuid = () => Math.random().toString(36).slice(2, 10)

export const cleanReplacementChars = (input: string) =>
  input
    .replace(/�/g, '.')
    .replace(/\s+\./g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()

export const normalizeEntry = (row: any): Entry => {
  const entry = {
    id: row?.id ? String(row.id) : undefined,
    source_key: row?.source_key ? String(row.source_key) : undefined,
    term: cleanReplacementChars(String(row?.term || row?.Term || '')),
    definition: cleanReplacementChars(String(row?.definition || row?.Definition || '')),
    synonyms: cleanReplacementChars(String(row?.synonyms || row?.Synonyms || '')),
    tags: cleanReplacementChars(String(row?.tags || row?.Tags || '')),
    pos: cleanReplacementChars(String(row?.pos || row?.Pos || '')),
    pronunciation: cleanReplacementChars(String(row?.pronunciation || row?.Pronunciation || '')),
    examples: cleanReplacementChars(String(row?.examples || row?.Examples || '')),
  }
  return { ...entry, tags: getEntryTags(entry).join(', ') }
}

export const getEntryId = (entry: Entry) => String(entry.id || entry.source_key || entry.term).trim()

export const termToSlug = (term: string) =>
  term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const entryLooksLikeAbbreviation = (entry: Pick<Entry, 'term' | 'definition'>) => {
  const term = String(entry.term || '').trim()
  if (!term || /[a-z]/.test(term)) return false
  const letters = term.replace(/[^A-Z]/g, '')
  return letters.length >= 2 && letters.length <= 10 && /^[A-Z0-9/&(). -]+$/.test(term)
}

export const getEntryTags = (entry: Pick<Entry, 'term' | 'definition' | 'tags'>) => {
  const tags = String(entry.tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  if ((/\babbreviation\s+for\b/i.test(entry.definition || '') || entryLooksLikeAbbreviation(entry)) && !tags.some((tag) => tag.toLowerCase() === 'abbreviation')) {
    tags.unshift('abbreviation')
  }
  return Array.from(new Map(tags.map((tag) => [tag.toLowerCase(), tag])).values())
}

export const stripHtml = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?b>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

export const formatRelativeTime = (time: number) => {
  const diff = Math.max(0, Date.now() - time)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export const formatSubscriptionDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export const subscriptionFromUser = (user: any): SubscriptionState => {
  const subscription = user?.app_metadata?.scmpedia_subscription
  if (!subscription || subscription.tier !== 'premium') return { tier: 'free' }
  const expiresAt = typeof subscription.expires_at === 'string' ? subscription.expires_at : ''
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return { tier: 'free' }
  return {
    tier: 'premium',
    plan: subscription.plan === 'monthly' ? 'monthly' : 'annual',
    expiresAt,
  }
}

export const sectorExampleFallback = (anchor: Entry, sector: string) => {
  const term = anchor.term || 'this concept'
  const definition = anchor.definition?.replace(/\.$/, '') || 'the way resources, decisions, and activities are coordinated'
  const templates: Record<string, string> = {
    chemical: `In a chemical plant, ${term} helps planners translate ${definition} into decisions about raw-material availability, batch scheduling, storage controls, and safe movement of hazardous inputs.`,
    oil: `In the oil sector, ${term} can guide how drilling teams, depots, vessels, and maintenance contractors coordinate equipment, spares, fuel, and documentation.`,
    mining: `In mining, ${term} affects how explosives, tyres, fuel, replacement parts, and haulage capacity are planned around production targets.`,
    'financial services': `In financial services, ${term} can shape how banks manage vendor onboarding, branch cash logistics, payment platforms, outsourced services, and operational controls.`,
    'food and beverages': `In food and beverages, ${term} supports decisions about ingredient supply, shelf life, production runs, cold-chain handling, and delivery timing.`,
    electronics: `In electronics, ${term} can be used to coordinate component sourcing, supplier lead times, quality checks, assembly capacity, and after-sales spares.`,
    healthcare: `In healthcare, ${term} helps hospitals and suppliers keep medicines, consumables, diagnostic kits, and critical equipment available at the point of care.`,
    tourism: `In tourism, ${term} can guide how hotels, tour operators, restaurants, transport providers, and maintenance teams prepare for seasonal demand.`,
    agriculture: `In agriculture, ${term} influences how seeds, fertiliser, equipment, labour, storage, and transport are timed around weather, harvest windows, and market demand.`,
    construction: `In construction, ${term} helps align materials, equipment, subcontractors, permits, and site sequencing with the project schedule.`,
  }
  return templates[sector] || templates.healthcare
}

export async function selectExampleSector() {
  const recent = await readJson<string[]>(SECTOR_HISTORY_KEY, [])
  const pool = SCMPEDIA_SECTORS.filter((sector) => !recent.includes(sector))
  const choices = pool.length ? pool : SCMPEDIA_SECTORS.filter((sector) => sector !== recent[0])
  const sector = choices[Math.floor(Math.random() * choices.length)] || SCMPEDIA_SECTORS[0]
  await writeJson(SECTOR_HISTORY_KEY, [sector, ...recent.filter((item) => item !== sector)].slice(0, 4))
  return sector
}

export async function clearLocalLearningData() {
  await AsyncStorage.multiRemove([SECTOR_HISTORY_KEY])
}
