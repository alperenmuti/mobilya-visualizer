'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Download, Undo2, RotateCcw, AlertCircle } from 'lucide-react'
import RoomCanvas from '@/components/RoomCanvas'
import FurnitureList from '@/components/FurnitureList'
import { drawMarkerOnImage } from '@/lib/utils'
import type { FurnitureItem, ClickPoint } from '@/lib/types'

type Job =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'error'; error: string }

export default function PlaceFurniturePage() {
  const [brand, setBrand] = useState<string | null>(null)
  // history[0] = original room; last entry = current image. Each add pushes a new entry.
  const [history, setHistory] = useState<string[]>([])
  const [clickPoint, setClickPoint] = useState<ClickPoint | null>(null)
  const [selectedFurniture, setSelectedFurniture] = useState<FurnitureItem | null>(null)
  const [furniture, setFurniture] = useState<FurnitureItem[]>([])
  const [furnitureLoading, setFurnitureLoading] = useState(true)
  const [job, setJob] = useState<Job>({ status: 'idle' })

  const current = history.length ? history[history.length - 1] : null
  const addedCount = Math.max(0, history.length - 1)

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
    setHistory([dataUrl])
    setClickPoint(null)
    setJob({ status: 'idle' })
  }, [])

  const isProcessing = job.status === 'processing'
  const canAdd = !!(current && clickPoint && selectedFurniture) && !isProcessing

  const handleAdd = async () => {
    if (!current || !clickPoint || !selectedFurniture) return
    setJob({ status: 'processing' })

    // Draw an anchor dot at the click so Gemini knows the target spot.
    let markedImage = current
    let markerDrawn = false
    try {
      markedImage = await drawMarkerOnImage(current, clickPoint.x, clickPoint.y)
      markerDrawn = true
    } catch {}

    try {
      const res = await fetch('/api/ai/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: markedImage,
          markerDrawn,
          clickX: clickPoint.x,
          clickY: clickPoint.y,
          furnitureName: selectedFurniture.name,
          furnitureImageUrl: selectedFurniture.image_url,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.resultUrl) throw new Error(data.error ?? 'Mobilya eklenemedi. Tekrar deneyin.')
      setHistory(h => [...h, data.resultUrl])   // result becomes the new current image
      setClickPoint(null)
      setJob({ status: 'idle' })
    } catch (err) {
      setJob({ status: 'error', error: (err as Error).message })
    }
  }

  const handleUndo = () => {
    if (history.length <= 1) return
    setHistory(h => h.slice(0, -1))
    setClickPoint(null)
    setJob({ status: 'idle' })
  }

  const handleResetAll = () => {
    if (!history.length) return
    setHistory(h => [h[0]])
    setClickPoint(null)
    setJob({ status: 'idle' })
  }

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
          <h1 className="font-semibold text-sm">Odayı Döşe</h1>
          <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>
            {addedCount > 0 ? `${addedCount} mobilya eklendi` : 'Mobilya seç, odada bir yere tıkla, ekle'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {addedCount > 0 && (
            <>
              <button
                onClick={handleUndo}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-40"
                style={{ color: 'var(--muted-fg)' }}
              >
                <Undo2 size={12} /> Geri al
              </button>
              <button
                onClick={handleResetAll}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-40"
                style={{ color: 'var(--muted-fg)' }}
              >
                <RotateCcw size={12} /> Sıfırla
              </button>
              {current && (
                <a
                  href={current}
                  download="oda-tasarim.png"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                  style={{ background: 'var(--accent-dark)' }}
                >
                  <Download size={12} /> İndir
                </a>
              )}
            </>
          )}
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)' }}
          >
            {isProcessing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Ekleniyor
              </>
            ) : (
              <><Plus size={14} /> Ekle</>
            )}
          </button>
        </div>
      </header>

      {/* Status bar */}
      {job.status === 'error' && (
        <div className="px-4 py-2 text-xs flex items-center gap-2 flex-shrink-0" style={{ background: '#FEF2F2', color: '#DC2626', borderBottom: '1px solid var(--border)' }}>
          <AlertCircle size={12} /> {job.error}
        </div>
      )}
      {isProcessing && (
        <div className="px-4 py-2 text-xs flex items-center gap-2 flex-shrink-0" style={{ background: '#F5EFE6', color: 'var(--accent-dark)', borderBottom: '1px solid var(--border)' }}>
          <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Mobilya ekleniyor...
        </div>
      )}

      {/* Hint bar */}
      {current && !isProcessing && (
        <div className="px-4 py-2 text-xs flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--muted-fg)' }}>
          <span>{selectedFurniture ? `✓ ${selectedFurniture.name}` : '1) Sağdan mobilya seç'}</span>
          <span>·</span>
          <span>{clickPoint ? '✓ Konum seçildi' : '2) Odada koymak istediğin yere tıkla'}</span>
          <span>·</span>
          <span>3) “Ekle”ye bas</span>
        </div>
      )}

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-4 overflow-hidden relative">
          <RoomCanvas
            mode="place"
            onImageLoad={handleImageLoad}
            onPointSelect={isProcessing ? () => {} : setClickPoint}
            imageUrl={current}
            clickPoint={isProcessing ? null : clickPoint}
            disabled={isProcessing}
          />
        </div>

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
