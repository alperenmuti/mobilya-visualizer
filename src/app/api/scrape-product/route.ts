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

const EN_TO_TR_CATEGORY: Record<string, string> = {
  'sofa': 'Koltuk', 'sofa set': 'Koltuk Takımı', 'corner sofa': 'Köşe Koltuk',
  'armchair': 'Berjer', 'loveseat': 'İkili Koltuk',
  'dining table': 'Yemek Masası', 'kitchen table': 'Mutfak Masası', 'coffee table': 'Sehpa',
  'table': 'Masa', 'desk': 'Çalışma Masası', 'side table': 'Yan Sehpa',
  'chair': 'Sandalye', 'dining chair': 'Yemek Sandalyesi', 'office chair': 'Ofis Koltuğu',
  'bed': 'Yatak', 'bed frame': 'Karyola', 'bedroom set': 'Yatak Odası Takımı',
  'wardrobe': 'Gardırop', 'closet': 'Dolap', 'bookcase': 'Kitaplık', 'shelf': 'Raf',
  'tv unit': 'TV Ünitesi', 'tv stand': 'TV Ünitesi', 'buffet': 'Büfe',
  'nightstand': 'Komodin', 'dresser': 'Şifonyer', 'chest of drawers': 'Şifonyer',
  'carpet': 'Halı', 'rug': 'Halı', 'lighting': 'Aydınlatma', 'lamp': 'Lamba',
  'ottoman': 'Puf', 'bench': 'Bank', 'bunk bed': 'Ranza',
}

function localizeCategory(raw: string): string {
  const key = raw.toLowerCase().trim()
  return EN_TO_TR_CATEGORY[key] ?? raw
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
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  }
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()

  // Follow JS redirect: window.location.href = "..."
  const jsRedirect = html.match(/window\.location\.href\s*=\s*["']([^"']+)["']/)
  if (jsRedirect && html.length < 500) {
    const redirectUrl = jsRedirect[1].startsWith('http')
      ? jsRedirect[1]
      : new URL(jsRedirect[1], url).href
    const res2 = await fetch(redirectUrl, { headers })
    if (!res2.ok) throw new Error(`HTTP ${res2.status}`)
    return res2.text()
  }

  return html
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
    const category = typeof rawCat === 'string' ? localizeCategory(rawCat) : null

    return Response.json({
      name: rawName.trim(),
      image_url,
      description: description ?? null,
      price,
      category,
      product_url: url,
      _debug: { htmlSize: html.length, hasH1: !!h1, hasOgImage: !!rawImage, hasRef: html.includes('"reference":"product detail"'), htmlPreview: html.slice(0, 120) },
    })
  } catch (err) {
    return Response.json({ error: 'Ürün bilgileri alınamadı: ' + (err as Error).message }, { status: 500 })
  }
}
