import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()

  // Delete messages first (foreign key constraint)
  await supabase.from('messages').delete().eq('session_id', sessionId)

  // Delete the session
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    return NextResponse.json({ error: 'Failed to dismiss session' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
