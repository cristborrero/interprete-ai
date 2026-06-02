/**
 * TranscriptPanel.tsx
 * ─────────────────────────────────────────────────────────────────
 * Historial de traducciones premium.
 * Rediseño completo con burbujas pulidas, etiquetas de idioma,
 * marcas de tiempo de alta gama y un diseño limpio y moderno.
 * ─────────────────────────────────────────────────────────────────
 */

'use client'

import { useEffect, useRef } from 'react'
import type { TranscriptEntry } from '@/hooks/useGeminiLive'
import clsx from 'clsx'

interface Props {
  entries: TranscriptEntry[]
  currentText: string
  onClear: () => void
}

const LANG_META: Record<string, { label: string; color: string; dot: string; border: string; bg: string }> = {
  es: { 
    label: 'Español', 
    color: 'text-brand-orange-400', 
    dot: 'bg-brand-orange-500', 
    border: 'border-brand-orange-500/20', 
    bg: 'bg-brand-orange-950/10' 
  },
  en: { 
    label: 'English', 
    color: 'text-brand-red-400', 
    dot: 'bg-brand-red-500', 
    border: 'border-brand-red-500/20', 
    bg: 'bg-brand-red-950/10' 
  },
}

export default function TranscriptPanel({ entries, currentText, onClear }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, currentText])

  const isEmpty = entries.length === 0 && !currentText

  return (
    <div className="flex flex-col h-full bg-surface-1">

      {/* ── Panel Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 bg-surface-1/40 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-text-muted/40" />
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em]">
            Historial de Conversación
          </span>
        </div>
        {!isEmpty && (
          <button
            onClick={onClear}
            className="text-[11px] text-text-muted hover:text-text-primary transition-all duration-150
                       px-3 py-1.5 rounded-xl hover:bg-surface-2 border border-transparent hover:border-border"
          >
            Limpiar transcripción
          </button>
        )}
      </div>

      {/* ── Conversational Timeline ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">

        {isEmpty ? (
          /* ── Premium Empty State ──────────────────────────────── */
          <div className="flex flex-col items-center justify-center h-full gap-5 text-center py-12">
            <div className="relative w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center shadow-premium">
              <span className="text-2xl animate-pulse">🎙️</span>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-brand-orange-500 border-2 border-surface-1" />
            </div>
            <div className="space-y-1.5 max-w-[280px]">
              <h4 className="text-[13px] font-semibold text-text-primary">
                Listo para conversar
              </h4>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Iniciá la sesión y comenzá a hablar. Las traducciones fluirán en este panel en tiempo real.
              </p>
            </div>
            <div className="flex items-center gap-4 px-4 py-2 rounded-2xl bg-surface-2/40 border border-border/40 text-[11px] text-text-muted">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange-500" />
                <span>Español</span>
              </div>
              <span className="opacity-40">|</span>
              <div className="flex items-center gap-1.5">
                <span>English</span>
                <span className="w-1.5 h-1.5 rounded-full bg-brand-red-500" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {entries.map((entry) => {
              const isAssistant = entry.role === 'assistant'
              const meta = LANG_META[entry.lang] ?? LANG_META.en
              
              return (
                <div 
                  key={entry.id} 
                  className={clsx(
                    'transcript-entry flex flex-col gap-2 p-5 rounded-2xl border transition-all duration-200',
                    isAssistant 
                      ? [meta.bg, meta.border].join(' ')
                      : 'bg-surface-2/30 border-border/60 hover:border-border'
                  )}
                >
                  {/* Meta Information */}
                  <div className="flex items-center gap-2">
                    <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', meta.dot)} />
                    <span className={clsx('text-[10px] font-bold uppercase tracking-widest', meta.color)}>
                      {isAssistant ? `Traducción · ${meta.label}` : meta.label}
                    </span>
                    <span className="text-[10px] text-text-muted/60 ml-auto font-medium">
                      {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  {/* Speech / Translation Text */}
                  <p className="text-[13px] text-text-primary leading-relaxed font-normal antialiased">
                    {entry.text}
                  </p>
                </div>
              )
            })}

            {/* ── Live Streaming Cursor ──────────────────────────── */}
            {currentText && (
              <div className="transcript-entry flex flex-col gap-2 p-5 rounded-2xl bg-surface-2/10 border border-amber-500/10 opacity-90 animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                    Procesando Voz...
                  </span>
                </div>
                <p className="text-[13px] text-text-secondary leading-relaxed antialiased">
                  {currentText}
                  <span className="inline-block w-[3px] h-[14px] bg-amber-500/70 ml-1 rounded-full animate-bounce align-middle" />
                </p>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
