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
        <nav className="sticky top-0 z-40 border-b border-[#e4e8f0] bg-white/90 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              {/* Logo — sadece yazı, clean */}
              <Link href="/islemler" className="flex items-center gap-1.5 group">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-[#5b50e8]">
                  <polyline points="1,14 6,8 10,11 17,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
                <span className="font-semibold text-[#0f1117] tracking-tight">Trade Journal</span>
              </Link>

              <NavLinks />
            </div>
          </div>
        </nav>

        <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
