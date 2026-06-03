/**
 * IntérpreteAI — Service Worker v1
 *
 * Estrategia:
 * - App shell (HTML, JS, CSS, fuentes, iconos) → Cache-first → fallback red
 * - /api/* → Network-only (las traducciones siempre en tiempo real)
 * - Resto → Network-first → fallback caché si existe
 */

const CACHE_NAME = 'interprete-ai-v1'

// Recursos estáticos a pre-cachear en la instalación
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// ── Install ───────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  // Activar inmediatamente sin esperar a que cierren las tabs anteriores
  self.skipWaiting()
})

// ── Activate ──────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  // Tomar control de todas las tabs abiertas de inmediato
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Las llamadas a la API van siempre a la red — nunca cacheadas
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // Para el resto: cache-first con fallback a red
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request)
        .then((response) => {
          // Solo cachear respuestas válidas del mismo origen o recursos estáticos
          if (
            response.ok &&
            (url.origin === self.location.origin ||
              url.hostname.includes('fonts.googleapis.com') ||
              url.hostname.includes('fonts.gstatic.com'))
          ) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => {
          // Offline fallback: si es una navegación, devolver la raíz cacheada
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
        })
    })
  )
})
