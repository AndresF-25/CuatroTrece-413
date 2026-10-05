import type { PeriodReport } from '../../../shared/types'
import { useAuth } from '../auth/useAuth'
import { useLoad } from '../lib/api'
import { formatCOP, formatPercent, todayLocal } from '../lib/format'
import { Alert, Card } from '../components/ui'
import { BarChartCard } from '../components/charts'

function PeriodCard({ title, r }: { title: string; r: PeriodReport }): React.JSX.Element {
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Ventas', value: formatCOP(r.sales.total) },
    { label: 'Utilidad bruta', value: formatCOP(r.grossProfit) },
    { label: 'Gastos', value: formatCOP(r.expenses.total) },
    { label: 'Utilidad neta', value: formatCOP(r.netProfit), strong: true }
  ]
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <p className="mt-1 text-3xl font-semibold">{formatCOP(r.netProfit)}</p>
        <p className="text-xs text-slate-500">
          utilidad neta · margen {formatPercent(r.netMargin)} · {r.sales.count}{' '}
          {r.sales.count === 1 ? 'venta' : 'ventas'}
        </p>
      </div>
      <dl className="space-y-1 border-t border-slate-100 pt-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between">
            <dt className="text-slate-600">{row.label}</dt>
            <dd className={row.strong ? 'font-semibold' : ''}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export function DashboardPage(): React.JSX.Element {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const { data, error } = useLoad(
    () => (isAdmin ? window.api.report.dashboard(todayLocal()) : Promise.resolve({ ok: false as const, error: '' })),
    [isAdmin]
  )

  if (!isAdmin) {
    return (
      <Card>
        <p className="text-slate-600">Bienvenido(a). Usa el menú para registrar ventas y consultar el inventario.</p>
      </Card>
    )
  }
  if (error) return <Alert>{error}</Alert>
  if (!data) return <></>

  const inv = data.inventory
  const stats = [
    { label: 'Unidades en inventario', value: String(inv.units) },
    { label: 'Valor del inventario (costo)', value: formatCOP(inv.valueAtCost) },
    { label: 'Productos bajo stock', value: String(inv.lowCount) },
    { label: 'Productos agotados', value: String(inv.outCount) }
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <PeriodCard title="Hoy" r={data.today} />
        <PeriodCard title="Esta semana" r={data.week} />
        <PeriodCard title="Este mes" r={data.month} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-lg font-semibold">{s.value}</p>
          </Card>
        ))}
      </div>

      <BarChartCard
        title="Ventas por día del mes"
        seriesName="Ventas"
        data={data.month.salesByDay.map((d) => ({ label: d.date.slice(8), value: d.total }))}
        empty="Aún no hay ventas este mes"
      />
    </div>
  )
}
