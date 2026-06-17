import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return Response.json({ error: 'URL gerekli' }, { status: 400 })

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MobilyaBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()

    // Extract OpenGraph / meta tags
    const og = (prop: string) => {
      const m = html.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
        ?? html.match(new RegExp(`<meta[^>]*name=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
        ?? html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${prop}["']`, 'i'))
      return m?.[1] ?? null
    }

    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
      ?? html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]

    const priceMatch = html.match(/₺\s?[\d.,]+|[\d.,]+\s?₺|\$[\d.,]+|[\d.,]+\s?\$/)

    const name = og('title') ?? titleTag ?? 'Ürün'
    const image_url = og('image') ?? null
    const description = og('description') ?? null
    const price = priceMatch?.[0]?.trim() ?? null

    return Response.json({ name: name.trim(), image_url, description, price, product_url: url })
  } catch (err) {
    return Response.json({ error: 'Ürün bilgileri alınamadı: ' + (err as Error).message }, { status: 500 })
  }
}
