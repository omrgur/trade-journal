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
    if (!form.enstruman || !form.yon) {
      setHata('Enstrüman ve yön zorunludur.')
      return
    }
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

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      onKayit()
    } else {
      const d = await res.json()
      setHata(d.error ?? 'Bir hata oluştu')
    }
    setKaydediliyor(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="font-semibold text-white">
            {mevcutIslem ? 'İşlemi Düzenle' : 'Yeni İşlem Ekle'}
          </h2>
          <button onClick={onKapat} className="text-gray-500 hover:text-white">✕</button>
        </div>

        <form onSubmit={kaydet} className="p-5 space-y-4">
          {/* Mesajdan parse */}
          {!mevcutIslem && (
            <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-3">
              <p className="text-xs text-gray-400 mb-2">Telegram tarzı mesaj yazarak formu otomatik doldur:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="XAUUSD long 2650'den 2670'de çıktım, 2RR, prop hesap"
                  value={mesajParse}
                  onChange={(e) => setMesajParse(e.target.value)}
                  className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
                />
                <button
                  type="button"
                  onClick={mesajdanDoldur}
                  disabled={parseEdiliyor}
                  className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600 disabled:opacity-50"
                >
                  {parseEdiliyor ? '...' : 'Doldur'}
                </button>
              </div>
            </div>
          )}

          {/* Enstrüman + Yön */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Enstrüman *</label>
              <input
                type="text"
                required
                placeholder="XAUUSD"
                value={form.enstruman}
                onChange={(e) => set('enstruman', e.target.value.toUpperCase())}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white uppercase"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Yön *</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-700">
                <button
                  type="button"
                  onClick={() => set('yon', 'long')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${form.yon === 'long' ? 'bg-emerald-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  Long
                </button>
                <button
                  type="button"
                  onClick={() => set('yon', 'short')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${form.yon === 'short' ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  Short
                </button>
              </div>
            </div>
          </div>

          {/* Tarih */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tarih & Saat</label>
            <input
              type="datetime-local"
              value={form.tarih_saat}
              onChange={(e) => set('tarih_saat', e.target.value)}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
            />
          </div>

          {/* Fiyatlar */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { alan: 'giris_fiyati' as const, etiket: 'Giriş Fiyatı' },
              { alan: 'cikis_fiyati' as const, etiket: 'Çıkış Fiyatı' },
              { alan: 'breakeven_fiyati' as const, etiket: 'Breakeven' },
            ].map(({ alan, etiket }) => (
              <div key={alan}>
                <label className="block text-xs text-gray-400 mb-1">{etiket}</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={form[alan]}
                  onChange={(e) => set(alan, e.target.value)}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>
            ))}
          </div>

          {/* PnL + RR */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">PnL</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={form.pnl}
                onChange={(e) => set('pnl', e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">RR Oranı</label>
              <input
                type="number"
                step="0.1"
                placeholder="2.0"
                value={form.rr_orani}
                onChange={(e) => set('rr_orani', e.target.value)}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {/* Hesap türü */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hesap Türü</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              {[
                { val: '', label: 'Seçilmedi' },
                { val: 'prop', label: 'Prop Hesap' },
                { val: 'kendi', label: 'Kendi' },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => set('hesap_turu', val)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${form.hesap_turu === val ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Görsel yükle */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Chart Görseli</label>
            <input type="file" accept="image/*" ref={dosyaRef} onChange={gorselSec} className="hidden" />
            {gorselUrl ? (
              <div className="flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2">
                <span className="text-emerald-400 text-xs flex-1 truncate">✓ Görsel yüklendi</span>
                <button type="button" onClick={() => setGorselUrl('')} className="text-gray-500 hover:text-red-400 text-xs">
                  Kaldır
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => dosyaRef.current?.click()}
                disabled={gorselYukleniyor}
                className="w-full rounded-lg bg-gray-800 border border-dashed border-gray-600 px-3 py-3 text-sm text-gray-400 hover:text-white hover:border-gray-400 transition-colors disabled:opacity-50"
              >
                {gorselYukleniyor ? 'Yükleniyor...' : '📎 Görsel Seç (PNG, JPG)'}
              </button>
            )}
          </div>

          {/* Notlar */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notlar</label>
            <textarea
              rows={3}
              placeholder="İşlemle ilgili notlarınız..."
              value={form.notlar}
              onChange={(e) => set('notlar', e.target.value)}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-600 resize-none"
            />
          </div>

          {hata && <p className="text-red-400 text-sm">{hata}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onKapat}
              className="flex-1 rounded-lg border border-gray-700 py-2.5 text-sm text-gray-300 hover:text-white"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={kaydediliyor}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {kaydediliyor ? 'Kaydediliyor...' : mevcutIslem ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
