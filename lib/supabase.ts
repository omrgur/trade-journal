import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side (dashboard)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side (API routes) — kişisel uygulama, RLS devre dışı
export function supabaseAdmin() {
  return createClient(supabaseUrl, supabaseAnonKey)
}
