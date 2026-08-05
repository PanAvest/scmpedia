import React, { useId } from 'react'
import { ChevronDown, Globe2 } from 'lucide-react'
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../../currency'
import { useCurrency } from './CurrencyProvider'

type CurrencySelectorProps = {
  compact?: boolean
  showMeta?: boolean
  className?: string
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({ compact = false, showMeta = false, className = '' }) => {
  const id = useId()
  const { currency, setCurrency, asOf, loading, error } = useCurrency()

  return (
    <div className={`scm-currency ${compact ? 'scm-currency-compact' : ''} ${className}`}>
      {!compact && <label htmlFor={id}>Display currency</label>}
      <div className="scm-currency-control">
        <Globe2 size={compact ? 14 : 16} aria-hidden />
        <select
          id={id}
          aria-label="Choose display currency"
          title="Choose the currency used to display plan prices"
          value={currency}
          onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
        >
          {SUPPORTED_CURRENCIES.map((option) => (
            <option key={option.code} value={option.code}>
              {compact ? option.code : `${option.code} — ${option.name}`}
            </option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden />
      </div>
      {showMeta && (
        <span className="scm-currency-meta">
          {error
            ? 'Live rates temporarily unavailable'
            : loading
              ? 'Loading Frankfurter rates…'
              : `Frankfurter rates${asOf ? ` · ${asOf}` : ''}`}
        </span>
      )}
      <style>{`
        .scm-currency { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 6px; }
        .scm-currency label { color: var(--text-sub); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .scm-currency-control { position: relative; display: inline-flex; align-items: center; height: 40px; min-width: 232px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--primary); box-shadow: var(--shadow-sm); transition: border-color .18s ease, box-shadow .18s ease; }
        .scm-currency-control:focus-within { border-color: rgba(182,84,55,.55); box-shadow: 0 0 0 3px rgba(182,84,55,.11); }
        .scm-currency-control > svg:first-child { position: absolute; left: 12px; pointer-events: none; }
        .scm-currency-control > svg:last-child { position: absolute; right: 10px; color: var(--text-sub); pointer-events: none; }
        .scm-currency select { width: 100%; height: 100%; appearance: none; border: 0; outline: 0; background: transparent; color: var(--text-main); padding: 0 34px 0 38px; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
        .scm-currency option { background: var(--card-bg); color: var(--text-main); }
        .scm-currency-meta { color: var(--text-sub); font-size: 10px; line-height: 1.35; }
        .scm-currency-compact { flex-shrink: 0; }
        .scm-currency-compact .scm-currency-control { width: 84px; min-width: 84px; height: 36px; border-radius: 8px; box-shadow: none; }
        .scm-currency-compact .scm-currency-control > svg:first-child { left: 9px; }
        .scm-currency-compact .scm-currency-control > svg:last-child { right: 7px; width: 12px; }
        .scm-currency-compact select { padding: 0 23px 0 28px; font-size: 12px; }
        @media (max-width: 420px) {
          .scm-currency-compact .scm-currency-control { width: 76px; min-width: 76px; }
        }
      `}</style>
    </div>
  )
}
