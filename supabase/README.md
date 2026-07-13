# Supabase Auth email + redirect setup

The confirm-signup email lives in the Supabase dashboard, not in this repo — `templates/confirm-signup.html`
is the source of truth that gets pasted into it.

## Why the template looks the way it does

Supabase renders these templates with Go's `html/template`, **which strips HTML comments**. That kills the
two techniques every "bulletproof email" guide reaches for:

- `<!--[if mso]>` conditional comments — gone, so no MSO-only stylesheets and no ghost tables.
- The `<v:roundrect>` VML button — gone, so Outlook falls back to the bare `<a>`. Word ignores
  `display:inline-block` and padding on an anchor, so a VML-dependent button can render as
  **white text on a white card**.

So the CTA is a `<td bgcolor="#b65437">` with a block anchor inside it — `bgcolor` on a table cell is one of
the few things the Word engine reliably honours, and it needs no conditional comments. Same reason the font
stack leads with `'Segoe UI'` rather than the site's `'Google Sans'`: Google Sans resolves on essentially no
mail client, and there is no way to add an MSO font fallback without comments.

Other constraints baked in: 600px table layout with inline styles, hidden preheader, `prefers-color-scheme`
plus `[data-ogsc]` (Outlook.com does not support the media query) dark mode, iOS auto-link suppression, and a
copy-paste fallback link for clients that strip the button. It is ~9.6KB — Gmail clips at 102KB.

The email is deliberately **single-purpose**. A "what's waiting inside" block of value props is what pushes a
transactional mail into Gmail's Promotions tab, which is the worst possible outcome for a link that expires in
24 hours.

## Dashboard setup

**1. Authentication → Emails → Templates → "Confirm signup"**
Paste `templates/confirm-signup.html`. Subject: `Confirm your email to activate your SCMpedia account`.

The CTA deliberately does **not** use `{{ .ConfirmationURL }}`. That URL points at
`<project>.supabase.co/auth/v1/verify`, which puts a third domain — neither the sender nor the brand — in a
"confirm your account" email, and it is a **GET that spends the single-use token server-side**, so any mail
scanner that follows links (Outlook Safe Links does) burns the token before the user clicks. Instead:

```
{{ if .RedirectTo }}{{ .RedirectTo }}{{ else }}{{ .SiteURL }}/auth{{ end }}?token_hash={{ .TokenHash }}&type=signup&confirmed=1
```

The app verifies the token itself with `supabase.auth.verifyOtp()`, so a scanner merely fetching the page
cannot spend it. `{{ .RedirectTo }}` (not a hardcoded `{{ .SiteURL }}`) is what keeps a **localhost** signup's
confirmation link pointing back at localhost.

⚠️ `emailRedirectTo` must therefore have **no query string** — the template appends its own `?`. If you ever
put one back, the link renders with two `?` and silently breaks. See `confirmRedirectUrl()` in `AuthPage.tsx`.

**2. Authentication → URL Configuration**
- **Site URL**: `https://www.scmpedia.org` — this is also the `{{ .SiteURL }}` origin the email's logo and
  footer links load from, so it must be the host that actually serves the app. (It is *not* `panavestkds.com`,
  which serves a different product entirely.)
- **Redirect URLs** (allow-list): `https://www.scmpedia.org/**`, `https://scmpedia.org/**`,
  `https://scmpedia.vercel.app/**`, `http://localhost:5173/**`

  This is the step that silently eats the fix. `signUp()` sends `emailRedirectTo`, but if it does not match an
  allow-list entry GoTrue **discards it and falls back to Site URL with no error returned to the client** —
  reproducing the original "it dumps me on the homepage" bug with nothing to debug. Glob semantics: `*` does
  not cross a `/`, `**` does.

**3. Authentication → Providers → Email → "Confirm email"**
Must be **on**. If it is off, `signUp()` returns a live session, no email is sent, and the user is bounced
straight to the homepage — which looks identical to the redirect bug.

**4. Authentication → SMTP Settings** (required for real traffic)
The built-in sender is capped at ~2 emails/hour per project and stamps every message "From Supabase Auth".
Point it at Resend:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (as a **string** — the Management API rejects a number) |
| Username | `resend` |
| Password | the Resend API key |
| Sender email | `noreply@scmpedia.org` |
| Sender name | `SCMpedia` |

Then raise **Authentication → Rate Limits → Emails sent per hour**, which stays pinned low while the built-in
sender is in use.

**The sender domain must be the brand domain.** Sending SCMpedia mail from `panavestkds.com` (a Resend-verified
domain we also own) put the first test straight in Gmail's spam folder: the From domain matched neither the
brand nor the links, which is the shape of a credential-phishing mail. `scmpedia.org` is now verified in Resend
(DKIM at `resend._domainkey`, SPF + `feedback-smtp` MX on `send.`), and it already published DMARC `p=reject` —
a strict policy backed by real SPF/DKIM is a strong positive signal.

Be realistic about what that buys: `scmpedia.org` is a **cold** sending domain with no engagement history, so
early sends may still land in spam. That resolves as real recipients open and click — which a signup
confirmation earns faster than any other kind of mail. Don't fake volume; it is itself a spam signal.

## How the redirect works

`signUp()` passes `emailRedirectTo: ${window.location.origin}/auth`. GoTrue exposes that to the template as
`{{ .RedirectTo }}`, and the template builds the link itself:
`https://www.scmpedia.org/auth?token_hash=…&type=signup&confirmed=1`.

Clicking it loads the app, which calls `verifyOtp({ token_hash, type: 'signup' })` to confirm the address and
then lands on the sign-in form. Nothing is confirmed server-side before the app runs — which is the point, and
also means **the app must be deployed for confirmation links to work at all**.

Three things in the app make that landing work, and all three are load-bearing:

1. `src/supabase.ts` — the `detectSessionInUrl` predicate only claims `/auth` and `/auth/reset`. Before this
   change the link landed on `/`, which is not a callback path, so the tokens were **silently discarded** and
   the user was not even signed in when they arrived.
2. `src/App.tsx` — the `/auth` guard is `auth.user && !confirmingEmail`. Confirming *also signs you in*, and
   auth-js emits `SIGNED_IN` from a `setTimeout(0)` before React can react, so a plain `auth.user` guard
   redirects to the homepage before `AuthPage` ever renders. `confirmingEmail` is seeded from the landing URL.
3. `src/pages/AuthPage.tsx` — calls `verifyOtp()`, takes the address off the resulting session, then signs it
   out, so the sign-in form is real rather than decorative. Guarded by a module-scoped promise so React
   StrictMode's double-invoked effect cannot fire two `/logout` calls. It also `replaceState`s `token_hash` out
   of the URL **before any network call**: a token in the query string (unlike the fragment it replaced) is
   sent to servers in the `Referer` header and written to browser history and hosting access logs.

`?confirmed=1` is read from the **query**, not the hash: auth-js wipes `window.location.hash` once it consumes
the tokens, but never touches the query string.

## Verifying

"Ended up on the homepage" now has three distinct causes (Site URL fallback, a non-allow-listed redirect, and
the SPA catch-all route), so assert on the **link itself** rather than on where the browser lands. View source
on the received email: the CTA href must be

```
https://www.scmpedia.org/auth?token_hash=<56 hex>&type=signup&confirmed=1
```

Two failure signatures to check for:
- **Two `?` in the URL** — `emailRedirectTo` was given a query string. See the warning in step 1.
- **The href points at `*.supabase.co`** — the dashboard still holds the old template; re-paste it.

## Known follow-up (not fixed here)

`/auth/reset` renders the plain `AuthPage`, which has `signin | signup | forgot` modes and **no set-new-password
form**. `useAuth` exposes a `passwordRecovery` flag that nothing consumes. Password reset is a dead end today:
the email arrives, the link works, and the user lands on a page that cannot change their password.
