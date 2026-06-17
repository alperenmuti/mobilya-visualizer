import Link from 'next/link'
import { ArrowRight, Layers, Replace, Sparkles } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="animate-fade-up">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-6"
            style={{ background: '#F5EFE6', color: 'var(--accent-dark)', border: '1px solid #E8D9C4' }}
          >
            <Sparkles size={12} />
            Yapay Zeka Destekli Tasarım
          </span>

          <h1
            className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight"
            style={{ color: 'var(--foreground)' }}
          >
            Mobilyanızı Satın Almadan<br />
            <span style={{ color: 'var(--accent)' }}>Odanızda Görün</span>
          </h1>

          <p className="text-lg md:text-xl max-w-xl mx-auto mb-10" style={{ color: 'var(--muted-fg)' }}>
            Boş odanıza mobilya ekleyin ya da mevcut mobilyanızın yerine başka birini deneyin.
            Yapay zeka, seçtiğiniz mobilyayı doğru açı, renk ve ışıkla yerleştirir.
          </p>

          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold text-base transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #C4A882, #9A7E5C)', boxShadow: '0 8px 24px rgba(196,168,130,0.35)' }}
          >
            Deneyimi Başlat
            <ArrowRight size={18} />
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-24 max-w-3xl w-full animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <FeatureCard
            icon={<Layers size={24} style={{ color: 'var(--accent)' }} />}
            title="Mobilya Yerleştir"
            description="Boş odanızın fotoğrafını yükleyin, mobilya listesinden seçin ve tıkladığınız noktaya AI yerleştirsin."
          />
          <FeatureCard
            icon={<Replace size={24} style={{ color: 'var(--accent)' }} />}
            title="Mobilya Değiştir"
            description="Dolu odanızdaki bir mobilyaya tıklayın, yerine koymak istediğinizi seçin — AI sadece o mobilyayı değiştirir."
          />
        </div>

        {/* Decorative grid */}
        <div className="mt-20 grid grid-cols-3 gap-3 opacity-40 max-w-xs">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl aspect-square"
              style={{ background: i % 2 === 0 ? '#E8D9C4' : '#F0E8DC', height: 64 }}
            />
          ))}
        </div>
      </main>

      {/* Footer with hidden admin link */}
      <footer className="py-6 text-center">
        <p className="text-xs" style={{ color: '#D0CDC8' }}>
          © 2025 Mobilya Görselleştirici
          {' · '}
          <Link
            href="/admin/login"
            className="hover:underline transition-colors"
            style={{ color: '#D0CDC8' }}
          >
            ·
          </Link>
        </p>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div
      className="p-6 rounded-2xl text-left"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold text-base mb-1.5">{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-fg)' }}>{description}</p>
    </div>
  )
}
