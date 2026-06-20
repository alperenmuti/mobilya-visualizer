import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { getGeminiModel, dataUrlToInlineData, describePlacement, extractImageFromResponse } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const {
      imageDataUrl, furnitureName, furnitureImageUrl,
      clickX, clickY,
    } = await req.json()

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    if (!process.env.GEMINI_KEY) {
      return Response.json({ resultUrl: imageDataUrl, demo: true })
    }

    const pctX = Math.round((clickX ?? 0.5) * 100)
    const pctY = Math.round((clickY ?? 0.5) * 100)
    const placement = describePlacement(clickX ?? 0.5, clickY ?? 0.5, furnitureName)
    const { mimeType, data } = dataUrlToInlineData(imageDataUrl)

    const prompt = `Task: in this room photo, replace one piece of furniture with a "${furnitureName}". Output a photorealistic image — no text, no labels.

TARGET: The user clicked at (${pctX}% from left, ${pctY}% from top). The furniture AT or nearest to that pixel is the only item to replace.

━━━ STEP 1 — ANALYZE THE SCENE ━━━
Before touching anything, mentally record:
A) The floor surface — its perspective lines, material, and texture.
B) The camera eye level — where is the horizon in this photo?
C) WALL POSITIONS: Find the left wall, right wall, and back wall surfaces. Find the exact floor-wall junction lines. Note which wall the existing furniture is against.
D) The shadow direction and angle — which way do all shadows fall?
E) The scale reference — door height (~200cm), ceiling height (~250cm).

━━━ STEP 2 — IDENTIFY THE TARGET ━━━
The user clicked at (${pctX}%, ${pctY}%) in the image.
Look at EXACTLY that pixel coordinate. Identify the furniture object that is at or nearest to that position. This is the ONLY item you will change. Name it mentally (sofa, chair, table, cabinet, etc.).

━━━ STEP 3 — REMOVE THE TARGET CLEANLY ━━━
Erase the identified furniture completely.
Fill its former space with the background that logically belongs there:
• Floor area below it → reconstruct the floor texture matching the surrounding floor exactly (same color, same perspective, same material grain/pattern).
• Wall area behind it → reconstruct the wall seamlessly.
The reconstruction must be invisible — as if the original furniture was never there.

━━━ STEP 4 — PLACE THE REPLACEMENT ━━━
${placement}

FOOTPRINT MATCHING: The new "${furnitureName}" occupies the SAME floor footprint as the removed item.
• Same floor contact position (${pctX}%, ${pctY}% is the floor contact point).
• Same approximate floor area coverage.
• Same distance from camera/walls.

FAILURE CONDITIONS — any of these = WRONG output:
✗ New furniture feet/base do not touch the floor (floating)
✗ New furniture back has a visible gap between it and the wall
✗ New furniture appears in a different wall/position than the original

━━━ STEP 5 — PERSPECTIVE & SCALE ━━━
• Align the replacement to the same vanishing point(s) as the removed furniture.
• Match the scale of the original item exactly — if the original was large, the replacement is large.
• Vertical edges of the replacement must be truly vertical (not tilted).
• Calibrate using your Step 1D scale reference.

━━━ STEP 6 — LIGHTING INTEGRATION ━━━
• The "${furnitureName}" receives light from the SAME direction as the original item and the rest of the room.
• Cast a floor contact shadow matching the direction, length, and softness of all other shadows.
• Do NOT change the room's ambient lighting, brightness, or color temperature.

━━━ ABSOLUTE PROHIBITIONS ━━━
✗ Change ONLY the identified furniture — nothing else in the image may change by even one pixel
✗ NO floating furniture — base must contact the floor
✗ NO modifying walls, ceiling, floor, other furniture, windows, doors, art, plants, or accessories
✗ NO changing room lighting, exposure, or color grading
✗ NO adding objects that were not in the original scene

Output the complete room image at its original resolution with ONLY the identified furniture replaced by the "${furnitureName}".`

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
          text: `REFERENCE APPEARANCE: The image above shows what the "${furnitureName}" looks like. Replicate its exact shape, proportions, color, and material finish in the room composite. Adapt ONLY the lighting direction and shadow to match the room's light source — do not change the furniture's intrinsic color or material.`,
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
    console.error('AI replace error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
