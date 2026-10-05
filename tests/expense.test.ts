import { describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'
import { createAdmin } from '../src/main/services/auth.service'
import { listLookup } from '../src/main/services/catalog.service'
import {
  createExpense,
  listExpenses,
  updateExpense,
  voidExpense
} from '../src/main/services/expense.service'

function setup() {
  const { db } = createTestDb()
  const admin = createAdmin(db, { businessName: 'T', name: 'Ana', username: 'ana', password: 'secreto1' })
  const cats = listLookup(db, 'expenseCategory')
  const method = listLookup(db, 'paymentMethod')[0]
  const publicidad = cats.find((c) => c.name === 'Publicidad')!
  const input = {
    expenseCategoryId: publicidad.id,
    description: 'Anuncios en Instagram',
    amount: 50000,
    expenseDate: '2026-10-05',
    paymentMethodId: method.id
  }
  return { db, admin, cats, method, input }
}

describe('gastos', () => {
  it('registra y lista con categoría, método y usuario', () => {
    const { db, admin, input } = setup()
    createExpense(db, admin.id, input)
    const [e] = listExpenses(db)
    expect(e).toMatchObject({
      categoryName: 'Publicidad',
      description: 'Anuncios en Instagram',
      amount: 50000,
      status: 'ACTIVE',
      userName: 'Ana'
    })
  })

  it('valida descripción, monto, fecha, categoría y método', () => {
    const { db, admin, input } = setup()
    expect(() => createExpense(db, admin.id, { ...input, description: ' ' })).toThrow('descripción')
    expect(() => createExpense(db, admin.id, { ...input, amount: 0 })).toThrow('mayor a 0')
    expect(() => createExpense(db, admin.id, { ...input, amount: 10.5 })).toThrow('entero')
    expect(() => createExpense(db, admin.id, { ...input, expenseDate: 'ayer' })).toThrow('fecha')
    expect(() => createExpense(db, admin.id, { ...input, expenseCategoryId: 999 })).toThrow('categoría')
    expect(() => createExpense(db, admin.id, { ...input, paymentMethodId: 999 })).toThrow('método de pago')
    expect(listExpenses(db)).toHaveLength(0)
  })

  it('edita un gasto vigente pero no uno anulado', () => {
    const { db, admin, input } = setup()
    const { id } = createExpense(db, admin.id, input)
    updateExpense(db, id, { ...input, amount: 60000, description: 'Anuncios' })
    expect(listExpenses(db)[0]).toMatchObject({ amount: 60000, description: 'Anuncios' })

    voidExpense(db, id, 'Duplicado')
    expect(() => updateExpense(db, id, input)).toThrow('anulado')
    expect(() => updateExpense(db, 999, input)).toThrow('no encontrado')
  })

  it('anular conserva el registro, exige motivo y no se repite', () => {
    const { db, admin, input } = setup()
    const { id } = createExpense(db, admin.id, input)
    expect(() => voidExpense(db, id, ' ')).toThrow('motivo')
    voidExpense(db, id, 'Error de registro')
    expect(listExpenses(db)[0]).toMatchObject({ status: 'VOIDED', voidReason: 'Error de registro' })
    expect(() => voidExpense(db, id, 'otra')).toThrow('ya está anulado')
  })

  it('filtra por fecha, categoría, método y estado', () => {
    const { db, admin, cats, method, input } = setup()
    const transporte = cats.find((c) => c.name === 'Transporte')!
    createExpense(db, admin.id, { ...input, expenseDate: '2026-10-01' })
    createExpense(db, admin.id, { ...input, expenseCategoryId: transporte.id, expenseDate: '2026-10-05' })
    const { id } = createExpense(db, admin.id, { ...input, expenseDate: '2026-10-05' })
    voidExpense(db, id, 'x')

    expect(listExpenses(db)).toHaveLength(3)
    expect(listExpenses(db, { from: '2026-10-05' })).toHaveLength(2)
    expect(listExpenses(db, { to: '2026-10-01' })).toHaveLength(1)
    expect(listExpenses(db, { categoryId: transporte.id })).toHaveLength(1)
    expect(listExpenses(db, { status: 'ACTIVE' })).toHaveLength(2)
    expect(listExpenses(db, { paymentMethodId: method.id })).toHaveLength(3)
    expect(listExpenses(db, { paymentMethodId: 999 })).toHaveLength(0)
  })
})
