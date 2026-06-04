'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Islem } from '@/lib/types'

// Recharts sadece client'ta render edilsin (SSR hatası önleme)
const GrafiklerBolumu = dynamic(() => import('@/components/GrafiklerBolumu'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5b50e8] border-t-transparent" />
    </div>
  ),
})

function StatKart({ label, value, renk }: { label: string; value: string; renk?: string }) {
  return (
    <div className="card rounded-2xl border border-[#e4e8f0] bg-white p-5">
      <p className="text-xs font-medium text-[#8892a4] uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${renk ?? 'text-[#0f1117]'}`}>{value}</p>
    </div>
  )
}

export default function IstatistiklerPage() {
  const [islemler, setIslemler] = useState<Islem[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [donem, setDonem] = useState<'hafta' | 'ay' | 'tum'>('ay')

  useEffect(() => {
    fetch('/api/islemler')
      .then((r) => r.json())
      .then((data) => {
        setIslemler(Array.isArray(data) ? data : [])
        setYukleniyor(false)
      })
      .catch(() => setYukleniyor(false))
  }, [])

  const filtreliIslemler = islemler.filter((i) => {
    if (donem === 'tum') return true
    const tarih = new Date(i.tarih_saat)
    const simdi = new Date()
    const gun = donem === 'hafta' ? 7 : 30
    const esik = new Date(simdi)
    esik.setDate(simdi.getDate() - gun)
    return tarih >= esik
  })

  const toplamPnl = filtreliIslemler.reduce((s, i) => s + (i.pnl ?? 0), 0)
  const kazananlar = filtreliIslemler.filter((i) => (i.pnl ?? 0) > 0)
  const winRate = filtreliIslemler.length > 0
    ? ((kazananlar.length / filtreliIslemler.length) * 100).toFixed(0)
    : '—'
  const rrList = filtreliIslemler.filter((i) => i.rr_orani)
  const ortRr = rrList.length > 0
    ? (rrList.reduce((s, i) => s + (i.rr_orani ?? 0), 0) / rrList.length).toFixed(2)
    : '—'

  if (yukleniyor) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5b50e8] border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      {/* Başlık + dönem filtresi */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-base font-semibold text-[#0f1117]">İstatistikler</h1>
        <div className="flex rounded-xl overflow-hidden border border-[#e4e8f0] text-sm">
          {([['hafta', 'Bu Hafta'], ['ay', 'Bu Ay'], ['tum', 'Tümü']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setDonem(val)}
              className={`px-4 py-2 transition-colors ${
                donem === val
                  ? 'bg-[#f0effd] text-[#5b50e8] font-medium'
                  : 'bg-white text-[#8892a4] hover:text-[#0f1117]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtreliIslemler.length === 0 ? (
        <div className="card rounded-2xl border border-[#e4e8f0] bg-white py-20 text-center">
          <p className="text-3xl mb-4">📊</p>
          <p className="text-[#0f1117] font-medium mb-1">Bu dönemde işlem yok</p>
          <p className="text-sm text-[#8892a4]">Farklı bir dönem seçin veya işlem ekleyin.</p>
        </div>
      ) : (
        <>
          {/* Özet kartlar */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatKart
              label="Toplam İşlem"
              value={filtreliIslemler.length.toString()}
            />
            <StatKart
              label="Toplam PnL"
              value={`${toplamPnl > 0 ? '+' : ''}${toplamPnl.toFixed(2)}`}
              renk={toplamPnl >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'}
            />
            <StatKart
              label="Win Rate"
              value={winRate === '—' ? '—' : `%${winRate}`}
              renk={Number(winRate) >= 50 ? 'text-[#059669]' : 'text-[#dc2626]'}
            />
            <StatKart
              label="Kazanan"
              value={kazananlar.length.toString()}
              renk="text-[#059669]"
            />
            <StatKart
              label="Kaybeden"
              value={(filtreliIslemler.length - kazananlar.length).toString()}
              renk="text-[#dc2626]"
            />
            <StatKart
              label="Ort. RR"
              value={ortRr === '—' ? '—' : `${ortRr}R`}
            />
          </div>

          {/* Grafikler — sadece client'ta */}
          <GrafiklerBolumu islemler={filtreliIslemler} />
        </>
      )}
    </div>
  )
}
