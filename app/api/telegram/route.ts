import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseTradeMesaji } from '@/lib/claude'

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
  const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${json.result.file_path}`)
  return Buffer.from(await fileRes.arrayBuffer())
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

  if (message.text?.startsWith('/son')) {
    const { data } = await db.from('islemler').select('*').order('tarih_saat', { ascending: false }).limit(5)
    if (!data?.length) { await telegramMesajGonder(chatId, 'Henüz hiç işlem yok.'); return Response.json({ ok: true }) }
    const liste = data.map((i) => `📌 <b>${i.enstruman}</b> ${i.yon?.toUpperCase()} | PnL: ${i.pnl ?? '?'} | ${i.tarih_saat?.slice(0, 10)}`).join('\n')
    await telegramMesajGonder(chatId, `<b>Son 5 İşlem:</b>\n\n${liste}`)
    return Response.json({ ok: true })
  }

  if (message.photo) {
    const foto = message.photo[message.photo.length - 1]
    const buffer = await telegramDosyaIndir(foto.file_id)
    const dosyaAdi = `telegram-${Date.now()}.jpg`
    const { data: uploadData, error } = await db.storage.from('chart-gorselleri').upload(dosyaAdi, buffer, { contentType: 'image/jpeg' })
    if (error) { await telegramMesajGonder(chatId, '❌ Görsel yüklenirken hata oluştu.'); return Response.json({ ok: true }) }
    const { data: urlData } = db.storage.from('chart-gorselleri').getPublicUrl(uploadData.path)
    const caption = message.caption ?? ''

    const islemData: Record<string, unknown> = { enstruman: 'BILINMIYOR', yon: 'long', kaynak: 'telegram', chart_gorseli_url: urlData.publicUrl, hesap_idleri: [] }

    if (caption.length > 3) {
      try {
        const parsed = await parseTradeMesaji(caption)
        if (parsed.enstruman) {
          Object.assign(islemData, {
            enstruman: parsed.enstruman.toUpperCase(),
            yon: parsed.yon ?? 'long',
            giris_fiyati: parsed.giris_fiyati,
            cikis_fiyati: parsed.cikis_fiyati,
            breakeven_fiyati: parsed.breakeven_fiyati,
            pnl: parsed.pnl,
            rr_orani: parsed.rr_orani,
            notlar: parsed.notlar,
          })
        }
      } catch { /* caption parse edilemezse sadece görseli kaydet */ }
    }

    const { data: islem } = await db.from('islemler').insert([islemData]).select().single()
    await telegramMesajGonder(chatId, `✅ <b>Görsel kaydedildi!</b>\n\n${islem?.enstruman ?? '?'} ${islem?.yon ?? ''}`)
    return Response.json({ ok: true })
  }

  if (message.text) {
    let parsed
    try { parsed = await parseTradeMesaji(message.text) }
    catch { await telegramMesajGonder(chatId, '❌ Mesajı anlayamadım.'); return Response.json({ ok: true }) }

    if (!parsed.enstruman || !parsed.yon) {
      await telegramMesajGonder(chatId, '⚠️ Enstrüman veya yön bulunamadı.\n\nÖrnek: <i>XAUUSD long, 2650\'den 2670\'de çıktım, 2RR</i>')
      return Response.json({ ok: true })
    }

    const { data: islem, error } = await db.from('islemler').insert([{
      enstruman: parsed.enstruman.toUpperCase(),
      yon: parsed.yon,
      giris_fiyati: parsed.giris_fiyati,
      cikis_fiyati: parsed.cikis_fiyati,
      breakeven_fiyati: parsed.breakeven_fiyati,
      pnl: parsed.pnl,
      rr_orani: parsed.rr_orani,
      hesap_idleri: [],
      notlar: parsed.notlar,
      kaynak: 'telegram',
    }]).select().single()

    if (error) { await telegramMesajGonder(chatId, '❌ Kayıt sırasında hata oluştu.'); return Response.json({ ok: true }) }

    await telegramMesajGonder(chatId,
      `✅ <b>İşlem kaydedildi!</b>\n\n📌 ${islem.enstruman} ${islem.yon?.toUpperCase()}\n📥 Giriş: ${islem.giris_fiyati ?? '?'}\n📤 Çıkış: ${islem.cikis_fiyati ?? '?'}\n💰 PnL: ${islem.pnl ?? '?'}\n📊 RR: ${islem.rr_orani ?? '?'}`
    )
    return Response.json({ ok: true })
  }

  return Response.json({ ok: true })
}
