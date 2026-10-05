// Hook de carga de datos: patrón estándar de fetch-en-efecto; las reglas estrictas del
// compilador de React no lo distinguen de un uso incorrecto.
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs, @typescript-eslint/explicit-function-return-type */
import { useEffect, useRef, useState } from 'react'
import type { ApiResult } from '../../../shared/types'

/** Devuelve los datos o lanza Error con el mensaje legible del backend. */
export async function unwrap<T>(promise: Promise<ApiResult<T>>): Promise<T> {
  const res = await promise
  if (!res.ok) throw new Error(res.error)
  return res.data
}

/**
 * Carga datos al montar y cuando cambian las dependencias; expone reload().
 * Mientras recarga conserva los datos anteriores (evita parpadeos).
 */
export function useLoad<T>(
  loader: () => Promise<ApiResult<T>>,
  deps: unknown[]
): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    let cancelled = false
    void loaderRef.current().then((res): void => {
      if (cancelled) return
      if (res.ok) {
        setData(res.data)
        setError(null)
      } else {
        setError(res.error)
      }
    })
    return (): void => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, error, reload: (): void => setTick((t) => t + 1) }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado'
}
