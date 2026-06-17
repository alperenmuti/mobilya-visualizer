import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

async function verifyAdmin() {
  const cookieStore = await cookies()
  return !!cookieStore.get('admin_session')?.value
}

export async function GET(_req: NextRequest) {
  if (!await verifyAdmin()) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')) {
    return Response.json({ items: [] })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase.from('furniture_items').select('*').order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ items: data })
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin()) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, image_url, product_url, category, price, description } = body

  if (!name || !image_url) return Response.json({ error: 'Ad ve görsel URL gerekli' }, { status: 400 })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')) {
    return Response.json({ item: { id: Date.now().toString(), name, image_url, product_url, category, price, description, created_at: new Date().toISOString() } })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase
    .from('furniture_items')
    .insert([{ name, image_url, product_url, category, price, description }])
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ item: data })
}

export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin()) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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
