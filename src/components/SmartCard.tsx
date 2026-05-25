import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Entry } from '../types'
import { getEntryTags, fallbackExplanation, sanitizeHtml } from '../utils'
import { Volume2, Star, Copy, MoreHorizontal, RefreshCw, Sparkles, ExternalLink, BookOpen } from 'lucide-react'

const FadeImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & { eager?: boolean }> = ({
  className, eager, ...props
}) => {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      {...props}
      className={`${className || ''} fade-img ${loaded ? 'loaded' : ''}`.trim()}
      loading={eager ? 'eager' : props.loading || 'lazy'}
      decoding="async"
      onLoad={(e) => { setLoaded(true); props.onLoad?.(e) }}
    />
  )
}

interface SmartCardProps {
  entry: Entry
  allData: Entry[]
  tts: any
  ai: { status: 'loading' | 'ready' | 'error'; generate: (e: Entry, regen?: boolean) => Promise<string> }
  autoReadAi: boolean
  user: User | null
  isFavorite: boolean
  savingFavorite: boolean
  onAuthRequired: () => void
  onToggleFavorite: (entry: Entry) => Promise<void>
  onOpenRelated?: (entry: Entry) => void
  onOpenTermPage?: (entry: Entry) => void
  authToken?: string
}

export const SmartCard: React.FC<SmartCardProps> = ({
  entry,
  tts,
  ai,
  autoReadAi,
  user,
  isFavorite,
  savingFavorite,
  onAuthRequired,
  onToggleFavorite,
  onOpenRelated,
  onOpenTermPage,
  authToken,
}) => {
  const [expanded, setExpanded] = useState<'details' | 'ai' | null>(null)
  const [aiText, setAiText] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAltUrl, setImageAltUrl] = useState('')
  const [imageTitle, setImageTitle] = useState('')
  const [imageSourceUrl, setImageSourceUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageErrorMessage, setImageErrorMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const aiPanelRef = useRef<HTMLDivElement>(null)

  const entryId = String(entry.id || entry.term).trim()

  const scrollAiIntoView = useCallback(() => {
    window.requestAnimationFrame(() => {
      aiPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, [])

  useEffect(() => {
    setAiText('')
    setLoadingAi(false)
    setImageUrl('')
    setImageAltUrl('')
    setImageTitle('')
    setImageSourceUrl('')
    setImageLoading(false)
    setImageError(false)
    setImageErrorMessage('')
    setCopied(false)
  }, [entryId])

  const fetchAi = async (regen = false) => {
    setLoadingAi(true)
    scrollAiIntoView()
    try {
      const txt = await ai.generate(entry, regen)
      setAiText(txt || '')
      if (autoReadAi && txt) {
        tts.speak(`ai-${entry.term}`, txt.replace(/<[^>]*>/g, ''))
      }
    } catch {
      setAiText(fallbackExplanation(entry))
    } finally {
      setLoadingAi(false)
    }
  }

  const fetchImage = async (force = false) => {
    if (imageLoading || (!force && imageUrl)) return
    const query = entry.term?.trim()
    if (!query) return
    const prevUrl = imageUrl
    setImageLoading(true)
    setImageError(false)
    setImageErrorMessage('')
    if (force) { setImageUrl(''); setImageAltUrl(''); setImageTitle(''); setImageSourceUrl('') }
    try {
      const params = new URLSearchParams({
        q: query,
        definition: entry.definition.slice(0, 240),
        v: `image-v3-${entryId}-${Date.now()}`,
      })
      if (force && prevUrl) params.set('exclude', prevUrl)
      const res = await fetch(`/api/image?${params.toString()}`, {
        cache: 'no-store',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      })
      const bodyText = await res.text()
      let data: any = {}
      try { data = JSON.parse(bodyText) } catch { data = {} }
      if (!res.ok) throw new Error(data?.error || `Image lookup failed (${res.status})`)
      const next = typeof data?.url === 'string' ? data.url : ''
      const thumb = typeof data?.thumbnail === 'string' ? data.thumbnail : ''
      if (!next && !thumb) throw new Error('No image found')
      setImageUrl(next || thumb)
      setImageAltUrl(thumb || next)
      setImageTitle(typeof data?.title === 'string' ? data.title : '')
      setImageSourceUrl(typeof data?.contextLink === 'string' ? data.contextLink : '')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setImageErrorMessage(message)
      setImageError(true)
    } finally {
      setImageLoading(false)
    }
  }

  const handleAi = async () => {
    if (expanded === 'ai') { setExpanded(null); return }
    setExpanded('ai')
    if (!aiText) fetchAi()
    fetchImage()
    scrollAiIntoView()
  }

  useEffect(() => {
    if (expanded === 'ai' && (loadingAi || imageLoading || aiText || imageUrl)) {
      scrollAiIntoView()
    }
  }, [expanded, loadingAi, imageLoading, aiText, imageUrl, scrollAiIntoView])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${entry.term}: ${entry.definition}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const visibleTags = getEntryTags(entry)
  const isSpeakingDef = tts.speakingId === `def-${entry.term}`
  const isPreparingDef = tts.preparingId === `def-${entry.term}`
  const isSpeakingAi = tts.speakingId === `ai-${entry.term}`
  const isPreparingAi = tts.preparingId === `ai-${entry.term}`

  return (
    <div
      className="card"
      style={{
        padding: '22px',
        maxWidth: 780,
        borderRadius: 14,
        animation: 'fade-in 0.35s ease',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        const t = e.currentTarget
        t.style.transform = 'translateY(-2px)'
        t.style.boxShadow = '0 12px 36px rgba(0,0,0,0.1)'
      }}
      onMouseLeave={(e) => {
        const t = e.currentTarget
        t.style.transform = ''
        t.style.boxShadow = ''
      }}
    >
      {/* Term Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <h2 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 700, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.3px' }}>
          {entry.term}
        </h2>
        {entry.pos && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-bg)',
            padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase',
          }}>
            {entry.pos}
          </span>
        )}
        {entry.pronunciation && (
          <span style={{ fontFamily: 'monospace', color: 'var(--text-sub)', fontSize: 14 }}>
            /{entry.pronunciation}/
          </span>
        )}
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {visibleTags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11, fontWeight: 700, color: 'var(--primary)',
                background: 'var(--primary-bg)', padding: '3px 9px', borderRadius: 99,
                border: '1px solid rgba(182,84,55,0.18)', textTransform: 'uppercase',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Definition */}
      <p style={{ fontSize: 16, color: 'var(--text-main)', lineHeight: 1.65, marginBottom: 18 }}>
        {entry.definition}
      </p>

      {/* Action Bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: expanded ? 16 : 0 }}>
        {/* Read aloud */}
        <ActionBtn
          active={isSpeakingDef}
          onClick={() => tts.speak(`def-${entry.term}`, `${entry.term}. ${entry.definition}`)}
          icon={<Volume2 size={15} />}
          label={isPreparingDef ? 'Preparing…' : isSpeakingDef ? 'Stop' : 'Read Aloud'}
        />

        {/* AI Explanation */}
        <ActionBtn
          active={expanded === 'ai'}
          onClick={handleAi}
          icon={<Sparkles size={15} />}
          label={loadingAi ? 'Thinking…' : 'AI Explanation'}
          accent
        />

        {/* Favorite */}
        <ActionBtn
          active={isFavorite}
          onClick={() => {
            if (!user) { onAuthRequired(); return }
            void onToggleFavorite(entry)
          }}
          icon={<Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />}
          label={savingFavorite ? 'Saving…' : isFavorite ? 'Saved' : 'Add to Favorites'}
        />

        {/* Copy */}
        <ActionBtn
          active={copied}
          onClick={handleCopy}
          icon={<Copy size={15} />}
          label={copied ? 'Copied!' : 'Copy Definition'}
        />

        {/* More / Details */}
        <ActionBtn
          active={expanded === 'details'}
          onClick={() => setExpanded(expanded === 'details' ? null : 'details')}
          icon={<MoreHorizontal size={15} />}
          label="Details"
        />

        {/* Full term page */}
        {onOpenTermPage && (
          <ActionBtn
            onClick={() => onOpenTermPage(entry)}
            icon={<BookOpen size={15} />}
            label="Full Page"
          />
        )}
      </div>

      {/* Details Panel */}
      {expanded === 'details' && (
        <div style={{
          background: 'var(--surface)', borderRadius: 10, padding: '14px 16px',
          border: '1px solid var(--border)', animation: 'fade-in 0.2s ease',
        }}>
          {entry.synonyms && (
            <DetailRow label="Synonyms" value={entry.synonyms} />
          )}
          {entry.tags && (
            <DetailRow label="Tags" value={entry.tags} />
          )}
          {entry.examples && (
            <DetailRow label="Example" value={entry.examples} />
          )}
          {!entry.synonyms && !entry.tags && !entry.examples && (
            <span style={{ color: 'var(--text-sub)', fontStyle: 'italic', fontSize: 14 }}>
              No additional details available.
            </span>
          )}
        </div>
      )}

      {/* AI Panel */}
      {expanded === 'ai' && (
        <div
          ref={aiPanelRef}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid #c3eec9',
            borderRadius: 10,
            padding: 16,
            animation: 'fade-in 0.2s ease',
          }}
        >
          {/* AI Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#14ae5c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Sparkles size={12} /> AI Explanation
            </span>
            {aiText && !loadingAi && (
              <button
                onClick={() => tts.speak(`ai-${entry.term}`, aiText.replace(/<[^>]*>/g, ''))}
                style={{
                  background: 'none', border: 'none', color: '#14ae5c', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                {isPreparingAi ? 'Preparing…' : isSpeakingAi ? 'Stop' : 'Read Insight'}
                <Volume2 size={13} />
              </button>
            )}
          </div>

          {/* Image */}
          {imageUrl && !imageError ? (
            <>
              <FadeImage
                key={imageUrl}
                src={imageUrl}
                alt={entry.term}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => {
                  if (imageAltUrl && imageUrl !== imageAltUrl) { setImageUrl(imageAltUrl); return }
                  setImageError(true)
                }}
                style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8, display: 'block', border: '1px solid var(--border)' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, color: 'var(--text-sub)', fontSize: 11 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imageTitle || 'Context image'}</span>
                <button onClick={() => fetchImage(true)} disabled={imageLoading} style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--primary)', padding: '3px 7px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  Refresh
                </button>
                {imageSourceUrl && (
                  <a href={imageSourceUrl} target="_blank" rel="noreferrer" style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--primary)', padding: '3px 7px', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                    Source
                  </a>
                )}
              </div>
            </>
          ) : imageLoading ? (
            <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 8 }} />
          ) : (
            <div style={{ width: '100%', height: 160, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              {imageErrorMessage?.toLowerCase().includes('google cse') ? 'Image unavailable (set Google CSE keys)' : 'Image unavailable'}
            </div>
          )}

          {/* AI Content */}
          {loadingAi ? (
            <AiLoadingSkeleton />
          ) : (
            <>
              <div
                style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-main)', marginTop: 12, whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(aiText) }}
              />
              <a
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${entry.term} supply chain`)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  marginTop: 10, padding: '8px', background: 'var(--primary-bg)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--primary)', fontSize: 12, fontWeight: 600, textDecoration: 'none',
                }}
              >
                View Google Images <ExternalLink size={12} />
              </a>
              <button
                onClick={() => fetchAi(true)}
                style={{
                  width: '100%', marginTop: 8, padding: '8px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 8, color: '#1a73e8',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 6,
                }}
              >
                <RefreshCw size={13} /> Try Different Explanation
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const ActionBtn: React.FC<{
  active?: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  accent?: boolean
}> = ({ active, onClick, icon, label, accent }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 13px',
      background: active
        ? accent
          ? 'var(--primary)'
          : 'var(--primary-bg)'
        : 'var(--surface)',
      border: `1px solid ${active ? (accent ? 'var(--primary)' : 'rgba(182,84,55,0.2)') : 'var(--border)'}`,
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 500,
      color: active ? (accent ? '#fff' : 'var(--primary)') : 'var(--text-sub)',
      cursor: 'pointer',
      transition: 'all 0.18s ease',
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'var(--surface-hover)'
        e.currentTarget.style.color = 'var(--text-main)'
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'var(--surface)'
        e.currentTarget.style.color = 'var(--text-sub)'
      }
    }}
  >
    {icon}
    {label}
  </button>
)

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 14 }}>
    <span style={{ fontWeight: 600, color: 'var(--text-sub)', minWidth: 80, flexShrink: 0 }}>{label}</span>
    <span style={{ color: 'var(--text-main)', flex: 1 }}>{value}</span>
  </div>
)

const AiLoadingSkeleton = () => (
  <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
    {[100, 82, 65, 90, 58].map((w, i) => (
      <div key={i} className="skeleton" style={{ height: 13, borderRadius: 99, width: `${w}%` }} />
    ))}
  </div>
)
