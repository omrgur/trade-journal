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
  "hesap_isimleri": string[],
  "notlar": string veya null
}

Kurallar:
- Fiyatları sayı olarak ver (2650.5)
- RR'yi sayı olarak ver (2RR → 2, 1.5RR → 1.5)
- PnL'i sayı olarak ver: "250 dolar" → 250 | "-150 dolar" → -150 | "zarar 100" → -100 | "kâr 200" → 200
- Enstrümanı normalize et:
    NASDAQ / US100 / NAS100 / Nasdaq → NAS100
    GOLD / XAUUSD / XAU / altın → XAUUSD
    DOW / US30 / DJ30 → US30
    SP500 / SPX / S&P500 → SPX500
    Diğer → büyük harfe çevir (EURUSD, GBPUSD, BTCUSD vb.)
- Eğer mesaj "PAR​ITE: X YÖN: Y PNL: Z" gibi etiketli formattaysa etiketleri yok say, değerleri çıkar:
    "PARITE: NASDAQ YÖN: LONG PNL: 250 DOLAR" → {enstruman: "NAS100", yon: "long", pnl: 250}
- hesap_isimleri: mesajda geçen hesap adlarını aynen yaz. Örnekler:
    "kendi bakiyemde" → ["kendi bakiyem"]
    "$10k challenge hesabımda" → ["$10k challenge"]
    "funded hesabımda" → ["funded hesap"]`

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

type GorselKaynak =
  | { base64: string; mediaType: string }
  | { url: string }

export async function gorseldenIslemCikar(gorsel: GorselKaynak, caption?: string): Promise<ParsedIslem> {
  const imageSource = 'base64' in gorsel
    ? { type: 'base64' as const, media_type: gorsel.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: gorsel.base64 }
    : { type: 'url' as const, url: gorsel.url }

  const metinKismi = `Bu bir TradingView chart görseli. Aşağıdakileri bul ve JSON döndür:

1. ENSTRÜMAN: Sol üst köşede veya başlıkta yazar (NAS100, XAUUSD, EURUSD, US30 vb). Göremiyorsan null yaz.
2. YÖN: Entry marker, ok veya pozisyon kutusu long mu short mu? Emin değilsen null yaz.
3. GİRİŞ FİYATI: Entry seviyesi yatay çizgide veya etikette yazıyorsa.
4. ÇIKIŞ FİYATI: TP (Take Profit) çizgisi veya etiketi varsa.
5. STOP LOSS: SL çizgisi veya etiketi varsa giris_fiyati değil, notlar alanına "SL: X" formatında ekle.
6. PnL / RR: Chart veya strateji panelinde yazıyorsa.
${caption ? `\nKullanıcının notu: "${caption}"` : ''}

ÖNEMLİ: Göremediğin alanları null yaz, tahmin etme.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: PARSE_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: imageSource },
        { type: 'text', text: metinKismi },
      ],
    }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}'
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed.hesap_isimleri)) parsed.hesap_isimleri = []
    return parsed as ParsedIslem
  } catch {
    return { enstruman: null, yon: null, giris_fiyati: null, cikis_fiyati: null, breakeven_fiyati: null, pnl: null, rr_orani: null, hesap_isimleri: [], notlar: caption ?? null }
  }
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
