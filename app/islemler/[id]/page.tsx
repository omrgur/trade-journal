'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Islem } from '@/lib/types'
import IslemFormu from '@/components/IslemFormu'

function Satir({ etiket, deger, renk }: { etiket: string; deger: React.ReactNode; renk?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#f0f2f8] last:border-0">
      <span className="text-xs font-medium text-[#8892a4] uppercase tracking-wider">{etiket}</span>
      <span className={`text-sm font-medium text-right ${renk ?? 'text-[#0f1117]'}`}>
        {deger ?? <span className="text-[#b8c0cc]">—</span>}
      </span>
    </div>
  )
}

function PnlDeger({ pnl }: { pnl: number | null }) {
  if (pnl === null) return <span className="text-[#b8c0cc]">—</span>
  const pos = pnl > 0
  return (
    <span className={`font-bold tabular-nums ${pos ? 'text-[#059669]' : pnl < 0 ? 'text-[#dc2626]' : 'text-[#8892a4]'}`}>
      {pos ? '+' : ''}{pnl}
    </span>
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
  const [koclukYukleniyor, setKoclukYukleniyor] = useState(false)

  useEffect(() => {
    fetch(`/api/islemler/${id}`)
      .then((r) => r.json())
      .then((data) => { setIslem(data); setYukleniyor(false) })
      .catch(() => setYukleniyor(false))
  }, [id])

  async function sil() {
    await fetch(`/api/islemler/${id}`, { method: 'DELETE' })
    router.push('/islemler')
  }

  async function koclukYukle() {
    if (!islem) return
    setKoclukYukleniyor(true)
    const res = await fetch('/api/claude/kocluk')
    const data = await res.json()
    setKocluk(data.sorular ?? [])
    setKoclukYukleniyor(false)
  }

  if (yukleniyor) return (
    <div className="flex items-center justify-center py-24">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5b50e8] border-t-transparent" />
    </div>
  )
  if (!islem) return (
    <div className="text-center py-16 text-[#8892a4]">İşlem bulunamadı</div>
  )

  const tarihStr = new Date(islem.tarih_saat).toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="max-w-2xl mx-auto">
      {/* Üst bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/islemler" className="flex items-center gap-1.5 text-sm text-[#8892a4] hover:text-[#0f1117] transition-colors">
          ← İşlemlere Dön
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => setDuzenleniyor(true)}
            className="rounded-xl border border-[#e4e8f0] px-3.5 py-1.5 text-sm text-[#8892a4] hover:text-[#0f1117] hover:border-[#c8d0e4] transition-colors"
          >
            Düzenle
          </button>
          <button
            onClick={() => setSilOnay(true)}
            className="rounded-xl border border-[#fecaca] px-3.5 py-1.5 text-sm text-[#dc2626] hover:bg-[#fef2f2] transition-colors"
          >
            Sil
          </button>
        </div>
      </div>

      {/* Başlık kartı */}
      <div className="card mb-4 rounded-2xl border border-[#e4e8f0] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0f1117] tracking-tight">{islem.enstruman}</h1>
            <p className="text-sm text-[#8892a4] mt-0.5">{tarihStr}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {islem.kaynak === 'telegram'
              ? <span className="text-xs text-[#b8c0cc] border border-[#e4e8f0] rounded-full px-2 py-0.5">📱 Telegram</span>
              : <span className="text-xs text-[#b8c0cc] border border-[#e4e8f0] rounded-full px-2 py-0.5">🖥️ Dashboard</span>
            }
            {islem.yon === 'long'
              ? <span className="badge-long rounded-lg px-3 py-1 text-sm font-bold">LONG</span>
              : <span className="badge-short rounded-lg px-3 py-1 text-sm font-bold">SHORT</span>
            }
          </div>
        </div>

        {/* Özet rakamlar */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#f8f9fc] p-3 text-center">
            <p className="text-xs text-[#8892a4] mb-1">PnL</p>
            <PnlDeger pnl={islem.pnl} />
          </div>
          <div className="rounded-xl bg-[#f8f9fc] p-3 text-center">
            <p className="text-xs text-[#8892a4] mb-1">RR</p>
            <p className="text-sm font-bold text-[#0f1117]">
              {islem.rr_orani ? `${islem.rr_orani}R` : <span className="text-[#b8c0cc]">—</span>}
            </p>
          </div>
          <div className="rounded-xl bg-[#f8f9fc] p-3 text-center">
            <p className="text-xs text-[#8892a4] mb-1">Sonuç</p>
            <p className="text-sm font-bold">
              {islem.pnl === null
                ? <span className="text-[#b8c0cc]">—</span>
                : islem.pnl > 0
                  ? <span className="text-[#059669]">Kazanç</span>
                  : islem.pnl < 0
                    ? <span className="text-[#dc2626]">Kayıp</span>
                    : <span className="text-[#8892a4]">Başabaş</span>
              }
            </p>
          </div>
        </div>
      </div>

      {/* Detaylar */}
      <div className="card mb-4 rounded-2xl border border-[#e4e8f0] bg-white p-5">
        <p className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-1">İşlem Detayları</p>
        <Satir etiket="Giriş Fiyatı" deger={islem.giris_fiyati} />
        <Satir etiket="Çıkış Fiyatı" deger={islem.cikis_fiyati} />
        <Satir etiket="Breakeven" deger={islem.breakeven_fiyati} />
        <Satir
          etiket="PnL"
          deger={<PnlDeger pnl={islem.pnl} />}
        />
        <Satir
          etiket="Risk / Reward"
          deger={islem.rr_orani ? `${islem.rr_orani}R` : null}
        />
      </div>

      {/* Chart görseli */}
      {islem.chart_gorseli_url && (
        <div className="card mb-4 rounded-2xl border border-[#e4e8f0] bg-white p-5">
          <p className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-3">Chart Görseli</p>
          <div className="relative w-full rounded-xl overflow-hidden bg-[#f8f9fc]" style={{ aspectRatio: '16/9' }}>
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
            className="mt-2 inline-flex items-center gap-1 text-xs text-[#8892a4] hover:text-[#5b50e8] transition-colors"
          >
            Tam boyut ↗
          </a>
        </div>
      )}

      {/* Notlar */}
      {islem.notlar && (
        <div className="card mb-4 rounded-2xl border border-[#e4e8f0] bg-white p-5">
          <p className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-3">Notlar</p>
          <p className="text-sm text-[#0f1117] whitespace-pre-wrap leading-relaxed">{islem.notlar}</p>
        </div>
      )}

      {/* AI Koçluk */}
      <div className="card mb-4 rounded-2xl border border-[#e4e8f0] bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider">AI Koçluk</p>
          {kocluk.length === 0 && (
            <button
              onClick={koclukYukle}
              disabled={koclukYukleniyor}
              className="text-xs font-medium text-[#5b50e8] hover:text-[#4a40d4] disabled:opacity-50 transition-colors"
            >
              {koclukYukleniyor ? 'Analiz ediliyor...' : 'Analiz İste →'}
            </button>
          )}
        </div>
        {kocluk.length > 0 ? (
          <ul className="space-y-2.5">
            {kocluk.map((soru, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <span className="text-[#5b50e8] font-bold shrink-0 mt-0.5">{i + 1}.</span>
                <span className="text-[#0f1117]">{soru}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#b8c0cc]">
            Bu işlem için AI koçluk soruları almak için &ldquo;Analiz İste&rdquo; butonuna tıkla.
          </p>
        )}
      </div>

      {/* Silme onayı */}
      {silOnay && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#e4e8f0] rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-black/10">
            <h3 className="font-semibold text-[#0f1117] mb-1">Bu işlemi silmek istediğinden emin misin?</h3>
            <p className="text-sm text-[#8892a4] mb-5">Bu işlem geri alınamaz.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setSilOnay(false)}
                className="flex-1 rounded-xl border border-[#e4e8f0] py-2.5 text-sm text-[#8892a4] hover:text-[#0f1117]"
              >
                İptal
              </button>
              <button
                onClick={sil}
                className="flex-1 rounded-xl bg-[#dc2626] py-2.5 text-sm font-semibold text-white hover:bg-[#b91c1c]"
              >
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
