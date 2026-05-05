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
LLAMA_API_KEY=your_key_here
LLAMA_BASE_URL=https://openrouter.ai/api/v1
LLAMA_MODEL=meta-llama/llama-4-maverick:free
GOOGLE_CSE_API_KEY=your_key_here
GOOGLE_CSE_CX=your_search_engine_id
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=VR5rq02kIGuHRg0JKxB6
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
```

On Vercel, add the same variables in Project Settings. The AI explanation button uses Llama 4 through a chat-completions compatible provider.

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
