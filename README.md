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
```

On Vercel, add the same variables in Project Settings.

## Admin Access

- URL: `/admin`
- Username: `scmpedia-admin`
- Password: `scmpedia-2026`

Admin changes are local until you download the updated CSV and replace `public/scmpedia_full_UPDATED.csv`.

## Build

```bash
npm run build
npm run preview
```
