import { NextRequest } from 'next/server'
import { gorseldenIslemCikar } from '@/lib/claude'

export async function POST(request: NextRequest) {
  const { gorsel_url, gorsel_base64, media_type, caption } = await request.json()

  if (!gorsel_url && !gorsel_base64) {
    return Response.json({ error: 'gorsel_url veya gorsel_base64 zorunlu' }, { status: 400 })
  }

  try {
    const gorsel = gorsel_base64
      ? { base64: gorsel_base64 as string, mediaType: (media_type as string) ?? 'image/jpeg' }
      : { url: gorsel_url as string }

    const parsed = await gorseldenIslemCikar(gorsel, caption ?? undefined)
    return Response.json(parsed)
  } catch (e) {
    console.error('gorsel-analiz hata:', e)
    return Response.json({
      enstruman: null, yon: null, giris_fiyati: null, cikis_fiyati: null,
      breakeven_fiyati: null, pnl: null, rr_orani: null, hesap_isimleri: [], notlar: null,
    })
  }
}
