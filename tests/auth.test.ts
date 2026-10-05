import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from './helpers'
import { createAdmin, getBusinessName, login, needsSetup } from '../src/main/services/auth.service'
import { user } from '../src/main/db/schema'

const input = { businessName: 'Mi Tienda', name: 'Ana', username: 'Ana', password: 'secreto1' }

describe('auth.service', () => {
  it('detecta primer arranque y crea el administrador', () => {
    const { db } = createTestDb()
    expect(needsSetup(db)).toBe(true)

    const admin = createAdmin(db, input)
    expect(admin.role).toBe('ADMIN')
    expect(admin.username).toBe('ana')
    expect(needsSetup(db)).toBe(false)
    expect(getBusinessName(db)).toBe('Mi Tienda')
  })

  it('no guarda la contraseña en texto plano', () => {
    const { db } = createTestDb()
    createAdmin(db, input)
    const row = db.select().from(user).get()!
    expect(row.passwordHash).not.toContain('secreto1')
    expect(row.passwordHash.startsWith('$2')).toBe(true)
  })

  it('no permite configurar dos veces ni contraseñas cortas', () => {
    const { db } = createTestDb()
    expect(() => createAdmin(db, { ...input, password: '123' })).toThrow(/al menos/)
    createAdmin(db, input)
    expect(() => createAdmin(db, { ...input, username: 'otro' })).toThrow(/ya fue configurado/)
  })

  it('inicia sesión sin distinguir mayúsculas en el usuario', () => {
    const { db } = createTestDb()
    createAdmin(db, input)
    expect(login(db, 'ANA', 'secreto1').name).toBe('Ana')
  })

  it('rechaza clave errónea, usuario inexistente o inactivo con el mismo mensaje', () => {
    const { db } = createTestDb()
    createAdmin(db, input)
    expect(() => login(db, 'ana', 'mala')).toThrow('Usuario o contraseña incorrectos')
    expect(() => login(db, 'nadie', 'secreto1')).toThrow('Usuario o contraseña incorrectos')

    db.update(user).set({ active: false }).where(eq(user.username, 'ana')).run()
    expect(() => login(db, 'ana', 'secreto1')).toThrow('Usuario o contraseña incorrectos')
  })
})
