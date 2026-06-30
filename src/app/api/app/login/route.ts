import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'E-posta ve şifre gerekli' }, { status: 400 })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, login_email, login_password_hash')
    .eq('login_email', email.toLowerCase().trim())
    .single()

  if (!tenant?.login_password_hash) {
    await new Promise(r => setTimeout(r, 300))
    return NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 })
  }

  const incoming = Buffer.from(hashPassword(password))
  const stored = Buffer.from(tenant.login_password_hash)
  const match = incoming.length === stored.length && timingSafeEqual(incoming, stored)

  if (!match) {
    await new Promise(r => setTimeout(r, 300))
    return NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 })
  }

  const sessionValue = Buffer.from(`${tenant.id}:${tenant.slug}:${Date.now()}`).toString('base64')
  const response = NextResponse.json({ ok: true, slug: tenant.slug })
  response.cookies.set('tenant_session', sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('tenant_session')
  return response
}
