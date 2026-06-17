'use client'
import { useRef, useState, useCallback } from 'react'
import { Upload, MousePointerClick, X } from 'lucide-react'
import type { ClickPoint } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  mode: 'place' | 'replace'
  onImageLoad: (file: File, dataUrl: string) => void
  onPointSelect: (point: ClickPoint) => void
  imageUrl?: string | null
  clickPoint?: ClickPoint | null
  resultUrl?: string | null
  disabled?: boolean
}

export default function RoomCanvas({
  mode, onImageLoad, onPointSelect, imageUrl, clickPoint, resultUrl, disabled
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => onImageLoad(file, e.target?.result as string)
    reader.readAsDataURL(file)
  }, [onImageLoad])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageUrl || disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const pixelX = Math.round(x * (imgRef.current?.naturalWidth ?? rect.width))
    const pixelY = Math.round(y * (imgRef.current?.naturalHeight ?? rect.height))
    onPointSelect({ x, y, pixelX, pixelY })
  }, [imageUrl, disabled, onPointSelect])

  const displayUrl = resultUrl || imageUrl

  return (
    <div className="flex flex-col h-full">
      {/* Canvas area */}
      <div
        className={cn(
          'relative flex-1 rounded-2xl overflow-hidden transition-all',
          !imageUrl && 'border-2 border-dashed',
          dragOver && 'scale-[0.99]'
        )}
        style={{
          background: imageUrl ? '#000' : 'var(--muted)',
          borderColor: dragOver ? 'var(--accent)' : 'var(--border)',
          cursor: imageUrl && !disabled ? (mode === 'place' ? 'crosshair' : 'pointer') : 'default',
          minHeight: 320,
        }}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={handleClick}
      >
        {!imageUrl ? (
          /* Upload prompt */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <Upload size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm">
                {mode === 'place' ? 'Boş oda fotoğrafı yükle' : 'Oda fotoğrafı yükle'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted-fg)' }}>
                Sürükle bırak veya tıkla
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              Dosya Seç
            </button>
          </div>
        ) : (
          /* Image display */
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={displayUrl!}
              alt="Oda"
              className="w-full h-full object-contain"
              draggable={false}
            />

            {/* Result overlay badge */}
            {resultUrl && (
              <div
                className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium text-white"
                style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              >
                ✨ AI Sonucu
              </div>
            )}

            {/* Click point indicator */}
            {clickPoint && !resultUrl && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${clickPoint.x * 100}%`,
                  top: `${clickPoint.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className="absolute inset-0 rounded-full animate-pulse-ring"
                  style={{ width: 32, height: 32, margin: -4, background: 'rgba(196,168,130,0.4)' }}
                />
                <div
                  className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center"
                  style={{ background: 'var(--accent)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
                >
                  <MousePointerClick size={10} className="text-white" />
                </div>
              </div>
            )}

            {/* Hint overlay when no point selected */}
            {imageUrl && !clickPoint && !resultUrl && !disabled && (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium text-white"
                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap' }}
              >
                {mode === 'place'
                  ? '👆 Mobilya koymak istediğin yere tıkla'
                  : '👆 Değiştirmek istediğin mobilyaya tıkla'}
              </div>
            )}
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {/* Change image button */}
      {imageUrl && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-3 flex items-center gap-1.5 text-xs self-center px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
          style={{ color: 'var(--muted-fg)' }}
        >
          <X size={12} />
          Fotoğrafı değiştir
        </button>
      )}
    </div>
  )
}
