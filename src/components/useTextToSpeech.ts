'use client'

import { useCallback, useState } from 'react'

export function useTextToSpeech(onDone?: () => void) {
  const [speaking, setSpeaking] = useState(false)

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  const speak = useCallback((text: string) => {
    stop()

    if (!window.speechSynthesis) {
      onDone?.()
      return
    }

    setSpeaking(true)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.0
    utterance.onend = () => {
      setSpeaking(false)
      onDone?.()
    }
    utterance.onerror = () => {
      setSpeaking(false)
      onDone?.()
    }
    window.speechSynthesis.speak(utterance)
  }, [stop, onDone])

  return { speak, stop, speaking }
}
