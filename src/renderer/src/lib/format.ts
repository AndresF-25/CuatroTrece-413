const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
})

/** Formatea un entero en pesos: 12600 → "$ 12.600". */
export function formatCOP(value: number): string {
  return cop.format(value)
}

/** Fecha local de hoy como 'YYYY-MM-DD' (fecha de negocio, no UTC). */
export function todayLocal(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** '2026-10-05' → '05/10/2026'. */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

/** Convierte lo escrito en un input numérico a entero ≥ 0 (vacío o inválido → 0). */
export function toInt(value: string): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n > 0 ? n : 0
}
