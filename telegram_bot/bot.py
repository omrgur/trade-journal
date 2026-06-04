"""
Trade Journal Telegram Botu
Çalıştırmak için: python bot.py
"""
import os
import logging
import httpx
from telegram import Update
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    ContextTypes, filters
)
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
API_URL = os.environ["NEXT_PUBLIC_APP_URL"]  # Örn: https://trade-journal.vercel.app

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

client = httpx.AsyncClient(timeout=30)


# ─── Yardımcılar ──────────────────────────────────────────────────────────────

async def api_post(endpoint: str, **kwargs) -> dict:
    res = await client.post(f"{API_URL}{endpoint}", **kwargs)
    return res.json()


async def api_get(endpoint: str) -> dict:
    res = await client.get(f"{API_URL}{endpoint}")
    return res.json()


# ─── Komutlar ─────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📈 *Trade Journal Bot*\n\n"
        "İşlem girmek için mesaj yaz:\n"
        "_XAUUSD long, 2650'den girdim 2670'de çıktım, 2RR, prop hesap_\n\n"
        "*Komutlar:*\n"
        "/son — Son 5 işlem\n"
        "/ozet — Bu haftanın özeti\n"
        "/kocluk — AI koçluk analizi\n"
        "/yardim — Bu mesaj",
        parse_mode="Markdown"
    )


async def cmd_yardim(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await cmd_start(update, context)


async def cmd_son(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        islemler = await api_get("/api/islemler")
        if not islemler or not isinstance(islemler, list):
            await update.message.reply_text("Henüz hiç işlem kaydı yok.")
            return

        son_5 = islemler[:5]
        mesaj = "*Son 5 İşlem:*\n\n"
        for i in son_5:
            pnl = i.get("pnl")
            pnl_str = f"+{pnl}" if pnl and pnl > 0 else str(pnl) if pnl is not None else "?"
            tarih = i.get("tarih_saat", "")[:10] if i.get("tarih_saat") else "?"
            mesaj += (
                f"📌 *{i.get('enstruman', '?')}* {i.get('yon', '').upper()} "
                f"| PnL: {pnl_str} | RR: {i.get('rr_orani', '?')}\n"
                f"📅 {tarih}\n\n"
            )
        await update.message.reply_text(mesaj, parse_mode="Markdown")
    except Exception as e:
        logger.error(f"cmd_son hata: {e}")
        await update.message.reply_text("❌ İşlemler yüklenirken hata oluştu.")


async def cmd_ozet(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        islemler = await api_get("/api/islemler")
        if not islemler or not isinstance(islemler, list):
            await update.message.reply_text("Henüz hiç işlem yok.")
            return

        from datetime import datetime, timedelta, timezone
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
            f"💰 Toplam PnL: {pnl_str}",
            parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(f"cmd_ozet hata: {e}")
        await update.message.reply_text("❌ Özet hesaplanırken hata oluştu.")


async def cmd_kocluk(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("⏳ Analiziniz hazırlanıyor...")
    try:
        data = await api_get("/api/claude/kocluk")
        analiz = data.get("analiz", "Analiz yapılamadı.")
        # Telegram 4096 karakter limiti
        if len(analiz) > 3800:
            analiz = analiz[:3800] + "..."
        await update.message.reply_text(f"🎯 *Koçluk Analizi:*\n\n{analiz}", parse_mode="Markdown")
    except Exception as e:
        logger.error(f"cmd_kocluk hata: {e}")
        await update.message.reply_text("❌ Analiz yapılırken hata oluştu.")


# ─── Metin mesajı (işlem girişi) ──────────────────────────────────────────────

async def metin_mesaji(update: Update, context: ContextTypes.DEFAULT_TYPE):
    metin = update.message.text
    if not metin:
        return

    try:
        # Telegram webhook endpoint'e ilet
        data = await api_post(
            "/api/telegram",
            json={"message": {"chat": {"id": update.message.chat_id}, "text": metin}},
            headers={"x-telegram-bot-api-secret-token": os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")}
        )
        # Webhook cevabı zaten mesaj gönderiyorsa tekrar gönderme
        # Polling modunda webhook kullanmıyoruz — burada doğrudan parse edelim
        await _isle_metin(update, metin)
    except Exception as e:
        logger.error(f"metin_mesaji hata: {e}")
        await _isle_metin(update, metin)


async def _isle_metin(update: Update, metin: str):
    """Doğrudan parse ve kaydet (polling modu için)"""
    try:
        parse_res = await api_post(
            "/api/claude/parse",
            json={"mesaj": metin},
        )

        if not parse_res.get("enstruman") or not parse_res.get("yon"):
            await update.message.reply_text(
                "⚠️ Enstrüman veya yön bulunamadı.\n\n"
                "Örnek: _XAUUSD long, 2650'den girdim 2670'de çıktım, 2RR, prop hesap_",
                parse_mode="Markdown"
            )
            return

        islem_data = {
            "enstruman": (parse_res.get("enstruman") or "").upper(),
            "yon": parse_res.get("yon"),
            "giris_fiyati": parse_res.get("giris_fiyati"),
            "cikis_fiyati": parse_res.get("cikis_fiyati"),
            "breakeven_fiyati": parse_res.get("breakeven_fiyati"),
            "pnl": parse_res.get("pnl"),
            "rr_orani": parse_res.get("rr_orani"),
            "hesap_turu": parse_res.get("hesap_turu"),
            "notlar": parse_res.get("notlar"),
            "kaynak": "telegram",
        }

        islem = await api_post("/api/islemler", json=islem_data)

        pnl = islem.get("pnl")
        pnl_str = f"+{pnl}" if pnl and pnl > 0 else str(pnl) if pnl is not None else "?"

        await update.message.reply_text(
            f"✅ *İşlem kaydedildi!*\n\n"
            f"📌 {islem.get('enstruman', '?')} {(islem.get('yon') or '').upper()}\n"
            f"📥 Giriş: {islem.get('giris_fiyati', '?')}\n"
            f"📤 Çıkış: {islem.get('cikis_fiyati', '?')}\n"
            f"💰 PnL: {pnl_str}\n"
            f"📊 RR: {islem.get('rr_orani', '?')}\n"
            f"🏦 Hesap: {islem.get('hesap_turu', '?')}",
            parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(f"_isle_metin hata: {e}")
        await update.message.reply_text("❌ İşlem kaydedilirken hata oluştu. Lütfen tekrar deneyin.")


# ─── Fotoğraf mesajı ──────────────────────────────────────────────────────────

async def fotograf_mesaji(update: Update, context: ContextTypes.DEFAULT_TYPE):
    foto = update.message.photo[-1]  # En büyük boyut
    caption = update.message.caption or ""

    try:
        # Telegram'dan dosyayı indir
        foto_dosyasi = await context.bot.get_file(foto.file_id)
        foto_bytes = await foto_dosyasi.download_as_bytearray()

        # API'ye yükle
        gorsel_res = await client.post(
            f"{API_URL}/api/gorsel-yukle",
            files={"file": ("chart.jpg", bytes(foto_bytes), "image/jpeg")}
        )
        gorsel_data = gorsel_res.json()

        if "error" in gorsel_data:
            await update.message.reply_text("❌ Görsel yüklenirken hata oluştu.")
            return

        gorsel_url = gorsel_data["url"]

        # Caption varsa parse et
        islem_data: dict = {
            "enstruman": "BILINMIYOR",
            "yon": "long",
            "kaynak": "telegram",
            "chart_gorseli_url": gorsel_url,
        }

        if len(caption) > 3:
            try:
                parse_res = await api_post("/api/claude/parse", json={"mesaj": caption})
                if parse_res.get("enstruman"):
                    islem_data.update({
                        "enstruman": parse_res["enstruman"].upper(),
                        "yon": parse_res.get("yon") or "long",
                        "giris_fiyati": parse_res.get("giris_fiyati"),
                        "cikis_fiyati": parse_res.get("cikis_fiyati"),
                        "breakeven_fiyati": parse_res.get("breakeven_fiyati"),
                        "pnl": parse_res.get("pnl"),
                        "rr_orani": parse_res.get("rr_orani"),
                        "hesap_turu": parse_res.get("hesap_turu"),
                        "notlar": parse_res.get("notlar"),
                    })
            except Exception:
                pass  # Caption parse edilemezse sadece görseli kaydet

        islem = await api_post("/api/islemler", json=islem_data)

        await update.message.reply_text(
            f"✅ *Görsel kaydedildi!*\n\n"
            f"📌 {islem.get('enstruman', '?')} {(islem.get('yon') or '').upper()}\n"
            + ("" if caption else "\n_İpucu: Açıklama ekleyerek işlem detaylarını da kaydedebilirsiniz._"),
            parse_mode="Markdown"
        )
    except Exception as e:
        logger.error(f"fotograf_mesaji hata: {e}")
        await update.message.reply_text("❌ Görsel işlenirken hata oluştu.")


# ─── Ana ──────────────────────────────────────────────────────────────────────

def main():
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("yardim", cmd_yardim))
    app.add_handler(CommandHandler("son", cmd_son))
    app.add_handler(CommandHandler("ozet", cmd_ozet))
    app.add_handler(CommandHandler("kocluk", cmd_kocluk))
    app.add_handler(MessageHandler(filters.PHOTO, fotograf_mesaji))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, metin_mesaji))

    logger.info("Bot başlatıldı — polling modunda çalışıyor")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
