'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SessionWithPatient } from '@/lib/types'

const URGENCY_CONFIG: Record<number, { color: string; bg: string; label: string; border: string }> = {
  1: { color: 'text-red-600', bg: 'bg-red-600', label: 'CRITICAL', border: 'border-l-red-600' },
  2: { color: 'text-orange-500', bg: 'bg-orange-500', label: 'URGENT', border: 'border-l-orange-500' },
  3: { color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'MODERATE', border: 'border-l-yellow-500' },
  4: { color: 'text-green-500', bg: 'bg-green-500', label: 'LOW', border: 'border-l-green-500' },
  5: { color: 'text-blue-500', bg: 'bg-blue-500', label: 'TRIVIAL', border: 'border-l-blue-500' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function PatientCard({ session, onDismiss }: { session: SessionWithPatient; onDismiss?: (id: string) => void }) {
  const [dismissing, setDismissing] = useState(false)
  const urgency = session.urgency ?? 5
  const config = URGENCY_CONFIG[urgency] ?? URGENCY_CONFIG[5]
  const patient = session.patients

  async function handleDismiss() {
    setDismissing(true)
    await fetch(`/api/sessions/${session.id}/dismiss`, { method: 'POST' })
    onDismiss?.(session.id)
  }

  return (
    <div className={`bg-white rounded-xl p-4 border-l-4 ${config.border} shadow-sm flex items-start gap-3`}>
      <div className="text-center flex-shrink-0">
        <div className={`${config.bg} text-white w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-lg`}>
          {urgency}
        </div>
        <div className={`text-[9px] font-bold mt-1 ${config.color}`}>{config.label}</div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900">{patient.name}</span>
            {patient.gender && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                {patient.gender === 'male' ? 'M' : 'F'}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            {formatTime(session.arrived_at)} ({timeAgo(session.arrived_at)})
          </div>
        </div>

        {session.summary && (
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-2">
            <span className="font-semibold">Summary:</span> {session.summary}
          </p>
        )}

        <div className="flex gap-1.5 mt-2 flex-wrap">
          {session.diagnosis?.map((d) => (
            <span
              key={d.name}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                urgency <= 2
                  ? 'bg-red-50 text-red-600'
                  : urgency === 3
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'bg-green-50 text-green-600'
              }`}
            >
              {d.name}
            </span>
          ))}
          {session.status === 'active' && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              Still chatting
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <Link
          href={`/dashboard/${session.id}`}
          className={`px-3 py-2 rounded-lg text-xs font-bold text-center ${
            session.status === 'waiting'
              ? 'bg-teal-700 text-white hover:bg-teal-800'
              : session.status === 'completed'
              ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          {session.status === 'active' ? 'Chatting...' : 'View'}
        </Link>
        {session.status !== 'completed' && (
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
