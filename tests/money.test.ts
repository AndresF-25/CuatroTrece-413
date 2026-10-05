import { describe, it, expect } from 'vitest'
import {
  allocateProportional,
  computePurchaseCosts,
  weightedAverageCost
} from '../src/shared/money'

describe('allocateProportional', () => {
  it('reparte proporcional al valor', () => {
    expect(allocateProportional(6000, [10000, 50000])).toEqual([1000, 5000])
  })

  it('la suma es exacta aunque haya residuo de redondeo', () => {
    const r = allocateProportional(10, [1, 1, 1])
    expect(r.reduce((a, b) => a + b, 0)).toBe(10)
    expect(r).toEqual([4, 3, 3])

    const big = allocateProportional(30001, [12345, 67890, 11111, 5])
    expect(big.reduce((a, b) => a + b, 0)).toBe(30001)
    expect(big.every((x) => x >= 0)).toBe(true)
  })

  it('con pesos en cero reparte en partes iguales; total 0 devuelve ceros', () => {
    expect(allocateProportional(9, [0, 0, 0])).toEqual([3, 3, 3])
    expect(allocateProportional(0, [5, 5])).toEqual([0, 0])
    expect(allocateProportional(5, [])).toEqual([])
  })
})

describe('computePurchaseCosts', () => {
  it('ejemplo del plan: 10 × $12.000 + envío $10.000 → $13.000 por unidad', () => {
    const [l] = computePurchaseCosts([{ quantity: 10, unitCost: 12000 }], 10000)
    expect(l).toEqual({ allocatedExtra: 10000, realLineTotal: 130000, realUnitCost: 13000 })
  })

  it('ejemplo de la sección 11: 20 blusas, mercancía $240.000 + $24.000 → $13.200', () => {
    const [l] = computePurchaseCosts([{ quantity: 20, unitCost: 12000 }], 24000)
    expect(l.realUnitCost).toBe(13200)
    expect(l.realLineTotal).toBe(264000)
  })

  it('la suma de líneas reales = mercancía + extras', () => {
    const lines = [
      { quantity: 3, unitCost: 10000 },
      { quantity: 2, unitCost: 50000 }
    ]
    const costs = computePurchaseCosts(lines, 7001)
    expect(costs.reduce((s, c) => s + c.realLineTotal, 0)).toBe(130000 + 7001)
  })
})

describe('weightedAverageCost', () => {
  it('promedia stock existente con el nuevo ingreso', () => {
    // 10 a 13.000 + 10 a 15.000 → 14.000
    expect(weightedAverageCost(10, 13000, 10, 150000)).toBe(14000)
  })
  it('con stock 0 toma el costo nuevo', () => {
    expect(weightedAverageCost(0, 99999, 4, 52000)).toBe(13000)
  })
})
