'use client'
import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, Building2, X, Check, AlertCircle, Copy } from 'lucide-react'
import type { Tenant } from '@/lib/types'
import { slugify } from '@/lib/utils'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/tenants')
      .then(r => r.json())
      .then(d => { setTenants(d.tenants ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleNameChange = (val: string) => {
    setName(val)
    if (!slugEdited) setSlug(slugify(val))
  }

  const handleOpenForm = () => {
    setName(''); setSlug(''); setSlugEdited(false); setError(''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!name || !slug) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug }),
    })
    const data = await res.json()
    if (res.ok) {
      setTenants(prev => [...prev, data.tenant].sort((a, b) => a.name.localeCompare(b.name)))
      setShowForm(false)
    } else {
      setError(data.error ?? 'Bir hata oluştu')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu işletmeyi silmek istediğinizden emin misiniz? Ürünleri de silinecek.')) return
    setDeleteId(id)
    const res = await fetch('/api/admin/tenants', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setTenants(prev => prev.filter(t => t.id !== id))
    setDeleteId(null)
  }

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/app?brand=${slug}`
    navigator.clipboard.writeText(url)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-0.5">İşletmeler</h1>
          <p className="text-sm" style={{ color: 'var(--muted-fg)' }}>{tenants.length} işletme</p>
        </div>
        <button
          onClick={handleOpenForm}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)' }}
        >
          <Plus size={15} /> Yeni İşletme
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-6 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Yeni İşletme Ekle</h2>
            <button onClick={() => setShowForm(false)}><X size={16} style={{ color: 'var(--muted-fg)' }} /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5">İşletme Adı *</label>
              <input
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="İstikbal"
                autoFocus
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5">URL Kodu (slug)</label>
              <input
                value={slug}
                onChange={e => { setSlug(e.target.value); setSlugEdited(true) }}
                placeholder="istikbal"
                style={inputStyle}
              />
              {slug && (
                <p className="mt-1.5 text-xs font-mono" style={{ color: 'var(--muted-fg)' }}>
                  Müşteri bağlantısı: /app?brand={slug}
                </p>
              )}
            </div>
            {error && (
              <p className="flex items-center gap-1.5 text-xs" style={{ color: '#DC2626' }}>
                <AlertCircle size={12} />{error}
              </p>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl text-sm hover:bg-gray-100 transition-colors"
              style={{ color: 'var(--muted-fg)' }}
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={!name || !slug || saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)' }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Kaydet
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-16">
          <Building2 size={32} className="mx-auto mb-3" style={{ color: 'var(--border)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-fg)' }}>
            Henüz işletme yok. Yukarıdan ekleyin.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-fg)' }}>
            Her işletme kendi ürün kataloğuna sahip olur.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tenants.map(tenant => (
            <div
              key={tenant.id}
              className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#F5EFE6' }}
              >
                <Building2 size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{tenant.name}</p>
                <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--muted-fg)' }}>
                  /app?brand={tenant.slug}
                </p>
              </div>
              <button
                onClick={() => copyLink(tenant.slug)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100"
                style={{ color: copied === tenant.slug ? '#16A34A' : 'var(--muted-fg)' }}
                title="Müşteri bağlantısını kopyala"
              >
                {copied === tenant.slug ? <Check size={12} /> : <Copy size={12} />}
                {copied === tenant.slug ? 'Kopyalandı' : 'Bağlantı'}
              </button>
              <button
                onClick={() => handleDelete(tenant.id)}
                disabled={deleteId === tenant.id}
                className="p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                style={{ color: '#DC2626' }}
              >
                {deleteId === tenant.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs" style={{ color: 'var(--muted-fg)' }}>
        Her işletmeye ait ürünler yalnızca o işletmenin bağlantısında görünür.
        Ürünleri eklemek için Mobilya Kataloğu sayfasına gidin.
      </p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 14,
  borderRadius: 10, outline: 'none',
  background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--foreground)',
}
