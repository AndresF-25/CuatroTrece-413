import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Receipt,
  Settings,
  ShoppingBag,
  Shirt,
  TrendingUp,
  type LucideIcon
} from 'lucide-react'

export type PageId =
  | 'dashboard'
  | 'products'
  | 'purchases'
  | 'inventory'
  | 'sales'
  | 'expenses'
  | 'reports'
  | 'settings'

export const NAV: { id: PageId; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Productos', icon: Shirt },
  { id: 'purchases', label: 'Compras', icon: ShoppingBag },
  { id: 'inventory', label: 'Inventario', icon: Boxes },
  { id: 'sales', label: 'Ventas', icon: ClipboardList },
  { id: 'expenses', label: 'Gastos', icon: Receipt },
  { id: 'reports', label: 'Reportes', icon: TrendingUp },
  { id: 'settings', label: 'Configuración', icon: Settings }
]
