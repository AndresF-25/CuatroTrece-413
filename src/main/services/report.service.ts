import { and, between, desc, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  category,
  expense,
  expenseCategory,
  paymentMethod,
  product,
  sale,
  saleItem,
  variant
} from '../db/schema'
import { assertBusinessDate } from '../lib/dates'
import { AppError } from '../lib/errors'
import { dayRange, eachDay, monthRange, weekRange } from '../../shared/periods'
import type { DashboardData, InventoryReport, PeriodReport } from '../../shared/types'
import { inventorySummary, listInventory } from './inventory.service'

const ratio = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null)

/**
 * Resultado de un periodo (fechas de negocio, extremos incluidos).
 * Solo cuentan ventas COMPLETED y gastos ACTIVE; las compras NO son costo:
 * el costo es únicamente el de lo efectivamente vendido.
 */
export function periodReport(db: Db, from: string, to: string): PeriodReport {
  assertBusinessDate(from, 'La fecha inicial')
  assertBusinessDate(to, 'La fecha final')
  if (from > to) throw new AppError('La fecha inicial no puede ser posterior a la final')

  const salesWhere = and(between(sale.saleDate, from, to), eq(sale.status, 'COMPLETED'))
  const expenseWhere = and(between(expense.expenseDate, from, to), eq(expense.status, 'ACTIVE'))

  const s = db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${sale.total}), 0)`,
      cost: sql<number>`coalesce(sum(${sale.totalCost}), 0)`
    })
    .from(sale)
    .where(salesWhere)
    .get()!

  const units = db
    .select({ n: sql<number>`coalesce(sum(${saleItem.quantity}), 0)` })
    .from(saleItem)
    .innerJoin(sale, eq(sale.id, saleItem.saleId))
    .where(salesWhere)
    .get()!.n

  const e = db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${expense.amount}), 0)`
    })
    .from(expense)
    .where(expenseWhere)
    .get()!

  const expensesByCategory = db
    .select({
      name: expenseCategory.name,
      total: sql<number>`sum(${expense.amount})`,
      count: sql<number>`count(*)`
    })
    .from(expense)
    .innerJoin(expenseCategory, eq(expenseCategory.id, expense.expenseCategoryId))
    .where(expenseWhere)
    .groupBy(expenseCategory.id)
    .orderBy(desc(sql`sum(${expense.amount})`))
    .all()

  const salesByMethod = db
    .select({ name: paymentMethod.name, total: sql<number>`sum(${sale.total})` })
    .from(sale)
    .innerJoin(paymentMethod, eq(paymentMethod.id, sale.paymentMethodId))
    .where(salesWhere)
    .groupBy(paymentMethod.id)
    .all()
  const expensesByMethod = db
    .select({ name: paymentMethod.name, total: sql<number>`sum(${expense.amount})` })
    .from(expense)
    .innerJoin(paymentMethod, eq(paymentMethod.id, expense.paymentMethodId))
    .where(expenseWhere)
    .groupBy(paymentMethod.id)
    .all()

  const methods = new Map<string, { sales: number; expenses: number }>()
  for (const r of salesByMethod) methods.set(r.name, { sales: r.total, expenses: 0 })
  for (const r of expensesByMethod) {
    methods.set(r.name, { sales: methods.get(r.name)?.sales ?? 0, expenses: r.total })
  }
  const cashByMethod = [...methods.entries()]
    .map(([name, v]) => ({ name, ...v, net: v.sales - v.expenses }))
    .sort((a, b) => b.net - a.net)

  const byDay = new Map(
    db
      .select({
        date: sale.saleDate,
        total: sql<number>`sum(${sale.total})`,
        cost: sql<number>`sum(${sale.totalCost})`
      })
      .from(sale)
      .where(salesWhere)
      .groupBy(sale.saleDate)
      .all()
      .map((r) => [r.date, r])
  )
  // Rellena días sin ventas (con tope para rangos muy largos).
  const days = eachDay({ from, to })
  const salesByDay =
    days.length <= 366
      ? days.map((date) => {
          const r = byDay.get(date)
          return { date, total: r?.total ?? 0, grossProfit: r ? r.total - r.cost : 0 }
        })
      : [...byDay.values()]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((r) => ({ date: r.date, total: r.total, grossProfit: r.total - r.cost }))

  const grossProfit = s.total - s.cost
  const netProfit = grossProfit - e.total
  return {
    from,
    to,
    sales: { count: s.count, units, total: s.total, cost: s.cost },
    grossProfit,
    grossMargin: ratio(grossProfit, s.total),
    expenses: { count: e.count, total: e.total },
    netProfit,
    netMargin: ratio(netProfit, s.total),
    expensesByCategory,
    cashByMethod,
    salesByDay
  }
}

/** `today` es la fecha local del equipo del usuario ('YYYY-MM-DD'). */
export function dashboard(db: Db, today: string): DashboardData {
  assertBusinessDate(today, 'La fecha')
  const range = (r: { from: string; to: string }): PeriodReport => periodReport(db, r.from, r.to)
  return {
    today: range(dayRange(today)),
    week: range(weekRange(today)),
    month: range(monthRange(today)),
    inventory: inventorySummary(db)
  }
}

export function inventoryReport(db: Db): InventoryReport {
  const byCategory = db
    .select({
      name: category.name,
      units: sql<number>`coalesce(sum(${variant.stock}), 0)`,
      valueAtCost: sql<number>`coalesce(sum(${variant.stock} * ${variant.avgCost}), 0)`,
      valueAtPrice: sql<number>`coalesce(sum(${variant.stock} * ${variant.salePrice}), 0)`
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .innerJoin(category, eq(category.id, product.categoryId))
    .where(and(eq(variant.active, true), eq(product.active, true)))
    .groupBy(category.id)
    .orderBy(desc(sql`sum(${variant.stock} * ${variant.avgCost})`))
    .all()

  return {
    summary: inventorySummary(db),
    byCategory,
    lowStock: listInventory(db, { status: 'low' }),
    outOfStock: listInventory(db, { status: 'out' })
  }
}
