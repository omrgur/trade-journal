import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json({
      error: 'GEMINI_API_KEY ayarlanmamış.',
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

  const prompt = `Sen bir trading psikolojisi koçusun. Samimi, senli konuşursun. Şeker yok — iyi şeyleri de söylersin, hataları da. Teknik analiz değil, tamamen psikoloji ve davranış odaklısın.

Trader'ın son işlemleri:
${JSON.stringify(ozet, null, 2)}

Şu sırayla yaz:

**Direkt gözlemlerim:**
Gördüğün davranış kalıplarını net söyle. Disiplin var mı yok mu, tekrar eden hatalar var mı, kazançlarda ne oluyor, kayıplarda ne oluyor. Örnek ver, işlemlere referans ver.

**Güçlü yönlerin:**
Ne yapıyorsun ki işe yarıyor. Bu kısmı atlama — sadece eleştiri değil, neyin işe yaradığını da bilmesi lazım.

**Çalışman gereken alan:**
Bir tane, en kritik olanı. Hepsini aynı anda sıralama.

**Sana 3 sorum var:**
Trader'ın kendi kendine dürüstçe cevaplaması gereken 3 soru. Rahatsız edici olabilir — olsun.

Türkçe, samimi, direkt. Uzun akademik paragraflar değil — kısa, net, dürüst.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const sorularMatch = text.match(/\d+[.)]\s*.+\?/g) ?? []
  const sorular = sorularMatch.map((s) => s.replace(/^\d+[.)]\s*/, '')).slice(0, 3)

  return Response.json({ analiz: text, sorular })
}
