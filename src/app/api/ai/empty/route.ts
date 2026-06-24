import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { getGeminiModel, dataUrlToInlineData, extractImageFromResponse } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl } = await req.json()

    if (!imageDataUrl) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    if (!process.env.GEMINI_KEY) {
      return Response.json({ resultUrl: imageDataUrl, demo: true })
    }

    const { mimeType, data } = dataUrlToInlineData(imageDataUrl)

    const prompt = `Task: remove everything movable from this room photo. Output a photorealistic empty room — no text, no labels.

Remove ALL of the following:
- Furniture (sofas, chairs, tables, beds, wardrobes, shelves, desks, stools, ottomans, etc.)
- Rugs and carpets
- Curtains, blinds, drapes (if not structurally built-in)
- Wall art, paintings, frames, mirrors
- Plants and flowers
- Lamps and floor lights (free-standing only — keep ceiling lights/fixtures)
- Decorations, vases, sculptures, books, electronics, appliances
- Personal items of any kind

Keep ONLY the permanent structural elements:
- Bare walls (keep their existing paint color, texture, and any wallpaper)
- Bare floor (keep its existing material — wood, tile, carpet base, etc.)
- Ceiling (keep ceiling fixtures, mouldings, beams)
- Windows and window frames (without curtains/blinds unless built-in)
- Doors and door frames
- Built-in structural elements (radiators, AC units fixed to wall, built-in shelving that is part of the wall)

Where furniture or objects were, reconstruct the background seamlessly:
- Floor area: reconstruct the floor texture/material to match the surrounding floor exactly.
- Wall area: reconstruct the wall surface seamlessly — same color, texture, and any existing patterns.

The result should look like a professionally photographed empty room ready for sale or rental listing.

Rules:
- Do not change wall colors, floor material, ceiling, or room proportions
- Do not add any new objects or furniture
- Do not change the room's lighting or camera angle
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
      console.warn(`Empty room attempt ${attempt + 1} returned no image: ${extracted.textFallback ?? 'no text'}`)
    }

    if (!imageUrl) {
      throw new Error('Gemini görüntü üretemedi. Lütfen tekrar deneyin.')
    }

    return Response.json({ resultUrl: imageUrl })
  } catch (err) {
    console.error('AI empty error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
