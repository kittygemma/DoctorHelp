'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') || 'starter'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, plan },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Also sign in immediately since email confirmation may be off
    await supabase.auth.signInWithPassword({ email, password })

    // Create Stripe checkout session
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan,
        doctorName: name,
        email,
        userId: authData.user?.id,
      }),
    })

    if (!res.ok) {
      setError('Failed to create checkout session')
      setLoading(false)
      return
    }

    const { url } = await res.json()
    window.location.href = url
  }

  const planLabel = plan === 'professional' ? 'Professional — $149/mo' : 'Starter — $49/mo'

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🩺</div>
          <h1 className="text-xl font-bold text-slate-900">Create Your Account</h1>
          <p className="text-sm text-slate-500 mt-1">
            {planLabel}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
        )}

        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
          Your Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 mb-4 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
          placeholder="Dr. Martinez"
        />

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
          minLength={6}
          className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 mb-6 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
          placeholder="At least 6 characters"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-700 text-white py-3.5 rounded-xl font-bold text-base hover:bg-teal-800 transition-colors disabled:opacity-50"
        >
          {loading ? 'Setting up...' : 'Continue to Payment'}
        </button>
      </form>
    </div>
  )
}
