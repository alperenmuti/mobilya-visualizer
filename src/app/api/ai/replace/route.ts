import { NextRequest } from 'next/server'
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

    const prompt = `You are an expert interior design visualization AI specializing in furniture replacement compositing.

## TASK
Replace one specific piece of furniture in this room photograph with a "${furnitureName}".

## TARGET IDENTIFICATION
The user clicked at ${pctX}% from the left and ${pctY}% from the top of the image. Look at that exact coordinate and identify the furniture object located there (it could be a sofa, armchair, chair, table, cabinet, bed, rug, etc.). That is the ONLY item you must replace.

## PLACEMENT OF REPLACEMENT
${placement}

## REPLACEMENT PROCESS — follow this exact order:
**STEP 1 — REMOVAL:** Remove the identified furniture item completely. Fill the area it occupied with the correct floor, wall, or background that logically belongs there (matching the surrounding floor texture, color, and perspective).

**STEP 2 — PLACEMENT:** Place the new "${furnitureName}" in exactly the same position and at the same scale as the removed item. The new piece occupies the same floor footprint.

**STEP 3 — INTEGRATION:**
- PERSPECTIVE: Align the new furniture to the room's vanishing points — same perspective grid as the floor and walls
- SCALE: Keep the same scale as the original piece. If the original was large, the replacement is large; if small, small.
- LIGHTING: The new furniture receives light from the same direction and intensity as the original
- SHADOW: Cast a floor shadow under the new furniture matching the angle, softness and color of other shadows in the scene
- CONTACT: The new furniture sits FIRMLY on the floor — no floating

## ABSOLUTE CONSTRAINTS
- Change ONLY the one identified furniture item. Everything else — all other furniture, walls, floor, ceiling, windows, doors, plants, artwork, lighting fixtures, pillows, and decorations — must remain PIXEL-PERFECT IDENTICAL.
- Do NOT adjust room brightness, contrast, color grading, or atmosphere.
- Do NOT move, resize, or alter any other object.
- Output the COMPLETE room image at the same resolution.

Now identify the furniture at (${pctX}%, ${pctY}%), remove it, and replace it with the "${furnitureName}".`

    const model = getGeminiModel()
    const parts: object[] = [
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
          text: `The image above shows the reference appearance for the "${furnitureName}". Use its exact shape, color, and style. Adapt only the lighting and shadow to match the room's light sources.`,
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
    console.error('AI replace error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
