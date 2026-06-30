// supabase-js builds a realtime client at construction, which requires a global
// WebSocket. Node < 22 has none and we never use realtime (only HTTP .from() queries),
// so a harmless stub keeps createClient() from throwing. Import this (side-effect only)
// from any module that calls createClient, before that call runs.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  ;(globalThis as { WebSocket?: unknown }).WebSocket = class {}
}

export {}
