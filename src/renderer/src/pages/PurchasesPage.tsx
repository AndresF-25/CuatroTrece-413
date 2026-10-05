import { useState, type FormEvent } from 'react'
import { ArrowLeft, PackagePlus, Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { InventoryRow, PurchaseListRow, Supplier } from '../../../shared/types'
import { computePurchaseCosts } from '../../../shared/money'
import { errorMessage, unwrap, useLoad } from '../lib/api'
import { formatCOP, formatDate, toInt, todayLocal } from '../lib/format'
import { Alert, Badge, Button, Card, Field, Select } from '../components/ui'
import { Modal } from '../components/Modal'
import { VariantPicker } from '../components/VariantPicker'

type Tab = 'purchases' | 'suppliers'

export function PurchasesPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('purchases')
  const [form, setForm] = useState<null | 'purchase' | 'opening'>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const list = useLoad(() => window.api.purchase.list(), [])

  if (form) {
    return (
      <PurchaseForm
        opening={form === 'opening'}
        onCancel={() => setForm(null)}
        onSaved={() => {
          setForm(null)
          list.reload()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-1">
          {(
            [
              ['purchases', 'Compras'],
              ['suppliers', 'Proveedores']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
                tab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'purchases' && (
          <div className="mb-2 flex gap-2">
            <Button variant="secondary" onClick={() => setForm('opening')}>
              <PackagePlus className="h-4 w-4" />
              Inventario inicial
            </Button>
            <Button onClick={() => setForm('purchase')}>
              <Plus className="h-4 w-4" />
              Nueva compra
            </Button>
          </div>
        )}
      </div>

      {tab === 'suppliers' && <SuppliersTab />}

      {tab === 'purchases' && (
        <>
          {list.error && <Alert>{list.error}</Alert>}
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2 font-medium">Número</th>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium">Proveedor</th>
                  <th className="px-4 py-2 text-right font-medium">Unidades</th>
                  <th className="px-4 py-2 text-right font-medium">Costo total</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data?.map((p: PurchaseListRow) => (
                  <tr key={p.id} onClick={() => setDetailId(p.id)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs">{p.number}</td>
                    <td className="px-4 py-2">{formatDate(p.purchaseDate)}</td>
                    <td className="px-4 py-2">{p.supplierName ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-2 text-right">{p.units}</td>
                    <td className="px-4 py-2 text-right">{formatCOP(p.totalCost)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={p.status === 'ACTIVE' ? 'green' : 'red'}>
                        {p.status === 'ACTIVE' ? 'Activa' : 'Anulada'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {list.data?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Aún no hay compras. Registra tu primera compra o carga el inventario inicial.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {detailId !== null && (
        <PurchaseDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={list.reload}
        />
      )}
    </div>
  )
}

// ---------- Formulario ----------

interface Line {
  row: InventoryRow
  quantity: string
  unitCost: string
}

function PurchaseForm({
  opening,
  onCancel,
  onSaved
}: {
  opening: boolean
  onCancel: () => void
  onSaved: () => void
}): React.JSX.Element {
  const suppliers = useLoad(() => window.api.supplier.list(), [])
  const [supplierId, setSupplierId] = useState(0)
  const [date, setDate] = useState(todayLocal())
  const [notes, setNotes] = useState('')
  const [shipping, setShipping] = useState('0')
  const [other, setOther] = useState('0')
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const parsed = lines.map((l) => ({ quantity: toInt(l.quantity), unitCost: toInt(l.unitCost) }))
  const extra = opening ? 0 : toInt(shipping) + toInt(other)
  const costs = computePurchaseCosts(parsed, extra)
  const merchandise = parsed.reduce((s, l) => s + l.quantity * l.unitCost, 0)
  const units = parsed.reduce((s, l) => s + l.quantity, 0)

  const addLine = (row: InventoryRow): void => {
    setLines((prev) =>
      prev.some((l) => l.row.variantId === row.variantId)
        ? prev
        : [...prev, { row, quantity: '1', unitCost: row.avgCost ? String(row.avgCost) : '' }]
    )
  }
  const patch = (i: number, p: Partial<Line>): void =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...p } : l)))

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await unwrap(
        window.api.purchase.create({
          supplierId: supplierId || null,
          purchaseDate: date,
          notes: notes || null,
          shippingCost: toInt(shipping),
          otherCost: toInt(other),
          isOpeningStock: opening,
          items: lines.map((l, i) => ({ variantId: l.row.variantId, ...parsed[i] }))
        })
      )
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const input = 'w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm'

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <button type="button" onClick={onCancel} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Volver a compras
      </button>

      <Card className="space-y-4">
        <h3 className="text-lg font-semibold">{opening ? 'Inventario inicial' : 'Nueva compra'}</h3>
        {opening && (
          <Alert kind="info">
            Registra aquí la mercancía que ya tienes. Indica el costo unitario de cada prenda; no se
            suman envío ni otros costos.
          </Alert>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {!opening && (
            <Select label="Proveedor (opcional)" value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
              <option value={0}>Sin proveedor</option>
              {suppliers.data
                ?.filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          )}
          <Field label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {!opening && <Field label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </div>
      </Card>

      <Card className="space-y-3">
        <h4 className="font-medium">Productos</h4>
        <VariantPicker onPick={addLine} placeholder="Buscar producto, referencia o SKU para agregar…" />

        {lines.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr>
                <th className="py-1 font-medium">Producto</th>
                <th className="py-1 text-right font-medium">Cantidad</th>
                <th className="py-1 text-right font-medium">Costo unit.</th>
                <th className="py-1 text-right font-medium">Subtotal</th>
                {!opening && <th className="py-1 text-right font-medium">+ Extra</th>}
                <th className="py-1 text-right font-medium">Costo real unit.</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l, i) => (
                <tr key={l.row.variantId}>
                  <td className="py-2">
                    <span className="font-medium">{l.row.productName}</span>{' '}
                    <span className="text-slate-500">
                      {l.row.colorName} · {l.row.sizeName}
                    </span>
                    <div className="font-mono text-xs text-slate-400">{l.row.sku}</div>
                  </td>
                  <td className="py-2 text-right">
                    <input className={input} type="number" min={1} value={l.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} />
                  </td>
                  <td className="py-2 text-right">
                    <input className={input} type="number" min={0} value={l.unitCost} onChange={(e) => patch(i, { unitCost: e.target.value })} />
                  </td>
                  <td className="py-2 text-right">{formatCOP(parsed[i].quantity * parsed[i].unitCost)}</td>
                  {!opening && <td className="py-2 text-right text-slate-500">{formatCOP(costs[i].allocatedExtra)}</td>}
                  <td className="py-2 text-right font-medium">{formatCOP(costs[i].realUnitCost)}</td>
                  <td className="py-2 text-right">
                    <Button type="button" variant="ghost" className="px-2 py-1" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} aria-label="Quitar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {lines.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Busca y agrega los productos de la compra.</p>}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {!opening ? (
          <Card className="space-y-3">
            <h4 className="font-medium">Costos adicionales</h4>
            <Field label="Envío" type="number" min={0} value={shipping} onChange={(e) => setShipping(e.target.value)} />
            <Field label="Otros costos" type="number" min={0} value={other} onChange={(e) => setOther(e.target.value)} />
            <p className="text-xs text-slate-500">
              Se reparten entre las prendas proporcional a su valor para obtener el costo real de cada una.
            </p>
          </Card>
        ) : (
          <div />
        )}
        <Card className="space-y-2 text-sm">
          <h4 className="font-medium">Resumen</h4>
          <Row label="Unidades" value={String(units)} />
          <Row label="Mercancía" value={formatCOP(merchandise)} />
          {!opening && <Row label="Envío y otros" value={formatCOP(extra)} />}
          <div className="border-t border-slate-200 pt-2">
            <Row label="Costo total real" value={formatCOP(merchandise + extra)} bold />
          </div>
        </Card>
      </div>

      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || lines.length === 0}>
          {opening ? 'Cargar inventario' : 'Confirmar compra'}
        </Button>
      </div>
    </form>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }): React.JSX.Element {
  return (
    <div className={clsx('flex justify-between', bold && 'text-base font-semibold')}>
      <span className={bold ? '' : 'text-slate-600'}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

// ---------- Detalle y anulación ----------

function PurchaseDetailModal({
  id,
  onClose,
  onChanged
}: {
  id: number
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element {
  const { data, error, reload } = useLoad(() => window.api.purchase.get(id), [id])
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const doVoid = async (): Promise<void> => {
    setErr(null)
    try {
      await unwrap(window.api.purchase.void(id, reason))
      setVoiding(false)
      reload()
      onChanged()
    } catch (e) {
      setErr(errorMessage(e))
    }
  }

  return (
    <Modal title={data ? `Compra ${data.number}` : 'Compra'} onClose={onClose} wide>
      {error && <Alert>{error}</Alert>}
      {data && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-600">
            <span>Fecha: {formatDate(data.purchaseDate)}</span>
            <span>Proveedor: {data.supplierName ?? '—'}</span>
            <Badge tone={data.status === 'ACTIVE' ? 'green' : 'red'}>
              {data.status === 'ACTIVE' ? 'Activa' : 'Anulada'}
            </Badge>
          </div>
          {data.notes && <p className="text-slate-600">Notas: {data.notes}</p>}
          {data.status === 'VOIDED' && <Alert>Anulada: {data.voidReason}</Alert>}

          <table className="w-full">
            <thead className="text-left text-slate-600">
              <tr>
                <th className="py-1 font-medium">Producto</th>
                <th className="py-1 text-right font-medium">Cant.</th>
                <th className="py-1 text-right font-medium">Costo unit.</th>
                <th className="py-1 text-right font-medium">Extra</th>
                <th className="py-1 text-right font-medium">Costo real unit.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((it) => (
                <tr key={it.id}>
                  <td className="py-1.5">
                    {it.productName} <span className="text-slate-500">{it.colorName} · {it.sizeName}</span>
                    <div className="font-mono text-xs text-slate-400">{it.sku}</div>
                  </td>
                  <td className="py-1.5 text-right">{it.quantity}</td>
                  <td className="py-1.5 text-right">{formatCOP(it.unitCost)}</td>
                  <td className="py-1.5 text-right">{formatCOP(it.allocatedExtra)}</td>
                  <td className="py-1.5 text-right font-medium">{formatCOP(it.realUnitCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto w-64 space-y-1">
            <Row label="Mercancía" value={formatCOP(data.merchandiseTotal)} />
            <Row label="Envío" value={formatCOP(data.shippingCost)} />
            <Row label="Otros costos" value={formatCOP(data.otherCost)} />
            <div className="border-t border-slate-200 pt-1">
              <Row label="Total" value={formatCOP(data.totalCost)} bold />
            </div>
          </div>

          {data.status === 'ACTIVE' &&
            (voiding ? (
              <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
                <Field label="Motivo de la anulación" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
                {err && <Alert>{err}</Alert>}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setVoiding(false)}>
                    Cancelar
                  </Button>
                  <Button variant="danger" onClick={() => void doVoid()}>
                    Confirmar anulación
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setVoiding(true)}>
                  Anular compra
                </Button>
              </div>
            ))}
        </div>
      )}
    </Modal>
  )
}

// ---------- Proveedores ----------

function SuppliersTab(): React.JSX.Element {
  const { data, error, reload } = useLoad(() => window.api.supplier.list(), [])
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)

  const toggle = async (s: Supplier): Promise<void> => {
    await window.api.supplier.setActive(s.id, !s.active)
    reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Teléfono</th>
              <th className="px-4 py-2 font-medium">Correo</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2">{s.phone ?? '—'}</td>
                <td className="px-4 py-2">{s.email ?? '—'}</td>
                <td className="px-4 py-2">
                  <Badge tone={s.active ? 'green' : 'gray'}>{s.active ? 'Activo' : 'Inactivo'}</Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" className="px-3 py-1" onClick={() => setEditing(s)}>
                    Editar
                  </Button>
                  <Button variant="ghost" className="px-3 py-1" onClick={() => void toggle(s)}>
                    {s.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Aún no hay proveedores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {editing && (
        <SupplierModal
          supplier={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

function SupplierModal({
  supplier,
  onClose,
  onSaved
}: {
  supplier?: Supplier
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? ''
  })
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value })

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      if (supplier) await unwrap(window.api.supplier.update(supplier.id, form))
      else await unwrap(window.api.supplier.create(form))
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal title={supplier ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nombre" value={form.name} onChange={set('name')} autoFocus />
        <Field label="Teléfono" value={form.phone} onChange={set('phone')} />
        <Field label="Correo" value={form.email} onChange={set('email')} />
        <Field label="Dirección" value={form.address} onChange={set('address')} />
        <Field label="Notas" value={form.notes} onChange={set('notes')} />
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Guardar</Button>
        </div>
      </form>
    </Modal>
  )
}
