// Server-side only utilities (no browser APIs)

export function createCircularMaskSvg(
  imageWidth: number,
  imageHeight: number,
  centerX: number,
  centerY: number,
  radiusPercent: number = 0.18
): string {
  const radius = Math.min(imageWidth, imageHeight) * radiusPercent
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}">
    <rect width="${imageWidth}" height="${imageHeight}" fill="black"/>
    <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="white"/>
  </svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

// Alias for route compatibility
export const createCircularMask = createCircularMaskSvg
