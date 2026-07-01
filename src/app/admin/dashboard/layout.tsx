'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Package, LogOut, Building2 } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Sidebar */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col"
        style={{ background: 'var(--card)', borderRight: '1px solid var(--border)' }}
      >
        {/* Brand area */}
        <div className="px-6 py-7" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              M
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Mobilya AI</p>
              <p className="text-xs" style={{ color: 'var(--muted-fg)' }}>Superadmin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <NavLink
            href="/admin/dashboard"
            icon={<LayoutDashboard size={15} />}
            label="Genel Bakis"
            active={pathname === '/admin/dashboard'}
          />
          <NavLink
            href="/admin/dashboard/tenants"
            icon={<Building2 size={15} />}
            label="Isletmeler"
            active={pathname?.startsWith('/admin/dashboard/tenants') ?? false}
          />
          <NavLink
            href="/admin/dashboard/furniture"
            icon={<Package size={15} />}
            label="Mobilya Katalogu"
            active={pathname?.startsWith('/admin/dashboard/furniture') ?? false}
          />
        </nav>

        {/* Logout */}
        <div className="p-3 mb-2">
          <Link
            href="/api/admin/logout"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors w-full"
            style={{ color: 'var(--muted-fg)' }}
          >
            <LogOut size={14} />
            Cikis Yap
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

function NavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative"
      style={{
        color: active ? 'var(--accent-dark)' : 'var(--foreground)',
        background: active ? 'var(--accent-light)' : 'transparent',
        borderLeft: active ? '4px solid var(--accent)' : '4px solid transparent',
      }}
    >
      <span style={{ color: active ? 'var(--accent)' : 'var(--muted-fg)' }}>{icon}</span>
      {label}
    </Link>
  )
}
