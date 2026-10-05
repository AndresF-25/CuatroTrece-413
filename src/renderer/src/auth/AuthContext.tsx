import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthStatus, SessionUser } from '../../../shared/types'

interface AuthState {
  loading: boolean
  needsSetup: boolean
  businessName: string
  user: SessionUser | null
  refresh: () => Promise<void>
  login: (username: string, password: string) => Promise<string | null>
  setup: (input: {
    businessName: string
    name: string
    username: string
    password: string
  }) => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus | null>(null)

  const refresh = useCallback(async () => {
    const res = await window.api.auth.status()
    if (res.ok) setStatus(res.data)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Devuelve un mensaje de error, o null si salió bien. */
  const login: AuthState['login'] = async (username, password) => {
    const res = await window.api.auth.login({ username, password })
    if (!res.ok) return res.error
    await refresh()
    return null
  }

  const setup: AuthState['setup'] = async (input) => {
    const res = await window.api.auth.setup(input)
    if (!res.ok) return res.error
    await refresh()
    return null
  }

  const logout = async (): Promise<void> => {
    await window.api.auth.logout()
    await refresh()
  }

  const value: AuthState = {
    loading: status === null,
    needsSetup: status?.needsSetup ?? false,
    businessName: status?.businessName ?? '413',
    user: status?.user ?? null,
    refresh,
    login,
    setup,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
