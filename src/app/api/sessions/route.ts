import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { name, dob, gender } = await request.json()

  if (!name || !dob) {
    return NextResponse.json({ error: 'Name and date of birth are required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Look up existing patient
  let { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('name', name.trim())
    .eq('dob', dob)
    .single()

  const isReturning = !!patient

  // Create new patient if not found
  if (!patient) {
    const { data: newPatient, error } = await supabase
      .from('patients')
      .insert({ name: name.trim(), dob, gender })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 })
    }
    patient = newPatient
  }

  // Create new session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({ patient_id: patient.id, status: 'active' })
    .select()
    .single()

  if (sessionError) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  return NextResponse.json({
    sessionId: session.id,
    patient,
    isReturning,
  })
}
