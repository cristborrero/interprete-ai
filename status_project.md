# 📊 Status del Proyecto: IntérpreteAI

> Este documento mantiene el registro en vivo del estado del proyecto, hitos alcanzados, problemas conocidos y mapa de ruta (roadmap).

## 🟢 Estado Actual: `ESTABLE / SIMPLIFICADO`

**Última actualización:** Junio 2026  
**Despliegue actual:** Vercel (Next.js App Router)  
**Branch principal:** `main`  

---

## 🎯 Hitos Completados (Milestones)

- [x] **Arquitectura Base**: Setup de Next.js 15, Tailwind CSS v3, TypeScript estricto.
- [x] **Traducción REST via API**: Implementación del endpoint `/api/translate` integrado con **OpenRouter** para consumir `google/gemini-3.1-flash-lite`.
- [x] **Speech-to-Text (STT) Nativo**: Configuración del reconocimiento de voz nativo por medio de la Web Speech API del navegador, con soporte continuo e interactivo.
- [x] **Text-to-Speech (TTS) Flexible**: Uso de `window.speechSynthesis` con panel interactivo desplegable para seleccionar velocidades y voces del sistema disponibles.
- [x] **Sistema de Diseño Premium**: Interfaz Glassmorphism oscura unificada sin emojis y usando iconos SVG vectoriales.
- [x] **Push-to-Talk (PTT)**: Mecánica central de captura de audio y disparo controlado para traducción fluida.

---

## 🚧 En Progreso (Work In Progress)

- [ ] **Optimización del Reconocimiento**: Refinar el manejo del silencio y eventos de finalización de habla para mejorar la experiencia manos libres.
- [ ] **Soporte PWA (Progressive Web App)**: Ajustar Service Workers y el manifiesto para permitir instalación local.

---

## 📋 Backlog / Roadmap a Futuro

1. **Persistencia Local**: Opción de guardar historial local en `localStorage` (sin base de datos) para revisión rápida de conversaciones recientes.
2. **Soporte Offline Opcional**: Investigar de nuevo modelos ultra-ligeros de traducción en el cliente si es requerido, pero manteniendo la arquitectura base web.
3. **Optimización de Voces**: Sugerir/detectar voces HQ del sistema operativo de manera automática para alertar al usuario si tiene voces robóticas de baja calidad por defecto.

---

## 🐞 Bugs Conocidos / Deuda Técnica

*   **Safari Web Speech API**: Apple tiene un soporte inconsistente para `SpeechRecognition` continuo. Se recomienda fuertemente el uso de navegadores basados en Chromium (Chrome, Edge) en entornos de escritorio y Android.
*   **Voces macOS por Defecto**: Las voces integradas por defecto en macOS pueden sonar robóticas a menos que el usuario descargue activamente las voces mejoradas (HQ) desde los Ajustes del Sistema -> Accesibilidad.
