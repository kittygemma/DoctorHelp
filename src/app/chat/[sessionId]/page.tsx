'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ChatMessage from '@/components/ChatMessage'
import VoiceInput from '@/components/VoiceInput'
import { useTextToSpeech } from '@/components/useTextToSpeech'
import type { Message } from '@/lib/types'

const OPENING_MESSAGE: Message = {
  id: 'opening',
  session_id: '',
  role: 'assistant',
  content: '',
  created_at: new Date().toISOString(),
}

export default function ChatPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [readyToWrap, setReadyToWrap] = useState(false)
  const [critical, setCritical] = useState(false)
  const [done, setDone] = useState(false)
  const [patientName, setPatientName] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const voiceStopRef = useRef<(() => void) | null>(null)
  const voiceStartRef = useRef<(() => void) | null>(null)
  const { speak, stop: stopSpeaking, speaking } = useTextToSpeech(() => {
    // Auto-start listening when AI finishes speaking
    setTimeout(() => voiceStartRef.current?.(), 300)
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch patient name and set opening message
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: '__init__' }),
        })
        if (!res.ok) return
        const data = await res.json()
        setPatientName(data.patientName || '')
        setMessages([{
          ...OPENING_MESSAGE,
          session_id: sessionId,
          content: data.reply,
        }])
        speak(data.reply)
      } catch {
        setMessages([{
          ...OPENING_MESSAGE,
          session_id: sessionId,
          content: "Welcome! I'd like to understand what's bringing you in today. Can you describe your main concern?",
        }])
      }
    }
    init()
  }, [sessionId])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const patientMsg: Message = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role: 'patient',
      content: text.trim(),
      created_at: new Date().toISOString(),
    }

    voiceStopRef.current?.()
    stopSpeaking()
    setMessages((prev) => [...prev, patientMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text.trim() }),
      })

      const data = await res.json()

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, aiMsg])
      speak(data.reply)

      if (data.assessment?.critical) {
        voiceStopRef.current?.()
        setCritical(true)
      } else if (data.assessment?.ready_to_wrap) {
        setReadyToWrap(true)
      }
    } catch {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role: 'assistant',
        content: "I'm sorry, I'm having trouble right now. Please try again.",
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  async function handleDone() {
    setLoading(true)
    try {
      await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' })
      setDone(true)
    } catch {
      alert('Failed to complete session')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  if (critical) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-red-50">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4 animate-pulse">🚨</div>
          <h1 className="text-2xl font-bold text-red-700 mb-3">Please Go to the Front Desk</h1>
          <p className="text-red-600 text-lg mb-4">Your symptoms need immediate attention from our staff.</p>
          <div className="bg-red-100 border-2 border-red-300 rounded-xl p-4">
            <p className="text-red-800 font-semibold">Walk to the front desk now and let them know you need urgent help.</p>
          </div>
          <p className="text-red-400 text-sm mt-4">Your doctor has been notified.</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-green-50">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-teal-700 mb-2">Thank you{patientName ? `, ${patientName}` : ''}!</h1>
          <p className="text-slate-500">Your doctor will review your information shortly.</p>
          <p className="text-slate-400 text-sm mt-2">You can close this page now.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-teal-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Image src="/logo-icon.png" alt="DoctorHelp" width={36} height={36} className="rounded-full" />
          <div>
            <div className="font-bold text-sm">DoctorHelp</div>
            <div className="text-[10px] opacity-75">{speaking ? 'Speaking...' : 'Session active'}</div>
          </div>
        </div>
        <button
          onClick={handleDone}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            readyToWrap
              ? 'bg-white text-teal-700 animate-pulse'
              : 'bg-white/20 hover:bg-white/30'
          }`}
        >
          Done
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-teal-50 border-b border-teal-100 px-4 py-2.5 text-xs text-teal-700 flex items-start gap-2">
        <span className="mt-0.5">ℹ️</span>
        <span>When you feel you&apos;ve shared all the information your doctor needs, press the <strong>Done</strong> button in the top right corner.</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 bg-teal-700 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
              AI
            </div>
            <div className="bg-white rounded-2xl rounded-bl-sm shadow-sm px-4 py-3 text-sm text-slate-400">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3 bg-white flex items-center gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tap mic or type..."
          disabled={loading}
          className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
        />
        <VoiceInput onTranscript={setInput} disabled={loading} stopRef={voiceStopRef} startRef={voiceStartRef} />
        {input.trim() && (
          <button
            type="submit"
            disabled={loading}
            className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-teal-800 disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </form>
    </div>
  )
}
