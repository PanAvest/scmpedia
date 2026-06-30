export type Entry = {
  id?: string
  source_key?: string
  term: string
  definition: string
  synonyms?: string
  tags?: string
  pos?: string
  pronunciation?: string
  examples?: string
}

export type Message = {
  id: string
  role: 'user' | 'bot'
  content?: string
  entry?: Entry
  related?: Entry[]
  loading?: boolean
  timestamp: number
}

export type TTSProvider = 'elevenlabs' | 'browser'
export type AuthMode = 'signin' | 'signup' | 'forgot' | 'update'
export type ProfileView = 'home' | 'dashboard'
export type SubscriptionTier = 'student' | 'pro'
export type BillingPeriod = 'monthly' | 'annual'
// Plan id sent to checkout, e.g. 'student-annual' | 'pro-monthly'
export type SubscriptionPlan = `${SubscriptionTier}-${BillingPeriod}`

export type SubscriptionState = {
  tier: 'free' | 'premium'
  // Stored plan id; kept as a loose string so legacy values ('monthly'/'annual') still render
  plan?: string
  expiresAt?: string
}

export type FavoriteRow = {
  id: string
  user_id: string
  word_id: string | null
  term: string
  created_at: string
}

export type DictionaryPage =
  | { type: 'cover' }
  | { type: 'entries'; entries: Entry[]; pageNumber: number }
