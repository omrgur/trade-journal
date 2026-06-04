import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return Response.json({ error: 'Dosya bulunamadı' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const dosyaAdi = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const buffer = await file.arrayBuffer()

  const { data, error } = await db.storage
    .from('chart-gorselleri')
    .upload(dosyaAdi, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { data: urlData } = db.storage
    .from('chart-gorselleri')
    .getPublicUrl(data.path)

  return Response.json({ url: urlData.publicUrl })
}
