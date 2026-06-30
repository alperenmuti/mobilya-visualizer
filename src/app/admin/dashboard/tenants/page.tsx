'use client'
import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, Building2, X, Check, AlertCircle, Copy, Coins, KeyRound } from 'lucide-react'
import type { Tenant } from '@/lib/types'
import { slugify } from '@/lib/utils'
import { getAdminAuthHeaders } from '@/lib/adminAuth'

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
  // Credits management
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({})
  const [creditSaving, setCreditSaving] = useState<string | null>(null)
  const [creditMsg, setCreditMsg] = useState<Record<string, string>>({})
  // Login credentials management
  const [loginOpen, setLoginOpen] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginSaving, setLoginSaving] = useState(false)
  const [loginMsg, setLoginMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/tenants', { headers: getAdminAuthHeaders() })
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
      headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
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
      headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setTenants(prev => prev.filter(t => t.id !== id))
    setDeleteId(null)
  }

  const handleAddCredits = async (tenant: Tenant, action: 'add' | 'set') => {
    const raw = creditInputs[tenant.id] ?? ''
    const amount = parseInt(raw, 10)
    if (!raw || isNaN(amount) || amount < 0) return
    setCreditSaving(tenant.id)
    const res = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
      body: JSON.stringify({ id: tenant.id, amount, action }),
    })
    const data = await res.json()
    if (res.ok) {
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, credits: data.credits } : t))
      setCreditInputs(prev => ({ ...prev, [tenant.id]: '' }))
      setCreditMsg(prev => ({ ...prev, [tenant.id]: `✓ ${data.credits} kontör` }))
      setTimeout(() => setCreditMsg(prev => { const n = { ...prev }; delete n[tenant.id]; return n }), 2500)
    }
    setCreditSaving(null)
  }

  const openLoginEditor = (tenant: Tenant) => {
    setLoginOpen(tenant.id)
    setLoginEmail(tenant.login_email ?? '')
    setLoginPassword('')
    setLoginMsg('')
  }

  const handleSaveLogin = async (tenantId: string) => {
    if (!loginEmail) return
    setLoginSaving(true)
    setLoginMsg('')
    const res = await fetch('/api/admin/tenants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
      body: JSON.stringify({ id: tenantId, login_email: loginEmail, login_password: loginPassword || undefined }),
    })
    const data = await res.json()
    if (res.ok) {
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, login_email: data.tenant.login_email } : t))
      setLoginMsg('✓ Kaydedildi')
      setLoginPassword('')
      if (!loginPassword) setTimeout(() => setLoginOpen(null), 800)
    } else {
      setLoginMsg(data.error ?? 'Hata')
    }
    setLoginSaving(false)
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
                {/* Credits row */}
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: (tenant.credits ?? 0) > 0 ? '#F0FDF4' : '#FEF2F2', color: (tenant.credits ?? 0) > 0 ? '#16A34A' : '#DC2626' }}
                  >
                    <Coins size={10} /> {tenant.credits ?? 0} kontör
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={creditInputs[tenant.id] ?? ''}
                    onChange={e => setCreditInputs(prev => ({ ...prev, [tenant.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddCredits(tenant, 'add')}
                    placeholder="miktar"
                    className="w-20 px-2 py-0.5 text-xs rounded-lg outline-none"
                    style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
                  />
                  <button
                    onClick={() => handleAddCredits(tenant, 'add')}
                    disabled={creditSaving === tenant.id}
                    className="px-2 py-0.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--accent)' }}
                    title="Kontör ekle"
                  >
                    {creditSaving === tenant.id ? <Loader2 size={10} className="animate-spin" /> : '+Ekle'}
                  </button>
                  <button
                    onClick={() => handleAddCredits(tenant, 'set')}
                    disabled={creditSaving === tenant.id}
                    className="px-2 py-0.5 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--muted-fg)' }}
                    title="Belirtilen değere ayarla"
                  >
                    =Ayarla
                  </button>
                  {creditMsg[tenant.id] && (
                    <span className="text-xs font-medium" style={{ color: '#16A34A' }}>{creditMsg[tenant.id]}</span>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-1 flex-shrink-0">
                <button
                  onClick={() => openLoginEditor(tenant)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100"
                  style={{ color: tenant.login_email ? '#16A34A' : 'var(--muted-fg)' }}
                  title="Giriş bilgileri"
                >
                  <KeyRound size={12} /> {tenant.login_email ? 'Giriş Var' : 'Giriş Ekle'}
                </button>
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

              {/* Login credentials editor (inline panel) */}
              {loginOpen === tenant.id && (
                <div
                  className="mt-3 pt-3 w-full"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1"><KeyRound size={11} /> Giriş Bilgileri</p>
                    <button onClick={() => setLoginOpen(null)} style={{ color: 'var(--muted-fg)' }}><X size={13} /></button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="firma@example.com"
                      className="flex-1 min-w-36 px-2 py-1 text-xs rounded-lg outline-none"
                      style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
                    />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder={tenant.login_email ? 'Yeni şifre (boş = değiştirme)' : 'Şifre'}
                      className="flex-1 min-w-36 px-2 py-1 text-xs rounded-lg outline-none"
                      style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
                    />
                    <button
                      onClick={() => handleSaveLogin(tenant.id)}
                      disabled={loginSaving || !loginEmail}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                      style={{ background: 'var(--accent)' }}
                    >
                      {loginSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Kaydet
                    </button>
                    {loginMsg && (
                      <span className="text-xs font-medium" style={{ color: loginMsg.startsWith('✓') ? '#16A34A' : '#DC2626' }}>
                        {loginMsg}
                      </span>
                    )}
                  </div>
                </div>
              )}
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
