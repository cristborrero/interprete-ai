import { NextResponse } from 'next/server'

/**
 * POST /api/translate
 * Body: { text: string, from: 'es' | 'en' }
 * Returns: { translation: string }
 */

const SYSTEM_PROMPT = `You are a professional simultaneous interpreter specializing in Spanish ↔ English.

RULES:
- Receive a text in one language and return ONLY the translation to the other language.
- No explanations, no commentary, no greetings. Just the translation.
- Preserve the speaker's tone (formal, informal, urgent, calm).
- Use correct medical and professional terminology when relevant.
- Context: medical appointments and professional settings in the UK.
  The user is Colombian Spanish-speaking communicating with English-speaking professionals.`

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    )
  }

  let body: { text?: string; from?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { text, from } = body
  if (!text || !from) {
    return NextResponse.json({ error: 'Missing text or from' }, { status: 400 })
  }

  const direction = from === 'es'
    ? 'Translate this Spanish text to English'
    : 'Translate this English text to Spanish'

  const prompt = `${direction}. Return ONLY the translation, nothing else.\n\nText: ${text}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[translate] Gemini error:', errText)
      return NextResponse.json(
        { error: `Gemini API error: ${res.status}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    const translation =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''

    return NextResponse.json({ translation })
  } catch (e) {
    console.error('[translate] fetch error:', e)
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 })
  }
}
