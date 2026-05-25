import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DoctorHelp',
  description: 'AI-powered pre-visit triage system',
  icons: { icon: '/logo.png' },
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
