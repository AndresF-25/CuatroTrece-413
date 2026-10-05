import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { seedBaseData } from './seed'

export type Db = BetterSQLite3Database<typeof schema>
export type AppDb = { db: Db; sqlite: Database.Database }

/**
 * Abre (o crea) la base, aplica PRAGMAs, migraciones y datos base.
 * No depende de Electron: los tests la usan con ':memory:'.
 */
export function openDatabase(file: string, migrationsFolder: string): AppDb {
  const sqlite = new Database(file)
  sqlite.pragma('foreign_keys = ON')
  if (file !== ':memory:') sqlite.pragma('journal_mode = WAL')

  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  seedBaseData(db)
  return { db, sqlite }
}
