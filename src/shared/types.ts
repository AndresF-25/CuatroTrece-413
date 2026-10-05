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
