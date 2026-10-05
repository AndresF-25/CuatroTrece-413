import { app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { openDatabase, type AppDb } from './client'

let instance: AppDb | null = null

/** Las migraciones viajan en resources/ (desempaquetadas del asar). */
function migrationsFolder(): string {
  return is.dev
    ? join(app.getAppPath(), 'resources', 'migrations')
    : join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'migrations')
}

export function dbFilePath(): string {
  return join(app.getPath('userData'), '413.db')
}

export function getDb(): AppDb {
  if (!instance) instance = openDatabase(dbFilePath(), migrationsFolder())
  return instance
}

export function closeDb(): void {
  instance?.sqlite.close()
  instance = null
}
