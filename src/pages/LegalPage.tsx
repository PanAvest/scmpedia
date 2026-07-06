import React from 'react'
import { Link } from 'react-router-dom'

type LegalPageProps = {
  type: 'privacy' | 'terms'
}

const updated = 'May 25, 2026'

export const LegalPage: React.FC<LegalPageProps> = ({ type }) => {
  const isPrivacy = type === 'privacy'
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '48px 24px 72px' }}>
      <article className="container-sm card" style={{ padding: '34px 30px', borderRadius: 12 }}>
        <div className="badge badge-primary" style={{ marginBottom: 16 }}>
          {isPrivacy ? 'Privacy' : 'Terms'}
        </div>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 44px)', color: 'var(--text-main)', marginBottom: 10 }}>
          {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
        </h1>
        <p style={{ color: 'var(--text-sub)', marginBottom: 26 }}>Last updated: {updated}</p>

        {isPrivacy ? (
          <div className="legal-copy">
            <h2>Information We Collect</h2>
            <p>SCMpedia collects account details, authentication data, payment status, favorites, preferences, and usage records needed to operate the service and enforce the free daily word limit.</p>
            <h2>How We Use Information</h2>
            <p>We use information to provide search, AI explanations, voice features, subscriptions, support, security monitoring, and product improvements.</p>
            <h2>Payments</h2>
            <p>Payments are processed by Paystack. SCMpedia stores payment references and subscription status, not full card details.</p>
            <h2>Data Controls</h2>
            <p>You can update account preferences in Settings. Contact support for account or data deletion requests.</p>
          </div>
        ) : (
          <div className="legal-copy">
            <h2>Using SCMpedia</h2>
            <p>You may use SCMpedia for lawful learning, research, and professional reference. Free users are entitled to 2 word searches per day; premium users receive expanded access while their subscription is active.</p>
            <h2>Content and AI</h2>
            <p>Definitions and AI explanations are educational references. Verify critical business, legal, financial, or operational decisions with qualified experts and primary sources.</p>
            <h2>Subscriptions</h2>
            <p>Premium access is activated after successful payment verification. Access may be suspended for abuse, credential sharing, or attempts to bypass technical limits.</p>
            <h2>Admin and Security</h2>
            <p>Unauthorized access, scraping, automated abuse, or tampering with SCMpedia systems is prohibited.</p>
          </div>
        )}

        <div style={{ marginTop: 30, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-primary">Back to search</Link>
          <Link to={isPrivacy ? '/terms' : '/privacy'} className="btn btn-outline">
            {isPrivacy ? 'Read Terms' : 'Read Privacy Policy'}
          </Link>
        </div>
      </article>

      <style>{`
        .legal-copy {
          display: grid;
          gap: 18px;
        }
        .legal-copy h2 {
          color: var(--text-main);
          font-size: 18px;
          margin-top: 6px;
        }
        .legal-copy p {
          color: var(--text-sub);
          font-size: 15px;
          line-height: 1.75;
        }
      `}</style>
    </div>
  )
}
