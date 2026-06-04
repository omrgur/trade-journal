-- Trade Journal veritabanı şeması
-- Supabase SQL Editor'da çalıştırın

CREATE TABLE islemler (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tarih_saat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enstruman TEXT NOT NULL,
  yon TEXT NOT NULL CHECK (yon IN ('long', 'short')),
  giris_fiyati DECIMAL(12,5),
  cikis_fiyati DECIMAL(12,5),
  breakeven_fiyati DECIMAL(12,5),
  pnl DECIMAL(10,2),
  rr_orani DECIMAL(5,2),
  hesap_turu TEXT CHECK (hesap_turu IN ('prop', 'kendi')),
  chart_gorseli_url TEXT,
  notlar TEXT,
  kaynak TEXT DEFAULT 'dashboard' CHECK (kaynak IN ('telegram', 'dashboard')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER islemler_updated_at
  BEFORE UPDATE ON islemler
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sıralama için index
CREATE INDEX idx_islemler_tarih ON islemler(tarih_saat DESC);
CREATE INDEX idx_islemler_hesap ON islemler(hesap_turu);
