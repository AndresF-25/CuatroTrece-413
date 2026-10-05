import { registerAuthIpc } from './auth.ipc'
import { registerCatalogIpc } from './catalog.ipc'
import { registerExpenseIpc } from './expense.ipc'
import { registerPurchaseIpc } from './purchase.ipc'
import { registerReportIpc } from './report.ipc'
import { registerSaleIpc } from './sale.ipc'

export function registerIpc(): void {
  registerAuthIpc()
  registerCatalogIpc()
  registerPurchaseIpc()
  registerSaleIpc()
  registerExpenseIpc()
  registerReportIpc()
}
