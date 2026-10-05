import { app, BrowserWindow, dialog, shell } from 'electron'
import { writeFileSync } from 'fs'
import { join, relative, resolve, isAbsolute } from 'path'
import { z } from 'zod'
import { backupsDir, closeDb, dbFilePath, getDb, getExtraBackupDir, setExtraBackupDir } from '../db/instance'
import { AppError } from '../lib/errors'
import * as backup from '../services/backup.service'
import { buildExport } from '../services/export.service'
import { handle, session, type HandlerOptions } from './handler'
import type { BackupInfo } from '../../shared/types'

const ADMIN: HandlerOptions = { access: ['ADMIN'] }
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es válida')

/** Evita que el renderer pida restaurar archivos arbitrarios: solo carpetas de copias conocidas. */
function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function allKnownBackups(): backup.BackupFile[] {
  const extra = getExtraBackupDir()
  const all = [...backup.listBackups(backupsDir()), ...(extra ? backup.listBackups(extra) : [])]
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Copia automática al cerrar la app (se conservan las 10 últimas). Nunca interrumpe el cierre. */
export function autoBackupOnQuit(): void {
  try {
    const { sqlite } = getDb()
    const hasUsers = (sqlite.prepare('SELECT COUNT(*) AS n FROM user').get() as { n: number }).n > 0
    if (!hasUsers) return
    const file = backup.createBackup(sqlite, backupsDir(), 'auto')
    backup.pruneBackups(backupsDir(), 'auto', 10)
    const extra = getExtraBackupDir()
    if (extra) backup.copyBackupTo(file, extra)
  } catch (error) {
    console.error('[backup] copia automática falló', error)
  }
}

export function registerBackupIpc(): void {
  handle('backup:info', z.undefined(), ADMIN, (): BackupInfo => ({
    dir: backupsDir(),
    extraDir: getExtraBackupDir(),
    backups: allKnownBackups()
  }))

  handle('backup:create', z.undefined(), ADMIN, () => {
    const file = backup.createBackup(getDb().sqlite, backupsDir(), 'manual')
    let extraError: string | null = null
    const extra = getExtraBackupDir()
    if (extra) {
      try {
        backup.copyBackupTo(file, extra)
      } catch {
        extraError = `No se pudo copiar a ${extra}. La copia principal sí se creó.`
      }
    }
    return { file, extraError }
  })

  handle('backup:openFolder', z.undefined(), ADMIN, async () => {
    const message = await shell.openPath(backupsDir())
    if (message) throw new AppError('No se pudo abrir la carpeta de copias')
  })

  handle('backup:chooseExtraDir', z.undefined(), ADMIN, async () => {
    const win = BrowserWindow.getFocusedWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Carpeta adicional para copias de seguridad',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    setExtraBackupDir(res.filePaths[0])
    return res.filePaths[0]
  })

  handle('backup:clearExtraDir', z.undefined(), ADMIN, () => setExtraBackupDir(null))

  /**
   * Restaura una copia: valida → copia de seguridad previa del estado actual →
   * reemplaza la base → reinicia la app. Sin `path` abre el selector de archivos.
   */
  handle('backup:restore', z.object({ path: z.string().optional() }), ADMIN, async ({ path }) => {
    let source = path
    if (source) {
      const known = [backupsDir(), getExtraBackupDir()].filter((d): d is string => Boolean(d))
      if (!known.some((d) => isInside(d, source!))) throw new AppError('Archivo de copia no reconocido')
    } else {
      const win = BrowserWindow.getFocusedWindow()
      const res = await dialog.showOpenDialog(win!, {
        title: 'Elegir copia de seguridad',
        filters: [{ name: 'Base de datos 413', extensions: ['db'] }],
        properties: ['openFile']
      })
      if (res.canceled || res.filePaths.length === 0) return { restarting: false }
      source = res.filePaths[0]
    }

    const problem = backup.validateBackupFile(source)
    if (problem) throw new AppError(problem)

    // Red de seguridad: si la restauración fuera un error, el estado actual sigue disponible.
    backup.createBackup(getDb().sqlite, backupsDir(), 'prerestore')
    closeDb()
    backup.replaceDatabaseFile(source, dbFilePath())
    session.set(null)

    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 400)
    return { restarting: true }
  })

  handle(
    'export:csv',
    z.object({
      kind: z.enum(['sales', 'purchases', 'inventory', 'expenses', 'period']),
      from: date.optional(),
      to: date.optional()
    }),
    ADMIN,
    async ({ kind, from, to }) => {
      const out = buildExport(getDb().db, kind, { from, to })
      const win = BrowserWindow.getFocusedWindow()
      const res = await dialog.showSaveDialog(win!, {
        title: 'Guardar archivo CSV',
        defaultPath: join(app.getPath('documents'), out.filename),
        filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }]
      })
      if (res.canceled || !res.filePath) return { path: null as string | null }
      writeFileSync(res.filePath, out.content, 'utf8')
      return { path: res.filePath as string | null }
    }
  )
}
