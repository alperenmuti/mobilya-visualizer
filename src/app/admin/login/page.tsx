'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Giriş başarısız'); setLoading(false); return }
      if (data.token) sessionStorage.setItem('admin_token', data.token)
      router.push('/admin/dashboard')
    } catch {
      setError('Bağlantı hatası')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--background)' }}>
      <div
        className="w-full max-w-sm p-8 rounded-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#F5EFE6' }}>
            <Lock size={20} style={{ color: 'var(--accent-dark)' }} />
          </div>
        </div>

        <h1 className="text-xl font-bold text-center mb-1">Yönetici Girişi</h1>
        <p className="text-sm text-center mb-8" style={{ color: 'var(--muted-fg)' }}>Süperadmin paneline erişin</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" htmlFor="email">E-posta</label>
            <input
              id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com" required
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" htmlFor="password">Şifre</label>
            <div className="relative">
              <input
                id="password" type={showPw ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                className="w-full px-3 py-2.5 pr-10 text-sm rounded-xl outline-none"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {showPw ? <EyeOff size={14} style={{ color: 'var(--muted-fg)' }} /> : <Eye size={14} style={{ color: 'var(--muted-fg)' }} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#DC2626' }}>
              <AlertCircle size={14} />{error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)' }}
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
