import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as Clipboard from 'expo-clipboard'
import * as Speech from 'expo-speech'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import type { Session, User } from '@supabase/supabase-js'

import { browseWords, explainEntry, getImageForEntry, getWordsByTerms, industryExample, initializeCheckout, searchWords, verifyCheckout } from './api'
import { hasApiConfig, hasSupabaseConfig } from './config'
import { supabase } from './supabase'
import { colorsFor, type AppColors } from './theme'
import {
  AUTO_READ_AI_KEY,
  DICTIONARY_MODE_KEY,
  FREE_USAGE_KEY,
  HISTORY_KEY,
  THEME_KEY,
  TTS_PROVIDER_KEY,
  readFreeUsage,
  readHistory,
  readJson,
  recordHistory,
  writeFreeUsage,
  writeHistory,
  writeJson,
} from './storage'
import type { ChatMessage, Entry, FavoriteRow, HistoryItem, Screen, SubscriptionPlan } from './types'
import {
  FREE_DAILY_LIMIT,
  SCMPEDIA_SECTORS,
  formatRelativeTime,
  formatSubscriptionDate,
  getEntryId,
  getEntryTags,
  stripHtml,
  subscriptionFromUser,
  termToSlug,
  uuid,
} from './utils'

const logo = require('../assets/scmpedia/logo2.png')
const book = require('../assets/scmpedia/book.jpg')
const popularTerms = ['Supply', 'Demand', 'Inventory', 'Logistics', 'Procurement', 'Sustainability']
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const amazonBookUrl = 'https://www.amazon.com/Executive-Insight-Compendium-Supply-Management-ebook/dp/B0FQVFQVFM?ref_=ast_author_dp'

type IconName = keyof typeof Ionicons.glyphMap
type AuthMode = 'signin' | 'signup' | 'forgot'
type TtsProvider = 'device' | 'prof-douglas'

function getDisplayName(user: User | null) {
  return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'
}

function scoreLocal(entry: Entry, query: string) {
  const q = query.trim().toLowerCase()
  const term = entry.term.toLowerCase()
  const definition = entry.definition.toLowerCase()
  if (term === q) return 0
  if (term.startsWith(q)) return 1
  if (term.includes(q)) return 2
  if (definition.includes(q)) return 5
  return 20
}

function cleanQuery(value: string) {
  return value.replace(/^(what is|what's|define|explain|describe|meaning of|tell me about|search for|look up)\s+/i, '').replace(/\?/g, '').trim()
}

function Button({
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled,
  colors,
}: {
  label: string
  icon?: IconName
  onPress: () => void
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  disabled?: boolean
  colors: AppColors
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent'
  const border = variant === 'outline' || variant === 'ghost' ? colors.line : bg
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : colors.text
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.55 : pressed ? 0.78 : 1 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={17} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  )
}

function IconButton({
  icon,
  onPress,
  colors,
  active,
  disabled,
}: {
  icon: IconName
  onPress: () => void
  colors: AppColors
  active?: boolean
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.iconButton,
        {
          borderColor: colors.line,
          backgroundColor: active ? colors.primarySoft : colors.card,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={active ? colors.primary : colors.text} />
    </Pressable>
  )
}

function Card({ children, colors, style }: { children: React.ReactNode; colors: AppColors; style?: object }) {
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }, style]}>{children}</View>
}

function Tag({ label, colors }: { label: string; colors: AppColors }) {
  return (
    <View style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
      <Text style={[styles.tagText, { color: colors.primary }]}>{label}</Text>
    </View>
  )
}

function Field({
  value,
  onChangeText,
  placeholder,
  colors,
  secureTextEntry,
  keyboardType,
  multiline,
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  colors: AppColors
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address'
  multiline?: boolean
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      secureTextEntry={secureTextEntry}
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      keyboardType={keyboardType}
      multiline={multiline}
      style={[
        styles.field,
        {
          backgroundColor: colors.input,
          borderColor: colors.line,
          color: colors.text,
          minHeight: multiline ? 90 : 48,
          textAlignVertical: multiline ? 'top' : 'center',
        },
      ]}
    />
  )
}

function SectionTitle({ title, subtitle, colors }: { title: string; subtitle?: string; colors: AppColors }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  )
}

function EmptyState({ icon, title, body, colors }: { icon: IconName; title: string; body: string; colors: AppColors }) {
  return (
    <Card colors={colors} style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Ionicons name={icon} size={34} color={colors.muted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.muted }]}>{body}</Text>
    </Card>
  )
}

export default function MainApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [previousScreen, setPreviousScreen] = useState<Screen>('home')
  const [darkMode, setDarkModeState] = useState(false)
  const [autoReadAi, setAutoReadAiState] = useState(false)
  const [dictionaryMode, setDictionaryModeState] = useState(true)
  const [ttsProvider, setTtsProviderState] = useState<TtsProvider>('device')
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [entries, setEntries] = useState<Entry[]>([])
  const [entryCount, setEntryCount] = useState(0)
  const [nextOffset, setNextOffset] = useState(0)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [favorites, setFavorites] = useState<FavoriteRow[]>([])
  const [favoriteEntries, setFavoriteEntries] = useState<Entry[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [speakingId, setSpeakingId] = useState('')
  const [notice, setNotice] = useState('')
  const colors = useMemo(() => colorsFor(darkMode), [darkMode])
  const s = useMemo(() => makeStyles(colors), [colors])
  const subscription = useMemo(() => subscriptionFromUser(user), [user])
  const isPremium = subscription.tier === 'premium'
  const favoriteTerms = useMemo(() => new Set(favorites.map((fav) => fav.term.toLowerCase())), [favorites])

  useEffect(() => {
    void Promise.all([
      readJson(THEME_KEY, 'light'),
      readJson(AUTO_READ_AI_KEY, false),
      readJson(DICTIONARY_MODE_KEY, true),
      readJson<TtsProvider>(TTS_PROVIDER_KEY, 'device'),
      readHistory(),
    ]).then(([theme, autoRead, dictMode, voiceProvider, storedHistory]) => {
      setDarkModeState(theme === 'dark')
      setAutoReadAiState(Boolean(autoRead))
      setDictionaryModeState(Boolean(dictMode))
      setTtsProviderState(voiceProvider === 'prof-douglas' ? 'prof-douglas' : 'device')
      setHistory(storedHistory)
    })
  }, [])

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    }).catch(() => setAuthLoading(false))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
    })
    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  const setDarkMode = (value: boolean) => {
    setDarkModeState(value)
    void writeJson(THEME_KEY, value ? 'dark' : 'light')
  }
  const setAutoReadAi = (value: boolean) => {
    setAutoReadAiState(value)
    void writeJson(AUTO_READ_AI_KEY, value)
  }
  const setDictionaryMode = (value: boolean) => {
    setDictionaryModeState(value)
    void writeJson(DICTIONARY_MODE_KEY, value)
  }
  const setTtsProvider = (value: TtsProvider) => {
    setTtsProviderState(value)
    void writeJson(TTS_PROVIDER_KEY, value)
  }

  const refreshHistory = useCallback(async () => {
    setHistory(await readHistory())
  }, [])

  const loadMoreEntries = useCallback(async () => {
    if (loadingEntries) return
    setLoadingEntries(true)
    try {
      const page = await browseWords(nextOffset, 500)
      setEntries((current) => {
        const byKey = new Map(current.map((entry) => [getEntryId(entry), entry]))
        page.words.forEach((entry) => byKey.set(getEntryId(entry), entry))
        return Array.from(byKey.values()).sort((a, b) => a.term.localeCompare(b.term))
      })
      setEntryCount(page.count)
      setNextOffset(page.nextOffset)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load dictionary.')
    } finally {
      setLoadingEntries(false)
    }
  }, [loadingEntries, nextOffset])

  useEffect(() => {
    if (hasApiConfig) void loadMoreEntries()
    else setNotice('Set EXPO_PUBLIC_API_BASE_URL before running the mobile app.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadFavorites = useCallback(async () => {
    if (!supabase || !user) {
      setFavorites([])
      setFavoriteEntries([])
      return
    }
    setFavoritesLoading(true)
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('id,user_id,word_id,term,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data || []) as FavoriteRow[]
      setFavorites(rows)
      const local = new Map(entries.map((entry) => [entry.term.toLowerCase(), entry]))
      const missing = rows.map((row) => row.term).filter((term) => !local.has(term.toLowerCase()))
      const remote = missing.length ? await getWordsByTerms(missing) : []
      const merged = new Map([...entries, ...remote].map((entry) => [entry.term.toLowerCase(), entry]))
      setFavoriteEntries(rows.map((row) => merged.get(row.term.toLowerCase())).filter(Boolean) as Entry[])
    } catch {
      setFavorites([])
      setFavoriteEntries([])
    } finally {
      setFavoritesLoading(false)
    }
  }, [entries, user])

  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  const openScreen = (next: Screen) => {
    setPreviousScreen(screen)
    setScreen(next)
  }

  const openTerm = (entry: Entry) => {
    setSelectedEntry(entry)
    openScreen('term')
  }

  const speak = (id: string, text: string) => {
    const clean = stripHtml(text).trim()
    if (!clean) return
    if (speakingId === id) {
      Speech.stop()
      setSpeakingId('')
      return
    }
    Speech.stop()
    setSpeakingId(id)
    Speech.speak(clean, {
      rate: ttsProvider === 'prof-douglas' ? 0.9 : 0.96,
      pitch: 1,
      onDone: () => setSpeakingId(''),
      onStopped: () => setSpeakingId(''),
      onError: () => setSpeakingId(''),
    })
  }

  const toggleFavorite = async (entry: Entry) => {
    if (!supabase || !user) {
      openScreen('auth')
      return
    }
    const term = entry.term.trim()
    const existing = favorites.find((fav) => fav.term.toLowerCase() === term.toLowerCase())
    try {
      if (existing) {
        const { error } = await supabase.from('favorites').delete().eq('id', existing.id).eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: user.id, word_id: entry.id || null, term })
        if (error) throw error
      }
      await loadFavorites()
    } catch (error) {
      Alert.alert('Favorite not saved', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const signOut = async () => {
    await supabase?.auth.signOut()
    setScreen('home')
  }

  const refreshUser = async () => {
    if (!supabase) return
    const { data } = await supabase.auth.getUser()
    setUser(data.user ?? null)
  }

  const renderScreen = () => {
    if (screen === 'auth') {
      return <AuthScreen colors={colors} onDone={() => setScreen(previousScreen === 'auth' ? 'home' : previousScreen)} />
    }
    if (screen === 'term' && selectedEntry) {
      return (
        <TermScreen
          entry={selectedEntry}
          colors={colors}
          entries={entries}
          isPremium={isPremium}
          isFavorite={favoriteTerms.has(selectedEntry.term.toLowerCase())}
          onBack={() => setScreen(previousScreen === 'term' ? 'home' : previousScreen)}
          onOpenTerm={openTerm}
          onSpeak={speak}
          speakingId={speakingId}
          onToggleFavorite={() => void toggleFavorite(selectedEntry)}
          onOpenPricing={() => openScreen('pricing')}
          onOpenAuth={() => openScreen('auth')}
          user={user}
          autoReadAi={autoReadAi}
        />
      )
    }
    if (screen === 'dictionary') {
      return (
        <DictionaryScreen
          colors={colors}
          entries={entries}
          count={entryCount}
          loading={loadingEntries}
          onLoadMore={() => void loadMoreEntries()}
          onOpenTerm={openTerm}
          onSpeak={speak}
          speakingId={speakingId}
          isPremium={isPremium}
          onOpenPricing={() => openScreen('pricing')}
        />
      )
    }
    if (screen === 'dashboard') {
      return (
        <DashboardScreen
          colors={colors}
          user={user}
          isPremium={isPremium}
          history={history}
          favorites={favoriteEntries}
          favoritesLoading={favoritesLoading}
          onSearch={(term) => {
            setScreen('home')
            void submitSearch(term)
          }}
          onOpenTerm={openTerm}
          onOpenPricing={() => openScreen('pricing')}
          onOpenAuth={() => openScreen('auth')}
          onClearHistory={async () => {
            await writeHistory([])
            await refreshHistory()
          }}
        />
      )
    }
    if (screen === 'pricing') {
      return (
        <PricingScreen
          colors={colors}
          user={user}
          session={session}
          isPremium={isPremium}
          subscription={subscription}
          onOpenAuth={() => openScreen('auth')}
          onRefreshUser={refreshUser}
        />
      )
    }
    if (screen === 'settings') {
      return (
        <SettingsScreen
          colors={colors}
          user={user}
          isPremium={isPremium}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          autoReadAi={autoReadAi}
          setAutoReadAi={setAutoReadAi}
          dictionaryMode={dictionaryMode}
          setDictionaryMode={setDictionaryMode}
          ttsProvider={ttsProvider}
          setTtsProvider={setTtsProvider}
          onSpeak={() => speak('voice-test', 'SCMpedia voice reading is ready.')}
          speaking={speakingId === 'voice-test'}
          onOpenPricing={() => openScreen('pricing')}
          onOpenAuth={() => openScreen('auth')}
          onSignOut={signOut}
          onClearLocalData={async () => {
            await writeHistory([])
            await writeFreeUsage(0)
            await refreshHistory()
            setNotice('Local search history and free usage counter cleared.')
          }}
        />
      )
    }
    if (screen === 'about') return <AboutScreen colors={colors} onOpenPricing={() => openScreen('pricing')} />
    return (
      <HomeScreen
        colors={colors}
        entries={entries}
        messages={messages}
        loadingEntries={loadingEntries}
        isPremium={isPremium}
        user={user}
        favoriteTerms={favoriteTerms}
        speakingId={speakingId}
        onSubmit={submitSearch}
        onOpenTerm={openTerm}
        onSpeak={speak}
        onToggleFavorite={(entry) => void toggleFavorite(entry)}
        onOpenAuth={() => openScreen('auth')}
        onOpenPricing={() => openScreen('pricing')}
      />
    )
  }

  const submitSearch = async (raw: string) => {
    const original = raw.trim()
    if (!original) return
    if (!isPremium) {
      const used = await readFreeUsage()
      if (used >= FREE_DAILY_LIMIT) {
        openScreen('pricing')
        return
      }
      await writeFreeUsage(used + 1)
    }
    const nextHistory = await recordHistory(original)
    setHistory(nextHistory)
    const loadingId = uuid()
    setMessages((current) => [
      ...current,
      { id: uuid(), role: 'user', query: original },
      { id: loadingId, role: 'assistant', loading: true },
    ])
    setScreen('home')
    try {
      const q = cleanQuery(original)
      let pool = entries
        .filter((entry) => {
          const text = `${entry.term} ${entry.definition} ${entry.tags || ''}`.toLowerCase()
          return text.includes(q.toLowerCase()) || text.includes(original.toLowerCase())
        })
        .sort((a, b) => scoreLocal(a, q) - scoreLocal(b, q))
        .slice(0, 8)
      if (!pool.length) pool = await searchWords(q || original, 8)
      const exact = pool.find((entry) => entry.term.toLowerCase() === q.toLowerCase() || entry.term.toLowerCase() === original.toLowerCase())
      setMessages((current) =>
        current.map((message) =>
          message.id === loadingId
            ? exact
              ? { id: loadingId, role: 'assistant', entry: exact }
              : pool.length
                ? { id: loadingId, role: 'assistant', related: pool.slice(0, 5) }
                : { id: loadingId, role: 'assistant', content: 'No close matches yet. Try another spelling or a related supply chain term.' }
            : message,
        ),
      )
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === loadingId ? { id: loadingId, role: 'assistant', content: error instanceof Error ? error.message : 'Search failed.' } : message,
        ),
      )
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      <Header colors={colors} user={user} isPremium={isPremium} authLoading={authLoading} onLogo={() => setScreen('home')} onAuth={() => openScreen('auth')} onAbout={() => openScreen('about')} />
      {notice ? (
        <Pressable onPress={() => setNotice('')} style={[styles.notice, { backgroundColor: colors.orangeSoft, borderColor: colors.line }]}>
          <Text style={{ color: colors.text, flex: 1 }}>{notice}</Text>
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>{renderScreen()}</View>
      <BottomTabs colors={colors} current={screen} dictionaryMode={dictionaryMode} onChange={(next) => setScreen(next)} />
    </SafeAreaView>
  )
}

function Header({
  colors,
  user,
  isPremium,
  authLoading,
  onLogo,
  onAuth,
  onAbout,
}: {
  colors: AppColors
  user: User | null
  isPremium: boolean
  authLoading: boolean
  onLogo: () => void
  onAuth: () => void
  onAbout: () => void
}) {
  return (
    <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.line }]}>
      <Pressable onPress={onLogo} style={styles.brand}>
        <Image source={logo} style={styles.logo} />
        <View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>SCMpedia</Text>
          <Text style={[styles.brandSub, { color: colors.muted }]}>Supply Chain Dictionary</Text>
        </View>
      </Pressable>
      <View style={styles.headerActions}>
        {isPremium ? <Tag label="Premium" colors={colors} /> : null}
        <IconButton icon="information-circle-outline" onPress={onAbout} colors={colors} />
        <Pressable onPress={onAuth} style={[styles.profileButton, { borderColor: colors.line, backgroundColor: colors.card }]}>
          {authLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={user ? 'person' : 'log-in-outline'} size={18} color={colors.text} />}
        </Pressable>
      </View>
    </View>
  )
}

function BottomTabs({ colors, current, dictionaryMode, onChange }: { colors: AppColors; current: Screen; dictionaryMode: boolean; onChange: (screen: Screen) => void }) {
  const tabs: Array<{ screen: Screen; label: string; icon: IconName }> = [
    { screen: 'home', label: 'Home', icon: 'search' },
    { screen: dictionaryMode ? 'dictionary' : 'dictionary', label: 'Dictionary', icon: 'book-outline' },
    { screen: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
    { screen: 'pricing', label: 'Pricing', icon: 'diamond-outline' },
    { screen: 'settings', label: 'Settings', icon: 'settings-outline' },
  ]
  return (
    <View style={[styles.tabs, { backgroundColor: colors.card, borderTopColor: colors.line }]}>
      {tabs.map((tab) => {
        const active = current === tab.screen || (current === 'term' && tab.screen === 'dictionary')
        return (
          <Pressable key={tab.label} onPress={() => onChange(tab.screen)} style={styles.tab}>
            <Ionicons name={active ? (tab.icon.replace('-outline', '') as IconName) : tab.icon} size={21} color={active ? colors.primary : colors.muted} />
            <Text style={[styles.tabText, { color: active ? colors.primary : colors.muted }]}>{tab.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function HomeScreen({
  colors,
  entries,
  messages,
  loadingEntries,
  isPremium,
  user,
  favoriteTerms,
  speakingId,
  onSubmit,
  onOpenTerm,
  onSpeak,
  onToggleFavorite,
  onOpenAuth,
  onOpenPricing,
}: {
  colors: AppColors
  entries: Entry[]
  messages: ChatMessage[]
  loadingEntries: boolean
  isPremium: boolean
  user: User | null
  favoriteTerms: Set<string>
  speakingId: string
  onSubmit: (query: string) => Promise<void>
  onOpenTerm: (entry: Entry) => void
  onSpeak: (id: string, text: string) => void
  onToggleFavorite: (entry: Entry) => void
  onOpenAuth: () => void
  onOpenPricing: () => void
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Entry[]>([])
  const [suggesting, setSuggesting] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSuggestions([])
      return
    }
    const timeout = setTimeout(() => {
      const local = entries
        .filter((entry) => entry.term.toLowerCase().includes(q.toLowerCase()) || entry.definition.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => scoreLocal(a, q) - scoreLocal(b, q))
        .slice(0, 5)
      if (local.length) {
        setSuggestions(local)
        return
      }
      setSuggesting(true)
      searchWords(q, 5).then(setSuggestions).catch(() => setSuggestions([])).finally(() => setSuggesting(false))
    }, 180)
    return () => clearTimeout(timeout)
  }, [entries, query])

  const submit = (value = query) => {
    if (!value.trim()) return
    setQuery('')
    setSuggestions([])
    void onSubmit(value)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 32 }}>
        {messages.length === 0 ? (
          <View style={styles.hero}>
            <Image source={logo} style={styles.heroMark} />
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              The <Text style={{ color: colors.primary }}>AI-Powered</Text> Dictionary for Supply Chain Professionals
            </Text>
            <Text style={[styles.heroText, { color: colors.muted }]}>Instant definitions, real-world examples, voice reading, images, favorites, and smart study history.</Text>
          </View>
        ) : null}

        <Card colors={colors} style={{ gap: 10 }}>
          <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.line }]}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={loadingEntries ? 'Loading dictionary...' : 'Search supply chain terms...'}
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              onSubmitEditing={() => submit()}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {query ? <IconButton icon="arrow-up" onPress={() => submit()} colors={colors} /> : null}
          </View>
          {suggesting ? <ActivityIndicator color={colors.primary} /> : null}
          {suggestions.map((entry) => (
            <Pressable key={getEntryId(entry)} onPress={() => submit(entry.term)} style={[styles.suggestion, { borderTopColor: colors.line }]}>
              <Ionicons name="book-outline" size={16} color={colors.primary} />
              <Text style={[styles.suggestionText, { color: colors.text }]}>{entry.term}</Text>
            </Pressable>
          ))}
          <View style={styles.popularWrap}>
            {popularTerms.map((term) => (
              <Pressable key={term} onPress={() => submit(term)} style={[styles.popularPill, { borderColor: colors.line, backgroundColor: term === 'Supply' ? colors.primarySoft : colors.cardAlt }]}>
                <Text style={{ color: term === 'Supply' ? colors.primary : colors.text, fontWeight: '800' }}>{term}</Text>
              </Pressable>
            ))}
          </View>
          {!isPremium ? (
            <Pressable onPress={onOpenPricing} style={[styles.freeLimit, { backgroundColor: colors.orangeSoft }]}>
              <Ionicons name="diamond-outline" size={17} color={colors.orange} />
              <Text style={{ color: colors.text, flex: 1 }}>Free plan includes {FREE_DAILY_LIMIT} AI searches per day.</Text>
            </Pressable>
          ) : null}
        </Card>

        {messages.length ? (
          <View style={{ marginTop: 18, gap: 14 }}>
            {messages.map((message) => (
              <View key={message.id} style={{ alignItems: message.role === 'user' ? 'flex-end' : 'stretch' }}>
                {message.role === 'user' ? (
                  <View style={[styles.userBubble, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{message.query}</Text>
                  </View>
                ) : message.loading ? (
                  <Card colors={colors} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={{ color: colors.muted }}>Searching SCMpedia...</Text>
                  </Card>
                ) : message.entry ? (
                  <ResultCard
                    entry={message.entry}
                    colors={colors}
                    isFavorite={favoriteTerms.has(message.entry.term.toLowerCase())}
                    isSpeaking={speakingId === `def-${getEntryId(message.entry)}`}
                    onOpen={() => onOpenTerm(message.entry as Entry)}
                    onSpeak={() => onSpeak(`def-${getEntryId(message.entry as Entry)}`, `${message.entry?.term}. ${message.entry?.definition}`)}
                    onFavorite={() => user ? onToggleFavorite(message.entry as Entry) : onOpenAuth()}
                  />
                ) : message.related?.length ? (
                  <Card colors={colors}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Related terms</Text>
                    {message.related.map((entry) => (
                      <Pressable key={getEntryId(entry)} onPress={() => onOpenTerm(entry)} style={[styles.relatedRow, { borderTopColor: colors.line }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.relatedTitle, { color: colors.text }]}>{entry.term}</Text>
                          <Text numberOfLines={2} style={{ color: colors.muted }}>{entry.definition}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                      </Pressable>
                    ))}
                  </Card>
                ) : (
                  <Card colors={colors}><Text style={{ color: colors.muted }}>{message.content}</Text></Card>
                )}
              </View>
            ))}
          </View>
        ) : (
          <FeatureGrid colors={colors} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function ResultCard({
  entry,
  colors,
  isFavorite,
  isSpeaking,
  onOpen,
  onSpeak,
  onFavorite,
}: {
  entry: Entry
  colors: AppColors
  isFavorite: boolean
  isSpeaking: boolean
  onOpen: () => void
  onSpeak: () => void
  onFavorite: () => void
}) {
  const tags = getEntryTags(entry).slice(0, 4)
  return (
    <Card colors={colors}>
      <View style={styles.resultHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.resultTitle, { color: colors.text }]}>{entry.term}</Text>
          {entry.pronunciation ? <Text style={{ color: colors.muted }}>/{entry.pronunciation}/</Text> : null}
        </View>
        <IconButton icon={isSpeaking ? 'stop' : 'volume-high-outline'} onPress={onSpeak} colors={colors} active={isSpeaking} />
        <IconButton icon={isFavorite ? 'star' : 'star-outline'} onPress={onFavorite} colors={colors} active={isFavorite} />
      </View>
      <Text style={[styles.definition, { color: colors.text }]}>{entry.definition}</Text>
      <View style={styles.tagRow}>{tags.map((tag) => <Tag key={tag} label={tag} colors={colors} />)}</View>
      <View style={styles.rowActions}>
        <Button label="Open" icon="open-outline" onPress={onOpen} colors={colors} />
        <Button
          label="Share"
          icon="share-outline"
          variant="outline"
          onPress={() => void Share.share({ title: `${entry.term} - SCMpedia`, message: `${entry.term}: ${entry.definition}` })}
          colors={colors}
        />
      </View>
    </Card>
  )
}

function FeatureGrid({ colors }: { colors: AppColors }) {
  const features: Array<{ icon: IconName; title: string; body: string }> = [
    { icon: 'sparkles-outline', title: 'AI Explanations', body: 'Senior-practitioner explanations with sector examples.' },
    { icon: 'volume-high-outline', title: 'Voice Reading', body: 'Listen to definitions and AI summaries on iPhone.' },
    { icon: 'image-outline', title: 'Context Images', body: 'Open term pages for supply chain visuals.' },
    { icon: 'star-outline', title: 'Favorites', body: 'Save terms to your account and dashboard.' },
    { icon: 'book-outline', title: 'Dictionary Mode', body: 'Browse A-Z with page and list views.' },
    { icon: 'time-outline', title: 'Study History', body: 'Recent searches stay on this device for fast review.' },
  ]
  return (
    <View style={styles.featureGrid}>
      {features.map((feature) => (
        <Card key={feature.title} colors={colors} style={{ width: '48%' }}>
          <View style={[styles.featureIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name={feature.icon} size={22} color={colors.primary} />
          </View>
          <Text style={[styles.featureTitle, { color: colors.text }]}>{feature.title}</Text>
          <Text style={{ color: colors.muted, lineHeight: 19 }}>{feature.body}</Text>
        </Card>
      ))}
    </View>
  )
}

function TermScreen({
  entry,
  colors,
  entries,
  isPremium,
  isFavorite,
  onBack,
  onOpenTerm,
  onSpeak,
  speakingId,
  onToggleFavorite,
  onOpenPricing,
  onOpenAuth,
  user,
  autoReadAi,
}: {
  entry: Entry
  colors: AppColors
  entries: Entry[]
  isPremium: boolean
  isFavorite: boolean
  onBack: () => void
  onOpenTerm: (entry: Entry) => void
  onSpeak: (id: string, text: string) => void
  speakingId: string
  onToggleFavorite: () => void
  onOpenPricing: () => void
  onOpenAuth: () => void
  user: User | null
  autoReadAi: boolean
}) {
  const [aiText, setAiText] = useState('')
  const [loadingAi, setLoadingAi] = useState(true)
  const [regen, setRegen] = useState(0)
  const [image, setImage] = useState<{ url: string; title: string; contextLink: string } | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [sector, setSector] = useState(SCMPEDIA_SECTORS[0])
  const [example, setExample] = useState('')
  const [copied, setCopied] = useState(false)
  const entryId = getEntryId(entry)
  const aiPlain = stripHtml(aiText)
  const tags = getEntryTags(entry)
  const related = useMemo(() => {
    const tagSet = new Set(tags.map((tag) => tag.toLowerCase()))
    return entries
      .filter((item) => item.term !== entry.term)
      .map((item) => ({ item, score: getEntryTags(item).filter((tag) => tagSet.has(tag.toLowerCase())).length }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ item }) => item)
  }, [entries, entry.term, tags])

  useEffect(() => {
    let cancelled = false
    setLoadingAi(true)
    setAiText('')
    explainEntry(entry, regen > 0).then((text) => {
      if (cancelled) return
      setAiText(text)
      if (autoReadAi && text) onSpeak(`ai-${entryId}`, stripHtml(text))
    }).finally(() => !cancelled && setLoadingAi(false))
    return () => { cancelled = true }
  }, [autoReadAi, entry, entryId, onSpeak, regen])

  useEffect(() => {
    let cancelled = false
    setImageLoading(true)
    getImageForEntry(entry).then((next) => {
      if (!cancelled && next.url) setImage({ url: next.url, title: next.title, contextLink: next.contextLink })
    }).catch(() => undefined).finally(() => !cancelled && setImageLoading(false))
    return () => { cancelled = true }
  }, [entry])

  useEffect(() => {
    let cancelled = false
    setExample('')
    industryExample(entry, sector).then((text) => !cancelled && setExample(text))
    return () => { cancelled = true }
  }, [entry, sector])

  const copyDefinition = async () => {
    await Clipboard.setStringAsync(`${entry.term}: ${entry.definition}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 34 }}>
      <View style={styles.topRow}>
        <Button label="Back" icon="chevron-back" variant="outline" onPress={onBack} colors={colors} />
        {!isPremium ? <Button label="Go Premium" icon="diamond-outline" onPress={onOpenPricing} colors={colors} /> : null}
      </View>

      <Card colors={colors}>
        <View style={styles.resultHead}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.termLabel, { color: colors.primary }]}>Term</Text>
            <Text style={[styles.termTitle, { color: colors.text }]}>{entry.term}</Text>
            {entry.pos ? <Text style={{ color: colors.muted }}>Part of speech: {entry.pos}</Text> : null}
            {entry.pronunciation ? <Text style={{ color: colors.muted }}>/{entry.pronunciation}/</Text> : null}
          </View>
          <IconButton icon={speakingId === `def-${entryId}` ? 'stop' : 'volume-high-outline'} onPress={() => onSpeak(`def-${entryId}`, `${entry.term}. ${entry.definition}`)} colors={colors} active={speakingId === `def-${entryId}`} />
          <IconButton icon={isFavorite ? 'star' : 'star-outline'} onPress={user ? onToggleFavorite : onOpenAuth} colors={colors} active={isFavorite} />
        </View>
        <Text style={[styles.definitionLarge, { color: colors.text }]}>{entry.definition}</Text>
        <View style={styles.tagRow}>{tags.map((tag) => <Tag key={tag} label={tag} colors={colors} />)}</View>
        <View style={styles.rowActions}>
          <Button label={copied ? 'Copied' : 'Copy'} icon="copy-outline" variant="outline" onPress={() => void copyDefinition()} colors={colors} />
          <Button label="Share" icon="share-outline" variant="outline" onPress={() => void Share.share({ title: `${entry.term} - SCMpedia`, message: `${entry.term}: ${entry.definition}` })} colors={colors} />
        </View>
      </Card>

      <Card colors={colors}>
        <View style={styles.resultHead}>
          <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]}>AI Deep Dive</Text>
          <IconButton icon="refresh" onPress={() => setRegen((value) => value + 1)} colors={colors} disabled={loadingAi} />
          <IconButton icon={speakingId === `ai-${entryId}` ? 'stop' : 'volume-high-outline'} onPress={() => onSpeak(`ai-${entryId}`, aiPlain)} colors={colors} active={speakingId === `ai-${entryId}`} disabled={!aiPlain} />
        </View>
        {loadingAi ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.definition, { color: colors.text }]}>{aiPlain}</Text>}
      </Card>

      <Card colors={colors}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Context Image</Text>
        {imageLoading ? <ActivityIndicator color={colors.primary} /> : image?.url ? (
          <Pressable onPress={() => image.contextLink ? Linking.openURL(image.contextLink) : undefined}>
            <Image source={{ uri: image.url }} style={styles.termImage} />
            {image.title ? <Text style={{ color: colors.muted, marginTop: 8 }}>{image.title}</Text> : null}
          </Pressable>
        ) : <Text style={{ color: colors.muted }}>No image available for this term right now.</Text>}
      </Card>

      <Card colors={colors}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Industry Example</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {SCMPEDIA_SECTORS.map((item) => (
            <Pressable key={item} onPress={() => setSector(item)} style={[styles.popularPill, { borderColor: colors.line, backgroundColor: sector === item ? colors.primarySoft : colors.cardAlt }]}>
              <Text style={{ color: sector === item ? colors.primary : colors.text, fontWeight: '800', textTransform: 'capitalize' }}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={[styles.definition, { color: colors.text }]}>{example || 'Loading example...'}</Text>
      </Card>

      {related.length ? (
        <Card colors={colors}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Related Terms</Text>
          {related.map((item) => (
            <Pressable key={getEntryId(item)} onPress={() => onOpenTerm(item)} style={[styles.relatedRow, { borderTopColor: colors.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.relatedTitle, { color: colors.text }]}>{item.term}</Text>
                <Text style={{ color: colors.muted }} numberOfLines={2}>{item.definition}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  )
}

function DictionaryScreen({
  colors,
  entries,
  count,
  loading,
  onLoadMore,
  onOpenTerm,
  onSpeak,
  speakingId,
  isPremium,
  onOpenPricing,
}: {
  colors: AppColors
  entries: Entry[]
  count: number
  loading: boolean
  onLoadMore: () => void
  onOpenTerm: (entry: Entry) => void
  onSpeak: (id: string, text: string) => void
  speakingId: string
  isPremium: boolean
  onOpenPricing: () => void
}) {
  const [query, setQuery] = useState('')
  const [letter, setLetter] = useState('All')
  const [view, setView] = useState<'page' | 'list'>('page')
  const [page, setPage] = useState(0)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((entry) => {
      const matchesLetter = letter === 'All' || entry.term.trim().toUpperCase().startsWith(letter)
      const matchesQuery = !q || entry.term.toLowerCase().includes(q) || entry.definition.toLowerCase().includes(q)
      return matchesLetter && matchesQuery
    })
  }, [entries, letter, query])
  const perPage = view === 'page' ? 6 : 30
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages - 1)
  const visible = filtered.slice(safePage * perPage, safePage * perPage + perPage)

  useEffect(() => setPage(0), [letter, query, view])

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 34 }}>
      <SectionTitle title="Dictionary Mode" subtitle={`Browse ${entries.length.toLocaleString()}${count ? ` of ${count.toLocaleString()}` : ''} loaded supply chain terms.`} colors={colors} />
      <Card colors={colors}>
        <Image source={book} style={styles.bookCover} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Printed compendium</Text>
          <Text style={{ color: colors.muted }}>Order the SCM dictionary book on Amazon.</Text>
        </View>
        <IconButton icon="open-outline" onPress={() => void Linking.openURL(amazonBookUrl)} colors={colors} />
      </Card>
      {!isPremium ? (
        <Pressable onPress={onOpenPricing} style={[styles.premiumBanner, { backgroundColor: colors.primarySoft, borderColor: colors.line }]}>
          <Ionicons name="diamond-outline" size={22} color={colors.primary} />
          <Text style={{ color: colors.text, flex: 1, fontWeight: '800' }}>Go Premium for unlimited search, voice, images, and study tools.</Text>
        </Pressable>
      ) : null}
      <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.line, marginBottom: 12 }]}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search dictionary..." placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.text }]} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingBottom: 10 }}>
        {['All', ...letters].map((item) => (
          <Pressable key={item} onPress={() => setLetter(item)} style={[styles.letter, { backgroundColor: letter === item ? colors.primary : colors.card, borderColor: colors.line }]}>
            <Text style={{ color: letter === item ? '#fff' : colors.text, fontWeight: '900' }}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.segmentRow}>
        <Button label="Page" icon="book-outline" variant={view === 'page' ? 'primary' : 'outline'} onPress={() => setView('page')} colors={colors} />
        <Button label="List" icon="list-outline" variant={view === 'list' ? 'primary' : 'outline'} onPress={() => setView('list')} colors={colors} />
      </View>
      <Card colors={colors}>
        <View style={styles.pageControls}>
          <IconButton icon="chevron-back" onPress={() => setPage((value) => Math.max(0, value - 1))} colors={colors} disabled={safePage === 0} />
          <Text style={{ color: colors.text, fontWeight: '900' }}>Page {safePage + 1} of {totalPages}</Text>
          <IconButton icon="chevron-forward" onPress={() => setPage((value) => Math.min(totalPages - 1, value + 1))} colors={colors} disabled={safePage >= totalPages - 1} />
        </View>
        {visible.length ? visible.map((entry) => (
          <Pressable key={getEntryId(entry)} onPress={() => onOpenTerm(entry)} style={[styles.dictionaryRow, { borderTopColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.relatedTitle, { color: colors.text }]}>{entry.term}</Text>
              <Text style={{ color: colors.muted }} numberOfLines={view === 'page' ? 3 : 2}>{entry.definition}</Text>
            </View>
            <IconButton icon={speakingId === `dict-${getEntryId(entry)}` ? 'stop' : 'volume-high-outline'} onPress={() => onSpeak(`dict-${getEntryId(entry)}`, `${entry.term}. ${entry.definition}`)} colors={colors} active={speakingId === `dict-${getEntryId(entry)}`} />
          </Pressable>
        )) : <Text style={{ color: colors.muted }}>No terms match this filter.</Text>}
      </Card>
      {entries.length < count || !count ? <Button label={loading ? 'Loading...' : 'Load more terms'} icon="download-outline" onPress={onLoadMore} colors={colors} disabled={loading} /> : null}
    </ScrollView>
  )
}

function DashboardScreen({
  colors,
  user,
  isPremium,
  history,
  favorites,
  favoritesLoading,
  onSearch,
  onOpenTerm,
  onOpenPricing,
  onOpenAuth,
  onClearHistory,
}: {
  colors: AppColors
  user: User | null
  isPremium: boolean
  history: HistoryItem[]
  favorites: Entry[]
  favoritesLoading: boolean
  onSearch: (term: string) => void
  onOpenTerm: (entry: Entry) => void
  onOpenPricing: () => void
  onOpenAuth: () => void
  onClearHistory: () => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const stats = [
    { label: 'Saved Terms', value: favorites.length.toString(), icon: 'star-outline' as IconName },
    { label: 'Recent Searches', value: history.length.toString(), icon: 'time-outline' as IconName },
    { label: 'Today', value: history.filter((item) => item.at >= today.getTime()).length.toString(), icon: 'trending-up-outline' as IconName },
    { label: 'Plan', value: isPremium ? 'Premium' : 'Free', icon: 'diamond-outline' as IconName },
  ]
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 34 }}>
      <SectionTitle title={`Welcome back, ${getDisplayName(user)}`} subtitle="Your saved terms and recent learning activity." colors={colors} />
      {!user ? <Button label="Sign in to sync favorites" icon="log-in-outline" onPress={onOpenAuth} colors={colors} /> : null}
      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <Card key={stat.label} colors={colors} style={{ width: '48%' }}>
            <Ionicons name={stat.icon} size={24} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
            <Text style={{ color: colors.muted }}>{stat.label}</Text>
          </Card>
        ))}
      </View>
      {!isPremium ? <Button label="Upgrade plan" icon="diamond-outline" onPress={onOpenPricing} colors={colors} /> : null}
      <SectionTitle title="Saved Terms" subtitle="Favorites synced through Supabase." colors={colors} />
      {favoritesLoading ? <ActivityIndicator color={colors.primary} /> : favorites.length ? (
        favorites.slice(0, 12).map((entry) => (
          <Pressable key={getEntryId(entry)} onPress={() => onOpenTerm(entry)} style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.relatedTitle, { color: colors.text }]}>{entry.term}</Text>
              <Text style={{ color: colors.muted }} numberOfLines={2}>{entry.definition}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))
      ) : <EmptyState icon="star-outline" title="No saved terms yet" body="Search for a term and tap the star to save it." colors={colors} />}
      <View style={styles.titleActionRow}>
        <SectionTitle title="Search History" subtitle="Stored on this device for 7 days." colors={colors} />
        {history.length ? <Button label="Clear" variant="ghost" onPress={onClearHistory} colors={colors} /> : null}
      </View>
      {history.length ? history.map((item) => (
        <Pressable key={`${item.term}-${item.at}`} onPress={() => onSearch(item.term)} style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.relatedTitle, { color: colors.text }]}>{item.term}</Text>
            <Text style={{ color: colors.muted }}>{formatRelativeTime(item.at)}</Text>
          </View>
        </Pressable>
      )) : <EmptyState icon="time-outline" title="No recent searches" body="Search activity will appear here." colors={colors} />}
    </ScrollView>
  )
}

function PricingScreen({
  colors,
  user,
  session,
  isPremium,
  subscription,
  onOpenAuth,
  onRefreshUser,
}: {
  colors: AppColors
  user: User | null
  session: Session | null
  isPremium: boolean
  subscription: { plan?: SubscriptionPlan; expiresAt?: string }
  onOpenAuth: () => void
  onRefreshUser: () => Promise<void>
}) {
  const [annual, setAnnual] = useState(true)
  const [pendingReference, setPendingReference] = useState('')
  const [manualReference, setManualReference] = useState('')
  const [busy, setBusy] = useState(false)
  const paidUntil = formatSubscriptionDate(subscription.expiresAt)

  const startCheckout = async () => {
    if (!user || !session?.access_token) {
      onOpenAuth()
      return
    }
    setBusy(true)
    try {
      const plan = annual ? 'annual' : 'monthly'
      const result = await initializeCheckout(plan, session.access_token)
      setPendingReference(result.reference)
      if (result.authorizationUrl) await WebBrowser.openBrowserAsync(result.authorizationUrl)
    } catch (error) {
      Alert.alert('Checkout failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const verify = async (reference: string) => {
    if (!session?.access_token || !reference.trim()) return
    setBusy(true)
    try {
      await verifyCheckout(reference.trim(), session.access_token)
      await onRefreshUser()
      Alert.alert('Premium activated', 'Your SCMpedia Premium access is active.')
    } catch (error) {
      Alert.alert('Verification failed', error instanceof Error ? error.message : 'Payment has not been completed yet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 34 }}>
      <SectionTitle title="Pricing" subtitle="Choose the plan that powers your supply chain learning." colors={colors} />
      <View style={styles.segmentRow}>
        <Button label="Monthly" variant={!annual ? 'primary' : 'outline'} onPress={() => setAnnual(false)} colors={colors} />
        <Button label="Annual Save 17%" variant={annual ? 'primary' : 'outline'} onPress={() => setAnnual(true)} colors={colors} />
      </View>
      <PlanCard colors={colors} title="Free" price="GHC0/month" features={['Limited daily searches', 'Basic definitions', 'Favorites', 'Search history']} cta="Current starter plan" onPress={user ? () => undefined : onOpenAuth} />
      <PlanCard
        colors={colors}
        title="Premium"
        price={annual ? 'GHC225.78/year' : 'GHC22.58/month'}
        highlighted
        disabled={isPremium || busy}
        features={['Unlimited dictionary searches', 'AI-powered explanations', 'Voice reading', 'Dictionary mode', 'Images, sharing, favorites, and dashboard tools']}
        cta={isPremium ? `Active${paidUntil ? ` until ${paidUntil}` : ''}` : busy ? 'Working...' : 'Go Premium'}
        onPress={() => void startCheckout()}
      />
      <PlanCard colors={colors} title="Team" price="Custom" features={['Everything in Premium', 'Team management', 'SSO/SAML', 'Custom onboarding', 'Dedicated support']} cta="Contact Sales" onPress={() => void Linking.openURL('mailto:hello@scmpedia.com?subject=Enterprise%20Inquiry')} />
      {pendingReference ? (
        <Card colors={colors}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Payment Verification</Text>
          <Text style={{ color: colors.muted, marginBottom: 10 }}>After Paystack confirms payment, verify the transaction reference below.</Text>
          <Field value={manualReference || pendingReference} onChangeText={setManualReference} placeholder="Paystack reference" colors={colors} />
          <Button label="Verify payment" icon="checkmark-circle-outline" onPress={() => void verify(manualReference || pendingReference)} colors={colors} disabled={busy} />
        </Card>
      ) : null}
    </ScrollView>
  )
}

function PlanCard({
  colors,
  title,
  price,
  features,
  cta,
  onPress,
  highlighted,
  disabled,
}: {
  colors: AppColors
  title: string
  price: string
  features: string[]
  cta: string
  onPress: () => void
  highlighted?: boolean
  disabled?: boolean
}) {
  return (
    <Card colors={colors} style={{ borderColor: highlighted ? colors.primary : colors.line }}>
      {highlighted ? <Tag label="Most Popular" colors={colors} /> : null}
      <Text style={[styles.planTitle, { color: highlighted ? colors.primary : colors.text }]}>{title}</Text>
      <Text style={[styles.planPrice, { color: colors.text }]}>{price}</Text>
      {features.map((feature) => (
        <View key={feature} style={styles.featureLine}>
          <Ionicons name="checkmark-circle" size={17} color={colors.primary} />
          <Text style={{ color: colors.text, flex: 1 }}>{feature}</Text>
        </View>
      ))}
      <Button label={cta} icon={highlighted ? 'diamond-outline' : 'arrow-forward'} onPress={onPress} colors={colors} variant={highlighted ? 'primary' : 'outline'} disabled={disabled} />
    </Card>
  )
}

function SettingsScreen({
  colors,
  user,
  isPremium,
  darkMode,
  setDarkMode,
  autoReadAi,
  setAutoReadAi,
  dictionaryMode,
  setDictionaryMode,
  ttsProvider,
  setTtsProvider,
  onSpeak,
  speaking,
  onOpenPricing,
  onOpenAuth,
  onSignOut,
  onClearLocalData,
}: {
  colors: AppColors
  user: User | null
  isPremium: boolean
  darkMode: boolean
  setDarkMode: (value: boolean) => void
  autoReadAi: boolean
  setAutoReadAi: (value: boolean) => void
  dictionaryMode: boolean
  setDictionaryMode: (value: boolean) => void
  ttsProvider: TtsProvider
  setTtsProvider: (value: TtsProvider) => void
  onSpeak: () => void
  speaking: boolean
  onOpenPricing: () => void
  onOpenAuth: () => void
  onSignOut: () => void
  onClearLocalData: () => void
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 34 }}>
      <SectionTitle title="Settings" subtitle="Appearance, voice, account, privacy, and reset tools." colors={colors} />
      <SettingsRow colors={colors} icon="moon-outline" title="Dark mode" body="Use a darker interface for reading." value={darkMode} onChange={setDarkMode} />
      <SettingsRow colors={colors} icon="book-outline" title="Open full dictionary mode" body="Use the native A-Z dictionary as the dictionary tab." value={dictionaryMode} onChange={setDictionaryMode} />
      <SettingsRow colors={colors} icon="volume-high-outline" title="Auto-read AI explanations" body="Read AI summaries when they finish loading." value={autoReadAi} onChange={setAutoReadAi} />
      <Card colors={colors}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Voice & Audio</Text>
        <View style={styles.segmentRow}>
          <Button label="Device Voice" variant={ttsProvider === 'device' ? 'primary' : 'outline'} onPress={() => setTtsProvider('device')} colors={colors} />
          <Button label="Prof Douglas" variant={ttsProvider === 'prof-douglas' ? 'primary' : 'outline'} onPress={() => setTtsProvider('prof-douglas')} colors={colors} />
        </View>
        <Button label={speaking ? 'Stop test' : 'Test voice'} icon="volume-high-outline" onPress={onSpeak} colors={colors} />
      </Card>
      <Card colors={colors}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Account</Text>
        <Text style={{ color: colors.muted, marginBottom: 12 }}>{user ? `${user.email}\n${isPremium ? 'Premium plan' : 'Free plan'}` : 'Not signed in'}</Text>
        {user ? <Button label="Sign out" icon="log-out-outline" variant="outline" onPress={onSignOut} colors={colors} /> : <Button label="Sign in or create account" icon="log-in-outline" onPress={onOpenAuth} colors={colors} />}
        {!isPremium ? <Button label="Manage subscription" icon="diamond-outline" variant="outline" onPress={onOpenPricing} colors={colors} /> : null}
      </Card>
      <Card colors={colors}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Privacy & Data</Text>
        <Text style={{ color: colors.muted, marginBottom: 12 }}>Search history and daily free usage counters are stored locally on this device.</Text>
        <Button label="Clear local data" icon="trash-outline" variant="danger" onPress={onClearLocalData} colors={colors} />
      </Card>
      <Card colors={colors}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Configuration</Text>
        <Text style={{ color: hasApiConfig ? colors.muted : colors.danger }}>API: {hasApiConfig ? 'Configured' : 'Missing EXPO_PUBLIC_API_BASE_URL'}</Text>
        <Text style={{ color: hasSupabaseConfig ? colors.muted : colors.danger }}>Supabase: {hasSupabaseConfig ? 'Configured' : 'Missing Supabase public env vars'}</Text>
      </Card>
    </ScrollView>
  )
}

function SettingsRow({ colors, icon, title, body, value, onChange }: { colors: AppColors; icon: IconName; title: string; body: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Card colors={colors}>
      <View style={styles.settingsRow}>
        <View style={[styles.featureIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={icon} size={21} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.relatedTitle, { color: colors.text }]}>{title}</Text>
          <Text style={{ color: colors.muted }}>{body}</Text>
        </View>
        <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.line, true: colors.primarySoft }} thumbColor={value ? colors.primary : '#fff'} />
      </View>
    </Card>
  )
}

function AuthScreen({ colors, onDone }: { colors: AppColors; onDone: () => void }) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async () => {
    if (!supabase) {
      setMessage('Supabase auth is not configured for the mobile app.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onDone()
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.')
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
        if (error) throw error
        setMessage('Check your email to confirm your account.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        setMessage('Password reset link sent.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 34 }}>
        <Button label="Back" icon="chevron-back" variant="outline" onPress={onDone} colors={colors} />
        <View style={styles.authHero}>
          <Image source={logo} style={styles.authLogo} />
          <Text style={[styles.heroTitle, { color: colors.text }]}>Welcome to SCMpedia</Text>
          <Text style={[styles.heroText, { color: colors.muted }]}>Sign in to sync favorites, manage premium access, and keep your supply chain learning connected.</Text>
        </View>
        <Card colors={colors}>
          <View style={styles.segmentRow}>
            <Button label="Sign in" variant={mode === 'signin' ? 'primary' : 'outline'} onPress={() => setMode('signin')} colors={colors} />
            <Button label="Sign up" variant={mode === 'signup' ? 'primary' : 'outline'} onPress={() => setMode('signup')} colors={colors} />
            <Button label="Reset" variant={mode === 'forgot' ? 'primary' : 'outline'} onPress={() => setMode('forgot')} colors={colors} />
          </View>
          {mode === 'signup' ? <Field value={name} onChangeText={setName} placeholder="Full name" colors={colors} /> : null}
          <Field value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" colors={colors} />
          {mode !== 'forgot' ? <Field value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry colors={colors} /> : null}
          {message ? <Text style={{ color: message.includes('sent') || message.includes('Check') ? colors.primary : colors.danger }}>{message}</Text> : null}
          <Button label={busy ? 'Working...' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'} icon="log-in-outline" onPress={() => void submit()} colors={colors} disabled={busy} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function AboutScreen({ colors, onOpenPricing }: { colors: AppColors; onOpenPricing: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 34 }}>
      <View style={styles.authHero}>
        <Image source={logo} style={styles.authLogo} />
        <Text style={[styles.heroTitle, { color: colors.text }]}>SCMpedia</Text>
        <Text style={[styles.heroText, { color: colors.muted }]}>A native iOS companion for the AI-powered supply chain dictionary and learning platform.</Text>
      </View>
      <Card colors={colors}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>What it includes</Text>
        {['AI-powered term explanations', 'Voice reading', 'Context images', 'Favorites and dashboard history', 'Native dictionary mode', 'Premium subscriptions through Paystack'].map((item) => (
          <View key={item} style={styles.featureLine}>
            <Ionicons name="checkmark-circle" size={17} color={colors.primary} />
            <Text style={{ color: colors.text, flex: 1 }}>{item}</Text>
          </View>
        ))}
        <Button label="View pricing" icon="diamond-outline" onPress={onOpenPricing} colors={colors} />
      </Card>
    </ScrollView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    unused: { color: colors.text },
  })
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  logo: { width: 42, height: 42, resizeMode: 'contain' },
  brandTitle: { fontSize: 18, fontWeight: '900' },
  brandSub: { fontSize: 11, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notice: { margin: 12, marginBottom: 0, padding: 12, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tabs: { minHeight: 66, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', paddingTop: 6, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabText: { fontSize: 10, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 14, padding: 15, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  button: { borderWidth: 1, minHeight: 42, borderRadius: 10, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'flex-start' },
  buttonText: { fontWeight: '900', fontSize: 14 },
  iconButton: { width: 38, height: 38, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingVertical: 22 },
  heroMark: { width: 80, height: 80, resizeMode: 'contain', marginBottom: 12 },
  heroTitle: { fontSize: 34, lineHeight: 38, fontWeight: '900', textAlign: 'center', letterSpacing: 0 },
  heroText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  searchBox: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, minHeight: 48, fontSize: 16, fontWeight: '700' },
  field: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, fontSize: 15, marginBottom: 10 },
  suggestion: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionText: { fontWeight: '800' },
  popularWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  popularPill: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  freeLimit: { borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  userBubble: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, maxWidth: '82%' },
  resultHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  resultTitle: { fontSize: 23, fontWeight: '900' },
  definition: { fontSize: 15, lineHeight: 23, marginTop: 10 },
  definitionLarge: { fontSize: 17, lineHeight: 26, marginTop: 14 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  tag: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999 },
  tagText: { fontSize: 12, fontWeight: '900' },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 },
  featureIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  featureTitle: { fontSize: 16, fontWeight: '900', marginBottom: 5 },
  cardTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  relatedRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  relatedTitle: { fontSize: 15, fontWeight: '900', marginBottom: 3 },
  sectionTitle: { fontSize: 26, fontWeight: '900', letterSpacing: 0 },
  sectionSubtitle: { fontSize: 14, lineHeight: 21, marginTop: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '900', marginTop: 10 },
  emptyBody: { textAlign: 'center', marginTop: 4, lineHeight: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  termLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  termTitle: { fontSize: 34, fontWeight: '900', letterSpacing: 0 },
  termImage: { width: '100%', height: 210, borderRadius: 12, resizeMode: 'cover', backgroundColor: '#DDE7E4' },
  bookCover: { width: 58, height: 78, borderRadius: 6, resizeMode: 'cover' },
  premiumBanner: { borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  letter: { minWidth: 42, height: 38, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pageControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  dictionaryRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  statValue: { fontSize: 26, fontWeight: '900', marginTop: 8 },
  listItem: { borderWidth: 1, borderRadius: 12, padding: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleActionRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  planTitle: { fontSize: 22, fontWeight: '900' },
  planPrice: { fontSize: 30, fontWeight: '900', marginVertical: 8 },
  featureLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginVertical: 5 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authHero: { alignItems: 'center', paddingVertical: 22 },
  authLogo: { width: 86, height: 86, resizeMode: 'contain', marginBottom: 10 },
})
