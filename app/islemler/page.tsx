'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Islem } from '@/lib/types'
import IslemFormu from '@/components/IslemFormu'

function PnlText({ pnl }: { pnl: number | null }) {
  if (pnl === null) return <span className="text-[#4b5471]">—</span>
  const pos = pnl > 0
  return (
    <span className={`font-semibold tabular-nums ${pos ? 'text-[#00e5a0]' : pnl < 0 ? 'text-[#ff4d6d]' : 'text-[#4b5471]'}`}>
      {pos ? '+' : ''}{pnl}
    </span>
  )
}

function YonBadge({ yon }: { yon: string }) {
  return yon === 'long'
    ? <span className="badge-long rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide">LONG</span>
    : <span className="badge-short rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide">SHORT</span>
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string; variant?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1320] p-5 hover:border-white/[0.12] transition-all">
      <p className="text-xs font-medium text-[#4b5471] uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      {sub && <p className="text-xs text-[#4b5471] mt-1">{sub}</p>}
    </div>
  )
}

export default function IslemlerPage() {
  const [islemler, setIslemler] = useState<Islem[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [formAcik, setFormAcik] = useState(false)
  const [filtreler, setFiltreler] = useState({ hesap: '', enstruman: '' })

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    const params = new URLSearchParams()
    if (filtreler.hesap) params.set('hesap', filtreler.hesap)
    if (filtreler.enstruman) params.set('enstruman', filtreler.enstruman)
    const res = await fetch(`/api/islemler?${params}`)
    const data = await res.json()
    setIslemler(Array.isArray(data) ? data : [])
    setYukleniyor(false)
  }, [filtreler])

  useEffect(() => { yukle() }, [yukle])

  const toplamPnl = islemler.reduce((s, i) => s + (i.pnl ?? 0), 0)
  const kazanan = islemler.filter((i) => (i.pnl ?? 0) > 0).length
  const winRate = islemler.length > 0 ? ((kazanan / islemler.length) * 100).toFixed(0) : '—'
  const ortRr = islemler.filter((i) => i.rr_orani).length > 0
    ? (islemler.reduce((s, i) => s + (i.rr_orani ?? 0), 0) / islemler.filter((i) => i.rr_orani).length).toFixed(2)
    : '—'

  return (
    <div>
      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Toplam PnL"
          value={`${toplamPnl > 0 ? '+' : ''}${toplamPnl.toFixed(2)}`}
          sub={`${islemler.length} işlem`}
        />
        <StatCard
          label="Win Rate"
          value={`%${winRate}`}
          sub={`${kazanan} kazanan`}
        />
        <StatCard
          label="Ort. Risk/Ödül"
          value={ortRr === '—' ? '—' : `${ortRr}R`}
          sub="ortalama RR"
        />
        <StatCard
          label="Kazanan / Kaybeden"
          value={`${kazanan} / ${islemler.length - kazanan}`}
          sub="bu dönem"
        />
      </div>

      {/* Header + filters */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white">İşlem Geçmişi</h1>
          <span className="rounded-full border border-white/[0.08] px-2.5 py-0.5 text-xs text-[#4b5471]">
            {islemler.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtreler.hesap}
            onChange={(e) => setFiltreler((f) => ({ ...f, hesap: e.target.value }))}
            className="rounded-xl border border-white/[0.08] bg-[#0f1320] px-3 py-2 text-xs text-[#4b5471] hover:border-white/[0.14]"
          >
            <option value="">Tüm Hesaplar</option>
            <option value="prop">Prop</option>
            <option value="kendi">Kendi</option>
          </select>
          <input
            type="text"
            placeholder="Enstrüman..."
            value={filtreler.enstruman}
            onChange={(e) => setFiltreler((f) => ({ ...f, enstruman: e.target.value }))}
            className="rounded-xl border border-white/[0.08] bg-[#0f1320] px-3 py-2 text-xs text-[#4b5471] placeholder:text-[#2a3050] w-32 hover:border-white/[0.14]"
          />
          <button
            onClick={() => setFormAcik(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-purple-500"
          >
            <span className="text-base leading-none">+</span>
            <span>Yeni İşlem</span>
          </button>
        </div>
      </div>

      {/* Table */}
      {yukleniyor ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      ) : islemler.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#0f1320] py-20 text-center">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-white font-medium mb-1">Henüz işlem yok</p>
          <p className="text-sm text-[#4b5471]">
            &ldquo;+ Yeni İşlem&rdquo; ile ekleyebilir veya Telegram botunuzu kullanabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1320] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['Tarih', 'Enstrüman', 'Yön', 'Giriş', 'Çıkış', 'PnL', 'RR', 'Hesap', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#2a3050] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {islemler.map((islem, i) => (
                <tr
                  key={islem.id}
                  className={`table-row border-b border-white/[0.04] last:border-0 cursor-pointer ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                >
                  <td className="px-4 py-3.5 text-[#4b5471] text-xs whitespace-nowrap">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      {new Date(islem.tarih_saat).toLocaleDateString('tr-TR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/islemler/${islem.id}`} className="flex items-center gap-2">
                      <span className="font-semibold text-white tracking-wide">{islem.enstruman}</span>
                      {islem.chart_gorseli_url && <span className="text-[#4b5471] text-xs">📎</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      <YonBadge yon={islem.yon} />
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[#4b5471] tabular-nums">
                    <Link href={`/islemler/${islem.id}`} className="block">{islem.giris_fiyati ?? '—'}</Link>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[#4b5471] tabular-nums">
                    <Link href={`/islemler/${islem.id}`} className="block">{islem.cikis_fiyati ?? '—'}</Link>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      <PnlText pnl={islem.pnl} />
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[#4b5471] tabular-nums">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      {islem.rr_orani ? `${islem.rr_orani}R` : '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      {islem.hesap_turu ? (
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium border ${
                          islem.hesap_turu === 'prop'
                            ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                            : 'border-purple-500/20 bg-purple-500/10 text-purple-400'
                        }`}>
                          {islem.hesap_turu === 'prop' ? 'Prop' : 'Kendi'}
                        </span>
                      ) : '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Link href={`/islemler/${islem.id}`} className="block text-[#2a3050] hover:text-[#4b5471] text-xs">
                      {islem.kaynak === 'telegram' ? '📱' : '🖥️'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formAcik && (
        <IslemFormu
          onKapat={() => setFormAcik(false)}
          onKayit={() => { setFormAcik(false); yukle() }}
        />
      )}
    </div>
  )
}
