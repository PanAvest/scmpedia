import React, { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  CheckCircle,
  Crown,
  Database,
  Download,
  LogOut,
  Mic,
  Moon,
  RotateCcw,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  User,
  Volume2,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { TTSProvider } from '../types'
import { supabase } from '../supabase'
import {
  AUTO_READ_AI_KEY,
  DASHBOARD_HISTORY_KEY,
  DICTIONARY_MODE_KEY,
  FREE_USAGE_KEY,
  LOCAL_ENTRIES_KEY,
  SELECTED_VOICE_KEY,
  SECTOR_HISTORY_KEY,
  SETTINGS_NOTIFICATIONS_KEY,
  THEME_KEY,
  TTS_PROVIDER_KEY,
  UNIT_SYSTEM_KEY,
  readDashboardHistory,
  writeDashboardHistory,
} from '../utils'

type SettingsSection = 'general' | 'voice' | 'notifications' | 'account' | 'subscription' | 'privacy' | 'advanced'
type UnitSystem = 'metric' | 'imperial'

interface SettingsPageProps {
  user: SupabaseUser | null
  isPremium: boolean
  authLoading?: boolean
  darkMode: boolean
  setDarkMode: (v: boolean) => void
  ttsProvider: TTSProvider
  setTtsProvider: (v: TTSProvider) => void
  onTestVoice: (text: string) => void
  speakingId?: string | null
  preparingId?: string | null
  voices: SpeechSynthesisVoice[]
  selectedVoiceURI: string
  setSelectedVoiceURI: (v: string) => void
  autoReadAi: boolean
  setAutoReadAi: (v: boolean) => void
  dictionaryMode: boolean
  setDictionaryMode: (v: boolean) => void
  onSignOut: () => void
  onOpenPricing: () => void
}

const SECTIONS: Array<{ slug: SettingsSection; icon: LucideIcon; label: string; desc: string }> = [
  { slug: 'general', icon: SettingsIcon, label: 'General', desc: 'Appearance and dictionary behavior' },
  { slug: 'voice', icon: Volume2, label: 'Voice & Audio', desc: 'Reading voice and playback defaults' },
  { slug: 'notifications', icon: Bell, label: 'Notifications', desc: 'Browser alerts on this device' },
  { slug: 'account', icon: User, label: 'Account', desc: 'Profile and sign-in actions' },
  { slug: 'subscription', icon: Crown, label: 'Subscription', desc: 'Plan status and premium access' },
  { slug: 'privacy', icon: Shield, label: 'Privacy & Data', desc: 'Local history and device data' },
  { slug: 'advanced', icon: SlidersHorizontal, label: 'Advanced', desc: 'Reset and cache tools' },
]

const DEFAULT_NOTIFICATIONS = {
  browser: false,
  dictionaryUpdates: true,
  productUpdates: true,
  studyReminders: false,
}

const NOTIFICATION_ROWS: Array<[keyof typeof DEFAULT_NOTIFICATIONS, string, string]> = [
  ['dictionaryUpdates', 'Dictionary updates', 'New and revised supply chain terms.'],
  ['productUpdates', 'Product updates', 'Changes to SCMpedia features and tools.'],
  ['studyReminders', 'Study reminders', 'Occasional reminders to continue learning.'],
]

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function writeStored<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

function ToggleSwitch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      style={{
        width: 46,
        height: 26,
        borderRadius: 999,
        background: checked ? 'var(--primary)' : 'var(--border)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        opacity: disabled ? 0.65 : 1,
        flexShrink: 0,
      }}
    >
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: checked ? 23 : 3, transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.24)' }} />
    </button>
  )
}

function SettingsCard({ icon: Icon, title, desc, children }: { icon: LucideIcon; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="card settings-card">
      <div className="settings-card-icon"><Icon size={22} /></div>
      <div style={{ minWidth: 0 }}>
        <h3>{title}</h3>
        <p>{desc}</p>
        {children}
      </div>
    </section>
  )
}

function PreferenceRow({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <strong>{title}</strong>
        <span>{desc}</span>
      </div>
      {children}
    </div>
  )
}

function activeSectionFromParam(section?: string): SettingsSection {
  return SECTIONS.some((item) => item.slug === section) ? section as SettingsSection : 'general'
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  isPremium,
  authLoading = false,
  darkMode,
  setDarkMode,
  ttsProvider,
  setTtsProvider,
  onTestVoice,
  speakingId,
  preparingId,
  voices,
  selectedVoiceURI,
  setSelectedVoiceURI,
  autoReadAi,
  setAutoReadAi,
  dictionaryMode,
  setDictionaryMode,
  onSignOut,
  onOpenPricing,
}) => {
  const params = useParams()
  // Dark mode & read-aloud are premium — but don't show the locked state until auth settles,
  // so a subscriber deep-linking to /settings never flashes the upgrade prompt.
  const premiumLocked = !isPremium && !authLoading
  const activeSection = activeSectionFromParam(params.section)
  const activeMeta = SECTIONS.find((item) => item.slug === activeSection) ?? SECTIONS[0]!
  const [notice, setNotice] = useState('')
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>(() => localStorage.getItem(UNIT_SYSTEM_KEY) === 'imperial' ? 'imperial' : 'metric')
  const [notifications, setNotifications] = useState(() => readStored(SETTINGS_NOTIFICATIONS_KEY, DEFAULT_NOTIFICATIONS))
  const [historyVersion, setHistoryVersion] = useState(0)
  const notificationSupported = typeof window !== 'undefined' && 'Notification' in window
  const history = useMemo(() => readDashboardHistory(), [historyVersion])
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'SCMpedia user'
  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Not signed in'
  const studentMeta = (user?.user_metadata || {}) as Record<string, unknown>
  const studentCountry = String(studentMeta.student_country || '')
  const studentUniversity = String(studentMeta.student_university || '')
  const studentIndexNumber = String(studentMeta.student_index_number || '')
  const studentProgramme = String(studentMeta.student_programme || '')
  const isTestingVoice = speakingId === 'settings-voice-test' || preparingId === 'settings-voice-test'

  const setUnitSystem = (next: UnitSystem) => {
    setUnitSystemState(next)
    localStorage.setItem(UNIT_SYSTEM_KEY, next)
    setNotice(`Units changed to ${next === 'metric' ? 'Metric (SI)' : 'Imperial'}.`)
  }

  const updateNotifications = async (key: keyof typeof DEFAULT_NOTIFICATIONS, value: boolean) => {
    if (key === 'browser' && value) {
      if (!notificationSupported) {
        setNotice('This browser does not support notifications.')
        return
      }
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission
      if (permission !== 'granted') {
        setNotice('Browser notification permission was not granted.')
        return
      }
    }
    const next = { ...notifications, [key]: value }
    setNotifications(next)
    writeStored(SETTINGS_NOTIFICATIONS_KEY, next)
    setNotice('Notification preferences saved on this device.')
  }

  const sendTestNotification = () => {
    if (!notificationSupported || Notification.permission !== 'granted') {
      setNotice('Enable browser notifications first.')
      return
    }
    new Notification('SCMpedia notifications are working', {
      body: 'You will receive alerts based on the preferences selected here.',
      icon: '/logo2.png',
    })
    setNotice('Test notification sent.')
  }

  const sendPasswordReset = async () => {
    if (!user?.email) return
    if (!supabase) {
      setNotice('Authentication is not configured in this environment.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    setNotice(error ? error.message : `Password reset email sent to ${user.email}.`)
  }

  const exportLocalData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      searchHistory: readDashboardHistory(),
      settings: {
        theme: localStorage.getItem(THEME_KEY) || 'system',
        voiceProvider: (localStorage.getItem(TTS_PROVIDER_KEY) || 'elevenlabs') === 'browser' ? 'Browser Voice' : 'Prof Douglas Boateng Voice',
        selectedVoice: localStorage.getItem(SELECTED_VOICE_KEY) || '',
        autoReadAi: localStorage.getItem(AUTO_READ_AI_KEY) === 'true',
        dictionaryMode: localStorage.getItem(DICTIONARY_MODE_KEY) === 'true',
        notifications,
        unitSystem,
      },
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'scmpedia-settings-export.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('Local settings export created.')
  }

  const clearSearchHistory = () => {
    writeDashboardHistory([])
    setHistoryVersion((v) => v + 1)
    setNotice('Search history cleared.')
  }

  const clearImportedDictionaryCache = () => {
    if (!window.confirm('Clear locally imported dictionary entries from this device?')) return
    localStorage.removeItem(LOCAL_ENTRIES_KEY)
    setNotice('Local imported dictionary cache cleared. Refresh to reload the current database.')
  }

  const resetPreferences = () => {
    localStorage.removeItem(THEME_KEY)
    localStorage.removeItem(TTS_PROVIDER_KEY)
    localStorage.removeItem(SELECTED_VOICE_KEY)
    localStorage.removeItem(AUTO_READ_AI_KEY)
    localStorage.removeItem(DICTIONARY_MODE_KEY)
    localStorage.removeItem(UNIT_SYSTEM_KEY)
    localStorage.removeItem(SETTINGS_NOTIFICATIONS_KEY)
    setDarkMode(false)
    setTtsProvider('elevenlabs')
    setSelectedVoiceURI('')
    setAutoReadAi(false)
    setDictionaryMode(false)
    setUnitSystemState('metric')
    setNotifications(DEFAULT_NOTIFICATIONS)
    setNotice('Preferences reset. Prof Douglas Boateng Voice is the default voice, and auto-read is off.')
  }

  const clearLearningRotation = () => {
    localStorage.removeItem(SECTOR_HISTORY_KEY)
    setNotice('Example-sector rotation cleared.')
  }

  const clearFreeUsageCounter = () => {
    localStorage.removeItem(FREE_USAGE_KEY)
    setNotice('Daily free usage counter cleared on this device.')
  }

  const sectionContent = {
    general: (
      <div className="settings-card-grid">
        <SettingsCard icon={Moon} title="Appearance" desc="Choose how SCMpedia looks on this device.">
          <PreferenceRow title="Dark mode" desc="Use a darker interface for lower-light reading.">
            {premiumLocked ? (
              <button onClick={onOpenPricing} className="btn btn-premium btn-sm"><Crown size={13} /> Premium</button>
            ) : (
              <ToggleSwitch checked={darkMode} onChange={setDarkMode} label="Toggle dark mode" />
            )}
          </PreferenceRow>
        </SettingsCard>

        <SettingsCard icon={BookOpen} title="Dictionary Behavior" desc="Control how the dictionary opens from the main menu.">
          <PreferenceRow title="Open full dictionary mode" desc="The Dictionary menu opens the full book-style dictionary page.">
            <ToggleSwitch checked={dictionaryMode} onChange={setDictionaryMode} label="Toggle dictionary mode preference" />
          </PreferenceRow>
          <Link to={dictionaryMode ? '/dictionary-mode' : '/dictionary'} className="btn btn-outline btn-sm" style={{ marginTop: 14 }}>
            Open dictionary
          </Link>
        </SettingsCard>

        <SettingsCard icon={Search} title="Search History" desc="Recent searches power the dashboard activity panels.">
          <div className="settings-metric-row">
            <span><strong>{history.length}</strong> saved searches</span>
            <button onClick={clearSearchHistory} className="btn btn-outline btn-sm"><Trash2 size={14} />Clear</button>
          </div>
        </SettingsCard>

        <SettingsCard icon={SlidersHorizontal} title="Units" desc="Choose the unit system used in examples and future tools.">
          <div className="settings-segment">
            <button onClick={() => setUnitSystem('metric')} className={unitSystem === 'metric' ? 'active' : ''}>Metric (SI)</button>
            <button onClick={() => setUnitSystem('imperial')} className={unitSystem === 'imperial' ? 'active' : ''}>Imperial</button>
          </div>
        </SettingsCard>
      </div>
    ),

    voice: premiumLocked ? (
      <div className="settings-card-grid">
        <SettingsCard icon={Volume2} title="Reading Voice" desc="Listen to definitions and AI explanations read aloud.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <p style={{ fontSize: 14, color: 'var(--text-sub)', margin: 0, lineHeight: 1.6 }}>
              Read-aloud narration is a premium feature. Upgrade to hear definitions and AI explanations in the Prof Douglas Boateng voice.
            </p>
            <button onClick={onOpenPricing} className="btn btn-premium btn-sm"><Crown size={14} /> Explore Premium</button>
          </div>
        </SettingsCard>
      </div>
    ) : (
      <div className="settings-card-grid">
        <SettingsCard icon={Volume2} title="Reading Voice" desc="Controls the voice used everywhere in SCMpedia — dictionary word buttons, dictionary mode reading, and AI explanations.">
          <div className="settings-choice-stack">
            <button onClick={() => setTtsProvider('elevenlabs')} className={ttsProvider === 'elevenlabs' ? 'active' : ''}>
              <strong>Prof Douglas Boateng Voice</strong>
              <span>Natural recorded-style narration for SCMpedia learning.</span>
            </button>
            <button onClick={() => setTtsProvider('browser')} className={ttsProvider === 'browser' ? 'active' : ''}>
              <strong>Browser Voice</strong>
              <span>Uses the built-in voice available on this device.</span>
            </button>
          </div>
          <button
            onClick={() => onTestVoice('SCMpedia helps supply chain professionals understand important terms clearly and quickly.')}
            className="btn btn-primary btn-sm"
            style={{ marginTop: 14 }}
          >
            <Mic size={14} />{isTestingVoice ? 'Playing...' : 'Test selected voice'}
          </button>
        </SettingsCard>

        <SettingsCard icon={Mic} title="Browser Voice" desc="The voice used for dictionary word reading and AI explanations when Browser Voice is selected or as a fallback.">
          <select
            value={selectedVoiceURI}
            onChange={(e) => setSelectedVoiceURI(e.target.value)}
            style={{ width: '100%', padding: '13px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)' }}
          >
            {voices.length ? voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>) : <option value="">Browser default voice</option>}
          </select>
        </SettingsCard>

        <SettingsCard icon={BookOpen} title="AI Reading" desc="Automatically read AI explanations when they are generated.">
          <PreferenceRow title="Auto-read AI insights" desc="When enabled, the answer is read aloud once the AI explanation loads.">
            <ToggleSwitch checked={autoReadAi} onChange={setAutoReadAi} label="Toggle auto-read AI insights" />
          </PreferenceRow>
        </SettingsCard>

        <SettingsCard icon={CheckCircle} title="Current Voice Status" desc="The selected voice is saved locally and applies across SCMpedia.">
          <div className="settings-status-box">
            <strong>{ttsProvider === 'elevenlabs' ? 'Prof Douglas Boateng Voice' : 'Browser Voice'}</strong>
            <span>{ttsProvider === 'elevenlabs' ? 'Default voice selected' : 'Device voice selected'}</span>
          </div>
        </SettingsCard>
      </div>
    ),

    notifications: (
      <div className="settings-card-grid">
        <SettingsCard icon={Bell} title="Browser Notifications" desc="Use this device's notification system for SCMpedia alerts.">
          <PreferenceRow title="Enable browser notifications" desc={notificationSupported ? `Current browser permission: ${Notification.permission}` : 'Notifications are not supported in this browser.'}>
            <ToggleSwitch checked={notifications.browser} onChange={(v) => void updateNotifications('browser', v)} disabled={!notificationSupported} label="Toggle browser notifications" />
          </PreferenceRow>
          <button onClick={sendTestNotification} className="btn btn-outline btn-sm" style={{ marginTop: 14 }}>Send test notification</button>
        </SettingsCard>

        <SettingsCard icon={BookOpen} title="Learning Alerts" desc="Choose which SCMpedia updates this device should surface.">
          {NOTIFICATION_ROWS.map(([key, title, desc]) => (
            <PreferenceRow key={key} title={title} desc={desc}>
              <ToggleSwitch checked={Boolean(notifications[key])} onChange={(v) => void updateNotifications(key, v)} label={`Toggle ${title}`} />
            </PreferenceRow>
          ))}
        </SettingsCard>
      </div>
    ),

    account: (
      <div className="settings-card-grid">
        <SettingsCard icon={User} title="Profile" desc="Your signed-in SCMpedia account information.">
          {user ? (
            <div className="settings-profile">
              <div><span>Name</span><strong>{displayName}</strong></div>
              <div><span>Email</span><strong>{user.email}</strong></div>
              <div><span>Member since</span><strong>{memberSince}</strong></div>
              <div><span>User ID</span><strong>{user.id}</strong></div>
              {studentCountry ? <div><span>Country</span><strong>{studentCountry}</strong></div> : null}
              {studentUniversity ? <div><span>University</span><strong>{studentUniversity}</strong></div> : null}
              {studentIndexNumber ? <div><span>Student index</span><strong>{studentIndexNumber}</strong></div> : null}
              {studentProgramme ? <div><span>Programme</span><strong>{studentProgramme}</strong></div> : null}
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-sub)', fontSize: 14, marginBottom: 14 }}>Sign in to manage account details.</p>
              <Link to="/auth" className="btn btn-primary btn-sm">Sign in</Link>
            </div>
          )}
        </SettingsCard>

        <SettingsCard icon={Shield} title="Security" desc="Manage account access.">
          {user ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={sendPasswordReset} className="btn btn-outline btn-sm">Send password reset email</button>
              <button onClick={onSignOut} className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }}><LogOut size={14} />Sign out</button>
            </div>
          ) : (
            <Link to="/auth" className="btn btn-primary btn-sm">Sign in to continue</Link>
          )}
        </SettingsCard>
      </div>
    ),

    subscription: (
      <div className="settings-card-grid">
        <SettingsCard icon={Crown} title="Current Plan" desc="Your plan controls search limits and premium learning features.">
          <div style={{ border: '1px solid rgba(20,174,92,0.25)', background: 'rgba(20,174,92,0.08)', borderRadius: 10, padding: 16 }}>
            <strong style={{ color: 'var(--text-main)', fontSize: 18 }}>{isPremium ? 'Premium Plan' : 'Free Plan'}</strong>
            <span className="badge badge-success" style={{ marginLeft: 8 }}>Active</span>
            <p style={{ color: 'var(--text-sub)', fontSize: 13, marginTop: 8 }}>
              {isPremium ? 'Full access is enabled for this account.' : 'Upgrade for unlimited search, advanced explanations, and premium learning tools.'}
            </p>
          </div>
          <button onClick={onOpenPricing} className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>{isPremium ? 'Manage plan' : 'View premium plans'}</button>
        </SettingsCard>

        <SettingsCard icon={CheckCircle} title="Plan Features" desc="Feature availability for your current account.">
          {[
            ['Dictionary search', true],
            ['Saved terms', true],
            ['Prof Douglas Boateng Voice', true],
            ['Dictionary mode', isPremium],
            ['Advanced AI insights', isPremium],
          ].map(([label, enabled]) => (
            <div key={String(label)} className="settings-feature-line">
              <CheckCircle size={15} color={enabled ? 'var(--success-green)' : 'var(--text-sub)'} />
              <span>{label}</span>
              <small>{enabled ? 'Enabled' : 'Premium'}</small>
            </div>
          ))}
        </SettingsCard>
      </div>
    ),

    privacy: (
      <div className="settings-card-grid">
        <SettingsCard icon={Shield} title="Local Data" desc="These actions affect data stored on this browser only.">
          <div className="settings-action-list">
            <button onClick={exportLocalData} className="btn btn-outline btn-sm"><Download size={14} />Export local data</button>
            <button onClick={clearSearchHistory} className="btn btn-outline btn-sm"><Trash2 size={14} />Clear search history</button>
            <button onClick={resetPreferences} className="btn btn-outline btn-sm"><RotateCcw size={14} />Reset preferences</button>
          </div>
        </SettingsCard>

        <SettingsCard icon={Search} title="Search History" desc="Dashboard activity uses this local history.">
          {history.length ? (
            <div className="settings-history-list">
              {history.slice(0, 6).map((item) => (
                <span key={`${item.term}-${item.at}`}>{item.term}</span>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-sub)', fontSize: 14 }}>No local search history stored.</div>
          )}
        </SettingsCard>
      </div>
    ),

    advanced: (
      <div className="settings-card-grid">
        <SettingsCard icon={Database} title="Dictionary Cache" desc="Manage locally imported dictionary data on this device.">
          <div className="settings-action-list">
            <button onClick={clearImportedDictionaryCache} className="btn btn-outline btn-sm"><Trash2 size={14} />Clear imported dictionary cache</button>
            <button onClick={clearLearningRotation} className="btn btn-outline btn-sm"><RotateCcw size={14} />Reset example rotation</button>
            <button onClick={clearFreeUsageCounter} className="btn btn-outline btn-sm"><RotateCcw size={14} />Reset free daily counter</button>
          </div>
        </SettingsCard>

        <SettingsCard icon={RotateCcw} title="Reset SCMpedia" desc="Return interface preferences to the app defaults.">
          <p style={{ color: 'var(--text-sub)', fontSize: 13, marginBottom: 14 }}>
            This keeps your account and favorites intact. It resets theme, voice, notifications, unit preferences, and dictionary menu behavior on this browser.
          </p>
          <button onClick={resetPreferences} className="btn btn-outline btn-sm"><RotateCcw size={14} />Reset preferences</button>
        </SettingsCard>
      </div>
    ),
  } satisfies Record<SettingsSection, React.ReactNode>

  return (
    <div style={{ background: 'var(--bg)', minHeight: 'calc(100vh - 64px)' }}>
      <div className="settings-shell">
        <aside className="settings-side">
          <h1>Settings</h1>
          <nav className="settings-nav" aria-label="Settings sections">
            {SECTIONS.map(({ icon: Icon, label, slug }) => (
              <Link key={slug} to={`/settings/${slug}`} className={activeSection === slug ? 'active' : ''}>
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          {!isPremium && (
            <div className="card settings-premium-card">
              <div><Crown size={18} />Go Premium</div>
              <p>Unlock advanced AI insights, unlimited searches, dictionary mode access, and more.</p>
              <button onClick={onOpenPricing} className="btn btn-premium btn-sm">Explore Premium</button>
            </div>
          )}
        </aside>

        <main className="settings-main">
          <div className="settings-heading">
            <div>
              <h2>{activeMeta.label}</h2>
              <p>{activeMeta.desc}</p>
            </div>
            {notice && <div className="settings-notice">{notice}</div>}
          </div>

          {sectionContent[activeSection]}
        </main>
      </div>
    </div>
  )
}
