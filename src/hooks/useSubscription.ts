import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SubscriptionState, SubscriptionPlan } from '../types'
import { formatSubscriptionDate, getPlanLabel, FREE_DAILY_LIMIT, readFreeUsage } from '../utils'

const getSubscriptionFromUser = (user: User | null): SubscriptionState => {
  const subscription = user?.app_metadata?.scmpedia_subscription
  if (!subscription || subscription.tier !== 'premium') return { tier: 'free' }
  const expiresAt = typeof subscription.expires_at === 'string' ? subscription.expires_at : ''
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return { tier: 'free' }
  return {
    tier: 'premium',
    plan: typeof subscription.plan === 'string' ? subscription.plan : undefined,
    expiresAt,
  }
}

type AuthLike = {
  user: User | null
  session: { access_token: string } | null
  refreshUser: () => Promise<User | null>
}

export function useSubscription(auth: AuthLike) {
  // Derive subscription synchronously from the current user so premium status never
  // lags auth by a render — otherwise gated pages (e.g. Full Page) briefly flash the
  // upgrade wall for a subscriber on the frame auth settles but this state hasn't.
  const derived = getSubscriptionFromUser(auth.user)
  // Optimistic state applied right after a successful Paystack verification, before
  // auth.user has refreshed to reflect it. Dropped once derived catches up (or logout).
  const [override, setOverride] = useState<SubscriptionState | null>(null)
  const [checkingOut, setCheckingOut] = useState<SubscriptionPlan | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (override && (!auth.user || derived.tier === 'premium')) setOverride(null)
  }, [auth.user, derived.tier, override])

  const state: SubscriptionState = override ?? derived

  const verifyReference = useCallback(async (reference: string) => {
    if (!auth.session?.access_token) return
    setVerifying(true)
    setError('')
    try {
      const response = await fetch('/api/paystack/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.session.access_token}`,
        },
        body: JSON.stringify({ reference }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Could not verify payment')
      await auth.refreshUser()
      setOverride({ tier: 'premium', plan: body.plan, expiresAt: body.expiresAt })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify payment')
    } finally {
      setVerifying(false)
    }
  }, [auth])

  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('reference')
    if (!reference || !auth.session?.access_token) return
    void verifyReference(reference).finally(() => {
      const url = new URL(window.location.href)
      url.searchParams.delete('reference')
      window.history.replaceState({}, '', url.toString())
    })
  }, [auth.session?.access_token, verifyReference])

  const subscribe = async (plan: SubscriptionPlan) => {
    if (!auth.user || !auth.session?.access_token) {
      setError('Sign in before subscribing.')
      return { needsAuth: true }
    }
    if (state.tier === 'premium') {
      const expiresLabel = formatSubscriptionDate(state.expiresAt)
      setError(
        expiresLabel
          ? `You are paid until ${expiresLabel}. You can change plans after your current plan expires.`
          : 'You already have an active premium plan.'
      )
      return { needsAuth: false }
    }
    setCheckingOut(plan)
    setError('')
    try {
      const response = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.session.access_token}`,
        },
        body: JSON.stringify({ plan }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body?.authorizationUrl) throw new Error(body?.error || 'Could not start checkout')
      window.location.href = body.authorizationUrl
      return { needsAuth: false }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout')
      setCheckingOut(null)
      return { needsAuth: false }
    }
  }

  const freeSearchesLeft = Math.max(FREE_DAILY_LIMIT - readFreeUsage(), 0)
  const paidUntil = formatSubscriptionDate(state.expiresAt)
  const statusText = state.tier === 'premium'
    ? paidUntil
      ? `${getPlanLabel(state.plan)} plan · paid until ${paidUntil}`
      : `${getPlanLabel(state.plan)} plan · active`
    : `Free plan · ${freeSearchesLeft} ${freeSearchesLeft === 1 ? 'search' : 'searches'} left today`

  return {
    ...state,
    isPremium: state.tier === 'premium',
    checkingOut,
    verifying,
    error,
    subscribe,
    statusText,
    freeSearchesLeft,
    paidUntil,
  }
}
