import type { VercelRequest, VercelResponse } from '@vercel/node'

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const SYSTEM_PROMPT =
  "You are scmpedia AI, a precise supply chain management tutor. Explain terms using the authority, clarity, and practical orientation of Prof. Douglas Boateng's Executive Insight Series. Be accurate, concise, globally aware, and useful to professionals, students, policy makers, and business leaders. Return clean HTML only. Use <b> labels and no markdown."

const extractText = (data: any) => {
  const parts = data?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('\n')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { prompt } = req.body || {}
  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' })
    return
  }

  if (!API_KEY) {
    res.status(500).json({ error: 'Missing GEMINI_API_KEY' })
    return
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: String(prompt) }],
          },
        ],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 520,
        },
      }),
    })

    const bodyText = await response.text()
    let data: any = {}
    try {
      data = JSON.parse(bodyText || '{}')
    } catch {
      data = {}
    }

    if (!response.ok) {
      const message = data?.error?.message || bodyText.slice(0, 500) || `Gemini request failed (${response.status})`
      throw new Error(message)
    }

    const text = extractText(data)
    if (!text.trim()) {
      res.status(502).json({ error: 'Gemini returned an empty response' })
      return
    }

    res.status(200).json({ text })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Gemini request failed' })
  }
}
