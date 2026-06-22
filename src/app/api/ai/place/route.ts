import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { runFluxKontextMulti } from '@/lib/fal'
import { engineerPlacement } from '@/lib/placement'
import { getGeminiModel, dataUrlToInlineData, extractImageFromResponse } from '@/lib/gemini'

// FLUX Kontext / Gemini image calls can take 15-40s — give the function room.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, furnitureName, furnitureImageUrl, clickX, clickY, markerDrawn } = await req.json()

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    const hasClick = typeof clickX === 'number' && typeof clickY === 'number'
    // Prompt-engineer layer: click -> rich perspective/depth/angle placement brief.
    const spec = hasClick ? engineerPlacement(clickX, clickY) : null
    const hint = spec
      ? spec.description
      : 'in the most natural, well-composed spot in the room, at a realistic scale and perspective with all feet on the floor'

    // ── Generative placement: FLUX Kontext renders the real product into the
    //    room at correct perspective / depth / angle, guided to the click. ───
    if (process.env.FAL_KEY && furnitureImageUrl) {
      try {
        const markerLine = markerDrawn
          ? `There is a bright orange dot drawn on the floor of the first image. That dot marks the EXACT spot where the furniture's base must stand — place it directly on the dot and hide the dot completely under the furniture. The dot location is non-negotiable.`
          : ''
        const resultUrl = await runFluxKontextMulti({
          roomDataUrl: imageDataUrl,
          furnitureImageUrl,
          prompt: `The first image is a room. The second image is a "${furnitureName}".
${markerLine}
${hint}
Add that exact piece of furniture from the second image into the room AT THE SPECIFIED SPOT ONLY. Render it in correct 3-D perspective and angle for that spot — it may be seen from a slight angle — with every foot flat on the floor (no floating), realistic scale for its depth, a natural contact shadow, and lighting matching the room. Reproduce its real shape, colour, upholstery and material from the second image. Keep the room itself completely unchanged (walls, floor, windows, doors, lighting, camera). Output only the edited room photo — no dot, no other objects, people or text.`,
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
