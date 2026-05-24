import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const userId = searchParams.get('user_id')
  const doctorName = searchParams.get('doctor_name')
  const plan = searchParams.get('plan') || 'starter'

  if (!sessionId || !userId || !doctorName) {
    return NextResponse.redirect(new URL('/pricing', request.url))
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)

  if (checkoutSession.payment_status !== 'paid') {
    return NextResponse.redirect(new URL('/pricing', request.url))
  }

  const supabase = await createClient()

  // Check if doctor already has a clinic (avoid duplicates on refresh)
  const { data: existingDoctor } = await supabase
    .from('doctors')
    .select('clinic_id')
    .eq('user_id', userId)
    .single()

  if (!existingDoctor) {
    // Create clinic
    const { data: clinic } = await supabase
      .from('clinics')
      .insert({
        name: `${doctorName}'s Clinic`,
        code: generateCode(),
        stripe_customer_id: checkoutSession.customer as string,
        stripe_subscription_id: checkoutSession.subscription as string,
        subscription_status: 'active',
        plan,
      })
      .select()
      .single()

    if (clinic) {
      // Create doctor linked to clinic
      await supabase.from('doctors').insert({
        user_id: userId,
        clinic_id: clinic.id,
        name: doctorName,
      })
    }
  }

  return NextResponse.redirect(new URL('/dashboard', request.url))
}
