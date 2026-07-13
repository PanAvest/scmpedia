import { useState, useEffect } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { hasSupabaseConfig, supabase } from '../supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const authClient = supabase
    let cancelled = false

    authClient.auth.getSession().then(async ({ data, error }) => {
      if (cancelled) return
      if (error) {
        console.warn('Supabase session could not be restored:', error)
        await authClient.auth.signOut().catch(() => undefined)
        if (cancelled) return
        setSession(null)
        setUser(null)
      } else {
        setSession(data.session)
        setUser(data.session?.user ?? null)
      }
      setLoading(false)
    }).catch((error) => {
      console.warn('Supabase session check failed:', error)
      if (!cancelled) {
        setSession(null)
        setUser(null)
        setLoading(false)
      }
    })

    const { data: listener } = authClient.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.access_token) return
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUser(data.user ?? null)
    })
    return () => { cancelled = true }
  }, [session?.access_token])

  // getUser() is a live network read of app_metadata, so a subscription change made
  // server-side (an admin grant/revoke, a Paystack webhook) shows up on the next fetch —
  // but the JWT itself only rotates near expiry, so a tab left open would otherwise lag
  // up to the token TTL. Re-sync on focus/visibility and every 2 minutes to close that.
  useEffect(() => {
    if (!supabase || !session?.access_token) return
    let cancelled = false
    const authClient = supabase
    const sync = () => {
      if (cancelled || document.visibilityState !== 'visible') return
      void authClient.auth.getUser().then(({ data }) => {
        if (!cancelled) setUser(data.user ?? null)
      })
    }
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    const timer = window.setInterval(sync, 120_000)
    return () => {
      cancelled = true
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
      window.clearInterval(timer)
    }
  }, [session?.access_token])

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const refreshUser = async () => {
    if (!supabase) return null
    const { data } = await supabase.auth.getUser()
    setUser(data.user ?? null)
    const sessionResult = await supabase.auth.getSession()
    setSession(sessionResult.data.session)
    return data.user ?? null
  }

  return { session, user, loading, passwordRecovery, setPasswordRecovery, signOut, refreshUser, hasSupabaseConfig }
}
