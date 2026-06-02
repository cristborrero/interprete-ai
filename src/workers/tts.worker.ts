import { KokoroTTS } from 'kokoro-js'

// Para evitar problemas de TypeScript con los Web Workers
declare const self: any

let ttsInstance: any = null

self.addEventListener('message', async (event: MessageEvent) => {
  const { action, text, voice } = event.data

  try {
    if (action === 'init') {
      // Inicializar el modelo
      // Utilizamos webgpu si está disponible para máxima velocidad, si no cae a wasm.
      if (!ttsInstance) {
        ttsInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
          dtype: 'fp32', // fp32 es más compatible y estable en WebGPU/WASM para Kokoro
          device: 'webgpu' // Intenta WebGPU, hace fallback a WASM
        })
      }
      self.postMessage({ status: 'ready' })
      return
    }

    if (action === 'speak') {
      if (!ttsInstance) {
        throw new Error('TTS Model not initialized yet.')
      }

      // voice puede ser 'ef_dora' (Español) o 'am_adam' (Inglés)
      const audioResult = await ttsInstance.generate(text, {
        voice: voice
      })

      // audioResult.data es un Float32Array
      self.postMessage({
        status: 'complete',
        audioData: audioResult.data,
        sampleRate: audioResult.sample_rate || 24000
      })
    }
  } catch (error: any) {
    self.postMessage({ status: 'error', error: error.message || 'Error generating TTS' })
  }
})
