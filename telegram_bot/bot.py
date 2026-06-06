"""
Trade Journal Telegram Botu — v4
Koç + asistan kişiliği, Gemini direkt entegrasyon
"""
import os
import base64
import logging
import asyncio
import httpx
import google.generativeai as genai
from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    ContextTypes, filters
)
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
API_URL = os.environ["NEXT_PUBLIC_APP_URL"].rstrip("/")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

client = httpx.AsyncClient(timeout=30)

# Gemini kurulumu
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("Gemini API bağlandı")
else:
    logger.warning("GEMINI_API_KEY bulunamadı — sohbet modu devre dışı")

SOHBET_KARAKTERI = """Sen bir trade journal botusun ama sadece kayıt tutan bir araç değilsin. Kullanıcının günlük yol arkadaşısın. Sabah "günaydın" dediğinde orada olursun, gece zor bir işlemden sonra "berbat gün geçirdim" dediğinde de. Trade konusunda ciddi ve bilgilisin ama bunu robotik bir şekilde değil, arkadaş gibi aktarırsın. Eğlenceli olabilirsin, espri yapabilirsin — ama iş ciddiye bindiğinde geceyi gündüze çevirirsin.

TEMEL KARAKTERİN:
- Samimi ve doğal — kalıp cümleler yok, her mesaj insan gibi
- Eğlenceli — espri yapabilirsin, hafif takılabilirsin, ama ölçülü
- Ciddi olunca ciddi — işlem analizi, hata tespiti, performans değerlendirmesi söz konusu olduğunda şakayı bir kenara bırakırsın
- Dürüst — iyi işlemi iyi, kötü işlemi kötü söylersin. Pohpohlama yok
- Kısa ve öz — gereksiz uzatma, söyleyeceğini söyle

HİTAP:
Kullanıcıya duruma göre farklı hitap edersin, doğal akışta gelsin:
"kardeşim", "reis", "dostum", "abi" (bazen), kullanıcı ismini söylemişse kullan, bazen hiç hitap yok direkt konuya gir.
Her cümlede hitap kullanma, zorlamayacaksın. Doğal geldiğinde gelsin.

SELAMLAMA (ÇOK ÖNEMLİ):
Kullanıcı "selam", "günaydın", "naber" veya herhangi bir selamlama attığında:
- Sıcak karşıla, sohbet aç — işlem sormak için acele etme
- Konuşma devam ederse konuş, kullanıcı işlem konusunu açarsa oraya geçersin
Örnekler: "selam" → "Selam! Nasılsın, bugün ne var ne yok?" / "günaydın" → "Günaydın! Günün güzel geçsin, piyasaya erken mi gireceksin?"

İŞLEM DEĞERLENDİRME TONU:
İyi işlem: "2RR almışsın, temiz iş. Breakeven yönetimi de güzeldi, böyle devam."
Hatalı işlem: "Girişi biraz erken yapmışsın gibi duruyor. Beklesen daha temiz çıkardı. Ne gördün o an?"
Tekrarlayan hata: "Bu hafta üçüncü kez erken giriş kardeşim. Fark etmişsindir zaten — ne zaman oluyor bu, baskı altında mı?"
Başabaş: "Zarar yok, kazanç yok. Risk yönettin, bu da bir şey sayılır."

ZOR GÜNLERDE:
- Önce insan olarak yanında ol — kısa ve samimi
- Fazla uzatma, nutuk atma
- Sonra analitik tarafa geç: ne oldu, neden oldu
- "Geçer, üzülme" gibi boş teselli yok, üzerine de basma

KESINLIKLE YAPMA:
- Kullanıcı "selam" yazdığında işlem formatı vermek veya işlem sormak
- Asla örnek format vermek — kullanıcıya "şu formatta yaz" demek yok
- Her mesajda aynı hitabı kullanmak
- Robot kalıp cümleler: "İşleminiz kaydedildi. Başka bir şey yapabilir miyim?"
- Gereksiz pohpohlama
- Konuşmayı zorla trade'e çekmek
- Uzun nutuk ve analizler (sorulmadıkça)
- Yanlışı görmezden gelmek

Arkadaş gibi konuş, koç gibi düşün."""

# Onay bekleyen işlemler: chat_id → işlem verisi
pending_trades: dict[int, dict] = {}

# Per-user sohbet geçmişi: chat_id → Gemini history listesi
chat_gecmisleri: dict[int, list] = {}

# Parite beklenen tamamlanmamış fotoğraf işlemleri: chat_id → kısmi işlem verisi
pending_fotograflar: dict[int, dict] = {}


# ── Gemini direkt fonksiyonları ──────────────────────────────

async def gemini_sohbet(chat_id: int, mesaj: str) -> str | None:
    """Sohbet mesajına Gemini karakteriyle cevap ver (konuşma geçmişiyle)."""
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY Railway'de tanımlı değil!")
        return "⚠️ GEMINI_API_KEY eksik — Railway Variables'a ekle"
    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-pro",
            system_instruction=SOHBET_KARAKTERI
        )
        gecmis = chat_gecmisleri.get(chat_id, [])
        chat = model.start_chat(history=gecmis)
        response = await asyncio.get_event_loop().run_in_executor(
            None, lambda: chat.send_message(mesaj)
        )
        # Son 20 tur tut (40 mesaj = 20 kullanıcı + 20 bot)
        chat_gecmisleri[chat_id] = chat.history[-40:]
        return response.text
    except Exception as e:
        logger.error(f"Gemini sohbet hata: {e}")
        if "429" in str(e) or "quota" in str(e).lower() or "rate" in str(e).lower():
            return None  # Sessiz düş, fallback göster
        return None


async def gemini_koc_yorum(islem_ozet: str) -> str | None:
    """İşlem sonrası koç yorumu üret."""
    if not GEMINI_API_KEY:
        return None
    direktif = (
        SOHBET_KARAKTERI +
        "\n\nKullanıcı az önce bir işlem kapattı ve kaydetti. "
        "İşlem değerlendirme tonunda yanıt ver: 1 kısa geri bildirim + en fazla 2 soru. "
        "Toplam 3-4 cümle. Teknik analiz değil, psikoloji ve davranış odaklı."
    )
    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-pro",
            system_instruction=direktif
        )
        response = await asyncio.get_event_loop().run_in_executor(
            None, lambda: model.generate_content(f"Az önce şu işlemi kapattım: {islem_ozet}")
        )
        return response.text
    except Exception as e:
        logger.error(f"Gemini koç yorum hata: {e}")
        return None

# Trade mesajı mı sohbet mi — hızlı keyword kontrolü
TRADE_KELIMELERI = [
    'long', 'short', 'xau', 'eur', 'gbp', 'usd', 'jpy', 'aud', 'cad', 'chf',
    'nasdaq', 'sp500', 'dax', 'btc', 'eth', 'crypto',
    'rr', 'pnl', 'pip', 'lot', 'stop', 'target', 'tp', 'sl',
    'girdim', 'çıktım', 'aldım', 'sattım', 'kapattım', 'açtım',
    'pozisyon', 'işlem', 'trade', 'breakeven', 'hedefe', 'zarar', 'kâr', 'kar',
    'fiyat', 'seviye', 'girişi', 'çıkışı',
]

SELAMLAMA_KELIMELERI = [
    'selam', 'merhaba', 'hey', 'günaydın', 'iyi günler', 'naber',
    'nasılsın', 'ne haber', 'hi', 'hello', 'good morning',
]

def trade_mesaji_mi(metin: str) -> bool:
    """Mesajın trade girişi mi yoksa sohbet mi olduğunu tahmin eder."""
    metin_lower = metin.lower()
    # Çok kısa veya selamlama → sohbet
    if len(metin.split()) <= 3:
        return False
    if any(s in metin_lower for s in SELAMLAMA_KELIMELERI) and len(metin.split()) <= 5:
        return False
    # Trade kelimesi varsa → trade
    return any(k in metin_lower for k in TRADE_KELIMELERI)


# ── Yardımcılar ───────────────────────────────────────────────

async def api_post(endpoint: str, **kwargs) -> dict:
    res = await client.post(f"{API_URL}{endpoint}", **kwargs)
    return res.json()

async def api_get(endpoint: str) -> dict | list:
    res = await client.get(f"{API_URL}{endpoint}")
    return res.json()

_HESAP_STOPWORDS = {'hesap', 'hesabı', 'hesapta', 'hesabım'}

def hesaplari_eslestir(hesap_isimleri: list[str], mesaj: str, hesaplar: list[dict]) -> list[str]:
    matched = []
    mesaj_lower = mesaj.lower()
    for hesap in hesaplar:
        if not hesap.get("aktif", True):
            continue
        hesap_isim = hesap["isim"].lower()
        # 1. Tam eşleşme
        if hesap_isim in mesaj_lower:
            matched.append(hesap["id"])
            continue
        # 2. Ayırt edici token eşleşmesi ("$5k Hesap" → "5k" mesajda geçiyor mu?)
        tokens = [t.lstrip('$') for t in hesap_isim.split()
                  if t.lstrip('$') not in _HESAP_STOPWORDS and len(t.lstrip('$')) >= 2]
        if tokens and any(tok in mesaj_lower for tok in tokens):
            matched.append(hesap["id"])
            continue
        # 3. Claude'un döndürdüğü hesap isimlerine karşılaştır
        for isim in hesap_isimleri:
            isim_n = isim.lower().lstrip('$')
            hesap_n = hesap_isim.lstrip('$')
            if isim_n in hesap_n or hesap_n in isim_n:
                if hesap["id"] not in matched:
                    matched.append(hesap["id"])
                break
    return matched

def onay_mesaji_olustur(islem: dict, eslesen_hesaplar: list[dict]) -> str:
    pnl = islem.get("pnl")
    pnl_str = f"+{pnl}" if pnl and pnl > 0 else str(pnl) if pnl is not None else "?"
    hesap_str = ", ".join(h["isim"] for h in eslesen_hesaplar) if eslesen_hesaplar else "Belirtilmedi"

    return (
        f"📋 *İşlem özeti:*\n\n"
        f"*{islem.get('enstruman', '?')}* {(islem.get('yon') or '').upper()}\n"
        f"Giriş: `{islem.get('giris_fiyati', '?')}` → Çıkış: `{islem.get('cikis_fiyati', '?')}`\n"
        f"PnL: `{pnl_str}` | RR: `{islem.get('rr_orani', '?')}`\n"
        f"Hesap: {hesap_str}\n"
        + (f"Not: _{islem.get('notlar')}_\n" if islem.get("notlar") else "")
        + f"\nKaydedeyim mi?"
    )


# ── Komutlar ──────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "👋 Selam! Ben hem koçun hem de işlem defterinin.\n\n"
        "İşlemlerini bana anlat, ben kaydederim. Zaman zaman sana sorular sorar, "
        "performansını analiz eder, psikolojik kör noktalarına dikkat çekerim.\n\n"
        "Ne yapmak istediğini bilmiyorsan /komutlar yaz.",
        parse_mode="Markdown"
    )

async def cmd_komutlar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "*Aktif Komutlar:*\n\n"
        "📊 /son — Son 5 işlem\n"
        "📈 /ozet — Bu haftanın özeti\n"
        "🧠 /kocluk — Psikoloji ve davranış analizi\n"
        "🏦 /hesaplar — Kayıtlı hesaplarım\n"
        "❓ /komutlar — Bu liste\n\n"
        "_İşlem girmek için düz mesaj yaz._",
        parse_mode="Markdown"
    )

async def cmd_hesaplar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    hesaplar = await api_get("/api/hesaplar")
    if not isinstance(hesaplar, list) or not hesaplar:
        await update.message.reply_text(
            f"Kayıtlı hesap yok. Dashboard'dan ekleyebilirsin:\n{API_URL}/hesaplar"
        )
        return
    kategori_etiket = {
        "kendi": "✅ Gerçek para",
        "funded": "💼 Funded",
        "challenge": "🎯 Challenge"
    }
    liste = "\n".join(
        f"• *{h['isim']}* — {kategori_etiket.get(h['kategori'], h['kategori'])}"
        + (f" ({h['firma']})" if h.get("firma") else "")
        for h in hesaplar if h.get("aktif")
    )
    await update.message.reply_text(f"*Hesaplarım:*\n\n{liste}", parse_mode="Markdown")

async def cmd_son(update: Update, context: ContextTypes.DEFAULT_TYPE):
    islemler = await api_get("/api/islemler")
    if not isinstance(islemler, list) or not islemler:
        await update.message.reply_text("Henüz kayıtlı işlem yok.")
        return
    mesaj = "*Son 5 İşlem:*\n\n"
    for i in islemler[:5]:
        pnl = i.get("pnl")
        pnl_str = f"+{pnl}" if pnl and pnl > 0 else str(pnl) if pnl is not None else "?"
        tarih = i.get("tarih_saat", "")[:10]
        emoji = "✅" if pnl and pnl > 0 else "❌" if pnl and pnl < 0 else "➖"
        mesaj += f"{emoji} *{i.get('enstruman', '?')}* {i.get('yon', '').upper()} | `{pnl_str}` | {tarih}\n"
    await update.message.reply_text(mesaj, parse_mode="Markdown")

async def cmd_ozet(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from datetime import datetime, timedelta, timezone
    islemler = await api_get("/api/islemler")
    if not isinstance(islemler, list):
        await update.message.reply_text("Veri alınamadı.")
        return
    hafta_once = datetime.now(timezone.utc) - timedelta(days=7)
    bu_hafta = [
        i for i in islemler
        if datetime.fromisoformat(i["tarih_saat"].replace("Z", "+00:00")) >= hafta_once
    ]
    if not bu_hafta:
        await update.message.reply_text("Bu hafta hiç işlem yok.")
        return
    toplam_pnl = sum(i.get("pnl") or 0 for i in bu_hafta)
    kazananlar = sum(1 for i in bu_hafta if (i.get("pnl") or 0) > 0)
    win_rate = (kazananlar / len(bu_hafta)) * 100
    pnl_str = f"+{toplam_pnl:.2f}" if toplam_pnl > 0 else f"{toplam_pnl:.2f}"
    deger = "Gerçek para kazandın 💰" if toplam_pnl > 0 else "Zor bir hafta, analiz şart 🔍"
    await update.message.reply_text(
        f"*Bu Hafta:*\n\n"
        f"İşlem: {len(bu_hafta)} | Kazanan: {kazananlar} | Win Rate: %{win_rate:.0f}\n"
        f"Toplam PnL: `{pnl_str}`\n\n"
        f"_{deger}_",
        parse_mode="Markdown"
    )

async def cmd_kocluk(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("⏳ Analiz hazırlanıyor, biraz sabır...")
    try:
        data = await api_get("/api/gemini/kocluk")
        if isinstance(data, dict) and data.get("error"):
            data = await api_get("/api/claude/kocluk")
        analiz = data.get("analiz", "Analiz yapılamadı.") if isinstance(data, dict) else "Analiz yapılamadı."
        if len(analiz) > 3800:
            analiz = analiz[:3800] + "..."
        await update.message.reply_text(f"🧠 *Koçluk Analizi:*\n\n{analiz}", parse_mode="Markdown")
    except Exception as e:
        logger.error(f"kocluk hata: {e}")
        await update.message.reply_text("❌ Analiz yapılırken bir sorun oluştu.")


# ── Metin işleme — onay akışlı ────────────────────────────────

async def metin_mesaji(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.message.chat_id
    metin = update.message.text.strip()
    metin_lower = metin.lower()

    # Onay bekleniyor mu?
    if chat_id in pending_trades:
        if metin_lower in ["evet", "e", "yes", "kaydet", "k", "tamam", "ok", "1"]:
            islem = pending_trades.pop(chat_id)
            try:
                sonuc = await api_post("/api/islemler", json=islem)
                pnl = sonuc.get("pnl")
                pnl_str = f"+{pnl}" if pnl and pnl > 0 else str(pnl) if pnl is not None else "?"
                emoji = "✅" if pnl and float(pnl) > 0 else "❌"
                # Kısa onay
                await update.message.reply_text(
                    f"{emoji} *Kaydedildi.* {sonuc.get('enstruman', '?')} {(sonuc.get('yon') or '').upper()} | `{pnl_str}`",
                    parse_mode="Markdown",
                    reply_markup=ReplyKeyboardRemove()
                )

                # Gemini koç cevabı — işlem sonrası
                try:
                    islem_ozet = (
                        f"{sonuc.get('enstruman','?')} {(sonuc.get('yon') or '').upper()} | "
                        f"Giriş: {sonuc.get('giris_fiyati','?')} → Çıkış: {sonuc.get('cikis_fiyati','?')} | "
                        f"PnL: {pnl_str} | RR: {sonuc.get('rr_orani','?')}"
                    )
                    karakter_mesaj = await gemini_koc_yorum(islem_ozet)
                    if karakter_mesaj:
                        await update.message.reply_text(karakter_mesaj, parse_mode="Markdown")
                except Exception as ge:
                    logger.warning(f"Gemini koç yorumu alınamadı: {ge}")

            except Exception as e:
                logger.error(f"kayıt hatası: {e}")
                await update.message.reply_text("❌ Kayıt sırasında hata oluştu.", reply_markup=ReplyKeyboardRemove())
            return

        elif metin_lower in ["hayır", "h", "no", "iptal", "0", "vazgeç"]:
            pending_trades.pop(chat_id)
            await update.message.reply_text("Tamam, iptal ettim.", reply_markup=ReplyKeyboardRemove())
            return

    # Eksik bilgi tamamlanıyor (fotoğraf sonrası)
    if chat_id in pending_fotograflar:
        islem_data = pending_fotograflar.pop(chat_id)
        try:
            parse_res = await api_post("/api/claude/parse", json={"mesaj": metin})
            if parse_res.get("enstruman"):
                islem_data["enstruman"] = parse_res["enstruman"].upper()
            if parse_res.get("yon"):
                islem_data["yon"] = parse_res["yon"]
            if parse_res.get("pnl") is not None:
                islem_data["pnl"] = parse_res["pnl"]
            if parse_res.get("rr_orani") is not None:
                islem_data["rr_orani"] = parse_res["rr_orani"]
            if parse_res.get("giris_fiyati") is not None:
                islem_data["giris_fiyati"] = parse_res["giris_fiyati"]
            if parse_res.get("cikis_fiyati") is not None:
                islem_data["cikis_fiyati"] = parse_res["cikis_fiyati"]
            if parse_res.get("hesap_isimleri"):
                h_listesi = await api_get("/api/hesaplar")
                h_listesi = h_listesi if isinstance(h_listesi, list) else []
                ids = hesaplari_eslestir(parse_res["hesap_isimleri"], metin, h_listesi)
                if ids:
                    islem_data["hesap_idleri"] = ids
        except Exception as pe:
            logger.error(f"Fotoğraf tamamlama parse hatası: {pe}")
            # Fallback: mesajı doğrudan enstrüman olarak al
            if islem_data["enstruman"] == "BILINMIYOR":
                islem_data["enstruman"] = metin.strip().upper()
        try:
            await _fotograf_kaydet(update, islem_data)
        except Exception as e:
            logger.error(f"Fotoğraf tamamlama kayıt hatası: {e}")
            await update.message.reply_text("Kaydederken bir sorun oluştu.")
        return

    # Trade mi sohbet mi?
    if not trade_mesaji_mi(metin):
        cevap = await gemini_sohbet(chat_id, metin)
        if cevap:
            await update.message.reply_text(cevap, parse_mode="Markdown")
        else:
            await update.message.reply_text("Selam! Ne var ne yok?")
        return

    # Yeni işlem parse et
    try:
        parsed = await api_post("/api/claude/parse", json={"mesaj": metin})
    except Exception as e:
        logger.error(f"parse hatası: {e}")
        await update.message.reply_text(
            "Anlayamadım. İşlemi biraz daha açar mısın?",
            parse_mode="Markdown"
        )
        return

    if not parsed.get("enstruman") or not parsed.get("yon"):
        await update.message.reply_text(
            "Enstrüman veya yönü anlayamadım. Tekrar yazar mısın?\n\n"
            "_Hangi paritede, long mu short mu aldın?_",
            parse_mode="Markdown"
        )
        return

    # Hesap eşleştir
    hesaplar = await api_get("/api/hesaplar")
    hesaplar = hesaplar if isinstance(hesaplar, list) else []
    eslesen_ids = hesaplari_eslestir(parsed.get("hesap_isimleri") or [], metin, hesaplar)
    eslesen_hesaplar = [h for h in hesaplar if h["id"] in eslesen_ids]

    islem_data = {
        "enstruman": (parsed.get("enstruman") or "").upper(),
        "yon": parsed.get("yon"),
        "giris_fiyati": parsed.get("giris_fiyati"),
        "cikis_fiyati": parsed.get("cikis_fiyati"),
        "breakeven_fiyati": parsed.get("breakeven_fiyati"),
        "pnl": parsed.get("pnl"),
        "rr_orani": parsed.get("rr_orani"),
        "hesap_idleri": eslesen_ids,
        "notlar": parsed.get("notlar"),
        "kaynak": "telegram",
    }

    pending_trades[chat_id] = islem_data

    await update.message.reply_text(
        onay_mesaji_olustur(islem_data, eslesen_hesaplar),
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardMarkup(
            [["Evet", "Hayır"]],
            one_time_keyboard=True,
            resize_keyboard=True
        )
    )


# ── Fotoğraf işleme ──────────────────────────────────────────

async def fotograf_mesaji(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.message.chat_id
    foto = update.message.photo[-1]
    caption = update.message.caption or ""

    try:
        # 1. Görseli indir
        foto_dosyasi = await context.bot.get_file(foto.file_id)
        foto_bytes = await foto_dosyasi.download_as_bytearray()

        # 2. Supabase'e yükle
        gorsel_res = await client.post(
            f"{API_URL}/api/gorsel-yukle",
            files={"file": ("chart.jpg", bytes(foto_bytes), "image/jpeg")}
        )
        gorsel_data = gorsel_res.json()
        if "error" in gorsel_data:
            await update.message.reply_text("Görseli yükleyemedim, tekrar dener misin?")
            return
        gorsel_url = gorsel_data["url"]

        # 3. Claude Vision — base64 ile gönder
        analiz_res: dict = {}
        try:
            foto_b64 = base64.b64encode(bytes(foto_bytes)).decode("utf-8")
            analiz_res = await api_post(
                "/api/claude/gorsel-analiz",
                json={"gorsel_base64": foto_b64, "media_type": "image/jpeg", "caption": caption or None}
            )
        except Exception as ae:
            logger.error(f"Görsel analiz hatası: {ae}")

        # 3b. Caption'ı ayrıca text parser ile analiz et (rr/hesap/pnl için)
        caption_parse: dict = {}
        if caption:
            try:
                caption_parse = await api_post("/api/claude/parse", json={"mesaj": caption})
            except Exception:
                pass
            # Fallback: caption'da bilinen enstruman anahtar kelimeleri direkt tara
            if not caption_parse.get("enstruman"):
                caption_lower = caption.lower()
                _ENSTRU_MAP = {
                    "nasdaq": "NAS100", "nas100": "NAS100", "us100": "NAS100",
                    "xauusd": "XAUUSD", "gold": "XAUUSD", "altın": "XAUUSD", "xau": "XAUUSD",
                    "dow": "US30", "us30": "US30", "dj30": "US30",
                    "sp500": "SPX500", "spx": "SPX500", "s&p": "SPX500",
                    "eurusd": "EURUSD", "gbpusd": "GBPUSD", "usdjpy": "USDJPY",
                    "btc": "BTCUSD", "btcusd": "BTCUSD", "eth": "ETHUSD",
                }
                for anahtar, deger in _ENSTRU_MAP.items():
                    if anahtar in caption_lower:
                        caption_parse["enstruman"] = deger
                        break

        # 4. Hesap eşleştir — her iki kaynaktan gelen isimler birleştirilerek
        hesaplar = await api_get("/api/hesaplar")
        hesaplar = hesaplar if isinstance(hesaplar, list) else []
        tum_hesap_isimleri = list(set(
            (analiz_res.get("hesap_isimleri") or []) +
            (caption_parse.get("hesap_isimleri") or [])
        ))
        eslesen_ids = hesaplari_eslestir(tum_hesap_isimleri, caption, hesaplar)

        # Görsel + caption parse birleştir (caption_parse boş değerleri doldurur)
        enstruman_ham = (analiz_res.get("enstruman") or caption_parse.get("enstruman") or "").upper().strip()
        yon_ham = analiz_res.get("yon") or caption_parse.get("yon")
        pnl_ham = analiz_res.get("pnl") if analiz_res.get("pnl") is not None else caption_parse.get("pnl")
        rr_ham = analiz_res.get("rr_orani") if analiz_res.get("rr_orani") is not None else caption_parse.get("rr_orani")

        islem_data: dict = {
            "enstruman": enstruman_ham or "BILINMIYOR",
            "yon": yon_ham or "long",
            "giris_fiyati": analiz_res.get("giris_fiyati"),
            "cikis_fiyati": analiz_res.get("cikis_fiyati"),
            "breakeven_fiyati": analiz_res.get("breakeven_fiyati"),
            "pnl": pnl_ham,
            "rr_orani": rr_ham,
            "hesap_idleri": eslesen_ids,
            "notlar": analiz_res.get("notlar") or (caption if caption else None),
            "kaynak": "telegram",
            "chart_gorseli_url": gorsel_url,
        }

        # 5. Eksik zorunlu alanları belirle
        eksik = []
        if not enstruman_ham:
            eksik.append("*Parite:* Hangi sembol? (örn: XAUUSD, NAS100, EURUSD)")
        if not yon_ham:
            eksik.append("*Yön:* Long mu short mu?")
        if pnl_ham is None:
            eksik.append("*PnL:* Kâr/zarar miktarı? (bilmiyorsan geç)")
        if not eslesen_ids:
            hesap_isimleri_str = ", ".join(h["isim"] for h in hesaplar if h.get("aktif")) if hesaplar else ""
            eksik.append(f"*Hesap:* Hangi hesap? ({hesap_isimleri_str or 'isteğe bağlı'})")

        if eksik:
            pending_fotograflar[chat_id] = islem_data
            await update.message.reply_text(
                "Chart yüklendi ✅ Bazı bilgiler eksik:\n\n" + "\n".join(eksik) +
                "\n\nHepsini tek mesajda yazabilirsin. (örn: _NAS100 short, -150_)",
                parse_mode="Markdown"
            )
            return

        # 6. Tüm bilgiler var — kaydet
        await _fotograf_kaydet(update, islem_data)

    except Exception as e:
        logger.error(f"fotoğraf hatası: {e}", exc_info=True)
        await update.message.reply_text("Görselde bir sorun oldu, tekrar dener misin?")


async def _fotograf_kaydet(update, islem_data: dict):
    sonuc = await api_post("/api/islemler", json=islem_data)

    if sonuc.get("error"):
        logger.error(f"İşlem kayıt hatası: {sonuc['error']} | veri: {islem_data}")
        await update.message.reply_text(
            f"❌ Kaydederken hata oluştu: `{sonuc['error']}`",
            parse_mode="Markdown"
        )
        return

    enstruman = sonuc.get("enstruman") or islem_data["enstruman"]
    yon = (sonuc.get("yon") or islem_data["yon"]).upper()
    pnl = sonuc.get("pnl")
    rr = sonuc.get("rr_orani")
    pnl_str = f"+{pnl}" if pnl and pnl > 0 else str(pnl) if pnl is not None else None

    onay = f"✅ *Kaydedildi* — {enstruman} {yon}"
    if pnl_str:
        onay += f" | `{pnl_str}`"
    if rr:
        onay += f" | `{rr}R`"
    await update.message.reply_text(onay, parse_mode="Markdown")

    try:
        islem_ozet = (
            f"{enstruman} {yon} | "
            f"PnL: {pnl_str or '?'} | RR: {rr or '?'} | Kaynak: chart"
        )
        karakter_mesaj = await gemini_koc_yorum(islem_ozet)
        if karakter_mesaj:
            await update.message.reply_text(karakter_mesaj, parse_mode="Markdown")
    except Exception as ge:
        logger.warning(f"Gemini koç yorumu alınamadı: {ge}")


# ── Ana ──────────────────────────────────────────────────────

def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("komutlar", cmd_komutlar))
    app.add_handler(CommandHandler("yardim", cmd_komutlar))
    app.add_handler(CommandHandler("son", cmd_son))
    app.add_handler(CommandHandler("ozet", cmd_ozet))
    app.add_handler(CommandHandler("kocluk", cmd_kocluk))
    app.add_handler(CommandHandler("hesaplar", cmd_hesaplar))
    app.add_handler(MessageHandler(filters.PHOTO, fotograf_mesaji))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, metin_mesaji))
    logger.info("Bot başlatıldı — polling modunda")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
