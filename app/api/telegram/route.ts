import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseTradeMesaji, getKoclukAnalizi } from '@/lib/claude'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!

async function telegramMesajGonder(chatId: number, metin: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: metin, parse_mode: 'HTML' }),
  })
}

async function telegramDosyaIndir(fileId: string): Promise<Buffer> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
  const json = (await res.json()) as { result: { file_path: string } }
  const filePath = json.result.file_path
  const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`)
  const arrayBuffer = await fileRes.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const update = await request.json()
  const message = update.message

  if (!message) return Response.json({ ok: true })

  const chatId: number = message.chat.id
  const db = supabaseAdmin()

  // Komut: /son
  if (message.text?.startsWith('/son')) {
    const { data } = await db
      .from('islemler')
      .select('*')
      .order('tarih_saat', { ascending: false })
      .limit(5)

    if (!data || data.length === 0) {
      await telegramMesajGonder(chatId, 'Henüz hiç işlem kaydı yok.')
      return Response.json({ ok: true })
    }

    const liste = data
      .map(
        (i) =>
          `📌 <b>${i.enstruman}</b> ${i.yon.toUpperCase()} | PnL: ${i.pnl ?? '?'} | RR: ${i.rr_orani ?? '?'}\n📅 ${new Date(i.tarih_saat).toLocaleDateString('tr-TR')}`
      )
      .join('\n\n')

    await telegramMesajGonder(chatId, `<b>Son 5 İşlem:</b>\n\n${liste}`)
    return Response.json({ ok: true })
  }

  // Komut: /ozet
  if (message.text?.startsWith('/ozet')) {
    const haftaBaslangic = new Date()
    haftaBaslangic.setDate(haftaBaslangic.getDate() - 7)

    const { data } = await db
      .from('islemler')
      .select('pnl, yon')
      .gte('tarih_saat', haftaBaslangic.toISOString())

    if (!data || data.length === 0) {
      await telegramMesajGonder(chatId, 'Bu hafta hiç işlem yok.')
      return Response.json({ ok: true })
    }

    const toplamPnl = data.reduce((sum, i) => sum + (i.pnl ?? 0), 0)
    const kazananlar = data.filter((i) => (i.pnl ?? 0) > 0).length
    const winRate = ((kazananlar / data.length) * 100).toFixed(0)

    await telegramMesajGonder(
      chatId,
      `<b>Bu Hafta Özet:</b>\n\n` +
        `📊 Toplam İşlem: ${data.length}\n` +
        `✅ Kazanan: ${kazananlar}\n` +
        `📈 Win Rate: %${winRate}\n` +
        `💰 Toplam PnL: ${toplamPnl > 0 ? '+' : ''}${toplamPnl.toFixed(2)}`
    )
    return Response.json({ ok: true })
  }

  // Komut: /kocluk
  if (message.text?.startsWith('/kocluk')) {
    await telegramMesajGonder(chatId, '⏳ Analiziniz hazırlanıyor...')

    const { data: islemler } = await db
      .from('islemler')
      .select('*')
      .order('tarih_saat', { ascending: false })
      .limit(20)

    const { analiz } = await getKoclukAnalizi(islemler ?? [])
    const kisa = analiz.length > 3000 ? analiz.slice(0, 3000) + '...' : analiz
    await telegramMesajGonder(chatId, `🎯 <b>Koçluk Analizi:</b>\n\n${kisa}`)
    return Response.json({ ok: true })
  }

  // Komut: /yardim
  if (message.text?.startsWith('/yardim') || message.text?.startsWith('/start')) {
    await telegramMesajGonder(
      chatId,
      `<b>Trade Journal Bot</b>\n\n` +
        `İşlem girmek için mesaj yaz:\n` +
        `<i>XAUUSD long, 2650'den girdim 2670'de çıktım, 2RR, prop hesap</i>\n\n` +
        `<b>Komutlar:</b>\n` +
        `/son — Son 5 işlem\n` +
        `/ozet — Bu haftanın özeti\n` +
        `/kocluk — AI koçluk analizi\n` +
        `/yardim — Bu mesaj`
    )
    return Response.json({ ok: true })
  }

  // Fotoğraf
  if (message.photo) {
    const enBuyukFoto = message.photo[message.photo.length - 1]
    const buffer = await telegramDosyaIndir(enBuyukFoto.file_id)

    const dosyaAdi = `telegram-${Date.now()}.jpg`
    const { data: uploadData, error } = await db.storage
      .from('chart-gorselleri')
      .upload(dosyaAdi, buffer, { contentType: 'image/jpeg', upsert: false })

    if (error) {
      await telegramMesajGonder(chatId, '❌ Görsel yüklenirken hata oluştu.')
      return Response.json({ ok: true })
    }

    const { data: urlData } = db.storage
      .from('chart-gorselleri')
      .getPublicUrl(uploadData.path)

    const caption = message.caption ?? ''
    let islemData: Record<string, unknown> = {
      enstruman: 'BILINMIYOR',
      yon: 'long',
      kaynak: 'telegram',
      chart_gorseli_url: urlData.publicUrl,
    }

    if (caption.length > 3) {
      try {
        const parsed = await parseTradeMesaji(caption)
        islemData = {
          ...islemData,
          enstruman: parsed.enstruman ?? 'BILINMIYOR',
          yon: parsed.yon ?? 'long',
          giris_fiyati: parsed.giris_fiyati,
          cikis_fiyati: parsed.cikis_fiyati,
          breakeven_fiyati: parsed.breakeven_fiyati,
          pnl: parsed.pnl,
          rr_orani: parsed.rr_orani,
          hesap_turu: parsed.hesap_turu,
          notlar: parsed.notlar,
        }
      } catch {
        // Caption parse edilemezse sadece görseli kaydet
      }
    }

    const { data: islem } = await db.from('islemler').insert([islemData]).select().single()

    await telegramMesajGonder(
      chatId,
      `✅ <b>Görsel kaydedildi!</b>\n\n` +
        `${islem?.enstruman ?? '?'} ${islem?.yon ?? ''}\n` +
        (caption.length < 3 ? '\n<i>İpucu: Açıklama ekleyerek işlem detaylarını da kaydedebilirsiniz.</i>' : '')
    )
    return Response.json({ ok: true })
  }

  // Düz metin mesajı — işlem parse et
  if (message.text) {
    let parsed
    try {
      parsed = await parseTradeMesaji(message.text)
    } catch {
      await telegramMesajGonder(chatId, '❌ Mesajı anlayamadım. /yardim yazarak örnek format görebilirsiniz.')
      return Response.json({ ok: true })
    }

    if (!parsed.enstruman || !parsed.yon) {
      await telegramMesajGonder(
        chatId,
        '⚠️ Enstrüman veya yön bulunamadı.\n\nÖrnek: <i>XAUUSD long, 2650\'den girdim 2670\'de çıktım, 2RR, prop hesap</i>'
      )
      return Response.json({ ok: true })
    }

    const { data: islem, error } = await db
      .from('islemler')
      .insert([
        {
          enstruman: parsed.enstruman.toUpperCase(),
          yon: parsed.yon,
          giris_fiyati: parsed.giris_fiyati,
          cikis_fiyati: parsed.cikis_fiyati,
          breakeven_fiyati: parsed.breakeven_fiyati,
          pnl: parsed.pnl,
          rr_orani: parsed.rr_orani,
          hesap_turu: parsed.hesap_turu,
          notlar: parsed.notlar,
          kaynak: 'telegram',
        },
      ])
      .select()
      .single()

    if (error) {
      await telegramMesajGonder(chatId, '❌ Kayıt sırasında hata oluştu.')
      return Response.json({ ok: true })
    }

    await telegramMesajGonder(
      chatId,
      `✅ <b>İşlem kaydedildi!</b>\n\n` +
        `📌 ${islem.enstruman} ${islem.yon.toUpperCase()}\n` +
        `📥 Giriş: ${islem.giris_fiyati ?? '?'}\n` +
        `📤 Çıkış: ${islem.cikis_fiyati ?? '?'}\n` +
        `💰 PnL: ${islem.pnl ?? '?'}\n` +
        `📊 RR: ${islem.rr_orani ?? '?'}\n` +
        `🏦 Hesap: ${islem.hesap_turu ?? '?'}`
    )
    return Response.json({ ok: true })
  }

  return Response.json({ ok: true })
}
