import React, { useState, useEffect } from 'react'
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
import { LegalPage, StaticInfoPage } from './pages/LegalPage'
import { useAuth } from './hooks/useAuth'
import { useData } from './hooks/useData'
import { useTTS } from './hooks/useTTS'
import { useAI } from './hooks/useAI'
import { useFavorites } from './hooks/useFavorites'
import { useSubscription } from './hooks/useSubscription'
import { AUTO_READ_AI_KEY, DICTIONARY_MODE_KEY, THEME_KEY, recordDashboardSearch, termToSlug } from './utils'
import type { Entry } from './types'
import './styles/globals.css'

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

  const handleOpenTermFromDict = (entry: Entry) => navigate(`/term/${termToSlug(entry.term)}`, { state: { from: 'dictionary' } })
  const handleOpenTermFromChat = (entry: Entry) => navigate(`/term/${termToSlug(entry.term)}`, { state: { from: 'chat' } })
  const handleSignIn = () => navigate('/auth')
  const handleSignOut = () => {
    auth.signOut()
    navigate('/')
  }
  const handleOpenPricing = () => {
    setPricingOpen(true)
    navigate('/pricing')
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
    void subscription.subscribe(plan as 'monthly' | 'annual')
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
              auth.user
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
            />
          }
          />

          <Route path="/about" element={<AboutPage isPremium={isPremium} />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/categories" element={<StaticInfoPage title="Categories" description="Category browsing is being prepared for the production dictionary. Use search or Dictionary Mode to explore terms now." />} />
          <Route path="/ai-features" element={<StaticInfoPage title="AI Features" description="SCMpedia uses AI to explain supply chain terms in practical professional language, with server-side limits for free accounts." />} />
          <Route path="/release-notes" element={<StaticInfoPage title="Release Notes" description="Release notes will list shipped product updates, dictionary improvements, and subscription changes." />} />
          <Route path="/blog" element={<StaticInfoPage title="Blog" description="SCMpedia articles and supply chain explainers will appear here." />} />
          <Route path="/guides" element={<StaticInfoPage title="Guides" description="Guides will help students and professionals apply supply chain terms in real operational contexts." />} />
          <Route path="/glossary" element={<StaticInfoPage title="Glossary" description="Use the main search or Dictionary Mode to browse the SCMpedia glossary." />} />
          <Route path="/help" element={<StaticInfoPage title="Help Center" description="For support, account, and subscription questions, contact hello@scmpedia.com." />} />
          <Route path="/careers" element={<StaticInfoPage title="Careers" description="There are no open roles listed right now." />} />
          <Route path="/contact" element={<StaticInfoPage title="Contact" description="For support, partnerships, and enterprise access, email hello@scmpedia.com." />} />
          <Route path="/resources" element={<StaticInfoPage title="Resources" description="Explore SCMpedia guides, glossary content, release notes, and learning resources." />} />

          <Route
          path="/settings"
          element={
            <SettingsPage
              user={auth.user}
              isPremium={isPremium}
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
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
