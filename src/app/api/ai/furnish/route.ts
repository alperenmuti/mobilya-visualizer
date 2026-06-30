import { NextRequest } from 'next/server'
import type { Part } from '@google/generative-ai'
import { getGeminiModel, dataUrlToInlineData, extractImageFromResponse } from '@/lib/gemini'
import { roomTypeToEn } from '@/lib/roomTypes'

export const maxDuration = 60

interface FurnitureRef { name: string; image_url?: string }

async function fetchImageParts(items: FurnitureRef[]): Promise<{ name: string; mimeType: string; data: string }[]> {
  const results = await Promise.allSettled(
    items.map(async item => {
      if (!item.image_url) return null
      const res = await fetch(item.image_url, { signal: AbortSignal.timeout(6000) })
      if (!res.ok) return null
      const buf = await res.arrayBuffer()
      const mime = res.headers.get('content-type') ?? 'image/jpeg'
      return { name: item.name, mimeType: mime, data: Buffer.from(buf).toString('base64') }
    })
  )
  return results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter((x): x is { name: string; mimeType: string; data: string } => !!x)
}

export async function POST(req: NextRequest) {
  try {
    const { roomDataUrl, furniture, roomType } = await req.json() as {
      roomDataUrl: string
      furniture: FurnitureRef[]
      roomType?: string
    }

    if (!roomDataUrl || !furniture?.length) {
      return Response.json({ error: 'Oda görseli ve en az bir mobilya gerekli' }, { status: 400 })
    }

    if (furniture.length > 12) {
      return Response.json({ error: 'En fazla 12 mobilya seçebilirsiniz' }, { status: 400 })
    }

    if (!process.env.GEMINI_KEY) {
      return Response.json({ error: 'GEMINI_KEY tanımlı değil' }, { status: 500 })
    }

    const { mimeType: roomMime, data: roomData } = dataUrlToInlineData(roomDataUrl)
    const roomCtx = roomType ? `Room type: ${roomTypeToEn(roomType)}.` : ''

    // Fetch all furniture images in parallel
    const furnImgs = await fetchImageParts(furniture)

    const furnitureList = furniture
      .map((f, i) => `${i + 1}. ${f.name}`)
      .join('\n')

    const parts: Part[] = [{ inlineData: { mimeType: roomMime, data: roomData } }]

    // Add each fetched furniture image + label
    for (const img of furnImgs) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
      parts.push({ text: `[Furniture photo: "${img.name}"]` })
    }

    parts.push({
      text: `You are a professional interior designer. The first image is an empty room. The subsequent images are product photos of specific furniture pieces.
${roomCtx}

FURNITURE LIST TO PLACE (in order):
${furnitureList}

YOUR TASK:
Furnish the room with EXACTLY these ${furniture.length} pieces — nothing more, nothing less.

PLACEMENT RULES (follow like a real interior designer):
- Place EVERY piece from the list in the most natural, functional position
- Sofas/armchairs: backs against walls, facing into the room or each other — NEVER perpendicular to the wall
- Dining tables: centred in the dining area with chairs around them
- Beds: headboard against the main wall
- Storage (wardrobes, shelves): flat against walls, fronts facing the room
- Ensure traffic flow — leave walking space between pieces
- Group related pieces together (sofa + coffee table, dining table + chairs)
- Do NOT add any extra furniture, plants, cushions, rugs, artwork, lamps or decor that is NOT in the list
- Reproduce each piece with its exact shape, colour and material from its product photo
- Correct perspective for each piece (vanishing lines match the room), all legs on the floor, contact shadows, lighting matches the room

Keep the room's architecture (walls, floor, ceiling, windows, doors) exactly as-is.

Return ONLY the furnished room image — no text, no labels.`,
    })

    const model = getGeminiModel()
    let lastDetail = 'bilinmeyen'
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await model.generateContent(parts)
        const extracted = await extractImageFromResponse(result)
        if (extracted.imageUrl) return Response.json({ resultUrl: extracted.imageUrl })
        lastDetail = extracted.textFallback ? `model metin döndürdü` : 'görüntü yok'
      } catch (e) {
        lastDetail = (e as Error).message
        if (attempt < 2) await new Promise(r => setTimeout(r, 1500))
      }
    }
    throw new Error(`Gemini görüntü üretemedi (${lastDetail})`)
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
