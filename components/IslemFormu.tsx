'use client'

import { useState, useRef } from 'react'
import type { Islem } from '@/lib/types'

interface Props {
  mevcutIslem?: Islem
  onKapat: () => void
  onKayit: () => void
}

const BOS_FORM = {
  enstruman: '',
  yon: 'long' as 'long' | 'short',
  giris_fiyati: '',
  cikis_fiyati: '',
  breakeven_fiyati: '',
  pnl: '',
  rr_orani: '',
  hesap_turu: '' as '' | 'prop' | 'kendi',
  notlar: '',
  tarih_saat: new Date().toISOString().slice(0, 16),
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-[#4b5471] mb-1.5 uppercase tracking-wider">{children}</label>
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-white/[0.08] bg-[#0d1019] px-3.5 py-2.5 text-sm text-white placeholder:text-[#2a3050] hover:border-white/[0.14] ${props.className ?? ''}`}
    />
  )
}

export default function IslemFormu({ mevcutIslem, onKapat, onKayit }: Props) {
  const [form, setForm] = useState(() => {
    if (!mevcutIslem) return BOS_FORM
    return {
      enstruman: mevcutIslem.enstruman,
      yon: mevcutIslem.yon,
      giris_fiyati: mevcutIslem.giris_fiyati?.toString() ?? '',
      cikis_fiyati: mevcutIslem.cikis_fiyati?.toString() ?? '',
      breakeven_fiyati: mevcutIslem.breakeven_fiyati?.toString() ?? '',
      pnl: mevcutIslem.pnl?.toString() ?? '',
      rr_orani: mevcutIslem.rr_orani?.toString() ?? '',
      hesap_turu: mevcutIslem.hesap_turu ?? ('' as ''),
      notlar: mevcutIslem.notlar ?? '',
      tarih_saat: mevcutIslem.tarih_saat.slice(0, 16),
    }
  })
  const [gorselUrl, setGorselUrl] = useState(mevcutIslem?.chart_gorseli_url ?? '')
  const [gorselYukleniyor, setGorselYukleniyor] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hata, setHata] = useState('')
  const [mesajParse, setMesajParse] = useState('')
  const [parseEdiliyor, setParseEdiliyor] = useState(false)
  const dosyaRef = useRef<HTMLInputElement>(null)

  function set(alan: keyof typeof BOS_FORM, deger: string) {
    setForm((f) => ({ ...f, [alan]: deger }))
  }

  async function gorselSec(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setGorselYukleniyor(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/gorsel-yukle', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) setGorselUrl(data.url)
    setGorselYukleniyor(false)
  }

  async function mesajdanDoldur() {
    if (!mesajParse.trim()) return
    setParseEdiliyor(true)
    const res = await fetch('/api/claude/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaj: mesajParse }),
    })
    const data = await res.json()
    setForm((f) => ({
      ...f,
      enstruman: data.enstruman ?? f.enstruman,
      yon: data.yon ?? f.yon,
      giris_fiyati: data.giris_fiyati?.toString() ?? f.giris_fiyati,
      cikis_fiyati: data.cikis_fiyati?.toString() ?? f.cikis_fiyati,
      breakeven_fiyati: data.breakeven_fiyati?.toString() ?? f.breakeven_fiyati,
      pnl: data.pnl?.toString() ?? f.pnl,
      rr_orani: data.rr_orani?.toString() ?? f.rr_orani,
      hesap_turu: data.hesap_turu ?? f.hesap_turu,
      notlar: data.notlar ?? f.notlar,
    }))
    setParseEdiliyor(false)
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault()
    if (!form.enstruman || !form.yon) { setHata('Enstrüman ve yön zorunludur.'); return }
    setKaydediliyor(true)
    setHata('')

    const body = {
      enstruman: form.enstruman,
      yon: form.yon,
      tarih_saat: new Date(form.tarih_saat).toISOString(),
      giris_fiyati: form.giris_fiyati ? parseFloat(form.giris_fiyati) : null,
      cikis_fiyati: form.cikis_fiyati ? parseFloat(form.cikis_fiyati) : null,
      breakeven_fiyati: form.breakeven_fiyati ? parseFloat(form.breakeven_fiyati) : null,
      pnl: form.pnl ? parseFloat(form.pnl) : null,
      rr_orani: form.rr_orani ? parseFloat(form.rr_orani) : null,
      hesap_turu: form.hesap_turu || null,
      chart_gorseli_url: gorselUrl || null,
      notlar: form.notlar || null,
      kaynak: 'dashboard',
    }

    const url = mevcutIslem ? `/api/islemler/${mevcutIslem.id}` : '/api/islemler'
    const method = mevcutIslem ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    if (res.ok) { onKayit() }
    else { const d = await res.json(); setHata(d.error ?? 'Bir hata oluştu') }
    setKaydediliyor(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#0f1320] border border-white/[0.08] rounded-2xl w-full max-w-lg my-8 shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-white">
            {mevcutIslem ? 'İşlemi Düzenle' : 'Yeni İşlem'}
          </h2>
          <button onClick={onKapat} className="text-[#4b5471] hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06]">
            ✕
          </button>
        </div>

        <form onSubmit={kaydet} className="px-6 py-5 space-y-5">
          {/* AI Parse */}
          {!mevcutIslem && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3.5">
              <p className="text-xs text-violet-400 mb-2.5 font-medium">✨ Metinden otomatik doldur</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="XAUUSD long 2650'den 2670'de çıktım, 2RR, prop hesap"
                  value={mesajParse}
                  onChange={(e) => setMesajParse(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), mesajdanDoldur())}
                  className="flex-1 rounded-lg bg-[#0a0d18] border border-white/[0.06] px-3 py-2 text-xs text-gray-300 placeholder:text-[#2a3050]"
                />
                <button
                  type="button"
                  onClick={mesajdanDoldur}
                  disabled={parseEdiliyor}
                  className="rounded-lg bg-violet-600/80 px-3 py-2 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50 whitespace-nowrap"
                >
                  {parseEdiliyor ? '...' : 'Doldur'}
                </button>
              </div>
            </div>
          )}

          {/* Enstrüman + Yön */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Enstrüman *</Label>
              <Input required placeholder="XAUUSD" value={form.enstruman} onChange={(e) => set('enstruman', e.target.value.toUpperCase())} />
            </div>
            <div>
              <Label>Yön *</Label>
              <div className="flex rounded-xl overflow-hidden border border-white/[0.08]">
                {(['long', 'short'] as const).map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => set('yon', y)}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                      form.yon === y
                        ? y === 'long' ? 'bg-[#00e5a0]/15 text-[#00e5a0]' : 'bg-[#ff4d6d]/15 text-[#ff4d6d]'
                        : 'bg-[#0d1019] text-[#4b5471] hover:text-white'
                    }`}
                  >
                    {y === 'long' ? '▲ Long' : '▼ Short'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tarih */}
          <div>
            <Label>Tarih & Saat</Label>
            <Input type="datetime-local" value={form.tarih_saat} onChange={(e) => set('tarih_saat', e.target.value)} />
          </div>

          {/* Fiyatlar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { alan: 'giris_fiyati' as const, label: 'Giriş' },
              { alan: 'cikis_fiyati' as const, label: 'Çıkış' },
              { alan: 'breakeven_fiyati' as const, label: 'Breakeven' },
            ].map(({ alan, label }) => (
              <div key={alan}>
                <Label>{label}</Label>
                <Input type="number" step="any" placeholder="0.00" value={form[alan]} onChange={(e) => set(alan, e.target.value)} />
              </div>
            ))}
          </div>

          {/* PnL + RR */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>PnL</Label>
              <Input type="number" step="any" placeholder="0.00" value={form.pnl} onChange={(e) => set('pnl', e.target.value)} />
            </div>
            <div>
              <Label>RR Oranı</Label>
              <Input type="number" step="0.1" placeholder="2.0" value={form.rr_orani} onChange={(e) => set('rr_orani', e.target.value)} />
            </div>
          </div>

          {/* Hesap türü */}
          <div>
            <Label>Hesap Türü</Label>
            <div className="flex rounded-xl overflow-hidden border border-white/[0.08]">
              {[
                { val: '' as const, label: 'Seçilmedi' },
                { val: 'prop' as const, label: 'Prop' },
                { val: 'kendi' as const, label: 'Kendi' },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => set('hesap_turu', val)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-all ${
                    form.hesap_turu === val
                      ? 'bg-violet-600/20 text-violet-300'
                      : 'bg-[#0d1019] text-[#4b5471] hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Görsel */}
          <div>
            <Label>Chart Görseli</Label>
            <input type="file" accept="image/*" ref={dosyaRef} onChange={gorselSec} className="hidden" />
            {gorselUrl ? (
              <div className="flex items-center gap-2 rounded-xl border border-[#00e5a0]/20 bg-[#00e5a0]/5 px-4 py-2.5">
                <span className="text-[#00e5a0] text-xs flex-1">✓ Görsel yüklendi</span>
                <button type="button" onClick={() => setGorselUrl('')} className="text-[#4b5471] hover:text-red-400 text-xs">Kaldır</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => dosyaRef.current?.click()}
                disabled={gorselYukleniyor}
                className="w-full rounded-xl border border-dashed border-white/[0.08] px-4 py-3.5 text-sm text-[#4b5471] hover:text-white hover:border-white/[0.2] disabled:opacity-50 text-center"
              >
                {gorselYukleniyor ? 'Yükleniyor...' : '📎  Görsel Seç (PNG, JPG)'}
              </button>
            )}
          </div>

          {/* Notlar */}
          <div>
            <Label>Notlar</Label>
            <textarea
              rows={3}
              placeholder="İşlemle ilgili notlarınız..."
              value={form.notlar}
              onChange={(e) => set('notlar', e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-[#0d1019] px-3.5 py-2.5 text-sm text-white placeholder:text-[#2a3050] resize-none hover:border-white/[0.14]"
            />
          </div>

          {hata && <p className="text-[#ff4d6d] text-sm">{hata}</p>}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onKapat}
              className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm text-[#4b5471] hover:text-white hover:border-white/[0.16]"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={kaydediliyor}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-2.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 shadow-lg shadow-violet-500/20"
            >
              {kaydediliyor ? 'Kaydediliyor...' : mevcutIslem ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
