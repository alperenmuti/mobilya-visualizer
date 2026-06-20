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

export async function extractImageFromResponse(
  result: Awaited<ReturnType<ReturnType<typeof getGeminiModel>['generateContent']>>
): Promise<string | null> {
  const parts = result.response.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    if ('inlineData' in part && part.inlineData) {
      const { mimeType, data } = part.inlineData as { mimeType: string; data: string }
      return `data:${mimeType};base64,${data}`
    }
  }
  return null
}
