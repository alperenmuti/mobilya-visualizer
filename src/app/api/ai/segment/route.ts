// Gemini kullanıldığında SAM 2 segmentasyonuna gerek yok.
// Gemini koordinat tabanlı çalıştığı için bu endpoint boş döner.
export async function POST() {
  return Response.json({ maskDataUrl: null, skipped: true })
}
