import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { getGeminiModel, dataUrlToInlineData, extractImageFromResponse } from '@/lib/gemini'
import { roomTypeToEn } from '@/components/RoomTypeSelector'

const STYLE_PROMPTS: Record<string, string> = {
  modern: 'modern contemporary style: low-profile furniture with clean geometric lines, neutral palette (white, light gray, beige, black accents), statement lighting, minimal clutter, large abstract art on walls',
  scandinavian: 'Scandinavian hygge style: light natural oak wood furniture, white walls, soft wool throws and cushions in muted tones, pendant lights, indoor plants, cozy layered textiles',
  classic: 'classic traditional style: dark rich wood furniture with ornate carved details, deep velvet or leather upholstery in burgundy or navy, gilded frames, heavy drapes, warm amber lighting',
  industrial: 'industrial loft style: raw metal and reclaimed wood furniture, leather sofa, Edison bulb pendant lights, exposed pipe/brick aesthetic elements, dark palette with warm metal accents',
  minimalist: 'ultra-minimalist style: only the essential furniture pieces in white and light gray, perfectly clean and uncluttered surfaces, hidden storage, monochromatic palette, simple geometric shapes',
  boho: 'bohemian eclectic style: rattan and wicker furniture, layered patterned rugs, macramé wall hangings, hanging plants and potted greenery, colorful cushions, warm earthy tones with pops of color',
}

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, style, roomType } = await req.json()

    if (!imageDataUrl || !style) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    if (!process.env.GEMINI_KEY) {
      return Response.json({ resultUrl: imageDataUrl, demo: true })
    }

    const styleDescription = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.modern
    const roomEn = roomTypeToEn(roomType ?? '')
    const { mimeType, data } = dataUrlToInlineData(imageDataUrl)

    const prompt = `Task: furnish this empty (or near-empty) ${roomEn || 'room'} in a specific interior design style. Output a photorealistic furnished room — no text, no labels.

ROOM TYPE: ${roomEn ? `This is a ${roomEn}. Furnish it with furniture and accessories appropriate for a ${roomEn} — not generic items.` : 'Determine the room type from the photo and furnish accordingly.'}
DESIGN STYLE: ${styleDescription}

Instructions:
1. Analyze the room: identify walls, floor material, ceiling height, windows, doors, and room dimensions from the photo.
2. Furnish the room completely in the specified style — add appropriate furniture, lighting, rugs, art, plants, and accessories.
3. Every piece must follow correct perspective for the room's vanishing points.
4. Every furniture piece must sit firmly on the floor — no floating objects.
5. Arrange furniture in a natural, professionally styled layout:
   - Sofas/seating against walls or facing focal points (fireplace, TV wall, window)
   - Coffee tables centered in front of seating
   - Lighting positioned naturally (floor lamps beside chairs, pendants centered)
6. Match the room's existing lighting direction. Add appropriate lamps/fixtures for the style.
7. The result should look like a high-end interior design magazine photo.

Rules:
- Keep the existing walls, floor, ceiling, windows, and doors unchanged
- Do not change wall colors or floor material (unless the style naturally overlays a rug)
- All objects must respect the room's perspective and scale
- Do not write any text or labels in the output image`

    const model = getGeminiModel()
    const parts: Part[] = [
      { inlineData: { mimeType, data } },
      { text: prompt },
    ]

    let imageUrl: string | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await model.generateContent(parts)
      const extracted = await extractImageFromResponse(result)
      if (extracted.imageUrl) { imageUrl = extracted.imageUrl; break }
      console.warn(`Design attempt ${attempt + 1} returned no image: ${extracted.textFallback ?? 'no text'}`)
    }

    if (!imageUrl) {
      throw new Error('Gemini görüntü üretemedi. Lütfen tekrar deneyin.')
    }

    return Response.json({ resultUrl: imageUrl })
  } catch (err) {
    console.error('AI design error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
