import React from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

type Props = {
  authLoading: boolean
  signedIn: boolean
  verifying: boolean
  isPremium: boolean
  error: string
  onRetry: () => Promise<boolean>
}

export const PaystackCallbackPage: React.FC<Props> = ({
  authLoading,
  signedIn,
  verifying,
  isPremium,
  error,
  onRetry,
}) => {
  const pending = authLoading || verifying || (signedIn && !isPremium && !error)

  return (
    <section style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '64px 24px' }}>
      <div className="card" style={{ width: 'min(100%, 560px)', padding: 32, textAlign: 'center' }}>
        {isPremium ? (
          <>
            <CheckCircle2 size={52} aria-hidden="true" style={{ color: 'var(--success-green)', marginBottom: 18 }} />
            <h1 style={{ marginBottom: 10 }}>Payment confirmed</h1>
            <p style={{ color: 'var(--text-sub)', marginBottom: 24 }}>
              Your premium access is active. Thank you for subscribing to SCMpedia.
            </p>
            <Link className="btn btn-primary" to="/dashboard">Go to your dashboard</Link>
          </>
        ) : error ? (
          <>
            <AlertCircle size={52} aria-hidden="true" style={{ color: 'var(--error)', marginBottom: 18 }} />
            <h1 style={{ marginBottom: 10 }}>We could not confirm the payment</h1>
            <p role="alert" style={{ color: 'var(--text-sub)', marginBottom: 24 }}>{error}</p>
            <button className="btn btn-primary" type="button" onClick={() => void onRetry()} disabled={verifying}>
              Try verification again
            </button>
          </>
        ) : !signedIn && !authLoading ? (
          <>
            <AlertCircle size={52} aria-hidden="true" style={{ color: '#b7791f', marginBottom: 18 }} />
            <h1 style={{ marginBottom: 10 }}>Sign in to finish verification</h1>
            <p style={{ color: 'var(--text-sub)', marginBottom: 24 }}>
              Your payment reference is saved in this browser. Sign in with the account used for payment to activate access.
            </p>
            <Link className="btn btn-primary" to="/auth">Sign in</Link>
          </>
        ) : pending ? (
          <>
            <LoaderCircle size={52} aria-hidden="true" style={{ color: 'var(--primary)', marginBottom: 18, animation: 'spin 0.75s linear infinite' }} />
            <h1 style={{ marginBottom: 10 }}>Confirming your payment</h1>
            <p aria-live="polite" style={{ color: 'var(--text-sub)', marginBottom: 0 }}>
              Please keep this page open while SCMpedia verifies the transaction with Paystack.
            </p>
          </>
        ) : null}
      </div>
    </section>
  )
}
