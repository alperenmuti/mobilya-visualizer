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

/** Strips SKU codes and brand suffixes from furniture names, e.g. "Alia Koltuk 2C0ALIA001 | İstikbal" → "Alia Koltuk" */
export function cleanFurnitureName(name: string): string {
  return (name ?? '')
    .split('|')[0]                          // remove brand suffix after |
    .replace(/\b[A-Z0-9]{6,}\b/g, '')      // remove SKU-like codes (6+ uppercase alphanumeric chars)
    .replace(/\s+/g, ' ')
    .trim()
}

export function dataUrlToInlineData(dataUrl: string): { mimeType: string; data: string } {
  const [header, data] = dataUrl.split(',')
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
  return { mimeType, data }
}

/**
 * Converts click coordinates into floor-contact + wall-proximity instructions.
 *
 * Wall detection uses wider zones than you'd expect because in a perspective
 * room photo the visible floor area is wide — furniture "against the left wall"
 * can appear anywhere in the left 40% of the image.
 *
 * Zones:
 *   x < 0.38  → near left wall
 *   x > 0.62  → near right wall
 *   y < 0.52  → near back wall (upper half = far from camera)
 *   corner    → both left/right AND y < 0.42
 *   center    → none of the above (open floor)
 */
export function describePlacement(x: number, y: number, furnitureName: string): string {
  const isSeating = /koltuk|kanepe|sandalye|berjer|sofa|chair|armchair|couch/i.test(furnitureName)
  const isStorage = /dolap|kitaplık|raf|cabinet|shelf|bookcase|wardrobe/i.test(furnitureName)
  const isTable = /masa|sehpa|coffee table|dining table|side table/i.test(furnitureName)
  const isBed = /yatak|bed/i.test(furnitureName)

  const pctX = Math.round(x * 100)
  const pctY = Math.round(y * 100)

  // Floor contact — single most critical rule
  const floorContact = `FLOOR CONTACT POINT: The click at (${pctX}%, ${pctY}%) is the EXACT pixel where the furniture's feet/base must touch the floor. The furniture body extends UPWARD from this point. Zero tolerance — no floating.`

  // Wall proximity (wider zones for realistic perspective room photos)
  const nearLeft = x < 0.38
  const nearRight = x > 0.62
  const nearBack = y < 0.52
  const inCorner = (nearLeft || nearRight) && y < 0.42

  let wallSection: string
  let orientationRule: string

  if (inCorner && nearLeft) {
    wallSection = `CORNER — LEFT + BACK WALL: The click is in the top-left area where the left wall and back wall converge. Place the furniture in that corner.
WALL CONTACT: The furniture's LEFT SIDE (or back-left corner) is flush against the left wall. The furniture's BACK is close to or touching the back wall. Zero gap on both wall surfaces.`
    orientationRule = isSeating
      ? 'The seating FACES diagonally toward the room center (rightward and toward camera). Back-left corner is in the room corner.'
      : 'The furniture tucks into the corner, back-left touching both walls.'

  } else if (inCorner && nearRight) {
    wallSection = `CORNER — RIGHT + BACK WALL: The click is in the top-right area where the right wall and back wall converge. Place the furniture in that corner.
WALL CONTACT: The furniture's RIGHT SIDE (or back-right corner) is flush against the right wall. The furniture's BACK is close to or touching the back wall. Zero gap on both wall surfaces.`
    orientationRule = isSeating
      ? 'The seating FACES diagonally toward the room center (leftward and toward camera). Back-right corner is in the room corner.'
      : 'The furniture tucks into the corner, back-right touching both walls.'

  } else if (nearLeft) {
    wallSection = `LEFT WALL: The left wall surface is to the left of position (${pctX}%, ${pctY}%).
WALL CONTACT: The BACK of the ${furnitureName} is pressed flat against the left wall. You must be able to trace a continuous contact line where the furniture back meets the wall — zero gap, zero shadow gap, no air space between them.`
    orientationRule = isSeating
      ? 'The seating FACES RIGHT — toward the room interior. Back is against the left wall. The front of the seat (where you sit) faces right.'
      : 'The furniture side/back is against the left wall, facing rightward/inward.'

  } else if (nearRight) {
    wallSection = `RIGHT WALL: The right wall surface is to the right of position (${pctX}%, ${pctY}%).
WALL CONTACT: The BACK of the ${furnitureName} is pressed flat against the right wall. Continuous contact line at the wall — zero gap.`
    orientationRule = isSeating
      ? 'The seating FACES LEFT — toward the room interior. Back is against the right wall. The front of the seat (where you sit) faces left.'
      : 'The furniture side/back is against the right wall, facing leftward/inward.'

  } else if (nearBack) {
    wallSection = `BACK WALL: The back (far) wall is directly behind position (${pctX}%, ${pctY}%).
WALL CONTACT: The BACK of the ${furnitureName} is pressed flat against the back wall. Continuous contact line where furniture back meets wall — zero gap.`
    orientationRule = isSeating
      ? 'The seating FACES THE CAMERA — toward the viewer. Back is against the back wall.'
      : 'The back of the furniture is against the back wall, facing toward the camera.'

  } else {
    // Open center of room
    wallSection = `OPEN FLOOR: Position (${pctX}%, ${pctY}%) is in the open center of the room.`
    orientationRule = isSeating
      ? 'The seating FACES THE CAMERA. For natural interior design, keep it in a deliberate arrangement — a coffee table in front if space allows.'
      : 'The furniture faces toward the camera.'
  }

  // Depth/scale hint from y coordinate
  const depthHint = y < 0.38
    ? `DEPTH: Position is near the FAR END of the room — furniture appears SMALLER due to perspective.`
    : y < 0.62
    ? `DEPTH: Mid-depth position.`
    : `DEPTH: CLOSE TO THE CAMERA — furniture appears LARGER due to perspective.`

  // Type physics
  let typePhysics = ''
  if (isSeating) {
    typePhysics = `SEATING PHYSICS: Every leg/base point touches the floor. The back surface of the ${furnitureName} is vertical and flat against the wall. Seat cushions are horizontal. The seating is perfectly upright — not tilted.`
  } else if (isStorage) {
    typePhysics = `STORAGE PHYSICS: ${furnitureName} is perfectly vertical (plumb). Back is flat on the wall surface with zero gap. Base is flat on the floor. All shelves are level.`
  } else if (isTable) {
    typePhysics = `TABLE PHYSICS: All legs contact the floor simultaneously. The tabletop surface is perfectly horizontal (level) — not tilted toward or away from camera.`
  } else if (isBed) {
    typePhysics = `BED PHYSICS: Headboard is flush against the wall. Entire bed frame sits flat on the floor. Mattress is level and horizontal.`
  }

  return [floorContact, wallSection, orientationRule, depthHint, typePhysics].filter(Boolean).join('\n')
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
