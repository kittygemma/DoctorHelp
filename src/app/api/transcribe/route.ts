import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const audioFile = formData.get('audio')

  if (!audioFile || !(audioFile instanceof Blob)) {
    return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 })
  }

  const groqForm = new FormData()
  groqForm.append('file', audioFile, 'recording.webm')
  groqForm.append('model', 'whisper-large-v3-turbo')
  groqForm.append('language', 'en')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: groqForm,
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Groq transcription failed:', error)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
  }

  const data = await response.json()
  return NextResponse.json({ text: data.text || '' })
}
