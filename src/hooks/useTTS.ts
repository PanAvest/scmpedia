import { useState, useEffect, useRef } from 'react'
import type { TTSProvider } from '../types'
import {
  DEFAULT_ELEVENLABS_VOICE_ID,
  ELEVENLABS_MODEL_ID,
  ELEVENLABS_OUTPUT_FORMAT,
  SELECTED_VOICE_KEY,
  TTS_PROVIDER_KEY,
} from '../utils'

export function useTTS(accessToken?: string) {
  const defaultVoiceUpgradeKey = 'scmpedia-prof-douglas-default-v1'
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [preparingId, setPreparingId] = useState<string | null>(null)
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(() => localStorage.getItem(SELECTED_VOICE_KEY) || '')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [provider, setProvider] = useState<TTSProvider>(() => {
    if (localStorage.getItem(defaultVoiceUpgradeKey) !== 'true') {
      localStorage.setItem(defaultVoiceUpgradeKey, 'true')
      localStorage.setItem(TTS_PROVIDER_KEY, 'elevenlabs')
      return 'elevenlabs'
    }
    const stored = localStorage.getItem(TTS_PROVIDER_KEY)
    return stored === 'browser' || stored === 'elevenlabs' ? stored : 'elevenlabs'
  })
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

  useEffect(() => {
    localStorage.setItem(TTS_PROVIDER_KEY, provider)
  }, [provider])

  useEffect(() => {
    if (selectedVoiceURI) localStorage.setItem(SELECTED_VOICE_KEY, selectedVoiceURI)
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
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
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
        speakBrowser(id, text, true)
      })
      return
    }
    speakBrowser(id, text)
  }

  return { speak, speakingId, preparingId, voices, selectedVoiceURI, setSelectedVoiceURI, provider, setProvider, stopAudio }
}
