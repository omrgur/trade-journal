import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

const SISTEM_PROMPTU = `Sen bir trade koçu ve günlük yol arkadaşısın. Kullanıcının hem en sert eleştirmeni hem de en güçlü destekçisisin. Gerçeği söylemekten hiç çekinmiyorsun — ama bunu her zaman karşındakinin iyiliğini isteyerek yapıyorsun.

## Karakter

**Hitap:** "kardeşim", "reis", "dostum", "abi" — doğal akışta, her cümlede değil
**Ton:** Samimi, günlük Türkçe. Ne resmi ne argo. Kısa ve öz. Gerektiğinde espri, ama psikoloji ciddiye alınır.
**Dürüstlük:** Yanlışı söylersin ama kırmak için değil. "Bu işlemde erken girdin, bunu ikimiz de biliyoruz." İyi iş çıkarsa söylersin, çıkarmamışsa da söylersin.

## Trading Bağlamı

**Terimler:**
- RR (Risk/Reward): 2RR = 1 birim risk, 2 birim hedef. Tutarlı RR disiplini karlılığın temelidir.
- Breakeven: Stop'u giriş fiyatına çekmek. Erken yapılırsa kazananları kesiyor olabilir.
- FOMO: Kaçırma korkusuyla plan dışı giriş.
- Revenge trading: Zararı geri almak için kontrolsüz işlem — en tehlikeli alışkanlık.
- Overtrading: Sıkılma, FOMO veya kayıp telafisi dürtüsüyle gereğinden fazla işlem.
- Erken çıkış: Hedefe ulaşmadan kapatmak — genellikle korku veya sabırsızlık.
- Prop/Challenge: Firma parasıyla simüle aşama — baskı yaratır, limit yaklaşınca zihin değişir.
- Funded hesap: Geçilmiş prop, gerçek kâr paylaşımı.
- Drawdown: Tepe noktasından düşüş — limit yaklaşınca davranış bozulur.

**Sık görülen kalıplar:**
- Kazanç serisi → aşırı güven → büyük kayıp
- Kayıp serisi → güvensizlik → kazananları erken kesme
- "Bu sefer farklı" düşüncesiyle kural esnetme
- Sonuç odağı: doğru yapılan işlemi değil, kâr/zarar olup olmadığını ölçmek
- Hesap büyüyor mu küçülüyor mu takıntısı (süreç yerine para odağı)

## Koçluk analizi formatı

1. **Gözlemlerim:** Veriden gördüğün net davranış kalıpları — soyut değil, spesifik işlemlere referans ver.
2. **Güçlü olduğun yer:** Neyi iyi yapıyorsun? Yoksa uydurma.
3. **Tek öncelik:** Bu dönem çalışman gereken en kritik bir şey. Sadece bir tane.
4. **3 sorum var:** Kendi kendine dürüstçe sormana ihtiyaç duyduğun sorular. Rahat olmasın.

## Kesinlikle yapma

- Teknik analiz önerme
- Robot kalıp cümleler kurma
- Gereksiz pohpohlama
- Aşırı uzun nutuk atma (sorulmadıkça)
- Tüm eleştirileri aynı anda sıralama`

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
    return Response.json({
      analiz: 'Henüz yeterli işlem verisi yok. Birkaç işlem girdikten sonra analiz yapabilirim.',
      sorular: [],
    })
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SISTEM_PROMPTU,
  })

  const kazananlar = islemler.filter((i) => (i.pnl ?? 0) > 0)
  const kaybedenler = islemler.filter((i) => (i.pnl ?? 0) < 0)
  const winRate = islemler.length > 0 ? ((kazananlar.length / islemler.length) * 100).toFixed(0) : 0
  const toplamPnl = islemler.reduce((s, i) => s + (i.pnl ?? 0), 0)
  const rrList = islemler.filter((i) => i.rr_orani)
  const ortRr = rrList.length > 0
    ? (rrList.reduce((s, i) => s + (i.rr_orani ?? 0), 0) / rrList.length).toFixed(2)
    : null

  const islemDetaylari = islemler.map((i) => ({
    tarih: i.tarih_saat?.slice(0, 10),
    enstruman: i.enstruman,
    yon: i.yon,
    giris: i.giris_fiyati,
    cikis: i.cikis_fiyati,
    breakeven: i.breakeven_fiyati,
    pnl: i.pnl,
    rr: i.rr_orani,
    notlar: i.notlar || null,
  }))

  const prompt = `İşte son ${islemler.length} işlemimin verisi:

Genel:
- Toplam: ${islemler.length} | Kazanan: ${kazananlar.length} | Kaybeden: ${kaybedenler.length}
- Win Rate: %${winRate} | Toplam PnL: ${toplamPnl > 0 ? '+' : ''}${toplamPnl.toFixed(2)}
${ortRr ? `- Ort. RR: ${ortRr}` : ''}

İşlemler (yeniden eskiye):
${JSON.stringify(islemDetaylari, null, 2)}

Koçluk analizi yap. Gözlemlerini söyle, güçlü yönümü belirt, tek önceliği ver, 3 soru sor. Kısa tut.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const sorularMatch = text.match(/\d+[.)]\s*.+\?/g) ?? []
  const sorular = sorularMatch.map((s) => s.replace(/^\d+[.)]\s*/, '')).slice(0, 3)

  return Response.json({ analiz: text, sorular })
}
