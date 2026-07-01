import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
            style={{ background: 'var(--accent)' }}
          >
            M
          </div>
          <span className="text-sm font-semibold tracking-wide" style={{ color: 'var(--foreground)' }}>
            Mobilya AI
          </span>
        </div>
        <Link
          href="/admin/login"
          className="text-base transition-colors"
          style={{ color: 'var(--border-mid)' }}
          aria-label="Yönetici girişi"
        >
          ·
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="animate-fade-up">
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px w-12 flex-shrink-0" style={{ background: 'var(--border-mid)' }} />
            <span
              className="text-xs font-medium tracking-widest uppercase"
              style={{ color: 'var(--muted-fg)' }}
            >
              Yapay Zeka Destekli Tasarım
            </span>
            <div className="h-px w-12 flex-shrink-0" style={{ background: 'var(--border-mid)' }} />
          </div>

          <h1
            className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight"
            style={{ color: 'var(--foreground)', fontFamily: 'var(--font-playfair, Georgia, serif)' }}
          >
            Mobilyanızı Satın Almadan
            <br />
            <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Odanızda Görün</span>
          </h1>

          <p
            className="text-lg md:text-xl max-w-lg mx-auto mb-12 leading-relaxed"
            style={{ color: 'var(--muted-fg)' }}
          >
            Boş odanıza mobilya ekleyin ya da mevcut mobilyanızın yerine başkasını deneyin.
            Yapay zeka seçtiğiniz mobilyayı doğru açı, renk ve ışıkla yerleştirir.
          </p>

          <Link
            href="/app/login"
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-white font-semibold text-sm tracking-wide transition-all hover:opacity-90 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
              boxShadow: '0 8px 24px rgba(184,149,106,0.30)',
            }}
          >
            Deneyimi Başlat
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Feature strip — 3 numbered panels */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 mt-28 w-full max-w-4xl animate-fade-up"
          style={{ animationDelay: '0.15s', borderTop: '1px solid var(--border)' }}
        >
          <FeaturePanel
            number="01"
            title="Mobilya Yerleştir"
            description="Boş odanızın fotoğrafını yükleyin, mobilya listesinden seçin ve AI işinizi yapsın."
          />
          <FeaturePanel
            number="02"
            title="Mobilya Değiştir"
            description="Dolu odadaki bir mobilyaya tıklayın, yerine koymak istediğinizi seçin — AI sadece onu değiştirir."
            bordered
          />
          <FeaturePanel
            number="03"
            title="Baştan Dizayn Et"
            description="Boş odanızı yükleyin, 6 farklı dekorasyon stilinden birini seçin — AI odayı başından döşer."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between px-8 py-6" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>
          &copy; 2025 Mobilya AI
        </p>
        <Link href="/app/login" className="text-xs hover:underline transition-colors" style={{ color: 'var(--muted-fg)' }}>
          Giriş
        </Link>
      </footer>
    </div>
  )
}

function FeaturePanel({
  number,
  title,
  description,
  bordered,
}: {
  number: string
  title: string
  description: string
  bordered?: boolean
}) {
  return (
    <div
      className="p-8 text-left"
      style={{
        borderLeft: bordered ? '1px solid var(--border)' : undefined,
        borderRight: bordered ? '1px solid var(--border)' : undefined,
      }}
    >
      <span
        className="block text-xs font-medium tracking-widest mb-5"
        style={{ color: 'var(--accent)' }}
      >
        {number}
      </span>
      <h3
        className="text-lg font-semibold mb-3"
        style={{ color: 'var(--foreground)', fontFamily: 'var(--font-playfair, Georgia, serif)' }}
      >
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-fg)' }}>
        {description}
      </p>
    </div>
  )
}
