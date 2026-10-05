import { z } from 'zod'
import type { Db } from '../db/client'
import { getDb } from '../db/instance'
import * as sales from '../services/sale.service'
import { handle, type HandlerOptions } from './handler'

const id = z.number().int().positive()
const money = z.number().int().min(0, 'El valor no puede ser negativo')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es válida')

const BOTH: HandlerOptions = { access: ['ADMIN', 'SELLER'] }
const ADMIN: HandlerOptions = { access: ['ADMIN'] }

const createSchema = z.object({
  saleDate: date,
  customerName: z.string().nullish(),
  notes: z.string().nullish(),
  paymentMethodId: id,
  discount: money,
  items: z
    .array(
      z.object({
        variantId: id,
        quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
        unitPrice: money
      })
    )
    .min(1, 'Agrega al menos un producto')
})

export function registerSaleIpc(): void {
  const db = (): Db => getDb().db

  handle('sale:create', createSchema, BOTH, (input, user) => sales.createSale(db(), user!.id, input))

  // El vendedor solo consulta sus propias ventas.
  handle(
    'sale:list',
    z.object({
      from: date.optional(),
      to: date.optional(),
      status: z.enum(['COMPLETED', 'VOIDED']).optional(),
      paymentMethodId: id.optional()
    }),
    BOTH,
    (filter, user) =>
      sales.listSales(db(), { ...filter, userId: user!.role === 'ADMIN' ? undefined : user!.id })
  )
  handle('sale:get', z.object({ id }), BOTH, ({ id }, user) =>
    sales.getSale(db(), id, user!.role === 'ADMIN' ? undefined : user!.id)
  )
  handle('sale:void', z.object({ id, reason: z.string() }), ADMIN, (i, user) =>
    sales.voidSale(db(), user!.id, i.id, i.reason)
  )
}
