# Replace Web Speech API with Groq Whisper STT

## Problem

The browser Web Speech API (`webkitSpeechRecognition`) used for patient voice input is unreliable: it drops words, has inconsistent browser support, and required multiple bug workarounds (text accumulation, `continuous: false` hack). This degrades the patient experience during triage conversations.

## Solution

Replace Web Speech API with Groq's hosted Whisper Large V3 Turbo model for speech-to-text. The patient holds a mic button to record, releases to transcribe. The transcribed text feeds into the existing Gemini chat pipeline unchanged.

## Data Flow

```
Patient holds mic → MediaRecorder captures audio (webm)
Patient releases → POST audio blob to /api/transcribe
/api/transcribe → forwards to Groq Whisper API → returns text
Text fills input field → patient taps send (or auto-send)
POST text to /api/chat → Gemini generates diagnosis + reply
Reply displayed in chat + spoken via browser TTS
```

## Changes

### New: `/api/transcribe/route.ts`

Server-side API route that:
- Accepts POST with `multipart/form-data` containing an audio file
- Forwards to `https://api.groq.com/openai/v1/audio/transcriptions`
- Uses model `whisper-large-v3-turbo`, language `en`
- Authenticates with `GROQ_API_KEY` env var
- Returns `{ text: string }`

### Rewrite: `VoiceInput.tsx`

Replace `webkitSpeechRecognition` with browser `MediaRecorder` API:
- Hold-to-talk: `onPointerDown` starts recording, `onPointerUp` stops and sends
- Records as `audio/webm` (broadly supported, small file size)
- On release: POST audio blob to `/api/transcribe`, call `onTranscript` with result
- Three visual states: idle (teal), recording (red pulse), transcribing (teal pulse)
- Same props interface: `onTranscript`, `disabled`, `stopRef`, `startRef`
- `stopRef` stops any in-progress recording
- `startRef` triggers recording start (used by TTS onDone for conversational flow)

### Unchanged

- `useTextToSpeech.ts` — browser SpeechSynthesis, no changes
- `/api/chat/route.ts` — Gemini brain, no changes
- `chat/[sessionId]/page.tsx` — same flow, receives transcript from VoiceInput the same way
- Supabase message storage, urgency scoring, dashboard — all untouched
- `gemini.ts` — no changes

### New Environment Variable

- `GROQ_API_KEY` — free API key from console.groq.com (no credit card required)
- Added to `.env.local` for local dev
- Added to Vercel env vars (Production + Development)

## Groq API Details

Endpoint: `POST https://api.groq.com/openai/v1/audio/transcriptions`

Request (multipart/form-data):
- `file`: audio blob
- `model`: `whisper-large-v3-turbo`
- `language`: `en`

Response: `{ "text": "transcribed words" }`

Auth header: `Authorization: Bearer $GROQ_API_KEY`

Free tier: 2,000 requests/day, 7,200 audio seconds/hour. No credit card.

## UX Change

Before: Tap mic to start, tap again to stop. Interim transcription appears as patient speaks (when it works).

After: Hold mic to speak, release to transcribe. Brief "Transcribing..." indicator (~0.5s), then text appears in input. Patient taps send or text auto-sends.

## What This Does NOT Change

- The AI diagnosis pipeline (Gemini) is completely untouched
- Doctor dashboard, urgency scoring, patient cards — all the same
- Message history in Supabase — still saved
- TTS (Maya speaking back) — still browser SpeechSynthesis
