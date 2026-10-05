import { z } from 'zod'
import type { Db } from '../db/client'
import { getDb } from '../db/instance'
import * as expenses from '../services/expense.service'
import { handle, type HandlerOptions } from './handler'

const id = z.number().int().positive()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es válida')
const ADMIN: HandlerOptions = { access: ['ADMIN'] }

const expenseSchema = z.object({
  expenseCategoryId: id,
  description: z.string().trim().min(1, 'La descripción es obligatoria'),
  amount: z.number().int().positive('El valor debe ser mayor a 0'),
  expenseDate: date,
  paymentMethodId: id,
  notes: z.string().nullish()
})

export function registerExpenseIpc(): void {
  const db = (): Db => getDb().db

  handle('expense:create', expenseSchema, ADMIN, (input, user) =>
    expenses.createExpense(db(), user!.id, input)
  )
  handle('expense:update', z.object({ id, data: expenseSchema }), ADMIN, (i) =>
    expenses.updateExpense(db(), i.id, i.data)
  )
  handle('expense:void', z.object({ id, reason: z.string() }), ADMIN, (i) =>
    expenses.voidExpense(db(), i.id, i.reason)
  )
  handle(
    'expense:list',
    z.object({
      from: date.optional(),
      to: date.optional(),
      categoryId: id.optional(),
      paymentMethodId: id.optional(),
      status: z.enum(['ACTIVE', 'VOIDED']).optional()
    }),
    ADMIN,
    (f) => expenses.listExpenses(db(), f)
  )
}
