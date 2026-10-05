import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  color,
  product,
  purchase,
  purchaseItem,
  size,
  stockMovement,
  supplier,
  variant
} from '../db/schema'
import { assertBusinessDate } from '../lib/dates'
import { AppError } from '../lib/errors'
import { computePurchaseCosts, weightedAverageCost } from '../../shared/money'
import type { PurchaseDetail, PurchaseListRow } from '../../shared/types'

export interface CreatePurchaseInput {
  supplierId?: number | null
  purchaseDate: string
  notes?: string | null
  shippingCost: number
  otherCost: number
  /** Inventario inicial: sin proveedor ni costos extra, número "I-000001". */
  isOpeningStock?: boolean
  items: { variantId: number; quantity: number; unitCost: number }[]
}

const isInt = (n: number): boolean => Number.isInteger(n)

function nextNumber(db: Db, prefix: string): string {
  const row = db
    .select({ n: count() })
    .from(purchase)
    .where(sql`${purchase.number} LIKE ${prefix + '-%'}`)
    .get()!
  return `${prefix}-${String(row.n + 1).padStart(6, '0')}`
}

/**
 * Registra una compra (o el inventario inicial) y actualiza stock y costo promedio
 * de cada variante, todo en una sola transacción.
 */
export function createPurchase(db: Db, userId: number, input: CreatePurchaseInput): { id: number; number: string } {
  const opening = input.isOpeningStock === true
  const shipping = opening ? 0 : input.shippingCost
  const other = opening ? 0 : input.otherCost

  assertBusinessDate(input.purchaseDate, 'La fecha de la compra')
  if (input.items.length === 0) throw new AppError('Agrega al menos un producto')
  if (![shipping, other].every((n) => isInt(n) && n >= 0)) {
    throw new AppError('El envío y otros costos deben ser valores enteros no negativos')
  }
  for (const it of input.items) {
    if (!isInt(it.quantity) || it.quantity <= 0) throw new AppError('La cantidad debe ser mayor a 0')
    if (!isInt(it.unitCost) || it.unitCost < 0) throw new AppError('El costo unitario no puede ser negativo')
  }

  return db.transaction((tx) => {
    const costs = computePurchaseCosts(input.items, shipping + other)
    const merchandiseTotal = input.items.reduce((s, it) => s + it.quantity * it.unitCost, 0)
    const number = nextNumber(tx, opening ? 'I' : 'C')

    const created = tx
      .insert(purchase)
      .values({
        number,
        supplierId: opening ? null : (input.supplierId ?? null),
        purchaseDate: input.purchaseDate,
        notes: opening ? 'Inventario inicial' : (input.notes?.trim() || null),
        merchandiseTotal,
        shippingCost: shipping,
        otherCost: other,
        totalCost: merchandiseTotal + shipping + other,
        userId
      })
      .returning({ id: purchase.id })
      .get()

    input.items.forEach((it, i) => {
      const v = tx.select().from(variant).where(eq(variant.id, it.variantId)).get()
      if (!v) throw new AppError('Una de las variantes no existe')
      const c = costs[i]

      tx.insert(purchaseItem)
        .values({
          purchaseId: created.id,
          variantId: v.id,
          quantity: it.quantity,
          unitCost: it.unitCost,
          allocatedExtra: c.allocatedExtra,
          realLineTotal: c.realLineTotal,
          realUnitCost: c.realUnitCost
        })
        .run()

      tx.update(variant)
        .set({
          stock: v.stock + it.quantity,
          avgCost: weightedAverageCost(v.stock, v.avgCost, it.quantity, c.realLineTotal)
        })
        .where(eq(variant.id, v.id))
        .run()

      tx.insert(stockMovement)
        .values({
          variantId: v.id,
          type: 'PURCHASE',
          quantity: it.quantity,
          unitCost: c.realUnitCost,
          refType: 'PURCHASE',
          refId: created.id,
          userId
        })
        .run()
    })

    return { id: created.id, number }
  })
}

/**
 * Anula una compra. Solo es posible si todas las unidades siguen en stock
 * (si ya se vendieron, primero habría que anular esas ventas).
 */
export function voidPurchase(db: Db, userId: number, id: number, reason: string): void {
  const why = reason.trim()
  if (!why) throw new AppError('Indica el motivo de la anulación')

  db.transaction((tx) => {
    const p = tx.select().from(purchase).where(eq(purchase.id, id)).get()
    if (!p) throw new AppError('Compra no encontrada')
    if (p.status === 'VOIDED') throw new AppError('La compra ya está anulada')

    const items = tx.select().from(purchaseItem).where(eq(purchaseItem.purchaseId, id)).all()

    // Se revierte en orden inverso al de ingreso.
    for (const it of [...items].reverse()) {
      const v = tx.select().from(variant).where(eq(variant.id, it.variantId)).get()!
      if (v.stock < it.quantity) {
        throw new AppError(
          `No se puede anular: ya se vendieron unidades de ${v.sku}. Anula primero esas ventas.`
        )
      }
      const newStock = v.stock - it.quantity
      const newAvg =
        newStock > 0
          ? Math.max(0, Math.round((v.stock * v.avgCost - it.realLineTotal) / newStock))
          : v.avgCost

      tx.update(variant).set({ stock: newStock, avgCost: newAvg }).where(eq(variant.id, v.id)).run()
      tx.insert(stockMovement)
        .values({
          variantId: v.id,
          type: 'PURCHASE_VOID',
          quantity: -it.quantity,
          unitCost: it.realUnitCost,
          refType: 'PURCHASE',
          refId: id,
          userId
        })
        .run()
    }

    tx.update(purchase)
      .set({ status: 'VOIDED', voidedAt: new Date().toISOString(), voidReason: why })
      .where(eq(purchase.id, id))
      .run()
  })
}

export interface ListPurchasesFilter {
  from?: string
  to?: string
}

export function listPurchases(db: Db, filter: ListPurchasesFilter = {}): PurchaseListRow[] {
  const conditions = [
    filter.from ? gte(purchase.purchaseDate, filter.from) : undefined,
    filter.to ? lte(purchase.purchaseDate, filter.to) : undefined
  ].filter((c) => c !== undefined)

  return db
    .select({
      id: purchase.id,
      number: purchase.number,
      purchaseDate: purchase.purchaseDate,
      supplierName: supplier.name,
      units: sql<number>`coalesce((select sum(quantity) from purchase_item where purchase_id = ${purchase.id}), 0)`,
      merchandiseTotal: purchase.merchandiseTotal,
      shippingCost: purchase.shippingCost,
      otherCost: purchase.otherCost,
      totalCost: purchase.totalCost,
      status: purchase.status
    })
    .from(purchase)
    .leftJoin(supplier, eq(supplier.id, purchase.supplierId))
    .where(and(...conditions))
    .orderBy(desc(purchase.purchaseDate), desc(purchase.id))
    .all()
}

export function getPurchase(db: Db, id: number): PurchaseDetail {
  const head = listPurchases(db).find((p) => p.id === id)
  const extra = db
    .select({ notes: purchase.notes, voidedAt: purchase.voidedAt, voidReason: purchase.voidReason })
    .from(purchase)
    .where(eq(purchase.id, id))
    .get()
  if (!head || !extra) throw new AppError('Compra no encontrada')

  const items = db
    .select({
      id: purchaseItem.id,
      variantId: purchaseItem.variantId,
      sku: variant.sku,
      productName: product.name,
      colorName: color.name,
      sizeName: size.name,
      quantity: purchaseItem.quantity,
      unitCost: purchaseItem.unitCost,
      allocatedExtra: purchaseItem.allocatedExtra,
      realLineTotal: purchaseItem.realLineTotal,
      realUnitCost: purchaseItem.realUnitCost
    })
    .from(purchaseItem)
    .innerJoin(variant, eq(variant.id, purchaseItem.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .innerJoin(color, eq(color.id, variant.colorId))
    .innerJoin(size, eq(size.id, variant.sizeId))
    .where(eq(purchaseItem.purchaseId, id))
    .orderBy(purchaseItem.id)
    .all()

  return { ...head, ...extra, items }
}
