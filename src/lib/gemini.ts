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

  const nearLeft  = x < 0.30
  const nearRight = x > 0.70
  const nearBack  = y < 0.42
  const cornerL   = nearLeft  && y < 0.33
  const cornerR   = nearRight && y < 0.33

  let zone: string
  let wallRule: string
  let facing: string

  if (cornerL) {
    zone     = 'top-left corner where the left wall and back wall meet'
    wallRule = `Left side of the furniture is flush against the left wall. Back is flush against the back wall. Zero gap on both.`
    facing   = 'Faces diagonally toward the room center (right + toward camera).'
  } else if (cornerR) {
    zone     = 'top-right corner where the right wall and back wall meet'
    wallRule = `Right side of the furniture is flush against the right wall. Back is flush against the back wall. Zero gap on both.`
    facing   = 'Faces diagonally toward the room center (left + toward camera).'
  } else if (nearLeft) {
    zone     = 'against the left wall'
    wallRule = `Back of the furniture is pressed flat against the left wall — continuous contact, zero gap.`
    facing   = 'Faces right, toward the room interior.'
  } else if (nearRight) {
    zone     = 'against the right wall'
    wallRule = `Back of the furniture is pressed flat against the right wall — continuous contact, zero gap.`
    facing   = 'Faces left, toward the room interior.'
  } else if (nearBack) {
    zone     = 'against the back (far) wall'
    wallRule = `Back of the furniture is pressed flat against the back wall — continuous contact, zero gap.`
    facing   = 'Faces the camera.'
  } else {
    zone     = 'open floor, away from walls'
    wallRule = `Freestanding — no wall contact needed. Leave natural spacing on all sides.`
    facing   = 'Faces the camera.'
  }

  const depth = y < 0.38
    ? 'Far from camera — furniture appears SMALLER due to perspective.'
    : y > 0.68
    ? 'Close to camera — furniture appears LARGER due to perspective.'
    : 'Mid-depth — standard scale.'

  return `ZONE: ${zone}.
ANCHOR — LOCKED: The center of the furniture's floor footprint is at pixel (${pctX}% from left, ${pctY}% from top). Do NOT drift the furniture from this point.
WALL RULE: ${wallRule}
FACING: ${facing}
DEPTH/SCALE: ${depth}`
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
