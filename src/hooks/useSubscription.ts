import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SubscriptionState, SubscriptionPlan } from '../types'
import { formatSubscriptionDate, getPlanLabel, FREE_DAILY_LIMIT, readFreeUsage } from '../utils'

const PENDING_PAYSTACK_REFERENCE_KEY = 'scmpedia-pending-paystack-reference'

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
  const automaticVerificationRef = useRef('')

  useEffect(() => {
    if (override && (!auth.user || derived.tier === 'premium')) setOverride(null)
  }, [auth.user, derived.tier, override])

  const state: SubscriptionState = override ?? derived

  const verifyReference = useCallback(async (reference: string) => {
    if (!auth.session?.access_token) return false
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
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify payment')
      return false
    } finally {
      setVerifying(false)
    }
  }, [auth])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const callbackReference = params.get('reference') || params.get('trxref') || ''
    if (callbackReference) sessionStorage.setItem(PENDING_PAYSTACK_REFERENCE_KEY, callbackReference)
    const reference = callbackReference || sessionStorage.getItem(PENDING_PAYSTACK_REFERENCE_KEY) || ''
    if (!reference || !auth.session?.access_token) return
    if (automaticVerificationRef.current === reference) return
    automaticVerificationRef.current = reference
    void verifyReference(reference).then((verified) => {
      if (!verified) return
      sessionStorage.removeItem(PENDING_PAYSTACK_REFERENCE_KEY)
      const url = new URL(window.location.href)
      url.searchParams.delete('reference')
      url.searchParams.delete('trxref')
      window.history.replaceState({}, '', url.toString())
    })
  }, [auth.session?.access_token, verifyReference])

  const retryVerification = useCallback(async () => {
    const params = new URLSearchParams(window.location.search)
    const reference = params.get('reference') || params.get('trxref') || sessionStorage.getItem(PENDING_PAYSTACK_REFERENCE_KEY) || ''
    if (!reference) {
      setError('Missing Paystack payment reference.')
      return false
    }
    automaticVerificationRef.current = reference
    const verified = await verifyReference(reference)
    if (verified) {
      sessionStorage.removeItem(PENDING_PAYSTACK_REFERENCE_KEY)
      const url = new URL(window.location.href)
      url.searchParams.delete('reference')
      url.searchParams.delete('trxref')
      window.history.replaceState({}, '', url.toString())
    }
    return verified
  }, [verifyReference])

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
    retryVerification,
    statusText,
    freeSearchesLeft,
    paidUntil,
  }
}
