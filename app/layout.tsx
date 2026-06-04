import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Trade Journal',
  description: 'Kişisel işlem defteri ve AI koçluk sistemi',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-gray-950 text-gray-100 antialiased">
        <nav className="border-b border-gray-800 bg-gray-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              <Link href="/islemler" className="flex items-center gap-2 font-semibold text-white">
                <span className="text-emerald-400">📈</span>
                <span>Trade Journal</span>
              </Link>
              <div className="flex items-center gap-6 text-sm">
                <Link href="/islemler" className="text-gray-400 hover:text-white transition-colors">
                  İşlemler
                </Link>
                <Link href="/istatistikler" className="text-gray-400 hover:text-white transition-colors">
                  İstatistikler
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">{children}</main>
      </body>
    </html>
  )
}
