import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, Mail, Lock, User, Check, BriefcaseBusiness, ShieldCheck, Sparkles, TrendingUp, MailCheck, RefreshCw, Clock } from 'lucide-react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase, hasSupabaseConfig } from '../supabase'
import { Logo } from '../components/Logo'

type AuthMode = 'signin' | 'signup' | 'forgot'

interface AuthPageProps {
  onSuccess?: () => void
}

// Where Supabase drops the user after they click the link in the confirmation email. It has to be
// on the Redirect URLs allow-list in the Supabase dashboard or Supabase silently falls back to the
// Site URL (the homepage), which is exactly what we're trying to avoid.
//
// No query string: the email template appends its own (`{{ .RedirectTo }}?token_hash=…`), and two
// `?` in one URL would break the link. Using .RedirectTo rather than a hardcoded {{ .SiteURL }} is
// what keeps a localhost signup's confirmation link pointing back at localhost.
export const CONFIRM_REDIRECT_PARAM = 'confirmed'
const confirmRedirectUrl = () => `${window.location.origin}/auth`
export const RESET_PATH = '/auth/reset'

const isResetRoute = () =>
  typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === RESET_PATH

// Read once, at module eval, off the landing URL — then scrub the token out of the address bar
// immediately. A token_hash sitting in the query string (unlike the URL fragment it replaces) is
// sent to servers in the Referer header and written to browser history and hosting access logs, so
// it must not survive a single network call.
const emailCallback = (() => {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const reset = isResetRoute()
  if (!reset && params.get(CONFIRM_REDIRECT_PARAM) !== '1') return null

  const tokenHash = params.get('token_hash') || ''
  const type = (params.get('type') || (reset ? 'recovery' : 'signup')) as EmailOtpType
  if (tokenHash) {
    window.history.replaceState({}, '', reset ? RESET_PATH : `/auth?${CONFIRM_REDIRECT_PARAM}=1`)
  }
  return { tokenHash, type, reset }
})()

const confirmCallback = emailCallback?.reset ? null : emailCallback

// Supabase splits its callback payload across the query string (?code=, ?error=) and the hash
// (#access_token=, #error=) depending on the flow, so read both.
const readAuthParams = () => {
  const params = new URLSearchParams(window.location.search)
  new URLSearchParams(window.location.hash.replace(/^#/, '')).forEach((value, key) => params.set(key, value))
  return params
}

// Verifying the address also mints a session and drops the tokens in the URL. We take the address
// off that session and then sign it out: the tokens are revoked rather than left live in browser
// history, and the sign-in form we land them on is real rather than decorative.
//
// Module-scoped so React 18 StrictMode's double-invoked effect reuses the same promise instead of
// firing a second /logout — a component ref is recreated on the StrictMode remount and would not.
let confirmSettlement: Promise<string> | null = null

const settleConfirmation = async (): Promise<string> => {
  if (!supabase) return ''

  // The email links here directly with a token_hash instead of bouncing through Supabase's
  // /auth/v1/verify. That endpoint is a GET that burns the single-use token server-side, so any mail
  // scanner that follows links (Outlook Safe Links does) consumed the token before the user ever
  // clicked. Verifying from JS means a scanner fetching the page can't spend it.
  if (confirmCallback?.tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: confirmCallback.tokenHash,
      type: confirmCallback.type,
    })
    if (error) throw error
    const confirmedEmail = data.session?.user?.email ?? data.user?.email ?? ''
    if (data.session) await supabase.auth.signOut()
    return confirmedEmail
  }

  // Fallback: the older {{ .ConfirmationURL }} flow, which arrives with tokens in the URL fragment.
  // getSession() resolves only once auth-js has finished reading them out of the URL.
  const { data } = await supabase.auth.getSession()
  const confirmedEmail = data.session?.user?.email ?? ''
  if (data.session) await supabase.auth.signOut()
  return confirmedEmail
}

// The recovery link's token is what authorises updateUser({ password }) — verifyOtp mints a session
// and that session IS the credential. So unlike the signup flow, we must NOT sign out here; we sign
// out only after the new password has been saved.
let recoverySettlement: Promise<string> | null = null

const settleRecovery = async (): Promise<string> => {
  if (!supabase) return ''

  if (emailCallback?.tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: emailCallback.tokenHash,
      type: emailCallback.type,
    })
    if (error) throw error
    return data.session?.user?.email ?? data.user?.email ?? ''
  }

  // Older recovery links arrive with the session in the URL fragment instead of a token_hash.
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('This password reset link is no longer valid.')
  return data.session.user?.email ?? ''
}

const friendlyAuthError = (params: URLSearchParams) => {
  const code = params.get('error_code')
  const description = params.get('error_description') || params.get('error') || ''
  if (code === 'otp_expired' || /expired/i.test(description)) {
    return 'That confirmation link has expired. Enter your email below and we\'ll send you a fresh one.'
  }
  return description.replace(/\+/g, ' ')
}

const VALUE_POINTS = [
  { icon: Sparkles, title: 'AI-Powered Insights', desc: 'Get intelligent explanations tailored for supply chain context' },
  { icon: BriefcaseBusiness, title: 'Built for Supply Chain Pros', desc: '10,000+ terms curated by industry experts' },
  { icon: TrendingUp, title: 'Learn. Apply. Advance.', desc: 'Contextual examples drawn from real-world logistics scenarios' },
  { icon: ShieldCheck, title: 'Trusted by Professionals', desc: 'Join 25,000+ supply chain professionals worldwide' },
]

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e']
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']

  if (!password) return null
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 99,
              background: i <= score ? colors[score] : 'var(--border)',
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, color: score >= 3 ? 'var(--success-green)' : 'var(--text-sub)' }}>
        {labels[score]}
      </span>
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.35 0-4.34-1.58-5.05-3.72H.94v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.34 2.82.94 4.03l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.66 8.66 0 0 0 9 0 9 9 0 0 0 .94 4.97L3.95 7.3C4.66 5.16 6.65 3.58 9 3.58z" />
    </svg>
  )
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null)
  const [sentTo, setSentTo] = useState('')
  const [resending, setResending] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [confirming, setConfirming] = useState(() => {
    if (isResetRoute()) return false
    const params = readAuthParams()
    return params.get(CONFIRM_REDIRECT_PARAM) === '1' && !params.has('error') && !params.has('error_description')
  })

  // Password-recovery landing (/auth/reset)
  const [onResetRoute] = useState(isResetRoute)
  const [recovering, setRecovering] = useState(() => {
    if (!isResetRoute()) return false
    const params = readAuthParams()
    return !params.has('error') && !params.has('error_description')
  })
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordUpdated, setPasswordUpdated] = useState(false)

  const reset = () => {
    setError('')
    setSuccess('')
  }

  useEffect(() => {
    const params = readAuthParams()
    if (params.has('error') || params.has('error_description')) setError(friendlyAuthError(params))
  }, [])

  // Landing back from the confirmation email.
  useEffect(() => {
    if (!confirming) return
    let cancelled = false

    confirmSettlement = confirmSettlement ?? settleConfirmation()
    confirmSettlement
      .then((confirmedEmail) => {
        if (cancelled) return
        if (confirmedEmail) setEmail(confirmedEmail)
        setConfirmed(true)
      })
      .catch((err: unknown) => {
        // An expired or already-spent link lands here. Say so, and leave them somewhere they can act.
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        setError(/expired|invalid|not found/i.test(message)
          ? 'That confirmation link has expired or has already been used. Sign in, or sign up again to get a fresh one.'
          : message || 'We could not confirm that link.')
      })
      .finally(() => {
        if (cancelled) return
        setMode('signin')
        setConfirming(false)
        // Drop ?confirmed=1 so a refresh is an ordinary visit to the sign-in page.
        window.history.replaceState({}, '', '/auth')
      })

    return () => { cancelled = true }
  }, [confirming])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasSupabaseConfig || !supabase) { setError('Auth not configured.'); return }
    setLoading(true); reset()
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      onSuccess?.()
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasSupabaseConfig || !supabase) { setError('Auth not configured.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Those passwords do not match'); return }
    setLoading(true); reset()
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: confirmRedirectUrl() },
      })
      if (err) throw err

      // "Confirm email" is off in the Supabase dashboard: no email is sent and they are already in.
      if (data.session) {
        onSuccess?.()
        navigate('/')
        return
      }

      // Supabase returns an obfuscated user with no identities when the address is already taken,
      // rather than leaking that the account exists. Don't promise an email that isn't coming.
      if (data.user && data.user.identities?.length === 0) {
        setError('That email is already registered. Sign in instead, or reset your password.')
        return
      }

      setSentTo(email)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!hasSupabaseConfig || !supabase || !sentTo) return
    setResending(true); reset()
    try {
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email: sentTo,
        options: { emailRedirectTo: confirmRedirectUrl() },
      })
      if (err) throw err
      setSuccess('Sent again — give it a minute, then check your spam folder too.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend the email')
    } finally {
      setResending(false)
    }
  }

  // Exchange the recovery token for the session that authorises the password change.
  useEffect(() => {
    if (!recovering) return
    let cancelled = false

    recoverySettlement = recoverySettlement ?? settleRecovery()
    recoverySettlement
      .then((email) => {
        if (cancelled) return
        setRecoveryEmail(email)
        setRecoveryReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        setError(/expired|invalid|not found|no longer valid/i.test(message)
          ? 'This password reset link has expired or has already been used. Request a new one below.'
          : message || 'We could not verify that reset link.')
      })
      .finally(() => {
        if (!cancelled) setRecovering(false)
      })

    return () => { cancelled = true }
  }, [recovering])

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasSupabaseConfig || !supabase) { setError('Auth not configured.'); return }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setError('Those passwords do not match'); return }

    setLoading(true); reset()
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword })
      if (err) throw err
      // Sign the recovery session out so the new password has to be used to get back in — and so a
      // recovery link that leaked (mail forward, shared inbox) does not leave a live session behind.
      await supabase.auth.signOut()
      setPasswordUpdated(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update your password')
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasSupabaseConfig || !supabase) { setError('Auth not configured.'); return }
    setLoading(true); reset()
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth/reset',
      })
      if (err) throw err
      setSuccess('Password reset link sent to your email.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    if (!hasSupabaseConfig || !supabase) {
      setError('Auth not configured.')
      return
    }
    reset()
    setOauthLoading('google')
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (err) throw err
    } catch (err: unknown) {
      setOauthLoading(null)
      setError(err instanceof Error ? err.message : 'Google sign in failed')
    }
  }

  return (
    <div className="auth-page" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left panel */}
      <div
        className="hide-mobile"
        style={{
          width: 480,
          flexShrink: 0,
          background: 'var(--auth-left-bg)',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 40px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Back link */}
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: 'rgba(255,255,255,0.7)',
            textDecoration: 'none',
            marginBottom: 48,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
        >
          <ArrowLeft size={14} />
          Back to site
        </Link>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
          <Logo variant="white" style={{ width: 190 }} />
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.2, margin: '0 0 12px' }}>
          Welcome to<br />SCMpedia
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: '0 0 48px', maxWidth: 340 }}>
          The AI-powered dictionary and learning platform built for supply chain professionals.
        </p>

        {/* Decorative letter */}
        <div
          style={{
            fontSize: 260,
            fontWeight: 900,
            color: 'rgba(255,255,255,0.04)',
            lineHeight: 1,
            position: 'absolute',
            right: -40,
            bottom: 120,
            userSelect: 'none',
            letterSpacing: '-0.05em',
          }}
        >
          S
        </div>

        {/* Value points */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', zIndex: 1 }}>
          {VALUE_POINTS.map((pt) => {
            const Icon = pt.icon
            return (
            <div key={pt.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.8)',
                  flexShrink: 0,
                }}
              >
                <Icon size={16} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{pt.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{pt.desc}</div>
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* Right panel */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          background: 'var(--auth-right-bg)',
          overflowY: 'auto',
        }}
      >
        {/* Mobile back link */}
        <div className="hide-desktop" style={{ width: '100%', maxWidth: 420, marginBottom: 24 }}>
          <Link
            to="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-sub)', textDecoration: 'none' }}
          >
            <ArrowLeft size={14} />
            Back to site
          </Link>
        </div>

        {/* Mobile logo */}
        <div className="hide-desktop" style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <Logo variant="default" style={{ width: 176 }} />
        </div>

        <div style={{ width: '100%', maxWidth: 420 }}>
          {onResetRoute ? (
            passwordUpdated ? (
              <div>
                <div className="auth-badge" aria-hidden="true">
                  <ShieldCheck size={22} />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px' }}>
                  Password updated
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, margin: '0 0 24px' }}>
                  You've been signed out everywhere. Sign in with your new password to continue.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 15 }}
                >
                  Go to sign in
                </button>
              </div>
            ) : recovering ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div className="auth-badge auth-badge-spin" aria-hidden="true">
                  <RefreshCw size={22} />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px' }}>
                  Checking your reset link…
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: 0 }}>One moment.</p>
              </div>
            ) : recoveryReady ? (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px' }}>
                  Choose a new password
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: '0 0 24px' }}>
                  {recoveryEmail
                    ? <>Setting a new password for <strong style={{ color: 'var(--text-main)' }}>{recoveryEmail}</strong>.</>
                    : 'Pick something you haven\'t used before.'}
                </p>

                <form onSubmit={handleSetNewPassword}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                      New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} color="var(--text-sub)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        className="auth-input"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); if (error) setError('') }}
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                        required
                        style={{
                          width: '100%',
                          padding: '11px 40px 11px 36px',
                          borderRadius: 8,
                          border: '1px solid var(--auth-input-border)',
                          background: 'var(--auth-input-bg)',
                          color: 'var(--text-main)',
                          fontSize: 14,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-sub)',
                          display: 'flex',
                          padding: 4,
                        }}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <PasswordStrength password={newPassword} />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                      Confirm New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} color="var(--text-sub)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        className="auth-input"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError('') }}
                        placeholder="Re-enter your new password"
                        autoComplete="new-password"
                        required
                        style={{
                          width: '100%',
                          padding: '11px 12px 11px 36px',
                          borderRadius: 8,
                          border: '1px solid var(--auth-input-border)',
                          background: 'var(--auth-input-bg)',
                          color: 'var(--text-main)',
                          fontSize: 14,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {error && (
                    <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--error)', marginBottom: 16 }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 15 }}
                  >
                    {loading ? 'Saving…' : 'Update password'}
                  </button>
                </form>
              </>
            ) : (
              <div>
                <div className="auth-badge" aria-hidden="true">
                  <Clock size={22} />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px' }}>
                  This link is no longer valid
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, margin: '0 0 20px' }}>
                  {error || 'Password reset links expire after one hour and can only be used once.'}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 15 }}
                >
                  Back to sign in
                </button>
              </div>
            )
          ) : confirming ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div className="auth-badge auth-badge-spin" aria-hidden="true">
                <RefreshCw size={22} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px' }}>
                Confirming your email…
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: 0 }}>One moment.</p>
            </div>
          ) : sentTo ? (
            <div>
              <div className="auth-badge" aria-hidden="true">
                <MailCheck size={22} />
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px' }}>
                Check your inbox
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6, margin: '0 0 20px' }}>
                We sent a confirmation link to <strong style={{ color: 'var(--text-main)' }}>{sentTo}</strong>.
                Click it to verify your address — you'll land back here to sign in.
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  fontSize: 12.5,
                  color: 'var(--text-sub)',
                  marginBottom: 20,
                }}
              >
                <Clock size={14} style={{ flexShrink: 0 }} />
                The link expires in 1 hour.
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--error)', marginBottom: 16 }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ padding: '10px 14px', background: 'rgba(20,174,92,0.10)', border: '1px solid rgba(20,174,92,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--success-green)', marginBottom: 16 }}>
                  {success}
                </div>
              )}

              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center', gap: 8, height: 44, fontSize: 14, marginBottom: 14 }}
              >
                <RefreshCw size={15} />
                {resending ? 'Sending…' : 'Resend confirmation email'}
              </button>

              <p style={{ fontSize: 13, color: 'var(--text-sub)', textAlign: 'center', margin: 0 }}>
                Wrong address?{' '}
                <button
                  type="button"
                  onClick={() => { setSentTo(''); setMode('signup'); reset() }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}
                >
                  Start over
                </button>
              </p>
            </div>
          ) : mode !== 'forgot' ? (
            <>
              {confirmed && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(20,174,92,0.10)',
                    border: '1px solid rgba(20,174,92,0.25)',
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'var(--success-green)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Check size={13} color="#fff" strokeWidth={3} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.5 }}>
                    <strong style={{ fontWeight: 700 }}>Email confirmed.</strong>{' '}
                    <span style={{ color: 'var(--text-sub)' }}>Sign in to get started.</span>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div
                style={{
                  display: 'flex',
                  background: 'var(--auth-tab-bg)',
                  borderRadius: 10,
                  padding: 4,
                  marginBottom: 28,
                }}
              >
                {(['signin', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setConfirmPassword(''); reset() }}
                    style={{
                      flex: 1,
                      padding: '9px 0',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      background: mode === m ? 'var(--auth-tab-active-bg)' : 'transparent',
                      color: mode === m ? 'var(--text-main)' : 'var(--text-sub)',
                      boxShadow: mode === m ? 'var(--auth-tab-shadow)' : 'none',
                    }}
                  >
                    {m === 'signin' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px' }}>
                {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: '0 0 24px' }}>
                {mode === 'signin'
                  ? 'Enter your credentials to access your account'
                  : 'Join 25,000+ supply chain professionals'}
              </p>

              <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}>
                {mode === 'signup' && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                      Full Name
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={15} color="var(--text-sub)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        className="auth-input"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your full name"
                        required
                        style={{
                          width: '100%',
                          padding: '11px 12px 11px 36px',
                          borderRadius: 8,
                          border: '1px solid var(--auth-input-border)',
                          background: 'var(--auth-input-bg)',
                          color: 'var(--text-main)',
                          fontSize: 14,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} color="var(--text-sub)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      className="auth-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      style={{
                        width: '100%',
                        padding: '11px 12px 11px 36px',
                        borderRadius: 8,
                        border: '1px solid var(--auth-input-border)',
                        background: 'var(--auth-input-bg)',
                        color: 'var(--text-main)',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: mode === 'signin' ? 8 : 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color="var(--text-sub)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      className="auth-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
                      placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Your password'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      required
                      style={{
                        width: '100%',
                        padding: '11px 40px 11px 36px',
                        borderRadius: 8,
                        border: '1px solid var(--auth-input-border)',
                        background: 'var(--auth-input-bg)',
                        color: 'var(--text-main)',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-sub)',
                        display: 'flex',
                        padding: 4,
                      }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {mode === 'signup' && <PasswordStrength password={password} />}
                </div>

                {mode === 'signup' && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                      Confirm Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} color="var(--text-sub)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        className="auth-input"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError('') }}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        required
                        aria-invalid={Boolean(confirmPassword) && confirmPassword !== password}
                        style={{
                          width: '100%',
                          padding: '11px 12px 11px 36px',
                          borderRadius: 8,
                          border: `1px solid ${confirmPassword && confirmPassword !== password ? 'var(--error)' : 'var(--auth-input-border)'}`,
                          background: 'var(--auth-input-bg)',
                          color: 'var(--text-main)',
                          fontSize: 14,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <span style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--error)' }}>
                        Passwords don't match
                      </span>
                    )}
                    {confirmPassword && confirmPassword === password && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, color: 'var(--success-green)' }}>
                        <Check size={11} strokeWidth={3} />
                        Passwords match
                      </span>
                    )}
                  </div>
                )}

                {mode === 'signin' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-sub)' }}>
                      <div
                        onClick={() => setRememberMe((v) => !v)}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: rememberMe ? 'none' : '1.5px solid var(--border)',
                          background: rememberMe ? 'var(--primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {rememberMe && <Check size={10} color="#fff" strokeWidth={3} />}
                      </div>
                      Remember me
                    </label>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); reset() }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--error)', marginBottom: 16 }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{ padding: '10px 14px', background: 'rgba(20,174,92,0.10)', border: '1px solid rgba(20,174,92,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--success-green)', marginBottom: 16 }}>
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 15 }}
                >
                  {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>or continue with</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {/* Social button */}
              <button
                type="button"
                className="auth-google-btn"
                disabled={oauthLoading === 'google'}
                onClick={handleGoogleAuth}
                aria-label={mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}
              >
                <GoogleLogo />
                <span>{oauthLoading === 'google' ? 'Redirecting...' : mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
              </button>

              <p style={{ fontSize: 12, color: 'var(--text-sub)', textAlign: 'center' }}>
                By {mode === 'signin' ? 'signing in' : 'creating an account'}, you agree to our{' '}
                <Link to="/terms" style={{ color: 'var(--primary)' }}>Terms of Service</Link> and{' '}
                <Link to="/privacy" style={{ color: 'var(--primary)' }}>Privacy Policy</Link>
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => { setMode('signin'); reset() }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-sub)', marginBottom: 24, padding: 0 }}
              >
                <ArrowLeft size={14} /> Back to sign in
              </button>

              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px' }}>Reset your password</h2>
              <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: '0 0 24px' }}>
                Enter your email and we'll send you a reset link.
              </p>

              <form onSubmit={handleForgot}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} color="var(--text-sub)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      className="auth-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      style={{
                        width: '100%',
                        padding: '11px 12px 11px 36px',
                        borderRadius: 8,
                        border: '1px solid var(--auth-input-border)',
                        background: 'var(--auth-input-bg)',
                        color: 'var(--text-main)',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {error && (
                  <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--error)', marginBottom: 16 }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{ padding: '10px 14px', background: 'rgba(20,174,92,0.10)', border: '1px solid rgba(20,174,92,0.25)', borderRadius: 8, fontSize: 13, color: 'var(--success-green)', marginBottom: 16 }}>
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: 15 }}
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <style>{`
        .auth-page {
          --auth-left-bg: var(--premium-green);
          --auth-right-bg: var(--bg);
          --auth-tab-bg: var(--surface);
          --auth-tab-active-bg: var(--card-bg);
          --auth-tab-shadow: 0 1px 4px rgba(0,0,0,0.1);
          --auth-input-bg: var(--card-bg);
          --auth-input-border: var(--border);
          --auth-placeholder: #8a918c;
          --auth-google-bg: #fff;
          --auth-google-border: #dadce0;
          --auth-google-text: #3c4043;
          --auth-google-hover: #f8fafd;
        }

        :root[data-theme="dark"] .auth-page {
          --auth-left-bg: #06483f;
          --auth-right-bg: #0f1411;
          --auth-tab-bg: #151a17;
          --auth-tab-active-bg: #202821;
          --auth-tab-shadow: 0 1px 0 rgba(255,255,255,0.04), 0 8px 22px rgba(0,0,0,0.22);
          --auth-input-bg: #171c19;
          --auth-input-border: #354039;
          --auth-placeholder: #8e998f;
          --auth-google-bg: #fff;
          --auth-google-border: #dadce0;
          --auth-google-text: #3c4043;
          --auth-google-hover: #f8fafd;
        }

        .auth-page .auth-badge {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          color: var(--pricing-green);
          background: var(--pricing-green-soft);
          border: 1px solid rgba(0, 79, 70, 0.14);
        }

        :root[data-theme="dark"] .auth-page .auth-badge {
          color: #62c7ba;
          background: rgba(98, 199, 186, 0.12);
          border-color: rgba(98, 199, 186, 0.22);
        }

        .auth-page .auth-badge-spin svg {
          animation: auth-badge-spin 900ms linear infinite;
        }

        @keyframes auth-badge-spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-page .auth-badge-spin svg { animation: none; }
        }

        .auth-page .auth-input {
          caret-color: var(--primary);
          transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
        }

        .auth-page .auth-input::placeholder {
          color: var(--auth-placeholder);
        }

        .auth-page .auth-input:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px var(--primary-bg);
        }

        .auth-page .auth-google-btn {
          width: 100%;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 20px;
          padding: 10px 16px;
          border-radius: 8px;
          border: 1px solid var(--auth-google-border);
          background: var(--auth-google-bg);
          color: var(--auth-google-text);
          font: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }

        .auth-page .auth-google-btn:hover:not(:disabled) {
          background: var(--auth-google-hover);
          box-shadow: 0 1px 2px rgba(60,64,67,0.18), 0 1px 3px rgba(60,64,67,0.12);
        }

        .auth-page .auth-google-btn:disabled {
          cursor: wait;
          opacity: 0.72;
        }

        .auth-page .auth-input:-webkit-autofill,
        .auth-page .auth-input:-webkit-autofill:hover,
        .auth-page .auth-input:-webkit-autofill:focus,
        .auth-page .auth-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px var(--auth-input-bg) inset !important;
          -webkit-text-fill-color: var(--text-main) !important;
          caret-color: var(--text-main);
          border-color: var(--auth-input-border) !important;
          transition: background-color 9999s ease-out;
        }
      `}</style>
    </div>
  )
}
