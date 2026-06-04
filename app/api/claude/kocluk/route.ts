import { supabaseAdmin } from '@/lib/supabase'
import { getKoclukAnalizi } from '@/lib/claude'

export async function GET() {
  const db = supabaseAdmin()

  const { data: islemler, error } = await db
    .from('islemler')
    .select('*')
    .order('tarih_saat', { ascending: false })
    .limit(20)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const sonuc = await getKoclukAnalizi(islemler ?? [])
  return Response.json(sonuc)
}
