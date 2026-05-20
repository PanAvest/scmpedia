import React, { useRef, useEffect, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import type { Entry } from '../types'

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (query: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  suggestions: Entry[]
  suggestionsLoading: boolean
  selectedSuggestion: number
  disabled?: boolean
  placeholder?: string
  size?: 'default' | 'large'
  autoFocus?: boolean
  dropdownPosition?: 'above' | 'below'
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  suggestions,
  suggestionsLoading,
  selectedSuggestion,
  disabled,
  placeholder = 'Search supply chain terms...',
  size = 'default',
  autoFocus,
  dropdownPosition = 'below',
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [dropdownDismissed, setDropdownDismissed] = useState(false)
  const isLarge = size === 'large'
  const showDropdown = !!value.trim() && !dropdownDismissed && (suggestionsLoading || suggestions.length > 0)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    setDropdownDismissed(false)
  }, [value])

  useEffect(() => {
    if (!showDropdown) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setDropdownDismissed(true)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [showDropdown])

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      {/* Suggestions dropdown */}
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            ...(dropdownPosition === 'above' ? { bottom: '100%', marginBottom: 8 } : { top: '100%', marginTop: 8 }),
            left: 0,
            right: 0,
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: isLarge ? 18 : 14,
            boxShadow: isLarge ? '0 18px 48px rgba(18,24,21,0.14)' : '0 8px 28px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            zIndex: 50,
            animation: 'pop-up 0.15s ease',
          }}
        >
          {/* Popular label */}
          <div style={{ padding: isLarge ? '16px 22px 8px' : '10px 16px 6px', fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Popular searches
          </div>

          {suggestionsLoading && !suggestions.length ? (
            // Skeleton
            [1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '40% 1fr', gap: 16, padding: '10px 16px', alignItems: 'center', borderBottom: '1px solid var(--surface)' }}>
                <div className="skeleton" style={{ height: 13, borderRadius: 99 }} />
                <div className="skeleton" style={{ height: 11, borderRadius: 99 }} />
              </div>
            ))
          ) : (
            suggestions.map((s, i) => (
              <div
                key={s.id || s.term}
                onClick={() => onSubmit(s.term)}
                style={{
                  padding: isLarge ? '12px 22px' : '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderBottom: i < suggestions.length - 1 ? '1px solid var(--surface)' : 'none',
                  background: i === selectedSuggestion ? 'var(--surface-hover)' : 'transparent',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = i === selectedSuggestion ? 'var(--surface-hover)' : 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ArrowRight size={13} color="var(--text-sub)" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{s.term}</div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-sub)',
                    maxWidth: '55%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.definition}
                </span>
              </div>
            ))
          )}

          {suggestions.length > 0 && (
            <div
              style={{ padding: '8px 16px 10px', borderTop: '1px solid var(--surface)' }}
            >
              <button
                onClick={() => onSubmit(value)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: 'var(--primary)',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                View all popular searches <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input wrapper */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--card-bg)',
            borderRadius: isLarge ? 18 : 10,
            border: '1px solid var(--border)',
            boxShadow: isLarge ? '0 14px 42px rgba(18,24,21,0.11)' : 'var(--shadow-sm)',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          overflow: 'hidden',
        }}
        onFocus={() => {}}
      >
        <Search
          size={isLarge ? 20 : 16}
          color="var(--text-sub)"
          style={{ marginLeft: isLarge ? 24 : 14, flexShrink: 0 }}
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setDropdownDismissed(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: isLarge ? '20px 18px' : '12px 12px',
            fontSize: isLarge ? 17 : 14,
            color: 'var(--text-main)',
            fontFamily: 'inherit',
          }}
        />
        {/* Submit button */}
        <button
          type="button"
          onClick={() => onSubmit(value)}
          disabled={disabled || !value.trim()}
          aria-label="Search"
          style={{
            width: isLarge ? 52 : 38,
            height: isLarge ? 52 : 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: isLarge ? '8px' : '4px',
            borderRadius: '50%',
            border: 'none',
            background: value.trim() && !disabled ? 'var(--primary)' : 'var(--surface)',
            color: value.trim() && !disabled ? '#fff' : 'var(--text-sub)',
            cursor: value.trim() && !disabled ? 'pointer' : 'not-allowed',
            opacity: disabled || !value.trim() ? 0.65 : 1,
            flexShrink: 0,
            transition: 'all 0.18s ease',
          }}
        >
          <ArrowRight size={isLarge ? 20 : 16} />
        </button>
      </div>
    </div>
  )
}
