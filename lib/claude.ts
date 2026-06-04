import Anthropic from '@anthropic-ai/sdk'
import type { ParsedIslem, Islem } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PARSE_SYSTEM_PROMPT = `Sen bir trading asistanısın. Kullanıcının Türkçe trade mesajından alanları çıkar ve SADECE geçerli JSON döndür, başka hiçbir şey yazma, açıklama ekleme.

Döndüreceğin JSON formatı:
{
  "enstruman": string veya null,
  "yon": "long" veya "short" veya null,
  "giris_fiyati": sayı veya null,
  "cikis_fiyati": sayı veya null,
  "breakeven_fiyati": sayı veya null,
  "pnl": sayı veya null,
  "rr_orani": sayı veya null,
  "hesap_turu": "prop" veya "kendi" veya null,
  "notlar": string veya null
}

Kurallar:
- Bulamadığın alanı null bırak
- Fiyatları her zaman sayı olarak ver (2650 veya 2650.5)
- "prop hesap", "prop", "funded" → hesap_turu: "prop"
- "kendi hesabım", "personal", "kendi" → hesap_turu: "kendi"
- RR oranını sayı olarak ver (2RR → 2, "iki rr" → 2)
- Enstrümanı büyük harf yaz (xauusd → XAUUSD)`

export async function parseTradeMesaji(mesaj: string): Promise<ParsedIslem> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: PARSE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: mesaj }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text) as ParsedIslem
}

export async function getKoclukAnalizi(islemler: Islem[]): Promise<{ analiz: string; sorular: string[] }> {
  if (islemler.length === 0) {
    return {
      analiz: 'Henüz yeterli işlem verisi yok. İşlem girdikçe analiz yapılabilir.',
      sorular: [],
    }
  }

  const islemOzeti = islemler.slice(0, 20).map((i) => ({
    tarih: i.tarih_saat.split('T')[0],
    enstruman: i.enstruman,
    yon: i.yon,
    pnl: i.pnl,
    rr: i.rr_orani,
    hesap: i.hesap_turu,
  }))

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: `Sen deneyimli bir trading koçusun. Türkçe konuş. Trader'ın son işlemlerini analiz et ve yapıcı geri bildirim ver.`,
    messages: [
      {
        role: 'user',
        content: `Son işlemlerim:\n${JSON.stringify(islemOzeti, null, 2)}\n\nBu işlemleri analiz et. Güçlü yönlerimi, tekrar eden hataları ve geliştirebileceğim alanları söyle. Son olarak bana düşünmemi sağlayacak 3 soru sor.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  const sorularMatch = text.match(/\d+\.\s+.+\?/g) ?? []
  const sorular = sorularMatch.map((s) => s.replace(/^\d+\.\s+/, ''))

  return { analiz: text, sorular }
}

export async function getSonrasıSoruları(islem: Islem): Promise<string[]> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: `Sen bir trading koçusun. Trader'ın işlem sonrasında düşünmesini sağlayacak 3 kısa soru sor. Türkçe yaz. Sadece soruları listele, başka bir şey yazma.`,
    messages: [
      {
        role: 'user',
        content: `İşlem: ${islem.enstruman} ${islem.yon} | Giriş: ${islem.giris_fiyati} | Çıkış: ${islem.cikis_fiyati} | PnL: ${islem.pnl} | RR: ${islem.rr_orani}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0 && line.includes('?'))
    .slice(0, 3)
}
