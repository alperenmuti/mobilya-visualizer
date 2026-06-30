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
    const { imageDataUrl, furnitureName, furnitureImageUrl, clickX, clickY, markerDrawn, preComposited, diag, roomType } = await req.json()

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
        const resultUrl = await geminiPlace(imageDataUrl, furnitureName, furnitureImageUrl, placementHint, markerDrawn === true, roomTypeToEn(roomType ?? ''), preComposited === true)
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
  preComposited?: boolean,
): Promise<string> {
  const { mimeType, data } = dataUrlToInlineData(imageDataUrl)

  const roomContext = roomTypeEn
    ? `Room type: ${roomTypeEn}.`
    : ''

  let prompt: string

  if (preComposited) {
    // The furniture has already been composited at the correct position by the
    // frontend canvas. Gemini's only job is post-processing: fix perspective,
    // remove white edges/halo, add shadow, match lighting. Do NOT move it.
    prompt = `The image shows a room with a "${furnitureName}" that has already been placed at the correct position.
${roomContext}
Your job is ONLY post-processing — do NOT move the furniture:
1. Fix the furniture's perspective so it aligns with the room's vanishing lines and floor angle
2. Remove any remaining white background halo or sharp cut edges around the furniture
3. Adjust the furniture's size/scale to look realistic for its depth in the room
4. Add a soft contact shadow matching the room's lighting direction
5. Match the furniture's colour temperature and exposure to the room's ambient light
6. Keep the rest of the room 100% unchanged — only fix the composited furniture

Return ONLY the edited image — no text.`
  } else {
    // Fallback: marker-guided or free placement
    let placementSection: string
    if (markerDrawn) {
      const scaleNote =
        placementHint?.includes('BACKGROUND') ? 'It is deep in the background — render it noticeably smaller.' :
        placementHint?.includes('FOREGROUND') ? 'It is close to the camera — render it larger.' :
        'Render at natural medium scale.'

      placementSection = `## PLACEMENT (CRITICAL)
An orange crosshair is drawn on the floor. Place the "${furnitureName}" so its base is centred on that crosshair. Do NOT pick a different spot.
${scaleNote}`
    } else if (placementHint) {
      placementSection = `## PLACEMENT\n${placementHint}`
    } else {
      placementSection = `## PLACEMENT\nPlace the "${furnitureName}" in a natural empty spot on the floor.`
    }

    prompt = `${placementSection}

## TASK
Add a single "${furnitureName}" into the room photo. Return ONLY the edited image — no text.
${roomContext}
## RULES
- Same photograph + one furniture piece added — do NOT re-render or restyle.
- Camera, room, walls, floor, existing items: unchanged.
- Render the furniture with correct perspective, all legs on the floor, soft shadow, matched lighting.
- Nothing else added.`
  }

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
