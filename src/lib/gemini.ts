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
 * Converts click coordinates into precise floor-contact + wall placement instructions.
 * Critical insight: the click point IS the floor contact point, not the furniture center.
 */
export function describePlacement(x: number, y: number, furnitureName: string): string {
  const isSeating = /koltuk|kanepe|sandalye|berjer|sofa|chair|armchair|couch/i.test(furnitureName)
  const isStorage = /dolap|kitaplık|raf|cabinet|shelf|bookcase|wardrobe/i.test(furnitureName)
  const isTable = /masa|sehpa|coffee table|dining table|side table/i.test(furnitureName)
  const isBed = /yatak|bed/i.test(furnitureName)

  const pctX = Math.round(x * 100)
  const pctY = Math.round(y * 100)

  // Floor contact — the single most critical instruction
  const floorContact = `FLOOR CONTACT POINT: The click at (${pctX}%, ${pctY}%) is the EXACT SPOT where the furniture's base/feet must touch the floor surface. The furniture body extends UPWARD from this point. Do NOT place the furniture above or below this floor contact point — it stands ON the floor AT this position.`

  // Depth estimation (y coordinate → distance from camera)
  const depthHint = y < 0.40
    ? `This is near the FAR WALL — the furniture should appear SMALL due to perspective (farther from camera).`
    : y < 0.65
    ? `This is at MID-DEPTH in the room.`
    : `This is CLOSE TO THE CAMERA — the furniture should appear LARGER due to perspective.`

  // Wall proximity and facing
  let wallInstruction: string
  let facingRule: string

  if (x < 0.22) {
    wallInstruction = 'The LEFT WALL is immediately to the left — place the furniture flush against it.'
    facingRule = isSeating
      ? 'The back of the seating presses against the left wall. It FACES RIGHT toward the room interior.'
      : 'The side/back of the furniture is against the left wall, facing right.'
  } else if (x > 0.78) {
    wallInstruction = 'The RIGHT WALL is immediately to the right — place the furniture flush against it.'
    facingRule = isSeating
      ? 'The back of the seating presses against the right wall. It FACES LEFT toward the room interior.'
      : 'The side/back of the furniture is against the right wall, facing left.'
  } else if (y < 0.45) {
    wallInstruction = 'The BACK (far) WALL is directly behind this position.'
    facingRule = isSeating
      ? 'The back of the seating is against the back wall. It FACES TOWARD THE CAMERA (toward the viewer).'
      : 'The back of the furniture is against the back wall, facing toward the camera.'
  } else {
    wallInstruction = 'Position is in the central floor area, back toward the far wall.'
    facingRule = isSeating
      ? 'The seating FACES TOWARD THE CAMERA. Its back is toward the far wall.'
      : 'The furniture faces toward the camera.'
  }

  // Type-specific constraints
  let typeConstraint = ''
  if (isSeating) {
    typeConstraint = `SOFA/CHAIR RULE: The back of the ${furnitureName} must lean against or be very close to a wall — never fully floating in open space. All four legs (or the base) rest flat on the floor.`
  } else if (isStorage) {
    typeConstraint = `CABINET/SHELF RULE: ${furnitureName} stands perfectly vertical against the wall with zero gap between its back and the wall surface. Base sits flat on the floor.`
  } else if (isTable) {
    typeConstraint = `TABLE RULE: All legs of the ${furnitureName} touch the floor simultaneously. The tabletop is level (horizontal), not tilted.`
  } else if (isBed) {
    typeConstraint = `BED RULE: The headboard of the ${furnitureName} sits flush against the wall. The entire bed frame rests flat on the floor.`
  }

  return [floorContact, depthHint, wallInstruction, facingRule, typeConstraint].filter(Boolean).join('\n')
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
