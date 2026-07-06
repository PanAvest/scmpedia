export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '')
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_NEXT_PUBLIC_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  ''

export const hasApiConfig = Boolean(API_BASE_URL)
export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const DEFAULT_ELEVENLABS_VOICE_ID = 'VR5rq02kIGuHRg0JKxB6'
export const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2'
export const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128'

