// src/app/api/tts/route.ts

const ELEVENLABS_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL' // Sarah — soft, warm, professional

export async function POST(request: Request) {
  const { text } = await request.json()

  if (!text || typeof text !== 'string') {
    return Response.json({ error: 'text is required' }, { status: 400 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.75,
        },
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    console.error('ElevenLabs API error:', res.status, body)
    return Response.json({ error: 'TTS generation failed' }, { status: 502 })
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
