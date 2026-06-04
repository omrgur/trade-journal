import { NextRequest } from 'next/server'
import { parseTradeMesaji } from '@/lib/claude'

export async function POST(request: NextRequest) {
  const { mesaj } = await request.json()

  if (!mesaj || typeof mesaj !== 'string') {
    return Response.json({ error: 'mesaj alanı zorunlu' }, { status: 400 })
  }

  const parsed = await parseTradeMesaji(mesaj)
  return Response.json(parsed)
}
