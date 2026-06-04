'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Islem } from '@/lib/types'
import IslemFormu from '@/components/IslemFormu'

function Satir({ etiket, deger }: { etiket: string; deger: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-800">
      <span className="text-gray-500 text-sm">{etiket}</span>
      <span className="text-gray-100 text-sm font-medium text-right">{deger ?? '-'}</span>
    </div>
  )
}

export default function IslemDetayPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [islem, setIslem] = useState<Islem | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [duzenleniyor, setDuzenleniyor] = useState(false)
  const [silOnay, setSilOnay] = useState(false)
  const [kocluk, setKocluk] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/islemler/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setIslem(data)
        setYukleniyor(false)
      })
      .catch(() => setYukleniyor(false))
  }, [id])

  async function sil() {
    await fetch(`/api/islemler/${id}`, { method: 'DELETE' })
    router.push('/islemler')
  }

  async function koclukSorulariYukle() {
    if (!islem) return
    const res = await fetch(`/api/claude/kocluk`)
    const data = await res.json()
    setKocluk(data.sorular ?? [])
  }

  if (yukleniyor) return <div className="text-center py-16 text-gray-500">Yükleniyor...</div>
  if (!islem) return <div className="text-center py-16 text-red-400">İşlem bulunamadı</div>

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/islemler" className="text-gray-500 hover:text-white text-sm flex items-center gap-1">
          ← İşlemlere Dön
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => setDuzenleniyor(true)}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
          >
            Düzenle
          </button>
          <button
            onClick={() => setSilOnay(true)}
            className="rounded-lg border border-red-800 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
          >
            Sil
          </button>
        </div>
      </div>

      {/* Başlık */}
      <div className="mb-6 rounded-xl bg-gray-900 border border-gray-800 p-5">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-white">{islem.enstruman}</h1>
          <span className={`rounded px-2 py-1 text-sm font-medium ${islem.yon === 'long' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'}`}>
            {islem.yon.toUpperCase()}
          </span>
        </div>
        <p className="text-gray-500 text-sm">
          {new Date(islem.tarih_saat).toLocaleDateString('tr-TR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })}
        </p>
      </div>

      {/* Detaylar */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">İşlem Detayları</h2>
        <Satir etiket="Giriş Fiyatı" deger={islem.giris_fiyati} />
        <Satir etiket="Çıkış Fiyatı" deger={islem.cikis_fiyati} />
        <Satir etiket="Breakeven" deger={islem.breakeven_fiyati} />
        <Satir
          etiket="PnL"
          deger={
            islem.pnl !== null ? (
              <span className={islem.pnl > 0 ? 'text-emerald-400' : islem.pnl < 0 ? 'text-red-400' : ''}>
                {islem.pnl > 0 ? '+' : ''}{islem.pnl}
              </span>
            ) : null
          }
        />
        <Satir etiket="Risk/Reward (RR)" deger={islem.rr_orani} />
        <Satir
          etiket="Hesap"
          deger={
            islem.hesap_turu ? (
              <span className={`rounded px-1.5 py-0.5 text-xs ${islem.hesap_turu === 'prop' ? 'bg-blue-900/60 text-blue-300' : 'bg-purple-900/60 text-purple-300'}`}>
                {islem.hesap_turu === 'prop' ? 'Prop Hesap' : 'Kendi Hesabım'}
              </span>
            ) : null
          }
        />
        <Satir etiket="Kaynak" deger={islem.kaynak === 'telegram' ? '📱 Telegram' : '🖥️ Dashboard'} />
      </div>

      {/* Chart görseli */}
      {islem.chart_gorseli_url && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Chart Görseli</h2>
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-800">
            <Image
              src={islem.chart_gorseli_url}
              alt="Chart görseli"
              fill
              className="object-contain"
            />
          </div>
          <a
            href={islem.chart_gorseli_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-gray-500 hover:text-gray-300"
          >
            Tam boyut görüntüle ↗
          </a>
        </div>
      )}

      {/* Notlar */}
      {islem.notlar && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Notlar</h2>
          <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{islem.notlar}</p>
        </div>
      )}

      {/* Koçluk soruları */}
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">AI Koçluk</h2>
          {kocluk.length === 0 && (
            <button
              onClick={koclukSorulariYukle}
              className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Analiz İste →
            </button>
          )}
        </div>
        {kocluk.length > 0 ? (
          <ul className="space-y-2">
            {kocluk.map((soru, i) => (
              <li key={i} className="text-sm text-gray-300 flex gap-2">
                <span className="text-emerald-500 font-bold shrink-0">{i + 1}.</span>
                <span>{soru}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 text-sm">
            &ldquo;Analiz İste&rdquo; butonuna tıklayarak bu işlem için AI koçluk soruları alabilirsiniz.
          </p>
        )}
      </div>

      {/* Silme onayı */}
      {silOnay && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold mb-2">Bu işlemi silmek istiyor musunuz?</h3>
            <p className="text-gray-400 text-sm mb-5">Bu işlem geri alınamaz.</p>
            <div className="flex gap-3">
              <button onClick={() => setSilOnay(false)} className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300">
                İptal
              </button>
              <button onClick={sil} className="flex-1 rounded-lg bg-red-600 py-2 text-sm text-white font-medium">
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Düzenleme formu */}
      {duzenleniyor && (
        <IslemFormu
          mevcutIslem={islem}
          onKapat={() => setDuzenleniyor(false)}
          onKayit={() => {
            setDuzenleniyor(false)
            fetch(`/api/islemler/${id}`).then((r) => r.json()).then(setIslem)
          }}
        />
      )}
    </div>
  )
}
