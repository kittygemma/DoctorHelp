# ElevenLabs TTS Integration

Replace browser Web Speech API TTS with ElevenLabs for higher-quality voice output from Maya (AI chat assistant).

## Motivation

Browser `speechSynthesis` sounds robotic and varies across devices/browsers. ElevenLabs provides natural, consistent voices suitable for a medical product.

## Approach

Server-side API route. The client hook interface stays identical so the chat page is untouched.

## Components

### 1. API Route: `src/app/api/tts/route.ts`

- POST endpoint accepting `{ text: string }`
- Calls ElevenLabs REST API: `POST /v1/text-to-speech/{voice_id}`
- Model: `eleven_multilingual_v2`
- Voice: `EXAVITQu4vr4xnSDxMaL` (Sarah — soft, warm, professional)
- Returns audio as `audio/mpeg` stream
- Voice ID stored as a constant at top of file for easy swapping
- Reads `ELEVENLABS_API_KEY` from environment

### 2. Hook Rewrite: `src/components/useTextToSpeech.ts`

- Same exported interface: `speak(text)`, `stop()`, `speaking` boolean
- Same `onDone` callback contract (triggers auto-listen after speech ends)
- `speak()` fetches `/api/tts` with the text, receives audio blob, plays via `new Audio(blobUrl)`
- `stop()` pauses the Audio object and revokes the blob URL
- `speaking` state driven by Audio `play`/`ended`/`error` events

### 3. Error Fallback

If the `/api/tts` fetch fails (network error, 4xx/5xx), fall back to browser `speechSynthesis` so the patient is never left in silence. Log the error to console.

## Data Flow

```
Maya response text
  → POST /api/tts { text }
  → Server calls ElevenLabs API
  → Returns audio/mpeg stream
  → Client creates Blob URL
  → Plays via Audio object
  → On ended: onDone callback fires
  → Auto-starts voice input (existing behavior)
```

## Environment

- `ELEVENLABS_API_KEY` in `.env.local` (already added)
- Will also need to be added to Vercel env vars for production

## What Does NOT Change

- Chat page (`src/app/chat/[sessionId]/page.tsx`) — no changes
- VoiceInput component — no changes
- ChatMessage component — no changes
- The `onDone` → auto-listen flow — preserved exactly
- "Speaking..." header indicator — driven by same `speaking` boolean

## Cost

ElevenLabs free tier: 10,000 characters/month. Maya's responses are typically 1-3 sentences (~50-150 chars each). Sufficient for demo/pilot. Paid plans start at $5/month for 30,000 characters.
