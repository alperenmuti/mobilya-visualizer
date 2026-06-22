// ─── Prompt engineer ────────────────────────────────────────────────────────
// Turns a normalized click point into a rich, perspective-aware placement brief
// for the generative model (FLUX Kontext), covering position, depth, scale and
// the angle the furniture should face. Deterministic, instant, free.

export interface PlacementSpec {
  /** Full natural-language placement brief injected into the prompt. */
  description: string
}

export function engineerPlacement(x: number, y: number): PlacementSpec {
  const pctX = Math.round(x * 100)
  const pctY = Math.round(y * 100)

  const horizontal =
    x < 0.20 ? 'against the left wall' :
    x < 0.40 ? 'on the left side of the room' :
    x < 0.60 ? 'in the horizontal centre of the room' :
    x < 0.80 ? 'on the right side of the room' :
               'against the right wall'

  const depth =
    y < 0.42 ? 'deep in the BACKGROUND of the room, far from the camera — so it must be rendered noticeably SMALLER and higher up the frame, in strong perspective' :
    y < 0.66 ? 'at MID-DISTANCE in the room — medium size' :
               'in the FOREGROUND, close to the camera — rendered LARGER'

  // Angle/facing — gives the furniture a believable orientation for its spot,
  // which is what makes left/right placements look 3-D rather than pasted flat.
  const facing =
    x < 0.20 ? 'Its back is against the left wall and it is rotated to face toward the right / the room centre (we see it roughly three-quarters from the front-right).' :
    x < 0.40 ? 'Rotate it slightly so it is seen three-quarters, angled toward the room centre.' :
    x < 0.60 ? 'It faces roughly toward the camera, seen from the front.' :
    x < 0.80 ? 'Rotate it slightly so it is seen three-quarters, angled toward the room centre (from the right side).' :
               'Its back is against the right wall and it is rotated to face toward the left / the room centre (three-quarters from the front-left).'

  const description =
    `MANDATORY POSITION — this overrides everything: the furniture MUST stand ${horizontal}, ${depth}. ` +
    `Its floor-contact point is at ${pctX}% from the left and ${pctY}% from the top of the image. ` +
    `Do NOT place it in the centre of the room, do NOT pick a "nicer" spot, do NOT move it — put it ONLY at that exact location. ` +
    `${facing} ` +
    `Match the room's floor lines and vanishing perspective exactly so it sits flat on the floor with every leg/foot on the ground (never floating), at realistic real-world scale for that depth, with a soft contact shadow and lighting that matches the room.`

  return { description }
}
