import { useState, type FormEvent } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import type { InventoryRow, SaleListRow } from '../../../shared/types'
import { useAuth } from '../auth/useAuth'
import { errorMessage, unwrap, useLoad } from '../lib/api'
import { formatCOP, formatDate, monthStartLocal, toInt, todayLocal } from '../lib/format'
import { Alert, Badge, Button, Card, Field, Select, SummaryRow } from '../components/ui'
import { ExportButton } from '../components/ExportButton'
import { Modal } from '../components/Modal'
import { VariantPicker } from '../components/VariantPicker'

export function SalesPage(): React.JSX.Element {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [creating, setCreating] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [from, setFrom] = useState(monthStartLocal())
  const [to, setTo] = useState(todayLocal())
  const [status, setStatus] = useState<'' | 'COMPLETED' | 'VOIDED'>('')
  const [methodId, setMethodId] = useState(0)

  const methods = useLoad(() => window.api.lookup.list('paymentMethod'), [])
  const list = useLoad(
    () =>
      window.api.sale.list({
        from: from || undefined,
        to: to || undefined,
        status: status || undefined,
        paymentMethodId: methodId || undefined
      }),
    [from, to, status, methodId]
  )

  if (creating) {
    return (
      <SaleForm
        showCosts={isAdmin}
        onCancel={() => setCreating(false)}
        onSaved={() => {
          setCreating(false)
          list.reload()
        }}
      />
    )
  }

  const completed = list.data?.filter((s) => s.status === 'COMPLETED') ?? []
  const totals = {
    count: completed.length,
    total: completed.reduce((a, s) => a + s.total, 0),
    profit: completed.reduce((a, s) => a + s.grossProfit, 0)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Field label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="w-40">
          <Field label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="w-40">
          <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">Todas</option>
            <option value="COMPLETED">Completadas</option>
            <option value="VOIDED">Anuladas</option>
          </Select>
        </div>
        <div className="w-44">
          <Select label="Método de pago" value={methodId} onChange={(e) => setMethodId(Number(e.target.value))}>
            <option value={0}>Todos</option>
            {methods.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <ExportButton kind="sales" range={{ from: from || undefined, to: to || undefined }} />
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nueva venta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Ventas completadas</p>
          <p className="mt-1 text-lg font-semibold">{totals.count}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Total vendido</p>
          <p className="mt-1 text-lg font-semibold">{formatCOP(totals.total)}</p>
        </Card>
        {isAdmin && (
          <Card className="p-4">
            <p className="text-xs text-slate-500">Utilidad bruta</p>
            <p className="mt-1 text-lg font-semibold">{formatCOP(totals.profit)}</p>
          </Card>
        )}
      </div>

      {list.error && <Alert>{list.error}</Alert>}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2 font-medium">Número</th>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Pago</th>
              <th className="px-4 py-2 text-right font-medium">Unid.</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              {isAdmin && <th className="px-4 py-2 text-right font-medium">Utilidad</th>}
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.data?.map((s: SaleListRow) => (
              <tr
                key={s.id}
                onClick={() => setDetailId(s.id)}
                className={`cursor-pointer hover:bg-slate-50 ${s.status === 'VOIDED' ? 'text-slate-400' : ''}`}
              >
                <td className="px-4 py-2 font-mono text-xs">{s.number}</td>
                <td className="px-4 py-2">{formatDate(s.saleDate)}</td>
                <td className="px-4 py-2">{s.customerName ?? '—'}</td>
                <td className="px-4 py-2">{s.paymentMethodName}</td>
                <td className="px-4 py-2 text-right">{s.units}</td>
                <td className="px-4 py-2 text-right">{formatCOP(s.total)}</td>
                {isAdmin && <td className="px-4 py-2 text-right">{formatCOP(s.grossProfit)}</td>}
                <td className="px-4 py-2">
                  <Badge tone={s.status === 'COMPLETED' ? 'green' : 'red'}>
                    {s.status === 'COMPLETED' ? 'Completada' : 'Anulada'}
                  </Badge>
                </td>
              </tr>
            ))}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No hay ventas en este periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {detailId !== null && (
        <SaleDetailModal
          id={detailId}
          isAdmin={isAdmin}
          onClose={() => setDetailId(null)}
          onChanged={list.reload}
        />
      )}
    </div>
  )
}

// ---------- Nueva venta ----------

interface CartLine {
  row: InventoryRow
  quantity: string
  unitPrice: string
}

function SaleForm({
  showCosts,
  onCancel,
  onSaved
}: {
  showCosts: boolean
  onCancel: () => void
  onSaved: () => void
}): React.JSX.Element {
  const methods = useLoad(() => window.api.lookup.list('paymentMethod'), [])
  const [lines, setLines] = useState<CartLine[]>([])
  const [date, setDate] = useState(todayLocal())
  const [customer, setCustomer] = useState('')
  const [methodId, setMethodId] = useState(0)
  const [discount, setDiscount] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const parsed = lines.map((l) => ({ quantity: toInt(l.quantity), unitPrice: toInt(l.unitPrice) }))
  const subtotal = parsed.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const discountValue = toInt(discount)
  const total = subtotal - discountValue
  const cost = lines.reduce((s, l, i) => s + parsed[i].quantity * l.row.avgCost, 0)
  const profit = total - cost

  const overStock = lines.some((l, i) => parsed[i].quantity > l.row.stock)
  const discountTooBig = discountValue > subtotal
  // Por defecto, el primer método activo en orden de creación (Efectivo en una base nueva).
  const defaultMethod = methods.data?.filter((m) => m.active).sort((a, b) => a.id - b.id)[0]?.id
  const effectiveMethod = methodId || defaultMethod || 0
  const canSubmit =
    lines.length > 0 && !overStock && !discountTooBig && parsed.every((p) => p.quantity > 0) && effectiveMethod > 0

  const addLine = (row: InventoryRow): void => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.row.variantId === row.variantId)
      if (i === -1) return [...prev, { row, quantity: '1', unitPrice: String(row.salePrice) }]
      return prev.map((l, idx) => (idx === i ? { ...l, quantity: String(toInt(l.quantity) + 1) } : l))
    })
  }
  const patch = (i: number, p: Partial<CartLine>): void =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...p } : l)))

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await unwrap(
        window.api.sale.create({
          saleDate: date,
          customerName: customer || null,
          paymentMethodId: effectiveMethod,
          discount: discountValue,
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
        Volver a ventas
      </button>

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold">Nueva venta</h3>
        <VariantPicker onPick={addLine} autoFocus placeholder="Buscar producto, referencia o SKU para agregar…" />

        {lines.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr>
                <th className="py-1 font-medium">Producto</th>
                <th className="py-1 text-right font-medium">Stock</th>
                <th className="py-1 text-right font-medium">Cantidad</th>
                <th className="py-1 text-right font-medium">Precio</th>
                <th className="py-1 text-right font-medium">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l, i) => {
                const over = parsed[i].quantity > l.row.stock
                return (
                  <tr key={l.row.variantId}>
                    <td className="py-2">
                      <span className="font-medium">{l.row.productName}</span>{' '}
                      <span className="text-slate-500">
                        {l.row.colorName} · {l.row.sizeName}
                      </span>
                      <div className="font-mono text-xs text-slate-400">{l.row.sku}</div>
                    </td>
                    <td className="py-2 text-right">{l.row.stock}</td>
                    <td className="py-2 text-right">
                      <input
                        className={`${input} ${over ? 'border-red-500 bg-red-50' : ''}`}
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) => patch(i, { quantity: e.target.value })}
                      />
                      {over && <div className="text-xs text-red-600">Supera el stock</div>}
                    </td>
                    <td className="py-2 text-right">
                      <input className={input} type="number" min={0} value={l.unitPrice} onChange={(e) => patch(i, { unitPrice: e.target.value })} />
                    </td>
                    <td className="py-2 text-right">{formatCOP(parsed[i].quantity * parsed[i].unitPrice)}</td>
                    <td className="py-2 text-right">
                      <Button type="button" variant="ghost" className="px-2 py-1" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} aria-label="Quitar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">Busca y agrega los productos de la venta.</p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <Field label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Select label="Método de pago" value={effectiveMethod} onChange={(e) => setMethodId(Number(e.target.value))}>
            {methods.data
              ?.filter((m) => m.active)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
          <Field label="Cliente (opcional)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <Field label="Descuento" type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          {discountTooBig && <Alert>El descuento no puede ser mayor al subtotal</Alert>}
        </Card>

        <Card className="space-y-2 text-sm">
          <h4 className="font-medium">Resumen</h4>
          <SummaryRow label="Subtotal" value={formatCOP(subtotal)} />
          <SummaryRow label="Descuento" value={`- ${formatCOP(discountValue)}`} />
          <div className="border-t border-slate-200 pt-2">
            <SummaryRow label="Total" value={formatCOP(Math.max(total, 0))} bold />
          </div>
          {showCosts && lines.length > 0 && (
            <div className="space-y-1 border-t border-slate-200 pt-2 text-slate-500">
              <SummaryRow label="Costo estimado" value={formatCOP(cost)} />
              <SummaryRow label="Utilidad estimada" value={formatCOP(profit)} />
            </div>
          )}
        </Card>
      </div>

      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || !canSubmit}>
          Confirmar venta
        </Button>
      </div>
    </form>
  )
}

// ---------- Detalle y anulación ----------

function SaleDetailModal({
  id,
  isAdmin,
  onClose,
  onChanged
}: {
  id: number
  isAdmin: boolean
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element {
  const { data, error, reload } = useLoad(() => window.api.sale.get(id), [id])
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const doVoid = async (): Promise<void> => {
    setErr(null)
    try {
      await unwrap(window.api.sale.void(id, reason))
      setVoiding(false)
      reload()
      onChanged()
    } catch (e) {
      setErr(errorMessage(e))
    }
  }

  return (
    <Modal title={data ? `Venta ${data.number}` : 'Venta'} onClose={onClose} wide>
      {error && <Alert>{error}</Alert>}
      {data && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-600">
            <span>Fecha: {formatDate(data.saleDate)}</span>
            <span>Pago: {data.paymentMethodName}</span>
            <span>Cliente: {data.customerName ?? '—'}</span>
            <span>Registró: {data.userName}</span>
            <Badge tone={data.status === 'COMPLETED' ? 'green' : 'red'}>
              {data.status === 'COMPLETED' ? 'Completada' : 'Anulada'}
            </Badge>
          </div>
          {data.status === 'VOIDED' && <Alert>Anulada: {data.voidReason}</Alert>}

          <table className="w-full">
            <thead className="text-left text-slate-600">
              <tr>
                <th className="py-1 font-medium">Producto</th>
                <th className="py-1 text-right font-medium">Cant.</th>
                <th className="py-1 text-right font-medium">Precio</th>
                <th className="py-1 text-right font-medium">Desc.</th>
                <th className="py-1 text-right font-medium">Total</th>
                {isAdmin && <th className="py-1 text-right font-medium">Costo</th>}
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
                  <td className="py-1.5 text-right">{formatCOP(it.unitPrice)}</td>
                  <td className="py-1.5 text-right">{formatCOP(it.lineDiscount)}</td>
                  <td className="py-1.5 text-right font-medium">{formatCOP(it.lineTotal)}</td>
                  {isAdmin && <td className="py-1.5 text-right">{formatCOP(it.lineCost)}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto w-64 space-y-1">
            <SummaryRow label="Subtotal" value={formatCOP(data.subtotal)} />
            <SummaryRow label="Descuento" value={`- ${formatCOP(data.discount)}`} />
            <div className="border-t border-slate-200 pt-1">
              <SummaryRow label="Total" value={formatCOP(data.total)} bold />
            </div>
            {isAdmin && (
              <div className="space-y-1 border-t border-slate-200 pt-1 text-slate-500">
                <SummaryRow label="Costo" value={formatCOP(data.totalCost)} />
                <SummaryRow label="Utilidad" value={formatCOP(data.grossProfit)} />
                <SummaryRow
                  label="Margen"
                  value={data.total > 0 ? `${((data.grossProfit / data.total) * 100).toFixed(1)} %` : '—'}
                />
              </div>
            )}
          </div>

          {isAdmin &&
            data.status === 'COMPLETED' &&
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
                  Anular venta
                </Button>
              </div>
            ))}
        </div>
      )}
    </Modal>
  )
}
