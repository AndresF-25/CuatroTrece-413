import { useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { MainLayout, NAV, type PageId } from './layouts/MainLayout'
import { LoginPage, SetupPage } from './pages/AuthPages'
import { Card } from './components/ui'

function Router(): React.JSX.Element | null {
  const { loading, needsSetup, user } = useAuth()
  const [page, setPage] = useState<PageId>('dashboard')

  if (loading) return null
  if (needsSetup) return <SetupPage />
  if (!user) return <LoginPage />

  const label = NAV.find((n) => n.id === page)?.label
  return (
    <MainLayout page={page} onNavigate={setPage}>
      <Card>
        <p className="text-slate-500">
          Módulo «{label}»: pendiente de desarrollar en los próximos pasos.
        </p>
      </Card>
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
