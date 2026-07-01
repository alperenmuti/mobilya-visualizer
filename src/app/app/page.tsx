'use client'
import Link from 'next/link'
import { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Replace, ArrowRight, Building2, Loader2, Wand2, Trash2, Sparkles, Sofa, LogOut } from 'lucide-react'
import CreditBadge from '@/components/CreditBadge'
import type { Tenant } from '@/lib/types'

function AppSelectorContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const brand = searchParams.get('brand') ?? ''

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  // Check session cookie — if no brand in URL but session exists, redirect
  useEffect(() => {
    if (brand) return
    fetch('/api/app/me')
      .then(r => r.json())
      .then(d => {
        if (d.tenant?.slug) router.replace(`/app?brand=${d.tenant.slug}`)
      })
      .catch(() => {})
  }, [brand, router])

  // Track if logged in via cookie (for logout button)
  useEffect(() => {
    if (!brand) return
    fetch('/api/app/me')
      .then(r => r.json())
      .then(d => { if (d.tenant?.slug === brand) setLoggedIn(true) })
      .catch(() => {})
  }, [brand])

  const handleLogout = async () => {
    await fetch('/api/app/login', { method: 'DELETE' })
    setLoggedIn(false)
    router.push('/app/login')
  }

  useEffect(() => {
    if (brand !== '') return
    setTenantsLoading(true)
    fetch('/api/tenants')
      .then(r => r.json())
      .then(d => { setTenants(d.tenants ?? []); setTenantsLoading(false) })
      .catch(() => setTenantsLoading(false))
  }, [brand])

  // Brand selected -> show mode selector
  if (brand) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
        <header className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <Link href="/app" className="p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Geri">
            <ArrowLeft size={18} style={{ color: 'var(--muted-fg)' }} />
          </Link>
          <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Mobilya Görselleştirici</span>
          <div className="ml-auto flex items-center gap-2">
            <CreditBadge brand={brand} />
            {loggedIn && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
                style={{ color: 'var(--muted-fg)' }}
              >
                <LogOut size={13} /> Çıkış
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <h2
            className="text-3xl font-bold mb-2 text-center"
            style={{ fontFamily: 'var(--font-playfair, Georgia, serif)', color: 'var(--foreground)' }}
          >
            Ne yapmak istersiniz?
          </h2>
          <p className="text-sm mb-12 text-center" style={{ color: 'var(--muted-fg)' }}>
            Bir işlev seçin ve başlayın.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-4xl">
            <ModeCard
              href={`/app/furnish?brand=${brand}`}
              icon={<Sofa size={28} style={{ color: 'var(--accent)' }} />}
              title="Odamı Sen Yap"
              subtitle="AI ile döşe"
              description="Boş odanı yükle, istediğin mobilyaları seç — AI hepsini iç mimar gibi yerleştirsin."
            />
            <ModeCard
              href={`/app/replace?brand=${brand}`}
              icon={<Replace size={28} style={{ color: 'var(--accent)' }} />}
              title="Mobilya Değiştir"
              subtitle="Dolu odada"
              description="Odandaki bir mobilyaya tıkla, listeden yenisini seç — sadece o mobilya değişir."
            />
            <ModeCard
              href={`/app/design?brand=${brand}`}
              icon={<Wand2 size={28} style={{ color: 'var(--accent)' }} />}
              title="Baştan Dizayn Et"
              subtitle="Stil seç"
              description="Boş oda yükle, 6 farklı tarzdan birini seç — AI odayı baştan döşer."
            />
            <ModeCard
              href={`/app/empty?brand=${brand}`}
              icon={<Trash2 size={28} style={{ color: 'var(--accent)' }} />}
              title="Odayı Boşalt"
              subtitle="Eşyaları kaldır"
              description="Dolu odayı yükle — AI tüm mobilya ve eşyaları kaldırır, satışa hazır boş oda gösterir."
            />
            <ModeCard
              href={`/app/mockup?brand=${brand}`}
              icon={<Sparkles size={28} style={{ color: 'var(--accent)' }} />}
              title="Mockup Oluştur"
              subtitle="Yaşam stili görseli"
              description="Ürün fotoğrafını yükle — AI 4 farklı oda ortamında yaşam stili mockup görseli oluşturur."
            />
          </div>
        </main>
      </div>
    )
  }

  // No brand -> show tenant selection (or fall through to mode selector if no tenants)
  if (!tenantsLoading && tenants.length === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
        <header className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Geri">
            <ArrowLeft size={18} style={{ color: 'var(--muted-fg)' }} />
          </Link>
          <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Mobilya Görselleştirici</span>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <h2
            className="text-3xl font-bold mb-2 text-center"
            style={{ fontFamily: 'var(--font-playfair, Georgia, serif)', color: 'var(--foreground)' }}
          >
            Ne yapmak istersiniz?
          </h2>
          <p className="text-sm mb-12 text-center" style={{ color: 'var(--muted-fg)' }}>
            Bir işlev seçin ve başlayın.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-4xl">
            <ModeCard href="/app/furnish" icon={<Sofa size={28} style={{ color: 'var(--accent)' }} />} title="Odamı Sen Yap" subtitle="AI ile döşe" description="Boş odanı yükle, istediğin mobilyaları seç — AI hepsini iç mimar gibi yerleştirsin." />
            <ModeCard href="/app/replace" icon={<Replace size={28} style={{ color: 'var(--accent)' }} />} title="Mobilya Değiştir" subtitle="Dolu odada" description="Odandaki bir mobilyaya tıkla, listeden yenisini seç — sadece o mobilya değişir." />
            <ModeCard href="/app/design" icon={<Wand2 size={28} style={{ color: 'var(--accent)' }} />} title="Baştan Dizayn Et" subtitle="Stil seç" description="Boş oda yükle, 6 farklı tarzdan birini seç — AI odayı baştan döşer." />
            <ModeCard href="/app/empty" icon={<Trash2 size={28} style={{ color: 'var(--accent)' }} />} title="Odayı Boşalt" subtitle="Eşyaları kaldır" description="Dolu odayı yükle — AI tüm mobilya ve eşyaları kaldırır, satışa hazır boş oda gösterir." />
            <ModeCard href="/app/mockup" icon={<Sparkles size={28} style={{ color: 'var(--accent)' }} />} title="Mockup Oluştur" subtitle="Yaşam stili görseli" description="Ürün fotoğrafını yükle — AI 4 farklı oda ortamında yaşam stili mockup görseli oluşturur." />
          </div>
        </main>
      </div>
    )
  }

  // Show brand/tenant selection
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <header className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
        <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Geri">
          <ArrowLeft size={18} style={{ color: 'var(--muted-fg)' }} />
        </Link>
        <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Mobilya Görselleştirici</span>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <h2
          className="text-3xl font-bold mb-2 text-center"
          style={{ fontFamily: 'var(--font-playfair, Georgia, serif)', color: 'var(--foreground)' }}
        >
          Marka Secin
        </h2>
        <p className="text-sm mb-10 text-center" style={{ color: 'var(--muted-fg)' }}>
          Hangi markanin urunleriyle devam etmek istersiniz?
        </p>
        {tenantsLoading ? (
          <div className="flex items-center gap-2" style={{ color: 'var(--muted-fg)' }}>
            <Loader2 size={16} className="animate-spin" /> Yukleniyor...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-3xl">
            {tenants.map(tenant => (
              <a
                key={tenant.id}
                href={`/app?brand=${tenant.slug}`}
                className="group flex items-center gap-4 p-5 rounded-2xl transition-all hover:-translate-y-0.5"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-light)' }}>
                  <Building2 size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>{tenant.name}</p>
                </div>
                <ArrowRight size={14} className="flex-shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--muted-fg)' }} />
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default function AppSelectorPage() {
  return (
    <Suspense fallback={null}>
      <AppSelectorContent />
    </Suspense>
  )
}

function ModeCard({ href, icon, title, subtitle, description }: {
  href: string; icon: React.ReactNode; title: string; subtitle: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group block p-7 rounded-2xl transition-all hover:-translate-y-1"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="mb-5">{icon}</div>
      <div className="mb-1">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: 'var(--accent-light)', color: 'var(--accent-dark)' }}
        >
          {subtitle}
        </span>
      </div>
      <h3
        className="font-semibold text-lg mt-3 mb-2"
        style={{ color: 'var(--foreground)', fontFamily: 'var(--font-playfair, Georgia, serif)' }}
      >
        {title}
      </h3>
      <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--muted-fg)' }}>{description}</p>
      <div className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--accent-dark)' }}>
        Basla <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  )
}
