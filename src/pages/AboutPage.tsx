import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Crown, ExternalLink, Search, Shield, Sparkles, Target, Users, Zap, TrendingUp, Star, type LucideIcon } from 'lucide-react'

const infoCards = [
  { icon: Target, title: 'Our Mission', text: 'To make supply chain knowledge accessible, practical, and actionable for everyone, empowering professionals to solve problems and build resilient supply chains.' },
  { icon: Users, title: "Who It's For", text: 'Supply chain professionals, students, operations managers, consultants, analysts, procurement, and logistics teams.' },
  { icon: Sparkles, title: 'Key Features', text: 'AI-powered explanations, real-world examples, contextual images, voice reading, custom lists, favorites, and always updated content.' },
  { icon: Shield, title: 'Built on Trust', text: 'We are committed to accuracy, relevance, and continuous improvement. Our content is curated by supply chain experts and enhanced by advanced AI.' },
]

const stats: Array<{ end: number; suffix: string; decimals?: number; label: string; icon: LucideIcon }> = [
  { end: 25000, suffix: '+', label: 'Professionals Worldwide', icon: Users },
  { end: 10000, suffix: '+', label: 'Terms & Concepts Explained', icon: BookOpen },
  { end: 50000, suffix: '+', label: 'Searches Every Month', icon: Zap },
  { end: 99.9, suffix: '%', decimals: 1, label: 'Uptime & Always Up-to-Date', icon: TrendingUp },
  { end: 4.9, suffix: '/5', decimals: 1, label: 'Average User Rating', icon: Star },
]

const story = [
  { year: '2023', yearEnd: 2023, title: 'The Idea', text: 'SCMpedia was born from a simple idea: supply chain knowledge should be easy to find, understand, and apply.' },
  { year: '2023', yearEnd: 2023, title: 'Built with Experts', text: 'We partnered with industry professionals to curate content and ensure real-world relevance and accuracy.' },
  { year: '2024', yearEnd: 2024, title: 'AI-Powered Launch', text: 'Launched our AI-powered platform to deliver instant, smart, and contextual explanations.' },
  { year: '2024+', yearEnd: 2024, yearSuffix: '+', title: 'Growing Together', text: 'Continuously adding terms, features, and learning resources based on user feedback and industry trends.' },
  { year: 'The Future', title: 'Our Vision', text: "To be the world's most trusted supply chain knowledge platform." },
]

interface AboutPageProps {
  isPremium?: boolean
}

export const AboutPage: React.FC<AboutPageProps> = ({ isPremium = false }) => {
  return (
    <div style={{ background: 'var(--bg)' }}>
      <section style={{ padding: '42px 24px 38px', background: 'var(--home-hero-bg)', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
        <img src="/logo2.png" alt="" aria-hidden style={{ position: 'absolute', right: '8%', top: 30, width: 150, opacity: 0.10, transform: 'rotate(-30deg)' }} />
        <div className="container about-hero">
          <div>
            <div className="badge badge-primary" style={{ marginBottom: 18 }}>About SCMpedia</div>
            <h1 style={{ fontSize: 'clamp(34px, 5vw, 52px)', fontWeight: 900, lineHeight: 1.05, color: 'var(--text-main)', marginBottom: 18 }}>
              What is <span style={{ color: 'var(--primary)' }}>SCMpedia?</span>
            </h1>
            <p style={{ fontSize: 17, color: 'var(--text-main)', maxWidth: 560, lineHeight: 1.6, marginBottom: 12 }}>
              SCMpedia is the digital version of Prof. Douglas Boateng's Executive Insight Series: Compendium of Supply Chain Management Terms.
            </p>
            <p style={{ fontSize: 15, color: 'var(--text-sub)', maxWidth: 600, lineHeight: 1.7, marginBottom: 24 }}>
              The platform brings the book's supply chain terminology into a searchable, AI-assisted reference for professionals, students, and leaders.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link to="/" className="btn btn-primary"><Search size={16} />Start Searching</Link>
              {!isPremium && <Link to="/pricing" className="btn btn-outline"><Crown size={16} />Go Premium</Link>}
            </div>
          </div>

          <div className="card about-book-card" style={{ padding: 24, minHeight: 260, boxShadow: 'var(--shadow-lg)', display: 'grid', gridTemplateColumns: '160px 1fr', gap: 22, alignItems: 'center' }}>
            <img
              src="/book.jpg"
              alt="Executive Insight Series: Compendium of Supply Chain Management Terms book cover"
              style={{ width: '100%', borderRadius: 8, boxShadow: '0 18px 38px rgba(0,0,0,0.18)' }}
            />
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                <BookOpen size={16} />
                Digital book reference
              </div>
              <h2 style={{ fontSize: 23, color: 'var(--text-main)', fontWeight: 900, lineHeight: 1.12, marginBottom: 10 }}>
                Built from a definitive supply chain compendium
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.65, marginBottom: 16 }}>
                SCMpedia transforms the printed reference into a fast digital learning and search experience while keeping the book at the center of the product.
              </p>
              <a
                href="https://www.amazon.com/Executive-Insight-Compendium-Supply-Management-ebook/dp/B0FQVFQVFM?ref_=ast_author_dp"
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
              >
                View book on Amazon <ExternalLink size={15} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '26px 24px 16px' }}>
        <div className="container about-card-grid">
          {infoCards.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card" style={{ padding: 22, minHeight: 190 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--primary-bg)', color: 'var(--primary)', marginBottom: 14 }}>
                <Icon size={21} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10, color: 'var(--text-main)' }}>{title}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '0 24px 24px' }}>
        <div className="container">
          <div className="card about-stats-strip" style={{ padding: '22px 26px' }}>
            {stats.map(({ end, suffix, decimals, label, icon: Icon }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                  <Icon size={23} />
                </div>
                <div>
                  <AboutCountUp
                    end={end}
                    suffix={suffix}
                    decimals={decimals}
                    style={{ color: 'var(--primary)', fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}
                  />
                  <div style={{ color: 'var(--text-main)', fontSize: 12, lineHeight: 1.25 }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '14px 24px 42px' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, color: 'var(--text-main)', marginBottom: 22 }}>Our Story</h2>
          <div className="about-timeline">
            {story.map(({ year, yearEnd, yearSuffix, title, text }, i) => (
              <div key={title} style={{ textAlign: 'center', position: 'relative' }}>
                <div style={{ width: 62, height: 62, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 12px', background: i % 2 ? 'rgba(20,174,92,0.12)' : 'var(--primary-bg)', color: i % 2 ? 'var(--success-green)' : 'var(--primary)', border: '1px solid var(--border)' }}>
                  <Zap size={22} />
                </div>
                {yearEnd ? (
                  <AboutCountUp
                    end={yearEnd}
                    suffix={yearSuffix ?? ''}
                    duration={1050}
                    useGrouping={false}
                    style={{ color: i === story.length - 1 ? 'var(--success-green)' : 'var(--primary)', fontSize: 15, fontWeight: 900 }}
                  />
                ) : (
                  <div style={{ color: i === story.length - 1 ? 'var(--success-green)' : 'var(--primary)', fontSize: 15, fontWeight: 900 }}>{year}</div>
                )}
                <div style={{ color: 'var(--text-main)', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>{title}</div>
                <p style={{ color: 'var(--text-sub)', fontSize: 11, lineHeight: 1.45 }}>{text}</p>
              </div>
            ))}
          </div>
          {!isPremium && (
            <div className="card" style={{ maxWidth: 760, margin: '30px auto 0', padding: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', background: 'linear-gradient(135deg, var(--primary-bg), transparent)' }}>
              <div>
                <strong style={{ fontSize: 16, color: 'var(--text-main)' }}>Unlock the full power of SCMpedia</strong>
                <p style={{ fontSize: 13, color: 'var(--text-sub)' }}>Go Premium for unlimited searches, voice features, advanced AI insights, custom lists, and more.</p>
              </div>
              <Link to="/pricing" className="btn btn-primary"><Crown size={16} />Explore Premium</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

const AboutCountUp = ({
  end,
  suffix = '',
  decimals = 0,
  duration = 1450,
  useGrouping = true,
  style,
}: {
  end: number
  suffix?: string
  decimals?: number
  duration?: number
  useGrouping?: boolean
  style?: React.CSSProperties
}) => {
  const [value, setValue] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node || started) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setStarted(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setStarted(true)
        observer.disconnect()
      },
      { threshold: 0.35 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(end)
      return
    }
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(end * eased)
      if (progress < 1) frame = window.requestAnimationFrame(tick)
      else setValue(end)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [duration, end, started])

  const display = value.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
    useGrouping,
  })

  return (
    <div ref={ref} style={{ ...style, fontVariantNumeric: 'tabular-nums', letterSpacing: 0 }}>
      {display}{suffix}
    </div>
  )
}
