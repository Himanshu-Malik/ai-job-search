import { createClient } from '@supabase/supabase-js'

// Browser-safe client (uses anon key)
// Use this for reading public data
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server-only admin client (uses service_role key)
// Use this for writing data, bypassing RLS
// NEVER import this in a component file
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)