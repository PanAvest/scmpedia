import OpenAI from 'openai'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const API_KEY = process.env.OPENAI_API_KEY
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini'

const client = API_KEY ? new OpenAI({ apiKey: API_KEY }) : null

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

  if (!client) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY' })
    return
  }

  try {
    const response = await client.responses.create({
      model: MODEL,
      input: String(prompt),
      store: true,
    })

    const text = response.output_text || ''
    if (!text.trim()) {
      res.status(502).json({ error: 'OpenAI returned an empty response' })
      return
    }

    res.status(200).json({ text })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'AI request failed' })
  }
}
