'use client'

import { useRef, useCallback, useState } from 'react'

export function useTextToSpeech(onDone?: () => void) {
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handleDone = useCallback(() => {
    setSpeaking(false)
    onDone?.()
  }, [onDone])

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
          URL.revokeObjectURL(url)
          handleDone()
        }
        audio.onerror = () => {
          URL.revokeObjectURL(url)
          handleDone()
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
      utterance.onend = () => handleDone()
      utterance.onerror = () => handleDone()
      window.speechSynthesis.speak(utterance)
    } else {
      handleDone()
    }
  }, [stop, handleDone])

  return { speak, stop, speaking }
}
