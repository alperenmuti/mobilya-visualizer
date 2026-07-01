'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

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
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Left decorative panel */}
      <div
        className="hidden md:flex md:w-2/5 flex-col justify-between p-12"
        style={{
          background: 'linear-gradient(160deg, #1C1917 0%, #2D2420 100%)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.10)' }}
          >
            M
          </div>
          <span className="text-sm font-semibold tracking-wide text-white opacity-70">
            Mobilya AI
          </span>
        </div>

        {/* Quote */}
        <div>
          <div className="h-px mb-6" style={{ background: 'rgba(255,255,255,0.12)' }} />
          <p
            className="text-white text-xl leading-relaxed mb-4"
            style={{ fontFamily: 'var(--font-playfair, Georgia, serif)', fontStyle: 'italic', opacity: 0.75 }}
          >
            &ldquo;Platformu yönetin, işletmeleri büyütün.&rdquo;
          </p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Süperadmin erişimi
          </p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 md:w-3/5 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h1
            className="text-3xl font-bold mb-2"
            style={{
              color: 'var(--foreground)',
              fontFamily: 'var(--font-playfair, Georgia, serif)',
            }}
          >
            Yönetici Paneli
          </h1>
          <p className="text-sm mb-10" style={{ color: 'var(--muted-fg)' }}>
            Süperadmin paneline erişim sağlayın
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                htmlFor="email"
                style={{ color: 'var(--foreground)' }}
              >
                E-posta
              </label>
              <input
                id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com" required
                className="w-full px-4 py-3 text-sm rounded-xl outline-none transition-colors"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                htmlFor="password"
                style={{ color: 'var(--foreground)' }}
              >
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password" type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full px-4 py-3 pr-11 text-sm rounded-xl outline-none transition-colors"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showPw
                    ? <EyeOff size={14} style={{ color: 'var(--muted-fg)' }} />
                    : <Eye size={14} style={{ color: 'var(--muted-fg)' }} />}
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
              className="w-full py-3.5 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-all"
              style={{
                background: 'linear-gradient(135deg, #1C1917, #2D2420)',
                boxShadow: '0 8px 24px rgba(28,25,23,0.20)',
              }}
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
