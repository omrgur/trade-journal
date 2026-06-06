import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side (dashboard)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side (API routes) — service role key, storage upload ve admin işlemleri için
export function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey
  return createClient(supabaseUrl, serviceKey)
}
