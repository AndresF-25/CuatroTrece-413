import { describe, it, expect } from 'vitest'
import { createTestDb } from './helpers'
import {
  colorCode,
  createLookup,
  createProduct,
  generateVariants,
  listLookup,
  listProducts,
  listVariants,
  setLookupActive,
  updateVariant
} from '../src/main/services/catalog.service'
import { translateDbError } from '../src/main/lib/errors'

function setup() {
  const { db } = createTestDb()
  const cat = listLookup(db, 'category')[0]
  const colors = listLookup(db, 'color')
  const sizes = listLookup(db, 'size')
  const colorId = (name: string): number => colors.find((c) => c.name === name)!.id
  return { db, cat, colors, sizes, colorId }
}

function messageOf(fn: () => void): string | undefined {
  try {
    fn()
  } catch (e) {
    return translateDbError(e)?.message ?? (e as Error).message
  }
  return undefined
}

describe('catálogos simples', () => {
  it('crea, desactiva y rechaza nombres duplicados', () => {
    const { db } = setup()
    const c = createLookup(db, 'color', 'Verde')
    expect(listLookup(db, 'color').some((x) => x.name === 'Verde')).toBe(true)
    setLookupActive(db, 'color', c.id, false)
    expect(listLookup(db, 'color').find((x) => x.id === c.id)!.active).toBe(false)

    expect(messageOf(() => createLookup(db, 'color', 'Verde'))).toBe(
      'Ya existe un color con ese nombre'
    )
  })

  it('las tallas nuevas se ordenan al final', () => {
    const { db } = setup()
    const s = createLookup(db, 'size', 'XXXL')
    const sizes = listLookup(db, 'size')
    expect(sizes[sizes.length - 1].id).toBe(s.id)
  })

  it('exige nombre', () => {
    const { db } = setup()
    expect(() => createLookup(db, 'category', '  ')).toThrow('obligatorio')
  })
})

describe('productos', () => {
  it('valida campos obligatorios y referencia única', () => {
    const { db, cat } = setup()
    expect(() => createProduct(db, { categoryId: cat.id, name: '', reference: 'X' })).toThrow(
      'nombre'
    )
    expect(() => createProduct(db, { categoryId: cat.id, name: 'Blusa', reference: ' ' })).toThrow(
      'referencia'
    )
    createProduct(db, { categoryId: cat.id, name: 'Blusa', reference: 'bl001' })
    expect(
      messageOf(() => createProduct(db, { categoryId: cat.id, name: 'Otra', reference: 'BL001' }))
    ).toBe('Ya existe un producto con esa referencia')
  })

  it('lista con búsqueda, conteo de variantes y stock', () => {
    const { db, cat, colors, sizes } = setup()
    const p = createProduct(db, { categoryId: cat.id, name: 'Blusa lino', reference: 'BL001' })
    createProduct(db, { categoryId: cat.id, name: 'Falda', reference: 'FA001' })
    generateVariants(db, {
      productId: p.id,
      colorIds: [colors[0].id],
      sizeIds: sizes.slice(0, 2).map((s) => s.id),
      salePrice: 25000,
      minStock: 2
    })
    expect(listProducts(db)).toHaveLength(2)
    const found = listProducts(db, 'lino')
    expect(found).toHaveLength(1)
    expect(found[0].variantCount).toBe(2)
    expect(found[0].totalStock).toBe(0)
  })
})

describe('generador de variantes', () => {
  it('3 colores × 3 tallas crea 9 variantes con SKU autogenerado', () => {
    const { db, cat, sizes, colorId } = setup()
    const p = createProduct(db, { categoryId: cat.id, name: 'Blusa', reference: 'BL001' })
    const res = generateVariants(db, {
      productId: p.id,
      colorIds: [colorId('Negro'), colorId('Azul'), colorId('Rojo')],
      sizeIds: sizes.slice(1, 4).map((s) => s.id), // S, M, L
      salePrice: 25000,
      minStock: 1
    })
    expect(res).toEqual({ created: 9, skipped: 0 })
    const variants = listVariants(db, p.id)
    expect(variants).toHaveLength(9)
    expect(new Set(variants.map((v) => v.sku)).size).toBe(9)
    expect(variants.some((v) => v.sku === 'BL001-NEG-M')).toBe(true)
    expect(variants.every((v) => v.salePrice === 25000)).toBe(true)
  })

  it('no duplica combinaciones existentes al volver a generar', () => {
    const { db, cat, sizes, colorId } = setup()
    const p = createProduct(db, { categoryId: cat.id, name: 'Blusa', reference: 'BL001' })
    const base = { productId: p.id, sizeIds: [sizes[0].id], salePrice: 1000, minStock: 0 }
    generateVariants(db, { ...base, colorIds: [colorId('Negro')] })
    const res = generateVariants(db, { ...base, colorIds: [colorId('Negro'), colorId('Rojo')] })
    expect(res).toEqual({ created: 1, skipped: 1 })
  })

  it('evita SKU repetidos si ya existe uno igual', () => {
    const { db, cat, sizes, colorId } = setup()
    const a = createProduct(db, { categoryId: cat.id, name: 'A', reference: 'BL1' })
    const params = { colorIds: [colorId('Negro')], sizeIds: [sizes[0].id], salePrice: 0, minStock: 0 }
    generateVariants(db, { ...params, productId: a.id })

    // SKU manual que choca con el que se generaría para otro producto
    const b = createProduct(db, { categoryId: cat.id, name: 'B', reference: 'BL2' })
    const [va] = listVariants(db, a.id)
    updateVariant(db, va.id, { sku: 'BL2-NEG-XS', salePrice: 0, minStock: 0 })
    generateVariants(db, { ...params, productId: b.id })
    expect(listVariants(db, b.id)[0].sku).toBe('BL2-NEG-XS-2')
  })

  it('exige color y talla', () => {
    const { db, cat, colors } = setup()
    const p = createProduct(db, { categoryId: cat.id, name: 'Blusa', reference: 'BL001' })
    expect(() =>
      generateVariants(db, {
        productId: p.id,
        colorIds: [colors[0].id],
        sizeIds: [],
        salePrice: 0,
        minStock: 0
      })
    ).toThrow('al menos un color y una talla')
  })

  it('rechaza SKU duplicado al editar', () => {
    const { db, cat, colors, sizes } = setup()
    const p = createProduct(db, { categoryId: cat.id, name: 'Blusa', reference: 'BL001' })
    generateVariants(db, {
      productId: p.id,
      colorIds: [colors[0].id],
      sizeIds: [sizes[0].id, sizes[1].id],
      salePrice: 0,
      minStock: 0
    })
    const [v1, v2] = listVariants(db, p.id)
    expect(
      messageOf(() =>
        updateVariant(db, v2.id, { sku: v1.sku.toLowerCase(), salePrice: 0, minStock: 0 })
      )
    ).toBe('Ya existe una variante con ese SKU')
  })
})

describe('colorCode', () => {
  it('quita tildes y limita a 3 caracteres', () => {
    expect(colorCode('Negro')).toBe('NEG')
    expect(colorCode('Ámbar')).toBe('AMB')
    expect(colorCode('Azul Cielo')).toBe('AZU')
  })
})
