import { NextRequest } from 'next/server'
import { gorseldenIslemCikar } from '@/lib/claude'

export async function POST(request: NextRequest) {
  const { gorsel_url, caption } = await request.json()
  if (!gorsel_url) return Response.json({ error: 'gorsel_url zorunlu' }, { status: 400 })
  const parsed = await gorseldenIslemCikar(gorsel_url, caption || undefined)
  return Response.json(parsed)
}
