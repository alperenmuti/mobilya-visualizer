import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { getGeminiModel, dataUrlToInlineData, describePlacement, extractImageFromResponse, drawMarker } from '@/lib/gemini'
import { roomTypeToEn } from '@/lib/roomTypes'
import { deductCredit } from '@/lib/credits'

export async function POST(req: NextRequest) {
  try {
    const {
      imageDataUrl, furnitureName, furnitureImageUrl,
      clickX, clickY, markerDrawn: clientMarked, roomType, brand,
    } = await req.json()

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    if (brand) {
      const credit = await deductCredit(brand)
      if (!credit.ok) {
        return Response.json({ error: 'Kontörünüz bitti. Lütfen yönetici ile iletişime geçin.', credits: 0 }, { status: 402 })
      }
    }

    if (!process.env.GEMINI_KEY) {
      return Response.json({ resultUrl: imageDataUrl, demo: true })
    }

    const cx = clickX ?? 0.5
    const cy = clickY ?? 0.5
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

    const target = markerDrawn
      ? `TARGET: There is a bright orange crosshair marker visible in the image. The furniture AT or nearest to that orange marker is the only item to replace. Remove both the marker and that furniture, then place the "${furnitureName}" in the same position.`
      : `TARGET: The user clicked at (${pctX}% from left, ${pctY}% from top). The furniture AT or nearest to that pixel is the only item to replace.`

    const roomEn = roomTypeToEn(roomType ?? '')
    const roomContext = roomEn ? `ROOM TYPE: This is a ${roomEn}.\n` : ''

    const prompt = `Edit this room photo by replacing one piece of furniture with a "${furnitureName}". Return ONLY the edited image — do not reply with any text.

${roomContext}${target}

Remove ${markerDrawn ? 'the orange marker and ' : ''}that furniture and rebuild the floor and wall behind it seamlessly, as if it was never there. Put the "${furnitureName}" in the same spot: same footprint and scale, base flat on the floor, back against the wall if the original was against one. Match the room's existing lighting and add a contact shadow. Change nothing else in the room — only that one piece of furniture is replaced.`

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
          text: `The image above is the "${furnitureName}" to use as the replacement. Match its shape, color and material; adapt only its lighting and shadow to the room.`,
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
        console.warn(`Gemini replace attempt ${attempt + 1}: ${lastDetail}`)
      } catch (e) {
        lastDetail = (e as Error).message
        console.warn(`Gemini replace attempt ${attempt + 1} threw: ${lastDetail}`)
      }
    }

    if (!imageUrl) {
      throw new Error(`Gemini görüntü üretemedi (${lastDetail})`)
    }

    return Response.json({ resultUrl: imageUrl })
  } catch (err) {
    console.error('AI replace error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
