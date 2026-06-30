import { NextRequest } from 'next/server'

// Resolve the final product URL: follow JS redirects from the given URL
async function resolveUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    if (html.length < 500) {
      const m = html.match(/window\.location\.href\s*=\s*["']([^"']+)["']/)
      if (m) return m[1].startsWith('http') ? m[1] : new URL(m[1], url).href
    }
  } catch { /* use original */ }
  return url
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return Response.json({ error: 'URL gerekli' }, { status: 400 })

    // Step 1: Resolve the canonical product URL (follow JS redirects from Vercel's IP)
    const productUrl = await resolveUrl(url)

    // Step 2: Fetch page content via Jina AI Reader (real browser, bypasses Cloudflare)
    const jinaRes = await fetch(`https://r.jina.ai/${encodeURIComponent(productUrl)}`, {
      headers: { 'Accept': 'application/json', 'X-No-Cache': 'true' },
      signal: AbortSignal.timeout(25000),
    })
    if (!jinaRes.ok) throw new Error(`Jina ${jinaRes.status}`)
    const jinaData = await jinaRes.json() as { data: { title?: string; content?: string } }
    const pageTitle = jinaData.data?.title ?? ''
    const pageContent = jinaData.data?.content ?? ''
    if (!pageContent) throw new Error('Sayfa içeriği alınamadı')

    // Step 3: Extract structured product data with Gemini
    const geminiKey = process.env.GEMINI_KEY
    if (!geminiKey) throw new Error('GEMINI_KEY tanımlı değil')

    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genai = new GoogleGenerativeAI(geminiKey)
    const model = genai.getGenerativeModel({ model: 'gemini-flash-latest' })

    // Find the relevant product section (skip boilerplate menu/banner content at top)
    const productName = pageTitle.replace(/\s*\|.*$/, '').replace(/\s+\w{5,}\d+\w*$/, '').trim()
    let contentSlice = pageContent.slice(0, 6000)
    if (productName) {
      const idx = pageContent.indexOf(productName)
      if (idx > 0) contentSlice = pageContent.slice(Math.max(0, idx - 200), idx + 5000)
    }

    const prompt = `Aşağıdaki mobilya ürün sayfası içeriğinden bilgileri çıkar ve SADECE JSON döndür.

Sayfa başlığı: ${pageTitle}
Ürün sayfası URL: ${productUrl}
İçerik:
${contentSlice}

Çıkarılacak bilgiler:
- name: Ürün adı (Türkçe, marka adı olmadan)
- image_url: Ürünün ana fotoğraf URL'si (tam URL, .jpg/.png/.webp, en yüksek kaliteli/büyük ürün görseli, "myassets/products" veya "product" içeren URL tercih et, _min.jpg KULLANMA)
- price: Fiyat (TL veya EUR, örn: "22.778 ₺" veya "888,90 EUR", taksit fiyatı değil ana fiyat)
- category: Ürün kategorisi Türkçe (örn: "Yemek Masası", "Koltuk", "Yatak Odası")

Sadece şu JSON formatını döndür, başka hiçbir şey yazma:
{"name":"...","image_url":"...","price":"...","category":"..."}`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI çıktısı parse edilemedi')
    const extracted = JSON.parse(jsonMatch[0]) as {
      name?: string; image_url?: string; price?: string; category?: string
    }

    return Response.json({
      name: extracted.name ?? pageTitle,
      image_url: extracted.image_url ?? null,
      price: extracted.price ?? null,
      category: extracted.category ?? null,
      description: null,
      product_url: url,
    })
  } catch (err) {
    return Response.json({ error: 'Ürün bilgileri alınamadı: ' + (err as Error).message }, { status: 500 })
  }
}
