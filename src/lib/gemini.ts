import { GoogleGenerativeAI, type Content } from '@google/generative-ai'
import type { Assessment, MedicalHistory, Message } from './types'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_API_KEY!)

function buildSystemPrompt(patientName: string, gender?: string | null, history?: MedicalHistory): string {
  const genderInfo = gender ? ` (${gender})` : ''
  let prompt = `You are a professional, warm pre-visit health assistant working at a medical clinic. Your role is to gather information about a patient's symptoms before they see the doctor.

The patient's name is ${patientName}${genderInfo}.

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

## Response Format
You MUST respond with valid JSON in this exact format — nothing else, no markdown, no code fences:
{
  "reply": "Your conversational response to the patient goes here",
  "assessment": {
    "summary": "Plain-English summary of symptoms gathered so far",
    "urgency": 3,
    "urgency_reasoning": "Why this urgency level",
    "possible_diagnoses": [{"name": "Condition", "confidence": "high"}],
    "follow_up_questions": ["Questions you still want to ask"],
    "ready_to_wrap": false
  }
}`

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

function convertMessages(messages: Message[]): Content[] {
  return messages.map((m) => ({
    role: m.role === 'patient' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))
}

export interface GeminiResponse {
  reply: string
  assessment: Assessment | null
}

export async function chat(
  patientName: string,
  gender: string | null | undefined,
  history: MedicalHistory | undefined,
  messages: Message[]
): Promise<GeminiResponse> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: buildSystemPrompt(patientName, gender, history),
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })

  // Gemini requires history to start with a 'user' message.
  // The DB history starts with the assistant's opening greeting, so we
  // prepend the synthetic check-in message that was used to generate it.
  const fullMessages: Message[] =
    messages.length === 0
      ? []
      : [
          { id: '_init', session_id: '', role: 'patient', content: 'Hello, I just checked in.', created_at: '' },
          ...messages,
        ]

  const chatHistory: Content[] =
    fullMessages.length === 0
      ? []
      : convertMessages(fullMessages.slice(0, -1))

  const lastMessage =
    fullMessages.length === 0
      ? 'Hello, I just checked in.'
      : fullMessages[fullMessages.length - 1].content

  const geminiChat = model.startChat({ history: chatHistory })
  const result = await geminiChat.sendMessage(lastMessage)
  const text = result.response.text()

  try {
    const parsed = JSON.parse(text)
    return {
      reply: parsed.reply || '',
      assessment: parsed.assessment || null,
    }
  } catch {
    return {
      reply: text,
      assessment: null,
    }
  }
}
