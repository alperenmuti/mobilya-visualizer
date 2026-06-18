import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { getGeminiModel, dataUrlToInlineData, describePlacement, extractImageFromResponse } from '@/lib/gemini'
import { runFluxKontext, wallInstructionForFlux } from '@/lib/fal'

export async function POST(req: NextRequest) {
  try {
    const { imageDataUrl, furnitureName, furnitureImageUrl, clickX, clickY } = await req.json()

    if (!imageDataUrl || !furnitureName) {
      return Response.json({ error: 'Eksik parametreler' }, { status: 400 })
    }

    const cx = clickX ?? 0.5
    const cy = clickY ?? 0.7
    const pctX = Math.round(cx * 100)
    const pctY = Math.round(cy * 100)

    // ── fal.ai — FLUX Kontext Pro (primary) ──────────────────────────
    if (process.env.FAL_KEY) {
      const wallNote = wallInstructionForFlux(cx, cy)

      // A visual yellow+red target marker is drawn on the image at the click
      // position before sending to FLUX. The prompt references that marker
      // so the model knows exactly where to place the furniture.
      const prompt = [
        `Add a photorealistic ${furnitureName} to this room.`,
        `Place it exactly where the yellow circle with the red center is marked in the image — that is the precise floor contact point where the furniture's feet or base must touch the floor.`,
        `The furniture body extends upward from the marker; its base/feet are at the marker position.`,
        wallNote,
        `Perspective and scale must be consistent with the room: align vanishing points, size relative to the doors and ceiling.`,
        `Apply natural shadows and lighting matching the existing room light.`,
        `Remove the yellow circle marker in the final output.`,
        `Do not change anything else — walls, floor, ceiling, windows, doors, and all existing objects remain pixel-perfect identical.`,
      ].join(' ')

      // Fallback prompt (no visual marker available): use wall zone description only
      const promptFallback = [
        `Add a photorealistic ${furnitureName} to this room.`,
        wallNote,
        `The furniture rests firmly on the floor with all feet in contact — zero floating.`,
        `Perspective and scale must match the room. Apply natural shadows and lighting.`,
        `Do not change anything else in the room.`,
      ].join(' ')

      try {
        const resultUrl = await runFluxKontext({
          imageDataUrl,
          prompt,
          promptFallback,
          marker: { x: cx, y: cy },
        })
        return Response.json({ resultUrl })
      } catch (falErr) {
        console.error('fal.ai error, falling back to Gemini:', falErr)
        if (!process.env.GEMINI_KEY) throw falErr
      }
    }

    // ── Gemini (fallback) ─────────────────────────────────────────────
    if (!process.env.GEMINI_KEY) {
      return Response.json({ resultUrl: imageDataUrl, demo: true })
    }

    const placement = describePlacement(cx, cy, furnitureName)
    const { mimeType, data } = dataUrlToInlineData(imageDataUrl)

    const prompt = `You are a professional photo compositor performing a precise surgical edit on a room photograph. Your task is to add one piece of furniture so that the result is completely indistinguishable from a real photograph.

━━━ STEP 1 — ANALYZE THE SCENE BEFORE DRAWING ━━━
Before making any change, mentally note:
A) Where is the floor surface? Trace its edges and perspective lines.
B) What is the camera eye level? (Look for the horizon line — where walls meet at eye level.)
C) WALL POSITIONS: Locate the left wall surface, right wall surface, and back wall surface in the image. Find the exact line where each wall meets the floor (the floor-wall junction). This is critical for furniture placement.
D) Where are existing shadows? Note their direction and angle precisely.
E) What is the scale reference? (A standard door is ~200cm tall; ceiling ~250cm. Use this to calibrate.)
F) What is the floor material and texture (wood, tile, carpet, concrete)?

━━━ STEP 2 — FLOOR + WALL CONTACT ━━━
${placement}

FAILURE CONDITIONS — if any of these are true, the output is WRONG:
✗ Furniture feet/base do not touch the floor (floating)
✗ Furniture back has a visible gap between it and the wall
✗ Furniture appears to pass through the wall or floor

━━━ STEP 3 — PERSPECTIVE ALIGNMENT ━━━
The furniture must share the exact vanishing point(s) of the room.
• Study the floor pattern lines, baseboard, or tile grout lines.
• The furniture's base edges must be parallel to those floor lines.
• The furniture's vertical edges must be truly vertical (not tilted).
• At position (${pctX}%, ${pctY}%): furniture is ${pctY < 45 ? 'far from camera → render it smaller' : pctY > 65 ? 'close to camera → render it larger' : 'at mid-depth → standard scale'}.

━━━ STEP 4 — SCALE CALIBRATION ━━━
Use your Step 1D reference to size the furniture correctly.
• A standard sofa is ~85cm tall, ~200cm wide.
• An armchair is ~80cm tall, ~80cm wide.
• A wardrobe is ~200cm tall, ~90cm wide.
• A dining table is ~75cm tall.
The furniture must look naturally sized relative to doors, windows, and walls visible in the photo.

━━━ STEP 5 — LIGHTING & SHADOW ━━━
• Identify the dominant light source direction from Step 1C shadows.
• The "${furnitureName}" receives light from that SAME direction — same brightness, same color temperature.
• Cast a contact shadow on the floor directly under the furniture, matching the softness and direction of existing shadows.
• Do NOT add ambient glow, halo, or diffuse light that doesn't exist in the scene.

━━━ STEP 6 — STYLE MATCH ━━━
• If the photo is a real photograph → render the furniture as if photographed.
• If the photo is a 3D render → render the furniture in matching render style.
• Match sharpness, noise grain, depth-of-field blur, and color profile of the original.

━━━ ABSOLUTE PROHIBITIONS ━━━
✗ NO floating — the furniture must touch the floor
✗ NO modifying walls, ceiling, floor surface, windows, doors, existing furniture
✗ NO changing room brightness, color, or atmosphere
✗ NO adding pillows, plants, accessories, or extra objects
✗ NO tilting the furniture (it must stand upright and level)

Output the complete room image at its original resolution with the "${furnitureName}" composited in.`

    const model = getGeminiModel()
    const parts: Part[] = [
      { inlineData: { mimeType, data } },
      { text: prompt },
    ]

    if (furnitureImageUrl && !furnitureImageUrl.startsWith('data:')) {
      try {
        const imgRes = await fetch(furnitureImageUrl, { signal: AbortSignal.timeout(5000) })
        const imgBuffer = await imgRes.arrayBuffer()
        const imgBase64 = Buffer.from(imgBuffer).toString('base64')
        const imgMime = imgRes.headers.get('content-type') ?? 'image/jpeg'
        parts.push({ inlineData: { mimeType: imgMime, data: imgBase64 } })
        parts.push({
          text: `REFERENCE APPEARANCE: The image above shows what the "${furnitureName}" looks like. Replicate its exact shape, proportions, color, and material finish in the room composite. Adapt ONLY the lighting direction and shadow to match the room's light source — do not alter the furniture's intrinsic color or material.`,
        })
      } catch {}
    }

    const result = await model.generateContent(parts)
    const resultUrl = await extractImageFromResponse(result)

    if (!resultUrl) {
      throw new Error('Gemini görüntü üretemedi. Lütfen tekrar deneyin.')
    }

    return Response.json({ resultUrl })
  } catch (err) {
    console.error('AI place error:', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
