import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  ExternalLink,
  Grid2X2,
  List,
  Maximize2,
  Search,
  Volume2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { Entry } from '../types'
import { cleanReplacementChars, getEntryId, getEntryTags } from '../utils'

interface DictionaryModePageProps {
  isPremium: boolean
  onOpenPricing: () => void
  onOpenTerm?: (entry: Entry) => void
  onSpeak: (id: string, text: string) => void
  speakingId: string | null
  preparingId: string | null
  authToken?: string
}

const FRIENDLY_LOAD_ERROR = 'Dictionary Mode could not load right now. Please try again.'
const ENTRIES_PER_PAGE = 4
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const AMAZON_BOOK_URL = 'https://www.amazon.com/Executive-Insight-Compendium-Supply-Management-ebook/dp/B0FQVFQVFM?ref_=ast_author_dp'
const FEATURED_ENTRIES: Entry[] = [
  {
    id: 'featured-bullwhip-effect',
    term: 'Bullwhip Effect',
    definition: 'The phenomenon where small changes in consumer demand cause increasingly larger fluctuations in orders as you move up the supply chain.',
  },
  {
    id: 'featured-buffer-inventory',
    term: 'Buffer Inventory',
    definition: 'Extra inventory held in the supply chain to hedge against variability in demand or supply.',
  },
  {
    id: 'featured-canonical-data',
    term: 'Canonical Data',
    definition: 'A single, trusted version of master data that is agreed upon across the organization and supply chain partners.',
  },
  {
    id: 'featured-cash-to-cash-cycle',
    term: 'Cash-to-Cash Cycle',
    definition: 'The total time it takes to convert cash invested in inventory into cash received from customer payments.',
  },
  {
    id: 'featured-demand-forecasting',
    term: 'Demand Forecasting',
    definition: 'The process of estimating future customer demand for products or services using historical data, market analysis, and statistical models.',
  },
  {
    id: 'featured-demand-sensing',
    term: 'Demand Sensing',
    definition: 'Real-time identification of changes in customer demand patterns to enable faster, more accurate response.',
  },
  {
    id: 'featured-digital-twin',
    term: 'Digital Twin',
    definition: 'A virtual representation of a physical supply chain or its components used to simulate, analyze, and optimize performance.',
  },
  {
    id: 'featured-distributed-inventory',
    term: 'Distributed Inventory',
    definition: 'Inventory that is positioned across multiple locations in the supply chain to improve availability and reduce lead time.',
  },
]

const getSection = (term: string) => {
  const first = term.trim()[0]?.toUpperCase() || '#'
  return /^[A-Z]$/.test(first) ? first : '#'
}

const normalizeEntry = (row: any): Entry => {
  const entry = {
    id: row.id ? String(row.id) : undefined,
    term: cleanReplacementChars(String(row.term || row.Term || '')).trim(),
    definition: cleanReplacementChars(String(row.definition || row.Definition || '')).trim(),
    synonyms: cleanReplacementChars(String(row.synonyms || row.Synonyms || '')),
    tags: cleanReplacementChars(String(row.tags || row.Tags || '')),
    pos: cleanReplacementChars(String(row.pos || row.Pos || '')),
    pronunciation: cleanReplacementChars(String(row.pronunciation || row.Pronunciation || '')),
    examples: cleanReplacementChars(String(row.examples || row.Examples || '')),
  }
  return { ...entry, tags: getEntryTags(entry).join(', ') }
}

const DictionaryLoader = ({ count }: { count: number }) => (
  <div
    className="dictionary-loader"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '90px 24px',
      gap: 16,
      color: 'var(--text-sub)',
      fontSize: 14,
      fontWeight: 600,
    }}
  >
    <img
      src="/logo2.png"
      alt="SCMpedia"
      style={{
        width: 52,
        height: 52,
        objectFit: 'contain',
        animation: 'pulse-opacity 1.2s ease infinite',
      }}
    />
    <div>Loading dictionary{count ? ` (${count.toLocaleString()} terms)` : ''}...</div>
  </div>
)

const EntryRow = ({
  entry,
  speaking,
  preparing,
  onSpeak,
  onOpenTerm,
}: {
  entry: Entry
  speaking: boolean
  preparing: boolean
  onSpeak: (entry: Entry) => void
  onOpenTerm?: (entry: Entry) => void
}) => (
  <article className="dictionary-entry">
    <div className="dictionary-entry-heading">
      <button
        className="dictionary-entry-title"
        onClick={() => onOpenTerm?.(entry)}
        disabled={!onOpenTerm}
      >
        {entry.term}
      </button>
      <button
        className={`dictionary-sound-button ${speaking ? 'is-speaking' : ''} ${preparing ? 'is-preparing' : ''}`}
        onClick={() => onSpeak(entry)}
        aria-label={preparing ? `Loading voice for ${entry.term}` : `Read ${entry.term}`}
        title={preparing ? 'Loading voice...' : `Read ${entry.term}`}
      >
        {preparing ? <span className="dict-spin" /> : <Volume2 size={14} />}
      </button>
    </div>
    <p>{entry.definition}</p>
  </article>
)

const DictionaryPagePanel = ({
  entries,
  pageNumber,
  speakingId,
  preparingId,
  onSpeak,
  onOpenTerm,
}: {
  entries: Entry[]
  pageNumber: number
  speakingId: string
  preparingId: string
  onSpeak: (entry: Entry) => void
  onOpenTerm?: (entry: Entry) => void
}) => (
  <section className="dictionary-paper" aria-label={`Dictionary page ${pageNumber}`}>
    <div className="dictionary-paper-content">
      {entries.length ? (
        entries.map((entry) => (
          <EntryRow
            key={getEntryId(entry)}
            entry={entry}
            speaking={speakingId === getEntryId(entry)}
            preparing={preparingId === getEntryId(entry)}
            onSpeak={onSpeak}
            onOpenTerm={onOpenTerm}
          />
        ))
      ) : (
        <div className="dictionary-empty-page">No terms on this page.</div>
      )}
    </div>
    <div className="dictionary-page-number">{pageNumber}</div>
  </section>
)

export const DictionaryModePage: React.FC<DictionaryModePageProps> = ({ isPremium, onOpenPricing, onOpenTerm, onSpeak, speakingId, preparingId, authToken }) => {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadedCount, setLoadedCount] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeLetter, setActiveLetter] = useState('All')
  const [spreadIndex, setSpreadIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'book' | 'list' | 'grid'>('book')
  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const dictionaryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError('')
      if (!isPremium) {
        setEntries(FEATURED_ENTRIES)
        setLoadedCount(FEATURED_ENTRIES.length)
        setLoading(false)
        return
      }
      let offset = 0
      let all: Entry[] = []
      let displayedFirstBatch = false
      try {
        while (!cancelled) {
          const res = await fetch(`/api/words?browse=1&limit=400&offset=${offset}`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          })
          if (!res.ok) throw new Error('Dictionary database is not connected.')
          const body = await res.json()
          const next = Array.isArray(body?.words) ? body.words.map(normalizeEntry).filter((entry: Entry) => entry.term && entry.definition) : []
          all = [...all, ...next]
          if (!cancelled) setLoadedCount(all.length)
          if (!cancelled && !displayedFirstBatch && all.length >= 1200) {
            displayedFirstBatch = true
            setEntries(all)
            setLoading(false)
          }
          if (!next.length || next.length < 400) break
          offset = Number(body?.nextOffset || offset + next.length)
        }
        if (!cancelled) {
          setEntries(all)
          setLoadError(all.length ? '' : FRIENDLY_LOAD_ERROR)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setEntries(all)
          setLoadError(all.length ? '' : FRIENDLY_LOAD_ERROR)
          setLoading(false)
        }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [authToken, isPremium])

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === dictionaryRef.current)
    document.addEventListener('fullscreenchange', updateFullscreen)
    return () => document.removeEventListener('fullscreenchange', updateFullscreen)
  }, [])

  const sortedEntries = useMemo(
    () => {
      const featuredTerms = new Set(FEATURED_ENTRIES.map((entry) => entry.term.toLowerCase()))
      const cleaned = [...entries]
        .filter((entry) => /^[A-Za-z]/.test(entry.term) && entry.term.length <= 90)
        .filter((entry) => !featuredTerms.has(entry.term.toLowerCase()))
        .sort((a, b) => a.term.localeCompare(b.term))
      return [...FEATURED_ENTRIES, ...cleaned]
    },
    [entries]
  )

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return sortedEntries.filter((entry) => {
      const matchesLetter = activeLetter === 'All' || getSection(entry.term) === activeLetter
      const matchesQuery = !normalizedQuery
        || entry.term.toLowerCase().includes(normalizedQuery)
        || entry.definition.toLowerCase().includes(normalizedQuery)
      return matchesLetter && matchesQuery
    })
  }, [activeLetter, query, sortedEntries])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / ENTRIES_PER_PAGE))
  const totalSpreads = Math.max(1, Math.ceil(totalPages / 2))
  const safeSpreadIndex = Math.min(spreadIndex, totalSpreads - 1)
  const firstPageIndex = safeSpreadIndex * 2
  const leftEntries = filteredEntries.slice(firstPageIndex * ENTRIES_PER_PAGE, (firstPageIndex + 1) * ENTRIES_PER_PAGE)
  const rightEntries = filteredEntries.slice((firstPageIndex + 1) * ENTRIES_PER_PAGE, (firstPageIndex + 2) * ENTRIES_PER_PAGE)
  const visibleEntries = [...leftEntries, ...rightEntries]
  const pageLabel = totalPages === 1
    ? 'Page 1'
    : `Page ${firstPageIndex + 1}-${Math.min(firstPageIndex + 2, totalPages)}`

  useEffect(() => {
    setSpreadIndex(0)
  }, [activeLetter, query])

  useEffect(() => {
    if (spreadIndex > totalSpreads - 1) setSpreadIndex(totalSpreads - 1)
  }, [spreadIndex, totalSpreads])

  const jumpToLetter = useCallback((letter: string) => {
    setQuery('')
    setSearchOpen(false)
    setActiveLetter(letter)
    setSpreadIndex(0)
  }, [])

  const nextSpread = () => setSpreadIndex((page) => Math.min(page + 1, totalSpreads - 1))
  const previousSpread = () => setSpreadIndex((page) => Math.max(page - 1, 0))

  const speakEntry = (entry: Entry) => {
    onSpeak(getEntryId(entry), `${entry.term}. ${entry.definition}`)
  }

  const toggleFullscreen = async () => {
    const node = dictionaryRef.current
    if (!node) return
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {})
    } else {
      await node.requestFullscreen().catch(() => {})
    }
  }

  if (loading) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: 'calc(100vh - 64px)' }}>
        <DictionaryLoader count={loadedCount} />
      </div>
    )
  }

  return (
    <div ref={dictionaryRef} className="dictionary-mode-page">
      <section className="dictionary-stage">
        <img className="dictionary-brand-mark dictionary-brand-mark-left" src="/logo2.png" alt="" aria-hidden />
        <img className="dictionary-brand-mark dictionary-brand-mark-right" src="/logo2.png" alt="" aria-hidden />
        <div className="dictionary-dotfield dictionary-dotfield-left" aria-hidden />
        <div className="dictionary-dotfield dictionary-dotfield-right" aria-hidden />

        <div className="dictionary-hero">
          <div className="dictionary-premium-pill"><Crown size={14} /> Premium Feature</div>
          <h1><span>Dictionary</span> Mode</h1>
          <p>Browse the complete supply chain dictionary from A to Z.<br />Expand your knowledge with clear definitions and real-world context.</p>
        </div>

        <div className="dictionary-book-cta">
          <img src="/book.jpg" alt="Executive Insight Series supply chain dictionary book cover" />
          <div>
            <strong>Prefer the printed compendium?</strong>
            <span>Order the SCM dictionary book on Amazon.</span>
          </div>
          <a href={AMAZON_BOOK_URL} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
            Buy physical copy <ExternalLink size={14} />
          </a>
        </div>

        <div className="dictionary-alpha-bar">
          <div className={`dictionary-search-box ${searchOpen || query ? 'is-open' : ''}`}>
            <button
              className="dictionary-icon-button"
              onClick={() => setSearchOpen((open) => !open)}
              aria-label="Search dictionary"
              title="Search dictionary"
            >
              <Search size={18} />
            </button>
            {(searchOpen || query) && (
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActiveLetter('All')
                }}
                autoFocus
                placeholder="Search terms..."
                aria-label="Search terms"
              />
            )}
          </div>
          <span className="dictionary-jump-label">Jump to</span>
          <button
            className={`dictionary-letter ${activeLetter === 'All' ? 'is-active' : ''}`}
            onClick={() => jumpToLetter('All')}
          >
            All
          </button>
          {LETTERS.map((letter) => (
            <button
              key={letter}
              className={`dictionary-letter ${activeLetter === letter ? 'is-active' : ''}`}
              onClick={() => jumpToLetter(letter)}
            >
              {letter}
            </button>
          ))}
        </div>

        {!isPremium ? (
          <div className="dictionary-load-error">
            Dictionary Mode is a premium feature. Free users can search 2 words per day from the home page.
          </div>
        ) : loadError ? (
          <div className="dictionary-load-error">{loadError}</div>
        ) : (
          <>
            <>
                <div className="dictionary-book-zone">
                  <button
                    className="dictionary-side-nav dictionary-side-nav-left"
                    onClick={previousSpread}
                    disabled={safeSpreadIndex === 0}
                  >
                    <ChevronLeft size={30} />
                    <span>Previous</span>
                  </button>

                  <div
                    className={`dictionary-spread-shell view-${viewMode}`}
                    style={{ transform: `scale(${zoom})` }}
                  >
                    {viewMode === 'book' ? (
                      <div className="dictionary-spread" data-testid="dictionary-spread">
                        <DictionaryPagePanel
                          entries={leftEntries}
                          pageNumber={firstPageIndex + 1}
                          speakingId={speakingId ?? ''}
                          preparingId={preparingId ?? ''}
                          onSpeak={speakEntry}
                          onOpenTerm={onOpenTerm}
                        />
                        <DictionaryPagePanel
                          entries={rightEntries}
                          pageNumber={Math.min(firstPageIndex + 2, totalPages)}
                          speakingId={speakingId ?? ''}
                          preparingId={preparingId ?? ''}
                          onSpeak={speakEntry}
                          onOpenTerm={onOpenTerm}
                        />
                      </div>
                    ) : (
                      <div className={`dictionary-${viewMode}-view`}>
                        {visibleEntries.length ? (
                          visibleEntries.map((entry) => (
                            <EntryRow
                              key={getEntryId(entry)}
                              entry={entry}
                              speaking={speakingId === getEntryId(entry)}
                              preparing={preparingId === getEntryId(entry)}
                              onSpeak={speakEntry}
                              onOpenTerm={onOpenTerm}
                            />
                          ))
                        ) : (
                          <div className="dictionary-no-results">No dictionary terms match this search.</div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    className="dictionary-side-nav dictionary-side-nav-right"
                    onClick={nextSpread}
                    disabled={safeSpreadIndex >= totalSpreads - 1}
                  >
                    <ChevronRight size={30} />
                    <span>Next</span>
                  </button>
                </div>

                <div className="dictionary-controls">
                  <label className="dictionary-page-select">
                    <BookOpen size={18} />
                    <select
                      value={safeSpreadIndex}
                      onChange={(event) => setSpreadIndex(Number(event.target.value))}
                      aria-label="Select dictionary page spread"
                    >
                      {Array.from({ length: totalSpreads }, (_, index) => {
                        const start = index * 2 + 1
                        const end = Math.min(start + 1, totalPages)
                        return (
                          <option key={index} value={index}>
                            Page {start === end ? start : `${start}-${end}`} of {totalPages}
                          </option>
                        )
                      })}
                    </select>
                    <ChevronDown size={16} />
                  </label>

                  <div className="dictionary-view-toggle" aria-label="Dictionary view mode">
                    <button className={viewMode === 'book' ? 'is-active' : ''} onClick={() => setViewMode('book')} aria-label="Book view"><BookOpen size={18} /></button>
                    <button className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} aria-label="List view"><List size={18} /></button>
                    <button className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => setViewMode('grid')} aria-label="Grid view"><Grid2X2 size={18} /></button>
                  </div>

                  <div className="dictionary-zoom-controls">
                    <button onClick={() => setZoom((value) => Math.min(1.4, Number((value + 0.1).toFixed(2))))} aria-label="Zoom in"><ZoomIn size={17} /></button>
                    <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom level">
                      <option value={0.8}>80%</option>
                      <option value={1}>100%</option>
                      <option value={1.2}>120%</option>
                      <option value={1.4}>140%</option>
                    </select>
                    <button onClick={() => setZoom((value) => Math.max(0.8, Number((value - 0.1).toFixed(2))))} aria-label="Zoom out"><ZoomOut size={17} /></button>
                    <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen dictionary'} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen dictionary'}>
                      <Maximize2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="dictionary-mobile-page-label">
                  {pageLabel} of {totalPages}
                </div>
            </>

          </>
        )}
      </section>

      {!isPremium && (
        <div className="dictionary-premium-banner">
          <div className="container">
            <div className="dictionary-premium-copy">
              <div><Crown size={22} /></div>
              <div>
                <strong>You're viewing Dictionary Mode</strong>
                <p>Go Premium to unlock advanced search, voice reading, contextual examples, and more.</p>
              </div>
            </div>
            <button onClick={onOpenPricing} className="btn btn-premium"><Crown size={15} />Go Premium</button>
          </div>
        </div>
      )}

      <style>{`
        .dictionary-mode-page {
          --dict-stage-bg:
            linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,251,255,0.94) 56%, rgba(255,248,243,0.88)),
            #fff;
          --dict-hero-title: #1d2430;
          --dict-hero-text: #596276;
          --dict-frosted-bg: rgba(255,255,255,0.88);
          --dict-frosted-soft-bg: rgba(255,255,255,0.82);
          --dict-frosted-border: #e4e8ef;
          --dict-control-border: #dfe5ee;
          --dict-control-text: #536075;
          --dict-strong-text: #30394b;
          --dict-search-text: #1d2430;
          --dict-book-bg: #f7f8fb;
          --dict-paper-bg:
            linear-gradient(90deg, rgba(0,0,0,0.035), transparent 9%, transparent 91%, rgba(0,0,0,0.03)),
            #fff;
          --dict-paper-border: #e2e6ee;
          --dict-entry-border: #c8d0dc;
          --dict-entry-text: #30394b;
          --dict-muted: #596276;
          --dict-icon-bg: #fff;
          --dict-icon-border: #dbe2ec;
          --dict-sound-bg: #f1f3f7;
          --dict-sound-text: #20242c;
          --dict-divider: rgba(0,0,0,0.10);
          --dict-dot: rgba(182, 84, 55, 0.28);
          --dict-shadow-soft: rgba(24, 35, 52, 0.08);
          --dict-shadow-control: rgba(24, 35, 52, 0.06);
          --dict-shadow-book: rgba(26, 35, 52, 0.16);
          --dict-shadow-list: rgba(26, 35, 52, 0.13);
          --dict-page-stack-1: rgba(255,255,255,0.86);
          --dict-page-stack-2: rgba(217,222,230,0.7);
          --dict-premium-border: #dceee6;
          --dict-premium-bg: linear-gradient(90deg, rgba(20,174,92,0.10), rgba(20,174,92,0.03));
          background: var(--bg);
          min-height: calc(100vh - 64px);
        }

        :root[data-theme="dark"] .dictionary-mode-page {
          --dict-stage-bg:
            linear-gradient(135deg, rgba(17,20,18,0.97), rgba(20,27,24,0.96) 56%, rgba(31,25,21,0.92)),
            #111412;
          --dict-hero-title: #f4f7f2;
          --dict-hero-text: #b8c0b8;
          --dict-frosted-bg: rgba(23,28,25,0.88);
          --dict-frosted-soft-bg: rgba(23,28,25,0.82);
          --dict-frosted-border: #2b332d;
          --dict-control-border: #2b332d;
          --dict-control-text: #b8c0b8;
          --dict-strong-text: #f4f7f2;
          --dict-search-text: #f4f7f2;
          --dict-book-bg: #161b18;
          --dict-paper-bg:
            linear-gradient(90deg, rgba(0,0,0,0.22), transparent 10%, transparent 90%, rgba(0,0,0,0.18)),
            #171c19;
          --dict-paper-border: #303a33;
          --dict-entry-border: #344039;
          --dict-entry-text: #dce3dc;
          --dict-muted: #aab5ad;
          --dict-icon-bg: #171c19;
          --dict-icon-border: #303a33;
          --dict-sound-bg: #222923;
          --dict-sound-text: #f4f7f2;
          --dict-divider: rgba(255,255,255,0.12);
          --dict-dot: rgba(242, 139, 88, 0.25);
          --dict-shadow-soft: rgba(0,0,0,0.28);
          --dict-shadow-control: rgba(0,0,0,0.22);
          --dict-shadow-book: rgba(0,0,0,0.42);
          --dict-shadow-list: rgba(0,0,0,0.36);
          --dict-page-stack-1: rgba(33,40,35,0.86);
          --dict-page-stack-2: rgba(55,65,58,0.72);
          --dict-premium-border: #2d4b3a;
          --dict-premium-bg: linear-gradient(90deg, rgba(20,174,92,0.14), rgba(20,174,92,0.05));
        }

        .dictionary-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 90px 24px;
          gap: 16px;
          color: var(--text-sub);
          font-size: 14px;
          font-weight: 600;
        }

        .dictionary-loader img {
          width: 52px;
          height: 52px;
          object-fit: contain;
          animation: pulse-opacity 1.2s ease infinite;
        }

        .dictionary-stage {
          position: relative;
          overflow: hidden;
          padding: 18px 24px 24px;
          border-bottom: 1px solid var(--border);
          background: var(--dict-stage-bg);
        }

        .dictionary-hero {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 0 0 20px;
        }

        .dictionary-premium-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 17px;
          border-radius: 999px;
          background: var(--primary-bg);
          color: var(--primary);
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .dictionary-hero h1 {
          font-size: clamp(42px, 5vw, 60px);
          font-weight: 900;
          line-height: 1.02;
          color: var(--dict-hero-title);
          letter-spacing: 0;
        }

        .dictionary-hero h1 span {
          color: var(--primary);
        }

        .dictionary-hero p {
          color: var(--dict-hero-text);
          font-size: 17px;
          line-height: 1.48;
          margin-top: 13px;
        }

        .dictionary-book-cta {
          position: relative;
          z-index: 2;
          width: fit-content;
          max-width: min(720px, 100%);
          margin: 0 auto 18px;
          display: grid;
          grid-template-columns: 54px minmax(0, 1fr) auto;
          align-items: center;
          gap: 14px;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--dict-frosted-bg);
          box-shadow: 0 8px 30px var(--dict-shadow-soft);
          text-align: left;
          backdrop-filter: blur(10px);
        }

        .dictionary-book-cta img {
          width: 54px;
          aspect-ratio: 3 / 4;
          object-fit: cover;
          border-radius: 6px;
          box-shadow: 0 8px 18px rgba(0,0,0,0.14);
        }

        .dictionary-book-cta strong {
          display: block;
          color: var(--text-main);
          font-size: 14px;
          line-height: 1.25;
          margin-bottom: 2px;
        }

        .dictionary-book-cta span {
          display: block;
          color: var(--text-sub);
          font-size: 12px;
          line-height: 1.35;
        }

        .dictionary-brand-mark {
          position: absolute;
          pointer-events: none;
          user-select: none;
          opacity: 0.08;
          filter: saturate(1.15);
        }

        .dictionary-brand-mark-left {
          width: 250px;
          left: 5%;
          top: 24px;
          transform: rotate(-30deg);
        }

        .dictionary-brand-mark-right {
          width: 180px;
          right: 8%;
          top: 62px;
          opacity: 0.035;
          transform: rotate(24deg);
        }

        .dictionary-dotfield {
          position: absolute;
          width: 118px;
          height: 118px;
          pointer-events: none;
          opacity: 0.6;
          background-image: radial-gradient(circle, var(--dict-dot) 1.1px, transparent 1.7px);
          background-size: 11px 11px;
        }

        .dictionary-dotfield-left {
          left: 2%;
          top: 244px;
        }

        .dictionary-dotfield-right {
          right: 6%;
          top: 74px;
        }

        .dictionary-alpha-bar {
          position: relative;
          z-index: 2;
          max-width: 1070px;
          min-height: 58px;
          margin: 0 auto 18px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          overflow-x: auto;
          background: var(--dict-frosted-soft-bg);
          border: 1px solid var(--dict-frosted-border);
          border-radius: 12px;
          box-shadow: 0 8px 30px var(--dict-shadow-soft);
          backdrop-filter: blur(10px);
        }

        .dictionary-search-box {
          display: flex;
          align-items: center;
          flex: 0 0 auto;
          gap: 8px;
        }

        .dictionary-search-box.is-open {
          min-width: min(280px, 62vw);
        }

        .dictionary-search-box input {
          width: 100%;
          min-width: 150px;
          border: none;
          outline: none;
          color: var(--dict-search-text);
          background: transparent;
          font-size: 14px;
        }

        .dictionary-icon-button {
          width: 38px;
          height: 38px;
          border-radius: 9px;
          border: 1px solid var(--dict-icon-border);
          background: var(--dict-icon-bg);
          color: var(--dict-control-text);
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }

        .dictionary-jump-label {
          color: var(--dict-muted);
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          margin-left: 10px;
        }

        .dictionary-letter {
          border: none;
          background: transparent;
          color: var(--dict-muted);
          font-size: 13px;
          font-weight: 800;
          width: 25px;
          height: 32px;
          border-radius: 999px;
          flex: 0 0 auto;
        }

        .dictionary-letter.is-active {
          background: var(--primary-bg);
          color: var(--primary);
        }

        .dictionary-book-zone {
          position: relative;
          z-index: 1;
          width: min(1120px, 100%);
          height: 494px;
          margin: 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0 116px;
        }

        .dictionary-spread-shell {
          transform-origin: center;
          transition: transform 0.18s ease;
        }

        .dictionary-spread {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          width: min(888px, calc(100vw - 310px));
          height: 456px;
          background: var(--dict-book-bg);
          border-radius: 10px;
          box-shadow:
            -16px 0 0 -8px var(--dict-page-stack-1),
            -24px 0 0 -14px var(--dict-page-stack-2),
            16px 0 0 -8px var(--dict-page-stack-1),
            24px 0 0 -14px var(--dict-page-stack-2),
            0 18px 42px var(--dict-shadow-book);
        }

        .dictionary-spread::before {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 1px;
          background: linear-gradient(180deg, transparent, var(--dict-divider), transparent);
          z-index: 3;
        }

        .dictionary-paper {
          position: relative;
          height: 456px;
          min-height: 0;
          display: flex;
          flex-direction: column;
          background: var(--dict-paper-bg);
          border: 1px solid var(--dict-paper-border);
        }

        .dictionary-paper:first-child {
          border-radius: 10px 0 0 10px;
        }

        .dictionary-paper:last-child {
          border-radius: 0 10px 10px 0;
        }

        .dictionary-paper-content {
          flex: 1;
          padding: 30px 44px 18px;
          overflow: hidden;
          min-height: 0;
          display: grid;
          grid-template-rows: repeat(4, minmax(0, 1fr));
        }

        .dictionary-entry {
          padding: 0 0 14px;
          margin-bottom: 14px;
          border-bottom: 1px dashed var(--dict-entry-border);
          min-height: 0;
          overflow: hidden;
        }

        .dictionary-entry:last-child {
          margin-bottom: 0;
        }

        .dictionary-entry-heading {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 7px;
        }

        .dictionary-entry-title {
          border: none;
          background: transparent;
          padding: 0;
          color: var(--primary);
          font-size: 20px;
          line-height: 1.2;
          font-weight: 900;
          text-align: left;
          white-space: normal;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .dictionary-entry-title:disabled {
          opacity: 1;
          cursor: default;
        }

        .dictionary-entry-title:not(:disabled) {
          cursor: pointer;
        }

        .dictionary-entry-title:not(:disabled):hover {
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .dictionary-sound-button {
          width: 32px;
          height: 26px;
          border-radius: 9px;
          border: none;
          background: var(--dict-sound-bg);
          color: var(--dict-sound-text);
          display: inline-grid;
          place-items: center;
          flex: 0 0 auto;
        }

        .dictionary-sound-button.is-speaking {
          color: #fff;
          background: var(--primary);
        }

        .dictionary-sound-button.is-preparing {
          background: var(--dict-sound-bg);
          color: var(--primary);
        }

        .dict-spin {
          display: block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid rgba(182, 84, 55, 0.25);
          border-top-color: var(--primary);
          animation: dict-spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes dict-spin {
          to { transform: rotate(360deg); }
        }

        .dictionary-entry p {
          color: var(--dict-entry-text);
          font-size: 14.5px;
          line-height: 1.55;
          letter-spacing: 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin: 0;
        }

        .dictionary-page-number {
          color: var(--dict-muted);
          font-size: 12px;
          text-align: center;
          padding: 0 0 10px;
        }

        .dictionary-empty-page,
        .dictionary-no-results,
        .dictionary-load-error {
          display: grid;
          place-items: center;
          min-height: 220px;
          color: var(--dict-muted);
          font-size: 14px;
          font-weight: 700;
          text-align: center;
        }

        .dictionary-list-view,
        .dictionary-grid-view {
          width: min(888px, calc(100vw - 310px));
          height: 456px;
          overflow: hidden;
          background: var(--dict-frosted-bg);
          border: 1px solid var(--dict-paper-border);
          border-radius: 10px;
          box-shadow: 0 18px 42px var(--dict-shadow-list);
          padding: 30px 42px;
        }

        .dictionary-grid-view {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0 34px;
        }

        .dictionary-mode-page:fullscreen {
          overflow: auto;
          background: var(--bg);
        }

        .dictionary-side-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          color: var(--primary);
          display: grid;
          justify-items: center;
          gap: 10px;
          font-size: 15px;
          font-weight: 700;
        }

        .dictionary-side-nav svg {
          width: 62px;
          height: 62px;
          padding: 16px;
          border-radius: 50%;
          background: var(--dict-frosted-bg);
          border: 1px solid var(--dict-frosted-border);
          box-shadow: 0 8px 26px var(--dict-shadow-soft);
        }

        .dictionary-side-nav span {
          color: var(--dict-strong-text);
        }

        .dictionary-side-nav:disabled {
          opacity: 0.38;
          cursor: not-allowed;
        }

        .dictionary-side-nav-left {
          left: 0;
        }

        .dictionary-side-nav-right {
          right: 0;
        }

        .dictionary-controls {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 18px;
          width: min(980px, 100%);
          margin: 20px auto 0;
        }

        .dictionary-page-select,
        .dictionary-view-toggle,
        .dictionary-zoom-controls {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          min-height: 42px;
          border-radius: 9px;
          border: 1px solid var(--dict-control-border);
          background: var(--dict-frosted-bg);
          color: var(--dict-control-text);
          box-shadow: 0 4px 18px var(--dict-shadow-control);
        }

        .dictionary-page-select {
          gap: 8px;
          padding: 0 12px;
          justify-self: start;
        }

        .dictionary-page-select select,
        .dictionary-zoom-controls select {
          border: none;
          outline: none;
          background: transparent;
          color: var(--dict-strong-text);
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          appearance: none;
        }

        .dictionary-view-toggle {
          overflow: hidden;
          justify-self: center;
        }

        .dictionary-view-toggle button,
        .dictionary-zoom-controls button {
          width: 46px;
          height: 42px;
          display: grid;
          place-items: center;
          border: none;
          border-right: 1px solid var(--dict-control-border);
          background: transparent;
          color: var(--dict-control-text);
        }

        .dictionary-view-toggle button:last-child {
          border-right: none;
          border-left: 1px solid var(--dict-control-border);
        }

        .dictionary-zoom-controls button:nth-last-child(-n+2) {
          border-right: none;
          border-left: 1px solid var(--dict-control-border);
        }

        .dictionary-view-toggle button.is-active {
          color: var(--primary);
          background: var(--primary-bg);
          box-shadow: inset 0 -2px 0 var(--primary);
        }

        .dictionary-zoom-controls {
          justify-self: end;
          overflow: hidden;
        }

        .dictionary-zoom-controls select {
          min-height: 42px;
          padding: 0 13px;
        }

        .dictionary-mobile-page-label {
          display: none;
        }

        .dictionary-premium-banner {
          border-top: 1px solid var(--dict-premium-border);
          border-bottom: 1px solid var(--dict-premium-border);
          background: var(--dict-premium-bg);
          padding: 16px 24px;
        }

        .dictionary-premium-banner .container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .dictionary-premium-copy {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .dictionary-premium-copy > div:first-child {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(20,174,92,0.12);
          color: var(--success-green);
          display: grid;
          place-items: center;
        }

        .dictionary-premium-copy strong {
          color: var(--text-main);
          font-size: 14px;
        }

        .dictionary-premium-copy p {
          color: var(--text-sub);
          font-size: 13px;
        }

        @media (max-width: 1100px) {
          .dictionary-book-zone {
            height: 494px;
            padding: 0 92px;
          }

          .dictionary-spread,
          .dictionary-list-view,
          .dictionary-grid-view {
            width: calc(100vw - 250px);
          }

          .dictionary-paper-content {
            padding: 26px 30px 18px;
          }
        }

        @media (max-width: 760px) {
          .dictionary-stage {
            padding: 20px 14px 22px;
          }

          .dictionary-hero h1 {
            font-size: 38px;
          }

          .dictionary-hero p {
            font-size: 15px;
          }

          .dictionary-alpha-bar {
            padding: 8px;
          }

          .dictionary-book-cta {
            grid-template-columns: 44px minmax(0, 1fr);
            width: 100%;
          }

          .dictionary-book-cta img {
            width: 44px;
          }

          .dictionary-book-cta a {
            grid-column: 1 / -1;
            width: 100%;
          }

          .dictionary-book-zone {
            height: 526px;
            padding: 0 0 70px;
            align-items: stretch;
          }

          .dictionary-spread,
          .dictionary-grid-view {
            grid-template-columns: 1fr;
          }

          .dictionary-spread,
          .dictionary-list-view,
          .dictionary-grid-view {
            width: calc(100vw - 28px);
            height: 456px;
          }

          .dictionary-spread::before,
          .dictionary-paper:last-child {
            display: none;
          }

          .dictionary-paper:first-child {
            border-radius: 10px;
          }

          .dictionary-side-nav {
            top: auto;
            bottom: 0;
            transform: none;
          }

          .dictionary-side-nav svg {
            width: 50px;
            height: 50px;
            padding: 13px;
          }

          .dictionary-side-nav-left {
            left: 26px;
          }

          .dictionary-side-nav-right {
            right: 26px;
          }

          .dictionary-controls {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 10px;
          }

          .dictionary-page-select {
            order: 3;
          }

          .dictionary-zoom-controls {
            display: none;
          }

          .dictionary-mobile-page-label {
            display: block;
            text-align: center;
            color: var(--dict-muted);
            font-size: 13px;
            font-weight: 700;
            margin-top: 10px;
          }
        }
      `}</style>
    </div>
  )
}
