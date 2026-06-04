import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION

  if (!key || !region) {
    console.error('[azure-token] Faltan credenciales AZURE_SPEECH_KEY o AZURE_SPEECH_REGION')
    return NextResponse.json(
      { error: 'Credenciales de Azure Speech no configuradas' },
      { status: 500 }
    )
  }

  try {
    const res = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('[azure-token] Error de Azure al emitir token:', errText)
      throw new Error(`Azure STS error: ${res.statusText}`)
    }

    const token = await res.text()
    return NextResponse.json({ token, region })
  } catch (e) {
    console.error('[azure-token] Error al obtener token:', e)
    return NextResponse.json(
      { error: 'Error al generar token de Azure' },
      { status: 500 }
    )
  }
}
