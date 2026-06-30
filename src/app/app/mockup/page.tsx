'use client'
import React, { useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Upload, Sparkles, Download, X, ImageIcon, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface Mockup {
  label: string
  imageUrl: string | null
  error: string | null
}

function MockupContent() {
  const searchParams = useSearchParams()
  const brand = searchParams.get('brand') ?? ''

  const [productImage, setProductImage] = useState<string | null>(null)
  const [productName, setProductName] = useState('')
  const [loading, setLoading] = useState(false)
  const [mockups, setMockups] = useState<Mockup[]>([])
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => setProductImage(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) readFile(file)
  }, [])

  const handleGenerate = async () => {
    if (!productImage || !productName.trim()) return
    setLoading(true)
    setError('')
    setMockups([])
    try {
      const res = await fetch('/api/mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productDataUrl: productImage, productName: productName.trim() }),
      })
      const text = await res.text()
      let data: { mockups?: Mockup[]; error?: string }
      try { data = JSON.parse(text) } catch { throw new Error('Sunucu hatası: ' + text.slice(0, 80)) }
      if (!res.ok) throw new Error(data.error)
      setMockups(data.mockups ?? [])
    } catch (err) {
      setError((err as Error).message)
    }
    setLoading(false)
  }

  const downloadImage = async (url: string, label: string) => {
    const res = await fetch(url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mockup-${label.toLowerCase().replace(/\s+/g, '-')}.jpg`
    a.click()
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <header className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
        <Link href={brand ? `/app?brand=${brand}` : '/app'} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} style={{ color: 'var(--muted-fg)' }} />
        </Link>
        <span className="font-semibold text-sm">Mockup Oluştur</span>
      </header>

      <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Yaşam Stili Görseli</h1>
          <p className="text-sm" style={{ color: 'var(--muted-fg)' }}>
            Ürün fotoğrafı yükle → AI 4 farklı oda ortamında gerçekçi mockup oluştursun
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Upload area */}
          <div>
            <label className="block text-xs font-medium mb-1.5">Ürün Fotoğrafı *</label>
            <div
              onClick={() => !productImage && fileRef.current?.click()}
              onDrop={onDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              className="relative rounded-2xl border-2 border-dashed transition-all flex items-center justify-center overflow-hidden"
              style={{
                height: 240,
                borderColor: dragOver ? 'var(--accent)' : 'var(--border)',
                background: dragOver ? 'rgba(196,168,130,0.08)' : 'var(--card)',
                cursor: productImage ? 'default' : 'pointer',
              }}
            >
              {productImage ? (
                <>
                  <img src={productImage} alt="ürün" className="h-full w-full object-contain p-4" />
                  <button
                    onClick={e => { e.stopPropagation(); setProductImage(null) }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white"
                    style={{ background: 'rgba(0,0,0,0.5)' }}
                  >
                    <X size={13} />
                  </button>
                </>
              ) : (
                <div className="text-center p-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: '#F5EFE6' }}>
                    <Upload size={20} style={{ color: 'var(--accent)' }} />
                  </div>
                  <p className="text-sm font-medium mb-1">Fotoğraf yükle veya sürükle</p>
                  <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>JPG, PNG, WEBP</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f) }} />
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Ürün Adı *</label>
              <input
                value={productName}
                onChange={e => setProductName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder="örn: Destina Yemek Masası"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              />
            </div>

            <div className="p-4 rounded-xl" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-medium mb-2">Oluşturulacak 4 sahne:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {['Modern Salon', 'Sıcak Oturma Odası', 'Doğal & Bohem', 'Stüdyo Çekimi'].map(s => (
                  <div key={s} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-fg)' }}>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                    {s}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!productImage || !productName.trim() || loading}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)' }}
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Oluşturuluyor... (~30-60sn)</>
                : <><Sparkles size={15} /> Mockup Oluştur</>}
            </button>

            {error && (
              <p className="flex items-start gap-1.5 text-xs" style={{ color: '#DC2626' }}>
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />{error}
              </p>
            )}
          </div>
        </div>

        {/* Results grid */}
        {(loading || mockups.length > 0) && (
          <div>
            <h2 className="text-sm font-semibold mb-4">
              {loading ? 'Sahneler oluşturuluyor...' : `${mockups.filter(m => m.imageUrl).length} mockup hazır`}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl flex flex-col items-center justify-center gap-2" style={{ aspectRatio: '4/3', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted-fg)' }}>
                    <Loader2 size={20} className="animate-spin" />
                    <span className="text-xs">Oluşturuluyor...</span>
                  </div>
                ))
                : mockups.map(m => (
                  <div key={m.label} className="rounded-2xl overflow-hidden relative group" style={{ border: '1px solid var(--border)' }}>
                    {m.imageUrl ? (
                      <>
                        <img src={m.imageUrl} alt={m.label} className="w-full object-cover" style={{ aspectRatio: '4/3' }} />
                        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2.5" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.65))' }}>
                          <span className="text-white text-xs font-medium">{m.label}</span>
                          <button
                            onClick={() => downloadImage(m.imageUrl!, m.label)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}
                          >
                            <Download size={11} /> İndir
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="w-full flex flex-col items-center justify-center gap-2 p-4 text-center" style={{ aspectRatio: '4/3', background: 'var(--card)', color: 'var(--muted-fg)' }}>
                        <AlertCircle size={18} style={{ color: '#DC2626' }} />
                        <span className="text-xs font-medium">{m.label}</span>
                        <span className="text-xs">{m.error ?? 'Üretilemedi'}</span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function MockupPage() {
  return (
    <Suspense fallback={null}>
      <MockupContent />
    </Suspense>
  )
}
