import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Volume2, BookOpen, Star, RefreshCw, CheckCircle, Copy, Share2, Clock, Trash2, X } from 'lucide-react'
import { SearchBar } from '../components/SearchBar'
import { SmartCard } from '../components/SmartCard'
import type { Entry, Message } from '../types'
import { uuid, readFreeUsage, writeFreeUsage, FREE_DAILY_LIMIT, getEntryId, recordDashboardSearch, readDashboardHistory, writeDashboardHistory } from '../utils'

const POPULAR_TERMS = ['Supply', 'Demand', 'Inventory', 'Logistics', 'Procurement', 'Sustainability']

const FEATURE_CARDS = [
  {
    icon: <Sparkles size={22} />,
    title: 'AI Explanations',
    text: 'Get clear, concise, and context-rich definitions powered by advanced AI.',
    bg: '#e6f4ef',
    color: '#006253',
  },
  {
    icon: <Volume2 size={22} />,
    title: 'Voice Reading',
    text: 'Listen to any term pronounced naturally with one click.',
    bg: '#fff0e2',
    color: '#ff781f',
  },
  {
    icon: <BookOpen size={22} />,
    title: 'Contextual Images',
    text: 'Visualize concepts with diagrams and real-world supply chain examples.',
    bg: '#e6f4ef',
    color: '#006253',
  },
  {
    icon: <Star size={22} />,
    title: 'Favorites',
    text: 'Save important terms and organize your learning journey.',
    bg: '#fff0e2',
    color: '#ff781f',
  },
  {
    icon: <BookOpen size={22} />,
    title: 'Dictionary Mode',
    text: 'Browse the complete dictionary or explore by category.',
    bg: '#e6f4ef',
    color: '#006253',
  },
  {
    icon: <CheckCircle size={22} />,
    title: 'Always Updated',
    text: 'Stay current with the latest supply chain terminology.',
    bg: '#fff0e2',
    color: '#ff781f',
  },
  {
    icon: <RefreshCw size={22} />,
    title: 'Real-World Examples',
    text: 'Every definition comes with real-world supply chain context.',
    bg: '#e6f4ef',
    color: '#006253',
  },
  {
    icon: <CheckCircle size={22} />,
    title: 'Instant Answers',
    text: 'Powerful search delivers precise results in milliseconds.',
    bg: '#fff0e2',
    color: '#ff781f',
  },
]

interface HomePageProps {
  dataHook: {
    data: Entry[]
    status: 'loading' | 'ready' | 'error' | 'empty'
    fuseRef: React.MutableRefObject<any>
    serverBacked: boolean
    searchServerWords: (q: string, limit?: number) => Promise<Entry[]>
  }
  tts: any
  ai: any
  user: any
  favorites: any
  subscription: any
  onOpenAuth: (mode?: 'signin' | 'signup') => void
  onOpenPricing: () => void
  pendingSearch?: string
  onPendingSearchConsumed?: () => void
  autoReadAi: boolean
  resetNonce: number
  onChatModeChange: (active: boolean) => void
  onOpenTermPage?: (entry: Entry) => void
}

export const HomePage: React.FC<HomePageProps> = ({
  dataHook,
  tts,
  ai,
  user,
  favorites,
  subscription,
  onOpenAuth,
  onOpenPricing,
  pendingSearch,
  onPendingSearchConsumed,
  autoReadAi,
  resetNonce,
  onChatModeChange,
  onOpenTermPage,
}) => {
  const { data, status, fuseRef, serverBacked, searchServerWords } = dataHook
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Entry[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [selectedSug, setSelectedSug] = useState(-1)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const suggestionsRequestRef = useRef(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const searchAreaRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const lastResetNonceRef = useRef(resetNonce)
  const searchHistory = useMemo(() => readDashboardHistory(), [historyVersion])

  const stopWords = /^(what is|what's|define|explain|describe|meaning of|tell me about|search for|look up|do you know)\s+/i

  // Suggestions
  useEffect(() => {
    const requestId = ++suggestionsRequestRef.current
    const query = input.trim()
    if (!query) {
      setSuggestions([])
      setSuggestionsLoading(false)
      return
    }
    if (fuseRef.current) {
      setSuggestionsLoading(false)
      setSuggestions(fuseRef.current.search(query).slice(0, 5).map((h: any) => h.item))
      return
    }
    if (serverBacked) {
      setSuggestionsLoading(true)
      const timeout = window.setTimeout(() => {
        void searchServerWords(query, 5)
          .then((next) => {
            if (suggestionsRequestRef.current === requestId) { setSuggestions(next); setSuggestionsLoading(false) }
          })
          .catch(() => {
            if (suggestionsRequestRef.current === requestId) { setSuggestions([]); setSuggestionsLoading(false) }
          })
      }, 180)
      return () => window.clearTimeout(timeout)
    }
    setSuggestions([])
    setSuggestionsLoading(false)
  }, [input, fuseRef, searchServerWords, serverBacked])

  useEffect(() => {
    onChatModeChange(messages.length > 0)
  }, [messages.length, onChatModeChange])

  useEffect(() => () => onChatModeChange(false), [onChatModeChange])

  useEffect(() => {
    if (resetNonce === lastResetNonceRef.current) return
    lastResetNonceRef.current = resetNonce
    suggestionsRequestRef.current += 1
    setMessages([])
    setInput('')
    setSuggestions([])
    setSuggestionsLoading(false)
    setSelectedSug(-1)
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }, [resetNonce])

  useEffect(() => {
    if (!historyOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!historyRef.current?.contains(event.target as Node)) setHistoryOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [historyOpen])

  // Scroll only when the newest answer is outside the usable viewport.
  useEffect(() => {
    if (!messages.length) return
    const latestBot = [...messages].reverse().find((m) => m.role === 'bot')
    const target = latestBot ? messageRefs.current[latestBot.id] : chatEndRef.current
    window.requestAnimationFrame(() => {
      if (!target) return
      const rect = target.getBoundingClientRect()
      const headerHeight = document.querySelector('header')?.getBoundingClientRect().height || 72
      const searchHeight = searchAreaRef.current?.getBoundingClientRect().height || 96
      const topLimit = headerHeight + 12
      const bottomLimit = window.innerHeight - searchHeight - 18
      const isUsablyVisible = rect.top >= topLimit && rect.top < bottomLimit && rect.bottom > topLimit
      if (!isUsablyVisible) {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })
  }, [messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSug((p) => Math.min(p + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSug((p) => Math.max(p - 1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedSug >= 0 && suggestions[selectedSug]) handleSubmit(suggestions[selectedSug].term)
      else handleSubmit(input)
    }
  }

  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim()) return
    const originalQuery = text.trim()

    if (!subscription.isPremium) {
      const usedToday = readFreeUsage()
      if (usedToday >= FREE_DAILY_LIMIT) {
        suggestionsRequestRef.current += 1
        setInput('')
        setSuggestions([])
        setSuggestionsLoading(false)
        setSelectedSug(-1)
        onOpenPricing()
        return
      }
      writeFreeUsage(usedToday + 1)
    }

    recordDashboardSearch(originalQuery)
    setHistoryVersion((value) => value + 1)

    suggestionsRequestRef.current += 1
    setInput('')
    setSuggestions([])
    setSuggestionsLoading(false)
    setSelectedSug(-1)

    const thinkingId = uuid()
    setMessages((prev) => [
      ...prev,
      { id: uuid(), role: 'user', content: originalQuery, timestamp: Date.now() },
      { id: thinkingId, role: 'bot', loading: true, timestamp: Date.now() },
    ])

    if (status !== 'ready') {
      setMessages((p) => p.map((m) => m.id === thinkingId
        ? { id: thinkingId, role: 'bot', content: 'Please load the database file first.', timestamp: Date.now() }
        : m
      ))
      return
    }

    const cleanQuery = originalQuery.replace(stopWords, '').replace(/\?/g, '').trim()
    const normalizedClean = cleanQuery.toLowerCase()
    const normalizedOrig = originalQuery.toLowerCase()
    const localExact = data.find((d) => d.term.toLowerCase() === normalizedClean) || data.find((d) => d.term.toLowerCase() === normalizedOrig)

    let searchPool = data
    if (localExact) {
      searchPool = [localExact, ...data.filter((e) => getEntryId(e) !== getEntryId(localExact))]
    } else if (fuseRef.current) {
      const res = fuseRef.current.search(cleanQuery || originalQuery)
      if (res.length) searchPool = res.map((h: any) => h.item)
      else if (serverBacked) {
        try { searchPool = await searchServerWords(cleanQuery || originalQuery, 8) }
        catch { searchPool = [] }
      } else searchPool = []
    } else if (serverBacked) {
      try { searchPool = await searchServerWords(cleanQuery || originalQuery, 8) }
      catch { searchPool = data }
    }

    let match = searchPool.find((d) => d.term.toLowerCase() === normalizedClean)
    if (!match) match = searchPool.find((d) => d.term.toLowerCase() === normalizedOrig)

    if (match) {
      setMessages((p) => p.map((m) => m.id === thinkingId
        ? { id: thinkingId, role: 'bot', entry: match, timestamp: Date.now() }
        : m
      ))
    } else if (searchPool.length) {
      setMessages((p) => p.map((m) => m.id === thinkingId
        ? { id: thinkingId, role: 'bot', related: searchPool.slice(0, 5), timestamp: Date.now() }
        : m
      ))
    } else {
      setMessages((p) => p.map((m) => m.id === thinkingId
        ? { id: thinkingId, role: 'bot', content: 'No close matches yet. Try another spelling or a related supply chain term.', timestamp: Date.now() }
        : m
      ))
    }
  }, [data, status, fuseRef, serverBacked, searchServerWords, subscription.isPremium, onOpenPricing])

  // Handle cross-page search trigger (e.g. from dashboard)
  useEffect(() => {
    if (pendingSearch && status === 'ready') {
      void handleSubmit(pendingSearch)
      onPendingSearchConsumed?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSearch, status])

  const handleRelatedPick = (messageId: string, entry: Entry) => {
    suggestionsRequestRef.current += 1
    setInput('')
    setSuggestions([])
    recordDashboardSearch(entry.term)
    setHistoryVersion((value) => value + 1)
    setMessages((c) => c.map((m) => m.id === messageId ? { id: messageId, role: 'bot', entry, timestamp: Date.now() } : m))
  }

  const clearChatHistory = () => {
    writeDashboardHistory([])
    setHistoryVersion((value) => value + 1)
    setHistoryOpen(false)
  }

  const toggleFavorite = async (entry: Entry) => {
    const result = await favorites.toggleFavorite(entry)
    if (result.needsAuth) onOpenAuth('signin')
  }

  return (
    <div className={messages.length > 0 ? 'home-chat-active' : ''} style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero Section */}
      {messages.length === 0 && (
      <section
        style={{
          background: 'var(--home-hero-bg)',
          padding: 'clamp(32px, 5vw, 58px) 24px clamp(36px, 5.5vw, 68px)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'visible',
          zIndex: 2,
        }}
      >
        <img className="home-hero-mark" src="/logo2.png" alt="" aria-hidden style={{ left: '4.8%', top: 18, width: 250, transform: 'rotate(-30deg)' }} />
        <img className="home-hero-mark" src="/logo2.png" alt="" aria-hidden style={{ right: '8%', top: 54, width: 118, opacity: 0.045, transform: 'rotate(24deg)' }} />
        <div className="home-hero-dotfield" style={{ right: '4%', top: 112 }} />
        <div className="home-hero-dotfield" style={{ left: '2.5%', bottom: 42, opacity: 0.32 }} />
        <div style={{ maxWidth: 850, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 'clamp(34px, 5.7vw, 68px)', fontWeight: 900, lineHeight: 1.03, color: 'var(--text-main)', marginBottom: 18, letterSpacing: 0 }}>
            The{' '}
            <span style={{ color: 'var(--primary)' }}>AI-Powered</span>{' '}
            Dictionary for Supply Chain Professionals
          </h1>
          <p style={{ fontSize: 18, color: 'var(--text-sub)', lineHeight: 1.55, maxWidth: 650, margin: '0 auto 28px' }}>
            Instant definitions, real-world examples, and smart insights across the entire supply chain ecosystem.
          </p>

          {/* Search Bar */}
          <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 2 }}>
            <SearchBar
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              onKeyDown={handleKeyDown}
              suggestions={suggestions}
              suggestionsLoading={suggestionsLoading}
              selectedSuggestion={selectedSug}
              disabled={status !== 'ready'}
              placeholder={status === 'ready' ? 'Search supply chain terms...' : 'Loading database...'}
              size="large"
            />
          </div>

          {/* Popular Terms */}
          <div className="home-popular-row">
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>Popular terms</span>
            {POPULAR_TERMS.map((term, i) => (
              <button
                key={term}
                onClick={() => handleSubmit(term)}
                disabled={status !== 'ready'}
                style={{
                  padding: '8px 16px',
                  borderRadius: 99,
                  border: '1px solid var(--border)',
                  background: i === 0 ? 'var(--primary-bg)' : 'var(--surface)',
                  color: i === 0 ? 'var(--primary)' : 'var(--text-sub)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)'
                  e.currentTarget.style.color = 'var(--primary)'
                  e.currentTarget.style.background = 'var(--primary-bg)'
                }}
                onMouseLeave={(e) => {
                  if (i !== 0) {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--text-sub)'
                    e.currentTarget.style.background = 'var(--surface)'
                  }
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Conversation / Results */}
      {messages.length > 0 && (
        <section className="home-chat-results-section">
          <div className="home-chat-thread">
            {messages.map((m) => (
              <div
                key={m.id}
                ref={(node) => { messageRefs.current[m.id] = node }}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 24,
                  animation: 'fade-in 0.3s ease',
                }}
              >
                {m.role === 'bot' && (
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0, marginRight: 12,
                    background: 'radial-gradient(circle at 45% 38%, #fff8f1 0 28%, #ffe3c6 58%, #ff7a36 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4,
                    boxShadow: '0 2px 12px rgba(255,122,54,0.28)',
                    overflow: 'hidden',
                  }}>
                    <img src="/logo2.png" alt="SCMpedia" style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} loading="eager" />
                  </div>
                )}
                <div style={{ maxWidth: m.role === 'user' ? '80%' : '100%', width: m.role === 'bot' ? 'calc(100% - 48px)' : 'auto' }}>
                  {m.role === 'user' ? (
                    <div style={{
                      background: '#1f4f4a', color: '#fff', padding: '10px 18px',
                      borderRadius: '16px 16px 4px 16px', fontSize: 15, lineHeight: 1.5,
                    }}>
                      {m.content}
                    </div>
                  ) : m.loading ? (
                    <ChatThinking />
                  ) : m.content ? (
                    <div style={{ padding: '10px 0', fontSize: 15, color: 'var(--text-sub)' }}>{m.content}</div>
                  ) : m.related?.length ? (
                    <WordSuggestions entries={m.related} onPick={(entry) => handleRelatedPick(m.id, entry)} />
                  ) : m.entry ? (
                    <SmartCard
                      key={`${m.id}-${getEntryId(m.entry)}`}
                      entry={m.entry}
                      allData={data}
                      tts={tts}
                      ai={ai}
                      autoReadAi={autoReadAi}
                      user={user}
                      isFavorite={favorites.favoriteTerms.has(m.entry.term.toLowerCase())}
                      savingFavorite={favorites.savingTerm?.toLowerCase() === m.entry.term.toLowerCase()}
                      onAuthRequired={() => onOpenAuth('signin')}
                      onToggleFavorite={toggleFavorite}
                      onOpenTermPage={onOpenTermPage}
                    />
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </section>
      )}

      {messages.length > 0 && (
        <section ref={searchAreaRef} className="home-results-search-section">
          <div className="home-results-search-inner">
            <div className="home-chat-search-shell">
              <div ref={historyRef} className="home-chat-history-wrap">
                <button
                  className="home-chat-history-btn"
                  onClick={() => setHistoryOpen((open) => !open)}
                  aria-expanded={historyOpen}
                  aria-label="Open chat history"
                >
                  <Clock size={16} />
                  <span>History</span>
                </button>

                {historyOpen && (
                  <div className="home-chat-history-panel">
                    <div className="home-chat-history-head">
                      <div>
                        <strong>Chat History</strong>
                        <span>Expires after 7 days</span>
                      </div>
                      <button onClick={() => setHistoryOpen(false)} aria-label="Close history"><X size={15} /></button>
                    </div>

                    {searchHistory.length ? (
                      <div className="home-chat-history-list">
                        {searchHistory.slice(0, 5).map((item) => (
                          <button
                            key={`${item.term}-${item.at}`}
                            onClick={() => {
                              setHistoryOpen(false)
                              void handleSubmit(item.term)
                            }}
                          >
                            <Clock size={13} />
                            <span>{item.term}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="home-chat-history-empty">No recent chat searches yet.</div>
                    )}

                    {searchHistory.length > 0 && (
                      <div className="home-chat-history-actions">
                        <button onClick={clearChatHistory} className="home-chat-history-clear">
                          <Trash2 size={13} />
                          Clear
                        </button>
                        {searchHistory.length > 5 && (
                          <Link to="/dashboard/history" onClick={() => setHistoryOpen(false)} className="home-chat-history-more">
                            Show more
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="home-chat-search-input">
                <SearchBar
                  value={input}
                  onChange={setInput}
                  onSubmit={handleSubmit}
                  onKeyDown={handleKeyDown}
                  suggestions={suggestions}
                  suggestionsLoading={suggestionsLoading}
                  selectedSuggestion={selectedSug}
                  disabled={status !== 'ready'}
                  placeholder="Search another supply chain term..."
                  dropdownPosition="above"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Feature Grid - only show when no results */}
      {messages.length === 0 && (
        <section style={{ padding: '58px 24px', background: 'var(--bg)', borderTop: '1px solid var(--border)', position: 'relative', zIndex: 1 }}>
          <div className="container">
            <div
              className="home-showcase"
            >
              <div className="card home-preview-card">
                <div className="home-preview-content">
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 22 }}>
                    <div style={{ background: 'var(--user-bubble)', borderRadius: 12, padding: '12px 18px', fontSize: 16, color: 'var(--text-main)', minWidth: 290 }}>
                      What is SCM?
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 22 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'radial-gradient(circle, #fff8f2 20%, #ff7a36 80%)', display: 'grid', placeItems: 'center', boxShadow: '0 12px 26px rgba(255,93,42,0.20)' }}>
                      <img src="/logo2.png" alt="" aria-hidden style={{ width: 42, height: 42, objectFit: 'contain' }} />
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 22, boxShadow: 'var(--shadow-sm)' }}>
                      <p style={{ color: 'var(--text-main)', fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
                        <strong>SCM</strong>: Abbreviation for: Supply Chain Management.
                      </p>
                      <strong style={{ fontSize: 14, color: 'var(--text-main)' }}>Related meaning:</strong>
                      <ul style={{ margin: '10px 0 20px 18px', padding: 0, color: 'var(--text-main)', fontSize: 14, lineHeight: 1.8 }}>
                        <li>Supply Chain Management (SCM)</li>
                        <li>Planning and management of sourcing, procurement, conversion, and logistics activities</li>
                        <li>Coordination and collaboration with suppliers, service providers, and customers</li>
                      </ul>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm"><Volume2 size={14} />Listen</button>
                        <button className="btn btn-outline btn-sm"><Copy size={14} />Copy</button>
                        <button className="btn btn-outline btn-sm"><Star size={14} />Save</button>
                        <button className="btn btn-outline btn-sm"><Share2 size={14} />Share</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="home-feature-grid">
                {FEATURE_CARDS.slice(0, 6).map((f) => (
                  <div
                    key={f.title}
                    className="card home-feature-card"
                  >
                    <div style={{
                      width: 54, height: 54, borderRadius: '50%', background: f.bg, color: f.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {f.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-main)', marginBottom: 5, letterSpacing: '-0.01em' }}>{f.title}</div>
                      <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.42 }}>{f.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stats Banner */}
      {messages.length === 0 && (
        <section style={{ background: 'var(--surface)', padding: '48px 24px' }}>
          <div className="container">
            <div className="home-stats-grid">
              {[
                { value: '25,000+', label: 'Professionals Worldwide' },
                { value: '10,000+', label: 'Terms & Concepts' },
                { value: '50,000+', label: 'Searches Every Month' },
                { value: '99.9%', label: 'Uptime' },
                { value: '4.9/5', label: 'Average Rating' },
              ].map((s) => (
                <div key={s.label} style={{ padding: '14px 10px' }}>
                  <div style={{ fontSize: 'clamp(27px, 4vw, 36px)', fontWeight: 900, color: 'var(--primary)', marginBottom: 6, letterSpacing: '-0.02em' }}>{s.value}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-sub)', fontWeight: 650 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      {messages.length === 0 && !subscription.isPremium && (
        <section style={{ padding: '64px 24px', textAlign: 'center', background: 'var(--bg)' }}>
          <div className="home-cta-card">
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, marginBottom: 14, lineHeight: 1.15, color: 'var(--text-main)' }}>
              Unlock the full power of{' '}
              <span style={{ color: 'var(--primary)' }}>SCMpedia</span>
            </h2>
            <p style={{ fontSize: 17, color: 'var(--text-sub)', margin: '0 auto 28px', lineHeight: 1.6, maxWidth: 640 }}>
              Go Premium for unlimited searches, voice features, advanced AI insights, custom lists, and more.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={onOpenPricing} className="btn btn-premium btn-lg">
                Explore Premium
              </button>
              <button onClick={() => handleSubmit('Bullwhip Effect')} className="btn btn-outline btn-lg">
                Start Searching
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

const ChatThinking = () => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px',
    border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card-bg)',
    color: 'var(--text-sub)', boxShadow: 'var(--shadow-sm)', fontSize: 14, fontWeight: 600,
  }}>
    <span style={{ fontSize: 13 }}>Thinking</span>
    {[1, 2, 3].map((i) => (
      <span key={i} style={{
        width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)',
        animation: 'pulse-opacity 0.85s infinite ease-in-out',
        animationDelay: `${(i - 1) * 0.12}s`,
      }} />
    ))}
  </div>
)

const WordSuggestions = ({ entries, onPick }: { entries: Entry[]; onPick: (e: Entry) => void }) => (
  <div style={{
    background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10,
    padding: 16, boxShadow: 'var(--shadow-sm)', maxWidth: 680,
  }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 10 }}>
      Did you mean one of these?
    </div>
    <div style={{ display: 'grid', gap: 8 }}>
      {entries.map((e, i) => (
        <button
          key={`${e.id || e.term}-${i}`}
          onClick={() => onPick(e)}
          style={{
            display: 'grid', gap: 4, width: '100%', padding: '11px 12px',
            border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)',
            textAlign: 'left', cursor: 'pointer', transition: 'all 0.18s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-hover)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface)'
            e.currentTarget.style.transform = ''
          }}
        >
          <strong style={{ fontSize: 14, color: 'var(--text-main)' }}>{e.term}</strong>
          <span style={{
            fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {e.definition}
          </span>
        </button>
      ))}
    </div>
  </div>
)
