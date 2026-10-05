import { and, asc, eq, inArray, like, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  category,
  color,
  expenseCategory,
  paymentMethod,
  product,
  size,
  supplier,
  variant
} from '../db/schema'
import { AppError } from '../lib/errors'
import type { LookupItem, LookupKind, ProductRow, Supplier, VariantRow } from '../../shared/types'

// ---------- Catálogos simples (categoría, color, talla, método de pago) ----------

const LOOKUP_TABLES = {
  category,
  color,
  paymentMethod,
  expenseCategory,
  size
} as const

function lookupTable(kind: LookupKind): typeof category {
  return LOOKUP_TABLES[kind] as unknown as typeof category
}

export function listLookup(db: Db, kind: LookupKind): LookupItem[] {
  if (kind === 'size') {
    return db.select().from(size).orderBy(asc(size.sortOrder), asc(size.name)).all()
  }
  const t = lookupTable(kind)
  return db.select().from(t).orderBy(asc(t.name)).all()
}

export function createLookup(db: Db, kind: LookupKind, name: string): LookupItem {
  const clean = name.trim()
  if (!clean) throw new AppError('El nombre es obligatorio')

  if (kind === 'size') {
    const last = db.select({ max: sql<number>`coalesce(max(${size.sortOrder}), -1)` }).from(size).get()!
    return db
      .insert(size)
      .values({ name: clean, sortOrder: last.max + 1 })
      .returning()
      .get()
  }
  return db.insert(lookupTable(kind)).values({ name: clean }).returning().get()
}

export function updateLookup(db: Db, kind: LookupKind, id: number, name: string): void {
  const clean = name.trim()
  if (!clean) throw new AppError('El nombre es obligatorio')
  const t = lookupTable(kind)
  const res = db.update(t).set({ name: clean }).where(eq(t.id, id)).run()
  if (res.changes === 0) throw new AppError('Registro no encontrado')
}

export function setLookupActive(db: Db, kind: LookupKind, id: number, active: boolean): void {
  const t = lookupTable(kind)
  const res = db.update(t).set({ active }).where(eq(t.id, id)).run()
  if (res.changes === 0) throw new AppError('Registro no encontrado')
}

// ---------- Proveedores ----------

export interface SupplierInput {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
}

const blankToNull = (v?: string | null): string | null => (v?.trim() ? v.trim() : null)

export function listSuppliers(db: Db): Supplier[] {
  return db.select().from(supplier).orderBy(asc(supplier.name)).all()
}

export function createSupplier(db: Db, input: SupplierInput): Supplier {
  if (!input.name.trim()) throw new AppError('El nombre del proveedor es obligatorio')
  return db
    .insert(supplier)
    .values({
      name: input.name.trim(),
      phone: blankToNull(input.phone),
      email: blankToNull(input.email),
      address: blankToNull(input.address),
      notes: blankToNull(input.notes)
    })
    .returning()
    .get()
}

export function updateSupplier(db: Db, id: number, input: SupplierInput): void {
  if (!input.name.trim()) throw new AppError('El nombre del proveedor es obligatorio')
  const res = db
    .update(supplier)
    .set({
      name: input.name.trim(),
      phone: blankToNull(input.phone),
      email: blankToNull(input.email),
      address: blankToNull(input.address),
      notes: blankToNull(input.notes)
    })
    .where(eq(supplier.id, id))
    .run()
  if (res.changes === 0) throw new AppError('Proveedor no encontrado')
}

export function setSupplierActive(db: Db, id: number, active: boolean): void {
  db.update(supplier).set({ active }).where(eq(supplier.id, id)).run()
}

// ---------- Productos ----------

export interface ProductInput {
  categoryId: number
  name: string
  reference: string
  description?: string | null
}

export function listProducts(db: Db, search?: string): ProductRow[] {
  const term = search?.trim()
  const filter = term
    ? or(like(product.name, `%${term}%`), like(product.reference, `%${term}%`))
    : undefined

  return db
    .select({
      id: product.id,
      categoryId: product.categoryId,
      categoryName: category.name,
      name: product.name,
      reference: product.reference,
      description: product.description,
      active: product.active,
      variantCount: sql<number>`count(${variant.id})`,
      totalStock: sql<number>`coalesce(sum(${variant.stock}), 0)`
    })
    .from(product)
    .innerJoin(category, eq(category.id, product.categoryId))
    .leftJoin(variant, eq(variant.productId, product.id))
    .where(filter)
    .groupBy(product.id)
    .orderBy(asc(product.name))
    .all()
}

export function createProduct(db: Db, input: ProductInput): { id: number } {
  const name = input.name.trim()
  const reference = input.reference.trim().toUpperCase()
  if (!name) throw new AppError('El nombre es obligatorio')
  if (!reference) throw new AppError('La referencia es obligatoria')
  if (!input.categoryId) throw new AppError('La categoría es obligatoria')

  const created = db
    .insert(product)
    .values({
      categoryId: input.categoryId,
      name,
      reference,
      description: blankToNull(input.description)
    })
    .returning({ id: product.id })
    .get()
  return created
}

export function updateProduct(db: Db, id: number, input: ProductInput): void {
  const name = input.name.trim()
  const reference = input.reference.trim().toUpperCase()
  if (!name) throw new AppError('El nombre es obligatorio')
  if (!reference) throw new AppError('La referencia es obligatoria')
  const res = db
    .update(product)
    .set({
      categoryId: input.categoryId,
      name,
      reference,
      description: blankToNull(input.description)
    })
    .where(eq(product.id, id))
    .run()
  if (res.changes === 0) throw new AppError('Producto no encontrado')
}

export function setProductActive(db: Db, id: number, active: boolean): void {
  db.update(product).set({ active }).where(eq(product.id, id)).run()
}

// ---------- Variantes ----------

export function listVariants(db: Db, productId: number): VariantRow[] {
  return db
    .select({
      id: variant.id,
      productId: variant.productId,
      colorId: variant.colorId,
      colorName: color.name,
      sizeId: variant.sizeId,
      sizeName: size.name,
      sku: variant.sku,
      salePrice: variant.salePrice,
      avgCost: variant.avgCost,
      stock: variant.stock,
      minStock: variant.minStock,
      active: variant.active
    })
    .from(variant)
    .innerJoin(color, eq(color.id, variant.colorId))
    .innerJoin(size, eq(size.id, variant.sizeId))
    .where(eq(variant.productId, productId))
    .orderBy(asc(color.name), asc(size.sortOrder))
    .all()
}

/** "Negro" → "NEG", "Azul Cielo" → "AZU" (sin tildes, solo letras/números). */
export function colorCode(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3)
}

export interface GenerateVariantsInput {
  productId: number
  colorIds: number[]
  sizeIds: number[]
  salePrice: number
  minStock: number
}

/**
 * Crea todas las combinaciones color × talla que aún no existan para el producto.
 * El SKU se autogenera como REFERENCIA-COL-TALLA (editable después).
 */
export function generateVariants(
  db: Db,
  input: GenerateVariantsInput
): { created: number; skipped: number } {
  if (input.colorIds.length === 0 || input.sizeIds.length === 0) {
    throw new AppError('Selecciona al menos un color y una talla')
  }
  if (input.salePrice < 0 || input.minStock < 0) throw new AppError('Valores inválidos')

  return db.transaction((tx) => {
    const prod = tx.select().from(product).where(eq(product.id, input.productId)).get()
    if (!prod) throw new AppError('Producto no encontrado')

    const colors = tx.select().from(color).where(inArray(color.id, input.colorIds)).all()
    const sizes = tx.select().from(size).where(inArray(size.id, input.sizeIds)).all()
    const existing = new Set(
      tx
        .select({ c: variant.colorId, s: variant.sizeId })
        .from(variant)
        .where(eq(variant.productId, prod.id))
        .all()
        .map((v) => `${v.c}:${v.s}`)
    )

    let created = 0
    let skipped = 0
    for (const c of colors) {
      for (const s of sizes) {
        if (existing.has(`${c.id}:${s.id}`)) {
          skipped++
          continue
        }
        const base = `${prod.reference}-${colorCode(c.name)}-${s.name.toUpperCase()}`
        let sku = base
        for (let n = 2; tx.select().from(variant).where(eq(variant.sku, sku)).get(); n++) {
          sku = `${base}-${n}`
        }
        tx.insert(variant)
          .values({
            productId: prod.id,
            colorId: c.id,
            sizeId: s.id,
            sku,
            salePrice: input.salePrice,
            minStock: input.minStock
          })
          .run()
        created++
      }
    }
    return { created, skipped }
  })
}

export interface UpdateVariantInput {
  sku: string
  salePrice: number
  minStock: number
}

export function updateVariant(db: Db, id: number, input: UpdateVariantInput): void {
  const sku = input.sku.trim().toUpperCase()
  if (!sku) throw new AppError('El SKU es obligatorio')
  if (input.salePrice < 0) throw new AppError('El precio no puede ser negativo')
  if (input.minStock < 0) throw new AppError('El stock mínimo no puede ser negativo')
  const res = db
    .update(variant)
    .set({ sku, salePrice: input.salePrice, minStock: input.minStock })
    .where(eq(variant.id, id))
    .run()
  if (res.changes === 0) throw new AppError('Variante no encontrada')
}

export function setVariantActive(db: Db, id: number, active: boolean): void {
  db.update(variant).set({ active }).where(and(eq(variant.id, id))).run()
}
