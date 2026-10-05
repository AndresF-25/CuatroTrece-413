import { ipcMain } from 'electron'
import { z } from 'zod'
import { AppError, translateDbError } from '../lib/errors'
import type { ApiResult, Role, SessionUser } from '../../shared/types'

let currentUser: SessionUser | null = null

export const session = {
  get: (): SessionUser | null => currentUser,
  set: (user: SessionUser | null): void => {
    currentUser = user
  }
}

export interface HandlerOptions {
  /** 'public' = sin sesión; lista de roles = requiere sesión con uno de esos roles. */
  access: 'public' | Role[]
}

/**
 * Registra un canal IPC: valida la entrada con zod, verifica sesión y rol en el
 * proceso main (nunca se confía en el renderer) y envuelve el resultado.
 */
export function handle<S extends z.ZodType, R>(
  channel: string,
  schema: S,
  options: HandlerOptions,
  fn: (input: z.infer<S>, user: SessionUser | null) => R
): void {
  ipcMain.handle(channel, async (_event, raw: unknown): Promise<ApiResult<Awaited<R>>> => {
    try {
      const user = session.get()
      if (options.access !== 'public') {
        if (!user) throw new AppError('Debes iniciar sesión')
        if (!options.access.includes(user.role)) {
          throw new AppError('No tienes permiso para esta acción')
        }
      }
      const input = schema.parse(raw)
      return { ok: true, data: await fn(input, user) }
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message }
      const dbError = translateDbError(error)
      if (dbError) return { ok: false, error: dbError.message }
      if (error instanceof z.ZodError) {
        return { ok: false, error: error.issues[0]?.message ?? 'Datos inválidos' }
      }
      console.error(`[ipc:${channel}]`, error)
      return { ok: false, error: 'Ocurrió un error inesperado' }
    }
  })
}
