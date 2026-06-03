'use client'

/**
 * InterpreterApp.tsx
 * UI compacta y funcional: 2 paneles (ES | EN) + botón central + selector de voz.
 * Soporta modo Auto (ciclo continuo) y modo Manual (PTT).
 */

import { useCallback, useState } from 'react'
import { useInterpreter, detectLang, type Language, type TranscriptEntry } from '@/hooks/useInterpreter'

// ── Iconos inline ─────────────────────────────────────────────────

function IconMic({ active, listening }: { active: boolean; listening: boolean }) {
  return (
    <svg
      className={`w-7 h-7 transition-colors ${listening ? 'text-white' : active ? 'text-orange-400' : 'text-neutral-400'}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

function IconStop() {
  return (
    <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  )
}

function IconCopy({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function IconVolume({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

function IconClear({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function IconAuto({ active }: { active: boolean }) {
  return (
    <svg className={`w-4 h-4 transition-colors ${active ? 'text-green-400' : 'text-neutral-500'}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

// ── Waveform animado ──────────────────────────────────────────────

function Waveform({ active, color = 'bg-orange-400' }: { active: boolean; color?: string }) {
  if (!active) return null
  return (
    <div className="flex items-center gap-[3px] h-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className={`waveform-bar ${color} h-4`} />
      ))}
    </div>
  )
}

// ── Panel de texto (ES o EN) ──────────────────────────────────────

interface PanelProps {
  lang: Language
  lastEntry: TranscriptEntry | null
  interimText: string
  isSource: boolean
  isListening: boolean
  onTranslate: (text: string, from: Language) => void
  onSpeak: (text: string, lang: Language) => void
  onSelect?: () => void
}

function TranslationPanel({ lang, lastEntry, interimText, isSource, isListening, onTranslate, onSpeak, onSelect }: PanelProps) {
  const [editText, setEditText] = useState('')
  const [copied, setCopied] = useState(false)

  const flag = lang === 'es' ? '🇪🇸' : '🇬🇧'
  const label = lang === 'es' ? 'Español' : 'English'
  const placeholder = lang === 'es'
    ? 'Hablá o escribí en español...'
    : 'Speak or type in English...'
  const accentColor = lang === 'es' ? 'text-orange-400' : 'text-blue-400'
  const dotColor = lang === 'es' ? 'bg-orange-400' : 'bg-blue-400'
  const borderActive = lang === 'es'
    ? 'border-orange-500/40 shadow-[0_0_20px_rgba(251,146,60,0.08)]'
    : 'border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.08)]'

  const displayText = lastEntry?.text ?? ''

  const handleCopy = async () => {
    const text = editText.trim() || displayText
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSpeak = () => {
    const text = editText.trim() || displayText
    if (text) onSpeak(text, lang)
  }

  return (
    <div className={`flex flex-col flex-1 rounded-2xl border bg-neutral-900 transition-all duration-300 overflow-hidden
      ${isSource && isListening ? borderActive : 'border-neutral-700/60'}`}>

      {/* Header */}
      <div
        onClick={onSelect}
        className={`flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0 select-none
          ${onSelect ? 'cursor-pointer hover:bg-neutral-800/20 active:bg-neutral-800/40' : ''}`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor} transition-opacity ${isSource && isListening ? 'animate-pulse opacity-100' : 'opacity-30'}`} />
          <span className="text-xs font-bold text-neutral-200 uppercase tracking-widest">
            {flag} {label}
          </span>
          {isSource && isListening && (
            <span className={`text-[10px] font-medium ${accentColor} animate-pulse`}>
              {lang === 'es' ? 'escuchando' : 'listening'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {(editText.trim() || displayText) && (
            <>
              <button
                onClick={handleSpeak}
                title="Escuchar"
                className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <IconVolume className="text-neutral-400 hover:text-neutral-200" />
              </button>
              <button
                onClick={handleCopy}
                title={copied ? 'Copiado' : 'Copiar'}
                className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <IconCopy className={copied ? accentColor : 'text-neutral-400 hover:text-neutral-200'} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
        {displayText && !editText && (
          <p className="text-[15px] leading-relaxed text-neutral-100 flex-1 overflow-y-auto custom-scrollbar">
            {displayText}
          </p>
        )}

        {isSource && interimText && !editText && (
          <p className={`text-[14px] leading-relaxed ${accentColor} opacity-70 italic`}>
            {interimText}
          </p>
        )}

        <textarea
          value={editText}
          onChange={e => setEditText(e.target.value)}
          placeholder={displayText ? '' : placeholder}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && editText.trim()) {
              e.preventDefault()
              onTranslate(editText.trim(), lang)
              setEditText('')
            }
          }}
          className="w-full bg-transparent text-[14px] text-neutral-200 placeholder-neutral-600
            border-0 resize-none outline-none focus:ring-0 min-h-[60px] custom-scrollbar"
        />
      </div>

      {/* Footer con botón traducir */}
      {editText.trim() && (
        <div className="px-4 pb-4 shrink-0">
          <button
            onClick={() => { onTranslate(editText.trim(), lang); setEditText('') }}
            className={`w-full py-2 rounded-xl text-[12px] font-bold transition-all
              ${lang === 'es' ? 'bg-orange-500 hover:bg-orange-400 text-white' : 'bg-blue-500 hover:bg-blue-400 text-white'}`}
          >
            {lang === 'es' ? 'Traducir al inglés →' : 'Translate to Spanish →'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────

export default function InterpreterApp() {
  const {
    state,
    transcript,
    interimText,
    error,
    autoMode,
    activeListeningLang,
    availableVoices,
    esVoice,
    enVoice,
    setEsVoice,
    setEnVoice,
    startSession,
    stopSession,
    startListening,
    stopListening,
    translateManual,
    clearTranscript,
    speak,
    toggleAutoMode,
    selectListeningLang,
  } = useInterpreter()

  const [showVoicePanel, setShowVoicePanel] = useState(false)

  const isActive    = state !== 'idle' && state !== 'error'
  const isListening = state === 'listening'
  const isBusy      = state === 'translating' || state === 'speaking'

  const lastEs = [...transcript].reverse().find(e => e.lang === 'es') ?? null
  const lastEn = [...transcript].reverse().find(e => e.lang === 'en') ?? null

  const lastUserEntry = [...transcript].reverse().find(e => e.role === 'user') ?? null
  const lastDetectedLang = lastUserEntry?.lang ?? null

  // ── Botón central ─────────────────────────────────────────────

  const handleOrbClick = () => {
    if (!isActive) {
      startSession()
      return
    }
    // En modo auto, el botón central detiene la sesión (detiene la escucha/habla)
    if (autoMode) {
      stopSession()
    } else {
      if (isListening) stopListening()
    }
  }

  const handleOrbDown = () => {
    if (!isActive || isBusy || autoMode) return
    startListening()
  }

  const handleOrbUp = () => {
    if (!autoMode && isListening) stopListening()
  }

  // Estilo del orb central
  const orbStyle = isListening
    ? 'bg-orange-500/20 border-orange-400 shadow-[0_0_30px_rgba(251,146,60,0.4)] scale-105'
    : state === 'speaking'
    ? 'bg-blue-500/10 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.3)] animate-pulse'
    : isBusy
    ? 'bg-neutral-800 border-neutral-600 animate-pulse'
    : isActive
    ? 'bg-neutral-800 border-neutral-600 hover:border-neutral-500 cursor-pointer'
    : 'bg-neutral-900 border-neutral-700 hover:border-orange-500/60 hover:bg-neutral-800 cursor-pointer'

  const orbLabel = isListening
    ? (activeListeningLang === 'en' ? 'Listening...' : 'Escuchando...')
    : state === 'translating' ? 'Traduciendo...'
    : state === 'speaking'
      ? (activeListeningLang === 'en' ? 'Speaking in English...' : 'Hablando en español...')
    : isActive && autoMode ? 'Modo automático activo'
    : isActive ? 'Mantén presionado para hablar'
    : 'Toca para iniciar'

  // ── Selector de voz ───────────────────────────────────────────

  const esVoices = availableVoices.filter(v => v.lang.startsWith('es'))
  const enVoices = availableVoices.filter(v => v.lang.startsWith('en'))

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-black text-white overflow-hidden">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="m5 8 4 4-4 4" />
            <line x1="11" y1="12" x2="16" y2="12" />
          </svg>
          <span className="text-[14px] font-bold tracking-tight">
            Intérprete<span className="text-orange-400">AI</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Auto/Manual */}
          {isActive && (
            <button
              onClick={toggleAutoMode}
              title={autoMode ? 'Cambiar a modo manual' : 'Cambiar a modo automático'}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold transition-all
                ${autoMode
                  ? 'border-green-800/60 bg-green-950/40 text-green-400 hover:bg-green-950/70'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
            >
              <IconAuto active={autoMode} />
              {autoMode ? 'Auto' : 'Manual'}
            </button>
          )}

          {/* Estado */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-neutral-800 bg-neutral-900">
            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isListening ? 'bg-orange-400 animate-pulse'
              : state === 'speaking' ? 'bg-blue-400 animate-pulse'
              : isBusy ? 'bg-yellow-400 animate-pulse'
              : isActive ? 'bg-green-400'
              : 'bg-neutral-600'
            }`} />
            <span className="text-[11px] font-medium text-neutral-400">
              {isListening ? 'Escuchando'
               : state === 'speaking' ? 'Hablando'
               : isBusy ? 'Procesando'
               : isActive ? 'Activo'
               : 'Inactivo'}
            </span>
          </div>

          {/* Voces */}
          <button
            onClick={() => setShowVoicePanel(v => !v)}
            className="px-3 py-1 rounded-full border border-neutral-800 bg-neutral-900 text-[11px] font-medium text-neutral-400 hover:border-neutral-700 hover:text-neutral-200 transition-all"
          >
            Voces
          </button>

          {/* Limpiar / Terminar */}
          {isActive && (
            <>
              {transcript.length > 0 && (
                <button
                  onClick={clearTranscript}
                  title="Limpiar"
                  className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  <IconClear className="text-neutral-500 hover:text-neutral-300" />
                </button>
              )}
              <button
                onClick={stopSession}
                className="px-3 py-1 rounded-full border border-red-900/60 bg-red-950/30 text-[11px] font-bold text-red-400 hover:bg-red-950/60 hover:border-red-700/60 transition-all"
              >
                Terminar
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── PANEL DE VOCES (colapsable) ───────────────────── */}
      {showVoicePanel && (
        <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950 shrink-0 flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-orange-400 uppercase tracking-widest">🇪🇸 Voz ES</span>
            <select
              value={esVoice?.name ?? ''}
              onChange={e => setEsVoice(esVoices.find(v => v.name === e.target.value) ?? null)}
              className="bg-neutral-900 border border-neutral-700 text-[11px] text-neutral-200 rounded-lg px-2 py-1 outline-none focus:border-orange-500"
            >
              {esVoices.length === 0 && <option value="">Sin voces ES disponibles</option>}
              {esVoices.map(v => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang}){v.localService ? ' ●' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-widest">🇬🇧 Voice EN</span>
            <select
              value={enVoice?.name ?? ''}
              onChange={e => setEnVoice(enVoices.find(v => v.name === e.target.value) ?? null)}
              className="bg-neutral-900 border border-neutral-700 text-[11px] text-neutral-200 rounded-lg px-2 py-1 outline-none focus:border-blue-500"
            >
              {enVoices.length === 0 && <option value="">No EN voices available</option>}
              {enVoices.map(v => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang}){v.localService ? ' ●' : ''}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-neutral-600 self-center">● = voz local del sistema</p>
        </div>
      )}

      {/* ── ERROR ─────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl border border-red-900/60 bg-red-950/20 text-[12px] text-red-300 shrink-0 flex items-center justify-between gap-2">
          <span>{error}</span>
        </div>
      )}

      {/* ── PANELES PRINCIPALES ───────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 p-4 min-h-0 overflow-hidden">
        <TranslationPanel
          lang="es"
          lastEntry={lastEs}
          interimText={interimText}
          isSource={activeListeningLang === 'es'}
          isListening={isListening}
          onTranslate={translateManual}
          onSpeak={speak}
          onSelect={isActive ? () => selectListeningLang('es') : undefined}
        />

        {/* Separador con indicador de dirección */}
        <div className="hidden md:flex flex-col items-center justify-center gap-2 shrink-0 w-8">
          <div className="w-px flex-1 bg-neutral-800" />
          <svg className="w-5 h-5 text-neutral-600" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m17 2 4 4-4 4" />
            <path d="M3 6h18" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 18H3" />
          </svg>
          <div className="w-px flex-1 bg-neutral-800" />
        </div>
        <div className="flex md:hidden items-center gap-3 shrink-0">
          <div className="h-px flex-1 bg-neutral-800" />
          <svg className="w-4 h-4 text-neutral-600 rotate-90" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m17 2 4 4-4 4" />
            <path d="M3 6h18" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 18H3" />
          </svg>
          <div className="h-px flex-1 bg-neutral-800" />
        </div>

        <TranslationPanel
          lang="en"
          lastEntry={lastEn}
          interimText={interimText}
          isSource={activeListeningLang === 'en'}
          isListening={isListening}
          onTranslate={translateManual}
          onSpeak={speak}
          onSelect={isActive ? () => selectListeningLang('en') : undefined}
        />
      </div>

      {/* ── CONTROLES DE MIC ──────────────────────────────── */}
      <div className="shrink-0 flex flex-col items-center gap-3 px-4 pb-safe pt-3 border-t border-neutral-800 bg-black">

        {/* Label de estado */}
        <div className="flex items-center gap-2 h-5">
          <Waveform active={isListening} color="bg-orange-400" />
          <span className={`text-[12px] font-medium transition-colors ${
            isListening ? 'text-orange-400'
            : state === 'speaking' ? 'text-blue-400'
            : isBusy ? 'text-yellow-400'
            : 'text-neutral-500'
          }`}>
            {orbLabel}
          </span>
          <Waveform active={state === 'speaking'} color="bg-blue-400" />
        </div>

        {/* Botón central */}
        <button
          id="ptt-button"
          onClick={handleOrbClick}
          onMouseDown={handleOrbDown}
          onMouseUp={handleOrbUp}
          onMouseLeave={() => { if (!autoMode && isListening) handleOrbUp() }}
          onTouchStart={e => {
            e.preventDefault()
            if (!isActive) { startSession(); return }
            if (!autoMode) handleOrbDown()
          }}
          onTouchEnd={e => {
            e.preventDefault()
            if (!autoMode) handleOrbUp()
          }}
          className={`w-16 h-16 rounded-full border-2 flex items-center justify-center
            transition-all duration-200 select-none touch-none mb-2 relative
            ${orbStyle}`}
        >
          {isListening && (
            <span className="absolute w-16 h-16 rounded-full border border-orange-400/30 pulse-ring" />
          )}
          {state === 'speaking' && (
            <span className="absolute w-16 h-16 rounded-full border border-blue-400/20 pulse-ring" />
          )}
          {/* En modo auto activo: mostrar stop; en manual o inactivo: mostrar mic */}
          {autoMode && isActive
            ? <IconStop />
            : <IconMic active={isActive} listening={isListening} />
          }
        </button>

        {/* Hint de modo */}
        {!isActive && (
          <p className="text-[11px] text-neutral-600 text-center pb-1">
            Modo automático — detecta ES/EN solo
          </p>
        )}
      </div>
    </div>
  )
}
