import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    const adminEmail = process.env.ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      return NextResponse.json({ error: 'Admin yapılandırılmamış' }, { status: 500 })
    }

    if (email !== adminEmail || password !== adminPassword) {
      await new Promise(r => setTimeout(r, 300))
      return NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 })
    }

    const sessionValue = Buffer.from(`${email}:${Date.now()}`).toString('base64')
    const response = NextResponse.json({ ok: true })
    response.cookies.set('admin_session', sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })
    return response
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('admin_session')
  return response
}
