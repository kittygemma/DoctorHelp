'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CompleteButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleComplete() {
    setLoading(true)
    await fetch(`/api/sessions/${sessionId}/complete?action=doctor-complete`, {
      method: 'POST',
    })
    router.push('/dashboard')
  }

  return (
    <button
      onClick={handleComplete}
      disabled={loading}
      className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-800 transition-colors disabled:opacity-50"
    >
      {loading ? 'Completing...' : 'Mark as Completed'}
    </button>
  )
}
