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

function getOrCreateAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    const ctx = getOrCreateAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start()
    document.removeEventListener('click', unlock, true)
    document.removeEventListener('touchstart', unlock, true)
  }
  document.addEventListener('click', unlock, true)
  document.addEventListener('touchstart', unlock, true)
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
      const ctx = getOrCreateAudioContext()
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) throw new Error(`TTS API returned ${res.status}`)

      const arrayBuffer = await res.arrayBuffer()
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
