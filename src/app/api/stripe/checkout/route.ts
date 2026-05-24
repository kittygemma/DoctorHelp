import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function getPriceMap(): Record<string, string> {
  return {
    starter: process.env.STRIPE_STARTER_PRICE_ID!,
    professional: process.env.STRIPE_PRO_PRICE_ID!,
  }
}

export async function POST(request: NextRequest) {
  const { plan, doctorName, email, userId } = await request.json()

  const priceId = getPriceMap()[plan]
  if (!priceId) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const origin = request.headers.get('origin') || 'http://localhost:3000'

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}&user_id=${userId}&doctor_name=${encodeURIComponent(doctorName)}&plan=${plan}`,
    cancel_url: `${origin}/pricing`,
    metadata: {
      userId,
      doctorName,
      plan,
    },
  })

  return NextResponse.json({ url: session.url })
}
