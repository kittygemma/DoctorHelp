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

      <Link href="/pricing" className="mt-8 text-sm text-slate-400 hover:text-teal-700 transition-colors">
        View Pricing
      </Link>
    </div>
  )
}
