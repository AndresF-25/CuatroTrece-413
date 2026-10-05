import { describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'
import { createAdmin } from '../src/main/services/auth.service'
import { createProduct, generateVariants, listLookup, listVariants } from '../src/main/services/catalog.service'
import { createPurchase } from '../src/main/services/purchase.service'
import { createSale } from '../src/main/services/sale.service'
import { createExpense } from '../src/main/services/expense.service'
import { buildExport, toCsv } from '../src/main/services/export.service'

describe('toCsv', () => {
  it('usa BOM UTF-8, ; como separador y CRLF', () => {
    const csv = toCsv([['a', 'b'], [1, 2]])
    expect(csv).toBe('﻿a;b\r\n1;2\r\n')
  })

  it('escapa ; comillas y saltos de línea', () => {
    expect(toCsv([['a;b', 'dice "hola"', 'l1\nl2', null]])).toBe('﻿"a;b";"dice ""hola""";"l1\nl2";\r\n')
  })

  it('neutraliza fórmulas de Excel en texto pero deja los números negativos', () => {
    const csv = toCsv([['=SUM(A1)', '+57300', '-x', '@cmd', -5000, 'normal']])
    expect(csv).toBe("﻿'=SUM(A1);'+57300;'-x;'@cmd;-5000;normal\r\n")
  })
})

function setup() {
  const { db } = createTestDb()
  const admin = createAdmin(db, { businessName: 'T', name: 'Ana', username: 'ana', password: 'secreto1' })
  const cat = listLookup(db, 'category')[0]
  const negro = listLookup(db, 'color').find((c) => c.name === 'Negro')!
  const sizes = listLookup(db, 'size')
  const method = listLookup(db, 'paymentMethod')[0].id
  const p = createProduct(db, { categoryId: cat.id, name: 'Blusa ñandú', reference: 'BL001' })
  generateVariants(db, { productId: p.id, colorIds: [negro.id], sizeIds: [sizes[1].id], salePrice: 25000, minStock: 1 })
  const v = listVariants(db, p.id)[0]
  createPurchase(db, admin.id, { purchaseDate: '2026-10-01', shippingCost: 10000, otherCost: 0, items: [{ variantId: v.id, quantity: 10, unitCost: 12000 }] })
  createSale(db, admin.id, { saleDate: '2026-10-05', customerName: '=cmd', paymentMethodId: method, discount: 5000, items: [{ variantId: v.id, quantity: 2, unitPrice: 25000 }] })
  createExpense(db, admin.id, { expenseCategoryId: listLookup(db, 'expenseCategory')[0].id, description: 'Anuncios; redes', amount: 50000, expenseDate: '2026-10-05', paymentMethodId: method })
  return { db }
}

const lines = (csv: string): string[] => csv.replace('﻿', '').trimEnd().split('\r\n')

describe('exportaciones', () => {
  it('ventas: una fila por línea con costo y utilidad', () => {
    const { db } = setup()
    const out = buildExport(db, 'sales', { from: '2026-10-01', to: '2026-10-31' })
    expect(out.filename).toBe('413_ventas_2026-10-01_a_2026-10-31.csv')
    const [head, row] = lines(out.content)
    expect(head.startsWith('Número;Fecha;Estado')).toBe(true)
    // total línea 45.000 (50.000 − 5.000 de descuento), costo 26.000, utilidad 19.000
    expect(row).toBe("V-000001;2026-10-05;Completada;'=cmd;Bancolombia;BL001-NEG-S;Blusa ñandú;Negro;S;2;25000;5000;45000;13000;26000;19000;Ana")
  })

  it('el filtro de fechas excluye lo que está fuera', () => {
    const { db } = setup()
    expect(lines(buildExport(db, 'sales', { from: '2026-11-01' }).content)).toHaveLength(1) // solo encabezado
    expect(lines(buildExport(db, 'expenses', { to: '2026-09-30' }).content)).toHaveLength(1)
  })

  it('compras, inventario y gastos', () => {
    const { db } = setup()
    expect(lines(buildExport(db, 'purchases').content)[1]).toBe('C-000001;2026-10-01;;Vigente;BL001-NEG-S;Blusa ñandú;Negro;S;10;12000;10000;130000;13000')
    expect(lines(buildExport(db, 'inventory').content)[1]).toBe('Blusa ñandú;BL001;Blusas;Negro;S;BL001-NEG-S;8;1;13000;25000;104000;200000')
    expect(lines(buildExport(db, 'expenses').content)[1]).toBe('2026-10-05;Arriendo;"Anuncios; redes";Bancolombia;50000;Vigente;;;Ana')
  })

  it('reporte del periodo exige rango y resume el resultado', () => {
    const { db } = setup()
    expect(() => buildExport(db, 'period', {})).toThrow('rango')
    const text = buildExport(db, 'period', { from: '2026-10-01', to: '2026-10-07' }).content
    expect(text).toContain('Total vendido;45000')
    expect(text).toContain('Utilidad bruta;19000')
    expect(text).toContain('Utilidad neta;-31000')
  })
})
