import type { VercelRequest, VercelResponse } from '@vercel/node'

const API_KEY = process.env.LLAMA_API_KEY
const BASE_URL = (process.env.LLAMA_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const MODEL = process.env.LLAMA_MODEL || 'meta-llama/llama-4-maverick:free'
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3:8b'
const SYSTEM_PROMPT =
  "You are scmpedia AI, a precise supply chain management tutor. Explain terms using the authority, clarity, and practical orientation of Prof. Douglas Boateng's Executive Insight Series. Be accurate, concise, globally aware, and useful to professionals, students, policy makers, and business leaders. Return clean HTML only. Use <b> labels and no markdown."

const extractText = (data: any) => {
  const content = data?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (typeof part?.text === 'string') return part.text
        return ''
      })
      .join('\n')
  }
  return ''
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

  try {
    const response = API_KEY
      ? await fetch(`${BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
            'HTTP-Referer': 'https://scmpedia.vercel.app',
            'X-Title': 'scmpedia',
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: 'system',
                content: SYSTEM_PROMPT,
              },
              { role: 'user', content: String(prompt) },
            ],
            temperature: 0.25,
            max_tokens: 520,
          }),
        })
      : await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          { role: 'user', content: String(prompt) },
        ],
        stream: false,
        temperature: 0.25,
        options: { num_predict: 520 },
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
      const message = data?.error?.message || bodyText.slice(0, 500) || `Llama request failed (${response.status})`
      throw new Error(message)
    }

    const text = API_KEY ? extractText(data) : data?.message?.content || data?.response || ''
    if (!text.trim()) {
      res.status(502).json({ error: 'Llama returned an empty response' })
      return
    }

    res.status(200).json({ text })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Llama request failed' })
  }
}
