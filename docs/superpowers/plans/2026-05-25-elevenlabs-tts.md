# ElevenLabs TTS Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser Web Speech API TTS with ElevenLabs for natural-sounding voice output from Maya.

**Architecture:** A new `/api/tts` POST route calls the ElevenLabs REST API server-side and streams back audio/mpeg. The existing `useTextToSpeech` hook is rewritten to fetch from this endpoint and play audio via an `Audio` object, keeping the same exported interface (`speak`, `stop`, `speaking`) so the chat page requires zero changes. If ElevenLabs fails, the hook falls back to browser `speechSynthesis`.

**Tech Stack:** Next.js 16 App Router (route handler), ElevenLabs REST API (`eleven_multilingual_v2` model), Web Audio (`Audio` object)

**Spec:** `docs/superpowers/specs/2026-05-25-elevenlabs-tts-design.md`

**Reference docs:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/app/api/tts/route.ts` | Server-side ElevenLabs proxy — accepts text, returns audio stream |
| Rewrite | `src/components/useTextToSpeech.ts` | Client hook — fetch from `/api/tts`, play audio, fallback to browser TTS |

---

### Task 1: Create the `/api/tts` route

**Files:**
- Create: `src/app/api/tts/route.ts`

- [ ] **Step 1: Create the route handler**

```ts
// src/app/api/tts/route.ts

const ELEVENLABS_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL' // Sarah — soft, warm, professional

export async function POST(request: Request) {
  const { text } = await request.json()

  if (!text || typeof text !== 'string') {
    return Response.json({ error: 'text is required' }, { status: 400 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
  }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.75,
        },
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    console.error('ElevenLabs API error:', res.status, body)
    return Response.json({ error: 'TTS generation failed' }, { status: 502 })
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 2: Verify the route works with curl**

Run from the project root (dev server must be running on port 3000):

```bash
curl -s -o /tmp/maya-test.mp3 -w "%{http_code}" \
  -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, I am Maya. How can I help you today?"}'
```

Expected: HTTP 200 and a valid MP3 file at `/tmp/maya-test.mp3`. Play it with `afplay /tmp/maya-test.mp3` to hear the voice.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tts/route.ts
git commit -m "feat: add /api/tts route for ElevenLabs voice synthesis"
```

---

### Task 2: Rewrite the `useTextToSpeech` hook

**Files:**
- Rewrite: `src/components/useTextToSpeech.ts`

- [ ] **Step 1: Rewrite the hook to use ElevenLabs with browser fallback**

Replace the entire contents of `src/components/useTextToSpeech.ts` with:

```ts
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
```

Key changes from the original:
- `speak` is now `async` — it fetches from `/api/tts`, creates a blob URL, plays via `Audio`
- `stop` cleans up both the Audio object and blob URL, plus cancels any browser fallback speech
- `cleanup` helper prevents memory leaks by revoking blob URLs
- On fetch failure, falls back to `speakWithBrowser` (the original browser TTS logic)
- Same exported interface: `{ speak, stop, speaking }` — chat page needs zero changes

- [ ] **Step 2: Test manually in the browser**

1. Start the dev server: `cd ~/projects/doctorhelp && npm run dev`
2. Open a patient check-in link (e.g., `http://localhost:3000/checkin/<clinic-code>`)
3. Fill in patient info and start a chat session
4. Verify: Maya's first message plays in the ElevenLabs voice (not the robotic browser voice)
5. Verify: after Maya finishes speaking, the mic auto-starts listening (300ms delay)
6. Verify: typing a message and sending it triggers a new ElevenLabs response
7. Verify: pressing "Done" during speech stops playback

- [ ] **Step 3: Test the fallback**

1. Temporarily rename `ELEVENLABS_API_KEY` to `ELEVENLABS_API_KEY_OFF` in `.env.local`
2. Restart the dev server
3. Send a message in the chat — Maya should fall back to the browser voice
4. Check browser console: should see `ElevenLabs TTS failed, falling back to browser:` error log
5. Restore the env var name and restart

- [ ] **Step 4: Commit**

```bash
git add src/components/useTextToSpeech.ts
git commit -m "feat: use ElevenLabs TTS for Maya's voice with browser fallback"
```

---

### Task 3: Add env var to Vercel for production

- [ ] **Step 1: Add the ElevenLabs API key to Vercel**

```bash
cd ~/projects/doctorhelp && npx vercel env add ELEVENLABS_API_KEY production
```

Paste the API key when prompted. This makes the `/api/tts` route work in production.

- [ ] **Step 2: Deploy and verify**

```bash
git push origin main
```

Vercel auto-deploys on push. Once deployed, open https://doctor-help-tau.vercel.app and test a patient chat session to confirm the ElevenLabs voice works in production.

- [ ] **Step 3: Commit any remaining changes**

If there are no code changes from this task, skip this step.
