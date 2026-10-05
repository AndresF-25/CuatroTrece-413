import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { count } from 'drizzle-orm'
import Database from 'better-sqlite3'
import { openDatabase } from '../src/main/db/client'
import { createAdmin } from '../src/main/services/auth.service'
import { createProduct, listLookup, listProducts } from '../src/main/services/catalog.service'
import {
  backupFileName,
  copyBackupTo,
  createBackup,
  listBackups,
  pruneBackups,
  replaceDatabaseFile,
  validateBackupFile
} from '../src/main/services/backup.service'
import { product } from '../src/main/db/schema'

const MIGRATIONS = join(__dirname, '..', 'resources', 'migrations')
let dir: string
let opened: Database.Database[] = []

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), '413-test-'))
  opened = []
})
afterEach(() => {
  // En Windows un archivo abierto no se puede borrar: cerrar antes de limpiar
  for (const db of opened) {
    try {
      db.close()
    } catch {
      /* ya cerrada */
    }
  }
  rmSync(dir, { recursive: true, force: true })
})

function openWithData(file: string) {
  const app = openDatabase(file, MIGRATIONS)
  opened.push(app.sqlite)
  createAdmin(app.db, { businessName: 'T', name: 'Ana', username: 'ana', password: 'secreto1' })
  const cat = listLookup(app.db, 'category')[0]
  createProduct(app.db, { categoryId: cat.id, name: 'Blusa', reference: 'BL001' })
  return { ...app, cat }
}

describe('nombres', () => {
  it('formato 413_backup_YYYY-MM-DD_HH-mm.db', () => {
    const d = new Date(2026, 9, 5, 14, 7, 9)
    expect(backupFileName('manual', d)).toBe('413_backup_2026-10-05_14-07.db')
    expect(backupFileName('auto', d)).toBe('413_auto_2026-10-05_14-07.db')
    expect(backupFileName('manual', d, true)).toBe('413_backup_2026-10-05_14-07-09.db')
  })
})

describe('copias de seguridad', () => {
  it('crea una copia válida de la base en uso (WAL) con todos los datos', () => {
    const { db, sqlite } = openWithData(join(dir, '413.db'))
    const file = createBackup(sqlite, join(dir, 'backups'))
    expect(file.kind).toBe('manual')
    expect(file.size).toBeGreaterThan(0)
    expect(validateBackupFile(file.path)).toBeNull()

    // la base original sigue funcionando
    expect(listProducts(db)).toHaveLength(1)

    const copy = new Database(file.path, { readonly: true })
    expect((copy.prepare('select count(*) n from product').get() as { n: number }).n).toBe(1)
    copy.close()
  })

  it('dos copias en el mismo minuto no se pisan', () => {
    const { sqlite } = openWithData(join(dir, '413.db'))
    const now = new Date(2026, 9, 5, 14, 7, 9)
    const a = createBackup(sqlite, join(dir, 'b'), 'manual', now)
    const b = createBackup(sqlite, join(dir, 'b'), 'manual', now)
    expect(a.name).not.toBe(b.name)
    expect(listBackups(join(dir, 'b'))).toHaveLength(2)
  })

  it('lista solo archivos reconocibles, la más reciente primero', () => {
    const { sqlite } = openWithData(join(dir, '413.db'))
    const b = join(dir, 'b')
    createBackup(sqlite, b, 'manual', new Date(2026, 9, 1, 10, 0))
    createBackup(sqlite, b, 'auto', new Date(2026, 9, 3, 10, 0))
    writeFileSync(join(b, 'notas.txt'), 'x')
    const names = listBackups(b).map((f) => f.name)
    expect(names).toEqual(['413_auto_2026-10-03_10-00.db', '413_backup_2026-10-01_10-00.db'])
    expect(listBackups(join(dir, 'no-existe'))).toEqual([])
  })

  it('poda solo las automáticas antiguas; las manuales se conservan', () => {
    const { sqlite } = openWithData(join(dir, '413.db'))
    const b = join(dir, 'b')
    createBackup(sqlite, b, 'manual', new Date(2026, 9, 1, 10, 0))
    for (let day = 1; day <= 5; day++) createBackup(sqlite, b, 'auto', new Date(2026, 9, day, 9, 0))
    expect(pruneBackups(b, 'auto', 2)).toBe(3)
    const left = listBackups(b)
    expect(left.filter((f) => f.kind === 'auto').map((f) => f.name)).toEqual([
      '413_auto_2026-10-05_09-00.db',
      '413_auto_2026-10-04_09-00.db'
    ])
    expect(left.filter((f) => f.kind === 'manual')).toHaveLength(1)
  })

  it('copia a una segunda carpeta', () => {
    const { sqlite } = openWithData(join(dir, '413.db'))
    const f = createBackup(sqlite, join(dir, 'b'))
    copyBackupTo(f, join(dir, 'extra'))
    expect(existsSync(join(dir, 'extra', f.name))).toBe(true)
  })
})

describe('validación', () => {
  it('rechaza archivos inexistentes, de texto y bases ajenas', () => {
    expect(validateBackupFile(join(dir, 'nada.db'))).toBe('El archivo no existe')

    writeFileSync(join(dir, 'texto.db'), 'esto no es sqlite, solo texto de relleno '.repeat(20))
    expect(validateBackupFile(join(dir, 'texto.db'))).toMatch(/no es una base de datos válida|dañado/)

    const other = new Database(join(dir, 'ajena.db'))
    other.exec('create table cosas (id integer)')
    other.close()
    expect(validateBackupFile(join(dir, 'ajena.db'))).toBe('El archivo no es una copia de seguridad de 413')
  })
})

describe('restauración', () => {
  it('restaura los datos del momento de la copia y descarta los cambios posteriores', () => {
    const dbPath = join(dir, '413.db')
    const app = openWithData(dbPath)
    const backup = createBackup(app.sqlite, join(dir, 'b'))

    // cambios posteriores a la copia
    createProduct(app.db, { categoryId: app.cat.id, name: 'Falda', reference: 'FA001' })
    expect(app.db.select({ n: count() }).from(product).get()!.n).toBe(2)
    app.sqlite.close()

    replaceDatabaseFile(backup.path, dbPath)

    const after = openDatabase(dbPath, MIGRATIONS)
    opened.push(after.sqlite)
    expect(listProducts(after.db).map((p) => p.reference)).toEqual(['BL001'])
    after.sqlite.close()
  })

  it('un archivo inválido no toca la base actual', () => {
    const dbPath = join(dir, '413.db')
    const app = openWithData(dbPath)
    app.sqlite.close()
    writeFileSync(join(dir, 'malo.db'), 'basura '.repeat(500))

    expect(() => replaceDatabaseFile(join(dir, 'malo.db'), dbPath)).toThrow()
    const still = openDatabase(dbPath, MIGRATIONS)
    opened.push(still.sqlite)
    expect(listProducts(still.db)).toHaveLength(1)
    still.sqlite.close()
  })
})
