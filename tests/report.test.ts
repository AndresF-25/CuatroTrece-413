import { describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'
import { createAdmin } from '../src/main/services/auth.service'
import { createProduct, generateVariants, listLookup, listVariants } from '../src/main/services/catalog.service'
import { createPurchase } from '../src/main/services/purchase.service'
import { createSale, voidSale } from '../src/main/services/sale.service'
import { createExpense, voidExpense } from '../src/main/services/expense.service'
import { dashboard, inventoryReport, periodReport } from '../src/main/services/report.service'
import { addDays, dayRange, eachDay, monthRange, weekRange, weekStart } from '../src/shared/periods'

describe('periodos', () => {
  it('la semana va de lunes a domingo', () => {
    // 2024-01-01 fue lunes
    expect(weekStart('2024-01-01')).toBe('2024-01-01')
    expect(weekStart('2024-01-03')).toBe('2024-01-01')
    expect(weekStart('2024-01-07')).toBe('2024-01-01') // domingo
    expect(weekRange('2024-01-07')).toEqual({ from: '2024-01-01', to: '2024-01-07' })
    expect(weekRange('2024-01-08')).toEqual({ from: '2024-01-08', to: '2024-01-14' })
  })

  it('mes, días y rangos cruzando mes/año', () => {
    expect(monthRange('2024-02-15')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(monthRange('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(weekRange('2026-12-31').to).toBe('2027-01-03')
    expect(dayRange('2026-10-05')).toEqual({ from: '2026-10-05', to: '2026-10-05' })
    expect(eachDay({ from: '2026-02-27', to: '2026-03-02' })).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02'
    ])
  })
})

function setup() {
  const { db } = createTestDb()
  const admin = createAdmin(db, { businessName: 'T', name: 'Ana', username: 'ana', password: 'secreto1' })
  const cat = listLookup(db, 'category')[0]
  const negro = listLookup(db, 'color').find((c) => c.name === 'Negro')!
  const sizes = listLookup(db, 'size')
  const methods = listLookup(db, 'paymentMethod')
  const method = (name: string) => methods.find((m) => m.name === name)!.id
  const publicidad = listLookup(db, 'expenseCategory').find((c) => c.name === 'Publicidad')!.id
  const transporte = listLookup(db, 'expenseCategory').find((c) => c.name === 'Transporte')!.id

  const p = createProduct(db, { categoryId: cat.id, name: 'Blusa', reference: 'BL001' })
  generateVariants(db, { productId: p.id, colorIds: [negro.id], sizeIds: [sizes[1].id], salePrice: 25000, minStock: 2 })
  const v = listVariants(db, p.id)[0]

  // Compra: 10 × 12.000 + envío 10.000 → costo real 13.000 (el gasto de la compra NO es costo del periodo)
  createPurchase(db, admin.id, {
    purchaseDate: '2026-10-01',
    shippingCost: 10000,
    otherCost: 0,
    items: [{ variantId: v.id, quantity: 10, unitCost: 12000 }]
  })
  const sell = (qty: number, date: string, m = 'Efectivo', discount = 0) =>
    createSale(db, admin.id, {
      saleDate: date,
      paymentMethodId: method(m),
      discount,
      items: [{ variantId: v.id, quantity: qty, unitPrice: 25000 }]
    })
  const spend = (amount: number, date: string, cat = publicidad, m = 'Efectivo') =>
    createExpense(db, admin.id, {
      expenseCategoryId: cat,
      description: 'Gasto',
      amount,
      expenseDate: date,
      paymentMethodId: method(m)
    })
  return { db, admin, sell, spend, publicidad, transporte }
}

describe('reporte del periodo', () => {
  it('Caso 6: utilidad neta = utilidad bruta − gastos (las compras no cuentan)', () => {
    const { db, sell, spend } = setup()
    sell(2, '2026-10-05') // 50.000 venta, costo 26.000
    spend(50000, '2026-10-05')

    const r = periodReport(db, '2026-10-05', '2026-10-05')
    expect(r.sales).toEqual({ count: 1, units: 2, total: 50000, cost: 26000 })
    expect(r.grossProfit).toBe(24000)
    expect(r.expenses).toEqual({ count: 1, total: 50000 })
    expect(r.netProfit).toBe(24000 - 50000)
    expect(r.grossMargin).toBeCloseTo(0.48)
    expect(r.netMargin).toBeCloseTo(-26000 / 50000)
  })

  it('respeta el rango de fechas (extremos incluidos) y la fecha de negocio', () => {
    const { db, sell } = setup()
    sell(1, '2026-10-04')
    sell(1, '2026-10-05')
    sell(1, '2026-10-06')
    expect(periodReport(db, '2026-10-05', '2026-10-05').sales.count).toBe(1)
    expect(periodReport(db, '2026-10-04', '2026-10-06').sales.count).toBe(3)
    expect(periodReport(db, '2026-10-07', '2026-10-09').sales.count).toBe(0)
  })

  it('Caso 7: una venta anulada sale del reporte; un gasto anulado también', () => {
    const { db, admin, sell, spend } = setup()
    const a = sell(2, '2026-10-05')
    sell(1, '2026-10-05')
    const g = spend(30000, '2026-10-05')
    voidSale(db, admin.id, a.id, 'x')
    voidExpense(db, g.id, 'x')

    const r = periodReport(db, '2026-10-05', '2026-10-05')
    expect(r.sales).toMatchObject({ count: 1, units: 1, total: 25000, cost: 13000 })
    expect(r.expenses.total).toBe(0)
    expect(r.netProfit).toBe(12000)
  })

  it('con descuento, la utilidad usa el total cobrado', () => {
    const { db, sell } = setup()
    sell(2, '2026-10-05', 'Efectivo', 5000) // total 45.000, costo 26.000
    const r = periodReport(db, '2026-10-05', '2026-10-05')
    expect(r.sales.total).toBe(45000)
    expect(r.grossProfit).toBe(19000)
  })

  it('sin ventas los márgenes son null y no hay división por cero', () => {
    const { db } = setup()
    const r = periodReport(db, '2026-10-05', '2026-10-05')
    expect(r.grossMargin).toBeNull()
    expect(r.netMargin).toBeNull()
    expect(r.netProfit).toBe(0)
  })

  it('gastos por categoría y caja por método de pago', () => {
    const { db, sell, spend, transporte } = setup()
    sell(2, '2026-10-05', 'Efectivo') // 50.000
    sell(1, '2026-10-05', 'Nequi') // 25.000
    spend(10000, '2026-10-05', transporte, 'Efectivo')
    spend(5000, '2026-10-05', transporte, 'Efectivo')
    spend(20000, '2026-10-05', undefined, 'Nequi')

    const r = periodReport(db, '2026-10-05', '2026-10-05')
    expect(r.expensesByCategory).toEqual([
      { name: 'Publicidad', total: 20000, count: 1 },
      { name: 'Transporte', total: 15000, count: 2 }
    ])
    const cash = Object.fromEntries(r.cashByMethod.map((c) => [c.name, c]))
    expect(cash['Efectivo']).toMatchObject({ sales: 50000, expenses: 15000, net: 35000 })
    expect(cash['Nequi']).toMatchObject({ sales: 25000, expenses: 20000, net: 5000 })
  })

  it('serie diaria con días sin ventas en cero', () => {
    const { db, sell } = setup()
    sell(1, '2026-10-05')
    sell(2, '2026-10-07')
    const r = periodReport(db, '2026-10-05', '2026-10-07')
    expect(r.salesByDay).toEqual([
      { date: '2026-10-05', total: 25000, grossProfit: 12000 },
      { date: '2026-10-06', total: 0, grossProfit: 0 },
      { date: '2026-10-07', total: 50000, grossProfit: 24000 }
    ])
  })

  it('valida fechas', () => {
    const { db } = setup()
    expect(() => periodReport(db, '2026-10-06', '2026-10-05')).toThrow('posterior')
    expect(() => periodReport(db, 'hoy', '2026-10-05')).toThrow('inicial')
  })
})

describe('dashboard e inventario', () => {
  it('hoy / semana / mes con el límite de la semana en lunes', () => {
    const { db, sell } = setup()
    // 2026-10-05 es lunes; 2026-10-04 (domingo) pertenece a la semana anterior
    expect(weekRange('2026-10-07')).toEqual({ from: '2026-10-05', to: '2026-10-11' })
    sell(1, '2026-10-04')
    sell(1, '2026-10-05')
    sell(1, '2026-10-07')
    const d = dashboard(db, '2026-10-07')
    expect(d.today.sales.count).toBe(1)
    expect(d.week.sales.count).toBe(2)
    expect(d.month.sales.count).toBe(3)
    expect(d.inventory.units).toBe(7)
  })

  it('reporte de inventario: valor a costo, a precio y por categoría', () => {
    const { db, sell } = setup()
    sell(2, '2026-10-05') // quedan 8
    const r = inventoryReport(db)
    expect(r.summary).toMatchObject({ units: 8, valueAtCost: 8 * 13000, valueAtPrice: 8 * 25000, potentialProfit: 8 * 12000 })
    expect(r.byCategory[0]).toMatchObject({ name: 'Blusas', units: 8, valueAtCost: 104000 })
    expect(r.lowStock).toHaveLength(0)
    expect(r.outOfStock).toHaveLength(0)
  })
})
