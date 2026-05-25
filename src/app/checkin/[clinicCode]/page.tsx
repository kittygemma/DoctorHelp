'use client'

import Image from 'next/image'
import { useState, use } from 'react'
import { useRouter } from 'next/navigation'

export default function ClinicCheckinPage({ params }: { params: Promise<{ clinicCode: string }> }) {
  const { clinicCode } = use(params)
  const router = useRouter()
  const [name, setName] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const [gender, setGender] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dob: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
          gender,
          clinicCode,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      const { sessionId } = await res.json()
      router.push(`/chat/${sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <Image src="/logo-icon.png" alt="DoctorHelp" width={80} height={80} className="mx-auto mb-1 rounded-xl" />
          <h1 className="text-xl font-bold text-teal-700">Welcome</h1>
          <p className="text-sm text-slate-500 mt-1">Let's get you checked in</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
        )}

        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
          Full Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 mb-4 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
          placeholder="Jane Doe"
        />

        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
          Date of Birth
        </label>
        <div className="flex gap-2 mb-4">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
            className="flex-1 border-2 border-slate-200 rounded-lg px-3 py-3 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
          >
            <option value="">Month</option>
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
              <option key={m} value={String(i + 1)}>{m}</option>
            ))}
          </select>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
            className="w-20 border-2 border-slate-200 rounded-lg px-3 py-3 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
          >
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
            min={new Date().getFullYear() - 120}
            max={new Date().getFullYear()}
            placeholder="Year"
            className="w-24 border-2 border-slate-200 rounded-lg px-3 py-3 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
          />
        </div>

        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
          Gender at Birth
        </label>
        <div className="flex gap-2 mb-6">
          {['Male', 'Female'].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g.toLowerCase())}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-colors ${
                gender === g.toLowerCase()
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-50 border-2 border-slate-200 text-slate-600 hover:border-teal-500'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-700 text-white py-3.5 rounded-xl font-bold text-base hover:bg-teal-800 transition-colors disabled:opacity-50"
        >
          {loading ? 'Checking in...' : 'Start Check-in'}
        </button>

        <p className="text-center text-xs text-slate-400 mt-4">
          Your information is private and secure
        </p>
      </form>
    </div>
  )
}
