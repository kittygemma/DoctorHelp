'use client'

import { useState, useRef, useCallback } from 'react'

interface SpeechRecognitionResult {
  readonly 0: { transcript: string }
}

interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEventMap {
  results: SpeechRecognitionResultList
}

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  stopRef?: React.MutableRefObject<(() => void) | null>
  startRef?: React.MutableRefObject<(() => void) | null>
}

export default function VoiceInput({ onTranscript, disabled, stopRef, startRef }: VoiceInputProps) {
  const [listening, setListening] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }, [])

  if (stopRef) stopRef.current = stop
  if (startRef) startRef.current = () => { if (!listening && !disabled) toggle() }

  const toggle = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      onTranscript(transcript)
    }

    recognition.onerror = () => {
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [listening, onTranscript])

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
        listening
          ? 'bg-red-500 animate-pulse'
          : 'bg-teal-700 hover:bg-teal-800'
      } disabled:opacity-50`}
      title={listening ? 'Stop recording' : 'Start recording'}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  )
}
