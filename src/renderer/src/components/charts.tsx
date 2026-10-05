import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCOP } from '../lib/format'

// Colores de la paleta de referencia de dataviz (serie 1 azul, tinta y rejilla recesivas).
const SERIES = '#2a78d6'
const MUTED = '#898781'
const GRID = '#e1e0d9'
const AXIS = '#c3c2b7'

const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })

interface Datum {
  label: string
  value: number
}

function ChartTooltip({
  active,
  payload,
  label,
  seriesName
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  seriesName: string
}): React.JSX.Element | null {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES }} />
        <span className="text-slate-600">{seriesName}</span>
        <span className="font-semibold">{formatCOP(payload[0].value)}</span>
      </div>
    </div>
  )
}

/**
 * Gráfico de barras de una sola serie (el título nombra la serie, sin leyenda), con
 * alternancia a tabla para lectura sin color. `horizontal` para categorías con nombre largo.
 */
export function BarChartCard({
  title,
  seriesName,
  data,
  horizontal,
  empty = 'Sin datos en este periodo'
}: {
  title: string
  seriesName: string
  data: Datum[]
  horizontal?: boolean
  empty?: string
}): React.JSX.Element {
  const [asTable, setAsTable] = useState(false)
  const hasData = data.some((d) => d.value !== 0)
  const height = horizontal ? Math.max(160, data.length * 36 + 24) : 240

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-medium">{title}</h4>
        {hasData && (
          <button
            onClick={() => setAsTable(!asTable)}
            className="text-xs text-slate-500 underline-offset-2 hover:underline"
          >
            {asTable ? 'Ver gráfico' : 'Ver tabla'}
          </button>
        )}
      </div>

      {!hasData ? (
        <p className="py-10 text-center text-sm text-slate-500">{empty}</p>
      ) : asTable ? (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {data.map((d) => (
              <tr key={d.label}>
                <td className="py-1.5">{d.label}</td>
                <td className="py-1.5 text-right">{formatCOP(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ height }} aria-label={title} role="img">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout={horizontal ? 'vertical' : 'horizontal'}
              margin={{ top: 4, right: 12, bottom: 0, left: horizontal ? 8 : -8 }}
            >
              <CartesianGrid stroke={GRID} strokeWidth={1} vertical={Boolean(horizontal)} horizontal={!horizontal} />
              {horizontal ? (
                <>
                  <XAxis type="number" tickFormatter={(v: number) => compact.format(v)} tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={110} tick={{ fill: MUTED, fontSize: 12 }} axisLine={{ stroke: AXIS }} tickLine={false} />
                </>
              ) : (
                <>
                  <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 12 }} axisLine={{ stroke: AXIS }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(v: number) => compact.format(v)} tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
                </>
              )}
              <Tooltip
                cursor={{ fill: 'rgba(11,11,11,0.04)' }}
                content={<ChartTooltip seriesName={seriesName} />}
              />
              <Bar
                dataKey="value"
                fill={SERIES}
                barSize={horizontal ? 18 : 22}
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
