import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('hesaplar')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: NextRequest) {
  const db = supabaseAdmin()
  const body = await request.json()

  if (!body.isim || !body.kategori) {
    return Response.json({ error: 'isim ve kategori zorunludur' }, { status: 400 })
  }

  const { data, error } = await db
    .from('hesaplar')
    .insert([{
      isim: body.isim,
      firma: body.firma ?? null,
      kategori: body.kategori,
      renk: body.renk ?? '#5b50e8',
      aktif: true,
    }])
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
