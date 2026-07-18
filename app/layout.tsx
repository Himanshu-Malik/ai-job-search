import type { Metadata } from 'next'
import { Sora, DM_Sans } from 'next/font/google'
import Providers from '@/components/Providers'
import { auth } from '@/lib/auth'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sora',
  weight: ['400', '500', '600', '700'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'AI Job Search — Find your next role with AI',
  description:
    'Search thousands of tech jobs in India using natural language. ' +
    'Describe your ideal job and AI finds the best matches for you.',
  keywords: ['jobs', 'ai', 'search', 'india', 'tech', 'remote', 'startup'],
  authors: [{ name: 'AI Job Search' }],
  icons: {
    icon: '/favicon.svg?v=1',
  },
  openGraph: {
    title: 'AI Job Search — Find your next role with AI',
    description: 'Search thousands of tech jobs in India using natural language.',
    type: 'website',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable}`}>
      <body className="antialiased"><Providers session={session}>{children}</Providers></body>
    </html>
  )
}