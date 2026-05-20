import { useState } from 'react'
import type { Entry } from '../types'
import { escapeHtml, selectExampleSector, sectorExampleFallback, fallbackExplanation, SCMPEDIA_SECTORS } from '../utils'

export function useAI() {
  const [status] = useState<'loading' | 'ready' | 'error'>('ready')

  const formatToHtml = (raw: string, anchor: Entry, sector: string) => {
    let text = raw.trim()
    if (!text) return fallbackExplanation(anchor, sector)
    const hasHtml = /<\/?[a-z][\s\S]*>/i.test(text)
    if (!hasHtml) {
      text = escapeHtml(text).replace(/\r?\n+/g, '\n')
    }
    text = text
      .replace(/Concept Overview:/i, '<b>Concept Overview:</b>')
      .replace(/Why It Matters:/i, '<b>Why It Matters:</b>')
      .replace(/Concept:/i, '<b>Concept:</b>')
      .replace(/Real-World Examples Across Industries:/i, `<b>Real-World Example (${escapeHtml(sector)}):</b>`)
      .replace(/Real-World Example(?:\s*\([^)]*\))?:/i, `<b>Real-World Example (${escapeHtml(sector)}):</b>`)
    if (!text.includes('<b>Concept:</b>') && !text.includes('<b>Concept Overview:</b>')) {
      text = `<b>Concept Overview:</b> ${text}`
    }
    if (!text.includes('<b>Real-World Example')) {
      text += `<br/><br/><b>Real-World Example (${escapeHtml(sector)}):</b> ${escapeHtml(sectorExampleFallback(anchor, sector))}`
    } else {
      text = text.replace(/\n/g, '<br/>')
    }
    return text
  }

  const scmpediaGenerate = async (anchor: Entry, sector: string, isRegen?: boolean) => {
    const instruction = isRegen
      ? `Re-explain the concept with a fresh practical angle and use only the ${sector} sector for the real-world example.`
      : `Explain the concept with precision and use only the ${sector} sector for the real-world example.`

    const prompt = `Term: "${anchor.term}"
Dictionary definition: "${anchor.definition}"
Tags: "${anchor.tags || 'supply chain management'}"
Selected sector for this answer: "${sector}"
Allowed sector list: ${SCMPEDIA_SECTORS.join('; ')}

Task: ${instruction}

Quality requirements:
- Explain like a senior supply chain educator advising professionals and students.
- Preserve the meaning of the supplied dictionary definition.
- Use plain, actionable language without oversimplifying the term.
- Give a detailed explanation of the term before the example. Use 3 to 5 clear sentences across Concept Overview and Why It Matters.
- Do not mention every sector in the allowed list.
- Do not use more than one sector in the real-world example.
- Make the selected-sector example realistic for logistics, procurement, operations, manufacturing, sourcing, trade, service delivery, finance, infrastructure, or risk control.
- Make the real-world example one focused paragraph of 2 to 3 sentences.

Output format:
Return strictly HTML. No markdown.
Use exactly these sections:
<b>Concept Overview:</b> ...
<br/><br/><b>Why It Matters:</b> ...
<br/><br/><b>Real-World Example (${sector}):</b> ...`

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(JSON.stringify({ status: response.status, body: errText || 'AI error' }))
    }

    const data = await response.json()
    const text = data?.text || ''
    if (!text) throw new Error('scmpedia AI returned empty response')
    return { text, sector }
  }

  const generate = async (anchor: Entry, isRegen?: boolean) => {
    const sector = selectExampleSector()
    try {
      const { text } = await scmpediaGenerate(anchor, sector, isRegen)
      return formatToHtml(text, anchor, sector)
    } catch (e) {
      console.error('scmpedia AI error', e)
    }

    return `<i>Could not reach scmpedia AI. Here is a dictionary-based summary:</i><br/><br/><b>Concept Overview:</b> ${escapeHtml(anchor.term)} refers to ${escapeHtml(anchor.definition)}.<br/><br/><b>Why It Matters:</b> This term can affect planning discipline, cost control, reliability, service quality, operational risk, and growth.<br/><br/><b>Real-World Example (${escapeHtml(sector)}):</b> ${escapeHtml(sectorExampleFallback(anchor, sector))}`
  }

  return { status, generate }
}
