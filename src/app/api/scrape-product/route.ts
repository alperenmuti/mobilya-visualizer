import { NextRequest } from 'next/server'

const EN_TO_TR: Record<string, string> = {
  'sofa': 'Koltuk', 'sofa set': 'Koltuk Takımı', 'corner sofa': 'Köşe Koltuk', 'loveseat': 'İkili Koltuk',
  'armchair': 'Berjer', 'dining table': 'Yemek Masası', 'kitchen table': 'Mutfak Masası',
  'coffee table': 'Sehpa', 'table': 'Masa', 'desk': 'Çalışma Masası', 'side table': 'Yan Sehpa',
  'chair': 'Sandalye', 'dining chair': 'Yemek Sandalyesi', 'office chair': 'Ofis Koltuğu',
  'bed': 'Yatak', 'bed frame': 'Karyola', 'bedroom set': 'Yatak Odası Takımı',
  'wardrobe': 'Gardırop', 'bookcase': 'Kitaplık', 'tv unit': 'TV Ünitesi', 'tv stand': 'TV Ünitesi',
  'buffet': 'Büfe', 'nightstand': 'Komodin', 'dresser': 'Şifonyer', 'ottoman': 'Puf',
  'bunk bed': 'Ranza', 'carpet': 'Halı', 'rug': 'Halı', 'lamp': 'Lamba',
}
const localize = (s: string) => EN_TO_TR[s.toLowerCase().trim()] ?? s

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
}

// Follow JS redirect if the response is tiny (e.g., Cloudflare/locale redirect)
async function resolveUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) })
    const html = await res.text()
    if (html.length < 500) {
      const m = html.match(/window\.location\.href\s*=\s*["']([^"']+)["']/)
      if (m) return m[1].startsWith('http') ? m[1] : new URL(m[1], url).href
    }
  } catch { /* fall through */ }
  return url
}

// Extract from raw HTML — works when not Cloudflare-blocked
function extractFromHtml(html: string, baseUrl: string) {
  const getOgTag = (prop: string) => {
    const r1 = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
    const r2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'))
    return r1?.[1] ?? r2?.[1] ?? null
  }
  const h1 = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i)?.[1] ?? null
  const name = h1 ?? getOgTag('title') ?? null
  const rawImg = getOgTag('image')
  const image_url = rawImg ? (rawImg.startsWith('http') ? rawImg : new URL(rawImg, baseUrl).href) : null

  // TL price lives inside dataLayer / tracking JSON: "reference":"product detail"
  let price: string | null = null
  let category: string | null = null
  const refIdx = html.indexOf('"reference":"product detail"')
  if (refIdx >= 0) {
    const s = html.lastIndexOf('{', refIdx)
    const e = html.indexOf('}', refIdx)
    if (s >= 0 && e >= 0) {
      try {
        const obj = JSON.parse(html.slice(s, e + 1)) as Record<string, unknown>
        if (typeof obj.price === 'number') price = Math.round(obj.price).toLocaleString('tr-TR') + ' ₺'
        if (typeof obj.category === 'string') category = localize(obj.category)
      } catch { /* skip */ }
    }
  }
  return { name, image_url, price, category }
}

// Gemini call with retry on 503
async function geminiExtract(pageTitle: string, productUrl: string, contentSlice: string, geminiKey: string): Promise<{ name?: string; image_url?: string; price?: string; category?: string }> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genai = new GoogleGenerativeAI(geminiKey)
  const model = genai.getGenerativeModel({ model: 'gemini-flash-latest' })
  const prompt = `Aşağıdaki mobilya ürün sayfası içeriğinden bilgileri çıkar ve SADECE JSON döndür.

Sayfa başlığı: ${pageTitle}
URL: ${productUrl}
İçerik:
${contentSlice}

- name: Ürün adı (Türkçe, marka adı olmadan)
- image_url: Ürünün ana fotoğraf URL'si (tam URL, .jpg/.png/.webp, "myassets/products" içeren en büyük görsel, _min.jpg KULLANMA)
- price: Ana fiyat (TL veya EUR, taksit değil, örn: "22.778 ₺" veya "888,90 EUR")
- category: Kategori Türkçe (örn: "Yemek Masası", "Koltuk", "Yatak Odası")

Sadece JSON: {"name":"...","image_url":"...","price":"...","category":"..."}`

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      const raw = result.response.text().trim()
      const m = raw.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('AI JSON parse edilemedi')
      return JSON.parse(m[0])
    } catch (err) {
      const msg = (err as Error).message ?? ''
      if (msg.includes('503') && attempt < 2) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error('Gemini yanıt vermedi')
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return Response.json({ error: 'URL gerekli' }, { status: 400 })

    // 1. Resolve canonical URL (follow JS redirects from Vercel IPs)
    const productUrl = await resolveUrl(url)

    // 2. Try direct HTML fetch (gets TL price when not Cloudflare-blocked)
    let htmlResult: ReturnType<typeof extractFromHtml> | null = null
    try {
      const res = await fetch(productUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) })
      const html = await res.text()
      if (html.length > 10000) htmlResult = extractFromHtml(html, productUrl)
    } catch { /* fall through to Jina */ }

    // If we got everything from raw HTML, return it
    if (htmlResult?.name && htmlResult?.image_url && htmlResult?.price) {
      return Response.json({
        name: htmlResult.name,
        image_url: htmlResult.image_url,
        price: htmlResult.price,
        category: htmlResult.category,
        description: null,
        product_url: url,
      })
    }

    // 3. Fall back to Jina AI reader (handles Cloudflare with real browser)
    const geminiKey = process.env.GEMINI_KEY
    if (!geminiKey) throw new Error('GEMINI_KEY tanımlı değil')

    const jinaRes = await fetch(`https://r.jina.ai/${encodeURIComponent(productUrl)}`, {
      headers: { 'Accept': 'application/json', 'X-No-Cache': 'true' },
      signal: AbortSignal.timeout(25000),
    })
    if (!jinaRes.ok) throw new Error(`Jina ${jinaRes.status}`)
    const jinaData = await jinaRes.json() as { data: { title?: string; content?: string } }
    const pageTitle = jinaData.data?.title ?? ''
    const pageContent = jinaData.data?.content ?? ''
    if (!pageContent) throw new Error('Sayfa içeriği alınamadı')

    // Find product section (skip header/nav boilerplate)
    const cleanTitle = pageTitle.replace(/\s*\|.*$/, '').replace(/\s+\w{5,}\d+\w*$/, '').trim()
    let contentSlice = pageContent.slice(0, 6000)
    if (cleanTitle) {
      const idx = pageContent.indexOf(cleanTitle)
      if (idx > 0) contentSlice = pageContent.slice(Math.max(0, idx - 200), idx + 5000)
    }

    const extracted = await geminiExtract(pageTitle, productUrl, contentSlice, geminiKey)

    return Response.json({
      name: extracted.name ?? htmlResult?.name ?? pageTitle,
      image_url: extracted.image_url ?? htmlResult?.image_url ?? null,
      price: htmlResult?.price ?? extracted.price ?? null,  // prefer TL price from raw HTML
      category: extracted.category ?? htmlResult?.category ?? null,
      description: null,
      product_url: url,
    })
  } catch (err) {
    return Response.json({ error: 'Ürün bilgileri alınamadı: ' + (err as Error).message }, { status: 500 })
  }
}
