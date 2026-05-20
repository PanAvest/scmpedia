import React, { useState } from 'react'

type LogoVariant = 'default' | 'icon' | 'admin' | 'footer' | 'white'

interface LogoProps {
  variant?: LogoVariant
  className?: string
  onClick?: () => void
  style?: React.CSSProperties
}

export const Logo: React.FC<LogoProps> = ({ variant = 'default', className = '', onClick, style }) => {
  const [loaded, setLoaded] = useState(false)

  if (variant === 'icon') {
    return (
      <img
        src="/logo2.png"
        alt="SCMpedia"
        className={`fade-img ${loaded ? 'loaded' : ''} ${className}`}
        style={{ width: 36, height: 36, objectFit: 'contain', ...style }}
        onLoad={() => setLoaded(true)}
        loading="eager"
      />
    )
  }

  if (variant === 'white') {
    const image = (
      <img
        src="/white-logo.png"
        alt="SCMpedia"
        className={className}
        style={{ width: 192, height: 'auto', objectFit: 'contain', ...style }}
        onLoad={() => setLoaded(true)}
        loading="eager"
      />
    )
    if (!onClick) return image
    return (
      <button
        onClick={onClick}
        aria-label="Go to SCMpedia home"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {image}
      </button>
    )
  }

  if (variant === 'admin') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, ...style }} className={className}>
        <img
          src="/logo.png"
          alt="SCMpedia"
          className={`theme-logo-light fade-img ${loaded ? 'loaded' : ''}`}
          style={{ height: 32, width: 'auto', objectFit: 'contain' }}
          onLoad={() => setLoaded(true)}
          loading="eager"
        />
        <img
          src="/white-logo.png"
          alt="SCMpedia"
          className={`theme-logo-dark fade-img ${loaded ? 'loaded' : ''}`}
          style={{ height: 32, width: 'auto', objectFit: 'contain' }}
          onLoad={() => setLoaded(true)}
          loading="eager"
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--admin-text-sub)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Admin Panel
        </span>
      </div>
    )
  }

  if (variant === 'footer') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }} className={className}>
        <img
          src="/logo.png"
          alt="SCMpedia"
          className={`theme-logo-light fade-img ${loaded ? 'loaded' : ''}`}
          style={{ width: 178, height: 'auto', objectFit: 'contain' }}
          onLoad={() => setLoaded(true)}
          loading="lazy"
        />
        <img
          src="/white-logo.png"
          alt="SCMpedia"
          className={`theme-logo-dark fade-img ${loaded ? 'loaded' : ''}`}
          style={{ width: 178, height: 'auto', objectFit: 'contain' }}
          onLoad={() => setLoaded(true)}
          loading="lazy"
        />
      </div>
    )
  }

  // Default horizontal
  return (
    <button
      onClick={onClick}
      aria-label="Go to SCMpedia home"
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        ...style,
      }}
      className={className}
    >
      <img
        src="/logo.png"
        alt="SCMpedia"
        className={`theme-logo-light fade-img ${loaded ? 'loaded' : ''}`}
        style={{ width: 192, height: 'auto', objectFit: 'contain' }}
        onLoad={() => setLoaded(true)}
        loading="eager"
      />
      <img
        src="/white-logo.png"
        alt="SCMpedia"
        className={`theme-logo-dark fade-img ${loaded ? 'loaded' : ''}`}
        style={{ width: 192, height: 'auto', objectFit: 'contain' }}
        onLoad={() => setLoaded(true)}
        loading="eager"
      />
    </button>
  )
}
