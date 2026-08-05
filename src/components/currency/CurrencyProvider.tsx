import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BASE_CURRENCY, formatCurrency, isCurrencyCode, type CurrencyCode, type CurrencyRates } from '../../currency'

type CurrencyContextValue = {
  currency: CurrencyCode
  displayCurrency: CurrencyCode
  rates: CurrencyRates
  asOf: string | null
  loading: boolean
  error: boolean
  setCurrency: (currency: CurrencyCode) => void
  formatFromGhs: (amountGhs: number) => string
}

type CachedRates = {
  rates: CurrencyRates
  asOf: string | null
  savedAt: number
}

const PREFERENCE_KEY = 'scmpedia-display-currency-v1'
const RATES_KEY = 'scmpedia-frankfurter-rates-v1'
const CACHE_LIFETIME_MS = 12 * 60 * 60 * 1000

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export const CurrencyProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(BASE_CURRENCY)
  const [rates, setRates] = useState<CurrencyRates>({ GHS: 1 })
  const [asOf, setAsOf] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const userChoseCurrencyRef = useRef(false)

  useEffect(() => {
    let hasFreshCache = false
    const savedCurrency = localStorage.getItem(PREFERENCE_KEY)
    const hasSavedPreference = isCurrencyCode(savedCurrency)
    if (hasSavedPreference) setCurrencyState(savedCurrency)

    try {
      const storedRates = localStorage.getItem(RATES_KEY)
      if (storedRates) {
        const cached = JSON.parse(storedRates) as CachedRates
        if (cached.rates?.GHS === 1 && Date.now() - cached.savedAt < CACHE_LIFETIME_MS) {
          hasFreshCache = true
          setRates(cached.rates)
          setAsOf(cached.asOf)
          setLoading(false)
        }
      }
    } catch {
      localStorage.removeItem(RATES_KEY)
    }

    const controller = new AbortController()
    if (!hasSavedPreference) {
      fetch('/api/location', { cache: 'no-store', signal: controller.signal })
        .then(async (response) => {
          const payload = (await response.json()) as { currency?: unknown }
          if (!response.ok || !isCurrencyCode(payload.currency) || userChoseCurrencyRef.current) return
          setCurrencyState(payload.currency)
          localStorage.setItem(PREFERENCE_KEY, payload.currency)
        })
        .catch(() => {
          // Location is optional; retain GHS if Vercel cannot detect the country.
        })
    }

    fetch('/api/currency', { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { rates?: CurrencyRates; asOf?: string | null }
        if (!response.ok || !payload.rates) throw new Error('Rates unavailable')
        const nextRates = { ...payload.rates, GHS: 1 }
        setRates(nextRates)
        setAsOf(payload.asOf || null)
        setError(false)
        localStorage.setItem(
          RATES_KEY,
          JSON.stringify({ rates: nextRates, asOf: payload.asOf || null, savedAt: Date.now() }),
        )
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return
        setError(!hasFreshCache)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  const setCurrency = useCallback((nextCurrency: CurrencyCode) => {
    userChoseCurrencyRef.current = true
    setCurrencyState(nextCurrency)
    localStorage.setItem(PREFERENCE_KEY, nextCurrency)
  }, [])

  const displayCurrency = rates[currency] == null ? BASE_CURRENCY : currency
  const formatFromGhs = useCallback(
    (amountGhs: number) => formatCurrency(amountGhs * (rates[currency] ?? 1), displayCurrency),
    [currency, displayCurrency, rates],
  )

  const value = useMemo(
    () => ({ currency, displayCurrency, rates, asOf, loading, error, setCurrency, formatFromGhs }),
    [currency, displayCurrency, rates, asOf, loading, error, setCurrency, formatFromGhs],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext)
  if (!context) throw new Error('useCurrency must be used inside CurrencyProvider')
  return context
}
