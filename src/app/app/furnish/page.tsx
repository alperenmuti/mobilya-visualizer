'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Download, RotateCcw, AlertCircle, Loader2, X } from 'lucide-react'
import RoomCanvas from '@/components/RoomCanvas'
import FurnitureList from '@/components/FurnitureList'
import RoomTypeSelector from '@/components/RoomTypeSelector'
import type { FurnitureItem } from '@/lib/types'

type Job = { status: 'idle' } | { status: 'processing' } | { status: 'error'; error: string }

export default function FurnishPage() {
  const [brand, setBrand] = useState<string | null>(null)
  const [roomType, setRoomType] = useState('')
  const [roomDataUrl, setRoomDataUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [furniture, setFurniture] = useState<FurnitureItem[]>([])
  const [furnitureLoading, setFurnitureLoading] = useState(true)
  const [selected, setSelected] = useState<FurnitureItem[]>([])
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
    setRoomDataUrl(dataUrl)
    setResultUrl(null)
    setJob({ status: 'idle' })
  }, [])

  const handleToggle = useCallback((item: FurnitureItem) => {
    setSelected(prev =>
      prev.find(s => s.id === item.id)
        ? prev.filter(s => s.id !== item.id)
        : prev.length >= 12 ? prev : [...prev, item]
    )
  }, [])

  const handleGenerate = async () => {
    if (!roomDataUrl || selected.length === 0) return
    setJob({ status: 'processing' })
    setResultUrl(null)
    try {
      const res = await fetch('/api/ai/furnish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomDataUrl,
          furniture: selected.map(f => ({ name: f.name, image_url: f.image_url })),
          roomType,
        }),
      })
      const text = await res.text()
      let data: { resultUrl?: string; error?: string }
      try { data = JSON.parse(text) } catch { throw new Error('Sunucu hatası: ' + text.slice(0, 80)) }
      if (!res.ok || !data.resultUrl) throw new Error(data.error ?? 'Oda döşenemedi, tekrar deneyin.')
      setResultUrl(data.resultUrl)
      setJob({ status: 'idle' })
    } catch (err) {
      setJob({ status: 'error', error: (err as Error).message })
    }
  }

  const handleReset = () => {
    setResultUrl(null)
    setJob({ status: 'idle' })
  }

  const handleDownload = () => {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = 'odami-sen-yap.jpg'
    a.click()
  }

  const isProcessing = job.status === 'processing'
  const canGenerate = !!roomDataUrl && selected.length > 0 && !isProcessing

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
          <h1 className="font-semibold text-sm">Odamı Sen Yap</h1>
          <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>
            {selected.length > 0
              ? `${selected.length} mobilya seçildi — AI odanı döşesin`
              : 'Oda fotoğrafı yükle, mobilyaları seç'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {resultUrl && (
            <>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100"
                style={{ color: 'var(--muted-fg)' }}
              >
                <RotateCcw size={12} /> Tekrar
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Download size={12} /> İndir
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: canvas + controls */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
          {/* Room type selector */}
          <RoomTypeSelector value={roomType} onChange={setRoomType} />

          {/* Canvas */}
          <div className="flex-1 overflow-hidden rounded-2xl">
            <RoomCanvas
              mode="place"
              selectable={false}
              onImageLoad={handleImageLoad}
              onPointSelect={() => {}}
              imageUrl={roomDataUrl}
              resultUrl={resultUrl}
            />
          </div>

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {selected.map(item => (
                <span
                  key={item.id}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: '#F5EFE6', color: 'var(--accent-dark)', border: '1px solid var(--accent)' }}
                >
                  {item.name}
                  <button onClick={() => handleToggle(item)} className="hover:opacity-70">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)' }}
          >
            {isProcessing
              ? <><Loader2 size={15} className="animate-spin" /> AI odanı döşüyor... (~30-60sn)</>
              : <><Sparkles size={15} /> Odamı Sen Yap</>}
          </button>

          {job.status === 'error' && (
            <p className="flex items-start gap-1.5 text-xs" style={{ color: '#DC2626' }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />{job.error}
            </p>
          )}
        </div>

        {/* Right: multi-select furniture list */}
        <aside
          className="w-72 flex-shrink-0 flex flex-col overflow-hidden"
          style={{ borderLeft: '1px solid var(--border)', background: 'var(--card)' }}
        >
          <div className="px-4 py-3 border-b text-xs font-semibold" style={{ borderColor: 'var(--border)' }}>
            Mobilya Seç {selected.length > 0 && `(${selected.length}/12)`}
          </div>
          <div className="flex-1 overflow-hidden">
            <FurnitureList
              items={furniture}
              loading={furnitureLoading}
              multiSelect
              selectedIds={selected.map(s => s.id)}
              onToggle={handleToggle}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
