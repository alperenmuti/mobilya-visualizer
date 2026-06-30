import { NextRequest } from 'next/server'
import { createHash } from 'crypto'

function verifyAdmin(req: NextRequest): boolean {
  if (req.cookies.get('admin_session')?.value) return true
  const auth = req.headers.get('authorization') ?? ''
  return auth.startsWith('Bearer ') && auth.length > 7
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')) {
    return Response.json({ tenants: [] })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await supabase.from('tenants').select('*').order('name')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ tenants: data })
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, slug } = await req.json()
  if (!name || !slug) return Response.json({ error: 'Ad ve slug gerekli' }, { status: 400 })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')) {
    return Response.json({ tenant: { id: Date.now().toString(), name, slug, created_at: new Date().toISOString() } })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await supabase.from('tenants').insert([{ name, slug }]).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ tenant: data })
}

export async function PATCH(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, login_email, login_password } = await req.json()
  if (!id) return Response.json({ error: 'ID gerekli' }, { status: 400 })

  const updates: Record<string, string | null> = {}
  if (login_email !== undefined) updates.login_email = login_email ? login_email.toLowerCase().trim() : null
  if (login_password) updates.login_password_hash = createHash('sha256').update(login_password).digest('hex')

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await supabase.from('tenants').update(updates).eq('id', id).select('id, login_email').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, tenant: data })
}

export async function DELETE(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return Response.json({ error: 'ID gerekli' }, { status: 400 })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('your_')) {
    return Response.json({ ok: true })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error } = await supabase.from('tenants').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
