'use client'

import { useCallback, useRef, useState } from 'react'

function speakWithBrowser(text: string, onDone?: () => void) {
  if (!window.speechSynthesis) {
    onDone?.()
    return
  }
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.95
  utterance.pitch = 1.0
  utterance.onend = () => onDone?.()
  utterance.onerror = () => onDone?.()
  window.speechSynthesis.speak(utterance)
}

export function useTextToSpeech(onDone?: () => void) {
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current = null
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    cleanup()
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [cleanup])

  const speak = useCallback(async (text: string) => {
    stop()
    setSpeaking(true)

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) throw new Error(`TTS API returned ${res.status}`)

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        cleanup()
        setSpeaking(false)
        onDone?.()
      }

      audio.onerror = () => {
        cleanup()
        setSpeaking(false)
        onDone?.()
      }

      await audio.play()
    } catch (err) {
      console.error('ElevenLabs TTS failed, falling back to browser:', err)
      cleanup()
      speakWithBrowser(text, () => {
        setSpeaking(false)
        onDone?.()
      })
    }
  }, [stop, cleanup, onDone])

  return { speak, stop, speaking }
}
