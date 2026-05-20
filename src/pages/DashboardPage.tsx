import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, BookOpen, Star, Settings, Crown,
  TrendingUp, Search, Heart, Clock, ChevronRight,
  Zap, Trash2
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Entry } from '../types'
import {
  formatRelativeTime,
  getEntryTags,
  readDashboardHistory,
  recordDashboardSearch,
  writeDashboardHistory,
  type DashboardHistoryItem,
} from '../utils'

interface DashboardPageProps {
  user: User | null
  isPremium: boolean
  favorites: Entry[]
  favoritesLoading: boolean
  onToggleFavorite: (entry: Entry) => void
  onOpenPricing: () => void
  onSearch: (term: string) => void
}

const NAV_ITEMS = [
  { icon: Home, label: 'Overview', to: '/dashboard' },
  { icon: Search, label: 'Search History', to: '/dashboard/history' },
  { icon: Star, label: 'Favorites', to: '/dashboard/favorites' },
  { icon: Settings, label: 'Settings', to: '/settings' },
]

function SidebarNav({ isPremium, onOpenPricing }: { isPremium: boolean; onOpenPricing: () => void }) {
  const location = useLocation()
  const isActive = (to: string) => location.pathname === to

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        background: 'var(--bg)',
        minHeight: 'calc(100vh - 64px)',
        position: 'sticky',
        top: 64,
      }}
      className="hide-mobile"
    >
      <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isActive(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--primary)' : 'var(--text-main)',
                background: active ? 'var(--primary-bg)' : 'transparent',
                marginBottom: 2,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface)' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </div>

      {!isPremium && (
        <div style={{ margin: '8px 16px 0', padding: 16, background: 'var(--premium-green)', borderRadius: 12 }}>
          <Crown size={18} color="#ffd700" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Go Premium</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: 12 }}>
            Unlock unlimited searches, voice, images & more.
          </div>
          <button
            onClick={onOpenPricing}
            style={{
              width: '100%',
              padding: '8px 0',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Upgrade →
          </button>
        </div>
      )}
    </aside>
  )
}

function MobileDashboardNav() {
  const location = useLocation()
  const isActive = (to: string) => location.pathname === to

  return (
    <nav className="dashboard-mobile-nav">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = isActive(item.to)
        return (
          <Link key={item.to} to={item.to} className={active ? 'active' : ''}>
            <Icon size={15} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function OverviewTab({ user, isPremium, favorites, favoritesLoading, history, onSearch }: {
  user: User | null
  isPremium: boolean
  favorites: Entry[]
  favoritesLoading: boolean
  history: DashboardHistoryItem[]
  onSearch: (term: string) => void
}) {
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'
  const [favoriteSearch, setFavoriteSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const categories = useMemo(() => {
    const tags = favorites.flatMap(getEntryTags)
    return ['All', ...Array.from(new Set(tags)).sort()]
  }, [favorites])
  const shownFavorites = favorites.filter((entry) => {
    const matchesSearch = !favoriteSearch.trim()
      || entry.term.toLowerCase().includes(favoriteSearch.trim().toLowerCase())
      || entry.definition.toLowerCase().includes(favoriteSearch.trim().toLowerCase())
    const matchesCategory = activeCategory === 'All' || getEntryTags(entry).includes(activeCategory)
    return matchesSearch && matchesCategory
  })
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const stats = [
    { icon: Star, label: 'Saved Terms', value: favorites.length.toString(), sub: `${categories.length - 1} saved ${categories.length - 1 === 1 ? 'category' : 'categories'}`, color: 'var(--primary)' },
    { icon: Search, label: 'Recent Searches', value: history.length.toString(), sub: 'Stored on this device', color: 'var(--success-green)' },
    { icon: TrendingUp, label: 'Searches Today', value: history.filter((item) => item.at >= todayStart.getTime()).length.toString(), sub: 'From dashboard actions', color: '#3b82f6' },
    { icon: Crown, label: 'Current Plan', value: isPremium ? 'Premium' : 'Free', sub: isPremium ? 'Full access enabled' : 'Upgrade available', color: '#f97316' },
  ]

  return (
    <div className="dashboard-layout">
      <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-main)', marginBottom: 8 }}>
            Welcome back, <span style={{ color: 'var(--primary)' }}>{displayName}</span>!
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 15 }}>Here are the supply chain terms you've saved and your recent activity.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }} className="stats-grid">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="card" style={{ padding: 22, display: 'grid', gridTemplateColumns: '52px 1fr', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: stat.color + '18', display: 'grid', placeItems: 'center' }}>
                  <Icon size={22} color={stat.color} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{stat.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-main)' }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>{stat.sub}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ color: 'var(--text-main)', fontSize: 19, fontWeight: 900, marginBottom: 2 }}>Saved Terms</h2>
              <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>Your favorite supply chain terms for quick access and reference.</p>
            </div>
            <div className="dashboard-filter-row">
              <select
                value={activeCategory}
                onChange={(event) => setActiveCategory(event.target.value)}
                aria-label="Filter saved terms by category"
              >
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <label>
                <Search size={14} />
                <input
                  value={favoriteSearch}
                  onChange={(event) => setFavoriteSearch(event.target.value)}
                  placeholder="Search saved terms..."
                />
              </label>
            </div>
          </div>

          {favoritesLoading ? (
            <div style={{ padding: '44px 18px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-sub)', fontSize: 14 }}>
              Loading saved terms...
            </div>
          ) : favorites.length === 0 ? (
            <div style={{ padding: '44px 18px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
              <Heart size={30} color="var(--border)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>No saved terms yet</div>
              <p style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 14 }}>Search for a term and use the star button to save it here.</p>
              <button onClick={() => onSearch('Supply Chain Management')} className="btn btn-primary btn-sm">Start searching</button>
            </div>
          ) : shownFavorites.length === 0 ? (
            <div style={{ padding: '36px 18px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-sub)', fontSize: 14 }}>
              No saved terms match the current filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }} className="favorites-grid">
              {shownFavorites.slice(0, 6).map((entry) => (
                <div key={entry.id || entry.term} className="card" style={{ padding: 16, boxShadow: 'none' }}>
                  <Star size={16} color="var(--primary)" fill="var(--primary)" style={{ marginBottom: 10 }} />
                  <h3 style={{ color: 'var(--text-main)', fontSize: 16, fontWeight: 900, marginBottom: 8 }}>{entry.term}</h3>
                  <p style={{ color: 'var(--text-sub)', fontSize: 13, lineHeight: 1.55, minHeight: 82 }}>{entry.definition}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
                    {getEntryTags(entry).slice(0, 3).map((tag) => <span key={tag} className="tag" style={{ fontSize: 11 }}>{tag}</span>)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => onSearch(entry.term)} className="btn btn-outline btn-sm"><BookOpen size={13} />Open</button>
                    <button onClick={() => onSearch(entry.term)} className="btn btn-outline btn-sm"><Zap size={13} />AI Insight</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {favorites.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <Link to="/dashboard/favorites" className="btn btn-outline btn-sm">View all saved terms <ChevronRight size={14} /></Link>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 24, display: 'grid', gridTemplateColumns: '74px 1fr auto', gap: 18, alignItems: 'center', background: 'linear-gradient(135deg, rgba(59,130,246,0.08), transparent)' }}>
          <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgba(59,130,246,0.14)', color: '#3b82f6', display: 'grid', placeItems: 'center' }}><Zap size={26} /></div>
          <div>
            <h3 style={{ color: 'var(--text-main)', fontSize: 17, fontWeight: 900 }}>Get deeper insights with AI</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>Ask follow-up questions, compare concepts, and get personalized explanations for your saved terms.</p>
          </div>
          <button onClick={() => onSearch(favorites[0]?.term || 'Supply Chain Management')} className="btn btn-outline">Ask AI About Saved Terms <ChevronRight size={15} /></button>
        </div>
      </div>

      <aside className="dashboard-rail">
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ color: 'var(--text-main)', fontSize: 17, fontWeight: 900, marginBottom: 20 }}>Account Summary</h3>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(20,174,92,0.15)', color: 'var(--success-green)', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 900 }}>{displayName.slice(0, 2).toUpperCase()}</div>
            <div>
              <strong style={{ color: 'var(--text-main)' }}>{displayName}</strong>
              <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>{user?.email}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, color: 'var(--text-sub)', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
            <span>Member since<br /><strong style={{ color: 'var(--text-main)' }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'Today'}</strong></span>
            <span>Plan<br /><strong style={{ color: 'var(--success-green)' }}>{isPremium ? 'Premium' : 'Free'}</strong></span>
          </div>
          <Link to="/settings" className="btn btn-outline" style={{ width: '100%' }}>Manage Account <ChevronRight size={15} /></Link>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ color: 'var(--text-main)', fontSize: 17, fontWeight: 900, marginBottom: 14 }}>Recent Activity</h3>
          {history.length || favorites.length ? (
            <>
              {history.slice(0, 3).map((item) => (
                <button
                  key={`search-${item.term}-${item.at}`}
                  onClick={() => onSearch(item.term)}
                  style={{ display: 'flex', gap: 12, marginBottom: 14, width: '100%', border: 0, background: 'transparent', textAlign: 'left', padding: 0 }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Search size={15} /></div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)' }}><strong style={{ display: 'block', color: 'var(--text-main)' }}>Searched {item.term}</strong>{formatRelativeTime(item.at)}</div>
                </button>
              ))}
              {favorites.slice(0, Math.max(0, 5 - Math.min(history.length, 3))).map((entry) => (
                <button
                  key={`saved-${entry.id || entry.term}`}
                  onClick={() => onSearch(entry.term)}
                  style={{ display: 'flex', gap: 12, marginBottom: 14, width: '100%', border: 0, background: 'transparent', textAlign: 'left', padding: 0 }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(182,84,55,0.12)', color: 'var(--primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Star size={15} /></div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)' }}><strong style={{ display: 'block', color: 'var(--text-main)' }}>Saved {entry.term}</strong>Open saved term</div>
                </button>
              ))}
            </>
          ) : (
            <div style={{ color: 'var(--text-sub)', fontSize: 13, lineHeight: 1.5 }}>Your searches and saved terms will appear here as you use SCMpedia.</div>
          )}
        </div>

        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ color: 'var(--text-main)', fontSize: 17, fontWeight: 900, marginBottom: 14 }}>Search History</h3>
          {history.length ? history.slice(0, 5).map((item) => (
            <button key={`${item.term}-${item.at}`} onClick={() => onSearch(item.term)} style={{ display: 'flex', gap: 10, alignItems: 'center', border: 'none', background: 'transparent', color: 'var(--text-sub)', padding: '8px 0', width: '100%', textAlign: 'left' }}><Search size={14} />{item.term}</button>
          )) : (
            <div style={{ color: 'var(--text-sub)', fontSize: 13, lineHeight: 1.5 }}>No recent searches yet.</div>
          )}
        </div>
      </aside>
    </div>
  )
}

function FavoritesTab({ favorites, favoritesLoading, onSearch, onToggleFavorite }: {
  favorites: Entry[]
  favoritesLoading: boolean
  onSearch: (term: string) => void
  onToggleFavorite: (entry: Entry) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = favorites.filter((e) => e.term.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>Saved Terms</h2>
          <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: 0 }}>{favorites.length} term{favorites.length !== 1 ? 's' : ''} saved</p>
        </div>
      </div>

      {favorites.length > 4 && (
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Search size={15} color="var(--text-sub)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter saved terms…"
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-main)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {favoritesLoading ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-sub)', fontSize: 14 }}>
          Loading saved terms...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12 }}>
          <Heart size={32} color="var(--border)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 6 }}>
            {search ? 'No matches found' : 'No saved terms yet'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>
            {search ? 'Try a different search.' : 'Search a term and click the star icon to save it.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((entry) => (
            <div
              key={entry.id || entry.term}
              style={{
                padding: '16px 20px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>{entry.term}</div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-sub)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: 1.5,
                  }}
                >
                  {entry.definition}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => onSearch(entry.term)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 7,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-main)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  View
                </button>
                <button
                  onClick={() => onToggleFavorite(entry)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 7,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--error)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Remove from favorites"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryTab({ history, onSearch, onClearHistory }: {
  history: DashboardHistoryItem[]
  onSearch: (term: string) => void
  onClearHistory: () => void
}) {
  return (
    <div>
      <div className="dashboard-section-heading">
        <div>
          <h2>Search History</h2>
          <p>{history.length} recent search{history.length === 1 ? '' : 'es'} stored on this device</p>
        </div>
        {history.length > 0 && (
          <button onClick={onClearHistory} className="btn btn-outline btn-sm"><Trash2 size={14} />Clear history</button>
        )}
      </div>

      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', border: '1px dashed var(--border)', borderRadius: 12 }}>
          <Clock size={40} color="var(--border)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 8 }}>No search history yet</h3>
          <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 16 }}>Search from your dashboard to build a quick access history.</p>
          <button onClick={() => onSearch('Supply Chain Management')} className="btn btn-primary btn-sm">Start a search</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {history.map((item) => (
            <button
              key={`${item.term}-${item.at}`}
              onClick={() => onSearch(item.term)}
              className="dashboard-history-row"
            >
              <span><Search size={15} />{item.term}</span>
              <small>{formatRelativeTime(item.at)}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  isPremium,
  favorites,
  favoritesLoading,
  onToggleFavorite,
  onOpenPricing,
  onSearch,
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [history, setHistory] = useState<DashboardHistoryItem[]>(() => readDashboardHistory())

  useEffect(() => {
    const refreshHistory = () => setHistory(readDashboardHistory())
    window.addEventListener('focus', refreshHistory)
    window.addEventListener('storage', refreshHistory)
    return () => {
      window.removeEventListener('focus', refreshHistory)
      window.removeEventListener('storage', refreshHistory)
    }
  }, [])

  const tab = location.pathname.includes('favorites')
    ? 'favorites'
    : location.pathname.includes('history')
    ? 'history'
    : 'overview'

  const runSearch = (term: string) => {
    const cleanTerm = term.trim()
    if (!cleanTerm) return
    const next = recordDashboardSearch(cleanTerm)
    setHistory(next)
    onSearch(cleanTerm)
    navigate('/')
  }

  const clearHistory = () => {
    setHistory([])
    writeDashboardHistory([])
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', padding: 20, overflow: 'hidden' }}>
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 420 }}>
          <h2 style={{ fontSize: 'clamp(20px, 6vw, 22px)', fontWeight: 700, color: 'var(--text-main)', margin: '0 auto 8px', lineHeight: 1.2, maxWidth: 280 }}>
            Sign in to view<br />your dashboard
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 20 }}>Track favorites, history, and more.</p>
          <Link to="/auth" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-shell">
      <SidebarNav isPremium={isPremium} onOpenPricing={onOpenPricing} />

      <main style={{ flex: 1, padding: '32px 36px', minWidth: 0 }} className="dashboard-main">
        <MobileDashboardNav />
        {tab === 'overview' && (
          <OverviewTab
            user={user}
            isPremium={isPremium}
            favorites={favorites}
            favoritesLoading={favoritesLoading}
            history={history}
            onSearch={runSearch}
          />
        )}
        {tab === 'favorites' && (
          <FavoritesTab
            favorites={favorites}
            favoritesLoading={favoritesLoading}
            onSearch={runSearch}
            onToggleFavorite={onToggleFavorite}
          />
        )}
        {tab === 'history' && <HistoryTab history={history} onSearch={runSearch} onClearHistory={clearHistory} />}
      </main>

      <style>{`
        .dashboard-shell {
          display: flex;
          min-width: 0;
          background: var(--bg);
        }

        .dashboard-mobile-nav {
          display: none;
        }

        .dashboard-filter-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .dashboard-filter-row select,
        .dashboard-filter-row label {
          min-height: 36px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text-main);
          font-size: 13px;
          font-weight: 600;
        }

        .dashboard-filter-row select {
          padding: 0 12px;
          max-width: 180px;
        }

        .dashboard-filter-row label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
        }

        .dashboard-filter-row input {
          width: 190px;
          border: none;
          outline: none;
          background: transparent;
          color: var(--text-main);
          font: inherit;
          font-weight: 500;
        }

        .dashboard-section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .dashboard-section-heading h2 {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-main);
          margin: 0 0 4px;
        }

        .dashboard-section-heading p {
          font-size: 13px;
          color: var(--text-sub);
          margin: 0;
        }

        .dashboard-history-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-main);
          text-align: left;
        }

        .dashboard-history-row span {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          font-weight: 700;
        }

        .dashboard-history-row small {
          color: var(--text-sub);
          white-space: nowrap;
        }

        @media (max-width: 1100px) {
          .dashboard-main { padding: 24px !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .favorites-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }

        @media (max-width: 820px) {
          .dashboard-shell { display: block; }
          .dashboard-shell > aside.hide-mobile { display: none !important; }
          .dashboard-main { padding: 16px !important; }
          .dashboard-mobile-nav {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding: 0 0 14px;
            margin-bottom: 18px;
            -webkit-overflow-scrolling: touch;
          }
          .dashboard-mobile-nav a {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            flex: 0 0 auto;
            padding: 9px 12px;
            border-radius: 999px;
            border: 1px solid var(--border);
            background: var(--surface);
            color: var(--text-main);
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
          }
          .dashboard-mobile-nav a.active {
            color: var(--primary);
            background: var(--primary-bg);
            border-color: rgba(182,84,55,0.25);
          }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .favorites-grid { grid-template-columns: 1fr !important; }
          .actions-grid { grid-template-columns: 1fr !important; }
          .dashboard-filter-row,
          .dashboard-filter-row label,
          .dashboard-filter-row input,
          .dashboard-filter-row select {
            width: 100%;
            max-width: none;
          }
          .dashboard-layout {
            grid-template-columns: 1fr !important;
          }
          .dashboard-rail {
            display: grid;
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .stats-grid { grid-template-columns: 1fr !important; }
          .dashboard-history-row {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}
