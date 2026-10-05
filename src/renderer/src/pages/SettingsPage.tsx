import { useState } from 'react'
import { DatabaseBackup, FolderOpen, FolderPlus, Upload } from 'lucide-react'
import type { BackupFile } from '../../../shared/types'
import { errorMessage, unwrap, useLoad } from '../lib/api'
import { Alert, Badge, Button, Card } from '../components/ui'
import { LookupManager } from '../components/LookupManager'
import { Modal } from '../components/Modal'

const KIND_LABEL = { manual: 'Manual', auto: 'Automática', prerestore: 'Previa a restaurar' } as const

const formatSize = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function SettingsPage(): React.JSX.Element {
  return (
    <div className="space-y-8">
      <BackupSection />
      <section>
        <h3 className="mb-2 text-base font-semibold">Métodos de pago</h3>
        <LookupManager kind="paymentMethod" singular="Método de pago" plural="métodos de pago" />
      </section>
      <section>
        <h3 className="mb-2 text-base font-semibold">Categorías de gasto</h3>
        <LookupManager kind="expenseCategory" singular="Categoría de gasto" plural="categorías de gasto" />
      </section>
    </div>
  )
}

function BackupSection(): React.JSX.Element {
  const { data, error, reload } = useLoad(() => window.api.backup.info(), [])
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirm, setConfirm] = useState<BackupFile | 'file' | null>(null)
  const [restoring, setRestoring] = useState(false)

  const run = async (action: () => Promise<string | void>): Promise<void> => {
    setMessage(null)
    try {
      const text = await action()
      if (text) setMessage({ ok: true, text })
      reload()
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) })
    }
  }

  const createBackup = (): Promise<void> =>
    run(async () => {
      const res = await unwrap(window.api.backup.create())
      if (res.extraError) throw new Error(res.extraError)
      return `Copia creada: ${res.file.name}`
    })

  const doRestore = async (): Promise<void> => {
    if (!confirm) return
    setRestoring(true)
    setMessage(null)
    try {
      const res = await unwrap(window.api.backup.restore(confirm === 'file' ? undefined : confirm.path))
      if (res.restarting) {
        setMessage({ ok: true, text: 'Restauración completa. La aplicación se está reiniciando…' })
      } else {
        setRestoring(false) // el usuario canceló el selector de archivos
      }
      setConfirm(null)
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) })
      setConfirm(null)
      setRestoring(false)
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">Copias de seguridad</h3>
      <Card className="space-y-4">
        <p className="text-sm text-slate-600">
          Se crea una copia automática cada vez que cierras la aplicación (se conservan las 10 más
          recientes). Haz además una copia manual antes de operaciones importantes.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void createBackup()}>
            <DatabaseBackup className="h-4 w-4" />
            Crear copia ahora
          </Button>
          <Button variant="secondary" onClick={() => void run(() => unwrap(window.api.backup.openFolder()))}>
            <FolderOpen className="h-4 w-4" />
            Abrir carpeta de copias
          </Button>
          <Button variant="secondary" onClick={() => setConfirm('file')}>
            <Upload className="h-4 w-4" />
            Restaurar desde archivo…
          </Button>
        </div>

        {message && <Alert kind={message.ok ? 'success' : 'error'}>{message.text}</Alert>}
        {error && <Alert>{error}</Alert>}

        {data && (
          <>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-slate-500">Carpeta principal: </span>
                <span className="font-mono text-xs">{data.dir}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">Carpeta adicional (OneDrive, USB…): </span>
                {data.extraDir ? (
                  <>
                    <span className="font-mono text-xs">{data.extraDir}</span>
                    <Button variant="ghost" className="px-2 py-1" onClick={() => void run(() => unwrap(window.api.backup.clearExtraDir()))}>
                      Quitar
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" className="px-3 py-1" onClick={() => void run(async () => void (await unwrap(window.api.backup.chooseExtraDir())))}>
                    <FolderPlus className="h-4 w-4" />
                    Elegir carpeta
                  </Button>
                )}
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="text-left text-slate-600">
                <tr>
                  <th className="py-1 font-medium">Archivo</th>
                  <th className="py-1 font-medium">Tipo</th>
                  <th className="py-1 text-right font-medium">Tamaño</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.backups.map((b) => (
                  <tr key={b.path}>
                    <td className="py-1.5 font-mono text-xs">{b.name}</td>
                    <td className="py-1.5">
                      <Badge tone={b.kind === 'manual' ? 'green' : 'gray'}>{KIND_LABEL[b.kind]}</Badge>
                    </td>
                    <td className="py-1.5 text-right">{formatSize(b.size)}</td>
                    <td className="py-1.5 text-right">
                      <Button variant="ghost" className="px-3 py-1" onClick={() => setConfirm(b)}>
                        Restaurar
                      </Button>
                    </td>
                  </tr>
                ))}
                {data.backups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Aún no hay copias de seguridad.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </Card>

      {confirm && (
        <Modal title="Restaurar copia de seguridad" onClose={() => !restoring && setConfirm(null)}>
          <div className="space-y-4 text-sm">
            <Alert kind="info">
              {confirm === 'file'
                ? 'Elegirás un archivo de copia (.db).'
                : `Se restaurará ${confirm.name}.`}{' '}
              Se reemplazarán <b>todos los datos actuales</b> por los de la copia. Antes se guardará
              una copia del estado actual y la aplicación se reiniciará.
            </Alert>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(null)} disabled={restoring}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => void doRestore()} disabled={restoring}>
                Restaurar y reiniciar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
