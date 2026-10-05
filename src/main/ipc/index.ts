import { registerAuthIpc } from './auth.ipc'
import { registerCatalogIpc } from './catalog.ipc'
import { registerPurchaseIpc } from './purchase.ipc'

export function registerIpc(): void {
  registerAuthIpc()
  registerCatalogIpc()
  registerPurchaseIpc()
}
