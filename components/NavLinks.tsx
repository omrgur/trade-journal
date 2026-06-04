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
            className={`relative px-3 py-1.5 text-sm rounded-lg transition-colors ${
              active
                ? 'text-white bg-white/[0.08]'
                : 'text-[#4b5471] hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {label}
            {active && (
              <span className="absolute inset-x-3 -bottom-[1px] h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
            )}
          </Link>
        )
      })}
    </div>
  )
}
