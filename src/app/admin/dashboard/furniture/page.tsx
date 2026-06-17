'use client'
import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Link2, Loader2, AlertCircle, Check, X } from 'lucide-react'
import type { FurnitureItem } from '@/lib/types'

interface FormState {
  name: string; image_url: string; product_url: string
  category: string; price: string; description: string
}

const EMPTY: FormState = { name: '', image_url: '', product_url: '', category: '', price: '', description: '' }
const CATEGORIES = ['Koltuk', 'Masa', 'Sandalye', 'Depolama', 'Aydınlatma', 'Tekstil', 'Aksesuar', 'Diğer']

export default function FurnitureCatalogPage() {
  const [items, setItems] = useState<FurnitureItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/furniture')
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleScrape = async () => {
    if (!scrapeUrl) return
    setScraping(true)
    setScrapeError('')
    try {
      const res = await fetch('/api/scrape-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm({
        name: data.name ?? '',
        image_url: data.image_url ?? '',
        product_url: data.product_url ?? scrapeUrl,
        category: '',
        price: data.price ?? '',
        description: data.description ?? '',
      })
      setShowForm(true)
    } catch (err) {
      setScrapeError((err as Error).message)
    }
    setScraping(false)
  }

  const handleSave = async () => {
    if (!form.name || !form.image_url) return
    setSaving(true)
    const res = await fetch('/api/admin/furniture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      setItems(prev => [data.item, ...prev])
      setForm(EMPTY)
      setScrapeUrl('')
      setShowForm(false)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    setDeleteId(id)
    const res = await fetch('/api/admin/furniture', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== id))
    setDeleteId(null)
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-0.5">Mobilya Kataloğu</h1>
          <p className="text-sm" style={{ color: 'var(--muted-fg)' }}>{items.length} ürün</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm(EMPTY); setScrapeUrl('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)' }}
        >
          <Plus size={15} /> Ürün Ekle
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div
          className="mb-6 p-6 rounded-2xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Yeni Ürün Ekle</h2>
            <button onClick={() => setShowForm(false)}><X size={16} style={{ color: 'var(--muted-fg)' }} /></button>
          </div>

          {/* URL Scraper */}
          <div className="mb-5 p-4 rounded-xl" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <label className="block text-xs font-medium mb-2">Ürün URL'sinden Otomatik Getir</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-fg)' }} />
                <input
                  value={scrapeUrl}
                  onChange={e => setScrapeUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScrape()}
                  placeholder="https://mobilyasitesi.com/urun/koltuk"
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                />
              </div>
              <button
                onClick={handleScrape}
                disabled={!scrapeUrl || scraping}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                style={{ background: 'var(--accent-dark)' }}
              >
                {scraping ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                Getir
              </button>
            </div>
            {scrapeError && (
              <p className="mt-2 text-xs flex items-center gap-1" style={{ color: '#DC2626' }}>
                <AlertCircle size={12} />{scrapeError}
              </p>
            )}
          </div>

          {/* Manual form */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ürün Adı *" required>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="" placeholder="Chester Koltuk" />
            </Field>
            <Field label="Kategori">
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="">
                <option value="">Seçin...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Görsel URL *" required className="col-span-2">
              <input value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} className="" placeholder="https://..." />
            </Field>
            <Field label="Ürün Sayfası URL">
              <input value={form.product_url} onChange={e => setForm(p => ({ ...p, product_url: e.target.value }))} className="" placeholder="https://..." />
            </Field>
            <Field label="Fiyat">
              <input value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} className="" placeholder="12.500 ₺" />
            </Field>
          </div>

          {/* Preview */}
          {form.image_url && (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--muted)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.image_url} alt="" className="w-14 h-14 rounded-lg object-cover" />
              <div>
                <p className="font-medium text-sm">{form.name || 'Ürün Adı'}</p>
                {form.category && <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>{form.category}</p>}
                {form.price && <p className="text-xs font-semibold" style={{ color: 'var(--accent-dark)' }}>{form.price}</p>}
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-gray-100" style={{ color: 'var(--muted-fg)' }}>İptal</button>
            <button
              onClick={handleSave}
              disabled={!form.name || !form.image_url || saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)' }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Kaydet
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--muted-fg)' }}>
          Henüz ürün yok. Yukarıdan ekleyin.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--muted)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-fg)' }}>
                  {item.category}{item.category && item.price ? ' · ' : ''}{item.price}
                </p>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                disabled={deleteId === item.id}
                className="p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                style={{ color: '#DC2626' }}
              >
                {deleteId === item.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const fieldInputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 14,
  borderRadius: 10, outline: 'none',
  background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)',
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, { style: fieldInputStyle })
          : child
      )}
    </div>
  )
}
