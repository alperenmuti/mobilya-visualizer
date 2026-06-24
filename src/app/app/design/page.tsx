'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Download, RotateCcw, AlertCircle, Check } from 'lucide-react'
import RoomCanvas from '@/components/RoomCanvas'
import type { ClickPoint } from '@/lib/types'

const STYLES = [
  { id: 'modern',       label: 'Modern',       desc: 'Temiz çizgiler, nötr tonlar' },
  { id: 'scandinavian', label: 'Skandinav',     desc: 'Açık ahşap, beyaz, sıcak dokular' },
  { id: 'classic',      label: 'Klasik',        desc: 'Koyu ahşap, kadife, altın detaylar' },
  { id: 'industrial',   label: 'Endüstriyel',   desc: 'Metal, deri, ham malzemeler' },
  { id: 'minimalist',   label: 'Minimalist',    desc: 'Sadece esaslar, monokromatik' },
  { id: 'boho',         label: 'Boho',          desc: 'Rattan, halı katmanlar, bitkiler' },
]

type Job =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'done'; resultUrl: string }
  | { status: 'error'; error: string }

export default function DesignPage() {
  const [brand, setBrand] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<string>('modern')
  const [job, setJob] = useState<Job>({ status: 'idle' })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setBrand(params.get('brand') ?? '')
  }, [])

  const handleImageLoad = useCallback((_file: File, dataUrl: string) => {
    setImageDataUrl(dataUrl)
    setJob({ status: 'idle' })
  }, [])

  const handleGenerate = async () => {
    if (!imageDataUrl) return
    setJob({ status: 'processing' })
    try {
      const res = await fetch('/api/ai/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl, style: selectedStyle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Bilinmeyen hata')
      setJob({ status: 'done', resultUrl: data.resultUrl })
    } catch (err) {
      setJob({ status: 'error', error: (err as Error).message })
    }
  }

  const handleReset = () => setJob({ status: 'idle' })

  const isProcessing = job.status === 'processing'
  const isDone = job.status === 'done'
  const isError = job.status === 'error'
  const resultUrl = isDone ? job.resultUrl : null

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--background)' }}>
      <header
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}
      >
        <Link href={brand ? `/app?brand=${brand}` : '/app'} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} style={{ color: 'var(--muted-fg)' }} />
        </Link>
        <div>
          <h1 className="font-semibold text-sm">Baştan Dizayn Et</h1>
          <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>Boş odayı seçilen stilde döşe</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isDone && resultUrl && (
            <a
              href={resultUrl}
              download={`dizayn-${selectedStyle}.png`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ background: 'var(--accent-dark)' }}
            >
              <Download size={12} /> İndir
            </a>
          )}
          {(isDone || isError) && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100"
              style={{ color: 'var(--muted-fg)' }}
            >
              <RotateCcw size={12} /> Tekrar dene
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={!imageDataUrl || isProcessing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)' }}
          >
            {isProcessing ? (
              <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Oluşturuyor...</>
            ) : (
              <><Sparkles size={14} /> Dizayn Et</>
            )}
          </button>
        </div>
      </header>

      {isError && (
        <div className="px-4 py-2 text-xs flex items-center gap-2 flex-shrink-0" style={{ background: '#FEF2F2', color: '#DC2626', borderBottom: '1px solid var(--border)' }}>
          <AlertCircle size={12} /> {job.error}
        </div>
      )}
      {isProcessing && (
        <div className="px-4 py-2 text-xs flex items-center gap-2 flex-shrink-0" style={{ background: '#F5EFE6', color: 'var(--accent-dark)', borderBottom: '1px solid var(--border)' }}>
          <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          AI odayı {STYLES.find(s => s.id === selectedStyle)?.label ?? ''} stilde döşüyor...
        </div>
      )}

      {/* Style selector */}
      <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
        <div className="grid grid-cols-6 gap-2">
          {STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => { setSelectedStyle(s.id); if (isDone) setJob({ status: 'idle' }) }}
              disabled={isProcessing}
              className="relative flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-center transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: selectedStyle === s.id ? 'var(--accent)' : 'var(--card)',
                border: `1px solid ${selectedStyle === s.id ? 'var(--accent)' : 'var(--border)'}`,
                color: selectedStyle === s.id ? 'white' : 'var(--foreground)',
              }}
            >
              {selectedStyle === s.id && (
                <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
                  <Check size={8} style={{ color: 'var(--accent)' }} />
                </div>
              )}
              <span className="text-xs font-semibold leading-tight">{s.label}</span>
              <span className="text-[10px] leading-tight opacity-70">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        <RoomCanvas
          mode="place"
          onImageLoad={handleImageLoad}
          onPointSelect={(_p: ClickPoint) => {}}
          imageUrl={imageDataUrl}
          clickPoint={null}
          resultUrl={resultUrl}
          disabled={isProcessing}
        />
      </div>
    </div>
  )
}
