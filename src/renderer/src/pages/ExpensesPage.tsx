import { useState, type FormEvent } from 'react'
import { Pencil, Plus } from 'lucide-react'
import type { ExpenseRow } from '../../../shared/types'
import { errorMessage, unwrap, useLoad } from '../lib/api'
import { formatCOP, formatDate, monthStartLocal, toInt, todayLocal } from '../lib/format'
import { Alert, Badge, Button, Card, Field, Select } from '../components/ui'
import { Modal } from '../components/Modal'

export function ExpensesPage(): React.JSX.Element {
  const [from, setFrom] = useState(monthStartLocal())
  const [to, setTo] = useState(todayLocal())
  const [categoryId, setCategoryId] = useState(0)
  const [methodId, setMethodId] = useState(0)
  const [status, setStatus] = useState<'' | 'ACTIVE' | 'VOIDED'>('')
  const [editing, setEditing] = useState<ExpenseRow | 'new' | null>(null)
  const [voiding, setVoiding] = useState<ExpenseRow | null>(null)

  const categories = useLoad(() => window.api.lookup.list('expenseCategory'), [])
  const methods = useLoad(() => window.api.lookup.list('paymentMethod'), [])
  const list = useLoad(
    () =>
      window.api.expense.list({
        from: from || undefined,
        to: to || undefined,
        categoryId: categoryId || undefined,
        paymentMethodId: methodId || undefined,
        status: status || undefined
      }),
    [from, to, categoryId, methodId, status]
  )

  const active = list.data?.filter((e) => e.status === 'ACTIVE') ?? []
  const total = active.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Field label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="w-40">
          <Field label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="w-44">
          <Select label="Categoría" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            <option value={0}>Todas</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Select label="Método de pago" value={methodId} onChange={(e) => setMethodId(Number(e.target.value))}>
            <option value={0}>Todos</option>
            {methods.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-36">
          <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">Todos</option>
            <option value="ACTIVE">Vigentes</option>
            <option value="VOIDED">Anulados</option>
          </Select>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            Nuevo gasto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:max-w-md">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Gastos vigentes</p>
          <p className="mt-1 text-lg font-semibold">{active.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Total gastado</p>
          <p className="mt-1 text-lg font-semibold">{formatCOP(total)}</p>
        </Card>
      </div>

      {list.error && <Alert>{list.error}</Alert>}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 font-medium">Descripción</th>
              <th className="px-4 py-2 font-medium">Pago</th>
              <th className="px-4 py-2 text-right font-medium">Valor</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.data?.map((e) => (
              <tr key={e.id} className={e.status === 'VOIDED' ? 'text-slate-400' : ''}>
                <td className="px-4 py-2">{formatDate(e.expenseDate)}</td>
                <td className="px-4 py-2">{e.categoryName}</td>
                <td className="px-4 py-2">
                  {e.description}
                  {e.status === 'VOIDED' && <div className="text-xs">Anulado: {e.voidReason}</div>}
                </td>
                <td className="px-4 py-2">{e.paymentMethodName}</td>
                <td className="px-4 py-2 text-right">{formatCOP(e.amount)}</td>
                <td className="px-4 py-2">
                  <Badge tone={e.status === 'ACTIVE' ? 'green' : 'red'}>
                    {e.status === 'ACTIVE' ? 'Vigente' : 'Anulado'}
                  </Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  {e.status === 'ACTIVE' && (
                    <>
                      <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(e)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" className="px-3 py-1" onClick={() => setVoiding(e)}>
                        Anular
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hay gastos en este periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {editing && (
        <ExpenseModal
          expense={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            list.reload()
          }}
        />
      )}
      {voiding && (
        <VoidModal
          expense={voiding}
          onClose={() => setVoiding(null)}
          onDone={() => {
            setVoiding(null)
            list.reload()
          }}
        />
      )}
    </div>
  )
}

function ExpenseModal({
  expense,
  onClose,
  onSaved
}: {
  expense?: ExpenseRow
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const categories = useLoad(() => window.api.lookup.list('expenseCategory'), [])
  const methods = useLoad(() => window.api.lookup.list('paymentMethod'), [])
  const [categoryId, setCategoryId] = useState(expense?.expenseCategoryId ?? 0)
  const [methodId, setMethodId] = useState(expense?.paymentMethodId ?? 0)
  const [description, setDescription] = useState(expense?.description ?? '')
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [date, setDate] = useState(expense?.expenseDate ?? todayLocal())
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const firstMethod = methods.data?.filter((m) => m.active).sort((a, b) => a.id - b.id)[0]?.id ?? 0
  const effectiveMethod = methodId || firstMethod

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!categoryId) return setError('Selecciona una categoría')
    setBusy(true)
    setError(null)
    const data = {
      expenseCategoryId: categoryId,
      description,
      amount: toInt(amount),
      expenseDate: date,
      paymentMethodId: effectiveMethod,
      notes: notes || null
    }
    try {
      if (expense) await unwrap(window.api.expense.update(expense.id, data))
      else await unwrap(window.api.expense.create(data))
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={expense ? 'Editar gasto' : 'Nuevo gasto'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Select label="Categoría" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
          <option value={0}>Selecciona…</option>
          {categories.data
            ?.filter((c) => c.active || c.id === expense?.expenseCategoryId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
        <Field label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Valor" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Field label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Select label="Método de pago" value={effectiveMethod} onChange={(e) => setMethodId(Number(e.target.value))}>
          {methods.data
            ?.filter((m) => m.active || m.id === expense?.paymentMethodId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </Select>
        <Field label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
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

function VoidModal({
  expense,
  onClose,
  onDone
}: {
  expense: ExpenseRow
  onClose: () => void
  onDone: () => void
}): React.JSX.Element {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      await unwrap(window.api.expense.void(expense.id, reason))
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal title="Anular gasto" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          {expense.description} · {formatCOP(expense.amount)}. Dejará de contar en la utilidad neta; el registro se conserva.
        </p>
        <Field label="Motivo de la anulación" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger">
            Anular gasto
          </Button>
        </div>
      </form>
    </Modal>
  )
}
