# DoctorHelp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pre-visit AI triage system where patients describe symptoms to a chatbot, which generates summaries and urgency scores shown on a real-time doctor dashboard.

**Architecture:** Next.js App Router with API routes calling the Claude API for diagnostic conversations. Supabase provides PostgreSQL storage, authentication for doctors, and Realtime subscriptions for live dashboard updates. Voice input uses the browser-native Web Speech API.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Supabase (DB + Auth + Realtime), Claude API (@anthropic-ai/sdk), Web Speech API

---

## Prerequisites

Before starting implementation, the developer needs:

1. **A Supabase project** — create one at https://supabase.com/dashboard. Note the project URL and anon key from Settings → API.
2. **An Anthropic API key** — from https://console.anthropic.com/settings/keys.
3. **Node.js 18+** installed.

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                          — Root layout, global fonts/metadata
│   ├── globals.css                         — Tailwind v4 imports + custom theme
│   ├── page.tsx                            — Landing page (Patient / Doctor paths)
│   ├── checkin/
│   │   └── page.tsx                        — Patient intake form (name + DOB)
│   ├── chat/
│   │   └── [sessionId]/
│   │       └── page.tsx                    — Patient chat interface
│   ├── login/
│   │   └── page.tsx                        — Doctor login
│   ├── dashboard/
│   │   ├── page.tsx                        — Live triage dashboard
│   │   └── [sessionId]/
│   │       └── page.tsx                    — Session detail view
│   └── api/
│       ├── sessions/
│       │   ├── route.ts                    — POST: create session + lookup patient
│       │   └── [sessionId]/
│       │       └── complete/
│       │           └── route.ts            — POST: mark session completed
│       └── chat/
│           └── route.ts                    — POST: send message, get Claude response
├── components/
│   ├── ChatMessage.tsx                     — Single chat bubble (patient or AI)
│   ├── VoiceInput.tsx                      — Mic button + Web Speech API
│   └── PatientCard.tsx                     — Dashboard patient card with urgency
├── lib/
│   ├── supabase/
│   │   ├── client.ts                       — Browser-side Supabase client
│   │   └── server.ts                       — Server-side Supabase client
│   ├── claude.ts                           — Claude API: system prompt, tool, call function
│   └── types.ts                            — Shared TypeScript types
└── middleware.ts                            — Supabase auth session refresh
supabase/
└── schema.sql                              — Database schema (run in Supabase SQL editor)
.env.local.example                          — Template for environment variables
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `.env.local.example`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/kitty/projects/doctorhelp
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-git --yes
```

The `--no-git` flag keeps our existing git repo. `--yes` accepts defaults.

- [ ] **Step 2: Install additional dependencies**

```bash
cd /Users/kitty/projects/doctorhelp
npm install @anthropic-ai/sdk @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: Create environment template**

Create `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

- [ ] **Step 4: Create .env.local with real values**

```bash
cp .env.local.example .env.local
```

Then fill in the real values. The Supabase values come from the Supabase dashboard under Settings → API. The Anthropic key comes from console.anthropic.com.

- [ ] **Step 5: Verify dev server starts**

```bash
cd /Users/kitty/projects/doctorhelp
npm run dev
```

Expected: Server starts on http://localhost:3000 and shows the default Next.js page.

- [ ] **Step 6: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: Database Schema + TypeScript Types

**Files:**
- Create: `supabase/schema.sql`, `src/lib/types.ts`

- [ ] **Step 1: Write the database schema**

Create `supabase/schema.sql`:

```sql
-- Patients table
create table patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dob date not null,
  medical_history jsonb default '{}',
  created_at timestamptz default now(),
  unique(name, dob)
);

-- Sessions table
create table sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  urgency integer check (urgency between 1 and 5),
  summary text,
  diagnosis jsonb default '[]',
  arrived_at timestamptz default now(),
  completed_at timestamptz
);

-- Messages table
create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) not null,
  role text not null check (role in ('patient', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Enable realtime on sessions table so the dashboard updates live
alter publication supabase_realtime add table sessions;

-- Index for sorting dashboard by urgency then arrival
create index idx_sessions_triage on sessions (urgency asc nulls last, arrived_at asc);

-- Index for looking up messages by session
create index idx_messages_session on messages (session_id, created_at asc);

-- Enable row-level security (required by Supabase, using permissive policies for hackathon)
alter table patients enable row level security;
alter table sessions enable row level security;
alter table messages enable row level security;

create policy "Allow all access to patients" on patients for all using (true) with check (true);
create policy "Allow all access to sessions" on sessions for all using (true) with check (true);
create policy "Allow all access to messages" on messages for all using (true) with check (true);
```

- [ ] **Step 2: Run the schema in Supabase**

Go to the Supabase dashboard → SQL Editor → paste the contents of `supabase/schema.sql` → click Run.

Expected: All tables created, realtime enabled, no errors.

- [ ] **Step 3: Write shared TypeScript types**

Create `src/lib/types.ts`:

```typescript
export interface Patient {
  id: string
  name: string
  dob: string
  medical_history: MedicalHistory
  created_at: string
}

export interface MedicalHistory {
  conditions?: string[]
  medications?: string[]
  allergies?: string[]
  notes?: string
}

export interface Session {
  id: string
  patient_id: string
  status: 'active' | 'completed'
  urgency: number | null
  summary: string | null
  diagnosis: Diagnosis[]
  arrived_at: string
  completed_at: string | null
}

export interface Diagnosis {
  name: string
  confidence: 'high' | 'medium' | 'low'
}

export interface Message {
  id: string
  session_id: string
  role: 'patient' | 'assistant'
  content: string
  created_at: string
}

export interface Assessment {
  summary: string
  urgency: number
  urgency_reasoning: string
  possible_diagnoses: Diagnosis[]
  follow_up_questions: string[]
  ready_to_wrap: boolean
}

export interface SessionWithPatient extends Session {
  patients: Patient
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add supabase/schema.sql src/lib/types.ts
git commit -m "feat: add database schema and TypeScript types"
```

---

## Task 3: Supabase Clients + Root Layout

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create browser-side Supabase client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server-side Supabase client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from Server Components where cookies can't be set.
            // This can be ignored if middleware is refreshing sessions.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Update global styles**

Replace `src/app/globals.css` with:

```css
@import "tailwindcss";
```

- [ ] **Step 4: Update root layout**

Replace `src/app/layout.tsx` with:

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DoctorHelp',
  description: 'AI-powered pre-visit triage system',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Verify dev server still works**

```bash
cd /Users/kitty/projects/doctorhelp
npm run dev
```

Expected: No errors, blank page at localhost:3000.

- [ ] **Step 6: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/lib/supabase/ src/app/layout.tsx src/app/globals.css
git commit -m "feat: add Supabase clients and root layout"
```

---

## Task 4: Landing Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Build the landing page**

Replace `src/app/page.tsx` with:

```typescript
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
        <div className="text-5xl mb-4">🩺</div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">DoctorHelp</h1>
        <p className="text-lg text-slate-500">AI-powered pre-visit triage</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link
          href="/checkin"
          className="flex-1 bg-teal-700 text-white text-center py-4 px-6 rounded-xl font-semibold text-lg hover:bg-teal-800 transition-colors"
        >
          I'm a Patient
        </Link>
        <Link
          href="/login"
          className="flex-1 bg-white text-teal-700 text-center py-4 px-6 rounded-xl font-semibold text-lg border-2 border-teal-700 hover:bg-teal-50 transition-colors"
        >
          I'm a Doctor
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev`, open http://localhost:3000. Expected: centered page with DoctorHelp title, stethoscope emoji, and two buttons (Patient / Doctor).

- [ ] **Step 3: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/app/page.tsx
git commit -m "feat: add landing page with patient/doctor paths"
```

---

## Task 5: Patient Check-in + Session API

**Files:**
- Create: `src/app/checkin/page.tsx`, `src/app/api/sessions/route.ts`

- [ ] **Step 1: Build the session creation API route**

Create `src/app/api/sessions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const { name, dob } = await request.json()

  if (!name || !dob) {
    return NextResponse.json({ error: 'Name and date of birth are required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Look up existing patient
  let { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('name', name.trim())
    .eq('dob', dob)
    .single()

  const isReturning = !!patient

  // Create new patient if not found
  if (!patient) {
    const { data: newPatient, error } = await supabase
      .from('patients')
      .insert({ name: name.trim(), dob })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 })
    }
    patient = newPatient
  }

  // Create new session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({ patient_id: patient.id, status: 'active' })
    .select()
    .single()

  if (sessionError) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  return NextResponse.json({
    sessionId: session.id,
    patient,
    isReturning,
  })
}
```

- [ ] **Step 2: Build the check-in page**

Create `src/app/checkin/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CheckinPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, dob }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      const { sessionId } = await res.json()
      router.push(`/chat/${sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">👋</div>
          <h1 className="text-xl font-bold text-teal-700">Welcome</h1>
          <p className="text-sm text-slate-500 mt-1">Let's get you checked in</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
        )}

        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
          Full Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 mb-4 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
          placeholder="Jane Doe"
        />

        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
          Date of Birth
        </label>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          required
          className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 mb-6 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-700 text-white py-3.5 rounded-xl font-bold text-base hover:bg-teal-800 transition-colors disabled:opacity-50"
        >
          {loading ? 'Checking in...' : 'Start Check-in'}
        </button>

        <p className="text-center text-xs text-slate-400 mt-4">
          Your information is private and secure
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Verify the flow in browser**

Run `npm run dev`. Go to http://localhost:3000, click "I'm a Patient". Expected: check-in form with name + DOB fields. Submit with test data. Expected: redirects to `/chat/[some-uuid]` (will show 404 until we build the chat page — that's fine).

Check the Supabase dashboard → Table Editor → `patients` and `sessions` tables. Verify a patient row and session row were created.

- [ ] **Step 4: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/app/checkin/ src/app/api/sessions/
git commit -m "feat: add patient check-in page and session API"
```

---

## Task 6: Claude AI Engine

**Files:**
- Create: `src/lib/claude.ts`

- [ ] **Step 1: Build the Claude integration module**

Create `src/lib/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { Assessment, MedicalHistory, Message } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ASSESSMENT_TOOL: Anthropic.Messages.Tool = {
  name: 'update_assessment',
  description: 'Update the patient assessment based on the conversation so far. You MUST call this after every response.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string', description: 'Plain-English summary of symptoms gathered so far' },
      urgency: { type: 'integer', description: '1=critical, 2=urgent, 3=moderate, 4=low, 5=trivial' },
      urgency_reasoning: { type: 'string', description: 'Why this urgency level' },
      possible_diagnoses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['name', 'confidence'],
        },
      },
      follow_up_questions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Questions you still want to ask',
      },
      ready_to_wrap: {
        type: 'boolean',
        description: 'True if you have gathered enough information to suggest ending the conversation',
      },
    },
    required: ['summary', 'urgency', 'urgency_reasoning', 'possible_diagnoses', 'follow_up_questions', 'ready_to_wrap'],
  },
}

function buildSystemPrompt(patientName: string, history?: MedicalHistory): string {
  let prompt = `You are a professional, warm pre-visit health assistant working at a medical clinic. Your role is to gather information about a patient's symptoms before they see the doctor.

The patient's name is ${patientName}.

## Your Approach
- Be empathetic but structured, like a skilled nurse doing intake
- Use simple, clear language — avoid unnecessary medical jargon
- Ask ONE focused follow-up question at a time
- Cover these areas naturally through conversation:
  - Chief complaint (what brings them in)
  - Onset and duration
  - Severity (1-10 scale)
  - Location and character of symptoms
  - Aggravating and relieving factors
  - Associated symptoms
  - Relevant medical history (if not already known)

## Important Boundaries
- You are NOT a doctor. Never diagnose definitively.
- Always frame findings as "possible" or "this may suggest"
- Defer to the physician for final assessment

## Safety
If symptoms suggest an emergency (chest pain radiating to arm, signs of stroke like sudden weakness or speech difficulty, severe bleeding, difficulty breathing), IMMEDIATELY:
1. Tell the patient to alert clinic staff RIGHT NOW
2. Set urgency to 1 in your assessment

## Wrapping Up
When you have gathered enough information (chief complaint is clear, severity assessed, key history covered), set ready_to_wrap to true and tell the patient something like: "Thank you, I think I have a good picture of what's going on. Your doctor will review this shortly. Is there anything else you'd like to mention?"

After EVERY response, you MUST call the update_assessment tool.`

  if (history && (history.conditions?.length || history.medications?.length || history.allergies?.length)) {
    prompt += `\n\n## Known Medical History for ${patientName}\n`
    if (history.conditions?.length) prompt += `- Conditions: ${history.conditions.join(', ')}\n`
    if (history.medications?.length) prompt += `- Medications: ${history.medications.join(', ')}\n`
    if (history.allergies?.length) prompt += `- Allergies: ${history.allergies.join(', ')}\n`
    if (history.notes) prompt += `- Notes: ${history.notes}\n`
    prompt += `\nUse this history to inform your questions and assessment. Don't re-ask about known conditions.`
  }

  return prompt
}

function convertMessages(messages: Message[]): Anthropic.Messages.MessageParam[] {
  return messages.map((m) => ({
    role: m.role === 'patient' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }))
}

export interface ClaudeResponse {
  reply: string
  assessment: Assessment | null
}

export async function chat(
  patientName: string,
  history: MedicalHistory | undefined,
  messages: Message[]
): Promise<ClaudeResponse> {
  // For init (no messages yet), send a greeting prompt so Claude generates the opening message
  const apiMessages: Anthropic.Messages.MessageParam[] =
    messages.length === 0
      ? [{ role: 'user' as const, content: 'Hello, I just checked in.' }]
      : convertMessages(messages)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: buildSystemPrompt(patientName, history),
    tools: [ASSESSMENT_TOOL],
    tool_choice: { type: 'auto' },
    messages: apiMessages,
  })

  let reply = ''
  let assessment: Assessment | null = null

  for (const block of response.content) {
    if (block.type === 'text') {
      reply += block.text
    } else if (block.type === 'tool_use' && block.name === 'update_assessment') {
      assessment = block.input as Assessment
    }
  }

  return { reply, assessment }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/lib/claude.ts
git commit -m "feat: add Claude AI engine with assessment tool"
```

---

## Task 7: Chat API Route

**Files:**
- Create: `src/app/api/chat/route.ts`

- [ ] **Step 1: Build the chat API route**

Create `src/app/api/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chat } from '@/lib/claude'
import type { Message, Patient } from '@/lib/types'

export async function POST(request: NextRequest) {
  const { sessionId, message } = await request.json()

  if (!sessionId || !message) {
    return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch session with patient info
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*, patients(*)')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const patient = session.patients as Patient

  // Save the patient's message
  await supabase.from('messages').insert({
    session_id: sessionId,
    role: 'patient',
    content: message,
  })

  // Fetch full message history
  const { data: existingMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  const allMessages = existingMessages as Message[]

  // Call Claude
  const { reply, assessment } = await chat(
    patient.name,
    patient.medical_history,
    allMessages
  )

  // Save Claude's response
  await supabase.from('messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: reply,
  })

  // Update session with latest assessment
  if (assessment) {
    await supabase
      .from('sessions')
      .update({
        summary: assessment.summary,
        urgency: assessment.urgency,
        diagnosis: assessment.possible_diagnoses,
      })
      .eq('id', sessionId)
  }

  return NextResponse.json({
    reply,
    assessment,
  })
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/app/api/chat/
git commit -m "feat: add chat API route with Claude integration"
```

---

## Task 8: Chat Message Component

**Files:**
- Create: `src/components/ChatMessage.tsx`

- [ ] **Step 1: Build the chat bubble component**

Create `src/components/ChatMessage.tsx`:

```typescript
import type { Message } from '@/lib/types'

export default function ChatMessage({ message }: { message: Message }) {
  const isPatient = message.role === 'patient'

  return (
    <div className={`flex ${isPatient ? 'justify-end' : 'gap-2'}`}>
      {!isPatient && (
        <div className="w-7 h-7 bg-teal-700 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
          AI
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed ${
          isPatient
            ? 'bg-teal-700 text-white rounded-2xl rounded-br-sm'
            : 'bg-white text-slate-800 rounded-2xl rounded-bl-sm shadow-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/components/ChatMessage.tsx
git commit -m "feat: add chat message bubble component"
```

---

## Task 9: Voice Input Component

**Files:**
- Create: `src/components/VoiceInput.tsx`

- [ ] **Step 1: Build the voice input component**

Create `src/components/VoiceInput.tsx`:

```typescript
'use client'

import { useState, useRef, useCallback } from 'react'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const toggle = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('')
      onTranscript(transcript)
    }

    recognition.onerror = () => {
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [listening, onTranscript])

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
        listening
          ? 'bg-red-500 animate-pulse'
          : 'bg-teal-700 hover:bg-teal-800'
      } disabled:opacity-50`}
      title={listening ? 'Stop recording' : 'Start recording'}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/components/VoiceInput.tsx
git commit -m "feat: add voice input component with Web Speech API"
```

---

## Task 10: Patient Chat Page

**Files:**
- Create: `src/app/chat/[sessionId]/page.tsx`

- [ ] **Step 1: Build the chat page**

Create `src/app/chat/[sessionId]/page.tsx`:

```typescript
'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import ChatMessage from '@/components/ChatMessage'
import VoiceInput from '@/components/VoiceInput'
import type { Message } from '@/lib/types'

const OPENING_MESSAGE: Message = {
  id: 'opening',
  session_id: '',
  role: 'assistant',
  content: '',
  created_at: new Date().toISOString(),
}

export default function ChatPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [readyToWrap, setReadyToWrap] = useState(false)
  const [done, setDone] = useState(false)
  const [patientName, setPatientName] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch patient name and set opening message
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: '__init__' }),
        })
        if (!res.ok) return
        const data = await res.json()
        setPatientName(data.patientName || '')
        setMessages([{
          ...OPENING_MESSAGE,
          session_id: sessionId,
          content: data.reply,
        }])
      } catch {
        setMessages([{
          ...OPENING_MESSAGE,
          session_id: sessionId,
          content: "Welcome! I'd like to understand what's bringing you in today. Can you describe your main concern?",
        }])
      }
    }
    init()
  }, [sessionId])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const patientMsg: Message = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role: 'patient',
      content: text.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, patientMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text.trim() }),
      })

      const data = await res.json()

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role: 'assistant',
        content: data.reply,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, aiMsg])

      if (data.assessment?.ready_to_wrap) {
        setReadyToWrap(true)
      }
    } catch {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role: 'assistant',
        content: "I'm sorry, I'm having trouble right now. Please try again.",
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  async function handleDone() {
    setLoading(true)
    try {
      await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' })
      setDone(true)
    } catch {
      alert('Failed to complete session')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-green-50">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-teal-700 mb-2">Thank you{patientName ? `, ${patientName}` : ''}!</h1>
          <p className="text-slate-500">Your doctor will review your information shortly.</p>
          <p className="text-slate-400 text-sm mt-2">You can close this page now.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-teal-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-lg">🩺</div>
          <div>
            <div className="font-bold text-sm">DoctorHelp</div>
            <div className="text-[10px] opacity-75">Session active</div>
          </div>
        </div>
        <button
          onClick={handleDone}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            readyToWrap
              ? 'bg-white text-teal-700 animate-pulse'
              : 'bg-white/20 hover:bg-white/30'
          }`}
        >
          Done
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 bg-teal-700 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold">
              AI
            </div>
            <div className="bg-white rounded-2xl rounded-bl-sm shadow-sm px-4 py-3 text-sm text-slate-400">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3 bg-white flex items-center gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tap mic or type..."
          disabled={loading}
          className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
        />
        <VoiceInput onTranscript={setInput} disabled={loading} />
        {input.trim() && (
          <button
            type="submit"
            disabled={loading}
            className="w-10 h-10 bg-teal-700 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-teal-800 disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Update chat API to handle the init message**

Edit `src/app/api/chat/route.ts`. Replace the beginning of the POST handler (before the Claude call) to handle the `__init__` message:

```typescript
export async function POST(request: NextRequest) {
  const { sessionId, message } = await request.json()

  if (!sessionId || !message) {
    return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch session with patient info
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*, patients(*)')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const patient = session.patients as Patient

  // Handle init — just get the opening message from Claude
  if (message === '__init__') {
    const { reply, assessment } = await chat(
      patient.name,
      patient.medical_history,
      []
    )

    // Save opening message
    await supabase.from('messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: reply,
    })

    if (assessment) {
      await supabase.from('sessions').update({
        summary: assessment.summary,
        urgency: assessment.urgency,
        diagnosis: assessment.possible_diagnoses,
      }).eq('id', sessionId)
    }

    return NextResponse.json({ reply, assessment, patientName: patient.name })
  }

  // Save the patient's message
  await supabase.from('messages').insert({
    session_id: sessionId,
    role: 'patient',
    content: message,
  })

  // Fetch full message history
  const { data: existingMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  const allMessages = existingMessages as Message[]

  // Call Claude
  const { reply, assessment } = await chat(
    patient.name,
    patient.medical_history,
    allMessages
  )

  // Save Claude's response
  await supabase.from('messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: reply,
  })

  // Update session with latest assessment
  if (assessment) {
    await supabase
      .from('sessions')
      .update({
        summary: assessment.summary,
        urgency: assessment.urgency,
        diagnosis: assessment.possible_diagnoses,
      })
      .eq('id', sessionId)
  }

  return NextResponse.json({
    reply,
    assessment,
    patientName: patient.name,
  })
}
```

- [ ] **Step 3: Verify the full patient flow**

Run `npm run dev`. Go to http://localhost:3000 → "I'm a Patient" → enter a name and DOB → submit. Expected: redirects to chat page, AI sends an opening message, you can type or use the mic and get responses. Test the Done button — should show the thank you screen.

- [ ] **Step 4: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/app/chat/ src/app/api/chat/
git commit -m "feat: add patient chat page with voice input"
```

---

## Task 11: Session Completion API

**Files:**
- Create: `src/app/api/sessions/[sessionId]/complete/route.ts`

- [ ] **Step 1: Build the completion route**

Create `src/app/api/sessions/[sessionId]/complete/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { error } = await supabase
    .from('sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) {
    return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Verify**

In the running app, go through the patient flow and tap Done. Check Supabase dashboard — the session should now have `status: completed` and a `completed_at` timestamp.

- [ ] **Step 3: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/app/api/sessions/
git commit -m "feat: add session completion API route"
```

---

## Task 12: Doctor Login + Auth Middleware

**Files:**
- Create: `src/app/login/page.tsx`, `src/middleware.ts`

- [ ] **Step 1: Create a doctor account in Supabase**

Go to Supabase dashboard → Authentication → Users → "Add user" → create a user with email and password. This is the doctor's login for the hackathon demo.

- [ ] **Step 2: Build the login page**

Create `src/app/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🩺</div>
          <h1 className="text-xl font-bold text-slate-900">Doctor Login</h1>
          <p className="text-sm text-slate-500 mt-1">Access the triage dashboard</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
        )}

        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 mb-4 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
          placeholder="doctor@clinic.com"
        />

        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 mb-6 text-sm bg-slate-50 focus:border-teal-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-700 text-white py-3.5 rounded-xl font-bold text-base hover:bg-teal-800 transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Add auth middleware**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

- [ ] **Step 4: Verify login flow**

Run `npm run dev`. Go to http://localhost:3000 → "I'm a Doctor" → enter the credentials created in Step 1. Expected: redirects to `/dashboard` (will be a 404 until next task — that's fine). Try going directly to `/dashboard` without logging in — should redirect to `/login`.

- [ ] **Step 5: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/app/login/ src/middleware.ts
git commit -m "feat: add doctor login and auth middleware"
```

---

## Task 13: Doctor Dashboard with Realtime

**Files:**
- Create: `src/components/PatientCard.tsx`, `src/app/dashboard/page.tsx`

- [ ] **Step 1: Build the patient card component**

Create `src/components/PatientCard.tsx`:

```typescript
import Link from 'next/link'
import type { SessionWithPatient } from '@/lib/types'

const URGENCY_CONFIG: Record<number, { color: string; bg: string; label: string; border: string }> = {
  1: { color: 'text-red-600', bg: 'bg-red-600', label: 'CRITICAL', border: 'border-l-red-600' },
  2: { color: 'text-orange-500', bg: 'bg-orange-500', label: 'URGENT', border: 'border-l-orange-500' },
  3: { color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'MODERATE', border: 'border-l-yellow-500' },
  4: { color: 'text-green-500', bg: 'bg-green-500', label: 'LOW', border: 'border-l-green-500' },
  5: { color: 'text-blue-500', bg: 'bg-blue-500', label: 'TRIVIAL', border: 'border-l-blue-500' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function PatientCard({ session }: { session: SessionWithPatient }) {
  const urgency = session.urgency ?? 5
  const config = URGENCY_CONFIG[urgency] ?? URGENCY_CONFIG[5]
  const patient = session.patients

  return (
    <div className={`bg-white rounded-xl p-4 border-l-4 ${config.border} shadow-sm flex items-start gap-3`}>
      <div className="text-center flex-shrink-0">
        <div className={`${config.bg} text-white w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-lg`}>
          {urgency}
        </div>
        <div className={`text-[9px] font-bold mt-1 ${config.color}`}>{config.label}</div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="font-bold text-sm text-slate-900">{patient.name}</div>
          <div className="text-xs text-slate-400">
            {formatTime(session.arrived_at)} ({timeAgo(session.arrived_at)})
          </div>
        </div>

        {session.summary && (
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-2">
            <span className="font-semibold">Summary:</span> {session.summary}
          </p>
        )}

        <div className="flex gap-1.5 mt-2 flex-wrap">
          {session.diagnosis?.map((d) => (
            <span
              key={d.name}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                urgency <= 2
                  ? 'bg-red-50 text-red-600'
                  : urgency === 3
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'bg-green-50 text-green-600'
              }`}
            >
              {d.name}
            </span>
          ))}
          {session.status === 'active' && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              Still chatting
            </span>
          )}
        </div>
      </div>

      <Link
        href={`/dashboard/${session.id}`}
        className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold ${
          session.status === 'completed'
            ? 'bg-teal-700 text-white hover:bg-teal-800'
            : 'bg-slate-100 text-slate-500'
        }`}
      >
        {session.status === 'completed' ? 'View Full' : 'Pending'}
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Build the dashboard page**

Create `src/app/dashboard/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PatientCard from '@/components/PatientCard'
import type { SessionWithPatient } from '@/lib/types'

function sortSessions(sessions: SessionWithPatient[]): SessionWithPatient[] {
  return [...sessions].sort((a, b) => {
    const ua = a.urgency ?? 6
    const ub = b.urgency ?? 6
    if (ua !== ub) return ua - ub
    return new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime()
  })
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionWithPatient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchSessions() {
      const { data } = await supabase
        .from('sessions')
        .select('*, patients(*)')
        .order('arrived_at', { ascending: true })

      if (data) {
        setSessions(data as SessionWithPatient[])
      }
      setLoading(false)
    }

    fetchSessions()

    // Subscribe to realtime updates
    const channel = supabase
      .channel('sessions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sessions' },
        async (payload) => {
          // Fetch the full session with patient data
          const { data } = await supabase
            .from('sessions')
            .select('*, patients(*)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setSessions((prev) => [...prev, data as SessionWithPatient])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        async (payload) => {
          const { data } = await supabase
            .from('sessions')
            .select('*, patients(*)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setSessions((prev) =>
              prev.map((s) => (s.id === data.id ? (data as SessionWithPatient) : s))
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const activeSessions = sortSessions(sessions.filter((s) => s.status === 'active'))
  const completedSessions = sessions.filter((s) => s.status === 'completed')

  const waitingCount = activeSessions.length
  const completedCount = completedSessions.length
  const totalMinutes = activeSessions.reduce((sum, s) => {
    return sum + (Date.now() - new Date(s.arrived_at).getTime()) / 60000
  }, 0)
  const avgWait = waitingCount > 0 ? Math.round(totalMinutes / waitingCount) : 0

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Nav */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🩺</span>
          <span className="font-extrabold text-base text-slate-900">DoctorHelp</span>
          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            Dashboard
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Doctor</span>
          <div className="w-8 h-8 bg-teal-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
            DR
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Waiting</div>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">{waitingCount}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">In Progress</div>
          <div className="text-3xl font-extrabold text-amber-500 mt-1">{activeSessions.filter((s) => s.summary).length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Completed</div>
          <div className="text-3xl font-extrabold text-emerald-500 mt-1">{completedCount}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Avg Wait</div>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">{avgWait}m</div>
        </div>
      </div>

      {/* Patient list */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm text-slate-900">Waiting Patients</h2>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live — sorted by urgency + arrival
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : activeSessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No patients waiting</div>
        ) : (
          <div className="space-y-2">
            {activeSessions.map((session) => (
              <PatientCard key={session.id} session={session} />
            ))}
          </div>
        )}

        {completedSessions.length > 0 && (
          <>
            <h2 className="font-bold text-sm text-slate-900 mt-8 mb-3">Completed</h2>
            <div className="space-y-2">
              {completedSessions.map((session) => (
                <PatientCard key={session.id} session={session} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify the dashboard**

Run `npm run dev`. Log in as the doctor at `/login`. Expected: dashboard shows any existing sessions from the Supabase database. Open a second browser tab and go through the patient flow — the dashboard should update in real time as the patient chats.

- [ ] **Step 4: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/components/PatientCard.tsx src/app/dashboard/page.tsx
git commit -m "feat: add doctor dashboard with realtime updates"
```

---

## Task 14: Session Detail Page

**Files:**
- Create: `src/app/dashboard/[sessionId]/page.tsx`

- [ ] **Step 1: Build the session detail page**

Create `src/app/dashboard/[sessionId]/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Patient, Message, Diagnosis } from '@/lib/types'

const URGENCY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Critical', color: 'bg-red-100 text-red-700' },
  2: { label: 'Urgent', color: 'bg-orange-100 text-orange-700' },
  3: { label: 'Moderate', color: 'bg-yellow-100 text-yellow-700' },
  4: { label: 'Low', color: 'bg-green-100 text-green-700' },
  5: { label: 'Trivial', color: 'bg-blue-100 text-blue-700' },
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('*, patients(*)')
    .eq('id', sessionId)
    .single()

  if (!session) notFound()

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  const patient = session.patients as Patient
  const allMessages = (messages || []) as Message[]
  const diagnosis = (session.diagnosis || []) as Diagnosis[]
  const urgency = session.urgency ?? 5
  const urgencyInfo = URGENCY_LABELS[urgency] ?? URGENCY_LABELS[5]

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Nav */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-teal-700 hover:text-teal-800 text-sm font-semibold">
          ← Dashboard
        </Link>
        <span className="text-slate-300">|</span>
        <span className="font-bold text-sm text-slate-900">{patient.name}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${urgencyInfo.color}`}>
          {urgencyInfo.label}
        </span>
      </div>

      <div className="max-w-4xl mx-auto p-6 grid md:grid-cols-3 gap-6">
        {/* Left: Assessment panel */}
        <div className="md:col-span-1 space-y-4">
          {/* Patient Info */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Patient Info</h3>
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-500">Name:</span> <span className="font-semibold">{patient.name}</span></div>
              <div><span className="text-slate-500">DOB:</span> <span className="font-semibold">{patient.dob}</span></div>
              <div><span className="text-slate-500">Arrived:</span> <span className="font-semibold">{new Date(session.arrived_at).toLocaleTimeString()}</span></div>
              <div><span className="text-slate-500">Status:</span> <span className="font-semibold capitalize">{session.status}</span></div>
            </div>
          </div>

          {/* Medical History */}
          {patient.medical_history && (patient.medical_history.conditions?.length || patient.medical_history.medications?.length || patient.medical_history.allergies?.length) && (
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Medical History</h3>
              <div className="space-y-2 text-sm">
                {patient.medical_history.conditions?.length ? (
                  <div><span className="text-slate-500">Conditions:</span> {patient.medical_history.conditions.join(', ')}</div>
                ) : null}
                {patient.medical_history.medications?.length ? (
                  <div><span className="text-slate-500">Medications:</span> {patient.medical_history.medications.join(', ')}</div>
                ) : null}
                {patient.medical_history.allergies?.length ? (
                  <div><span className="text-slate-500">Allergies:</span> {patient.medical_history.allergies.join(', ')}</div>
                ) : null}
              </div>
            </div>
          )}

          {/* AI Assessment */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">AI Assessment</h3>
            {session.summary && (
              <p className="text-sm text-slate-700 leading-relaxed mb-4">{session.summary}</p>
            )}
            <div className="space-y-2">
              {diagnosis.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    d.confidence === 'high' ? 'bg-red-50 text-red-600' :
                    d.confidence === 'medium' ? 'bg-yellow-50 text-yellow-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {d.confidence}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Chat transcript */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chat Transcript</h3>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {allMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'patient' ? 'justify-end' : 'gap-2'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 bg-teal-700 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold">AI</div>
                  )}
                  <div className={`max-w-[75%] px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'patient'
                      ? 'bg-teal-700 text-white rounded-xl rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-xl rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the session detail view**

Run `npm run dev`. Log in as doctor, go to the dashboard, click "View Full" on a completed session. Expected: left panel shows patient info + AI assessment with diagnoses and confidence levels, right panel shows the full chat transcript.

- [ ] **Step 3: Commit**

```bash
cd /Users/kitty/projects/doctorhelp
git add src/app/dashboard/
git commit -m "feat: add session detail page with transcript and assessment"
```

---

## Final Verification

- [ ] **Full end-to-end test:**

1. Open http://localhost:3000 in two browser windows
2. Window 1 (Patient): Click "I'm a Patient" → enter name + DOB → chat with the AI, describe symptoms, use voice input
3. Window 2 (Doctor): Click "I'm a Doctor" → log in → watch the dashboard update in real time as the patient chats
4. In Window 1: Click "Done" when finished
5. In Window 2: See the session move to "Completed" → click "View Full" to see the transcript

- [ ] **Final commit:**

```bash
cd /Users/kitty/projects/doctorhelp
git add -A
git commit -m "feat: complete DoctorHelp MVP"
```
