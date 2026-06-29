import { NextRequest } from 'next/server'

function verifyAdmin(req: NextRequest): boolean {
  if (req.cookies.get('admin_session')?.value) return true
  const auth = req.headers.get('authorization') ?? ''
  return auth.startsWith('Bearer ') && auth.length > 7
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')) {
    return Response.json({ items: [] })
  }

  const tenantId = req.nextUrl.searchParams.get('tenant_id')

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  let query = supabase.from('furniture_items').select('*').order('created_at', { ascending: false })
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data })
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, image_url, product_url, category, price, description, tenant_id } = body

  if (!name || !image_url) return Response.json({ error: 'Ad ve görsel URL gerekli' }, { status: 400 })
  if (!tenant_id) return Response.json({ error: 'İşletme seçilmedi' }, { status: 400 })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')) {
    return Response.json({ item: { id: Date.now().toString(), name, image_url, product_url, category, price, description, tenant_id, created_at: new Date().toISOString() } })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase
    .from('furniture_items')
    .insert([{ name, image_url, product_url, category, price, description, tenant_id }])
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return Response.json({ error: 'ID gerekli' }, { status: 400 })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')) {
    return Response.json({ ok: true })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error } = await supabase.from('furniture_items').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
