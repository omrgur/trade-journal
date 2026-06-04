'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/islemler', label: 'İşlemler' },
  { href: '/istatistikler', label: 'İstatistikler' },
]

export default function NavLinks() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1">
      {links.map(({ href, label }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`relative px-3.5 py-1.5 text-sm rounded-lg transition-colors ${
              active
                ? 'text-[#5b50e8] bg-[#f0effd] font-medium'
                : 'text-[#8892a4] hover:text-[#0f1117] hover:bg-[#f4f6fb]'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
