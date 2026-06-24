'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Download, RotateCcw, AlertCircle } from 'lucide-react'
import RoomCanvas from '@/components/RoomCanvas'
import type { ClickPoint } from '@/lib/types'

type Job =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'done'; resultUrl: string }
  | { status: 'error'; error: string }

export default function EmptyRoomPage() {
  const [brand, setBrand] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
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
      const res = await fetch('/api/ai/empty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
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
          <h1 className="font-semibold text-sm">Odayı Boşalt</h1>
          <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>Tüm mobilyaları kaldır, boş oda göster</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isDone && resultUrl && (
            <a
              href={resultUrl}
              download="bos-oda.png"
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
              <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />İşleniyor...</>
            ) : (
              <><Sparkles size={14} /> Boşalt</>
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
          AI odadaki tüm eşyaları kaldırıyor...
        </div>
      )}

      <div className="flex items-center gap-4 px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
        <Step n={1} label="Fotoğraf" done={!!imageDataUrl} />
        <StepDivider />
        <Step n={2} label="Boşalt" done={isDone} />
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
