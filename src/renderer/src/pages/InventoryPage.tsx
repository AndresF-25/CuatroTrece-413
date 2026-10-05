import { useState } from 'react'
import { Search } from 'lucide-react'
import type { InventoryRow } from '../../../shared/types'
import { useLoad } from '../lib/api'
import { formatCOP } from '../lib/format'
import { Alert, Badge, Card, Select } from '../components/ui'
import { ExportButton } from '../components/ExportButton'
import { Modal } from '../components/Modal'

const MOVEMENT_LABEL = {
  PURCHASE: 'Compra',
  PURCHASE_VOID: 'Anulación de compra',
  SALE: 'Venta',
  SALE_VOID: 'Anulación de venta'
} as const

export function InventoryPage(): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState(0)
  const [colorId, setColorId] = useState(0)
  const [sizeId, setSizeId] = useState(0)
  const [status, setStatus] = useState<'all' | 'low' | 'out'>('all')
  const [detail, setDetail] = useState<InventoryRow | null>(null)

  const categories = useLoad(() => window.api.lookup.list('category'), [])
  const colors = useLoad(() => window.api.lookup.list('color'), [])
  const sizes = useLoad(() => window.api.lookup.list('size'), [])
  const summary = useLoad(() => window.api.inventory.summary(), [])
  const rows = useLoad(
    () =>
      window.api.inventory.list({
        search,
        status,
        categoryId: categoryId || undefined,
        colorId: colorId || undefined,
        sizeId: sizeId || undefined
      }),
    [search, status, categoryId, colorId, sizeId]
  )

  const s = summary.data
  const cards: { label: string; value: string; tone?: string }[] = s
    ? [
        { label: 'Unidades en inventario', value: String(s.units) },
        { label: 'Valor a costo', value: formatCOP(s.valueAtCost) },
        { label: 'Valor a precio de venta', value: formatCOP(s.valueAtPrice) },
        { label: 'Utilidad potencial', value: formatCOP(s.potentialProfit) },
        { label: 'Bajo stock', value: String(s.lowCount), tone: s.lowCount ? 'text-amber-700' : '' },
        { label: 'Agotados', value: String(s.outCount), tone: s.outCount ? 'text-red-700' : '' }
      ]
    : []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButton kind="inventory" label="Exportar inventario CSV" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`mt-1 text-lg font-semibold ${c.tone ?? ''}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto, referencia o SKU"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-900"
          />
        </div>
        <div className="w-40">
          <Select label="Categoría" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            <option value={0}>Todas</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-36">
          <Select label="Color" value={colorId} onChange={(e) => setColorId(Number(e.target.value))}>
            <option value={0}>Todos</option>
            {colors.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-32">
          <Select label="Talla" value={sizeId} onChange={(e) => setSizeId(Number(e.target.value))}>
            <option value={0}>Todas</option>
            {sizes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-36">
          <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">Todos</option>
            <option value="low">Bajo stock</option>
            <option value="out">Agotados</option>
          </Select>
        </div>
      </div>

      {rows.error && <Alert>{rows.error}</Alert>}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2 font-medium">Producto</th>
              <th className="px-4 py-2 font-medium">Color</th>
              <th className="px-4 py-2 font-medium">Talla</th>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 text-right font-medium">Stock</th>
              <th className="px-4 py-2 text-right font-medium">Costo</th>
              <th className="px-4 py-2 text-right font-medium">Precio</th>
              <th className="px-4 py-2 text-right font-medium">Valor (costo)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.data?.map((r) => (
              <tr key={r.variantId} onClick={() => setDetail(r)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{r.productName}</td>
                <td className="px-4 py-2">{r.colorName}</td>
                <td className="px-4 py-2">{r.sizeName}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.sku}</td>
                <td className="px-4 py-2 text-right">
                  {r.stock === 0 ? (
                    <Badge tone="red">Agotado</Badge>
                  ) : r.stock <= r.minStock ? (
                    <Badge tone="amber">{r.stock} · bajo</Badge>
                  ) : (
                    r.stock
                  )}
                </td>
                <td className="px-4 py-2 text-right">{formatCOP(r.avgCost)}</td>
                <td className="px-4 py-2 text-right">{formatCOP(r.salePrice)}</td>
                <td className="px-4 py-2 text-right">{formatCOP(r.stock * r.avgCost)}</td>
              </tr>
            ))}
            {rows.data?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No hay variantes que coincidan. Crea productos y regístralos en una compra.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {detail && <MovementsModal row={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function MovementsModal({ row, onClose }: { row: InventoryRow; onClose: () => void }): React.JSX.Element {
  const { data, error } = useLoad(() => window.api.inventory.movements(row.variantId), [row.variantId])

  return (
    <Modal title={`Movimientos · ${row.sku}`} onClose={onClose} wide>
      <p className="mb-3 text-sm text-slate-600">
        {row.productName} · {row.colorName} · {row.sizeName} — Stock actual: <b>{row.stock}</b>
      </p>
      {error && <Alert>{error}</Alert>}
      <table className="w-full text-sm">
        <thead className="text-left text-slate-600">
          <tr>
            <th className="py-1 font-medium">Fecha</th>
            <th className="py-1 font-medium">Tipo</th>
            <th className="py-1 font-medium">Documento</th>
            <th className="py-1 text-right font-medium">Cantidad</th>
            <th className="py-1 text-right font-medium">Costo unit.</th>
            <th className="py-1 font-medium">Usuario</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data?.map((m) => (
            <tr key={m.id}>
              <td className="py-1.5">{new Date(m.createdAt).toLocaleString('es-CO')}</td>
              <td className="py-1.5">{MOVEMENT_LABEL[m.type]}</td>
              <td className="py-1.5 font-mono text-xs">{m.refNumber ?? '—'}</td>
              <td className={`py-1.5 text-right font-medium ${m.quantity > 0 ? 'text-green-700' : 'text-red-700'}`}>
                {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
              </td>
              <td className="py-1.5 text-right">{formatCOP(m.unitCost)}</td>
              <td className="py-1.5">{m.userName}</td>
            </tr>
          ))}
          {data?.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-slate-500">
                Sin movimientos todavía
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Modal>
  )
}
