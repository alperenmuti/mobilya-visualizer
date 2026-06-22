// ─── Prompt engineer ────────────────────────────────────────────────────────
// Turns a normalized click point (where the user wants the furniture's floor
// contact to be) into a precise, FLUX-friendly placement instruction.
// Deterministic, instant and free — no extra model call.

export interface PlacementSpec {
  /** Natural-language description of the target position. */
  description: string
  /** Scale guidance derived from depth (lower in frame = closer = larger). */
  depthScale: string
}

export function engineerPlacement(x: number, y: number): PlacementSpec {
  const pctX = Math.round(x * 100)
  const pctY = Math.round(y * 100)

  const horizontal =
    x < 0.18 ? 'hard against the left edge of the room' :
    x < 0.40 ? 'on the left side of the room, left of centre' :
    x < 0.60 ? 'horizontally centred in the room' :
    x < 0.82 ? 'on the right side of the room, right of centre' :
               'hard against the right edge of the room'

  const depth =
    y < 0.40 ? 'deep in the background, far from the camera' :
    y < 0.65 ? 'at mid-distance in the room' :
               'in the foreground, close to the camera'

  // Wall proximity only when the click is genuinely near an edge/back.
  const nearLeft  = x < 0.20
  const nearRight = x > 0.80
  const nearBack  = y < 0.30
  let wall = ''
  if (nearBack && nearLeft)  wall = ' Tuck it into the back-left corner, its left side and back flush against the two walls.'
  else if (nearBack && nearRight) wall = ' Tuck it into the back-right corner, its right side and back flush against the two walls.'
  else if (nearLeft)  wall = ' Push its back flat against the left wall, zero gap.'
  else if (nearRight) wall = ' Push its back flat against the right wall, zero gap.'
  else if (nearBack)  wall = ' Push its back flat against the back wall, zero gap.'

  const depthScale =
    y < 0.40 ? 'render it SMALLER (it is far from the camera)' :
    y > 0.65 ? 'render it LARGER (it is close to the camera)' :
               'render it at medium scale'

  const description = `${horizontal}, ${depth}.${wall} The furniture's floor-contact point must land at ${pctX}% from the left and ${pctY}% from the top of the room image.`

  return { description, depthScale }
}
