import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { YeniIslem } from '@/lib/types'

export async function GET(request: NextRequest) {
  const db = supabaseAdmin()
  const params = request.nextUrl.searchParams
  const hesap = params.get('hesap')
  const enstruman = params.get('enstruman')

  let query = db
    .from('islemler')
    .select('*')
    .order('tarih_saat', { ascending: false })

  if (hesap) query = query.eq('hesap_turu', hesap)
  if (enstruman) query = query.ilike('enstruman', `%${enstruman}%`)

  const { data, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: NextRequest) {
  const db = supabaseAdmin()
  const body = (await request.json()) as Partial<YeniIslem>

  if (!body.enstruman || !body.yon) {
    return Response.json({ error: 'enstruman ve yon zorunludur' }, { status: 400 })
  }

  const { data, error } = await db
    .from('islemler')
    .insert([
      {
        enstruman: body.enstruman.toUpperCase(),
        yon: body.yon,
        tarih_saat: body.tarih_saat ?? new Date().toISOString(),
        giris_fiyati: body.giris_fiyati ?? null,
        cikis_fiyati: body.cikis_fiyati ?? null,
        breakeven_fiyati: body.breakeven_fiyati ?? null,
        pnl: body.pnl ?? null,
        rr_orani: body.rr_orani ?? null,
        hesap_turu: body.hesap_turu ?? null,
        chart_gorseli_url: body.chart_gorseli_url ?? null,
        notlar: body.notlar ?? null,
        kaynak: body.kaynak ?? 'dashboard',
      },
    ])
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
