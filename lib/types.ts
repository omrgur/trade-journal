export type Yon = 'long' | 'short'
export type HesapKategori = 'kendi' | 'challenge' | 'funded'
export type Kaynak = 'telegram' | 'dashboard'

export interface Hesap {
  id: string
  isim: string
  firma: string | null
  kategori: HesapKategori
  renk: string
  aktif: boolean
  created_at: string
}

export interface Islem {
  id: string
  tarih_saat: string
  enstruman: string
  yon: Yon
  giris_fiyati: number | null
  cikis_fiyati: number | null
  breakeven_fiyati: number | null
  pnl: number | null
  rr_orani: number | null
  hesap_turu: string | null
  hesap_idleri: string[]
  chart_gorseli_url: string | null
  notlar: string | null
  kaynak: Kaynak
  created_at: string
  updated_at: string
}

export type YeniIslem = Omit<Islem, 'id' | 'created_at' | 'updated_at'>

export interface ParsedIslem {
  enstruman: string | null
  yon: Yon | null
  giris_fiyati: number | null
  cikis_fiyati: number | null
  breakeven_fiyati: number | null
  pnl: number | null
  rr_orani: number | null
  hesap_isimleri: string[]
  notlar: string | null
}
