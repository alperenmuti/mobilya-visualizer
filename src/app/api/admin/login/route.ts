import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    const adminEmail = process.env.ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminEmail || !adminPassword) {
      return Response.json({ error: 'Admin yapılandırılmamış' }, { status: 500 })
    }

    if (email !== adminEmail || password !== adminPassword) {
      // Prevent timing attacks with a small delay
      await new Promise(r => setTimeout(r, 300))
      return Response.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 })
    }

    const cookieStore = await cookies()
    cookieStore.set('admin_session', Buffer.from(`${email}:${Date.now()}`).toString('base64'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    })

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  return Response.json({ ok: true })
}
