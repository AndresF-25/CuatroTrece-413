import bcrypt from 'bcryptjs'
import { count, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { setting, user } from '../db/schema'
import { AppError } from '../lib/errors'
import type { SessionUser } from '../../shared/types'

const BCRYPT_ROUNDS = 10
export const MIN_PASSWORD_LENGTH = 6

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function needsSetup(db: Db): boolean {
  return db.select({ n: count() }).from(user).get()!.n === 0
}

export function getBusinessName(db: Db): string {
  return db.select().from(setting).where(eq(setting.key, 'business_name')).get()?.value ?? '413'
}

function toSessionUser(row: typeof user.$inferSelect): SessionUser {
  return { id: row.id, name: row.name, username: row.username, role: row.role }
}

export interface SetupInput {
  businessName: string
  name: string
  username: string
  password: string
}

/** Primer arranque: crea el administrador y guarda el nombre del negocio. */
export function createAdmin(db: Db, input: SetupInput): SessionUser {
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
  }
  return db.transaction((tx) => {
    if (!needsSetup(tx)) throw new AppError('El sistema ya fue configurado')

    const created = tx
      .insert(user)
      .values({
        name: input.name.trim(),
        username: normalizeUsername(input.username),
        passwordHash: bcrypt.hashSync(input.password, BCRYPT_ROUNDS),
        role: 'ADMIN'
      })
      .returning()
      .get()

    tx.insert(setting)
      .values({ key: 'business_name', value: input.businessName.trim() })
      .onConflictDoUpdate({ target: setting.key, set: { value: input.businessName.trim() } })
      .run()

    return toSessionUser(created)
  })
}

export function login(db: Db, username: string, password: string): SessionUser {
  const row = db
    .select()
    .from(user)
    .where(eq(user.username, normalizeUsername(username)))
    .get()

  // Mismo mensaje para usuario inexistente, inactivo o clave errónea.
  if (!row || !row.active || !bcrypt.compareSync(password, row.passwordHash)) {
    throw new AppError('Usuario o contraseña incorrectos')
  }
  return toSessionUser(row)
}
