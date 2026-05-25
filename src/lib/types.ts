export interface Patient {
  id: string
  name: string
  dob: string
  gender: string | null
  medical_history: MedicalHistory
  created_at: string
}

export interface MedicalHistory {
  conditions?: string[]
  medications?: string[]
  allergies?: string[]
  notes?: string
}

export interface Clinic {
  id: string
  name: string
  code: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string
  plan: string
  created_at: string
}

export interface Doctor {
  id: string
  user_id: string
  clinic_id: string
  name: string
  created_at: string
}

export interface Session {
  id: string
  patient_id: string
  clinic_id: string | null
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
  critical: boolean
}

export interface SessionWithPatient extends Session {
  patients: Patient
}
