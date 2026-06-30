import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Package, LogOut, Building2, Sparkles } from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  if (!cookieStore.get('admin_session')?.value) redirect('/admin/login')

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col"
        style={{ background: 'var(--card)', borderRight: '1px solid var(--border)' }}
      >
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--accent)' }}>M</div>
            <div>
              <p className="text-xs font-bold">Mobilya Admin</p>
              <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>Süperadmin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavLink href="/admin/dashboard" icon={<LayoutDashboard size={15} />} label="Genel Bakış" />
          <NavLink href="/admin/dashboard/tenants" icon={<Building2 size={15} />} label="İşletmeler" />
          <NavLink href="/admin/dashboard/furniture" icon={<Package size={15} />} label="Mobilya Kataloğu" />
          <NavLink href="/admin/dashboard/mockup" icon={<Sparkles size={15} />} label="Mockup Üret" />
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <Link
            href="/api/admin/logout"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-100 w-full"
            style={{ color: 'var(--muted-fg)' }}
          >
            <LogOut size={14} />
            Çıkış Yap
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-50"
      style={{ color: 'var(--foreground)' }}
    >
      <span style={{ color: 'var(--muted-fg)' }}>{icon}</span>
      {label}
    </Link>
  )
}
