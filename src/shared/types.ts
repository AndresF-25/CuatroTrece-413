// Tipos compartidos entre main, preload y renderer.

export type Role = 'ADMIN' | 'SELLER'

export interface SessionUser {
  id: number
  name: string
  username: string
  role: Role
}

export interface AuthStatus {
  needsSetup: boolean
  businessName: string
  user: SessionUser | null
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }
