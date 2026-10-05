// Tipos compartidos entre main, preload y renderer.

export type Role = 'ADMIN' | 'SELLER'

export interface SessionUser {
  id: number
  name: string
  username: string
  role: Role
}

export interface AuthStatus {
  needsSetup: boolean
  businessName: string
  user: SessionUser | null
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

// ---------- Catálogo ----------

export type LookupKind = 'category' | 'color' | 'size' | 'paymentMethod' | 'expenseCategory'

export interface LookupItem {
  id: number
  name: string
  active: boolean
  sortOrder?: number
}

export interface Supplier {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  active: boolean
}

export interface ProductRow {
  id: number
  categoryId: number
  categoryName: string
  name: string
  reference: string
  description: string | null
  active: boolean
  variantCount: number
  totalStock: number
}

// ---------- Compras e inventario ----------

export type DocStatus = 'ACTIVE' | 'VOIDED'

export interface PurchaseListRow {
  id: number
  number: string
  purchaseDate: string
  supplierName: string | null
  units: number
  merchandiseTotal: number
  shippingCost: number
  otherCost: number
  totalCost: number
  status: DocStatus
}

export interface PurchaseItemRow {
  id: number
  variantId: number
  sku: string
  productName: string
  colorName: string
  sizeName: string
  quantity: number
  unitCost: number
  allocatedExtra: number
  realLineTotal: number
  realUnitCost: number
}

export interface PurchaseDetail extends PurchaseListRow {
  notes: string | null
  voidedAt: string | null
  voidReason: string | null
  items: PurchaseItemRow[]
}

// ---------- Ventas ----------

export type SaleStatus = 'COMPLETED' | 'VOIDED'

export interface SaleListRow {
  id: number
  number: string
  saleDate: string
  customerName: string | null
  paymentMethodId: number
  paymentMethodName: string
  units: number
  subtotal: number
  discount: number
  total: number
  totalCost: number
  /** total − costo de lo vendido (calculado, no almacenado) */
  grossProfit: number
  status: SaleStatus
  userName: string
}

export interface SaleItemRow {
  id: number
  variantId: number
  sku: string
  productName: string
  colorName: string
  sizeName: string
  quantity: number
  unitPrice: number
  lineSubtotal: number
  lineDiscount: number
  lineTotal: number
  unitCost: number
  lineCost: number
}

export interface SaleDetail extends SaleListRow {
  notes: string | null
  voidedAt: string | null
  voidReason: string | null
  items: SaleItemRow[]
}

// ---------- Gastos ----------

export interface ExpenseRow {
  id: number
  expenseCategoryId: number
  categoryName: string
  description: string
  amount: number
  expenseDate: string
  paymentMethodId: number
  paymentMethodName: string
  notes: string | null
  status: DocStatus
  voidedAt: string | null
  voidReason: string | null
  userName: string
}

// ---------- Reportes ----------

export interface PeriodReport {
  from: string
  to: string
  sales: { count: number; units: number; total: number; cost: number }
  grossProfit: number
  /** utilidad bruta / ventas (fracción); null si no hubo ventas */
  grossMargin: number | null
  expenses: { count: number; total: number }
  netProfit: number
  netMargin: number | null
  expensesByCategory: { name: string; total: number; count: number }[]
  /** Ventas recibidas y gastos pagados por método de pago */
  cashByMethod: { name: string; sales: number; expenses: number; net: number }[]
  salesByDay: { date: string; total: number; grossProfit: number }[]
}

export interface DashboardData {
  today: PeriodReport
  week: PeriodReport
  month: PeriodReport
  inventory: InventorySummary
}

export interface InventoryReport {
  summary: InventorySummary
  byCategory: { name: string; units: number; valueAtCost: number; valueAtPrice: number }[]
  lowStock: InventoryRow[]
  outOfStock: InventoryRow[]
}

export interface InventoryRow {
  variantId: number
  productId: number
  productName: string
  reference: string
  categoryId: number
  categoryName: string
  colorName: string
  sizeName: string
  sku: string
  stock: number
  minStock: number
  avgCost: number
  salePrice: number
}

export interface InventorySummary {
  units: number
  valueAtCost: number
  valueAtPrice: number
  potentialProfit: number
  lowCount: number
  outCount: number
}

export interface InventoryFilters {
  search?: string
  categoryId?: number
  colorId?: number
  sizeId?: number
  status?: 'all' | 'low' | 'out'
  limit?: number
}

export interface MovementRow {
  id: number
  type: 'PURCHASE' | 'PURCHASE_VOID' | 'SALE' | 'SALE_VOID'
  quantity: number
  unitCost: number
  refNumber: string | null
  userName: string
  createdAt: string
}

export interface VariantRow {
  id: number
  productId: number
  colorId: number
  colorName: string
  sizeId: number
  sizeName: string
  sku: string
  salePrice: number
  avgCost: number
  stock: number
  minStock: number
  active: boolean
}
