import { and, asc, eq, gte, lte, type SQL } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  color,
  paymentMethod,
  product,
  purchase,
  purchaseItem,
  sale,
  saleItem,
  size,
  supplier,
  user,
  variant
} from '../db/schema'
import { AppError } from '../lib/errors'
import { listExpenses } from './expense.service'
import { listInventory } from './inventory.service'
import { periodReport } from './report.service'

export type Cell = string | number | null
export type ExportKind = 'sales' | 'purchases' | 'inventory' | 'expenses' | 'period'

const SEP = ';' // Excel en español (coma decimal) separa columnas con punto y coma
const BOM = '﻿' // para que Excel detecte UTF-8 y respete tildes y ñ

function escapeCell(cell: Cell): string {
  if (cell === null) return ''
  if (typeof cell === 'number') return String(cell)
  // Evita "inyección de fórmulas": texto que Excel interpretaría como fórmula
  let text = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell
  if (/[;"\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(rows: Cell[][]): string {
  return BOM + rows.map((r) => r.map(escapeCell).join(SEP)).join('\r\n') + '\r\n'
}

export interface ExportRange {
  from?: string
  to?: string
}

export interface ExportResult {
  filename: string
  content: string
}

const STATUS_SALE = { COMPLETED: 'Completada', VOIDED: 'Anulada' } as const
const STATUS_DOC = { ACTIVE: 'Vigente', VOIDED: 'Anulada' } as const

function salesRows(db: Db, range: ExportRange): Cell[][] {
  const conditions: (SQL | undefined)[] = [
    range.from ? gte(sale.saleDate, range.from) : undefined,
    range.to ? lte(sale.saleDate, range.to) : undefined
  ]
  const rows = db
    .select({
      number: sale.number,
      date: sale.saleDate,
      status: sale.status,
      customer: sale.customerName,
      method: paymentMethod.name,
      sku: variant.sku,
      product: product.name,
      color: color.name,
      size: size.name,
      quantity: saleItem.quantity,
      unitPrice: saleItem.unitPrice,
      lineDiscount: saleItem.lineDiscount,
      lineTotal: saleItem.lineTotal,
      unitCost: saleItem.unitCost,
      lineCost: saleItem.lineCost,
      userName: user.name
    })
    .from(saleItem)
    .innerJoin(sale, eq(sale.id, saleItem.saleId))
    .innerJoin(paymentMethod, eq(paymentMethod.id, sale.paymentMethodId))
    .innerJoin(variant, eq(variant.id, saleItem.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .innerJoin(color, eq(color.id, variant.colorId))
    .innerJoin(size, eq(size.id, variant.sizeId))
    .innerJoin(user, eq(user.id, sale.userId))
    .where(and(...conditions))
    .orderBy(asc(sale.saleDate), asc(sale.id), asc(saleItem.id))
    .all()

  return [
    ['Número', 'Fecha', 'Estado', 'Cliente', 'Método de pago', 'SKU', 'Producto', 'Color', 'Talla', 'Cantidad', 'Precio unitario', 'Descuento línea', 'Total línea', 'Costo unitario', 'Costo línea', 'Utilidad línea', 'Registró'],
    ...rows.map((r) => [
      r.number, r.date, STATUS_SALE[r.status], r.customer, r.method, r.sku, r.product, r.color, r.size,
      r.quantity, r.unitPrice, r.lineDiscount, r.lineTotal, r.unitCost, r.lineCost, r.lineTotal - r.lineCost, r.userName
    ])
  ]
}

function purchasesRows(db: Db, range: ExportRange): Cell[][] {
  const conditions: (SQL | undefined)[] = [
    range.from ? gte(purchase.purchaseDate, range.from) : undefined,
    range.to ? lte(purchase.purchaseDate, range.to) : undefined
  ]
  const rows = db
    .select({
      number: purchase.number,
      date: purchase.purchaseDate,
      supplier: supplier.name,
      status: purchase.status,
      sku: variant.sku,
      product: product.name,
      color: color.name,
      size: size.name,
      quantity: purchaseItem.quantity,
      unitCost: purchaseItem.unitCost,
      extra: purchaseItem.allocatedExtra,
      realLineTotal: purchaseItem.realLineTotal,
      realUnitCost: purchaseItem.realUnitCost
    })
    .from(purchaseItem)
    .innerJoin(purchase, eq(purchase.id, purchaseItem.purchaseId))
    .leftJoin(supplier, eq(supplier.id, purchase.supplierId))
    .innerJoin(variant, eq(variant.id, purchaseItem.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .innerJoin(color, eq(color.id, variant.colorId))
    .innerJoin(size, eq(size.id, variant.sizeId))
    .where(and(...conditions))
    .orderBy(asc(purchase.purchaseDate), asc(purchase.id), asc(purchaseItem.id))
    .all()

  return [
    ['Número', 'Fecha', 'Proveedor', 'Estado', 'SKU', 'Producto', 'Color', 'Talla', 'Cantidad', 'Costo unitario', 'Extra asignado', 'Costo real línea', 'Costo real unitario'],
    ...rows.map((r) => [
      r.number, r.date, r.supplier, STATUS_DOC[r.status], r.sku, r.product, r.color, r.size,
      r.quantity, r.unitCost, r.extra, r.realLineTotal, r.realUnitCost
    ])
  ]
}

function inventoryRows(db: Db): Cell[][] {
  return [
    ['Producto', 'Referencia', 'Categoría', 'Color', 'Talla', 'SKU', 'Stock', 'Stock mínimo', 'Costo promedio', 'Precio de venta', 'Valor a costo', 'Valor a precio'],
    ...listInventory(db).map((r) => [
      r.productName, r.reference, r.categoryName, r.colorName, r.sizeName, r.sku, r.stock, r.minStock,
      r.avgCost, r.salePrice, r.stock * r.avgCost, r.stock * r.salePrice
    ])
  ]
}

function expensesRows(db: Db, range: ExportRange): Cell[][] {
  return [
    ['Fecha', 'Categoría', 'Descripción', 'Método de pago', 'Valor', 'Estado', 'Motivo anulación', 'Notas', 'Registró'],
    ...listExpenses(db, range).map((e) => [
      e.expenseDate, e.categoryName, e.description, e.paymentMethodName, e.amount,
      STATUS_DOC[e.status], e.voidReason, e.notes, e.userName
    ])
  ]
}

function periodRows(db: Db, range: ExportRange): Cell[][] {
  if (!range.from || !range.to) throw new AppError('Indica el rango de fechas del reporte')
  const r = periodReport(db, range.from, range.to)
  return [
    ['Reporte del periodo', `${r.from} a ${r.to}`],
    [],
    ['Resultado', 'Valor'],
    ['Número de ventas', r.sales.count],
    ['Unidades vendidas', r.sales.units],
    ['Total vendido', r.sales.total],
    ['Costo vendido', r.sales.cost],
    ['Utilidad bruta', r.grossProfit],
    ['Gastos', r.expenses.total],
    ['Utilidad neta', r.netProfit],
    [],
    ['Gastos por categoría', 'Cantidad', 'Total'],
    ...r.expensesByCategory.map((c) => [c.name, c.count, c.total]),
    [],
    ['Dinero por método de pago', 'Ventas', 'Gastos', 'Neto'],
    ...r.cashByMethod.map((c) => [c.name, c.sales, c.expenses, c.net]),
    [],
    ['Ventas por día', 'Total vendido', 'Utilidad bruta'],
    ...r.salesByDay.map((d) => [d.date, d.total, d.grossProfit])
  ]
}

const NAMES: Record<ExportKind, string> = {
  sales: 'ventas',
  purchases: 'compras',
  inventory: 'inventario',
  expenses: 'gastos',
  period: 'reporte'
}

export function buildExport(db: Db, kind: ExportKind, range: ExportRange = {}): ExportResult {
  const rows =
    kind === 'sales' ? salesRows(db, range)
    : kind === 'purchases' ? purchasesRows(db, range)
    : kind === 'inventory' ? inventoryRows(db)
    : kind === 'expenses' ? expensesRows(db, range)
    : periodRows(db, range)

  const suffix =
    kind === 'inventory'
      ? new Date().toISOString().slice(0, 10)
      : [range.from, range.to].filter(Boolean).join('_a_') || 'todo'
  return { filename: `413_${NAMES[kind]}_${suffix}.csv`, content: toCsv(rows) }
}
