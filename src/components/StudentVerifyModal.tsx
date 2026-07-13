import React, { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ChevronRight, GraduationCap, PencilLine, Search } from 'lucide-react'
import { supabase } from '../supabase'
import { useUniversityCountries } from '../data/useUniversityCountries'

type Step = 'country' | 'university' | 'details'

interface StudentVerifyModalProps {
  open: boolean
  user: unknown
  onClose: () => void
  // Fires after the student details are saved to the account.
  onComplete: () => void
  submitLabel?: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card-bg)',
  color: 'var(--text-main)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-main)',
  marginBottom: 6,
}

const searchWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--card-bg)',
  padding: '0 12px',
  marginBottom: 10,
}

const STEP_TITLES: Record<Step, { title: string; sub: string }> = {
  country: { title: 'Where do you study?', sub: 'Step 1 of 3 · Select your country' },
  university: { title: 'Select your university', sub: 'Step 2 of 3 · Search or pick from the list' },
  details: { title: 'Your student details', sub: 'Step 3 of 3 · Required before payment' },
}

const focusWithoutScroll = (node: HTMLInputElement | null) => {
  if (!node || typeof window === 'undefined' || typeof document === 'undefined') return
  window.requestAnimationFrame(() => {
    if (document.contains(node)) node.focus({ preventScroll: true })
  })
}

export const StudentVerifyModal: React.FC<StudentVerifyModalProps> = ({ open, user, onClose, onComplete, submitLabel = 'Save & continue to payment' }) => {
  const [step, setStep] = useState<Step>('country')
  const [countryQuery, setCountryQuery] = useState('')
  const [uniQuery, setUniQuery] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [university, setUniversity] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [customUniversity, setCustomUniversity] = useState('')
  const [indexNumber, setIndexNumber] = useState('')
  const [programme, setProgramme] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Seed list merged with admin-approved additions. Called before any early return so
  // the hook order is stable.
  const countries = useUniversityCountries(open)

  // Reset the flow and prefill from previously saved account info on each open.
  useEffect(() => {
    if (!open) return
    const meta = (user as { user_metadata?: Record<string, unknown> } | null)?.user_metadata || {}
    const savedUni = String(meta.student_university || '')
    const savedCustom = Boolean(meta.student_university_custom)
    setStep('country')
    setCountryQuery('')
    setUniQuery('')
    setError('')
    setSaving(false)
    setCountryCode(String(meta.student_country_code || ''))
    setCustomMode(savedCustom)
    setUniversity(savedCustom ? '' : savedUni)
    setCustomUniversity(savedCustom ? savedUni : '')
    setIndexNumber(String(meta.student_index_number || ''))
    setProgramme(String(meta.student_programme || ''))
  }, [open, user])

  useLayoutEffect(() => {
    if (!open || typeof document === 'undefined' || typeof window === 'undefined') return

    const scrollY = window.scrollY
    const body = document.body
    const root = document.documentElement
    const previousBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    const previousRootOverflow = root.style.overflow

    root.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'

    return () => {
      root.style.overflow = previousRootOverflow
      body.style.position = previousBodyStyles.position
      body.style.top = previousBodyStyles.top
      body.style.left = previousBodyStyles.left
      body.style.right = previousBodyStyles.right
      body.style.width = previousBodyStyles.width
      body.style.overflow = previousBodyStyles.overflow
      window.scrollTo(0, scrollY)
    }
  }, [open])

  if (!open) return null

  const country = countries.find((c) => c.code === countryCode) || null
  const chosenUniversity = (customMode ? customUniversity : university).trim()

  const filteredCountries = countries.filter(
    (c) => !countryQuery.trim() || c.name.toLowerCase().includes(countryQuery.trim().toLowerCase()),
  )
  const filteredUnis = (country?.universities || []).filter(
    (u) => !uniQuery.trim() || u.toLowerCase().includes(uniQuery.trim().toLowerCase()),
  )

  const pickCountry = (code: string) => {
    const next = countries.find((c) => c.code === code)
    setCountryCode(code)
    setUniQuery('')
    setError('')
    // Countries without a curated list (e.g. "Other country") go straight to free-typing.
    setCustomMode(!next || next.universities.length === 0)
    setStep('university')
  }

  const pickUniversity = (name: string) => {
    setUniversity(name)
    setCustomMode(false)
    setError('')
    setStep('details')
  }

  const continueWithCustom = () => {
    if (!customUniversity.trim()) {
      setError('Type the name of your university.')
      return
    }
    setError('')
    setStep('details')
  }

  const handleSave = async () => {
    if (!indexNumber.trim()) {
      setError('Your student index number is required.')
      return
    }
    if (!chosenUniversity) {
      setError('Select or type your university first.')
      setStep('university')
      return
    }
    if (!supabase) {
      setError('Authentication is not configured in this environment.')
      return
    }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({
      data: {
        student_country: country?.name || '',
        student_country_code: countryCode,
        student_university: chosenUniversity,
        student_university_custom: customMode,
        student_index_number: indexNumber.trim(),
        student_programme: programme.trim(),
        student_verified_at: new Date().toISOString(),
      },
    })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onComplete()
  }

  const heading = STEP_TITLES[step]

  const modal = (
    <div
      className="modal-overlay svm-scope"
      style={{ zIndex: 2100 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div className="modal-panel" style={{ maxWidth: 540 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '20px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-bg)', color: 'var(--primary)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <GraduationCap size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)' }}>{heading.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>{heading.sub}</div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', cursor: 'pointer', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {step === 'country' && (
            <>
              <div style={searchWrapStyle}>
                <Search size={15} color="var(--text-sub)" />
                <input
                  ref={focusWithoutScroll}
                  value={countryQuery}
                  onChange={(e) => setCountryQuery(e.target.value)}
                  placeholder="Search country..."
                  style={{ ...inputStyle, border: 'none', background: 'transparent', padding: '11px 0' }}
                />
              </div>
              <div className="svm-list">
                {filteredCountries.map((c) => (
                  <button key={c.code} className="svm-row" onClick={() => pickCountry(c.code)}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{c.flag}</span>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{c.name}</span>
                    <ChevronRight size={15} color="var(--text-sub)" />
                  </button>
                ))}
                {!filteredCountries.length && (
                  <div style={{ padding: '18px 14px', fontSize: 13, color: 'var(--text-sub)' }}>
                    No country matches "{countryQuery}". Pick "Other country" to continue.
                  </div>
                )}
              </div>
            </>
          )}

          {step === 'university' && (
            <>
              <button className="svm-back" onClick={() => { setStep('country'); setError('') }}>
                <ArrowLeft size={14} /> {country ? `${country.flag} ${country.name}` : 'Back to countries'}
              </button>

              {!customMode ? (
                <>
                  <div style={searchWrapStyle}>
                    <Search size={15} color="var(--text-sub)" />
                    <input
                      ref={focusWithoutScroll}
                      value={uniQuery}
                      onChange={(e) => setUniQuery(e.target.value)}
                      placeholder="Type to search universities..."
                      style={{ ...inputStyle, border: 'none', background: 'transparent', padding: '11px 0' }}
                    />
                  </div>
                  <div className="svm-list">
                    {filteredUnis.map((u) => (
                      <button key={u} className="svm-row" onClick={() => pickUniversity(u)}>
                        <span style={{ flex: 1, textAlign: 'left', fontSize: 14, color: 'var(--text-main)' }}>{u}</span>
                        <ChevronRight size={15} color="var(--text-sub)" />
                      </button>
                    ))}
                    {!filteredUnis.length && (
                      <div style={{ padding: '14px', fontSize: 13, color: 'var(--text-sub)' }}>No university matches your search.</div>
                    )}
                    <button className="svm-row" onClick={() => { setCustomMode(true); setError('') }} style={{ borderTop: '1px solid var(--border)' }}>
                      <PencilLine size={15} color="var(--primary)" />
                      <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>
                        My university is not listed — type it
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label style={labelStyle}>University name</label>
                  <input
                    ref={focusWithoutScroll}
                    value={customUniversity}
                    onChange={(e) => setCustomUniversity(e.target.value)}
                    placeholder="Type your university's full name"
                    style={inputStyle}
                  />
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 8 }}>
                    We review typed universities and add popular ones to the list.
                  </div>
                  {country && country.universities.length > 0 && (
                    <button className="svm-back" style={{ marginTop: 12, marginBottom: 0 }} onClick={() => { setCustomMode(false); setError('') }}>
                      <ArrowLeft size={14} /> Back to the university list
                    </button>
                  )}
                  {error && <div className="svm-error">{error}</div>}
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={continueWithCustom}>
                    Continue
                  </button>
                </>
              )}
            </>
          )}

          {step === 'details' && (
            <>
              <button className="svm-back" onClick={() => { setStep('university'); setError('') }}>
                <ArrowLeft size={14} /> {country ? `${country.flag} ` : ''}{chosenUniversity || 'Back'}
              </button>

              <label style={labelStyle}>
                Student index number <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <input
                ref={focusWithoutScroll}
                value={indexNumber}
                onChange={(e) => setIndexNumber(e.target.value)}
                placeholder="e.g. UMT/IT/21/0042"
                style={{ ...inputStyle, marginBottom: 14 }}
              />

              <label style={labelStyle}>Programme / course</label>
              <input
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                placeholder="e.g. BSc Information Technology"
                style={inputStyle}
              />

              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 10, lineHeight: 1.5 }}>
                These details are saved to your SCMpedia account and may be used to confirm your student status.
              </div>

              {error && <div className="svm-error">{error}</div>}

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 16, height: 44, fontSize: 15 }}
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Saving…' : submitLabel}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .svm-scope .svm-list {
          border: 1px solid var(--border);
          border-radius: 12px;
          max-height: min(340px, 48vh);
          overflow-y: auto;
          overscroll-behavior: contain;
          background: var(--card-bg);
        }
        .svm-scope .svm-row {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 11px 14px;
          border: none;
          border-bottom: 1px solid var(--surface);
          background: transparent;
          cursor: pointer;
          font-family: inherit;
        }
        .svm-scope .svm-row:last-child { border-bottom: none; }
        .svm-scope .svm-row:hover { background: var(--surface-hover); }
        .svm-scope .svm-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-sub);
          padding: 0;
          margin-bottom: 12px;
          font-family: inherit;
        }
        .svm-scope .svm-back:hover { color: var(--text-main); }
        .svm-scope .svm-error {
          margin-top: 12px;
          padding: 10px 14px;
          background: rgba(220, 38, 38, 0.10);
          border: 1px solid rgba(220, 38, 38, 0.25);
          border-radius: 8px;
          font-size: 13px;
          color: var(--error);
        }
        .svm-scope input:focus {
          border-color: var(--primary);
        }
      `}</style>
    </div>
  )

  return typeof document === 'undefined' ? modal : createPortal(modal, document.body)
}
