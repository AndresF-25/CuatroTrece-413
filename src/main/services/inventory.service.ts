import { and, asc, desc, eq, like, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  category,
  color,
  product,
  purchase,
  sale,
  size,
  stockMovement,
  user,
  variant
} from '../db/schema'
import type {
  InventoryFilters,
  InventoryRow,
  InventorySummary,
  MovementRow
} from '../../shared/types'

/** Variantes activas (de productos activos) con su stock, costo y precio. */
export function listInventory(db: Db, filters: InventoryFilters = {}): InventoryRow[] {
  const term = filters.search?.trim()
  const conditions: (SQL | undefined)[] = [
    eq(variant.active, true),
    eq(product.active, true),
    term
      ? or(
          like(product.name, `%${term}%`),
          like(product.reference, `%${term}%`),
          like(variant.sku, `%${term}%`)
        )
      : undefined,
    filters.categoryId ? eq(product.categoryId, filters.categoryId) : undefined,
    filters.colorId ? eq(variant.colorId, filters.colorId) : undefined,
    filters.sizeId ? eq(variant.sizeId, filters.sizeId) : undefined,
    filters.status === 'out' ? eq(variant.stock, 0) : undefined,
    filters.status === 'low'
      ? sql`${variant.stock} > 0 AND ${variant.stock} <= ${variant.minStock}`
      : undefined
  ]

  const query = db
    .select({
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      reference: product.reference,
      categoryId: category.id,
      categoryName: category.name,
      colorName: color.name,
      sizeName: size.name,
      sku: variant.sku,
      stock: variant.stock,
      minStock: variant.minStock,
      avgCost: variant.avgCost,
      salePrice: variant.salePrice
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .innerJoin(category, eq(category.id, product.categoryId))
    .innerJoin(color, eq(color.id, variant.colorId))
    .innerJoin(size, eq(size.id, variant.sizeId))
    .where(and(...conditions))
    .orderBy(asc(product.name), asc(color.name), asc(size.sortOrder))

  return filters.limit ? query.limit(filters.limit).all() : query.all()
}

/** Totales del inventario (solo variantes activas de productos activos). */
export function inventorySummary(db: Db): InventorySummary {
  const row = db
    .select({
      units: sql<number>`coalesce(sum(${variant.stock}), 0)`,
      valueAtCost: sql<number>`coalesce(sum(${variant.stock} * ${variant.avgCost}), 0)`,
      valueAtPrice: sql<number>`coalesce(sum(${variant.stock} * ${variant.salePrice}), 0)`,
      lowCount: sql<number>`coalesce(sum(case when ${variant.stock} > 0 and ${variant.stock} <= ${variant.minStock} then 1 else 0 end), 0)`,
      outCount: sql<number>`coalesce(sum(case when ${variant.stock} = 0 then 1 else 0 end), 0)`
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(eq(variant.active, true), eq(product.active, true)))
    .get()!

  return { ...row, potentialProfit: row.valueAtPrice - row.valueAtCost }
}

export function listMovements(db: Db, variantId: number): MovementRow[] {
  return db
    .select({
      id: stockMovement.id,
      type: stockMovement.type,
      quantity: stockMovement.quantity,
      unitCost: stockMovement.unitCost,
      refNumber: sql<string | null>`case ${stockMovement.refType}
        when 'PURCHASE' then (select number from ${purchase} where ${purchase.id} = ${stockMovement.refId})
        else (select number from ${sale} where ${sale.id} = ${stockMovement.refId}) end`,
      userName: user.name,
      createdAt: stockMovement.createdAt
    })
    .from(stockMovement)
    .innerJoin(user, eq(user.id, stockMovement.userId))
    .where(eq(stockMovement.variantId, variantId))
    .orderBy(desc(stockMovement.id))
    .all()
}
