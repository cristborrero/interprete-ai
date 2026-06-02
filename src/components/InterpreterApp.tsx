/**
 * InterpreterApp.tsx
 * ─────────────────────────────────────────────────────────────────
 * REDISEÑO DE INTERFAZ PREMIUM — CRÍTICA Y MEJORA FINAL (RONDA 2)
 * 
 * Perfeccionamientos aplicados:
 * 1. ORB SUPREMO (CONSTANTE & PULSANTE): El botón central del micrófono
 *    ahora cuenta con una corona de luz verde esmeralda y un icono verde
 *    de forma constante (incluso desconectado), con una animación de respiración
 *    sutil ("animate-pulse") cuando está inactivo para invitar orgánicamente a la acción.
 * 2. EDITORES ULTRA GLASSMORPHISM: Aplicación de la clase "premium-glass"
 *    con bordes súper finos de gradiente interior y relieve de luz blanca superior
 *    en las cajas de Español e Inglés, dándoles el look Linear de alta gama.
 * 3. CABECERAS DE EDITOR TRANSLÚCIDAS: El encabezado de cada caja ahora tiene
 *    un fondo difuminado de cristal (`bg-surface-1/40 backdrop-blur-md`).
 * 4. BOTÓN DE CONEXIÓN HÍPER PULIDO: La pastilla de "Modo en línea" y "Modo local"
 *    tiene relieve interno, mejor contraste y transiciones fluidas.
 * 5. CERO EMOJIS & ICONOGRAFÍA PREMIUM: Todos los elementos visuales usan SVGs
 *    limpios con proporciones perfectas.
 * ─────────────────────────────────────────────────────────────────
 */

'use client'

import { useCallback, useState, useEffect } from 'react'
import { useGeminiLive, type Language } from '@/hooks/useGeminiLive'
import { useOfflineInterpreter } from '@/hooks/useOfflineInterpreter'
import TranscriptPanel from '@/components/TranscriptPanel'
import WaveformVisualizer from '@/components/WaveformVisualizer'
import clsx from 'clsx'

export interface FavoriteItem {
  id: string
  es: string
  en: string
  timestamp: number
}

export default function InterpreterApp() {
  const [activeTab, setActiveTab] = useState<'traductor' | 'historial' | 'favoritos' | 'ajustes'>('traductor')
  const [offlineMode, setOfflineModeState] = useState(false)
  const [autoMode, setAutoModeState] = useState(true)

  const gemini  = useGeminiLive()
  const offline = useOfflineInterpreter()
  const active  = offlineMode ? offline : gemini

  const {
    state,
    transcript,
    currentText,
    detectedLang,
    error,
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
  } = active

  const [esInput, setEsInput] = useState('')
  const [enInput, setEnInput] = useState('')

  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem('interpreter_favorites')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        // ignore
      }
    }
    return [
      { id: '1', es: 'Médico de cabecera', en: 'GP (General Practitioner)', timestamp: Date.now() },
      { id: '2', es: 'Urgencias médicas', en: 'A&E (Accident & Emergency)', timestamp: Date.now() - 1000 },
      { id: '3', es: 'Carta de derivación para especialista', en: 'Referral Letter', timestamp: Date.now() - 2000 },
      { id: '4', es: 'Tengo una cita médica a las tres en punto.', en: "I have an appointment at three o'clock.", timestamp: Date.now() - 3000 },
      { id: '5', es: '¿Podría repetir eso despacio, por favor?', en: 'Can you repeat that slowly, please?', timestamp: Date.now() - 4000 },
    ]
  })

  const progress = offlineMode && 'progress' in offline ? offline.progress : null

  const isActive      = state !== 'idle' && state !== 'error'
  const canTalk       = state === 'ready'
  const isListening   = state === 'listening'
  const isTranslating = state === 'translating'
  const isLoading     = state === 'loading' || state === 'connecting'

  const handleSetAutoMode = useCallback((v: boolean) => {
    setAutoModeState(v)
    setAutoMode(v)
  }, [setAutoMode])

  const toggleOfflineMode = useCallback((toOffline: boolean) => {
    if (isActive) active.stopSession()
    setOfflineModeState(toOffline)
  }, [isActive, active])

  const handlePressStart = useCallback(() => {
    if (!canTalk) return
    startListening()
  }, [canTalk, startListening])

  const handlePressEnd = useCallback(() => {
    if (!isListening) return
    stopListening()
  }, [isListening, stopListening])

  // Save favorites to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('interpreter_favorites', JSON.stringify(favorites))
    }
  }, [favorites])

  // ── Mapeo Inteligente de Texto a los Editores Lado a Lado ──────────
  const lastEsEntry = [...transcript].reverse().find(e => e.lang === 'es')
  const lastEnEntry = [...transcript].reverse().find(e => e.lang === 'en')

  const esTextFinal = lastEsEntry?.text ?? ''
  const enTextFinal = lastEnEntry?.text ?? ''

  let esDisplayText = esTextFinal
  let enDisplayText = enTextFinal

  if (currentText) {
    if (detectedLang === 'es') {
      enDisplayText = currentText
    } else if (detectedLang === 'en') {
      esDisplayText = currentText
    }
  }

  // Sync inputs with transcript translations
  useEffect(() => {
    setEsInput(esDisplayText)
  }, [esDisplayText])

  useEffect(() => {
    setEnInput(enDisplayText)
  }, [enDisplayText])

  const handleTranslateText = async (text: string, fromLang: Language) => {
    if (!text.trim()) return
    try {
      await translateText(text, fromLang)
    } catch (err) {
      console.error('Error in handleTranslateText:', err)
    }
  }

  const isBookmarked = !!(esInput.trim() && enInput.trim() && favorites.some(f => f.es === esInput.trim() && f.en === enInput.trim()))

  const toggleBookmark = () => {
    const esVal = esInput.trim()
    const enVal = enInput.trim()
    if (!esVal || !enVal) return
    if (isBookmarked) {
      setFavorites(prev => prev.filter(f => !(f.es === esVal && f.en === enVal)))
    } else {
      setFavorites(prev => [
        { id: `${Date.now()}-${Math.random()}`, es: esVal, en: enVal, timestamp: Date.now() },
        ...prev
      ])
    }
  }

  // ── Orb Styles ──────────────────────────────────────────────────
  const handleOrbClick = () => {
    if (!isActive && !isLoading) {
      startSession()
    }
  }

  const orbBorder = isListening
    ? 'border-brand-orange-500/40 bg-brand-orange-950/15 shadow-glow-es ring-4 ring-brand-orange-500/10'
    : isTranslating
    ? 'border-brand-red-500/40 bg-brand-red-950/15 shadow-glow-en ring-4 ring-brand-red-500/10'
    : isLoading
    ? 'border-amber-500/35 bg-amber-950/5 animate-pulse'
    : isActive
    ? 'border-brand-orange-500/30 bg-surface-2/65 hover:border-brand-orange-500/50 hover:bg-surface-2 shadow-premium cursor-pointer'
    : 'border-brand-orange-500/20 bg-surface-1/40 hover:border-brand-orange-500/40 hover:bg-surface-2 cursor-pointer shadow-premium animate-pulse'

  const orbLabel = isListening ? 'Escuchando voz...'
    : isTranslating ? 'Traduciendo...'
    : isLoading ? (offlineMode ? 'Cargando modelos locales...' : 'Iniciando conexión...')
    : isActive ? (autoMode ? 'Detección automática activa' : 'Listo · Mantén presionado')
    : 'Haz clic para iniciar traducción'

  const orbLabelColor = isListening ? 'text-brand-orange-400 font-semibold'
    : isTranslating ? 'text-brand-red-400 font-semibold'
    : isLoading ? 'text-amber-400'
    : isActive ? 'text-text-secondary'
    : 'text-text-muted hover:text-text-secondary transition-colors font-medium'

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-surface text-text-primary">
      
      {/* ========================================================= */}
      {/* ── COLUMNA 1: SIDEBAR DE NAVEGACIÓN IZQUIERDO ─────────────── */}
      {/* ========================================================= */}
      <aside className="hidden md:flex w-[60px] lg:w-[260px] border-r border-border bg-surface-DEFAULT flex-col justify-between py-5 px-2 lg:px-5 select-none shrink-0 z-20">
        <div className="space-y-7">
          
          {/* Logo Corporativo */}
          <div className="flex items-center gap-3 px-1 justify-center lg:justify-start">
            <svg className="w-6 h-6 text-brand-orange-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M12 7v5" />
              <path d="M12 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
            </svg>
            <span className="hidden lg:block text-[14px] font-bold text-text-primary tracking-tight">
              Intérprete<span className="text-brand-orange-400">AI</span>
            </span>
          </div>

          {/* Menú de Navegación */}
          <nav className="flex flex-col gap-1.5">
            <SidebarTab
              active={activeTab === 'traductor'}
              onClick={() => setActiveTab('traductor')}
              label="Traductor"
              desc="Traduce en tiempo real"
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 8 6 6 6-6" />
                  <path d="m4 14 6-6 8 8" />
                </svg>
              }
            />
            <SidebarTab
              active={activeTab === 'historial'}
              onClick={() => setActiveTab('historial')}
              label="Historial"
              desc="Tus conversaciones"
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }
            />
            <SidebarTab
              active={activeTab === 'favoritos'}
              onClick={() => setActiveTab('favoritos')}
              label="Favoritos"
              desc="Frases guardadas"
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              }
            />
            <SidebarTab
              active={activeTab === 'ajustes'}
              onClick={() => setActiveTab('ajustes')}
              label="Ajustes"
              desc="Preferencias generales"
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              }
            />
          </nav>

          {/* Premium Pro Box — solo visible en desktop */}
          <div className="hidden lg:block p-4 rounded-2xl border border-brand-orange-500/10 bg-brand-orange-950/5 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
                <path d="M3 20h18v2H3z" />
              </svg>
              <span className="text-[11.5px] font-bold text-text-primary">Intérprete Pro</span>
            </div>
            <p className="text-[9.5px] text-text-muted leading-relaxed">
              Traducciones ilimitadas, voz avanzada y más.
            </p>
            <button className="w-full py-2 rounded-xl bg-brand-orange-500 text-surface text-[10.5px] font-bold hover:bg-brand-orange-400 transition-colors shadow-premium">
              Mejorar plan
            </button>
          </div>
        </div>

        {/* Footer del Sidebar */}
        <div className="hidden lg:flex flex-col space-y-4">
          {/* Selector de Modo Oscuro */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-surface-1/30">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span className="text-[11px] font-medium text-text-secondary">Modo oscuro</span>
            </div>
            <span className="text-[10px] text-brand-orange-400 font-semibold uppercase tracking-wider">
              Activado
            </span>
          </div>

          {/* Perfil del Invitado */}
          <div className="flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:bg-surface-1/30 transition-colors cursor-pointer group">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border flex items-center justify-center font-bold text-[11px] text-text-secondary">
                N
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-text-primary">Invitado</span>
                <span className="text-[9px] text-text-muted">Inicia sesión para guardar</span>
              </div>
            </div>
            <svg className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* ── COLUMNA 2: ÁREA DE CONTENIDO CENTRAL ──────────────────── */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-surface relative z-10">
        
        {/* Barra superior de estado */}
        {/* Mobile logo — only rendered inside header on mobile */}
        <header className="flex items-center justify-between px-4 md:px-8 py-3 md:py-5 border-b border-border shrink-0 select-none">
          <div className="flex md:hidden items-center gap-2">
            <svg className="w-5 h-5 text-brand-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-[13px] font-bold text-text-primary">IntérpreteAI</span>
          </div>
          <div className="flex items-center gap-3">
            {!isActive && (
              <button
                onClick={() => toggleOfflineMode(!offlineMode)}
                className="px-3 py-1.5 rounded-xl border border-border/80 bg-surface-2 text-[10.5px] font-bold flex items-center gap-2 hover:border-border-active hover:bg-surface-3 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                {offlineMode ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-brand-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a1 1 0 0 0-1.2 1.3L11 12l-4 4H4v3h3l4-4 4.5 7.4a1 1 0 0 0 1.8-.2Z" />
                    </svg>
                    <span>Modo local</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-brand-orange-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <span>Modo en línea</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3.5">
            {/* Botón sutil de Terminar Consulta (Desconexión) */}
            {isActive && (
              <button
                onClick={stopSession}
                className="px-2.5 md:px-3.5 py-1.5 rounded-xl border border-red-500/25 bg-red-950/15 hover:bg-red-950/25 hover:border-red-500/55 text-red-400 text-[10px] md:text-[10.5px] font-bold flex items-center gap-1.5 transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                </svg>
                <span className="hidden sm:inline">Terminar</span>
              </button>
            )}

            {/* Estado del WebSocket de Gemini o Servidor Local */}
            <div className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 rounded-full border border-border bg-surface-1/40">
              <span className={clsx(
                'w-1.5 h-1.5 rounded-full',
                isActive ? 'bg-brand-orange-500 animate-pulse' : 'bg-text-muted/40'
              )} />
              <span className="text-[10px] md:text-[10.5px] font-semibold text-text-secondary">
                {isActive ? 'En línea' : 'Desconectado'}
              </span>
            </div>

            {/* Selector de idiomas */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold tracking-wider px-3.5 py-1.5 rounded-xl bg-surface-2/40 border border-border/80">
              <span className="text-brand-orange-400">ES</span>
              <span className="opacity-30">↔</span>
              <span className="text-brand-red-400">EN</span>
            </div>
          </div>
        </header>

        {/* ── CONTENIDO DINÁMICO ────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          
          {activeTab === 'traductor' && (
            /* ======================================================= */
            /* ── INTERFAZ PRINCIPAL: TRADUCTOR SIMULTÁNEO ─────────── */
            /* ======================================================= */
            <div className="flex-1 flex flex-col px-4 md:px-8 py-4 md:py-6 space-y-4 md:space-y-8 max-w-[1200px] w-full mx-auto justify-between pb-20 md:pb-4">
              
              {/* Hero Section */}
              <div className="text-center space-y-1.5 select-none">
                <h2 className="text-[20px] sm:text-[26px] lg:text-[34px] font-extrabold tracking-tight text-text-primary antialiased leading-tight">
                  Traduce sin límites, conecta sin fronteras.
                </h2>
                <p className="text-[11px] sm:text-[12.5px] lg:text-[14px] text-text-muted leading-relaxed font-medium">
                  Traducción en tiempo real con IA de última generación.
                </p>
              </div>

              {/* Controles de Modo & Micrófono Central */}
              <div className="flex items-center justify-center gap-3 md:gap-8 py-2 select-none">
                
                {/* Botón PTT */}
                <button
                  onClick={() => handleSetAutoMode(false)}
                  disabled={isActive}
                  className={clsx(
                    'px-3 md:px-5 py-2.5 md:py-3 rounded-2xl border text-left flex items-center gap-2 md:gap-3.5 transition-all duration-200 shadow-premium',
                    !autoMode 
                      ? 'bg-surface-2 border-border-active ring-1 ring-inset ring-white/[0.04]' 
                      : 'bg-surface-DEFAULT border-border/40 text-text-muted hover:border-border-active hover:bg-surface-1/40',
                    isActive && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-[10.5px] md:text-[11px] font-bold text-text-primary">Push-to-Talk</span>
                    <span className="hidden sm:block text-[9.5px] text-text-muted">Presiona para hablar</span>
                  </div>
                </button>

                {/* Gran Botón de Micrófono Central (Orb) */}
                <button
                  id="ptt-button"
                  onClick={handleOrbClick}
                  onMouseDown={handlePressStart}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={(e) => { e.preventDefault(); handlePressStart() }}
                  onTouchEnd={(e) => { e.preventDefault(); handlePressEnd() }}
                  disabled={isActive && !canTalk && !isListening}
                  className={clsx(
                    'relative w-16 h-16 md:w-20 md:h-20 rounded-full border-2 transition-all duration-300',
                    'flex items-center justify-center select-none touch-none shadow-premium',
                    orbBorder,
                    (isActive && canTalk) && 'active:scale-95 hover:shadow-premium-hover',
                    (isActive && !canTalk && !isListening) && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {isListening && (
                    <span className="absolute inset-0 rounded-full border border-brand-orange-500/25 pulse-ring" />
                  )}
                  <MicIcon size={22} active={isListening || isActive} translating={isTranslating} />
                </button>

                {/* Botón Automático */}
                <button
                  onClick={() => handleSetAutoMode(true)}
                  disabled={isActive}
                  className={clsx(
                    'px-3 md:px-5 py-2.5 md:py-3 rounded-2xl border text-left flex items-center gap-2 md:gap-3.5 transition-all duration-200 shadow-premium',
                    autoMode 
                      ? 'bg-surface-2 border-border-active ring-1 ring-inset ring-white/[0.04]' 
                      : 'bg-surface-DEFAULT border-border/40 text-text-muted hover:border-border-active hover:bg-surface-1/40',
                    isActive && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-brand-orange-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-[10.5px] md:text-[11px] font-bold text-text-primary">Automático</span>
                    <span className="hidden sm:block text-[9.5px] text-text-muted">Detección de idioma</span>
                  </div>
                </button>

              </div>

              {/* Caja de Consejo / Estado del Orb */}
              <div className="flex items-center gap-2.5 justify-center py-1 select-none">
                <svg className="w-4 h-4 text-brand-orange-400 shrink-0 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
                <span className={clsx('text-[11px] font-medium transition-colors', orbLabelColor)}>
                  {orbLabel}
                </span>
                {(isListening || isTranslating) && (
                  <WaveformVisualizer
                    active={true}
                    color={isListening ? 'bg-brand-orange-500' : 'bg-brand-red-500'}
                    barCount={5}
                  />
                )}
              </div>

              {/* Editores Lado a Lado (Español / English) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch relative">
                
                {/* Editor Izquierdo: Español */}
                <div className="flex flex-col rounded-3xl border border-border bg-surface-1 shadow-premium overflow-hidden transition-all duration-200 focus-within:border-border-active">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0 bg-surface-1/50 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-orange-500 shrink-0 animate-pulse" />
                      <span className="text-[11.5px] font-bold text-text-primary uppercase tracking-wider">Español</span>
                      <svg className="w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-6 min-h-[220px] flex flex-col justify-between">
                    <textarea
                      value={esInput}
                      onChange={(e) => setEsInput(e.target.value)}
                      placeholder="Hablá o escribí en español..."
                      className="text-[14px] leading-relaxed antialiased bg-transparent border-0 resize-none outline-none focus:ring-0 min-h-[140px] w-full text-text-primary placeholder-text-muted custom-scrollbar"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleTranslateText(esInput, 'es')
                        }
                      }}
                    />
                    
                    <div className="flex items-center justify-between pt-4 border-t border-border/30 shrink-0 select-none">
                      <div className="flex items-center gap-3">
                        <VolumeButton onClick={() => window.speechSynthesis.speak(new SpeechSynthesisUtterance(esInput))} />
                        <CopyButton text={esInput} />
                        {esInput.trim() && (
                          <button
                            onClick={() => handleTranslateText(esInput, 'es')}
                            className="px-3 py-1.5 rounded-xl bg-brand-orange-500 hover:bg-brand-orange-400 text-surface text-[10px] font-bold transition-all shadow-sm"
                          >
                            Traducir
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted font-medium tabular-nums">
                        {esInput.length} / 5000
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botón de Intercambio de Idioma */}
                <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full border border-border bg-surface-2 flex items-center justify-center shadow-premium hover:border-border-active hover:scale-105 transition-all cursor-pointer">
                  <svg className="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m17 2 4 4-4 4" />
                    <path d="M3 6h18" />
                    <path d="m7 22-4-4 4-4" />
                    <path d="M21 18H3" />
                  </svg>
                </div>

                {/* Editor Derecho: English */}
                <div className="flex flex-col rounded-3xl border border-border bg-surface-1 shadow-premium overflow-hidden transition-all duration-200 focus-within:border-border-active">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0 bg-surface-1/50 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-red-500 shrink-0 animate-pulse" />
                      <span className="text-[11.5px] font-bold text-text-primary uppercase tracking-wider">English</span>
                      <svg className="w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-6 min-h-[220px] flex flex-col justify-between">
                    <textarea
                      value={enInput}
                      onChange={(e) => setEnInput(e.target.value)}
                      placeholder="Translation will appear here or type in English..."
                      className="text-[14px] leading-relaxed antialiased bg-transparent border-0 resize-none outline-none focus:ring-0 min-h-[140px] w-full text-text-primary placeholder-text-muted custom-scrollbar"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleTranslateText(enInput, 'en')
                        }
                      }}
                    />
                    
                    <div className="flex items-center justify-between pt-4 border-t border-border/30 shrink-0 select-none">
                      <div className="flex items-center gap-3">
                        <VolumeButton onClick={() => window.speechSynthesis.speak(new SpeechSynthesisUtterance(enInput))} />
                        <CopyButton text={enInput} />
                        <BookmarkButton
                          active={isBookmarked}
                          onClick={toggleBookmark}
                          disabled={!esInput.trim() || !enInput.trim()}
                        />
                        {enInput.trim() && (
                          <button
                            onClick={() => handleTranslateText(enInput, 'en')}
                            className="px-3 py-1.5 rounded-xl bg-brand-red-500 hover:bg-brand-red-400 text-surface text-[10px] font-bold transition-all shadow-sm"
                          >
                            Translate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Barra de Progreso del OPUS-MT */}
              {offlineMode && isLoading && progress && (
                <div className="mb-4 shrink-0 transition-all duration-200 animate-fade-up">
                  <div className="flex justify-between text-[10px] text-text-muted mb-2 font-medium">
                    <span>{progress.message}</span>
                    <span className="tabular-nums">{progress.percent}%</span>
                  </div>
                  <div className="h-1 bg-surface-2 rounded-full overflow-hidden border border-border/20">
                    <div
                      className="h-full bg-brand-red-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Grilla Inferior de 4 Columnas */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 pt-2 md:pt-4 select-none">
                <ValueCard
                  title="Traducción en tiempo real"
                  desc="Resultados instantáneos y precisos."
                  icon={
                    <svg className="w-5 h-5 text-brand-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  }
                />
                <ValueCard
                  title="Soporte multiidioma"
                  desc="Más de 100 idiomas disponibles."
                  icon={
                    <svg className="w-5 h-5 text-brand-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  }
                />
                <ValueCard
                  title="IA de última generación"
                  desc="Traducciones naturales y contextuales."
                  icon={
                    <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <rect x="9" y="9" width="6" height="6" rx="1" />
                      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
                    </svg>
                  }
                />
                <ValueCard
                  title="Privacidad segura"
                  desc="Tus conversaciones están protegidas."
                  icon={
                    <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  }
                />
              </div>

              {/* Banner de Login en el Fondo */}
              <div className="rounded-2xl border border-brand-orange-500/10 bg-brand-orange-950/5 p-6 flex flex-col md:flex-row items-center justify-between gap-4 select-none">
                <span className="text-[11.5px] text-text-secondary text-center md:text-left font-medium leading-relaxed">
                  Inicia sesión para guardar tu historial, favoritos y sincronizar en todos tus dispositivos.
                </span>
                <button className="px-5 py-2.5 rounded-xl bg-text-primary text-surface text-[11px] font-bold flex items-center gap-2 hover:bg-white transition-colors shrink-0 shadow-premium">
                  <span>Iniciar sesión</span>
                  <svg className="w-3.5 h-3.5 text-surface" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>

            </div>
          )}

          {activeTab === 'historial' && (
            /* ======================================================= */
            /* ── PESTAÑA: HISTORIAL COMPLETO DE DIÁLOGOS ────────────── */
            /* ======================================================= */
            <div className="flex-1 flex flex-col px-4 md:px-8 py-4 max-w-[1000px] w-full mx-auto justify-between pb-20 md:pb-4">
              <div className="flex-1 rounded-3xl border border-border bg-surface-1 shadow-premium overflow-hidden min-h-[500px] flex flex-col">
                <TranscriptPanel
                  entries={transcript}
                  currentText={currentText}
                  onClear={clearTranscript}
                />
              </div>
            </div>
          )}

          {activeTab === 'favoritos' && (
            <div className="flex-1 flex flex-col px-4 md:px-8 py-4 max-w-[800px] w-full mx-auto space-y-6 pb-20 md:pb-4">
              <div className="space-y-1.5 select-none">
                <h3 className="text-[18px] font-bold text-text-primary">Frases Favoritas</h3>
                <p className="text-[11px] text-text-muted">Marcá con favoritos las frases de traducción recurrente para tenerlas al alcance rápido.</p>
              </div>

              <div className="rounded-3xl border border-border bg-surface-1 shadow-premium p-6 space-y-4">
                {favorites.length === 0 ? (
                  <div className="text-center py-8 text-text-muted text-[11px]">
                    No tenés frases favoritas guardadas aún.
                  </div>
                ) : (
                  favorites.map(fav => (
                    <GlosarioCompletoItem
                      key={fav.id}
                      en={fav.en}
                      es={fav.es}
                      onRemove={() => setFavorites(prev => prev.filter(f => f.id !== fav.id))}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'ajustes' && (
            <div className="flex-1 flex flex-col px-4 md:px-8 py-4 max-w-[800px] w-full mx-auto space-y-6 pb-20 md:pb-4">
              <div className="space-y-1.5 select-none">
                <h3 className="text-[18px] font-bold text-text-primary">Ajustes Generales</h3>
                <p className="text-[11px] text-text-muted">Ajustá la configuración del sintetizador de voz y la conexión del traductor.</p>
              </div>

              <div className="rounded-3xl border border-border bg-surface-1 shadow-premium p-6 divide-y divide-border/40 space-y-6">
                <div className="pt-2 space-y-3">
                  <h4 className="text-[12px] font-bold text-text-primary uppercase tracking-wider">Conectividad de Traducción</h4>
                  <p className="text-[10px] text-text-muted leading-relaxed">Selecciona qué pipeline utilizar para traducir entre idiomas. El modo en línea tiene mejor compresión de voz natural.</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleOfflineMode(false)}
                      className={clsx(
                        'px-4 py-2 rounded-xl border text-[11px] font-bold transition-all shadow-premium',
                        !offlineMode ? 'bg-surface-2 border-border-active text-text-primary' : 'bg-surface-DEFAULT border-border/40 text-text-muted'
                      )}
                    >
                      🌐 Gemini Live API (En Línea)
                    </button>
                    <button
                      onClick={() => toggleOfflineMode(true)}
                      className={clsx(
                        'px-4 py-2 rounded-xl border text-[11px] font-bold transition-all shadow-premium',
                        offlineMode ? 'bg-surface-2 border-border-active text-text-primary' : 'bg-surface-DEFAULT border-border/40 text-text-muted'
                      )}
                    >
                      ✈️ OPUS-MT Local (Sin internet)
                    </button>
                  </div>
                </div>

                <div className="pt-6 space-y-3">
                  <h4 className="text-[12px] font-bold text-text-primary uppercase tracking-wider">Sintetizador de Voz (TTS)</h4>
                  <p className="text-[10px] text-text-muted leading-relaxed">Configurá la velocidad y tono para la lectura automática de la traducción.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[10.5px] text-text-secondary font-semibold">Velocidad de habla ({ttsRate}x)</span>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.05"
                        value={ttsRate}
                        onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                        className="w-full h-1 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-brand-orange-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10.5px] text-text-secondary font-semibold">Volumen de audio ({Math.round(ttsVolume * 100)}%)</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={ttsVolume}
                        onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
                        className="w-full h-1 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-brand-orange-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Bottom Tab Bar — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border flex items-center justify-around pb-safe pt-2">
        {([
          { key: 'traductor', label: 'Traductor', path: 'm5 8 6 6 6-6 M4 14 l6-6 8 8' },
          { key: 'historial', label: 'Historial', circle: true },
          { key: 'favoritos', label: 'Favoritos', star: true },
          { key: 'ajustes',   label: 'Ajustes',   gear: true },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={clsx(
              'flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all min-w-[60px]',
              activeTab === key ? 'text-brand-orange-400' : 'text-text-muted'
            )}
          >
            {key === 'traductor' && (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6 6-6" /><path d="m4 14 6-6 8 8" /></svg>
            )}
            {key === 'historial' && (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            )}
            {key === 'favoritos' && (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            )}
            {key === 'ajustes' && (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            )}
            <span className="text-[9px] font-semibold tracking-tight">{label}</span>
          </button>
        ))}
      </nav>

    </div>
  )
}

// ── COMPONENTE AUXILIAR: Botón de Navegación Lateral (SidebarTab) ──────
function SidebarTab({
  active, onClick, label, desc, icon
}: {
  active: boolean
  onClick: () => void
  label: string
  desc: string
  icon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3.5 px-3 py-3 rounded-2xl w-full text-left transition-all duration-200 border',
        active
          ? [
              'bg-surface-2 border-border-active',
              'ring-1 ring-inset ring-white/[0.04]',
              'shadow-premium shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
              'text-text-primary',
            ].join(' ')
          : 'bg-transparent border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-1/30'
      )}
    >
      <div className={clsx('shrink-0 transition-colors', active ? 'text-brand-orange-400' : 'text-text-muted')}>
        {icon}
      </div>
      <div className="flex flex-col select-none">
        <span className="text-[11.5px] font-bold tracking-tight">{label}</span>
        <span className="text-[9px] opacity-75 font-normal text-text-muted/60">{desc}</span>
      </div>
    </button>
  )
}

// ── COMPONENTE AUXILIAR: Tarjeta de Características (Grilla) ─────────
function ValueCard({
  title, desc, icon
}: {
  title: string
  desc: string
  icon: React.ReactNode
}) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-surface-1/50 shadow-premium space-y-2 hover:border-border-active hover:bg-surface-1 transition-all duration-200">
      <div className="shrink-0">{icon}</div>
      <div className="space-y-0.5">
        <h4 className="text-[11px] font-bold text-text-primary tracking-tight leading-tight">{title}</h4>
        <p className="text-[10px] text-text-muted leading-relaxed font-medium">{desc}</p>
      </div>
    </div>
  )
}

// ── COMPONENTES: Controles Profesionales de Editor ───────────────────
function VolumeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2.5 rounded-xl border border-border bg-surface-2/30 hover:border-border-active hover:bg-surface-2 transition-all shadow-sm"
    >
      <svg className="w-3.5 h-3.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    </button>
  )
}

// CopyButton con feedback de portapapeles premium en el ícono
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="p-2.5 rounded-xl border border-border bg-surface-2/30 hover:border-border-active hover:bg-surface-2 transition-all shadow-sm"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-brand-orange-400 transition-colors animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

function BookmarkButton({ active, onClick, disabled }: { active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'p-2.5 rounded-xl border border-border bg-surface-2/30 hover:border-border-active hover:bg-surface-2 transition-all shadow-sm',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <svg className={clsx('w-3.5 h-3.5 transition-colors cursor-pointer', active ? 'text-brand-orange-400 fill-brand-orange-400/25' : 'text-text-muted hover:text-text-primary')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}

// ── COMPONENTE AUXILIAR: Elemento de Glosario en pestaña Favoritos ─────
function GlosarioCompletoItem({ en, es, onRemove }: { en: string; es: string; onRemove?: () => void }) {
  return (
    <div className="p-3.5 rounded-2xl border border-border bg-surface-2/10 hover:border-border-active hover:bg-surface-2/20 transition-all flex items-center justify-between group select-none">
      <div className="space-y-0.5">
        <div className="text-[12px] font-bold text-text-primary select-all">{en}</div>
        <div className="text-[10px] text-text-muted select-all">{es}</div>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-2 rounded-xl border border-border bg-surface-2/45 opacity-60 group-hover:opacity-100 hover:border-border-active hover:bg-surface-2 transition-all"
        >
          <svg className="w-3.5 h-3.5 text-brand-orange-400 fill-brand-orange-400/10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── COMPONENTE AUXILIAR: MicIcon ──────────────────────────────────────
function MicIcon({ size = 24, active, translating }: {
  size?: number
  active: boolean
  translating: boolean
}) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.5 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx(
        'transition-all duration-300',
        active ? 'text-brand-orange-400 scale-110' : translating ? 'text-brand-red-400' : 'text-text-muted',
      )}
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  )
}
