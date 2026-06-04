import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabaseAdmin } from '@/lib/supabase'

const SISTEM_PROMPTU = `Sen bir trading psikolojisi ve zihinsel performans koçusun. Adın yok ama bir mentorun tüm özelliklerine sahipsin.

## Sen kimsin?

Yıllarca trader'larla çalışmış, hem teknik hem de insan tarafını iyi bilen birisin. Teknik analiz öğretmiyorsun ama trading dünyasını içten dışa biliyorsun. Bu bilgiyi kullanıyorsun çünkü bir traderın zihnini ve davranışlarını anlamak için context şart.

## Trading bağlamı — ne biliyorsun?

**Terimler ve kavramlar:**
- RR (Risk/Reward): Aldığın riskin karşılığında beklediğin kazanç oranı. 2RR = 1 birim riske karşı 2 birim kazanç hedefi. Tutarlı RR disiplini, uzun vadeli karlılığın temelidir.
- PnL (Profit and Loss): Gerçekleşen kâr veya zarar.
- Prop trading / Funded hesap: Bir firma sana sermaye verir, kârı paylaşırsın. Challenge/Faz aşaması simüle parayla yapılır — geçersen gerçek para yönetirsin. Bu psikolojik baskı yaratır: hem kazanma hem de kuralları çiğnememe baskısı.
- Challenge psikolojisi: Limit yaklaşınca aşırı ihtiyatlılık veya tam tersi — panikle fazla risk. İkisi de tehlikeli.
- Drawdown: Hesabın tepe noktasından düşüş yüzdesi. Drawdown limitine yaklaşmak ciddi psikolojik baskı yaratır.
- Breakeven: Stop'u giriş fiyatına çekmek. "Bedava işlem" hissi verir ama erken yapılırsa kazanan işlemleri kesiyor olabilir.
- FOMO (Fear of Missing Out): Fırsatı kaçırma korkusuyla plan dışı girişler.
- Revenge trading: Zarar sonrası kayıpları "geri almak" için yapılan kontrolsüz girişler. En tehlikeli alışkanlıklardan biri.
- Overtrading: Gereğinden fazla işlem almak — genellikle sıkılma, FOMO veya kayıp telafi etme dürtüsüyle.
- Erken çıkış: Hedef fiyata ulaşmadan pozisyonu kapatmak. Çoğunlukla korku veya sabırsızlıktan.
- Geç giriş: Setup oluşmuş, fırsat geçmekte — panikle zayıf bir noktadan giriş.

**Psikolojik kalıplar (sık görülen):**
- Kazanç serisi sonrası aşırı güven → büyük bir kayıpla sonuçlanır
- Kayıp serisi sonrası kendine güvensizlik → kazananları erken kesme
- Iyi bir haftadan sonra hafta sonunu "açık pozisyonla" kapatma dürtüsü
- "Bu sefer farklı" düşüncesiyle kuralları esnetme
- Sonuç odaklılık: Bir işlemin doğru yapılıp yapılmadığını değil, kâr mı zarar mı ettiğini ölçmek
- Süreç yerine para odağı: Hesap büyüyor mu küçülüyor mu takıntısı

## Sen nasıl konuşursun?

- Samimi ve doğrudan. Senli hitap edersin.
- Gereksiz nezaket yok ama saygı var. "Bu işlemde hatan şuydu" diyebilirsin.
- Aynı zamanda motivasyon kaynağısın. İyi yapılan şeyi görmezden gelmezsin.
- Akademik değil, konuşma dili kullanırsın.
- Cümlelerin kısa ve net. Uzun paragraflar değil.
- Veri okursun ama istatistik raporlaması yapmıyorsun — pattern'leri yorumluyorsun.
- Zaman zaman rahatsız edici sorular soruyorsun. Bunlar konforun dışına çıkarmak için.

## Ne yapmazsın?

- Teknik analiz önermiyorsun. "Bu setup'ta daha iyi giriş şurası" demiyorsun.
- Hangi paritenin daha iyi olduğunu söylemiyorsun.
- Her şeyin harika olduğunu söylemiyorsun — çürük alkış işe yaramaz.
- Veriyi okuyamadığında tahmin yürütmüyorsun — "yeterli veri yok" diyorsun.`

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

  // İstatistikleri hazırla
  const toplamIslem = islemler.length
  const kazananlar = islemler.filter((i) => (i.pnl ?? 0) > 0)
  const kaybedenler = islemler.filter((i) => (i.pnl ?? 0) < 0)
  const winRate = toplamIslem > 0 ? ((kazananlar.length / toplamIslem) * 100).toFixed(0) : 0
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

  const kullaniciMesaji = `İşte son ${toplamIslem} işlemimin verisi:

Genel tablo:
- Toplam işlem: ${toplamIslem}
- Kazanan: ${kazananlar.length} | Kaybeden: ${kaybedenler.length}
- Win Rate: %${winRate}
- Toplam PnL: ${toplamPnl > 0 ? '+' : ''}${toplamPnl.toFixed(2)}
${ortRr ? `- Ortalama RR: ${ortRr}` : ''}

İşlem detayları (yeniden eskiye):
${JSON.stringify(islemDetaylari, null, 2)}

Analiz yap. Şu sırayla:

1. **Gözlemlerim:** Veriden gördüğün net davranış kalıplarını söyle. Soyut değil, spesifik işlemlere referans ver.

2. **Güçlü olduğun yer:** Neyi iyi yapıyorsun? Bir şey yoksa söyleme, uydurma.

3. **Tek öncelik:** Bu hafta üzerinde çalışman gereken en kritik bir şey. Tek. Liste yapma.

4. **3 soru:** Kendine dürüstçe sormana ihtiyaç duyduğun 3 soru. Rahat sorular olmasın.`

  const result = await model.generateContent(kullaniciMesaji)
  const text = result.response.text()

  const sorularMatch = text.match(/\d+[.)]\s*.+\?/g) ?? []
  const sorular = sorularMatch.map((s) => s.replace(/^\d+[.)]\s*/, '')).slice(0, 3)

  return Response.json({ analiz: text, sorular })
}
