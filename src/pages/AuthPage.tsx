import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, Mail, Lock, User, Check, BriefcaseBusiness, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { supabase, hasSupabaseConfig } from '../supabase'
import { Logo } from '../components/Logo'

type AuthMode = 'signin' | 'signup' | 'forgot'

interface AuthPageProps {
  onSuccess?: () => void
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

  const reset = () => {
    setError('')
    setSuccess('')
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.replace(/^#/, '?'))
    const authError = params.get('error_description') || params.get('error')
    if (authError) setError(authError)
  }, [])

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
    setLoading(true); reset()
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (err) throw err
      setSuccess('Check your email to confirm your account.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
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
          {mode !== 'forgot' ? (
            <>
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
                    onClick={() => { setMode(m); reset() }}
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
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Your password'}
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

              {/* Social buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Google', icon: 'G', enabled: true, onClick: handleGoogleAuth },
                  { label: 'Microsoft', icon: 'M', enabled: false, onClick: undefined },
                ].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    disabled={!s.enabled || oauthLoading === 'google'}
                    onClick={s.onClick}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--auth-social-bg)',
                      color: 'var(--text-sub)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: s.enabled ? 'pointer' : 'not-allowed',
                      opacity: s.enabled ? 1 : 0.6,
                    }}
                  >
                    <span style={{ fontWeight: 900, fontSize: 15 }}>{s.icon}</span>
                    {s.label === 'Google' && oauthLoading === 'google' ? 'Redirecting...' : s.label}
                  </button>
                ))}
              </div>

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
          --auth-social-bg: var(--surface);
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
          --auth-social-bg: #151a17;
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
