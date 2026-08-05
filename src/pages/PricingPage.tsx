import React, { useEffect, useState } from 'react'
import { Check, X, Crown, Zap, GraduationCap } from 'lucide-react'
import { StudentVerifyModal } from '../components/StudentVerifyModal'
import { CurrencySelector } from '../components/currency/CurrencySelector'
import { useCurrency } from '../components/currency/CurrencyProvider'

interface PricingPageProps {
  isPremium: boolean
  onSubscribe: (plan: string) => void
  onSignIn: () => void
  user: unknown
  // Plan id currently being sent to Paystack (e.g. 'pro-annual'), or null when idle.
  checkingOut?: string | null
  error?: string
}

type Plan = {
  key: string
  tier: 'student' | 'pro' | null
  label: string
  icon: React.ReactNode
  monthly: number
  annual: number
  color: string
  accentBg: string
  description: string
  cta: string
  ctaStyle: 'premium' | 'outline'
  badge?: string
  note?: string
  features: string[]
  missing: string[]
}

// Yearly discount vs. paying monthly for 12 months, as a rounded percentage.
const savingsPct = (monthly: number, annual: number) =>
  monthly > 0 ? Math.max(0, Math.round((1 - annual / (monthly * 12)) * 100)) : 0
// Absolute cedis saved per year by choosing annual over monthly.
const savingsAmount = (monthly: number, annual: number) => Math.max(monthly * 12 - annual, 0)

const PLANS: Plan[] = [
  {
    key: 'free',
    tier: null,
    label: 'Free',
    icon: <Zap size={20} />,
    monthly: 0,
    annual: 0,
    color: 'var(--text-sub)',
    accentBg: 'var(--surface)',
    description: 'Perfect for getting started',
    cta: 'Get Started Free',
    ctaStyle: 'outline',
    features: [
      '3 word searches per day',
      'Full definitions, examples & synonyms',
      'Save favorites',
      'Preview access to blog, guides, glossary & AI pages',
    ],
    missing: [
      'Unlimited searches',
      'AI explanations & insights',
      'Read aloud (text-to-speech)',
      'Dark mode',
      'Full Page mode (rich term pages)',
      'Dictionary mode (page-flip book)',
      'Full resource library access',
      'Priority support',
    ],
  },
  {
    key: 'student',
    tier: 'student',
    label: 'Student',
    icon: <GraduationCap size={20} />,
    monthly: 5,
    annual: 50,
    color: 'var(--pricing-green)',
    accentBg: 'var(--surface)',
    description: 'Full access at a student-friendly price',
    cta: 'Get Student Plan',
    ctaStyle: 'outline',
    note: 'Valid student ID may be required.',
    features: [
      'Unlimited dictionary searches',
      'Full Page mode (rich term pages)',
      'Dictionary mode (page-flip book)',
      'Full access to blog, guides, glossary, AI pages & release notes',
      'Unlimited AI explanations & insights',
      'Contextual images & read aloud',
      'Dark mode',
      'Save unlimited favorites',
      'Download & share definitions',
    ],
    missing: ['Priority support'],
  },
  {
    key: 'pro',
    tier: 'pro',
    label: 'Professional',
    icon: <Crown size={20} />,
    monthly: 12,
    annual: 120,
    color: 'var(--pricing-green)',
    accentBg: 'var(--card-bg)',
    description: 'For working supply chain professionals',
    cta: 'Go Professional',
    ctaStyle: 'premium',
    badge: 'Most Popular',
    features: [
      'Everything in the Student plan',
      'Full Page mode (rich term pages)',
      'Dictionary mode (page-flip book)',
      'Full premium resource library access',
      'Unlimited AI explanations & insights',
      'Download & share definitions',
      'Priority support',
    ],
    missing: [],
  },
]

const COMPARE_ROWS: { feature: string; free: boolean | string; student: boolean | string; pro: boolean | string }[] = [
  { feature: 'Dictionary searches', free: '3/day', student: 'Unlimited', pro: 'Unlimited' },
  { feature: 'AI explanations & images', free: false, student: 'Unlimited', pro: 'Unlimited' },
  { feature: 'Read aloud (text-to-speech)', free: false, student: true, pro: true },
  { feature: 'Dark mode', free: false, student: true, pro: true },
  { feature: 'Full Page mode (rich term pages)', free: false, student: true, pro: true },
  { feature: 'Dictionary mode (page-flip)', free: false, student: true, pro: true },
  { feature: 'Resource library access', free: 'Preview only', student: true, pro: true },
  { feature: 'Save favorites', free: true, student: true, pro: true },
  { feature: 'Download & share', free: true, student: true, pro: true },
  { feature: 'Priority support', free: false, student: false, pro: true },
]

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{value}</span>
  }
  return value ? (
    <Check size={16} color="var(--success-green)" strokeWidth={2.5} />
  ) : (
    <X size={16} color="var(--text-sub)" strokeWidth={2} />
  )
}

// Students must have a university + index number on their account before checkout.
const hasStudentInfo = (user: unknown) => {
  const meta = (user as { user_metadata?: Record<string, unknown> } | null)?.user_metadata
  return Boolean(meta && String(meta.student_university || '').trim() && String(meta.student_index_number || '').trim())
}

export const PricingPage: React.FC<PricingPageProps> = ({ isPremium, onSubscribe, onSignIn, user, checkingOut = null, error = '' }) => {
  const { displayCurrency, formatFromGhs, loading: currencyLoading, error: currencyError, rateAvailable } = useCurrency()
  const money = (amountGhs: number) => `${formatFromGhs(amountGhs)} ${displayCurrency}`
  const [annual, setAnnual] = useState(true)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  // Live prices (in cedis) keyed by plan id, fetched from /api/plans so admin edits show up.
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    fetch('/api/plans')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.plans)) return
        const map: Record<string, number> = {}
        for (const p of data.plans) {
          if (p && typeof p.id === 'string' && typeof p.price === 'number') map[p.id] = p.price
        }
        setLivePrices(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const priceFor = (tier: 'student' | 'pro' | null, period: 'monthly' | 'annual', fallback: number) =>
    tier ? livePrices[`${tier}-${period}`] ?? fallback : fallback

  const paid = PLANS.filter((p) => p.tier)
  const maxSavings = Math.max(
    0,
    ...paid.map((p) => savingsPct(priceFor(p.tier, 'monthly', p.monthly), priceFor(p.tier, 'annual', p.annual))),
  )

  const handleCTA = (plan: Plan) => {
    if (checkingOut) return
    if (plan.key === 'free') {
      if (!user) onSignIn()
      return
    }
    if (!user) {
      onSignIn()
      return
    }
    if (!plan.tier) return
    const planId = `${plan.tier}-${annual ? 'annual' : 'monthly'}`
    if (plan.tier === 'student' && !hasStudentInfo(user)) {
      setPendingPlan(planId)
      setVerifyOpen(true)
      return
    }
    onSubscribe(planId)
  }

  return (
    <div className="pricing-page-v2" style={{ background: 'var(--pricing-page-bg)', minHeight: '100vh' }}>
      {/* Student verification popup — collects school details before student checkout */}
      <StudentVerifyModal
        open={verifyOpen}
        user={user}
        onClose={() => {
          setVerifyOpen(false)
          setPendingPlan(null)
        }}
        onComplete={() => {
          setVerifyOpen(false)
          const plan = pendingPlan
          setPendingPlan(null)
          if (plan) onSubscribe(plan)
        }}
      />

      {/* Connecting-to-Paystack overlay */}
      {checkingOut && (
        <div className="pp-overlay" role="status" aria-live="polite">
          <div className="pp-overlay-card">
            <span className="pp-spinner pp-spinner-lg" aria-hidden />
            <div className="pp-overlay-title">Connecting to Paystack…</div>
            <div className="pp-overlay-sub">Your secure checkout will be charged in Ghana cedis (GHS).</div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '58px 24px 46px', background: 'var(--pricing-hero-bg)', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <img src="/logo2.png" alt="" aria-hidden style={{ position: 'absolute', left: '7%', top: 18, width: 150, opacity: 'var(--pricing-mark-opacity)', transform: 'rotate(-30deg)' }} />
        <h1 style={{ fontSize: 'clamp(30px, 4.6vw, 46px)', fontWeight: 900, color: 'var(--pricing-hero-title)', margin: '0 0 12px', lineHeight: 1.05, letterSpacing: 0 }}>
          Choose the plan that powers<br />
          your <span style={{ color: 'var(--pricing-green)' }}>supply chain success</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--pricing-hero-sub)', margin: '0 0 28px', maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          Unlock unlimited knowledge and AI-powered insights — a student plan for learners and a professional plan for the field. Pay yearly and save {maxSavings}%.
        </p>

        {/* Billing toggle */}
        <div className="pricing-toggle" style={{ display: 'inline-flex', alignItems: 'center', padding: 4, background: 'var(--pricing-toggle-bg)', border: '1px solid var(--pricing-toggle-border)', borderRadius: 999, boxShadow: 'var(--shadow-sm)', maxWidth: '100%' }}>
          <button
            onClick={() => setAnnual(false)}
            aria-pressed={!annual}
            style={{ minWidth: 120, padding: '10px 22px', border: 'none', borderRadius: 999, cursor: 'pointer', background: !annual ? 'var(--pricing-green)' : 'transparent', color: !annual ? '#fff' : 'var(--text-main)', fontWeight: 700 }}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            aria-pressed={annual}
            style={{
              minWidth: 140,
              padding: '10px 18px',
              borderRadius: 999,
              cursor: 'pointer',
              background: annual ? 'var(--pricing-green)' : 'transparent',
              border: 'none',
              color: annual ? '#fff' : 'var(--text-main)',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            Annual
            <span style={{ fontSize: 11, background: annual ? 'rgba(255,255,255,0.22)' : 'var(--pricing-green-soft)', color: annual ? '#fff' : 'var(--pricing-green)', padding: '2px 8px', borderRadius: 999, fontWeight: 800 }}>
              Save {maxSavings}%
            </span>
          </button>
        </div>

        <div className="pricing-currency-panel">
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)' }}>
              Prices shown in {displayCurrency}
            </div>
            <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-sub)', lineHeight: 1.35 }}>
              {!rateAvailable && currencyLoading
                ? `Loading live ${displayCurrency} rate…`
                : !rateAvailable && currencyError
                  ? `Live ${displayCurrency} rate temporarily unavailable`
                  : 'Frankfurter display estimate'}{' '}
              · Paystack always charges GHS
            </div>
          </div>
          <CurrencySelector compact />
        </div>
      </div>

      {/* Cards */}
      <div className="container" style={{ paddingTop: 72, paddingBottom: 64 }}>
        {error && (
          <div className="pp-error" role="alert">
            {error}
          </div>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 20,
            maxWidth: 1000,
            margin: '0 auto 64px',
          }}
          className="pricing-grid"
        >
          {PLANS.map((plan) => {
            const isPro = plan.key === 'pro'
            const isFree = plan.key === 'free'
            const effMonthly = priceFor(plan.tier, 'monthly', plan.monthly)
            const effAnnual = priceFor(plan.tier, 'annual', plan.annual)
            const price = annual ? effAnnual : effMonthly
            const pct = savingsPct(effMonthly, effAnnual)
            const saveAmt = savingsAmount(effMonthly, effAnnual)
            const hasDiscount = saveAmt > 0 && pct > 0
            const perMonthAnnual = effAnnual / 12
            const planCheckoutId = plan.tier ? `${plan.tier}-${annual ? 'annual' : 'monthly'}` : null
            const isCheckingOut = !!planCheckoutId && checkingOut === planCheckoutId
            return (
              <div
                key={plan.key}
                className="pricing-card"
                style={{
                  borderRadius: 16,
                  border: isPro ? '2px solid var(--pricing-green)' : '1px solid var(--border)',
                  background: isPro ? 'var(--pricing-pro-card-bg)' : plan.accentBg,
                  padding: '46px 28px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'visible',
                  boxShadow: isPro ? 'var(--pricing-pro-shadow)' : 'var(--shadow-sm)',
                }}
              >
                {plan.badge && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translate(-50%, -1px)',
                      background: 'var(--pricing-green)',
                      border: '1px solid var(--pricing-green)',
                      borderRadius: '0 0 10px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fff',
                      padding: '8px 34px',
                      whiteSpace: 'nowrap',
                      lineHeight: 1,
                    }}
                  >
                    {plan.badge}
                  </div>
                )}

                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isFree ? 'var(--text-sub)' : 'var(--pricing-green)',
                    marginBottom: 16,
                  }}
                >
                  {plan.icon}
                </div>

                <div style={{ fontSize: 18, fontWeight: 800, color: plan.color, marginBottom: 4 }}>{plan.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 18, minHeight: 34 }}>{plan.description}</div>

                {/* Price block */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 38, fontWeight: 900, color: plan.color, lineHeight: 1 }}>{money(price)}</span>
                    <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>/{isFree ? 'forever' : annual ? 'year' : 'month'}</span>
                    {!isFree && annual && hasDiscount && (
                      <span style={{ fontSize: 14, color: 'var(--text-sub)', textDecoration: 'line-through', opacity: 0.75 }}>
                        {money(effMonthly * 12)}
                      </span>
                    )}
                  </div>

                  {isFree ? (
                    <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 8 }}>No credit card required</div>
                  ) : (
                    <>
                      {hasDiscount && (
                        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--pricing-green-soft)', color: 'var(--pricing-green)', fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 999 }}>
                          {annual ? `Save ${pct}% · ${money(saveAmt)}/yr` : `Save ${pct}% if billed yearly`}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 8 }}>
                        {annual
                          ? `≈ ${money(perMonthAnnual)}/month, billed annually`
                          : hasDiscount
                          ? `or ${money(effAnnual)}/year — save ${money(saveAmt)}`
                          : `or ${money(effAnnual)}/year`}
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => handleCTA(plan)}
                  disabled={(isPremium && !isFree) || (!!checkingOut && !isCheckingOut)}
                  className={`btn btn-${plan.ctaStyle === 'premium' ? 'premium' : 'outline'}`}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    marginBottom: 16,
                    ...(isPro && { background: 'var(--pricing-green)', color: '#fff', border: 'none' }),
                  }}
                >
                  {isCheckingOut ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className="pp-spinner" aria-hidden /> Redirecting…
                    </span>
                  ) : isPremium && !isFree ? (
                    'Subscription active'
                  ) : (
                    plan.cta
                  )}
                </button>

                {plan.note && (
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', textAlign: 'center', marginBottom: 12 }}>{plan.note}</div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <Check size={15} color="var(--pricing-green)" style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={2.5} />
                      <span style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                  {plan.missing.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <X size={15} color="var(--text-sub)" style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={2} />
                      <span style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Compare table */}
        <div className="pricing-compare" style={{ maxWidth: 860, margin: '0 auto' }} id="compare">
          <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', textAlign: 'center', marginBottom: 32 }}>
            Full feature comparison
          </h2>
          <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {/* Header */}
            <div
              className="pricing-compare-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr repeat(3, 140px)',
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-sub)' }}>Feature</div>
              {PLANS.map((p) => (
                <div
                  key={p.key}
                  style={{
                    padding: '14px 0',
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: p.key === 'pro' ? 'var(--pricing-green)' : 'var(--text-main)',
                  }}
                >
                  {p.label}
                </div>
              ))}
            </div>

            {COMPARE_ROWS.map((row, i) => (
              <div
                key={row.feature}
                className="pricing-compare-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr repeat(3, 140px)',
                  borderBottom: i < COMPARE_ROWS.length - 1 ? '1px solid var(--surface)' : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'var(--bg)',
                }}
              >
                <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-main)' }}>{row.feature}</div>
                <div style={{ padding: '12px 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FeatureCell value={row.free} />
                </div>
                <div style={{ padding: '12px 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FeatureCell value={row.student} />
                </div>
                <div style={{ padding: '12px 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FeatureCell value={row.pro} />
                </div>
              </div>
            ))}

            {/* Price row */}
            <div
              className="pricing-compare-grid"
              style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, 140px)', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <div style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-sub)' }}>
                Price per {annual ? 'year' : 'month'}
              </div>
              <div style={{ padding: '14px 0', textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>{money(0)}</div>
              <div style={{ padding: '14px 0', textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                {money(annual ? priceFor('student', 'annual', 50) : priceFor('student', 'monthly', 5))}
              </div>
              <div style={{ padding: '14px 0', textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--pricing-green)' }}>
                {money(annual ? priceFor('pro', 'annual', 120) : priceFor('pro', 'monthly', 12))}
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 640, margin: '64px auto 0', textAlign: 'center' }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>Frequently asked questions</h2>
          <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 36 }}>Everything you need to know about our plans.</p>

          {[
            {
              q: 'How much do I save with annual billing?',
              a: `Annual plans are billed once a year and save you about ${maxSavings}% versus paying monthly — that's ${money(savingsAmount(priceFor('student', 'monthly', 5), priceFor('student', 'annual', 50)))}/year on the Student plan and ${money(savingsAmount(priceFor('pro', 'monthly', 12), priceFor('pro', 'annual', 120)))}/year on the Professional plan.`,
            },
            { q: 'Who qualifies for the Student plan?', a: 'Any enrolled student. We may ask you to confirm your student status with a valid student ID or school email. The Student plan includes everything except priority support.' },
            { q: 'Can I cancel anytime?', a: "Yes. You can cancel your subscription at any time from your account settings. You'll retain access until the end of your billing period." },
            { q: 'What payment methods do you accept?', a: 'We accept all major cards and mobile money via Paystack, billed securely in Ghana Cedis (GHS).' },
          ].map((faq) => (
            <div
              key={faq.q}
              style={{
                textAlign: 'left',
                padding: 20,
                borderRadius: 12,
                border: '1px solid var(--border)',
                marginBottom: 12,
                background: 'var(--surface)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>{faq.q}</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>{faq.a}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .pricing-page-v2 {
          --pricing-page-bg: var(--bg);
          --pricing-hero-bg: linear-gradient(160deg, rgba(251,248,241,0.92), rgba(231,243,239,0.82));
          --pricing-hero-title: #1f1f1f;
          --pricing-hero-sub: #53615b;
          --pricing-mark-opacity: 0.11;
          --pricing-toggle-bg: var(--card-bg);
          --pricing-toggle-border: var(--border);
          --pricing-pro-card-bg: var(--card-bg);
          --pricing-pro-shadow: 0 18px 44px rgba(0,79,70,0.14);
        }

        :root[data-theme="dark"] .pricing-page-v2 {
          --pricing-green: #20c7b2;
          --pricing-green-2: #33d6bf;
          --pricing-green-soft: rgba(32,199,178,0.16);
          --pricing-page-bg: #0f1411;
          --pricing-hero-bg:
            linear-gradient(160deg, rgba(18,24,21,0.98), rgba(20,38,34,0.94)),
            radial-gradient(circle at 12% 12%, rgba(242,139,88,0.10), transparent 28%);
          --pricing-hero-title: #f4f7f2;
          --pricing-hero-sub: #b8c0b8;
          --pricing-mark-opacity: 0.08;
          --pricing-toggle-bg: #151a17;
          --pricing-toggle-border: #2b332d;
          --pricing-pro-card-bg: #12211e;
          --pricing-pro-shadow: 0 18px 44px rgba(0,0,0,0.28);
        }

        /* Paystack loading UI */
        .pp-spinner {
          display: inline-block;
          width: 15px;
          height: 15px;
          border-radius: 50%;
          border: 2px solid rgba(128,128,128,0.35);
          border-top-color: currentColor;
          animation: pp-spin 0.7s linear infinite;
        }
        .pp-spinner-lg {
          width: 34px;
          height: 34px;
          border-width: 3px;
          border-color: var(--pricing-green-soft);
          border-top-color: var(--pricing-green);
        }
        @keyframes pp-spin { to { transform: rotate(360deg); } }
        .pp-overlay {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(8,12,10,0.55);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: pp-fade 0.18s ease;
        }
        .pp-overlay-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px 32px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0,0,0,0.28);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          max-width: 320px;
        }
        .pp-overlay-title { font-weight: 800; font-size: 16px; color: var(--text-main); }
        .pp-overlay-sub { font-size: 13px; color: var(--text-sub); }
        @keyframes pp-fade { from { opacity: 0; } to { opacity: 1; } }
        .pp-error {
          max-width: 1000px;
          margin: 0 auto 24px;
          background: rgba(185,28,28,0.08);
          color: #b91c1c;
          border: 1px solid rgba(185,28,28,0.25);
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 600;
          text-align: center;
        }
        .pricing-currency-panel {
          width: min(100%, 410px);
          margin: 18px auto 0;
          padding: 10px 12px 10px 15px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid rgba(182,84,55,.2);
          border-radius: 12px;
          background: var(--card-bg);
          box-shadow: var(--shadow-sm);
        }

        /* 3 cards stack straight to a single centred column to avoid an orphan card. */
        @media (max-width: 900px) {
          .pricing-grid {
            grid-template-columns: minmax(0, 460px) !important;
            justify-content: center !important;
          }
          .pricing-compare {
            max-width: 100% !important;
          }
          .pricing-compare-grid {
            grid-template-columns: minmax(104px, 1fr) repeat(3, minmax(64px, 0.8fr)) !important;
          }
          .pricing-compare-grid > div {
            padding-left: 8px !important;
            padding-right: 8px !important;
            font-size: 12px !important;
          }
        }
        @media (max-width: 420px) {
          .pricing-toggle button {
            min-width: 0 !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
          }
          .pricing-currency-panel {
            align-items: flex-start;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  )
}
