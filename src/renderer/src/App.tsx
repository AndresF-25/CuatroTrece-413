import { useState } from 'react'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import { MainLayout } from './layouts/MainLayout'
import { NAV, type PageId } from './layouts/nav'
import { LoginPage, SetupPage } from './pages/AuthPages'
import { Card } from './components/ui'
import { InventoryPage } from './pages/InventoryPage'
import { ProductsPage } from './pages/ProductsPage'
import { PurchasesPage } from './pages/PurchasesPage'
import { SettingsPage } from './pages/SettingsPage'

function Router(): React.JSX.Element | null {
  const { loading, needsSetup, user } = useAuth()
  const [page, setPage] = useState<PageId>('dashboard')

  if (loading) return null
  if (needsSetup) return <SetupPage />
  if (!user) return <LoginPage />

  const label = NAV.find((n) => n.id === page)?.label
  return (
    <MainLayout page={page} onNavigate={setPage}>
      {page === 'products' ? (
        <ProductsPage />
      ) : page === 'purchases' ? (
        <PurchasesPage />
      ) : page === 'inventory' ? (
        <InventoryPage />
      ) : page === 'settings' ? (
        <SettingsPage />
      ) : (
        <Card>
          <p className="text-slate-500">
            Módulo «{label}»: pendiente de desarrollar en los próximos pasos.
          </p>
        </Card>
      )}
    </MainLayout>
  )
}

function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  )
}

export default App
