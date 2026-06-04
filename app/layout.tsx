import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import NavLinks from '@/components/NavLinks'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'Trade Journal',
  description: 'Kişisel işlem defteri ve AI koçluk sistemi',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${geist.variable} h-full`}>
      <body className="min-h-full antialiased relative">
        {/* Navbar */}
        <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#080b14]/80 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              {/* Logo */}
              <Link href="/islemler" className="flex items-center gap-2.5 group">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-violet-500/20">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 10L5 6L8 9L13 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="font-semibold text-white tracking-tight">Trade Journal</span>
              </Link>

              {/* Nav links */}
              <NavLinks />
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
