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
