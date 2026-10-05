import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AuthStatus } from '../../../shared/types'
import { AuthContext, type AuthState } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const res = await window.api.auth.status()
    if (res.ok) setStatus(res.data)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const login = async (username: string, password: string): Promise<string | null> => {
    const res = await window.api.auth.login({ username, password })
    if (!res.ok) return res.error
    await refresh()
    return null
  }

  const setup = async (input: Parameters<AuthState['setup']>[0]): Promise<string | null> => {
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
