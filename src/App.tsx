import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'

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
body { margin: 0; font-family: "Google Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text-main); height: 100dvh; overflow: hidden; -webkit-text-size-adjust: 100%; }
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
.action-icon { width: 16px; height: 16px; opacity: 0.8; }

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

body {
  background:
    radial-gradient(circle at 7% 9%, rgba(255, 110, 28, 0.14) 0 1px, transparent 2px) 0 0 / 15px 15px,
    linear-gradient(180deg, rgba(255,255,255,0.72), rgba(250,247,241,0.94)),
    radial-gradient(circle at top left, rgba(255, 128, 43, 0.1), transparent 34%),
    radial-gradient(circle at 88% 10%, rgba(0, 79, 70, 0.1), transparent 30%),
    #fbf8f1;
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
  height: auto;
  margin: 0 auto 18px;
  object-fit: contain;
  animation: logo-pop 0.58s cubic-bezier(.2,.9,.2,1) 0.08s both;
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
}

type TTSProvider = 'elevenlabs' | 'browser'

const DEFAULT_ELEVENLABS_VOICE_ID = 'VR5rq02kIGuHRg0JKxB6'
const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2'
const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128'

const uuid = () => Math.random().toString(36).substring(2, 9)
const escapeHtml = (input: string) =>
  input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const fallbackExplanation = (anchor: Entry) => {
  const concept = escapeHtml(anchor.definition || `${anchor.term} is a supply chain concept.`)
  const exampleText =
    anchor.examples ||
    `In practice, ${anchor.term} could involve ${anchor.definition?.replace(/\.$/, '') || 'real-world operations'}.`
  const example = escapeHtml(exampleText)
  return `<b>Concept:</b> ${concept}<br/><br/><b>Real-World Example:</b> ${example}`
}

/* ------------------------------- LOGIC HOOKS ------------------------------- */

// 1. DATA HOOK
function useData() {
  const [data, setData] = useState<Entry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading')
  const papaRef = useRef<any>(null)
  const fuseLibRef = useRef<any>(null)
  const fuseRef = useRef<any>(null)

  const processCSV = useCallback((csv: string) => {
    if (!papaRef.current) return
    try {
      const res = papaRef.current.parse(csv, { header: true, skipEmptyLines: true })
      const entries = res.data
        .map((r: any) => ({
          term: (r.term || r.Term || '').trim(),
          definition: (r.definition || r.Definition || '').trim(),
          synonyms: r.synonyms || r.Synonyms || '',
          tags: r.tags || r.Tags || '',
          pos: r.pos || r.Pos || '',
          pronunciation: r.pronunciation || r.Pronunciation || '',
          examples: r.examples || r.Examples || '',
        }))
        .filter((e: Entry) => e.term && e.definition)

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
    } catch {
      setStatus('error')
    }
  }, [])

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
  }, [processCSV])

  return { data, status, processCSV, fuseRef }
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

// 3. AI GENERATOR (scmpedia)
function useAI() {
  const [status] = useState<'loading' | 'ready' | 'error'>('ready')
  const transformersRef = useRef<any>(null)
  const transformersReadyRef = useRef<Promise<any> | null>(null)

  const formatToHtml = (raw: string, anchor: Entry) => {
    let text = raw.trim()
    if (!text) return fallbackExplanation(anchor)
    const hasHtml = /<\/?[a-z][\s\S]*>/i.test(text)
    if (!hasHtml) {
      text = escapeHtml(text).replace(/\r?\n+/g, '\n')
    }
    text = text.replace(/Concept:/i, '<b>Concept:</b>').replace(/Real-World Example:/i, '<b>Real-World Example:</b>')
    if (!text.includes('<b>Concept:</b>')) text = `<b>Concept:</b> ${text}`
    if (!text.includes('<b>Real-World Example:</b>')) {
      text += `<br/><br/><b>Real-World Example:</b> ${escapeHtml(anchor.examples || 'A practical example can be observed in day-to-day supply chain operations.')}`
    } else {
      text = text.replace(/\n/g, '<br/>')
    }
    return text
  }

  const pollinationsGenerate = async (anchor: Entry, isRegen?: boolean) => {
    const instruction = isRegen
      ? 'Re-explain this concept simply for a beginner. Use a fresh analogy.'
      : 'Explain this concept simply to a professional. Provide a clear definition and a real-world supply chain example.'

    const prompt = `You are a Supply Chain Tutor.\nTerm: "${anchor.term}"\nDefinition: "${anchor.definition}"\nTags: "${anchor.tags || ''}"\n\nTask: ${instruction}\n\nOutput Format:\nReturn strictly HTML with <b> tags. No markdown.\n1. <b>Concept:</b> (Explanation)\n2. <b>Real-World Example:</b> (Example)`

    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(JSON.stringify({ status: response.status, body: errText || 'scmpedia error' }))
    }

    const data = await response.json()
    const text = data?.text || ''
    if (!text) throw new Error('scmpedia returned empty response')
    return text
  }

  const shouldFallback = (message: string) => {
    const text = message.toLowerCase()
    return (
      text.includes('"status":402') ||
      text.includes('"status":404') ||
      text.includes('"status":429') ||
      text.includes('insufficient_quota') ||
      text.includes('quota') ||
      text.includes('rate limit') ||
      text.includes('payment required') ||
      text.includes('unauthorized') ||
      text.includes('authenticate') ||
      text.includes('authentication') ||
      text.includes('"status":401') ||
      text.includes('important notice') ||
      text.includes('legacy text api') ||
      text.includes('being deprecated') ||
      text.includes('migrate to our new service') ||
      text.includes('enter.pollinations.ai')
    )
  }

  const loadTransformers = () => {
    if (transformersRef.current) return Promise.resolve(transformersRef.current)
    if (transformersReadyRef.current) return transformersReadyRef.current

    transformersReadyRef.current = import(
      /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.2/dist/transformers.min.js'
    )
      .then((mod: any) => {
        const lib = mod?.pipeline ? mod : mod?.default
        if (!lib?.pipeline) throw new Error('Transformers.js failed to load')
        transformersRef.current = lib
        return lib
      })
      .catch((err) => {
        transformersReadyRef.current = null
        throw err
      })

    return transformersReadyRef.current
  }

  const transformersGenerate = async (anchor: Entry, isRegen?: boolean) => {
    const instruction = isRegen
      ? 'Explain simply for a beginner with a fresh analogy.'
      : 'Explain simply to a professional with a clear definition and a real-world supply chain example.'
    const prompt = `Explain the supply chain term: ${anchor.term}. ${instruction} Definition: ${anchor.definition}. Tags: ${anchor.tags || ''}.`

    const lib = await loadTransformers()
    if (!lib?.pipeline) throw new Error('Transformers.js unavailable')

    const generator = await lib.pipeline('text2text-generation', 'Xenova/flan-t5-small')
    const out = await generator(prompt, { max_new_tokens: 160 })
    const text = out?.[0]?.generated_text || ''
    if (!text) throw new Error('Transformers.js returned empty response')
    return text
  }

  const generate = async (anchor: Entry, isRegen?: boolean) => {
    try {
      const text = await pollinationsGenerate(anchor, isRegen)
      return formatToHtml(text, anchor)
    } catch (e) {
      console.error('scmpedia error', e)

      if (shouldFallback(String(e))) {
        try {
          const fallback = await transformersGenerate(anchor, isRegen)
          return formatToHtml(fallback, anchor)
        } catch (fallbackErr) {
          console.error('Transformers.js fallback error', fallbackErr)
        }
      }
    }

    return `<i>Could not reach scmpedia services. Here is a summary:</i><br/><br/><b>Concept:</b> ${anchor.term} is a concept in ${anchor.tags || 'supply chain'} regarding ${anchor.definition}.<br/><br/><b>Real-World Example:</b> This often appears when companies manage sourcing, inventory, logistics, or supplier performance related to the term.`
  }

  return { status, generate }
}

/* ------------------------------- UI COMPONENTS ------------------------------- */

const SettingsDialog = ({
  open,
  onClose,
  tts,
  autoReadAi,
  setAutoReadAi,
}: {
  open: boolean
  onClose: () => void
  tts: any
  autoReadAi: boolean
  setAutoReadAi: (v: boolean) => void
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
                <option value="elevenlabs">ElevenLabs default voice</option>
                <option value="browser">Browser voices</option>
              </select>
              <div className="api-hint">ElevenLabs uses the same default voice configured in PanAvest Courses.</div>
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
                <label className="toggle-switch" aria-label="Auto-read scmpedia insights">
                  <input type="checkbox" checked={autoReadAi} onChange={(e) => setAutoReadAi(e.target.checked)} />
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
        scmpedia is thinking...
      </div>
      <div className="thought-process">
        <span className="fade-text">» {thought}</span>
      </div>
    </div>
  )
}

const SmartCard = ({
  entry,
  allData,
  tts,
  ai,
  autoReadAi,
}: {
  entry: Entry
  allData: Entry[]
  tts: any
  ai: { status: 'loading' | 'ready' | 'error'; generate: (e: Entry, regen?: boolean) => Promise<string> }
  autoReadAi: boolean
}) => {
  const [expanded, setExpanded] = useState<'details' | 'ai' | null>(null)
  const [aiText, setAiText] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAltUrl, setImageAltUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageErrorMessage, setImageErrorMessage] = useState('')

  const fetchAi = async (regen = false) => {
    setLoadingAi(true)
    try {
      const txt = await ai.generate(entry, regen)
      const next = txt || ''
      setAiText(next)
    } catch (e) {
      console.error('scmpedia generate error', e)
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
      setImageUrl(thumb || next)
      setImageAltUrl(next || thumb)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('scmpedia image error', e)
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

  const handleCopy = () => {
    navigator.clipboard.writeText(`${entry.term}: ${entry.definition}`)
  }

  const isSpeakingDef = tts.speakingId === `def-${entry.term}`
  const isSpeakingAi = tts.speakingId === `ai-${entry.term}`
  const isPreparingDef = tts.preparingId === `def-${entry.term}`
  const isPreparingAi = tts.preparingId === `ai-${entry.term}`

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
          {ai.status === 'loading' ? 'Loading scmpedia...' : 'Explain with scmpedia'}
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

        <button className="action-btn" onClick={handleCopy}>
          <svg className="action-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
          </svg>
          Copy
        </button>
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
            <img
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
          <img className="about-logo" src="/white-logo.png" alt="scmpedia" />
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
          <img
            className="book-cover"
            src="/book.jpg"
            alt="Executive Insight Series: Compendium of Supply Chain Management Terms book cover"
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
  const { data, status, processCSV, fuseRef } = useData()
  const tts = useTTS()
  const ai = useAI()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Entry[]>([])
  const [selectedSug, setSelectedSug] = useState(-1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [autoReadAi, setAutoReadAi] = useState(true)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stopWords = useMemo(
    () => /^(what is|what's|define|explain|describe|meaning of|tell me about|search for|look up|do you know)\s+/i,
    []
  )

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages])

  useEffect(() => {
    if (!input.trim() || !fuseRef.current) {
      setSuggestions([])
      return
    }
    const hits = fuseRef.current.search(input).slice(0, 5).map((h: any) => h.item)
    setSuggestions(hits)
  }, [input, fuseRef])

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

  const handleSubmit = (text: string) => {
    if (!text.trim()) return
    const originalQuery = text.trim()
    setInput('')
    setSuggestions([])
    setSelectedSug(-1)
    setAboutOpen(false)
    setMobileMenuOpen(false)

    setMessages((prev) => [...prev, { id: uuid(), role: 'user', content: originalQuery, timestamp: Date.now() }])

    if (status !== 'ready') {
      setTimeout(
        () => setMessages((p) => [...p, { id: uuid(), role: 'bot', content: 'Please load the database file first.' }]),
        200
      )
      return
    }

    const cleanQuery = originalQuery.replace(stopWords, '').replace(/[?]/g, '').trim()

    let match = data.find((d) => d.term.toLowerCase() === cleanQuery.toLowerCase())

    if (!match && fuseRef.current) {
      const res = fuseRef.current.search(cleanQuery)
      if (res.length > 0) match = res[0].item
    }

    if (!match && cleanQuery !== originalQuery && fuseRef.current) {
      const exactOrig = data.find((d) => d.term.toLowerCase() === originalQuery.toLowerCase())
      if (exactOrig) {
        match = exactOrig
      } else {
        const res = fuseRef.current.search(originalQuery)
        if (res.length > 0) match = res[0].item
      }
    }

    if (match) {
      setMessages((p) => [...p, { id: uuid(), role: 'bot', entry: match, timestamp: Date.now() }])
    } else {
      setTimeout(
        () =>
          setMessages((p) => [
            ...p,
            { id: uuid(), role: 'bot', content: `I couldn't find a match for "${cleanQuery}". Try a different term.` },
          ]),
        300
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
    setMobileMenuOpen(false)
    setMessages([])
    setInput('')
    setSuggestions([])
    setSelectedSug(-1)
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
        />

        <div className={`header ${messages.length > 0 ? 'scrolled' : ''}`}>
          <button className="brand" onClick={goHome} aria-label="Go to scmpedia home">
            <img className="brand-logo" src="/logo.png" alt="scmpedia" />
            <img className="brand-icon" src="/logo2.png" alt="scmpedia" />
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
          {aboutOpen ? (
            <AboutPage onBack={() => setAboutOpen(false)} />
          ) : messages.length === 0 ? (
            <div className="welcome-screen width-constraint">
              <div style={{ fontSize: '48px', marginBottom: '16px' }} aria-hidden="true"></div>
              <img className="welcome-logo" src="/logo.png" alt="scmpedia" />
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
                  Please drag and drop scmpedia_full_UPDATED.csv or scmpedia_full.csv here.
                </div>
              )}
            </div>
          ) : (
            <div className="width-constraint">
              {messages.map((m) => (
                <div key={m.id} className={`message-row ${m.role}`}>
                  {m.role === 'bot' && (
                    <div className="avatar bot">
                      <img className="avatar-logo" src="/logo2.png" alt="scmpedia" />
                    </div>
                  )}
                  <div className="bubble">
                    {m.content && <div style={{ padding: m.role === 'bot' ? '12px 0' : undefined }}>{m.content}</div>}
                    {m.entry && <SmartCard entry={m.entry} allData={data} tts={tts} ai={ai} autoReadAi={autoReadAi} />}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {messages.length > 0 && !aboutOpen && <div className="input-area">
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
