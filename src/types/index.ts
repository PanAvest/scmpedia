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
export type SubscriptionPlan = 'monthly' | 'annual'

export type SubscriptionState = {
  tier: 'free' | 'premium'
  plan?: SubscriptionPlan
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
