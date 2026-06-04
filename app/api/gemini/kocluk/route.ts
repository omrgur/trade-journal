import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'GEMINI_API_KEY ayarlanmamış. aistudio.google.com adresinden ücretsiz alabilirsiniz.' }, { status: 500 })
  }

  const db = supabaseAdmin()
  const { data: islemler } = await db
    .from('islemler')
    .select('*')
    .order('tarih_saat', { ascending: false })
    .limit(20)

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
  }))

  const prompt = `Sen deneyimli bir trading koçusun. Trader'ın son işlemlerini analiz et ve Türkçe geri bildirim ver.

Son işlemler:
${JSON.stringify(ozet, null, 2)}

Yapıcı ve kısa bir analiz yaz. Güçlü yönler, tekrar eden hatalar ve gelişim alanları. Son olarak düşündürücü 3 soru sor.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const sorularMatch = text.match(/\d+[.)]\s*.+\?/g) ?? []
  const sorular = sorularMatch.map((s) => s.replace(/^\d+[.)]\s*/, '')).slice(0, 3)

  return Response.json({ analiz: text, sorular })
}
