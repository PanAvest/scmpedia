import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  BASE_CURRENCY,
  formatCurrency,
  hasCompleteCurrencyRates,
  isCurrencyCode,
  type CurrencyCode,
  type CurrencyRates,
} from '../../currency'

type CurrencyContextValue = {
  currency: CurrencyCode
  displayCurrency: CurrencyCode
  rates: CurrencyRates
  asOf: string | null
  loading: boolean
  error: boolean
  rateAvailable: boolean
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

const wait = (duration: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, duration)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeout)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })

const fetchCurrencyRates = async (signal: AbortSignal) => {
  let lastError: unknown = new Error('Rates unavailable')
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch('/api/currency', { cache: 'no-store', signal })
      const payload = (await response.json()) as { rates?: unknown; asOf?: string | null }
      if (!response.ok || !hasCompleteCurrencyRates(payload.rates)) throw new Error('Rates unavailable')
      return { rates: payload.rates, asOf: payload.asOf || null }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      lastError = error
      if (attempt < 2) await wait(500 * (attempt + 1), signal)
    }
  }
  throw lastError
}

export const CurrencyProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(BASE_CURRENCY)
  const [rates, setRates] = useState<CurrencyRates>({ GHS: 1 })
  const [asOf, setAsOf] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const userChoseCurrencyRef = useRef(false)

  useEffect(() => {
    let active = true
    let hasFreshCache = false
    const savedCurrency = localStorage.getItem(PREFERENCE_KEY)
    const hasSavedPreference = isCurrencyCode(savedCurrency)
    if (hasSavedPreference) setCurrencyState(savedCurrency)

    try {
      const storedRates = localStorage.getItem(RATES_KEY)
      if (storedRates) {
        const cached = JSON.parse(storedRates) as CachedRates
        if (hasCompleteCurrencyRates(cached.rates) && Date.now() - cached.savedAt < CACHE_LIFETIME_MS) {
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
          if (!active || !response.ok || !isCurrencyCode(payload.currency) || userChoseCurrencyRef.current) return
          setCurrencyState(payload.currency)
          localStorage.setItem(PREFERENCE_KEY, payload.currency)
        })
        .catch(() => {
          // Location is optional; retain GHS if Vercel cannot detect the country.
        })
    }

    fetchCurrencyRates(controller.signal)
      .then((payload) => {
        if (!active) return
        const nextRates = payload.rates
        setRates(nextRates)
        setAsOf(payload.asOf)
        setError(false)
        localStorage.setItem(
          RATES_KEY,
          JSON.stringify({ rates: nextRates, asOf: payload.asOf, savedAt: Date.now() }),
        )
      })
      .catch((fetchError: unknown) => {
        if (!active) return
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return
        setError(!hasFreshCache)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  const setCurrency = useCallback((nextCurrency: CurrencyCode) => {
    userChoseCurrencyRef.current = true
    setCurrencyState(nextCurrency)
    localStorage.setItem(PREFERENCE_KEY, nextCurrency)
  }, [])

  const displayCurrency = currency
  const rateAvailable = currency === BASE_CURRENCY || rates[currency] != null
  const formatFromGhs = useCallback(
    (amountGhs: number) => {
      if (amountGhs === 0) return formatCurrency(0, currency)
      const rate = rates[currency]
      return rate == null ? '—' : formatCurrency(amountGhs * rate, currency)
    },
    [currency, rates],
  )

  const value = useMemo(
    () => ({ currency, displayCurrency, rates, asOf, loading, error, rateAvailable, setCurrency, formatFromGhs }),
    [currency, displayCurrency, rates, asOf, loading, error, rateAvailable, setCurrency, formatFromGhs],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext)
  if (!context) throw new Error('useCurrency must be used inside CurrencyProvider')
  return context
}
