import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')) {
    return Response.json({ tenants: [] })
  }

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await supabase.from('tenants').select('id, name, slug, logo_url').order('name')
    if (error) throw error
    return Response.json({ tenants: data ?? [] })
  } catch {
    return Response.json({ tenants: [] })
  }
}
