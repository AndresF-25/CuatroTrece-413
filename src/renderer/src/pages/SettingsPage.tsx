import { LookupManager } from '../components/LookupManager'

export function SettingsPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-base font-semibold">Métodos de pago</h3>
        <LookupManager kind="paymentMethod" singular="Método de pago" plural="métodos de pago" />
      </section>
    </div>
  )
}
