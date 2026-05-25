import type { VercelRequest, VercelResponse } from './vercel-types'
import { createClient } from '@supabase/supabase-js'
import { enforceDailyLimit } from './server-auth'

const API_KEY = process.env.ELEVENLABS_API_KEY
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'VR5rq02kIGuHRg0JKxB6'
const DEFAULT_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
const DEFAULT_OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const serviceClient =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

const resolveText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!API_KEY) {
    res.status(400).json({ error: 'Missing ElevenLabs API key' })
    return
  }
  if (serviceClient) {
    const usage = await enforceDailyLimit(req, serviceClient, 'tts', 20)
    if (!usage.ok) {
      res.status(usage.status || 429).json({ error: usage.error || 'Daily voice limit reached' })
      return
    }
  }

  const text = resolveText(req.body?.text)
  if (!text) {
    res.status(400).json({ error: 'Missing text' })
    return
  }

  const voiceId = resolveText(req.body?.voiceId) || DEFAULT_VOICE_ID
  const modelId = resolveText(req.body?.modelId) || DEFAULT_MODEL_ID
  const outputFormat = resolveText(req.body?.outputFormat) || DEFAULT_OUTPUT_FORMAT
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(
    outputFormat
  )}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
      }),
    })

    const payload = Buffer.from(await response.arrayBuffer())
    if (!response.ok) {
      res.status(response.status).json({ error: payload.toString('utf8').slice(0, 500) })
      return
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(payload)
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to generate audio' })
  }
}
