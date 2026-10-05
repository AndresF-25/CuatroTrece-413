const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
})

/** Formatea un entero en pesos: 12600 → "$ 12.600". */
export function formatCOP(value: number): string {
  return cop.format(value)
}
