import './_runtime.js'

// Server-side email sending for the admin composer. Wraps admin-written content in the
// branded SCMpedia shell (same design as the auth emails) and sends it through Resend
// from noreply@scmpedia.org — the domain verified for this Resend account.

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = 'SCMpedia <noreply@scmpedia.org>'
const REPLY_TO = process.env.SCMPEDIA_REPLY_TO || 'support@scmpedia.org'
const SITE_URL = 'https://www.scmpedia.org'

export const hasEmailConfig = () => Boolean(RESEND_API_KEY)

export type EmailAttachment = { filename: string; content: string } // content = base64
export type EmailCta = { label: string; url: string }

export type ComposedEmail = {
  subject: string
  heading: string
  subheading?: string
  body: string // plain text the admin typed; blank line = new paragraph
  cta?: EmailCta | null
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Admin content is trusted, but we still escape it and apply a tiny, safe formatting pass
// rather than accept raw HTML — that keeps every email on-brand and impossible to break.
//   blank line  -> new paragraph
//   single \n   -> line break
//   **text**    -> bold
const renderBodyHtml = (body: string) => {
  const paragraphs = body.replace(/\r\n/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return paragraphs
    .map((p) => {
      const withBreaks = escapeHtml(p)
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="dk-strong" style="color:#1f1f1f; font-weight:600;">$1</strong>')
        .replace(/\n/g, '<br>')
      return `<p class="dk-body" style="margin:0 0 18px 0; font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:26px; color:#444746; mso-line-height-rule:exactly;">${withBreaks}</p>`
    })
    .join('\n')
}

const ctaHtml = (cta?: EmailCta | null) => {
  if (!cta || !cta.label || !cta.url) return ''
  const href = escapeHtml(cta.url)
  const label = escapeHtml(cta.label)
  return `
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:8px 0 26px 0;">
              <tr>
                <td align="center" bgcolor="#b65437" style="background-color:#b65437; border-radius:10px;">
                  <a class="sm-btn" href="${href}" style="display:inline-block; padding:15px 32px; font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:20px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px; mso-line-height-rule:exactly;">${label}</a>
                </td>
              </tr>
            </table>`
}

export const renderBrandedEmail = (email: ComposedEmail): string => {
  const heading = escapeHtml(email.heading || 'SCMpedia')
  const subheading = email.subheading ? escapeHtml(email.subheading) : ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<title>${escapeHtml(email.subject || 'SCMpedia')}</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  table { border-spacing: 0; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  #outlook a { padding: 0; }
  .ExternalClass { width: 100%; }
  .ExternalClass, .ExternalClass p, .ExternalClass td, .ExternalClass div { line-height: 100%; }
  div[style*="margin: 16px 0"] { margin: 0 !important; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
  @media only screen and (max-width: 620px) {
    .sm-full { width: 100% !important; max-width: 100% !important; }
    .sm-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .sm-hero { padding: 32px 24px !important; }
    .sm-h1 { font-size: 24px !important; line-height: 32px !important; }
    .sm-btn { display: block !important; width: 100% !important; }
  }
  @media (prefers-color-scheme: dark) {
    .dk-canvas { background-color: #0f1411 !important; }
    .dk-card { background-color: #171c19 !important; border-color: #2b332d !important; }
    .dk-body { color: #b8c0b8 !important; }
    .dk-strong { color: #f4f7f2 !important; }
    .dk-muted { color: #8e998f !important; }
    .dk-rule { border-color: #2b332d !important; }
  }
  [data-ogsc] .dk-canvas { background-color: #0f1411 !important; }
  [data-ogsc] .dk-card { background-color: #171c19 !important; border-color: #2b332d !important; }
  [data-ogsc] .dk-body { color: #b8c0b8 !important; }
  [data-ogsc] .dk-strong { color: #f4f7f2 !important; }
  [data-ogsc] .dk-muted { color: #8e998f !important; }
  [data-ogsc] .dk-rule { border-color: #2b332d !important; }
</style>
</head>
<body class="dk-canvas" style="margin:0; padding:0; width:100%; background-color:#fbf8f1; font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif; mso-line-height-rule:exactly;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#fbf8f1" class="dk-canvas" style="background-color:#fbf8f1; width:100%;">
  <tr>
    <td align="center" style="padding:32px 12px 40px 12px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="sm-full" style="width:600px; max-width:600px;">
        <tr>
          <td bgcolor="#063f3a" class="sm-hero" style="background-color:#063f3a; border-radius:16px 16px 0 0; padding:40px 32px 40px 32px;">
            <img src="${SITE_URL}/white-logo.png" width="168" alt="SCMpedia" style="display:block; width:168px; max-width:168px; height:auto; margin:0 0 28px 0; border:0;">
            <p class="sm-h1" style="margin:0 0 ${subheading ? '12px' : '0'} 0; font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:28px; line-height:36px; font-weight:700; color:#ffffff; mso-line-height-rule:exactly;">${heading}</p>
            ${subheading ? `<p style="margin:0; font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:24px; color:#a9c2be; mso-line-height-rule:exactly;">${subheading}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td bgcolor="#ffffff" class="dk-card sm-pad" style="background-color:#ffffff; border:1px solid #e3e3e3; border-top:0; border-radius:0 0 16px 16px; padding:36px 32px 32px 32px;">
            ${renderBodyHtml(email.body)}
            ${ctaHtml(email.cta)}
          </td>
        </tr>
        <tr>
          <td class="sm-pad" style="padding:28px 32px 0 32px;" align="center">
            <p class="dk-muted" style="margin:0 0 10px 0; font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:20px; font-weight:600; color:#5f6660; mso-line-height-rule:exactly;">SCMpedia</p>
            <p class="dk-muted" style="margin:0 0 14px 0; font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; line-height:20px; color:#767d76; mso-line-height-rule:exactly;">The AI-powered dictionary and learning platform for supply chain professionals.</p>
            <p class="dk-muted" style="margin:0 0 14px 0; font-family:'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; line-height:20px; color:#767d76; mso-line-height-rule:exactly;">
              <a href="${SITE_URL}/help" style="color:#5f6660; text-decoration:underline;">Help Center</a>&nbsp;&nbsp;<a href="${SITE_URL}/privacy" style="color:#5f6660; text-decoration:underline;">Privacy Policy</a>&nbsp;&nbsp;<a href="${SITE_URL}/terms" style="color:#5f6660; text-decoration:underline;">Terms of Service</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

// Plaintext alternative — keeps the message out of "HTML-only" spam heuristics.
export const renderPlainText = (email: ComposedEmail): string => {
  const lines = [email.heading]
  if (email.subheading) lines.push(email.subheading)
  lines.push('', email.body.replace(/\*\*([^*]+)\*\*/g, '$1').trim())
  if (email.cta?.label && email.cta.url) lines.push('', `${email.cta.label}: ${email.cta.url}`)
  lines.push('', '—', 'SCMpedia', `${SITE_URL}`)
  return lines.join('\n')
}

export type SendResult = { to: string; ok: boolean; id?: string; error?: string }

// One Resend call per recipient: each person is the sole "To" (better deliverability and
// privacy than a shared To/BCC), and we report per-recipient success/failure.
export async function sendComposed(
  email: ComposedEmail,
  recipients: string[],
  attachments: EmailAttachment[],
): Promise<SendResult[]> {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured on the server')
  const html = renderBrandedEmail(email)
  const text = renderPlainText(email)

  const results: SendResult[] = new Array(recipients.length)
  const CONCURRENCY = 3
  let cursor = 0
  const workers = Array.from({ length: Math.min(CONCURRENCY, recipients.length) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= recipients.length) return
      const to = recipients[index] as string
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM,
            to: [to],
            reply_to: REPLY_TO,
            subject: email.subject,
            html,
            text,
            ...(attachments.length ? { attachments } : {}),
          }),
        })
        const body = await res.json().catch(() => ({}))
        results[index] = res.ok
          ? { to, ok: true, id: (body as { id?: string }).id }
          : { to, ok: false, error: (body as { message?: string; error?: string }).message || (body as { error?: string }).error || `HTTP ${res.status}` }
      } catch (err) {
        results[index] = { to, ok: false, error: err instanceof Error ? err.message : 'Send failed' }
      }
    }
  })
  await Promise.all(workers)
  return results
}
