import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { runFluxKontextMulti } from '@/lib/fal'
import { engineerPlacement, getOrientationRules } from '@/lib/placement'
import { getGeminiModel, dataUrlToInlineData, extractImageFromResponse } from '@/lib/gemini'
import { roomTypeToEn } from '@/lib/roomTypes'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, furnitureName, furnitureImageUrl, clickX, clickY, markerDrawn, preComposited, diag, roomType } = await req.json()

    if (diag) {
      return Response.json({ gemini: !!process.env.GEMINI_KEY, fal: !!process.env.FAL_KEY })
    }

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    const hasClick = typeof clickX === 'number' && typeof clickY === 'number'
    const spec = hasClick ? engineerPlacement(clickX, clickY) : null
    const orientationRules = spec ? getOrientationRules(spec.wallSide, furnitureName) : ''

    if (process.env.GEMINI_KEY) {
      try {
        const resultUrl = await geminiPlace(
          imageDataUrl, furnitureName, furnitureImageUrl,
          spec?.description ?? null,
          orientationRules,
          spec?.depthLabel ?? 'mid',
          spec?.wallSide ?? 'center',
          markerDrawn === true,
          roomTypeToEn(roomType ?? ''),
          preComposited === true,
        )
        return Response.json({ resultUrl, engine: 'gemini' })
      } catch (e) {
        console.error('Gemini place error:', (e as Error).message)
      }
    }

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

async function geminiPlace(
  imageDataUrl: string,
  furnitureName: string,
  furnitureImageUrl?: string,
  positionHint?: string | null,
  orientationRules?: string,
  depthLabel?: string,
  wallSide?: string,
  markerDrawn?: boolean,
  roomTypeEn?: string,
  preComposited?: boolean,
): Promise<string> {
  const { mimeType, data } = dataUrlToInlineData(imageDataUrl)
  const roomCtx = roomTypeEn ? `Room type: ${roomTypeEn}.` : ''

  let prompt: string

  if (preComposited) {
    // The frontend canvas already placed the furniture at the correct X/Y.
    // Gemini must NOT move it. Its only job: fix orientation + blending.
    const scaleHint =
      depthLabel === 'background' ? 'It is far from the camera — it should appear smaller.' :
      depthLabel === 'foreground'  ? 'It is close to the camera — it should appear larger.' :
      ''

    prompt = `You are an interior designer photo editor. The image shows a room with a "${furnitureName}" that was roughly composited at the correct floor position.
${roomCtx}

## STEP 1 — FIX ORIENTATION (most important)
${orientationRules || `Orient the furniture naturally for its position in the room. If near a wall, its back must face the wall and its front faces into the room. NEVER place seating perpendicular to a wall (never seat facing the wall).`}

## STEP 2 — FIX REALISM (do NOT change the position or move to a different spot)
- Align the furniture to the room's EXISTING perspective and vanishing lines — same floor plane
- ${scaleHint || 'Scale it to look realistic for its depth in the room'}
- Remove any white background halo or sharp cut edges around the furniture
- Add a soft contact shadow underneath matching the room's light direction
- Match the furniture's colour temperature and exposure to the room's ambient lighting
- Keep every other pixel in the room unchanged — only fix the furniture

Return ONLY the edited image — no text, no explanation.`
  } else {
    // Fallback: Gemini must both place and orient
    const posSection = markerDrawn
      ? `An orange crosshair marks the exact floor spot. The "${furnitureName}" base must be centred on it. Do NOT move it elsewhere.`
      : (positionHint ?? `Place the "${furnitureName}" in a natural empty spot on the floor.`)

    prompt = `You are a professional interior designer. Add a single "${furnitureName}" to this room photo.
${roomCtx}

## PLACEMENT (mandatory — follow exactly)
${posSection}

## ORIENTATION (interior design rules — mandatory)
${orientationRules || `Place the furniture naturally for its position. Seating must always have its back against the nearest wall facing into the room.`}

## PHOTO EDIT RULES
- This is a local edit — output is the same photograph with ONLY the "${furnitureName}" added.
- Camera, room, walls, floor, all existing items: 100% unchanged.
- Furniture: correct perspective (aligned to room vanishing lines), all legs flat on floor, soft contact shadow, lighting matches room.
- Nothing else added.

Return ONLY the edited image — no text.`
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
      parts.push({ text: `The image above is the "${furnitureName}" to add. Reproduce its exact shape, colour and material; adapt only its lighting and shadow to the room.` })
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
    } catch (e) {
      lastDetail = (e as Error).message
    }
  }
  throw new Error(`Gemini görüntü üretemedi (${lastDetail})`)
}
