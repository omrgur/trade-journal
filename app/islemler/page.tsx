'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Islem } from '@/lib/types'
import IslemFormu from '@/components/IslemFormu'

function PnlText({ pnl }: { pnl: number | null }) {
  if (pnl === null) return <span className="text-[#b8c0cc]">—</span>
  const pos = pnl > 0
  return (
    <span className={`font-semibold tabular-nums ${pos ? 'text-[#059669]' : pnl < 0 ? 'text-[#dc2626]' : 'text-[#8892a4]'}`}>
      {pos ? '+' : ''}{pnl}
    </span>
  )
}

function YonBadge({ yon }: { yon: string }) {
  return yon === 'long'
    ? <span className="badge-long rounded-md px-2 py-0.5 text-xs font-semibold">LONG</span>
    : <span className="badge-short rounded-md px-2 py-0.5 text-xs font-semibold">SHORT</span>
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'green' | 'red' | 'default' }) {
  const valueColor =
    accent === 'green' ? 'text-[#059669]' :
    accent === 'red' ? 'text-[#dc2626]' :
    'text-[#0f1117]'

  return (
    <div className="card rounded-2xl border border-[#e4e8f0] bg-white p-5 hover:border-[#c8d0e4]">
      <p className="text-xs font-medium text-[#8892a4] uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-[#b8c0cc] mt-1">{sub}</p>}
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
          accent={toplamPnl > 0 ? 'green' : toplamPnl < 0 ? 'red' : 'default'}
        />
        <StatCard
          label="Win Rate"
          value={winRate === '—' ? '—' : `%${winRate}`}
          sub={`${kazanan} kazanan`}
        />
        <StatCard
          label="Ort. Risk/Ödül"
          value={ortRr === '—' ? '—' : `${ortRr}R`}
          sub="ortalama RR"
        />
        <StatCard
          label="Kazanan / Kaybeden"
          value={islemler.length > 0 ? `${kazanan} / ${islemler.length - kazanan}` : '— / —'}
          sub="bu dönem"
        />
      </div>

      {/* Header + controls */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-base font-semibold text-[#0f1117]">İşlem Geçmişi</h1>
          <span className="rounded-full border border-[#e4e8f0] px-2.5 py-0.5 text-xs text-[#8892a4]">
            {islemler.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtreler.hesap}
            onChange={(e) => setFiltreler((f) => ({ ...f, hesap: e.target.value }))}
            className="rounded-xl border border-[#e4e8f0] bg-white px-3 py-2 text-xs text-[#8892a4] hover:border-[#c8d0e4]"
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
            className="rounded-xl border border-[#e4e8f0] bg-white px-3 py-2 text-xs text-[#0f1117] placeholder:text-[#b8c0cc] w-32 hover:border-[#c8d0e4]"
          />
          <button
            onClick={() => setFormAcik(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#5b50e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a40d4] shadow-sm shadow-[#5b50e8]/20"
          >
            <span className="text-base leading-none">+</span>
            Yeni İşlem
          </button>
        </div>
      </div>

      {/* Table */}
      {yukleniyor ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5b50e8] border-t-transparent" />
        </div>
      ) : islemler.length === 0 ? (
        <div className="card rounded-2xl border border-[#e4e8f0] bg-white py-20 text-center">
          <p className="text-3xl mb-4">📊</p>
          <p className="text-[#0f1117] font-medium mb-1">Henüz işlem yok</p>
          <p className="text-sm text-[#8892a4]">
            &ldquo;+ Yeni İşlem&rdquo; ile ekleyebilir veya Telegram botunuzu kullanabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="card rounded-2xl border border-[#e4e8f0] bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0f2f8]">
                {['Tarih', 'Enstrüman', 'Yön', 'Giriş', 'Çıkış', 'PnL', 'RR', 'Hesap', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#b8c0cc] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {islemler.map((islem) => (
                <tr key={islem.id} className="table-row border-b border-[#f4f6fb] last:border-0 cursor-pointer">
                  <td className="px-4 py-3.5 text-[#8892a4] text-xs whitespace-nowrap">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      {new Date(islem.tarih_saat).toLocaleDateString('tr-TR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/islemler/${islem.id}`} className="flex items-center gap-1.5">
                      <span className="font-semibold text-[#0f1117] tracking-wide">{islem.enstruman}</span>
                      {islem.chart_gorseli_url && <span className="text-[#b8c0cc] text-xs">📎</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      <YonBadge yon={islem.yon} />
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[#8892a4] tabular-nums">
                    <Link href={`/islemler/${islem.id}`} className="block">{islem.giris_fiyati ?? '—'}</Link>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[#8892a4] tabular-nums">
                    <Link href={`/islemler/${islem.id}`} className="block">{islem.cikis_fiyati ?? '—'}</Link>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      <PnlText pnl={islem.pnl} />
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-right text-[#8892a4] tabular-nums">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      {islem.rr_orani ? `${islem.rr_orani}R` : '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      {islem.hesap_turu ? (
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium border ${
                          islem.hesap_turu === 'prop'
                            ? 'border-blue-200 bg-blue-50 text-blue-600'
                            : 'border-violet-200 bg-violet-50 text-violet-600'
                        }`}>
                          {islem.hesap_turu === 'prop' ? 'Prop' : 'Kendi'}
                        </span>
                      ) : '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-center text-xs text-[#b8c0cc]">
                    <Link href={`/islemler/${islem.id}`} className="block">
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
