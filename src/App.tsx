import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { hasSupabaseConfig, supabase } from './supabase'

/* ------------------------------- THEME & CSS ------------------------------- */
const STYLES = `
:root {
  --bg: #fff;
  --surface: #f0f4f9;
  --surface-hover: #e9eef6;
  --primary: #b65437;
  --primary-bg: rgba(182, 84, 55, 0.1);
  --text-main: #1f1f1f;
  --text-sub: #444746;
  --border: #e3e3e3;
  --user-bubble: #e8f0fe;
  --bot-bubble: transparent;
  --card-bg: #ffffff;
  --shadow: 0 4px 12px rgba(0,0,0,0.08);
  --input-offset: 150px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

/* Base */
* { box-sizing: border-box; }
img { backface-visibility: hidden; transform: translateZ(0); }
body { margin: 0; font-family: "Google Sans", "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Arial Unicode MS", sans-serif; background: var(--bg); color: var(--text-main); height: 100dvh; overflow: hidden; -webkit-text-size-adjust: 100%; }
#root { height: 100%; display: flex; flex-direction: column; overflow: hidden; }

/* Layout */
.app-container { display: flex; flex-direction: column; height: 100%; max-width: 100%; position: relative; }
.chat-window { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px 0 calc(var(--input-offset) + var(--safe-bottom)); scroll-behavior: smooth; display: flex; flex-direction: column; align-items: center; scroll-padding-bottom: calc(var(--input-offset) + var(--safe-bottom)); }
.width-constraint { width: 100%; max-width: 850px; padding: 0 20px; box-sizing: border-box; }

/* Header */
.header { padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); z-index: 50; border-bottom: 1px solid transparent; }
.header.scrolled { border-color: var(--border); }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 18px; color: var(--text-sub); }
.brand span { color: var(--primary); font-weight: 700; }

.header-controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }

.settings-btn { background: none; border: none; cursor: pointer; color: var(--text-sub); display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500; padding: 6px 12px; border-radius: 8px; transition: background 0.2s, transform 0.2s ease; background: var(--surface); }
.settings-btn:hover { background: var(--surface-hover); }
.settings-btn:active { transform: scale(0.98); }

.db-status { font-size: 12px; display: flex; align-items: center; gap: 6px; padding: 4px 12px; background: var(--surface); border-radius: 99px; font-weight: 500; cursor: pointer; transition: background 0.2s, transform 0.2s ease; border: 1px solid var(--border); }
.db-status:hover { background: var(--surface-hover); }
.db-status:active { transform: scale(0.98); }
.indicator { width: 8px; height: 8px; border-radius: 50%; background: #ccc; }
.indicator.ready { background: #14ae5c; box-shadow: 0 0 0 2px rgba(20, 174, 92, 0.2); }
.indicator.error { background: #d93025; }

/* Settings Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
.modal { background: #fff; width: 100%; max-width: 480px; border-radius: 16px; padding: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); animation: pop-up 0.2s ease-out; }
.modal h2 { margin: 0 0 16px; font-size: 20px; }
.modal-row { margin-bottom: 20px; }
.modal-label { display: block; font-size: 13px; font-weight: 600; color: var(--text-sub); margin-bottom: 8px; }
.modal-input { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; box-sizing: border-box; }
.modal-select { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; box-sizing: border-box; background: #fff; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
.modal-btn { padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
.modal-btn.secondary { background: var(--surface); color: var(--text-main); }
.modal-btn.primary { background: var(--primary); color: #fff; }
.api-hint { font-size: 12px; color: #666; margin-top: 6px; line-height: 1.4; }

/* Messages */
.message-row { display: flex; width: 100%; margin-bottom: 32px; animation: slide-up 0.35s ease-out; }
.message-row.user { justify-content: flex-end; }
.message-row.bot { justify-content: flex-start; }

.avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-top: 2px; flex-shrink: 0; font-size: 14px; }
.avatar.bot { background: linear-gradient(135deg, #b65437, #d97757); color: white; margin-right: 16px; box-shadow: 0 2px 6px rgba(182, 84, 55, 0.3); }
.avatar.user { display: none; }

.bubble { max-width: 100%; line-height: 1.6; font-size: 16px; position: relative; }
.user .bubble { background: var(--user-bubble); padding: 12px 20px; border-radius: 20px 20px 4px 20px; color: var(--text-main); }
.bot .bubble { background: var(--bot-bubble); padding: 0; width: 100%; }

/* --- RICH CARD STYLE --- */
.smart-card {
  background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px;
  padding: 20px; box-shadow: var(--shadow); margin-top: 8px; max-width: 680px;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.2s ease;
}
.smart-card:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(0,0,0,0.12); border-color: rgba(182, 84, 55, 0.15); }
.term-header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.term-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--text-main); letter-spacing: -0.5px; }
.term-pos { font-size: 12px; font-weight: 600; color: var(--primary); background: var(--primary-bg); padding: 2px 8px; border-radius: 99px; text-transform: uppercase; }
.term-pron { font-family: monospace; color: var(--text-sub); font-size: 14px; }
.term-def { font-size: 16px; color: #333; margin-bottom: 16px; line-height: 1.6; }

/* Card Actions */
.action-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.action-btn {
  display: flex; align-items: center; gap: 8px; padding: 8px 14px;
  background: var(--surface); border: 1px solid transparent; border-radius: 8px;
  font-size: 13px; font-weight: 500; color: var(--text-sub); cursor: pointer; transition: transform 0.2s ease, background 0.2s, border-color 0.2s, color 0.2s;
}
.action-btn:hover { background: var(--surface-hover); border-color: var(--border); color: var(--text-main); }
.action-btn:active { transform: translateY(1px); }
.action-btn.active { background: var(--primary-bg); color: var(--primary); border-color: rgba(182,84,55,0.2); }
.action-btn.copied { background: #063f3a; color: #fff; border-color: #063f3a; }
.action-icon { width: 16px; height: 16px; opacity: 0.8; }
.copy-wrap { position: relative; display: inline-flex; }
.copy-toast {
  position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);
  background: #063f3a; color: #fff; border-radius: 999px; padding: 6px 10px;
  font-size: 12px; font-weight: 700; white-space: nowrap; box-shadow: 0 8px 20px rgba(6,63,58,0.2);
  animation: pop-in 0.18s ease-out; z-index: 5; pointer-events: none;
}
.copy-toast::before {
  content: ''; position: absolute; top: -4px; left: 50%; width: 8px; height: 8px;
  background: #063f3a; transform: translateX(-50%) rotate(45deg);
}

/* Voice Meter */
.voice-meter { display: flex; align-items: flex-end; gap: 2px; height: 12px; margin-left: 4px; }
.bar { width: 3px; background: var(--primary); border-radius: 2px; animation: bounce-bar 0s infinite; }
.action-btn:not(.active) .bar { display: none; }
.action-btn.active .bar { background: #fff; }
.loading-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-opacity 0.8s infinite ease-in-out;
}
.loading-dot:nth-child(2) { animation-delay: 0.12s; }
.loading-dot:nth-child(3) { animation-delay: 0.24s; }

/* Expanded Details */
.details-panel {
  background: var(--surface); border-radius: 12px; padding: 16px; font-size: 14px;
  animation: slide-down 0.2s ease-out; border: 1px solid var(--border);
}
.detail-row { margin-bottom: 8px; display: flex; gap: 8px; }
.detail-label { font-weight: 600; color: var(--text-sub); min-width: 80px; }
.detail-val { color: var(--text-main); flex: 1; }

.ai-box { background: #fff; border: 1px solid #c3eec9; padding: 12px; border-radius: 8px; margin-top: 12px; position: relative; }
.ai-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.ai-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #14ae5c; text-transform: uppercase; }
.mini-read-btn { background: none; border: none; color: #14ae5c; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 4px; }
.mini-read-btn:hover { background: #f0fdf4; }
.context-img { width: 100%; height: 220px; object-fit: cover; border-radius: 8px; margin-top: 12px; border: 1px solid var(--border); background: #f0f0f0; }
.context-img.placeholder { display: flex; align-items: center; justify-content: center; color: #7a7a7a; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }

.regen-btn {
  width: 100%; margin-top: 12px; padding: 8px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; color: #1a73e8; font-size: 12px; font-weight: 500; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;
}
.regen-btn:hover { background: var(--surface-hover); color: var(--text-main); }

.google-link-btn {
  width: 100%; margin-top: 8px; padding: 8px; background: #e8f0fe; border: 1px solid #d2e3fc;
  border-radius: 8px; color: #1a73e8; font-size: 12px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none;
}
.google-link-btn:hover { background: #d2e3fc; }

/* Thinking Animation */
.thinking-box { margin-top: 12px; padding: 16px; background: #f8fafc; border-radius: 12px; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--border); }
.thinking-header { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--primary); }
.pulse-dot { width: 8px; height: 8px; background: var(--primary); border-radius: 50%; animation: pulse-opacity 1s infinite ease-in-out; }
.thought-process { font-size: 12px; color: #64748b; font-family: monospace; height: 1.4em; overflow: hidden; white-space: nowrap; }
.fade-text { animation: fade-in-out 2s infinite; }
.chat-thinking {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 42px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text-sub);
  box-shadow: var(--shadow);
  font-size: 14px;
  font-weight: 750;
}
.chat-thinking i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
  animation: pulse-opacity 0.85s infinite ease-in-out;
}
.chat-thinking i:nth-child(3) { animation-delay: 0.12s; }
.chat-thinking i:nth-child(4) { animation-delay: 0.24s; }
.word-suggestions {
  width: min(680px, 100%);
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  box-shadow: var(--shadow);
}
.word-suggestions-title {
  margin-bottom: 10px;
  color: var(--text-main);
  font-size: 14px;
  font-weight: 850;
}
.word-suggestion-list {
  display: grid;
  gap: 8px;
}
.word-suggestion-list button {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}
.word-suggestion-list button:hover {
  background: var(--surface-hover);
  border-color: rgba(154, 75, 50, 0.24);
  transform: translateY(-1px);
}
.word-suggestion-list strong {
  font-size: 14px;
}
.word-suggestion-list span {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-sub);
  font-size: 12px;
  line-height: 1.4;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Input Area */
.input-area { position: fixed; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, var(--bg) 85%, transparent); padding: 0 20px calc(30px + var(--safe-bottom)); display: flex; flex-direction: column; align-items: center; z-index: 20; pointer-events: none; }
.input-container { width: 100%; max-width: 850px; position: relative; pointer-events: auto; }

/* Predictive Suggestions */
.predictive-list {
  position: absolute; bottom: 100%; left: 20px; right: 20px; margin-bottom: 10px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; max-height: 220px; overflow-y: auto;
  display: flex; flex-direction: column; z-index: 30; transform-origin: bottom; animation: pop-up 0.15s ease-out;
}
.predictive-item { padding: 12px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--surface); }
.predictive-item:last-child { border-bottom: none; }
.predictive-item:hover, .predictive-item.selected { background: var(--surface-hover); }
.p-term { font-weight: 500; color: var(--text-main); }
.p-def { font-size: 12px; color: var(--text-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%; }

/* Input Bar */
.input-wrapper { background: var(--surface); border-radius: 28px; display: flex; align-items: center; border: 1px solid transparent; transition: box-shadow 0.2s, border-color 0.2s, transform 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.05); }
.input-wrapper:focus-within { background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-color: var(--border); }
.chat-input { flex: 1; background: transparent; border: none; padding: 16px 24px; font-size: 16px; outline: none; color: var(--text-main); font-family: inherit; }
.send-btn { background: transparent; border: none; cursor: pointer; padding: 12px; margin-right: 6px; color: var(--text-sub); border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease, background 0.2s, color 0.2s; }
.send-btn.active { color: #fff; background: var(--primary); }
.send-btn:active { transform: scale(0.96); }

/* Welcome */
.welcome-screen { text-align: center; padding-top: 60px; opacity: 0; animation: fade-in 0.6s forwards; }
.w-title { font-size: 36px; font-weight: 600; margin-bottom: 10px; color: var(--text-main); }
.w-sub { color: var(--text-sub); margin-bottom: 30px; font-size: 16px; }
.highlight { color: var(--primary); font-weight: 700; }

/* Utilities */
@keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pop-up { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes slide-down { from { opacity: 0; height: 0; } to { opacity: 1; height: auto; } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bounce-bar { 0%, 100% { height: 4px; } 50% { height: 100%; } }
@keyframes pulse-opacity { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
@keyframes fade-in-out { 0% { opacity: 0; transform: translateY(2px); } 10% { opacity: 1; transform: translateY(0); } 90% { opacity: 1; } 100% { opacity: 0; transform: translateY(-2px); } }
mark { background: rgba(182, 84, 55, 0.2); color: inherit; padding: 0 2px; border-radius: 2px; }

/* Mobile */
@media (max-width: 760px) {
  :root { --input-offset: 130px; }
  body { overflow: hidden; }
  .header { padding: 10px 14px; gap: 8px; flex-wrap: wrap; }
  .brand { font-size: 16px; }
  .header-controls { width: 100%; justify-content: space-between; gap: 8px; }
  .settings-btn { font-size: 12px; padding: 6px 10px; }
  .db-status { font-size: 11px; padding: 4px 10px; }
  .chat-window { padding: 12px 0 calc(var(--input-offset) + var(--safe-bottom)); }
  .width-constraint { padding: 0 12px; }
  .message-row { margin-bottom: 22px; }
  .avatar.bot { margin-right: 10px; width: 28px; height: 28px; font-size: 12px; }
  .smart-card { padding: 16px; border-radius: 14px; }
  .term-title { font-size: 20px; }
  .term-def { font-size: 15px; }
  .action-bar { gap: 6px; }
  .action-btn { padding: 6px 10px; font-size: 12px; }
  .predictive-list { left: 12px; right: 12px; border-radius: 12px; }
  .input-area { padding: 0 12px calc(18px + var(--safe-bottom)); }
  .input-wrapper { border-radius: 22px; }
  .chat-input { padding: 14px 16px; font-size: 16px; }
  .send-btn { padding: 10px; margin-right: 4px; }
  .w-title { font-size: 28px; }
  .w-sub { font-size: 14px; }
}

@media (max-width: 480px) {
  :root { --input-offset: 120px; }
  .header-controls { flex-direction: column; align-items: stretch; }
  .db-status, .settings-btn { width: 100%; justify-content: center; }
  .action-btn { flex: 1 1 auto; }
  .term-header { gap: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  .smart-card:hover { transform: none; }
}

@media (max-width: 420px) {
  .header-controls { flex-direction: column; align-items: stretch; }
  .settings-btn, .db-status { width: 100%; justify-content: center; }
  .smart-card { padding: 14px; }
  .term-title { font-size: 18px; }
  .details-panel { padding: 12px; }
}
`

const PLATFORM_STYLES = `
:root {
  --bg: #f6f7f4;
  --surface: #ffffff;
  --surface-hover: #eef2ec;
  --primary: #9a4b32;
  --primary-bg: rgba(154, 75, 50, 0.1);
  --accent: #2f6f68;
  --accent-soft: rgba(47, 111, 104, 0.1);
  --text-main: #151716;
  --text-sub: #5c625d;
  --border: #dfe4dd;
  --user-bubble: #1f4f4a;
  --card-bg: #ffffff;
  --shadow: 0 16px 40px rgba(29, 35, 32, 0.09);
}

:root[data-theme="dark"] {
  --bg: #111412;
  --surface: #171c19;
  --surface-hover: #222923;
  --primary: #f28b58;
  --primary-bg: rgba(242, 139, 88, 0.15);
  --accent: #62c7ba;
  --accent-soft: rgba(98, 199, 186, 0.14);
  --text-main: #f4f7f2;
  --text-sub: #b8c0b8;
  --border: #2b332d;
  --user-bubble: #0f6157;
  --card-bg: #171c19;
  --shadow: 0 18px 46px rgba(0, 0, 0, 0.35);
}

body {
  background:
    radial-gradient(circle at 7% 9%, rgba(255, 110, 28, 0.14) 0 1px, transparent 2px) 0 0 / 15px 15px,
    linear-gradient(180deg, rgba(255,255,255,0.72), rgba(250,247,241,0.94)),
    radial-gradient(circle at top left, rgba(255, 128, 43, 0.1), transparent 34%),
    radial-gradient(circle at 88% 10%, rgba(0, 79, 70, 0.1), transparent 30%),
    #fbf8f1;
}

:root[data-theme="dark"] body {
  background:
    radial-gradient(circle at 7% 9%, rgba(242, 139, 88, 0.13) 0 1px, transparent 2px) 0 0 / 15px 15px,
    linear-gradient(180deg, rgba(13,17,15,0.94), rgba(17,20,18,0.98)),
    radial-gradient(circle at top left, rgba(242, 139, 88, 0.08), transparent 34%),
    radial-gradient(circle at 88% 10%, rgba(98, 199, 186, 0.08), transparent 30%),
    #111412;
}

.app-container {
  background: transparent;
}

.header {
  min-height: 72px;
  padding: 14px clamp(16px, 4vw, 44px);
  background: rgba(246, 247, 244, 0.88);
  border-bottom: 1px solid rgba(223, 228, 221, 0.8);
  animation: drop-in 0.45s cubic-bezier(.2,.8,.2,1) both;
}

.brand {
  color: var(--text-main);
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.brand-logo {
  display: block;
  width: min(260px, 48vw);
  height: auto;
  max-height: 48px;
  object-fit: contain;
  transition: transform 0.22s ease, filter 0.22s ease;
}

.brand-icon {
  display: none;
}

.brand::before,
.brand span {
  content: none;
  display: none;
}

.brand:hover .brand-logo,
.brand:hover .brand-icon {
  transform: translateY(-1px) scale(1.02);
  filter: drop-shadow(0 10px 18px rgba(255, 122, 31, 0.16));
}

.settings-btn,
.db-status {
  border-radius: 8px;
  min-height: 38px;
  background: #fff;
  border-color: var(--border);
  box-shadow: 0 8px 20px rgba(20, 24, 22, 0.06);
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
}

.settings-btn.active {
  color: #fff;
  background: #004f46;
}

.settings-btn:hover,
.db-status:hover {
  background: var(--surface-hover);
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(20, 24, 22, 0.1);
}

.mobile-menu-btn {
  display: none;
}

.mobile-menu {
  display: none;
}

.indicator.ready {
  background: var(--accent);
  box-shadow: 0 0 0 3px rgba(47, 111, 104, 0.16);
}

.chat-window {
  padding-top: 18px;
}

.width-constraint {
  max-width: 980px;
}

.welcome-screen {
  min-height: calc(100dvh - 98px);
  display: block;
  text-align: left;
  padding-top: 8px;
  animation: page-fade-in 0.55s ease both;
}

.welcome-screen > div:first-child {
  display: none;
}

.welcome-screen::before {
  content: none;
  display: none;
}

.welcome-logo {
  display: block;
  width: min(360px, 76vw);
  min-height: 74px;
  height: auto;
  margin: 0 auto 18px;
  object-fit: contain;
  animation: logo-pop 0.58s cubic-bezier(.2,.9,.2,1) 0.08s both;
}

.fade-img {
  opacity: 0;
  transition: opacity 0.28s ease, filter 0.28s ease;
}

.fade-img.loaded {
  opacity: 1;
}

.home-panel {
  position: relative;
  overflow: hidden;
  min-height: 330px;
  border-radius: 8px;
  border: 1px solid rgba(0, 68, 60, 0.18);
  background:
    radial-gradient(circle at 80% 24%, rgba(255, 132, 35, 0.16), transparent 18%),
    radial-gradient(circle at 76% 38%, rgba(255,255,255,0.11) 0 1px, transparent 2px) 0 0 / 13px 13px,
    linear-gradient(132deg, rgba(0, 56, 50, 0.98), rgba(0, 77, 67, 0.96));
  box-shadow: 0 24px 70px rgba(24, 34, 30, 0.16);
  padding: clamp(24px, 5vw, 50px);
  color: #fff;
  animation: panel-rise 0.62s cubic-bezier(.2,.8,.2,1) 0.12s both;
}

.home-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, transparent 0 40%, rgba(255,255,255,0.06) 41%, transparent 42%),
    radial-gradient(circle at 94% 12%, rgba(255,255,255,0.08), transparent 30%);
  pointer-events: none;
  animation: soft-pan 9s ease-in-out infinite alternate;
}

.home-content {
  position: relative;
  z-index: 1;
  max-width: 760px;
}

.home-kicker {
  display: inline-flex;
  color: #ff8a1d;
  font-weight: 800;
  font-size: 13px;
  margin-bottom: 12px;
  animation: text-rise 0.48s ease 0.22s both;
}

.home-title {
  margin: 0 0 12px;
  max-width: 680px;
  color: #fff;
  font-size: clamp(32px, 5vw, 58px);
  line-height: 1.02;
  font-weight: 850;
  letter-spacing: 0;
  animation: text-rise 0.52s ease 0.28s both;
}

.home-title span {
  color: #ff8a1d;
}

.home-copy {
  max-width: 610px;
  margin: 0 0 26px;
  color: rgba(255,255,255,0.86);
  font-size: 16px;
  line-height: 1.65;
  animation: text-rise 0.52s ease 0.34s both;
}

.home-search {
  max-width: 680px;
  position: relative;
  animation: search-pop 0.48s cubic-bezier(.2,.8,.2,1) 0.42s both;
}

.home-search .input-wrapper {
  min-height: 66px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 22px 46px rgba(0, 22, 19, 0.26);
}

.home-search .chat-input {
  min-height: 64px;
}

.home-search .send-btn {
  width: 48px;
  height: 48px;
  margin-right: 9px;
  border-radius: 50%;
}

.home-search .predictive-list {
  left: 0;
  right: 0;
}

.popular-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.popular-label {
  width: 100%;
  color: rgba(255,255,255,0.84);
  font-size: 12px;
  font-weight: 800;
}

.term-chip {
  min-height: 34px;
  padding: 7px 14px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.term-chip:hover,
.term-chip.primary {
  color: #ff8a1d;
  border-color: rgba(255, 138, 29, 0.8);
  background: rgba(255, 138, 29, 0.12);
  transform: translateY(-1px);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 18px 0 0;
}

.feature-card {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 12px;
  align-items: center;
  min-height: 104px;
  padding: 16px;
  border: 1px solid rgba(223, 228, 221, 0.92);
  border-radius: 8px;
  background: rgba(255,255,255,0.88);
  box-shadow: 0 14px 36px rgba(31, 39, 35, 0.08);
  animation: card-pop 0.48s cubic-bezier(.2,.8,.2,1) both;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.feature-card:nth-child(1) { animation-delay: 0.18s; }
.feature-card:nth-child(2) { animation-delay: 0.24s; }
.feature-card:nth-child(3) { animation-delay: 0.3s; }
.feature-card:nth-child(4) { animation-delay: 0.36s; }

.feature-card:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 122, 31, 0.24);
  box-shadow: 0 20px 44px rgba(31, 39, 35, 0.12);
}

.feature-icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #006253;
  background: #e6f4ef;
}

.feature-card:nth-child(even) .feature-icon {
  color: #ff781f;
  background: #fff0e2;
}

.feature-title {
  color: var(--text-main);
  font-size: 14px;
  font-weight: 850;
  margin-bottom: 4px;
}

.feature-text {
  color: var(--text-sub);
  font-size: 12px;
  line-height: 1.35;
}

.about-page {
  width: 100%;
  max-width: 1060px;
  padding: 12px 20px 40px;
  animation: page-fade-in 0.45s ease both;
}

.about-hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 24px;
  align-items: center;
  min-height: 250px;
  padding: clamp(24px, 5vw, 44px);
  border-radius: 8px;
  border: 1px solid rgba(0, 68, 60, 0.18);
  background:
    radial-gradient(circle at 82% 28%, rgba(255, 132, 35, 0.22), transparent 22%),
    linear-gradient(132deg, rgba(0, 56, 50, 0.98), rgba(0, 77, 67, 0.96));
  color: #fff;
  box-shadow: 0 24px 70px rgba(24, 34, 30, 0.16);
  animation: panel-rise 0.56s cubic-bezier(.2,.8,.2,1) both;
}

.about-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 88% 20%, rgba(255,255,255,0.12) 0 1px, transparent 2px) 0 0 / 14px 14px;
  pointer-events: none;
}

.about-hero-content,
.about-book {
  position: relative;
  z-index: 1;
}

.about-logo {
  width: min(300px, 72vw);
  min-height: 58px;
  height: auto;
  margin-bottom: 18px;
  animation: text-rise 0.45s ease 0.12s both;
}

.about-title {
  margin: 0 0 12px;
  color: #fff;
  font-size: clamp(30px, 5vw, 52px);
  line-height: 1.02;
  font-weight: 850;
  animation: text-rise 0.5s ease 0.18s both;
}

.about-title span {
  color: #ff8a1d;
}

.about-copy {
  max-width: 720px;
  margin: 0;
  color: rgba(255,255,255,0.86);
  font-size: 16px;
  line-height: 1.65;
  animation: text-rise 0.5s ease 0.24s both;
}

.about-book {
  justify-self: center;
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: 14px;
}

.book-cover {
  width: min(190px, 52vw);
  aspect-ratio: 386 / 500;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: 0 22px 42px rgba(0, 18, 16, 0.34);
  animation: book-float-in 0.62s cubic-bezier(.2,.8,.2,1) 0.22s both, float-soft 4.5s ease-in-out 1.1s infinite;
}

.amazon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #ff8a1d;
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
  box-shadow: 0 14px 26px rgba(255, 122, 31, 0.28);
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.amazon-btn:hover {
  background: #ff9c3d;
  transform: translateY(-2px);
  box-shadow: 0 18px 34px rgba(255, 122, 31, 0.34);
}

.about-section-title {
  margin: 28px 0 12px;
  color: var(--text-main);
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.about-card {
  display: grid;
  grid-template-columns: 46px 1fr;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(223, 228, 221, 0.92);
  border-radius: 8px;
  background: rgba(255,255,255,0.9);
  box-shadow: 0 14px 36px rgba(31, 39, 35, 0.08);
  animation: card-pop 0.45s cubic-bezier(.2,.8,.2,1) both;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.about-card:nth-child(1) { animation-delay: 0.08s; }
.about-card:nth-child(2) { animation-delay: 0.14s; }
.about-card:nth-child(3) { animation-delay: 0.2s; }
.about-card:nth-child(4) { animation-delay: 0.26s; }

.about-card:hover {
  transform: translateY(-2px);
  border-color: rgba(0, 80, 70, 0.18);
  box-shadow: 0 20px 44px rgba(31, 39, 35, 0.11);
}

.about-card-icon {
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #006253;
  background: #e6f4ef;
}

.about-card:nth-child(even) .about-card-icon {
  color: #ff781f;
  background: #fff0e2;
}

.about-card h3 {
  margin: 0 0 6px;
  color: var(--text-main);
  font-size: 16px;
}

.about-card p {
  margin: 0;
  color: var(--text-sub);
  font-size: 13px;
  line-height: 1.5;
}

.about-actions {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.about-back {
  min-height: 42px;
  padding: 10px 16px;
  border: 1px solid rgba(0, 80, 70, 0.24);
  border-radius: 8px;
  background: #fff;
  color: #004f46;
  font-weight: 800;
  cursor: pointer;
}

.about-back:hover {
  background: #e6f4ef;
}

.w-title {
  max-width: 760px;
  margin: 0 auto 14px;
  color: var(--text-main);
  font-size: clamp(42px, 7vw, 78px);
  line-height: 0.98;
  font-weight: 820;
  letter-spacing: 0;
}

.w-sub {
  max-width: 760px;
  color: var(--text-sub);
  font-size: clamp(15px, 2vw, 18px);
  line-height: 1.65;
  margin-bottom: 28px;
}

.highlight {
  color: var(--accent);
  font-weight: 750;
}

.message-row {
  margin-bottom: 24px;
}

.user .bubble {
  max-width: min(760px, 82%);
  background: var(--user-bubble);
  color: #fff;
  border-radius: 16px 16px 4px 16px;
}

.avatar.bot {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 45% 38%, #fff8f1 0 28%, #ffe3c6 58%, #ff7a36 100%);
  box-shadow:
    0 0 0 1px rgba(255, 122, 54, 0.2),
    0 0 18px rgba(255, 122, 54, 0.34),
    0 10px 24px rgba(154, 75, 50, 0.16);
  padding: 8px;
  overflow: hidden;
  animation: avatar-pop 0.34s cubic-bezier(.2,.8,.2,1) both;
}

.avatar-logo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  mix-blend-mode: multiply;
  filter: saturate(1.08) contrast(1.04);
}

.smart-card {
  max-width: 780px;
  border-radius: 8px;
  border-color: rgba(223, 228, 221, 0.92);
  box-shadow: var(--shadow);
  padding: 22px;
  animation: card-pop 0.42s cubic-bezier(.2,.8,.2,1) both;
}

.smart-card::before {
  content: "Back to search";
  display: block;
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 14px;
}

.smart-card:hover {
  border-color: rgba(154, 75, 50, 0.24);
  box-shadow: 0 20px 44px rgba(29, 35, 32, 0.12);
}

.term-title {
  font-size: clamp(24px, 4vw, 34px);
  color: var(--text-main);
  letter-spacing: 0;
}

.term-pos {
  background: var(--primary-bg);
  color: var(--primary);
  border-radius: 6px;
  order: -1;
}

.term-def {
  color: #303632;
  font-size: 16px;
}

.action-btn,
.modal-btn,
.regen-btn,
.google-link-btn {
  border-radius: 8px;
}

.action-btn.active {
  color: #fff;
  background: linear-gradient(135deg, #004f46, #007060);
  border-color: rgba(0, 80, 70, 0.42);
  box-shadow: 0 10px 22px rgba(0, 80, 70, 0.18);
}

.action-btn:hover,
.regen-btn:hover,
.google-link-btn:hover,
.modal-btn:hover,
.about-back:hover {
  transform: translateY(-1px);
}

.details-panel,
.ai-box {
  border-radius: 8px;
}

.ai-box {
  border-color: rgba(47, 111, 104, 0.22);
  background: #fff;
}

.ai-badge,
.mini-read-btn {
  color: var(--accent);
}

.context-img {
  border-radius: 8px;
  height: 250px;
  object-fit: contain;
  background: #f7faf9;
  animation: media-reveal 0.42s ease both;
}

.context-img.placeholder {
  position: relative;
  overflow: hidden;
}

.context-img.placeholder::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.62), transparent);
  animation: shimmer 1.5s infinite;
}

.input-area {
  background: linear-gradient(to top, rgba(246,247,244,1) 70%, rgba(246,247,244,0));
}

.input-wrapper {
  border-radius: 8px;
  background: #fff;
  border-color: var(--border);
  box-shadow: 0 18px 42px rgba(29, 35, 32, 0.12);
}

.input-wrapper:focus-within {
  border-color: rgba(47, 111, 104, 0.32);
  box-shadow: 0 20px 48px rgba(29, 35, 32, 0.15);
  transform: translateY(-1px);
}

.chat-input {
  min-height: 60px;
}

.send-btn {
  border-radius: 8px;
}

.send-btn.active {
  background: var(--primary);
  animation: button-ready 0.28s ease both;
}

.predictive-list {
  border-radius: 8px;
  box-shadow: 0 18px 42px rgba(29, 35, 32, 0.12);
  animation: dropdown-in 0.2s cubic-bezier(.2,.8,.2,1) both;
}

.modal-overlay {
  padding: 18px;
  background: rgba(0, 28, 24, 0.5);
  backdrop-filter: blur(8px);
  animation: overlay-in 0.2s ease both;
}

.modal {
  width: min(560px, 100%);
  max-height: calc(100dvh - 36px);
  overflow-y: auto;
  border: 1px solid rgba(223, 228, 221, 0.92);
  border-radius: 8px;
  padding: 0;
  box-shadow: 0 28px 80px rgba(0, 28, 24, 0.28);
  animation: modal-rise 0.26s cubic-bezier(.2,.8,.2,1) both;
}

.settings-head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
  background:
    radial-gradient(circle at 92% 12%, rgba(255, 138, 29, 0.14), transparent 28%),
    linear-gradient(135deg, #fff, #f8fbf7);
}

.settings-mark {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #fff;
  background: linear-gradient(135deg, #004f46, #007060);
  box-shadow: 0 14px 30px rgba(0, 80, 70, 0.22);
  flex-shrink: 0;
}

.settings-title {
  margin: 0;
  color: var(--text-main);
  font-size: 22px;
  font-weight: 900;
}

.settings-subtitle {
  margin: 3px 0 0;
  color: var(--text-sub);
  font-size: 13px;
  line-height: 1.4;
}

.settings-body {
  display: grid;
  gap: 12px;
  padding: 16px 20px 20px;
}

.setting-card {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgba(223, 228, 221, 0.92);
  border-radius: 8px;
  background: #fff;
  animation: card-pop 0.34s cubic-bezier(.2,.8,.2,1) both;
}

.setting-card:nth-child(1) { animation-delay: 0.05s; }
.setting-card:nth-child(2) { animation-delay: 0.1s; }
.setting-card:nth-child(3) { animation-delay: 0.15s; }

.setting-card-icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #006253;
  background: #e6f4ef;
}

.setting-card:nth-child(even) .setting-card-icon {
  color: #ff781f;
  background: #fff0e2;
}

.setting-card-main {
  min-width: 0;
}

.modal-label {
  color: var(--text-main);
  font-size: 14px;
  font-weight: 850;
}

.modal-select {
  min-height: 42px;
  border-radius: 8px;
  border-color: var(--border);
  color: var(--text-main);
}

.api-hint {
  color: var(--text-sub);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.toggle-copy {
  color: var(--text-sub);
  font-size: 12px;
  line-height: 1.45;
}

.toggle-switch {
  position: relative;
  width: 48px;
  height: 28px;
  flex: 0 0 auto;
}

.toggle-switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: #d9ded7;
  cursor: pointer;
  transition: background 0.2s ease;
}

.toggle-slider::before {
  content: "";
  position: absolute;
  width: 22px;
  height: 22px;
  top: 3px;
  left: 3px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.16);
  transition: transform 0.2s ease;
}

.toggle-switch input:checked + .toggle-slider {
  background: #004f46;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.modal-actions {
  padding-top: 4px;
}

.modal-btn.primary {
  min-height: 42px;
  padding: 10px 18px;
  border-radius: 8px;
  background: #004f46;
  font-weight: 850;
}

:root[data-theme="dark"] .header {
  background: rgba(17, 20, 18, 0.9);
  border-bottom-color: rgba(43, 51, 45, 0.9);
}

:root[data-theme="dark"] .settings-btn,
:root[data-theme="dark"] .db-status,
:root[data-theme="dark"] .modal,
:root[data-theme="dark"] .auth-modal,
:root[data-theme="dark"] .setting-card,
:root[data-theme="dark"] .smart-card,
:root[data-theme="dark"] .feature-card,
:root[data-theme="dark"] .about-card,
:root[data-theme="dark"] .favorite-card,
:root[data-theme="dark"] .dashboard-empty,
:root[data-theme="dark"] .details-panel,
:root[data-theme="dark"] .ai-box {
  background: #171c19;
  border-color: #2b332d;
  color: var(--text-main);
}

:root[data-theme="dark"] .settings-head,
:root[data-theme="dark"] .auth-head {
  background: linear-gradient(135deg, #171c19, #111412);
  border-bottom-color: #2b332d;
}

:root[data-theme="dark"] .input-wrapper,
:root[data-theme="dark"] .home-search .input-wrapper,
:root[data-theme="dark"] .predictive-list,
:root[data-theme="dark"] .modal-input,
:root[data-theme="dark"] .modal-select,
:root[data-theme="dark"] .auth-field input,
:root[data-theme="dark"] .password-wrap,
:root[data-theme="dark"] .password-wrap button,
:root[data-theme="dark"] .icon-btn {
  background: #111412;
  border-color: #2b332d;
  color: var(--text-main);
}

:root[data-theme="dark"] .input-area {
  background: linear-gradient(to top, rgba(17,20,18,1) 70%, rgba(17,20,18,0));
}

:root[data-theme="dark"] .term-def,
:root[data-theme="dark"] .favorite-card strong,
:root[data-theme="dark"] .feature-title,
:root[data-theme="dark"] .about-card h3 {
  color: var(--text-main);
}

:root[data-theme="dark"] .feature-text,
:root[data-theme="dark"] .about-card p,
:root[data-theme="dark"] .favorite-card span,
:root[data-theme="dark"] .detail-val,
:root[data-theme="dark"] .auth-head p,
:root[data-theme="dark"] .settings-subtitle,
:root[data-theme="dark"] .toggle-copy {
  color: var(--text-sub);
}

:root[data-theme="dark"] .context-img.placeholder,
:root[data-theme="dark"] .thinking-box,
:root[data-theme="dark"] .strength-panel,
:root[data-theme="dark"] .strength-checks span {
  background: #111412;
  border-color: #2b332d;
}

.auth-modal {
  width: min(480px, 100%);
  max-height: calc(100dvh - 36px);
  overflow-y: auto;
  border: 1px solid rgba(223, 228, 221, 0.92);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 28px 80px rgba(0, 28, 24, 0.28);
  animation: modal-rise 0.26s cubic-bezier(.2,.8,.2,1) both;
}

.auth-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(135deg, #fff, #f8fbf7);
}

.auth-head h2 {
  margin: 0;
  color: var(--text-main);
  font-size: 22px;
  font-weight: 900;
}

.auth-head p {
  margin: 4px 0 0;
  color: var(--text-sub);
  font-size: 13px;
  line-height: 1.4;
}

.auth-brand-row {
  min-width: 0;
}

.auth-logo {
  display: block;
  width: min(210px, 62vw);
  height: auto;
  max-height: 42px;
  object-fit: contain;
  object-position: left center;
  margin-bottom: 14px;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text-main);
  cursor: pointer;
}

.auth-body {
  display: grid;
  gap: 13px;
  padding: 18px 20px 20px;
}

.name-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.auth-field {
  display: grid;
  gap: 7px;
  color: var(--text-main);
  font-size: 13px;
  font-weight: 800;
}

.auth-field input {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text-main);
  font: inherit;
  font-weight: 500;
}

.password-wrap {
  display: grid;
  grid-template-columns: 1fr 44px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.password-wrap input {
  border: 0;
  border-radius: 0;
}

.password-wrap button {
  border: 0;
  border-left: 1px solid var(--border);
  background: #fff;
  color: var(--text-sub);
  cursor: pointer;
}

.strength-panel {
  display: grid;
  gap: 9px;
  padding: 11px;
  border: 1px solid rgba(223, 228, 221, 0.95);
  border-radius: 8px;
  background: #f8faf7;
}

.strength-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-sub);
  font-size: 12px;
  font-weight: 800;
}

.strength-top strong {
  color: #991b1b;
  font-size: 12px;
  font-weight: 950;
}

.strength-panel.good .strength-top strong { color: #9a4b32; }
.strength-panel.strong .strength-top strong { color: #047857; }

.strength-bars {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
}

.strength-bars span {
  height: 7px;
  border-radius: 999px;
  background: #dfe4dd;
  transition: background 0.18s ease, transform 0.18s ease;
}

.strength-bars span.filled {
  background: #b91c1c;
  transform: scaleY(1.2);
}

.strength-panel.good .strength-bars span.filled { background: #d97706; }
.strength-panel.strong .strength-bars span.filled { background: #059669; }

.strength-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.strength-checks span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 26px;
  padding: 5px 8px;
  border-radius: 999px;
  background: #fff;
  color: #6b7280;
  border: 1px solid rgba(223, 228, 221, 0.95);
  font-size: 11px;
  font-weight: 850;
}

.strength-checks svg {
  opacity: 0.35;
}

.strength-checks span.met {
  color: #047857;
  border-color: rgba(4, 120, 87, 0.2);
  background: #ecfdf5;
}

.strength-checks span.met svg {
  opacity: 1;
}

.auth-alert {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
}

.auth-alert.error {
  color: #991b1b;
  background: #fee2e2;
}

.auth-alert.success {
  color: #065f46;
  background: #d1fae5;
}

.auth-submit {
  min-height: 46px;
  border: 0;
  border-radius: 8px;
  background: #004f46;
  color: #fff;
  font-weight: 900;
  cursor: pointer;
}

.auth-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.auth-switch {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.auth-switch button {
  border: 0;
  background: transparent;
  color: #004f46;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 850;
}

.dashboard-page {
  width: 100%;
  max-width: 1060px;
  padding: 12px 20px 40px;
  animation: page-fade-in 0.45s ease both;
}

.dashboard-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 190px;
  padding: clamp(24px, 5vw, 44px);
  border: 1px solid rgba(0, 68, 60, 0.18);
  border-radius: 8px;
  background: linear-gradient(132deg, rgba(0, 56, 50, 0.98), rgba(0, 77, 67, 0.96));
  color: #fff;
  box-shadow: 0 24px 70px rgba(24, 34, 30, 0.16);
}

.dashboard-head h1 {
  margin: 0 0 8px;
  color: #fff;
  font-size: clamp(30px, 5vw, 50px);
  line-height: 1.04;
}

.dashboard-head p {
  margin: 0;
  color: rgba(255,255,255,0.82);
}

.favorite-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.favorite-card {
  min-height: 124px;
  padding: 18px;
  border: 1px solid rgba(223, 228, 221, 0.92);
  border-radius: 8px;
  background: rgba(255,255,255,0.9);
  text-align: left;
  box-shadow: 0 14px 36px rgba(31, 39, 35, 0.08);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.favorite-card:hover {
  transform: translateY(-2px);
  border-color: rgba(0, 80, 70, 0.18);
  box-shadow: 0 20px 44px rgba(31, 39, 35, 0.11);
}

.favorite-card strong {
  display: block;
  margin-bottom: 8px;
  color: var(--text-main);
  font-size: 17px;
}

.favorite-card span {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-sub);
  font-size: 13px;
  line-height: 1.5;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.dashboard-empty {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text-sub);
  font-weight: 700;
}

@media (max-width: 760px) {
  .header {
    align-items: center;
    min-height: 62px;
    padding: 10px 12px;
  }

  .brand-logo {
    display: none;
  }

  .brand-icon {
    display: block;
    width: 38px;
    height: 38px;
    object-fit: contain;
    mix-blend-mode: multiply;
  }

  .header-controls {
    position: relative;
    width: auto;
    gap: 0;
  }

  .header-controls > .settings-btn {
    display: none;
  }

  .mobile-menu-btn {
    display: inline-flex;
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #fff;
    color: var(--text-main);
    box-shadow: 0 8px 20px rgba(20, 24, 22, 0.06);
    cursor: pointer;
  }

.mobile-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 80;
    display: grid;
    gap: 6px;
    width: min(260px, calc(100vw - 24px));
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(255,255,255,0.98);
    box-shadow: 0 18px 44px rgba(20, 24, 22, 0.16);
    animation: dropdown-in 0.18s cubic-bezier(.2,.8,.2,1) both;
  }

  .mobile-menu[hidden] {
    display: none;
  }

  .mobile-menu .settings-btn {
    display: flex;
    width: 100%;
    justify-content: flex-start;
    box-shadow: none;
  }

  .chat-window {
    padding-top: 10px;
  }

  .welcome-screen {
    min-height: calc(100dvh - 110px);
    padding-top: 2px;
  }

  .w-title {
    font-size: 40px;
  }

  .welcome-logo {
    width: min(260px, 78vw);
  }

  .home-panel {
    min-height: auto;
    padding: 22px 16px;
  }

  .home-title {
    font-size: 28px;
  }

  .home-copy {
    font-size: 14px;
    margin-bottom: 20px;
  }

  .home-search .input-wrapper {
    min-height: 58px;
  }

  .home-search .chat-input {
    min-height: 58px;
    padding: 12px 14px;
  }

  .home-search .send-btn {
    width: 42px;
    height: 42px;
    margin-right: 8px;
  }

  .popular-row {
    gap: 7px;
  }

  .term-chip {
    min-height: 32px;
    padding: 7px 11px;
    font-size: 12px;
  }

  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .feature-card {
    grid-template-columns: 34px 1fr;
    min-height: 82px;
    padding: 12px;
  }

  .feature-icon {
    width: 32px;
    height: 32px;
  }

  .about-page {
    padding: 4px 12px 32px;
  }

  .dashboard-page {
    padding: 4px 12px 32px;
  }

  .dashboard-head {
    align-items: flex-start;
    flex-direction: column;
    padding: 22px 16px;
  }

  .favorite-grid {
    grid-template-columns: 1fr;
  }

  .name-grid {
    grid-template-columns: 1fr;
  }

  .about-hero {
    grid-template-columns: 1fr;
    gap: 18px;
    padding: 22px 16px;
  }

  .about-logo {
    width: min(240px, 76vw);
  }

  .about-title {
    font-size: 28px;
  }

  .about-copy {
    font-size: 14px;
  }

  .about-book {
    justify-self: start;
  }

  .book-cover {
    width: min(150px, 48vw);
  }

  .about-grid {
    grid-template-columns: 1fr;
  }

  .smart-card {
    padding: 16px;
    max-width: 100%;
  }

  .message-row.bot {
    align-items: flex-start;
  }

  .avatar.bot {
    width: 32px;
    height: 32px;
    padding: 7px;
    margin-right: 8px;
  }

  .action-bar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .action-btn {
    justify-content: center;
    min-height: 40px;
    width: 100%;
    padding: 8px 10px;
    white-space: nowrap;
  }

  .action-btn:nth-child(1) {
    order: 1;
  }

  .action-btn:nth-child(2) {
    order: 2;
  }

  .action-btn:nth-child(3) {
    order: 3;
  }

  .action-btn:nth-child(4) {
    order: 4;
  }

  .input-area {
    padding: 0 12px calc(14px + var(--safe-bottom));
  }

  .input-container {
    max-width: 100%;
  }

  .context-img {
    height: 190px;
  }

  .modal-overlay {
    align-items: flex-end;
    padding: 10px;
  }

  .modal {
    width: 100%;
    max-height: calc(100dvh - 20px);
  }

  .settings-head {
    padding: 16px;
  }

  .settings-mark {
    width: 42px;
    height: 42px;
  }

  .settings-title {
    font-size: 20px;
  }

  .settings-body {
    padding: 14px;
  }

  .setting-card {
    grid-template-columns: 36px 1fr;
    gap: 12px;
    padding: 12px;
  }

  .setting-card-icon {
    width: 34px;
    height: 34px;
  }
}

@media (max-width: 480px) {
  .header-controls {
    width: auto;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .feature-card,
  .about-card {
    grid-template-columns: 38px 1fr;
  }

  .action-bar {
    grid-template-columns: 1fr;
  }

  .action-btn {
    justify-content: flex-start;
  }
}

@keyframes page-fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes drop-in {
  from { opacity: 0; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes logo-pop {
  0% { opacity: 0; transform: scale(0.94) translateY(8px); }
  70% { opacity: 1; transform: scale(1.015) translateY(0); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes panel-rise {
  from { opacity: 0; transform: translateY(18px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes text-rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes search-pop {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes card-pop {
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes avatar-pop {
  from { opacity: 0; transform: scale(0.75); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes dropdown-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modal-rise {
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes book-float-in {
  from { opacity: 0; transform: translateY(16px) rotate(-1.5deg) scale(0.96); }
  to { opacity: 1; transform: translateY(0) rotate(0) scale(1); }
}

@keyframes float-soft {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes media-reveal {
  from { opacity: 0; transform: scale(0.985); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes shimmer {
  100% { transform: translateX(100%); }
}

@keyframes soft-pan {
  from { transform: translate3d(0, 0, 0); opacity: 0.75; }
  to { transform: translate3d(12px, -8px, 0); opacity: 1; }
}

@keyframes button-ready {
  0% { transform: scale(0.96); }
  70% { transform: scale(1.04); }
  100% { transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .header,
  .welcome-screen,
  .welcome-logo,
  .home-panel,
  .home-panel::before,
  .home-kicker,
  .home-title,
  .home-copy,
  .home-search,
  .feature-card,
  .about-page,
  .about-hero,
  .about-logo,
  .about-title,
  .about-copy,
  .book-cover,
  .about-card,
  .avatar.bot,
  .smart-card,
  .context-img,
  .predictive-list,
  .modal-overlay,
  .modal,
  .setting-card,
  .mobile-menu,
  .send-btn.active {
    animation: none !important;
  }
}
`

/* ------------------------------- TYPES & UTILS ------------------------------- */

type Entry = {
  id?: string
  term: string
  definition: string
  synonyms?: string
  tags?: string
  pronunciation?: string
  pos?: string
  examples?: string
  [key: string]: any
}

type Message = {
  id: string
  role: 'user' | 'bot'
  content?: string
  entry?: Entry
  related?: Entry[]
  timestamp?: number
  loading?: boolean
}

type TTSProvider = 'elevenlabs' | 'browser'
type AuthMode = 'signin' | 'signup' | 'forgot' | 'update'
type ProfileView = 'home' | 'dashboard'

type FavoriteRow = {
  id: string
  user_id: string
  word_id: string | null
  term: string
  created_at: string
}

const DEFAULT_ELEVENLABS_VOICE_ID = 'VR5rq02kIGuHRg0JKxB6'
const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2'
const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128'
const LOCAL_ENTRIES_KEY = 'scmpedia-admin-entries-v1'
const THEME_KEY = 'scmpedia-theme-v1'

const uuid = () => Math.random().toString(36).substring(2, 9)
const escapeHtml = (input: string) =>
  input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const FadeImage = ({
  className,
  eager,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { eager?: boolean }) => {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      {...props}
      className={`${className || ''} fade-img ${loaded ? 'loaded' : ''}`.trim()}
      loading={eager ? 'eager' : props.loading || 'lazy'}
      decoding="async"
      onLoad={(event) => {
        setLoaded(true)
        props.onLoad?.(event)
      }}
    />
  )
}

const fallbackExplanation = (anchor: Entry) => {
  const concept = escapeHtml(anchor.definition || `${anchor.term} is a supply chain concept.`)
  const exampleText =
    anchor.examples ||
    `In practice, ${anchor.term} could involve ${anchor.definition?.replace(/\.$/, '') || 'real-world operations'}.`
  const example = escapeHtml(exampleText)
  return `<b>Concept:</b> ${concept}<br/><br/><b>Real-World Example:</b> ${example}`
}

const getEntryId = (entry: Entry) => String(entry.id || entry.term).trim()

const passwordStrength = (password: string) => {
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (!password) return { score: 0, label: 'Enter a password', tone: 'empty' }
  if (score <= 2) return { score, label: 'Weak', tone: 'weak' }
  if (score <= 4) return { score, label: 'Good', tone: 'good' }
  return { score, label: 'Strong', tone: 'strong' }
}

const passwordChecks = (password: string) => [
  { label: '8+ characters', met: password.length >= 8 },
  { label: 'Upper & lower', met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
  { label: 'Number', met: /\d/.test(password) },
  { label: 'Symbol', met: /[^A-Za-z0-9]/.test(password) },
]

/* ------------------------------- LOGIC HOOKS ------------------------------- */

// 1. DATA HOOK
function useData() {
  const [data, setData] = useState<Entry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading')
  const [serverBacked, setServerBacked] = useState(false)
  const papaRef = useRef<any>(null)
  const fuseLibRef = useRef<any>(null)
  const fuseRef = useRef<any>(null)

  const applyEntries = useCallback((entries: Entry[]) => {
      if (entries.length) {
        setData(entries)
        if (fuseLibRef.current) {
          fuseRef.current = new fuseLibRef.current(entries, {
            keys: [
              { name: 'term', weight: 0.7 },
              { name: 'definition', weight: 0.3 },
              { name: 'tags', weight: 0.1 },
            ],
            threshold: 0.3,
            includeScore: true,
          })
        }
        setStatus('ready')
      } else {
        setStatus('empty')
      }
  }, [])

  const normalizeEntry = (r: any): Entry => ({
    id: r.id ? String(r.id) : undefined,
    term: String(r.term || r.Term || '').trim(),
    definition: String(r.definition || r.Definition || '').trim(),
    synonyms: String(r.synonyms || r.Synonyms || ''),
    tags: String(r.tags || r.Tags || ''),
    pos: String(r.pos || r.Pos || ''),
    pronunciation: String(r.pronunciation || r.Pronunciation || ''),
    examples: String(r.examples || r.Examples || ''),
  })

  const readLocalEntries = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_ENTRIES_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.map(normalizeEntry).filter((e: Entry) => e.term && e.definition)
    } catch {
      return []
    }
  }, [])

  const processCSV = useCallback((csv: string) => {
    if (!papaRef.current) return
    try {
      const localEntries = readLocalEntries()
      if (localEntries.length) {
        applyEntries(localEntries)
        return
      }

      const res = papaRef.current.parse(csv, { header: true, skipEmptyLines: true })
      const entries = res.data.map(normalizeEntry).filter((e: Entry) => e.term && e.definition)
      applyEntries(entries)
    } catch {
      setStatus('error')
    }
  }, [applyEntries, readLocalEntries])

  const searchServerWords = useCallback(async (query: string, limit = 8) => {
    const q = query.trim()
    if (!q) return []
    const res = await fetch(`/api/words?q=${encodeURIComponent(q)}&limit=${limit}`)
    if (!res.ok) throw new Error('Word search failed')
    const body = await res.json()
    return ((body?.words || []) as Entry[]).map(normalizeEntry).filter((e: Entry) => e.term && e.definition)
  }, [])

  const loadServerWords = useCallback(async () => {
    try {
      const entries = await searchServerWords('supply', 12)
      setServerBacked(true)
      applyEntries(entries)
      return true
    } catch (error) {
      console.warn('Server words fallback:', error)
      setServerBacked(false)
      return false
    }
  }, [applyEntries, searchServerWords])

  useEffect(() => {
    const load = (src: string, g: string) =>
      new Promise((res) => {
        if ((window as any)[g]) return res((window as any)[g])
        const s = document.createElement('script')
        s.src = src
        s.onload = () => res((window as any)[g])
        document.head.appendChild(s)
      })

    const loadCsv = async () => {
      const loadedFromServer = await loadServerWords()
      if (loadedFromServer) return

      const sources = ['/scmpedia_full_UPDATED.csv', '/scmpedia_full.csv']
      for (const src of sources) {
        try {
          const cacheBuster = `${src}?v=${Date.now()}`
          const r = await fetch(cacheBuster, { cache: 'no-store' })
          if (!r.ok) continue
          const text = await r.text()
          if (!text) continue
          processCSV(text)
          return
        } catch {
          // try the next source
        }
      }
      setStatus('empty')
    }

    Promise.all([
      load('https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.basic.min.js', 'Fuse'),
      load('https://cdn.jsdelivr.net/npm/papaparse@5.3.0/papaparse.min.js', 'Papa'),
    ]).then(([F, P]) => {
      fuseLibRef.current = F
      papaRef.current = P
      loadCsv()
    })
  }, [loadServerWords, processCSV])

  useEffect(() => {
    const syncLocalEntries = (event?: StorageEvent) => {
      if (event && event.key !== LOCAL_ENTRIES_KEY) return
      const localEntries = readLocalEntries()
      if (localEntries.length) applyEntries(localEntries)
    }
    window.addEventListener('storage', syncLocalEntries)
    return () => window.removeEventListener('storage', syncLocalEntries)
  }, [applyEntries, readLocalEntries])

  return { data, status, processCSV, fuseRef, serverBacked, searchServerWords }
}

// 2. TTS HOOK
function useTTS() {
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [preparingId, setPreparingId] = useState<string | null>(null)
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [provider, setProvider] = useState<TTSProvider>('elevenlabs')
  const synth = useRef(window.speechSynthesis)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const pickBestVoice = (list: SpeechSynthesisVoice[]) => {
    const english = list.filter((v) => v.lang.toLowerCase().startsWith('en'))
    const pool = english.length ? english : list
    const patterns = [
      /google us english/i,
      /google uk english female/i,
      /google uk english/i,
      /microsoft (aria|jenny|guy|sara|zira|david)/i,
      /natural/i,
      /neural/i,
      /samantha/i,
      /alex/i,
      /karen/i,
      /moira/i,
      /google/i,
    ]
    for (const pattern of patterns) {
      const match = pool.find((v) => pattern.test(v.name))
      if (match) return match
    }
    return pool[0]
  }

  useEffect(() => {
    const load = () => {
      const v = synth.current.getVoices().sort((a, b) => a.name.localeCompare(b.name))
      setVoices(v)
      const hasSelected = v.some((voice) => voice.voiceURI === selectedVoiceURI)
      if (!selectedVoiceURI || !hasSelected) {
        const best = pickBestVoice(v)
        if (best) setSelectedVoiceURI(best.voiceURI)
      }
    }
    load()
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = load
    }
  }, [selectedVoiceURI])

  const stopAudio = () => {
    abortRef.current?.abort()
    abortRef.current = null
    const audio = audioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.pause()
      audio.currentTime = 0
      audio.src = ''
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setSpeakingId(null)
    setPreparingId(null)
  }

  const speakBrowser = (id: string, text: string, force = false) => {
    if (speakingId === id) {
      synth.current.cancel()
      setSpeakingId(null)
      return
    }
    if (!force) stopAudio()
    synth.current.cancel()
    setSpeakingId(id)
    setPreparingId(null)

    const u = new SpeechSynthesisUtterance(text)
    const voice = voices.find((v) => v.voiceURI === selectedVoiceURI)
    if (voice) {
      u.voice = voice
      u.lang = voice.lang
    }

    u.rate = 0.95
    u.pitch = 1.0
    u.volume = 1.0
    u.onend = () => setSpeakingId(null)
    synth.current.speak(u)
  }

  const speakElevenLabs = async (id: string, text: string) => {
    if (speakingId === id || preparingId === id) {
      stopAudio()
      return
    }

    stopAudio()
    synth.current.cancel()
    setPreparingId(id)
    setSpeakingId(id)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId: DEFAULT_ELEVENLABS_VOICE_ID,
          modelId: ELEVENLABS_MODEL_ID,
          outputFormat: ELEVENLABS_OUTPUT_FORMAT,
        }),
        signal: controller.signal,
      })

      const contentType = response.headers.get('content-type') || ''
      if (!response.ok) {
        let message = `TTS request failed (${response.status})`
        if (contentType.includes('application/json')) {
          const data = await response.json().catch(() => ({}))
          if (data?.error) message = String(data.error)
        } else {
          const body = await response.text().catch(() => '')
          if (body) message = body.slice(0, 200)
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url
      const audio = audioRef.current ?? new Audio()
      audioRef.current = audio
      audio.src = url
      audio.onended = stopAudio
      audio.onerror = stopAudio
      setPreparingId(null)
      await audio.play()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setPreparingId(null)
      setSpeakingId(null)
      throw err
    }
  }

  const speak = (id: string, text: string) => {
    if (!text.trim()) return
    if (provider === 'elevenlabs') {
      void speakElevenLabs(id, text).catch((err) => {
        const message = err instanceof Error ? err.message : String(err)
        if (message.toLowerCase().includes('missing elevenlabs api key')) {
          setProvider('browser')
        }
        console.error('ElevenLabs TTS error', err)
        speakBrowser(id, text, true)
      })
      return
    }
    speakBrowser(id, text)
  }

  return { speak, speakingId, preparingId, voices, selectedVoiceURI, setSelectedVoiceURI, provider, setProvider }
}

// 3. AI GENERATOR
function useAI() {
  const [status] = useState<'loading' | 'ready' | 'error'>('ready')

  const formatToHtml = (raw: string, anchor: Entry) => {
    let text = raw.trim()
    if (!text) return fallbackExplanation(anchor)
    const hasHtml = /<\/?[a-z][\s\S]*>/i.test(text)
    if (!hasHtml) {
      text = escapeHtml(text).replace(/\r?\n+/g, '\n')
    }
    text = text
      .replace(/Concept Overview:/i, '<b>Concept Overview:</b>')
      .replace(/Why It Matters:/i, '<b>Why It Matters:</b>')
      .replace(/Concept:/i, '<b>Concept:</b>')
      .replace(/Real-World Example:/i, '<b>Real-World Example:</b>')
    if (!text.includes('<b>Concept:</b>') && !text.includes('<b>Concept Overview:</b>')) {
      text = `<b>Concept Overview:</b> ${text}`
    }
    if (!text.includes('<b>Real-World Example:</b>')) {
      text += `<br/><br/><b>Real-World Example:</b> ${escapeHtml(anchor.examples || 'A practical example can be observed in day-to-day supply chain operations.')}`
    } else {
      text = text.replace(/\n/g, '<br/>')
    }
    return text
  }

  const scmpediaGenerate = async (anchor: Entry, isRegen?: boolean) => {
    const instruction = isRegen
      ? 'Re-explain the concept with a fresh practical angle while staying faithful to the supplied definition.'
      : 'Explain the concept with precision, practical context, and a real-world supply chain example.'

    const prompt = `Term: "${anchor.term}"
Dictionary definition: "${anchor.definition}"
Tags: "${anchor.tags || 'supply chain management'}"
Existing example: "${anchor.examples || ''}"

Task: ${instruction}

Quality requirements:
- Explain like a senior supply chain educator advising professionals and students.
- Preserve the meaning of the supplied dictionary definition.
- Use plain, actionable language without oversimplifying the term.
- Make the example realistic for logistics, procurement, operations, manufacturing, sourcing, trade, or policy.
- If useful, mention why the term matters for performance, cost, reliability, service, risk, or growth.

Output format:
Return strictly HTML. No markdown.
Use exactly these sections:
<b>Concept Overview:</b> ...
<br/><br/><b>Why It Matters:</b> ...
<br/><br/><b>Real-World Example:</b> ...`

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(JSON.stringify({ status: response.status, body: errText || 'AI error' }))
    }

    const data = await response.json()
    const text = data?.text || ''
    if (!text) throw new Error('scmpedia AI returned empty response')
    return text
  }

  const generate = async (anchor: Entry, isRegen?: boolean) => {
    try {
      const text = await scmpediaGenerate(anchor, isRegen)
      return formatToHtml(text, anchor)
    } catch (e) {
      console.error('scmpedia AI error', e)
    }

    return `<i>Could not reach scmpedia AI. Here is a dictionary-based summary:</i><br/><br/><b>Concept Overview:</b> ${anchor.term} refers to ${anchor.definition}.<br/><br/><b>Why It Matters:</b> This term can affect planning, cost, reliability, service delivery, risk, or supply chain performance.<br/><br/><b>Real-World Example:</b> In practice, teams may use this concept when managing sourcing, inventory, logistics, operations, supplier performance, or customer fulfilment.`
  }

  return { status, generate }
}

function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return { session, user, loading, passwordRecovery, setPasswordRecovery, signOut }
}

function useFavorites(user: User | null, allData: Entry[]) {
  const [favorites, setFavorites] = useState<FavoriteRow[]>([])
  const [remoteEntries, setRemoteEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [savingTerm, setSavingTerm] = useState<string | null>(null)

  const loadFavorites = useCallback(async () => {
    if (!supabase || !user) {
      setFavorites([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('favorites')
      .select('id,user_id,word_id,term,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Favorites load error', error)
      setFavorites([])
    } else {
      setFavorites(data || [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  const favoriteTerms = useMemo(
    () => new Set(favorites.map((favorite) => favorite.term.toLowerCase())),
    [favorites]
  )

  useEffect(() => {
    const terms = favorites.map((favorite) => favorite.term).filter(Boolean)
    if (!terms.length) {
      setRemoteEntries([])
      return
    }
    const params = new URLSearchParams({ terms: terms.join(','), limit: String(Math.min(terms.length, 25)) })
    void fetch(`/api/words?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { words: [] }))
      .then((body) => setRemoteEntries(Array.isArray(body?.words) ? body.words : []))
      .catch(() => setRemoteEntries([]))
  }, [favorites])

  const favoriteEntries = useMemo(() => {
    const byTerm = new Map([...allData, ...remoteEntries].map((entry) => [entry.term.toLowerCase(), entry]))
    return favorites.map((favorite) => byTerm.get(favorite.term.toLowerCase())).filter(Boolean) as Entry[]
  }, [allData, favorites, remoteEntries])

  const toggleFavorite = async (entry: Entry) => {
    if (!supabase || !user) return { ok: false, needsAuth: true }
    const term = entry.term.trim()
    if (!term) return { ok: false, needsAuth: false }
    setSavingTerm(term)
    try {
      const existing = favorites.find((favorite) => favorite.term.toLowerCase() === term.toLowerCase())
      if (existing) {
        const { error } = await supabase.from('favorites').delete().eq('id', existing.id).eq('user_id', user.id)
        if (error) throw error
        setFavorites((current) => current.filter((favorite) => favorite.id !== existing.id))
        return { ok: true, needsAuth: false }
      }

      const { data, error } = await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          word_id: entry.id || null,
          term,
        })
        .select('id,user_id,word_id,term,created_at')
        .single()
      if (error) throw error
      if (data) setFavorites((current) => [data, ...current])
      return { ok: true, needsAuth: false }
    } catch (error) {
      console.error('Favorite save error', error)
      return { ok: false, needsAuth: false }
    } finally {
      setSavingTerm(null)
    }
  }

  return { favorites, favoriteEntries, favoriteTerms, loading, savingTerm, toggleFavorite, reload: loadFavorites }
}

/* ------------------------------- UI COMPONENTS ------------------------------- */

const SettingsDialog = ({
  open,
  onClose,
  tts,
  autoReadAi,
  setAutoReadAi,
  darkMode,
  setDarkMode,
}: {
  open: boolean
  onClose: () => void
  tts: any
  autoReadAi: boolean
  setAutoReadAi: (v: boolean) => void
  darkMode: boolean
  setDarkMode: (v: boolean) => void
}) => {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <div className="settings-mark">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7A2 2 0 1 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 20.9 10h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </div>
          <div>
            <h2 className="settings-title">Settings</h2>
            <p className="settings-subtitle">Tune voice playback and AI reading behavior.</p>
          </div>
        </div>

        <div className="settings-body">
          <div className="setting-card">
            <div className="setting-card-icon">
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 9v6h4l5 5V4L8 9H4Z" />
                <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" />
              </svg>
            </div>
            <div className="setting-card-main">
              <label className="modal-label">Voice Provider</label>
              <select
                className="modal-select"
                value={tts.provider}
                onChange={(e) => tts.setProvider(e.target.value as TTSProvider)}
              >
                <option value="browser">Google / browser voices</option>
                <option value="elevenlabs">ElevenLabs voice</option>
              </select>
              <div className="api-hint">Google browser voice is the default. ElevenLabs is optional if you have quota available.</div>
            </div>
          </div>

          {tts.provider === 'browser' && (
            <div className="setting-card">
              <div className="setting-card-icon">
                <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 18.5a6.5 6.5 0 0 0 6.5-6.5V7a6.5 6.5 0 0 0-13 0v5a6.5 6.5 0 0 0 6.5 6.5Z" />
                  <path d="M9 21h6M12 18.5V21" />
                </svg>
              </div>
              <div className="setting-card-main">
                <label className="modal-label">Browser Voice</label>
                <select
                  className="modal-select"
                  value={tts.selectedVoiceURI}
                  onChange={(e) => tts.setSelectedVoiceURI(e.target.value)}
                >
                  {tts.voices
                    .filter((v: any) => v.lang.startsWith('en'))
                    .map((v: any) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                </select>
                <div className="api-hint">Fallback for devices or deployments without an ElevenLabs API key.</div>
              </div>
            </div>
          )}

          <div className="setting-card">
            <div className="setting-card-icon">
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4V4Z" />
                <path d="M9 8h5M9 12h6" />
              </svg>
            </div>
            <div className="setting-card-main">
              <div className="toggle-row">
                <div>
                  <label className="modal-label">Auto-read insights</label>
                  <div className="toggle-copy">Read AI explanations aloud automatically when they finish loading.</div>
                </div>
                <label className="toggle-switch" aria-label="Auto-read AI insights">
                  <input type="checkbox" checked={autoReadAi} onChange={(e) => setAutoReadAi(e.target.checked)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <div className="setting-card">
            <div className="setting-card-icon">
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3a6 6 0 0 0 9 7.5A9 9 0 1 1 12 3Z" />
              </svg>
            </div>
            <div className="setting-card-main">
              <div className="toggle-row">
                <div>
                  <label className="modal-label">Dark mode</label>
                  <div className="toggle-copy">Use a darker interface for lower-light reading.</div>
                </div>
                <label className="toggle-switch" aria-label="Dark mode">
                  <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="modal-btn primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const AuthDialog = ({
  open,
  mode,
  setMode,
  onClose,
  darkMode,
}: {
  open: boolean
  mode: AuthMode
  setMode: (mode: AuthMode) => void
  onClose: () => void
  darkMode: boolean
}) => {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const strength = passwordStrength(password)

  useEffect(() => {
    if (!open) return
    setError('')
    setStatusMessage('')
    setPassword('')
    setShowPassword(false)
  }, [mode, open])

  if (!open) return null

  const title =
    mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'update' ? 'Update password' : 'Reset password'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setStatusMessage('')
    if (!supabase) {
      setError('Supabase is not configured for this deployment.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        onClose()
      } else if (mode === 'signup') {
        if (strength.score < 3) {
          setError('Use a stronger password before creating your account.')
          return
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              full_name: `${firstName} ${lastName}`.trim(),
            },
          },
        })
        if (signUpError) throw signUpError
        setStatusMessage('Account created. Check your email if confirmation is enabled.')
      } else if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (resetError) throw resetError
        setStatusMessage('Password reset link sent if this email exists.')
      } else {
        if (strength.score < 3) {
          setError('Use a stronger password before updating your account.')
          return
        }
        const { error: updateError } = await supabase.auth.updateUser({ password })
        if (updateError) throw updateError
        setStatusMessage('Password updated.')
        setPassword('')
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="auth-modal" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <div className="auth-head">
          <div className="auth-brand-row">
            <FadeImage className="auth-logo" src={darkMode ? '/white-logo.png' : '/logo.png'} alt="scmpedia" eager />
            <h2>{title}</h2>
            <p>{mode === 'forgot' ? 'Enter your account email.' : mode === 'update' ? 'Choose a new password.' : 'Save favorite terms to your personal dashboard.'}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="auth-body">
          {mode === 'signup' && (
            <div className="name-grid">
              <label className="auth-field">
                <span>First name</span>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required />
              </label>
              <label className="auth-field">
                <span>Last name</span>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required />
              </label>
            </div>
          )}

          {mode !== 'update' && (
            <label className="auth-field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
          )}

          {mode !== 'forgot' && (
            <label className="auth-field">
              <span>Password</span>
              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                />
                <button type="button" onClick={() => setShowPassword((show) => !show)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.6 4 10 8a12.7 12.7 0 0 1-2.2 3.7M6.6 6.6A12.2 12.2 0 0 0 2 12c1.4 4 5 8 10 8 1.7 0 3.2-.5 4.5-1.2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {(mode === 'signup' || mode === 'update') && (
                <div className={`strength-panel ${strength.tone}`}>
                  <div className="strength-top">
                    <span>Password strength</span>
                    <strong>{strength.label}</strong>
                  </div>
                  <div className="strength-bars" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <span key={level} className={strength.score >= level ? 'filled' : ''} />
                    ))}
                  </div>
                  <div className="strength-checks">
                    {passwordChecks(password).map((check) => (
                      <span key={check.label} className={check.met ? 'met' : ''}>
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                        {check.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </label>
          )}

          {error && <div className="auth-alert error">{error}</div>}
          {statusMessage && <div className="auth-alert success">{statusMessage}</div>}

          <button className="auth-submit" disabled={loading || !hasSupabaseConfig}>
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Sign up' : mode === 'update' ? 'Update password' : 'Send reset link'}
          </button>

          <div className="auth-switch">
            {mode !== 'signin' && mode !== 'update' && <button type="button" onClick={() => setMode('signin')}>Sign in</button>}
            {mode !== 'signup' && mode !== 'update' && <button type="button" onClick={() => setMode('signup')}>Create account</button>}
            {mode !== 'forgot' && mode !== 'update' && <button type="button" onClick={() => setMode('forgot')}>Forgot password?</button>}
          </div>
        </div>
      </form>
    </div>
  )
}

const DashboardPage = ({
  user,
  entries,
  loading,
  onBack,
  onOpenTerm,
}: {
  user: User | null
  entries: Entry[]
  loading: boolean
  onBack: () => void
  onOpenTerm: (entry: Entry) => void
}) => {
  const meta = user?.user_metadata || {}
  const displayName = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || user?.email || 'Your profile'

  return (
    <div className="dashboard-page">
      <section className="dashboard-head">
        <div>
          <div className="home-kicker">Personal dashboard</div>
          <h1>{displayName}</h1>
          <p>{user?.email}</p>
        </div>
        <button className="about-back" onClick={onBack}>Back to search</button>
      </section>

      <h2 className="about-section-title">Favorite Words</h2>
      {loading ? (
        <div className="dashboard-empty">Loading favorites...</div>
      ) : entries.length ? (
        <section className="favorite-grid">
          {entries.map((entry) => (
            <button className="favorite-card" key={getEntryId(entry)} onClick={() => onOpenTerm(entry)}>
              <strong>{entry.term}</strong>
              <span>{entry.definition}</span>
            </button>
          ))}
        </section>
      ) : (
        <div className="dashboard-empty">No favorites saved yet.</div>
      )}
    </div>
  )
}

const ThinkingIndicator = () => {
  const [thought, setThought] = useState('Initializing...')
  const thoughts = useMemo(
    () => ['Scanning database...', 'Connecting concepts...', 'Analyzing context...', 'Drafting insight...', 'Formatting response...'],
    []
  )

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      const nextThought = thoughts[i % thoughts.length] ?? 'Thinking...'
      setThought(nextThought)
      i += 1
    }, 1200)
    return () => clearInterval(interval)
  }, [thoughts])

  return (
    <div className="thinking-box">
      <div className="thinking-header">
        <div className="pulse-dot"></div>
        AI is thinking...
      </div>
      <div className="thought-process">
        <span className="fade-text">» {thought}</span>
      </div>
    </div>
  )
}

const ChatThinking = () => (
  <div className="chat-thinking" aria-live="polite">
    <span>Thinking</span>
    <i />
    <i />
    <i />
  </div>
)

const WordSuggestions = ({ entries, onPick }: { entries: Entry[]; onPick: (entry: Entry) => void }) => (
  <div className="word-suggestions">
    <div className="word-suggestions-title">Did you mean one of these?</div>
    <div className="word-suggestion-list">
      {entries.map((entry) => (
        <button key={getEntryId(entry)} onClick={() => onPick(entry)}>
          <strong>{entry.term}</strong>
          <span>{entry.definition}</span>
        </button>
      ))}
    </div>
  </div>
)

const SmartCard = ({
  entry,
  allData,
  tts,
  ai,
  autoReadAi,
  user,
  isFavorite,
  savingFavorite,
  onAuthRequired,
  onToggleFavorite,
}: {
  entry: Entry
  allData: Entry[]
  tts: any
  ai: { status: 'loading' | 'ready' | 'error'; generate: (e: Entry, regen?: boolean) => Promise<string> }
  autoReadAi: boolean
  user: User | null
  isFavorite: boolean
  savingFavorite: boolean
  onAuthRequired: () => void
  onToggleFavorite: (entry: Entry) => Promise<void>
}) => {
  const [expanded, setExpanded] = useState<'details' | 'ai' | null>(null)
  const [aiText, setAiText] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAltUrl, setImageAltUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageErrorMessage, setImageErrorMessage] = useState('')
  const [copied, setCopied] = useState(false)

  const fetchAi = async (regen = false) => {
    setLoadingAi(true)
    try {
      const txt = await ai.generate(entry, regen)
      const next = txt || ''
      setAiText(next)
    } catch (e) {
      console.error('AI generate error', e)
      setAiText(fallbackExplanation(entry))
    } finally {
      setLoadingAi(false)
    }
  }

  const fetchImage = async () => {
    if (imageLoading || imageUrl) return
    const query = entry.term?.trim()
    if (!query) return

    setImageLoading(true)
    setImageError(false)
    setImageErrorMessage('')
    try {
      const res = await fetch(`/api/image?q=${encodeURIComponent(query)}`)
      const bodyText = await res.text()
      let data: any = {}
      if (bodyText) {
        try {
          data = JSON.parse(bodyText)
        } catch {
          data = {}
        }
      }
      if (!res.ok) {
        const serverError = typeof data?.error === 'string' ? data.error : bodyText
        throw new Error(serverError || `Image lookup failed (${res.status})`)
      }
      const next = typeof data?.url === 'string' ? data.url : ''
      const thumb = typeof data?.thumbnail === 'string' ? data.thumbnail : ''
      if (!next && !thumb) throw new Error('No image found')
      setImageUrl(next || thumb)
      setImageAltUrl(thumb || next)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('AI image error', e)
      setImageErrorMessage(message)
      setImageError(true)
    } finally {
      setImageLoading(false)
    }
  }

  const handleImageError = () => {
    if (imageAltUrl && imageUrl !== imageAltUrl) {
      setImageUrl(imageAltUrl)
      return
    }
    setImageError(true)
  }

  const handleAi = async () => {
    if (expanded === 'ai') {
      setExpanded(null)
      return
    }
    setExpanded('ai')
    if (!aiText) fetchAi()
    fetchImage()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${entry.term}: ${entry.definition}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch (error) {
      console.error('Copy failed', error)
    }
  }

  const isSpeakingDef = tts.speakingId === `def-${entry.term}`
  const isSpeakingAi = tts.speakingId === `ai-${entry.term}`
  const isPreparingDef = tts.preparingId === `def-${entry.term}`
  const isPreparingAi = tts.preparingId === `ai-${entry.term}`
  const handleFavorite = () => {
    if (!user) {
      onAuthRequired()
      return
    }
    void onToggleFavorite(entry)
  }

  return (
    <div className="smart-card">
      <div className="term-header">
        <h2 className="term-title">{entry.term}</h2>
        {entry.pos && <span className="term-pos">{entry.pos}</span>}
        {entry.pronunciation && <span className="term-pron">/{entry.pronunciation}/</span>}
      </div>
      <div className="term-def">{entry.definition}</div>

      <div className="action-bar">
        <button
          className={`action-btn ${isSpeakingDef || isPreparingDef ? 'active' : ''}`}
          onClick={() => tts.speak(`def-${entry.term}`, `${entry.term}. ${entry.definition}`)}
        >
          <svg className="action-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
          {isPreparingDef ? 'Preparing' : isSpeakingDef ? 'Reading' : 'Read'}
          {isPreparingDef ? (
            <div className="voice-meter" aria-label="Preparing audio">
              {[1, 2, 3].map((i) => (
                <span key={i} className="loading-dot" />
              ))}
            </div>
          ) : (
            <div className="voice-meter">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bar"
                  style={{ height: isSpeakingDef ? '100%' : '4px', animationDuration: `${0.4 + i * 0.1}s` }}
                />
              ))}
            </div>
          )}
        </button>

        <button className={`action-btn ${expanded === 'ai' ? 'active' : ''}`} onClick={handleAi}>
          <svg className="action-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2zm0-4H7V7h10v2z" />
          </svg>
          {ai.status === 'loading' ? 'Loading AI...' : 'Explain with AI'}
        </button>

        <button
          className={`action-btn ${isFavorite ? 'active' : ''}`}
          onClick={handleFavorite}
          disabled={savingFavorite}
        >
          <svg className="action-icon" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7-4.4-9.2-8.5C1 9 2.7 5 6.5 5c2 0 3.5 1.1 4.3 2.4C11.7 6.1 13.2 5 15.2 5 19 5 21 9 19.2 12.5 17 16.6 12 21 12 21Z" />
          </svg>
          {savingFavorite ? 'Saving' : isFavorite ? 'Saved' : 'Favorite'}
        </button>

        <button
          className={`action-btn ${expanded === 'details' ? 'active' : ''}`}
          onClick={() => setExpanded(expanded === 'details' ? null : 'details')}
        >
          <svg className="action-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
          Details
        </button>

        <div className="copy-wrap">
          <button className={`action-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} aria-live="polite">
            <svg className="action-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
            </svg>
            {copied ? 'Copied' : 'Copy'}
          </button>
          {copied && <div className="copy-toast">Copied</div>}
        </div>
      </div>

      {expanded === 'details' && (
        <div className="details-panel">
          {entry.synonyms && (
            <div className="detail-row">
              <div className="detail-label">Synonyms</div>
              <div className="detail-val">{entry.synonyms}</div>
            </div>
          )}
          {entry.tags && (
            <div className="detail-row">
              <div className="detail-label">Tags</div>
              <div className="detail-val">{entry.tags}</div>
            </div>
          )}
          {entry.examples && (
            <div className="detail-row">
              <div className="detail-label">Example</div>
              <div className="detail-val">{entry.examples}</div>
            </div>
          )}
          {!entry.synonyms && !entry.tags && !entry.examples && (
            <div style={{ color: '#888', fontStyle: 'italic' }}>No additional details available.</div>
          )}
        </div>
      )}

      {expanded === 'ai' && (
        <div className="details-panel ai-box">
          <div className="ai-header">
            <div className="ai-badge">scmpedia</div>
            {aiText && !loadingAi && (
              <button
                className="mini-read-btn"
                onClick={() => tts.speak(`ai-${entry.term}`, aiText.replace(/<[^>]*>/g, ''))}
              >
                {isPreparingAi ? 'Preparing' : isSpeakingAi ? 'Stop Reading' : 'Read Insight'}
                {isPreparingAi && (
                  <span className="voice-meter" aria-label="Preparing audio">
                    {[1, 2, 3].map((i) => (
                      <span key={i} className="loading-dot" />
                    ))}
                  </span>
                )}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
              </button>
            )}
          </div>

          {imageUrl && !imageError ? (
            <FadeImage
              src={imageUrl}
              className="context-img"
              alt={entry.term}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={handleImageError}
            />
          ) : (
            <div className="context-img placeholder">
              {imageLoading
                ? 'Loading image...'
                : imageErrorMessage.toLowerCase().includes('google cse')
                ? 'Image unavailable (set Google CSE keys)'
                : 'Image unavailable'}
            </div>
          )}

          {loadingAi ? (
            <ThinkingIndicator />
          ) : (
            <>
              <div
                style={{ whiteSpace: 'pre-wrap', marginTop: '12px' }}
                dangerouslySetInnerHTML={{ __html: aiText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
              />

              <a
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${entry.term} supply chain`)}`}
                target="_blank"
                rel="noreferrer"
                className="google-link-btn"
              >
                View Google Images
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>

              <button className="regen-btn" onClick={() => fetchAi(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
                Try Different Explanation
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const Icon = ({ type }: { type: 'world' | 'book' | 'industry' | 'growth' | 'leader' | 'academic' | 'supply' | 'policy' }) => {
  const common = { width: 23, height: 23, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (type === 'world') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20" />
      </svg>
    )
  }
  if (type === 'book') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    )
  }
  if (type === 'industry') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M3 21h18M5 21V9l5 3V9l5 3V5h4v16" />
        <path d="M8 17h1M12 17h1M16 17h1" />
      </svg>
    )
  }
  if (type === 'growth') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M4 19V5M4 19h16" />
        <path d="m7 15 4-4 3 3 5-7" />
      </svg>
    )
  }
  if (type === 'leader') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
        <circle cx="12" cy="7" r="4" />
        <path d="M18 8h3M19.5 6.5v3" />
      </svg>
    )
  }
  if (type === 'academic') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="m3 8 9-5 9 5-9 5-9-5Z" />
        <path d="M7 10.5V16c3 2 7 2 10 0v-5.5" />
      </svg>
    )
  }
  if (type === 'supply') {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M3 7h11v10H3zM14 11h4l3 3v3h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M12 3 4 7v6c0 5 3.4 7.6 8 9 4.6-1.4 8-4 8-9V7l-8-4Z" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  )
}

const AboutPage = ({ onBack }: { onBack: () => void }) => {
  const matters = [
    ['Built From A Definitive Compendium', 'Grounded in Prof. Douglas Boateng’s Executive Insight Series: Compendium of Supply Chain Management Terms.', 'book' as const],
    ['4,000+ Terms And Benchmarks', 'Definitions, acronyms, abbreviations, performance metrics, and global supply chain benchmarks in one reference.', 'growth' as const],
    ['Global And Africa-Relevant', 'International perspectives shaped by cross-border trade, industrialization, and practical realities across markets.', 'world' as const],
    ['Professional Decision Support', 'Clear language for logistics, procurement, operations, manufacturing, and supply chain strategy.', 'industry' as const],
  ]
  const audiences = [
    ['Business Leaders & Consultants', 'Use precise terminology to improve strategic discussions, operating models, and supply chain decisions.', 'leader' as const],
    ['Students & Academicians', 'Build mastery of supply chain language for study, research, teaching, and professional development.', 'academic' as const],
    ['Supply Chain Practitioners', 'Stay fluent in essential terms across logistics, procurement, sourcing, operations, and manufacturing.', 'supply' as const],
    ['Policy Makers & Development Practitioners', 'Use shared language to support better industrial, trade, and regional supply chain policy.', 'policy' as const],
  ]

  return (
    <div className="about-page">
      <section className="about-hero">
        <div className="about-hero-content">
          <FadeImage className="about-logo" src="/white-logo.png" alt="scmpedia" eager />
          <h1 className="about-title">
            The intelligence behind <span>scmpedia</span>
          </h1>
          <p className="about-copy">
            scmpedia is powered by the Executive Insight Series: Compendium of Supply Chain Management Terms by Prof.
            Douglas Boateng, Africa’s first Professor Extraordinaire in Supply Chain Management. The 927-page reference brings
            together more than 4,000 terms, acronyms, abbreviations, performance metrics, and global benchmarks for
            professionals and students who need clarity, precision, and practical insight.
          </p>
        </div>
        <div className="about-book">
          <FadeImage
            className="book-cover"
            src="/book.jpg"
            alt="Executive Insight Series: Compendium of Supply Chain Management Terms book cover"
            eager
          />
          <a
            className="amazon-btn"
            href="https://www.amazon.com/Executive-Insight-Compendium-Supply-Management-ebook/dp/B0FQVFQVFM?ref_=ast_author_dp"
            target="_blank"
            rel="noreferrer"
          >
            <svg viewBox="0 0 76 24" width="54" height="18" aria-hidden="true">
              <text x="0" y="15" fill="currentColor" fontSize="14" fontWeight="800" fontFamily="Arial, sans-serif">
                amazon
              </text>
              <path
                d="M10 20c12 4 28 3 42-5M48 15l7-1-4 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Purchase on Amazon
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </a>
        </div>
      </section>

      <h2 className="about-section-title">Why This Reference Matters</h2>
      <section className="about-grid">
        {matters.map(([title, text, icon]) => (
          <article className="about-card" key={title}>
            <div className="about-card-icon">
              <Icon type={icon} />
            </div>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </section>

      <h2 className="about-section-title">Who Is It For?</h2>
      <section className="about-grid">
        {audiences.map(([title, text, icon]) => (
          <article className="about-card" key={title}>
            <div className="about-card-icon">
              <Icon type={icon} />
            </div>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="about-actions">
        <button className="about-back" onClick={onBack}>
          Back to search
        </button>
      </div>
    </div>
  )
}

/* ------------------------------- MAIN APP ------------------------------- */

export default function App() {
  const { data, status, processCSV, fuseRef, serverBacked, searchServerWords } = useData()
  const tts = useTTS()
  const ai = useAI()
  const auth = useAuth()
  const favorites = useFavorites(auth.user, data)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Entry[]>([])
  const [selectedSug, setSelectedSug] = useState(-1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [profileView, setProfileView] = useState<ProfileView>('home')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [autoReadAi, setAutoReadAi] = useState(true)
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored) return stored === 'dark'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRequestRef = useRef(0)

  const stopWords = useMemo(
    () => /^(what is|what's|define|explain|describe|meaning of|tell me about|search for|look up|do you know)\s+/i,
    []
  )

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    if (!auth.user && profileView === 'dashboard') {
      setProfileView('home')
    }
  }, [auth.user, profileView])

  useEffect(() => {
    if (!auth.passwordRecovery) return
    setAuthMode('update')
    setAuthOpen(true)
    auth.setPasswordRecovery(false)
  }, [auth])

  useEffect(() => {
    const requestId = ++suggestionsRequestRef.current
    if (serverBacked) {
      const query = input.trim()
      if (!query) {
        setSuggestions([])
        return
      }
      const timeout = window.setTimeout(() => {
        void searchServerWords(query, 5)
          .then((next) => {
            if (suggestionsRequestRef.current === requestId) setSuggestions(next)
          })
          .catch(() => {
            if (suggestionsRequestRef.current === requestId) setSuggestions([])
          })
      }, 180)
      return () => window.clearTimeout(timeout)
    }

    if (!input.trim() || !fuseRef.current) {
      setSuggestions([])
      return
    }
    const hits = fuseRef.current.search(input).slice(0, 5).map((h: any) => h.item)
    setSuggestions(hits)
  }, [input, fuseRef, searchServerWords, serverBacked])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSug((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSug((prev) => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedSug >= 0 && suggestions[selectedSug]) {
        handleSubmit(suggestions[selectedSug].term)
      } else {
        handleSubmit(input)
      }
    }
  }

  const handleSubmit = async (text: string) => {
    if (!text.trim()) return
    const originalQuery = text.trim()
    suggestionsRequestRef.current += 1
    setInput('')
    setSuggestions([])
    setSelectedSug(-1)
    setAboutOpen(false)
    setProfileView('home')
    setMobileMenuOpen(false)

    const thinkingId = uuid()
    setMessages((prev) => [
      ...prev,
      { id: uuid(), role: 'user', content: originalQuery, timestamp: Date.now() },
      { id: thinkingId, role: 'bot', loading: true, timestamp: Date.now() },
    ])

    if (status !== 'ready') {
      setMessages((p) =>
        p.map((message) =>
          message.id === thinkingId
            ? { id: thinkingId, role: 'bot', content: 'Please load the database file first.', timestamp: Date.now() }
            : message
        )
      )
      return
    }

    const cleanQuery = originalQuery.replace(stopWords, '').replace(/[?]/g, '').trim()

    let searchPool = data
    if (serverBacked) {
      try {
        searchPool = await searchServerWords(cleanQuery || originalQuery, 8)
      } catch {
        searchPool = data
      }
    }

    let match = searchPool.find((d) => d.term.toLowerCase() === cleanQuery.toLowerCase())
    const exactOriginal = searchPool.find((d) => d.term.toLowerCase() === originalQuery.toLowerCase())
    if (!match && exactOriginal) match = exactOriginal

    if (!match && !serverBacked && fuseRef.current) {
      const res = fuseRef.current.search(cleanQuery)
      if (res.length > 0) match = res[0].item
    }

    if (!match && cleanQuery !== originalQuery && !serverBacked && fuseRef.current) {
      const exactOrig = searchPool.find((d) => d.term.toLowerCase() === originalQuery.toLowerCase())
      if (exactOrig) {
        match = exactOrig
      } else {
        const res = fuseRef.current.search(originalQuery)
        if (res.length > 0) match = res[0].item
      }
    }

    if (match) {
      setMessages((p) =>
        p.map((message) =>
          message.id === thinkingId
            ? { id: thinkingId, role: 'bot', entry: match, timestamp: Date.now() }
            : message
        )
      )
    } else if (searchPool.length) {
      setMessages((p) =>
        p.map((message) =>
          message.id === thinkingId
            ? { id: thinkingId, role: 'bot', related: searchPool.slice(0, 5), timestamp: Date.now() }
            : message
        )
      )
    } else {
      setMessages((p) =>
        p.map((message) =>
          message.id === thinkingId
            ? {
                id: thinkingId,
                role: 'bot',
                content: 'No close matches yet. Try another spelling or a related supply chain term.',
                timestamp: Date.now(),
              }
            : message
        )
      )
    }
  }

  const handleFile = (file: File) => {
    const r = new FileReader()
    r.onload = (ev) => processCSV(ev.target?.result as string)
    r.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const goHome = () => {
    setAboutOpen(false)
    setProfileView('home')
    setMobileMenuOpen(false)
    setMessages([])
    setInput('')
    setSuggestions([])
    setSelectedSug(-1)
  }

  const openAuth = (mode: AuthMode = 'signin') => {
    setAuthMode(mode)
    setAuthOpen(true)
    setMobileMenuOpen(false)
  }

  const openDashboard = () => {
    if (!auth.user) {
      openAuth('signin')
      return
    }
    setAboutOpen(false)
    setProfileView('dashboard')
    setMessages([])
    setMobileMenuOpen(false)
  }

  const openTerm = (entry: Entry) => {
    suggestionsRequestRef.current += 1
    setInput('')
    setSuggestions([])
    setSelectedSug(-1)
    setProfileView('home')
    setAboutOpen(false)
    setMessages([{ id: uuid(), role: 'bot', entry, timestamp: Date.now() }])
  }

  const handleRelatedPick = (messageId: string, entry: Entry) => {
    suggestionsRequestRef.current += 1
    setInput('')
    setSuggestions([])
    setSelectedSug(-1)
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { id: messageId, role: 'bot', entry, timestamp: Date.now() }
          : message
      )
    )
  }

  const toggleFavorite = async (entry: Entry) => {
    const result = await favorites.toggleFavorite(entry)
    if (result.needsAuth) openAuth('signin')
  }

  return (
    <>
      <style>{STYLES + PLATFORM_STYLES}</style>
      <div className="app-container" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          tts={tts}
          autoReadAi={autoReadAi}
          setAutoReadAi={setAutoReadAi}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
        />
        <AuthDialog open={authOpen} mode={authMode} setMode={setAuthMode} onClose={() => setAuthOpen(false)} darkMode={darkMode} />

        <div className={`header ${messages.length > 0 ? 'scrolled' : ''}`}>
          <button className="brand" onClick={goHome} aria-label="Go to scmpedia home">
            <FadeImage className="brand-logo" src={darkMode ? '/white-logo.png' : '/logo.png'} alt="scmpedia" eager />
            <FadeImage className="brand-icon" src="/logo2.png" alt="scmpedia" eager />
          </button>

          <div className="header-controls">
            <button
              className={`settings-btn ${aboutOpen ? 'active' : ''}`}
              onClick={() => {
                setAboutOpen((open) => !open)
                setMobileMenuOpen(false)
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              What is scmpedia?
            </button>
            <button
              className="settings-btn"
              onClick={() => {
                setSettingsOpen(true)
                setMobileMenuOpen(false)
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7A2 2 0 1 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 20.9 10h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
              </svg>
              Settings
            </button>
            {auth.user ? (
              <>
                <button className={`settings-btn ${profileView === 'dashboard' ? 'active' : ''}`} onClick={openDashboard}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 20V8l8-4 8 4v12" />
                    <path d="M9 20v-6h6v6" />
                  </svg>
                  Dashboard
                </button>
                <button className="settings-btn" onClick={() => void auth.signOut()}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Sign out
                </button>
              </>
            ) : (
              <button className="settings-btn" onClick={() => openAuth('signin')}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <path d="M10 17l5-5-5-5M15 12H3" />
                </svg>
                Sign in
              </button>
            )}
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="mobile-menu" hidden={!mobileMenuOpen}>
              <button
                className={`settings-btn ${aboutOpen ? 'active' : ''}`}
                onClick={() => {
                  setAboutOpen((open) => !open)
                  setMobileMenuOpen(false)
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                What is scmpedia?
              </button>
              <button
                className="settings-btn"
                onClick={() => {
                  setSettingsOpen(true)
                  setMobileMenuOpen(false)
                }}
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7A2 2 0 1 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1A1.7 1.7 0 0 0 20.9 10h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                </svg>
                Settings
              </button>
              {auth.user ? (
                <>
                  <button className={`settings-btn ${profileView === 'dashboard' ? 'active' : ''}`} onClick={openDashboard}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 20V8l8-4 8 4v12" />
                      <path d="M9 20v-6h6v6" />
                    </svg>
                    Dashboard
                  </button>
                  <button
                    className="settings-btn"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      void auth.signOut()
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5M21 12H9" />
                    </svg>
                    Sign out
                  </button>
                </>
              ) : (
                <button className="settings-btn" onClick={() => openAuth('signin')}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <path d="M10 17l5-5-5-5M15 12H3" />
                  </svg>
                  Sign in
                </button>
              )}
            </div>

          </div>
          <input
            type="file"
            ref={fileInputRef}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
            accept=".csv"
          />
        </div>

        <div className="chat-window">
          {profileView === 'dashboard' ? (
            <DashboardPage
              user={auth.user}
              entries={favorites.favoriteEntries}
              loading={favorites.loading}
              onBack={goHome}
              onOpenTerm={openTerm}
            />
          ) : aboutOpen ? (
            <AboutPage onBack={() => setAboutOpen(false)} />
          ) : messages.length === 0 ? (
            <div className="welcome-screen width-constraint">
              <div style={{ fontSize: '48px', marginBottom: '16px' }} aria-hidden="true"></div>
              <FadeImage className="welcome-logo" src={darkMode ? '/white-logo.png' : '/logo.png'} alt="scmpedia" eager />
              <section className="home-panel">
                <div className="home-content">
                  <div className="home-kicker">Powered by Prof. Douglas Boateng’s Executive Insight Series</div>
                  <h1 className="home-title">
                    Master Supply Chain Language. <span>Think Clearly. Lead Better.</span>
                  </h1>
                  <p className="home-copy">
                    Explore a 927-page, 4,000+ term compendium transformed into an AI-assisted reference for logistics,
                    procurement, operations, manufacturing, and supply chain strategy.
                  </p>

                  <div className="home-search">
                    {suggestions.length > 0 && (
                      <div className="predictive-list">
                        {suggestions.map((s, i) => (
                          <div
                            key={s.term}
                            className={`predictive-item ${i === selectedSug ? 'selected' : ''}`}
                            onClick={() => handleSubmit(s.term)}
                          >
                            <span className="p-term">{s.term}</span>
                            <span className="p-def">{s.definition}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="input-wrapper">
                      <input
                        className="chat-input"
                        placeholder={status === 'ready' ? 'Search a supply chain term...' : 'Load database to start...'}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={status !== 'ready'}
                      />
                      <button className={`send-btn ${input.trim() ? 'active' : ''}`} onClick={() => handleSubmit(input)}>
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                          <path d="M5 12h12M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="popular-row">
                    <div className="popular-label">Popular terms</div>
                    {['Supply', 'Demand', 'Inventory', 'Logistics', 'Procurement', 'Sustainability'].map((term, index) => (
                      <button
                        key={term}
                        className={`term-chip ${index === 0 ? 'primary' : ''}`}
                        onClick={() => handleSubmit(term)}
                        disabled={status !== 'ready'}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="feature-grid" aria-label="scmpedia strengths">
                <div className="feature-card">
                  <div className="feature-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 6h10M8 12h10M8 18h7" />
                      <path d="M4 6h.01M4 12h.01M4 18h.01" />
                    </svg>
                  </div>
                  <div>
                    <div className="feature-title">Definitive Reference</div>
                    <div className="feature-text">Terms sourced from Prof. Douglas Boateng’s supply chain compendium.</div>
                  </div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
                    </svg>
                  </div>
                  <div>
                    <div className="feature-title">AI Explanations</div>
                    <div className="feature-text">Plain-language breakdowns, examples, and voice-assisted learning.</div>
                  </div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />
                      <path d="M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20" />
                    </svg>
                  </div>
                  <div>
                    <div className="feature-title">Global Benchmarks</div>
                    <div className="feature-text">Acronyms, metrics, and terminology used by organizations worldwide.</div>
                  </div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 7h10v14H7z" />
                      <path d="M9 3h6v4H9zM10 12h4M10 16h4" />
                    </svg>
                  </div>
                  <div>
                    <div className="feature-title">Strategic Value</div>
                    <div className="feature-text">A training aid, desk reference, and decision support tool.</div>
                  </div>
                </div>
              </section>

              {status === 'empty' && (
                <div style={{ color: '#d93025', fontWeight: 500 }}>
                  Word database is not connected. Add SUPABASE_SERVICE_ROLE_KEY to your local or Vercel server environment.
                </div>
              )}
            </div>
          ) : (
            <div className="width-constraint">
              {messages.map((m) => (
                <div key={m.id} className={`message-row ${m.role}`}>
                  {m.role === 'bot' && (
                    <div className="avatar bot">
                      <FadeImage className="avatar-logo" src="/logo2.png" alt="scmpedia" eager />
                    </div>
                  )}
                  <div className="bubble">
                    {m.loading && <ChatThinking />}
                    {m.content && <div style={{ padding: m.role === 'bot' ? '12px 0' : undefined }}>{m.content}</div>}
                    {m.related?.length ? <WordSuggestions entries={m.related} onPick={(entry) => handleRelatedPick(m.id, entry)} /> : null}
                    {m.entry && (
                      <SmartCard
                        entry={m.entry}
                        allData={data}
                        tts={tts}
                        ai={ai}
                        autoReadAi={autoReadAi}
                        user={auth.user}
                        isFavorite={favorites.favoriteTerms.has(m.entry.term.toLowerCase())}
                        savingFavorite={favorites.savingTerm?.toLowerCase() === m.entry.term.toLowerCase()}
                        onAuthRequired={() => openAuth('signin')}
                        onToggleFavorite={toggleFavorite}
                      />
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {messages.length > 0 && !aboutOpen && profileView !== 'dashboard' && <div className="input-area">
          <div className="input-container">
            {suggestions.length > 0 && (
              <div className="predictive-list">
                {suggestions.map((s, i) => (
                  <div
                    key={s.term}
                    className={`predictive-item ${i === selectedSug ? 'selected' : ''}`}
                    onClick={() => handleSubmit(s.term)}
                  >
                    <span className="p-term">{s.term}</span>
                    <span className="p-def">{s.definition}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="input-wrapper">
              <input
                className="chat-input"
                placeholder={status === 'ready' ? 'Search a supply chain term...' : 'Load database to start...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={status !== 'ready'}
              />
              <button className={`send-btn ${input.trim() ? 'active' : ''}`} onClick={() => handleSubmit(input)}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                </svg>
              </button>
            </div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#999', marginTop: '12px' }}>
              Powered by scmpedia | Prof. Douglas Boateng
            </div>
          </div>
        </div>}
      </div>
    </>
  )
}
