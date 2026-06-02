/**
 * translation.worker.ts
 * ─────────────────────────────────────────────────────────────────
 * Web Worker: carga el modelo OPUS-MT (Helsinki-NLP) via Transformers.js
 * y ejecuta traducción ES ↔ EN de forma completamente local/offline.
 *
 * La primera carga descarga ~150MB y los cachea en IndexedDB del browser.
 * Las cargas posteriores son instantáneas.
 * ─────────────────────────────────────────────────────────────────
 */

import { pipeline, env } from '@huggingface/transformers'

// Forzar carga desde CDN solo la primera vez (luego usa caché local)
env.allowLocalModels = false
env.useBrowserCache = true

// ── Tipos de mensajes ─────────────────────────────────────────────

type WorkerRequest =
  | { type: 'load' }
  | { type: 'translate'; id: string; text: string; direction: 'es-en' | 'en-es' }

type WorkerResponse =
  | { type: 'loaded' }
  | { type: 'progress'; message: string; percent?: number }
  | { type: 'result'; id: string; text: string }
  | { type: 'error'; id?: string; message: string }

// ── Estado del worker ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let translatorEsEn: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let translatorEnEs: any = null
let isLoading = false

function send(msg: WorkerResponse) {
  self.postMessage(msg)
}

// ── Carga de modelos ──────────────────────────────────────────────

async function loadModels() {
  if (translatorEsEn && translatorEnEs) {
    send({ type: 'loaded' })
    return
  }

  if (isLoading) return
  isLoading = true

  try {
    send({ type: 'progress', message: 'Cargando modelo ES→EN…', percent: 10 })

    translatorEsEn = await pipeline(
      'translation',
      'Xenova/opus-mt-es-en',
      {
        dtype: 'fp32',
        progress_callback: (info: { progress?: number; status?: string }) => {
          if (info.progress) {
            send({
              type: 'progress',
              message: `Descargando ES→EN… ${Math.round(info.progress)}%`,
              percent: Math.round(info.progress * 0.5), // primera mitad
            })
          }
        },
      }
    )

    send({ type: 'progress', message: 'Cargando modelo EN→ES…', percent: 55 })

    translatorEnEs = await pipeline(
      'translation',
      'Xenova/opus-mt-en-es',
      {
        dtype: 'fp32',
        progress_callback: (info: { progress?: number; status?: string }) => {
          if (info.progress) {
            send({
              type: 'progress',
              message: `Descargando EN→ES… ${Math.round(info.progress)}%`,
              percent: 50 + Math.round(info.progress * 0.5), // segunda mitad
            })
          }
        },
      }
    )

    isLoading = false
    send({ type: 'loaded' })
  } catch (e) {
    isLoading = false
    const msg = e instanceof Error ? e.message : 'Error cargando modelos'
    send({ type: 'error', message: msg })
  }
}

// ── Traducción ────────────────────────────────────────────────────

async function translate(id: string, text: string, direction: 'es-en' | 'en-es') {
  try {
    const translator = direction === 'es-en' ? translatorEsEn : translatorEnEs
    if (!translator) {
      send({ type: 'error', id, message: 'Modelo no cargado aún' })
      return
    }

    const result = await translator(text, { max_new_tokens: 512 })
    const output = Array.isArray(result) ? result[0] : result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const translated = (output as any)?.translation_text ?? ''

    send({ type: 'result', id, text: translated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de traducción'
    send({ type: 'error', id, message: msg })
  }
}

// ── Mensaje handler ───────────────────────────────────────────────

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data

  switch (msg.type) {
    case 'load':
      loadModels()
      break
    case 'translate':
      translate(msg.id, msg.text, msg.direction)
      break
  }
})
