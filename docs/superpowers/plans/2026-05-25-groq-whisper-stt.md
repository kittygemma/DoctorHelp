# Groq Whisper STT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreliable browser Web Speech API with Groq's hosted Whisper model for patient voice transcription, using a hold-to-talk interaction.

**Architecture:** A new `/api/transcribe` server route receives audio blobs from the browser, forwards them to Groq's OpenAI-compatible endpoint, and returns the transcript text. The `VoiceInput` component is rewritten to use MediaRecorder (hold-to-talk) instead of `webkitSpeechRecognition`. Everything downstream (Gemini, Supabase, dashboard) is untouched.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Groq Whisper API (OpenAI-compatible), MediaRecorder API

**Spec:** `docs/superpowers/specs/2026-05-25-groq-whisper-stt-design.md`

**Note:** This project has no test runner configured (hackathon project). Verification is done via manual testing with the dev server.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/api/transcribe/route.ts` | Server route: receives audio blob, sends to Groq, returns transcript |
| Rewrite | `src/components/VoiceInput.tsx` | Hold-to-talk mic button using MediaRecorder + /api/transcribe |
| Modify | `.env.local` | Add `GROQ_API_KEY` |

Unchanged: `src/app/api/chat/route.ts`, `src/lib/gemini.ts`, `src/components/useTextToSpeech.ts`, `src/app/chat/[sessionId]/page.tsx`, all Supabase/dashboard code.

---

### Task 1: Add GROQ_API_KEY to environment

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Get a Groq API key**

Go to https://console.groq.com, sign up (free, no credit card), go to API Keys, create a new key.

- [ ] **Step 2: Add to `.env.local`**

Add this line at the end of `.env.local`:

```
GROQ_API_KEY=gsk_your_key_here
```

- [ ] **Step 3: Add to Vercel environment variables**

```bash
cd ~/projects/doctorhelp
vercel env add GROQ_API_KEY production
vercel env add GROQ_API_KEY development
```

Paste the key when prompted for each.

---

### Task 2: Create `/api/transcribe` route

**Files:**
- Create: `src/app/api/transcribe/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/transcribe/route.ts` with this content:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const audioFile = formData.get('audio')

  if (!audioFile || !(audioFile instanceof Blob)) {
    return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 })
  }

  const groqForm = new FormData()
  groqForm.append('file', audioFile, 'recording.webm')
  groqForm.append('model', 'whisper-large-v3-turbo')
  groqForm.append('language', 'en')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: groqForm,
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Groq transcription failed:', error)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
  }

  const data = await response.json()
  return NextResponse.json({ text: data.text || '' })
}
```

- [ ] **Step 2: Verify the route compiles**

```bash
cd ~/projects/doctorhelp && npm run build
```

Expected: Build succeeds with the new route listed under `Route (app)` as `ƒ /api/transcribe`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/transcribe/route.ts
git commit -m "feat: add /api/transcribe route for Groq Whisper STT"
```

---

### Task 3: Rewrite VoiceInput to use MediaRecorder + hold-to-talk

**Files:**
- Rewrite: `src/components/VoiceInput.tsx`

- [ ] **Step 1: Rewrite VoiceInput.tsx**

Replace the entire contents of `src/components/VoiceInput.tsx` with:

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'

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

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (disabled || recording || transcribing) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
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

  const busy = recording || transcribing

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
```

Key changes from the original:
- `webkitSpeechRecognition` replaced with `MediaRecorder`
- `onClick` toggle replaced with `onPointerDown`/`onPointerUp`/`onPointerLeave` for hold-to-talk
- On release: audio blob is POSTed to `/api/transcribe`, transcript is passed to `onTranscript`
- Three visual states: idle (teal), recording (red pulse), transcribing (teal pulse with clock icon)
- Same props interface preserved — no changes needed in `chat/[sessionId]/page.tsx`

- [ ] **Step 2: Verify the build**

```bash
cd ~/projects/doctorhelp && npm run build
```

Expected: Build succeeds, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/VoiceInput.tsx
git commit -m "feat: rewrite VoiceInput to use MediaRecorder + Groq Whisper STT

Replace browser Web Speech API with hold-to-talk MediaRecorder
that sends audio to /api/transcribe for Groq Whisper transcription."
```

---

### Task 4: Manual testing

- [ ] **Step 1: Start the dev server**

```bash
export PATH="/opt/homebrew/bin:$PATH" && cd ~/projects/doctorhelp && npm run dev
```

- [ ] **Step 2: Test the voice flow**

Open `http://localhost:3000/checkin/[your-clinic-code]` in Chrome. Check in as a test patient.

On the chat page:
1. **Hold the mic button** and say "I have a headache and my temperature is 101 degrees"
2. **Release the button** — you should see a brief teal pulse (transcribing)
3. The transcribed text should appear in the input field within ~1 second
4. **Tap send** — Gemini should respond with Maya's reply and the assessment should be generated
5. Verify the text-to-speech still reads Maya's response aloud
6. Verify the doctor dashboard still shows urgency score and summary

- [ ] **Step 3: Test edge cases**

1. **Quick tap (no audio):** Tap and immediately release — should do nothing (empty blob is ignored)
2. **No mic permission:** Deny microphone access — should show alert
3. **While disabled:** During loading state, mic button should be non-interactive
4. **Text input still works:** Type a message manually and send — should work unchanged
5. **Auto-start after TTS:** After Maya finishes speaking, `startRef` should be callable

- [ ] **Step 4: Commit any fixes if needed**

---

### Task 5: Deploy to Vercel

- [ ] **Step 1: Verify GROQ_API_KEY is set on Vercel**

```bash
cd ~/projects/doctorhelp && vercel env ls | grep GROQ
```

Expected: `GROQ_API_KEY` shown for Production and Development environments. If not, add it:

```bash
vercel env add GROQ_API_KEY production
vercel env add GROQ_API_KEY development
```

- [ ] **Step 2: Deploy to production**

```bash
cd ~/projects/doctorhelp && vercel --prod
```

Expected: Build succeeds, `/api/transcribe` listed in routes.

- [ ] **Step 3: Test on production**

Open the production URL, check in as a test patient, and run through the voice flow to confirm transcription works in production.

- [ ] **Step 4: Commit and push**

```bash
cd ~/projects/doctorhelp && git push
```
