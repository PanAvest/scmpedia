import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

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
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
  const adminUser = env.SCMPEDIA_ADMIN_USER || env.VITE_SCMPEDIA_ADMIN_USER || 'scmpedia-admin'
  const adminPass = env.SCMPEDIA_ADMIN_PASS || env.VITE_SCMPEDIA_ADMIN_PASS || 'scmpedia-2026'
  const paystackSecretKey = env.PAYSTACK_SECRET_KEY
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
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
                res.end(
                  JSON.stringify({
                    error: err?.message || 'AI request failed',
                  }),
                )
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
                  voiceId,
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
                  res.end(
                    JSON.stringify({
                      error: payload.toString('utf8').slice(0, 500),
                    }),
                  )
                  return
                }

                res.statusCode = 200
                res.setHeader('Content-Type', 'audio/mpeg')
                res.setHeader('Cache-Control', 'no-store')
                res.end(payload)
              } catch (err: any) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: err?.message || 'Failed to generate audio',
                  }),
                )
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
            const definition = url.searchParams.get('definition')?.trim() || ''
            const exclude = url.searchParams.get('exclude')?.trim() || ''
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

            const cleanText = (value: string) =>
              value
                .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
                .replace(/\s+/g, ' ')
                .trim()
            const wordsFrom = (value: string) =>
              cleanText(value)
                .toLowerCase()
                .split(' ')
                .filter((word) => word.length > 2)
            const stopWords = new Set(['the', 'and', 'that', 'with', 'from', 'this', 'their', 'are', 'for', 'used', 'into', 'more'])
            const context = ['supply chain', 'logistics', 'procurement', 'inventory', 'warehouse', 'operations management']
            const visualWords = [
              'ghana',
              'tricycle',
              'tricycles',
              'cargo',
              'carrier',
              'carriers',
              'waste',
              'goods',
              'truck',
              'vehicle',
              'motor',
              'warehouse',
              'forklift',
              'container',
              'port',
              'ship',
              'pallet',
              'inventory',
              'procurement',
              'factory',
              'supplier',
              'highway',
              'road',
              'roadway',
              'route',
              'routing',
              'transportation',
              'corridor',
              'corridors',
              'traffic',
            ]
            const expandedTermFromDefinition = (value: string) => {
              const seeMatch = value.match(/^\s*see\s*:\s*([^.;]+)/i)
              if (seeMatch?.[1]) return cleanText(seeMatch[1])
              const colonMatch = value.match(/^\s*([^:]{4,90})\s*:/)
              if (colonMatch?.[1]) return cleanText(colonMatch[1])
              return ''
            }
            const expandedTerm = expandedTermFromDefinition(definition)
            const definitionWords = wordsFrom([expandedTerm, definition].filter(Boolean).join(' ')).filter((word) => !stopWords.has(word))
            const visualTerms = definitionWords.filter((word) => visualWords.includes(word)).slice(0, 6)
            const fallbackTerms = definitionWords
              .filter((word) => !visualTerms.includes(word))
              .slice(0, 8)
              .join(' ')
            const hasContext = context.some((term) => q.toLowerCase().includes(term))
            const isPhysicalTerm = visualTerms.some((word) =>
              ['ghana', 'tricycle', 'tricycles', 'cargo', 'carrier', 'vehicle', 'motor', 'truck'].includes(word),
            )
            const isShortAcronym = /^[A-Z0-9]{2,5}$/.test(cleanText(q)) && definitionWords.length > 0
            const contextualQuery = [
              cleanText(q),
              visualTerms.slice(0, 4).join(' '),
              visualTerms.length ? '' : fallbackTerms,
              hasContext || isPhysicalTerm ? '' : 'supply chain logistics',
            ]
              .filter(Boolean)
              .join(' ')
            const definitionContext = [
              isShortAcronym ? '' : cleanText(q),
              expandedTerm,
              fallbackTerms,
              'supply chain procurement logistics operations',
            ]
              .filter(Boolean)
              .join(' ')
            const imageQueries = Array.from(new Set([isShortAcronym ? definitionContext : cleanText(q), contextualQuery].filter(Boolean)))
            const scoreResult = (item: any) => {
              const haystack = [item?.title, item?.snippet, item?.displayLink, item?.link, item?.image?.contextLink]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
              const queryWords = isShortAcronym ? [] : wordsFrom(q)
              const expandedWords = wordsFrom(expandedTerm).filter((word) => !stopWords.has(word))
              let score = 0
              for (const word of queryWords) if (haystack.includes(word)) score += 18
              for (const word of visualTerms) if (haystack.includes(word)) score += 12
              if (!isShortAcronym && haystack.includes(q.toLowerCase())) score += 20
              for (const term of context) if (haystack.includes(term)) score += 6
              if (/\b(diagram|infographic|concept|process|management|logistics|warehouse|procurement)\b/.test(haystack)) score += 5
              if (
                /\b(logo|icon|clipart|meme|wallpaper|template|ppt|pdf|book cover|headshot|portrait|scandal|political|politics)\b/.test(
                  haystack,
                )
              )
                score -= 25
              if (
                /\b(song|songs|music|album|lyrics|soundcloud|spotify|stream|listen online|radio|mixtape|playlist|artist)\b/.test(haystack)
              )
                score -= 70
              if (
                /\b(school|schools|student|students|spring play|stage|theatre|theater|concert|embassy|training certificate|media training|ceremony)\b/.test(
                  haystack,
                )
              )
                score -= 80
              if (visualTerms.length && !visualTerms.some((word) => haystack.includes(word))) score -= 35
              if (isShortAcronym) {
                const expandedHits = expandedWords.filter((word) => haystack.includes(word)).length
                if (expandedWords.length && expandedHits < Math.min(2, expandedWords.length)) score -= 90
                if (haystack.includes(cleanText(q).toLowerCase()) && expandedHits === 0) score -= 40
              }
              if (/\b(researchgate|gbcghanaonline|upfrica|alibaba|alamy|ghanabusinessnews|citinewsroom|graphic)\b/.test(haystack))
                score += 14
              if (/\b(tiktok|instagram|facebook|lookaside|fbcdn)\b/.test(haystack)) score -= 16
              const pixels = Number(item?.image?.width || 0) * Number(item?.image?.height || 0)
              return score + Math.min(6, Math.floor(pixels / 500000))
            }
            const isReliableResult = (item: any, score: number) => {
              const haystack = [item?.title, item?.snippet, item?.displayLink, item?.link, item?.image?.contextLink]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
              if (
                /\b(song|songs|music|album|lyrics|soundcloud|spotify|stream|listen online|school|schools|student|students|spring play|stage|theatre|theater|concert|embassy|media training|ceremony)\b/.test(
                  haystack,
                )
              ) {
                return false
              }
              if (isShortAcronym) {
                const expandedWords = wordsFrom(expandedTerm).filter((word) => !stopWords.has(word))
                const expandedHits = expandedWords.filter((word) => haystack.includes(word)).length
                return score >= 18 && (!expandedWords.length || expandedHits >= Math.min(2, expandedWords.length))
              }
              return score >= 10
            }

            Promise.all(
              imageQueries.map(async (imageQuery) => {
                const params = new URLSearchParams({
                  key: cseKey,
                  cx: cseCx,
                  q: imageQuery,
                  searchType: 'image',
                  num: '10',
                  imgSize: 'large',
                  safe: 'active',
                })
                if (wordsFrom(q).length <= 5 && !definition) params.set('exactTerms', cleanText(q))
                const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`)
                const body = await response.text()
                if (!response.ok) throw new Error(body.slice(0, 500))
                return JSON.parse(body)
              }),
            )
              .then((responses) => {
                const seen = new Set<string>()
                const scoredItems = responses
                  .flatMap((data) => (Array.isArray(data?.items) ? data.items : []))
                  .filter((result: any) => {
                    const key = String(result?.link || result?.image?.thumbnailLink || '')
                    if (!key || seen.has(key)) return false
                    if (exclude && (String(result?.link || '') === exclude || String(result?.image?.thumbnailLink || '') === exclude))
                      return false
                    seen.add(key)
                    return typeof result?.link === 'string' || typeof result?.image?.thumbnailLink === 'string'
                  })
                  .map((result: any) => ({
                    result,
                    score: scoreResult(result),
                  }))
                  .filter(({ result, score }: any) => isReliableResult(result, score))
                  .sort((a: any, b: any) => b.score - a.score)
                const item = scoredItems[0]?.result
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
                res.setHeader('Cache-Control', 'no-store')
                res.end(
                  JSON.stringify({
                    url: link || thumbnail,
                    thumbnail,
                    link,
                    width: item?.image?.width || null,
                    height: item?.image?.height || null,
                    title: item?.title || '',
                    contextLink: item?.image?.contextLink || '',
                  }),
                )
              })
              .catch((err: any) => {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: err?.message || 'Failed to fetch image',
                  }),
                )
              })
          })

          server.middlewares.use('/api/paystack/initialize', (req, res) => {
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
                if (!supabaseUrl || !supabaseAnonKey || !paystackSecretKey) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: 'Missing payment server configuration',
                    }),
                  )
                  return
                }

                const plans: any = {
                  monthly: { amount: 2258, durationDays: 31 },
                  annual: { amount: 22578, durationDays: 366 },
                }
                const parsed = JSON.parse(body || '{}')
                const planId = String(parsed.plan || '').toLowerCase()
                const plan = plans[planId]
                const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
                if (!plan) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Invalid subscription plan' }))
                  return
                }
                if (!token) {
                  res.statusCode = 401
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Sign in before subscribing' }))
                  return
                }

                const authClient = createClient(supabaseUrl, supabaseAnonKey, {
                  auth: { persistSession: false, autoRefreshToken: false },
                })
                const { data: userData, error: userError } = await authClient.auth.getUser(token)
                if (userError || !userData.user?.email) {
                  res.statusCode = 401
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: 'Could not verify signed-in user',
                    }),
                  )
                  return
                }
                const subscription = (userData.user as any).app_metadata?.scmpedia_subscription
                const expiresAt = typeof subscription?.expires_at === 'string' ? subscription.expires_at : ''
                if (subscription?.tier === 'premium' && (!expiresAt || new Date(expiresAt).getTime() > Date.now())) {
                  const expiresLabel = expiresAt
                    ? new Date(expiresAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : ''
                  res.statusCode = 409
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: expiresLabel
                        ? `You are paid until ${expiresLabel}. You can change plans after your current plan expires.`
                        : 'You already have an active premium plan.',
                    }),
                  )
                  return
                }

                const response = await fetch('https://api.paystack.co/transaction/initialize', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${paystackSecretKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    amount: plan.amount,
                    email: userData.user.email,
                    currency: 'GHS',
                    callback_url: 'http://localhost:5173/',
                    metadata: {
                      user_id: userData.user.id,
                      plan: planId,
                      duration_days: plan.durationDays,
                      product: 'scmpedia-premium',
                    },
                  }),
                })
                const payload = await response.json().catch(() => ({}))
                if (!response.ok || !payload?.status || !payload?.data?.authorization_url) {
                  res.statusCode = 502
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: payload?.message || 'Could not initialize checkout',
                    }),
                  )
                  return
                }
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    authorizationUrl: payload.data.authorization_url,
                    reference: payload.data.reference,
                  }),
                )
              } catch (err: any) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: err?.message || 'Could not initialize checkout',
                  }),
                )
              }
            })
          })

          server.middlewares.use('/api/paystack/verify', (req, res) => {
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
                if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !paystackSecretKey) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: 'Missing payment server configuration',
                    }),
                  )
                  return
                }

                const parsed = JSON.parse(body || '{}')
                const reference = String(parsed.reference || '').trim()
                const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
                if (!reference) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Missing payment reference' }))
                  return
                }
                if (!token) {
                  res.statusCode = 401
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Sign in to verify payment' }))
                  return
                }

                const authClient = createClient(supabaseUrl, supabaseAnonKey, {
                  auth: { persistSession: false, autoRefreshToken: false },
                })
                const { data: userData, error: userError } = await authClient.auth.getUser(token)
                if (userError || !userData.user) {
                  res.statusCode = 401
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: 'Could not verify signed-in user',
                    }),
                  )
                  return
                }

                const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
                  headers: { Authorization: `Bearer ${paystackSecretKey}` },
                })
                const payment = await response.json().catch(() => ({}))
                const plans: any = {
                  monthly: { amount: 2258, durationDays: 31 },
                  annual: { amount: 22578, durationDays: 366 },
                }
                const planId = String(payment?.data?.metadata?.plan || '').toLowerCase()
                const plan = plans[planId]
                if (!response.ok || !payment?.status || payment?.data?.status !== 'success') {
                  res.statusCode = 402
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: payment?.message || 'Payment has not been completed',
                    }),
                  )
                  return
                }
                if (!plan || payment.data.metadata?.user_id !== userData.user.id || Number(payment.data.amount) !== plan.amount) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: 'Payment does not match this subscription',
                    }),
                  )
                  return
                }

                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + plan.durationDays)
                const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
                  auth: { persistSession: false, autoRefreshToken: false },
                })
                const { error: updateError } = await admin.auth.admin.updateUserById(userData.user.id, {
                  app_metadata: {
                    ...(userData.user.app_metadata || {}),
                    scmpedia_subscription: {
                      tier: 'premium',
                      plan: planId,
                      paystack_reference: reference,
                      expires_at: expiresAt.toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                  },
                })
                if (updateError) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: updateError.message || 'Could not activate subscription',
                    }),
                  )
                  return
                }

                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    tier: 'premium',
                    plan: planId,
                    expiresAt: expiresAt.toISOString(),
                  }),
                )
              } catch (err: any) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: err?.message || 'Could not verify payment',
                  }),
                )
              }
            })
          })

          server.middlewares.use('/api/words', async (req, res) => {
            if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }

            if (!supabaseUrl || !supabaseServiceRoleKey) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: 'Missing Supabase service configuration',
                }),
              )
              return
            }

            const url = new URL(req.url || '', 'http://localhost')
            const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            })
            const isMissingSourceKeyError = (error: any) => String(error?.message || '').includes('source_key')
            const hasAdminAccess = () =>
              String(req.headers['x-admin-user'] || '').trim() === adminUser &&
              String(req.headers['x-admin-pass'] || '').trim() === adminPass
            const readJsonBody = async () =>
              new Promise<any>((resolve, reject) => {
                let body = ''
                req.on('data', (chunk) => {
                  body += chunk
                })
                req.on('error', reject)
                req.on('end', () => {
                  try {
                    resolve(JSON.parse(body || '{}'))
                  } catch (error) {
                    reject(error)
                  }
                })
              })
            const normalizeWord = (row: any) => ({
              id: row?.id ? String(row.id) : undefined,
              source_key: String(row?.source_key || row?.sourceKey || row?.SourceKey || '').trim(),
              term: String(row?.term || row?.Term || '').trim(),
              definition: String(row?.definition || row?.Definition || '').trim(),
              synonyms: String(row?.synonyms || row?.Synonyms || ''),
              tags: String(row?.tags || row?.Tags || ''),
              pos: String(row?.pos || row?.Pos || ''),
              pronunciation: String(row?.pronunciation || row?.Pronunciation || ''),
              examples: String(row?.examples || row?.Examples || ''),
            })
            const withoutSourceKey = (rows: any[]) => rows.map(({ source_key, ...row }) => row)
            const wordUpdatePayload = (row: any) => {
              const entry = normalizeWord(row)
              return {
                source_key: entry.source_key || undefined,
                term: entry.term,
                definition: entry.definition,
                synonyms: entry.synonyms,
                tags: entry.tags,
                pos: entry.pos,
                pronunciation: entry.pronunciation,
                examples: entry.examples,
                updated_at: new Date().toISOString(),
              }
            }
            const prepareImportRows = (rows: any[]) => {
              const occurrenceByTerm = new Map<string, number>()
              const prepared = []
              for (const row of rows) {
                const entry = normalizeWord(row)
                if (!entry.term || !entry.definition) continue
                const keyBase = entry.source_key || entry.term.toLowerCase()
                const occurrence = (occurrenceByTerm.get(keyBase) || 0) + 1
                occurrenceByTerm.set(keyBase, occurrence)
                prepared.push({
                  source_key: entry.source_key || (occurrence === 1 ? keyBase : `${keyBase}::${occurrence}`),
                  term: entry.term,
                  definition: entry.definition,
                  synonyms: entry.synonyms,
                  tags: entry.tags,
                  pos: entry.pos,
                  pronunciation: entry.pronunciation,
                  examples: entry.examples,
                  updated_at: new Date().toISOString(),
                })
              }
              return prepared
            }
            const chunkRows = <T>(items: T[], size: number) => {
              const chunks: T[][] = []
              for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
              return chunks
            }
            if (req.method === 'POST') {
              if (!hasAdminAccess()) {
                res.statusCode = 401
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Unauthorized' }))
                return
              }
              try {
                const parsed = await readJsonBody()
                const rows = Array.isArray(parsed?.words) ? parsed.words : []
                const singleRow = rows.length === 1 ? normalizeWord(rows[0]) : null
                if (singleRow?.id && singleRow.term && singleRow.definition) {
                  const payload = wordUpdatePayload(rows[0])
                  const { source_key, ...payloadWithoutSourceKey } = payload
                  let update = await client.from('words').update(payload).eq('id', singleRow.id)
                  if (isMissingSourceKeyError(update.error)) {
                    update = await client.from('words').update(payloadWithoutSourceKey).eq('id', singleRow.id)
                  }
                  if (update.error) throw update.error
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.setHeader('Cache-Control', 'no-store')
                  res.end(JSON.stringify({ imported: 1, updated: true }))
                  return
                }
                const words = prepareImportRows(rows).slice(0, 10000)
                if (!words.length) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'No valid words to import' }))
                  return
                }
                let uploaded = 0
                for (const batch of chunkRows(words, 500)) {
                  const { error } = await client.from('words').upsert(batch, { onConflict: 'source_key' })
                  if (isMissingSourceKeyError(error)) {
                    const fallback = await client.from('words').upsert(withoutSourceKey(batch), { onConflict: 'term' })
                    if (fallback.error) throw fallback.error
                    uploaded += batch.length
                    continue
                  }
                  if (error) throw error
                  uploaded += batch.length
                }
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Cache-Control', 'no-store')
                res.end(JSON.stringify({ imported: uploaded }))
              } catch (err: any) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: err?.message || 'Failed to import words',
                  }),
                )
              }
              return
            }
            if (req.method === 'DELETE') {
              if (!hasAdminAccess()) {
                res.statusCode = 401
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Unauthorized' }))
                return
              }
              const id = url.searchParams.get('id')?.trim() || ''
              const sourceKey = url.searchParams.get('source_key')?.trim() || ''
              const term = url.searchParams.get('term')?.trim() || ''
              if (!id && !sourceKey && !term) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing word identifier' }))
                return
              }
              try {
                let query = client.from('words').delete()
                if (id) query = query.eq('id', id)
                else if (sourceKey) query = query.eq('source_key', sourceKey)
                else query = query.eq('term', term)
                const { error } = await query
                if (isMissingSourceKeyError(error) && sourceKey) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(
                    JSON.stringify({
                      error: 'Delete by source_key is not supported by the current words table',
                    }),
                  )
                  return
                }
                if (error) throw error
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Cache-Control', 'no-store')
                res.end(JSON.stringify({ deleted: true }))
              } catch (err: any) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    error: err?.message || 'Failed to delete word',
                  }),
                )
              }
              return
            }
            const q = url.searchParams.get('q')?.trim() || ''
            const terms = url.searchParams.get('terms')?.trim() || ''
            const browse = url.searchParams.get('browse') === '1'
            const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 8, 1), 25)
            const browseLimit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 300, 50), 1000)
            const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
            const searchLimit = terms ? limit : 100
            if (!q && !terms && !browse) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing search query' }))
              return
            }

            try {
              if (browse) {
                const { data, error, count } = await client
                  .from('words')
                  .select('id,term,definition,synonyms,tags,pronunciation,pos,examples', { count: 'exact' })
                  .order('term', { ascending: true })
                  .range(offset, offset + browseLimit - 1)
                if (error) throw error
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    words: data || [],
                    nextOffset: offset + (data?.length || 0),
                    count,
                  }),
                )
                return
              }

              let data: any[] | null = []
              let error: any = null
              if (terms) {
                const response = await client
                  .from('words')
                  .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
                  .limit(searchLimit)
                  .in(
                    'term',
                    terms
                      .split(',')
                      .map((term) => term.trim())
                      .filter(Boolean)
                      .slice(0, 25),
                  )
                data = response.data
                error = response.error
              }
              if (error) throw error
              const normalizeSearchText = (value: string) =>
                value
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, ' ')
                  .trim()
              const searchStopWords = new Set([
                'a',
                'an',
                'and',
                'are',
                'about',
                'can',
                'could',
                'define',
                'describe',
                'does',
                'explain',
                'for',
                'from',
                'help',
                'how',
                'in',
                'is',
                'looking',
                'look',
                'mean',
                'meaning',
                'me',
                'need',
                'of',
                'please',
                'search',
                'show',
                'tell',
                'term',
                'the',
                'this',
                'to',
                'understand',
                'want',
                'what',
                'whats',
                'with',
                'word',
                'work',
                'works',
                'you',
              ])
              const searchTokens = (value: string) =>
                normalizeSearchText(value)
                  .split(/\s+/)
                  .filter((token) => token.length >= 3 && !searchStopWords.has(token))
              const searchAcronym = (value: string) => {
                const tokens = normalizeSearchText(value)
                  .split(/\s+/)
                  .filter(
                    (token) =>
                      token.length >= 2 &&
                      ![
                        'a',
                        'an',
                        'are',
                        'about',
                        'can',
                        'could',
                        'define',
                        'describe',
                        'does',
                        'explain',
                        'help',
                        'how',
                        'is',
                        'looking',
                        'look',
                        'mean',
                        'meaning',
                        'me',
                        'need',
                        'please',
                        'search',
                        'show',
                        'tell',
                        'term',
                        'the',
                        'this',
                        'to',
                        'understand',
                        'want',
                        'what',
                        'whats',
                        'with',
                        'word',
                        'work',
                        'works',
                        'you',
                      ].includes(token),
                  )
                return tokens.length >= 3 ? tokens.map((token) => token[0]).join('') : ''
              }
              const editDistance = (a: string, b: string) => {
                const left = a.toLowerCase()
                const right = b.toLowerCase()
                const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
                for (let i = 1; i <= left.length; i += 1) {
                  let before = previous[0]
                  previous[0] = i
                  for (let j = 1; j <= right.length; j += 1) {
                    const tmp = previous[j]
                    previous[j] = left[i - 1] === right[j - 1] ? before : Math.min(previous[j] + 1, previous[j - 1] + 1, before + 1)
                    before = tmp
                  }
                }
                return previous[right.length]
              }
              const rankWords = (rows: any[]) => {
                const needle = q.toLowerCase()
                const compactNeedle = needle.replace(/[^a-z0-9]/g, '')
                const tokens = searchTokens(needle)
                const acronym = searchAcronym(needle)
                const tokenPhrase = tokens.join(' ')
                const score = (row: any) => {
                  const term = String(row?.term || '').toLowerCase()
                  const definition = String(row?.definition || '').toLowerCase()
                  const synonyms = String(row?.synonyms || '').toLowerCase()
                  const tags = String(row?.tags || '').toLowerCase()
                  const haystack = [term, definition, synonyms, tags].join(' ')
                  const compactTerm = term.replace(/[^a-z0-9]/g, '')
                  const compactDefinition = definition.replace(/[^a-z0-9]/g, '')
                  const compactSynonyms = synonyms.replace(/[^a-z0-9]/g, '')
                  if (term === needle) return 0
                  if (compactTerm && compactTerm === compactNeedle) return 0.2
                  if (acronym.length >= 2 && compactTerm === acronym && tokens.some((token) => definition.startsWith(token))) return 0.25
                  if (tokenPhrase && term === tokenPhrase) return 0.3
                  if (tokenPhrase && (term.startsWith(`${tokenPhrase} `) || term.startsWith(`${tokenPhrase}-`))) return 0.4
                  if (tokenPhrase && (term.includes(tokenPhrase) || synonyms.includes(tokenPhrase))) return 0.8
                  if (tokens.length > 1 && tokens.every((token) => term.includes(token))) return 1
                  if (acronym.length >= 2 && compactTerm === acronym) return 1.5
                  if (term.startsWith(`${needle} `) || term.startsWith(`${needle}-`) || term.startsWith(needle)) return 1
                  if (term.includes(needle)) return 2
                  if (synonyms === needle || compactSynonyms === compactNeedle) return 2.2
                  if (tokens.some((token) => definition.startsWith(token))) return 2.3
                  if (definition.startsWith(needle) || compactDefinition.startsWith(compactNeedle)) return 2.5
                  if (synonyms.includes(needle) || compactSynonyms.includes(compactNeedle)) return 3
                  if (tags.includes(needle)) return 4
                  if (definition.includes(needle) || compactDefinition.includes(compactNeedle)) return 5
                  if (tokens.length) {
                    const matchedTokens = tokens.filter((token) => haystack.includes(token)).length
                    if (matchedTokens === tokens.length) return 6
                    if (matchedTokens) return 7 + (tokens.length - matchedTokens)
                  }
                  return 20
                }
                return [...rows]
                  .sort((a, b) => {
                    const scoreDiff = score(a) - score(b)
                    if (scoreDiff) return scoreDiff
                    return String(a?.term || '').localeCompare(String(b?.term || ''))
                  })
                  .slice(0, limit)
              }
              const fuzzyRankWords = (rows: any[]) => {
                const needle = q.toLowerCase()
                const compactNeedle = needle.replace(/[^a-z0-9]/g, '')
                if (!compactNeedle) return []
                return [...rows]
                  .map((row) => {
                    const term = String(row?.term || '').toLowerCase()
                    const compactTerm = term.replace(/[^a-z0-9]/g, '')
                    const distance = Math.min(editDistance(term, needle), editDistance(compactTerm, compactNeedle))
                    const prefixBonus = term[0] === needle[0] ? -1 : 0
                    return { row, score: distance + prefixBonus }
                  })
                  .filter(({ row, score }) => {
                    const termLength = String(row?.term || '').length
                    const maxDistance = Math.max(2, Math.floor(Math.min(compactNeedle.length, termLength) * 0.35))
                    return score <= maxDistance
                  })
                  .sort((a, b) => {
                    if (a.score !== b.score) return a.score - b.score
                    return String(a.row?.term || '').localeCompare(String(b.row?.term || ''))
                  })
                  .slice(0, limit)
                  .map(({ row }) => row)
              }
              const tokenRankWords = (rows: any[]) => {
                const tokens = searchTokens(q)
                if (!tokens.length) return []
                const acronym = searchAcronym(q)
                const tokenPhrase = tokens.join(' ')
                return [...rows]
                  .map((row) => {
                    const term = normalizeSearchText(String(row?.term || ''))
                    const compactTerm = term.replace(/[^a-z0-9]/g, '')
                    const definition = normalizeSearchText(String(row?.definition || ''))
                    const synonyms = normalizeSearchText(String(row?.synonyms || ''))
                    const tags = normalizeSearchText(String(row?.tags || ''))
                    const haystack = [term, definition, synonyms, tags].join(' ')
                    const haystackWords = haystack.split(/\s+/).filter(Boolean)
                    const phraseScore =
                      tokenPhrase && term === tokenPhrase
                        ? -8
                        : tokenPhrase && (term.startsWith(`${tokenPhrase} `) || term.startsWith(`${tokenPhrase}-`))
                          ? -6
                          : tokenPhrase && (term.includes(tokenPhrase) || synonyms.includes(tokenPhrase))
                            ? -5
                            : tokens.length > 1 && tokens.every((token) => term.includes(token))
                              ? -3
                              : tokens.some((token) => definition.startsWith(token)) && tokens.every((token) => haystack.includes(token))
                                ? -3
                                : tokenPhrase && definition.startsWith(tokenPhrase)
                                  ? -2
                                  : tokenPhrase && definition.includes(tokenPhrase)
                                    ? -1
                                    : 0
                    const tokenScore = tokens.reduce((total, token) => {
                      if (term === token || synonyms === token) return total
                      if (term.includes(token) || synonyms.includes(token)) return total + 0.25
                      if (definition.startsWith(token) || tags.includes(token)) return total + 0.5
                      if (haystack.includes(token)) return total + 1
                      const bestDistance = haystackWords.reduce((best, word) => Math.min(best, editDistance(token, word)), token.length)
                      return total + Math.min(4, bestDistance + 1)
                    }, 0)
                    const acronymScore = acronym.length >= 2 && compactTerm === acronym ? -4 : 0
                    const score = tokenScore + acronymScore + phraseScore
                    return { row, score }
                  })
                  .filter(({ score }) => score <= Math.max(2, tokens.length * 2.5))
                  .sort((a, b) => {
                    if (a.score !== b.score) return a.score - b.score
                    return String(a.row?.term || '').localeCompare(String(b.row?.term || ''))
                  })
                  .slice(0, limit)
                  .map(({ row }) => row)
              }
              const uniqueSearchPhrases = (value: string) =>
                Array.from(new Set([value.trim(), searchTokens(value).join(' ')].map((phrase) => phrase.trim()).filter(Boolean)))
              const collectSearchCandidates = async () => {
                const rows: any[] = []
                const add = (next: any[] | null) => rows.push(...(next || []))
                const run = async (query: any) => {
                  const { data: next, error: nextError } = await query
                  if (nextError) throw nextError
                  add(next)
                }
                const phrases = uniqueSearchPhrases(q)
                const acronym = searchAcronym(q)
                for (const phrase of phrases) {
                  await run(
                    client
                      .from('words')
                      .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
                      .ilike('term', phrase)
                      .limit(50),
                  )
                  await run(
                    client
                      .from('words')
                      .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
                      .ilike('term', `${phrase}%`)
                      .order('term', { ascending: true })
                      .limit(250),
                  )
                  await run(
                    client
                      .from('words')
                      .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
                      .ilike('term', `%${phrase}%`)
                      .order('term', { ascending: true })
                      .limit(250),
                  )
                }
                if (acronym) {
                  await run(
                    client
                      .from('words')
                      .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
                      .ilike('term', acronym)
                      .limit(50),
                  )
                }
                for (const phrase of phrases) {
                  await run(
                    client
                      .from('words')
                      .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
                      .ilike('definition', `%${phrase}%`)
                      .limit(250),
                  )
                  await run(
                    client
                      .from('words')
                      .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
                      .ilike('tags', `%${phrase}%`)
                      .limit(100),
                  )
                }
                for (const token of searchTokens(q).slice(0, 5)) {
                  await run(
                    client
                      .from('words')
                      .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
                      .ilike('term', `%${token}%`)
                      .order('term', { ascending: true })
                      .limit(250),
                  )
                  await run(
                    client
                      .from('words')
                      .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
                      .ilike('definition', `%${token}%`)
                      .limit(250),
                  )
                }
                const seen = new Set<string>()
                return rows.filter((row) => {
                  const key = String(row?.term || '').toLowerCase()
                  if (!key || seen.has(key)) return false
                  seen.add(key)
                  return true
                })
              }
              if (!terms && q) data = await collectSearchCandidates()
              const seenWords = new Set<string>()
              const rows = (data || []).filter((row) => {
                const key = String(row?.term || '').toLowerCase()
                if (!key || seenWords.has(key)) return false
                seenWords.add(key)
                return true
              })
              let words = terms ? rows : rankWords(rows)
              if (!terms && q && !words.length) {
                const tokens = searchTokens(q)
                const tokenFilters = tokens
                  .slice(0, 5)
                  .flatMap((token) => [`term.ilike.%${token}%`, `definition.ilike.%${token}%`, `tags.ilike.%${token}%`])
                if (tokenFilters.length) {
                  const { data: tokenCandidates, error: tokenCandidateError } = await client
                    .from('words')
                    .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
                    .or(tokenFilters.join(','))
                    .limit(5000)
                  if (tokenCandidateError) throw tokenCandidateError
                  words = tokenRankWords(tokenCandidates || [])
                }
              }
              if (!terms && q && !words.length) {
                const first = q.trim()[0] || ''
                const { data: candidates, error: candidateError } = await client
                  .from('words')
                  .select('id,term,definition,synonyms,tags,pronunciation,pos,examples')
                  .ilike('term', `${first}%`)
                  .order('term', { ascending: true })
                  .limit(5000)
                if (candidateError) throw candidateError
                words = fuzzyRankWords(candidates || [])
              }
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ words }))
            } catch (err: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: err?.message || 'Failed to search words',
                }),
              )
            }
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
