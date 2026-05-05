import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const pollinationsKey = env.POLLINATIONS_API_KEY
  const pollinationsBaseUrl = env.POLLINATIONS_BASE_URL || 'https://gen.pollinations.ai'
  const pollinationsModel = env.POLLINATIONS_MODEL || 'openai'
  const cseKey = env.GOOGLE_CSE_API_KEY
  const cseCx = env.GOOGLE_CSE_CX
  const elevenLabsKey = env.ELEVENLABS_API_KEY
  const elevenLabsVoiceId = env.ELEVENLABS_VOICE_ID || 'VR5rq02kIGuHRg0JKxB6'
  const elevenLabsModelId = env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
  const elevenLabsOutputFormat = env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128'

  return {
    plugins: [
      react(),
      {
        name: 'scm-pedia-proxy',
        configureServer(server) {
          server.middlewares.use('/api/ai', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }

            let body = ''
            req.on('data', (chunk) => {
              body += chunk
            })

            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}')
                const prompt = String(parsed.prompt || '')

                if (!prompt) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Missing prompt' }))
                  return
                }

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

                const callPollinationsChat = async (useKey: boolean) => {
                  const response = await fetch(`${pollinationsBaseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(useKey && pollinationsKey ? { Authorization: `Bearer ${pollinationsKey}` } : {}),
                    },
                    body: JSON.stringify({
                      model: pollinationsModel,
                      messages: [{ role: 'user', content: prompt }],
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

                  const message = parsed?.choices?.[0]?.message || {}
                  const text = typeof message?.content === 'string' ? message.content : ''
                  const blocks = Array.isArray(message?.content_blocks) ? message.content_blocks : []
                  const blockText = blocks
                    .filter((block: any) => block?.type === 'text' && typeof block?.text === 'string')
                    .map((block: any) => block.text)
                    .join('\n')
                  const finalText = text || blockText
                  if (!finalText || isBadPollinations(finalText)) {
                    const preview = finalText ? finalText.slice(0, 500) : 'empty content'
                    throw new Error(`Pollinations error (${response.status}): ${preview}`)
                  }

                  return finalText
                }

                const callPollinationsText = async (useKey: boolean) => {
                  const query = new URLSearchParams({
                    model: pollinationsModel,
                    temperature: '0.3',
                  })
                  if (useKey && pollinationsKey) query.set('key', pollinationsKey)
                  const url = `${pollinationsBaseUrl}/text/${encodeURIComponent(prompt)}?${query.toString()}`
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

                const generateText = async (useKey: boolean) => {
                  try {
                    return await callPollinationsChat(useKey)
                  } catch {
                    return await callPollinationsText(useKey)
                  }
                }

                let outputText = ''
                try {
                  outputText = await generateText(Boolean(pollinationsKey))
                } catch {
                  outputText = await generateText(false)
                }

                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ text: outputText }))
              } catch (err: any) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: err?.message || 'AI request failed' }))
              }
            })
          })

          server.middlewares.use('/api/tts', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }

            let body = ''
            req.on('data', (chunk) => {
              body += chunk
            })

            req.on('end', async () => {
              try {
                if (!elevenLabsKey) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Missing ElevenLabs API key' }))
                  return
                }

                const parsed = JSON.parse(body || '{}')
                const text = String(parsed.text || '').trim()
                if (!text) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Missing text' }))
                  return
                }

                const voiceId = String(parsed.voiceId || elevenLabsVoiceId).trim()
                const modelId = String(parsed.modelId || elevenLabsModelId).trim()
                const outputFormat = String(parsed.outputFormat || elevenLabsOutputFormat).trim()
                const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
                  voiceId
                )}?output_format=${encodeURIComponent(outputFormat)}`

                const response = await fetch(url, {
                  method: 'POST',
                  headers: {
                    Accept: 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': elevenLabsKey,
                  },
                  body: JSON.stringify({
                    text,
                    model_id: modelId,
                  }),
                })

                const payload = Buffer.from(await response.arrayBuffer())
                if (!response.ok) {
                  res.statusCode = response.status
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: payload.toString('utf8').slice(0, 500) }))
                  return
                }

                res.statusCode = 200
                res.setHeader('Content-Type', 'audio/mpeg')
                res.setHeader('Cache-Control', 'no-store')
                res.end(payload)
              } catch (err: any) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: err?.message || 'Failed to generate audio' }))
              }
            })
          })

          server.middlewares.use('/api/image', (req, res) => {
            if (req.method !== 'GET') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }

            const url = new URL(req.url || '', 'http://localhost')
            const q = url.searchParams.get('q')?.trim() || ''
            if (!q) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing query' }))
              return
            }

            if (!cseKey || !cseCx) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing Google CSE configuration' }))
              return
            }

            const params = new URLSearchParams({
              key: cseKey,
              cx: cseCx,
              q,
              searchType: 'image',
              num: '1',
              safe: 'active',
            })
            const apiUrl = `https://www.googleapis.com/customsearch/v1?${params.toString()}`

            fetch(apiUrl)
              .then(async (response) => {
                const body = await response.text()
                if (!response.ok) {
                  res.statusCode = response.status
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: body.slice(0, 500) }))
                  return
                }

                let data: any
                try {
                  data = JSON.parse(body)
                } catch {
                  res.statusCode = 502
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Invalid response from Google' }))
                  return
                }

                const item = data?.items?.[0]
                const link = typeof item?.link === 'string' ? item.link : ''
                const thumbnail = typeof item?.image?.thumbnailLink === 'string' ? item.image.thumbnailLink : ''

                if (!link && !thumbnail) {
                  res.statusCode = 404
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'No image results' }))
                  return
                }

                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ url: link || thumbnail, thumbnail }))
              })
              .catch((err: any) => {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: err?.message || 'Failed to fetch image' }))
              })
          })
        },
      },
    ],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          admin: resolve(__dirname, 'admin.html'),
        },
      },
    },
  }
})
