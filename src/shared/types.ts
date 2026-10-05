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
