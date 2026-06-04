import Anthropic from '@anthropic-ai/sdk'
import type { ParsedIslem, Islem } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PARSE_SYSTEM_PROMPT = `Sen bir trading asistanısın. Kullanıcının Türkçe trade mesajından alanları çıkar ve SADECE geçerli JSON döndür, başka hiçbir şey yazma.

{
  "enstruman": string veya null,
  "yon": "long" veya "short" veya null,
  "giris_fiyati": sayı veya null,
  "cikis_fiyati": sayı veya null,
  "breakeven_fiyati": sayı veya null,
  "pnl": sayı veya null,
  "rr_orani": sayı veya null,
  "hesap_isimleri": string[] (mesajda bahsedilen hesap adları veya boş array),
  "notlar": string veya null
}

Kurallar:
- Fiyatları sayı olarak ver (2650.5)
- RR'yi sayı olarak ver (2RR → 2)
- Enstrümanı büyük harf yaz (xauusd → XAUUSD)
- hesap_isimleri: mesajda geçen hesap adlarını aynen yaz. Örnekler:
  "kendi bakiyemde" → ["kendi bakiyem"]
  "hem kendi hem de $10k challenge hesabımda" → ["kendi bakiyem", "$10k challenge"]
  "funded hesabımda" → ["funded hesap"]
  "faz 1 hesabımda" → ["faz 1"]
  "prop hesap" → ["prop hesap"]`

export async function parseTradeMesaji(mesaj: string): Promise<ParsedIslem> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: PARSE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: mesaj }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed.hesap_isimleri)) parsed.hesap_isimleri = []
  return parsed as ParsedIslem
}

export async function getSonrasıSoruları(islem: Islem): Promise<string[]> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: `Trading koçusun. Bu işlem için düşündürücü 3 kısa soru sor. Sadece soruları listele, başka bir şey yazma. Türkçe.`,
    messages: [{
      role: 'user',
      content: `${islem.enstruman} ${islem.yon} | Giriş: ${islem.giris_fiyati} | Çıkış: ${islem.cikis_fiyati} | PnL: ${islem.pnl} | RR: ${islem.rr_orani}`,
    }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return text.split('\n').filter((l) => l.trim().length > 0 && l.includes('?')).slice(0, 3)
}
