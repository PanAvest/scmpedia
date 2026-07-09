import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, Bell, Menu, X, Crown, ChevronDown } from 'lucide-react'
import { Logo } from './Logo'
import type { User } from '@supabase/supabase-js'

interface AppHeaderProps {
  user: User | null
  darkMode: boolean
  setDarkMode: (v: boolean) => void
  isPremium: boolean
  authLoading?: boolean
  preferDictionaryMode?: boolean
  onLogoClick?: () => void
  onSignIn: () => void
  onSignOut: () => void
  onOpenPricing: () => void
}

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Dictionary', to: '/dictionary' },
  { label: 'About', to: '/about' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Resources', to: '/resources', hasDropdown: true },
]

const RESOURCES_ITEMS = [
  { label: 'Blog', to: '/blog' },
  { label: 'Guides', to: '/guides' },
  { label: 'AI Features', to: '/ai-features' },
  { label: 'Glossary', to: '/glossary' },
  { label: 'Release Notes', to: '/release-notes' },
  { label: 'Help Center', to: '/help' },
]

export const AppHeader: React.FC<AppHeaderProps> = ({
  user,
  darkMode,
  setDarkMode,
  isPremium,
  authLoading = false,
  preferDictionaryMode = false,
  onLogoClick,
  onSignIn,
  onSignOut,
  onOpenPricing,
}) => {
  // Dark mode is premium-gated, but don't show the locked state until auth has settled —
  // otherwise a real subscriber flashes the crown/upsell for a frame while their session restores.
  const darkLocked = !isPremium && !authLoading
  const location = useLocation()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const resourcesRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setResourcesOpen(false)
    setProfileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!resourcesOpen && !profileOpen && !mobileOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (resourcesOpen && resourcesRef.current && !resourcesRef.current.contains(target)) {
        setResourcesOpen(false)
      }

      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false)
      }

      if (mobileOpen && headerRef.current && !headerRef.current.contains(target)) {
        setMobileOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [mobileOpen, profileOpen, resourcesOpen])

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'U'
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const userRole = isPremium ? 'Premium Member' : 'Free Plan'
  const navLinks = NAV_LINKS.map((link) =>
    link.label === 'Dictionary'
      ? { ...link, to: preferDictionaryMode ? '/dictionary-mode' : '/dictionary' }
      : link
  )

  return (
    <header
      ref={headerRef}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: scrolled
          ? darkMode
            ? 'rgba(17,20,18,0.94)'
            : 'rgba(255,255,255,0.95)'
          : 'var(--card-bg)',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid var(--border)',
        transition: 'box-shadow 0.2s ease, background 0.2s ease',
        boxShadow: scrolled ? `0 2px 20px ${darkMode ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.06)'}` : 'none',
      }}
    >
      <div className="container app-header-inner" style={{ display: 'flex', alignItems: 'center', height: 72 }}>
        {/* Logo */}
        <Logo variant={darkMode ? 'white' : 'default'} className="app-header-logo" onClick={onLogoClick || (() => navigate('/'))} />

        {/* Desktop Nav */}
        <nav className="app-header-nav hide-mobile">
          {navLinks.map((link) =>
            link.hasDropdown ? (
              <div key={link.to} ref={resourcesRef} style={{ position: 'relative' }}>
                <button
                  className={`nav-link ${isActive(link.to) ? 'active' : ''}`}
                  onClick={() => {
                    setProfileOpen(false)
                    setResourcesOpen((o) => !o)
                  }}
                  onBlur={() => setTimeout(() => setResourcesOpen(false), 150)}
                  aria-expanded={resourcesOpen}
                >
                  {link.label}
                  <ChevronDown size={14} style={{ transition: 'transform 0.18s', transform: resourcesOpen ? 'rotate(180deg)' : '' }} />
                </button>
                {resourcesOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      boxShadow: '0 10px 36px rgba(0,0,0,0.12)',
                      padding: '6px 0',
                      minWidth: 180,
                      zIndex: 200,
                      animation: 'pop-up 0.15s ease',
                    }}
                  >
                    {RESOURCES_ITEMS.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        style={{
                          display: 'block',
                          padding: '8px 16px',
                          fontSize: 14,
                          color: 'var(--text-main)',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${isActive(link.to) ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        {/* Right Controls */}
        <div className="app-header-actions hide-mobile">
          {/* Theme toggle — dark mode is a premium feature */}
          <button
            onClick={() => { if (darkLocked) onOpenPricing(); else setDarkMode(!darkMode) }}
            aria-label={darkLocked ? 'Dark mode is a premium feature' : darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={darkLocked ? 'Dark mode is a premium feature' : undefined}
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-sub)',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
            }}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkLocked && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  width: 15,
                  height: 15,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid var(--card-bg)',
                }}
              >
                <Crown size={8} />
              </span>
            )}
          </button>

          {/* Notifications (placeholder) */}
          {user && (
            <button
              aria-label="Notifications"
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-sub)',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <Bell size={16} />
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  border: '2px solid var(--card-bg)',
                }}
              />
            </button>
          )}

          {user ? (
            <div ref={profileRef} style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  setResourcesOpen(false)
                  setProfileOpen((o) => !o)
                }}
                onBlur={() => setTimeout(() => setProfileOpen(false), 150)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 8px 4px 4px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {initials}
                </div>
                <div className="app-header-profile-text" style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: isPremium ? 'var(--success-green)' : 'var(--text-sub)', lineHeight: 1 }}>{userRole}</div>
                </div>
                <ChevronDown size={14} color="var(--text-sub)" />
              </button>
              {profileOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    boxShadow: '0 10px 36px rgba(0,0,0,0.12)',
                    padding: '6px 0',
                    minWidth: 180,
                    zIndex: 200,
                    animation: 'pop-up 0.15s ease',
                  }}
                >
                  {[
                    { label: 'Dashboard', to: '/dashboard' },
                    { label: 'Settings', to: '/settings' },
                    { label: 'Subscription', to: '/settings/subscription' },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      style={{
                        display: 'block',
                        padding: '8px 16px',
                        fontSize: 14,
                        color: 'var(--text-main)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                  <button
                    onClick={onSignOut}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 16px',
                      fontSize: 14,
                      color: 'var(--error)',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={onSignIn}
                className="btn btn-outline"
                style={{ minWidth: 86, height: 42 }}
              >
                Sign In
              </button>
              <button
                onClick={onOpenPricing}
                className="btn btn-primary"
                style={{ gap: 8, minWidth: 138, height: 44, borderRadius: 10, boxShadow: '0 10px 24px rgba(182,84,55,0.28)' }}
              >
                <Crown size={16} />
                Get Premium
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="hide-desktop"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--card-bg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            animation: 'fade-in 0.18s ease',
          }}
          className="hide-desktop"
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${isActive(link.to) ? 'active' : ''}`}
              style={{ padding: '10px 8px', width: '100%' }}
            >
              {link.label}
            </Link>
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

          {/* Theme toggle */}
          <button
            onClick={() => {
              if (!darkLocked) { setDarkMode(!darkMode); return }
              setMobileOpen(false)
              onOpenPricing()
            }}
            aria-label={darkLocked ? 'Dark mode is a premium feature' : darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '10px 8px',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-main)',
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </span>
            {!darkLocked ? (
              <span
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 24,
                  borderRadius: 99,
                  background: darkMode ? 'var(--primary)' : 'var(--border)',
                  position: 'relative',
                  transition: 'background 0.18s ease',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: darkMode ? 19 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.18s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  }}
                />
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--primary)',
                  background: 'var(--primary-bg)',
                  padding: '3px 9px',
                  borderRadius: 99,
                  flexShrink: 0,
                }}
              >
                <Crown size={11} /> Premium
              </span>
            )}
          </button>
          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {user ? (
              <>
                <Link to="/dashboard" className="btn btn-outline btn-sm" style={{ flex: 1 }}>
                  Dashboard
                </Link>
                <button onClick={onSignOut} className="btn btn-outline btn-sm" style={{ flex: 1 }}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button onClick={onSignIn} className="btn btn-outline btn-sm" style={{ flex: 1 }}>
                  Sign In
                </button>
                <button onClick={onOpenPricing} className="btn btn-premium btn-sm" style={{ flex: 1 }}>
                  <Crown size={13} /> Get Premium
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
