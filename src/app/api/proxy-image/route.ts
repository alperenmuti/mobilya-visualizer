import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const imageUrl = searchParams.get('url')
  if (!imageUrl) return Response.json({ error: 'url gerekli' }, { status: 400 })

  try {
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) throw new Error(`${res.status}`)
    const buffer = await res.arrayBuffer()
    const mime = res.headers.get('content-type') ?? 'image/jpeg'
    const base64 = Buffer.from(buffer).toString('base64')
    return Response.json({ dataUrl: `data:${mime};base64,${base64}` })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 })
  }
}
