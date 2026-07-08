import React, { useEffect, useMemo, useRef, useState } from 'react'

// ---- shared types (mirror api/admin/raffle.ts) -----------------------------
type Entry = {
  user_id: string
  name: string
  email: string
  university: string
  programme: string
  plan: string
  index_number: string
  index_masked: string
  paid_at: string
}
type Winner = Entry & { rank: number }
type Pool = {
  cutoff: string
  university: string
  drawSize: number
  poolSize: number
  drawCount: number
  commitment: string
  excludedUnverified: number
  paymentsTableMissing: boolean
  universities: { name: string; count: number }[]
  entries: Entry[]
}

// ---- deterministic PRNG (identical maths to the server) --------------------
// Lets anyone recompute the winners from (committed list + public seed).
function xmur3(str: string) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}
function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function seededOrder<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(xmur3(seed)())
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

// Canonical serialization + SHA-256 — identical to the server's commitmentOf, so
// the client can independently confirm the entry list matches the published hash.
function canonicalOf(entries: { user_id: string; index_number: string; plan: string }[]) {
  return entries.map((e) => `${e.user_id}|${e.index_number}|${e.plan}`).join('\n')
}
async function sha256Hex(str: string) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return ''
  }
}

const CONFETTI = ['#b65437', '#ff7a34', '#e9a23b', '#14ae5c', '#007060', '#8f3e25']

export function RaffleDrawMode({ token, onClose }: { token: string; onClose: () => void }) {
  const reduce = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [cutoff] = useState(() => new Date().toISOString())
  const [university, setUniversity] = useState('ALL')
  const [drawSize, setDrawSize] = useState(30)
  const [seed, setSeed] = useState('UMaT-LAUNCH-2026-07-15')
  const [pool, setPool] = useState<Pool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<'setup' | 'drawing' | 'done'>('setup')
  const [winners, setWinners] = useState<Winner[]>([])
  const [revealed, setRevealed] = useState<Winner[]>([])
  const [reelName, setReelName] = useState('—')
  const [reelSub, setReelSub] = useState('shuffling the pool…')
  const [drawIdx, setDrawIdx] = useState(0)
  const [muted, setMuted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const skipRef = useRef(false)
  const mutedRef = useRef(false)
  const mountedRef = useRef(true)
  const inFlightRef = useRef(false)
  const acRef = useRef<AudioContext | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const partsRef = useRef<any[]>([])
  const burstRef = useRef<(x: number, y: number, n: number) => void>(() => {})
  const toastTimer = useRef<number | undefined>(undefined)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // Unlock audio on the very first interaction (browsers start AudioContext
  // suspended until a user gesture), so the draw always has sound.
  useEffect(() => {
    const unlock = () => {
      try {
        const c = ac()
        if (c && c.state === 'suspended') c.resume()
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Stop any in-flight reveal, silence audio, and release timers/AudioContext when
  // the overlay closes mid-draw — no setState or sound on an unmounted component.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      skipRef.current = true
      timersRef.current.forEach((id) => window.clearTimeout(id))
      timersRef.current = []
      window.clearTimeout(toastTimer.current)
      try {
        acRef.current?.close()
      } catch {
        /* already closed */
      }
      acRef.current = null
    }
  }, [])

  // ---- load / freeze the pool ---------------------------------------------
  const loadPool = async (uni: string) => {
    setLoading(true)
    setError('')
    setPool(null) // never keep a previous school's pool/commitment if this refetch fails
    try {
      const res = await fetch(`/api/admin/raffle?cutoff=${encodeURIComponent(cutoff)}&university=${encodeURIComponent(uni)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not load the eligible pool')
      setPool(body as Pool)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the eligible pool')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPool(university)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [university])

  // ---- confetti ------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const cx = canvas.getContext('2d')
    if (!cx) return
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    const size = () => {
      canvas.width = window.innerWidth * DPR
      canvas.height = window.innerHeight * DPR
      cx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    size()
    window.addEventListener('resize', size)
    burstRef.current = (x, y, n) => {
      if (reduce) return
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 4 + Math.random() * 8
        partsRef.current.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, g: 0.22 + Math.random() * 0.12,
          s: 5 + Math.random() * 7, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
          c: CONFETTI[i % CONFETTI.length], life: 70 + Math.random() * 40, sq: Math.random() < 0.5,
        })
      }
    }
    let raf = 0
    const loop = () => {
      cx.clearRect(0, 0, canvas.width, canvas.height)
      const parts = partsRef.current
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr; p.life--
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot)
        cx.globalAlpha = Math.max(0, Math.min(1, p.life / 40)); cx.fillStyle = p.c
        if (p.sq) cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.5)
        else { cx.beginPath(); cx.arc(0, 0, p.s / 2, 0, 6.28); cx.fill() }
        cx.restore()
        if (p.life <= 0 || p.y > window.innerHeight + 40) parts.splice(i, 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
    }
  }, [reduce])

  // ---- audio ---------------------------------------------------------------
  const ac = () => {
    if (!acRef.current) {
      try {
        acRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch {
        /* no audio */
      }
    }
    return acRef.current
  }
  const tone = (freq: number, dur: number, type: OscillatorType, vol: number) => {
    if (!mountedRef.current || mutedRef.current) return
    const c = ac()
    if (!c) return
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.setValueAtTime(0, c.currentTime)
    g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
    o.connect(g)
    g.connect(c.destination)
    o.start()
    o.stop(c.currentTime + dur + 0.02)
  }
  const tick = () => tone(190 + Math.random() * 50, 0.05, 'square', 0.06)
  const ding = (n: number) => {
    const base = 523.25 * Math.pow(2, (n % 7) / 12)
    tone(base, 0.55, 'triangle', 0.22)
    tone(base * 1.5, 0.45, 'sine', 0.1)
  }
  const readyChime = () => {
    ;[392, 523.25].forEach((f, i) => timersRef.current.push(window.setTimeout(() => tone(f, 0.22, 'triangle', 0.16), i * 130)))
  }
  const fanfare = () => {
    ;[0, 4, 7, 12, 16].forEach((s, i) =>
      timersRef.current.push(window.setTimeout(() => tone(392 * Math.pow(2, s / 12), 0.6, 'triangle', 0.14), i * 110)),
    )
  }

  const flash = (msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }

  // ---- the draw ------------------------------------------------------------
  const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, skipRef.current ? 0 : ms))

  const spinTo = async (w: Winner, rank: number, candidates: Entry[]) => {
    setDrawIdx(rank)
    setReelSub('shuffling the pool…')
    const total = reduce ? 3 : (rank <= 5 ? 24 : 15) + Math.floor(Math.random() * 5)
    let delay = 28
    for (let k = 0; k < total; k++) {
      const r = candidates[Math.floor(Math.random() * candidates.length)]
      setReelName(r?.name || '—')
      tick()
      await sleep(delay)
      delay = Math.min(delay * 1.14, 150)
      if (skipRef.current || !mountedRef.current) break
    }
    if (!mountedRef.current) return
    setReelName(w.name)
    setReelSub(`${w.university} · ${w.index_masked}`)
    ding(rank)
    burstRef.current(window.innerWidth / 2, window.innerHeight * 0.42, 34)
  }

  const startDraw = async () => {
    if (inFlightRef.current || !pool || !pool.entries.length) return
    inFlightRef.current = true
    setBusy(true)
    setError('')
    try {
      const c = ac()
      if (c && c.state === 'suspended') c.resume()
    } catch {
      /* ignore */
    }
    let data: any
    try {
      const res = await fetch('/api/admin/raffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        // trim the seed exactly like the server, and send the committed hash so the
        // server refuses to draw if the pool shifted since it was published.
        body: JSON.stringify({ seed: seed.trim(), cutoff, university, commitment: pool.commitment, drawSize }),
      })
      data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not run the draw')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run the draw')
      inFlightRef.current = false
      setBusy(false)
      return
    }
    const wins: Winner[] = Array.isArray(data.winners) ? data.winners : []
    setWinners(wins)
    setRevealed([])
    skipRef.current = false
    setPhase('drawing')
    readyChime()
    const candidates = pool.entries
    for (let i = 0; i < wins.length; i++) {
      if (!mountedRef.current) return
      const w = wins[i]!
      await spinTo(w, i + 1, candidates)
      if (!mountedRef.current) return
      setRevealed((prev) => [...prev, w])
      await sleep(reduce ? 60 : i < 5 ? 480 : 280)
    }
    if (!mountedRef.current) return
    setPhase('done')
    inFlightRef.current = false
    setBusy(false)
    if (!reduce) {
      fanfare()
      const w = window.innerWidth
      burstRef.current(w * 0.5, window.innerHeight * 0.3, 90)
      burstRef.current(w * 0.2, window.innerHeight * 0.4, 60)
      burstRef.current(w * 0.8, window.innerHeight * 0.4, 60)
    }
  }

  // ---- actions -------------------------------------------------------------
  const copyCommit = () => {
    if (!pool) return
    navigator.clipboard?.writeText(pool.commitment).then(
      () => flash('Commitment copied — publish it before the draw'),
      () => flash('Copy failed'),
    )
  }
  const randomizeSeed = () => {
    const s = 'DRAW-' + Math.floor(performance.now()).toString(36).toUpperCase() + '-' + (pool?.poolSize || 0)
    setSeed(s)
    flash('Random seed set')
  }
  const verifyDraw = async () => {
    if (!pool || !winners.length) return
    const usedSeed = seed.trim()
    const hash = await sha256Hex(canonicalOf(pool.entries))
    const hashOk = hash === pool.commitment
    const order = seededOrder(pool.entries, usedSeed).slice(0, winners.length)
    const orderOk = order.every((e, i) => e.user_id === winners[i]!.user_id)
    if (hashOk && orderOk) flash('Verified — entry list matches the commitment and reproduces these winners')
    else if (!hashOk) flash('Not verified — entry list does not match the published commitment')
    else flash('Not verified — winners could not be reproduced from (list + seed)')
  }
  const exportCsv = () => {
    if (!winners.length) return
    const rows = [['rank', 'name', 'email', 'university', 'programme', 'index_number', 'plan']].concat(
      winners.map((w) => [String(w.rank), w.name, w.email, w.university, w.programme, w.index_number, w.plan]),
    )
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `scmpedia-grand-draw-${(university || 'all').toLowerCase()}.csv`
    a.style.display = 'none'
    document.body.appendChild(a) // Safari/Firefox only download an anchor that's in the DOM
    a.click()
    window.setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 0)
    flash('Winners exported as CSV')
  }
  const drawAgain = () => {
    inFlightRef.current = false
    setBusy(false)
    setPhase('setup')
    setWinners([])
    setRevealed([])
    setReelName('—')
    setReelSub('shuffling the pool…')
    setDrawIdx(0)
  }

  const uniLabel = (u: string) => (u === 'ALL' ? 'All universities' : u)
  const locked = phase !== 'setup'
  const drawCount = pool ? Math.min(drawSize, pool.poolSize) : drawSize

  return (
    <div className="rf-overlay">
      <style>{CSS}</style>
      <canvas ref={canvasRef} className="rf-confetti" />

      <header className="rf-top">
        <div className="rf-brand">
          <img src="/logo.png" alt="SCMpedia" className="rf-logo" />
          <span className="rf-chip rf-chip-live">
            <i className="rf-dot" /> GRAND DRAW
          </span>
        </div>
        <div className="rf-top-actions">
          <button className="rf-icon" onClick={() => setMuted((m) => !m)} title="Sound on/off" aria-label="Sound on/off">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
              {muted ? <path d="m23 9-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />}
            </svg>
          </button>
          <button className="rf-back" onClick={onClose} aria-label="Back to dashboard">
            Back
          </button>
        </div>
      </header>

      <main className="rf-main">
        {/* ---------------- SETUP ---------------- */}
        {phase === 'setup' && (
          <section className="rf-setup">
            <div className="rf-eyebrow">UMaT Launch · 15 July 2026 · Live Draw</div>
            <h1 className="rf-title">
              The <span className="rf-accent">Grand Draw</span>
            </h1>
            <p className="rf-sub">
              <b>{drawCount} verified students</b> who backed the <b>Student Plan</b> win — headlined by a signed{' '}
              <span className="rf-prize">Executive Insight Series Compendium (GHS&nbsp;1,200)</span>.
            </p>

            <div className="rf-controls">
              <label className="rf-field">
                <span className="rf-label">University</span>
                <select className="rf-select" value={university} disabled={loading || locked} onChange={(e) => setUniversity(e.target.value)}>
                  <option value="ALL">All universities{pool ? ` · ${pool.universities.reduce((s, u) => s + u.count, 0)}` : ''}</option>
                  {pool?.universities.map((u) => (
                    <option key={u.name} value={u.name}>
                      {u.name} · {u.count}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rf-field rf-field-sm">
                <span className="rf-label">Number of winners</span>
                <input
                  className="rf-input"
                  type="number"
                  min={1}
                  max={pool ? Math.max(1, pool.poolSize) : 500}
                  value={drawSize}
                  disabled={locked}
                  onChange={(e) => setDrawSize(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                />
              </label>
              <label className="rf-field">
                <span className="rf-label">Public seed</span>
                <div className="rf-seed">
                  <input
                    className="rf-input"
                    value={seed}
                    disabled={locked}
                    spellCheck={false}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="e.g. NLA result / block hash"
                  />
                  <button className="rf-ghost rf-seed-btn" onClick={randomizeSeed} disabled={locked} title="Random seed">
                    New
                  </button>
                </div>
              </label>
            </div>

            <div className="rf-stats">
              <div className="rf-stat">
                <div className="rf-stat-num">{loading ? '…' : pool?.poolSize ?? 0}</div>
                <div className="rf-stat-lbl">in the draw</div>
              </div>
              <div className="rf-stat">
                <div className="rf-stat-num">{loading ? '…' : drawCount}</div>
                <div className="rf-stat-lbl">winners</div>
              </div>
              <div className="rf-stat rf-stat-uni">
                <div className="rf-stat-num rf-stat-sm">{uniLabel(university)}</div>
                <div className="rf-stat-lbl">selected school</div>
              </div>
            </div>

            {pool && pool.excludedUnverified > 0 && (
              <div className="rf-note">
                {pool.excludedUnverified} paid {pool.excludedUnverified === 1 ? 'student has' : 'students have'} not completed student
                verification, so they can’t be placed in a school and aren’t in this draw.
              </div>
            )}

            {pool && pool.paymentsTableMissing && (
              <div className="rf-note">
                Eligibility is read from active student subscriptions. The payments audit table isn’t set up in this database, so
                exact payment-time freezing isn’t available — run supabase-schema.sql to enable it.
              </div>
            )}

            <div className="rf-commit">
              <div className="rf-commit-head">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 3l7 3v5c0 4.4-3 8.3-7 10-4-1.7-7-5.6-7-10V6z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                Entry-list commitment (publish before drawing)
              </div>
              <div className="rf-commit-row">
                <code className="rf-hash">{loading ? 'computing…' : pool?.commitment || '—'}</code>
                <button className="rf-ghost" onClick={copyCommit} disabled={!pool}>
                  Copy
                </button>
              </div>
            </div>

            {error && <div className="rf-error">{error}</div>}

            <button className="rf-cta" onClick={startDraw} disabled={loading || busy || !pool || !pool.entries.length}>
              {busy ? 'Drawing…' : loading ? 'Loading pool…' : !pool?.entries.length ? 'No eligible students yet' : 'Start the Draw'}
            </button>
            <div className="rf-fairline">Provably fair · commit-reveal · anyone can recompute the winners</div>
          </section>
        )}

        {/* ---------------- DRAWING ---------------- */}
        {phase === 'drawing' && (
          <section className="rf-drawing">
            <div className="rf-drawcount">
              Drawing winner <b>{String(drawIdx).padStart(2, '0')}</b> / {winners.length}
            </div>
            <div className="rf-reel">
              <div className="rf-reel-line" />
              <div className="rf-reel-name">{reelName}</div>
              <div className="rf-reel-sub">{reelSub}</div>
            </div>
            <div className="rf-dots">
              {winners.map((_, i) => (
                <i key={i} className={i < revealed.length ? 'on' : ''} />
              ))}
            </div>
            <button className="rf-ghost rf-skip" onClick={() => (skipRef.current = true)}>
              Skip to results
            </button>
            <WinnersGrid winners={revealed} live />
          </section>
        )}

        {/* ---------------- DONE ---------------- */}
        {phase === 'done' && (
          <section className="rf-done">
            <div className="rf-done-head">
              <div>
                <h2 className="rf-done-title">
                  {winners.length} <span className="rf-accent">Winners</span>
                </h2>
                <div className="rf-done-sub">
                  {uniLabel(university)} · seed “{seed.trim()}”
                </div>
              </div>
              <div className="rf-actions">
                <button className="rf-ghost" onClick={exportCsv}>Export CSV</button>
                <button className="rf-ghost" onClick={verifyDraw}>Verify draw</button>
                <button className="rf-ghost" onClick={drawAgain}>Draw again</button>
              </div>
            </div>
            <WinnersGrid winners={winners} />
            {pool && (
              <div className="rf-fairness">
                <div className="rf-commit-head">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 3l7 3v5c0 4.4-3 8.3-7 10-4-1.7-7-5.6-7-10V6z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  This draw can be reproduced by anyone
                </div>
                <div className="rf-fairrows">
                  <div className="rf-fairrow"><span className="k">Commitment</span><code className="v">{pool.commitment}</code></div>
                  <div className="rf-fairrow"><span className="k">Public seed</span><span className="v">{seed.trim()}</span></div>
                  <div className="rf-fairrow"><span className="k">University</span><span className="v">{uniLabel(university)}</span></div>
                  <div className="rf-fairrow"><span className="k">Method</span><span className="v">seeded Fisher–Yates, first {winners.length} · deterministic</span></div>
                  <div className="rf-fairrow"><span className="k">Pool</span><span className="v">{pool.poolSize} eligible · frozen at {new Date(cutoff).toLocaleString()}</span></div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {toast && <div className="rf-toast">{toast}</div>}
    </div>
  )
}

function WinnersGrid({ winners, live }: { winners: Winner[]; live?: boolean }) {
  return (
    <div className="rf-grid">
      {winners.map((w) => (
        <div className={`rf-card in${w.rank <= 3 ? ' top3' : ''}`} key={w.user_id}>
          <div className="rf-rank">#{String(w.rank).padStart(2, '0')}</div>
          <div className="rf-name">{w.name || 'Student'}</div>
          <div className="rf-uni">
            {w.university}
            {w.programme ? ` · ${w.programme}` : ''}
          </div>
          <div className="rf-meta">
            <span className="rf-verified">Verified · paid</span>
            <span className="rf-idx">{w.index_masked}</span>
          </div>
        </div>
      ))}
      {live && !winners.length && <div className="rf-grid-empty">Winners appear here…</div>}
    </div>
  )
}

const CSS = `
.rf-overlay{position:fixed;inset:0;z-index:9999;overflow-y:auto;color:#1f1f1f;
  font-family:"Google Sans","Segoe UI",Roboto,Helvetica,Arial,"Apple Color Emoji","Segoe UI Emoji",sans-serif;
  background:
    radial-gradient(circle at 7% 16%, rgba(255,110,28,.06) 0 1px, transparent 1.8px) 0 0/18px 18px,
    linear-gradient(180deg,#ffffff,#faf7f1),
    radial-gradient(circle at top left, rgba(255,128,43,.07), transparent 34%),
    radial-gradient(circle at 88% 12%, rgba(0,79,70,.06), transparent 30%),
    #fbf8f1;
  --rf-primary:#b65437;--rf-primary-2:#e2673a;--rf-primary-dark:#8f3e25;
  --rf-green:#004f46;--rf-green-2:#007060;--rf-mint:#14ae5c;--rf-gold:#e9a23b;
  --rf-ink:#1f1f1f;--rf-sub:#5f5b57;--rf-border:#e6ded2;--rf-surface:#ffffff;--rf-surface-2:#f4efe6;
}
.rf-overlay *{box-sizing:border-box}
.rf-confetti{position:fixed;inset:0;z-index:5;pointer-events:none}
.rf-top{position:relative;z-index:6;display:flex;align-items:center;justify-content:space-between;
  gap:14px;padding:18px clamp(16px,3vw,34px)}
.rf-brand{display:flex;align-items:center;gap:14px}
.rf-logo{height:34px;width:auto;display:block}
.rf-chip{display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 13px;border-radius:999px;
  font-size:12px;font-weight:700;letter-spacing:.14em;font-family:ui-monospace,"SF Mono",Menlo,monospace}
.rf-chip-live{color:var(--rf-primary);background:rgba(182,84,55,.09);border:1px solid rgba(182,84,55,.24)}
.rf-dot{width:7px;height:7px;border-radius:50%;background:var(--rf-mint);box-shadow:0 0 9px var(--rf-mint);animation:rf-pulse 1.8s ease-in-out infinite}
.rf-top-actions{display:flex;gap:8px}
.rf-icon{cursor:pointer;width:38px;height:38px;border-radius:50%;border:1px solid var(--rf-border);
  background:var(--rf-surface);color:var(--rf-sub);font-size:15px;display:flex;align-items:center;justify-content:center;transition:.15s}
.rf-icon:hover{color:var(--rf-ink);border-color:var(--rf-primary)}
.rf-back{cursor:pointer;height:38px;padding:0 18px;border-radius:999px;border:1px solid var(--rf-border);background:var(--rf-surface);color:var(--rf-sub);font-family:inherit;font-size:14px;font-weight:600;transition:.15s}
.rf-back:hover{color:var(--rf-primary);border-color:var(--rf-primary);background:rgba(182,84,55,.06)}

.rf-main{position:relative;z-index:6;max-width:1120px;margin:0 auto;padding:10px clamp(16px,3vw,34px) 60px}

/* ---- setup ---- */
.rf-setup{text-align:center;max-width:760px;margin:0 auto;padding-top:clamp(8px,4vh,40px)}
.rf-eyebrow{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;letter-spacing:.32em;
  color:var(--rf-primary);font-weight:700;text-transform:uppercase;margin-bottom:16px}
.rf-title{font-size:clamp(38px,7vw,74px);font-weight:800;line-height:.98;letter-spacing:-.03em;margin:0;text-wrap:balance}
.rf-accent{background:linear-gradient(120deg,var(--rf-gold),var(--rf-primary-2) 55%,var(--rf-primary));
  -webkit-background-clip:text;background-clip:text;color:transparent}
.rf-sub{max-width:56ch;margin:18px auto 0;font-size:clamp(15px,1.8vw,18px);line-height:1.5;color:var(--rf-sub)}
.rf-sub b{color:var(--rf-ink)}
.rf-prize{color:var(--rf-primary);font-weight:600}

.rf-controls{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin:30px auto 0;max-width:640px}
.rf-field{flex:1;min-width:240px;text-align:left;display:flex;flex-direction:column;gap:7px}
.rf-field.rf-field-sm{flex:0 1 170px;min-width:150px}
.rf-label{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--rf-sub)}
.rf-select,.rf-input{width:100%;height:48px;border:1px solid var(--rf-border);border-radius:12px;background:var(--rf-surface);
  color:var(--rf-ink);font-size:15px;padding:0 14px;font-family:inherit;outline:none;transition:.15s}
.rf-select:focus,.rf-input:focus{border-color:var(--rf-primary);box-shadow:0 0 0 3px rgba(182,84,55,.12)}
.rf-select:disabled,.rf-input:disabled{background:var(--rf-surface-2);color:var(--rf-sub);cursor:not-allowed}
.rf-seed{display:flex;gap:8px}
.rf-seed .rf-input{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:13px}
.rf-seed-btn{flex:none;width:48px;height:48px;font-size:16px}

.rf-stats{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:26px auto 0;max-width:640px}
.rf-stat{flex:1;min-width:150px;background:var(--rf-surface);border:1px solid var(--rf-border);border-radius:14px;padding:16px 14px;box-shadow:0 10px 24px rgba(20,12,4,.05)}
.rf-stat-num{font-size:34px;font-weight:800;letter-spacing:-.02em;color:var(--rf-primary);font-variant-numeric:tabular-nums;line-height:1}
.rf-stat-sm{font-size:16px;line-height:1.2;word-break:break-word}
.rf-stat-lbl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--rf-sub);margin-top:7px;font-weight:600}

.rf-note{margin:18px auto 0;max-width:60ch;font-size:13px;line-height:1.5;color:var(--rf-sub);
  background:rgba(233,162,59,.1);border:1px solid rgba(233,162,59,.32);border-radius:12px;padding:11px 15px}
.rf-commit{margin:22px auto 0;max-width:640px;text-align:left;background:rgba(0,79,70,.05);
  border:1px solid rgba(0,79,70,.18);border-radius:14px;padding:15px 17px}
.rf-commit-head{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:var(--rf-green)}
.rf-commit-row{display:flex;align-items:center;gap:10px;margin-top:10px}
.rf-hash{flex:1;font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;color:var(--rf-green-2);
  word-break:break-all;line-height:1.4}
.rf-error{margin:18px auto 0;max-width:60ch;color:#b4231a;background:rgba(217,48,37,.08);
  border:1px solid rgba(217,48,37,.3);border-radius:12px;padding:11px 15px;font-size:14px}

.rf-cta{margin:26px auto 0;display:inline-flex;align-items:center;gap:12px;cursor:pointer;border:0;border-radius:999px;
  padding:18px 40px;color:#fff;font-size:clamp(16px,2.2vw,20px);font-weight:800;letter-spacing:.01em;
  background:linear-gradient(180deg,var(--rf-primary-2),var(--rf-primary));font-family:inherit;
  box-shadow:0 16px 34px -12px rgba(182,84,55,.65);transition:transform .16s cubic-bezier(.2,.9,.3,1.4),box-shadow .16s,opacity .2s}
.rf-cta:hover:not(:disabled){transform:translateY(-3px) scale(1.02);box-shadow:0 24px 46px -14px rgba(182,84,55,.75)}
.rf-cta:active:not(:disabled){transform:translateY(0) scale(.99)}
.rf-cta:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
.rf-cta:not(:disabled)::after{content:"";width:0;height:0;border-left:14px solid #fff;border-top:8px solid transparent;border-bottom:8px solid transparent}
.rf-fairline{margin-top:18px;font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;color:var(--rf-sub)}

/* ---- drawing ---- */
.rf-drawing{max-width:760px;margin:0 auto;text-align:center;display:flex;flex-direction:column;align-items:center;gap:20px;padding-top:clamp(8px,3vh,30px)}
.rf-drawcount{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:14px;letter-spacing:.28em;text-transform:uppercase;color:var(--rf-primary)}
.rf-drawcount b{color:var(--rf-ink)}
.rf-reel{width:100%;background:var(--rf-surface);border:1px solid var(--rf-border);border-radius:20px;
  box-shadow:0 22px 50px -20px rgba(20,12,4,.25);padding:44px 24px;position:relative;overflow:hidden}
.rf-reel-line{position:absolute;left:0;right:0;top:50%;height:2px;transform:translateY(-1px);
  background:linear-gradient(90deg,transparent,var(--rf-primary),transparent);opacity:.4}
.rf-reel-name{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-weight:700;font-size:clamp(24px,4.8vw,48px);
  letter-spacing:-.01em;line-height:1.06;min-height:1.1em;text-transform:uppercase;color:var(--rf-ink)}
.rf-reel-sub{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:13px;color:var(--rf-sub);margin-top:12px;min-height:1.2em}
.rf-dots{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:640px}
.rf-dots i{width:8px;height:8px;border-radius:50%;background:rgba(182,84,55,.2);transition:.3s}
.rf-dots i.on{background:var(--rf-primary);box-shadow:0 0 8px rgba(182,84,55,.6);transform:scale(1.2)}

.rf-ghost{cursor:pointer;background:var(--rf-surface);border:1px solid var(--rf-border);color:var(--rf-sub);
  border-radius:999px;padding:10px 20px;font-family:inherit;font-size:13px;font-weight:600;transition:.15s}
.rf-ghost:hover:not(:disabled){color:var(--rf-primary);border-color:var(--rf-primary);background:rgba(182,84,55,.06)}
.rf-ghost:disabled{opacity:.5;cursor:not-allowed}
.rf-skip{margin-top:2px}

/* ---- winners ---- */
.rf-done{max-width:1120px;margin:0 auto}
.rf-done-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:6px 2px 20px}
.rf-done-title{margin:0;font-size:clamp(24px,3.6vw,38px);font-weight:800;letter-spacing:-.02em}
.rf-done-sub{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;color:var(--rf-sub);margin-top:5px}
.rf-actions{display:flex;gap:9px;flex-wrap:wrap}

.rf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:13px;margin-top:14px}
.rf-grid-empty{grid-column:1/-1;text-align:center;color:var(--rf-sub);padding:40px;font-size:14px}
.rf-card{position:relative;background:var(--rf-surface);border:1px solid var(--rf-border);border-radius:15px;
  padding:16px 16px 14px 19px;overflow:hidden;box-shadow:0 10px 24px rgba(20,12,4,.06);
  opacity:0;transform:translateY(22px) scale(.94);animation:rf-in .5s cubic-bezier(.2,1,.3,1) forwards}
.rf-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;
  background:linear-gradient(180deg,var(--rf-gold),var(--rf-primary),var(--rf-primary-dark))}
.rf-rank{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;font-weight:700;color:var(--rf-primary);letter-spacing:.06em}
.rf-name{font-size:19px;font-weight:800;letter-spacing:-.01em;margin:5px 0 3px;line-height:1.12}
.rf-uni{font-size:13px;color:var(--rf-sub);line-height:1.35}
.rf-meta{display:flex;align-items:center;gap:8px;margin-top:11px;flex-wrap:wrap;
  font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:11px}
.rf-verified{display:inline-flex;align-items:center;gap:5px;color:var(--rf-green-2);font-weight:600;
  background:rgba(0,112,96,.09);border:1px solid rgba(0,112,96,.24);border-radius:999px;padding:3px 9px}
.rf-idx{background:var(--rf-surface-2);border:1px solid var(--rf-border);border-radius:999px;padding:3px 9px;color:var(--rf-sub)}
.rf-card.top3::after{content:"";position:absolute;top:0;right:0;border-width:0 22px 22px 0;border-style:solid;border-color:transparent var(--rf-gold) transparent transparent}

.rf-fairness{margin-top:24px;background:rgba(0,79,70,.05);border:1px solid rgba(0,79,70,.18);border-radius:16px;padding:18px 20px}
.rf-fairrows{margin-top:14px;display:grid;gap:9px}
.rf-fairrow{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12.5px}
.rf-fairrow .k{color:var(--rf-sub);min-width:120px;letter-spacing:.06em;text-transform:uppercase;font-size:11px}
.rf-fairrow .v{color:var(--rf-ink);word-break:break-all}

.rf-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10000;
  background:var(--rf-ink);color:#fff;padding:12px 20px;border-radius:12px;font-size:13.5px;
  box-shadow:0 16px 40px rgba(0,0,0,.28);animation:rf-toast .25s ease}

@keyframes rf-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes rf-in{to{opacity:1;transform:none}}
@keyframes rf-toast{from{opacity:0;transform:translateX(-50%) translateY(14px)}to{opacity:1;transform:translateX(-50%)}}
@media (max-width:560px){.rf-reel{padding:32px 16px}.rf-done-head{align-items:flex-start}}
@media (prefers-reduced-motion:reduce){.rf-card{animation:none;opacity:1;transform:none}.rf-dot{animation:none}}
`
