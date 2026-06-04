'use client'

import { useEffect, useState } from 'react'
import type { Hesap, HesapKategori } from '@/lib/types'

const KATEGORİ_ETİKET: Record<HesapKategori, string> = {
  kendi: 'Kendi Bakiye',
  challenge: 'Challenge / Faz',
  funded: 'Funded',
}

const KATEGORİ_RENK: Record<HesapKategori, string> = {
  kendi: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  funded: 'bg-blue-50 text-blue-700 border-blue-200',
  challenge: 'bg-amber-50 text-amber-700 border-amber-200',
}

const KATEGORİ_ACIKLAMA: Record<HesapKategori, string> = {
  kendi: 'Gerçek para — kâr doğrudan cebe girer',
  funded: 'Geçilmiş fon hesabı — kâr paylaşımlı gerçek para',
  challenge: 'Değerlendirme/faz aşaması — simüle para',
}

const BOS_FORM = { isim: '', firma: '', kategori: 'challenge' as HesapKategori }

export default function HesaplarPage() {
  const [hesaplar, setHesaplar] = useState<Hesap[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [formAcik, setFormAcik] = useState(false)
  const [duzenle, setDuzenle] = useState<Hesap | null>(null)
  const [form, setForm] = useState(BOS_FORM)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hata, setHata] = useState('')

  const yukle = async () => {
    setYukleniyor(true)
    const res = await fetch('/api/hesaplar')
    const data = await res.json()
    setHesaplar(Array.isArray(data) ? data : [])
    setYukleniyor(false)
  }

  useEffect(() => { yukle() }, [])

  function acForm(hesap?: Hesap) {
    if (hesap) {
      setDuzenle(hesap)
      setForm({ isim: hesap.isim, firma: hesap.firma ?? '', kategori: hesap.kategori })
    } else {
      setDuzenle(null)
      setForm(BOS_FORM)
    }
    setHata('')
    setFormAcik(true)
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault()
    if (!form.isim) { setHata('Hesap adı zorunludur.'); return }
    setKaydediliyor(true)

    const body = { isim: form.isim, firma: form.firma || null, kategori: form.kategori }
    const url = duzenle ? `/api/hesaplar/${duzenle.id}` : '/api/hesaplar'
    const method = duzenle ? 'PUT' : 'POST'

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      setFormAcik(false)
      yukle()
    } else {
      const d = await res.json()
      setHata(d.error ?? 'Hata')
    }
    setKaydediliyor(false)
  }

  async function sil(id: string) {
    if (!confirm('Bu hesabı silmek istediğinizden emin misiniz?')) return
    await fetch(`/api/hesaplar/${id}`, { method: 'DELETE' })
    yukle()
  }

  async function toggleAktif(hesap: Hesap) {
    await fetch(`/api/hesaplar/${hesap.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: !hesap.aktif }),
    })
    yukle()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[#0f1117]">Hesaplar</h1>
          <p className="text-xs text-[#8892a4] mt-0.5">Telegram bot işlemleri otomatik eşleştirir</p>
        </div>
        <button
          onClick={() => acForm()}
          className="flex items-center gap-1.5 rounded-xl bg-[#5b50e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a40d4] shadow-sm"
        >
          + Yeni Hesap
        </button>
      </div>

      {/* Kategori açıklaması */}
      <div className="mb-6 rounded-xl border border-[#e4e8f0] bg-[#f8f9fc] p-4 space-y-2">
        <p className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-2">Para Gerçek Mi?</p>
        {Object.entries(KATEGORİ_ACIKLAMA).map(([kat, aciklama]) => (
          <div key={kat} className="flex items-start gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium border shrink-0 ${KATEGORİ_RENK[kat as HesapKategori]}`}>
              {KATEGORİ_ETİKET[kat as HesapKategori]}
            </span>
            <span className="text-xs text-[#8892a4]">{aciklama}</span>
          </div>
        ))}
      </div>

      {yukleniyor ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5b50e8] border-t-transparent" />
        </div>
      ) : hesaplar.length === 0 ? (
        <div className="card rounded-2xl border border-[#e4e8f0] bg-white py-16 text-center">
          <p className="text-2xl mb-3">🏦</p>
          <p className="font-medium text-[#0f1117] mb-1">Henüz hesap yok</p>
          <p className="text-sm text-[#8892a4]">Hesap ekleyince Telegram bot otomatik eşleştirir.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hesaplar.map((hesap) => (
            <div key={hesap.id} className={`card rounded-2xl border bg-white p-4 flex items-center gap-4 ${!hesap.aktif ? 'opacity-50' : 'border-[#e4e8f0]'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[#0f1117] text-sm">{hesap.isim}</span>
                  <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium border ${KATEGORİ_RENK[hesap.kategori]}`}>
                    {KATEGORİ_ETİKET[hesap.kategori]}
                  </span>
                  {!hesap.aktif && <span className="text-xs text-[#b8c0cc]">Pasif</span>}
                </div>
                {hesap.firma && <p className="text-xs text-[#8892a4]">{hesap.firma}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleAktif(hesap)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f4f6fb] text-[#b8c0cc] hover:text-[#8892a4] text-xs"
                  title={hesap.aktif ? 'Pasife al' : 'Aktife al'}
                >
                  {hesap.aktif ? '⏸' : '▶'}
                </button>
                <button
                  onClick={() => acForm(hesap)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f4f6fb] text-[#b8c0cc] hover:text-[#0f1117] text-xs"
                >
                  ✏️
                </button>
                <button
                  onClick={() => sil(hesap.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#fef2f2] text-[#b8c0cc] hover:text-[#dc2626] text-xs"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {formAcik && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#e4e8f0] rounded-2xl w-full max-w-md shadow-2xl shadow-black/10">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f2f8]">
              <h2 className="font-semibold text-[#0f1117]">{duzenle ? 'Hesabı Düzenle' : 'Yeni Hesap'}</h2>
              <button onClick={() => setFormAcik(false)} className="text-[#b8c0cc] hover:text-[#0f1117] w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f4f6fb] text-sm">✕</button>
            </div>
            <form onSubmit={kaydet} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8892a4] mb-1.5 uppercase tracking-wider">Hesap Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="ör: $10k Challenge, Kendi Bakiyem, FTMO Funded"
                  value={form.isim}
                  onChange={(e) => setForm((f) => ({ ...f, isim: e.target.value }))}
                  className="w-full rounded-xl border border-[#e4e8f0] bg-white px-3.5 py-2.5 text-sm text-[#0f1117] placeholder:text-[#b8c0cc]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8892a4] mb-1.5 uppercase tracking-wider">Firma (opsiyonel)</label>
                <input
                  type="text"
                  placeholder="ör: FTMO, MyForexFunds, The5ers"
                  value={form.firma}
                  onChange={(e) => setForm((f) => ({ ...f, firma: e.target.value }))}
                  className="w-full rounded-xl border border-[#e4e8f0] bg-white px-3.5 py-2.5 text-sm text-[#0f1117] placeholder:text-[#b8c0cc]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#8892a4] mb-1.5 uppercase tracking-wider">Kategori *</label>
                <div className="space-y-2">
                  {(Object.entries(KATEGORİ_ETİKET) as [HesapKategori, string][]).map(([kat, etiket]) => (
                    <label key={kat} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${form.kategori === kat ? 'border-[#5b50e8] bg-[#f0effd]' : 'border-[#e4e8f0] hover:border-[#c8d0e4]'}`}>
                      <input type="radio" name="kategori" value={kat} checked={form.kategori === kat} onChange={() => setForm((f) => ({ ...f, kategori: kat }))} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-[#0f1117]">{etiket}</p>
                        <p className="text-xs text-[#8892a4]">{KATEGORİ_ACIKLAMA[kat]}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {hata && <p className="text-[#dc2626] text-sm">{hata}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setFormAcik(false)} className="flex-1 rounded-xl border border-[#e4e8f0] py-2.5 text-sm text-[#8892a4] hover:text-[#0f1117]">İptal</button>
                <button type="submit" disabled={kaydediliyor} className="flex-1 rounded-xl bg-[#5b50e8] py-2.5 text-sm font-semibold text-white hover:bg-[#4a40d4] disabled:opacity-50">
                  {kaydediliyor ? 'Kaydediliyor...' : duzenle ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
