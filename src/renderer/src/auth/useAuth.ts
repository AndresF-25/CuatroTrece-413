import { createContext, useContext } from 'react'
import type { SessionUser } from '../../../shared/types'

export interface AuthState {
  loading: boolean
  needsSetup: boolean
  businessName: string
  user: SessionUser | null
  refresh: () => Promise<void>
  /** Devuelve un mensaje de error, o null si salió bien. */
  login: (username: string, password: string) => Promise<string | null>
  setup: (input: {
    businessName: string
    name: string
    username: string
    password: string
  }) => Promise<string | null>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
