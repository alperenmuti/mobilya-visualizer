import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { runFluxKontext } from '@/lib/fal'
import { getGeminiModel, dataUrlToInlineData, extractImageFromResponse } from '@/lib/gemini'

// FLUX Kontext / Gemini image calls can take 15-40s — give the function room.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, furnitureName, furnitureImageUrl, placementHint } = await req.json()

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    const hint = typeof placementHint === 'string' && placementHint.trim()
      ? placementHint.trim()
      : 'in the most natural, well-composed spot in the room'

    // ── Primary: FLUX.1 Kontext (instruction-based image editing) ──────────
    if (process.env.FAL_KEY) {
      try {
        const prompt = `Add a photorealistic ${furnitureName} to this empty room, placed ${hint}. Keep the room itself completely unchanged — same walls, floor, ceiling, windows, doors, lighting and camera angle. The ${furnitureName} must rest naturally on the floor at correct real-world scale and perspective, with realistic contact shadows that match the room's light. Do not add any other objects, people or text.`
        const resultUrl = await runFluxKontext({ imageDataUrl, prompt })
        return Response.json({ resultUrl, engine: 'flux' })
      } catch (e) {
        console.error('FLUX place error, falling back:', (e as Error).message)
        // fall through to Gemini / demo
      }
    }

    // ── Fallback: Gemini ───────────────────────────────────────────────────
    if (!process.env.GEMINI_KEY) {
      return Response.json({ resultUrl: imageDataUrl, demo: true })
    }

    const { mimeType, data } = dataUrlToInlineData(imageDataUrl)

    const prompt = `Edit this photo of an empty room by adding a "${furnitureName}". Return ONLY the edited image — do not reply with any text.

Place the "${furnitureName}" ${hint}. Choose a position that looks natural and realistic for this type of furniture in this room.

Make it photorealistic: follow the room's floor perspective so the furniture sits at the correct scale and depth, with all feet flat on the floor (never floating) and a soft contact shadow underneath. Match the room's existing lighting, color temperature and camera angle. Keep everything else exactly as it is — do not change the walls, floor, ceiling, windows or doors, and do not add any other objects.`

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
