/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

// Convenciones (ver PLAN.md sección 5):
// - dinero = INTEGER en pesos COP
// - *_at   = instante UTC ISO
// - *_date = fecha local del negocio 'YYYY-MM-DD'

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)

const active = () => integer('active', { mode: 'boolean' }).notNull().default(true)

export const ROLES = ['ADMIN', 'SELLER'] as const
export const DOC_STATUS_PURCHASE = ['ACTIVE', 'VOIDED'] as const
export const DOC_STATUS_SALE = ['COMPLETED', 'VOIDED'] as const
export const DOC_STATUS_EXPENSE = ['ACTIVE', 'VOIDED'] as const
export const MOVEMENT_TYPES = ['PURCHASE', 'PURCHASE_VOID', 'SALE', 'SALE_VOID'] as const

// ---------- Usuarios y configuración ----------

export const user = sqliteTable('user', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ROLES }).notNull().default('ADMIN'),
  active: active(),
  createdAt: createdAt()
})

export const setting = sqliteTable('setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

// ---------- Catálogo ----------

export const category = sqliteTable('category', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  active: active()
})

export const color = sqliteTable('color', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  active: active()
})

export const size = sqliteTable('size', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: active()
})

export const product = sqliteTable('product', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  categoryId: integer('category_id')
    .notNull()
    .references(() => category.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  reference: text('reference').notNull().unique(),
  description: text('description'),
  active: active(),
  createdAt: createdAt()
})

export const variant = sqliteTable(
  'variant',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'restrict' }),
    colorId: integer('color_id')
      .notNull()
      .references(() => color.id, { onDelete: 'restrict' }),
    sizeId: integer('size_id')
      .notNull()
      .references(() => size.id, { onDelete: 'restrict' }),
    sku: text('sku').notNull().unique(),
    salePrice: integer('sale_price').notNull().default(0),
    avgCost: integer('avg_cost').notNull().default(0),
    stock: integer('stock').notNull().default(0),
    minStock: integer('min_stock').notNull().default(0),
    active: active()
  },
  (t) => [
    unique('variant_product_color_size').on(t.productId, t.colorId, t.sizeId),
    check('variant_stock_nonneg', sql`${t.stock} >= 0`),
    check('variant_price_nonneg', sql`${t.salePrice} >= 0`),
    index('variant_product_idx').on(t.productId)
  ]
)

export const paymentMethod = sqliteTable('payment_method', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  active: active()
})

export const supplier = sqliteTable('supplier', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  notes: text('notes'),
  active: active()
})

// ---------- Compras ----------

export const purchase = sqliteTable(
  'purchase',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    number: text('number').notNull().unique(),
    supplierId: integer('supplier_id').references(() => supplier.id, { onDelete: 'restrict' }),
    purchaseDate: text('purchase_date').notNull(),
    notes: text('notes'),
    merchandiseTotal: integer('merchandise_total').notNull(),
    shippingCost: integer('shipping_cost').notNull().default(0),
    otherCost: integer('other_cost').notNull().default(0),
    totalCost: integer('total_cost').notNull(),
    status: text('status', { enum: DOC_STATUS_PURCHASE }).notNull().default('ACTIVE'),
    voidedAt: text('voided_at'),
    voidReason: text('void_reason'),
    userId: integer('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: createdAt()
  },
  (t) => [index('purchase_date_idx').on(t.purchaseDate, t.status)]
)

export const purchaseItem = sqliteTable(
  'purchase_item',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    purchaseId: integer('purchase_id')
      .notNull()
      .references(() => purchase.id, { onDelete: 'restrict' }),
    variantId: integer('variant_id')
      .notNull()
      .references(() => variant.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitCost: integer('unit_cost').notNull(),
    allocatedExtra: integer('allocated_extra').notNull().default(0),
    realLineTotal: integer('real_line_total').notNull(),
    realUnitCost: integer('real_unit_cost').notNull()
  },
  (t) => [check('purchase_item_qty_pos', sql`${t.quantity} > 0`)]
)

// ---------- Inventario (historial) ----------

export const stockMovement = sqliteTable(
  'stock_movement',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    variantId: integer('variant_id')
      .notNull()
      .references(() => variant.id, { onDelete: 'restrict' }),
    type: text('type', { enum: MOVEMENT_TYPES }).notNull(),
    quantity: integer('quantity').notNull(), // con signo
    unitCost: integer('unit_cost').notNull(),
    refType: text('ref_type', { enum: ['PURCHASE', 'SALE'] }).notNull(),
    refId: integer('ref_id').notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: createdAt()
  },
  (t) => [index('stock_movement_variant_idx').on(t.variantId)]
)

// ---------- Ventas ----------

export const sale = sqliteTable(
  'sale',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    number: text('number').notNull().unique(),
    saleDate: text('sale_date').notNull(),
    customerName: text('customer_name'),
    notes: text('notes'),
    paymentMethodId: integer('payment_method_id')
      .notNull()
      .references(() => paymentMethod.id, { onDelete: 'restrict' }),
    subtotal: integer('subtotal').notNull(),
    discount: integer('discount').notNull().default(0),
    total: integer('total').notNull(),
    totalCost: integer('total_cost').notNull(),
    status: text('status', { enum: DOC_STATUS_SALE }).notNull().default('COMPLETED'),
    voidedAt: text('voided_at'),
    voidReason: text('void_reason'),
    voidedBy: integer('voided_by').references(() => user.id, { onDelete: 'restrict' }),
    userId: integer('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: createdAt()
  },
  (t) => [
    index('sale_date_idx').on(t.saleDate, t.status),
    check('sale_discount_valid', sql`${t.discount} >= 0 AND ${t.discount} <= ${t.subtotal}`)
  ]
)

export const saleItem = sqliteTable(
  'sale_item',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sale.id, { onDelete: 'restrict' }),
    variantId: integer('variant_id')
      .notNull()
      .references(() => variant.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
    lineSubtotal: integer('line_subtotal').notNull(),
    lineDiscount: integer('line_discount').notNull().default(0),
    lineTotal: integer('line_total').notNull(),
    unitCost: integer('unit_cost').notNull(), // snapshot de variant.avg_cost
    lineCost: integer('line_cost').notNull()
  },
  (t) => [
    index('sale_item_sale_idx').on(t.saleId),
    index('sale_item_variant_idx').on(t.variantId),
    check('sale_item_qty_pos', sql`${t.quantity} > 0`)
  ]
)

// ---------- Gastos ----------

export const expenseCategory = sqliteTable('expense_category', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  active: active()
})

export const expense = sqliteTable(
  'expense',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    expenseCategoryId: integer('expense_category_id')
      .notNull()
      .references(() => expenseCategory.id, { onDelete: 'restrict' }),
    description: text('description').notNull(),
    amount: integer('amount').notNull(),
    expenseDate: text('expense_date').notNull(),
    paymentMethodId: integer('payment_method_id')
      .notNull()
      .references(() => paymentMethod.id, { onDelete: 'restrict' }),
    notes: text('notes'),
    status: text('status', { enum: DOC_STATUS_EXPENSE }).notNull().default('ACTIVE'),
    voidedAt: text('voided_at'),
    voidReason: text('void_reason'),
    userId: integer('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    createdAt: createdAt()
  },
  (t) => [
    index('expense_date_idx').on(t.expenseDate, t.status),
    check('expense_amount_pos', sql`${t.amount} > 0`)
  ]
)
