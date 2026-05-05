import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const llamaKey = env.LLAMA_API_KEY
  const llamaBaseUrl = (env.LLAMA_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
  const llamaModel = env.LLAMA_MODEL || 'meta-llama/llama-4-maverick:free'
  const ollamaBaseUrl = (env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
  const ollamaModel = env.OLLAMA_MODEL || 'llama3:8b'
  const aiSystemPrompt =
    "You are scmpedia AI, a precise supply chain management tutor. Explain terms using the authority, clarity, and practical orientation of Prof. Douglas Boateng's Executive Insight Series. Be accurate, concise, globally aware, and useful to professionals, students, policy makers, and business leaders. Return clean HTML only. Use <b> labels and no markdown."
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
                const response = llamaKey
                  ? await fetch(`${llamaBaseUrl}/chat/completions`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${llamaKey}`,
                        'HTTP-Referer': 'http://localhost:5173',
                        'X-Title': 'scmpedia',
                      },
                      body: JSON.stringify({
                        model: llamaModel,
                        messages: [
                          {
                            role: 'system',
                            content: aiSystemPrompt,
                          },
                          { role: 'user', content: prompt },
                        ],
                        temperature: 0.25,
                        max_tokens: 520,
                      }),
                    })
                  : await fetch(`${ollamaBaseUrl}/api/chat`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        model: ollamaModel,
                        messages: [
                          {
                            role: 'system',
                            content: aiSystemPrompt,
                          },
                          { role: 'user', content: prompt },
                        ],
                        stream: false,
                        temperature: 0.25,
                        options: { num_predict: 520 },
                      }),
                    })

                const textBody = await response.text()
                let data: any = {}
                try {
                  data = JSON.parse(textBody || '{}')
                } catch {
                  data = {}
                }
                if (!response.ok) {
                  const message = data?.error?.message || textBody.slice(0, 500) || `Llama error (${response.status})`
                  throw new Error(message)
                }

                const content = llamaKey ? data?.choices?.[0]?.message?.content : data?.message?.content || data?.response
                const outputText =
                  typeof content === 'string'
                    ? content
                    : Array.isArray(content)
                    ? content
                        .map((part: any) =>
                          typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''
                        )
                        .join('\n')
                    : ''

                if (!outputText.trim()) throw new Error('Llama returned an empty response')

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
