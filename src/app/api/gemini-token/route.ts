import { NextResponse } from 'next/server'

/**
 * GET /api/gemini-token
 * Devuelve la API key y el modelo Live disponible para esta key.
 * Consulta la lista de modelos y filtra los que soportan bidiGenerateContent.
 */
export async function GET() {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY no configurada en .env.local' },
      { status: 500 }
    )
  }

  // Detectar el modelo Live disponible para esta API key
  let model = 'gemini-3.1-flash-live-preview' // fallback
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { next: { revalidate: 3600 } } // cachear 1 hora
    )
    if (res.ok) {
      const data = await res.json()
      const PREFERRED = [
        'gemini-3.1-flash-live-preview',
        'gemini-2.5-flash-live-preview',
        'gemini-2.0-flash-live-preview',
        'gemini-2.0-flash-live-001',
        'gemini-2.0-flash-exp',
      ]
      const available: string[] = (data.models ?? [])
        .filter((m: { supportedGenerationMethods?: string[] }) =>
          m.supportedGenerationMethods?.includes('bidiGenerateContent')
        )
        .map((m: { name: string }) => m.name.replace('models/', ''))

      const found = PREFERRED.find(p => available.includes(p))
      if (found) model = found
      else if (available.length > 0) model = available[0]

      console.log('[gemini-token] Live models available:', available)
      console.log('[gemini-token] Selected:', model)
    }
  } catch (e) {
    console.warn('[gemini-token] No se pudo detectar modelos, usando fallback:', model, e)
  }

  return NextResponse.json({ key, model })
}
