// Rangos de fechas de negocio ('YYYY-MM-DD'), calculados solo con cadenas/UTC para que
// no dependan de la zona horaria del equipo. La semana va de lunes a domingo.

export interface DateRange {
  from: string
  to: string
}

const pad = (n: number): string => String(n).padStart(2, '0')
const fmt = (d: Date): string => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const parse = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDays(date: string, days: number): string {
  const d = parse(date)
  d.setUTCDate(d.getUTCDate() + days)
  return fmt(d)
}

/** Lunes de la semana que contiene `date`. */
export function weekStart(date: string): string {
  const dow = parse(date).getUTCDay() // 0 = domingo
  return addDays(date, -((dow + 6) % 7))
}

export function weekRange(today: string): DateRange {
  const from = weekStart(today)
  return { from, to: addDays(from, 6) }
}

export function monthRange(today: string): DateRange {
  const [y, m] = today.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` }
}

export function dayRange(today: string): DateRange {
  return { from: today, to: today }
}

/** Todas las fechas del rango, ambos extremos incluidos. */
export function eachDay(range: DateRange): string[] {
  const days: string[] = []
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d)
  return days
}
