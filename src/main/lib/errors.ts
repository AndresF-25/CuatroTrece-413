/** Error de negocio: su mensaje (en español) se muestra tal cual al usuario. */
export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}

const UNIQUE_MESSAGES: Record<string, string> = {
  'category.name': 'Ya existe una categoría con ese nombre',
  'color.name': 'Ya existe un color con ese nombre',
  'size.name': 'Ya existe una talla con ese nombre',
  'payment_method.name': 'Ya existe un método de pago con ese nombre',
  'expense_category.name': 'Ya existe una categoría de gasto con ese nombre',
  'product.reference': 'Ya existe un producto con esa referencia',
  'variant.sku': 'Ya existe una variante con ese SKU',
  'variant.product_id, variant.color_id, variant.size_id':
    'Esa combinación de color y talla ya existe para el producto',
  'user.username': 'Ese nombre de usuario ya está en uso'
}

/**
 * Convierte errores de restricción de SQLite en mensajes legibles.
 * Devuelve null si el error no es una restricción conocida.
 */
export function translateDbError(error: unknown): AppError | null {
  const message = error instanceof Error ? error.message : ''
  const unique = /UNIQUE constraint failed: (.+)$/.exec(message)
  if (unique) {
    return new AppError(UNIQUE_MESSAGES[unique[1]] ?? 'Ya existe un registro con ese valor')
  }
  if (message.includes('FOREIGN KEY constraint failed')) {
    return new AppError('No se puede completar: el registro está en uso o no existe')
  }
  return null
}
