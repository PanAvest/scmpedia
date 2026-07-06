# SCMpedia iOS App

Native Expo app for SCMpedia. It mirrors the website features with iOS UI: search/chat, term pages, AI explanations, voice reading, images, dictionary mode, favorites, dashboard history, settings, auth, and Paystack premium checkout.

## Setup

```bash
cp .env.example .env.local
npm install
npm run ios
```

`EXPO_PUBLIC_API_BASE_URL` must point to the deployed SCMpedia website/API host because the app calls the existing `/api/words`, `/api/ai`, `/api/image`, `/api/tts`, and `/api/paystack/*` routes.

Use the Supabase public URL and publishable/anon key only. Keep service-role, Paystack secret, ElevenLabs, Google CSE, and AI provider keys on the website/API server.

## Checks

```bash
npm run typecheck
```
