'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Download, RotateCcw, AlertCircle } from 'lucide-react'
import RoomCanvas from '@/components/RoomCanvas'
import FurnitureList from '@/components/FurnitureList'
import { compositeFurnitureOnImage } from '@/lib/utils'
import type { FurnitureItem, ClickPoint } from '@/lib/types'

type Job =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'done'; resultUrl: string }
  | { status: 'error'; error: string }

export default function PlaceFurniturePage() {
  const [brand, setBrand] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [clickPoint, setClickPoint] = useState<ClickPoint | null>(null)
  const [selectedFurniture, setSelectedFurniture] = useState<FurnitureItem | null>(null)
  const [furniture, setFurniture] = useState<FurnitureItem[]>([])
  const [furnitureLoading, setFurnitureLoading] = useState(true)
  const [job, setJob] = useState<Job>({ status: 'idle' })

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

  const canGenerate = !!(imageDataUrl && clickPoint && selectedFurniture) && job.status !== 'processing'

  const handleGenerate = async () => {
    if (!imageDataUrl || !clickPoint || !selectedFurniture) return
    setJob({ status: 'processing' })

    try {
      // Step 1 — server cuts the product out of its catalog photo (bg removed).
      const cutRes = await fetch('/api/ai/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'cutout',
          furnitureName: selectedFurniture.name,
          furnitureImageUrl: selectedFurniture.image_url,
        }),
      })
      const cut = await cutRes.json()
      if (!cutRes.ok || !cut.cutoutUrl) throw new Error(cut.error ?? 'Mobilya görseli hazırlanamadı.')

      // Step 2 — composite the cut-out onto the room exactly where the user clicked.
      const composite = await compositeFurnitureOnImage(
        imageDataUrl, cut.cutoutUrl, clickPoint.x, clickPoint.y, cut.widthFraction ?? 0.3,
      )

      // Step 3 — server refines the paste into a photorealistic result via FLUX.
      const refRes = await fetch('/api/ai/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'refine',
          imageDataUrl: composite,
          furnitureName: selectedFurniture.name,
        }),
      })
      const ref = await refRes.json()
      if (!refRes.ok || !ref.resultUrl) throw new Error(ref.error ?? 'AI görüntü oluşturamadı. Tekrar deneyin.')
      setJob({ status: 'done', resultUrl: ref.resultUrl })
    } catch (err) {
      setJob({ status: 'error', error: (err as Error).message })
    }
  }

  const handleReset = () => {
    setClickPoint(null)
    setJob({ status: 'idle' })
  }

  const isProcessing = job.status === 'processing'
  const isDone = job.status === 'done'
  const isError = job.status === 'error'
  const resultUrl = isDone ? job.resultUrl : null

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
          {isDone && resultUrl && (
            <a
              href={resultUrl}
              download="mobilya-yerlesim.png"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--accent-dark)' }}
            >
              <Download size={12} /> İndir
            </a>
          )}
          {(isDone || isError) && (
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
                Oluşturuluyor
              </>
            ) : (
              <><Sparkles size={14} /> Oluştur</>
            )}
          </button>
        </div>
      </header>

      {/* Status bar */}
      {isError && (
        <div className="px-4 py-2 text-xs flex items-center gap-2 flex-shrink-0" style={{ background: '#FEF2F2', color: '#DC2626', borderBottom: '1px solid var(--border)' }}>
          <AlertCircle size={12} /> {job.error}
        </div>
      )}
      {isProcessing && (
        <div className="px-4 py-2 text-xs flex items-center gap-2 flex-shrink-0" style={{ background: '#F5EFE6', color: 'var(--accent-dark)', borderBottom: '1px solid var(--border)' }}>
          <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Mobilya yerleştiriliyor...
        </div>
      )}

      {/* Steps indicator */}
      <div className="flex items-center gap-4 px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
        <Step n={1} label="Fotoğraf" done={!!imageDataUrl} />
        <StepDivider />
        <Step n={2} label="Mobilya" done={!!selectedFurniture} />
        <StepDivider />
        <Step n={3} label="Konum" done={!!clickPoint} />
        <StepDivider />
        <Step n={4} label="Oluştur" done={isDone} />
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 p-4 overflow-hidden relative">
          <RoomCanvas
            mode="place"
            onImageLoad={handleImageLoad}
            onPointSelect={isProcessing ? () => {} : setClickPoint}
            imageUrl={imageDataUrl}
            clickPoint={isProcessing ? null : clickPoint}
            resultUrl={resultUrl}
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
