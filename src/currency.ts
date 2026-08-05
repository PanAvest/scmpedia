export const BASE_CURRENCY = 'GHS' as const

export const SUPPORTED_CURRENCIES = [
  { code: 'GHS', name: 'Ghanaian cedi' },
  { code: 'USD', name: 'US dollar' },
  { code: 'GBP', name: 'British pound' },
  { code: 'EUR', name: 'Euro' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'NGN', name: 'Nigerian naira' },
  { code: 'KES', name: 'Kenyan shilling' },
  { code: 'XOF', name: 'West African CFA franc' },
  { code: 'XAF', name: 'Central African CFA franc' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'AED', name: 'UAE dirham' },
] as const

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code']
export type CurrencyRates = Partial<Record<CurrencyCode, number>>
export type CompleteCurrencyRates = Record<CurrencyCode, number>

export const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  typeof value === 'string' && SUPPORTED_CURRENCIES.some((currency) => currency.code === value)

export const hasCompleteCurrencyRates = (value: unknown): value is CompleteCurrencyRates => {
  if (!value || typeof value !== 'object') return false
  const rates = value as CurrencyRates
  return SUPPORTED_CURRENCIES.every(({ code }) => {
    const rate = rates[code]
    return typeof rate === 'number' && Number.isFinite(rate) && rate > 0
  })
}

export const formatCurrency = (amount: number, currency: CurrencyCode) =>
  new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: currency === 'XOF' || currency === 'XAF' ? 0 : 2,
    maximumFractionDigits: currency === 'XOF' || currency === 'XAF' ? 0 : 2,
  }).format(amount)
