import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { RaffleDrawMode } from './components/RaffleDrawMode'

type Entry = {
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

type PapaParse = {
  parse: (csv: string, config: any) => { data: any[] }
  unparse: (data: any) => string
}

const LOCAL_ENTRIES_KEY = 'scmpedia-admin-entries-v1'
const ADMIN_TOKEN_KEY = 'scmpedia-admin-token-v1'

type PlanRow = {
  id: string
  tier: string
  period: string
  amount: number // pesewas (GHS * 100)
  duration_days: number
  label: string
  active: boolean
}

type StudentRow = {
  id: string
  email: string
  full_name: string
  country: string
  country_code: string
  university: string
  university_custom: boolean
  index_number: string
  programme: string
  saved_at: string
  plan: string
  created_at: string
}

// 'GH' → 🇬🇭 (regional-indicator emoji); anything else → 🌍
const flagFor = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : '🌍'

const STYLES = `
:root {
  --bg: #f7f5f2;
  --surface: #ffffff;
  --surface-2: #f0eee9;
  --primary: #b65437;
  --primary-dark: #8f3e25;
  --text-main: #1f1f1f;
  --text-sub: #5f5b57;
  --border: #e6e2db;
  --shadow: 0 10px 24px rgba(20, 12, 4, 0.08);
  --radius: 14px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

* { box-sizing: border-box; }
body { margin: 0; font-family: "Google Sans", "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Arial Unicode MS", sans-serif; background: var(--bg); color: var(--text-main); }

.admin-shell { min-height: 100dvh; display: flex; flex-direction: column; }
.admin-header { padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.9); backdrop-filter: blur(6px); position: sticky; top: 0; z-index: 10; }
.brand { font-size: 18px; font-weight: 600; letter-spacing: -0.2px; }
.brand span { color: var(--primary); }
.header-actions { display: flex; gap: 10px; }

.btn { border: none; cursor: pointer; border-radius: 10px; padding: 10px 14px; font-weight: 600; font-size: 13px; transition: transform 0.2s ease, box-shadow 0.2s ease; }
.btn-primary { background: var(--primary); color: #fff; box-shadow: 0 6px 16px rgba(182, 84, 55, 0.25); }
.btn-secondary { background: var(--surface-2); color: var(--text-main); }
.btn-danger { background: #b91c1c; color: #fff; box-shadow: 0 6px 16px rgba(185, 28, 28, 0.18); }
.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

.admin-main { flex: 1; display: grid; grid-template-columns: 320px 1fr; gap: 20px; padding: 20px 24px 24px; align-items: start; }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 16px; }
.panel-title { font-weight: 600; margin-bottom: 10px; color: var(--text-sub); font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; }
.panel-title-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.panel-title-row .panel-title { margin-bottom: 0; }
.count-pill { border-radius: 999px; background: var(--surface-2); color: var(--text-sub); font-size: 11px; font-weight: 700; padding: 5px 8px; }

.search-input { width: 100%; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 14px; }
.list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; max-height: 65vh; overflow-y: auto; }
.list-item { padding: 10px 12px; border-radius: 10px; background: var(--surface-2); cursor: pointer; transition: background 0.2s ease, transform 0.2s ease; }
.list-item:hover { background: #e9e3d9; }
.list-item.active { background: rgba(182, 84, 55, 0.12); color: var(--primary-dark); font-weight: 600; }
.loading-strip { display: flex; align-items: center; gap: 8px; margin-top: 10px; color: var(--text-sub); font-size: 12px; font-weight: 600; }
.spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(182,84,55,0.18); border-top-color: var(--primary); animation: spin 0.8s linear infinite; flex: 0 0 auto; }
.skeleton-list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.skeleton-item { height: 38px; border-radius: 10px; background: linear-gradient(90deg, #f2eee8 0%, #fff 45%, #f2eee8 90%); background-size: 220% 100%; animation: shimmer 1.1s ease-in-out infinite; }
.skeleton-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.skeleton-field { height: 62px; border-radius: 10px; background: linear-gradient(90deg, #f2eee8 0%, #fff 45%, #f2eee8 90%); background-size: 220% 100%; animation: shimmer 1.1s ease-in-out infinite; }
.skeleton-field.full { grid-column: 1 / -1; height: 116px; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-row.full { grid-column: 1 / -1; }
.label { font-size: 12px; font-weight: 600; color: var(--text-sub); }
.input, .textarea { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 14px; font-family: inherit; background: #fff; }
.textarea { min-height: 90px; resize: vertical; }
.helper { font-size: 12px; color: var(--text-sub); margin-top: 6px; }
.price-field { display: flex; align-items: center; gap: 8px; }
.price-field .input { flex: 1; min-width: 0; }
.price-affix { font-size: 13px; font-weight: 700; color: var(--text-sub); white-space: nowrap; }
.status { font-size: 12px; color: var(--primary-dark); font-weight: 600; width: 100%; }
.status.success { color: #047857; }
.status.warn { color: #b45309; }
.status.error { color: #b91c1c; }

.login-wrap { min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px; }
.login-card { width: min(420px, 100%); background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow); padding: 24px; animation: pop-up 0.25s ease; }
.login-title { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
.login-sub { font-size: 13px; color: var(--text-sub); margin-bottom: 16px; }
.error { color: #b91c1c; font-size: 12px; margin-top: 8px; }

.fade-in { animation: fade-in 0.35s ease; }

@keyframes pop-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shimmer { 0% { background-position: 140% 0; } 100% { background-position: -80% 0; } }

@media (max-width: 900px) {
  .admin-main { grid-template-columns: 1fr; padding: 16px; }
  .list { max-height: 260px; }
  .form-grid { grid-template-columns: 1fr; }
  .skeleton-form { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .admin-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .header-actions { flex-wrap: wrap; }
}
`

const defaultEntry: Entry = {
  term: '',
  definition: '',
  synonyms: '',
  tags: '',
  pos: '',
  pronunciation: '',
  examples: '',
}

function AdminApp() {
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) || '')
  const [authed, setAuthed] = useState(() => Boolean(localStorage.getItem(ADMIN_TOKEN_KEY)))
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<Entry>(defaultEntry)
  const [query, setQuery] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [backgroundLoading, setBackgroundLoading] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [status, setStatus] = useState('Ready')
  const [statusTone, setStatusTone] = useState<'default' | 'success' | 'warn' | 'error'>('default')
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [plansLoading, setPlansLoading] = useState(false)
  const [plansStatus, setPlansStatus] = useState('')
  const [plansTone, setPlansTone] = useState<'default' | 'success' | 'error'>('default')
  const [adminRole, setAdminRole] = useState(() => localStorage.getItem('scmpedia-admin-role-v1') || '')
  const [adminEmail, setAdminEmail] = useState(() => localStorage.getItem('scmpedia-admin-email-v1') || '')
  const [admins, setAdmins] = useState<{ id: string; email: string; role: string; created_at?: string }[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsStatus, setAccountsStatus] = useState('')
  const [accountsTone, setAccountsTone] = useState<'default' | 'success' | 'error'>('default')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'master'>('admin')
  const [myPassword, setMyPassword] = useState('')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [customUnis, setCustomUnis] = useState<{ name: string; count: number }[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [studentsStatus, setStudentsStatus] = useState('')
  const [studentsTone, setStudentsTone] = useState<'default' | 'success' | 'error'>('default')
  const [studentSearch, setStudentSearch] = useState('')
  const [raffleOpen, setRaffleOpen] = useState(false)
  const papaRef = useRef<PapaParse | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => !q || entry.term.toLowerCase().includes(q))
  }, [entries, query])

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) =>
      [s.email, s.full_name, s.university, s.index_number, s.programme, s.country].some((v) => v.toLowerCase().includes(q)),
    )
  }, [students, studentSearch])

  const showStatus = (message: string, tone: 'default' | 'success' | 'warn' | 'error' = 'default') => {
    setStatus(message)
    setStatusTone(tone)
  }

  const updateDraft = (patch: Partial<Entry>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  const persistEntries = (next: Entry[]) => {
    localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(next))
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: LOCAL_ENTRIES_KEY,
        newValue: JSON.stringify(next),
      }),
    )
  }

  const normalizeRow = (row: any): Entry => ({
    id: row.id ? String(row.id) : undefined,
    source_key: String(row.source_key || row.sourceKey || row.SourceKey || '').trim() || undefined,
    term: String(row.term || row.Term || '').trim(),
    definition: String(row.definition || row.Definition || '').trim(),
    synonyms: String(row.synonyms || row.Synonyms || ''),
    tags: String(row.tags || row.Tags || ''),
    pos: String(row.pos || row.Pos || ''),
    pronunciation: String(row.pronunciation || row.Pronunciation || ''),
    examples: String(row.examples || row.Examples || ''),
  })

  const loadPapa = (): Promise<PapaParse> =>
    new Promise((resolve, reject) => {
      if (papaRef.current) return resolve(papaRef.current)
      const existing = (window as any).Papa
      if (existing) {
        papaRef.current = existing
        return resolve(existing)
      }
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js'
      script.onload = () => {
        papaRef.current = (window as any).Papa
        if (!papaRef.current) return reject(new Error('PapaParse failed to load'))
        resolve(papaRef.current)
      }
      script.onerror = () => reject(new Error('PapaParse failed to load'))
      document.head.appendChild(script)
    })

  const adminHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  })

  const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const fetchWordsPage = async (offset: number, limit = 1000) => {
    const res = await fetch(`/api/words?browse=1&limit=${limit}&offset=${offset}`, {
      cache: 'no-store',
      headers: adminHeaders(),
    })
    const body = await res.json().catch(() => ({}))
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem(ADMIN_TOKEN_KEY)
      setAdminToken('')
      setAuthed(false)
    }
    if (!res.ok) throw new Error(body?.error || 'Failed to load server dictionary')
    const words = Array.isArray(body?.words) ? body.words.map(normalizeRow).filter((e: Entry) => e.term && e.definition) : []
    return {
      words,
      nextOffset: Number(body?.nextOffset || offset + words.length),
      count: typeof body?.count === 'number' ? body.count : null,
    }
  }

  const loadServerEntries = async (onBatch?: (batch: Entry[], loaded: number, count: number | null) => void) => {
    let offset = 0
    let all: Entry[] = []

    while (true) {
      const page = await fetchWordsPage(offset)
      const next = page.words
      all = [...all, ...next]
      onBatch?.(next, all.length, page.count)
      if (!next.length || next.length < 1000) break
      offset = page.nextOffset
      await delay(120)
    }

    return all
  }

  const syncWords = async (words: Entry[]) => {
    const res = await fetch('/api/words', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ words }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.error || 'Failed to save words to server')
    return Number(body?.imported || 0)
  }

  const loadCsv = async () => {
    setLoading(true)
    setBackgroundLoading(false)
    setTotalCount(null)
    showStatus('Loading dictionary...')
    try {
      const firstPage = await fetchWordsPage(0)
      if (firstPage.words.length) {
        setEntries(firstPage.words)
        setSelectedIndex(null)
        setDraft(defaultEntry)
        setDirty(false)
        setTotalCount(firstPage.count)
        setLoading(false)
        showStatus(
          firstPage.count && firstPage.words.length < firstPage.count
            ? `Loaded first ${firstPage.words.length} of ${firstPage.count} terms. Continuing in background...`
            : `Loaded ${firstPage.words.length} server terms`,
          firstPage.count && firstPage.words.length < firstPage.count ? 'default' : 'success',
        )

        if (!firstPage.count || firstPage.words.length < firstPage.count) {
          setBackgroundLoading(true)
          const all = [...firstPage.words]
          let offset = firstPage.nextOffset
          try {
            while (true) {
              await delay(160)
              const page = await fetchWordsPage(offset)
              if (!page.words.length) break
              all.push(...page.words)
              setEntries([...all])
              setTotalCount(page.count)
              showStatus(`Loaded ${all.length}${page.count ? ` of ${page.count}` : ''} server terms...`)
              if (page.words.length < 1000 || (page.count && all.length >= page.count)) break
              offset = page.nextOffset
            }
            persistEntries(all)
            showStatus(`Loaded ${all.length} server terms`, 'success')
          } catch (err: any) {
            showStatus(`${err?.message || 'Could not finish loading all terms'}. Showing ${all.length} loaded terms.`, 'warn')
          } finally {
            setBackgroundLoading(false)
          }
        } else {
          persistEntries(firstPage.words)
        }
        return
      }

      const localEntries = localStorage.getItem(LOCAL_ENTRIES_KEY)
      if (localEntries) {
        const parsedLocal = JSON.parse(localEntries)
        if (Array.isArray(parsedLocal) && parsedLocal.length) {
          setEntries(parsedLocal.map(normalizeRow).filter((e: Entry) => e.term && e.definition))
          setSelectedIndex(null)
          setDraft(defaultEntry)
          setDirty(false)
          showStatus(`Loaded ${parsedLocal.length} saved local terms`, 'success')
          return
        }
      }

      throw new Error('No server dictionary found. Upload a CSV to seed the dictionary.')
    } catch (err: any) {
      showStatus(err?.message || 'Failed to load dictionary', 'error')
    } finally {
      setLoading(false)
      setBackgroundLoading(false)
    }
  }

  const loadPlans = async () => {
    setPlansLoading(true)
    try {
      const res = await fetch('/api/admin/plans', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not load plans')
      const list: PlanRow[] = Array.isArray(body.plans) ? body.plans : []
      setPlans(list)
      setPriceDrafts(Object.fromEntries(list.map((p) => [p.id, String(p.amount / 100)])))
      setPlansStatus('')
      setPlansTone('default')
    } catch (err) {
      setPlansStatus(err instanceof Error ? err.message : 'Could not load plans')
      setPlansTone('error')
    } finally {
      setPlansLoading(false)
    }
  }

  const savePlans = async () => {
    const updates = plans.map((p) => ({
      id: p.id,
      amount: Math.round(parseFloat(priceDrafts[p.id] ?? '') * 100),
    }))
    if (updates.some((u) => !Number.isFinite(u.amount) || u.amount <= 0)) {
      setPlansStatus('Enter a valid price (greater than 0) for every plan.')
      setPlansTone('error')
      return
    }
    setPlansLoading(true)
    setPlansStatus('Saving prices...')
    setPlansTone('default')
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ plans: updates }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not save prices')
      const list: PlanRow[] = Array.isArray(body.plans) ? body.plans : plans
      setPlans(list)
      setPriceDrafts(Object.fromEntries(list.map((p) => [p.id, String(p.amount / 100)])))
      setPlansStatus('Saved. New checkouts use these prices immediately.')
      setPlansTone('success')
    } catch (err) {
      setPlansStatus(err instanceof Error ? err.message : 'Could not save prices')
      setPlansTone('error')
    } finally {
      setPlansLoading(false)
    }
  }

  const loadAccounts = async () => {
    setAccountsLoading(true)
    try {
      const res = await fetch('/api/admin/accounts', { headers: { Authorization: `Bearer ${adminToken}` } })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not load admins')
      setAdmins(Array.isArray(body.admins) ? body.admins : [])
      if (body?.me?.role) {
        setAdminRole(body.me.role)
        if (body.me.email) setAdminEmail(body.me.email)
      }
      setAccountsStatus('')
      setAccountsTone('default')
    } catch (err) {
      setAccountsStatus(err instanceof Error ? err.message : 'Could not load admins')
      setAccountsTone('error')
    } finally {
      setAccountsLoading(false)
    }
  }

  const loadStudents = async () => {
    setStudentsLoading(true)
    try {
      const res = await fetch('/api/admin/students', { headers: { Authorization: `Bearer ${adminToken}` } })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not load students')
      setStudents(Array.isArray(body.students) ? body.students : [])
      setCustomUnis(Array.isArray(body.customUniversities) ? body.customUniversities : [])
      setStudentsStatus('')
      setStudentsTone('default')
    } catch (err) {
      setStudentsStatus(err instanceof Error ? err.message : 'Could not load students')
      setStudentsTone('error')
    } finally {
      setStudentsLoading(false)
    }
  }

  const addAdmin = async () => {
    if (!newEmail.trim() || newPassword.length < 6) {
      setAccountsStatus('Enter an email and a password of at least 6 characters.')
      setAccountsTone('error')
      return
    }
    setAccountsLoading(true)
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword, role: newRole }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not add admin')
      setAdmins(Array.isArray(body.admins) ? body.admins : admins)
      setNewEmail('')
      setNewPassword('')
      setNewRole('admin')
      setAccountsStatus('Admin added.')
      setAccountsTone('success')
    } catch (err) {
      setAccountsStatus(err instanceof Error ? err.message : 'Could not add admin')
      setAccountsTone('error')
    } finally {
      setAccountsLoading(false)
    }
  }

  const deleteAdmin = async (admin: { id: string; email: string }) => {
    if (!window.confirm(`Remove admin ${admin.email}?`)) return
    setAccountsLoading(true)
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ id: admin.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not delete admin')
      setAdmins(Array.isArray(body.admins) ? body.admins : admins)
      setAccountsStatus(`Removed ${admin.email}.`)
      setAccountsTone('success')
    } catch (err) {
      setAccountsStatus(err instanceof Error ? err.message : 'Could not delete admin')
      setAccountsTone('error')
    } finally {
      setAccountsLoading(false)
    }
  }

  const changeMyPassword = async () => {
    if (myPassword.length < 6) {
      setAccountsStatus('Your new password must be at least 6 characters.')
      setAccountsTone('error')
      return
    }
    setAccountsLoading(true)
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ password: myPassword }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Could not change password')
      setMyPassword('')
      setAccountsStatus('Your password was changed.')
      setAccountsTone('success')
    } catch (err) {
      setAccountsStatus(err instanceof Error ? err.message : 'Could not change password')
      setAccountsTone('error')
    } finally {
      setAccountsLoading(false)
    }
  }

  useEffect(() => {
    if (authed) {
      loadCsv()
      void loadPlans()
      void loadAccounts()
      void loadStudents()
    }
  }, [authed])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.token) throw new Error(body?.error || 'Invalid credentials')
      localStorage.setItem(ADMIN_TOKEN_KEY, body.token)
      localStorage.setItem('scmpedia-admin-role-v1', body.role || '')
      localStorage.setItem('scmpedia-admin-email-v1', body.email || '')
      setAdminToken(body.token)
      setAdminRole(body.role || '')
      setAdminEmail(body.email || '')
      setAuthed(true)
      setPass('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    localStorage.removeItem('scmpedia-admin-role-v1')
    localStorage.removeItem('scmpedia-admin-email-v1')
    setAdminToken('')
    setAdminRole('')
    setAdminEmail('')
    setAuthed(false)
    setPass('')
    setEntries([])
    setSelectedIndex(null)
    setDraft(defaultEntry)
  }

  const handleSelect = (entry: Entry, index: number) => {
    setSelectedIndex(index)
    setDraft({ ...entry })
    setDirty(false)
  }

  const handleNew = () => {
    setSelectedIndex(null)
    setDraft(defaultEntry)
    setDirty(false)
  }

  const handleSave = async () => {
    if (!draft.term.trim() || !draft.definition.trim()) {
      showStatus('Term and definition are required.', 'error')
      return
    }

    const cleanDraft = normalizeRow(draft)
    const isNew = selectedIndex === null
    if (isNew) {
      const confirmed = window.confirm(`Add "${cleanDraft.term}" to scmpedia?`)
      if (!confirmed) {
        showStatus('Not added.', 'warn')
        return
      }
    }

    setLoading(true)
    showStatus(isNew ? 'Adding word to server...' : 'Saving word to server...')
    try {
      await syncWords([cleanDraft])
      const refreshed = await loadServerEntries()
      const next = refreshed.length
        ? refreshed
        : isNew
          ? [cleanDraft, ...entries]
          : entries.map((entry, index) => (index === selectedIndex ? cleanDraft : entry))
      const savedIndex = next.findIndex((entry) => entry.term.toLowerCase() === cleanDraft.term.toLowerCase())
      setEntries(next)
      persistEntries(next)
      setSelectedIndex(savedIndex >= 0 ? savedIndex : isNew ? 0 : selectedIndex)
      setDirty(false)
      showStatus(isNew ? 'Added to server.' : 'Changes saved to server.', 'success')
    } catch (err: any) {
      showStatus(err?.message || 'Save failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (selectedIndex === null) {
      showStatus('Select a word before deleting.', 'warn')
      return
    }
    const term = entries[selectedIndex]?.term || 'this word'
    const confirmed = window.confirm(`Delete "${term}" from scmpedia?`)
    if (!confirmed) {
      showStatus('Not deleted.', 'warn')
      return
    }
    setLoading(true)
    showStatus('Deleting word from server...')
    try {
      const entry = entries[selectedIndex]
      if (!entry) throw new Error('Selected word was not found')
      const params = new URLSearchParams()
      if (entry.id) params.set('id', entry.id)
      else if (entry.source_key) params.set('source_key', entry.source_key)
      else params.set('term', entry.term)
      const res = await fetch(`/api/words?${params.toString()}`, {
        method: 'DELETE',
        headers: adminHeaders(),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Delete failed')

      const next = entries.filter((_, index) => index !== selectedIndex)
      setEntries(next)
      persistEntries(next)
      setSelectedIndex(null)
      setDraft(defaultEntry)
      setDirty(false)
      showStatus('Deleted from server.', 'success')
    } catch (err: any) {
      showStatus(err?.message || 'Delete failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    showStatus('Preparing CSV...')
    try {
      const Papa = await loadPapa()
      const csv = Papa.unparse(entries)
      const blob = new Blob([`\uFEFF${csv}`], {
        type: 'text/csv;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'scmpedia_full_UPDATED.csv'
      a.click()
      URL.revokeObjectURL(url)
      setDirty(false)
      showStatus('CSV downloaded. UTF-8 symbols, logos, and emoji are preserved.', 'success')
    } catch (err: any) {
      showStatus(err?.message || 'Failed to export CSV', 'error')
    }
  }

  const handleUpload = async (file?: File) => {
    if (!file) return
    setLoading(true)
    showStatus('Uploading CSV...')
    try {
      const Papa = await loadPapa()
      const text = await file.text()
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      const data = parsed.data.map(normalizeRow).filter((e: Entry) => e.term && e.definition)
      const imported = await syncWords(data)
      const refreshed = await loadServerEntries()
      const next = refreshed.length ? refreshed : data
      setEntries(next)
      persistEntries(next)
      setSelectedIndex(null)
      setDraft(defaultEntry)
      setDirty(false)
      showStatus(`Uploaded ${imported} entries to the server.`, 'success')
    } catch (err: any) {
      showStatus(err?.message || 'Upload failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!authed) {
    return (
      <div className="login-wrap">
        <style>{STYLES}</style>
        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-title">scmpedia Admin</div>
          <div className="login-sub">Secure access to manage terms and definitions.</div>
          <div className="form-row">
            <label className="label">Username</label>
            <input className="input" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
          </div>
          <div className="form-row" style={{ marginTop: '12px' }}>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary" style={{ marginTop: '16px', width: '100%' }}>
            Sign In
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="admin-shell fade-in">
      <style>{STYLES}</style>
      <header className="admin-header">
        <div className="brand">
          <span>scmpedia</span> Admin
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadCsv} disabled={loading}>
            Reload CSV
          </button>
          <button className="btn btn-secondary" onClick={handleLogout} disabled={loading}>
            Sign Out
          </button>
          <label
            className="btn btn-secondary"
            style={{
              margin: 0,
              opacity: loading ? 0.5 : 1,
              pointerEvents: loading ? 'none' : 'auto',
            }}
          >
            Upload CSV
            <input
              type="file"
              accept=".csv"
              hidden
              onChange={(e) => {
                handleUpload(e.target.files?.[0])
                e.currentTarget.value = ''
              }}
            />
          </label>
          <button className="btn btn-primary" onClick={handleDownload} disabled={!entries.length}>
            Download CSV
          </button>
        </div>
      </header>

      <main className="admin-main">
        <section
          className="panel"
          style={{
            gridColumn: '1 / -1',
            background: 'linear-gradient(120deg, #fbf3ee, #f4efe6)',
            border: '1px solid rgba(182,84,55,.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="panel-title" style={{ color: 'var(--primary)' }}>Launch Raffle · Grand Draw</div>
            <div style={{ color: 'var(--text-sub)', fontSize: 14, maxWidth: '62ch', lineHeight: 1.5 }}>
              Draw 30 winners from students who paid for the <b>Student Plan</b>. Pick a university (or all schools),
              publish the commitment, then run a provably-fair live draw on the projector.
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap', fontSize: 15, padding: '12px 22px' }}
            onClick={() => setRaffleOpen(true)}
          >
            Launch Grand Draw
          </button>
        </section>

        <section className="panel">
          <div className="panel-title-row">
            <div className="panel-title">Entries</div>
            <div className="count-pill">
              {entries.length}
              {totalCount ? ` / ${totalCount}` : ''} terms
            </div>
          </div>
          <input className="search-input" placeholder="Search terms..." value={query} onChange={(e) => setQuery(e.target.value)} />
          {(loading || backgroundLoading) && (
            <div className="loading-strip">
              <span className="spinner" />
              <span>
                {loading ? 'Loading first terms...' : `Loading more terms${totalCount ? ` (${entries.length}/${totalCount})` : ''}...`}
              </span>
            </div>
          )}
          <div className="list">
            {loading && !entries.length ? (
              <div className="skeleton-list">
                {Array.from({ length: 9 }, (_, index) => (
                  <div className="skeleton-item" key={index} />
                ))}
              </div>
            ) : (
              <>
                {filtered.map(({ entry, index }) => (
                  <div
                    key={`${entry.term}-${index}`}
                    className={`list-item ${selectedIndex === index ? 'active' : ''}`}
                    onClick={() => handleSelect(entry, index)}
                  >
                    {entry.term}
                  </div>
                ))}
                {!filtered.length && <div className="helper">No matching terms.</div>}
              </>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">Editor</div>
          {loading && !entries.length ? (
            <div className="skeleton-form">
              <div className="skeleton-field" />
              <div className="skeleton-field" />
              <div className="skeleton-field full" />
              <div className="skeleton-field" />
              <div className="skeleton-field" />
              <div className="skeleton-field full" />
            </div>
          ) : (
            <div className="form-grid">
              <div className="form-row">
                <label className="label">Term</label>
                <input className="input" value={draft.term} onChange={(e) => updateDraft({ term: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="label">Part of Speech</label>
                <input className="input" value={draft.pos || ''} onChange={(e) => updateDraft({ pos: e.target.value })} />
              </div>
              <div className="form-row full">
                <label className="label">Definition</label>
                <textarea className="textarea" value={draft.definition} onChange={(e) => updateDraft({ definition: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="label">Pronunciation</label>
                <input
                  className="input"
                  value={draft.pronunciation || ''}
                  onChange={(e) => updateDraft({ pronunciation: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label className="label">Synonyms</label>
                <input className="input" value={draft.synonyms || ''} onChange={(e) => updateDraft({ synonyms: e.target.value })} />
              </div>
              <div className="form-row full">
                <label className="label">Tags</label>
                <input className="input" value={draft.tags || ''} onChange={(e) => updateDraft({ tags: e.target.value })} />
              </div>
              <div className="form-row full">
                <label className="label">Example</label>
                <textarea className="textarea" value={draft.examples || ''} onChange={(e) => updateDraft({ examples: e.target.value })} />
              </div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginTop: '16px',
              flexWrap: 'wrap',
            }}
          >
            <button className="btn btn-secondary" onClick={handleNew} disabled={loading}>
              New Entry
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {selectedIndex === null ? 'Add Entry' : 'Save Entry'}
            </button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={loading || selectedIndex === null}>
              Delete Word
            </button>
            <div className={`status ${statusTone === 'default' ? '' : statusTone}`}>
              {dirty ? `${status} Download CSV when ready.` : status}
            </div>
          </div>
          <div className="helper">Admin changes save directly to the server. Download the UTF-8 CSV when you want a backup copy.</div>
        </section>

        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-title-row">
            <div className="panel-title">Subscription Pricing</div>
            {plansLoading && <span className="spinner" />}
          </div>
          <div className="helper" style={{ marginTop: 0, marginBottom: 14 }}>
            Set the price (Ghana Cedis) for each plan. Saved prices apply to new checkouts immediately — the server validates every payment against these amounts.
          </div>
          {plans.length ? (
            <>
              <div className="form-grid">
                {plans.map((p) => (
                  <div className="form-row" key={p.id}>
                    <label className="label">{p.label}</label>
                    <div className="price-field">
                      <span className="price-affix">GH₵</span>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceDrafts[p.id] ?? ''}
                        onChange={(e) => setPriceDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      />
                      <span className="price-affix">/{p.period === 'annual' ? 'yr' : 'mo'}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={savePlans} disabled={plansLoading}>
                  Save Prices
                </button>
                <button className="btn btn-secondary" onClick={loadPlans} disabled={plansLoading}>
                  Reload
                </button>
                <div className={`status ${plansTone === 'default' ? '' : plansTone}`}>{plansStatus}</div>
              </div>
            </>
          ) : (
            <div className="helper">{plansLoading ? 'Loading plans…' : plansStatus || 'No plans loaded.'}</div>
          )}
        </section>

        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-title-row">
            <div className="panel-title">Students</div>
            <span className="count-pill">{students.length}</span>
            {studentsLoading && <span className="spinner" />}
          </div>
          <div className="helper" style={{ marginTop: 0, marginBottom: 14 }}>
            Users who completed student verification before buying the Student plan — country, university, index number
            and programme are saved to their account. Universities typed by hand are collected under "Custom
            universities" below so they can be added to the app's list when legitimate.
          </div>

          <input
            className="search-input"
            placeholder="Search by email, name, university, index number or programme..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
          />
          <div className="list" style={{ maxHeight: 420 }}>
            {filteredStudents.map((s) => (
              <div key={s.id} className="list-item" style={{ cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>
                    {s.full_name || s.email}
                    {s.plan && (
                      <span
                        className="count-pill"
                        style={s.plan.startsWith('student') ? { marginLeft: 8, background: 'rgba(4,120,87,0.12)', color: '#047857' } : { marginLeft: 8 }}
                      >
                        {s.plan}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                    {s.saved_at ? new Date(s.saved_at).toLocaleDateString() : ''}
                  </span>
                </div>
                <div className="helper" style={{ marginTop: 4 }}>
                  {s.email}
                  {s.country ? ` · ${flagFor(s.country_code)} ${s.country}` : ''}
                </div>
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  {s.university || '—'}
                  {s.university_custom && (
                    <span className="count-pill" style={{ marginLeft: 8, background: 'rgba(180,83,9,0.12)', color: '#b45309' }}>
                      custom
                    </span>
                  )}
                </div>
                <div className="helper" style={{ marginTop: 4 }}>
                  Index: <strong>{s.index_number || '—'}</strong>
                  {s.programme ? (
                    <>
                      {' '}· Programme: <strong>{s.programme}</strong>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {!filteredStudents.length && (
              <div className="helper">
                {studentsLoading
                  ? 'Loading students…'
                  : students.length
                  ? 'No students match your search.'
                  : 'No student verifications yet. They appear here after a user fills the pre-payment popup.'}
              </div>
            )}
          </div>

          <div className="panel-title" style={{ marginTop: 18, marginBottom: 0 }}>Custom universities (typed by students)</div>
          <div className="list" style={{ maxHeight: 220 }}>
            {customUnis.map((u) => (
              <div
                key={u.name}
                className="list-item"
                style={{ cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
              >
                <span>{u.name}</span>
                <span className="count-pill">{u.count} student{u.count === 1 ? '' : 's'}</span>
              </div>
            ))}
            {!customUnis.length && (
              <div className="helper">No custom university names yet. When a student types a school that isn't in the list, it shows here.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={loadStudents} disabled={studentsLoading}>
              Reload
            </button>
            <div className={`status ${studentsTone === 'default' ? '' : studentsTone}`}>{studentsStatus}</div>
          </div>
        </section>

        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="panel-title-row">
            <div className="panel-title">Admins &amp; Roles</div>
            {accountsLoading && <span className="spinner" />}
          </div>
          <div className="helper" style={{ marginTop: 0, marginBottom: 14 }}>
            Signed in as <strong>{adminEmail || 'admin'}</strong> ({adminRole === 'master' ? 'master admin' : 'admin'}).
            {adminRole !== 'master' && ' Only a master admin can add or remove accounts.'}
          </div>

          {adminRole === 'master' && (
            <>
              <div className="list" style={{ maxHeight: 'none', marginTop: 0 }}>
                {admins.map((a) => (
                  <div
                    key={a.id}
                    className="list-item"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'default', gap: 10 }}
                  >
                    <span>
                      {a.email}
                      <span className="count-pill" style={{ marginLeft: 8 }}>{a.role === 'master' ? 'master' : 'admin'}</span>
                    </span>
                    <button
                      className="btn btn-danger"
                      onClick={() => deleteAdmin(a)}
                      disabled={accountsLoading || a.email.toLowerCase() === adminEmail.toLowerCase()}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {!admins.length && <div className="helper">No admin accounts in the database yet. Add one below.</div>}
              </div>

              <div className="form-grid" style={{ marginTop: 14 }}>
                <div className="form-row">
                  <label className="label">New admin email</label>
                  <input className="input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" />
                </div>
                <div className="form-row">
                  <label className="label">Temporary password</label>
                  <input className="input" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="at least 6 characters" />
                </div>
                <div className="form-row">
                  <label className="label">Role</label>
                  <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value === 'master' ? 'master' : 'admin')}>
                    <option value="admin">Admin — dashboard access</option>
                    <option value="master">Master — can manage admins</option>
                  </select>
                </div>
                <div className="form-row" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={addAdmin} disabled={accountsLoading} style={{ marginTop: 'auto' }}>
                    Add admin
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="form-grid" style={{ marginTop: 18 }}>
            <div className="form-row">
              <label className="label">Change my password</label>
              <input className="input" type="text" value={myPassword} onChange={(e) => setMyPassword(e.target.value)} placeholder="new password (min 6 chars)" />
            </div>
            <div className="form-row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={changeMyPassword} disabled={accountsLoading} style={{ marginTop: 'auto' }}>
                Update password
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={loadAccounts} disabled={accountsLoading}>
              Reload
            </button>
            <div className={`status ${accountsTone === 'default' ? '' : accountsTone}`}>{accountsStatus}</div>
          </div>
        </section>
      </main>
      {raffleOpen && <RaffleDrawMode token={adminToken} onClose={() => setRaffleOpen(false)} />}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('admin-root')!).render(<AdminApp />)
