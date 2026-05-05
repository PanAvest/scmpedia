import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'

type Entry = {
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

const ADMIN_USER = 'scmpedia-admin'
const ADMIN_PASS = 'scmpedia-2026'
const LOCAL_ENTRIES_KEY = 'scmpedia-admin-entries-v1'

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

.search-input { width: 100%; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 14px; }
.list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; max-height: 65vh; overflow-y: auto; }
.list-item { padding: 10px 12px; border-radius: 10px; background: var(--surface-2); cursor: pointer; transition: background 0.2s ease, transform 0.2s ease; }
.list-item:hover { background: #e9e3d9; }
.list-item.active { background: rgba(182, 84, 55, 0.12); color: var(--primary-dark); font-weight: 600; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-row.full { grid-column: 1 / -1; }
.label { font-size: 12px; font-weight: 600; color: var(--text-sub); }
.input, .textarea { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 14px; font-family: inherit; background: #fff; }
.textarea { min-height: 90px; resize: vertical; }
.helper { font-size: 12px; color: var(--text-sub); margin-top: 6px; }
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

@media (max-width: 900px) {
  .admin-main { grid-template-columns: 1fr; padding: 16px; }
  .list { max-height: 260px; }
  .form-grid { grid-template-columns: 1fr; }
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
  const [authed, setAuthed] = useState(false)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<Entry>(defaultEntry)
  const [query, setQuery] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('Ready')
  const [statusTone, setStatusTone] = useState<'default' | 'success' | 'warn' | 'error'>('default')
  const papaRef = useRef<PapaParse | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => !q || entry.term.toLowerCase().includes(q))
  }, [entries, query])

  const showStatus = (message: string, tone: 'default' | 'success' | 'warn' | 'error' = 'default') => {
    setStatus(message)
    setStatusTone(tone)
  }

  const persistEntries = (next: Entry[]) => {
    localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(next))
    window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_ENTRIES_KEY, newValue: JSON.stringify(next) }))
  }

  const normalizeRow = (row: any): Entry => ({
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

  const loadCsv = async () => {
    setLoading(true)
    showStatus('Loading CSV...')
    try {
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

      const Papa = await loadPapa()
      const sources = ['/scmpedia_full_UPDATED.csv', '/scmpedia_full.csv']
      let csv = ''
      for (const src of sources) {
        const res = await fetch(`${src}?v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) continue
        csv = await res.text()
        if (csv) break
      }
      if (!csv) throw new Error('Failed to load CSV')
      const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })
      const data = parsed.data.map(normalizeRow).filter((e: Entry) => e.term && e.definition)
      setEntries(data)
      setSelectedIndex(null)
      setDraft(defaultEntry)
      setDirty(false)
      persistEntries(data)
      showStatus(`Loaded ${data.length} terms`, 'success')
    } catch (err: any) {
      showStatus(err?.message || 'Failed to load CSV', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authed) loadCsv()
  }, [authed])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      setAuthed(true)
      setError('')
    } else {
      setError('Invalid credentials')
    }
  }

  const handleSelect = (entry: Entry, index: number) => {
    setSelectedIndex(index)
    setDraft({ ...entry })
  }

  const handleNew = () => {
    setSelectedIndex(null)
    setDraft(defaultEntry)
  }

  const handleSave = () => {
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

    const next = [...entries]
    if (isNew) {
      next.unshift(cleanDraft)
    } else {
      next[selectedIndex] = cleanDraft
    }
    setEntries(next)
    persistEntries(next)
    if (isNew) setSelectedIndex(0)
    setDirty(true)
    showStatus(isNew ? 'Added.' : 'Changes saved.', 'success')
  }

  const handleDelete = () => {
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
    const next = entries.filter((_, index) => index !== selectedIndex)
    setEntries(next)
    persistEntries(next)
    setSelectedIndex(null)
    setDraft(defaultEntry)
    setDirty(true)
    showStatus('Deleted.', 'success')
  }

  const handleDownload = async () => {
    showStatus('Preparing CSV...')
    try {
      const Papa = await loadPapa()
      const csv = Papa.unparse(entries)
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
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
      setEntries(data)
      persistEntries(data)
      setSelectedIndex(null)
      setDraft(defaultEntry)
      setDirty(true)
      showStatus(`Loaded ${data.length} entries from upload.`, 'success')
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
          <label className="btn btn-secondary" style={{ margin: 0 }}>
            Upload CSV
            <input
              type="file"
              accept=".csv"
              hidden
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
          </label>
          <button className="btn btn-primary" onClick={handleDownload} disabled={!entries.length}>
            Download CSV
          </button>
        </div>
      </header>

      <main className="admin-main">
        <section className="panel">
          <div className="panel-title">Entries</div>
          <input
            className="search-input"
            placeholder="Search terms..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="list">
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
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">Editor</div>
          <div className="form-grid">
            <div className="form-row">
              <label className="label">Term</label>
              <input
                className="input"
                value={draft.term}
                onChange={(e) => setDraft({ ...draft, term: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label className="label">Part of Speech</label>
              <input
                className="input"
                value={draft.pos || ''}
                onChange={(e) => setDraft({ ...draft, pos: e.target.value })}
              />
            </div>
            <div className="form-row full">
              <label className="label">Definition</label>
              <textarea
                className="textarea"
                value={draft.definition}
                onChange={(e) => setDraft({ ...draft, definition: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label className="label">Pronunciation</label>
              <input
                className="input"
                value={draft.pronunciation || ''}
                onChange={(e) => setDraft({ ...draft, pronunciation: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label className="label">Synonyms</label>
              <input
                className="input"
                value={draft.synonyms || ''}
                onChange={(e) => setDraft({ ...draft, synonyms: e.target.value })}
              />
            </div>
            <div className="form-row full">
              <label className="label">Tags</label>
              <input
                className="input"
                value={draft.tags || ''}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              />
            </div>
            <div className="form-row full">
              <label className="label">Example</label>
              <textarea
                className="textarea"
                value={draft.examples || ''}
                onChange={(e) => setDraft({ ...draft, examples: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleNew}>
              New Entry
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              {selectedIndex === null ? 'Add Entry' : 'Save Entry'}
            </button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={selectedIndex === null}>
              Delete Word
            </button>
            <div className={`status ${statusTone === 'default' ? '' : statusTone}`}>
              {dirty ? `${status} Download CSV when ready.` : status}
            </div>
          </div>
          <div className="helper">
            Admin changes are saved in this browser immediately for the search page. Download the UTF-8 CSV when you want to update the server file.
          </div>
        </section>
      </main>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('admin-root')!).render(<AdminApp />)
