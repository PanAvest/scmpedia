import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { createHmac, scryptSync, randomBytes } from 'crypto'
import { DEFAULT_PLANS, loadPlan, loadAllPlans } from './api/_plans'
import { collectStudents } from './api/_students'
import { buildPool, poolResponse, drawResult } from './api/_raffle'
import { listUsersReport, deleteUsers as deleteUsersCore, setPremium as setPremiumCore } from './api/_users'
import { loadUniversityAdditions, addUniversity as addUniversityCore, deleteUniversity as deleteUniversityCore } from './api/_universities'
import { hasEmailConfig, sendComposed } from './api/_email'
import { collectPaystackFinance, hasPaystackConfig } from './api/_finance'
import { currencyForCountry, loadCurrencyRates } from './api/_currency'

// Supabase's client builds a realtime client (needs a global WebSocket) at construction.
// Node < 22 has none, and the dev middleware never opens a realtime channel, so a harmless
// stub lets createClient() work locally without pulling in the `ws` package.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  ;(globalThis as { WebSocket?: unknown }).WebSocket = class {}
}

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
  const adminUser = env.SCMPEDIA_ADMIN_USER
  const adminPass = env.SCMPEDIA_ADMIN_PASS
  const adminSecret = env.ADMIN_SESSION_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || adminPass
  const paystackSecretKey = env.PAYSTACK_SECRET_KEY
  const paystackCallbackUrl = env.PAYSTACK_CALLBACK_URL || 'http://localhost:5173/paystack/callback'
  const base64Url = (value: string | Buffer) =>
    Buffer.from(value)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  const signAdminPayload = (payload: string) =>
    adminSecret ? base64Url(createHmac('sha256', adminSecret).update(payload).digest()) : ''
  const createAdminToken = (identity?: { email?: string; role?: string }) => {
    const payload = base64Url(
      JSON.stringify({
        sub: 'scmpedia-admin',
        email: identity?.email || '',
        role: identity?.role === 'master' ? 'master' : 'admin',
        exp: Date.now() + 12 * 60 * 60 * 1000,
      }),
    )
    return `${payload}.${signAdminPayload(payload)}`
  }
  const decodeAdminPayload = (token: string): any => {
    const [payload] = token.split('.')
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
  }
  const verifyAdminToken = (token: string) => {
    const [payload, signature] = token.split('.')
    if (!payload || !signature || !adminSecret || signature !== signAdminPayload(payload)) return false
    try {
      const parsed = decodeAdminPayload(token)
      return parsed?.sub === 'scmpedia-admin' && Number(parsed?.exp || 0) > Date.now()
    } catch {
      return false
    }
  }
  const adminIdentity = (req: any): { email: string; role: string } | null => {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!verifyAdminToken(token)) return null
    try {
      const parsed = decodeAdminPayload(token)
      return { email: String(parsed?.email || ''), role: parsed?.role === 'master' ? 'master' : 'admin' }
    } catch {
      return null
    }
  }
  const hashPassword = (password: string) => {
    const salt = randomBytes(16).toString('hex')
    return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`
  }
  const verifyPassword = (password: string, stored: string) => {
    const parts = String(stored || '').split('$')
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false
    return scryptSync(password, parts[1], 64).toString('hex') === parts[2]
  }
  const isEmailValue = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [
      react(),
      {
        name: 'scm-pedia-proxy',
        configureServer(server) {
          server.middlewares.use('/api/admin/login', (req, res) => {
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
                if (!adminSecret) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Admin credentials are not configured on the server' }))
                  return
                }
                const parsed = JSON.parse(body || '{}')
                const username = String(parsed.username || '').trim()
                const password = String(parsed.password || '')
                const sendToken = (email: string, role: string) => {
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ token: createAdminToken({ email, role }), email, role }))
                }
                // 1) Table-based admin accounts (by email). Also count admins to gate the
                //    env bootstrap below (kept in sync with api/admin/login.ts).
                let adminTableReadable = false
                let adminCount = 0
                if (supabaseUrl && supabaseServiceRoleKey) {
                  try {
                    const service = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
                    const { count, error: countError } = await service.from('scmpedia_admins').select('id', { count: 'exact', head: true })
                    if (!countError) { adminTableReadable = true; adminCount = count || 0 }
                    const { data, error } = await service.from('scmpedia_admins').select('email,password_hash,role').eq('email', username.toLowerCase()).maybeSingle()
                    if (!error && data && verifyPassword(password, String(data.password_hash))) {
                      sendToken(String(data.email), data.role === 'master' ? 'master' : 'admin')
                      return
                    }
                  } catch {
                    /* table missing → fall through to env admin */
                  }
                }
                // 2) Env bootstrap admin (master) — only until the first table admin exists.
                const bootstrapAllowed = !adminTableReadable || adminCount === 0
                if (bootstrapAllowed && adminUser && adminPass && username === adminUser && password === adminPass) {
                  sendToken(username, 'master')
                  return
                }
                res.statusCode = 401
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Invalid credentials' }))
              } catch (err: any) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: err?.message || 'Admin login failed' }))
              }
            })
          })

          server.middlewares.use('/api/admin/accounts', (req, res) => {
            const identity = adminIdentity(req)
            if (!identity) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Admin sign-in required' }))
              return
            }
            if (!supabaseUrl || !supabaseServiceRoleKey) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing server configuration' }))
              return
            }
            const service = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
            const tableHelp = 'Has the scmpedia_admins table been created? Run supabase-admins.sql.'
            const listAll = () => service.from('scmpedia_admins').select('id,email,role,created_at').order('created_at', { ascending: true })
            const sendJson = (code: number, payload: any) => {
              res.statusCode = code
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(payload))
            }

            if (req.method === 'GET') {
              listAll().then(({ data, error }) => {
                if (error) sendJson(500, { error: `Could not load admins: ${error.message}. ${tableHelp}` })
                else sendJson(200, { me: identity, admins: data || [] })
              })
              return
            }

            let body = ''
            req.on('data', (chunk) => {
              body += chunk
            })
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}')
                if (req.method === 'POST') {
                  if (identity.role !== 'master') return sendJson(403, { error: 'Only a master admin can add accounts' })
                  const email = String(parsed.email || '').trim().toLowerCase()
                  const pwd = String(parsed.password || '')
                  const role = parsed.role === 'master' ? 'master' : 'admin'
                  if (!isEmailValue(email)) return sendJson(400, { error: 'Enter a valid email address' })
                  if (pwd.length < 6) return sendJson(400, { error: 'Password must be at least 6 characters' })
                  const { error } = await service.from('scmpedia_admins').insert({ email, password_hash: hashPassword(pwd), role, updated_at: new Date().toISOString() })
                  if (error) {
                    if (String(error.code) === '23505') return sendJson(409, { error: 'An admin with that email already exists' })
                    return sendJson(500, { error: `Could not add admin: ${error.message}. ${tableHelp}` })
                  }
                  const { data } = await listAll()
                  return sendJson(200, { me: identity, admins: data || [] })
                }
                if (req.method === 'PATCH') {
                  const targetEmail = String(parsed.email || identity.email || '').trim().toLowerCase()
                  const pwd = String(parsed.password || '')
                  if (pwd.length < 6) return sendJson(400, { error: 'Password must be at least 6 characters' })
                  if (targetEmail !== identity.email.toLowerCase() && identity.role !== 'master') return sendJson(403, { error: "Only a master admin can change another account's password" })
                  const { data: rows, error } = await service.from('scmpedia_admins').update({ password_hash: hashPassword(pwd), updated_at: new Date().toISOString() }).eq('email', targetEmail).select('id')
                  if (error) return sendJson(500, { error: `Could not change password: ${error.message}. ${tableHelp}` })
                  if (!rows || !rows.length) return sendJson(404, { error: "That account isn't in the database. The bootstrap admin/admin password is set in env vars, not here." })
                  return sendJson(200, { ok: true })
                }
                if (req.method === 'DELETE') {
                  if (identity.role !== 'master') return sendJson(403, { error: 'Only a master admin can delete accounts' })
                  const id = String(parsed.id || '')
                  const email = String(parsed.email || '').trim().toLowerCase()
                  const { data: target } = id
                    ? await service.from('scmpedia_admins').select('id,email,role').eq('id', id).maybeSingle()
                    : await service.from('scmpedia_admins').select('id,email,role').eq('email', email).maybeSingle()
                  if (!target) return sendJson(404, { error: 'Admin account not found' })
                  if (String(target.email).toLowerCase() === identity.email.toLowerCase()) return sendJson(400, { error: 'You cannot delete your own account' })
                  if (target.role === 'master') {
                    const { count } = await service.from('scmpedia_admins').select('id', { count: 'exact', head: true }).eq('role', 'master')
                    if ((count || 0) <= 1) return sendJson(400, { error: 'Cannot delete the last master admin' })
                  }
                  const { error } = await service.from('scmpedia_admins').delete().eq('id', target.id)
                  if (error) return sendJson(500, { error: `Could not delete admin: ${error.message}` })
                  const { data } = await listAll()
                  return sendJson(200, { me: identity, admins: data || [] })
                }
                return sendJson(405, { error: 'Method not allowed' })
              } catch (err: any) {
                sendJson(500, { error: err?.message || 'Admin account request failed' })
              }
            })
          })

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
            const badResultPattern =
              /\b(song|songs|music|album|lyrics|soundcloud|spotify|stream|listen online|radio|mixtape|playlist|artist|drama|k-drama|kdrama|movie|movies|tv series|series|episode|episodes|cast|plot|boyfriend|girlfriend|celebrity|actor|actress|netflix|viki|soompi|asianwiki|school|schools|student|students|spring play|stage|theatre|theater|concert|embassy|training certificate|media training|ceremony)\b/
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
            const domainHintsFor = (term: string, definitionText: string) => {
              const haystack = `${term} ${definitionText}`.toLowerCase()
              const cleanTerm = cleanText(term).toLowerCase()
              const hints: string[] = []
              if (
                cleanTerm === 'demand' ||
                /\bdemand\b/.test(haystack) ||
                /\brequirement\b.*\b(product|component)\b/.test(haystack)
              ) {
                hints.push('demand planning', 'demand forecasting', 'customer demand', 'product demand', 'inventory planning')
              }
              if (/\bforecast/.test(haystack)) hints.push('forecasting chart', 'demand forecast')
              if (/\binventory|stock|warehouse/.test(haystack)) hints.push('inventory management', 'warehouse operations')
              if (/\bprocurement|supplier|sourcing/.test(haystack)) hints.push('procurement supplier management')
              if (/\blogistics|transport|shipment|distribution/.test(haystack)) hints.push('logistics distribution')
              if (/\bproduction|manufacturing|factory/.test(haystack)) hints.push('production planning manufacturing')
              return Array.from(new Set(hints))
            }
            const expandedTerm = expandedTermFromDefinition(definition)
            const definitionWords = wordsFrom([expandedTerm, definition].filter(Boolean).join(' ')).filter((word) => !stopWords.has(word))
            const domainHints = domainHintsFor(q, definition)
            const visualTerms = definitionWords.filter((word) => visualWords.includes(word)).slice(0, 6)
            const fallbackTerms = definitionWords
              .filter((word) => !visualTerms.includes(word))
              .slice(0, 5)
              .join(' ')
            const hasContext = context.some((term) => q.toLowerCase().includes(term))
            const isPhysicalTerm = visualTerms.some((word) =>
              ['ghana', 'tricycle', 'tricycles', 'cargo', 'carrier', 'vehicle', 'motor', 'truck'].includes(word),
            )
            const isShortAcronym = /^[A-Z0-9]{2,5}$/.test(cleanText(q)) && definitionWords.length > 0
            const isGenericTerm = wordsFrom(q).length <= 2 && !hasContext && !isPhysicalTerm
            const contextualQuery = [
              cleanText(q),
              domainHints.slice(0, 3).join(' '),
              visualTerms.slice(0, 4).join(' '),
              visualTerms.length ? '' : fallbackTerms,
              hasContext || isPhysicalTerm ? '' : 'supply chain logistics inventory operations',
            ]
              .filter(Boolean)
              .join(' ')
            const definitionContext = [
              isShortAcronym ? '' : cleanText(q),
              expandedTerm,
              domainHints.slice(0, 4).join(' '),
              fallbackTerms,
              'supply chain procurement logistics operations',
            ]
              .filter(Boolean)
              .join(' ')
            const conceptDiagram = [
              cleanText(q),
              domainHints.slice(0, 2).join(' '),
              'supply chain diagram process',
            ]
              .filter(Boolean)
              .join(' ')
            const imageQueries = Array.from(
              new Set([
                isShortAcronym ? definitionContext : contextualQuery,
                definitionContext,
                conceptDiagram,
                isGenericTerm ? '' : cleanText(q),
              ].filter(Boolean)),
            )
            const scoreResult = (item: any) => {
              const haystack = [item?.title, item?.snippet, item?.displayLink, item?.link, item?.image?.contextLink]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
              const queryWords = isShortAcronym ? [] : wordsFrom(q)
              const expandedWords = wordsFrom(expandedTerm).filter((word) => !stopWords.has(word))
              const generic = queryWords.length <= 2 && !context.some((term) => cleanText(q).toLowerCase().includes(term))
              let score = 0
              for (const word of queryWords) if (haystack.includes(word)) score += generic ? 7 : 18
              for (const word of visualTerms) if (haystack.includes(word)) score += 12
              if (!isShortAcronym && haystack.includes(q.toLowerCase())) score += generic ? 6 : 20
              for (const hint of domainHints) {
                if (haystack.includes(hint)) score += 34
                else if (wordsFrom(hint).filter((word) => haystack.includes(word)).length >= 2) score += 20
              }
              const definitionHits = definitionWords
                .filter((word) => !['requirement', 'particular', 'number', 'sources', 'internal', 'external'].includes(word))
                .filter((word) => haystack.includes(word)).length
              score += Math.min(18, definitionHits * 4)
              for (const term of context) if (haystack.includes(term)) score += 6
              if (/\b(diagram|infographic|concept|process|management|logistics|warehouse|procurement)\b/.test(haystack)) score += 5
              if (
                /\b(logo|icon|clipart|meme|wallpaper|template|ppt|pdf|book cover|headshot|portrait|scandal|political|politics)\b/.test(
                  haystack,
                )
              )
                score -= 25
              if (badResultPattern.test(haystack)) score -= 140
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
              if (badResultPattern.test(haystack)) {
                return false
              }
              if (isShortAcronym) {
                const expandedWords = wordsFrom(expandedTerm).filter((word) => !stopWords.has(word))
                const expandedHits = expandedWords.filter((word) => haystack.includes(word)).length
                return score >= 18 && (!expandedWords.length || expandedHits >= Math.min(2, expandedWords.length))
              }
              if (isGenericTerm) {
                const hasScmContext = context.some((term) => haystack.includes(term))
                const hasDomainContext = domainHints.some((hint) => {
                  if (haystack.includes(hint)) return true
                  return wordsFrom(hint).filter((word) => haystack.includes(word)).length >= 2
                })
                const definitionHits = definitionWords
                  .filter((word) => !['requirement', 'particular', 'number', 'sources', 'internal', 'external'].includes(word))
                  .filter((word) => haystack.includes(word)).length
                return score >= 22 && (hasScmContext || hasDomainContext || definitionHits >= 2)
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
                params.set(
                  'excludeTerms',
                  'song lyrics album drama k-drama movie tv series cast plot boyfriend girlfriend celebrity actor actress netflix viki soompi asianwiki',
                )
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

                const parsed = JSON.parse(body || '{}')
                const planId = String(parsed.plan || '').toLowerCase()
                const planService = supabaseServiceRoleKey
                  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
                  : null
                const plan = await loadPlan(planService, planId)
                const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
                if (!plan || !plan.active) {
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

                // Student plans require the verification details collected by the pre-payment popup.
                if (plan.tier === 'student') {
                  const meta = ((userData.user as any).user_metadata || {}) as Record<string, unknown>
                  if (!String(meta.student_university || '').trim() || !String(meta.student_index_number || '').trim()) {
                    res.statusCode = 400
                    res.setHeader('Content-Type', 'application/json')
                    res.end(
                      JSON.stringify({
                        error: 'Please add your university and student index number before paying for the Student plan.',
                      }),
                    )
                    return
                  }
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
                    callback_url: paystackCallbackUrl,
                    metadata: {
                      user_id: userData.user.id,
                      plan: planId,
                      amount: plan.amount,
                      duration_days: plan.duration_days,
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
                const adminService = createClient(supabaseUrl, supabaseServiceRoleKey, {
                  auth: { persistSession: false, autoRefreshToken: false },
                })
                const planId = String(payment?.data?.metadata?.plan || '').toLowerCase()
                const plan = await loadPlan(adminService, planId)
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
                const expectedAmount = Number(payment.data.metadata?.amount) > 0 ? Number(payment.data.metadata?.amount) : plan?.amount
                if (
                  !plan ||
                  payment.data.metadata?.user_id !== userData.user.id ||
                  Number(payment.data.amount) !== expectedAmount ||
                  String(payment.data.currency || '').toUpperCase() !== 'GHS'
                ) {
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
                expiresAt.setDate(expiresAt.getDate() + plan.duration_days)
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

          server.middlewares.use('/api/location', (req, res) => {
            if (req.method !== 'GET') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            const rawCountry = req.headers['x-vercel-ip-country']
            const country = String(Array.isArray(rawCountry) ? rawCountry[0] : rawCountry || '').trim().toUpperCase() || null
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'private, no-store, max-age=0')
            res.end(JSON.stringify({ country, currency: currencyForCountry(country), detected: Boolean(country) }))
          })

          server.middlewares.use('/api/currency', async (req, res) => {
            if (req.method !== 'GET') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            try {
              const payload = await loadCurrencyRates()
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Cache-Control', 'public, max-age=300')
              res.end(JSON.stringify(payload))
            } catch (error) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Exchange rates are temporarily unavailable.' }))
            }
          })

          server.middlewares.use('/api/plans', async (req, res) => {
            if (req.method !== 'GET') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            const service = supabaseUrl && supabaseServiceRoleKey
              ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
              : null
            const all = await loadAllPlans(service)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                currency: 'GHS',
                plans: all
                  .filter((p) => p.active)
                  .map((p) => ({ id: p.id, tier: p.tier, period: p.period, amount: p.amount, price: p.amount / 100, label: p.label })),
              }),
            )
          })

          server.middlewares.use('/api/admin/plans', (req, res) => {
            const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
            if (!verifyAdminToken(token)) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Admin sign-in required' }))
              return
            }
            if (!supabaseUrl || !supabaseServiceRoleKey) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing server configuration' }))
              return
            }
            const service = createClient(supabaseUrl, supabaseServiceRoleKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            })

            if (req.method === 'GET') {
              loadAllPlans(service)
                .then((all) => {
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ plans: all }))
                })
                .catch((err: any) => {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: err?.message || 'Could not load plans' }))
                })
              return
            }

            if (req.method === 'PUT' || req.method === 'POST') {
              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })
              req.on('end', async () => {
                try {
                  const parsed = JSON.parse(body || '{}')
                  const updates = Array.isArray(parsed.plans) ? parsed.plans : []
                  const rows: any[] = []
                  for (const update of updates) {
                    const id = String(update?.id || '')
                    const base = DEFAULT_PLANS[id]
                    if (!base) continue
                    const amount = Math.round(Number(update?.amount))
                    if (!Number.isFinite(amount) || amount <= 0) {
                      res.statusCode = 400
                      res.setHeader('Content-Type', 'application/json')
                      res.end(JSON.stringify({ error: `Enter a valid price (greater than 0) for ${base.label}` }))
                      return
                    }
                    rows.push({
                      id,
                      tier: base.tier,
                      period: base.period,
                      amount,
                      duration_days: base.duration_days,
                      label: typeof update?.label === 'string' && update.label.trim() ? update.label.trim() : base.label,
                      active: update?.active === undefined ? true : Boolean(update.active),
                      updated_at: new Date().toISOString(),
                    })
                  }
                  if (!rows.length) {
                    res.statusCode = 400
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: 'No valid plans to update' }))
                    return
                  }
                  const byTier: Record<string, { monthly?: number; annual?: number }> = {}
                  for (const r of rows) {
                    const entry = byTier[r.tier] ?? {}
                    if (r.period === 'monthly') entry.monthly = Number(r.amount)
                    if (r.period === 'annual') entry.annual = Number(r.amount)
                    byTier[r.tier] = entry
                  }
                  for (const [tier, pair] of Object.entries(byTier)) {
                    if (pair.monthly !== undefined && pair.annual !== undefined && pair.annual > pair.monthly * 12) {
                      res.statusCode = 400
                      res.setHeader('Content-Type', 'application/json')
                      res.end(JSON.stringify({ error: `For ${tier}, the yearly price must not exceed 12× the monthly price.` }))
                      return
                    }
                  }
                  const { error } = await service.from('scmpedia_plans').upsert(rows, { onConflict: 'id' })
                  if (error) {
                    res.statusCode = 500
                    res.setHeader('Content-Type', 'application/json')
                    res.end(JSON.stringify({ error: `Could not save prices: ${error.message}. Has the scmpedia_plans table been created?` }))
                    return
                  }
                  const all = await loadAllPlans(service)
                  res.statusCode = 200
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ plans: all }))
                } catch (err: any) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: err?.message || 'Could not save prices' }))
                }
              })
              return
            }

            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
          })

          // Dev mirror of api/admin/finance.ts — Paystack revenue reconciliation.
          server.middlewares.use('/api/admin/finance', (req, res) => {
            const sendJson = (code: number, payload: any) => {
              res.statusCode = code
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(payload))
            }
            const identity = adminIdentity(req)
            if (!identity) return sendJson(401, { error: 'Admin sign-in required' })
            if (req.method !== 'GET') return sendJson(405, { error: 'Method not allowed' })
            if (!hasPaystackConfig(paystackSecretKey)) return sendJson(503, { error: 'Paystack is not configured.' })
            collectPaystackFinance(paystackSecretKey as string)
              .then((finance) => sendJson(200, { finance }))
              .catch((err: any) => sendJson(502, { error: err?.message || 'Could not reach Paystack' }))
          })

          // Dev mirror of api/admin/email.ts — send a branded email via Resend.
          server.middlewares.use('/api/admin/email', (req, res) => {
            const sendJson = (code: number, payload: any) => {
              res.statusCode = code
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(payload))
            }
            const identity = adminIdentity(req)
            if (!identity) return sendJson(401, { error: 'Admin sign-in required' })
            if (req.method !== 'POST') return sendJson(405, { error: 'Method not allowed' })
            if (!hasEmailConfig()) return sendJson(503, { error: 'Email is not configured (RESEND_API_KEY missing).' })
            let raw = ''
            req.on('data', (c: any) => { raw += c })
            req.on('end', async () => {
              try {
                const body = JSON.parse(raw || '{}')
                const recipients = [...new Set(
                  (Array.isArray(body.to) ? body.to : String(body.to || '').split(/[,\n;]+/))
                    .map((s: any) => String(s || '').trim().toLowerCase()).filter(Boolean),
                )] as string[]
                if (!recipients.length) return sendJson(400, { error: 'Add at least one recipient.' })
                if (recipients.length > 50) return sendJson(400, { error: 'Send to at most 50 recipients at a time.' })
                const subject = String(body.subject || '').trim()
                const heading = String(body.heading || '').trim()
                const content = String(body.body || '').trim()
                if (!subject || !heading || !content) return sendJson(400, { error: 'Subject, heading and body are all required.' })
                const attachments = (Array.isArray(body.attachments) ? body.attachments : [])
                  .filter((a: any) => a?.filename && a?.content)
                  .map((a: any) => ({ filename: String(a.filename), content: String(a.content) }))
                const cta = body.cta && String(body.cta.label || '').trim() && String(body.cta.url || '').trim()
                  ? { label: String(body.cta.label).trim(), url: String(body.cta.url).trim() } : null
                const results = await sendComposed(
                  { subject, heading, subheading: String(body.subheading || '').trim() || undefined, body: content, cta },
                  recipients, attachments,
                )
                const failed = results.filter((r) => !r.ok)
                sendJson(failed.length ? 207 : 200, {
                  sent: results.length - failed.length, total: results.length, results,
                  message: failed.length ? `Sent ${results.length - failed.length} of ${results.length}. Failed: ${failed.map((f) => f.to).join(', ')}` : `Sent to ${results.length} recipient${results.length === 1 ? '' : 's'}.`,
                })
              } catch (err: any) {
                sendJson(500, { error: err?.message || 'Could not send the email' })
              }
            })
          })

          // Dev mirror of api/admin/students.ts — students who completed verification
          // plus the custom university names they typed.
          server.middlewares.use('/api/admin/students', (req, res) => {
            if (req.method !== 'GET') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            const identity = adminIdentity(req)
            if (!identity) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Admin sign-in required' }))
              return
            }
            if (!supabaseUrl || !supabaseServiceRoleKey) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing server configuration' }))
              return
            }
            const service = createClient(supabaseUrl, supabaseServiceRoleKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            })
            collectStudents(service)
              .then(({ students, customUniversities, stats }) => {
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ students, customUniversities, stats }))
              })
              .catch((err: any) => {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: err?.message || 'Could not load students' }))
              })
          })

          // Dev mirror of api/admin/users.ts — delegates to the SAME shared module as
          // prod (api/_users.ts), so delete/premium semantics can never drift in dev.
          server.middlewares.use('/api/admin/users', (req, res) => {
            const identity = adminIdentity(req)
            const send = (status: number, body: any) => {
              res.statusCode = status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(body))
            }
            if (!identity) return send(401, { error: 'Admin sign-in required' })
            if (!supabaseUrl || !supabaseServiceRoleKey) return send(500, { error: 'Missing server configuration' })
            const service = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

            if (req.method === 'GET') {
              listUsersReport(service)
                .then((report) => send(200, { me: identity, ...report }))
                .catch((err: any) => send(500, { error: err?.message || 'Could not load users' }))
              return
            }
            if (req.method === 'PATCH' || req.method === 'POST' || req.method === 'DELETE') {
              let raw = ''
              req.on('data', (chunk) => { raw += chunk })
              req.on('end', async () => {
                try {
                  const parsed = JSON.parse(raw || '{}')
                  const out = req.method === 'DELETE'
                    ? await deleteUsersCore(service, identity, parsed)
                    : await setPremiumCore(service, identity, parsed)
                  send(out.status, out.body)
                } catch (err: any) {
                  send(500, { error: err?.message || 'Could not complete the request' })
                }
              })
              return
            }
            send(405, { error: 'Method not allowed' })
          })

          // Dev mirror of api/admin/universities.ts.
          server.middlewares.use('/api/admin/universities', (req, res) => {
            const identity = adminIdentity(req)
            const send = (status: number, body: any) => {
              res.statusCode = status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(body))
            }
            if (!identity) return send(401, { error: 'Admin sign-in required' })
            if (!supabaseUrl || !supabaseServiceRoleKey) return send(500, { error: 'Missing server configuration' })
            const service = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

            if (req.method === 'GET') {
              loadUniversityAdditions(service)
                .then((universities) => send(200, { universities }))
                .catch((err: any) => send(500, { error: err?.message || 'Could not load universities' }))
              return
            }
            if (req.method === 'DELETE') {
              const id = new URL(req.url || '', 'http://localhost').searchParams.get('id') || ''
              deleteUniversityCore(service, id)
                .then((out) => send(out.status, out.body))
                .catch((err: any) => send(500, { error: err?.message || 'Could not remove university' }))
              return
            }
            if (req.method === 'POST') {
              let raw = ''
              req.on('data', (chunk) => { raw += chunk })
              req.on('end', async () => {
                try {
                  const out = await addUniversityCore(service, identity, JSON.parse(raw || '{}'))
                  send(out.status, out.body)
                } catch (err: any) {
                  send(500, { error: err?.message || 'Could not add university' })
                }
              })
              return
            }
            send(405, { error: 'Method not allowed' })
          })

          // Dev mirror of api/universities.ts — public read.
          server.middlewares.use('/api/universities', (req, res) => {
            const send = (status: number, body: any) => {
              res.statusCode = status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(body))
            }
            if (req.method !== 'GET') return send(405, { error: 'Method not allowed' })
            if (!supabaseUrl || !supabaseServiceRoleKey) return send(200, { additions: [] })
            const service = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
            loadUniversityAdditions(service)
              .then((rows) => send(200, { additions: rows.map((u) => ({ country_code: u.country_code, name: u.name })) }))
              .catch(() => send(200, { additions: [] }))
          })

          // Dev mirror of api/admin/raffle.ts — eligible pool + commit-reveal draw.
          server.middlewares.use('/api/admin/raffle', (req, res) => {
            const identity = adminIdentity(req)
            if (!identity) {
              res.statusCode = 401
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Admin sign-in required' }))
              return
            }
            if (!supabaseUrl || !supabaseServiceRoleKey) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing server configuration' }))
              return
            }
            const service = createClient(supabaseUrl, supabaseServiceRoleKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            })
            const send = (status: number, body: any) => {
              res.statusCode = status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(body))
            }

            if (req.method === 'GET') {
              const url = new URL(req.url || '', 'http://localhost')
              const cutoffIso = url.searchParams.get('cutoff') || new Date().toISOString()
              const university = url.searchParams.get('university') || ''
              const drawSize = url.searchParams.get('drawSize') || undefined
              buildPool(service, { cutoffIso, university })
                .then((built) => send(200, poolResponse(built, cutoffIso, university, drawSize)))
                .catch((err: any) => send(500, { error: err?.message || 'Could not load pool' }))
              return
            }

            if (req.method === 'POST') {
              let raw = ''
              req.on('data', (chunk) => {
                raw += chunk
              })
              req.on('end', async () => {
                try {
                  const parsed = JSON.parse(raw || '{}')
                  const { status, body } = await drawResult(service, parsed, identity.email)
                  send(status, body)
                } catch (err: any) {
                  send(500, { error: err?.message || 'Could not run the raffle' })
                }
              })
              return
            }

            send(405, { error: 'Method not allowed' })
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
              verifyAdminToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
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
	                    const normalizedTerm = wordsFrom(term).join(' ')
	                    const termWords = normalizedTerm.split(/\s+/).filter((word) => word.length >= 2)
	                    const compactTerm = term.replace(/[^a-z0-9]/g, '')
	                    const comparableParts = [
	                      compactTerm,
	                      ...termWords,
	                      ...termWords
	                        .filter((word) => word.length >= compactNeedle.length)
	                        .map((word) => word.slice(0, compactNeedle.length)),
	                    ].filter((part) => part && part[0] === compactNeedle[0])
	                    const distance = comparableParts.reduce(
	                      (best, part) => Math.min(best, editDistance(part, compactNeedle)),
	                      Math.min(editDistance(term, needle), editDistance(compactTerm, compactNeedle)),
	                    )
	                    const prefixDistance = comparableParts
	                      .filter((part) => part.length >= compactNeedle.length)
	                      .reduce((best, part) => Math.min(best, editDistance(part.slice(0, compactNeedle.length), compactNeedle)), distance)
	                    const bestDistance = Math.min(distance, prefixDistance)
	                    const abbreviationPenalty = /^[a-z](?:[^a-z0-9]*[a-z]){0,3}$/i.test(term.trim()) ? 8 : 0
	                    const lengthPenalty = Math.min(6, Math.max(0, normalizedTerm.length - compactNeedle.length) / 8)
	                    const prefixBonus = normalizedTerm.startsWith(compactNeedle.slice(0, 2)) ? -1 : 0
	                    const lastNeedleChar = compactNeedle[compactNeedle.length - 1] || ''
	                    const firstAndLastBonus = compactNeedle.length <= 4 && comparableParts.some((part) => part.startsWith(compactNeedle.slice(0, 2)) && part.includes(lastNeedleChar)) ? -2 : 0
	                    return { row, distance: bestDistance, score: bestDistance * 10 + abbreviationPenalty + lengthPenalty + prefixBonus + firstAndLastBonus }
	                  })
	                  .filter(({ row, distance }) => {
	                    const termLength = String(row?.term || '').length
	                    const maxDistance = compactNeedle.length <= 4 ? 1 : Math.max(2, Math.floor(Math.min(compactNeedle.length, termLength) * 0.35))
	                    return distance <= maxDistance
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
