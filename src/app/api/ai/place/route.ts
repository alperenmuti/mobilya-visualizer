import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { runFluxKontextMulti } from '@/lib/fal'
import { engineerPlacement } from '@/lib/placement'
import { getGeminiModel, dataUrlToInlineData, extractImageFromResponse } from '@/lib/gemini'
import { roomTypeToEn } from '@/lib/roomTypes'

// FLUX Kontext / Gemini image calls can take 15-40s — give the function room.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, furnitureName, furnitureImageUrl, clickX, clickY, markerDrawn, diag, roomType } = await req.json()

    // Safe diagnostic: reports only whether keys are configured (never values).
    if (diag) {
      return Response.json({ gemini: !!process.env.GEMINI_KEY, fal: !!process.env.FAL_KEY })
    }

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    // Click -> position brief (left/right/depth/facing) for the prompt.
    const hasClick = typeof clickX === 'number' && typeof clickY === 'number'
    let placementHint = hasClick ? engineerPlacement(clickX, clickY).description : null
    // Seating furniture must always be against a wall regardless of click position.
    if (placementHint && /koltuk|kanepe|berjer|sofa|chair|armchair|couch/i.test(furnitureName ?? '')) {
      placementHint += ' IMPORTANT: This is seating furniture — its back MUST be touching a wall. Do NOT place it floating in the middle of the room.'
    }

    // ── PRIMARY: Gemini — edits the photo in place, keeping the room's exact
    //    resolution, framing and detail (FLUX re-renders the whole image at low
    //    res and drifts; user prefers Gemini). ──────────────────────────────
    if (process.env.GEMINI_KEY) {
      try {
        const resultUrl = await geminiPlace(imageDataUrl, furnitureName, furnitureImageUrl, placementHint, markerDrawn === true, roomTypeToEn(roomType ?? ''))
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
async function geminiPlace(
  imageDataUrl: string,
  furnitureName: string,
  furnitureImageUrl?: string,
  placementHint?: string | null,
  markerDrawn?: boolean,
  roomTypeEn?: string,
): Promise<string> {
  const { mimeType, data } = dataUrlToInlineData(imageDataUrl)

  // When the user marked a spot with the crosshair, lead with ONLY the visual
  // marker reference. Mixing verbose text coordinates alongside a visual anchor
  // causes Gemini to average or ignore the dot — keep it simple and visual-first.
  let placementSection: string
  if (markerDrawn) {
    // Extract only the depth/scale cue from the hint (background/foreground) so
    // we don't add conflicting left/right/centre text that overrides the dot.
    const scaleNote =
      placementHint?.includes('BACKGROUND') ? 'It is deep in the background — render it noticeably smaller and higher in the frame.' :
      placementHint?.includes('FOREGROUND') ? 'It is close to the camera — render it larger.' :
      'Render at natural medium scale for mid-distance depth.'

    placementSection = `## WHERE TO PLACE THE FURNITURE (CRITICAL — follow exactly)
An orange crosshair marker is drawn on the floor of the room photo.
You MUST place the "${furnitureName}" so its base (floor-contact point) is centred on that crosshair.
Do NOT move it elsewhere. Do NOT pick a "nicer" or "more natural" spot. The crosshair IS the target.
The furniture must completely cover and hide the crosshair under its base.
${scaleNote}`
  } else if (placementHint) {
    placementSection = `## WHERE TO PLACE THE FURNITURE\n${placementHint}`
  } else {
    placementSection = `## WHERE TO PLACE THE FURNITURE\nPlace the "${furnitureName}" standing on the floor in a natural empty spot.`
  }

  const roomContext = roomTypeEn
    ? `Room type: ${roomTypeEn} — place the furniture appropriately for this room.`
    : ''

  const prompt = `${placementSection}

## TASK
Add a single "${furnitureName}" into the room photo. Return ONLY the edited image — no text.
${roomContext ? roomContext + '\n' : ''}
## PHOTO EDIT RULES (keep the room pixel-perfect)
- This is a LOCAL edit, NOT a re-render. Output = same photograph + one furniture piece added.
- Camera: same angle, viewpoint, zoom, framing, crop, aspect ratio — do NOT change.
- Room: every wall, floor, window, door, colour, existing item stays exactly as-is — do NOT touch.
- Only allowed change: add the "${furnitureName}" at the specified position.
- Render it photorealistically: aligned to the room's perspective and vanishing lines, all legs flat on the floor (never floating), correct real-world scale, soft contact shadow, lighting matches the room.
- Add nothing else — no extra items, decor, people or text.`

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
