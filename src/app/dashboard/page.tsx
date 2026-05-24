'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import PatientCard from '@/components/PatientCard'
import type { SessionWithPatient } from '@/lib/types'

function sortSessions(sessions: SessionWithPatient[]): SessionWithPatient[] {
  return [...sessions].sort((a, b) => {
    const ua = a.urgency ?? 6
    const ub = b.urgency ?? 6
    if (ua !== ub) return ua - ub
    return new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime()
  })
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionWithPatient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchSessions() {
      const { data } = await supabase
        .from('sessions')
        .select('*, patients(*)')
        .order('arrived_at', { ascending: true })

      if (data) {
        setSessions(data as SessionWithPatient[])
      }
      setLoading(false)
    }

    fetchSessions()

    // Subscribe to realtime updates
    const channel = supabase
      .channel('sessions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sessions' },
        async (payload) => {
          // Fetch the full session with patient data
          const { data } = await supabase
            .from('sessions')
            .select('*, patients(*)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setSessions((prev) => [...prev, data as SessionWithPatient])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        async (payload) => {
          const { data } = await supabase
            .from('sessions')
            .select('*, patients(*)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setSessions((prev) =>
              prev.map((s) => (s.id === data.id ? (data as SessionWithPatient) : s))
            )
          }
        }
      )
      .subscribe()

    // Auto-expire: every 60 seconds, dismiss sessions active for 30+ minutes
    const expireInterval = setInterval(async () => {
      const now = Date.now()
      const expired = sessions.filter(
        (s) => s.status === 'active' && now - new Date(s.arrived_at).getTime() > 30 * 60 * 1000
      )
      for (const s of expired) {
        await fetch(`/api/sessions/${s.id}/dismiss`, { method: 'POST' })
        setSessions((prev) => prev.filter((p) => p.id !== s.id))
      }
    }, 60000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(expireInterval)
    }
  }, [sessions])

  const handleDismiss = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const inProgressSessions = sessions.filter((s) => s.status === 'active')
  const waitingSessions = sortSessions(sessions.filter((s) => s.status === 'waiting'))
  const completedSessions = sessions.filter((s) => s.status === 'completed')

  const totalMinutes = waitingSessions.reduce((sum, s) => {
    return sum + (Date.now() - new Date(s.arrived_at).getTime()) / 60000
  }, 0)
  const avgWait = waitingSessions.length > 0 ? Math.round(totalMinutes / waitingSessions.length) : 0

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Nav */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🩺</span>
          <span className="font-extrabold text-base text-slate-900">DoctorHelp</span>
          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            Dashboard
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Doctor</span>
          <div className="w-8 h-8 bg-teal-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
            DR
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">In Progress</div>
          <div className="text-3xl font-extrabold text-amber-500 mt-1">{inProgressSessions.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Waiting</div>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">{waitingSessions.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Completed</div>
          <div className="text-3xl font-extrabold text-emerald-500 mt-1">{completedSessions.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Avg Wait</div>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">{avgWait}m</div>
        </div>
      </div>

      {/* Patient list */}
      <div className="px-6 pb-6">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : (
          <>
            {/* Waiting for doctor — sorted by urgency */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-slate-900">Waiting for Doctor</h2>
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Live — sorted by urgency + arrival
              </div>
            </div>
            {waitingSessions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No patients waiting</div>
            ) : (
              <div className="space-y-2">
                {waitingSessions.map((session) => (
                  <PatientCard key={session.id} session={session} onDismiss={handleDismiss} />
                ))}
              </div>
            )}

            {/* Still chatting with bot */}
            {inProgressSessions.length > 0 && (
              <>
                <h2 className="font-bold text-sm text-slate-900 mt-8 mb-3">Chatting with AI</h2>
                <div className="space-y-2">
                  {inProgressSessions.map((session) => (
                    <PatientCard key={session.id} session={session} onDismiss={handleDismiss} />
                  ))}
                </div>
              </>
            )}

            {/* Doctor completed */}
            {completedSessions.length > 0 && (
              <>
                <h2 className="font-bold text-sm text-slate-900 mt-8 mb-3">Completed</h2>
                <div className="space-y-2">
                  {completedSessions.map((session) => (
                    <PatientCard key={session.id} session={session} onDismiss={handleDismiss} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
