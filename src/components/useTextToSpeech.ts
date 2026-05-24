'use client'

import { useRef, useCallback, useState } from 'react'

export function useTextToSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback(async (text: string) => {
    stop()
    setSpeaking(true)

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => {
          setSpeaking(false)
          URL.revokeObjectURL(url)
        }
        audio.onerror = () => {
          setSpeaking(false)
          URL.revokeObjectURL(url)
        }
        await audio.play()
        return
      }
    } catch {
      // ElevenLabs failed, fall through to browser TTS
    }

    // Fallback: browser Web Speech API
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.95
      utterance.pitch = 1.0
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    } else {
      setSpeaking(false)
    }
  }, [stop])

  return { speak, stop, speaking }
}
