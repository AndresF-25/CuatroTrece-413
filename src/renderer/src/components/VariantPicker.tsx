import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { InventoryRow } from '../../../shared/types'

/** Buscador de variantes por nombre, referencia o SKU. */
export function VariantPicker({
  onPick,
  placeholder = 'Buscar producto o SKU…',
  autoFocus
}: {
  onPick: (row: InventoryRow) => void
  placeholder?: string
  autoFocus?: boolean
}): React.JSX.Element {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<InventoryRow[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!term.trim()) return
    let cancelled = false
    const timer = setTimeout(() => {
      void window.api.inventory.list({ search: term, limit: 8 }).then((res) => {
        if (!cancelled && res.ok) {
          setResults(res.data)
          setOpen(true)
        }
      })
    }, 200)
    return (): void => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term])

  const visible = term.trim() ? results : []

  return (
    <div className="relative">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <input
        value={term}
        autoFocus={autoFocus}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-900"
      />
      {open && visible.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {visible.map((r) => (
            <li key={r.variantId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(r)
                  setTerm('')
                  setResults([])
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-100"
              >
                <span>
                  <span className="font-medium">{r.productName}</span>{' '}
                  <span className="text-slate-500">
                    {r.colorName} · {r.sizeName}
                  </span>
                  <span className="ml-2 font-mono text-xs text-slate-400">{r.sku}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">Stock {r.stock}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && term.trim() && visible.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
          Sin resultados
        </div>
      )}
    </div>
  )
}
