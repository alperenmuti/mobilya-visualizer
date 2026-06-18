import { fal } from '@fal-ai/client'

let _configured = false

function configure() {
  if (!_configured && process.env.FAL_KEY) {
    fal.config({ credentials: process.env.FAL_KEY })
    _configured = true
  }
}

/**
 * Wall-aware placement string optimised for FLUX Kontext (shorter, diffusion-model style).
 * Uses the same detection zones as describePlacement() in gemini.ts.
 */
export function placementForFlux(x: number, y: number): string {
  const nearLeft = x < 0.38
  const nearRight = x > 0.62
  const nearBack = y < 0.52
  const inCorner = (nearLeft || nearRight) && y < 0.42

  if (inCorner && nearLeft)
    return 'in the top-left corner with its back flush against both the left wall and the back wall'
  if (inCorner && nearRight)
    return 'in the top-right corner with its back flush against both the right wall and the back wall'
  if (nearLeft)
    return 'against the left wall with its back flush against the wall surface, facing right toward the center of the room'
  if (nearRight)
    return 'against the right wall with its back flush against the wall surface, facing left toward the center of the room'
  if (nearBack)
    return 'against the back wall with its back flush against the wall surface, facing the camera'
  return 'in the center of the room facing the camera'
}

interface FluxImageOutput {
  images: Array<{ url: string; content_type: string; width: number; height: number }>
  seed: number
}

/**
 * Runs FLUX.1 Kontext Pro on the given room image with the given prompt.
 * Uploads the input image to fal.ai storage, runs the model, then converts
 * the output URL to a base64 data URL for client download compatibility.
 */
export async function runFluxKontext(params: {
  imageDataUrl: string
  prompt: string
}): Promise<string> {
  configure()

  // Convert data URL → Blob and upload to fal.ai CDN
  const [header, base64] = params.imageDataUrl.split(',')
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
  const bytes = Buffer.from(base64, 'base64')
  const blob = new Blob([bytes], { type: mimeType })
  const imageUrl = await fal.storage.upload(blob)

  // Run FLUX Kontext Pro
  const result = await fal.subscribe('fal-ai/flux-pro/kontext', {
    input: {
      prompt: params.prompt,
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
