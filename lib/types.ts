export type Yon = 'long' | 'short'
export type HesapTuru = 'prop' | 'kendi'
export type Kaynak = 'telegram' | 'dashboard'

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
  hesap_turu: HesapTuru | null
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
  hesap_turu: HesapTuru | null
  notlar: string | null
}
