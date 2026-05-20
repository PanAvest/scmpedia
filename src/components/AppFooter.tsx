import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Crown } from 'lucide-react'
import { Logo } from './Logo'

const FOOTER_LINKS = {
  Product: [
    { label: 'Dictionary', to: '/dictionary' },
    { label: 'Categories', to: '/categories' },
    { label: 'AI Features', to: '/ai-features' },
    { label: 'Release Notes', to: '/release-notes' },
  ],
  Resources: [
    { label: 'Blog', to: '/blog' },
    { label: 'Guides', to: '/guides' },
    { label: 'Glossary', to: '/glossary' },
    { label: 'Help Center', to: '/help' },
  ],
  Company: [
    { label: 'About Us', to: '/about' },
    { label: 'Careers', to: '/careers' },
    { label: 'Contact', to: '/contact' },
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Terms of Service', to: '/terms' },
  ],
  Pricing: [
    { label: 'Plans', to: '/pricing' },
    { label: 'Compare', to: '/pricing#compare' },
    { label: 'For Teams', to: '/pricing#teams' },
    { label: 'Enterprise', to: '/pricing#enterprise' },
  ],
}

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://instagram.com', icon: 'instagram' },
  { label: 'Twitter', href: 'https://x.com', icon: 'twitter' },
  { label: 'TikTok', href: 'https://tiktok.com', icon: 'tiktok' },
  { label: 'Facebook', href: 'https://facebook.com', icon: 'facebook' },
  { label: 'LinkedIn', href: 'https://linkedin.com', icon: 'linkedin' },
]

function SocialIcon({ icon }: { icon: string }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (icon === 'instagram') {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <path d="M17.5 6.5h.01" />
      </svg>
    )
  }

  if (icon === 'twitter') {
    return (
      <svg {...common}>
        <path d="M4 4l16 16" />
        <path d="M20 4 4 20" />
      </svg>
    )
  }

  if (icon === 'tiktok') {
    return (
      <svg {...common}>
        <path d="M14 3v11.2a4.2 4.2 0 1 1-4.2-4.2" />
        <path d="M14 6.5c1.1 1.8 2.8 3 5 3.2" />
      </svg>
    )
  }

  if (icon === 'facebook') {
    return (
      <svg {...common}>
        <path d="M15 8h-2a2 2 0 0 0-2 2v3H8v4h3v4h4v-4h3l1-4h-4v-2a1 1 0 0 1 1-1h3V6h-4Z" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M6 9v10" />
      <path d="M10 19v-5.5a3.5 3.5 0 0 1 7 0V19" />
      <path d="M6 5.5h.01" />
    </svg>
  )
}

interface AppFooterProps {
  onOpenPricing?: () => void
  isPremium?: boolean
}

export const AppFooter: React.FC<AppFooterProps> = ({ onOpenPricing, isPremium = false }) => {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
        paddingTop: 58,
        paddingBottom: 36,
      }}
    >
      <div className="container">
        <div className="footer-grid">
          {/* Brand Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Logo variant="footer" />
            <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.65, margin: 0, maxWidth: 280 }}>
              The AI-powered dictionary and learning platform for supply chain professionals worldwide.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text-sub)',
                    background: 'var(--surface)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.18s ease',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--primary-bg)'
                    e.currentTarget.style.color = 'var(--primary)'
                    e.currentTarget.style.borderColor = 'rgba(182,84,55,0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface)'
                    e.currentTarget.style.color = 'var(--text-sub)'
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                >
                  <SocialIcon icon={s.icon} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{category}</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      style={{
                        fontSize: 14,
                        color: 'var(--text-sub)',
                        textDecoration: 'none',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-main)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-sub)')}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {!isPremium && (
            <div
              style={{
                borderRadius: 16,
                border: '1px solid rgba(20,174,92,0.20)',
                background: 'linear-gradient(135deg, rgba(20,174,92,0.10), rgba(20,174,92,0.03))',
                padding: 24,
                minHeight: 158,
                boxShadow: '0 12px 32px rgba(18,24,21,0.07)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, color: 'var(--success-green)', fontSize: 18, fontWeight: 900 }}>
                <Crown size={19} />
                Go Premium
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.55, margin: '0 0 18px' }}>
                Unlock advanced AI insights, unlimited search, voice features, and more.
              </p>
              <button
                onClick={onOpenPricing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 17px',
                  borderRadius: 9,
                  border: 'none',
                  background: 'var(--success-green)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                Explore Premium <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Copyright */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 13,
            color: 'var(--text-sub)',
          }}
        >
          <span>© 2025 SCMpedia. All rights reserved.</span>
        </div>
      </div>

      <style>{`
        .footer-grid {
          display: grid;
          grid-template-columns: 300px repeat(4, minmax(130px, 1fr)) ${isPremium ? '' : '280px'};
          gap: 42px;
          margin-bottom: 42px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
        }
      `}</style>
    </footer>
  )
}
