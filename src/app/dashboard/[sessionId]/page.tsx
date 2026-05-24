import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Patient, Message, Diagnosis } from '@/lib/types'
import CompleteButton from '@/components/CompleteButton'

const URGENCY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Critical', color: 'bg-red-100 text-red-700' },
  2: { label: 'Urgent', color: 'bg-orange-100 text-orange-700' },
  3: { label: 'Moderate', color: 'bg-yellow-100 text-yellow-700' },
  4: { label: 'Low', color: 'bg-green-100 text-green-700' },
  5: { label: 'Trivial', color: 'bg-blue-100 text-blue-700' },
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('*, patients(*)')
    .eq('id', sessionId)
    .single()

  if (!session) notFound()

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  const patient = session.patients as Patient
  const allMessages = (messages || []) as Message[]
  const diagnosis = (session.diagnosis || []) as Diagnosis[]
  const urgency = session.urgency ?? 5
  const urgencyInfo = URGENCY_LABELS[urgency] ?? URGENCY_LABELS[5]

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Nav */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-teal-700 hover:text-teal-800 text-sm font-semibold">
          ← Dashboard
        </Link>
        <span className="text-slate-300">|</span>
        <span className="font-bold text-sm text-slate-900">{patient.name}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${urgencyInfo.color}`}>
          {urgencyInfo.label}
        </span>
      </div>

      <div className="max-w-4xl mx-auto p-6 grid md:grid-cols-3 gap-6">
        {/* Left: Assessment panel */}
        <div className="md:col-span-1 space-y-4">
          {/* Patient Info */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Patient Info</h3>
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-500">Name:</span> <span className="font-semibold">{patient.name}</span></div>
              <div><span className="text-slate-500">DOB:</span> <span className="font-semibold">{patient.dob}</span></div>
              {patient.gender && <div><span className="text-slate-500">Gender:</span> <span className="font-semibold capitalize">{patient.gender}</span></div>}
              <div><span className="text-slate-500">Arrived:</span> <span className="font-semibold">{new Date(session.arrived_at).toLocaleTimeString()}</span></div>
              <div><span className="text-slate-500">Status:</span> <span className="font-semibold capitalize">{session.status}</span></div>
            </div>
          </div>

          {/* Medical History */}
          {patient.medical_history && (patient.medical_history.conditions?.length || patient.medical_history.medications?.length || patient.medical_history.allergies?.length) && (
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Medical History</h3>
              <div className="space-y-2 text-sm">
                {patient.medical_history.conditions?.length ? (
                  <div><span className="text-slate-500">Conditions:</span> {patient.medical_history.conditions.join(', ')}</div>
                ) : null}
                {patient.medical_history.medications?.length ? (
                  <div><span className="text-slate-500">Medications:</span> {patient.medical_history.medications.join(', ')}</div>
                ) : null}
                {patient.medical_history.allergies?.length ? (
                  <div><span className="text-slate-500">Allergies:</span> {patient.medical_history.allergies.join(', ')}</div>
                ) : null}
              </div>
            </div>
          )}

          {/* Complete Button */}
          {session.status === 'waiting' && (
            <CompleteButton sessionId={sessionId} />
          )}
          {session.status === 'completed' && (
            <div className="bg-emerald-50 text-emerald-700 text-center py-3 rounded-xl font-bold text-sm">
              Visit Completed
            </div>
          )}

          {/* AI Assessment */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">AI Assessment</h3>
            {session.summary && (
              <p className="text-sm text-slate-700 leading-relaxed mb-4">{session.summary}</p>
            )}
            <div className="space-y-2">
              {diagnosis.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    d.confidence === 'high' ? 'bg-red-50 text-red-600' :
                    d.confidence === 'medium' ? 'bg-yellow-50 text-yellow-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {d.confidence}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Chat transcript */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chat Transcript</h3>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {allMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'patient' ? 'justify-end' : 'gap-2'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 bg-teal-700 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold">AI</div>
                  )}
                  <div className={`max-w-[75%] px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'patient'
                      ? 'bg-teal-700 text-white rounded-xl rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-xl rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
