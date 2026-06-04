'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import type { Islem } from '@/lib/types'

interface GunlukVeri {
  tarih: string
  pnl: number
  kumulatif: number
  islemSayisi: number
}

function gunlukVeriHazirla(islemler: Islem[]): GunlukVeri[] {
  const gunler: Record<string, { pnl: number; sayi: number }> = {}

  for (const i of islemler) {
    const gun = i.tarih_saat.slice(0, 10)
    if (!gunler[gun]) gunler[gun] = { pnl: 0, sayi: 0 }
    gunler[gun].pnl += i.pnl ?? 0
    gunler[gun].sayi += 1
  }

  const sirali = Object.entries(gunler)
    .sort(([a], [b]) => a.localeCompare(b))

  let kumulatif = 0
  return sirali.map(([tarih, { pnl, sayi }]) => {
    kumulatif += pnl
    return {
      tarih: new Date(tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
      pnl: Math.round(pnl * 100) / 100,
      kumulatif: Math.round(kumulatif * 100) / 100,
      islemSayisi: sayi,
    }
  })
}

function enstrumanaGoreGrupla(islemler: Islem[]) {
  const gruplar: Record<string, { kazanan: number; kaybeden: number; toplamPnl: number }> = {}
  for (const i of islemler) {
    if (!gruplar[i.enstruman]) gruplar[i.enstruman] = { kazanan: 0, kaybeden: 0, toplamPnl: 0 }
    gruplar[i.enstruman].toplamPnl += i.pnl ?? 0
    if ((i.pnl ?? 0) > 0) gruplar[i.enstruman].kazanan++
    else if ((i.pnl ?? 0) < 0) gruplar[i.enstruman].kaybeden++
  }
  return Object.entries(gruplar)
    .sort(([, a], [, b]) => Math.abs(b.toplamPnl) - Math.abs(a.toplamPnl))
    .slice(0, 8)
}

export default function IstatistiklerPage() {
  const [islemler, setIslemler] = useState<Islem[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [donem, setDonem] = useState<'hafta' | 'ay' | 'tum'>('ay')

  useEffect(() => {
    fetch('/api/islemler')
      .then((r) => r.json())
      .then((data) => {
        setIslemler(data)
        setYukleniyor(false)
      })
  }, [])

  const filtreliIslemler = islemler.filter((i) => {
    const tarih = new Date(i.tarih_saat)
    const simdi = new Date()
    if (donem === 'hafta') {
      const haftaOnce = new Date(simdi)
      haftaOnce.setDate(simdi.getDate() - 7)
      return tarih >= haftaOnce
    }
    if (donem === 'ay') {
      const ayOnce = new Date(simdi)
      ayOnce.setMonth(simdi.getMonth() - 1)
      return tarih >= ayOnce
    }
    return true
  })

  const toplamPnl = filtreliIslemler.reduce((s, i) => s + (i.pnl ?? 0), 0)
  const kazanan = filtreliIslemler.filter((i) => (i.pnl ?? 0) > 0)
  const kaybeden = filtreliIslemler.filter((i) => (i.pnl ?? 0) < 0)
  const winRate = filtreliIslemler.length > 0 ? (kazanan.length / filtreliIslemler.length) * 100 : 0
  const ortRr = filtreliIslemler.filter((i) => i.rr_orani).reduce((s, i) => s + (i.rr_orani ?? 0), 0) /
    (filtreliIslemler.filter((i) => i.rr_orani).length || 1)
  const enIyiIslem = filtreliIslemler.reduce<Islem | null>((best, i) => (i.pnl ?? -Infinity) > (best?.pnl ?? -Infinity) ? i : best, null)
  const enKotuIslem = filtreliIslemler.reduce<Islem | null>((worst, i) => (i.pnl ?? Infinity) < (worst?.pnl ?? Infinity) ? i : worst, null)

  const gunlukVeri = gunlukVeriHazirla(filtreliIslemler)
  const enstrumanGrup = enstrumanaGoreGrupla(filtreliIslemler)

  if (yukleniyor) return <div className="text-center py-16 text-gray-500">Yükleniyor...</div>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">İstatistikler</h1>
        <div className="flex rounded-lg overflow-hidden border border-gray-700 text-sm">
          {([['hafta', 'Bu Hafta'], ['ay', 'Bu Ay'], ['tum', 'Tümü']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setDonem(val)}
              className={`px-3 py-1.5 transition-colors ${donem === val ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtreliIslemler.length === 0 ? (
        <div className="text-center py-16 text-gray-500">Bu dönemde işlem yok</div>
      ) : (
        <>
          {/* Özet kartlar */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { etiket: 'Toplam İşlem', deger: filtreliIslemler.length.toString(), renk: 'text-white' },
              { etiket: 'Toplam PnL', deger: `${toplamPnl > 0 ? '+' : ''}${toplamPnl.toFixed(2)}`, renk: toplamPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
              { etiket: 'Win Rate', deger: `%${winRate.toFixed(0)}`, renk: winRate >= 50 ? 'text-emerald-400' : 'text-red-400' },
              { etiket: 'Kazanan', deger: kazanan.length.toString(), renk: 'text-emerald-400' },
              { etiket: 'Kaybeden', deger: kaybeden.length.toString(), renk: 'text-red-400' },
              { etiket: 'Ort. RR', deger: ortRr.toFixed(2), renk: 'text-white' },
            ].map(({ etiket, deger, renk }) => (
              <div key={etiket} className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                <p className="text-xs text-gray-500 mb-1">{etiket}</p>
                <p className={`text-xl font-bold ${renk}`}>{deger}</p>
              </div>
            ))}
          </div>

          {/* Kümülatif PnL */}
          <div className="mb-5 rounded-xl bg-gray-900 border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Kümülatif PnL</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={gunlukVeri}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="tarih" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <ReferenceLine y={0} stroke="#374151" />
                <Line type="monotone" dataKey="kumulatif" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Günlük PnL */}
          <div className="mb-5 rounded-xl bg-gray-900 border border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Günlük PnL</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={gunlukVeri}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="tarih" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <ReferenceLine y={0} stroke="#374151" />
                <Bar dataKey="pnl" fill="#10b981" radius={[3, 3, 0, 0]}
                  className="[&_.recharts-bar-rectangle]:data-[positive=false]:fill-red-500"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Enstrüman analizi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Enstrümanlara Göre</h2>
              <div className="space-y-3">
                {enstrumanGrup.map(([enstruman, { kazanan: k, kaybeden: kb, toplamPnl: pnl }]) => (
                  <div key={enstruman} className="flex items-center gap-3">
                    <span className="text-sm text-white font-medium w-20 shrink-0">{enstruman}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${pnl >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(Math.abs(pnl) / 100, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium w-20 text-right ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-500 w-10 text-right">{k}W/{kb}L</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-gray-900 border border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">En İyi / En Kötü</h2>
              {enIyiIslem && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">En İyi İşlem</p>
                  <div className="rounded-lg bg-emerald-900/20 border border-emerald-800/40 p-3">
                    <div className="flex justify-between">
                      <span className="text-white font-medium">{enIyiIslem.enstruman} {enIyiIslem.yon}</span>
                      <span className="text-emerald-400 font-bold">+{enIyiIslem.pnl}</span>
                    </div>
                    <span className="text-gray-500 text-xs">{new Date(enIyiIslem.tarih_saat).toLocaleDateString('tr-TR')}</span>
                  </div>
                </div>
              )}
              {enKotuIslem && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">En Kötü İşlem</p>
                  <div className="rounded-lg bg-red-900/20 border border-red-800/40 p-3">
                    <div className="flex justify-between">
                      <span className="text-white font-medium">{enKotuIslem.enstruman} {enKotuIslem.yon}</span>
                      <span className="text-red-400 font-bold">{enKotuIslem.pnl}</span>
                    </div>
                    <span className="text-gray-500 text-xs">{new Date(enKotuIslem.tarih_saat).toLocaleDateString('tr-TR')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
