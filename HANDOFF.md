# DoctorHelp — Session Handoff

**Date:** 2026-05-25
**Branch:** main
**Live URL:** https://doctor-help-tau.vercel.app
**GitHub:** https://github.com/kittygemma/DoctorHelp

---

## What Was Done This Session

### Vercel Deployment
- Pushed codebase to GitHub (`kittygemma/DoctorHelp`)
- Linked project to Vercel (`kitty01/doctor-help`)
- Added all 7 environment variables to Vercel (production + preview + development)
- Fixed build failure: Google AI and Stripe SDKs were initializing at module level, crashing during Vercel's static page collection phase. Changed to lazy initialization via getter functions in:
  - `src/lib/gemini.ts` — `getGenAI()` instead of top-level `const genAI`
  - `src/app/api/stripe/checkout/route.ts` — `getStripe()` and `getPriceMap()`
  - `src/app/api/stripe/success/route.ts` — `getStripe()`
- Successfully deployed to production

### Voice Recognition Fix
- Mentor reported speech recognition not catching words well
- Changed `VoiceInput.tsx` from single-phrase mode to **continuous mode** (`recognition.continuous = true`)
- Added proper separation of final vs interim transcription results
- Suppressed `no-speech` errors that were killing the listener on brief pauses
- Deployed fix to production

### Commits
```
79f4fb5 fix: improve voice recognition with continuous mode
f48fbd4 fix: lazy-initialize SDKs to fix Vercel build
```

---

## Current State

- **Production is live** and functional at https://doctor-help-tau.vercel.app
- **Local dev server** was running on `localhost:3000` (may need restart: `npm run dev`)
- **Build passes** cleanly — `npm run build` succeeds
- **Git is clean** — no uncommitted changes

---

## Known Issues / Not Yet Done

### Security (Critical for Production)
- **RLS policies are wide open** — all tables use `for all using (true)`. Need clinic-scoped policies so doctors only see their own clinic's data. Migration file needed for Supabase SQL editor.
- **No Stripe webhooks** — subscription lifecycle (cancellation, failed payments, upgrades) relies on redirect-based flow only. Need `/api/stripe/webhook` endpoint.
- **API routes lack auth checks** — `/api/sessions/[id]/complete` and `/api/sessions/[id]/dismiss` don't verify the caller is a doctor from the session's clinic. Anyone with a session ID can modify it.
- **Chat API is unauthenticated** — `/api/chat` doesn't verify the session belongs to an active clinic with a valid subscription.

### Features
- **No logout button** on the dashboard
- **No subscription guard** — dashboard doesn't check if the clinic's subscription is active
- **No team invites** — schema supports multiple doctors per clinic but no invite flow exists
- **No analytics dashboard** — mentioned in Professional tier pricing but not built
- **No patient usage limits** — Starter (50/mo) and Professional (300/mo) limits aren't enforced
- **No EHR integration** — mentioned in Enterprise tier

### UI/UX
- **Voice recognition** — works best in Chrome. Safari/Firefox have weaker support. Consider Deepgram or Whisper API if browser-native quality isn't sufficient.
- **No copy feedback** — clinic check-in link copy button has no visual confirmation
- **Mobile polish** — dashboard works on mobile but could use responsive refinements
- **No error toasts** — errors show as `alert()` dialogs

---

## Environment Variables

All set in Vercel and locally in `.env.local`:

| Key | Where Used |
|-----|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client (browser + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client (browser + server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operations |
| `GOOGLE_AI_STUDIO_API_KEY` | Gemini AI in `src/lib/gemini.ts` |
| `STRIPE_SECRET_KEY` | Stripe checkout + success routes |
| `STRIPE_STARTER_PRICE_ID` | Starter plan Stripe price |
| `STRIPE_PRO_PRICE_ID` | Professional plan Stripe price |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/gemini.ts` | AI engine — system prompt + Gemini API wrapper |
| `src/app/api/chat/route.ts` | Chat endpoint — message in, AI response + assessment out |
| `src/app/dashboard/page.tsx` | Real-time doctor dashboard |
| `src/app/dashboard/[sessionId]/page.tsx` | Session detail with transcript + assessment |
| `src/app/checkin/[clinicCode]/page.tsx` | Patient check-in form |
| `src/app/chat/[sessionId]/page.tsx` | Patient chat interface |
| `src/components/VoiceInput.tsx` | Voice recognition component |
| `src/proxy.ts` | Middleware — auth + dashboard route protection |
| `supabase/schema.sql` | Base database schema |
| `supabase/migration-multi-tenant.sql` | Multi-tenant migration |

---

## Pending Decision

**Tough Tongue AI Integration** — Mentor suggested integrating [Tough Tongue AI](https://www.toughtongueai.com/). It's a conversational AI practice platform with embeddable voice agents (not a speech-to-text API). Need to clarify with mentor:
1. Embed their AI agent as the patient-facing chatbot (replacing Maya/Gemini)?
2. Use their voice tech for better speech recognition?
3. Use as a reference/inspiration?

Alternatives if we just need better speech-to-text: Deepgram, OpenAI Whisper, or Google Speech-to-Text.

**Decision needed next session before proceeding.**

---

## Quick Start

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
vercel --prod --yes  # deploy to production
```
