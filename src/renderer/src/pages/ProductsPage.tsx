import { useState, type FormEvent } from 'react'
import { ArrowLeft, Layers, Pencil, Plus, Search } from 'lucide-react'
import { clsx } from 'clsx'
import type { ProductRow, VariantRow } from '../../../shared/types'
import { errorMessage, unwrap, useLoad } from '../lib/api'
import { formatCOP } from '../lib/format'
import { Alert, Badge, Button, Card, Field, Select } from '../components/ui'
import { Modal } from '../components/Modal'
import { LookupManager } from '../components/LookupManager'

type Tab = 'products' | 'category' | 'color' | 'size'

const TABS: { id: Tab; label: string }[] = [
  { id: 'products', label: 'Productos' },
  { id: 'category', label: 'Categorías' },
  { id: 'color', label: 'Colores' },
  { id: 'size', label: 'Tallas' }
]

export function ProductsPage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('products')
  const [selected, setSelected] = useState<ProductRow | null>(null)

  if (selected) {
    return <ProductDetail productId={selected.id} onBack={() => setSelected(null)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
              tab === t.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'products' && <ProductList onOpen={setSelected} />}
      {tab === 'category' && <LookupManager kind="category" singular="Categoría" plural="categorías" />}
      {tab === 'color' && <LookupManager kind="color" singular="Color" plural="colores" />}
      {tab === 'size' && <LookupManager kind="size" singular="Talla" plural="tallas" />}
    </div>
  )
}

// ---------- Lista de productos ----------

function ProductList({ onOpen }: { onOpen: (p: ProductRow) => void }): React.JSX.Element {
  const [search, setSearch] = useState('')
  const { data, error, reload } = useLoad(() => window.api.product.list(search), [search])
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o referencia"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-900"
          />
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2 font-medium">Referencia</th>
              <th className="px-4 py-2 font-medium">Producto</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 text-right font-medium">Variantes</th>
              <th className="px-4 py-2 text-right font-medium">Stock</th>
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.map((p) => (
              <tr key={p.id} onClick={() => onOpen(p)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">{p.reference}</td>
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 text-slate-600">{p.categoryName}</td>
                <td className="px-4 py-2 text-right">{p.variantCount}</td>
                <td className="px-4 py-2 text-right">{p.totalStock}</td>
                <td className="px-4 py-2">
                  <Badge tone={p.active ? 'green' : 'gray'}>{p.active ? 'Activo' : 'Inactivo'}</Badge>
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {search ? 'Sin resultados' : 'Aún no hay productos. Crea el primero.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {creating && (
        <ProductFormModal
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false)
            reload()
            if (id) onOpen({ id } as ProductRow)
          }}
        />
      )}
    </div>
  )
}

// ---------- Formulario de producto ----------

function ProductFormModal({
  product,
  onClose,
  onSaved
}: {
  product?: ProductRow
  onClose: () => void
  onSaved: (newId?: number) => void
}): React.JSX.Element {
  const { data: categories } = useLoad(() => window.api.lookup.list('category'), [])
  const [form, setForm] = useState({
    name: product?.name ?? '',
    reference: product?.reference ?? '',
    categoryId: product?.categoryId ?? 0,
    description: product?.description ?? ''
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!form.categoryId) return setError('La categoría es obligatoria')
    setBusy(true)
    setError(null)
    try {
      if (product) {
        await unwrap(window.api.product.update(product.id, form))
        onSaved()
      } else {
        const created = await unwrap(window.api.product.create(form))
        onSaved(created.id)
      }
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={product ? 'Editar producto' : 'Nuevo producto'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          autoFocus
        />
        <Field
          label="Referencia"
          hint="Código corto del producto, ej. BL001. Se usa para armar los SKU."
          value={form.reference}
          onChange={(e) => setForm({ ...form, reference: e.target.value })}
        />
        <Select
          label="Categoría"
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
        >
          <option value={0}>Selecciona…</option>
          {categories
            ?.filter((c) => c.active || c.id === product?.categoryId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
        <Field
          label="Descripción (opcional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Detalle: variantes ----------

function ProductDetail({
  productId,
  onBack
}: {
  productId: number
  onBack: () => void
}): React.JSX.Element {
  const products = useLoad(() => window.api.product.list(), [productId])
  const variants = useLoad(() => window.api.variant.list(productId), [productId])
  const [editing, setEditing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const product = products.data?.find((p) => p.id === productId)

  const toggleActive = async (): Promise<void> => {
    if (!product) return
    try {
      await unwrap(window.api.product.setActive(product.id, !product.active))
      products.reload()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Volver a productos
      </button>

      {product && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold">{product.name}</h3>
              <Badge tone={product.active ? 'green' : 'gray'}>
                {product.active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              <span className="font-mono">{product.reference}</span> · {product.categoryName}
              {product.description && ` · ${product.description}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
            <Button variant="secondary" onClick={() => void toggleActive()}>
              {product.active ? 'Desactivar' : 'Activar'}
            </Button>
            <Button onClick={() => setGenerating(true)}>
              <Layers className="h-4 w-4" />
              Generar variantes
            </Button>
          </div>
        </Card>
      )}

      {(error || variants.error) && <Alert>{error ?? variants.error}</Alert>}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Color</th>
              <th className="px-3 py-2 font-medium">Talla</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Precio venta</th>
              <th className="px-3 py-2 font-medium">Stock mín.</th>
              <th className="px-3 py-2 text-right font-medium">Stock</th>
              <th className="px-3 py-2 text-right font-medium">Costo prom.</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {variants.data?.map((v) => (
              <VariantEditRow key={v.id} variant={v} onChanged={variants.reload} onError={setError} />
            ))}
            {variants.data?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Este producto aún no tiene variantes. Usa «Generar variantes».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {editing && product && (
        <ProductFormModal
          product={product}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            products.reload()
          }}
        />
      )}
      {generating && (
        <GenerateVariantsModal
          productId={productId}
          onClose={() => setGenerating(false)}
          onDone={() => {
            setGenerating(false)
            variants.reload()
            products.reload()
          }}
        />
      )}
    </div>
  )
}

function VariantEditRow({
  variant,
  onChanged,
  onError
}: {
  variant: VariantRow
  onChanged: () => void
  onError: (msg: string | null) => void
}): React.JSX.Element {
  const [sku, setSku] = useState(variant.sku)
  const [price, setPrice] = useState(String(variant.salePrice))
  const [minStock, setMinStock] = useState(String(variant.minStock))

  const dirty =
    sku !== variant.sku ||
    Number(price) !== variant.salePrice ||
    Number(minStock) !== variant.minStock

  const save = async (): Promise<void> => {
    onError(null)
    try {
      await unwrap(
        window.api.variant.update(variant.id, {
          sku,
          salePrice: Math.round(Number(price)),
          minStock: Math.round(Number(minStock))
        })
      )
      onChanged()
    } catch (e) {
      onError(errorMessage(e))
    }
  }

  const toggle = async (): Promise<void> => {
    try {
      await unwrap(window.api.variant.setActive(variant.id, !variant.active))
      onChanged()
    } catch (e) {
      onError(errorMessage(e))
    }
  }

  const input = 'w-full rounded border border-slate-300 px-2 py-1 text-sm'
  return (
    <tr className={variant.active ? '' : 'bg-slate-50 text-slate-400'}>
      <td className="px-3 py-2">{variant.colorName}</td>
      <td className="px-3 py-2">{variant.sizeName}</td>
      <td className="px-3 py-2">
        <input className={clsx(input, 'font-mono')} value={sku} onChange={(e) => setSku(e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input className={clsx(input, 'w-28')} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <input className={clsx(input, 'w-20')} type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
      </td>
      <td className="px-3 py-2 text-right">{variant.stock}</td>
      <td className="px-3 py-2 text-right">{formatCOP(variant.avgCost)}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        {dirty && (
          <Button className="mr-2 px-3 py-1" onClick={() => void save()}>
            Guardar
          </Button>
        )}
        <Button variant="ghost" className="px-3 py-1" onClick={() => void toggle()}>
          {variant.active ? 'Desactivar' : 'Activar'}
        </Button>
      </td>
    </tr>
  )
}

function GenerateVariantsModal({
  productId,
  onClose,
  onDone
}: {
  productId: number
  onClose: () => void
  onDone: () => void
}): React.JSX.Element {
  const colors = useLoad(() => window.api.lookup.list('color'), [])
  const sizes = useLoad(() => window.api.lookup.list('size'), [])
  const [colorIds, setColorIds] = useState<number[]>([])
  const [sizeIds, setSizeIds] = useState<number[]>([])
  const [price, setPrice] = useState('0')
  const [minStock, setMinStock] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const toggle = (list: number[], setList: (v: number[]) => void, id: number): void =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const chips = (
    items: { id: number; name: string }[] | undefined,
    selected: number[],
    setList: (v: number[]) => void
  ): React.JSX.Element => (
    <div className="flex flex-wrap gap-2">
      {items?.map((item) => (
        <button
          type="button"
          key={item.id}
          onClick={() => toggle(selected, setList, item.id)}
          className={clsx(
            'rounded-full border px-3 py-1 text-sm',
            selected.includes(item.id)
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 hover:bg-slate-100'
          )}
        >
          {item.name}
        </button>
      ))}
    </div>
  )

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await unwrap(
        window.api.variant.generate({
          productId,
          colorIds,
          sizeIds,
          salePrice: Math.round(Number(price)),
          minStock: Math.round(Number(minStock))
        })
      )
      onDone()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="Generar variantes" onClose={onClose} wide>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium">Colores</p>
          {chips(colors.data?.filter((c) => c.active), colorIds, setColorIds)}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Tallas</p>
          {chips(sizes.data?.filter((s) => s.active), sizeIds, setSizeIds)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Precio de venta" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          <Field label="Stock mínimo" type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
        </div>
        <p className="text-sm text-slate-500">
          Se crearán hasta {colorIds.length * sizeIds.length} variantes. Las combinaciones que ya existen se omiten.
        </p>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || !colorIds.length || !sizeIds.length}>
            Generar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
