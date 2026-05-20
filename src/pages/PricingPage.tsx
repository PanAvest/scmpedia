import React, { useState } from 'react'
import { Check, X, Crown, Zap, Building2 } from 'lucide-react'

interface PricingPageProps {
  isPremium: boolean
  onSubscribe: (plan: string) => void
  onSignIn: () => void
  user: unknown
}

const PLANS = [
  {
    key: 'free',
    label: 'Free',
    icon: <Zap size={20} />,
    monthlyPrice: 0,
    annualPrice: 0,
    color: 'var(--text-sub)',
    accentBg: 'var(--surface)',
    description: 'Perfect for getting started',
    cta: 'Get Started Free',
    ctaStyle: 'outline',
    features: [
      'Limited dictionary searches (20/day)',
      'Basic definitions & examples',
      'Standard contextual images',
      'Voice search (limited)',
      'Favorites (up to 20)',
    ],
    missing: [
      'Unlimited AI explanations',
      'Voice text-to-speech',
      'Contextual images',
      'Dictionary mode (page-flip)',
      'Favorites & history',
      'Advanced search filters',
    ],
  },
  {
    key: 'pro',
    label: 'Premium',
    icon: <Crown size={20} />,
    monthlyPrice: 22.58,
    annualPrice: 225.78,
    color: 'var(--pricing-green)',
    accentBg: 'var(--card-bg)',
    description: 'For serious supply chain professionals',
    cta: 'Go Premium',
    ctaStyle: 'premium',
    badge: 'Most Popular',
    features: [
      'Unlimited dictionary searches',
      'AI-powered explanations & insights',
      'Voice search (unlimited)',
      'Dictionary mode (full access)',
      'Dark mode',
      'Smart study flow & smart history',
      'Download & share definitions',
      'Priority support',
    ],
    missing: [],
  },
  {
    key: 'enterprise',
    label: 'Team',
    icon: <Building2 size={20} />,
    monthlyPrice: null,
    annualPrice: null,
    color: 'var(--text-main)',
    accentBg: 'var(--surface)',
    description: 'For teams and organizations',
    cta: 'Contact Sales',
    ctaStyle: 'outline',
    features: [
      'Everything in Premium',
      'Team management & roles',
      'Custom integrations (API)',
      'SSO / SAML authentication',
      'Dedicated account manager',
      'SLA & uptime guarantee',
      'Custom onboarding',
      'Volume licensing',
    ],
    missing: [],
  },
]

const COMPARE_ROWS = [
  { feature: 'Dictionary searches', free: '20/day', pro: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'AI-powered explanations', free: 'Limited', pro: true, enterprise: true },
  { feature: 'Voice search', free: 'Limited', pro: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'Dictionary mode', free: 'Basic', pro: true, enterprise: true },
  { feature: 'Dark mode', free: false, pro: true, enterprise: true },
  { feature: 'Smart history & study flow', free: 'Basic', pro: true, enterprise: true },
  { feature: 'Favorites', free: 'Up to 20', pro: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'Download & share', free: false, pro: true, enterprise: true },
  { feature: 'Priority support', free: false, pro: true, enterprise: 'Priority + Dedicated' },
]

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{value}</span>
  }
  return value ? (
    <Check size={16} color="var(--success-green)" strokeWidth={2.5} />
  ) : (
    <X size={16} color="var(--border)" strokeWidth={2} />
  )
}

export const PricingPage: React.FC<PricingPageProps> = ({ isPremium, onSubscribe, onSignIn, user }) => {
  const [annual, setAnnual] = useState(true)

  const handleCTA = (plan: typeof PLANS[0]) => {
    if (plan.key === 'free') {
      if (!user) onSignIn()
      return
    }
    if (plan.key === 'enterprise') {
      window.location.href = 'mailto:hello@scmpedia.com?subject=Enterprise%20Inquiry'
      return
    }
    if (!user) { onSignIn(); return }
    onSubscribe(annual ? 'annual' : 'monthly')
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '58px 24px 46px', background: 'linear-gradient(160deg, rgba(251,248,241,0.9), rgba(231,243,239,0.78))', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <img src="/logo2.png" alt="" aria-hidden style={{ position: 'absolute', left: '7%', top: 18, width: 150, opacity: 0.11, transform: 'rotate(-30deg)' }} />
        <h1 style={{ fontSize: 'clamp(32px, 4.6vw, 46px)', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 12px', lineHeight: 1.05 }}>
          Choose the plan that powers<br />
          your <span style={{ color: 'var(--pricing-green)' }}>supply chain success</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-sub)', margin: '0 0 28px', maxWidth: 540, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          Unlock unlimited knowledge, AI-powered insights, and expert tools designed for supply chain professionals.
        </p>

        {/* Billing toggle */}
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: 4, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 999, boxShadow: 'var(--shadow-sm)' }}>
          <button onClick={() => setAnnual(false)} style={{ minWidth: 150, padding: '10px 22px', border: 'none', borderRadius: 999, background: !annual ? 'var(--pricing-green)' : 'transparent', color: !annual ? '#fff' : 'var(--text-main)', fontWeight: 700 }}>Monthly</button>
          <button
            onClick={() => setAnnual((v) => !v)}
            style={{
              minWidth: 170,
              padding: '10px 22px',
              borderRadius: 999,
              background: annual ? 'var(--pricing-green)' : 'transparent',
              border: 'none',
              color: annual ? '#fff' : 'var(--text-main)',
              fontWeight: 700,
            }}
          >
            Annual <span style={{ marginLeft: 6, fontSize: 11, background: annual ? '#fff' : 'var(--pricing-green-soft)', color: 'var(--pricing-green)', padding: '2px 7px', borderRadius: 999 }}>Save 17%</span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="container" style={{ paddingTop: 72, paddingBottom: 64 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            maxWidth: 960,
            margin: '0 auto 64px',
          }}
          className="pricing-grid"
        >
          {PLANS.map((plan) => {
            const isPro = plan.key === 'pro'
            const price = annual ? plan.annualPrice : plan.monthlyPrice
            return (
              <div
                key={plan.key}
                style={{
                  borderRadius: 16,
                  border: isPro ? '2px solid var(--pricing-green)' : '1px solid var(--border)',
                  background: plan.accentBg,
                  padding: isPro ? '46px 28px 28px' : 28,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'visible',
                  boxShadow: isPro ? '0 18px 44px rgba(0,79,70,0.14)' : 'var(--shadow-sm)',
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
                    color: isPro ? 'var(--pricing-green)' : 'var(--text-sub)',
                    marginBottom: 16,
                  }}
                >
                  {plan.icon}
                </div>

                <div style={{ fontSize: 18, fontWeight: 800, color: plan.color, marginBottom: 4 }}>{plan.label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 20 }}>{plan.description}</div>

                {price !== null ? (
                  <div style={{ marginBottom: 20 }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: plan.color, lineHeight: 1 }}>{plan.key === 'free' ? 'GHC0' : `GHC${price}`}</span>
                    <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>/{annual && plan.key === 'pro' ? 'year' : 'month'}</span>
                    {annual && price > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>
                        GHC22.58/month, billed annually
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 28, fontWeight: 900, color: plan.color, marginBottom: 20 }}>Custom</div>
                )}

                <button
                  onClick={() => handleCTA(plan)}
                  disabled={isPremium && plan.key === 'pro'}
                  className={`btn btn-${plan.ctaStyle === 'premium' ? 'premium' : 'outline'}`}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    marginBottom: 24,
                    ...(isPro && { background: 'var(--pricing-green)', color: '#fff', border: 'none' }),
                  }}
                >
                  {isPremium && plan.key === 'pro' ? 'Current Plan' : plan.cta}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <Check
                        size={15}
                        color="var(--pricing-green)"
                        style={{ flexShrink: 0, marginTop: 1 }}
                        strokeWidth={2.5}
                      />
                      <span style={{ fontSize: 13, color: 'var(--text-main)', lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                  {plan.missing.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <X size={15} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={2} />
                      <span style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Compare table */}
        <div style={{ maxWidth: 860, margin: '0 auto' }} id="compare">
          <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-main)', textAlign: 'center', marginBottom: 32 }}>
            Full feature comparison
          </h2>
          <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {/* Header */}
            <div
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
                    color: p.key === 'pro' ? 'var(--primary)' : 'var(--text-main)',
                  }}
                >
                  {p.label}
                </div>
              ))}
            </div>

            {COMPARE_ROWS.map((row, i) => (
              <div
                key={row.feature}
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
                  <FeatureCell value={row.pro} />
                </div>
                <div style={{ padding: '12px 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FeatureCell value={row.enterprise} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 640, margin: '64px auto 0', textAlign: 'center' }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginBottom: 8 }}>Frequently asked questions</h2>
          <p style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 36 }}>Everything you need to know about our plans.</p>

          {[
            { q: 'Can I cancel anytime?', a: "Yes. You can cancel your subscription at any time from your account settings. You'll retain access until the end of your billing period." },
            { q: 'What payment methods do you accept?', a: 'We accept all major cards via Paystack — Visa, Mastercard, and local bank transfers in supported regions.' },
            { q: 'Is there a free trial for Pro?', a: 'The Free plan lets you try the core features with 2 AI searches per day. Upgrade whenever you\'re ready for unlimited access.' },
            { q: 'What is Dictionary Mode?', a: 'Dictionary Mode gives you a beautiful page-flip interface to browse and read supply chain terms like a physical book — a premium-only feature.' },
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
        @media (max-width: 768px) {
          .pricing-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 1024px) {
          .pricing-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
