import Link from 'next/link'
import { Package, ExternalLink, Layers, Replace } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Genel Bakış</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted-fg)' }}>Mobilya Görselleştirici yönetim paneli</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <StatCard icon={<Package size={20} style={{ color: 'var(--accent)' }} />} label="Mobilya Kataloğu" value="Yönet" href="/admin/dashboard/furniture" />
        <StatCard icon={<Layers size={20} style={{ color: 'var(--accent)' }} />} label="Yerleştirme Aracı" value="Aç" href="/app/place" external />
        <StatCard icon={<Replace size={20} style={{ color: 'var(--accent)' }} />} label="Değiştirme Aracı" value="Aç" href="/app/replace" external />
      </div>

      <div
        className="p-6 rounded-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-semibold mb-3">Hızlı Başlangıç</h2>
        <ol className="space-y-2">
          {[
            'Mobilya Kataloğu sayfasına gidin',
            'Ürün URL\'si yapıştırın ve "Ürün Bilgisi Getir" butonuna tıklayın',
            'Ad, kategori ve fiyatı kontrol edip kaydedin',
            'Kullanıcılar bu ürünleri uygulamada görebilecek',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: '#F5EFE6', color: 'var(--accent-dark)' }}
              >
                {i + 1}
              </span>
              <span style={{ color: 'var(--muted-fg)' }}>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, href, external }: {
  icon: React.ReactNode; label: string; value: string; href: string; external?: boolean
}) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      className="flex items-center gap-4 p-5 rounded-2xl transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F5EFE6' }}>
        {icon}
      </div>
      <div>
        <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>{label}</p>
        <p className="font-semibold text-sm flex items-center gap-1">
          {value}
          {external && <ExternalLink size={10} style={{ color: 'var(--muted-fg)' }} />}
        </p>
      </div>
    </Link>
  )
}
