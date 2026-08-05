export const BASE_CURRENCY = 'GHS' as const

export const CURRENCY_CODES = [
  'GHS',
  'USD',
  'GBP',
  'EUR',
  'ZAR',
  'INR',
  'NGN',
  'KES',
  'XOF',
  'XAF',
  'CAD',
  'AUD',
  'AED',
] as const

export type CurrencyCode = (typeof CURRENCY_CODES)[number]

type FrankfurterRate = {
  date: string
  base: string
  quote: string
  rate: number
}

export type CurrencyRatesPayload = {
  base: typeof BASE_CURRENCY
  rates: Record<CurrencyCode, number>
  asOf: string | null
  provider: 'Frankfurter'
}

const COUNTRIES_BY_CURRENCY: Record<Exclude<CurrencyCode, 'GHS'>, readonly string[]> = {
  USD: ['US', 'EC', 'SV', 'PA', 'TL', 'MH', 'FM', 'PW'],
  GBP: ['GB'],
  EUR: ['AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'],
  ZAR: ['ZA'],
  INR: ['IN'],
  NGN: ['NG'],
  KES: ['KE'],
  XOF: ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'],
  XAF: ['CM', 'CF', 'TD', 'CG', 'GQ', 'GA'],
  CAD: ['CA'],
  AUD: ['AU'],
  AED: ['AE'],
}

export const currencyForCountry = (country: string | null | undefined): CurrencyCode => {
  const code = country?.trim().toUpperCase()
  if (!code || code === 'GH') return BASE_CURRENCY
  for (const [currency, countries] of Object.entries(COUNTRIES_BY_CURRENCY)) {
    if (countries.includes(code)) return currency as CurrencyCode
  }
  return 'USD'
}

export async function loadCurrencyRates(): Promise<CurrencyRatesPayload> {
  const quotes = CURRENCY_CODES.filter((code) => code !== BASE_CURRENCY).join(',')
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rates?base=${BASE_CURRENCY}&quotes=${encodeURIComponent(quotes)}`,
    { headers: { Accept: 'application/json' } },
  )

  if (!response.ok) throw new Error(`Frankfurter returned HTTP ${response.status}`)

  const rows = (await response.json()) as FrankfurterRate[]
  const partial: Partial<Record<CurrencyCode, number>> = { GHS: 1 }

  for (const row of rows) {
    const quote = row.quote as CurrencyCode
    if (
      CURRENCY_CODES.includes(quote) &&
      typeof row.rate === 'number' &&
      Number.isFinite(row.rate) &&
      row.rate > 0
    ) {
      partial[quote] = row.rate
    }
  }

  const missing = CURRENCY_CODES.filter((code) => partial[code] == null)
  if (missing.length) throw new Error(`Frankfurter did not return rates for ${missing.join(', ')}`)

  const effectiveDates = rows.map((row) => row.date).filter(Boolean).sort()
  return {
    base: BASE_CURRENCY,
    rates: partial as Record<CurrencyCode, number>,
    asOf: effectiveDates[0] || null,
    provider: 'Frankfurter',
  }
}
