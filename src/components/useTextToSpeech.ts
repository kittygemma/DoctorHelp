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

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

export function useTextToSpeech(onDone?: () => void) {
  const [speaking, setSpeaking] = useState(false)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current.disconnect()
      sourceRef.current = null
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

      if (!res.ok) throw new Error(`TTS API returned ${res.status}`)

      const arrayBuffer = await res.arrayBuffer()
      const ctx = getAudioContext()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      sourceRef.current = source

      source.onended = () => {
        sourceRef.current = null
        setSpeaking(false)
        onDone?.()
      }

      source.start()
    } catch (err) {
      console.error('ElevenLabs TTS failed, falling back to browser:', err)
      sourceRef.current = null
      speakWithBrowser(text, () => {
        setSpeaking(false)
        onDone?.()
      })
    }
  }, [stop, onDone])

  return { speak, stop, speaking }
}
