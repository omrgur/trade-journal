'use client'

import { useState } from 'react'
import type { Islem } from '@/lib/types'

interface GunOzet {
  sayi: number
  pnl: number
}

const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

export default function Takvim({ islemler }: { islemler: Islem[] }) {
  const bugun = new Date()
  const [gorunum, setGorunum] = useState({ yil: bugun.getFullYear(), ay: bugun.getMonth() })

  const oncekiAy = () => setGorunum((g) => {
    const d = new Date(g.yil, g.ay - 1)
    return { yil: d.getFullYear(), ay: d.getMonth() }
  })
  const sonrakiAy = () => setGorunum((g) => {
    const d = new Date(g.yil, g.ay + 1)
    return { yil: d.getFullYear(), ay: d.getMonth() }
  })

  // Ayın ilk günü hangi haftanın günü (Pazartesi=0)
  const ilkGun = new Date(gorunum.yil, gorunum.ay, 1)
  const ilkGunIndex = (ilkGun.getDay() + 6) % 7 // Pazartesi bazlı
  const toplamGun = new Date(gorunum.yil, gorunum.ay + 1, 0).getDate()

  // Günlük özetler
  const gunOzetler: Record<string, GunOzet> = {}
  for (const i of islemler) {
    const d = i.tarih_saat.slice(0, 10)
    if (!gunOzetler[d]) gunOzetler[d] = { sayi: 0, pnl: 0 }
    gunOzetler[d].sayi++
    gunOzetler[d].pnl += i.pnl ?? 0
  }

  const bugunStr = bugun.toISOString().slice(0, 10)

  // Grid hücreleri (boş + günler)
  const hucreler: Array<null | number> = [
    ...Array(ilkGunIndex).fill(null),
    ...Array.from({ length: toplamGun }, (_, i) => i + 1),
  ]
  // 6 satır için dolgu
  while (hucreler.length % 7 !== 0) hucreler.push(null)

  return (
    <div className="card rounded-2xl border border-[#e4e8f0] bg-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-[#0f1117]">
          {AYLAR[gorunum.ay]} {gorunum.yil}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setGorunum({ yil: bugun.getFullYear(), ay: bugun.getMonth() })}
            className="px-2.5 py-1 text-xs rounded-lg border border-[#e4e8f0] text-[#8892a4] hover:text-[#0f1117] hover:border-[#c8d0e4]"
          >
            Bugün
          </button>
          <button onClick={oncekiAy} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f4f6fb] text-[#8892a4] hover:text-[#0f1117]">
            ‹
          </button>
          <button onClick={sonrakiAy} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f4f6fb] text-[#8892a4] hover:text-[#0f1117]">
            ›
          </button>
        </div>
      </div>

      {/* Gün başlıkları */}
      <div className="grid grid-cols-7 mb-1">
        {GUNLER.map((g) => (
          <div key={g} className="py-1.5 text-center text-xs font-medium text-[#b8c0cc] uppercase tracking-wide">
            {g}
          </div>
        ))}
      </div>

      {/* Takvim grid */}
      <div className="grid grid-cols-7 gap-px bg-[#f4f6fb] rounded-xl overflow-hidden border border-[#f0f2f8]">
        {hucreler.map((gun, i) => {
          if (!gun) return <div key={i} className="bg-white min-h-[72px]" />

          const tarihStr = `${gorunum.yil}-${String(gorunum.ay + 1).padStart(2, '0')}-${String(gun).padStart(2, '0')}`
          const ozet = gunOzetler[tarihStr]
          const isBugun = tarihStr === bugunStr

          return (
            <div
              key={i}
              className={`bg-white min-h-[72px] p-2 ${ozet ? 'cursor-pointer hover:bg-[#fafbff]' : ''}`}
            >
              {/* Tarih numarası */}
              <span className={`text-xs font-semibold inline-flex w-5 h-5 items-center justify-center rounded-full ${
                isBugun
                  ? 'bg-[#5b50e8] text-white'
                  : 'text-[#8892a4]'
              }`}>
                {gun}
              </span>

              {/* İşlem özeti */}
              {ozet && (
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-[10px] text-[#b8c0cc] leading-none">{ozet.sayi} işlem</p>
                  <p className={`text-xs font-semibold leading-none tabular-nums ${
                    ozet.pnl > 0 ? 'text-[#059669]' : ozet.pnl < 0 ? 'text-[#dc2626]' : 'text-[#8892a4]'
                  }`}>
                    {ozet.pnl > 0 ? '+' : ''}{ozet.pnl.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
