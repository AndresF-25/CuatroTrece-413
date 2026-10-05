import { AppError } from './errors'

/** Valida una fecha de negocio local 'YYYY-MM-DD' (existente en el calendario). */
export function assertBusinessDate(value: string, label = 'La fecha'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const date = new Date(Date.UTC(y, mo - 1, d))
    if (date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d) {
      return value
    }
  }
  throw new AppError(`${label} no es válida`)
}
