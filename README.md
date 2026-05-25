# scmpedia

scmpedia means Supply Chain Management pedia. It is a standalone Vite + React platform with supply chain term search, AI-powered explanations, voice reading, image lookup, CSV-backed content, and a separate admin screen for maintaining the dictionary.

## Local Development

```bash
npm install
npm run dev
```

Main app: `http://localhost:5173/`

Admin app: `http://localhost:5173/admin`

## Environment Variables

Create `.env.local` with:

```bash
POLLINATIONS_API_KEY=your_key_here
POLLINATIONS_BASE_URL=https://gen.pollinations.ai
POLLINATIONS_MODEL=openai
GOOGLE_CSE_API_KEY=your_key_here
GOOGLE_CSE_CX=your_search_engine_id
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=VR5rq02kIGuHRg0JKxB6
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
```

On Vercel, add the same variables in Project Settings. The AI explanation button uses the same Pollinations provider pattern as PanAvest Courses.

## Admin Access

- URL: `/admin`
- Set `SCMPEDIA_ADMIN_USER`, `SCMPEDIA_ADMIN_PASS`, and `ADMIN_SESSION_SECRET` in the server environment.
- Admin login is verified server-side and returns a short-lived admin session token.

Words are served from Supabase through the server-only `/api/words` endpoint. Keep `SUPABASE_SERVICE_ROLE_KEY` in local/Vercel server environment variables, never in frontend code.

CSV uploads in `/admin` are imported into Supabase through `/api/words`. Do not expose admin credentials as `VITE_` variables; Vite variables are bundled into client JavaScript.

## Build

```bash
npm run build
npm run preview
```
