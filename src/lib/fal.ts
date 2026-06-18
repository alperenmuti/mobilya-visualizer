import { fal } from '@fal-ai/client'

let _configured = false

function configure() {
  if (!_configured && process.env.FAL_KEY) {
    fal.config({ credentials: process.env.FAL_KEY })
    _configured = true
  }
}

/**
 * Wall-aware instruction for the FLUX Kontext prompt.
 * Used alongside the visual marker to clarify wall contact.
 */
export function wallInstructionForFlux(x: number, y: number): string {
  const nearLeft = x < 0.38
  const nearRight = x > 0.62
  const nearBack = y < 0.52
  const inCorner = (nearLeft || nearRight) && y < 0.42

  if (inCorner && nearLeft)
    return 'Its back-left corner is tucked into the corner where the left wall meets the back wall — both wall surfaces have zero gap contact.'
  if (inCorner && nearRight)
    return 'Its back-right corner is tucked into the corner where the right wall meets the back wall — both wall surfaces have zero gap contact.'
  if (nearLeft)
    return 'Its back is pressed flush against the left wall with zero gap. It faces right toward the center of the room.'
  if (nearRight)
    return 'Its back is pressed flush against the right wall with zero gap. It faces left toward the center of the room.'
  if (nearBack)
    return 'Its back is pressed flush against the back wall with zero gap. It faces toward the camera.'
  return 'It is freestanding in the open floor area, facing the camera.'
}

/**
 * Draws a bright visual target marker on the image at the given normalized
 * coordinates. FLUX Kontext understands image-space markers far better than
 * text coordinates like "(30%, 60%)".
 *
 * Marker design: concentric rings (black outer → yellow fill → red center)
 * with four crosshair lines so it is clearly a "place here" indicator.
 */
async function drawMarker(imageDataUrl: string, cx: number, cy: number): Promise<string> {
  const { default: sharp } = await import('sharp')

  const [, base64] = imageDataUrl.split(',')
  const buffer = Buffer.from(base64, 'base64')

  const meta = await sharp(buffer).metadata()
  const w = meta.width!
  const h = meta.height!

  const mx = Math.round(cx * w)
  const my = Math.round(cy * h)
  const r = Math.max(22, Math.round(Math.min(w, h) * 0.028))
  const arm = Math.round(r * 1.5) // crosshair arm length

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <!-- crosshair lines -->
    <line x1="${mx - arm}" y1="${my}" x2="${mx + arm}" y2="${my}"
          stroke="black" stroke-width="5" stroke-linecap="round"/>
    <line x1="${mx}" y1="${my - arm}" x2="${mx}" y2="${my + arm}"
          stroke="black" stroke-width="5" stroke-linecap="round"/>
    <line x1="${mx - arm}" y1="${my}" x2="${mx + arm}" y2="${my}"
          stroke="#FFD700" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="${mx}" y1="${my - arm}" x2="${mx}" y2="${my + arm}"
          stroke="#FFD700" stroke-width="2.5" stroke-linecap="round"/>
    <!-- outer black ring -->
    <circle cx="${mx}" cy="${my}" r="${r + 3}" fill="rgba(0,0,0,0.6)"/>
    <!-- yellow fill ring -->
    <circle cx="${mx}" cy="${my}" r="${r}" fill="rgba(255,215,0,0.85)"/>
    <!-- red center dot -->
    <circle cx="${mx}" cy="${my}" r="${Math.max(5, Math.round(r * 0.22))}" fill="rgba(220,30,30,0.95)"/>
  </svg>`

  const annotated = await sharp(buffer)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .jpeg({ quality: 92 })
    .toBuffer()

  return `data:image/jpeg;base64,${annotated.toString('base64')}`
}

interface FluxImageOutput {
  images: Array<{ url: string; content_type: string; width: number; height: number }>
  seed: number
}

/**
 * Runs FLUX.1 Kontext Pro.
 * When `marker` coords are provided, draws a visual target on the image first
 * so the model understands exactly where to place / replace the furniture.
 */
export async function runFluxKontext(params: {
  imageDataUrl: string
  /** Prompt used when the visual marker was successfully drawn on the image. */
  prompt: string
  /** Fallback prompt used when marker drawing fails (no yellow circle in image). */
  promptFallback?: string
  marker?: { x: number; y: number }
}): Promise<string> {
  configure()

  // Annotate with visual placement marker (greatly improves spatial accuracy)
  // If Sharp fails for any reason, fall back to the original image without annotation
  let sourceDataUrl = params.imageDataUrl
  let markerDrawn = false
  if (params.marker) {
    try {
      sourceDataUrl = await drawMarker(params.imageDataUrl, params.marker.x, params.marker.y)
      markerDrawn = true
    } catch (annotateErr) {
      console.warn('drawMarker failed, sending unannotated image:', annotateErr)
    }
  }

  const activePrompt = (!markerDrawn && params.promptFallback) ? params.promptFallback : params.prompt

  // Convert data URL → Blob and upload to fal.ai CDN
  const [, base64] = sourceDataUrl.split(',')
  const bytes = Buffer.from(base64, 'base64')
  const blob = new Blob([bytes], { type: 'image/jpeg' })
  const imageUrl = await fal.storage.upload(blob)

  // Run FLUX Kontext Pro
  const result = await fal.subscribe('fal-ai/flux-pro/kontext', {
    input: {
      prompt: activePrompt,
      image_url: imageUrl,
      guidance_scale: 5,
      safety_tolerance: '3',
      output_format: 'jpeg',
    },
  })

  const outputUrl = (result.data as FluxImageOutput).images?.[0]?.url
  if (!outputUrl) throw new Error('fal.ai görüntü üretemedi')

  // Fetch result and return as data URL so download button works cross-origin
  const imgRes = await fetch(outputUrl)
  const imgBuf = await imgRes.arrayBuffer()
  const imgBase64 = Buffer.from(imgBuf).toString('base64')
  const ct = imgRes.headers.get('content-type') ?? 'image/jpeg'
  return `data:${ct};base64,${imgBase64}`
}
