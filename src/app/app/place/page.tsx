'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Download, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react'
import RoomCanvas from '@/components/RoomCanvas'
import FurnitureList from '@/components/FurnitureList'
import { drawMarkerOnImage } from '@/lib/utils'
import type { FurnitureItem, ClickPoint } from '@/lib/types'

type Job =
  | { status: 'idle' }
  | { status: 'processing'; done: number }
  | { status: 'selecting' }
  | { status: 'done'; resultUrl: string }
  | { status: 'error'; error: string }

// 3 parallel calls with slight X offsets so each variation lands in a slightly different spot
const OFFSETS = [
  { dx: 0,     dy: 0 },
  { dx: -0.05, dy: 0 },
  { dx:  0.05, dy: 0 },
]

export default function PlaceFurniturePage() {
  const [brand, setBrand] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [clickPoint, setClickPoint] = useState<ClickPoint | null>(null)
  const [selectedFurniture, setSelectedFurniture] = useState<FurnitureItem | null>(null)
  const [furniture, setFurniture] = useState<FurnitureItem[]>([])
  const [furnitureLoading, setFurnitureLoading] = useState(true)
  const [job, setJob] = useState<Job>({ status: 'idle' })
  const [variations, setVariations] = useState<(string | null)[]>([null, null, null])

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
    setVariations([null, null, null])
  }, [])

  const canGenerate = !!(imageDataUrl && clickPoint && selectedFurniture) && job.status !== 'processing'

  const handleGenerate = async () => {
    if (!imageDataUrl || !clickPoint || !selectedFurniture) return

    const results: (string | null)[] = [null, null, null]
    setVariations([null, null, null])
    setJob({ status: 'processing', done: 0 })

    let doneCount = 0

    await Promise.all(
      OFFSETS.map(async ({ dx, dy }, i) => {
        const cx = Math.max(0.05, Math.min(0.95, clickPoint.x + dx))
        const cy = Math.max(0.05, Math.min(0.95, clickPoint.y + dy))

        // Draw the anchor marker in the browser (no server Sharp dependency).
        // If it fails for any reason, send the plain image and let the server fall back.
        let markedImage = imageDataUrl
        let markerDrawn = false
        try {
          markedImage = await drawMarkerOnImage(imageDataUrl, cx, cy)
          markerDrawn = true
        } catch {}

        return fetch('/api/ai/place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageDataUrl: markedImage,
            markerDrawn,
            clickX: cx,
            clickY: cy,
            furnitureName: selectedFurniture.name,
            furnitureImageUrl: selectedFurniture.image_url,
          }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.resultUrl) {
              results[i] = data.resultUrl
              setVariations([...results])
            }
          })
          .catch(() => {})
          .finally(() => {
            doneCount++
            setJob({ status: 'processing', done: doneCount })
          })
      })
    )

    const ok = results.filter(Boolean)
    if (ok.length === 0) {
      setJob({ status: 'error', error: 'AI görüntü oluşturamadı. Tekrar deneyin.' })
    } else {
      setJob({ status: 'selecting' })
    }
  }

  const handlePick = (url: string) => {
    setJob({ status: 'done', resultUrl: url })
  }

  const handleReset = () => {
    setClickPoint(null)
    setJob({ status: 'idle' })
    setVariations([null, null, null])
  }

  const isProcessing = job.status === 'processing'
  const isSelecting = job.status === 'selecting'
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
          {(isDone || isError || isSelecting) && (
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
                {job.done}/3
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
          3 farklı seçenek hazırlanıyor — {job.done}/3 tamamlandı
        </div>
      )}
      {isSelecting && (
        <div className="px-4 py-2 text-xs flex items-center gap-2 flex-shrink-0" style={{ background: '#F5EFE6', color: 'var(--accent-dark)', borderBottom: '1px solid var(--border)' }}>
          <CheckCircle2 size={12} /> Beğendiğiniz seçeneğe tıklayın
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
        <Step n={4} label="Seç" done={isDone} />
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas + variation overlay */}
        <div className="flex-1 p-4 overflow-hidden relative">
          <RoomCanvas
            mode="place"
            onImageLoad={handleImageLoad}
            onPointSelect={isProcessing || isSelecting ? (_p: ClickPoint) => {} : setClickPoint}
            imageUrl={imageDataUrl}
            clickPoint={isProcessing || isSelecting ? null : clickPoint}
            resultUrl={resultUrl}
            disabled={isProcessing || isSelecting}
          />

          {/* Variation cards — shown while processing and while selecting */}
          {(isProcessing || isSelecting) && imageDataUrl && (
            <div className="absolute inset-x-4 bottom-4 flex gap-3 z-10">
              {variations.map((v, i) => (
                <VariationCard key={i} index={i} url={v} onPick={handlePick} />
              ))}
            </div>
          )}
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

function VariationCard({ index, url, onPick }: { index: number; url: string | null; onPick: (url: string) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={() => url && onPick(url)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={!url}
      className="flex-1 rounded-2xl overflow-hidden relative"
      style={{
        aspectRatio: '4/3',
        opacity: url ? (hovered ? 1 : 0.78) : 0.45,
        transform: hovered && url ? 'scale(1.03) translateY(-3px)' : 'scale(1)',
        transition: 'opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
        border: hovered && url ? '2px solid rgba(255,255,255,0.95)' : '2px solid rgba(255,255,255,0.45)',
        boxShadow: hovered && url ? '0 10px 28px rgba(0,0,0,0.4)' : '0 4px 14px rgba(0,0,0,0.25)',
        cursor: url ? 'pointer' : 'default',
        background: 'rgba(200,195,190,0.4)',
      }}
    >
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Seçenek ${index + 1}`} className="w-full h-full object-cover" />
          {/* bottom gradient + label on hover */}
          <div
            className="absolute inset-0 flex items-end justify-center pb-3"
            style={{
              background: hovered
                ? 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)'
                : 'linear-gradient(to top, rgba(0,0,0,0.2) 0%, transparent 40%)',
              transition: 'background 0.15s',
            }}
          >
            {hovered && (
              <span className="text-white text-xs font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}>
                Seçenek {index + 1} — Seç
              </span>
            )}
          </div>
          {/* number badge */}
          {!hovered && (
            <div className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
              <span className="text-white text-xs font-bold">{index + 1}</span>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium" style={{ color: 'rgba(100,90,80,0.7)' }}>{index + 1}</span>
        </div>
      )}
    </button>
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
