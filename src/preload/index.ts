import { contextBridge, ipcRenderer } from 'electron'
import type {
  ApiResult,
  AuthStatus,
  DashboardData,
  ExpenseRow,
  InventoryFilters,
  InventoryReport,
  InventoryRow,
  InventorySummary,
  LookupItem,
  LookupKind,
  MovementRow,
  ProductRow,
  PeriodReport,
  PurchaseDetail,
  PurchaseListRow,
  SaleDetail,
  SaleListRow,
  SessionUser,
  Supplier,
  VariantRow
} from '../shared/types'

const call = <T>(channel: string, input?: unknown): Promise<ApiResult<T>> =>
  ipcRenderer.invoke(channel, input)

interface SupplierData {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
}

interface ProductData {
  categoryId: number
  name: string
  reference: string
  description?: string | null
}

interface ExpenseData {
  expenseCategoryId: number
  description: string
  amount: number
  expenseDate: string
  paymentMethodId: number
  notes?: string | null
}

// Lista cerrada de operaciones que el renderer puede pedir al proceso main.
const api = {
  auth: {
    status: () => call<AuthStatus>('auth:status'),
    setup: (input: { businessName: string; name: string; username: string; password: string }) =>
      call<SessionUser>('auth:setup', input),
    login: (input: { username: string; password: string }) =>
      call<SessionUser>('auth:login', input),
    logout: () => call<null>('auth:logout')
  },
  lookup: {
    list: (kind: LookupKind) => call<LookupItem[]>('lookup:list', { kind }),
    create: (kind: LookupKind, name: string) => call<LookupItem>('lookup:create', { kind, name }),
    update: (kind: LookupKind, id: number, name: string) =>
      call<void>('lookup:update', { kind, id, name }),
    setActive: (kind: LookupKind, id: number, active: boolean) =>
      call<void>('lookup:setActive', { kind, id, active })
  },
  supplier: {
    list: () => call<Supplier[]>('supplier:list'),
    create: (data: SupplierData) => call<Supplier>('supplier:create', data),
    update: (id: number, data: SupplierData) => call<void>('supplier:update', { id, data }),
    setActive: (id: number, active: boolean) => call<void>('supplier:setActive', { id, active })
  },
  product: {
    list: (search?: string) => call<ProductRow[]>('product:list', { search }),
    create: (data: ProductData) => call<{ id: number }>('product:create', data),
    update: (id: number, data: ProductData) => call<void>('product:update', { id, data }),
    setActive: (id: number, active: boolean) => call<void>('product:setActive', { id, active })
  },
  purchase: {
    create: (input: {
      supplierId?: number | null
      purchaseDate: string
      notes?: string | null
      shippingCost: number
      otherCost: number
      isOpeningStock?: boolean
      items: { variantId: number; quantity: number; unitCost: number }[]
    }) => call<{ id: number; number: string }>('purchase:create', input),
    list: (filter?: { from?: string; to?: string }) =>
      call<PurchaseListRow[]>('purchase:list', filter ?? {}),
    get: (id: number) => call<PurchaseDetail>('purchase:get', { id }),
    void: (id: number, reason: string) => call<void>('purchase:void', { id, reason })
  },
  sale: {
    create: (input: {
      saleDate: string
      customerName?: string | null
      notes?: string | null
      paymentMethodId: number
      discount: number
      items: { variantId: number; quantity: number; unitPrice: number }[]
    }) => call<{ id: number; number: string }>('sale:create', input),
    list: (filter?: {
      from?: string
      to?: string
      status?: 'COMPLETED' | 'VOIDED'
      paymentMethodId?: number
    }) => call<SaleListRow[]>('sale:list', filter ?? {}),
    get: (id: number) => call<SaleDetail>('sale:get', { id }),
    void: (id: number, reason: string) => call<void>('sale:void', { id, reason })
  },
  expense: {
    create: (input: ExpenseData) => call<{ id: number }>('expense:create', input),
    update: (id: number, data: ExpenseData) => call<void>('expense:update', { id, data }),
    void: (id: number, reason: string) => call<void>('expense:void', { id, reason }),
    list: (filter?: {
      from?: string
      to?: string
      categoryId?: number
      paymentMethodId?: number
      status?: 'ACTIVE' | 'VOIDED'
    }) => call<ExpenseRow[]>('expense:list', filter ?? {})
  },
  report: {
    period: (from: string, to: string) => call<PeriodReport>('report:period', { from, to }),
    dashboard: (today: string) => call<DashboardData>('report:dashboard', { today }),
    inventory: () => call<InventoryReport>('report:inventory')
  },
  inventory: {
    list: (filters?: InventoryFilters) => call<InventoryRow[]>('inventory:list', filters ?? {}),
    summary: () => call<InventorySummary>('inventory:summary'),
    movements: (variantId: number) => call<MovementRow[]>('inventory:movements', { variantId })
  },
  variant: {
    list: (productId: number) => call<VariantRow[]>('variant:list', { productId }),
    generate: (input: {
      productId: number
      colorIds: number[]
      sizeIds: number[]
      salePrice: number
      minStock: number
    }) => call<{ created: number; skipped: number }>('variant:generate', input),
    update: (id: number, data: { sku: string; salePrice: number; minStock: number }) =>
      call<void>('variant:update', { id, data }),
    setActive: (id: number, active: boolean) => call<void>('variant:setActive', { id, active })
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
