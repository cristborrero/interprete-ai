# 📊 Status del Proyecto: IntérpreteAI

> Este documento mantiene el registro en vivo del estado del proyecto, hitos alcanzados, problemas conocidos y mapa de ruta (roadmap).

## 🟢 Estado Actual: `ESTABLE / INTEGRACIÓN AZURE COMPLETA`

**Última actualización:** Junio 2026  
**Despliegue actual:** Vercel (Next.js App Router)  
**Branch principal:** `main`  

---

## 🎯 Hitos Completados (Milestones)

- [x] **Arquitectura Base**: Setup de Next.js 15, Tailwind CSS v3, TypeScript estricto.
- [x] **Traducción REST via API**: Implementación del endpoint `/api/translate` integrado con **OpenRouter** para consumir `google/gemini-3.1-flash-lite`.
- [x] **Azure AI Speech (STT + LID)**: Integración del SDK oficial de Azure para reconocimiento de voz bilingüe automatizado con detección de idioma en tiempo real (LID).
- [x] **Azure Neural TTS**: Síntesis de voz hiperrealista utilizando las voces premium de Azure (`es-CO-SalomeNeural` y `en-GB-SoniaNeural`).
- [x] **Servidor de Autenticación de Voz**: Endpoint seguro `/api/azure-token` para aprovisionar tokens temporales de Azure al cliente sin exponer claves privadas.
- [x] **Arquitectura con Fallback Nativo**: Mecanismo de contingencia que conmuta automáticamente a la Web Speech API nativa si falla la conexión con Azure.
- [x] **Sistema de Diseño Premium**: Interfaz Glassmorphism oscura unificada sin emojis y usando iconos SVG vectoriales.
- [x] **Push-to-Talk (PTT)**: Mecánica central de captura de audio y disparo controlado para traducción fluida.

---

## 🚧 En Progreso (Work In Progress)

- [ ] **Soporte PWA (Progressive Web App)**: Ajustar Service Workers y el manifiesto para permitir instalación local.

---

## 📋 Backlog / Roadmap a Futuro

1. **Persistencia Local**: Opción de guardar historial local en `localStorage` (sin base de datos) para revisión rápida de conversaciones recientes.
2. **Soporte Offline Opcional**: Investigar de nuevo modelos ultra-ligeros de traducción en el cliente si es requerido, pero manteniendo la arquitectura base web.

---

## 🐞 Bugs Conocidos / Deuda Técnica

*   **Safari Web Speech API (Fallback)**: Apple tiene un soporte inconsistente para `SpeechRecognition` continuo. En modo fallback nativo, se recomienda usar navegadores basados en Chromium. (Nota: La integración de Azure soluciona esto en todos los navegadores compatibles con captura de audio estándar).

