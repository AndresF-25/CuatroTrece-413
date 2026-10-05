import { z } from 'zod'
import type { Db } from '../db/client'
import { getDb } from '../db/instance'
import * as inventory from '../services/inventory.service'
import * as purchases from '../services/purchase.service'
import { handle, type HandlerOptions } from './handler'

const id = z.number().int().positive()
const money = z.number().int().min(0, 'El valor no puede ser negativo')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es válida')

const READ: HandlerOptions = { access: ['ADMIN', 'SELLER'] }
const ADMIN: HandlerOptions = { access: ['ADMIN'] }

const createSchema = z.object({
  supplierId: id.nullish(),
  purchaseDate: date,
  notes: z.string().nullish(),
  shippingCost: money,
  otherCost: money,
  isOpeningStock: z.boolean().optional(),
  items: z
    .array(
      z.object({
        variantId: id,
        quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
        unitCost: money
      })
    )
    .min(1, 'Agrega al menos un producto')
})

export function registerPurchaseIpc(): void {
  const db = (): Db => getDb().db

  handle('purchase:create', createSchema, ADMIN, (input, user) =>
    purchases.createPurchase(db(), user!.id, input)
  )
  handle('purchase:list', z.object({ from: date.optional(), to: date.optional() }), ADMIN, (f) =>
    purchases.listPurchases(db(), f)
  )
  handle('purchase:get', z.object({ id }), ADMIN, ({ id }) => purchases.getPurchase(db(), id))
  handle('purchase:void', z.object({ id, reason: z.string() }), ADMIN, (i, user) =>
    purchases.voidPurchase(db(), user!.id, i.id, i.reason)
  )

  handle(
    'inventory:list',
    z.object({
      search: z.string().optional(),
      categoryId: id.optional(),
      colorId: id.optional(),
      sizeId: id.optional(),
      status: z.enum(['all', 'low', 'out']).optional(),
      limit: z.number().int().positive().max(500).optional()
    }),
    READ,
    (f) => inventory.listInventory(db(), f)
  )
  handle('inventory:summary', z.undefined(), READ, () => inventory.inventorySummary(db()))
  handle('inventory:movements', z.object({ variantId: id }), READ, ({ variantId }) =>
    inventory.listMovements(db(), variantId)
  )
}
