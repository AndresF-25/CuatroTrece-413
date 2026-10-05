import { describe, it, expect } from 'vitest'
import { count } from 'drizzle-orm'
import { createTestDb } from './helpers'
import { seedBaseData } from '../src/main/db/seed'
import { paymentMethod, size, variant, product, category, color, user } from '../src/main/db/schema'

describe('base de datos', () => {
  it('crea las tablas y carga los datos base', () => {
    const { db } = createTestDb()
    expect(db.select({ n: count() }).from(paymentMethod).get()!.n).toBe(5)
    expect(db.select({ n: count() }).from(size).get()!.n).toBeGreaterThan(0)
  })

  it('las claves foráneas están activas', () => {
    const { sqlite } = createTestDb()
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
  })

  it('no permite stock negativo ni variantes duplicadas', () => {
    const { db } = createTestDb()
    const cat = db.select().from(category).get()!
    const col = db.select().from(color).get()!
    const sz = db.select().from(size).get()!
    const p = db
      .insert(product)
      .values({ categoryId: cat.id, name: 'Blusa', reference: 'BL001' })
      .returning()
      .get()
    const base = { productId: p.id, colorId: col.id, sizeId: sz.id }

    expect(() => db.insert(variant).values({ ...base, sku: 'A', stock: -1 }).run()).toThrow()
    db.insert(variant).values({ ...base, sku: 'A' }).run()
    expect(() => db.insert(variant).values({ ...base, sku: 'B' }).run()).toThrow()
  })

  it('exige usuario válido en las tablas que lo referencian (FK)', () => {
    const { db } = createTestDb()
    expect(db.select({ n: count() }).from(user).get()!.n).toBe(0)
  })

  it('no repite los datos base si se vuelve a abrir', () => {
    const { db } = createTestDb()
    seedBaseData(db)
    expect(db.select({ n: count() }).from(paymentMethod).get()!.n).toBe(5)
  })
})
