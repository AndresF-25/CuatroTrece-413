import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import type { LookupItem, LookupKind } from '../../../shared/types'
import { errorMessage, unwrap, useLoad } from '../lib/api'
import { Alert, Badge, Button, Card } from './ui'

/** Lista editable de un catálogo simple (categorías, colores, tallas, métodos de pago…). */
export function LookupManager({
  kind,
  singular,
  plural
}: {
  kind: LookupKind
  singular: string
  plural: string
}): React.JSX.Element {
  const { data, error: loadError, reload } = useLoad(() => window.api.lookup.list(kind), [kind])
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setError(null)
    try {
      await action()
      reload()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  const onAdd = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (await run(() => unwrap(window.api.lookup.create(kind, newName)))) setNewName('')
  }

  const onSaveEdit = async (item: LookupItem): Promise<void> => {
    if (!editing) return
    if (await run(() => unwrap(window.api.lookup.update(kind, item.id, editing.name)))) {
      setEditing(null)
    }
  }

  return (
    <Card className="max-w-xl space-y-4">
      <form onSubmit={onAdd} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Nuevo(a) ${singular.toLowerCase()}`}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <Button type="submit" disabled={!newName.trim()}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </form>

      {(error || loadError) && <Alert>{error ?? loadError}</Alert>}

      <ul className="divide-y divide-slate-100">
        {data?.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2">
            {editing?.id === item.id ? (
              <>
                <input
                  autoFocus
                  value={editing.name}
                  onChange={(e) => setEditing({ id: item.id, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && void onSaveEdit(item)}
                  className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <Button variant="ghost" onClick={() => void onSaveEdit(item)} aria-label="Guardar">
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)} aria-label="Cancelar">
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className={item.active ? 'flex-1' : 'flex-1 text-slate-400 line-through'}>
                  {item.name}
                </span>
                {!item.active && <Badge>Inactivo</Badge>}
                <Button
                  variant="ghost"
                  onClick={() => setEditing({ id: item.id, name: item.name })}
                  aria-label="Renombrar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void run(() => unwrap(window.api.lookup.setActive(kind, item.id, !item.active)))
                  }
                >
                  {item.active ? 'Desactivar' : 'Activar'}
                </Button>
              </>
            )}
          </li>
        ))}
        {data?.length === 0 && (
          <li className="py-4 text-center text-sm text-slate-500">No hay {plural} registrados</li>
        )}
      </ul>
    </Card>
  )
}
