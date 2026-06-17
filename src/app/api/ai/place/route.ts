import { NextRequest } from 'next/server'
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

    const placement = describePlacement(clickX ?? 0.5, clickY ?? 0.7, furnitureName)
    const { mimeType, data } = dataUrlToInlineData(imageDataUrl)

    const prompt = `You are an expert interior design visualization AI. Your job is to add furniture to room photographs with photorealistic precision.

## TASK
Add a "${furnitureName}" to this room photograph.

## PLACEMENT INSTRUCTIONS
${placement}

## RENDERING REQUIREMENTS
1. PERSPECTIVE & DEPTH: The furniture must align perfectly with the room's vanishing point(s). Study the floor lines and wall angles — the furniture must share the exact same perspective grid as the floor and walls. If the floor has wood planks or tiles, the furniture legs must sit correctly on them.
2. SCALE: Compare to visible reference objects (doors are ~200cm tall, standard sofa ~85cm tall, armchair ~80cm). Render the furniture at a realistic human-scale size relative to the room.
3. LIGHTING: Identify the light source direction from existing shadows in the room. The furniture must receive light from the SAME direction and cast a shadow on the floor at the SAME angle as other objects.
4. SHADOW: Cast a soft floor shadow under the furniture that matches the softness and color temperature of existing shadows.
5. CONTACT: The furniture must sit FIRMLY on the floor — no floating, no hovering. The legs or base must make full contact with the floor surface.
6. STYLE COHERENCE: Match the furniture's rendering quality to the photo — if the room photo is a render, render the furniture as a render; if it's a real photograph, make the furniture look photographed.

## ABSOLUTE CONSTRAINTS
- Do NOT modify ANYTHING else: walls, floor, ceiling, windows, doors, light switches, baseboards, and any existing objects must remain pixel-perfect identical.
- Do NOT add any other objects, decorations, or accessories.
- Do NOT change room brightness, contrast, color grading, or atmosphere.
- Output the COMPLETE room image at the same resolution.

Now add the ${furnitureName} following all instructions above.`

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
          text: `The image above is the reference appearance for the "${furnitureName}". Use its exact shape, color, and style when rendering it in the room. Adapt only the lighting and shadows to match the room.`,
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
