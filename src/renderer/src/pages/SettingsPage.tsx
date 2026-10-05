import { LookupManager } from '../components/LookupManager'

export function SettingsPage(): React.JSX.Element {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-2 text-base font-semibold">Métodos de pago</h3>
        <LookupManager kind="paymentMethod" singular="Método de pago" plural="métodos de pago" />
      </section>
      <section>
        <h3 className="mb-2 text-base font-semibold">Categorías de gasto</h3>
        <LookupManager kind="expenseCategory" singular="Categoría de gasto" plural="categorías de gasto" />
      </section>
    </div>
  )
}
