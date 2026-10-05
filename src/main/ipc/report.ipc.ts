import { z } from 'zod'
import type { Db } from '../db/client'
import { getDb } from '../db/instance'
import * as reports from '../services/report.service'
import { handle, type HandlerOptions } from './handler'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es válida')
const ADMIN: HandlerOptions = { access: ['ADMIN'] }

export function registerReportIpc(): void {
  const db = (): Db => getDb().db

  handle('report:period', z.object({ from: date, to: date }), ADMIN, ({ from, to }) =>
    reports.periodReport(db(), from, to)
  )
  handle('report:dashboard', z.object({ today: date }), ADMIN, ({ today }) =>
    reports.dashboard(db(), today)
  )
  handle('report:inventory', z.undefined(), ADMIN, () => reports.inventoryReport(db()))
}
