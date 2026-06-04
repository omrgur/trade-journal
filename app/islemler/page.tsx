'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Islem } from '@/lib/types'
import IslemFormu from '@/components/IslemFormu'

function pnlRenk(pnl: number | null) {
  if (pnl === null) return 'text-gray-400'
  if (pnl > 0) return 'text-emerald-400'
  if (pnl < 0) return 'text-red-400'
  return 'text-gray-400'
}

function ynEtiketi(yon: string) {
  return yon === 'long' ? (
    <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-900/60 text-emerald-300">LONG</span>
  ) : (
    <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-red-900/60 text-red-300">SHORT</span>
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
    setIslemler(data)
    setYukleniyor(false)
  }, [filtreler])

  useEffect(() => {
    yukle()
  }, [yukle])

  const toplamPnl = islemler.reduce((sum, i) => sum + (i.pnl ?? 0), 0)
  const kazanan = islemler.filter((i) => (i.pnl ?? 0) > 0).length
  const winRate = islemler.length > 0 ? ((kazanan / islemler.length) * 100).toFixed(0) : '-'

  return (
    <div>
      {/* Özet kartlar */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <p className="text-xs text-gray-500 mb-1">Toplam İşlem</p>
          <p className="text-2xl font-bold text-white">{islemler.length}</p>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <p className="text-xs text-gray-500 mb-1">Toplam PnL</p>
          <p className={`text-2xl font-bold ${pnlRenk(toplamPnl)}`}>
            {toplamPnl > 0 ? '+' : ''}{toplamPnl.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <p className="text-xs text-gray-500 mb-1">Win Rate</p>
          <p className="text-2xl font-bold text-white">%{winRate}</p>
        </div>
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
          <p className="text-xs text-gray-500 mb-1">Kazanan / Kaybeden</p>
          <p className="text-2xl font-bold text-white">
            <span className="text-emerald-400">{kazanan}</span>
            <span className="text-gray-600 mx-1">/</span>
            <span className="text-red-400">{islemler.length - kazanan}</span>
          </p>
        </div>
      </div>

      {/* Başlık + butonlar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white">İşlem Geçmişi</h1>
        <button
          onClick={() => setFormAcik(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          + Yeni İşlem
        </button>
      </div>

      {/* Filtreler */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={filtreler.hesap}
          onChange={(e) => setFiltreler((f) => ({ ...f, hesap: e.target.value }))}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300"
        >
          <option value="">Tüm Hesaplar</option>
          <option value="prop">Prop</option>
          <option value="kendi">Kendi</option>
        </select>
        <input
          type="text"
          placeholder="Enstrüman ara..."
          value={filtreler.enstruman}
          onChange={(e) => setFiltreler((f) => ({ ...f, enstruman: e.target.value }))}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 placeholder:text-gray-600 w-40"
        />
      </div>

      {/* Tablo */}
      {yukleniyor ? (
        <div className="text-center py-16 text-gray-500">Yükleniyor...</div>
      ) : islemler.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">Henüz işlem yok</p>
          <p className="text-sm">Yukarıdaki &ldquo;+ Yeni İşlem&rdquo; butonundan veya Telegram bot üzerinden işlem ekleyebilirsiniz.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enstrüman</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yön</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Giriş</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Çıkış</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">PnL</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">RR</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hesap</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {islemler.map((islem) => (
                <tr
                  key={islem.id}
                  className="border-b border-gray-800/50 hover:bg-gray-900/40 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      {new Date(islem.tarih_saat).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/islemler/${islem.id}`} className="font-medium text-white">{islem.enstruman}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/islemler/${islem.id}`} className="block">{ynEtiketi(islem.yon)}</Link>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    <Link href={`/islemler/${islem.id}`} className="block">{islem.giris_fiyati ?? '-'}</Link>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    <Link href={`/islemler/${islem.id}`} className="block">{islem.cikis_fiyati ?? '-'}</Link>
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${pnlRenk(islem.pnl)}`}>
                    <Link href={`/islemler/${islem.id}`} className="block">
                      {islem.pnl !== null ? `${islem.pnl > 0 ? '+' : ''}${islem.pnl}` : '-'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    <Link href={`/islemler/${islem.id}`} className="block">{islem.rr_orani ?? '-'}</Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link href={`/islemler/${islem.id}`} className="block">
                      {islem.hesap_turu ? (
                        <span className={`rounded px-1.5 py-0.5 text-xs ${islem.hesap_turu === 'prop' ? 'bg-blue-900/60 text-blue-300' : 'bg-purple-900/60 text-purple-300'}`}>
                          {islem.hesap_turu === 'prop' ? 'Prop' : 'Kendi'}
                        </span>
                      ) : '-'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500 text-xs">
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

      {/* Form modal */}
      {formAcik && (
        <IslemFormu
          onKapat={() => setFormAcik(false)}
          onKayit={() => {
            setFormAcik(false)
            yukle()
          }}
        />
      )}
    </div>
  )
}
