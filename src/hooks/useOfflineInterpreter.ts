import { useState, useEffect, useRef, useCallback } from 'react'

type Language = 'es' | 'en'

type OfflineState = 'idle' | 'loading' | 'ready' | 'listening' | 'translating' | 'error'

interface OfflineProgress {
  message: string
  percent: number
}

interface TranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  lang: Language
  timestamp: Date
}

interface SpeechAwareWindow extends Window {
  SpeechRecognition?: any
  webkitSpeechRecognition?: any
}

interface UseOfflineInterpreterReturn {
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
  const ttsWorkerRef = useRef<Worker | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  
  const recognitionRef = useRef<any>(null)
  const sessionActiveRef = useRef(false)
  const autoModeRef = useRef(false)
  const pendingTranslations = useRef<Map<string, Language>>(new Map())

  const mtLoadedRef = useRef(false)
  const ttsLoadedRef = useRef(false)
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

  const checkAllLoaded = useCallback(() => {
    if (mtLoadedRef.current && ttsLoadedRef.current) {
      loadedRef.current = true
      setState('ready')
      setProgress({ message: 'Listo — motores IA cargados', percent: 100 })
    }
  }, [])

  // ── TTS: sintetizar la traducción en voz (Kokoro-82M) ──────────────

  const speak = useCallback((text: string, lang: Language) => {
    if (typeof window === 'undefined') return
    if (!ttsWorkerRef.current) return

    setState('translating')

    if (currentAudioSourceRef.current) {
      try { currentAudioSourceRef.current.stop() } catch {}
      currentAudioSourceRef.current.disconnect()
      currentAudioSourceRef.current = null
    }

    ttsWorkerRef.current.postMessage({
      action: 'speak',
      text,
      voice: lang === 'es' ? 'ef_dora' : 'am_adam'
    })
  }, [])

  // ── Web Workers: inicializar y manejar mensajes ────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Traductor (OPUS-MT)
    const worker = new Worker(
      new URL('../workers/translation.worker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data

      switch (msg.type) {
        case 'progress':
          // Solo mostramos progreso del traductor o podemos dividirlo
          if (!mtLoadedRef.current) {
            setProgress({ message: `Traductor: ${msg.message}`, percent: (msg.percent ?? 0) / 2 })
          }
          break

        case 'loaded':
          mtLoadedRef.current = true
          checkAllLoaded()
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

          // TTS: leer la traducción en voz alta usando Kokoro
          speak(msg.text, targetLang)
          break
        }

        case 'error':
          console.error('[OfflineInterpreter] MT Worker error:', msg.message)
          if (!sessionActiveRef.current) return
          setError(msg.message)
          setState('error')
          break
      }
    }

    worker.onerror = (e: ErrorEvent) => {
      setError(`Error en el worker de traducción: ${e.message}`)
      setState('error')
    }

    // TTS (Kokoro-82M)
    const ttsWorker = new Worker(
      new URL('../workers/tts.worker.ts', import.meta.url),
      { type: 'module' }
    )
    ttsWorkerRef.current = ttsWorker

    ttsWorker.onmessage = (e: MessageEvent) => {
      const msg = e.data
      if (msg.status === 'ready') {
        ttsLoadedRef.current = true
        checkAllLoaded()
      } else if (msg.status === 'complete') {
        const audioData = msg.audioData
        const sampleRate = msg.sampleRate
        
        if (!audioContextRef.current) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
          audioContextRef.current = new AudioCtx()
        }
        const ctx = audioContextRef.current
        if (ctx.state === 'suspended') ctx.resume()

        const buffer = ctx.createBuffer(1, audioData.length, sampleRate)
        buffer.getChannelData(0).set(audioData)
        
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(ctx.destination)
        currentAudioSourceRef.current = source

        source.onended = () => {
          if (sessionActiveRef.current) {
            setState(autoModeRef.current ? 'listening' : 'ready')
            if (autoModeRef.current && recognitionRef.current) {
              try { recognitionRef.current.start() } catch { /* ya iniciado */ }
            }
          }
        }
        source.start()
      } else if (msg.status === 'error') {
        console.error('[OfflineInterpreter] TTS Worker error:', msg.error)
        if (sessionActiveRef.current) setState('ready')
      }
    }
    
    ttsWorker.onerror = (e: ErrorEvent) => {
      setError(`Error en el worker de TTS: ${e.message}`)
      setState('error')
    }

    return () => {
      worker.terminate()
      workerRef.current = null
      ttsWorker.terminate()
      ttsWorkerRef.current = null
      
      if (currentAudioSourceRef.current) {
        try { currentAudioSourceRef.current.stop() } catch {}
        currentAudioSourceRef.current.disconnect()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [speak, checkAllLoaded])

  // ── SpeechRecognition: configurar ─────────────────────────────

  const buildRecognition = useCallback((): any | null => {
    if (typeof window === 'undefined') return null

    const w = window as SpeechAwareWindow
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) {
      setError('SpeechRecognition no está disponible en este navegador. Usá Chrome o Edge.')
      return null
    }

    const r = new SR()
    r.lang = 'es-ES' // hint inicial
    r.continuous = false
    r.interimResults = true
    r.maxAlternatives = 1

    r.onresult = (e: any) => {
      const result = e.results[e.results.length - 1]
      const text = result[0].transcript.trim()

      if (result.isFinal && text.length > 2) {
        setCurrentText('')

        const srcLang = detectLang(text)
        setDetectedLang(srcLang)

        const userEntry: TranscriptEntry = {
          id: `${Date.now()}-user`,
          role: 'user',
          text,
          lang: srcLang,
          timestamp: new Date(),
        }
        setTranscript(prev => [...prev, userEntry])

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
      if (autoModeRef.current && state !== 'translating') {
        try { r.start() } catch { /* ya activo */ }
      } else if (!autoModeRef.current) {
        setState('ready')
      }
    }

    r.onerror = (e: any) => {
      if (e.error === 'no-speech') return
      if (e.error === 'aborted') return
      setError(`Error de reconocimiento: ${e.error}`)
      setState('error')
    }

    return r
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // ── Control de sesión ─────────────────────────────────────────

  const startSession = useCallback(() => {
    if (!workerRef.current || !ttsWorkerRef.current) return
    sessionActiveRef.current = true
    mtLoadedRef.current = false
    ttsLoadedRef.current = false
    loadedRef.current = false
    setError(null)
    setState('loading')
    setProgress({ message: 'Iniciando motores de IA (Traducción + Kokoro TTS)...', percent: 0 })
    
    // Iniciar ambos motores
    workerRef.current.postMessage({ type: 'load' })
    ttsWorkerRef.current.postMessage({ action: 'init' })
  }, [])

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false
    loadedRef.current = false
    mtLoadedRef.current = false
    ttsLoadedRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current?.abort()
    recognitionRef.current = null
    
    if (currentAudioSourceRef.current) {
      try { currentAudioSourceRef.current.stop() } catch {}
      currentAudioSourceRef.current.disconnect()
      currentAudioSourceRef.current = null
    }
    
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
    
    let attempts = 0
    while (!loadedRef.current && attempts < 100) {
      await new Promise(r => setTimeout(r, 100))
      attempts++
    }

    if (!loadedRef.current) {
      setError('Los motores de IA locales no se cargaron a tiempo.')
      return
    }

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
