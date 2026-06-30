import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface ProductData {
  name: string | null
  price: string | null
  image_url: string | null
  category: string | null
  description: string | null
  product_url: string
}

async function scrapeWithJinaAndGemini(url: string): Promise<ProductData> {
  // Step 1: Jina AI Reader renders JS and returns clean markdown + image list
  const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      'Accept': 'application/json',
      'X-No-Cache': 'true',
      'X-With-Images-Summary': 'true',
    },
    signal: AbortSignal.timeout(25000),
  })
  if (!jinaRes.ok) throw new Error(`Jina HTTP ${jinaRes.status}`)
  const jinaData = await jinaRes.json()
  const content: string = jinaData.data?.content ?? ''
  const images: { src: string; alt: string }[] = jinaData.data?.images ?? []

  // Step 2: Gemini extracts structured product data
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const imageList = images
    .filter(i => i.src?.startsWith('http') && !i.src.includes('logo') && !i.src.includes('icon') && !i.src.includes('banner'))
    .slice(0, 15)
    .map((img, i) => `${i + 1}. alt="${img.alt ?? ''}" → ${img.src}`)
    .join('\n')

  const prompt = `Bu bir Türk mobilya ürün sayfasıdır. Ürün bilgilerini çıkar.

SAYFA İÇERİĞİ:
${content.substring(0, 5000)}

MEVCUT GÖRSELLER (numaralı liste):
${imageList || '(görsel bulunamadı)'}

SADECE geçerli JSON döndür, başka hiçbir şey yazma:
{
  "name": "ürün adı",
  "price": "fiyat ₺ simgesiyle (örn: 12.499 ₺) — bulunamazsa null",
  "image_url": "Yukarıdaki MEVCUT GÖRSELLER listesinden ana ürün görselinin tam URL'si — logo/ikon/banner olmayan, ürünü gösteren ilk görsel — bulunamazsa null",
  "category": "şunlardan biri: Koltuk, Kanepe, Berjer, Yatak, Karyola, Masa, Yemek Masası, Sandalye, Dolap, Gardırop, Raf, Kitaplık, Aydınlatma, Halı, TV Ünitesi, Çalışma Masası, Diğer",
  "description": "kısa ürün açıklaması veya null"
}`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Gemini JSON döndürmedi')
  const extracted = JSON.parse(jsonMatch[0])

  return {
    name: extracted.name ?? null,
    price: extracted.price ?? null,
    image_url: extracted.image_url ?? null,
    category: extracted.category ?? null,
    description: extracted.description ?? null,
    product_url: url,
  }
}

// Fallback: plain HTML scraper
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

async function scrapeViaHtml(url: string): Promise<ProductData> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'tr-TR,tr;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const priceMatch = html.match(/₺\s?[\d.,]+|[\d.,]+\s?₺/)
  const rawImage = getMeta(html, 'og:image') ?? getMeta(html, 'twitter:image')
  const image_url = rawImage ? (() => { try { return new URL(rawImage, url).href } catch { return rawImage } })() : null
  return {
    name: (getMeta(html, 'og:title') ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? 'Ürün').trim(),
    price: priceMatch?.[0]?.trim() ?? null,
    image_url,
    category: null,
    description: getMeta(html, 'og:description') ?? null,
    product_url: url,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return Response.json({ error: 'URL gerekli' }, { status: 400 })

    if (process.env.GEMINI_KEY) {
      try {
        const result = await scrapeWithJinaAndGemini(url)
        return Response.json(result)
      } catch (err) {
        console.warn('Jina+Gemini scrape failed, falling back to HTML:', err)
      }
    }

    // Fallback
    const result = await scrapeViaHtml(url)
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: 'Ürün bilgileri alınamadı: ' + (err as Error).message }, { status: 500 })
  }
}
