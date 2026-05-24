'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CheckinPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
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
        body: JSON.stringify({ name, dob }),
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
          <div className="text-3xl mb-2">👋</div>
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
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          required
          className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 mb-6 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
        />

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
