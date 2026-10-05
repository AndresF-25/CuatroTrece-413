import Database from 'better-sqlite3'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs'
import { basename, join } from 'path'
import { AppError } from '../lib/errors'
import type { BackupFile } from '../../shared/types'

export type { BackupFile }
export type BackupKind = BackupFile['kind']

const REQUIRED_TABLES = ['user', 'variant', 'sale', 'sale_item', 'purchase', 'expense', 'setting']
const FILE_RE = /^413_(backup|auto|prerestore)_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}(?:-\d{2})?)\.db$/
const PREFIX: Record<BackupKind, string> = { manual: 'backup', auto: 'auto', prerestore: 'prerestore' }
const KIND_OF: Record<string, BackupKind> = { backup: 'manual', auto: 'auto', prerestore: 'prerestore' }

const pad = (n: number): string => String(n).padStart(2, '0')

/** 413_backup_YYYY-MM-DD_HH-mm.db (hora local del equipo). */
export function backupFileName(kind: BackupKind, now = new Date(), withSeconds = false): string {
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_` +
    `${pad(now.getHours())}-${pad(now.getMinutes())}` +
    (withSeconds ? `-${pad(now.getSeconds())}` : '')
  return `413_${PREFIX[kind]}_${stamp}.db`
}

/**
 * Copia consistente de la base abierta. Usa VACUUM INTO (nunca copiar el archivo
 * en uso: con WAL activo la copia podría quedar corrupta o incompleta).
 */
export function createBackup(sqlite: Database.Database, dir: string, kind: BackupKind = 'manual', now = new Date()): BackupFile {
  mkdirSync(dir, { recursive: true })
  let name = backupFileName(kind, now)
  if (existsSync(join(dir, name))) name = backupFileName(kind, now, true)
  if (existsSync(join(dir, name))) throw new AppError('Ya existe una copia creada en este mismo segundo')

  const path = join(dir, name)
  sqlite.prepare('VACUUM INTO ?').run(path)
  return describe(path)
}

function describe(path: string): BackupFile {
  const name = basename(path)
  const m = FILE_RE.exec(name)
  const st = statSync(path)
  return {
    name,
    path,
    kind: m ? KIND_OF[m[1]] : 'manual',
    size: st.size,
    createdAt: st.mtime.toISOString()
  }
}

/** Copias reconocibles de la carpeta, más recientes primero. */
export function listBackups(dir: string): BackupFile[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => FILE_RE.test(f))
    .map((f) => describe(join(dir, f)))
    .sort((a, b) => stampOf(b.name).localeCompare(stampOf(a.name)) || b.name.localeCompare(a.name))
}

/** Parte de fecha/hora del nombre ('2026-10-05_14-07'), para ordenar sin importar el tipo. */
function stampOf(name: string): string {
  return FILE_RE.exec(name)?.[2] ?? ''
}

/** Conserva solo las `keep` copias más recientes de un tipo (las manuales nunca se podan). */
export function pruneBackups(dir: string, kind: Exclude<BackupKind, 'manual'>, keep: number): number {
  const old = listBackups(dir)
    .filter((b) => b.kind === kind)
    .slice(keep)
  for (const b of old) rmSync(b.path, { force: true })
  return old.length
}

/** Copia un archivo de respaldo a una segunda carpeta (OneDrive, USB…). */
export function copyBackupTo(file: BackupFile, dir: string): void {
  mkdirSync(dir, { recursive: true })
  copyFileSync(file.path, join(dir, file.name))
}

/** Verifica que un archivo sea una base 413 íntegra. Devuelve un mensaje de error o null. */
export function validateBackupFile(path: string): string | null {
  if (!existsSync(path)) return 'El archivo no existe'
  let db: Database.Database | null = null
  try {
    db = new Database(path, { readonly: true, fileMustExist: true })
    const check = db.pragma('integrity_check', { simple: true })
    if (check !== 'ok') return 'El archivo está dañado (falló la verificación de integridad)'
    const tables = new Set(
      (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name)
    )
    const missing = REQUIRED_TABLES.filter((t) => !tables.has(t))
    if (missing.length > 0) return 'El archivo no es una copia de seguridad de 413'
    return null
  } catch {
    return 'El archivo no es una base de datos válida'
  } finally {
    db?.close()
  }
}

/**
 * Reemplaza el archivo de base de datos por la copia. La conexión actual debe estar
 * cerrada antes de llamar (se eliminan también los archivos -wal/-shm huérfanos).
 */
export function replaceDatabaseFile(backupPath: string, dbPath: string): void {
  const problem = validateBackupFile(backupPath)
  if (problem) throw new AppError(problem)
  for (const ext of ['-wal', '-shm']) rmSync(dbPath + ext, { force: true })
  copyFileSync(backupPath, dbPath)
}
