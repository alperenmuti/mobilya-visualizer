'use client'
import React, { useState, useRef, useCallback } from 'react'
import { Upload, Sparkles, Download, X, ImageIcon, Loader2, AlertCircle } from 'lucide-react'
import { getAdminAuthHeaders } from '@/lib/adminAuth'

interface Mockup {
  label: string
  imageUrl: string | null
  error: string | null
}

export default function MockupPage() {
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
      const res = await fetch('/api/admin/mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
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
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-0.5">Mockup Görseli Üret</h1>
        <p className="text-sm" style={{ color: 'var(--muted-fg)' }}>
          Ürün fotoğrafı yükle → AI 4 farklı oda sahnesinde yaşam stili görseli oluştursun
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Upload */}
        <div>
          <label className="block text-xs font-medium mb-1.5">Ürün Fotoğrafı *</label>
          <div
            onClick={() => !productImage && fileRef.current?.click()}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            className="relative rounded-2xl border-2 border-dashed transition-colors flex items-center justify-center overflow-hidden"
            style={{
              height: 220,
              borderColor: dragOver ? 'var(--accent)' : 'var(--border)',
              background: dragOver ? 'var(--muted)' : 'var(--card)',
              cursor: productImage ? 'default' : 'pointer',
            }}
          >
            {productImage ? (
              <>
                <img src={productImage} alt="ürün" className="h-full w-full object-contain p-3" />
                <button
                  onClick={e => { e.stopPropagation(); setProductImage(null) }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <div className="text-center p-6">
                <ImageIcon size={32} className="mx-auto mb-2" style={{ color: 'var(--border)' }} />
                <p className="text-sm font-medium mb-1">Fotoğraf yükle veya sürükle</p>
                <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>JPG, PNG, WEBP</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f) }} />
        </div>

        {/* Settings */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5">Ürün Adı *</label>
            <input
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="örn: Destina Yemek Masası"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="p-4 rounded-xl text-sm" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <p className="font-medium mb-2 text-xs">Oluşturulacak sahneler:</p>
            <ul className="space-y-1 text-xs" style={{ color: 'var(--muted-fg)' }}>
              <li>• Modern Salon</li>
              <li>• Sıcak Oturma Odası</li>
              <li>• Doğal & Bohem</li>
              <li>• Minimalist</li>
            </ul>
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

      {/* Results */}
      {(loading || mockups.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold mb-4">
            {loading ? 'AI sahneler oluşturuyor...' : `${mockups.filter(m => m.imageUrl).length} mockup hazır`}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)', aspectRatio: '4/3' }}>
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: 'var(--muted-fg)' }}>
                    <Loader2 size={20} className="animate-spin" />
                    <span className="text-xs">Oluşturuluyor...</span>
                  </div>
                </div>
              ))
              : mockups.map(m => (
                <div key={m.label} className="rounded-2xl overflow-hidden relative group" style={{ border: '1px solid var(--border)' }}>
                  {m.imageUrl ? (
                    <>
                      <img src={m.imageUrl} alt={m.label} className="w-full aspect-[4/3] object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2"
                        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
                        <span className="text-white text-xs font-medium">{m.label}</span>
                        <button
                          onClick={() => downloadImage(m.imageUrl!, m.label)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: 'rgba(255,255,255,0.2)' }}
                        >
                          <Download size={11} /> İndir
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full aspect-[4/3] flex flex-col items-center justify-center gap-2 p-4 text-center"
                      style={{ background: 'var(--card)', color: 'var(--muted-fg)' }}>
                      <AlertCircle size={20} style={{ color: '#DC2626' }} />
                      <span className="text-xs font-medium">{m.label}</span>
                      <span className="text-xs">{m.error ?? 'Üretilemedi'}</span>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
