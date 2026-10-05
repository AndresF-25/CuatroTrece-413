import { useState } from 'react'
import { Download } from 'lucide-react'
import type { ExportKind } from '../../../shared/types'
import { errorMessage, unwrap } from '../lib/api'
import { Button } from './ui'

/** Exporta a CSV (se abre bien en Excel). `range` limita por fechas cuando aplica. */
export function ExportButton({
  kind,
  range,
  label = 'Exportar CSV'
}: {
  kind: ExportKind
  range?: { from?: string; to?: string }
  label?: string
}): React.JSX.Element {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await unwrap(window.api.exportCsv(kind, range))
      if (res.path) setMessage({ ok: true, text: `Guardado en ${res.path}` })
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={() => void run()} disabled={busy}>
        <Download className="h-4 w-4" />
        {label}
      </Button>
      {message && (
        <span
          role="status"
          className={`max-w-xs truncate text-xs ${message.ok ? 'text-green-700' : 'text-red-700'}`}
          title={message.text}
        >
          {message.text}
        </span>
      )}
    </div>
  )
}
