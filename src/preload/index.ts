import { contextBridge, ipcRenderer } from 'electron'
import type { ApiResult, AuthStatus, SessionUser } from '../shared/types'

const call = <T>(channel: string, input?: unknown): Promise<ApiResult<T>> =>
  ipcRenderer.invoke(channel, input)

// Lista cerrada de operaciones que el renderer puede pedir al proceso main.
const api = {
  auth: {
    status: () => call<AuthStatus>('auth:status'),
    setup: (input: { businessName: string; name: string; username: string; password: string }) =>
      call<SessionUser>('auth:setup', input),
    login: (input: { username: string; password: string }) =>
      call<SessionUser>('auth:login', input),
    logout: () => call<null>('auth:logout')
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
