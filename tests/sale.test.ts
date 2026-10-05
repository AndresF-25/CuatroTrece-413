import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from './helpers'
import { createAdmin } from '../src/main/services/auth.service'
import {
  createProduct,
  generateVariants,
  listLookup,
  listVariants,
  setLookupActive
} from '../src/main/services/catalog.service'
import { createPurchase, voidPurchase } from '../src/main/services/purchase.service'
import { createSale, getSale, listSales, voidSale } from '../src/main/services/sale.service'
import { listMovements } from '../src/main/services/inventory.service'
import { saleItem, variant } from '../src/main/db/schema'

function setup() {
  const { db } = createTestDb()
  const admin = createAdmin(db, { businessName: 'T', name: 'Ana', username: 'ana', password: 'secreto1' })
  const cat = listLookup(db, 'category')[0]
  const negro = listLookup(db, 'color').find((c) => c.name === 'Negro')!
  const sizes = listLookup(db, 'size')
  const efectivo = listLookup(db, 'paymentMethod').find((m) => m.name === 'Efectivo')!

  const mk = (ref: string) => {
    const p = createProduct(db, { categoryId: cat.id, name: `Prod ${ref}`, reference: ref })
    generateVariants(db, { productId: p.id, colorIds: [negro.id], sizeIds: [sizes[1].id], salePrice: 25000, minStock: 0 })
    return listVariants(db, p.id)[0]
  }
  const buy = (variantId: number, quantity: number, unitCost: number, shippingCost = 0) =>
    createPurchase(db, admin.id, {
      purchaseDate: '2026-10-01',
      shippingCost,
      otherCost: 0,
      items: [{ variantId, quantity, unitCost }]
    })
  const sell = (items: { variantId: number; quantity: number; unitPrice: number }[], discount = 0, date = '2026-10-05') =>
    createSale(db, admin.id, { saleDate: date, paymentMethodId: efectivo.id, discount, items })
  const row = (id: number) => db.select().from(variant).where(eq(variant.id, id)).get()!
  return { db, admin, mk, buy, sell, row, efectivo }
}

describe('ventas', () => {
  it('Caso 2: vender 2 de 10 → stock 8, costo, utilidad y movimiento', () => {
    const { db, admin, mk, buy, sell, row } = setup()
    const v = mk('BL001')
    buy(v.id, 10, 12000, 10000) // costo real 13.000
    const res = sell([{ variantId: v.id, quantity: 2, unitPrice: 25000 }])

    expect(res.number).toBe('V-000001')
    expect(row(v.id).stock).toBe(8)

    const s = getSale(db, res.id)
    expect(s).toMatchObject({ subtotal: 50000, discount: 0, total: 50000, totalCost: 26000, grossProfit: 24000 })
    expect(s.items[0]).toMatchObject({ unitCost: 13000, lineCost: 26000, lineTotal: 50000 })

    const moves = listMovements(db, v.id)
    expect(moves[0]).toMatchObject({ type: 'SALE', quantity: -2, unitCost: 13000, refNumber: 'V-000001' })
    expect(moves[0].userName).toBe(admin.name)
  })

  it('el margen del plan: venta $25.000 con costo $12.600 → utilidad $12.400', () => {
    const { db, mk, buy, sell } = setup()
    const v = mk('BL001')
    buy(v.id, 50, 12000, 30000) // 600 extra por unidad → 12.600
    const res = sell([{ variantId: v.id, quantity: 1, unitPrice: 25000 }])
    const s = getSale(db, res.id)
    expect(s.totalCost).toBe(12600)
    expect(s.grossProfit).toBe(12400)
    expect(Math.round((s.grossProfit / s.total) * 1000) / 10).toBe(49.6)
  })

  it('Caso 4: stock insuficiente bloquea la venta y no deja rastro', () => {
    const { db, mk, buy, sell, row } = setup()
    const v = mk('BL001')
    buy(v.id, 3, 10000)
    expect(() => sell([{ variantId: v.id, quantity: 4, unitPrice: 25000 }])).toThrow('Stock insuficiente')
    expect(row(v.id).stock).toBe(3)
    expect(listSales(db)).toHaveLength(0)
  })

  it('valida stock sumando líneas repetidas de la misma variante', () => {
    const { mk, buy, sell, row } = setup()
    const v = mk('BL001')
    buy(v.id, 5, 10000)
    expect(() =>
      sell([
        { variantId: v.id, quantity: 3, unitPrice: 25000 },
        { variantId: v.id, quantity: 3, unitPrice: 25000 }
      ])
    ).toThrow('Stock insuficiente')
    expect(row(v.id).stock).toBe(5)
  })

  it('si una línea falla se revierte toda la venta (transacción)', () => {
    const { db, mk, buy, sell, row } = setup()
    const a = mk('BL001')
    const b = mk('FA001')
    buy(a.id, 5, 10000)
    buy(b.id, 1, 10000)
    expect(() =>
      sell([
        { variantId: a.id, quantity: 2, unitPrice: 25000 },
        { variantId: b.id, quantity: 9, unitPrice: 25000 }
      ])
    ).toThrow('Stock insuficiente')
    expect(row(a.id).stock).toBe(5)
    expect(listSales(db)).toHaveLength(0)
  })

  it('Caso 6 (descuento): las líneas siempre suman el total, incluso con residuo', () => {
    const { db, mk, buy, sell } = setup()
    const a = mk('BL001')
    const b = mk('FA001')
    buy(a.id, 5, 10000)
    buy(b.id, 5, 10000)
    const res = sell(
      [
        { variantId: a.id, quantity: 1, unitPrice: 10000 },
        { variantId: b.id, quantity: 1, unitPrice: 20000 },
        { variantId: a.id, quantity: 1, unitPrice: 7777 }
      ],
      1001
    )
    const s = getSale(db, res.id)
    expect(s.subtotal).toBe(37777)
    expect(s.total).toBe(36776)
    expect(s.items.reduce((x, i) => x + i.lineDiscount, 0)).toBe(1001)
    expect(s.items.reduce((x, i) => x + i.lineTotal, 0)).toBe(s.total)
  })

  it('rechaza descuento mayor al subtotal, método inválido, cantidades/precios inválidos y fecha mala', () => {
    const { db, admin, mk, buy, sell, efectivo } = setup()
    const v = mk('BL001')
    buy(v.id, 5, 10000)
    const item = { variantId: v.id, quantity: 1, unitPrice: 1000 }
    expect(() => sell([item], 1001)).toThrow('descuento')
    expect(() => createSale(db, admin.id, { saleDate: '2026-10-05', paymentMethodId: 999, discount: 0, items: [item] })).toThrow('método de pago')
    expect(() => sell([{ ...item, quantity: 0 }])).toThrow('cantidad')
    expect(() => sell([{ ...item, unitPrice: -1 }])).toThrow('precio')
    expect(() => sell([item], 0, '2026-13-01')).toThrow('fecha')
    expect(() => sell([])).toThrow('al menos un producto')

    setLookupActive(db, 'paymentMethod', efectivo.id, false)
    expect(() => sell([item])).toThrow('método de pago')
  })

  it('no permite vender variantes inactivas', () => {
    const { db, mk, buy, sell } = setup()
    const v = mk('BL001')
    buy(v.id, 5, 10000)
    db.update(variant).set({ active: false }).where(eq(variant.id, v.id)).run()
    expect(() => sell([{ variantId: v.id, quantity: 1, unitPrice: 1 }])).toThrow('inactiva')
  })

  it('el costo de la venta queda fijo aunque luego cambie el costo promedio', () => {
    const { db, mk, buy, sell } = setup()
    const v = mk('BL001')
    buy(v.id, 10, 10000)
    const res = sell([{ variantId: v.id, quantity: 2, unitPrice: 25000 }])
    buy(v.id, 10, 20000) // el promedio sube
    const s = getSale(db, res.id)
    expect(s.items[0].unitCost).toBe(10000)
    expect(s.totalCost).toBe(20000)
    expect(db.select().from(saleItem).get()!.lineCost).toBe(20000)
  })
})

describe('anular venta', () => {
  it('Caso 7: queda VOIDED, restituye stock y conserva el historial', () => {
    const { db, admin, mk, buy, sell, row } = setup()
    const v = mk('BL001')
    buy(v.id, 10, 12000)
    const res = sell([{ variantId: v.id, quantity: 4, unitPrice: 25000 }])
    expect(row(v.id).stock).toBe(6)

    voidSale(db, admin.id, res.id, 'Cliente se arrepintió')
    expect(row(v.id)).toMatchObject({ stock: 10, avgCost: 12000 })

    const s = getSale(db, res.id)
    expect(s).toMatchObject({ status: 'VOIDED', voidReason: 'Cliente se arrepintió' })
    expect(s.items).toHaveLength(1) // no se borra
    expect(listMovements(db, v.id).map((m) => m.type)).toEqual(['SALE_VOID', 'SALE', 'PURCHASE'])
    expect(listSales(db, { status: 'COMPLETED' })).toHaveLength(0)
    expect(listSales(db, { status: 'VOIDED' })).toHaveLength(1)

    expect(() => voidSale(db, admin.id, res.id, 'otra')).toThrow('ya está anulada')
  })

  it('al anular, el costo promedio se pondera con el costo de la venta original', () => {
    const { db, admin, mk, buy, sell, row } = setup()
    const v = mk('BL001')
    buy(v.id, 10, 13000)
    const res = sell([{ variantId: v.id, quantity: 2, unitPrice: 25000 }]) // costo 13.000
    buy(v.id, 10, 15000) // stock 18, promedio (8*13000+10*15000)/18 = 14.111
    voidSale(db, admin.id, res.id, 'x')
    // (18 × 14.111 + 2 × 13.000) / 20 ≈ 14.000
    expect(row(v.id).stock).toBe(20)
    expect(row(v.id).avgCost).toBe(14000)
  })

  it('exige motivo y existencia', () => {
    const { db, admin } = setup()
    expect(() => voidSale(db, admin.id, 1, ' ')).toThrow('motivo')
    expect(() => voidSale(db, admin.id, 99, 'x')).toThrow('no encontrada')
  })

  it('anular una venta permite anular la compra que alimentó ese stock', () => {
    const { db, admin, mk, buy, sell } = setup()
    const v = mk('BL001')
    const p = buy(v.id, 5, 10000)
    const s = sell([{ variantId: v.id, quantity: 2, unitPrice: 25000 }])
    expect(() => voidPurchase(db, admin.id, p.id, 'x')).toThrow('ya se vendieron')
    voidSale(db, admin.id, s.id, 'x')
    voidPurchase(db, admin.id, p.id, 'x')
  })
})

describe('listado', () => {
  it('filtra por fecha, estado y usuario', () => {
    const { db, admin, mk, buy, sell } = setup()
    const v = mk('BL001')
    buy(v.id, 20, 10000)
    sell([{ variantId: v.id, quantity: 1, unitPrice: 25000 }], 0, '2026-10-01')
    sell([{ variantId: v.id, quantity: 1, unitPrice: 25000 }], 0, '2026-10-05')
    const last = sell([{ variantId: v.id, quantity: 1, unitPrice: 25000 }], 0, '2026-10-05')
    voidSale(db, admin.id, last.id, 'x')

    expect(listSales(db)).toHaveLength(3)
    expect(listSales(db, { from: '2026-10-05', to: '2026-10-05' })).toHaveLength(2)
    expect(listSales(db, { from: '2026-10-05', status: 'COMPLETED' })).toHaveLength(1)
    expect(listSales(db, { userId: admin.id })).toHaveLength(3)
    expect(listSales(db, { userId: 999 })).toHaveLength(0)
    expect(listSales(db)[0].paymentMethodName).toBe('Efectivo')
    expect(() => getSale(db, last.id, 999)).toThrow('no encontrada')
  })
})
