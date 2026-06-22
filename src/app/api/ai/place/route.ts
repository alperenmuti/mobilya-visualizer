import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { runFluxKontextMulti, pasteFurnitureAndRefine } from '@/lib/fal'
import { engineerPlacement } from '@/lib/placement'
import { getGeminiModel, dataUrlToInlineData, extractImageFromResponse } from '@/lib/gemini'

// FLUX Kontext / Gemini image calls can take 15-40s — give the function room.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, furnitureName, furnitureImageUrl, clickX, clickY } = await req.json()

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    const hasClick = typeof clickX === 'number' && typeof clickY === 'number'
    // Prompt-engineer layer (used by the no-click / Gemini fallback path).
    const spec = hasClick ? engineerPlacement(clickX, clickY) : null
    const hint = spec
      ? spec.description
      : 'in the most natural, well-composed spot in the room'

    // ── Primary: cut out the real product, paste it exactly where the user
    //    clicked (correct position + scale), then let FLUX refine it. ───────
    if (process.env.FAL_KEY && furnitureImageUrl) {
      try {
        const resultUrl = hasClick
          ? await pasteFurnitureAndRefine({ roomDataUrl: imageDataUrl, furnitureImageUrl, furnitureName, x: clickX, y: clickY })
          : await runFluxKontextMulti({
              roomDataUrl: imageDataUrl,
              furnitureImageUrl,
              prompt: `The first image is a room. The second image is a "${furnitureName}". Place that exact piece of furniture from the second image into the room, positioned ${hint}. Keep the room completely unchanged. Reproduce the furniture's real shape, colour and material; render it at realistic scale and perspective, feet on the floor, natural contact shadow. Output only the edited room photo — no other objects or text.`,
            })
        return Response.json({ resultUrl, engine: hasClick ? 'flux-paste' : 'flux' })
      } catch (e) {
        const msg = (e as Error).message
        console.error('FLUX place error:', msg)
        // No Gemini fallback configured → surface the real reason instead of
        // silently returning the unchanged room (which looks like "nothing happened").
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
