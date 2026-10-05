import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm'
import type { Db } from '../db/client'
import { expense, expenseCategory, paymentMethod, user } from '../db/schema'
import { assertBusinessDate } from '../lib/dates'
import { AppError } from '../lib/errors'
import type { DocStatus, ExpenseRow } from '../../shared/types'

export interface ExpenseInput {
  expenseCategoryId: number
  description: string
  amount: number
  expenseDate: string
  paymentMethodId: number
  notes?: string | null
}

function validate(db: Db, input: ExpenseInput): void {
  if (!input.description.trim()) throw new AppError('La descripción es obligatoria')
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new AppError('El valor debe ser un entero mayor a 0')
  }
  assertBusinessDate(input.expenseDate, 'La fecha del gasto')

  const cat = db.select().from(expenseCategory).where(eq(expenseCategory.id, input.expenseCategoryId)).get()
  if (!cat) throw new AppError('Selecciona una categoría de gasto válida')
  const method = db.select().from(paymentMethod).where(eq(paymentMethod.id, input.paymentMethodId)).get()
  if (!method) throw new AppError('Selecciona un método de pago válido')
}

export function createExpense(db: Db, userId: number, input: ExpenseInput): { id: number } {
  validate(db, input)
  return db
    .insert(expense)
    .values({
      expenseCategoryId: input.expenseCategoryId,
      description: input.description.trim(),
      amount: input.amount,
      expenseDate: input.expenseDate,
      paymentMethodId: input.paymentMethodId,
      notes: input.notes?.trim() || null,
      userId
    })
    .returning({ id: expense.id })
    .get()
}

/** Solo se pueden editar gastos vigentes; un gasto anulado queda como historial. */
export function updateExpense(db: Db, id: number, input: ExpenseInput): void {
  validate(db, input)
  db.transaction((tx) => {
    const current = tx.select().from(expense).where(eq(expense.id, id)).get()
    if (!current) throw new AppError('Gasto no encontrado')
    if (current.status === 'VOIDED') throw new AppError('No se puede editar un gasto anulado')
    tx.update(expense)
      .set({
        expenseCategoryId: input.expenseCategoryId,
        description: input.description.trim(),
        amount: input.amount,
        expenseDate: input.expenseDate,
        paymentMethodId: input.paymentMethodId,
        notes: input.notes?.trim() || null
      })
      .where(eq(expense.id, id))
      .run()
  })
}

export function voidExpense(db: Db, id: number, reason: string): void {
  const why = reason.trim()
  if (!why) throw new AppError('Indica el motivo de la anulación')
  db.transaction((tx) => {
    const current = tx.select().from(expense).where(eq(expense.id, id)).get()
    if (!current) throw new AppError('Gasto no encontrado')
    if (current.status === 'VOIDED') throw new AppError('El gasto ya está anulado')
    tx.update(expense)
      .set({ status: 'VOIDED', voidedAt: new Date().toISOString(), voidReason: why })
      .where(eq(expense.id, id))
      .run()
  })
}

export interface ListExpensesFilter {
  from?: string
  to?: string
  categoryId?: number
  paymentMethodId?: number
  status?: DocStatus
}

export function listExpenses(db: Db, filter: ListExpensesFilter = {}): ExpenseRow[] {
  const conditions: (SQL | undefined)[] = [
    filter.from ? gte(expense.expenseDate, filter.from) : undefined,
    filter.to ? lte(expense.expenseDate, filter.to) : undefined,
    filter.categoryId ? eq(expense.expenseCategoryId, filter.categoryId) : undefined,
    filter.paymentMethodId ? eq(expense.paymentMethodId, filter.paymentMethodId) : undefined,
    filter.status ? eq(expense.status, filter.status) : undefined
  ]
  return db
    .select({
      id: expense.id,
      expenseCategoryId: expense.expenseCategoryId,
      categoryName: expenseCategory.name,
      description: expense.description,
      amount: expense.amount,
      expenseDate: expense.expenseDate,
      paymentMethodId: expense.paymentMethodId,
      paymentMethodName: paymentMethod.name,
      notes: expense.notes,
      status: expense.status,
      voidedAt: expense.voidedAt,
      voidReason: expense.voidReason,
      userName: user.name
    })
    .from(expense)
    .innerJoin(expenseCategory, eq(expenseCategory.id, expense.expenseCategoryId))
    .innerJoin(paymentMethod, eq(paymentMethod.id, expense.paymentMethodId))
    .innerJoin(user, eq(user.id, expense.userId))
    .where(and(...conditions))
    .orderBy(desc(expense.expenseDate), desc(expense.id))
    .all()
}
