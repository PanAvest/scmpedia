import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
const AUTH_CALLBACK_PATHS = new Set(['/auth', '/auth/reset'])

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey)

// A trailing slash on the allow-listed redirect URL would otherwise miss the Set lookup, and the
// tokens would be dropped with no session and no error — the same silent failure we are fixing.
const normalizePath = (pathname: string) => pathname.replace(/\/+$/, '') || '/'

// auth-js accepts a predicate here (`boolean | ((url, params) => boolean)`), and calls it to decide
// whether a URL is an implicit-grant callback. Claiming a URL we don't own would let a stray
// #access_token on any page mint a session, so we only claim our own callback paths.
//
// It must NEVER return true for a `?code=` URL: _isImplicitGrantCallback is tested before
// _isPKCECallback, so claiming a code URL here would misroute PKCE and break every auth link the
// day anyone sets flowType: 'pkce'.
const shouldDetectSessionInUrl = (url: URL, params: Record<string, string>) => {
  if (!AUTH_CALLBACK_PATHS.has(normalizePath(url.pathname))) return false
  if (params.error || params.error_description) return true
  return Boolean(params.access_token && params.refresh_token)
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

// True when this page load is the landing from a confirmation email. Read from the query string,
// which — unlike the hash — auth-js never rewrites, so it stays readable for the life of the page.
export const isEmailConfirmCallback = (): boolean => {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('confirmed') === '1'
}
