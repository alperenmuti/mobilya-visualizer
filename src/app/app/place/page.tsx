'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Download, RotateCcw, AlertCircle } from 'lucide-react'
import RoomCanvas from '@/components/RoomCanvas'
import FurnitureList from '@/components/FurnitureList'
import type { FurnitureItem, ClickPoint, AIJobStatus } from '@/lib/types'

/** Returns furniture area fractions for mask sizing */
function furnitureFracs(name: string): { wFrac: number; hFrac: number } {
  const n = name.toLowerCase()
  if (/kanepe|sofa|couch|chester/.test(n)) return { wFrac: 0.40, hFrac: 0.32 }
  if (/berjer|bergere/.test(n))           return { wFrac: 0.22, hFrac: 0.28 }
  if (/koltuk|armchair|lounge/.test(n))   return { wFrac: 0.26, hFrac: 0.30 }
  if (/sandalye|chair/.test(n))           return { wFrac: 0.16, hFrac: 0.24 }
  if (/yatak|bed/.test(n))                return { wFrac: 0.48, hFrac: 0.36 }
  if (/dolap|wardrobe|closet/.test(n))    return { wFrac: 0.22, hFrac: 0.55 }
  if (/kitaplık|bookcase|shelf/.test(n))  return { wFrac: 0.22, hFrac: 0.50 }
  if (/sehpa|coffee table/.test(n))       return { wFrac: 0.28, hFrac: 0.14 }
  if (/yemek masası|dining/.test(n))      return { wFrac: 0.36, hFrac: 0.20 }
  if (/masa|desk|table/.test(n))          return { wFrac: 0.30, hFrac: 0.20 }
  return { wFrac: 0.30, hFrac: 0.30 }
}

/**
 * Draws a black+white inpainting mask using browser Canvas.
 * White ellipse = where FLUX Fill places furniture (grows upward from click).
 * No server-side native deps needed.
 */
function generateMask(
  imageDataUrl: string,
  cx: number, cy: number,
  furnitureName: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!

      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const { wFrac, hFrac } = furnitureFracs(furnitureName)
      const fw = canvas.width  * wFrac
      const fh = canvas.height * hFrac
      const mx = cx * canvas.width
      const my = cy * canvas.height

      // Soft feathered edge via layered semi-transparent ellipses
      for (let i = 5; i >= 0; i--) {
        const scale = 1 + i * 0.06
        ctx.globalAlpha = i === 0 ? 1 : 0.18
        ctx.fillStyle = i === 0 ? '#fff' : '#aaa'
        ctx.beginPath()
        ctx.ellipse(mx, my - fh / 2, (fw / 2) * scale, (fh / 2) * scale, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = reject
    img.src = imageDataUrl
  })
}

export default function PlaceFurniturePage() {
  const [brand, setBrand] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [clickPoint, setClickPoint] = useState<ClickPoint | null>(null)
  const [selectedFurniture, setSelectedFurniture] = useState<FurnitureItem | null>(null)
  const [furniture, setFurniture] = useState<FurnitureItem[]>([])
  const [furnitureLoading, setFurnitureLoading] = useState(true)
  const [job, setJob] = useState<AIJobStatus>({ status: 'idle' })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setBrand(params.get('brand') ?? '')
  }, [])

  useEffect(() => {
    if (brand === null) return
    const url = brand ? `/api/furniture?tenant=${brand}` : '/api/furniture'
    fetch(url)
      .then(r => r.json())
      .then(d => { setFurniture(d.items ?? []); setFurnitureLoading(false) })
      .catch(() => setFurnitureLoading(false))
  }, [brand])

  const handleImageLoad = useCallback((_file: File, dataUrl: string) => {
    setImageDataUrl(dataUrl)
    setClickPoint(null)
    setJob({ status: 'idle' })
  }, [])

  const canGenerate = imageDataUrl && clickPoint && selectedFurniture && job.status !== 'processing'

  const handleGenerate = async () => {
    if (!imageDataUrl || !clickPoint || !selectedFurniture) return
    setJob({ status: 'processing', message: 'AI mobilyayı yerleştiriyor...' })

    try {
      // Generate inpainting mask client-side (no server-side native deps needed)
      let maskDataUrl: string | undefined
      try {
        maskDataUrl = await generateMask(imageDataUrl, clickPoint.x, clickPoint.y, selectedFurniture.name)
      } catch (e) {
        console.warn('Mask generation failed, proceeding without mask:', e)
      }

      const res = await fetch('/api/ai/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          maskDataUrl,
          clickX: clickPoint.x,
          clickY: clickPoint.y,
          furnitureName: selectedFurniture.name,
          furnitureImageUrl: selectedFurniture.image_url,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Bilinmeyen hata')
      setJob({ status: 'done', resultUrl: data.resultUrl })
    } catch (err) {
      setJob({ status: 'error', error: (err as Error).message })
    }
  }

  const handleReset = () => {
    setClickPoint(null)
    setJob({ status: 'idle' })
  }

  const isProcessing = job.status === 'processing'

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}
      >
        <Link href={brand ? `/app?brand=${brand}` : '/app'} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} style={{ color: 'var(--muted-fg)' }} />
        </Link>
        <div>
          <h1 className="font-semibold text-sm">Mobilya Yerleştir</h1>
          <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>Boş odana mobilya ekle</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {job.status === 'done' && job.resultUrl && (
            <a
              href={job.resultUrl}
              download="mobilya-yerlesim.png"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--accent-dark)' }}
            >
              <Download size={12} /> İndir
            </a>
          )}
          {(job.status === 'done' || job.status === 'error') && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100"
              style={{ color: 'var(--muted-fg)' }}
            >
              <RotateCcw size={12} /> Tekrar dene
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)' }}
          >
            {isProcessing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                İşleniyor...
              </>
            ) : (
              <><Sparkles size={14} /> Oluştur</>
            )}
          </button>
        </div>
      </header>

      {/* Status bar */}
      {(isProcessing || job.status === 'error') && (
        <div
          className="px-4 py-2 text-xs flex items-center gap-2 flex-shrink-0"
          style={{
            background: job.status === 'error' ? '#FEF2F2' : '#F5EFE6',
            color: job.status === 'error' ? '#DC2626' : 'var(--accent-dark)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {job.status === 'error' ? (
            <><AlertCircle size={12} /> {job.error}</>
          ) : (
            <><span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />{job.message}</>
          )}
        </div>
      )}

      {/* Steps indicator */}
      <div className="flex items-center gap-4 px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
        <Step n={1} label="Fotoğraf yükle" done={!!imageDataUrl} />
        <StepDivider />
        <Step n={2} label="Mobilya seç" done={!!selectedFurniture} />
        <StepDivider />
        <Step n={3} label="Konuma tıkla" done={!!clickPoint} />
        <StepDivider />
        <Step n={4} label="Oluştur" done={job.status === 'done'} />
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 p-4 overflow-hidden">
          <RoomCanvas
            mode="place"
            onImageLoad={handleImageLoad}
            onPointSelect={setClickPoint}
            imageUrl={imageDataUrl}
            clickPoint={clickPoint}
            resultUrl={job.status === 'done' ? job.resultUrl : null}
            disabled={isProcessing}
          />
        </div>

        {/* Sidebar */}
        <div
          className="w-72 flex-shrink-0 flex flex-col overflow-hidden"
          style={{ borderLeft: '1px solid var(--border)', background: 'var(--card)' }}
        >
          <div className="px-4 pt-4 pb-2 flex-shrink-0">
            <h2 className="font-semibold text-sm">Mobilya Seç</h2>
            {selectedFurniture && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--accent-dark)' }}>
                ✓ {selectedFurniture.name}
              </p>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <FurnitureList
              items={furniture}
              loading={furnitureLoading}
              selected={selectedFurniture}
              onSelect={setSelectedFurniture}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Step({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: done ? 'var(--accent)' : 'var(--border)', color: done ? 'white' : 'var(--muted-fg)' }}
      >
        {done ? '✓' : n}
      </div>
      <span className="text-xs" style={{ color: done ? 'var(--foreground)' : 'var(--muted-fg)' }}>{label}</span>
    </div>
  )
}

function StepDivider() {
  return <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
}
