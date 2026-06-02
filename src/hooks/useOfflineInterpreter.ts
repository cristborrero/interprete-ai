/**
 * useOfflineInterpreter.ts
 * ─────────────────────────────────────────────────────────────────
 * Hook para interpretación ES ↔ EN 100% offline:
 *
 * STT:  Web Speech API (SpeechRecognition nativa del browser/SO)
 * MT:   OPUS-MT via Transformers.js en un Web Worker (Helsinki-NLP)
 * TTS:  SpeechSynthesis nativa del browser/SO
 *
 * Primera carga: descarga ~150MB de modelos (se cachean en IndexedDB)
 * Cargas siguientes: completamente offline, sin red.
 * ─────────────────────────────────────────────────────────────────
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranscriptEntry, Language } from './useGeminiLive'

// ── Tipos ─────────────────────────────────────────────────────────

export type OfflineState =
  | 'idle'
  | 'loading'       // descargando modelos de traducción
  | 'ready'         // modelos cargados, esperando
  | 'listening'     // reconociendo voz
  | 'translating'   // traduciendo + sintetizando
  | 'error'

export interface OfflineProgress {
  message: string
  percent: number
}

export interface UseOfflineInterpreterReturn {
  state: OfflineState
  transcript: TranscriptEntry[]
  currentText: string
  detectedLang: Language | null
  error: string | null
  progress: OfflineProgress
  autoMode: boolean
  setAutoMode: (v: boolean) => void
  startSession: () => void
  stopSession: () => void
  startListening: () => void
  stopListening: () => void
  clearTranscript: () => void
  ttsRate: number
  setTtsRate: (r: number) => void
  ttsVolume: number
  setTtsVolume: (v: number) => void
  translateText: (text: string, fromLang: Language) => Promise<void>
}

// ── Detección de idioma por heurística simple ─────────────────────

function detectLang(text: string): Language {
  const es = /\b(el|la|los|las|un|una|que|de|en|con|por|para|es|son|tiene|está|pero|como|cuando|también|más|me|mi|tu|su|no|sí|muy|bien|gracias|buenos|días)\b/gi
  const en = /\b(the|a|an|is|are|was|were|have|has|with|for|that|this|but|and|or|it|he|she|they|we|you|I|my|your|please|thank|yes|no|good|hello)\b/gi
  const esN = (text.match(es) ?? []).length
  const enN = (text.match(en) ?? []).length
  return esN >= enN ? 'es' : 'en'
}

// ── Hook ──────────────────────────────────────────────────────────

export function useOfflineInterpreter(): UseOfflineInterpreterReturn {
  const [state, setState] = useState<OfflineState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [currentText, setCurrentText] = useState('')
  const [detectedLang, setDetectedLang] = useState<Language | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<OfflineProgress>({ message: '', percent: 0 })
  const [autoMode, setAutoModeState] = useState(false)

  const [ttsRate, setTtsRateState] = useState(0.95)
  const [ttsVolume, setTtsVolumeState] = useState(1.0)

  const workerRef = useRef<Worker | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const sessionActiveRef = useRef(false)
  const autoModeRef = useRef(false)
  const pendingTranslations = useRef<Map<string, Language>>(new Map())

  const loadedRef = useRef(false)
  const ttsRateRef = useRef(0.95)
  const ttsVolumeRef = useRef(1.0)

  const setTtsRate = useCallback((r: number) => {
    ttsRateRef.current = r
    setTtsRateState(r)
  }, [])

  const setTtsVolume = useCallback((v: number) => {
    ttsVolumeRef.current = v
    setTtsVolumeState(v)
  }, [])

  const setAutoMode = useCallback((v: boolean) => {
    autoModeRef.current = v
    setAutoModeState(v)
  }, [])

  // ── TTS: sintetizar la traducción en voz ─────────────────────

  const speak = useCallback((text: string, lang: Language) => {
    if (typeof window === 'undefined') return
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang === 'es' ? 'es-ES' : 'en-GB'
    utter.rate = ttsRateRef.current
    utter.volume = ttsVolumeRef.current
    utter.pitch = 1.0

    // Intentar encontrar una voz nativa del SO para el idioma
    const voices = window.speechSynthesis.getVoices()
    const match = voices.find(v => v.lang.startsWith(lang === 'es' ? 'es' : 'en') && v.localService)
    if (match) utter.voice = match

    utter.onend = () => {
      if (sessionActiveRef.current) {
        setState(autoModeRef.current ? 'listening' : 'ready')
        // En auto mode, reiniciar el reconocimiento inmediatamente
        if (autoModeRef.current && recognitionRef.current) {
          try { recognitionRef.current.start() } catch { /* ya iniciado */ }
        }
      }
    }

    utter.onerror = () => {
      if (sessionActiveRef.current) setState('ready')
    }

    setState('translating')
    window.speechSynthesis.cancel() // cancelar cualquier TTS previo
    window.speechSynthesis.speak(utter)
  }, [])

  // ── Web Worker: inicializar y manejar mensajes ────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return

    const worker = new Worker(
      new URL('../workers/translation.worker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e) => {
      const msg = e.data

      switch (msg.type) {
        case 'progress':
          setProgress({ message: msg.message, percent: msg.percent ?? 0 })
          break

        case 'loaded':
          loadedRef.current = true
          setState('ready')
          setProgress({ message: 'Listo — modelos cargados localmente', percent: 100 })
          break

        case 'result': {
          const sourceLang = pendingTranslations.current.get(msg.id)
          pendingTranslations.current.delete(msg.id)

          if (!msg.text || !sourceLang) break

          const targetLang: Language = sourceLang === 'es' ? 'en' : 'es'
          setDetectedLang(sourceLang)

          const entry: TranscriptEntry = {
            id: msg.id,
            role: 'assistant',
            text: msg.text,
            lang: targetLang,
            timestamp: new Date(),
          }
          setTranscript(prev => [...prev, entry])
          setCurrentText('')

          // TTS: leer la traducción en voz alta
          speak(msg.text, targetLang)
          break
        }

        case 'error':
          console.error('[OfflineInterpreter] Worker error:', msg.message)
          if (!sessionActiveRef.current) return
          setError(msg.message)
          setState('error')
          break
      }
    }

    worker.onerror = (e) => {
      setError(`Error en el worker de traducción: ${e.message}`)
      setState('error')
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [speak])

  // ── SpeechRecognition: configurar ─────────────────────────────

  const buildRecognition = useCallback((): SpeechRecognition | null => {
    if (typeof window === 'undefined') return null

    const SR = window.SpeechRecognition || (window as Window & typeof globalThis & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) {
      setError('SpeechRecognition no está disponible en este navegador. Usá Chrome o Edge.')
      return null
    }

    const r = new SR()
    // Sin lang fijo — detectamos el idioma con heurística después
    r.lang = 'es-ES' // hint inicial; el usuario puede cambiar
    r.continuous = false
    r.interimResults = true
    r.maxAlternatives = 1

    r.onresult = (e) => {
      const result = e.results[e.results.length - 1]
      const text = result[0].transcript.trim()

      if (result.isFinal && text.length > 2) {
        setCurrentText('')

        const srcLang = detectLang(text)
        setDetectedLang(srcLang)

        // Agregar al transcript lo que dijo el usuario
        const userEntry: TranscriptEntry = {
          id: `${Date.now()}-user`,
          role: 'user',
          text,
          lang: srcLang,
          timestamp: new Date(),
        }
        setTranscript(prev => [...prev, userEntry])

        // Enviar al worker para traducir
        const id = `${Date.now()}-${Math.random()}`
        const direction = srcLang === 'es' ? 'es-en' : 'en-es'
        pendingTranslations.current.set(id, srcLang)
        workerRef.current?.postMessage({ type: 'translate', id, text, direction })
      } else {
        setCurrentText(text)
      }
    }

    r.onend = () => {
      if (!sessionActiveRef.current) return
      // En modo auto y si no hay traducción activa, reiniciamos
      if (autoModeRef.current && state !== 'translating') {
        try { r.start() } catch { /* ya activo */ }
      } else if (!autoModeRef.current) {
        setState('ready')
      }
    }

    r.onerror = (e) => {
      if (e.error === 'no-speech') return // silencio → ignorar
      if (e.error === 'aborted') return   // detenido manualmente
      setError(`Error de reconocimiento: ${e.error}`)
      setState('error')
    }

    return r
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // ── Control de sesión ─────────────────────────────────────────

  const startSession = useCallback(() => {
    if (!workerRef.current) return
    sessionActiveRef.current = true
    loadedRef.current = false
    setError(null)
    setState('loading')
    setProgress({ message: 'Iniciando modelos de traducción…', percent: 0 })
    workerRef.current.postMessage({ type: 'load' })
  }, [])

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false
    loadedRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current?.abort()
    recognitionRef.current = null
    window.speechSynthesis?.cancel()
    setState('idle')
    setCurrentText('')
  }, [])

  // ── Control de mic ────────────────────────────────────────────

  const startListening = useCallback(() => {
    if (state !== 'ready') return
    const r = buildRecognition()
    if (!r) return
    recognitionRef.current = r
    setState('listening')
    try { r.start() } catch (e) { console.warn('Recognition start error:', e) }
  }, [state, buildRecognition])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    if (sessionActiveRef.current) setState('ready')
  }, [])

  // Auto-iniciar en modo automático cuando el estado es 'ready'
  useEffect(() => {
    if (autoMode && state === 'ready' && sessionActiveRef.current) {
      startListening()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, state])

  const clearTranscript = useCallback(() => {
    setTranscript([])
    setCurrentText('')
  }, [])

  const translateText = useCallback(async (text: string, fromLang: Language) => {
    if (state === 'idle') {
      startSession()
    }
    
    // Esperar a que los modelos estén cargados
    let attempts = 0
    while (!loadedRef.current && attempts < 100) {
      await new Promise(r => setTimeout(r, 100))
      attempts++
    }

    if (!loadedRef.current) {
      setError('Los modelos locales de traducción no se cargaron a tiempo.')
      return
    }

    // Agregar al transcript lo que escribió el usuario
    const userEntry: TranscriptEntry = {
      id: `${Date.now()}-user`,
      role: 'user',
      text,
      lang: fromLang,
      timestamp: new Date(),
    }
    setTranscript(prev => [...prev, userEntry])
    setDetectedLang(fromLang)

    const id = `${Date.now()}-${Math.random()}`
    const direction = fromLang === 'es' ? 'es-en' : 'en-es'
    pendingTranslations.current.set(id, fromLang)
    
    setState('translating')
    workerRef.current?.postMessage({ type: 'translate', id, text, direction })
  }, [startSession, state])

  return {
    state,
    transcript,
    currentText,
    detectedLang,
    error,
    progress,
    autoMode,
    setAutoMode,
    startSession,
    stopSession,
    startListening,
    stopListening,
    clearTranscript,
    ttsRate,
    setTtsRate,
    ttsVolume,
    setTtsVolume,
    translateText,
  }
}
