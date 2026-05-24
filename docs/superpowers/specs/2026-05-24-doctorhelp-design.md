# DoctorHelp — Pre-Visit AI Triage System

A medical pre-visit tool where patients describe their symptoms to an AI chatbot in the waiting room. The AI gathers information through conversational follow-ups, generates a summary with possible diagnoses and urgency classification, and surfaces it on a real-time doctor dashboard — so the doctor walks into the appointment already informed.

Built for a hackathon demo.

## System Architecture

```
Patient (phone/tablet browser)
    │
    ├── Check-in form (name + DOB)
    ├── Web Speech API (voice input)
    └── Chat UI
         │
         ▼
  Next.js API Routes
    │
    ├── POST /api/sessions        — create session, lookup/create patient
    ├── POST /api/chat            — send message → Claude API → save response + assessment
    └── POST /api/sessions/[id]/complete — mark session done, lock final diagnosis
         │
         ▼
  Claude API (Anthropic SDK)
    │
    └── Returns: chat response + structured JSON assessment
         │
         ▼
  Supabase (PostgreSQL + Realtime)
    │
    ├── patients table
    ├── sessions table (urgency, summary, diagnosis)
    └── messages table
         │
         ▼
  Doctor Dashboard (browser)
    │
    ├── Supabase Realtime subscription
    ├── Live-sorted patient list (urgency → arrival time)
    └── Session detail view (full transcript + AI analysis)
```

## Data Model

### `patients`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | Full name |
| dob | date | Date of birth |
| medical_history | jsonb | Past diagnoses, medications, allergies |
| created_at | timestamptz | First visit |

Unique constraint on `(name, dob)` for patient lookup.

### `sessions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| patient_id | uuid | FK → patients |
| status | text | `active` or `completed` |
| urgency | integer | 1 (critical) to 5 (trivial), nullable until AI assesses |
| summary | text | AI-generated plain-English summary |
| diagnosis | jsonb | Array of possible diagnoses with confidence |
| arrived_at | timestamptz | When patient started check-in |
| completed_at | timestamptz | When session ended, nullable |

### `messages`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| session_id | uuid | FK → sessions |
| role | text | `patient` or `assistant` |
| content | text | Message text |
| created_at | timestamptz | Message timestamp |

## Pages & Routing

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Landing page — "I'm a Patient" / "I'm a Doctor" | None |
| `/checkin` | Patient intake form (name + DOB) | None |
| `/chat/[sessionId]` | Patient chat interface | None (session-scoped) |
| `/login` | Doctor login | None |
| `/dashboard` | Live triage dashboard | Doctor only |
| `/dashboard/[sessionId]` | Full session detail view | Doctor only |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/sessions` | POST | Create session — looks up patient by name+DOB, creates if new, returns sessionId |
| `/api/chat` | POST | Accept patient message, call Claude API, save messages + updated assessment to Supabase |
| `/api/sessions/[sessionId]/complete` | POST | Mark session completed, lock final summary/diagnosis |

## Patient Chat Interface

### Check-in Flow
1. Patient opens the app (via QR code on phone or on a waiting room tablet)
2. Enters full name and date of birth
3. System looks up `patients` table by name + DOB
4. If found: loads `medical_history` for AI context
5. If not found: creates new patient record
6. Creates a new `session` row with `status: active` and `arrived_at: now()`
7. Redirects to `/chat/[sessionId]`

### Chat Flow
1. AI sends opening message: "Hi [name], welcome. I'd like to understand what's bringing you in today. Can you describe your main concern?"
2. Patient responds via voice (Web Speech API mic button) or text input
3. Message hits `POST /api/chat` → sent to Claude with conversation history + system prompt
4. Claude returns both a chat response (shown to patient) and a structured assessment (saved to session)
5. Dashboard updates in real time via Supabase Realtime
6. Repeat until patient taps "Done" or AI suggests wrapping up
7. On end: `POST /api/sessions/[sessionId]/complete` locks the final assessment

### Voice Input
- Web Speech API (browser-native, free, no API key)
- Green mic button in input area — tap to start, tap again to stop
- Transcript populates the text input, patient can review before sending
- Text input always available as fallback
- Recommended browser: Chrome (best Web Speech API support)

### UI Design
- Mobile-first, full-width layout
- Teal color scheme (#0f766e) — medical, trustworthy
- Large touch targets for mic button and Done
- Chat bubbles: AI messages left-aligned (white), patient messages right-aligned (teal)
- "Done" button always visible in header

## Doctor Dashboard

### Authentication
- Supabase Auth with email/password
- `/login` page, redirects to `/dashboard` on success
- `/dashboard` is a protected route — redirects to `/login` if unauthenticated

### Dashboard Layout
- **Top nav**: DoctorHelp logo, "Dashboard" badge, doctor name + avatar
- **Stats bar**: Waiting count, In Progress count, Completed count, Average wait time
- **Patient list**: Cards sorted by urgency (1 first) then arrival time (earliest first)

### Patient Cards
Each card shows:
- **Urgency badge**: Number 1-5 with color coding
  - 1 = Critical (red #dc2626)
  - 2 = Urgent (orange #f97316)
  - 3 = Moderate (yellow #eab308)
  - 4 = Low (green #22c55e)
  - 5 = Trivial (blue #3b82f6)
- **Patient name**
- **Arrival time** (absolute + relative, e.g., "9:12 AM (31 min ago)")
- **AI summary**: One-paragraph description of symptoms
- **Diagnosis tags**: Colored badges showing possible diagnoses
- **Status indicators**: "Still chatting" badge if session is active, "View Full" button if completed
- **"View Full" button**: Opens `/dashboard/[sessionId]`

### Session Detail View (`/dashboard/[sessionId]`)
- Full chat transcript (all messages in order)
- AI assessment panel: summary, urgency with reasoning, possible diagnoses with confidence levels
- Patient info: name, DOB, medical history if returning patient

### Real-time Updates
- Supabase Realtime subscription on `sessions` table
- New patients appear on dashboard as soon as they check in
- Summary and urgency update live as the AI conversation progresses
- Status changes (active → completed) reflected instantly
- No polling, no manual refresh

## AI Diagnostic Engine

### System Prompt Design

The Claude system prompt establishes:

- **Role**: Professional, warm pre-visit health assistant — like a skilled nurse doing intake
- **Tone**: Empathetic but structured, uses simple language, avoids unnecessary medical jargon
- **Boundaries**: Never diagnoses definitively, always frames as "possible" or "may suggest", defers to the physician
- **Patient context**: If returning patient, their medical history (past diagnoses, medications, allergies) is injected into the system prompt

### Conversation Strategy
- Ask one focused follow-up at a time
- Cover systematically: chief complaint, onset/duration, severity (1-10), location, aggravating/relieving factors, associated symptoms, relevant medical history
- Adapt based on what the patient says — don't follow a rigid script

### Structured Assessment Output

After each patient message, Claude returns both a chat response and a structured JSON assessment. The API route parses this and saves it to the session:

```json
{
  "summary": "39-year-old female with recurring headaches (7/10) behind eyes for 1 week, worse in mornings, with light sensitivity. History of migraines. OTC pain medication not providing relief.",
  "urgency": 3,
  "urgency_reasoning": "Chronic symptom with moderate severity, no red flags for emergent conditions",
  "possible_diagnoses": [
    { "name": "Migraine", "confidence": "high" },
    { "name": "Tension Headache", "confidence": "medium" },
    { "name": "Sinusitis", "confidence": "low" }
  ],
  "follow_up_questions": ["Any recent vision changes?", "Any nausea or vomiting with the headaches?"],
  "ready_to_wrap": false
}
```

### Safety Guardrails
- If symptoms suggest an emergency (chest pain + arm radiation, stroke signs like sudden weakness/speech difficulty, severe bleeding, difficulty breathing), immediately:
  - Set urgency to 1
  - Tell the patient to alert clinic staff immediately
  - Flag the session for immediate attention on the dashboard

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React Server Components) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (doctor login) |
| Realtime | Supabase Realtime |
| AI | Claude API via @anthropic-ai/sdk |
| Voice | Web Speech API (browser-native, free) |
| Deployment | Vercel |

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

## Hackathon Scope

### In Scope (MVP)
- Patient check-in flow (name + DOB lookup)
- AI chat with voice input (Web Speech API)
- Structured AI assessment after each turn
- Live doctor dashboard sorted by urgency + arrival time
- Session detail view with full transcript + AI analysis
- Urgency classification 1-5 with color coding
- Returning patient medical history lookup
- Doctor authentication (Supabase Auth)

### Out of Scope
- Real medical records integration (FHIR/HL7)
- Multi-doctor / multi-clinic support
- Patient accounts / login
- Push notifications / SMS alerts
- Chat history export / PDF reports
- HIPAA compliance infrastructure
- Internationalization / multi-language
- Offline support
