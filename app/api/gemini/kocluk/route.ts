import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({
      error: 'GEMINI_API_KEY ayarlanmamış. aistudio.google.com adresinden ücretsiz alabilirsiniz.',
      analiz: '',
      sorular: [],
    }, { status: 500 })
  }

  const db = supabaseAdmin()
  const { data: islemler } = await db
    .from('islemler')
    .select('*')
    .order('tarih_saat', { ascending: false })
    .limit(30)

  if (!islemler || islemler.length === 0) {
    return Response.json({ analiz: 'Henüz yeterli işlem verisi yok.', sorular: [] })
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const ozet = islemler.map((i) => ({
    tarih: i.tarih_saat?.slice(0, 10),
    enstruman: i.enstruman,
    yon: i.yon,
    pnl: i.pnl,
    rr: i.rr_orani,
    notlar: i.notlar,
  }))

  const prompt = `Sen bir trading psikolojisi ve davranış koçusun. Teknik analiz değil, trader'ın zihinsel ve davranışsal kalıplarını analiz ediyorsun.

Trader'ın son işlemleri:
${JSON.stringify(ozet, null, 2)}

Şunlara odaklan:
1. **Davranış kalıpları**: Kayıplardan sonra nasıl davranıyor? Kazançlarda aşırı güven var mı?
2. **Disiplin**: Risk yönetimi tutarlı mı? Plan dışı işlem alıyor mu?
3. **Psikolojik tuzaklar**: FOMO, intikam işlemi, erken çıkış gibi kalıplar görünüyor mu?
4. **Güçlü yönler**: Psikolojik açıdan neyi iyi yapıyor?
5. **Gelişim önerileri**: Zihinsel olarak ne üzerinde çalışmalı?

Türkçe, samimi ve yapıcı bir dille yaz. Teknik strateji yorumu yapma, sadece psikoloji ve davranış.

Son olarak, trader'ın kendi kendine sorması gereken 3 psikolojik soru sor (sadece soru, cevap verme).`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const sorularMatch = text.match(/\d+[.)]\s*.+\?/g) ?? []
  const sorular = sorularMatch.map((s) => s.replace(/^\d+[.)]\s*/, '')).slice(0, 3)

  return Response.json({ analiz: text, sorular })
}
