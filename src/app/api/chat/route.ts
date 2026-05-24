import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chat } from '@/lib/claude'
import type { Message, Patient } from '@/lib/types'

export async function POST(request: NextRequest) {
  const { sessionId, message } = await request.json()

  if (!sessionId || !message) {
    return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch session with patient info
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*, patients(*)')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const patient = session.patients as Patient

  // Handle init — just get the opening message from Claude
  if (message === '__init__') {
    const { reply, assessment } = await chat(
      patient.name,
      patient.medical_history,
      []
    )

    // Save opening message
    await supabase.from('messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: reply,
    })

    if (assessment) {
      await supabase.from('sessions').update({
        summary: assessment.summary,
        urgency: assessment.urgency,
        diagnosis: assessment.possible_diagnoses,
      }).eq('id', sessionId)
    }

    return NextResponse.json({ reply, assessment, patientName: patient.name })
  }

  // Save the patient's message
  await supabase.from('messages').insert({
    session_id: sessionId,
    role: 'patient',
    content: message,
  })

  // Fetch full message history
  const { data: existingMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  const allMessages = existingMessages as Message[]

  // Call Claude
  const { reply, assessment } = await chat(
    patient.name,
    patient.medical_history,
    allMessages
  )

  // Save Claude's response
  await supabase.from('messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: reply,
  })

  // Update session with latest assessment
  if (assessment) {
    await supabase
      .from('sessions')
      .update({
        summary: assessment.summary,
        urgency: assessment.urgency,
        diagnosis: assessment.possible_diagnoses,
      })
      .eq('id', sessionId)
  }

  return NextResponse.json({
    reply,
    assessment,
    patientName: patient.name,
  })
}
