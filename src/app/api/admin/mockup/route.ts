import { NextRequest } from 'next/server'
import { getGeminiModel, dataUrlToInlineData, extractImageFromResponse } from '@/lib/gemini'
import type { Part } from '@google/generative-ai'

export const maxDuration = 60

function verifyAdmin(req: NextRequest): boolean {
  if (req.cookies.get('admin_session')?.value) return true
  const auth = req.headers.get('authorization') ?? ''
  return auth.startsWith('Bearer ') && auth.length > 7
}

const SCENES = [
  {
    label: 'Modern Salon',
    prompt: 'a bright modern living room, white and light grey walls, large windows with natural daylight, wooden herringbone floor, minimal Scandinavian style decor',
  },
  {
    label: 'Sıcak Oturma Odası',
    prompt: 'a warm and cozy living room, warm beige walls, soft ambient lighting, plush rugs, neutral tones, elegant and homely interior design',
  },
  {
    label: 'Doğal & Bohem',
    prompt: 'a natural bohemian room, exposed brick or warm terracotta walls, plants, rattan and wood accents, soft warm lighting, earthy tones',
  },
  {
    label: 'Minimalist',
    prompt: 'a minimalist contemporary room, pure white walls, polished concrete floor, clean lines, no clutter, bright and airy, high-end architectural interior',
  },
]

async function generateMockup(
  productDataUrl: string,
  productName: string,
  scene: (typeof SCENES)[number],
): Promise<string> {
  const { mimeType, data } = dataUrlToInlineData(productDataUrl)
  const model = getGeminiModel()

  const prompt = `You are given a product photo of a "${productName}".
Generate a photorealistic interior design lifestyle photo that:
- Features the "${productName}" from the product photo as the MAIN focal piece of furniture
- Places it in ${scene.prompt}
- Renders the furniture with the EXACT same shape, colour, texture and material shown in the product photo
- Adds tasteful complementary decor (cushions, plants, lighting, art) that suits the style
- Uses professional architectural photography: wide angle, perfect exposure, sharp focus
- Output: only the lifestyle interior photo, no text, no labels, no white background

Make it look like a premium furniture catalogue shot.`

  const parts: Part[] = [
    { inlineData: { mimeType, data } },
    { text: prompt },
  ]

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(parts)
      const extracted = await extractImageFromResponse(result)
      if (extracted.imageUrl) return extracted.imageUrl
    } catch (e) {
      if (attempt === 2) throw e
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  throw new Error(`${scene.label} üretilemedi`)
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { productDataUrl, productName } = await req.json()
    if (!productDataUrl || !productName) {
      return Response.json({ error: 'Ürün fotoğrafı ve adı gerekli' }, { status: 400 })
    }

    // Generate all 4 mockups in parallel, collect successes
    const results = await Promise.allSettled(
      SCENES.map(scene => generateMockup(productDataUrl, productName, scene))
    )

    const mockups = results.map((r, i) => ({
      label: SCENES[i].label,
      imageUrl: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? (r.reason as Error).message : null,
    }))

    const succeeded = mockups.filter(m => m.imageUrl).length
    if (succeeded === 0) throw new Error('Hiçbir mockup üretilemedi')

    return Response.json({ mockups })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
