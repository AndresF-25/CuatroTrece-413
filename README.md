# 413 — Contabilidad local

Aplicación de escritorio (Windows) para registrar ventas, compras, gastos e inventario del negocio 413 y conocer sus ganancias. Funciona 100 % local. El plan completo está en [PLAN.md](PLAN.md).

## Comandos

```powershell
npm install            # instala y reconstruye better-sqlite3 para Electron
npm run dev            # abre la app en modo desarrollo
npm test               # pruebas (Vitest, se ejecutan con el Node de Electron)
npm run typecheck      # revisión de tipos
npm run db:generate    # genera una migración tras editar src/main/db/schema.ts
npm run build:win      # genera el instalador de Windows
```

La base de datos vive en `%APPDATA%\413\413.db`.

## Estado de avance

```text
[x] Paso 1  — Proyecto base (Electron + React + TS + Tailwind + Vitest + Git)
[x] Paso 2  — Base de datos (better-sqlite3 + Drizzle + migraciones + seed)
[x] Paso 3  — Primer arranque, login, IPC seguro, layout
[ ] Paso 4  — Catálogo + generador de variantes
[ ] Paso 5  — Compras + inventario (costo promedio)
[ ] Paso 6  — Ventas + anulación
[ ] Paso 7  — Gastos
[ ] Paso 8  — Dashboard y reportes
[ ] Paso 9  — Backup / restauración / CSV
[ ] Paso 10 — Pruebas finales + instalador probado en equipo limpio
```
