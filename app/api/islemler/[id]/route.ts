import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { YeniIslem } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = supabaseAdmin()
  const { id } = await params

  const { data, error } = await db
    .from('islemler')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return Response.json({ error: 'İşlem bulunamadı' }, { status: 404 })
  return Response.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = supabaseAdmin()
  const { id } = await params
  const body = (await request.json()) as Partial<YeniIslem>

  if (body.enstruman) body.enstruman = body.enstruman.toUpperCase()

  const { data, error } = await db
    .from('islemler')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = supabaseAdmin()
  const { id } = await params

  const { error } = await db.from('islemler').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
