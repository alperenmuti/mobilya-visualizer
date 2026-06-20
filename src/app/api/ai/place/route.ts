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

    const prompt = `You are a professional photo compositor. Add a "${furnitureName}" to this room photo at the exact location the user selected.

▶▶▶ POSITION LOCK — THIS IS THE MOST IMPORTANT INSTRUCTION ◀◀◀
The user clicked at: ${pctX}% from the LEFT edge, ${pctY}% from the TOP edge.
This pixel is the floor contact point. The center of the furniture's base MUST land here.
Do NOT place the furniture where you think it "looks better." The user's click is final.
▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶▶◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀◀

━━━ STEP 1 — READ THE SCENE ━━━
Before placing anything, analyze:
A) Floor surface — perspective vanishing lines, material, texture.
B) Camera eye level — find the horizon line.
C) Floor-wall junctions — exact line where floor meets each wall.
D) Shadow direction and angle — note the light source.
E) Scale reference — door ~200cm, ceiling ~250cm.

━━━ STEP 2 — COMMIT TO THE POSITION ━━━
${placement}

The furniture's floor footprint center is LOCKED to (${pctX}%, ${pctY}%). Do not drift it.

━━━ STEP 3 — PERSPECTIVE & SCALE ━━━
• Align furniture to the room's vanishing points — base edges parallel to floor lines.
• Vertical edges truly vertical (not tilted).
• Scale: sofa ~85cm tall/200cm wide · armchair ~80cm/80cm · wardrobe ~200cm/90cm · dining table ~75cm tall.

━━━ STEP 4 — LIGHTING ━━━
• Match the room's existing light source direction exactly.
• Cast a contact shadow on the floor beneath the furniture.
• Do not change room brightness, color temperature, or ambient light.

━━━ STEP 5 — STYLE ━━━
• Real photo → photorealistic. 3D render → match the render style.
• Match sharpness, grain, depth-of-field, and color profile of the original.

━━━ HARD RULES ━━━
✗ Furniture center must be at (${pctX}%, ${pctY}%) — no repositioning
✗ All feet/base points touch the floor — no floating
✗ Do not modify walls, floor, ceiling, windows, doors, or any existing objects
✗ Do not add pillows, plants, accessories, or extra items
✗ Do not write any text or labels anywhere in the output image

Output the complete room image with the "${furnitureName}" composited in at the specified position.`

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
    const resultUrl = await extractImageFromResponse(result)

    if (!resultUrl) {
      throw new Error('Gemini görüntü üretemedi. Lütfen tekrar deneyin.')
    }

    return Response.json({ resultUrl })
  } catch (err) {
    console.error('AI place error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
