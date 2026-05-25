'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  stopRef?: React.MutableRefObject<(() => void) | null>
  startRef?: React.MutableRefObject<(() => void) | null>
}

export default function VoiceInput({ onTranscript, disabled, stopRef, startRef }: VoiceInputProps) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (disabled || recording || transcribing) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)

        const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType })
        if (blob.size === 0) return

        setTranscribing(true)
        try {
          const form = new FormData()
          form.append('audio', blob)
          const res = await fetch('/api/transcribe', { method: 'POST', body: form })
          if (res.ok) {
            const { text } = await res.json()
            if (text?.trim()) onTranscript(text.trim())
          }
        } finally {
          setTranscribing(false)
        }
      }

      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      alert('Microphone access is required for voice input.')
    }
  }, [disabled, recording, transcribing, onTranscript])

  if (stopRef) stopRef.current = stopRecording
  if (startRef) startRef.current = () => { if (!recording && !disabled) startRecording() }

  return (
    <button
      type="button"
      onPointerDown={startRecording}
      onPointerUp={stopRecording}
      onPointerLeave={stopRecording}
      disabled={disabled || transcribing}
      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
        recording
          ? 'bg-red-500 animate-pulse'
          : transcribing
            ? 'bg-teal-500 animate-pulse'
            : 'bg-teal-700 hover:bg-teal-800'
      } disabled:opacity-50`}
      title={recording ? 'Release to send' : transcribing ? 'Transcribing...' : 'Hold to speak'}
    >
      {transcribing ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </button>
  )
}
