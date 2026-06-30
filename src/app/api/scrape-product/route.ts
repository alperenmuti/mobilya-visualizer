import { NextRequest } from 'next/server'

// Microlink renders JS and extracts metadata universally (100 req/day free, no key needed)
async function scrapeViaMicrolink(url: string) {
  const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false`, {
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Microlink HTTP ${res.status}`)
  const json = await res.json()
  if (json.status !== 'success') throw new Error(json.message ?? 'Microlink hata')
  const d = json.data
  return {
    name: d.title ?? null,
    image_url: d.image?.url ?? null,
    description: d.description ?? null,
    price: null as string | null,
    product_url: url,
  }
}

// Fallback: plain HTML scraper for sites that don't need JS
function getMeta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${prop}["']`, 'i'),
    new RegExp(`<meta[^>]*name=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${prop}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

function toAbsolute(url: string | null, base: string): string | null {
  if (!url) return null
  try { return new URL(url, base).href } catch { return url.startsWith('http') ? url : null }
}

function extractImageFromJsonLd(html: string): string | null {
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const objs: unknown[] = [].concat(JSON.parse(match[1]))
      for (const obj of objs as Record<string, unknown>[]) {
        const img = obj.image
        if (typeof img === 'string' && img.startsWith('http')) return img
        if (Array.isArray(img) && typeof img[0] === 'string') return img[0]
        if (img && typeof img === 'object' && typeof (img as Record<string, unknown>).url === 'string') return (img as Record<string, unknown>).url as string
      }
    } catch { /* skip */ }
  }
  return null
}

async function scrapeViaHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  const priceMatch = html.match(/₺\s?[\d.,]+|[\d.,]+\s?₺|\$[\d.,]+|[\d.,]+\s?\$/)

  const rawImage = getMeta(html, 'og:image')
    ?? getMeta(html, 'twitter:image')
    ?? extractImageFromJsonLd(html)

  return {
    name: (getMeta(html, 'og:title') ?? getMeta(html, 'twitter:title') ?? titleTag ?? 'Ürün').trim(),
    image_url: toAbsolute(rawImage, url),
    description: getMeta(html, 'og:description') ?? getMeta(html, 'description') ?? null,
    price: priceMatch?.[0]?.trim() ?? null,
    product_url: url,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return Response.json({ error: 'URL gerekli' }, { status: 400 })

    // Try Microlink first (handles JS-rendered sites)
    try {
      const result = await scrapeViaMicrolink(url)
      if (result.image_url) return Response.json(result)
      // Microlink succeeded but no image — fall through to HTML scraper for price etc.
      const html = await scrapeViaHtml(url).catch(() => null)
      return Response.json({
        ...result,
        price: html?.price ?? null,
        image_url: result.image_url ?? html?.image_url ?? null,
      })
    } catch {
      // Microlink failed — fall back to direct HTML fetch
      const result = await scrapeViaHtml(url)
      return Response.json(result)
    }
  } catch (err) {
    return Response.json({ error: 'Ürün bilgileri alınamadı: ' + (err as Error).message }, { status: 500 })
  }
}
