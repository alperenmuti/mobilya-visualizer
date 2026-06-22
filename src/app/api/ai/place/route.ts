import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { runFluxKontextMulti } from '@/lib/fal'
import { getGeminiModel, dataUrlToInlineData, extractImageFromResponse } from '@/lib/gemini'

// FLUX Kontext / Gemini image calls can take 15-40s — give the function room.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, furnitureName, furnitureImageUrl } = await req.json()

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    // ── Generative placement: FLUX Kontext renders the real product into the
    //    room in a natural spot, at correct perspective / scale / lighting. ──
    if (process.env.FAL_KEY && furnitureImageUrl) {
      try {
        const resultUrl = await runFluxKontextMulti({
          roomDataUrl: imageDataUrl,
          furnitureImageUrl,
          prompt: `Image 1 is a photo of a room. Image 2 is a "${furnitureName}".
Your ONLY job is to ADD the furniture from image 2 into the room of image 1. Image 1 must stay EXACTLY the same — keep its exact walls, wall colours, floor, windows, doors, archways, mouldings, lighting and camera angle pixel-for-pixel. Do NOT regenerate, restyle, repaint, crop or replace the room. Do NOT invent a new room.
Add the "${furnitureName}" standing on the floor in a natural, sensible empty spot (against a wall or in open floor area, not blocking a doorway). Render it photorealistically in correct perspective and real-world scale for the room, every foot flat on the floor, with a soft contact shadow and lighting matching the room. Reproduce its real shape, colour, upholstery and material from image 2. Output only the edited photo of THIS room with the furniture added — no text.`,
        })
        return Response.json({ resultUrl, engine: 'flux' })
      } catch (e) {
        const msg = (e as Error).message
        console.error('FLUX place error:', msg)
        if (!process.env.GEMINI_KEY) {
          return Response.json({ error: `FLUX hatası: ${msg}` }, { status: 500 })
        }
        // otherwise fall through to Gemini
      }
    }

    // ── Fallback: Gemini ───────────────────────────────────────────────────
    if (!process.env.GEMINI_KEY) {
      return Response.json({ resultUrl: imageDataUrl, demo: true })
    }

    const { mimeType, data } = dataUrlToInlineData(imageDataUrl)

    const prompt = `Edit this photo of an empty room by adding a "${furnitureName}". Return ONLY the edited image — do not reply with any text.

Place the "${furnitureName}" in a natural, sensible spot for this kind of furniture. Make it photorealistic: follow the room's floor perspective so the furniture sits at the correct scale and depth, with all feet flat on the floor (never floating) and a soft contact shadow underneath. Match the room's existing lighting, color temperature and camera angle. Keep everything else exactly as it is — do not change the walls, floor, ceiling, windows or doors, and do not add any other objects.`

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
      throw new Error(`Görüntü üretilemedi (${lastDetail})`)
    }

    return Response.json({ resultUrl: imageUrl, engine: 'gemini' })
  } catch (err) {
    console.error('AI place error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
