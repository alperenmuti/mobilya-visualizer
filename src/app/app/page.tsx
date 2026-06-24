'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ArrowLeft, Layers, Replace, ArrowRight, Building2, Loader2, Wand2, Trash2 } from 'lucide-react'
import type { Tenant } from '@/lib/types'

export default function AppSelectorPage() {
  const [brand, setBrand] = useState<string | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setBrand(params.get('brand') ?? '')
  }, [])

  useEffect(() => {
    if (brand === null || brand !== '') return
    setTenantsLoading(true)
    fetch('/api/tenants')
      .then(r => r.json())
      .then(d => { setTenants(d.tenants ?? []); setTenantsLoading(false) })
      .catch(() => setTenantsLoading(false))
  }, [brand])

  if (brand === null) return null

  // Brand selected → show mode selector
  if (brand) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
        <header className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <Link href="/app" className="p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Geri">
            <ArrowLeft size={18} style={{ color: 'var(--muted-fg)' }} />
          </Link>
          <span className="font-semibold text-sm">Mobilya Görselleştirici</span>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <h2 className="text-2xl font-bold mb-2 text-center">Ne yapmak istersiniz?</h2>
          <p className="text-sm mb-10 text-center" style={{ color: 'var(--muted-fg)' }}>
            Bir işlev seçin ve başlayın.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            <ModeCard
              href={`/app/place?brand=${brand}`}
              icon={<Layers size={32} style={{ color: 'var(--accent)' }} />}
              title="Mobilya Yerleştir"
              subtitle="Boş odaya"
              description="Boş oda fotoğrafı yükle, mobilya seç, tıkladığın noktaya AI yerleştirsin."
              steps={['Oda fotoğrafı yükle', 'Mobilya seç', 'Nereye koyacağına tıkla', 'AI görüntüsünü oluştur']}
            />
            <ModeCard
              href={`/app/replace?brand=${brand}`}
              icon={<Replace size={32} style={{ color: 'var(--accent)' }} />}
              title="Mobilya Değiştir"
              subtitle="Dolu odada"
              description="Odandaki bir mobilyaya tıkla, listeden yenisini seç — sadece o mobilya değişir."
              steps={['Oda fotoğrafı yükle', 'Değiştirmek istediğine tıkla', 'Yeni mobilyayı seç', 'AI değişikliği uygular']}
            />
            <ModeCard
              href={`/app/design?brand=${brand}`}
              icon={<Wand2 size={32} style={{ color: 'var(--accent)' }} />}
              title="Baştan Dizayn Et"
              subtitle="Stil seç"
              description="Boş oda yükle, 6 farklı tarzdan birini seç — AI odayı baştan döşesin."
              steps={['Boş oda fotoğrafı yükle', 'Dekorasyon stili seç', 'AI odayı tamamen döşer']}
            />
            <ModeCard
              href={`/app/empty?brand=${brand}`}
              icon={<Trash2 size={32} style={{ color: 'var(--accent)' }} />}
              title="Odayı Boşalt"
              subtitle="Eşyaları kaldır"
              description="Dolu odayı yükle — AI tüm mobilya ve eşyaları kaldırır, satışa hazır boş oda gösterir."
              steps={['Dolu oda fotoğrafı yükle', 'AI tüm eşyaları kaldırır', 'Temiz boş oda indir']}
            />
          </div>
        </main>
      </div>
    )
  }

  // No brand → show tenant selection (or fall through to mode selector if no tenants)
  if (!tenantsLoading && tenants.length === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
        <header className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Geri">
            <ArrowLeft size={18} style={{ color: 'var(--muted-fg)' }} />
          </Link>
          <span className="font-semibold text-sm">Mobilya Görselleştirici</span>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <h2 className="text-2xl font-bold mb-2 text-center">Ne yapmak istersiniz?</h2>
          <p className="text-sm mb-10 text-center" style={{ color: 'var(--muted-fg)' }}>
            Bir işlev seçin ve başlayın.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            <ModeCard
              href="/app/place"
              icon={<Layers size={32} style={{ color: 'var(--accent)' }} />}
              title="Mobilya Yerleştir"
              subtitle="Boş odaya"
              description="Boş oda fotoğrafı yükle, mobilya seç, tıkladığın noktaya AI yerleştirsin."
              steps={['Oda fotoğrafı yükle', 'Mobilya seç', 'Nereye koyacağına tıkla', 'AI görüntüsünü oluştur']}
            />
            <ModeCard
              href="/app/replace"
              icon={<Replace size={32} style={{ color: 'var(--accent)' }} />}
              title="Mobilya Değiştir"
              subtitle="Dolu odada"
              description="Odandaki bir mobilyaya tıkla, listeden yenisini seç — sadece o mobilya değişir."
              steps={['Oda fotoğrafı yükle', 'Değiştirmek istediğine tıkla', 'Yeni mobilyayı seç', 'AI değişikliği uygular']}
            />
            <ModeCard
              href="/app/design"
              icon={<Wand2 size={32} style={{ color: 'var(--accent)' }} />}
              title="Baştan Dizayn Et"
              subtitle="Stil seç"
              description="Boş oda yükle, 6 farklı tarzdan birini seç — AI odayı baştan döşesin."
              steps={['Boş oda fotoğrafı yükle', 'Dekorasyon stili seç', 'AI odayı tamamen döşer']}
            />
            <ModeCard
              href="/app/empty"
              icon={<Trash2 size={32} style={{ color: 'var(--accent)' }} />}
              title="Odayı Boşalt"
              subtitle="Eşyaları kaldır"
              description="Dolu odayı yükle — AI tüm mobilya ve eşyaları kaldırır, satışa hazır boş oda gösterir."
              steps={['Dolu oda fotoğrafı yükle', 'AI tüm eşyaları kaldırır', 'Temiz boş oda indir']}
            />
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
        <span className="font-semibold text-sm">Mobilya Görselleştirici</span>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <h2 className="text-2xl font-bold mb-2 text-center">Marka Seçin</h2>
        <p className="text-sm mb-10 text-center" style={{ color: 'var(--muted-fg)' }}>
          Hangi markanın ürünleriyle devam etmek istersiniz?
        </p>
        {tenantsLoading ? (
          <div className="flex items-center gap-2" style={{ color: 'var(--muted-fg)' }}>
            <Loader2 size={16} className="animate-spin" /> Yükleniyor...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-3xl">
            {tenants.map(tenant => (
              <Link
                key={tenant.id}
                href={`/app?brand=${tenant.slug}`}
                className="group flex items-center gap-4 p-5 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F5EFE6' }}>
                  <Building2 size={20} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{tenant.name}</p>
                </div>
                <ArrowRight size={14} className="flex-shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--muted-fg)' }} />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ModeCard({ href, icon, title, subtitle, description, steps }: {
  href: string; icon: React.ReactNode; title: string; subtitle: string
  description: string; steps: string[]
}) {
  return (
    <Link
      href={href}
      className="group block p-6 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="mb-4">{icon}</div>
      <div className="mb-1">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#F5EFE6', color: 'var(--accent-dark)' }}>
          {subtitle}
        </span>
      </div>
      <h3 className="font-bold text-lg mt-2 mb-2">{title}</h3>
      <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--muted-fg)' }}>{description}</p>
      <ol className="space-y-1.5 mb-5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted-fg)' }}>
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: '#F5EFE6', color: 'var(--accent-dark)' }}
            >
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--accent-dark)' }}>
        Başla <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  )
}
