import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { runFluxKontextMulti } from '@/lib/fal'
import { getGeminiModel, dataUrlToInlineData, extractImageFromResponse } from '@/lib/gemini'

// FLUX Kontext / Gemini image calls can take 15-40s — give the function room.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, furnitureName, furnitureImageUrl, diag } = await req.json()

    // Safe diagnostic: reports only whether keys are configured (never values).
    if (diag) {
      return Response.json({ gemini: !!process.env.GEMINI_KEY, fal: !!process.env.FAL_KEY })
    }

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    // ── PRIMARY: Gemini — edits the photo in place, keeping the room's exact
    //    resolution, framing and detail (FLUX re-renders the whole image at low
    //    res and drifts; user prefers Gemini). ──────────────────────────────
    if (process.env.GEMINI_KEY) {
      try {
        const resultUrl = await geminiPlace(imageDataUrl, furnitureName, furnitureImageUrl)
        return Response.json({ resultUrl, engine: 'gemini' })
      } catch (e) {
        console.error('Gemini place error:', (e as Error).message)
        // fall through to FLUX if available
      }
    }

    // ── FALLBACK: FLUX Kontext multi-image ─────────────────────────────────
    if (process.env.FAL_KEY && furnitureImageUrl) {
      try {
        const resultUrl = await runFluxKontextMulti({
          roomDataUrl: imageDataUrl,
          furnitureImageUrl,
          prompt: `Image 1 is a photo of a room. Image 2 is a "${furnitureName}". Add the furniture from image 2 into the room of image 1, standing on the floor in a natural empty spot. Keep image 1 exactly the same — do not regenerate or restyle the room. Render the furniture photorealistically at correct perspective and scale, feet on the floor, with a contact shadow and matching light, reproducing its real shape/colour/material from image 2. Output only the edited photo — no text.`,
        })
        return Response.json({ resultUrl, engine: 'flux' })
      } catch (e) {
        const msg = (e as Error).message
        console.error('FLUX place error:', msg)
        return Response.json({ error: `Görüntü üretilemedi: ${msg}` }, { status: 500 })
      }
    }

    if (!process.env.GEMINI_KEY) {
      return Response.json({ error: 'GEMINI_KEY tanımlı değil — Vercel ortam değişkenlerine ekleyin.' }, { status: 500 })
    }
    return Response.json({ error: 'Görüntü üretilemedi.' }, { status: 500 })
  } catch (err) {
    console.error('AI place error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** Adds the furniture to the room with Gemini, editing the photo in place. */
async function geminiPlace(imageDataUrl: string, furnitureName: string, furnitureImageUrl?: string): Promise<string> {
  const { mimeType, data } = dataUrlToInlineData(imageDataUrl)

  const prompt = `Edit THIS exact photo of a room by adding a "${furnitureName}" to it. Return ONLY the edited image — no text.

Keep the room itself exactly as it is — same walls, floor, windows, doors, lighting, framing and resolution. Do not change or re-render anything except adding the furniture. Place the "${furnitureName}" standing on the floor in a natural, sensible empty spot. Make it photorealistic: correct perspective and real-world scale for the room, all feet flat on the floor (never floating), with a soft contact shadow and lighting that matches the room.`

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
        text: `The image above is the "${furnitureName}" to add. Reproduce its exact shape, colour and material; adapt only its lighting and shadow to the room.`,
      })
    } catch {}
  }

  const model = getGeminiModel()
  let lastDetail = 'bilinmeyen'
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(parts)
      const extracted = await extractImageFromResponse(result)
      if (extracted.imageUrl) return extracted.imageUrl
      lastDetail = extracted.textFallback ? `model metin döndürdü: "${extracted.textFallback}"` : 'görüntü yok, metin yok'
      console.warn(`Gemini place attempt ${attempt + 1}: ${lastDetail}`)
    } catch (e) {
      lastDetail = (e as Error).message
      console.warn(`Gemini place attempt ${attempt + 1} threw: ${lastDetail}`)
    }
  }
  throw new Error(`Gemini görüntü üretemedi (${lastDetail})`)
}
