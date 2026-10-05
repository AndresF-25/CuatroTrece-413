import { z } from 'zod'
import type { Db } from '../db/client'
import { getDb } from '../db/instance'
import * as catalog from '../services/catalog.service'
import { handle, type HandlerOptions } from './handler'

const kind = z.enum(['category', 'color', 'size', 'paymentMethod', 'expenseCategory'])
const id = z.number().int().positive()
const money = z.number().int().min(0, 'El valor no puede ser negativo')

const READ: HandlerOptions = { access: ['ADMIN', 'SELLER'] }
const WRITE: HandlerOptions = { access: ['ADMIN'] }

const supplierSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del proveedor es obligatorio'),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  address: z.string().nullish(),
  notes: z.string().nullish()
})

const productSchema = z.object({
  categoryId: id,
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  reference: z.string().trim().min(1, 'La referencia es obligatoria'),
  description: z.string().nullish()
})

export function registerCatalogIpc(): void {
  const db = (): Db => getDb().db

  // Catálogos simples
  handle('lookup:list', z.object({ kind }), READ, ({ kind }) => catalog.listLookup(db(), kind))
  handle('lookup:create', z.object({ kind, name: z.string() }), WRITE, ({ kind, name }) =>
    catalog.createLookup(db(), kind, name)
  )
  handle('lookup:update', z.object({ kind, id, name: z.string() }), WRITE, (i) =>
    catalog.updateLookup(db(), i.kind, i.id, i.name)
  )
  handle('lookup:setActive', z.object({ kind, id, active: z.boolean() }), WRITE, (i) =>
    catalog.setLookupActive(db(), i.kind, i.id, i.active)
  )

  // Proveedores
  handle('supplier:list', z.undefined(), READ, () => catalog.listSuppliers(db()))
  handle('supplier:create', supplierSchema, WRITE, (i) => catalog.createSupplier(db(), i))
  handle('supplier:update', z.object({ id, data: supplierSchema }), WRITE, (i) =>
    catalog.updateSupplier(db(), i.id, i.data)
  )
  handle('supplier:setActive', z.object({ id, active: z.boolean() }), WRITE, (i) =>
    catalog.setSupplierActive(db(), i.id, i.active)
  )

  // Productos
  handle('product:list', z.object({ search: z.string().optional() }), READ, ({ search }) =>
    catalog.listProducts(db(), search)
  )
  handle('product:create', productSchema, WRITE, (i) => catalog.createProduct(db(), i))
  handle('product:update', z.object({ id, data: productSchema }), WRITE, (i) =>
    catalog.updateProduct(db(), i.id, i.data)
  )
  handle('product:setActive', z.object({ id, active: z.boolean() }), WRITE, (i) =>
    catalog.setProductActive(db(), i.id, i.active)
  )

  // Variantes
  handle('variant:list', z.object({ productId: id }), READ, ({ productId }) =>
    catalog.listVariants(db(), productId)
  )
  handle(
    'variant:generate',
    z.object({
      productId: id,
      colorIds: z.array(id),
      sizeIds: z.array(id),
      salePrice: money,
      minStock: money
    }),
    WRITE,
    (i) => catalog.generateVariants(db(), i)
  )
  handle(
    'variant:update',
    z.object({
      id,
      data: z.object({ sku: z.string().trim().min(1, 'El SKU es obligatorio'), salePrice: money, minStock: money })
    }),
    WRITE,
    (i) => catalog.updateVariant(db(), i.id, i.data)
  )
  handle('variant:setActive', z.object({ id, active: z.boolean() }), WRITE, (i) =>
    catalog.setVariantActive(db(), i.id, i.active)
  )
}
