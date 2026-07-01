'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

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
      if (!res.ok) { setError(data.error ?? 'Giris basarisiz'); setLoading(false); return }
      router.push(`/app?brand=${data.slug}`)
    } catch {
      setError('Baglanti hatasi')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Left decorative panel */}
      <div
        className="hidden md:flex md:w-2/5 flex-col justify-between p-12"
        style={{
          background: 'linear-gradient(160deg, var(--accent-dark) 0%, #5C3D20 100%)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            M
          </div>
          <span className="text-sm font-semibold tracking-wide text-white opacity-90">
            Mobilya AI
          </span>
        </div>

        {/* Quote */}
        <div>
          <div className="h-px mb-6" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <p
            className="text-white text-xl leading-relaxed mb-4"
            style={{ fontFamily: 'var(--font-playfair, Georgia, serif)', fontStyle: 'italic', opacity: 0.9 }}
          >
            &ldquo;Mobilyanizi satin almadan once odanizda gorun.&rdquo;
          </p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Yapay zeka destekli ic tasarim
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
            Hos Geldiniz
          </h1>
          <p className="text-sm mb-10" style={{ color: 'var(--muted-fg)' }}>
            Mobilya gorsellestiric paneline giris yapin
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
                placeholder="firma@example.com" required autoFocus
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
                Sifre
              </label>
              <div className="relative">
                <input
                  id="password" type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full px-4 py-3 text-sm rounded-xl outline-none pr-11 transition-colors"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
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
              className="w-full py-3.5 rounded-full text-sm font-semibold text-white disabled:opacity-60 transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
                boxShadow: '0 8px 24px rgba(184,149,106,0.25)',
              }}
            >
              {loading ? 'Giris yapiliyor...' : 'Giris Yap'}
            </button>
          </form>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs text-center" style={{ color: 'var(--muted-fg)' }}>
              Hesabiniz yok mu? Yoneticinizden erisim isteyin.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
