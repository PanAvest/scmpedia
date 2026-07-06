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

export type FavoriteRow = {
  id: string
  user_id: string
  word_id: string | null
  term: string
  created_at: string
}

export type HistoryItem = {
  term: string
  at: number
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  query?: string
  entry?: Entry
  related?: Entry[]
  content?: string
  loading?: boolean
}

export type SubscriptionPlan = 'monthly' | 'annual'

export type SubscriptionState = {
  tier: 'free' | 'premium'
  plan?: SubscriptionPlan
  expiresAt?: string
}

export type Screen =
  | 'home'
  | 'term'
  | 'dictionary'
  | 'dashboard'
  | 'pricing'
  | 'settings'
  | 'about'
  | 'auth'
