import { join } from 'path'
import { openDatabase, type AppDb } from '../src/main/db/client'

/** Base SQLite en memoria con migraciones y datos base ya aplicados. */
export function createTestDb(): AppDb {
  return openDatabase(':memory:', join(__dirname, '..', 'resources', 'migrations'))
}
