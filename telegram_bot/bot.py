"""
Trade Journal Telegram Botu — v4
Koç + asistan kişiliği, Gemini direkt entegrasyon
"""
import os
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

SOHBET_KARAKTERI = """Sen bir trade koçu ve günlük yol arkadaşısın.

KİŞİLİK:
- Samimi, doğal, kısa konuşursun
- Hitap: "kardeşim", "reis", "dostum" — doğal akışta, her cümlede değil
- Espri yapabilirsin ama abartmadan

SELAMLAMA KURALLARI:
- "selam", "günaydın", "naber", "nasılsın" gibi mesajlara sıcak ve kısa karşılık ver
- İşlem sorma, format verme, örnek verme — ASLA
- Sadece sohbet et: nasılsın, gün nasıl, piyasalar nasıl gibi

GENEL SOHBET:
- Trade dışı konulardan bahsediyorsa onunla konuş
- Her şeyi trade'e bağlamak zorunda değilsin
- İnsan gibi davran, 2-3 cümle yeter

YAPMA:
- Örnek trade formatı verme (hiçbir zaman)
- Robot kalıpları kullanma
- Her mesaja aynı cevabı verme — FARKLI cevaplar üret"""

# Onay bekleyen işlemler: chat_id → işlem verisi
pending_trades: dict[int, dict] = {}

# Per-user sohbet geçmişi: chat_id → Gemini history listesi
chat_gecmisleri: dict[int, list] = {}


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
        return f"⚠️ Gemini hata: {str(e)[:200]}"


async def gemini_koc_yorum(islem_ozet: str) -> str | None:
    """İşlem sonrası koç yorumu üret."""
    if not GEMINI_API_KEY:
        return None
    koc_karakteri = (
        "Sen samimi bir trade koçusun. İşlem verildikten sonra kısa ve net yorum yaparsın. "
        "Hitap: 'kardeşim', 'reis', 'dostum' — doğal akışta. "
        "1 geri bildirim + en fazla 2 soru. Toplam 3-4 cümle. Türkçe. "
        "Teknik analiz değil, psikoloji ve davranış odaklı. "
        "Örnek format asla verme."
    )
    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-pro",
            system_instruction=koc_karakteri
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

def hesaplari_eslestir(hesap_isimleri: list[str], mesaj: str, hesaplar: list[dict]) -> list[str]:
    matched = []
    mesaj_lower = mesaj.lower()
    for hesap in hesaplar:
        if not hesap.get("aktif", True):
            continue
        hesap_isim = hesap["isim"].lower()
        if hesap_isim in mesaj_lower:
            matched.append(hesap["id"])
            continue
        for isim in hesap_isimleri:
            if isim.lower() in hesap_isim or hesap_isim in isim.lower():
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
    foto = update.message.photo[-1]
    caption = update.message.caption or ""
    try:
        foto_dosyasi = await context.bot.get_file(foto.file_id)
        foto_bytes = await foto_dosyasi.download_as_bytearray()

        gorsel_res = await client.post(
            f"{API_URL}/api/gorsel-yukle",
            files={"file": ("chart.jpg", bytes(foto_bytes), "image/jpeg")}
        )
        gorsel_data = gorsel_res.json()
        if "error" in gorsel_data:
            await update.message.reply_text("Görseli yükleyemedim, tekrar dener misin?")
            return

        gorsel_url = gorsel_data["url"]
        islem_data: dict = {
            "enstruman": "BILINMIYOR",
            "yon": "long",
            "kaynak": "telegram",
            "chart_gorseli_url": gorsel_url,
            "hesap_idleri": []
        }

        if len(caption) > 3:
            try:
                parse_res = await api_post("/api/claude/parse", json={"mesaj": caption})
                if parse_res.get("enstruman"):
                    hesaplar = await api_get("/api/hesaplar")
                    hesaplar = hesaplar if isinstance(hesaplar, list) else []
                    eslesen_ids = hesaplari_eslestir(parse_res.get("hesap_isimleri") or [], caption, hesaplar)
                    islem_data.update({
                        "enstruman": parse_res["enstruman"].upper(),
                        "yon": parse_res.get("yon") or "long",
                        "giris_fiyati": parse_res.get("giris_fiyati"),
                        "cikis_fiyati": parse_res.get("cikis_fiyati"),
                        "breakeven_fiyati": parse_res.get("breakeven_fiyati"),
                        "pnl": parse_res.get("pnl"),
                        "rr_orani": parse_res.get("rr_orani"),
                        "hesap_idleri": eslesen_ids,
                        "notlar": parse_res.get("notlar"),
                    })
            except Exception:
                pass

        sonuc = await api_post("/api/islemler", json=islem_data)
        await update.message.reply_text(
            f"✅ *Chart kaydedildi.*\n{sonuc.get('enstruman', '?')} {(sonuc.get('yon') or '').upper()}"
            + ("\n\n_Açıklama ekleyerek detayları da kaydedebilirsin._" if len(caption) < 3 else ""),
            parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(f"fotoğraf hatası: {e}")
        await update.message.reply_text("Görselde bir sorun oldu, tekrar dener misin?")


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
