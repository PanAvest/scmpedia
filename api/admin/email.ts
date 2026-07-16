import type { VercelRequest, VercelResponse } from '../vercel-types'
import { getAdminIdentity } from '../server-auth.js'
import {
  hasEmailConfig,
  sendComposed,
  type ComposedEmail,
  type EmailAttachment,
} from '../_email.js'

// Base64 inflates ~33%, and Vercel caps the serverless request body around 4.5MB, so keep the
// summed encoded attachment size comfortably under that.
const MAX_ATTACHMENT_BYTES = 3_500_000
const MAX_RECIPIENTS = 50
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Give the whole batch room to finish (per-recipient Resend calls, attachments uploaded each time).
export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identity = getAdminIdentity(req)
  if (!identity) {
    res.status(401).json({ error: 'Admin sign-in required' })
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!hasEmailConfig()) {
    res.status(503).json({ error: 'Email is not configured (RESEND_API_KEY missing on the server).' })
    return
  }

  const body = req.body || {}

  const recipients = [
    ...new Set(
      (Array.isArray(body.to) ? body.to : String(body.to || '').split(/[,\n;]+/))
        .map((s: unknown) => String(s || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  ] as string[]

  if (!recipients.length) {
    res.status(400).json({ error: 'Add at least one recipient.' })
    return
  }
  const invalid = recipients.filter((r) => !EMAIL_RE.test(r))
  if (invalid.length) {
    res.status(400).json({ error: `Not a valid email address: ${invalid[0]}` })
    return
  }
  if (recipients.length > MAX_RECIPIENTS) {
    res.status(400).json({ error: `Send to at most ${MAX_RECIPIENTS} recipients at a time (got ${recipients.length}).` })
    return
  }

  const subject = String(body.subject || '').trim()
  const heading = String(body.heading || '').trim()
  const content = String(body.body || '').trim()
  if (!subject) { res.status(400).json({ error: 'A subject is required.' }); return }
  if (!heading) { res.status(400).json({ error: 'A heading is required.' }); return }
  if (!content) { res.status(400).json({ error: 'The message body is empty.' }); return }

  // Attachments: [{ filename, content(base64) }]. Validate shape + total size.
  const rawAttachments = Array.isArray(body.attachments) ? body.attachments : []
  const attachments: EmailAttachment[] = []
  let totalBytes = 0
  for (const a of rawAttachments) {
    const filename = String(a?.filename || '').trim()
    const contentB64 = String(a?.content || '')
    if (!filename || !contentB64) continue
    totalBytes += contentB64.length
    attachments.push({ filename, content: contentB64 })
  }
  if (totalBytes > MAX_ATTACHMENT_BYTES) {
    res.status(413).json({ error: 'Attachments are too large. Keep the total under ~3.5 MB.' })
    return
  }

  const cta =
    body.cta && String(body.cta.label || '').trim() && String(body.cta.url || '').trim()
      ? { label: String(body.cta.label).trim(), url: String(body.cta.url).trim() }
      : null

  const email: ComposedEmail = {
    subject,
    heading,
    subheading: String(body.subheading || '').trim() || undefined,
    body: content,
    cta,
  }

  try {
    const results = await sendComposed(email, recipients, attachments)
    const failed = results.filter((r) => !r.ok)
    res.status(failed.length ? 207 : 200).json({
      sent: results.filter((r) => r.ok).length,
      total: results.length,
      results,
      message: failed.length
        ? `Sent ${results.length - failed.length} of ${results.length}. Failed: ${failed.map((f) => f.to).join(', ')}`
        : `Sent to ${results.length} recipient${results.length === 1 ? '' : 's'}.`,
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not send the email' })
  }
}
