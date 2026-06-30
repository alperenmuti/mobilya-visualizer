import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = req.cookies.get('tenant_session')?.value
  if (!session) return NextResponse.json({ tenant: null })

  try {
    const decoded = Buffer.from(session, 'base64').toString('utf8')
    const [id, slug] = decoded.split(':')
    if (!id || !slug) return NextResponse.json({ tenant: null })

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data } = await supabase
      .from('tenants')
      .select('id, name, slug, credits')
      .eq('id', id)
      .single()

    if (!data) return NextResponse.json({ tenant: null })
    return NextResponse.json({ tenant: data })
  } catch {
    return NextResponse.json({ tenant: null })
  }
}
