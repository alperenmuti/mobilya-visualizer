import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { getGeminiModel, dataUrlToInlineData, describePlacement, extractImageFromResponse } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, furnitureName, furnitureImageUrl, clickX, clickY } = await req.json()

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    if (!process.env.GEMINI_KEY) {
      return Response.json({ resultUrl: imageDataUrl, demo: true })
    }

    const pctX = Math.round((clickX ?? 0.5) * 100)
    const pctY = Math.round((clickY ?? 0.7) * 100)
    const placement = describePlacement(clickX ?? 0.5, clickY ?? 0.7, furnitureName)
    const { mimeType, data } = dataUrlToInlineData(imageDataUrl)

    const prompt = `Task: add a "${furnitureName}" to this room photo. Output a photorealistic composite image — no text, no labels anywhere.

PLACEMENT — NON-NEGOTIABLE:
The user selected floor position (${pctX}% from left, ${pctY}% from top).
Place the furniture's base center exactly at that coordinate. Do not relocate it.

${placement}

DEPTH & PERSPECTIVE ANALYSIS (critical — do this before placing):
1. Find the room's vanishing point(s) — trace floor tile lines, baseboard, or wall edges to the horizon.
2. Measure the apparent height of a door or ceiling at different depths in the photo. Use this to build a scale map.
3. The click position (${pctX}%, ${pctY}%) is at a specific depth in the 3D room. Objects at this depth obey perspective:
   - Objects near the vanishing point (high Y% or deep in room) appear small.
   - Objects near the camera (low Y% or close) appear large.
4. Resize the furniture to match EXACTLY the perspective scale at position (${pctX}%, ${pctY}%).
   Compare: if a door at the same depth appears X pixels tall, a 200cm door = X pixels → sofa at 85cm = X * 0.425 pixels tall.

WALL & FLOOR CONTACT:
- All furniture feet/base points must sit exactly on the floor plane at the anchor coordinate.
- Follow the WALL RULE from placement instructions above.

LIGHTING:
- Match the room's light source direction. Cast a contact shadow on the floor.
- Do not change room brightness, color temperature, or ambient light.

STYLE:
- Real photo → photorealistic. 3D render → match its render style.
- Match sharpness, grain, depth-of-field, and color profile of the original.

RULES:
- Furniture base center stays at (${pctX}%, ${pctY}%) — no repositioning
- No floating — all feet/base must contact the floor
- Do not modify walls, floor, ceiling, windows, doors, or existing objects
- Do not add accessories, pillows, or plants
- Do not write any text or labels in the output image`

    const model = getGeminiModel()
    const parts: Part[] = [
      { inlineData: { mimeType, data } },
      { text: prompt },
    ]

    if (furnitureImageUrl && !furnitureImageUrl.startsWith('data:')) {
      try {
        const imgRes = await fetch(furnitureImageUrl, { signal: AbortSignal.timeout(5000) })
        const imgBuffer = await imgRes.arrayBuffer()
        const imgBase64 = Buffer.from(imgBuffer).toString('base64')
        const imgMime = imgRes.headers.get('content-type') ?? 'image/jpeg'
        parts.push({ inlineData: { mimeType: imgMime, data: imgBase64 } })
        parts.push({
          text: `REFERENCE APPEARANCE: The image above shows what the "${furnitureName}" looks like. Replicate its exact shape, proportions, color, and material finish in the room composite. Adapt ONLY the lighting direction and shadow to match the room's light source — do not alter the furniture's intrinsic color or material.`,
        })
      } catch {}
    }

    // Retry up to 3 times — Gemini sometimes returns text-only on the first attempt
    let imageUrl: string | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await model.generateContent(parts)
      const extracted = await extractImageFromResponse(result)
      if (extracted.imageUrl) { imageUrl = extracted.imageUrl; break }
      console.warn(`Gemini attempt ${attempt + 1} returned no image: ${extracted.textFallback ?? 'no text'}`)
    }

    if (!imageUrl) {
      throw new Error('Gemini görüntü üretemedi. Lütfen tekrar deneyin.')
    }

    return Response.json({ resultUrl: imageUrl })
  } catch (err) {
    console.error('AI place error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
