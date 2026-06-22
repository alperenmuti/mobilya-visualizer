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

/**
 * Returns a short, direct placement description for the Gemini prompt.
 *
 * Zones (tighter than before to avoid mis-classifying center clicks as wall zones):
 *   x < 0.30  → near left wall
 *   x > 0.70  → near right wall
 *   y < 0.42  → near back wall
 *   corner    → (left|right) AND y < 0.33
 *   open floor → everything else
 */
export function describePlacement(x: number, y: number, furnitureName: string): string {
  const pctX = Math.round(x * 100)
  const pctY = Math.round(y * 100)

  // Plain-language horizontal band — gives the model a verbal anchor alongside the marker.
  const horizontal =
    x < 0.20 ? 'at the far left edge of the room' :
    x < 0.40 ? 'on the left side of the room, left of center' :
    x < 0.60 ? 'horizontally centered in the room' :
    x < 0.80 ? 'on the right side of the room, right of center' :
               'at the far right edge of the room'

  // Depth band from vertical position — lower in frame = closer to camera = larger.
  const depth =
    y < 0.40 ? 'deep in the background, far from the camera, so it must be rendered SMALL' :
    y < 0.65 ? 'in the middle of the room at mid-distance, rendered at MEDIUM size' :
               'in the foreground, close to the camera, so it must be rendered LARGE'

  // Wall contact only when the click is genuinely near a wall.
  const nearLeft  = x < 0.22
  const nearRight = x > 0.78
  const nearBack  = y < 0.30
  let wallRule: string
  let facing: string
  if (nearBack && nearLeft) {
    wallRule = 'Tuck it into the back-left corner: left side flush to the left wall, back flush to the back wall.'
    facing   = 'Faces diagonally toward the room center.'
  } else if (nearBack && nearRight) {
    wallRule = 'Tuck it into the back-right corner: right side flush to the right wall, back flush to the back wall.'
    facing   = 'Faces diagonally toward the room center.'
  } else if (nearLeft) {
    wallRule = 'Back of the furniture is flush against the left wall, zero gap.'
    facing   = 'Faces right, toward the room interior.'
  } else if (nearRight) {
    wallRule = 'Back of the furniture is flush against the right wall, zero gap.'
    facing   = 'Faces left, toward the room interior.'
  } else if (nearBack) {
    wallRule = 'Back of the furniture is flush against the back wall, zero gap.'
    facing   = 'Faces the camera.'
  } else {
    wallRule = 'Freestanding on open floor — natural spacing, no wall contact needed.'
    facing   = 'Faces the camera.'
  }

  return `EXACT POSITION (highest priority): put the "${furnitureName}" ${horizontal}, ${depth}. Its floor contact point sits exactly on the orange marker at ${pctX}% from the left and ${pctY}% from the top. Do NOT center it or move it elsewhere — honor this spot precisely.
${wallRule}
${facing}
Follow the room's floor perspective so the furniture sits naturally at that depth, with all feet on the ground.`
}

/**
 * Draws a bright orange crosshair+circle marker at the click position.
 * Makes the anchor visible to Gemini so it can see exactly where to act.
 *
 * Returns { dataUrl, ok }. `ok` is false when Sharp can't rasterize the SVG
 * (e.g. a serverless runtime whose libvips lacks SVG support) — callers MUST
 * check it and avoid referencing a marker that was never drawn, otherwise
 * Gemini hunts for a nonexistent marker and replies with text instead of an image.
 */
export async function drawMarker(
  imageDataUrl: string,
  cx: number,
  cy: number,
): Promise<{ dataUrl: string; ok: boolean }> {
  try {
    const { default: sharp } = await import('sharp')
    const [, base64] = imageDataUrl.split(',')
    const buffer = Buffer.from(base64, 'base64')
    const meta = await sharp(buffer).metadata()
    const w = meta.width!
    const h = meta.height!
    const mx = Math.round(cx * w)
    const my = Math.round(cy * h)
    const r   = Math.max(18, Math.round(Math.min(w, h) * 0.026))
    const arm = Math.round(r * 1.9)

    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${mx - arm}" y1="${my}" x2="${mx + arm}" y2="${my}" stroke="black" stroke-width="5" stroke-linecap="round"/>
      <line x1="${mx}" y1="${my - arm}" x2="${mx}" y2="${my + arm}" stroke="black" stroke-width="5" stroke-linecap="round"/>
      <line x1="${mx - arm}" y1="${my}" x2="${mx + arm}" y2="${my}" stroke="#FF6B00" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="${mx}" y1="${my - arm}" x2="${mx}" y2="${my + arm}" stroke="#FF6B00" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="${mx}" cy="${my}" r="${r + 3}" fill="rgba(0,0,0,0.6)"/>
      <circle cx="${mx}" cy="${my}" r="${r}" fill="rgba(255,107,0,0.88)"/>
      <circle cx="${mx}" cy="${my}" r="${Math.max(5, Math.round(r * 0.28))}" fill="white"/>
    </svg>`

    const out = await sharp(buffer)
      .composite([{ input: Buffer.from(svg), blend: 'over' }])
      .jpeg({ quality: 92 })
      .toBuffer()

    return { dataUrl: `data:image/jpeg;base64,${out.toString('base64')}`, ok: true }
  } catch (e) {
    console.warn('drawMarker failed, falling back to unmarked image:', (e as Error).message)
    return { dataUrl: imageDataUrl, ok: false }
  }
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
