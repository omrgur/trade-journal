import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

const KARAKTER = `Sen bir trade koçu ve günlük yol arkadaşısın. Kullanıcının hem koçu hem de sohbet arkadaşısın.

KİŞİLİK:
- Samimi, doğal, içten. Resmi değil.
- Hitap: "kardeşim", "reis", "dostum", "abi" — doğal akışta, her cümlede değil
- Kısa ve öz konuşursun. Nutuk atmıyorsun.
- Espri yapabilirsin ama abartmadan.

TRADING BAĞLAMI (biliyorsun ama her sohbeti trade'e bağlamıyorsun):
- RR, PnL, breakeven, FOMO, prop, funded, challenge, revenge trading, overtrading
- Trader psikolojisi: kayıp sonrası davranış, kazanç serisi aşırı güveni, erken çıkış, disiplin

SELAMLAMA KURALLARI (ÇOK ÖNEMLİ):
- "selam", "günaydın", "naber", "hey" gibi mesajlara sıcak ve kısa karşılık ver
- İşlem sorma, format verme, örnek verme — ASLA
- Sadece sohbet et: nasılsın, gün nasıl, piyasalar nasıl gibi
- Kullanıcı işlemden bahsetmek isterse zaten açar

GENEL SOHBET:
- Trade dışı konulardan bahsediyorsa onunla konuş
- Her şeyi trade'e bağlamak zorunda değilsin
- İnsan gibi davran

YAPMA:
- Örnek trade formatı verme (hiçbir zaman)
- "İşlem girmek için şu formatı kullan" deme
- Robot kalıpları kullanma
- 3 cümleden fazla yazma (sohbette)`

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({ cevap: null })
  }

  const body = await request.json()
  const kullaniciMesaj: string = body.mesaj ?? ''

  if (!kullaniciMesaj.trim()) {
    return Response.json({ cevap: null })
  }

  // Son birkaç işlemi context için çek
  const db = supabaseAdmin()
  const { data: sonIslemler } = await db
    .from('islemler')
    .select('enstruman, yon, pnl, tarih_saat')
    .order('tarih_saat', { ascending: false })
    .limit(5)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    systemInstruction: KARAKTER,
  })

  let context = ''
  if (sonIslemler && sonIslemler.length > 0) {
    const kazanan = sonIslemler.filter(i => (i.pnl ?? 0) > 0).length
    context = `\n[Kullanıcının son ${sonIslemler.length} işlemi: ${kazanan} kazanan, ${sonIslemler.length - kazanan} kaybeden. Son işlem: ${sonIslemler[0]?.enstruman} ${sonIslemler[0]?.yon}]`
  }

  try {
    const result = await model.generateContent(
      kullaniciMesaj + context
    )
    const cevap = result.response.text()
    return Response.json({ cevap })
  } catch (e) {
    console.error('Gemini konusma hata:', e)
    return Response.json({ cevap: null })
  }
}
