import Link from 'next/link'

const plans = [
  {
    name: 'Starter',
    slug: 'starter',
    price: '$49',
    period: '/month',
    description: 'Perfect for solo practitioners',
    features: [
      'Up to 50 patients/month',
      '1 doctor account',
      'AI triage & voice intake',
      'Real-time dashboard',
      'Email support',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Professional',
    slug: 'professional',
    price: '$149',
    period: '/month',
    description: 'For growing practices',
    features: [
      'Up to 300 patients/month',
      '5 doctor accounts',
      'AI triage & voice intake',
      'Real-time dashboard',
      'Voice cloning (custom AI voice)',
      'Priority support',
      'Patient history & analytics',
    ],
    cta: 'Get Started',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    price: 'Custom',
    period: '',
    description: 'For hospitals & clinic networks',
    features: [
      'Unlimited patients',
      'Unlimited doctor accounts',
      'AI triage & voice intake',
      'Real-time dashboard',
      'Voice cloning (custom AI voice)',
      'HIPAA compliance',
      'EHR/EMR integration',
      'Dedicated account manager',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">🩺</span>
          <span className="font-extrabold text-base text-slate-900">DoctorHelp</span>
        </Link>
        <Link href="/login" className="text-teal-700 text-sm font-semibold hover:text-teal-800">
          Sign In
        </Link>
      </div>

      {/* Header */}
      <div className="text-center pt-16 pb-12 px-6">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-3">Simple, transparent pricing</h1>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">
          Reduce wait times, improve patient experience, and give your doctors a head start — all powered by AI.
        </p>
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-6 pb-20 grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl p-8 flex flex-col ${
              plan.highlighted
                ? 'bg-teal-700 text-white shadow-xl ring-4 ring-teal-700/20 scale-105'
                : 'bg-white shadow-sm border border-slate-200'
            }`}
          >
            <div className="mb-6">
              <h3 className={`text-sm font-bold uppercase tracking-wide mb-2 ${
                plan.highlighted ? 'text-teal-200' : 'text-slate-500'
              }`}>
                {plan.name}
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">{plan.price}</span>
                {plan.period && (
                  <span className={`text-sm ${plan.highlighted ? 'text-teal-200' : 'text-slate-400'}`}>
                    {plan.period}
                  </span>
                )}
              </div>
              <p className={`text-sm mt-2 ${plan.highlighted ? 'text-teal-100' : 'text-slate-500'}`}>
                {plan.description}
              </p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 ${plan.highlighted ? 'text-teal-200' : 'text-teal-600'}`}>
                    &#10003;
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href={plan.slug === 'enterprise' ? '#' : `/signup?plan=${plan.slug}`}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-colors text-center block ${
                plan.highlighted
                  ? 'bg-white text-teal-700 hover:bg-teal-50'
                  : 'bg-teal-700 text-white hover:bg-teal-800'
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
