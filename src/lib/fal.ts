import { fal } from '@fal-ai/client'

let _configured = false

function configure() {
  if (!_configured && process.env.FAL_KEY) {
    fal.config({ credentials: process.env.FAL_KEY.trim() })
    _configured = true
  }
}

// ─── Wall description ────────────────────────────────────────────────────────

export function wallInstructionForFlux(x: number, y: number): string {
  const nearLeft  = x < 0.38
  const nearRight = x > 0.62
  const nearBack  = y < 0.52
  const inCorner  = (nearLeft || nearRight) && y < 0.42

  if (inCorner && nearLeft)  return 'tucked into the top-left corner against both the left wall and back wall'
  if (inCorner && nearRight) return 'tucked into the top-right corner against both the right wall and back wall'
  if (nearLeft)  return 'against the left wall, back flush with the wall, facing right'
  if (nearRight) return 'against the right wall, back flush with the wall, facing left'
  if (nearBack)  return 'against the back wall, back flush with the wall, facing the camera'
  return 'in the center of the room facing the camera'
}

// ─── Furniture type detection ────────────────────────────────────────────────

interface FurnitureProfile {
  /** Fraction of image width the furniture occupies */
  wFrac: number
  /** Fraction of image height the furniture occupies */
  hFrac: number
  /** English term for FLUX prompt */
  englishName: string
}

export function detectFurniture(name: string): FurnitureProfile {
  const n = name.toLowerCase()
  if (/kanepe|sofa|couch|chester/.test(n))      return { wFrac: 0.40, hFrac: 0.32, englishName: /chester/.test(n) ? 'chester sofa' : 'sofa' }
  if (/berjer|bergere|accent chair/.test(n))    return { wFrac: 0.22, hFrac: 0.28, englishName: 'accent armchair' }
  if (/koltuk|armchair|lounge/.test(n))         return { wFrac: 0.26, hFrac: 0.30, englishName: 'armchair' }
  if (/sandalye|chair/.test(n))                 return { wFrac: 0.16, hFrac: 0.24, englishName: 'chair' }
  if (/yatak|bed/.test(n))                      return { wFrac: 0.48, hFrac: 0.36, englishName: 'bed' }
  if (/dolap|wardrobe|closet/.test(n))          return { wFrac: 0.22, hFrac: 0.55, englishName: 'wardrobe' }
  if (/kitaplık|bookcase|bookshelf|shelf/.test(n)) return { wFrac: 0.22, hFrac: 0.50, englishName: 'bookcase' }
  if (/sehpa|coffee table/.test(n))             return { wFrac: 0.28, hFrac: 0.14, englishName: 'coffee table' }
  if (/yemek masası|dining table/.test(n))      return { wFrac: 0.36, hFrac: 0.20, englishName: 'dining table' }
  if (/masa|desk|table/.test(n))                return { wFrac: 0.30, hFrac: 0.20, englishName: 'table' }
  if (/tv ünitesi|tv unit|media console/.test(n)) return { wFrac: 0.40, hFrac: 0.18, englishName: 'TV media unit' }
  return { wFrac: 0.30, hFrac: 0.30, englishName: name }
}

// ─── Mask generation for FLUX Fill ──────────────────────────────────────────

/**
 * Creates a black+white inpainting mask.
 * White area = where FLUX Fill will generate furniture.
 * The furniture "grows upward" from the click (floor contact) point.
 */
async function createFurnitureMask(
  imageDataUrl: string,
  cx: number,   // 0-1, floor contact X
  cy: number,   // 0-1, floor contact Y
  wFrac: number,
  hFrac: number,
): Promise<string> {
  const { default: sharp } = await import('sharp')
  const [, base64] = imageDataUrl.split(',')
  const buffer = Buffer.from(base64, 'base64')
  const meta   = await sharp(buffer).metadata()
  const w = meta.width!
  const h = meta.height!

  // Furniture footprint in pixels.
  // Bottom-center at the click point; extends UPWARD.
  const fw = Math.round(w * wFrac)
  const fh = Math.round(h * hFrac)
  const mx = Math.round(cx * w)          // horizontal center
  const my = Math.round(cy * h)          // bottom / floor contact
  const top    = Math.max(0, my - fh)
  const left   = Math.max(0, mx - fw / 2)
  const right  = Math.min(w, mx + fw / 2)
  const bottom = Math.min(h, my)

  const ellipseW = right - left
  const ellipseH = bottom - top
  const ecx = left + ellipseW / 2
  const ecy = top  + ellipseH / 2

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="black"/>
    <ellipse cx="${ecx}" cy="${ecy}" rx="${ellipseW / 2}" ry="${ellipseH / 2}" fill="white"/>
  </svg>`

  // Blur the mask edges for seamless blending
  const maskBuf = await sharp(Buffer.from(svg))
    .png()
    .blur(Math.max(8, Math.round(Math.min(fw, fh) * 0.08)))
    .jpeg({ quality: 95 })
    .toBuffer()

  return `data:image/jpeg;base64,${maskBuf.toString('base64')}`
}

// ─── Upload helper ───────────────────────────────────────────────────────────

async function uploadDataUrl(dataUrl: string): Promise<string> {
  const [, base64] = dataUrl.split(',')
  const bytes = Buffer.from(base64, 'base64')
  return fal.storage.upload(new Blob([bytes], { type: 'image/jpeg' }))
}

/**
 * Fetches a remote image on OUR server and re-uploads it to fal storage.
 * Retail CDNs (e.g. İstikbal) block fal's datacenter IPs, so passing their
 * URL straight to fal yields a file_download_error. We proxy it instead, with
 * browser-like headers, and hand fal a fal.media URL it can always read.
 */
async function uploadRemoteImage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/jpeg,image/png,*/*',
      'Referer': new URL(url).origin,
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`mobilya görseli indirilemedi: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const ct = res.headers.get('content-type') ?? 'image/jpeg'
  return fal.storage.upload(new Blob([buf], { type: ct }))
}

async function resultToDataUrl(url: string): Promise<string> {
  const res  = await fetch(url)
  const buf  = await res.arrayBuffer()
  const b64  = Buffer.from(buf).toString('base64')
  const ct   = res.headers.get('content-type') ?? 'image/jpeg'
  return `data:${ct};base64,${b64}`
}

interface FluxImageOutput {
  images: Array<{ url: string; content_type: string; width: number; height: number }>
}

// ─── FLUX Fill — for PLACE (add furniture to empty spot) ────────────────────

/**
 * Uses FLUX Pro Fill (inpainting) to place furniture.
 * Generates a precise mask showing exactly where the furniture goes,
 * so the model doesn't have to guess spatial location.
 */
export async function runFluxFill(params: {
  imageDataUrl: string
  /** Client-generated mask (preferred — no Sharp needed). Falls back to server-side Sharp if absent. */
  maskDataUrl?: string
  furnitureName: string
  cx: number
  cy: number
  wallNote: string
}): Promise<string> {
  configure()
  const { imageDataUrl, furnitureName, cx, cy, wallNote } = params

  const profile = detectFurniture(furnitureName)

  // Prefer client-provided mask; fall back to Sharp-based generation
  let resolvedMask = params.maskDataUrl
  if (!resolvedMask) {
    resolvedMask = await createFurnitureMask(imageDataUrl, cx, cy, profile.wFrac, profile.hFrac)
  }

  const [imageUrl, maskUrl] = await Promise.all([
    uploadDataUrl(imageDataUrl),
    uploadDataUrl(resolvedMask),
  ])

  const prompt = [
    `A photorealistic ${profile.englishName}`,
    // include original name if it differs (e.g. Turkish brand name)
    profile.englishName.toLowerCase() !== furnitureName.toLowerCase()
      ? `(${furnitureName})`
      : '',
    wallNote,
    'resting firmly on the floor, back flush against the wall, zero floating.',
    'Realistic lighting and shadows matching the room.',
    'Professional interior design photography.',
  ].filter(Boolean).join(' ')

  const result = await fal.subscribe('fal-ai/flux-pro/v1/fill', {
    input: {
      prompt,
      image_url: imageUrl,
      mask_url:  maskUrl,
      safety_tolerance: '3',
      output_format:    'jpeg',
    },
  })

  const outputUrl = (result.data as FluxImageOutput).images?.[0]?.url
  if (!outputUrl) throw new Error('fal.ai görüntü üretemedi')
  return resultToDataUrl(outputUrl)
}

// ─── FLUX Kontext — for REPLACE (swap existing furniture) ───────────────────

/**
 * Uses FLUX Kontext Pro to replace furniture.
 * A visual marker is drawn at the click position so the model can
 * identify which piece of furniture to replace.
 */
export async function runFluxKontext(params: {
  imageDataUrl: string
  prompt: string
  promptFallback?: string
  marker?: { x: number; y: number }
}): Promise<string> {
  configure()

  let sourceDataUrl = params.imageDataUrl
  let markerDrawn   = false

  if (params.marker) {
    try {
      sourceDataUrl = await drawMarker(params.imageDataUrl, params.marker.x, params.marker.y)
      markerDrawn   = true
    } catch (e) {
      console.warn('drawMarker failed, sending unannotated image:', e)
    }
  }

  const activePrompt = (!markerDrawn && params.promptFallback)
    ? params.promptFallback
    : params.prompt

  const imageUrl = await uploadDataUrl(sourceDataUrl)

  const result = await fal.subscribe('fal-ai/flux-pro/kontext', {
    input: {
      prompt:           activePrompt,
      image_url:        imageUrl,
      guidance_scale:   5,
      safety_tolerance: '3',
      output_format:    'jpeg',
    },
  })

  const outputUrl = (result.data as FluxImageOutput).images?.[0]?.url
  if (!outputUrl) throw new Error('fal.ai görüntü üretemedi')
  return resultToDataUrl(outputUrl)
}

// ─── Paste real product at click, then AI-refine — for PLACE (exact spot) ───
// NOTE: compositing is done CLIENT-SIDE (canvas) because sharp's native binary
// fails to load on this Vercel runtime. The server only does fal calls here.

/**
 * Proxies a catalog image to fal, removes its background, and returns the
 * cut-out PNG as a data URL (transparent background). No sharp.
 */
export async function cutoutProductDataUrl(catalogUrl: string): Promise<string> {
  configure()
  const falUrl = catalogUrl.startsWith('data:')
    ? await uploadDataUrl(catalogUrl)
    : await uploadRemoteImage(catalogUrl)

  const result = await fal.subscribe('fal-ai/imageutils/rembg', {
    input: { image_url: falUrl },
  })
  const outUrl = (result.data as { image?: { url: string } }).image?.url
  if (!outUrl) throw new Error('arka plan silinemedi')
  return resultToDataUrl(outUrl)
}

/**
 * Refines a client-composited image (room with the product already pasted at
 * the right spot) into a photorealistic result via FLUX Kontext, without
 * moving or resizing the furniture.
 */
export async function refinePastedScene(compositeDataUrl: string, furnitureName: string): Promise<string> {
  configure()
  const prompt = `A "${furnitureName}" has been pasted into this room photo. Make it look like a genuine photograph of that furniture standing in the room: add a soft, natural contact shadow on the floor beneath it, relight its surfaces to match the room's light direction and white balance, and blend any hard cut-out edges. CRITICAL — keep the furniture in EXACTLY the same position, size and orientation; do not move it, rescale it, duplicate it, or replace it with different furniture. Do not change anything else in the room. Output only the edited photo.`
  return runFluxKontext({ imageDataUrl: compositeDataUrl, prompt })
}

// ─── FLUX Kontext multi-image — for PLACE (insert a real product) ───────────

/**
 * Uses FLUX Kontext (multi-image) to drop a SPECIFIC product into a room.
 * Feeds two images — the room and the furniture's catalog photo — so the
 * output contains the actual selected product, not a generic guess from text.
 */
export async function runFluxKontextMulti(params: {
  roomDataUrl: string
  furnitureImageUrl: string
  prompt: string
}): Promise<string> {
  configure()

  // Both images go to fal storage. The furniture is a retail-catalog URL that
  // fal's own fetcher often can't reach, so we always proxy it through our server.
  const roomUrl = await uploadDataUrl(params.roomDataUrl)
  const furnitureUrl = params.furnitureImageUrl.startsWith('data:')
    ? await uploadDataUrl(params.furnitureImageUrl)
    : await uploadRemoteImage(params.furnitureImageUrl)

  const result = await fal.subscribe('fal-ai/flux-pro/kontext/max/multi', {
    input: {
      prompt:        params.prompt,
      image_urls:    [roomUrl, furnitureUrl],
      safety_tolerance: '3',
      output_format: 'jpeg',
    },
  })

  const outputUrl = (result.data as FluxImageOutput).images?.[0]?.url
  if (!outputUrl) throw new Error('fal.ai görüntü üretemedi')
  return resultToDataUrl(outputUrl)
}

// ─── Marker drawing (used by Kontext replace path) ──────────────────────────

async function drawMarker(imageDataUrl: string, cx: number, cy: number): Promise<string> {
  const { default: sharp } = await import('sharp')
  const [, base64] = imageDataUrl.split(',')
  const buffer = Buffer.from(base64, 'base64')
  const meta   = await sharp(buffer).metadata()
  const w = meta.width!
  const h = meta.height!
  const mx  = Math.round(cx * w)
  const my  = Math.round(cy * h)
  const r   = Math.max(22, Math.round(Math.min(w, h) * 0.028))
  const arm = Math.round(r * 1.5)

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${mx - arm}" y1="${my}" x2="${mx + arm}" y2="${my}" stroke="black" stroke-width="5" stroke-linecap="round"/>
    <line x1="${mx}" y1="${my - arm}" x2="${mx}" y2="${my + arm}" stroke="black" stroke-width="5" stroke-linecap="round"/>
    <line x1="${mx - arm}" y1="${my}" x2="${mx + arm}" y2="${my}" stroke="#FFD700" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="${mx}" y1="${my - arm}" x2="${mx}" y2="${my + arm}" stroke="#FFD700" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="${mx}" cy="${my}" r="${r + 3}" fill="rgba(0,0,0,0.6)"/>
    <circle cx="${mx}" cy="${my}" r="${r}" fill="rgba(255,215,0,0.85)"/>
    <circle cx="${mx}" cy="${my}" r="${Math.max(5, Math.round(r * 0.22))}" fill="rgba(220,30,30,0.95)"/>
  </svg>`

  const out = await sharp(buffer)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .jpeg({ quality: 92 })
    .toBuffer()

  return `data:image/jpeg;base64,${out.toString('base64')}`
}
