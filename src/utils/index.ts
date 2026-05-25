import type { Entry } from '../types'

export const DEFAULT_ELEVENLABS_VOICE_ID = 'VR5rq02kIGuHRg0JKxB6'
export const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2'
export const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128'
export const LOCAL_ENTRIES_KEY = 'scmpedia-admin-entries-v1'
export const THEME_KEY = 'scmpedia-theme-v1'
export const DICTIONARY_MODE_KEY = 'scmpedia-dictionary-mode-v1'
export const AUTO_READ_AI_KEY = 'scmpedia-auto-read-ai-v1'
export const TTS_PROVIDER_KEY = 'scmpedia-tts-provider-v1'
export const SELECTED_VOICE_KEY = 'scmpedia-selected-voice-v1'
export const SETTINGS_NOTIFICATIONS_KEY = 'scmpedia-notification-settings-v1'
export const UNIT_SYSTEM_KEY = 'scmpedia-unit-system-v1'
export const FREE_USAGE_KEY = 'scmpedia-free-usage-v1'
export const FREE_DAILY_LIMIT = 2
export const SECTOR_HISTORY_KEY = 'scmpedia-sector-history-v1'
export const DASHBOARD_HISTORY_KEY = 'scmpedia_recent_searches'

export type DashboardHistoryItem = {
  term: string
  at: number
}

export const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000

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

export const uuid = () => Math.random().toString(36).substring(2, 9)

export const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const sanitizeHtml = (input: string) =>
  escapeHtml(input)
    .replace(/&lt;(br\s*\/?)&gt;/gi, '<br/>')
    .replace(/&lt;(\/?(?:b|strong|i|em))&gt;/gi, '<$1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

export const cleanReplacementChars = (input: string) =>
  input
    .replace(/�/g, '.')
    .replace(/\s+\./g, '.')
    .replace(/\.(?=[A-Z]\.)/g, '.')
    .replace(/\.(?=\s*[),])/g, '.')
    .replace(/\.(?=\s*\()/g, '.')
    .replace(/\.(?=\s+(?:AND|JR|SR|EDS?\b))/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')

export const todayKey = () => new Date().toISOString().slice(0, 10)

export const readFreeUsage = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(FREE_USAGE_KEY) || '{}')
    if (parsed?.day === todayKey()) return Number(parsed.count) || 0
  } catch {
    // reset invalid local usage state
  }
  return 0
}

export const writeFreeUsage = (count: number) => {
  localStorage.setItem(FREE_USAGE_KEY, JSON.stringify({ day: todayKey(), count }))
}

export const readDashboardHistory = (): DashboardHistoryItem[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DASHBOARD_HISTORY_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    const cutoff = Date.now() - HISTORY_TTL_MS
    const normalized = parsed
      .map((item) => {
        if (typeof item === 'string') return { term: item, at: Date.now() }
        return { term: String(item?.term || ''), at: Number(item?.at || Date.now()) }
      })
      .filter((item) => item.term.trim() && item.at >= cutoff)
      .slice(0, 30)
    if (normalized.length !== parsed.length) {
      localStorage.setItem(DASHBOARD_HISTORY_KEY, JSON.stringify(normalized))
    }
    return normalized
  } catch {
    return []
  }
}

export const writeDashboardHistory = (items: DashboardHistoryItem[]) => {
  localStorage.setItem(DASHBOARD_HISTORY_KEY, JSON.stringify(items.slice(0, 30)))
}

export const recordDashboardSearch = (term: string) => {
  const cleanTerm = term.trim()
  if (!cleanTerm) return readDashboardHistory()
  const current = readDashboardHistory()
  const next = [
    { term: cleanTerm, at: Date.now() },
    ...current.filter((item) => item.term.toLowerCase() !== cleanTerm.toLowerCase()),
  ].slice(0, 30)
  writeDashboardHistory(next)
  return next
}

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

export const readSectorHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SECTOR_HISTORY_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((s) => SCMPEDIA_SECTORS.includes(s)).slice(0, 4) : []
  } catch {
    return []
  }
}

export const rememberSector = (sector: string) => {
  try {
    const next = [sector, ...readSectorHistory().filter((item) => item !== sector)].slice(0, 4)
    localStorage.setItem(SECTOR_HISTORY_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export const selectExampleSector = (): string => {
  const recent = readSectorHistory()
  const pool = SCMPEDIA_SECTORS.filter((s) => !recent.includes(s))
  const choices = pool.length ? pool : SCMPEDIA_SECTORS.filter((s) => s !== recent[0])
  const sector = (choices[Math.floor(Math.random() * choices.length)] || SCMPEDIA_SECTORS[0]) as string
  rememberSector(sector)
  return sector
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
  return templates[sector] ?? templates['healthcare'] ?? `In supply chain, ${term} is used to support operational decisions and coordination.`
}

export const fallbackExplanation = (anchor: Entry, sector = selectExampleSector()) => {
  const concept = escapeHtml(anchor.definition || `${anchor.term} is a supply chain concept.`)
  const example = escapeHtml(sectorExampleFallback(anchor, sector))
  return `<b>Concept Overview:</b> ${concept}<br/><br/><b>Real-World Example (${escapeHtml(sector)}):</b> ${example}`
}

export const getEntryId = (entry: Entry) => String(entry.id || entry.term).trim()

export const termToSlug = (term: string) =>
  term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const entryHasAbbreviationDefinition = (entry: Pick<Entry, 'definition'>) =>
  /\babbreviation\s+for\b/i.test(entry.definition || '')

export const entryLooksLikeAbbreviation = (entry: Pick<Entry, 'term' | 'definition'>) => {
  const term = String(entry.term || '').trim()
  if (!term || /[a-z]/.test(term)) return false
  const letters = term.replace(/[^A-Z]/g, '')
  if (letters.length < 2 || letters.length > 10) return false
  if (/\s/.test(term) && !/\d/.test(term)) return false
  return /^[A-Z0-9/&(). -]+$/.test(term)
}

export const getEntryTags = (entry: Pick<Entry, 'term' | 'definition' | 'tags'>) => {
  const tags = String(entry.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  if (
    (entryHasAbbreviationDefinition(entry) || entryLooksLikeAbbreviation(entry)) &&
    !tags.some((t) => t.toLowerCase() === 'abbreviation')
  ) {
    tags.unshift('abbreviation')
  }
  return Array.from(new Map(tags.map((t) => [t.toLowerCase(), t])).values())
}

export const formatSubscriptionDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export const getPlanLabel = (plan?: string) => (plan === 'monthly' ? 'Monthly' : plan === 'annual' ? 'Annual' : 'Free')
