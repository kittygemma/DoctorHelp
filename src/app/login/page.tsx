'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🩺</div>
          <h1 className="text-xl font-bold text-slate-900">Doctor Login</h1>
          <p className="text-sm text-slate-500 mt-1">Access the triage dashboard</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
        )}

        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 mb-4 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
          placeholder="doctor@clinic.com"
        />

        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 mb-6 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-700 text-white py-3.5 rounded-xl font-bold text-base hover:bg-teal-800 transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
