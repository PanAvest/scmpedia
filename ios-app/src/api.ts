import { API_BASE_URL, DEFAULT_ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL_ID, ELEVENLABS_OUTPUT_FORMAT, hasApiConfig } from './config'
import type { Entry, SubscriptionPlan } from './types'
import { normalizeEntry, SCMPEDIA_SECTORS, selectExampleSector, sectorExampleFallback } from './utils'

const requireApi = () => {
  if (!hasApiConfig) {
    throw new Error('Set EXPO_PUBLIC_API_BASE_URL to your SCMpedia website URL.')
  }
}

export const absoluteUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

async function requestJson(path: string, init?: RequestInit) {
  requireApi()
  const response = await fetch(absoluteUrl(path), init)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`)
  return body
}

export async function searchWords(query: string, limit = 8): Promise<Entry[]> {
  const q = query.trim()
  if (!q) return []
  const body = await requestJson(`/api/words?q=${encodeURIComponent(q)}&limit=${limit}`)
  return ((body?.words || []) as Entry[]).map(normalizeEntry).filter((entry) => entry.term && entry.definition)
}

export async function getWordsByTerms(terms: string[], limit = 25): Promise<Entry[]> {
  const clean = terms.map((term) => term.trim()).filter(Boolean).slice(0, 25)
  if (!clean.length) return []
  const body = await requestJson(`/api/words?terms=${encodeURIComponent(clean.join(','))}&limit=${limit}`)
  return ((body?.words || []) as Entry[]).map(normalizeEntry).filter((entry) => entry.term && entry.definition)
}

export async function browseWords(offset = 0, limit = 400): Promise<{ words: Entry[]; count: number; nextOffset: number }> {
  const body = await requestJson(`/api/words?browse=1&offset=${offset}&limit=${limit}`)
  return {
    words: ((body?.words || []) as Entry[]).map(normalizeEntry).filter((entry) => entry.term && entry.definition),
    count: Number(body?.count || 0),
    nextOffset: Number(body?.nextOffset || offset),
  }
}

export async function generateAI(prompt: string) {
  const body = await requestJson('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  return String(body?.text || '').trim()
}

export async function explainEntry(entry: Entry, regen = false) {
  const sector = await selectExampleSector()
  const instruction = regen
    ? `Re-explain the concept with a fresh practical angle and use only the ${sector} sector for the real-world example.`
    : `Explain the concept with precision and use only the ${sector} sector for the real-world example.`
  const prompt = `Term: "${entry.term}"
Dictionary definition: "${entry.definition}"
Tags: "${entry.tags || 'supply chain management'}"
Selected sector for this answer: "${sector}"
Allowed sector list: ${SCMPEDIA_SECTORS.join('; ')}

Task: ${instruction}

Quality requirements:
- Explain like a senior supply chain educator advising professionals and students.
- Preserve the meaning of the supplied dictionary definition.
- Use plain, actionable language without oversimplifying the term.
- Give a detailed explanation before the example.
- Use only the selected sector for the real-world example.

Output format:
Return strictly HTML. No markdown.
Use exactly these sections:
<b>Concept Overview:</b> ...
<br/><br/><b>Why It Matters:</b> ...
<br/><br/><b>Real-World Example (${sector}):</b> ...`

  try {
    const text = await generateAI(prompt)
    if (text) return text
  } catch {
    // Fall through to dictionary-based explanation.
  }
  return `<b>Concept Overview:</b> ${entry.definition}<br/><br/><b>Why It Matters:</b> This term can affect planning discipline, cost control, reliability, service quality, operational risk, and growth.<br/><br/><b>Real-World Example (${sector}):</b> ${sectorExampleFallback(entry, sector)}`
}

export async function industryExample(entry: Entry, sector: string) {
  try {
    const text = await generateAI(
      `Supply chain term: "${entry.term}"\nDefinition: "${entry.definition}"\n\nWrite ONE focused paragraph (2-3 sentences) of a concrete, realistic example of how "${entry.term}" applies in the ${sector} industry. Be specific to that industry. No headings, just the example paragraph.`,
    )
    return text || sectorExampleFallback(entry, sector)
  } catch {
    return sectorExampleFallback(entry, sector)
  }
}

export async function getImageForEntry(entry: Entry) {
  const params = new URLSearchParams({
    q: entry.term,
    definition: entry.definition.slice(0, 240),
    v: `mobile-${Date.now()}`,
  })
  const body = await requestJson(`/api/image?${params.toString()}`)
  return {
    url: String(body?.url || body?.thumbnail || ''),
    thumbnail: String(body?.thumbnail || body?.url || ''),
    title: String(body?.title || ''),
    contextLink: String(body?.contextLink || ''),
  }
}

export async function initializeCheckout(plan: SubscriptionPlan, token: string) {
  const body = await requestJson('/api/paystack/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
  })
  return {
    authorizationUrl: String(body?.authorizationUrl || ''),
    reference: String(body?.reference || ''),
  }
}

export async function verifyCheckout(reference: string, token: string) {
  return requestJson('/api/paystack/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reference }),
  })
}

export async function requestElevenLabsAudio(text: string) {
  requireApi()
  return fetch(absoluteUrl('/api/tts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voiceId: DEFAULT_ELEVENLABS_VOICE_ID,
      modelId: ELEVENLABS_MODEL_ID,
      outputFormat: ELEVENLABS_OUTPUT_FORMAT,
    }),
  })
}
