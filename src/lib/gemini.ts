import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'

export function getGeminiModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY!)
  return genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-image',
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      temperature: 0.7,
    } as GenerationConfig & { responseModalities: string[] },
  })
}

export function dataUrlToInlineData(dataUrl: string): { mimeType: string; data: string } {
  const [header, data] = dataUrl.split(',')
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
  return { mimeType, data }
}

/** Strips SKU codes and brand suffixes from furniture names, e.g. "Alia Koltuk 2C0ALIA001 | İstikbal" → "Alia Koltuk" */
export function cleanFurnitureName(name: string): string {
  return (name ?? '')
    .split('|')[0]
    .replace(/\b[A-Z0-9]{6,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Returns precise placement instructions for the Gemini prompt.
 *
 * Wall zones (tight — only trigger when clearly near a wall):
 *   x < 0.28  → near left wall
 *   x > 0.72  → near right wall
 *   y < 0.40  → near back wall
 *   corner    → (left|right) AND y < 0.32
 *
 * Seating (koltuk, kanepe, berjer…) is ALWAYS placed against a wall.
 * For center-area clicks, the nearest wall is inferred from x position.
 */
export function describePlacement(x: number, y: number, furnitureName: string): string {
  const isSeating = /koltuk|kanepe|sandalye|berjer|sofa|chair|armchair|couch/i.test(furnitureName)

  const pctX = Math.round(x * 100)
  const pctY = Math.round(y * 100)

  const nearLeft  = x < 0.28
  const nearRight = x > 0.72
  const nearBack  = y < 0.40
  const cornerL   = nearLeft  && y < 0.32
  const cornerR   = nearRight && y < 0.32

  // Seating must always be against a wall — infer wall from x if in open area
  let effectiveLeft  = nearLeft
  let effectiveRight = nearRight
  let effectiveBack  = nearBack

  if (isSeating && !nearLeft && !nearRight && !nearBack) {
    if (x < 0.42)      effectiveLeft  = true
    else if (x > 0.58) effectiveRight = true
    else                effectiveBack  = true
  }

  let zone: string
  let wallRule: string
  let facing: string

  if (cornerL) {
    zone     = 'top-left corner where the left wall and back wall meet'
    wallRule = 'Left side flush against left wall. Back flush against back wall. Zero gap on both.'
    facing   = 'Faces diagonally toward the room center (right and toward camera).'
  } else if (cornerR) {
    zone     = 'top-right corner where the right wall and back wall meet'
    wallRule = 'Right side flush against right wall. Back flush against back wall. Zero gap on both.'
    facing   = 'Faces diagonally toward the room center (left and toward camera).'
  } else if (effectiveLeft) {
    zone     = 'against the left wall'
    wallRule = 'Back of the furniture pressed flat against the left wall — continuous contact, zero gap, no shadow gap.'
    facing   = 'Faces right, toward the room interior.'
  } else if (effectiveRight) {
    zone     = 'against the right wall'
    wallRule = 'Back of the furniture pressed flat against the right wall — continuous contact, zero gap.'
    facing   = 'Faces left, toward the room interior.'
  } else if (effectiveBack) {
    zone     = 'against the back (far) wall'
    wallRule = 'Back of the furniture pressed flat against the back wall — continuous contact, zero gap.'
    facing   = 'Faces the camera.'
  } else {
    zone     = 'open floor, away from walls'
    wallRule = 'Freestanding — no wall contact needed. Leave natural spacing on all sides.'
    facing   = 'Faces the camera.'
  }

  // Perspective-aware scale instruction based on y depth
  const perspectiveScale = y < 0.28
    ? `PERSPECTIVE SCALE: Very far from camera (top of image). Furniture must appear roughly 35-50% the size it would at the foreground. Use door heights and floor tile proportions visible in the image to calibrate.`
    : y < 0.42
    ? `PERSPECTIVE SCALE: Far from camera. Furniture appears about 55-70% of foreground size. Scale down accordingly.`
    : y < 0.58
    ? `PERSPECTIVE SCALE: Mid-depth. Standard perspective scale.`
    : y < 0.72
    ? `PERSPECTIVE SCALE: Moderately close to camera. Furniture appears about 115-130% of mid-depth size.`
    : `PERSPECTIVE SCALE: Very close to camera (bottom of image). Furniture appears large — roughly 140-160% of standard. May be partially cropped at bottom edge.`

  return `ZONE: ${zone}.
ANCHOR — LOCKED: The center of the furniture's floor footprint is at pixel (${pctX}% from left, ${pctY}% from top). Do NOT drift from this point.
WALL RULE: ${wallRule}
FACING: ${facing}
${perspectiveScale}`
}

export async function extractImageFromResponse(
  result: Awaited<ReturnType<ReturnType<typeof getGeminiModel>['generateContent']>>
): Promise<{ imageUrl: string | null; textFallback: string | null }> {
  const parts = result.response.candidates?.[0]?.content?.parts ?? []
  let textFallback: string | null = null

  for (const part of parts) {
    if ('inlineData' in part && part.inlineData) {
      const { mimeType, data } = part.inlineData as { mimeType: string; data: string }
      return { imageUrl: `data:${mimeType};base64,${data}`, textFallback: null }
    }
    if ('text' in part && typeof part.text === 'string' && part.text.trim()) {
      textFallback = part.text.trim().slice(0, 200)
    }
  }

  return { imageUrl: null, textFallback }
}
