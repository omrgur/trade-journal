import { supabaseAdmin } from '@/lib/supabase'
import { getSonrasıSoruları } from '@/lib/claude'
import type { Islem } from '@/lib/types'

export async function GET() {
  const db = supabaseAdmin()
  const { data: islemler } = await db
    .from('islemler')
    .select('*')
    .order('tarih_saat', { ascending: false })
    .limit(1)

  if (!islemler || islemler.length === 0) {
    return Response.json({ sorular: [], analiz: 'Henüz işlem yok.' })
  }

  const sorular = await getSonrasıSoruları(islemler[0] as Islem)
  return Response.json({ sorular, analiz: '' })
}
