import { registerAuthIpc } from './auth.ipc'
import { registerCatalogIpc } from './catalog.ipc'
import { registerPurchaseIpc } from './purchase.ipc'
import { registerSaleIpc } from './sale.ipc'

export function registerIpc(): void {
  registerAuthIpc()
  registerCatalogIpc()
  registerPurchaseIpc()
  registerSaleIpc()
}
