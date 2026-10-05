// Aritmética de dinero en pesos enteros. Compartido entre main y renderer para que
// la vista previa del formulario y el cálculo guardado coincidan exactamente.

/**
 * Reparte `total` (entero ≥ 0) proporcionalmente a `weights` sin perder ni inventar pesos:
 * la suma del resultado es exactamente `total`. El sobrante de redondeo se asigna a las
 * líneas con mayor resto (método del mayor resto), nunca produce valores negativos.
 * Si todos los pesos son 0, reparte en partes iguales.
 */
export function allocateProportional(total: number, weights: number[]): number[] {
  const n = weights.length
  if (n === 0) return []
  if (total === 0) return weights.map(() => 0)

  let w = weights
  let sum = w.reduce((a, b) => a + b, 0)
  if (sum === 0) {
    w = weights.map(() => 1)
    sum = n
  }

  const exact = w.map((x) => (total * x) / sum)
  const base = exact.map(Math.floor)
  let left = total - base.reduce((a, b) => a + b, 0)

  const order = exact
    .map((e, i) => ({ i, rem: e - Math.floor(e) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    base[i] += 1
    left -= 1
  }
  return base
}

export interface PurchaseLineInput {
  quantity: number
  unitCost: number
}

export interface PurchaseLineCost {
  allocatedExtra: number
  realLineTotal: number
  realUnitCost: number
}

/**
 * Costo real de cada línea de una compra: el envío y otros costos se reparten
 * proporcional al valor de cada línea (o por cantidad si la mercancía no tiene costo).
 */
export function computePurchaseCosts(
  lines: PurchaseLineInput[],
  extraTotal: number
): PurchaseLineCost[] {
  const values = lines.map((l) => l.quantity * l.unitCost)
  const merchandise = values.reduce((a, b) => a + b, 0)
  const weights = merchandise > 0 ? values : lines.map((l) => l.quantity)
  const extras = allocateProportional(extraTotal, weights)

  return lines.map((l, i) => {
    const realLineTotal = values[i] + extras[i]
    return {
      allocatedExtra: extras[i],
      realLineTotal,
      realUnitCost: l.quantity > 0 ? Math.round(realLineTotal / l.quantity) : 0
    }
  })
}

/** Costo promedio ponderado tras agregar `qty` unidades con costo total `lineTotal`. */
export function weightedAverageCost(
  stock: number,
  avgCost: number,
  qty: number,
  lineTotal: number
): number {
  const newStock = stock + qty
  return newStock > 0 ? Math.round((stock * avgCost + lineTotal) / newStock) : 0
}
