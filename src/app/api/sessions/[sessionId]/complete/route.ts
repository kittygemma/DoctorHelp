import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { searchParams } = new URL(_request.url)
  const action = searchParams.get('action')

  if (action === 'doctor-complete') {
    const { error } = await supabase
      .from('sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    if (error) {
      return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 })
    }
  } else {
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'waiting' })
      .eq('id', sessionId)

    if (error) {
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
