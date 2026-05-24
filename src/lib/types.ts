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
  status: 'active' | 'waiting' | 'completed'
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
