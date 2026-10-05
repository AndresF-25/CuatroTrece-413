import { z } from 'zod'
import { getDb } from '../db/instance'
import * as auth from '../services/auth.service'
import { handle, session } from './handler'
import type { AuthStatus } from '../../shared/types'

const setupSchema = z.object({
  businessName: z.string().trim().min(1, 'El nombre del negocio es obligatorio'),
  name: z.string().trim().min(1, 'Tu nombre es obligatorio'),
  username: z.string().trim().min(3, 'El usuario debe tener al menos 3 caracteres'),
  password: z.string().min(auth.MIN_PASSWORD_LENGTH, 'La contraseña es muy corta')
})

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Escribe tu usuario'),
  password: z.string().min(1, 'Escribe tu contraseña')
})

export function registerAuthIpc(): void {
  handle('auth:status', z.undefined(), { access: 'public' }, (): AuthStatus => {
    const { db } = getDb()
    return {
      needsSetup: auth.needsSetup(db),
      businessName: auth.getBusinessName(db),
      user: session.get()
    }
  })

  handle('auth:setup', setupSchema, { access: 'public' }, (input) => {
    const user = auth.createAdmin(getDb().db, input)
    session.set(user)
    return user
  })

  handle('auth:login', loginSchema, { access: 'public' }, (input) => {
    const user = auth.login(getDb().db, input.username, input.password)
    session.set(user)
    return user
  })

  handle('auth:logout', z.undefined(), { access: 'public' }, () => {
    session.set(null)
    return null
  })
}
