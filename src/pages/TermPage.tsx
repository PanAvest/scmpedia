import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Volume2, Star, Copy, Share2, Sparkles,
  RefreshCw, BookOpen, ChevronRight, ThumbsUp, ThumbsDown,
  Building2, ChevronDown, Search, Users, FileText,
  ShieldCheck, Package, Truck, BarChart2,
} from 'lucide-react'
import type { Entry } from '../types'
import {
  getEntryId, getEntryTags, sectorExampleFallback, SCMPEDIA_SECTORS, termToSlug,
} from '../utils'

interface TermPageProps {
  dataHook: { data: Entry[]; status: 'loading' | 'ready' | 'error' | 'empty' }
  tts: { speak: (id: string, text: string) => void; speakingId: string | null; preparingId: string | null }
  ai: { generate: (entry: Entry, regen?: boolean) => Promise<string> }
  user: any
  favorites: {
    favoriteTerms: Set<string>
    savingTerm: string | null
    toggleFavorite: (entry: Entry) => Promise<{ ok: boolean; needsAuth?: boolean }>
  }
  isPremium: boolean
  onOpenAuth: () => void
  onOpenPricing: () => void
}

// Cycle of colored icons for Related Terms
const REL_ICONS = [
  { icon: <Search size={14} />, bg: '#e6f4ef', color: '#006253' },
  { icon: <Users size={14} />, bg: '#e0f0ff', color: '#1a73e8' },
  { icon: <FileText size={14} />, bg: '#fff0e2', color: '#ea580c' },
  { icon: <ShieldCheck size={14} />, bg: '#f0e6ff', color: '#7c3aed' },
  { icon: <Package size={14} />, bg: '#ffeef0', color: '#dc2626' },
  { icon: <Truck size={14} />, bg: '#e8f5e9', color: '#2e7d32' },
  { icon: <BarChart2 size={14} />, bg: '#fff8e1', color: '#f57f17' },
  { icon: <Building2 size={14} />, bg: '#e3f2fd', color: '#0277bd' },
]

interface AccordionRowProps {
  label: string
  preview: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  icon?: React.ReactNode
  iconBg?: string
  iconColor?: string
}

const AccordionRow: React.FC<AccordionRowProps> = ({
  label, preview, open, onToggle, children, icon, iconBg = '#e6f4ef', iconColor = '#006253',
}) => (
  <div className="tp-accordion">
    <button className="tp-accordion-header" onClick={onToggle}>
      <span className="tp-accordion-icon" style={{ background: iconBg, color: iconColor }}>
        {icon ?? <FileText size={14} />}
      </span>
      <span className="tp-accordion-label">{label}</span>
      {!open && <span className="tp-accordion-preview">{preview}</span>}
      <ChevronDown size={15} className={`tp-accordion-chevron${open ? ' open' : ''}`} />
    </button>
    {open && <div className="tp-accordion-body">{children}</div>}
  </div>
)

export const TermPage: React.FC<TermPageProps> = ({
  dataHook, tts, ai, user, favorites, onOpenAuth,
}) => {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const fromSource = (location.state as { from?: string } | null)?.from as 'dictionary' | 'chat' | undefined

  const entry = useMemo(() => {
    if (!slug || !dataHook.data.length) return null
    return dataHook.data.find((e) => termToSlug(e.term) === slug) ?? null
  }, [slug, dataHook.data])

  const entryId = entry ? getEntryId(entry) : ''

  // --- Image ---
  const [imageUrl, setImageUrl] = useState('')
  const [imageAltUrl, setImageAltUrl] = useState('')
  const [imageTitle, setImageTitle] = useState('')
  const [imageSourceUrl, setImageSourceUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const fetchImage = async (force = false) => {
    if (imageLoading || (!force && imageUrl)) return
    if (!entry) return
    setImageLoading(true)
    setImageError(false)
    setImageLoaded(false)
    if (force) { setImageUrl(''); setImageAltUrl(''); setImageTitle(''); setImageSourceUrl('') }
    try {
      const params = new URLSearchParams({
        q: entry.term,
        definition: entry.definition.slice(0, 240),
        v: `tp-${entryId}-${Date.now()}`,
      })
      const res = await fetch(`/api/image?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Image failed')
      const next = (data?.url as string) || (data?.thumbnail as string) || ''
      const thumb = (data?.thumbnail as string) || next
      if (!next) throw new Error('No image')
      setImageUrl(next)
      setImageAltUrl(thumb)
      setImageTitle((data?.title as string) || '')
      setImageSourceUrl((data?.contextLink as string) || '')
    } catch {
      setImageError(true)
    } finally {
      setImageLoading(false)
    }
  }

  useEffect(() => {
    if (!entry) return
    setImageUrl(''); setImageAltUrl(''); setImageTitle(''); setImageSourceUrl('')
    setImageError(false); setImageLoaded(false)
    fetchImage()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId])

  // --- AI Deep Dive ---
  const [aiText, setAiText] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [aiRegenKey, setAiRegenKey] = useState(0)
  const aiSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!entry) return
    let cancelled = false
    setAiText('')
    setLoadingAi(true)
    ai.generate(entry, aiRegenKey > 0)
      .then((text) => { if (!cancelled) setAiText(text) })
      .catch(() => { if (!cancelled) setAiText('') })
      .finally(() => { if (!cancelled) setLoadingAi(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, aiRegenKey])

  // --- Industry Example ---
  const [selectedSector, setSelectedSector] = useState(SCMPEDIA_SECTORS[0] ?? 'healthcare')
  const [industryExample, setIndustryExample] = useState('')
  const [loadingExample, setLoadingExample] = useState(false)

  useEffect(() => {
    if (!entry) return
    let cancelled = false
    setIndustryExample(sectorExampleFallback(entry, selectedSector))
    setLoadingExample(true)
    fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Supply chain term: "${entry.term}"\nDefinition: "${entry.definition}"\n\nWrite ONE focused paragraph (2-3 sentences) of a concrete, realistic example of how "${entry.term}" applies in the ${selectedSector} industry. Be specific to that industry. No headings — just the example paragraph.`,
      }),
    })
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const data = await res.json().catch(() => ({}))
        if (!cancelled && data?.text?.trim()) setIndustryExample(data.text.trim())
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingExample(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, selectedSector])

  // --- Related Terms ---
  const relatedTerms = useMemo(() => {
    if (!entry || !dataHook.data.length) return []
    const entryTags = new Set(getEntryTags(entry).map((t) => t.toLowerCase()))
    if (!entryTags.size) return []
    return dataHook.data
      .filter((e) => e.term !== entry.term)
      .map((e) => ({ e, score: getEntryTags(e).filter((t) => entryTags.has(t.toLowerCase())).length }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ e }) => e)
  }, [entry, dataHook.data])

  const synonymList = useMemo(() => {
    if (!entry?.synonyms) return []
    return entry.synonyms.split(',').map((s) => s.trim()).filter(Boolean)
  }, [entry?.synonyms])

  const tags = entry ? getEntryTags(entry) : []

  // --- Actions ---
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [openSection, setOpenSection] = useState<string | null>(null)

  const isFavorite = entry ? favorites.favoriteTerms.has(entry.term.toLowerCase()) : false
  const isSavingFav = entry ? favorites.savingTerm?.toLowerCase() === entry.term.toLowerCase() : false
  const isSpeaking = tts.speakingId === `def-${entryId}`
  const isPreparing = tts.preparingId === `def-${entryId}`
  const isSpeakingAi = tts.speakingId === `ai-${entryId}`

  const handleFavorite = async () => {
    if (!user) { onOpenAuth(); return }
    if (!entry) return
    const result = await favorites.toggleFavorite(entry)
    if (result?.needsAuth) onOpenAuth()
  }

  const handleCopy = async () => {
    if (!entry) return
    try {
      await navigator.clipboard.writeText(`${entry.term}: ${entry.definition}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const handleShare = async () => {
    if (!entry) return
    const url = `${window.location.origin}/term/${termToSlug(entry.term)}`
    try {
      if (navigator.share) {
        await navigator.share({ title: `${entry.term} – SCMpedia`, text: entry.definition, url })
      } else {
        await navigator.clipboard.writeText(url)
        setShared(true)
        setTimeout(() => setShared(false), 1800)
      }
    } catch {}
  }

  const handleAiClick = () => {
    aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleTryDifferent = () => {
    setAiRegenKey((k) => k + 1)
    setTimeout(() => aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  // ---- Loading / Not Found ----
  if (dataHook.status === 'loading' && !entry) {
    return (
      <div className="tp-page">
        <div className="tp-state-center">
          <img src="/logo2.png" alt="SCMpedia" style={{ width: 52, height: 52, objectFit: 'contain', animation: 'pulse-opacity 1.2s ease infinite' }} />
          <span>Loading term…</span>
        </div>
        <style>{css}</style>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="tp-page">
        <div className="tp-state-center">
          <BookOpen size={48} style={{ color: 'var(--text-sub)', marginBottom: 16 }} />
          <h2 style={{ fontSize: 22, color: 'var(--text-main)', marginBottom: 8 }}>Term Not Found</h2>
          <p style={{ color: 'var(--text-sub)', marginBottom: 20, maxWidth: 340 }}>
            We couldn't find "{slug?.replace(/-/g, ' ')}" in the dictionary.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/dictionary')}>Browse Dictionary</button>
            <button className="btn btn-outline" onClick={() => navigate('/')}>Search SCMpedia</button>
          </div>
        </div>
        <style>{css}</style>
      </div>
    )
  }

  const backLabel = fromSource === 'chat' ? 'Back to Chat' : fromSource === 'dictionary' ? 'Back to Dictionary' : 'Back'

  return (
    <div className="tp-page">

      {/* ── Breadcrumb ── */}
      <div className="tp-breadcrumb">
        <button className="tp-back-btn" onClick={() => navigate(-1 as any)}>
          <ArrowLeft size={14} /> {backLabel}
        </button>
        <nav className="tp-breadcrumb-nav" aria-label="breadcrumb">
          <button onClick={() => navigate('/')}>Home</button>
          <span>/</span>
          {fromSource !== 'chat' && (
            <><button onClick={() => navigate('/dictionary')}>Dictionary</button><span>/</span></>
          )}
          <span className="tp-breadcrumb-current">{entry.term}</span>
        </nav>
      </div>

      {/* ── Two-column layout ── */}
      <div className="tp-layout container">

        {/* ── LEFT: Main card ── */}
        <main className="tp-main-card card">

          {/* Term header */}
          <div className="tp-term-header">
            <div className="tp-badges">
              <span className="tp-badge-term">Term</span>
              {entry.pos && <span className="tp-pos-badge">{entry.pos}</span>}
            </div>
            <div className="tp-title-row">
              <h1 className="tp-title">{entry.term}</h1>
              <button
                className={`tp-sound-btn${isSpeaking ? ' active' : ''}`}
                onClick={() => tts.speak(`def-${entryId}`, `${entry.term}. ${entry.definition}`)}
                title={isPreparing ? 'Loading voice…' : isSpeaking ? 'Stop' : 'Read aloud'}
              >
                {isPreparing ? <span className="tp-spin" /> : <Volume2 size={17} />}
              </button>
            </div>
            {entry.pronunciation && (
              <div className="tp-pron-row">
                <span className="tp-pron">/{entry.pronunciation}/</span>
                <span className="tp-pron-link">→ Pronunciation</span>
              </div>
            )}
            {entry.pos && (
              <p className="tp-pos-line"><strong>Part of speech:</strong> {entry.pos}</p>
            )}
          </div>

          {/* Definition */}
          <div className="tp-def-block">
            <p className="tp-definition">{entry.definition}</p>
            {tags.length > 0 && (
              <div className="tp-tags">
                {tags.map((tag) => (
                  <span key={tag} className="tp-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Action grid — matches reference screenshot */}
          <div className="tp-action-grid">
            <ActionCard
              icon={<Volume2 size={16} />}
              iconBg="#fff0e2" iconColor="#ff781f"
              label={isPreparing ? 'Preparing…' : isSpeaking ? 'Stop' : 'Read Aloud'}
              sub="Listen to the definition"
              active={isSpeaking}
              onClick={() => tts.speak(`def-${entryId}`, `${entry.term}. ${entry.definition}`)}
            />
            <ActionCard
              icon={<Sparkles size={16} />}
              iconBg="#e6f4ef" iconColor="#14ae5c"
              label="AI Explanation"
              sub="Get AI-powered insights"
              onClick={handleAiClick}
            />
            <ActionCard
              icon={<Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />}
              iconBg="#fff8e1" iconColor="#f59e0b"
              label={isSavingFav ? 'Saving…' : isFavorite ? 'Saved ★' : 'Add to Favorites'}
              sub="Save to your favorites"
              active={isFavorite}
              onClick={handleFavorite}
            />
            <ActionCard
              icon={<Copy size={16} />}
              iconBg="#f3f4f6" iconColor="#374151"
              label={copied ? 'Copied!' : 'Copy Definition'}
              sub="Copy to clipboard"
              active={copied}
              onClick={handleCopy}
            />
            <ActionCard
              icon={<RefreshCw size={16} />}
              iconBg="#e0f0ff" iconColor="#1a73e8"
              label="Try Different Explanation"
              sub="See alternative explanations"
              onClick={handleTryDifferent}
            />
            <ActionCard
              icon={<Share2 size={16} />}
              iconBg="#f0e6ff" iconColor="#7c3aed"
              label={shared ? 'Link Copied!' : 'Share'}
              sub="Share this term"
              active={shared}
              onClick={handleShare}
            />
          </div>

          {/* Accordion: Synonyms */}
          {synonymList.length > 0 && (
            <AccordionRow
              label="Synonyms"
              preview={synonymList.slice(0, 4).join(', ')}
              open={openSection === 'synonyms'}
              onToggle={() => setOpenSection(openSection === 'synonyms' ? null : 'synonyms')}
              icon={<Search size={14} />}
              iconBg="#e6f4ef"
              iconColor="#006253"
            >
              <div className="tp-synonyms-row">
                {synonymList.map((syn) => (
                  <button
                    key={syn}
                    className="tp-synonym-chip"
                    onClick={() => navigate(`/term/${termToSlug(syn)}`)}
                  >
                    {syn}
                  </button>
                ))}
              </div>
            </AccordionRow>
          )}

          {/* Accordion: Example Usage */}
          {entry.examples && entry.examples.trim() && (
            <AccordionRow
              label="Example Usage"
              preview={`"${entry.examples.trim().slice(0, 60)}…"`}
              open={openSection === 'examples'}
              onToggle={() => setOpenSection(openSection === 'examples' ? null : 'examples')}
              icon={<FileText size={14} />}
              iconBg="#e0f0ff"
              iconColor="#1a73e8"
            >
              <blockquote className="tp-usage">"{entry.examples.trim()}"</blockquote>
            </AccordionRow>
          )}

          {/* Accordion: Related Terms inline */}
          {relatedTerms.length > 0 && (
            <AccordionRow
              label="Related Terms"
              preview={relatedTerms.slice(0, 3).map((r) => r.term).join(', ')}
              open={openSection === 'related'}
              onToggle={() => setOpenSection(openSection === 'related' ? null : 'related')}
              icon={<BookOpen size={14} />}
              iconBg="#fff0e2"
              iconColor="#ea580c"
            >
              <div className="tp-related-inline">
                {relatedTerms.map((rel) => (
                  <button
                    key={getEntryId(rel)}
                    className="tp-synonym-chip"
                    onClick={() => navigate(`/term/${termToSlug(rel.term)}`)}
                  >
                    {rel.term}
                  </button>
                ))}
              </div>
            </AccordionRow>
          )}

          {/* Feedback */}
          <div className="tp-feedback-row">
            <span className="tp-feedback-label">Was this definition helpful?</span>
            <button
              className={`tp-feedback-btn${feedback === 'up' ? ' up' : ''}`}
              onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
            >
              <ThumbsUp size={14} />
            </button>
            <button
              className={`tp-feedback-btn${feedback === 'down' ? ' down' : ''}`}
              onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
            >
              <ThumbsDown size={14} />
            </button>
            {feedback && (
              <span className="tp-feedback-thanks">
                {feedback === 'up' ? 'Thanks!' : "We'll improve this."}
              </span>
            )}
          </div>
        </main>

        {/* ── RIGHT: Sidebar ── */}
        <aside className="tp-sidebar">

          {/* Image card */}
          <div className="tp-sidebar-card card tp-img-card">
            <div className="tp-img-sidebar-box">
              {imageLoading ? (
                <div className="skeleton tp-img-sidebar-skeleton" />
              ) : imageUrl && !imageError ? (
                <img
                  src={imageUrl}
                  alt={entry.term}
                  className={`tp-img-sidebar${imageLoaded ? ' loaded' : ''}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    if (imageAltUrl && imageUrl !== imageAltUrl) { setImageUrl(imageAltUrl); return }
                    setImageError(true)
                  }}
                />
              ) : (
                <div className="tp-img-sidebar-placeholder">
                  <span>{entry.term.charAt(0).toUpperCase()}</span>
                </div>
              )}
              {imageUrl && !imageError && !imageLoading && (
                <button className="tp-image-refresh" onClick={() => fetchImage(true)} title="Try different image">
                  <RefreshCw size={11} />
                </button>
              )}
            </div>
            {imageSourceUrl && (
              <div className="tp-img-sidebar-source">
                {imageTitle || 'Supply Chain Image'}
                <a href={imageSourceUrl} target="_blank" rel="noreferrer"> ↗</a>
              </div>
            )}
          </div>

          {/* Related Terms card */}
          {relatedTerms.length > 0 && (
            <div className="tp-sidebar-card card">
              <div className="tp-sidebar-head">
                <strong>Related Terms</strong>
                <button className="tp-sidebar-all" onClick={() => navigate('/dictionary')}>View all</button>
              </div>
              {relatedTerms.map((rel, i) => (
                <button
                  key={getEntryId(rel)}
                  className="tp-related-item"
                  onClick={() => navigate(`/term/${termToSlug(rel.term)}`)}
                >
                  <span
                    className="tp-related-icon"
                    style={{ background: REL_ICONS[i % REL_ICONS.length]?.bg, color: REL_ICONS[i % REL_ICONS.length]?.color }}
                  >
                    {REL_ICONS[i % REL_ICONS.length]?.icon}
                  </span>
                  <span className="tp-related-text">
                    <strong>{rel.term}</strong>
                    <span>{rel.definition.length > 70 ? `${rel.definition.slice(0, 70)}…` : rel.definition}</span>
                  </span>
                  <ChevronRight size={14} className="tp-related-arrow" />
                </button>
              ))}
            </div>
          )}

          {/* Synonyms quick cloud in sidebar */}
          {synonymList.length > 0 && (
            <div className="tp-sidebar-card card">
              <div className="tp-sidebar-head">
                <strong>Similar Words</strong>
              </div>
              <div className="tp-syn-cloud">
                {synonymList.map((syn) => (
                  <button
                    key={syn}
                    className="tp-syn-pill"
                    onClick={() => navigate(`/term/${termToSlug(syn)}`)}
                  >
                    {syn}
                  </button>
                ))}
              </div>
            </div>
          )}

        </aside>
      </div>

      {/* ── Below fold: AI Deep Dive + Industry Example ── */}
      <div className="tp-below-fold container">

        {/* AI Deep Dive */}
        <section ref={aiSectionRef} className="tp-ai-section card">
          <div className="tp-ai-header">
            <span className="tp-ai-label"><Sparkles size={14} /> AI Deep Dive</span>
            <div className="tp-ai-btns">
              {!loadingAi && aiText && (
                <button className="tp-ai-btn" onClick={() => tts.speak(`ai-${entryId}`, aiText.replace(/<[^>]*>/g, ''))}>
                  <Volume2 size={12} /> {isSpeakingAi ? 'Stop' : 'Read'}
                </button>
              )}
              <button className="tp-ai-btn" onClick={() => setAiRegenKey((k) => k + 1)}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>
          {loadingAi ? (
            <div style={{ display: 'grid', gap: 10, padding: '4px 0' }}>
              {[100, 87, 72, 94, 63, 80].map((w, i) => (
                <div key={i} className="skeleton" style={{ height: 13, width: `${w}%`, borderRadius: 99 }} />
              ))}
            </div>
          ) : aiText ? (
            <div
              className="tp-ai-content"
              dangerouslySetInnerHTML={{
                __html: aiText
                  .replace(/\n*\*{0,2}Real[\s-]?World\s+Example\*{0,2}:?[\s\S]*$/im, '')
                  .trim()
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
              }}
            />
          ) : (
            <p className="tp-empty-note">AI explanation unavailable. Try refreshing.</p>
          )}
        </section>

        {/* Industry Example */}
        <section className="tp-industry-section card">
          <div className="tp-industry-header">
            <span className="tp-industry-label"><Building2 size={14} /> Real-World Industry Example</span>
            <select
              className="tp-industry-select"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              aria-label="Select industry"
            >
              {SCMPEDIA_SECTORS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="tp-industry-tinted">
            {loadingExample ? (
              <div className="tp-industry-loading">
                <span className="tp-spin" style={{ width: 13, height: 13 }} />
                Generating example for {selectedSector}…
              </div>
            ) : (
              <p>{industryExample}</p>
            )}
          </div>
        </section>

      </div>

      <style>{css}</style>
    </div>
  )
}

const ActionCard: React.FC<{
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  label: string
  sub: string
  active?: boolean
  onClick: () => void
  disabled?: boolean
}> = ({ icon, iconBg, iconColor, label, sub, active, onClick, disabled }) => (
  <button
    className={`tp-action-card${active ? ' active' : ''}`}
    onClick={onClick}
    disabled={disabled}
  >
    <span className="tp-action-icon" style={{ background: iconBg, color: iconColor }}>{icon}</span>
    <span className="tp-action-text">
      <strong>{label}</strong>
      <span>{sub}</span>
    </span>
  </button>
)

const css = `
  .tp-page {
    background: var(--bg);
    min-height: calc(100vh - 64px);
  }

  .tp-state-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: 14px;
    padding: 48px 24px;
    text-align: center;
    color: var(--text-sub);
    font-size: 15px;
    font-weight: 600;
  }

  /* ── Breadcrumb bar ── */
  .tp-breadcrumb {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 28px;
    border-bottom: 1px solid var(--border);
    background: rgba(var(--bg-rgb, 255,255,255), 0.9);
    font-size: 13px;
    position: sticky;
    top: 64px;
    z-index: 10;
    backdrop-filter: blur(10px);
  }

  .tp-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text-sub);
    font-size: 12.5px;
    font-weight: 700;
    padding: 6px 13px;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
    letter-spacing: 0.01em;
  }

  .tp-back-btn:hover {
    background: var(--surface-hover);
    color: var(--text-main);
    border-color: rgba(182,84,55,0.3);
  }

  .tp-breadcrumb-nav {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    color: var(--text-sub);
  }

  .tp-breadcrumb-nav button {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
  }

  .tp-breadcrumb-nav button:hover { text-decoration: underline; }
  .tp-breadcrumb-current { color: var(--text-main); font-weight: 700; font-size: 13px; }

  /* ── Two-column layout ── */
  .tp-layout {
    display: grid;
    grid-template-columns: 1fr 348px;
    gap: 28px;
    max-width: 1260px;
    margin: 0 auto;
    padding: 28px 28px 24px;
    align-items: start;
  }

  /* ── Main card — premium ── */
  .tp-main-card {
    padding: 32px 36px;
    border-radius: 22px;
    box-shadow: 0 2px 20px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.05);
  }

  .tp-term-header { margin-bottom: 18px; }

  .tp-badges {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .tp-badge-term {
    font-size: 10.5px;
    font-weight: 800;
    background: var(--primary-bg);
    color: var(--primary);
    padding: 4px 12px;
    border-radius: 99px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    border: 1px solid rgba(182,84,55,0.22);
  }

  .tp-pos-badge {
    font-size: 10.5px;
    font-weight: 700;
    color: #596276;
    background: #f0f2f5;
    padding: 4px 10px;
    border-radius: 99px;
  }

  .tp-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 6px;
  }

  .tp-title {
    font-size: clamp(28px, 4vw, 42px);
    font-weight: 900;
    color: var(--text-main);
    line-height: 1.05;
    letter-spacing: -0.025em;
    margin: 0;
    flex: 1;
  }

  .tp-sound-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1.5px solid var(--border);
    background: var(--surface);
    color: var(--primary);
    display: grid;
    place-items: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  }

  .tp-sound-btn:hover { background: var(--primary-bg); border-color: rgba(182,84,55,0.35); }
  .tp-sound-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); box-shadow: 0 2px 8px rgba(182,84,55,0.35); }

  .tp-pron-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 3px;
  }

  .tp-pron { font-family: monospace; color: var(--text-sub); font-size: 14px; }
  .tp-pron-link { color: var(--primary); font-size: 12px; font-weight: 600; }
  .tp-pos-line { font-size: 13px; color: var(--text-sub); margin: 5px 0 0; }

  /* ── Definition block ── */
  .tp-def-block {
    margin-bottom: 20px;
  }

  .tp-definition {
    font-size: 15.5px;
    line-height: 1.72;
    color: var(--text-main);
    margin: 0 0 12px;
  }

  .tp-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tp-tag {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--primary);
    background: var(--primary-bg);
    padding: 3px 10px;
    border-radius: 99px;
    border: 1px solid rgba(182,84,55,0.15);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ── Sidebar image card ── */
  .tp-img-card { overflow: hidden; }

  .tp-img-sidebar-box {
    position: relative;
    width: 100%;
  }

  .tp-img-sidebar-skeleton {
    width: 100%;
    height: 210px;
    border-radius: 0;
  }

  .tp-img-sidebar {
    width: 100%;
    height: 210px;
    object-fit: cover;
    display: block;
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .tp-img-sidebar.loaded { opacity: 1; }

  .tp-img-sidebar-placeholder {
    width: 100%;
    height: 210px;
    background: linear-gradient(135deg, var(--primary-bg) 0%, var(--surface) 100%);
    display: grid;
    place-items: center;
    font-size: 72px;
    font-weight: 900;
    color: var(--primary);
    opacity: 0.45;
  }

  .tp-img-sidebar-source {
    padding: 9px 16px;
    font-size: 11px;
    color: var(--text-sub);
    border-top: 1px solid var(--border);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tp-img-sidebar-source a { color: var(--text-sub); }

  .tp-image-refresh {
    position: absolute;
    bottom: 8px;
    right: 8px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.7);
    background: rgba(255,255,255,0.88);
    color: #596276;
    display: grid;
    place-items: center;
    cursor: pointer;
    backdrop-filter: blur(6px);
    transition: background 0.15s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  }

  .tp-image-refresh:hover { background: #fff; }

  /* ── Action grid ── */
  .tp-action-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin: 0 0 8px;
  }

  .tp-action-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 1.5px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .tp-action-card:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: rgba(182,84,55,0.28);
    transform: translateY(-1px);
    box-shadow: 0 3px 10px rgba(0,0,0,0.07);
  }

  .tp-action-card.active {
    background: var(--primary-bg);
    border-color: rgba(182,84,55,0.35);
  }

  .tp-action-card:disabled { opacity: 0.55; cursor: default; }

  .tp-action-icon {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  .tp-action-text strong {
    display: block;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-main);
    line-height: 1.25;
  }

  .tp-action-text span {
    display: block;
    font-size: 11px;
    color: var(--text-sub);
    line-height: 1.3;
    margin-top: 2px;
  }

  /* ── Accordion ── */
  .tp-accordion {
    border-top: 1px solid var(--border);
  }

  .tp-accordion-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 0;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: opacity 0.13s;
  }

  .tp-accordion-header:hover { opacity: 0.8; }

  .tp-accordion-icon {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .tp-accordion-label {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-main);
  }

  .tp-accordion-preview {
    flex: 1;
    font-size: 13px;
    color: var(--text-sub);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .tp-accordion-chevron {
    color: var(--text-sub);
    flex-shrink: 0;
    transition: transform 0.2s;
  }

  .tp-accordion-chevron.open { transform: rotate(180deg); }

  .tp-accordion-body {
    padding: 0 0 16px 40px;
  }

  .tp-synonyms-row, .tp-related-inline {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .tp-synonym-chip, .tp-syn-pill {
    padding: 5px 13px;
    border-radius: 99px;
    border: 1.5px solid var(--border);
    background: var(--surface);
    color: var(--text-sub);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tp-synonym-chip:hover, .tp-syn-pill:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-bg);
  }

  .tp-usage {
    border-left: 3px solid var(--primary);
    padding: 10px 16px;
    background: var(--surface);
    border-radius: 0 10px 10px 0;
    font-size: 14px;
    line-height: 1.68;
    color: var(--text-main);
    font-style: italic;
    margin: 0;
  }

  /* ── Feedback ── */
  .tp-feedback-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    margin-top: 6px;
  }

  .tp-feedback-label { font-size: 13px; color: var(--text-sub); flex: 1; }

  .tp-feedback-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1.5px solid var(--border);
    background: var(--surface);
    color: var(--text-sub);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tp-feedback-btn:hover { background: var(--surface-hover); }
  .tp-feedback-btn.up { border-color: #14ae5c; background: rgba(20,174,92,0.1); color: #14ae5c; }
  .tp-feedback-btn.down { border-color: #e53935; background: rgba(229,57,53,0.08); color: #e53935; }
  .tp-feedback-thanks { font-size: 12px; color: var(--text-sub); font-style: italic; }

  /* ── Sidebar ── */
  .tp-sidebar {
    position: sticky;
    top: 106px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
  }

  .tp-sidebar-card {
    padding: 0;
    overflow: hidden;
    border-radius: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }

  .tp-sidebar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 15px 20px;
    border-bottom: 1px solid var(--border);
  }

  .tp-sidebar-head strong { font-size: 14px; font-weight: 800; color: var(--text-main); }

  .tp-sidebar-all {
    background: none;
    border: none;
    color: var(--primary);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .tp-sidebar-all:hover { text-decoration: underline; }

  .tp-related-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 18px;
    text-align: left;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.12s;
  }

  .tp-related-item:last-child { border-bottom: none; }
  .tp-related-item:hover { background: var(--surface-hover); }

  .tp-related-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .tp-related-text { flex: 1; min-width: 0; }

  .tp-related-text strong {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 2px;
  }

  .tp-related-text span {
    display: block;
    font-size: 11px;
    color: var(--text-sub);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tp-related-arrow { color: var(--text-sub); flex-shrink: 0; }

  .tp-syn-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 14px 18px;
  }

  /* ── Below fold: AI + Industry ── */
  .tp-below-fold {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;
    max-width: 1260px;
    margin: 0 auto;
    padding: 4px 28px 48px;
  }

  .tp-ai-section, .tp-industry-section {
    padding: 26px 30px;
    border-radius: 22px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.07);
  }

  .tp-ai-header, .tp-industry-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border);
  }

  .tp-ai-label, .tp-industry-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11.5px;
    font-weight: 800;
    color: var(--text-sub);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    flex: 1;
  }

  .tp-ai-btns { display: flex; gap: 8px; }

  .tp-ai-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 8px;
    border: 1.5px solid var(--border);
    background: none;
    color: var(--text-sub);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.14s;
  }

  .tp-ai-btn:hover { background: var(--surface); border-color: rgba(182,84,55,0.25); color: var(--text-main); }

  .tp-ai-content {
    font-size: 14.5px;
    line-height: 1.78;
    color: var(--text-main);
  }

  .tp-ai-content p {
    margin: 0 0 14px;
  }

  .tp-ai-content p:last-child { margin-bottom: 0; }

  .tp-ai-content b, .tp-ai-content strong { font-weight: 700; color: var(--text-main); }

  .tp-ai-content br { display: block; margin-bottom: 10px; content: ''; }

  .tp-empty-note { font-size: 14px; color: var(--text-sub); font-style: italic; margin: 0; }

  /* Industry: tinted inner panel */
  .tp-industry-tinted {
    background: rgba(182,84,55,0.04);
    border: 1px solid rgba(182,84,55,0.12);
    border-radius: 14px;
    padding: 16px 20px;
    font-size: 14.5px;
    line-height: 1.74;
    color: var(--text-main);
    min-height: 54px;
  }

  .tp-industry-tinted p { margin: 0; }

  .tp-industry-select {
    padding: 6px 28px 6px 11px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text-main);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23596276' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 7px center;
    transition: border-color 0.14s;
  }

  .tp-industry-select:hover { border-color: rgba(182,84,55,0.35); }

  .tp-industry-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text-sub);
    font-size: 14px;
  }

  /* ── Spinner ── */
  .tp-spin {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(182,84,55,0.22);
    border-top-color: var(--primary);
    animation: tp-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes tp-spin { to { transform: rotate(360deg); } }

  /* ── Responsive: tablet ── */
  @media (max-width: 1060px) {
    .tp-layout { grid-template-columns: 1fr; padding: 22px 20px 20px; }
    .tp-sidebar { position: static; max-height: none; order: 2; }
    .tp-below-fold { grid-template-columns: 1fr; padding: 4px 20px 40px; }
    .tp-action-grid { grid-template-columns: repeat(2, 1fr); }
  }

  /* ── Responsive: mobile ── */
  @media (max-width: 680px) {
    .tp-layout, .tp-below-fold { padding: 14px 14px 20px; gap: 16px; }
    .tp-breadcrumb { padding: 9px 14px; top: 56px; }
    .tp-action-grid { grid-template-columns: 1fr 1fr; gap: 9px; }
    .tp-action-card { padding: 11px 12px; border-radius: 13px; }
    .tp-img-sidebar, .tp-img-sidebar-skeleton, .tp-img-sidebar-placeholder { height: 180px; }
    .tp-title { font-size: 26px; }
    .tp-main-card { padding: 18px 20px; border-radius: 18px; }
    .tp-ai-section, .tp-industry-section { padding: 18px 20px; border-radius: 18px; }
  }

  @media (max-width: 440px) {
    .tp-action-grid { grid-template-columns: 1fr; }
  }
`
