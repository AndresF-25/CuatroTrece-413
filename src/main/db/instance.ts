import { app } from 'electron'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { is } from '@electron-toolkit/utils'
import { openDatabase, type AppDb } from './client'
import { setting } from './schema'

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

/** Carpeta de copias de seguridad (dentro de los datos de la app: sobrevive a actualizaciones). */
export function backupsDir(): string {
  return join(app.getPath('userData'), 'backups')
}

export function getDb(): AppDb {
  if (!instance) instance = openDatabase(dbFilePath(), migrationsFolder())
  return instance
}

export function closeDb(): void {
  instance?.sqlite.close()
  instance = null
}

/** Segunda carpeta opcional donde se duplican las copias (OneDrive, USB…). */
export function getExtraBackupDir(): string | null {
  const row = getDb().db.select().from(setting).where(eq(setting.key, 'backup_dir')).get()
  return row?.value || null
}

export function setExtraBackupDir(dir: string | null): void {
  const { db } = getDb()
  if (dir) {
    db.insert(setting)
      .values({ key: 'backup_dir', value: dir })
      .onConflictDoUpdate({ target: setting.key, set: { value: dir } })
      .run()
  } else {
    db.delete(setting).where(eq(setting.key, 'backup_dir')).run()
  }
}
