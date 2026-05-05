import type { VercelRequest, VercelResponse } from '@vercel/node'

const BASE_URL = process.env.POLLINATIONS_BASE_URL || 'https://gen.pollinations.ai'
const API_KEY = process.env.POLLINATIONS_API_KEY
const MODEL = process.env.POLLINATIONS_MODEL || 'openai'

const isBadPollinations = (text: string) => {
  const s = (text || '').toLowerCase()
  return (
    s.includes('important notice') ||
    s.includes('legacy text api') ||
    s.includes('being deprecated') ||
    s.includes('migrate to our new service') ||
    s.includes('enter.pollinations.ai')
  )
}

const extractMessageText = (parsed: any) => {
  const message = parsed?.choices?.[0]?.message || {}
  const text = typeof message?.content === 'string' ? message.content : ''
  const blocks = Array.isArray(message?.content_blocks) ? message.content_blocks : []
  const blockText = blocks
    .filter((block: any) => block?.type === 'text' && typeof block?.text === 'string')
    .map((block: any) => block.text)
    .join('\n')
  return text || blockText
}

const callPollinationsChat = async (prompt: string, useKey: boolean) => {
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(useKey && API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: String(prompt) }],
      temperature: 0.3,
      max_tokens: 520,
    }),
  })

  const textBody = await response.text()
  if (!response.ok || !textBody) {
    const preview = textBody ? textBody.slice(0, 500) : 'empty response'
    throw new Error(`Pollinations error (${response.status}): ${preview}`)
  }

  let parsed: any
  try {
    parsed = JSON.parse(textBody)
  } catch {
    throw new Error(textBody.slice(0, 500))
  }

  const finalText = extractMessageText(parsed)
  if (!finalText || isBadPollinations(finalText)) {
    const preview = finalText ? finalText.slice(0, 500) : 'empty content'
    throw new Error(`Pollinations error (${response.status}): ${preview}`)
  }

  return finalText
}

const callPollinationsText = async (prompt: string, useKey: boolean) => {
  const query = new URLSearchParams({
    model: MODEL,
    temperature: '0.3',
  })
  if (useKey && API_KEY) query.set('key', API_KEY)
  const url = `${BASE_URL}/text/${encodeURIComponent(prompt)}?${query.toString()}`
  const response = await fetch(url, { method: 'GET' })
  const textBody = await response.text()
  if (!response.ok || !textBody) {
    const preview = textBody ? textBody.slice(0, 500) : 'empty response'
    throw new Error(`Pollinations error (${response.status}): ${preview}`)
  }
  if (isBadPollinations(textBody)) {
    throw new Error(`Pollinations error (${response.status}): ${textBody.slice(0, 500)}`)
  }
  return textBody
}

const generateText = async (prompt: string, useKey: boolean) => {
  try {
    return await callPollinationsChat(prompt, useKey)
  } catch {
    return await callPollinationsText(prompt, useKey)
  }
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
    let text = ''
    try {
      text = await generateText(String(prompt), Boolean(API_KEY))
    } catch {
      text = await generateText(String(prompt), false)
    }
    res.status(200).json({ text })
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'SCM AI request failed' })
  }
}
