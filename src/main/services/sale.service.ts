import { and, count, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  color,
  paymentMethod,
  product,
  sale,
  saleItem,
  size,
  stockMovement,
  user,
  variant
} from '../db/schema'
import { assertBusinessDate } from '../lib/dates'
import { AppError } from '../lib/errors'
import { allocateProportional, weightedAverageCost } from '../../shared/money'
import type { SaleDetail, SaleListRow, SaleStatus } from '../../shared/types'

export interface CreateSaleInput {
  saleDate: string
  customerName?: string | null
  notes?: string | null
  paymentMethodId: number
  /** Descuento total en pesos; se prorratea entre las líneas. */
  discount: number
  items: { variantId: number; quantity: number; unitPrice: number }[]
}

const isInt = (n: number): boolean => Number.isInteger(n)

function nextNumber(db: Db): string {
  const row = db.select({ n: count() }).from(sale).get()!
  return `V-${String(row.n + 1).padStart(6, '0')}`
}

/**
 * Registra una venta: valida stock, toma el costo promedio vigente como snapshot
 * de cada línea, prorratea el descuento y descuenta el inventario. Una sola transacción.
 */
export function createSale(db: Db, userId: number, input: CreateSaleInput): { id: number; number: string } {
  assertBusinessDate(input.saleDate, 'La fecha de la venta')
  if (input.items.length === 0) throw new AppError('Agrega al menos un producto')
  if (!isInt(input.discount) || input.discount < 0) {
    throw new AppError('El descuento debe ser un valor entero no negativo')
  }
  for (const it of input.items) {
    if (!isInt(it.quantity) || it.quantity <= 0) throw new AppError('La cantidad debe ser mayor a 0')
    if (!isInt(it.unitPrice) || it.unitPrice < 0) throw new AppError('El precio no puede ser negativo')
  }

  const lineSubtotals = input.items.map((it) => it.quantity * it.unitPrice)
  const subtotal = lineSubtotals.reduce((a, b) => a + b, 0)
  if (input.discount > subtotal) throw new AppError('El descuento no puede ser mayor al subtotal')

  return db.transaction((tx) => {
    const method = tx.select().from(paymentMethod).where(eq(paymentMethod.id, input.paymentMethodId)).get()
    if (!method || !method.active) throw new AppError('Selecciona un método de pago válido')

    // Stock: se valida contra el total pedido por variante (puede repetirse en varias líneas).
    const requested = new Map<number, number>()
    for (const it of input.items) {
      requested.set(it.variantId, (requested.get(it.variantId) ?? 0) + it.quantity)
    }
    const variants = new Map<number, typeof variant.$inferSelect>()
    for (const [variantId, qty] of requested) {
      const v = tx.select().from(variant).where(eq(variant.id, variantId)).get()
      if (!v || !v.active) throw new AppError('Una de las variantes no existe o está inactiva')
      if (v.stock < qty) {
        throw new AppError(`Stock insuficiente de ${v.sku}: disponible ${v.stock}, solicitado ${qty}`)
      }
      variants.set(variantId, v)
    }

    const discounts = allocateProportional(input.discount, lineSubtotals)
    const lines = input.items.map((it, i) => {
      const unitCost = variants.get(it.variantId)!.avgCost
      return {
        ...it,
        lineSubtotal: lineSubtotals[i],
        lineDiscount: discounts[i],
        lineTotal: lineSubtotals[i] - discounts[i],
        unitCost,
        lineCost: it.quantity * unitCost
      }
    })
    const totalCost = lines.reduce((s, l) => s + l.lineCost, 0)

    const number = nextNumber(tx)
    const created = tx
      .insert(sale)
      .values({
        number,
        saleDate: input.saleDate,
        customerName: input.customerName?.trim() || null,
        notes: input.notes?.trim() || null,
        paymentMethodId: input.paymentMethodId,
        subtotal,
        discount: input.discount,
        total: subtotal - input.discount,
        totalCost,
        userId
      })
      .returning({ id: sale.id })
      .get()

    for (const l of lines) {
      tx.insert(saleItem)
        .values({
          saleId: created.id,
          variantId: l.variantId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineSubtotal: l.lineSubtotal,
          lineDiscount: l.lineDiscount,
          lineTotal: l.lineTotal,
          unitCost: l.unitCost,
          lineCost: l.lineCost
        })
        .run()

      tx.update(variant)
        .set({ stock: sql`${variant.stock} - ${l.quantity}` })
        .where(eq(variant.id, l.variantId))
        .run()

      tx.insert(stockMovement)
        .values({
          variantId: l.variantId,
          type: 'SALE',
          quantity: -l.quantity,
          unitCost: l.unitCost,
          refType: 'SALE',
          refId: created.id,
          userId
        })
        .run()
    }

    return { id: created.id, number }
  })
}

/**
 * Anula una venta: restituye el stock al costo con el que salió (snapshot), deja
 * el registro y lo excluye de los reportes.
 */
export function voidSale(db: Db, userId: number, id: number, reason: string): void {
  const why = reason.trim()
  if (!why) throw new AppError('Indica el motivo de la anulación')

  db.transaction((tx) => {
    const s = tx.select().from(sale).where(eq(sale.id, id)).get()
    if (!s) throw new AppError('Venta no encontrada')
    if (s.status === 'VOIDED') throw new AppError('La venta ya está anulada')

    const items = tx.select().from(saleItem).where(eq(saleItem.saleId, id)).all()
    for (const it of items) {
      const v = tx.select().from(variant).where(eq(variant.id, it.variantId)).get()!
      tx.update(variant)
        .set({
          stock: v.stock + it.quantity,
          avgCost: weightedAverageCost(v.stock, v.avgCost, it.quantity, it.lineCost)
        })
        .where(eq(variant.id, v.id))
        .run()
      tx.insert(stockMovement)
        .values({
          variantId: v.id,
          type: 'SALE_VOID',
          quantity: it.quantity,
          unitCost: it.unitCost,
          refType: 'SALE',
          refId: id,
          userId
        })
        .run()
    }

    tx.update(sale)
      .set({ status: 'VOIDED', voidedAt: new Date().toISOString(), voidReason: why, voidedBy: userId })
      .where(eq(sale.id, id))
      .run()
  })
}

export interface ListSalesFilter {
  from?: string
  to?: string
  status?: SaleStatus
  paymentMethodId?: number
  /** Limita a las ventas de un usuario (para el rol vendedor). */
  userId?: number
}

const saleColumns = {
  id: sale.id,
  number: sale.number,
  saleDate: sale.saleDate,
  customerName: sale.customerName,
  paymentMethodId: sale.paymentMethodId,
  paymentMethodName: paymentMethod.name,
  units: sql<number>`coalesce((select sum(quantity) from sale_item where sale_id = ${sale.id}), 0)`,
  subtotal: sale.subtotal,
  discount: sale.discount,
  total: sale.total,
  totalCost: sale.totalCost,
  grossProfit: sql<number>`${sale.total} - ${sale.totalCost}`,
  status: sale.status,
  userName: user.name
}

export function listSales(db: Db, filter: ListSalesFilter = {}): SaleListRow[] {
  const conditions: (SQL | undefined)[] = [
    filter.from ? gte(sale.saleDate, filter.from) : undefined,
    filter.to ? lte(sale.saleDate, filter.to) : undefined,
    filter.status ? eq(sale.status, filter.status) : undefined,
    filter.paymentMethodId ? eq(sale.paymentMethodId, filter.paymentMethodId) : undefined,
    filter.userId ? eq(sale.userId, filter.userId) : undefined
  ]
  return db
    .select(saleColumns)
    .from(sale)
    .innerJoin(paymentMethod, eq(paymentMethod.id, sale.paymentMethodId))
    .innerJoin(user, eq(user.id, sale.userId))
    .where(and(...conditions))
    .orderBy(desc(sale.saleDate), desc(sale.id))
    .all()
}

export function getSale(db: Db, id: number, restrictToUserId?: number): SaleDetail {
  const head = db
    .select({ ...saleColumns, notes: sale.notes, voidedAt: sale.voidedAt, voidReason: sale.voidReason })
    .from(sale)
    .innerJoin(paymentMethod, eq(paymentMethod.id, sale.paymentMethodId))
    .innerJoin(user, eq(user.id, sale.userId))
    .where(and(eq(sale.id, id), restrictToUserId ? eq(sale.userId, restrictToUserId) : undefined))
    .get()
  if (!head) throw new AppError('Venta no encontrada')

  const items = db
    .select({
      id: saleItem.id,
      variantId: saleItem.variantId,
      sku: variant.sku,
      productName: product.name,
      colorName: color.name,
      sizeName: size.name,
      quantity: saleItem.quantity,
      unitPrice: saleItem.unitPrice,
      lineSubtotal: saleItem.lineSubtotal,
      lineDiscount: saleItem.lineDiscount,
      lineTotal: saleItem.lineTotal,
      unitCost: saleItem.unitCost,
      lineCost: saleItem.lineCost
    })
    .from(saleItem)
    .innerJoin(variant, eq(variant.id, saleItem.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .innerJoin(color, eq(color.id, variant.colorId))
    .innerJoin(size, eq(size.id, variant.sizeId))
    .where(eq(saleItem.saleId, id))
    .orderBy(saleItem.id)
    .all()

  return { ...head, items }
}
