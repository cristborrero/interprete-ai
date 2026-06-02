/**
 * useGeminiLive.ts
 * ─────────────────────────────────────────────────────────────────
 * Hook que maneja la conexión WebSocket con Gemini Live API
 * para interpretación bidireccional Español ↔ English en tiempo real.
 *
 * Modelo: gemini-2.5-flash-live (audio-to-audio, nativo)
 * Protocolo: BidiGenerateContent via WebSocket
 * ─────────────────────────────────────────────────────────────────
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Tipos ─────────────────────────────────────────────────────────

export type SessionState =
  | 'idle'        // sin sesión
  | 'connecting'  // abriendo WebSocket
  | 'ready'       // conectado, esperando
  | 'listening'   // grabando audio del usuario
  | 'translating' // Gemini procesando / reproduciendo
  | 'error'       // error de conexión

export type Language = 'es' | 'en'

export interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  lang: Language
  timestamp: Date
}

export interface UseGeminiLiveReturn {
  state: SessionState
  transcript: TranscriptEntry[]
  currentText: string          // texto parcial en streaming
  detectedLang: Language | null
  error: string | null
  autoMode: boolean
  setAutoMode: (enabled: boolean) => void
  startSession: () => Promise<void>
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

// ── Constantes ────────────────────────────────────────────────────

// Modelo se resuelve dinámicamente desde /api/gemini-token
// (el servidor consulta qué modelos Live están disponibles para la key)
const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

const SYSTEM_PROMPT = `You are a professional simultaneous interpreter specializing in Spanish and English.

CORE RULES:
1. Listen to what is said and detect the language automatically.
2. If you hear SPANISH → translate to ENGLISH immediately, naturally, without pauses.
3. If you hear ENGLISH → translate to SPANISH immediately, naturally, without pauses.
4. Do NOT add commentary, explanations, or greetings. Only the translation.
5. Preserve the speaker's tone (formal, informal, urgent, calm).
6. For medical contexts: use correct medical terminology in both languages.
7. Translate continuously — do not wait for the speaker to fully finish if a sentence is complete.
8. Start translating immediately after each sentence or phrase is clear.

CONTEXT: This is being used in medical appointments and professional settings in the UK.
The user is Colombian Spanish-speaking communicating with English-speaking professionals.`

const AUDIO_CONFIG = {
  sampleRateHertz: 16000,
  encoding: 'LINEAR16',
}

// ── Hook ──────────────────────────────────────────────────────────

export function useGeminiLive(): UseGeminiLiveReturn {
  const [state, setState] = useState<SessionState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [currentText, setCurrentText] = useState('')
  const [detectedLang, setDetectedLang] = useState<Language | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoMode, setAutoModeState] = useState(false)

  const [ttsRate, setTtsRateState] = useState(0.95)
  const [ttsVolume, setTtsVolumeState] = useState(1.0)

  const wsRef = useRef<WebSocket | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const apiKeyRef = useRef<{ key: string; model: string } | null>(null)
  const partialTextRef = useRef('')
  const sessionActiveRef = useRef(false)
  const autoModeRef = useRef(false)

  const setupCompleteRef = useRef(false)
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

  const setAutoMode = useCallback((enabled: boolean) => {
    autoModeRef.current = enabled
    setAutoModeState(enabled)
  }, [])

  // ── Obtener API key + modelo del servidor ────────────────────

  const fetchApiKey = useCallback(async (): Promise<{ key: string; model: string }> => {
    if (apiKeyRef.current) return apiKeyRef.current
    const res = await fetch('/api/gemini-token')
    if (!res.ok) throw new Error('No se pudo obtener la API key')
    const data = await res.json()
    apiKeyRef.current = data
    return data
  }, [])

  // ── Detectar idioma en el texto ───────────────────────────────

  const detectLanguage = (text: string): Language => {
    // Patrones simples para detección rápida
    const spanishMarkers = /\b(el|la|los|las|un|una|que|de|en|con|por|para|es|son|tiene|está|pero|como|cuando|también|más)\b/gi
    const englishMarkers = /\b(the|a|an|is|are|was|were|have|has|with|for|that|this|but|and|or|it|he|she|they)\b/gi
    const esMatches = (text.match(spanishMarkers) || []).length
    const enMatches = (text.match(englishMarkers) || []).length
    return esMatches >= enMatches ? 'es' : 'en'
  }

  // ── Enviar mensaje de setup al conectar ───────────────────────

  // ── TTS: leer la traducción en voz alta ──────────────────────

  const speak = useCallback((text: string, lang: Language) => {
    if (typeof window === 'undefined') return
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang === 'es' ? 'es-ES' : 'en-GB'
    utter.rate = ttsRateRef.current
    utter.volume = ttsVolumeRef.current
    const voices = window.speechSynthesis.getVoices()
    const match = voices.find(v => v.lang.startsWith(lang === 'es' ? 'es' : 'en') && v.localService)
    if (match) utter.voice = match
    utter.onend = () => {
      if (sessionActiveRef.current) {
        setState(autoModeRef.current ? 'listening' : 'ready')
      }
    }
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }, [])

  const sendSetup = useCallback((ws: WebSocket, model: string) => {
    const setup = {
      setup: {
        model: `models/${model}`,
        generation_config: {
          // Solo TEXT — AUDIO+TEXT no está soportado en los modelos live preview
          response_modalities: ['TEXT'],
        },
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
      },
    }
    ws.send(JSON.stringify(setup))
  }, [])

  // ── Manejar mensajes entrantes de Gemini ─────────────────────

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)

      // Setup confirmado
      if (data.setupComplete) {
        setupCompleteRef.current = true
        setState('ready')
        return
      }

      // Respuesta del modelo (solo TEXT)
      if (data.serverContent?.modelTurn?.parts) {
        const parts = data.serverContent.modelTurn.parts
        for (const part of parts) {
          if (part.text) {
            setState('translating')
            partialTextRef.current += part.text
            setCurrentText(partialTextRef.current)
          }
        }
      }

      // Turno completo
      if (data.serverContent?.turnComplete) {
        const fullText = partialTextRef.current.trim()
        if (fullText) {
          const lang = detectLanguage(fullText)
          setDetectedLang(lang)
          const entry: TranscriptEntry = {
            id: `${Date.now()}-${Math.random()}`,
            role: 'assistant',
            text: fullText,
            lang,
            timestamp: new Date(),
          }
          setTranscript(prev => [...prev, entry])
          partialTextRef.current = ''
          setCurrentText('')
          // TTS: leer la traducción en voz alta
          speak(fullText, lang)
        } else if (sessionActiveRef.current) {
          setState(autoModeRef.current ? 'listening' : 'ready')
        }
      }

      // Interrupción (usuario habló mientras se leía la traducción)
      if (data.serverContent?.interrupted) {
        window.speechSynthesis?.cancel()
        partialTextRef.current = ''
        setCurrentText('')
        setState('listening')
      }

    } catch (e) {
      console.error('Error parsing Gemini message:', e)
    }
  }, [speak])

  // ── Iniciar sesión WebSocket ──────────────────────────────────

  const startSession = useCallback(async () => {
    try {
      setState('connecting')
      setError(null)
      setupCompleteRef.current = false

      const { key, model } = await fetchApiKey()
      console.log('[useGeminiLive] Connecting with model:', model)
      const url = `${WS_BASE}?key=${key}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        sendSetup(ws, model)
        sessionActiveRef.current = true
      }

      ws.onmessage = handleMessage

      ws.onerror = () => {
        setError('Error de conexión con Gemini API. Verifica tu API key.')
        setState('error')
        sessionActiveRef.current = false
      }

      ws.onclose = (ev) => {
        sessionActiveRef.current = false
        if (state !== 'idle') {
          setState('idle')
        }
        console.log('WebSocket cerrado:', ev.code, ev.reason)
      }

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setError(msg)
      setState('error')
    }
  }, [fetchApiKey, handleMessage, sendSetup, state])

  // ── Cerrar sesión ─────────────────────────────────────────────

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false
    setupCompleteRef.current = false
    stopListeningInternal()
    window.speechSynthesis?.cancel()
    wsRef.current?.close()
    wsRef.current = null
    setState('idle')
    setCurrentText('')
    partialTextRef.current = ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Captura de audio interno ──────────────────────────────────

  const stopListeningInternal = useCallback(() => {
    processorRef.current?.disconnect()
    processorRef.current = null
    audioContextRef.current?.close()
    audioContextRef.current = null
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    mediaStreamRef.current = null
  }, [])

  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    if (state !== 'ready') return

    try {
      setState('listening')

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      mediaStreamRef.current = stream

      const ctx = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      // ScriptProcessor deprecated pero ampliamente soportado en móvil
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

        const float32 = e.inputBuffer.getChannelData(0)
        // Convertir Float32 → Int16 (LINEAR16)
        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768))
        }

        // Base64 encode
        const uint8 = new Uint8Array(int16.buffer)
        let binary = ''
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
        const b64 = btoa(binary)

        const msg = {
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/pcm;rate=16000',
              data: b64,
            }],
          },
        }
        wsRef.current.send(JSON.stringify(msg))
      }

      source.connect(processor)
      processor.connect(ctx.destination)

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error de micrófono'
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError('Permiso de micrófono denegado. Actívalo en la configuración del navegador.')
      } else {
        setError(msg)
      }
      setState('ready')
    }
  }, [state])

  const stopListening = useCallback(() => {
    stopListeningInternal()
    if (sessionActiveRef.current) {
      setState('ready')
    }
    // Enviar señal de fin de turno a Gemini
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ clientContent: { turnComplete: true } }))
    }
  }, [stopListeningInternal])

  const clearTranscript = useCallback(() => {
    setTranscript([])
    setCurrentText('')
    partialTextRef.current = ''
  }, [])

  // Auto-iniciar mic cuando el modo automático está activo y la sesión está lista
  useEffect(() => {
    if (autoMode && state === 'ready' && sessionActiveRef.current) {
      startListening()
    }
  // startListening se estabiliza con useCallback — es seguro incluirlo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, state])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopSession()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const translateText = useCallback(async (text: string, fromLang: Language) => {
    let ws = wsRef.current
    if (!sessionActiveRef.current || !ws || ws.readyState !== WebSocket.OPEN) {
      await startSession()
      let attempts = 0
      while (!setupCompleteRef.current && attempts < 50) {
        await new Promise(r => setTimeout(r, 100))
        attempts++
      }
      ws = wsRef.current
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('No se pudo establecer la conexión con Gemini Live.')
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

    setState('translating')
    partialTextRef.current = ''
    setCurrentText('')

    const msg = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text: text }]
        }],
        turnComplete: true
      }
    }
    ws.send(JSON.stringify(msg))
  }, [startSession])

  return {
    state,
    transcript,
    currentText,
    detectedLang,
    error,
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
