"""
Trade Journal Telegram Botu — v2
Onay akışlı, çoklu hesap destekli
Çalıştırmak için: python bot.py
"""
import os
import logging
import httpx
from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    ContextTypes, filters
)
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
API_URL = os.environ["NEXT_PUBLIC_APP_URL"].rstrip("/")

logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

client = httpx.AsyncClient(timeout=30)

# Onay bekleyen işlemler: chat_id → işlem verisi
pending_trades: dict[int, dict] = {}


# ── Yardımcılar ───────────────────────────────────────────────

async def api_post(endpoint: str, **kwargs) -> dict:
    res = await client.post(f"{API_URL}{endpoint}", **kwargs)
    return res.json()

async def api_get(endpoint: str) -> dict | list:
    res = await client.get(f"{API_URL}{endpoint}")
    return res.json()

def hesaplari_eslestir(hesap_isimleri: list[str], mesaj: str, hesaplar: list[dict]) -> list[str]:
    """Mesaj ve parse edilen isimlerden hesap ID'lerini bul."""
    matched = []
    mesaj_lower = mesaj.lower()
    for hesap in hesaplar:
        if not hesap.get("aktif", True):
            continue
        hesap_isim = hesap["isim"].lower()
        # Doğrudan isim eşleşmesi
        if hesap_isim in mesaj_lower:
            matched.append(hesap["id"])
            continue
        # Parse edilen isimlerle kısmi eşleşme
        for isim in hesap_isimleri:
            isim_lower = isim.lower()
            if isim_lower in hesap_isim or hesap_isim in isim_lower:
                if hesap["id"] not in matched:
                    matched.append(hesap["id"])
                break
    return matched

def onay_mesaji_olustur(islem: dict, eslesen_hesaplar: list[dict]) -> str:
    pnl = islem.get("pnl")
    pnl_str = f"+{pnl}" if pnl and pnl > 0 else str(pnl) if pnl is not None else "?"
    hesap_str = ", ".join(h["isim"] for h in eslesen_hesaplar) if eslesen_hesaplar else "Belirtilmedi"

    return (
        f"📊 *İşlem Özeti*\n\n"
        f"📌 *{islem.get('enstruman', '?')}* {(islem.get('yon') or '').upper()}\n"
        f"📥 Giriş: `{islem.get('giris_fiyati', '?')}`\n"
        f"📤 Çıkış: `{islem.get('cikis_fiyati', '?')}`\n"
        f"🔄 Breakeven: `{islem.get('breakeven_fiyati') or '—'}`\n"
        f"💰 PnL: `{pnl_str}`\n"
        f"📊 RR: `{islem.get('rr_orani', '?')}`\n"
        f"🏦 Hesap: {hesap_str}\n"
        + (f"📝 Not: _{islem.get('notlar')}_\n" if islem.get("notlar") else "")
        + f"\n*Kaydetmek istiyor musunuz?*"
    )


# ── Komutlar ──────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📈 *Trade Journal Bot*\n\n"
        "İşlem girmek için mesaj yaz:\n"
        "_XAUUSD long, 2650'den girdim 2670'de çıktım, 2RR, hem kendi hesabımda hem de $10k challenge hesabımda_\n\n"
        "*Komutlar:*\n"
        "/son — Son 5 işlem\n"
        "/ozet — Bu haftanın özeti\n"
        "/kocluk — AI koçluk analizi\n"
        "/hesaplar — Kayıtlı hesaplar\n"
        "/yardim — Bu mesaj",
        parse_mode="Markdown"
    )

async def cmd_hesaplar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    hesaplar = await api_get("/api/hesaplar")
    if not isinstance(hesaplar, list) or not hesaplar:
        await update.message.reply_text(
            "Kayıtlı hesap yok.\n"
            f"Hesap eklemek için: {API_URL}/hesaplar"
        )
        return
    kategori_etiket = {"kendi": "✅ Gerçek", "funded": "💼 Funded", "challenge": "🎯 Challenge"}
    liste = "\n".join(
        f"• *{h['isim']}* — {kategori_etiket.get(h['kategori'], h['kategori'])}"
        + (f" ({h['firma']})" if h.get("firma") else "")
        for h in hesaplar if h.get("aktif")
    )
    await update.message.reply_text(f"*Aktif Hesaplar:*\n\n{liste}", parse_mode="Markdown")

async def cmd_son(update: Update, context: ContextTypes.DEFAULT_TYPE):
    islemler = await api_get("/api/islemler")
    if not isinstance(islemler, list) or not islemler:
        await update.message.reply_text("Henüz hiç işlem kaydı yok.")
        return
    mesaj = "*Son 5 İşlem:*\n\n"
    for i in islemler[:5]:
        pnl = i.get("pnl")
        pnl_str = f"+{pnl}" if pnl and pnl > 0 else str(pnl) if pnl is not None else "?"
        tarih = i.get("tarih_saat", "")[:10]
        mesaj += f"📌 *{i.get('enstruman', '?')}* {i.get('yon', '').upper()} | PnL: `{pnl_str}` | RR: `{i.get('rr_orani', '?')}`\n📅 {tarih}\n\n"
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
    await update.message.reply_text(
        f"*Bu Hafta Özet:*\n\n"
        f"📊 Toplam İşlem: {len(bu_hafta)}\n"
        f"✅ Kazanan: {kazananlar}\n"
        f"📈 Win Rate: %{win_rate:.0f}\n"
        f"💰 Toplam PnL: `{pnl_str}`",
        parse_mode="Markdown"
    )

async def cmd_kocluk(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("⏳ Gemini analiz hazırlıyor...")
    try:
        data = await api_get("/api/gemini/kocluk")
        if isinstance(data, dict) and data.get("error"):
            # Gemini key yoksa Claude'a düş
            data = await api_get("/api/claude/kocluk")
        analiz = data.get("analiz", "Analiz yapılamadı.") if isinstance(data, dict) else "Analiz yapılamadı."
        if len(analiz) > 3800:
            analiz = analiz[:3800] + "..."
        await update.message.reply_text(f"🎯 *Koçluk Analizi:*\n\n{analiz}", parse_mode="Markdown")
    except Exception as e:
        logger.error(f"kocluk hata: {e}")
        await update.message.reply_text("❌ Analiz yapılırken hata oluştu.")


# ── Metin işleme — onay akışlı ────────────────────────────────

async def metin_mesaji(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.message.chat_id
    metin = update.message.text.strip()
    metin_lower = metin.lower()

    # Onay bekleniyor
    if chat_id in pending_trades:
        if metin_lower in ["evet", "e", "yes", "✓", "kaydet", "k", "1", "tamam", "ok"]:
            islem = pending_trades.pop(chat_id)
            try:
                sonuc = await api_post("/api/islemler", json=islem)
                pnl = sonuc.get("pnl")
                pnl_str = f"+{pnl}" if pnl and pnl > 0 else str(pnl) if pnl is not None else "?"
                await update.message.reply_text(
                    f"✅ *Kaydedildi!*\n\n{sonuc.get('enstruman', '?')} {(sonuc.get('yon') or '').upper()} | PnL: `{pnl_str}`",
                    parse_mode="Markdown",
                    reply_markup=ReplyKeyboardRemove()
                )
            except Exception as e:
                logger.error(f"kayıt hatası: {e}")
                await update.message.reply_text("❌ Kayıt sırasında hata oluştu.", reply_markup=ReplyKeyboardRemove())
            return

        elif metin_lower in ["hayır", "h", "no", "iptal", "0", "2", "vazgeç"]:
            pending_trades.pop(chat_id)
            await update.message.reply_text("İptal edildi.", reply_markup=ReplyKeyboardRemove())
            return

    # Yeni işlem parse et
    try:
        parsed = await api_post("/api/claude/parse", json={"mesaj": metin})
    except Exception as e:
        logger.error(f"parse hatası: {e}")
        await update.message.reply_text(
            "❌ İşlem anlaşılamadı.\n\nÖrnek:\n_XAUUSD long, 2650'den girdim 2670'de çıktım, 2RR, kendi hesabımda_",
            parse_mode="Markdown"
        )
        return

    if not parsed.get("enstruman") or not parsed.get("yon"):
        await update.message.reply_text(
            "⚠️ Enstrüman veya yön bulunamadı.\n\nÖrnek:\n_XAUUSD long, 2650 → 2670, 2RR_",
            parse_mode="Markdown"
        )
        return

    # Hesap eşleştirme
    hesaplar = await api_get("/api/hesaplar")
    hesaplar = hesaplar if isinstance(hesaplar, list) else []
    hesap_isimleri = parsed.get("hesap_isimleri") or []
    eslesen_ids = hesaplari_eslestir(hesap_isimleri, metin, hesaplar)
    eslesen_hesaplar = [h for h in hesaplar if h["id"] in eslesen_ids]

    # Kaydedilecek veri
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

    # Onay mesajı
    await update.message.reply_text(
        onay_mesaji_olustur(islem_data, eslesen_hesaplar),
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardMarkup([["Evet", "Hayır"]], one_time_keyboard=True, resize_keyboard=True)
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
            await update.message.reply_text("❌ Görsel yüklenirken hata oluştu.")
            return
        gorsel_url = gorsel_data["url"]

        islem_data: dict = {"enstruman": "BILINMIYOR", "yon": "long", "kaynak": "telegram", "chart_gorseli_url": gorsel_url}

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
            f"✅ *Görsel kaydedildi!*\n\n{sonuc.get('enstruman', '?')} {(sonuc.get('yon') or '').upper()}"
            + ("\n\n_İpucu: Açıklama ekleyerek detayları otomatik kaydedebilirsiniz._" if len(caption) < 3 else ""),
            parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(f"fotoğraf hatası: {e}")
        await update.message.reply_text("❌ Görsel işlenirken hata oluştu.")


# ── Ana ──────────────────────────────────────────────────────

def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("yardim", cmd_start))
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
