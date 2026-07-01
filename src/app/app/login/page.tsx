'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'

/* ─── SVG Room Illustrations ─────────────────────────────────────── */

function EmptyRoom() {
  return (
    <svg viewBox="0 0 260 175" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: '100%' }}>
      {/* Wall */}
      <rect width="260" height="175" fill="#F5EDE0" />
      {/* Floor */}
      <rect y="124" width="260" height="51" fill="#E8DEC8" />
      <line x1="0" y1="124" x2="260" y2="124" stroke="#D8CEB8" strokeWidth="1" />
      {/* Baseboard */}
      <rect y="121" width="260" height="3" fill="#E0D4BC" />
      {/* Window */}
      <rect x="88" y="18" width="84" height="62" rx="2" fill="#C8DEE8" />
      <rect x="88" y="18" width="84" height="62" rx="2" fill="none" stroke="#C4B8A4" strokeWidth="2" />
      <line x1="130" y1="18" x2="130" y2="80" stroke="#C4B8A4" strokeWidth="1.5" />
      <line x1="88" y1="49" x2="172" y2="49" stroke="#C4B8A4" strokeWidth="1.5" />
      {/* Window light on floor */}
      <rect x="106" y="124" width="48" height="40" fill="#EFE4CC" opacity="0.45" />
      {/* Corner shadow left */}
      <rect width="18" height="175" fill="rgba(0,0,0,0.04)" />
      {/* Corner shadow right */}
      <rect x="242" width="18" height="175" fill="rgba(0,0,0,0.04)" />
    </svg>
  )
}

function SemiRoom() {
  return (
    <svg viewBox="0 0 260 175" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: '100%' }}>
      {/* Wall */}
      <rect width="260" height="175" fill="#F5EDE0" />
      {/* Floor */}
      <rect y="124" width="260" height="51" fill="#E8DEC8" />
      <line x1="0" y1="124" x2="260" y2="124" stroke="#D8CEB8" strokeWidth="1" />
      <rect y="121" width="260" height="3" fill="#E0D4BC" />
      {/* Window */}
      <rect x="88" y="18" width="84" height="62" rx="2" fill="#C8DEE8" />
      <rect x="88" y="18" width="84" height="62" rx="2" fill="none" stroke="#C4B8A4" strokeWidth="2" />
      <line x1="130" y1="18" x2="130" y2="80" stroke="#C4B8A4" strokeWidth="1.5" />
      <line x1="88" y1="49" x2="172" y2="49" stroke="#C4B8A4" strokeWidth="1.5" />
      <rect x="106" y="124" width="48" height="40" fill="#EFE4CC" opacity="0.45" />
      <rect width="18" height="175" fill="rgba(0,0,0,0.04)" />
      <rect x="242" width="18" height="175" fill="rgba(0,0,0,0.04)" />
      {/* Rug */}
      <ellipse cx="130" cy="138" rx="72" ry="10" fill="#C8A870" opacity="0.30" />
      {/* Sofa back */}
      <rect x="48" y="80" width="140" height="22" rx="5" fill="#9A7A52" />
      {/* Sofa seat */}
      <rect x="48" y="96" width="140" height="32" rx="5" fill="#875E3A" />
      {/* Sofa arm left */}
      <rect x="48" y="80" width="14" height="48" rx="4" fill="#9A7A52" />
      {/* Sofa arm right */}
      <rect x="174" y="80" width="14" height="48" rx="4" fill="#9A7A52" />
      {/* Sofa legs */}
      <rect x="58" y="125" width="8" height="9" rx="1" fill="#5C3A1E" />
      <rect x="175" y="125" width="8" height="9" rx="1" fill="#5C3A1E" />
      {/* Cushions */}
      <rect x="64" y="99" width="34" height="22" rx="4" fill="#A07848" />
      <rect x="103" y="99" width="34" height="22" rx="4" fill="#A07848" />
      <rect x="142" y="99" width="28" height="22" rx="4" fill="#9A7040" />
      {/* Throw */}
      <rect x="68" y="84" width="18" height="14" rx="3" fill="#C4A882" />
    </svg>
  )
}

function FurnishedRoom() {
  return (
    <svg viewBox="0 0 260 175" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', width: '100%', height: '100%' }}>
      {/* Wall */}
      <rect width="260" height="175" fill="#F5EDE0" />
      {/* Floor */}
      <rect y="124" width="260" height="51" fill="#E8DEC8" />
      <line x1="0" y1="124" x2="260" y2="124" stroke="#D8CEB8" strokeWidth="1" />
      <rect y="121" width="260" height="3" fill="#E0D4BC" />
      {/* Window */}
      <rect x="88" y="18" width="84" height="62" rx="2" fill="#C8DEE8" />
      <rect x="88" y="18" width="84" height="62" rx="2" fill="none" stroke="#C4B8A4" strokeWidth="2" />
      <line x1="130" y1="18" x2="130" y2="80" stroke="#C4B8A4" strokeWidth="1.5" />
      <line x1="88" y1="49" x2="172" y2="49" stroke="#C4B8A4" strokeWidth="1.5" />
      <rect x="106" y="124" width="48" height="40" fill="#EFE4CC" opacity="0.45" />
      <rect width="18" height="175" fill="rgba(0,0,0,0.04)" />
      <rect x="242" width="18" height="175" fill="rgba(0,0,0,0.04)" />
      {/* Wall art */}
      <rect x="182" y="22" width="44" height="32" rx="3" fill="white" opacity="0.8" />
      <rect x="185" y="25" width="38" height="26" rx="2" fill="#E8D4B8" opacity="0.6" />
      <ellipse cx="204" cy="38" rx="10" ry="7" fill="#C4A882" opacity="0.5" />
      {/* Small shelf bracket left */}
      <rect x="22" y="48" width="36" height="4" rx="2" fill="#C4B4A0" />
      <rect x="30" y="52" width="4" height="12" rx="1" fill="#C4B4A0" />
      {/* Vase on shelf */}
      <rect x="26" y="36" width="10" height="12" rx="3" fill="#9A8060" />
      <ellipse cx="31" cy="36" rx="7" ry="3" fill="#8A7050" />
      <line x1="31" y1="33" x2="28" y2="26" stroke="#5A7840" strokeWidth="1.5" />
      <line x1="31" y1="33" x2="31" y2="24" stroke="#4A6830" strokeWidth="1.5" />
      <line x1="31" y1="33" x2="34" y2="26" stroke="#5A7840" strokeWidth="1.5" />
      <ellipse cx="28" cy="26" rx="4" ry="5" fill="#6A9050" />
      <ellipse cx="31" cy="23" rx="4" ry="5" fill="#7AA060" />
      <ellipse cx="34" cy="25" rx="3.5" ry="4.5" fill="#5A8040" />
      {/* Rug */}
      <ellipse cx="130" cy="138" rx="78" ry="10" fill="#C8A870" opacity="0.32" />
      {/* Rug pattern lines */}
      <ellipse cx="130" cy="138" rx="60" ry="7" fill="none" stroke="#B89860" strokeWidth="0.8" opacity="0.4" />
      {/* Sofa back */}
      <rect x="48" y="80" width="140" height="22" rx="5" fill="#9A7A52" />
      {/* Sofa seat */}
      <rect x="48" y="96" width="140" height="32" rx="5" fill="#875E3A" />
      {/* Sofa arm left */}
      <rect x="48" y="80" width="14" height="48" rx="4" fill="#9A7A52" />
      {/* Sofa arm right */}
      <rect x="174" y="80" width="14" height="48" rx="4" fill="#9A7A52" />
      {/* Sofa legs */}
      <rect x="58" y="125" width="8" height="9" rx="1" fill="#5C3A1E" />
      <rect x="175" y="125" width="8" height="9" rx="1" fill="#5C3A1E" />
      {/* Cushions */}
      <rect x="64" y="99" width="34" height="22" rx="4" fill="#A07848" />
      <rect x="103" y="99" width="34" height="22" rx="4" fill="#A07848" />
      <rect x="142" y="99" width="28" height="22" rx="4" fill="#9A7040" />
      {/* Throw */}
      <rect x="68" y="84" width="18" height="14" rx="3" fill="#C4A882" />
      {/* Coffee table top */}
      <rect x="90" y="123" width="80" height="5" rx="2" fill="#6B4A28" />
      {/* Coffee table legs */}
      <rect x="96" y="128" width="4" height="8" rx="1" fill="#5C3A1E" />
      <rect x="160" y="128" width="4" height="8" rx="1" fill="#5C3A1E" />
      {/* Book on table */}
      <rect x="107" y="118" width="26" height="5" rx="1" fill="#8B9B7E" />
      <rect x="109" y="116" width="22" height="2" rx="1" fill="#7A8A6E" />
      {/* Floor lamp */}
      <rect x="226" y="36" width="3" height="90" fill="#7A5A38" />
      <rect x="219" y="34" width="17" height="3" rx="1" fill="#7A5A38" />
      <polygon points="219,35 236,35 233,22 222,22" fill="#F0E4C8" />
      <ellipse cx="227" cy="22" rx="5" ry="3" fill="#E8D4A0" />
      {/* Lamp glow on wall */}
      <ellipse cx="227" cy="28" rx="22" ry="16" fill="#FFEAA0" opacity="0.10" />
      {/* Plant pot left */}
      <rect x="20" y="106" width="18" height="18" rx="3" fill="#8B6B42" />
      <rect x="16" y="104" width="26" height="4" rx="2" fill="#9A7848" />
      <ellipse cx="29" cy="100" rx="16" ry="13" fill="#4A7040" opacity="0.9" />
      <ellipse cx="20" cy="106" rx="10" ry="9" fill="#5A8050" opacity="0.85" />
      <ellipse cx="38" cy="104" rx="11" ry="9" fill="#3D6038" opacity="0.85" />
      <ellipse cx="29" cy="95" rx="9" ry="8" fill="#5A8848" opacity="0.9" />
    </svg>
  )
}

/* ─── Animated Room Slideshow ─────────────────────────────────────── */

const BADGE: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  background: 'rgba(255,255,255,0.88)',
  color: '#6B4A28',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  padding: '3px 9px',
  borderRadius: 20,
}

function RoomShowcase() {
  const card: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 16px 48px rgba(0,0,0,0.30)',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%', padding: '12px 0' }}>
      <style>{`
        @keyframes rc1 {
          0%, 30%  { opacity: 1; }
          37%, 93% { opacity: 0; }
          100%     { opacity: 1; }
        }
        @keyframes rc2 {
          0%, 30%  { opacity: 0; }
          37%, 63% { opacity: 1; }
          70%, 100%{ opacity: 0; }
        }
        @keyframes rc3 {
          0%, 63%  { opacity: 0; }
          70%, 93% { opacity: 1; }
          100%     { opacity: 0; }
        }
        @keyframes dot1 {
          0%, 30%  { opacity:1; width:18px; }
          37%, 100%{ opacity:.35; width:6px; }
        }
        @keyframes dot2 {
          0%, 30%  { opacity:.35; width:6px; }
          37%, 63% { opacity:1; width:18px; }
          70%, 100%{ opacity:.35; width:6px; }
        }
        @keyframes dot3 {
          0%, 63%  { opacity:.35; width:6px; }
          70%, 93% { opacity:1; width:18px; }
          100%     { opacity:.35; width:6px; }
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: 280 }}>
        {/* Card container */}
        <div style={{ position: 'relative', width: '100%', paddingBottom: '67%' /* 3:2 aspect */ }}>
          <div style={{ position: 'absolute', inset: 0 }}>

            {/* Scene 1 — Empty room */}
            <div style={{ ...card, zIndex: 2, animation: 'rc1 9s linear infinite' }}>
              <EmptyRoom />
              <span style={BADGE}>Önce</span>
            </div>

            {/* Scene 2 — Sofa added */}
            <div style={{ ...card, zIndex: 1, opacity: 0, animation: 'rc2 9s linear infinite' }}>
              <SemiRoom />
              <span style={BADGE}>İşlemde</span>
            </div>

            {/* Scene 3 — Fully furnished */}
            <div style={{ ...card, zIndex: 0, opacity: 0, animation: 'rc3 9s linear infinite' }}>
              <FurnishedRoom />
              <span style={BADGE}>Sonra</span>
            </div>

          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, justifyContent: 'center' }}>
          {[
            { anim: 'dot1 9s linear infinite', label: 'Boş oda' },
            { anim: 'dot2 9s linear infinite', label: 'Mobilya ekleniyor' },
            { anim: 'dot3 9s linear infinite', label: 'Döşenmiş' },
          ].map(({ anim, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.75)',
                animation: anim,
              }} />
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────── */

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
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>

      {/* Left decorative panel */}
      <div
        className="hidden md:flex md:w-2/5 flex-col py-10 px-10"
        style={{ background: 'linear-gradient(160deg, var(--accent-dark) 0%, #5C3D20 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
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

        {/* Room slideshow — fills remaining space */}
        <RoomShowcase />

        {/* Quote at bottom */}
        <div className="flex-shrink-0">
          <div className="h-px mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <p
            className="text-white leading-relaxed mb-2"
            style={{ fontFamily: 'var(--font-playfair, Georgia, serif)', fontStyle: 'italic', opacity: 0.85, fontSize: 16 }}
          >
            &ldquo;Mobilyanızı satın almadan önce odanızda görün.&rdquo;
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>
            Yapay zeka destekli iç tasarım
          </p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 md:w-3/5 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: 'var(--foreground)', fontFamily: 'var(--font-playfair, Georgia, serif)' }}
          >
            Hoş Geldiniz
          </h1>
          <p className="text-sm mb-10" style={{ color: 'var(--muted-fg)' }}>
            Mobilya Görselleştirici paneline giriş yapın
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
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
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
                  id="password" type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full px-4 py-3 text-sm rounded-xl outline-none pr-11 transition-colors"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
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
              <p className="flex items-center gap-2 text-xs py-3 px-4 rounded-xl" style={{ background: '#FEF2F2', color: '#DC2626' }}>
                <AlertCircle size={13} className="flex-shrink-0" /> {error}
              </p>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-3.5 rounded-full text-sm font-semibold text-white disabled:opacity-60 transition-all hover:opacity-90 mt-2"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
                boxShadow: '0 8px 24px rgba(184,149,106,0.25)',
              }}
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs text-center" style={{ color: 'var(--muted-fg)' }}>
              Hesabınız yok mu? Yöneticinizden erişim isteyin.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
