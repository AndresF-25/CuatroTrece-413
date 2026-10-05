import { useState } from 'react'
import { clsx } from 'clsx'
import { monthRange, weekRange } from '../../../shared/periods'
import type { PeriodReport } from '../../../shared/types'
import { useLoad } from '../lib/api'
import { formatCOP, formatDate, formatPercent, todayLocal } from '../lib/format'
import { Alert, Card, Field, SummaryRow } from '../components/ui'
import { BarChartCard } from '../components/charts'

type Tab = 'period' | 'inventory'
type Preset = 'today' | 'week' | 'month' | 'custom'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
  { id: 'custom', label: 'Rango personalizado' }
]

export function ReportsPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('period')
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            ['period', 'Resultados por periodo'],
            ['inventory', 'Inventario']
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
      {tab === 'period' ? <PeriodTab /> : <InventoryTab />}
    </div>
  )
}

function rangeFor(preset: Preset, custom: { from: string; to: string }): { from: string; to: string } {
  const today = todayLocal()
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') return weekRange(today)
  if (preset === 'month') return monthRange(today)
  return custom
}

function PeriodTab(): React.JSX.Element {
  const [preset, setPreset] = useState<Preset>('month')
  const [custom, setCustom] = useState({ from: todayLocal(), to: todayLocal() })
  const { from, to } = rangeFor(preset, custom)
  const { data, error } = useLoad(() => window.api.report.period(from, to), [from, to])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={clsx(
              'rounded-full border px-4 py-1.5 text-sm',
              preset === p.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white hover:bg-slate-100'
            )}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <div className="w-40">
              <Field label="Desde" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            </div>
            <div className="w-40">
              <Field label="Hasta" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </div>
          </>
        )}
        <span className="ml-auto text-sm text-slate-500">
          {formatDate(from)} – {formatDate(to)}
        </span>
      </div>

      {error && <Alert>{error}</Alert>}
      {data && <PeriodContent r={data} />}
    </div>
  )
}

function PeriodContent({ r }: { r: PeriodReport }): React.JSX.Element {
  const longRange = r.salesByDay.length > 31
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-2 text-sm">
          <h4 className="font-medium">Ventas</h4>
          <SummaryRow label="Número de ventas" value={String(r.sales.count)} />
          <SummaryRow label="Unidades vendidas" value={String(r.sales.units)} />
          <SummaryRow label="Total vendido" value={formatCOP(r.sales.total)} />
          <SummaryRow label="Costo vendido" value={formatCOP(r.sales.cost)} />
          <div className="border-t border-slate-200 pt-2">
            <SummaryRow label="Utilidad bruta" value={formatCOP(r.grossProfit)} bold />
            <SummaryRow label="Margen bruto" value={formatPercent(r.grossMargin)} />
          </div>
        </Card>

        <Card className="space-y-2 text-sm">
          <h4 className="font-medium">Gastos</h4>
          <SummaryRow label="Cantidad" value={String(r.expenses.count)} />
          <SummaryRow label="Total" value={formatCOP(r.expenses.total)} />
        </Card>

        <Card className="space-y-2 text-sm">
          <h4 className="font-medium">Resultado</h4>
          <SummaryRow label="Utilidad bruta" value={formatCOP(r.grossProfit)} />
          <SummaryRow label="Gastos" value={`- ${formatCOP(r.expenses.total)}`} />
          <div className="border-t border-slate-200 pt-2">
            <SummaryRow label="Utilidad neta" value={formatCOP(r.netProfit)} bold />
            <SummaryRow label="Margen neto" value={formatPercent(r.netMargin)} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Ventas por día"
          seriesName="Ventas"
          data={r.salesByDay.map((d) => ({
            label: longRange ? formatDate(d.date).slice(0, 5) : d.date.slice(8),
            value: d.total
          }))}
        />
        <BarChartCard
          title="Gastos por categoría"
          seriesName="Gastos"
          horizontal
          data={r.expensesByCategory.map((c) => ({ label: c.name, value: c.total }))}
          empty="No hay gastos en este periodo"
        />
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="border-b border-slate-100 px-5 py-3">
          <h4 className="font-medium">Dinero por método de pago</h4>
          <p className="text-xs text-slate-500">Ventas recibidas menos gastos pagados con cada método.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-5 py-2 font-medium">Método</th>
              <th className="px-5 py-2 text-right font-medium">Ventas</th>
              <th className="px-5 py-2 text-right font-medium">Gastos</th>
              <th className="px-5 py-2 text-right font-medium">Neto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.cashByMethod.map((c) => (
              <tr key={c.name}>
                <td className="px-5 py-2">{c.name}</td>
                <td className="px-5 py-2 text-right">{formatCOP(c.sales)}</td>
                <td className="px-5 py-2 text-right">{formatCOP(c.expenses)}</td>
                <td className="px-5 py-2 text-right font-medium">{formatCOP(c.net)}</td>
              </tr>
            ))}
            {r.cashByMethod.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                  Sin movimientos en este periodo
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function InventoryTab(): React.JSX.Element {
  const { data, error } = useLoad(() => window.api.report.inventory(), [])
  if (error) return <Alert>{error}</Alert>
  if (!data) return <></>
  const s = data.summary

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Unidades totales', String(s.units)],
          ['Valor a costo', formatCOP(s.valueAtCost)],
          ['Valor a precio de venta', formatCOP(s.valueAtPrice)],
          ['Utilidad potencial', formatCOP(s.potentialProfit)],
          ['Margen potencial', formatPercent(s.valueAtPrice > 0 ? s.potentialProfit / s.valueAtPrice : null)]
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Valor del inventario por categoría (a costo)"
          seriesName="Valor a costo"
          horizontal
          data={data.byCategory.map((c) => ({ label: c.name, value: c.valueAtCost }))}
          empty="No hay inventario"
        />
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-slate-100 px-5 py-3">
            <h4 className="font-medium">Detalle por categoría</h4>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-5 py-2 font-medium">Categoría</th>
                <th className="px-5 py-2 text-right font-medium">Unid.</th>
                <th className="px-5 py-2 text-right font-medium">A costo</th>
                <th className="px-5 py-2 text-right font-medium">A precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.byCategory.map((c) => (
                <tr key={c.name}>
                  <td className="px-5 py-2">{c.name}</td>
                  <td className="px-5 py-2 text-right">{c.units}</td>
                  <td className="px-5 py-2 text-right">{formatCOP(c.valueAtCost)}</td>
                  <td className="px-5 py-2 text-right">{formatCOP(c.valueAtPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StockList title="Productos con stock bajo" rows={data.lowStock} />
        <StockList title="Productos agotados" rows={data.outOfStock} />
      </div>
    </div>
  )
}

function StockList({
  title,
  rows
}: {
  title: string
  rows: { variantId: number; productName: string; colorName: string; sizeName: string; sku: string; stock: number; minStock: number }[]
}): React.JSX.Element {
  return (
    <Card className="p-0">
      <div className="border-b border-slate-100 px-5 py-3">
        <h4 className="font-medium">
          {title} <span className="text-slate-400">({rows.length})</span>
        </h4>
      </div>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-auto text-sm">
        {rows.map((r) => (
          <li key={r.variantId} className="flex justify-between px-5 py-2">
            <span>
              {r.productName} <span className="text-slate-500">{r.colorName} · {r.sizeName}</span>
              <span className="ml-2 font-mono text-xs text-slate-400">{r.sku}</span>
            </span>
            <span className="text-slate-600">
              {r.stock} / mín. {r.minStock}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-6 text-center text-slate-500">Nada por aquí</li>}
      </ul>
    </Card>
  )
}
