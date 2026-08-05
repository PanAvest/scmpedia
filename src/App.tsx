import React, { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AppHeader } from './components/AppHeader'
import { AppFooter } from './components/AppFooter'
import { HomePage } from './pages/HomePage'
import { AuthPage } from './pages/AuthPage'
import { PricingPage } from './pages/PricingPage'
import { DashboardPage } from './pages/DashboardPage'
import { AboutPage } from './pages/AboutPage'
import { SettingsPage } from './pages/SettingsPage'
import { DictionaryModePage } from './pages/DictionaryModePage'
import { TermPage } from './pages/TermPage'
import { LegalPage } from './pages/LegalPage'
import type { ResourcePageProps } from './pages/ResourcePages'
import { isEmailConfirmCallback } from './supabase'
import { useAuth } from './hooks/useAuth'
import { useData } from './hooks/useData'
import { useTTS } from './hooks/useTTS'
import { useAI } from './hooks/useAI'
import { useFavorites } from './hooks/useFavorites'
import { useSubscription } from './hooks/useSubscription'
import { AUTO_READ_AI_KEY, DICTIONARY_MODE_KEY, THEME_KEY, recordDashboardSearch, termToSlug } from './utils'
import type { SubscriptionPlan } from './types'
import type { Entry } from './types'
import { CurrencyProvider } from './components/currency/CurrencyProvider'
import './styles/globals.css'

const ResourcePage = lazy(() => import('./pages/ResourcePages').then((module) => ({ default: module.ResourcePage })))

const ResourcePageLoading = () => (
  <div style={{ minHeight: '100vh', background: 'var(--bg)' }} aria-label="Loading resource page" aria-busy="true">
    <section style={{ padding: '54px 24px 48px', background: 'var(--home-hero-bg)', borderBottom: '1px solid var(--border)' }}>
      <div className="container">
        <div className="skeleton" style={{ width: 130, height: 15, marginBottom: 18 }} />
        <div className="skeleton" style={{ width: 'min(680px, 88%)', height: 42, marginBottom: 14 }} />
        <div className="skeleton" style={{ width: 'min(740px, 100%)', height: 15, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 'min(560px, 78%)', height: 15 }} />
      </div>
    </section>
    <section style={{ padding: '48px 24px' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="card" style={{ padding: 22, minHeight: 170 }}>
            <div className="skeleton" style={{ width: 42, height: 42, marginBottom: 16 }} />
            <div className="skeleton" style={{ width: '52%', height: 17, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: '100%', height: 12, marginBottom: 7 }} />
            <div className="skeleton" style={{ width: '76%', height: 12 }} />
          </div>
        ))}
      </div>
    </section>
  </div>
)

const ResourceRoute: React.FC<ResourcePageProps> = (props) => (
  <Suspense fallback={<ResourcePageLoading />}>
    <ResourcePage {...props} />
  </Suspense>
)

function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAuthRoute = location.pathname.startsWith('/auth')

  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored) return stored === 'dark'
    return false
  })
  const [autoReadAi, setAutoReadAi] = useState(() => {
    const migratedKey = 'scmpedia-auto-read-default-off-v1'
    if (localStorage.getItem(migratedKey) !== 'true') {
      localStorage.setItem(migratedKey, 'true')
      localStorage.setItem(AUTO_READ_AI_KEY, 'false')
      return false
    }
    return localStorage.getItem(AUTO_READ_AI_KEY) === 'true'
  })
  const [dictionaryMode, setDictionaryMode] = useState(() => localStorage.getItem(DICTIONARY_MODE_KEY) === 'true')
  // Clicking the link in the confirmation email also signs the user in, so the /auth guard below
  // would bounce them straight to the homepage — the exact thing the confirmation is meant to avoid.
  // Seeded once from the landing URL, before any auth state exists, so it cannot lose that race.
  const [confirmingEmail] = useState(isEmailConfirmCallback)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [pendingSearch, setPendingSearch] = useState('')
  const [homeChatMode, setHomeChatMode] = useState(false)
  const [homeResetNonce, setHomeResetNonce] = useState(0)

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem(AUTO_READ_AI_KEY, autoReadAi ? 'true' : 'false')
  }, [autoReadAi])

  useEffect(() => {
    localStorage.setItem(DICTIONARY_MODE_KEY, dictionaryMode ? 'true' : 'false')
  }, [dictionaryMode])

  const auth = useAuth()
  const dataHook = useData(auth.session?.access_token)
  const tts = useTTS(auth.session?.access_token)
  const ai = useAI(auth.session?.access_token)
  const subscription = useSubscription(auth)
  const favorites = useFavorites(auth.user, dataHook.data)

  const isPremium = subscription.isPremium

  // Dark mode is a premium feature — force free users back to light once auth has settled
  // (covers a persisted setting or a premium user who downgrades). Waiting on auth.loading
  // avoids flipping a real subscriber to light for a frame while their session restores.
  useEffect(() => {
    if (!auth.loading && !isPremium && darkMode) setDarkMode(false)
  }, [auth.loading, isPremium, darkMode])

  const handleOpenTermFromDict = (entry: Entry) => navigate(`/term/${termToSlug(entry.term)}`, { state: { from: 'dictionary' } })
  const handleOpenTermFromChat = (entry: Entry) => navigate(`/term/${termToSlug(entry.term)}`, { state: { from: 'chat' } })
  const handleSignIn = () => navigate('/auth')
  const handleSignOut = async () => {
    await auth.signOut()
    window.location.replace('/')
  }
  const handleOpenPricing = () => {
    setPricingOpen(true)
  }
  const handleLogoClick = () => {
    setHomeResetNonce((value) => value + 1)
    navigate('/')
  }

  const handleSearch = (term: string) => {
    recordDashboardSearch(term)
    setPendingSearch(term)
    navigate('/')
  }

  const handleSubscribe = (plan: string) => {
    void subscription.subscribe(plan as SubscriptionPlan)
  }

  // Pricing dialog (modal overlay on top of any page)
  const PricingModal = pricingOpen ? (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setPricingOpen(false) }}
    >
      <div
        style={{
          background: 'var(--bg)',
          borderRadius: 20,
          width: '100%',
          maxWidth: 960,
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <button
          onClick={() => setPricingOpen(false)}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            cursor: 'pointer',
            fontSize: 16,
            color: 'var(--text-sub)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          ✕
        </button>
        <PricingPage
          isPremium={isPremium}
          onSubscribe={handleSubscribe}
          onSignIn={handleSignIn}
          user={auth.user}
          checkingOut={subscription.checkingOut}
          error={subscription.error}
        />
      </div>
    </div>
  ) : null

  return (
    <>
      {!isAuthRoute && (
        <AppHeader
          user={auth.user}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          isPremium={isPremium}
          authLoading={auth.loading}
          preferDictionaryMode={dictionaryMode}
          onLogoClick={handleLogoClick}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onOpenPricing={handleOpenPricing}
        />
      )}

      <main key={location.pathname} className="route-transition-shell">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                dataHook={dataHook}
                tts={tts}
                ai={ai}
                user={auth.user}
                favorites={favorites}
                subscription={subscription}
                onOpenAuth={handleSignIn}
                onOpenPricing={handleOpenPricing}
                pendingSearch={pendingSearch}
                onPendingSearchConsumed={() => setPendingSearch('')}
                autoReadAi={autoReadAi}
                resetNonce={homeResetNonce}
                onChatModeChange={setHomeChatMode}
                onOpenTermPage={handleOpenTermFromChat}
                authToken={auth.session?.access_token}
              />
            }
          />

          <Route
            path="/auth"
            element={
              auth.user && !confirmingEmail
                ? <Navigate to="/" replace />
                : <AuthPage onSuccess={() => navigate('/')} />
            }
          />
          <Route path="/auth/reset" element={<AuthPage />} />

          <Route
            path="/pricing"
            element={
              <PricingPage
                isPremium={isPremium}
                onSubscribe={handleSubscribe}
                onSignIn={handleSignIn}
                user={auth.user}
                checkingOut={subscription.checkingOut}
                error={subscription.error}
              />
            }
          />

          <Route
          path="/dashboard"
          element={
            <DashboardPage
              user={auth.user}
              isPremium={isPremium}
              favorites={favorites.favoriteEntries}
              favoritesLoading={favorites.loading}
              onToggleFavorite={(entry) => void favorites.toggleFavorite(entry)}
              onOpenPricing={handleOpenPricing}
              onSearch={handleSearch}
              onStudentDetailsUpdated={() => void auth.refreshUser()}
            />
          }
          />
          <Route
          path="/dashboard/favorites"
          element={
            <DashboardPage
              user={auth.user}
              isPremium={isPremium}
              favorites={favorites.favoriteEntries}
              favoritesLoading={favorites.loading}
              onToggleFavorite={(entry) => void favorites.toggleFavorite(entry)}
              onOpenPricing={handleOpenPricing}
              onSearch={handleSearch}
              onStudentDetailsUpdated={() => void auth.refreshUser()}
            />
          }
          />
          <Route
          path="/dashboard/history"
          element={
            <DashboardPage
              user={auth.user}
              isPremium={isPremium}
              favorites={favorites.favoriteEntries}
              favoritesLoading={favorites.loading}
              onToggleFavorite={(entry) => void favorites.toggleFavorite(entry)}
              onOpenPricing={handleOpenPricing}
              onSearch={handleSearch}
              onStudentDetailsUpdated={() => void auth.refreshUser()}
            />
          }
          />

          <Route path="/about" element={<AboutPage isPremium={isPremium} />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/categories" element={<ResourceRoute kind="categories" isPremium={isPremium} onOpenPricing={handleOpenPricing} />} />
          <Route path="/ai-features" element={<ResourceRoute kind="ai-features" isPremium={isPremium} onOpenPricing={handleOpenPricing} />} />
          <Route path="/release-notes" element={<ResourceRoute kind="release-notes" isPremium={isPremium} onOpenPricing={handleOpenPricing} />} />
          <Route path="/blog" element={<ResourceRoute kind="blog" isPremium={isPremium} onOpenPricing={handleOpenPricing} />} />
          <Route path="/guides" element={<ResourceRoute kind="guides" isPremium={isPremium} onOpenPricing={handleOpenPricing} />} />
          <Route path="/glossary" element={<ResourceRoute kind="glossary" entries={dataHook.data} dataStatus={dataHook.status} isPremium={isPremium} onOpenPricing={handleOpenPricing} />} />
          <Route path="/help" element={<ResourceRoute kind="help" isPremium={isPremium} onOpenPricing={handleOpenPricing} />} />
          <Route path="/careers" element={<ResourceRoute kind="careers" isPremium={isPremium} onOpenPricing={handleOpenPricing} />} />
          <Route path="/contact" element={<ResourceRoute kind="contact" isPremium={isPremium} onOpenPricing={handleOpenPricing} />} />
          <Route path="/resources" element={<ResourceRoute kind="resources" isPremium={isPremium} onOpenPricing={handleOpenPricing} />} />

          <Route
          path="/settings"
          element={
            <SettingsPage
              user={auth.user}
              isPremium={isPremium}
              authLoading={auth.loading}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              ttsProvider={tts.provider}
              setTtsProvider={(v) => tts.setProvider(v as any)}
              onTestVoice={(text) => tts.speak('settings-voice-test', text)}
              speakingId={tts.speakingId}
              preparingId={tts.preparingId}
              voices={tts.voices}
              selectedVoiceURI={tts.selectedVoiceURI}
              setSelectedVoiceURI={tts.setSelectedVoiceURI}
              autoReadAi={autoReadAi}
              setAutoReadAi={setAutoReadAi}
              dictionaryMode={dictionaryMode}
              setDictionaryMode={setDictionaryMode}
              onSignOut={handleSignOut}
              onOpenPricing={handleOpenPricing}
            />
          }
          />
          <Route
          path="/settings/:section"
          element={
            <SettingsPage
              user={auth.user}
              isPremium={isPremium}
              authLoading={auth.loading}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              ttsProvider={tts.provider}
              setTtsProvider={(v) => tts.setProvider(v as any)}
              onTestVoice={(text) => tts.speak('settings-voice-test', text)}
              speakingId={tts.speakingId}
              preparingId={tts.preparingId}
              voices={tts.voices}
              selectedVoiceURI={tts.selectedVoiceURI}
              setSelectedVoiceURI={tts.setSelectedVoiceURI}
              autoReadAi={autoReadAi}
              setAutoReadAi={setAutoReadAi}
              dictionaryMode={dictionaryMode}
              setDictionaryMode={setDictionaryMode}
              onSignOut={handleSignOut}
              onOpenPricing={handleOpenPricing}
            />
          }
          />

          <Route
          path="/dictionary"
          element={
            <DictionaryModePage
              isPremium={isPremium}
              onOpenPricing={handleOpenPricing}
              onOpenTerm={handleOpenTermFromDict}
              onSpeak={tts.speak}
              speakingId={tts.speakingId}
              preparingId={tts.preparingId}
              authToken={auth.session?.access_token}
            />
          }
          />
          <Route
          path="/dictionary-mode"
          element={
            <DictionaryModePage
              isPremium={isPremium}
              onOpenPricing={handleOpenPricing}
              onOpenTerm={handleOpenTermFromDict}
              onSpeak={tts.speak}
              speakingId={tts.speakingId}
              preparingId={tts.preparingId}
              authToken={auth.session?.access_token}
            />
          }
          />

          <Route
          path="/term/:slug"
          element={
            <TermPage
              dataHook={dataHook}
              tts={tts}
              ai={ai}
              user={auth.user}
              favorites={favorites}
              isPremium={isPremium}
              authLoading={auth.loading}
              onOpenAuth={handleSignIn}
              onOpenPricing={handleOpenPricing}
              authToken={auth.session?.access_token}
            />
          }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!(location.pathname === '/' && homeChatMode) && (
        <AppFooter onOpenPricing={handleOpenPricing} isPremium={isPremium} />
      )}

      {PricingModal}
    </>
  )
}

export default function App() {
  return (
    <CurrencyProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </CurrencyProvider>
  )
}
