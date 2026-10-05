# 413 — Plan de Desarrollo v2 (MVP contable local)

> Reemplaza a `413_PLAN_DESARROLLO.md` (se conserva como referencia de la visión completa → ver sección 12, "Versión 2").

## 1. Objetivo

Aplicación de escritorio para Windows, 100 % local, para que el negocio **413** (ropa) pueda:

1. Registrar **ventas** (qué se vendió, a quién, cómo pagó).
2. Registrar **compras de mercancía** con su costo real (incluye envío).
3. Registrar **gastos** del negocio.
4. Saber su **inventario** (stock y valor).
5. Ver **ganancias**: utilidad bruta y neta por día, semana, mes o rango.
6. Tener **copias de seguridad** y exportar a CSV.

**Fuera del MVP** (ver sección 12): lotes FIFO, devoluciones parciales, reportes por pedido/producto, calculadora de precio, ajustes de inventario con motivo, vendedor con permisos limitados, ventas a crédito.

## 2. Decisiones de diseño (no se discuten durante el desarrollo)

| Tema | Decisión | Por qué |
|---|---|---|
| Dinero | **Enteros en pesos COP** (sin decimales). Nunca `float`. | COP no usa centavos; evita errores de redondeo |
| Costo de lo vendido | **Costo promedio ponderado** por variante; el costo se **copia (snapshot) a cada línea de venta** | Utilidad exacta sin lotes; permite migrar a FIFO después |
| Margen / utilidad | **Se calculan al consultar**, no se guardan | Evita datos inconsistentes tras anulaciones |
| Stock | Columna `variant.stock` actualizada **en la misma transacción** que cada operación + tabla `stock_movement` como historial | Consultas rápidas y trazabilidad |
| Fechas | `*_at` = instante UTC (ISO). `*_date` = **fecha local del negocio** `YYYY-MM-DD` | Los reportes por día no se rompen por zona horaria (Colombia UTC-5) |
| Semana | Lunes a domingo | Definido una vez para todos los reportes |
| Borrado | **Nunca se borran** ventas, compras ni gastos: se **anulan** (`VOIDED`) | Historial contable |
| Descuento | Se captura a nivel de venta y se **prorratea por línea** | Las líneas siempre suman el total |
| Envío/otros costos de compra | Se reparten **proporcional al valor de cada línea**; el residuo de redondeo va a la última línea | Una prenda cara no carga lo mismo que una barata |
| Base de datos | **SQLite con `better-sqlite3`** + **Drizzle ORM** con migraciones SQL embebidas | Prisma complica el empaquetado y las migraciones en el equipo del cliente |
| Ubicación de la BD | `app.getPath('userData')/413.db` | Sobrevive a actualizaciones y desinstalación |
| Seguridad | `contextIsolation: true`, `nodeIntegration: false`, validación con **zod** en cada canal IPC, **permisos verificados en el proceso main**, hash **bcrypt** | Estándar Electron |
| Roles | La columna `role` existe (`ADMIN`/`SELLER`) y la verificación en IPC existe desde el inicio, pero el MVP solo usa ADMIN | Evita reabrir todos los servicios después |

## 3. Stack

- **Electron + React + TypeScript + Vite** (scaffold con `electron-vite`)
- **better-sqlite3** + **drizzle-orm** + **drizzle-kit**
- **zod** (validación), **bcryptjs** (hash)
- **Tailwind CSS + shadcn/ui + lucide-react + Recharts**
- **Vitest** (pruebas de servicios)
- **electron-builder** (instalador Windows)
- Git desde el primer día

Nota: `better-sqlite3` es un módulo nativo → hay que reconstruirlo para Electron (`electron-builder install-app-deps` / `electron-rebuild`) y declararlo en `asarUnpack`.

## 4. Estructura de carpetas

```text
413/
├── src/
│   ├── main/
│   │   ├── index.ts              # ventana, ciclo de vida, primer arranque
│   │   ├── db/
│   │   │   ├── client.ts         # abre 413.db, PRAGMA foreign_keys=ON, journal_mode=WAL
│   │   │   ├── schema.ts         # esquema Drizzle (sección 5)
│   │   │   └── migrations/       # SQL generado, se aplica al iniciar
│   │   ├── services/             # TODA la lógica de negocio (testeable sin Electron)
│   │   │   ├── auth.service.ts
│   │   │   ├── catalog.service.ts
│   │   │   ├── purchase.service.ts
│   │   │   ├── sale.service.ts
│   │   │   ├── expense.service.ts
│   │   │   ├── report.service.ts
│   │   │   ├── backup.service.ts
│   │   │   └── export.service.ts
│   │   ├── ipc/                  # un archivo por servicio: valida (zod) + autoriza + llama al servicio
│   │   └── lib/                  # money.ts, dates.ts, errors.ts
│   ├── preload/index.ts          # expone window.api.* (lista cerrada de canales)
│   └── renderer/
│       ├── pages/ components/ hooks/ layouts/ lib/
├── tests/                        # Vitest: services con BD SQLite en memoria
├── drizzle.config.ts
├── .gitignore                    # node_modules, dist, *.db, backups/
└── README.md                     # checklist de avance (sección 11)
```

## 5. Esquema de base de datos corregido

Convenciones: `id` entero autoincremental; `*_at` = UTC ISO; `*_date` = `YYYY-MM-DD` local; montos = INTEGER (COP); `active` = 0/1. Todas las FK con `ON DELETE RESTRICT`.

### Usuarios y configuración
```text
user:            id, name, username (UNIQUE), password_hash, role (ADMIN|SELLER),
                 active, created_at
setting:         key (PK), value
                 -- business_name, currency=COP, low_stock_default, backup_dir, schema_notes
```

### Catálogo
```text
category:        id, name (UNIQUE), active
color:           id, name (UNIQUE), active
size:            id, name (UNIQUE), sort_order, active     -- sort_order para ordenar XS<S<M<L
product:         id, category_id→category, name, reference (UNIQUE), description, active, created_at
variant:         id, product_id→product, color_id→color, size_id→size,
                 sku (UNIQUE), sale_price, avg_cost, stock, min_stock, active
                 UNIQUE(product_id, color_id, size_id)
                 CHECK(stock >= 0)
payment_method:  id, name (UNIQUE), active
supplier:        id, name, phone, email, address, notes, active
```

### Compras (simplificadas, sin lotes)
```text
purchase:        id, number (UNIQUE), supplier_id→supplier (NULL permitido),
                 purchase_date, notes,
                 merchandise_total,         -- Σ(qty × unit_cost)
                 shipping_cost, other_cost,
                 total_cost,                -- merchandise_total + shipping_cost + other_cost
                 status (ACTIVE|VOIDED), voided_at, void_reason,
                 user_id→user, created_at

purchase_item:   id, purchase_id→purchase, variant_id→variant,
                 quantity, unit_cost,                 -- costo del proveedor
                 allocated_extra,                     -- parte de envío/otros asignada a la línea
                 real_line_total,                     -- qty×unit_cost + allocated_extra
                 real_unit_cost                       -- round(real_line_total / quantity)
```
El **inventario inicial** se registra como una compra con `supplier_id = NULL` y nota "Inventario inicial" (sin envío), de modo que no se necesita una tabla aparte.

### Inventario (historial)
```text
stock_movement:  id, variant_id→variant,
                 type (PURCHASE|PURCHASE_VOID|SALE|SALE_VOID),
                 quantity,                            -- con signo (+ entra / − sale)
                 unit_cost,
                 ref_type (PURCHASE|SALE), ref_id,
                 user_id→user, created_at
```
(Ajustes manuales, daños y devoluciones se añaden en v2 como nuevos `type`.)

### Ventas
```text
sale:            id, number (UNIQUE), sale_date, customer_name, notes,
                 payment_method_id→payment_method,
                 subtotal,                  -- Σ line_subtotal
                 discount,                  -- descuento total (≤ subtotal)
                 total,                     -- subtotal − discount = Σ line_total
                 total_cost,                -- Σ line_cost (snapshot)
                 status (COMPLETED|VOIDED), voided_at, void_reason, voided_by→user,
                 user_id→user, created_at

sale_item:       id, sale_id→sale, variant_id→variant,
                 quantity,
                 unit_price,                -- precio de venta aplicado
                 line_subtotal,             -- qty × unit_price
                 line_discount,             -- descuento prorrateado (residuo a la última línea)
                 line_total,                -- line_subtotal − line_discount
                 unit_cost,                 -- variant.avg_cost al momento de vender (snapshot)
                 line_cost                  -- qty × unit_cost
```
Utilidad bruta de una venta = `total − total_cost`. Margen = `(total − total_cost) / total`. **No se almacenan.**

### Gastos
```text
expense_category: id, name (UNIQUE), active
                  -- Transporte, Publicidad, Empaque, Domicilios, Arriendo, Servicios,
                  -- Comisiones, Mantenimiento, Otros
expense:          id, expense_category_id→expense_category, description, amount,
                  expense_date, payment_method_id→payment_method, notes,
                  status (ACTIVE|VOIDED), voided_at, void_reason,
                  user_id→user, created_at
```

### Índices
`sale(sale_date, status)`, `expense(expense_date, status)`, `purchase(purchase_date, status)`, `sale_item(sale_id)`, `sale_item(variant_id)`, `stock_movement(variant_id)`, `variant(product_id)`.

## 6. Reglas de negocio (fórmulas exactas)

**Reparto de costos de compra**
```text
extra_total = shipping_cost + other_cost
allocated_extra(línea) = round(extra_total × (qty×unit_cost de la línea) / merchandise_total)
-- el residuo (extra_total − Σ allocated_extra) se suma a la última línea
real_line_total = qty × unit_cost + allocated_extra
real_unit_cost  = round(real_line_total / qty)
```
Si `merchandise_total = 0` (inventario inicial sin costo), el extra se reparte por cantidad.

**Costo promedio al recibir una compra** (por variante)
```text
nuevo_avg_cost = round((stock_actual × avg_cost_actual + real_line_total) / (stock_actual + qty))
stock += qty
```

**Venta**
```text
line_subtotal = qty × unit_price
discount_prorrateado(línea) = round(discount × line_subtotal / subtotal)   -- residuo a la última línea
line_total = line_subtotal − line_discount
unit_cost  = variant.avg_cost    (snapshot)      line_cost = qty × unit_cost
stock −= qty                                      (error si stock < qty)
Utilidad bruta = Σ line_total − Σ line_cost
Margen bruto   = Utilidad bruta / Σ line_total
```

**Resultado de un periodo** (solo `status` activo/completado, filtrando por `*_date`)
```text
Ventas              = Σ sale.total
− Costo vendido     = Σ sale.total_cost
= Utilidad bruta
− Gastos            = Σ expense.amount
= Utilidad neta                    Margen neto = Utilidad neta / Ventas
```
Las compras **no** son costo del periodo; solo aumentan inventario.

**Anular venta** (una transacción): `status=VOIDED`, `stock += qty` por línea, recalcular `avg_cost` con `unit_cost` del snapshot, crear `stock_movement SALE_VOID`. Queda fuera de todos los reportes.

**Anular compra**: solo si para cada línea `variant.stock ≥ qty`; revierte stock y recalcula `avg_cost` (`(stock×avg − real_line_total)/(stock − qty)`, o conserva el avg si el stock queda en 0). Si no hay stock suficiente → error "ya se vendieron unidades de esta compra".

**Anular gasto**: `status=VOIDED`, sale de los reportes.

**Caja por método de pago** (resumen simple): por método → `Σ ventas completadas − Σ gastos activos` en el periodo.

**Numeración**: `number` consecutivo generado dentro de la transacción (`V-000001`, `C-000001`).

## 7. Reglas de implementación (aplican a todos los módulos)

1. Cada operación que toca stock, ventas o compras corre en **una transacción** (`db.transaction`).
2. Los servicios no importan Electron: reciben `db` por parámetro → se prueban con SQLite en memoria.
3. Canal IPC = `zod.parse(input)` → `requireRole(session, roles)` → servicio → resultado `{ok, data | error}`. Errores de negocio con mensajes en español legibles.
4. Montos en el renderer se formatean con un único `formatCOP()` (`$12.600`); los inputs entregan enteros.
5. Ciclo por módulo: **esquema → servicio → test → IPC/preload → hook → UI → validaciones**. No se avanza hasta que el test del módulo pasa.
6. Un commit de Git por paso completado.

## 8. Plan paso a paso

Cada paso termina con su **criterio de aceptación**. Marcar en la sección 11 al completar.

### Paso 1 — Proyecto base
- Git init, `.gitignore`, scaffold `electron-vite` (React + TS), Tailwind, shadcn/ui, lucide, Recharts, Vitest.
- `npm run dev` abre la ventana de escritorio con React; `npm run test` corre.
- **Aceptación:** ventana abre y cierra sin errores en consola; `contextIsolation` activo.

### Paso 2 — Base de datos y migraciones
- Instalar `better-sqlite3` (reconstruir para Electron, `asarUnpack`), `drizzle-orm`, `drizzle-kit`.
- Escribir `schema.ts` (sección 5), generar migración inicial, aplicarla automáticamente al iniciar.
- `client.ts`: `foreign_keys=ON`, `journal_mode=WAL`, ruta en `userData`.
- Seed **de datos base** (no de prueba): métodos de pago, categorías de gasto, tallas, colores comunes.
- Seed **de desarrollo** (script aparte, solo dev): categorías, producto demo, proveedor demo.
- **Aceptación:** al borrar `413.db` y arrancar, se recrea con todas las tablas y datos base.

### Paso 3 — Primer arranque, login e IPC seguro
- Primer arranque (sin usuarios): pantalla "Crear administrador" (nombre, usuario, contraseña) y nombre del negocio. **Sin contraseña por defecto.**
- Login (bcrypt), sesión en memoria del proceso main, cierre de sesión.
- Estructura IPC (zod + `requireRole`) y `window.api` en el preload.
- Layout principal: sidebar (Dashboard, Productos, Compras, Inventario, Ventas, Gastos, Reportes, Configuración), header con usuario.
- **Aceptación:** sin sesión no se puede invocar ningún canal; credenciales incorrectas muestran error; layout navegable.

### Paso 4 — Catálogo (categorías, colores, tallas, productos, variantes, proveedores, métodos de pago)
- CRUD con activar/desactivar (sin borrar).
- Producto + **generador de variantes**: elegir colores × tallas → crea todas las combinaciones con SKU autogenerado (`REF-COLOR-TALLA`, editable) y precio base.
- Validaciones: referencia/nombre/categoría obligatorios, SKU único, combinación producto-color-talla única, precio ≥ 0.
- **Aceptación:** crear "Blusa" con 3 colores × 3 tallas genera 9 variantes de una sola vez; SKU duplicado se rechaza.

### Paso 5 — Compras e inventario
- Pantalla **Nueva compra**: proveedor (opcional), fecha, líneas (variante, cantidad, costo unitario), envío, otros costos → muestra costo real por línea antes de confirmar.
- `purchase.service`: reparto proporcional, `avg_cost`, `stock`, `stock_movement` (sección 6).
- Opción **Inventario inicial** (compra sin proveedor ni envío).
- Anular compra (con la regla de stock suficiente).
- Pantalla **Inventario**: producto, color, talla, SKU, stock, costo promedio, precio, valor; búsqueda, filtros (categoría/talla/color), bajo stock, agotados, total de unidades y valor a costo, historial de movimientos por variante.
- **Aceptación (tests):**
  - Caso 1: 10 prendas × $12.000 + envío $10.000 → `real_unit_cost = 13.000`, stock +10, avg_cost = 13.000.
  - Reparto proporcional: blusa $10.000 ×1 y vestido $50.000 ×1 con envío $6.000 → extras 1.000 y 5.000; suma exacta (incluye caso con residuo).
  - Segunda compra a otro costo recalcula el promedio ponderado.

### Paso 6 — Ventas
- Pantalla **Nueva venta**: buscar por nombre/SKU, carrito, cantidad, precio editable por línea, descuento, método de pago, cliente (opcional), fecha (por defecto hoy) → confirmar.
- `sale.service`: valida stock, descuenta, snapshot de costo, prorrateo de descuento, movimientos, todo en una transacción.
- Listado de ventas (filtro por fecha/método/estado), detalle, **Anular venta** con motivo.
- **Aceptación (tests):**
  - Caso 2: vender 2 de 10 → stock 8, costo = 2×avg, utilidad correcta.
  - Caso 4: vender más que el stock → bloqueado, sin cambios en BD (transacción revertida).
  - Descuento: `Σ line_total = sale.total` siempre (probar con residuo).
  - Caso 7: anular → `VOIDED`, stock restaurado, desaparece de reportes.

### Paso 7 — Gastos
- Registrar, editar, anular; filtros por fecha, categoría y método de pago; gestión de categorías de gasto.
- **Aceptación (test):** Caso 6 — gasto de $50.000 reduce la utilidad neta exactamente en $50.000; un gasto anulado no cuenta.

### Paso 8 — Dashboard y reportes
- `report.service` con las fórmulas de la sección 6, filtrando por `*_date`.
- **Dashboard:** ventas, utilidad bruta, gastos y utilidad neta de hoy / semana / mes; unidades y valor del inventario; productos bajo stock y agotados.
- **Reportes:** filtros Hoy / Semana / Mes / Rango; ventas (número, unidades, total, costo, utilidad, margen), gastos por categoría (gráfico), resultado neto, caja por método de pago, valor del inventario a costo y a precio de venta.
- **Aceptación (test de integración):** compra → venta → gasto → anulación: los números del reporte coinciden con el cálculo manual; una venta del día a las 11 pm cae en el día correcto.

### Paso 9 — Respaldo y exportación
- `backup.service`: crear copia con `db.backup()` (nunca copiar el archivo abierto) a `userData/backups/413_backup_YYYY-MM-DD_HH-mm.db`; copia automática al cerrar la app (conservar las últimas 10); carpeta alternativa configurable (OneDrive/USB); abrir carpeta de backups.
- Restaurar: elegir archivo → validar (`PRAGMA integrity_check` + tablas esperadas) → **backup automático previo** → cerrar conexión → reemplazar → reiniciar la app.
- Exportar CSV (ventas, compras, inventario, gastos, reporte del periodo) con selector de archivos de Windows; CSV con BOM UTF-8 y `;` como separador para abrir bien en Excel en español.
- **Aceptación:** crear datos → backup → borrar/alterar → restaurar → los datos vuelven; un archivo inválido se rechaza sin tocar la BD actual.

### Paso 10 — Pruebas finales e instalador
- Revisar la lista de la sección 9 (todos los tests pasan) y recorrer manualmente el criterio de finalización (sección 10).
- `npm run build` + `electron-builder` → `413 Setup.exe` (NSIS), ícono, nombre de producto.
- **Probar el instalador en un Windows limpio**: primer arranque crea la BD, el admin, y la base persiste tras actualizar/reinstalar.
- **Aceptación:** instalación limpia funciona; backup y restauración funcionan en la app instalada.

## 9. Pruebas automatizadas mínimas (Vitest, BD en memoria)

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Compra 10 × $12.000 + envío $10.000 | real_unit_cost 13.000; stock 10 |
| 2 | Reparto de envío con 2 líneas de valor distinto + residuo | Σ allocated_extra = extra_total |
| 3 | Dos compras a distinto costo | avg_cost ponderado correcto |
| 4 | Venta de 2 | stock 8; total_cost = 2 × avg; movimiento SALE |
| 5 | Venta con stock insuficiente | error; BD sin cambios |
| 6 | Venta con descuento (con residuo) | Σ líneas = total |
| 7 | Anular venta | VOIDED; stock restaurado; fuera de reportes |
| 8 | Anular compra con unidades ya vendidas | rechazado |
| 9 | Gasto $50.000 | utilidad neta = bruta − 50.000 |
| 10 | Reporte del periodo tras compra+venta+gasto+anulación | coincide con cálculo manual |
| 11 | Reporte "hoy" con venta registrada a las 23:30 | cae en la fecha local correcta |
| 12 | Canal IPC sin sesión / rol incorrecto | rechazado en main |

## 10. Criterio de finalización del MVP

```text
Primer arranque → creo mi usuario administrador
 → creo un producto con sus variantes (talla/color)
 → registro la compra con envío (o cargo inventario inicial)
 → veo el stock y el costo real en Inventario
 → registro una venta: el stock baja y se calcula costo y utilidad
 → registro un gasto
 → el Dashboard y Reportes muestran ventas, utilidad bruta, gastos y utilidad neta
   del día, semana, mes y rango
 → anulo una venta y todo se revierte
 → hago un backup, altero datos, restauro y la información vuelve
 → exporto a CSV y lo abro en Excel
 → todo funciona en la app instalada con 413 Setup.exe
```

## 11. Estado de avance (copiar al `README.md`)

```text
[ ] Paso 1  — Proyecto base (Electron + React + TS + Tailwind + Vitest + Git)
[ ] Paso 2  — Base de datos (better-sqlite3 + Drizzle + migraciones + seed)
[ ] Paso 3  — Primer arranque, login, IPC seguro, layout
[ ] Paso 4  — Catálogo + generador de variantes
[ ] Paso 5  — Compras + inventario (costo promedio)
[ ] Paso 6  — Ventas + anulación
[ ] Paso 7  — Gastos
[ ] Paso 8  — Dashboard y reportes
[ ] Paso 9  — Backup / restauración / CSV
[ ] Paso 10 — Pruebas finales + instalador probado en equipo limpio
```

## 12. Versión 2 (solo cuando el negocio lo pida)

Cada punto se agrega sin romper el MVP gracias al snapshot de costo y al historial de movimientos:

- **Devoluciones** (tabla `sale_return` + `sale_return_item`; reingresan al costo del snapshot; reducen ventas y costo del periodo).
- **Ajustes de inventario** (entrada/salida, dañado, corrección de conteo) como nuevos tipos de `stock_movement`, con motivo obligatorio.
- **Lotes y FIFO** (`inventory_lot`, `sale_item_lot`) si se requiere costo exacto por pedido.
- **Reportes por pedido de compra y por producto** (más vendidos, más rentables).
- **Calculadora de precio**: `precio = costo real / (1 − margen)`.
- **Vendedor** con permisos limitados (la verificación en main ya existe).
- **Ventas a crédito / apartados / abonos** (`payment` ligado a la venta; separa "vendido" de "recibido").
- Alertas de stock bajo configurables, múltiples cajas, impresión de recibo.
