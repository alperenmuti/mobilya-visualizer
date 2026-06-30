import { NextRequest } from 'next/server'

function getOgTag(html: string, prop: string): string | null {
  // Handles both quote types and both attribute orderings
  const re1 = new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i')
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null
}

function getMetaName(html: string, name: string): string | null {
  const re1 = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i')
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null
}

function toAbsolute(url: string | null, base: string): string | null {
  if (!url) return null
  try { return new URL(url, base).href } catch { return url.startsWith('http') ? url : null }
}

// Extracts product JSON object from inline JS (e.g. dataLayer / tracking scripts)
function extractProductJson(html: string): Record<string, unknown> | null {
  // Try various "reference" values used by Turkish e-commerce platforms
  const refPatterns = ['"product detail"', '"product"', '"Product"', '"urun"']
  for (const ref of refPatterns) {
    const refIdx = html.indexOf(`"reference":${ref}`)
    if (refIdx >= 0) {
      const start = html.lastIndexOf('{', refIdx)
      const end = html.indexOf('}', refIdx)
      if (start >= 0 && end >= 0) {
        try { return JSON.parse(html.slice(start, end + 1)) } catch { /* skip */ }
      }
    }
  }

  // Fallback: JSON-LD Product schema
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(m[1])
      const items = Array.isArray(json) ? json : [json]
      for (const item of items) {
        if (item['@type'] === 'Product') return item
      }
    } catch { /* skip */ }
  }
  return null
}

function formatPrice(raw: unknown): string | null {
  if (!raw) return null
  if (typeof raw === 'number') {
    const n = Math.round(raw)
    return n.toLocaleString('tr-TR') + ' ₺'
  }
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  return null
}

function decodeUnicode(s: string): string {
  return s.replace(/\\u([\da-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

async function fetchHtml(url: string): Promise<string> {
  // Use ScrapingAnt when available — bypasses Cloudflare from cloud IPs
  const antKey = process.env.SCRAPINGANT_KEY
  if (antKey) {
    const antUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(url)}&browser=false&return_page_source=true`
    const res = await fetch(antUrl, {
      headers: { 'x-api-key': antKey },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`ScrapingAnt HTTP ${res.status}`)
    const json = await res.json()
    return json.content ?? ''
  }

  // Direct fetch (works locally, blocked on Vercel for Cloudflare-protected sites)
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
    },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return Response.json({ error: 'URL gerekli' }, { status: 400 })

    const html = await fetchHtml(url)

    // --- Name ---
    const h1 = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i)?.[1]
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
      ?.replace(/\s*\|\s*[^|]+$/, '').trim() // strip "| Brand" suffix
    const rawName = getOgTag(html, 'title') ?? h1 ?? titleTag ?? 'Ürün'

    // --- Image ---
    const rawImage = getOgTag(html, 'image') ?? getMetaName(html, 'twitter:image')
    const image_url = toAbsolute(rawImage, url)

    // --- Description ---
    const description = getOgTag(html, 'description') ?? getMetaName(html, 'description') ?? null

    // --- Product JSON (price + category) ---
    const productObj = extractProductJson(html)
    const p = productObj as Record<string, unknown> | null
    const price = formatPrice(p?.price ?? (p?.offers as Record<string,unknown>)?.price ?? p?.Price)
    // JSON.parse already decodes \uXXXX — no extra decoding needed
    const rawCat = p?.category ?? p?.categoryName ?? null
    const category = typeof rawCat === 'string' ? rawCat : null

    return Response.json({
      name: rawName.trim(),
      image_url,
      description: description ?? null,
      price,
      category,
      product_url: url,
      _debug: { htmlSize: html.length, hasH1: !!h1, hasOgImage: !!rawImage, hasRef: html.includes('"reference":"product detail"') },
    })
  } catch (err) {
    return Response.json({ error: 'Ürün bilgileri alınamadı: ' + (err as Error).message }, { status: 500 })
  }
}
