import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'

export function getGeminiModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY!)
  return genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-image',
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      temperature: 1,
    } as GenerationConfig & { responseModalities: string[] },
  })
}

export function dataUrlToInlineData(dataUrl: string): { mimeType: string; data: string } {
  const [header, data] = dataUrl.split(',')
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
  return { mimeType, data }
}

/**
 * Converts click coordinates to interior-design-aware placement instructions.
 * In a typical room photo: left wall = left edge, right wall = right edge,
 * back wall = upper-center, floor/foreground = bottom.
 */
export function describePlacement(x: number, y: number, furnitureName: string): string {
  const isSeating = /koltuk|kanepe|sandalye|berjer|sofa|chair|armchair|couch/i.test(furnitureName)
  const isStorage = /dolap|kitaplık|raf|cabinet|shelf|bookcase|wardrobe/i.test(furnitureName)
  const isTable = /masa|sehpa|coffee table|dining table|side table/i.test(furnitureName)
  const isBed = /yatak|bed/i.test(furnitureName)

  // Determine which wall/area was clicked
  let wallInstruction: string
  let orientationRule: string

  if (x < 0.25) {
    // Left side → against left wall
    wallInstruction = 'Place it flush against the LEFT wall of the room.'
    orientationRule = isSeating
      ? 'The seating must face RIGHTWARD / toward the center of the room, NOT toward the wall.'
      : 'The furniture faces rightward/inward.'
  } else if (x > 0.75) {
    // Right side → against right wall
    wallInstruction = 'Place it flush against the RIGHT wall of the room.'
    orientationRule = isSeating
      ? 'The seating must face LEFTWARD / toward the center of the room, NOT toward the wall.'
      : 'The furniture faces leftward/inward.'
  } else if (y < 0.45) {
    // Upper area → against back/far wall
    wallInstruction = 'Place it flush against the BACK (far) wall of the room.'
    orientationRule = isSeating
      ? 'The seating must face TOWARD THE CAMERA / toward the viewer, NOT toward the back wall.'
      : 'The furniture faces toward the camera/viewer.'
  } else {
    // Lower/center → against back wall, slightly forward
    wallInstruction = 'Place it against the BACK wall or in the center-back area of the room.'
    orientationRule = isSeating
      ? 'The seating must face TOWARD THE CAMERA / toward the viewer.'
      : 'The furniture faces toward the camera/viewer.'
  }

  // Type-specific rules
  let typeRule = ''
  if (isSeating) {
    typeRule = `SEATING RULE: Sofas and armchairs are NEVER placed floating in the middle of an empty room — they must have their back against a wall or be part of a clearly intentional arrangement. The back of the ${furnitureName} goes against the wall.`
  } else if (isStorage) {
    typeRule = `STORAGE RULE: ${furnitureName} must be placed flush against a wall with no gap between the back of the furniture and the wall surface.`
  } else if (isTable) {
    typeRule = `TABLE RULE: Place the ${furnitureName} as a natural centerpiece or against the wall depending on context.`
  } else if (isBed) {
    typeRule = `BED RULE: The headboard of the ${furnitureName} goes against the wall, usually centered on that wall.`
  }

  return `${wallInstruction}\n${orientationRule}\n${typeRule}`
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
