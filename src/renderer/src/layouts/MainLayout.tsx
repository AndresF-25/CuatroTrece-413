import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { clsx } from 'clsx'
import logoLight from '../assets/logo-light.png'
import { useAuth } from '../auth/useAuth'
import { NAV, type PageId } from './nav'

export function MainLayout({
  page,
  onNavigate,
  children
}: {
  page: PageId
  onNavigate: (page: PageId) => void
  children: ReactNode
}): React.JSX.Element {
  const { user, businessName, logout } = useAuth()

  return (
    <div className="flex h-screen">
      <aside className="flex w-56 shrink-0 flex-col bg-slate-900 text-slate-200">
        <div className="flex justify-center px-5 py-5">
          <img src={logoLight} alt={businessName} title={businessName} className="h-28 w-auto" draggable={false} />
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                page === id ? 'bg-slate-700 text-white' : 'hover:bg-slate-800'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <h2 className="text-lg font-semibold">{NAV.find((n) => n.id === page)?.label}</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {user?.name} · {user?.role === 'ADMIN' ? 'Administrador' : 'Vendedor'}
            </span>
            <button
              onClick={() => void logout()}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
