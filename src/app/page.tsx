import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
        <div className="text-5xl mb-4">🩺</div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">DoctorHelp</h1>
        <p className="text-lg text-slate-500 max-w-md mx-auto">
          AI-powered pre-visit triage. Reduce wait times and give your doctors a head start.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Link
          href="/pricing"
          className="flex-1 bg-teal-700 text-white text-center py-4 px-6 rounded-xl font-semibold text-lg hover:bg-teal-800 transition-colors"
        >
          View Plans
        </Link>
        <Link
          href="/login"
          className="flex-1 bg-white text-teal-700 text-center py-4 px-6 rounded-xl font-semibold text-lg border-2 border-teal-700 hover:bg-teal-50 transition-colors"
        >
          Sign In
        </Link>
      </div>
    </div>
  )
}
