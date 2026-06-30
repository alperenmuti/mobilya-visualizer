export type WallSide = 'left' | 'right' | 'back' | 'center'

export interface PlacementSpec {
  description: string
  wallSide: WallSide
  depthLabel: 'background' | 'mid' | 'foreground'
}

export function engineerPlacement(x: number, y: number): PlacementSpec {
  const wallSide: WallSide =
    x < 0.22 ? 'left' :
    x > 0.78 ? 'right' :
    y < 0.32 ? 'back' :
    'center'

  const depthLabel: PlacementSpec['depthLabel'] =
    y < 0.40 ? 'background' :
    y < 0.65 ? 'mid' :
    'foreground'

  const depthText =
    depthLabel === 'background' ? 'deep in the background — render noticeably SMALLER (far from camera)' :
    depthLabel === 'foreground' ? 'in the foreground — render LARGER (close to camera)' :
    'at mid-distance — render at natural scale'

  const posText =
    wallSide === 'left'   ? 'against the LEFT wall' :
    wallSide === 'right'  ? 'against the RIGHT wall' :
    wallSide === 'back'   ? 'against the back/far wall' :
    x < 0.4              ? 'on the left side of the room' :
    x > 0.6              ? 'on the right side of the room' :
                            'in the centre of the room'

  const description =
    `Place it ${posText}, ${depthText}. ` +
    `Floor contact at ${Math.round(x * 100)}% from left, ${Math.round(y * 100)}% from top. ` +
    `Do NOT move it to a different area — this position is mandatory.`

  return { description, wallSide, depthLabel }
}

/**
 * Returns interior-designer rules for how a piece of furniture should be
 * oriented relative to the wall it's placed against.
 * Gemini tends to get this wrong (placing sofas perpendicular to walls) so we
 * give it explicit rules derived from the furniture type + wall side.
 */
export function getOrientationRules(wallSide: WallSide, furnitureName: string): string {
  const isSeating  = /koltuk|kanepe|berjer|sofa|couch|armchair|chair|sandalye/i.test(furnitureName)
  const isBed      = /yatak|bed/i.test(furnitureName)
  const isStorage  = /dolap|kitaplık|şifonyer|wardrobe|cabinet|bookcase|shelf/i.test(furnitureName)
  const isTable    = /masa|sehpa|table|desk/i.test(furnitureName)

  if (isSeating) {
    if (wallSide === 'left')   return `SEATING RULE: sofa/chair BACK must be flat against the LEFT wall. The piece faces RIGHT into the room. Seen from front-right three-quarter view. NEVER perpendicular to the wall (never facing left wall).`
    if (wallSide === 'right')  return `SEATING RULE: sofa/chair BACK must be flat against the RIGHT wall. The piece faces LEFT into the room. Seen from front-left three-quarter view. NEVER perpendicular to the wall (never facing right wall).`
    if (wallSide === 'back')   return `SEATING RULE: sofa/chair BACK against the back/far wall. Faces toward the camera/viewer. Seen from direct front view.`
    return `SEATING RULE: sofa/chair faces toward the camera, or slightly angled toward the nearest wall. Never faces a wall directly with its front.`
  }

  if (isBed) {
    if (wallSide === 'left')  return `BED RULE: headboard against the LEFT wall. Bed extends rightward into the room. Long axis parallel to left wall.`
    if (wallSide === 'right') return `BED RULE: headboard against the RIGHT wall. Bed extends leftward into the room. Long axis parallel to right wall.`
    if (wallSide === 'back')  return `BED RULE: headboard against the back wall. Bed faces the camera, long axis pointing toward viewer.`
    return `BED RULE: headboard against the nearest wall, long axis extending into the room.`
  }

  if (isStorage) {
    if (wallSide === 'left')  return `STORAGE RULE: flat back against the LEFT wall. Doors/front face RIGHT into the room.`
    if (wallSide === 'right') return `STORAGE RULE: flat back against the RIGHT wall. Doors/front face LEFT into the room.`
    if (wallSide === 'back')  return `STORAGE RULE: flat back against the back wall. Front faces camera.`
    return `STORAGE RULE: flat back against nearest wall, front facing into room.`
  }

  if (isTable) {
    if (wallSide === 'left' || wallSide === 'right') return `TABLE RULE: centre of table at the click point. Long side parallel to the nearest wall (not perpendicular to it unless it's a narrow console table).`
    return `TABLE RULE: centred at the click point, oriented naturally.`
  }

  return ''
}
