/** Error de negocio: su mensaje (en español) se muestra tal cual al usuario. */
export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}
