'use client'

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import type { Islem } from '@/lib/types'

function gunlukVeri(islemler: Islem[]) {
  const gunler: Record<string, { pnl: number; sayi: number }> = {}
  for (const i of islemler) {
    const gun = i.tarih_saat.slice(0, 10)
    if (!gunler[gun]) gunler[gun] = { pnl: 0, sayi: 0 }
    gunler[gun].pnl += i.pnl ?? 0
    gunler[gun].sayi += 1
  }
  let kumulatif = 0
  return Object.entries(gunler)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tarih, { pnl, sayi }]) => {
      kumulatif += pnl
      return {
        tarih: new Date(tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }),
        pnl: Math.round(pnl * 100) / 100,
        kumulatif: Math.round(kumulatif * 100) / 100,
        islemSayisi: sayi,
      }
    })
}

function enstrumanGrup(islemler: Islem[]) {
  const g: Record<string, { k: number; kb: number; pnl: number }> = {}
  for (const i of islemler) {
    if (!g[i.enstruman]) g[i.enstruman] = { k: 0, kb: 0, pnl: 0 }
    g[i.enstruman].pnl += i.pnl ?? 0
    if ((i.pnl ?? 0) > 0) g[i.enstruman].k++
    else if ((i.pnl ?? 0) < 0) g[i.enstruman].kb++
  }
  return Object.entries(g)
    .sort(([, a], [, b]) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 6)
}

const tipStyle = {
  contentStyle: {
    backgroundColor: '#fff',
    border: '1px solid #e4e8f0',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    fontSize: 12,
  },
  labelStyle: { color: '#8892a4' },
  itemStyle: { color: '#0f1117' },
}

export default function GrafiklerBolumu({ islemler }: { islemler: Islem[] }) {
  const veri = gunlukVeri(islemler)
  const gruplar = enstrumanGrup(islemler)

  const enIyi = islemler.reduce<Islem | null>((b, i) => (i.pnl ?? -Infinity) > (b?.pnl ?? -Infinity) ? i : b, null)
  const enKotu = islemler.reduce<Islem | null>((w, i) => (i.pnl ?? Infinity) < (w?.pnl ?? Infinity) ? i : w, null)

  return (
    <div className="space-y-5">
      {/* Kümülatif PnL */}
      <div className="card rounded-2xl border border-[#e4e8f0] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#0f1117] mb-5">Kümülatif PnL</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={veri} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
            <XAxis dataKey="tarih" tick={{ fill: '#b8c0cc', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#b8c0cc', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
            <Tooltip {...tipStyle} />
            <ReferenceLine y={0} stroke="#e4e8f0" />
            <Line type="monotone" dataKey="kumulatif" stroke="#5b50e8" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Günlük PnL */}
      <div className="card rounded-2xl border border-[#e4e8f0] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#0f1117] mb-5">Günlük PnL</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={veri} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
            <XAxis dataKey="tarih" tick={{ fill: '#b8c0cc', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#b8c0cc', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
            <Tooltip {...tipStyle} />
            <ReferenceLine y={0} stroke="#e4e8f0" />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {veri.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.pnl >= 0 ? '#059669' : '#dc2626'}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Alt 2 kolon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Enstrüman analizi */}
        <div className="card rounded-2xl border border-[#e4e8f0] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#0f1117] mb-5">Enstrümanlara Göre</h2>
          <div className="space-y-3">
            {gruplar.map(([enstruman, { k, kb, pnl }]) => {
              const maxPnl = Math.max(...gruplar.map(([, g]) => Math.abs(g.pnl)), 1)
              return (
                <div key={enstruman} className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-[#0f1117] w-20 shrink-0">{enstruman}</span>
                  <div className="flex-1 bg-[#f4f6fb] rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${pnl >= 0 ? 'bg-[#059669]' : 'bg-[#dc2626]'}`}
                      style={{ width: `${(Math.abs(pnl) / maxPnl) * 100}%` }}
                    />
                  </div>
                  <span className={`text-sm font-semibold w-20 text-right tabular-nums ${pnl >= 0 ? 'text-[#059669]' : 'text-[#dc2626]'}`}>
                    {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}
                  </span>
                  <span className="text-xs text-[#b8c0cc] w-10 text-right">{k}W/{kb}L</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* En iyi / en kötü */}
        <div className="card rounded-2xl border border-[#e4e8f0] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#0f1117] mb-5">En İyi / En Kötü</h2>
          {enIyi && (
            <div className="mb-4">
              <p className="text-xs text-[#8892a4] mb-2">En İyi İşlem</p>
              <div className="rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] p-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#0f1117] text-sm">{enIyi.enstruman} {enIyi.yon}</span>
                  <span className="text-[#059669] font-bold">+{enIyi.pnl}</span>
                </div>
                <span className="text-[#8892a4] text-xs">{new Date(enIyi.tarih_saat).toLocaleDateString('tr-TR')}</span>
              </div>
            </div>
          )}
          {enKotu && (
            <div>
              <p className="text-xs text-[#8892a4] mb-2">En Kötü İşlem</p>
              <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#0f1117] text-sm">{enKotu.enstruman} {enKotu.yon}</span>
                  <span className="text-[#dc2626] font-bold">{enKotu.pnl}</span>
                </div>
                <span className="text-[#8892a4] text-xs">{new Date(enKotu.tarih_saat).toLocaleDateString('tr-TR')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
