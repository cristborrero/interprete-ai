'use client'

import { useEffect } from 'react'

/**
 * SwRegistrar
 * Registra el Service Worker únicamente en producción.
 * En desarrollo, desregistra activamente cualquier SW previo y limpia cachés
 * para evitar interferir con Fast Refresh y el servidor de desarrollo.
 */
export default function SwRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[SW] Registrado:', reg.scope)
          })
          .catch((err) => {
            console.warn('[SW] Error al registrar SW:', err)
          })
      } else {
        // Limpieza activa en desarrollo
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister().then((unregistered) => {
              if (unregistered) {
                console.log('[SW] Desregistrado SW de desarrollo para refrescar caché.')
              }
            })
          }
        }).catch((err) => {
          console.warn('[SW] Error al buscar registros de SW:', err)
        })

        // Borrar cachés del navegador asociadas al origen
        if (window.caches) {
          caches.keys().then((keys) => {
            return Promise.all(keys.map((key) => caches.delete(key)))
          }).then(() => {
            console.log('[Cache] Cachés del navegador vaciadas en desarrollo.')
          }).catch((err) => {
            console.warn('[Cache] Error al limpiar cachés:', err)
          })
        }
      }
    }
  }, [])

  return null
}
