import { count } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { Db } from './client'
import { category, color, expenseCategory, paymentMethod, setting, size } from './schema'

const PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Bancolombia', 'Tarjeta', 'Otro']
const EXPENSE_CATEGORIES = [
  'Transporte',
  'Publicidad',
  'Empaque',
  'Domicilios',
  'Arriendo',
  'Servicios',
  'Comisiones',
  'Mantenimiento',
  'Otros'
]
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const COLORS = ['Negro', 'Blanco', 'Rojo', 'Azul', 'Beige']
const CATEGORIES = ['Blusas', 'Vestidos', 'Pantalones', 'Faldas', 'Otros']

/**
 * Datos base que la app necesita para funcionar. Solo se insertan cuando la
 * tabla está vacía, así nunca pisan lo que el usuario haya editado.
 */
export function seedBaseData(db: Db): void {
  db.transaction((tx) => {
    const isEmpty = (t: SQLiteTable): boolean => tx.select({ n: count() }).from(t).get()!.n === 0

    if (isEmpty(paymentMethod)) {
      tx.insert(paymentMethod).values(PAYMENT_METHODS.map((name) => ({ name }))).run()
    }
    if (isEmpty(expenseCategory)) {
      tx.insert(expenseCategory).values(EXPENSE_CATEGORIES.map((name) => ({ name }))).run()
    }
    if (isEmpty(size)) {
      tx.insert(size).values(SIZES.map((name, i) => ({ name, sortOrder: i }))).run()
    }
    if (isEmpty(color)) {
      tx.insert(color).values(COLORS.map((name) => ({ name }))).run()
    }
    if (isEmpty(category)) {
      tx.insert(category).values(CATEGORIES.map((name) => ({ name }))).run()
    }
    if (isEmpty(setting)) {
      tx.insert(setting)
        .values([
          { key: 'business_name', value: '413' },
          { key: 'currency', value: 'COP' }
        ])
        .run()
    }
  })
}
