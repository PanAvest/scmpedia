import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
const AUTH_CALLBACK_PATHS = new Set(['/auth', '/auth/reset'])

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey)

const shouldDetectSessionInUrl = (url: URL, params: Record<string, string>) => {
  if (!AUTH_CALLBACK_PATHS.has(url.pathname)) return false
  if (params.error || params.error_description) return true
  if (params.access_token && params.refresh_token) return true
  return Boolean(params.code)
}

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: shouldDetectSessionInUrl,
      },
    })
  : null
