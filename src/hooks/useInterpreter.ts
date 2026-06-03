'use client'

/**
 * useInterpreter.ts
 * ─────────────────────────────────────────────────────────────────
 * Hook principal del intérprete simultáneo ES ↔ EN.
 *
 * STT  → Web Speech API (browser nativo, sin modelos pesados)
 * TTS  → window.speechSynthesis (voces del sistema, seleccionables)
 * MTx  → POST /api/translate (Gemini Flash, una llamada REST simple)
 * ─────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Tipos ─────────────────────────────────────────────────────────

export type Language = 'es' | 'en'

export type SessionState =
  | 'idle'        // sin sesión
  | 'ready'       // esperando input
  | 'listening'   // grabando voz del usuario
  | 'translating' // llamada a Gemini en curso
  | 'speaking'    // TTS reproduciendo
  | 'error'

export interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  lang: Language
  timestamp: Date
}

interface SpeechAwareWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognition
  webkitSpeechRecognition?: new () => SpeechRecognition
}

// ── Detección de idioma por heurística ────────────────────────────

export function detectLang(text: string): Language {
  const esMarkers = /\b(el|la|los|las|un|una|que|de|en|con|por|para|es|son|tiene|está|estoy|pero|como|cuando|también|más|me|mi|tu|su|no|sí|muy|bien|gracias|buenos|días|hola|quiero|tengo|necesito|puedo|hacer|este|eso|aquí|ahora|todo|nada|ya|hay|ser|por|favor)\b/gi
  const enMarkers = /\b(the|a|an|is|are|was|were|have|has|with|for|that|this|but|and|or|it|he|she|they|we|you|I|my|your|please|thank|yes|no|good|hello|want|need|can|do|here|now|all|nothing|already|there|be|could|would|should|get|go)\b/gi

  const esCount = (text.match(esMarkers) ?? []).length
  const enCount = (text.match(enMarkers) ?? []).length

  // Si hay acento o ñ, es español sin dudas
  if (/[áéíóúüñ¿¡]/i.test(text)) return 'es'

  return esCount >= enCount ? 'es' : 'en'
}

// ── Hook ──────────────────────────────────────────────────────────

export function useInterpreter() {
  const [state, setState] = useState<SessionState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Voces disponibles del sistema
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [esVoice, setEsVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [enVoice, setEnVoice] = useState<SpeechSynthesisVoice | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const sessionActiveRef = useRef(false)
  const isTranslatingRef = useRef(false)
  const isSpeakingRef = useRef(false)

  // ── Cargar voces del sistema ───────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0) return

      setAvailableVoices(voices)

      // Auto-seleccionar la mejor voz ES y EN si no hay una ya elegida
      setEsVoice(prev => {
        if (prev) return prev
        return (
          voices.find(v => v.lang === 'es-ES' && v.localService) ||
          voices.find(v => v.lang.startsWith('es') && v.localService) ||
          voices.find(v => v.lang.startsWith('es')) ||
          null
        )
      })

      setEnVoice(prev => {
        if (prev) return prev
        return (
          voices.find(v => v.lang === 'en-GB' && v.localService) ||
          voices.find(v => v.lang === 'en-US' && v.localService) ||
          voices.find(v => v.lang.startsWith('en') && v.localService) ||
          voices.find(v => v.lang.startsWith('en')) ||
          null
        )
      })
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  // ── TTS ───────────────────────────────────────────────────────

  const speak = useCallback((text: string, lang: Language, onEnd?: () => void) => {
    if (typeof window === 'undefined') return

    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang === 'es' ? 'es-ES' : 'en-GB'

    // Usar la voz seleccionada por el usuario si está disponible
    const voice = lang === 'es' ? esVoice : enVoice
    if (voice) utter.voice = voice

    utter.rate = 0.95
    utter.pitch = 1.0
    utter.volume = 1.0

    isSpeakingRef.current = true
    setState('speaking')

    utter.onend = () => {
      isSpeakingRef.current = false
      if (sessionActiveRef.current) setState('ready')
      onEnd?.()
    }

    utter.onerror = () => {
      isSpeakingRef.current = false
      if (sessionActiveRef.current) setState('ready')
    }

    window.speechSynthesis.speak(utter)
  }, [esVoice, enVoice])

  // ── Traducción via Gemini REST ─────────────────────────────────

  const translate = useCallback(async (text: string, from: Language) => {
    if (isTranslatingRef.current) return
    isTranslatingRef.current = true
    setState('translating')

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, from }),
      })

      const data = await res.json()

      if (!res.ok || !data.translation) {
        throw new Error(data.error || 'Translation failed')
      }

      const toLang: Language = from === 'es' ? 'en' : 'es'

      // Agregar la traducción al transcript
      const entry: TranscriptEntry = {
        id: `${Date.now()}-assist`,
        role: 'assistant',
        text: data.translation,
        lang: toLang,
        timestamp: new Date(),
      }
      setTranscript(prev => [...prev, entry])

      // Leer la traducción en voz alta
      if (sessionActiveRef.current) {
        speak(data.translation, toLang)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error de traducción'
      console.error('[useInterpreter] translate error:', msg)
      setError(msg)
      if (sessionActiveRef.current) setState('ready')
    } finally {
      isTranslatingRef.current = false
    }
  }, [speak])

  // ── SpeechRecognition ─────────────────────────────────────────

  const buildRecognition = useCallback((): SpeechRecognition | null => {
    if (typeof window === 'undefined') return null
    const w = window as SpeechAwareWindow
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) {
      setError('SpeechRecognition no está disponible. Usá Chrome o Edge.')
      return null
    }

    const r = new SR()
    // Reconocimiento en ambos idiomas — detectamos manualmente tras la transcripción
    r.lang = 'es-ES'
    r.continuous = false
    r.interimResults = true
    r.maxAlternatives = 1

    r.onresult = (e: SpeechRecognitionEvent) => {
      const result = e.results[e.results.length - 1]
      const text = result[0].transcript.trim()

      if (result.isFinal && text.length > 1) {
        setInterimText('')

        const srcLang = detectLang(text)

        // Agregar lo que dijo el usuario al transcript
        const userEntry: TranscriptEntry = {
          id: `${Date.now()}-user`,
          role: 'user',
          text,
          lang: srcLang,
          timestamp: new Date(),
        }
        setTranscript(prev => [...prev, userEntry])

        // Traducir
        translate(text, srcLang)
      } else {
        setInterimText(text)
      }
    }

    r.onend = () => {
      if (!sessionActiveRef.current) return
      if (!isTranslatingRef.current && !isSpeakingRef.current) {
        setState('ready')
      }
    }

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      if (e.error === 'not-allowed') {
        setError('Permiso de micrófono denegado. Habilitalo en la configuración del navegador.')
        setState('error')
        return
      }
      console.warn('[useInterpreter] SpeechRecognition error:', e.error)
      if (sessionActiveRef.current) setState('ready')
    }

    return r
  }, [translate])

  // ── Control de sesión ─────────────────────────────────────────

  const startSession = useCallback(() => {
    sessionActiveRef.current = true
    setError(null)
    setState('ready')
  }, [])

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false
    recognitionRef.current?.abort()
    recognitionRef.current = null
    window.speechSynthesis?.cancel()
    setInterimText('')
    setState('idle')
  }, [])

  // ── Control de micrófono ──────────────────────────────────────

  const startListening = useCallback(() => {
    if (state !== 'ready' || !sessionActiveRef.current) return

    const r = buildRecognition()
    if (!r) return

    recognitionRef.current?.abort()
    recognitionRef.current = r

    setState('listening')
    try {
      r.start()
    } catch (e) {
      console.warn('[useInterpreter] recognition.start error:', e)
      setState('ready')
    }
  }, [state, buildRecognition])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    if (sessionActiveRef.current && !isTranslatingRef.current) {
      setState('ready')
    }
  }, [])

  // ── Traducción manual (desde los paneles de texto) ────────────

  const translateManual = useCallback(async (text: string, from: Language) => {
    if (!text.trim()) return
    if (!sessionActiveRef.current) startSession()

    const userEntry: TranscriptEntry = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: text.trim(),
      lang: from,
      timestamp: new Date(),
    }
    setTranscript(prev => [...prev, userEntry])

    await translate(text.trim(), from)
  }, [translate, startSession])

  const clearTranscript = useCallback(() => {
    setTranscript([])
    setInterimText('')
  }, [])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      window.speechSynthesis?.cancel()
    }
  }, [])

  return {
    // Estado
    state,
    transcript,
    interimText,
    error,

    // Voces
    availableVoices,
    esVoice,
    enVoice,
    setEsVoice,
    setEnVoice,

    // Controles
    startSession,
    stopSession,
    startListening,
    stopListening,
    translateManual,
    clearTranscript,
    speak,
  }
}
