'use client'

/**
 * useInterpreter.ts
 * ─────────────────────────────────────────────────────────────────
 * Hook principal del intérprete simultáneo ES ↔ EN.
 *
 * STT  → Azure AI Speech (con Language ID) o Web Speech API (fallback)
 * TTS  → Azure Neural Voices o window.speechSynthesis (fallback)
 * MTx  → POST /api/translate (OpenRouter → gemini-3.1-flash-lite)
 *
 * Modos:
 *  - Manual (PTT): el usuario mantiene presionado para hablar
 *  - Auto: STT con Language ID → traduce → TTS habla → STT vuelve a escuchar solo
 * ─────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Tipos ─────────────────────────────────────────────────────────

export type Language = 'es' | 'en'

export type SessionState =
  | 'idle'        // sin sesión
  | 'ready'       // esperando input
  | 'listening'   // grabando voz del usuario
  | 'translating' // llamada a la API en curso
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

// ── Detección de idioma por heurística (fallback) ─────────────────

export function detectLang(text: string): Language {
  const esMarkers = /\b(el|la|los|las|un|una|que|de|en|con|por|para|es|son|tiene|está|estoy|pero|como|cuando|también|más|me|mi|tu|su|no|sí|muy|bien|gracias|buenos|días|hola|quiero|tengo|necesito|puedo|hacer|este|eso|aquí|ahora|todo|nada|ya|hay|ser|por|favor)\b/gi
  const enMarkers = /\b(the|a|an|is|are|was|were|have|has|with|for|that|this|but|and|or|it|he|she|they|we|you|I|my|your|please|thank|yes|no|good|hello|want|need|can|do|here|now|all|nothing|already|there|be|could|would|should|get|go)\b/gi

  const esCount = (text.match(esMarkers) ?? []).length
  const enCount = (text.match(enMarkers) ?? []).length

  // Si hay acento o ñ, es español sin dudas
  if (/[áéíóúüñ¿¡]/i.test(text)) return 'es'

  return esCount >= enCount ? 'es' : 'en'
}

// ── Constantes de timing ──────────────────────────────────────────

/** Pausa después de que el TTS termina antes de volver a escuchar (ms) */
const AUTO_RESTART_DELAY_MS = 800

/** Pausa mínima entre el fin del reconocimiento y el reinicio (ms) */
const AUTO_LISTEN_DEBOUNCE_MS = 500

// ── Hook ──────────────────────────────────────────────────────────

export function useInterpreter() {
  const [state, setState] = useState<SessionState>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [autoMode, setAutoMode] = useState(true)
  const [activeListeningLang, setActiveListeningLang] = useState<Language>('es')

  // Voces disponibles del sistema (para fallback nativo)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [esVoice, setEsVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [enVoice, setEnVoice] = useState<SpeechSynthesisVoice | null>(null)

  const azureTokenRef = useRef<{ token: string; region: string } | null>(null)
  const recognitionRef = useRef<any>(null)
  const sessionActiveRef = useRef(false)
  const autoModeRef = useRef(true)
  const isTranslatingRef = useRef(false)
  const isSpeakingRef = useRef(false)
  const autoRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync autoMode state → ref (el ref lo leen los callbacks asincrónicos)
  useEffect(() => {
    autoModeRef.current = autoMode
  }, [autoMode])

  // ── Helpers internos ──────────────────────────────────────────

  const clearAutoRestartTimer = () => {
    if (autoRestartTimerRef.current) {
      clearTimeout(autoRestartTimerRef.current)
      autoRestartTimerRef.current = null
    }
  }

  const fetchAzureToken = async () => {
    try {
      const res = await fetch('/api/azure-token')
      if (!res.ok) throw new Error('Token fetch failed')
      const data = await res.json()
      azureTokenRef.current = data
      return data
    } catch (e) {
      console.error('[useInterpreter] Failed to fetch Azure token:', e)
      return null
    }
  }

  // ── Cargar voces del sistema (fallback nativo) ──────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return

    const synth = window.speechSynthesis
    if (!synth) {
      console.warn('[useInterpreter] window.speechSynthesis no está disponible en este navegador.')
      return
    }

    const loadVoices = () => {
      try {
        const voices = synth.getVoices()
        if (voices.length === 0) return

        setAvailableVoices(voices)

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
      } catch (e) {
        console.warn('[useInterpreter] Error al cargar voces:', e)
      }
    }

    loadVoices()
    try {
      synth.onvoiceschanged = loadVoices
    } catch (e) {
      console.warn('[useInterpreter] Error al asignar onvoiceschanged:', e)
    }

    return () => {
      try {
        synth.onvoiceschanged = null
      } catch (e) {
        // Silencioso
      }
    }
  }, [])

  // ── TTS (Síntesis de voz) ──────────────────────────────────────

  const speakNativeFallback = useCallback((text: string, lang: Language, onEnd?: () => void) => {
    const synth = window.speechSynthesis
    if (!synth || !window.SpeechSynthesisUtterance) {
      console.warn('[useInterpreter] TTS nativo no soportado')
      onEnd?.()
      if (sessionActiveRef.current) {
        if (autoModeRef.current) {
          clearAutoRestartTimer()
          autoRestartTimerRef.current = setTimeout(() => {
            if (sessionActiveRef.current && autoModeRef.current) {
              startListeningInternal()
            }
          }, AUTO_RESTART_DELAY_MS)
        } else {
          setState('ready')
        }
      }
      return
    }

    try {
      synth.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang === 'es' ? 'es-ES' : 'en-GB'

      const voice = lang === 'es' ? esVoice : enVoice
      if (voice) utter.voice = voice

      utter.rate = 0.95
      utter.pitch = 1.0
      utter.volume = 1.0

      isSpeakingRef.current = true
      setState('speaking')

      utter.onend = () => {
        isSpeakingRef.current = false
        onEnd?.()

        if (!sessionActiveRef.current) return

        if (autoModeRef.current) {
          clearAutoRestartTimer()
          autoRestartTimerRef.current = setTimeout(() => {
            if (sessionActiveRef.current && autoModeRef.current) {
              startListeningInternal()
            }
          }, AUTO_RESTART_DELAY_MS)
        } else {
          setState('ready')
        }
      }

      utter.onerror = (e) => {
        console.warn('[useInterpreter] Native TTS error:', e)
        isSpeakingRef.current = false
        if (sessionActiveRef.current) {
          if (autoModeRef.current) {
            clearAutoRestartTimer()
            autoRestartTimerRef.current = setTimeout(() => {
              if (sessionActiveRef.current && autoModeRef.current) {
                startListeningInternal()
              }
            }, AUTO_RESTART_DELAY_MS)
          } else {
            setState('ready')
          }
        }
      }

      synth.speak(utter)
    } catch (e) {
      console.error('[useInterpreter] Native TTS crash:', e)
      isSpeakingRef.current = false
      if (sessionActiveRef.current) setState('ready')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esVoice, enVoice])

  const speak = useCallback((text: string, lang: Language, onEnd?: () => void) => {
    if (typeof window === 'undefined') return

    const azureConfig = azureTokenRef.current
    if (azureConfig && azureConfig.token) {
      // Usar Azure TTS
      import('microsoft-cognitiveservices-speech-sdk').then((SDK) => {
        try {
          const speechConfig = SDK.SpeechConfig.fromAuthorizationToken(azureConfig.token!, azureConfig.region!)
          // Configurar voces neurales premium automáticas
          speechConfig.speechSynthesisVoiceName = lang === 'es' ? 'es-CO-SalomeNeural' : 'en-GB-SoniaNeural'

          const synthesizer = new SDK.SpeechSynthesizer(speechConfig)
          
          isSpeakingRef.current = true
          setState('speaking')

          synthesizer.speakTextAsync(
            text,
            result => {
              isSpeakingRef.current = false
              synthesizer.close()

              if (result.reason === SDK.ResultReason.SynthesizingAudioCompleted) {
                onEnd?.()

                if (!sessionActiveRef.current) return

                if (autoModeRef.current) {
                  clearAutoRestartTimer()
                  autoRestartTimerRef.current = setTimeout(() => {
                    if (sessionActiveRef.current && autoModeRef.current) {
                      startListeningInternal()
                    }
                  }, AUTO_RESTART_DELAY_MS)
                } else {
                  setState('ready')
                }
              } else {
                console.warn('[useInterpreter] Azure TTS no completado:', result.errorDetails)
                if (sessionActiveRef.current) {
                  if (autoModeRef.current) {
                    startListeningInternal()
                  } else {
                    setState('ready')
                  }
                }
              }
            },
            err => {
              console.error('[useInterpreter] Azure TTS error:', err)
              isSpeakingRef.current = false
              synthesizer.close()
              if (sessionActiveRef.current) setState('ready')
            }
          )
        } catch (e) {
          console.error('[useInterpreter] Error configurando Azure TTS:', e)
          isSpeakingRef.current = false
          speakNativeFallback(text, lang, onEnd)
        }
      }).catch(err => {
        console.error('[useInterpreter] Error cargando SDK de Azure para TTS:', err)
        speakNativeFallback(text, lang, onEnd)
      })
    } else {
      speakNativeFallback(text, lang, onEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakNativeFallback])

  // ── Traducción via REST ───────────────────────────────────────

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

      const entry: TranscriptEntry = {
        id: `${Date.now()}-assist`,
        role: 'assistant',
        text: data.translation,
        lang: toLang,
        timestamp: new Date(),
      }
      setTranscript(prev => [...prev, entry])
      setActiveListeningLang(toLang)

      if (sessionActiveRef.current) {
        speak(data.translation, toLang)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error de traducción'
      console.error('[useInterpreter] translate error:', msg)
      setError(msg)

      // Incluso con error, en modo auto volver a escuchar
      if (sessionActiveRef.current) {
        if (autoModeRef.current) {
          clearAutoRestartTimer()
          autoRestartTimerRef.current = setTimeout(() => {
            if (sessionActiveRef.current) startListeningInternal()
          }, AUTO_RESTART_DELAY_MS)
        } else {
          setState('ready')
        }
      }
    } finally {
      isTranslatingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak])

  // ── SpeechRecognition (fallback nativo) ──────────────────────────

  const buildRecognition = useCallback((): SpeechRecognition | null => {
    if (typeof window === 'undefined') return null
    const w = window as SpeechAwareWindow
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) {
      setError('SpeechRecognition no está disponible. Usá Chrome o Edge.')
      return null
    }

    const r = new SR()
    r.lang = activeListeningLang === 'es' ? 'es-ES' : 'en-GB'
    r.continuous = false
    r.interimResults = true
    r.maxAlternatives = 1

    r.onresult = (e: SpeechRecognitionEvent) => {
      const result = e.results[e.results.length - 1]
      const text = result[0].transcript.trim()

      if (result.isFinal && text.length > 1) {
        setInterimText('')

        const srcLang = activeListeningLang

        const userEntry: TranscriptEntry = {
          id: `${Date.now()}-user`,
          role: 'user',
          text,
          lang: srcLang,
          timestamp: new Date(),
        }
        setTranscript(prev => [...prev, userEntry])

        translate(text, srcLang)
      } else {
        setInterimText(text)
      }
    }

    r.onend = () => {
      if (!sessionActiveRef.current) return
      if (isTranslatingRef.current || isSpeakingRef.current) return

      if (autoModeRef.current) {
        clearAutoRestartTimer()
        autoRestartTimerRef.current = setTimeout(() => {
          if (sessionActiveRef.current && autoModeRef.current) {
            startListeningInternal()
          }
        }, AUTO_LISTEN_DEBOUNCE_MS)
      } else {
        setState('ready')
      }
    }

    r.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech') {
        if (autoModeRef.current && sessionActiveRef.current) {
          clearAutoRestartTimer()
          autoRestartTimerRef.current = setTimeout(() => {
            if (sessionActiveRef.current && autoModeRef.current) {
              startListeningInternal()
            }
          }, AUTO_LISTEN_DEBOUNCE_MS)
        }
        return
      }
      if (e.error === 'aborted') return
      if (e.error === 'not-allowed') {
        setError('Permiso de micrófono denegado. Habilitalo en la configuración del navegador.')
        setState('error')
        return
      }
      console.warn('[useInterpreter] SpeechRecognition error:', e.error)
      if (sessionActiveRef.current) setState('ready')
    }

    return r
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translate, activeListeningLang])

  // ── startListeningInternal (ciclo de captura) ──────────────────

  const startListeningInternalRef = useRef<() => void>(() => {})

  const startListeningInternal = useCallback(() => {
    startListeningInternalRef.current()
  }, [])

  const fallbackToNativeRecognition = useCallback(() => {
    const r = buildRecognition()
    if (!r) return

    if (recognitionRef.current) {
      try {
        if (typeof recognitionRef.current.close === 'function') {
          recognitionRef.current.close()
        } else if (typeof recognitionRef.current.abort === 'function') {
          recognitionRef.current.abort()
        }
      } catch (e) {}
    }
    recognitionRef.current = r

    setState('listening')
    try {
      r.start()
    } catch (e) {
      console.warn('[useInterpreter] Native recognition start error:', e)
      setState('ready')
    }
  }, [buildRecognition])

  useEffect(() => {
    startListeningInternalRef.current = async () => {
      if (!sessionActiveRef.current) return
      if (isTranslatingRef.current || isSpeakingRef.current) return

      let azureConfig = azureTokenRef.current
      if (!azureConfig) {
        azureConfig = await fetchAzureToken()
      }

      if (azureConfig && azureConfig.token) {
        try {
          const SDK = await import('microsoft-cognitiveservices-speech-sdk')
          const speechConfig = SDK.SpeechConfig.fromAuthorizationToken(azureConfig.token, azureConfig.region)
          const audioConfig = SDK.AudioConfig.fromDefaultMicrophoneInput()

          let recognizer: any
          if (autoModeRef.current) {
            // Auto detección bilingüe (español e inglés)
            const autoDetectConfig = SDK.AutoDetectSourceLanguageConfig.fromLanguages(['es-ES', 'en-US'])
            recognizer = SDK.SpeechRecognizer.FromConfig(speechConfig, autoDetectConfig, audioConfig)
          } else {
            // Modo manual (PTT): usar el idioma seleccionado activamente
            speechConfig.speechRecognitionLanguage = activeListeningLang === 'es' ? 'es-ES' : 'en-US'
            recognizer = new SDK.SpeechRecognizer(speechConfig, audioConfig)
          }

          if (recognitionRef.current) {
            try {
              recognitionRef.current.close()
            } catch (e) {}
          }
          recognitionRef.current = recognizer

          setState('listening')

          recognizer.recognizing = (sender: any, event: any) => {
            setInterimText(event.result.text || '')
          }

          recognizer.recognizeOnceAsync(
            async (result: any) => {
              recognizer.close()
              if (recognitionRef.current === recognizer) {
                recognitionRef.current = null
              }

              if (result.reason === SDK.ResultReason.RecognizedSpeech) {
                setInterimText('')

                let srcLang = activeListeningLang
                if (autoModeRef.current) {
                  const autoDetectResult = SDK.AutoDetectSourceLanguageResult.fromResult(result)
                  srcLang = autoDetectResult.language.startsWith('es') ? 'es' : 'en'
                }

                const userEntry: TranscriptEntry = {
                  id: `${Date.now()}-user`,
                  role: 'user',
                  text: result.text,
                  lang: srcLang,
                  timestamp: new Date(),
                }
                setTranscript(prev => [...prev, userEntry])
                setActiveListeningLang(srcLang === 'es' ? 'en' : 'es')

                await translate(result.text, srcLang)
              } else {
                setInterimText('')
                if (sessionActiveRef.current) {
                  if (autoModeRef.current) {
                    clearAutoRestartTimer()
                    autoRestartTimerRef.current = setTimeout(() => {
                      if (sessionActiveRef.current && autoModeRef.current) {
                        startListeningInternal()
                      }
                    }, AUTO_LISTEN_DEBOUNCE_MS)
                  } else {
                    setState('ready')
                  }
                }
              }
            },
            (err: any) => {
              console.error('[useInterpreter] Azure SpeechSDK error:', err)
              recognizer.close()
              if (recognitionRef.current === recognizer) {
                recognitionRef.current = null
              }
              if (sessionActiveRef.current) {
                if (autoModeRef.current) {
                  startListeningInternal()
                } else {
                  setState('ready')
                }
              }
            }
          )
        } catch (e) {
          console.error('[useInterpreter] Fallo iniciando Azure Speech SDK, usando nativo:', e)
          fallbackToNativeRecognition()
        }
      } else {
        fallbackToNativeRecognition()
      }
    }
  }, [activeListeningLang, translate, buildRecognition, fallbackToNativeRecognition])

  // ── Control de sesión ─────────────────────────────────────────

  const startSession = useCallback(async () => {
    sessionActiveRef.current = true
    setError(null)
    setActiveListeningLang('es')
    setState('ready')

    // Precargar el token de Azure
    await fetchAzureToken()

    // En modo auto, arrancar escuchando de inmediato
    if (autoModeRef.current) {
      setTimeout(() => startListeningInternal(), 300)
    }
  }, [startListeningInternal])

  const stopSession = useCallback(() => {
    clearAutoRestartTimer()
    sessionActiveRef.current = false
    
    if (recognitionRef.current) {
      try {
        if (typeof recognitionRef.current.close === 'function') {
          recognitionRef.current.close()
        } else if (typeof recognitionRef.current.abort === 'function') {
          recognitionRef.current.abort()
        }
      } catch (e) {}
      recognitionRef.current = null
    }

    window.speechSynthesis?.cancel()
    setInterimText('')
    setState('idle')
  }, [])

  // ── Control de micrófono (PTT manual) ──────────────────────────

  const startListening = useCallback(() => {
    if (state !== 'ready' || !sessionActiveRef.current) return
    startListeningInternal()
  }, [state, startListeningInternal])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        if (typeof recognitionRef.current.stop === 'function') {
          recognitionRef.current.stop()
        } else if (typeof recognitionRef.current.close === 'function') {
          recognitionRef.current.close()
        }
      } catch (e) {}
    }
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

  const toggleAutoMode = useCallback(() => {
    setAutoMode(prev => !prev)
  }, [])

  const selectListeningLang = useCallback((lang: Language) => {
    setActiveListeningLang(lang)
    if (sessionActiveRef.current && recognitionRef.current) {
      try {
        if (typeof recognitionRef.current.close === 'function') {
          recognitionRef.current.close()
        } else if (typeof recognitionRef.current.abort === 'function') {
          recognitionRef.current.abort()
        }
      } catch (e) {}
    }
  }, [])

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      clearAutoRestartTimer()
      if (recognitionRef.current) {
        try {
          recognitionRef.current.close()
        } catch (e) {}
      }
      window.speechSynthesis?.cancel()
    }
  }, [])

  return {
    // Estado
    state,
    transcript,
    interimText,
    error,
    autoMode,
    activeListeningLang,

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
    toggleAutoMode,
    selectListeningLang,
  }
}
