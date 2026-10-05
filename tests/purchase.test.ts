import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from './helpers'
import { createAdmin } from '../src/main/services/auth.service'
import {
  createProduct,
  generateVariants,
  listLookup,
  listVariants
} from '../src/main/services/catalog.service'
import {
  createPurchase,
  getPurchase,
  listPurchases,
  voidPurchase
} from '../src/main/services/purchase.service'
import { inventorySummary, listInventory, listMovements } from '../src/main/services/inventory.service'
import { variant } from '../src/main/db/schema'

function setup() {
  const { db } = createTestDb()
  const admin = createAdmin(db, { businessName: 'T', name: 'Ana', username: 'ana', password: 'secreto1' })
  const cat = listLookup(db, 'category')[0]
  const negro = listLookup(db, 'color').find((c) => c.name === 'Negro')!
  const [s, m] = listLookup(db, 'size').slice(1, 3)
  const mk = (ref: string, price = 25000) => {
    const p = createProduct(db, { categoryId: cat.id, name: `Prod ${ref}`, reference: ref })
    generateVariants(db, { productId: p.id, colorIds: [negro.id], sizeIds: [s.id, m.id], salePrice: price, minStock: 2 })
    return listVariants(db, p.id)
  }
  const stockOf = (id: number) => db.select().from(variant).where(eq(variant.id, id)).get()!
  return { db, admin, mk, stockOf }
}

const date = '2026-10-05'

describe('compras', () => {
  it('Caso 1: 10 × $12.000 + envío $10.000 → stock 10, costo real $13.000', () => {
    const { db, admin, mk, stockOf } = setup()
    const [v] = mk('BL001')
    const res = createPurchase(db, admin.id, {
      purchaseDate: date,
      shippingCost: 10000,
      otherCost: 0,
      items: [{ variantId: v.id, quantity: 10, unitCost: 12000 }]
    })
    expect(res.number).toBe('C-000001')
    expect(stockOf(v.id)).toMatchObject({ stock: 10, avgCost: 13000 })

    const detail = getPurchase(db, res.id)
    expect(detail.totalCost).toBe(130000)
    expect(detail.items[0]).toMatchObject({ realUnitCost: 13000, allocatedExtra: 10000 })

    const moves = listMovements(db, v.id)
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({ type: 'PURCHASE', quantity: 10, refNumber: 'C-000001' })
  })

  it('reparte el envío proporcional al valor entre líneas', () => {
    const { db, admin, mk } = setup()
    const [blusa] = mk('BL001')
    const [vestido] = mk('VE001')
    const res = createPurchase(db, admin.id, {
      purchaseDate: date,
      shippingCost: 6000,
      otherCost: 0,
      items: [
        { variantId: blusa.id, quantity: 1, unitCost: 10000 },
        { variantId: vestido.id, quantity: 1, unitCost: 50000 }
      ]
    })
    const items = getPurchase(db, res.id).items
    expect(items.map((i) => i.allocatedExtra)).toEqual([1000, 5000])
    expect(items.map((i) => i.realUnitCost)).toEqual([11000, 55000])
  })

  it('una segunda compra a otro costo recalcula el promedio ponderado', () => {
    const { db, admin, mk, stockOf } = setup()
    const [v] = mk('BL001')
    const buy = (qty: number, cost: number) =>
      createPurchase(db, admin.id, {
        purchaseDate: date,
        shippingCost: 0,
        otherCost: 0,
        items: [{ variantId: v.id, quantity: qty, unitCost: cost }]
      })
    buy(10, 13000)
    buy(10, 15000)
    expect(stockOf(v.id)).toMatchObject({ stock: 20, avgCost: 14000 })
  })

  it('valida entradas', () => {
    const { db, admin, mk } = setup()
    const [v] = mk('BL001')
    const base = { purchaseDate: date, shippingCost: 0, otherCost: 0 }
    expect(() => createPurchase(db, admin.id, { ...base, items: [] })).toThrow('al menos un producto')
    expect(() =>
      createPurchase(db, admin.id, { ...base, items: [{ variantId: v.id, quantity: 0, unitCost: 1 }] })
    ).toThrow('cantidad')
    expect(() =>
      createPurchase(db, admin.id, { ...base, items: [{ variantId: v.id, quantity: 1, unitCost: -5 }] })
    ).toThrow('costo')
    expect(() =>
      createPurchase(db, admin.id, {
        ...base,
        purchaseDate: '2026-02-31',
        items: [{ variantId: v.id, quantity: 1, unitCost: 1 }]
      })
    ).toThrow('fecha')
  })

  it('si una línea falla, no queda nada guardado (transacción)', () => {
    const { db, admin, mk, stockOf } = setup()
    const [v] = mk('BL001')
    expect(() =>
      createPurchase(db, admin.id, {
        purchaseDate: date,
        shippingCost: 0,
        otherCost: 0,
        items: [
          { variantId: v.id, quantity: 5, unitCost: 1000 },
          { variantId: 99999, quantity: 1, unitCost: 1000 }
        ]
      })
    ).toThrow('no existe')
    expect(stockOf(v.id).stock).toBe(0)
    expect(listPurchases(db)).toHaveLength(0)
  })

  it('inventario inicial: número I-, sin proveedor ni extras', () => {
    const { db, admin, mk, stockOf } = setup()
    const [v] = mk('BL001')
    const res = createPurchase(db, admin.id, {
      purchaseDate: date,
      isOpeningStock: true,
      shippingCost: 99999,
      otherCost: 99999,
      items: [{ variantId: v.id, quantity: 8, unitCost: 9000 }]
    })
    expect(res.number).toBe('I-000001')
    expect(stockOf(v.id)).toMatchObject({ stock: 8, avgCost: 9000 })
    expect(getPurchase(db, res.id)).toMatchObject({ shippingCost: 0, otherCost: 0, notes: 'Inventario inicial' })
  })
})

describe('anular compra', () => {
  it('revierte stock y costo promedio', () => {
    const { db, admin, mk, stockOf } = setup()
    const [v] = mk('BL001')
    const buy = (qty: number, cost: number) =>
      createPurchase(db, admin.id, {
        purchaseDate: date,
        shippingCost: 0,
        otherCost: 0,
        items: [{ variantId: v.id, quantity: qty, unitCost: cost }]
      })
    buy(10, 13000)
    const second = buy(10, 15000)
    voidPurchase(db, admin.id, second.id, 'Error de digitación')
    expect(stockOf(v.id)).toMatchObject({ stock: 10, avgCost: 13000 })
    expect(getPurchase(db, second.id)).toMatchObject({ status: 'VOIDED', voidReason: 'Error de digitación' })
    expect(listMovements(db, v.id).map((m) => m.type)).toEqual(['PURCHASE_VOID', 'PURCHASE', 'PURCHASE'])
    expect(() => voidPurchase(db, admin.id, second.id, 'otra vez')).toThrow('ya está anulada')
  })

  it('se rechaza si ya no hay stock suficiente de esas unidades', () => {
    const { db, admin, mk, stockOf } = setup()
    const [v] = mk('BL001')
    const res = createPurchase(db, admin.id, {
      purchaseDate: date,
      shippingCost: 0,
      otherCost: 0,
      items: [{ variantId: v.id, quantity: 5, unitCost: 1000 }]
    })
    db.update(variant).set({ stock: 3 }).where(eq(variant.id, v.id)).run() // simula ventas
    expect(() => voidPurchase(db, admin.id, res.id, 'x')).toThrow('ya se vendieron')
    expect(stockOf(v.id).stock).toBe(3)
    expect(getPurchase(db, res.id).status).toBe('ACTIVE')
  })

  it('exige motivo', () => {
    const { db, admin } = setup()
    expect(() => voidPurchase(db, admin.id, 1, '  ')).toThrow('motivo')
  })
})

describe('inventario', () => {
  it('lista, filtra por estado y resume valores', () => {
    const { db, admin, mk } = setup()
    const [a, b] = mk('BL001', 25000) // a: S, b: M
    createPurchase(db, admin.id, {
      purchaseDate: date,
      shippingCost: 0,
      otherCost: 0,
      items: [
        { variantId: a.id, quantity: 10, unitCost: 12000 },
        { variantId: b.id, quantity: 2, unitCost: 12000 } // min_stock 2 → bajo stock
      ]
    })
    const [c] = mk('FA001') // sin stock → agotado
    expect(c.stock).toBe(0)

    expect(listInventory(db)).toHaveLength(4)
    expect(listInventory(db, { status: 'low' }).map((r) => r.variantId)).toEqual([b.id])
    expect(listInventory(db, { status: 'out' })).toHaveLength(2)
    expect(listInventory(db, { search: 'FA001' })).toHaveLength(2)
    expect(listInventory(db, { limit: 1 })).toHaveLength(1)

    expect(inventorySummary(db)).toEqual({
      units: 12,
      valueAtCost: 12 * 12000,
      valueAtPrice: 12 * 25000,
      potentialProfit: 12 * 13000,
      lowCount: 1,
      outCount: 2
    })
  })
})
