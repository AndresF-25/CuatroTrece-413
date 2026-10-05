import { registerAuthIpc } from './auth.ipc'
import { registerCatalogIpc } from './catalog.ipc'

export function registerIpc(): void {
  registerAuthIpc()
  registerCatalogIpc()
}
