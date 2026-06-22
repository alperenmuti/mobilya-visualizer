import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { getGeminiModel, dataUrlToInlineData, describePlacement, extractImageFromResponse, drawMarker } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, furnitureName, furnitureImageUrl, clickX, clickY, markerDrawn: clientMarked } = await req.json()

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

    // The marker may already be baked in by the browser (preferred, no Sharp needed).
    // If not, draw it server-side via Sharp; if that fails too, fall back to
    // coordinate-only wording so we never reference a marker that isn't in the image.
    let sourceImage = imageDataUrl
    let markerDrawn = clientMarked === true
    if (!markerDrawn) {
      const drawn = await drawMarker(imageDataUrl, cx, cy)
      sourceImage = drawn.dataUrl
      markerDrawn = drawn.ok
    }
    const { mimeType, data } = dataUrlToInlineData(sourceImage)

    const placementHeader = markerDrawn
      ? `There is a bright orange circle with crosshairs on the floor of the image — that is the exact spot the user chose.
Place the "${furnitureName}" with its base center directly on that orange marker. The marker must be completely hidden under the furniture in the output. Do not move the furniture anywhere else.`
      : `The user selected floor position (${pctX}% from left, ${pctY}% from top).
Place the furniture's base center exactly at that pixel. Do not move it to a position you prefer.`

    const prompt = `Edit this room photo by adding a "${furnitureName}". Return ONLY the edited image — do not reply with any text.

${placementHeader}
${placement}

Render it photorealistically: correct perspective and scale for that floor position (${pctY < 40 ? 'farther from camera, render smaller' : pctY > 65 ? 'close to camera, render larger' : 'mid-depth, standard scale'}), all feet flat on the floor — never floating — with a soft contact shadow and lighting that matches the room. Keep everything else exactly as it is: do not change the walls, floor, ceiling, windows or doors${markerDrawn ? ', hide the orange marker under the furniture,' : ''} and do not add any other objects.`

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
          text: `The image above is the "${furnitureName}" to add. Match its shape, color and material; adapt only its lighting and shadow to the room.`,
        })
      } catch {}
    }

    // Retry up to 3 times — Gemini sometimes returns text-only on the first attempt.
    // Capture the real reason (API error vs text response) so failures aren't opaque.
    let imageUrl: string | null = null
    let lastDetail = 'bilinmeyen'
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await model.generateContent(parts)
        const extracted = await extractImageFromResponse(result)
        if (extracted.imageUrl) { imageUrl = extracted.imageUrl; break }
        lastDetail = extracted.textFallback ? `model metin döndürdü: "${extracted.textFallback}"` : 'görüntü yok, metin yok'
        console.warn(`Gemini place attempt ${attempt + 1}: ${lastDetail}`)
      } catch (e) {
        lastDetail = (e as Error).message
        console.warn(`Gemini place attempt ${attempt + 1} threw: ${lastDetail}`)
      }
    }

    if (!imageUrl) {
      throw new Error(`Gemini görüntü üretemedi (${lastDetail})`)
    }

    return Response.json({ resultUrl: imageUrl })
  } catch (err) {
    console.error('AI place error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
