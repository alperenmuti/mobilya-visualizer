import { NextRequest } from 'next/server'

function getMeta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${prop}["']`, 'i'),
    new RegExp(`<meta[^>]*name=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']og:${prop}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

function getMeta2(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

function toAbsolute(url: string | null, base: string): string | null {
  if (!url) return null
  try {
    return new URL(url, base).href
  } catch {
    return url.startsWith('http') ? url : null
  }
}

function extractImageFromJsonLd(html: string): string | null {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const match of scripts) {
    try {
      const json = JSON.parse(match[1])
      const objs = Array.isArray(json) ? json : [json]
      for (const obj of objs) {
        const img = obj.image ?? obj.image?.[0]
        if (typeof img === 'string' && img.startsWith('http')) return img
        if (Array.isArray(img) && img[0]?.startsWith?.('http')) return img[0]
        if (typeof img === 'object' && img?.url?.startsWith?.('http')) return img.url
      }
    } catch { /* skip */ }
  }
  return null
}

function extractFirstProductImage(html: string, base: string): string | null {
  // Look for prominent product images (large src, no icon/logo patterns)
  const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*(class|id)=["'][^"']*(product|hero|main|featured|detail|zoom|gallery)[^"']*["'][^>]*>/gi
  const m = html.match(imgPattern)
  if (m) {
    const srcMatch = m[0].match(/src=["']([^"']+)["']/)
    if (srcMatch?.[1]) return toAbsolute(srcMatch[1], base)
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return Response.json({ error: 'URL gerekli' }, { status: 400 })

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
      ?? html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]

    const priceMatch = html.match(/₺\s?[\d.,]+|[\d.,]+\s?₺|\$[\d.,]+|[\d.,]+\s?\$/)

    const name = getMeta(html, 'title') ?? getMeta2(html, 'twitter:title') ?? titleTag ?? 'Ürün'

    const rawImage = getMeta(html, 'image')
      ?? getMeta2(html, 'twitter:image')
      ?? extractImageFromJsonLd(html)
      ?? extractFirstProductImage(html, url)

    const image_url = toAbsolute(rawImage, url)

    const description = getMeta(html, 'description') ?? getMeta2(html, 'description') ?? null
    const price = priceMatch?.[0]?.trim() ?? null

    return Response.json({ name: name.trim(), image_url, description, price, product_url: url })
  } catch (err) {
    return Response.json({ error: 'Ürün bilgileri alınamadı: ' + (err as Error).message }, { status: 500 })
  }
}
