import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function createCircularMask(
  imageWidth: number,
  imageHeight: number,
  centerX: number,
  centerY: number,
  radiusPercent: number = 0.15
): string {
  const canvas = document.createElement('canvas')
  canvas.width = imageWidth
  canvas.height = imageHeight
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, imageWidth, imageHeight)
  const radius = Math.min(imageWidth, imageHeight) * radiusPercent
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.fill()
  return canvas.toDataURL('image/png')
}

/**
 * Draws a bright orange crosshair+circle marker at a normalized (0-1) point
 * onto the image, fully in the browser via canvas — no server/Sharp dependency.
 * Returns a JPEG data URL with the marker baked in.
 */
export function drawMarkerOnImage(imageDataUrl: string, nx: number, ny: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas context yok')); return }

      ctx.drawImage(img, 0, 0, w, h)

      const mx = Math.round(nx * w)
      const my = Math.round(ny * h)
      const r = Math.max(24, Math.round(Math.min(w, h) * 0.034))
      const arm = Math.round(r * 2.1)

      // Crosshair — black halo then orange
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'black'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(mx - arm, my); ctx.lineTo(mx + arm, my)
      ctx.moveTo(mx, my - arm); ctx.lineTo(mx, my + arm)
      ctx.stroke()
      ctx.strokeStyle = '#FF6B00'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(mx - arm, my); ctx.lineTo(mx + arm, my)
      ctx.moveTo(mx, my - arm); ctx.lineTo(mx, my + arm)
      ctx.stroke()

      // Concentric dots: dark halo, orange ring, white center
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.beginPath(); ctx.arc(mx, my, r + 3, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,107,0,0.88)'
      ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'white'
      ctx.beginPath(); ctx.arc(mx, my, Math.max(5, Math.round(r * 0.28)), 0, Math.PI * 2); ctx.fill()

      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = () => reject(new Error('görüntü yüklenemedi'))
    img.src = imageDataUrl
  })
}

/**
 * Composites a transparent-background furniture cut-out onto the room photo at
 * a normalized click point, entirely in the browser via canvas (no server
 * Sharp). The cut-out's floor-contact (its bottom-centre) lands on the click;
 * size = room width × widthFraction × a depth factor. Returns a JPEG data URL.
 */
export function compositeFurnitureOnImage(
  roomDataUrl: string,
  cutoutDataUrl: string,
  x: number,
  y: number,
  widthFraction: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const room = new Image()
    room.onload = () => {
      const W = room.naturalWidth, H = room.naturalHeight
      const cut = new Image()
      cut.onload = () => {
        try {
          // Find the non-transparent bounding box so size/position track the
          // real product, not the transparent padding around it.
          const oc = document.createElement('canvas')
          oc.width = cut.naturalWidth; oc.height = cut.naturalHeight
          const octx = oc.getContext('2d')
          if (!octx) { reject(new Error('canvas yok')); return }
          octx.drawImage(cut, 0, 0)
          const px = octx.getImageData(0, 0, oc.width, oc.height).data
          let minX = oc.width, minY = oc.height, maxX = 0, maxY = 0, found = false
          for (let py = 0; py < oc.height; py++) {
            for (let pxn = 0; pxn < oc.width; pxn++) {
              if (px[(py * oc.width + pxn) * 4 + 3] > 16) {
                found = true
                if (pxn < minX) minX = pxn
                if (pxn > maxX) maxX = pxn
                if (py < minY) minY = py
                if (py > maxY) maxY = py
              }
            }
          }
          if (!found) { minX = 0; minY = 0; maxX = oc.width - 1; maxY = oc.height - 1 }
          const bw = maxX - minX + 1, bh = maxY - minY + 1

          const depthFactor = y < 0.40 ? 0.72 : y > 0.65 ? 1.15 : 0.92
          let drawW = Math.max(20, Math.round(W * widthFraction * depthFactor))
          let drawH = Math.round(drawW * bh / bw)
          const maxH = Math.max(40, Math.round(y * H))   // furniture rises from the floor
          if (drawH > maxH || drawW > W) {
            const s = Math.min(W / drawW, maxH / drawH)
            drawW = Math.max(20, Math.floor(drawW * s))
            drawH = Math.max(20, Math.floor(drawH * s))
          }
          let left = Math.round(x * W - drawW / 2)
          let top  = Math.round(y * H - drawH)           // bottom edge at the click
          left = Math.max(0, Math.min(left, W - drawW))
          top  = Math.max(0, Math.min(top,  H - drawH))

          const canvas = document.createElement('canvas')
          canvas.width = W; canvas.height = H
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('canvas yok')); return }
          ctx.drawImage(room, 0, 0, W, H)
          ctx.drawImage(cut, minX, minY, bw, bh, left, top, drawW, drawH)
          resolve(canvas.toDataURL('image/jpeg', 0.92))
        } catch (e) { reject(e as Error) }
      }
      cut.onerror = () => reject(new Error('cutout yüklenemedi'))
      cut.src = cutoutDataUrl
    }
    room.onerror = () => reject(new Error('oda görseli yüklenemedi'))
    room.src = roomDataUrl
  })
}

export function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',')
  const mime = arr[0].match(/:(.*?);/)![1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new Blob([u8arr], { type: mime })
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.src = URL.createObjectURL(file)
  })
}

export function formatPrice(price?: string): string {
  if (!price) return ''
  return price.startsWith('₺') || price.startsWith('$') ? price : `${price} ₺`
}

export function slugify(text: string): string {
  return text
    .replace(/[Ğğ]/g, 'g').replace(/[Üü]/g, 'u').replace(/[Şş]/g, 's')
    .replace(/[İ]/g, 'i').replace(/[ı]/g, 'i').replace(/[Öö]/g, 'o').replace(/[Çç]/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
