import { NextRequest } from 'next/server'
import { getCredits, addCredits, setCredits } from '@/lib/credits'
import { createClient } from '@supabase/supabase-js'

function verifyAdmin(req: NextRequest): boolean {
  if (req.cookies.get('admin_session')?.value) return true
  const auth = req.headers.get('authorization') ?? ''
  return auth.startsWith('Bearer ') && auth.length > 7
}

/** GET /api/credits?brand=slug — public, returns current balance */
export async function GET(req: NextRequest) {
  const brand = new URL(req.url).searchParams.get('brand')
  if (!brand) return Response.json({ error: 'brand gerekli' }, { status: 400 })
  const credits = await getCredits(brand)
  if (credits === null) return Response.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  return Response.json({ credits })
}

/** POST /api/credits — admin only, add or set credits for a tenant */
export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, amount, action } = await req.json() as {
    id: string
    amount: number
    action: 'add' | 'set'
  }

  if (!id || typeof amount !== 'number') {
    return Response.json({ error: 'id ve amount gerekli' }, { status: 400 })
  }

  if (action === 'set') {
    await setCredits(id, Math.max(0, amount))
    return Response.json({ ok: true, credits: Math.max(0, amount) })
  }

  const newTotal = await addCredits(id, amount)
  return Response.json({ ok: true, credits: newTotal })
}
