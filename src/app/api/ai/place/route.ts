import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { getGeminiModel, dataUrlToInlineData, describePlacement, extractImageFromResponse, drawMarker } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, furnitureName, furnitureImageUrl, clickX, clickY } = await req.json()

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    if (!process.env.GEMINI_KEY) {
      return Response.json({ resultUrl: imageDataUrl, demo: true })
    }

    const cx = clickX ?? 0.5
    const cy = clickY ?? 0.7
    const pctX = Math.round(cx * 100)
    const pctY = Math.round(cy * 100)
    const placement = describePlacement(cx, cy, furnitureName)

    // Draw a visible orange marker so Gemini can see the exact target position
    const markedImageDataUrl = await drawMarker(imageDataUrl, cx, cy)
    const { mimeType, data } = dataUrlToInlineData(markedImageDataUrl)

    const prompt = `Task: add a "${furnitureName}" to this room photo. Output a photorealistic composite image — no text, no labels.

━━━ STEP 1 — FIND THE ORANGE MARKER ━━━
Look at the room image. There is a bright orange circle with crosshairs drawn on the floor.
That orange marker is the EXACT spot where the user wants the furniture placed.

━━━ STEP 2 — PLACE THE FURNITURE ON THE MARKER ━━━
→ Place the "${furnitureName}" with its base center directly on the orange marker.
→ The orange marker must be completely hidden under the furniture in the output — it must not be visible.
→ Do NOT move the furniture to any other position. The marker is the final, locked anchor.

${placement}

━━━ STEP 3 — SCENE ANALYSIS ━━━
Before compositing, observe:
- Floor perspective vanishing lines and material/texture.
- Floor-wall junctions for each wall.
- Shadow direction and light source angle.
- Scale reference: door ~200cm tall, ceiling height ~250cm.

━━━ STEP 4 — PERSPECTIVE & SCALE ━━━
- Align furniture to the room vanishing points; base edges parallel to floor lines.
- Vertical edges truly vertical.
- Sizes: sofa ~85cm tall / 200cm wide; armchair ~80cm / 80cm; wardrobe ~200cm / 90cm; dining table ~75cm tall.
- Depth scale: ${pctY < 40 ? 'far from camera — render smaller' : pctY > 65 ? 'close to camera — render larger' : 'mid-depth — standard scale'}.

━━━ STEP 5 — LIGHTING ━━━
- Match the existing light source direction. Add a contact shadow beneath the furniture.
- Do not change room brightness, color temperature, or ambient light.

━━━ ABSOLUTE RULES ━━━
✗ Orange marker must be hidden under the furniture — not visible in output
✗ Furniture base must touch the floor — no floating
✗ Do not alter walls, floor, ceiling, windows, doors, or any existing objects
✗ Do not add accessories, pillows, or plants
✗ Do not write any text or labels in the output image`

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
