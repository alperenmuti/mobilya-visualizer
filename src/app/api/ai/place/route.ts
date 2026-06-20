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

    const prompt = `Task: add a "${furnitureName}" to this room photo. Output a photorealistic composite image — no text, no labels.

PLACEMENT — HIGHEST PRIORITY:
The user selected floor position (${pctX}% from left, ${pctY}% from top).
Place the furniture's base center exactly at that pixel. Do not move it to a position you prefer.

${placement}

Scene analysis (do before placing):
- Trace the floor perspective vanishing lines.
- Find floor-wall junctions for each wall.
- Note shadow direction, light source angle.
- Scale reference: door ~200cm tall, ceiling ~250cm.
- Floor material and texture.

Perspective & scale:
- Align furniture to the room vanishing points; base edges parallel to floor lines.
- Vertical edges truly vertical.
- Sizes: sofa ~85cm tall / 200cm wide; armchair ~80cm / 80cm; wardrobe ~200cm / 90cm; dining table ~75cm tall.
- Depth scale: ${pctY < 40 ? 'far from camera — render smaller' : pctY > 65 ? 'close to camera — render larger' : 'mid-depth — standard scale'}.

Lighting:
- Match existing light source direction. Add contact shadow beneath furniture.
- Do not change room brightness, color temperature, or ambient light.

Style:
- Real photo: photorealistic rendering. 3D render: match its render style.
- Match sharpness, grain, depth-of-field, and color profile.

Rules:
- Furniture base center at (${pctX}%, ${pctY}%) — no repositioning
- All feet/base must touch the floor — no floating
- Do not alter walls, floor, ceiling, windows, doors, or any existing objects
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

    const result = await model.generateContent(parts)
    const { imageUrl, textFallback } = await extractImageFromResponse(result)

    if (!imageUrl) {
      const detail = textFallback ? ` (model said: "${textFallback}")` : ''
      console.error('Gemini returned no image' + detail)
      throw new Error('Gemini görüntü üretemedi. Lütfen tekrar deneyin.')
    }

    return Response.json({ resultUrl: imageUrl })
  } catch (err) {
    console.error('AI place error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
