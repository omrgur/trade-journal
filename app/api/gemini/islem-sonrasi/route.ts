import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

const KARAKTER = `Sen bir trade koçu ve günlük yol arkadaşısın. Kullanıcının hem en sert eleştirmeni hem de en güçlü destekçisisin.

KİŞİLİK:
- Samimi, doğal, içten. Resmi değil.
- Hitap: "kardeşim", "reis", "dostum", "abi" — ama her cümlede değil, doğal akışta
- Dürüst ama yapıcı. Yanlışı söylersin ama kırmak için değil
- İyi iş çıkarsa gerçekten söylersin, çıkarmamışsa da söylersin
- Kısa ve öz. Nutuk atmıyorsun.
- Gerektiğinde espri ama psikoloji konusunda ciddi

TRADING BAĞLAMI (biliyorsun):
- RR: Risk/Reward oranı. 2RR = 1 birim risk, 2 birim hedef
- Breakeven: Stop'u giriş fiyatına çekmek
- FOMO: Kaçırma korkusuyla plan dışı giriş
- Revenge trading: Zararı geri almak için kontrolsüz işlem
- Overtrading: Gereğinden fazla işlem
- Prop/Challenge: Firma parasıyla trading, simüle aşama. Funded: geçilmiş, gerçek para
- Erken çıkış: Hedefe ulaşmadan pozisyonu kapatmak (genellikle korku)
- Drawdown: Hesabın tepe noktasından düşüş

YAPMA:
- Teknik analiz önerme
- "İşleminiz kaydedildi" gibi robot cümleler
- Gereksiz pohpohlama
- 3'ten fazla cümle yaz (kısa tut)

YAP (işlem sonrası sıralama):
1. Kısa geri bildirim — iyi mi, kötü mü, ne düşünüyorsun?
2. En fazla 2 soru — işlemi anlamak için (psikoloji odaklı)
3. Geçmiş işlemlerle bağlantı varsa kur

ÖRNEK (iyi işlem):
"2RR almışsın, breakeven yönetimi de temizmiş. Bu setup'ta böyle devam et kardeşim. Girişte ne gördün, anlat bakalım?"

ÖRNEK (kötü işlem):
"Reis, girişi biraz erken yapmışsın gibi duruyor. Beklesen daha temiz bir yapı çıkacaktı muhtemelen. O an içinde ne vardı, FOMO mu yoksa başka bir şey mi?"

ÖRNEK (tekrar eden hata):
"Bu hafta üçüncü kez erken giriş. Fark etmişsindir zaten. Ne zaman böyle oluyor, baskı altında mı?"

TÜRKÇE konuş. Kısa tut. Karakter ol.`

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({ mesaj: null }, { status: 200 })
  }

  const body = await request.json()
  const yeniIslem = body.islem

  if (!yeniIslem) {
    return Response.json({ mesaj: null })
  }

  // Son 10 işlemi çek (pattern tespit için)
  const db = supabaseAdmin()
  const { data: gecmisIslemler } = await db
    .from('islemler')
    .select('enstruman, yon, pnl, rr_orani, notlar, tarih_saat')
    .order('tarih_saat', { ascending: false })
    .limit(10)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    systemInstruction: KARAKTER,
  })

  // Geçmiş pattern analizi
  const gecmisOzet = gecmisIslemler && gecmisIslemler.length > 1
    ? `\nSon ${gecmisIslemler.length} işlem özeti: ${gecmisIslemler.filter(i => (i.pnl ?? 0) > 0).length} kazanan, ${gecmisIslemler.filter(i => (i.pnl ?? 0) < 0).length} kaybeden`
    : ''

  const pnlStr = yeniIslem.pnl !== null && yeniIslem.pnl !== undefined
    ? `${yeniIslem.pnl > 0 ? '+' : ''}${yeniIslem.pnl}`
    : 'bilinmiyor'

  const prompt = `Az önce şu işlemi kaydetti:

${yeniIslem.enstruman} ${(yeniIslem.yon || '').toUpperCase()}
Giriş: ${yeniIslem.giris_fiyati ?? '?'} → Çıkış: ${yeniIslem.cikis_fiyati ?? '?'}
PnL: ${pnlStr}
RR: ${yeniIslem.rr_orani ?? '?'}
Breakeven: ${yeniIslem.breakeven_fiyati ?? 'yok'}
${yeniIslem.notlar ? `Not: ${yeniIslem.notlar}` : ''}
${gecmisOzet}

Kısa bir geri bildirim ver ve en fazla 2 soru sor. 3-5 cümle max.`

  try {
    const result = await model.generateContent(prompt)
    const mesaj = result.response.text()
    return Response.json({ mesaj })
  } catch (e) {
    console.error('Gemini islem-sonrasi hata:', e)
    return Response.json({ mesaj: null })
  }
}
