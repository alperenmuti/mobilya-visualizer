'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff, AlertCircle, Sofa } from 'lucide-react'

export default function TenantLoginPage() {
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
      const res = await fetch('/api/app/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Giriş başarısız'); setLoading(false); return }
      router.push(`/app?brand=${data.slug}`)
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
            <Sofa size={22} style={{ color: 'var(--accent)' }} />
          </div>
        </div>

        <h1 className="text-xl font-bold text-center mb-1">Hoş Geldiniz</h1>
        <p className="text-sm text-center mb-8" style={{ color: 'var(--muted-fg)' }}>
          Mobilya görselleştirici paneline giriş yapın
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" htmlFor="email">E-posta</label>
            <input
              id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="firma@example.com" required autoFocus
              className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" htmlFor="password">Şifre</label>
            <div className="relative">
              <input
                id="password" type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none pr-10"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
              />
              <button
                type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--muted-fg)' }}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: '#DC2626' }}>
              <AlertCircle size={13} /> {error}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)' }}
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <div className="mt-6 p-3 rounded-xl text-center" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>
            Hesabınız yok mu? Yöneticinizden erişim isteyin.
          </p>
        </div>
      </div>
    </div>
  )
}
