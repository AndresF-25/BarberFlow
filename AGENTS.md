# AGENTS.md — BarberFlow

Reglas **permanentes** para cualquier agente de IA que trabaje en este repo (imperativas, sin historia ni cifras). Estado y salud → [PROJECT_STATUS.md](PROJECT_STATUS.md); tareas → [TASKS.md](TASKS.md); decisiones y lecciones → [MEMORY.md](MEMORY.md); defectos pasados → [docs/HALLAZGOS.md](docs/HALLAZGOS.md); procedimientos → skills (índice en [SKILLS.md](SKILLS.md)).

## Qué es

SaaS para barberías. Multi-tenant por `businessId`, con tres roles: `master` (sin negocio), `owner` y `employee`.

- **Frontend** (raíz): React 18 + Vite 5 + Tailwind 3 + react-router 6 + recharts.
- **Backend** (`server/`): Express 4 + Prisma 5 + PostgreSQL 16 + Zod. ESM en ambos (`"type": "module"`).
- Dos `package.json` independientes (sin workspaces). Docker Compose para Postgres y, con `--profile app`, API + nginx.

## Comandos

Shell real: **Windows PowerShell 5.1** (las variables de entorno se ponen con `$env:X=…`). En Git Bash también valen, con la sintaxis `X=… cmd`.

| Tarea | Comando |
|---|---|
| Postgres | `docker compose up -d` |
| Migraciones (primera vez) | `cd server; npm run db:deploy` |
| Dev completo (API :3001, web :5173) | `npm run dev:all` |
| Lint (front + back) | `npm run lint` |
| Tests backend | `cd server; npm test` (o desde la raíz `npm run test:server`) |
| Tests frontend (sin API: el smoke se omite) | `npx vitest run [archivo]` |
| Tests frontend + smoke (con API real) | ver «Flujo de pruebas» |
| Pruebas por módulo contra datos demo | `cd server; npm run test:demo -- tests/demo/NN-nombre.test.js` (`pretest:demo` recarga los datos demo antes) |
| Cargar / borrar datos demo | `cd server; npm run db:seed:demo` · `npm run db:seed:demo:reset` — cuentas `…@demo.barberflow.com`, contraseña `Demo1234` |
| Limpiar restos de pruebas | `npm run test:cleanup --prefix server` |
| Migración nueva (dev) | `cd server; npm run db:migrate` (= `prisma migrate dev`, que crea **y aplica**; el procedimiento seguro está en «Reglas por área» → «Migraciones»: `--create-only`, revisar el SQL, `migrate deploy`) |
| Build | `npm run build` |
| Stack completo en Docker | `docker compose --profile app up -d --build` (requiere `JWT_SECRET`) |

> Un resultado verde sin confirmar que corrió **no vale**: los tests de integración y el smoke **se omiten en silencio** si no hay Postgres/API. Nunca digas «en verde» sin cifras reales, `skipped = 0`, lint y build limpios.

## Flujo de pruebas (qué ejecutar y cuándo)

1. **Específica del cambio** primero: el archivo de pruebas del módulo (`test:demo -- tests/demo/NN-x.test.js` y/o `npx vitest run <archivo>`).
2. **Estabilidad:** repetir el archivo backend ×2 (×3 si hay concurrencia o cerrojos).
3. **Regresión de área:** `cd server; npm test` + las pruebas de frontend afectadas.
4. **Regresión global** — solo al cerrar un módulo/tarea, antes de commitear, al tocar código **compartido** (middleware, `lib/utils`, `Modal`, `theme`, esquema/migraciones) o antes de decir «todo verde»: backend `npm test` + **demo completa** (~10 min) + **frontend completo con API activa** + `npm run lint` + `npm run build` + `npm run test:cleanup` + comprobar los datos reales.
- **Toda ejecución larga** va en segundo plano, con **límite de tiempo y código de salida** (envoltorios probados en la skill `run-full-test-suite`): válida solo con `EXIT=0`, recuentos leídos del log **recién creado** y `skipped = 0`; `EXIT=124` = tiempo agotado = **no válida**.
- **Base de datos:** las pruebas usan la **misma** base `barberflow` donde están los datos reales (`T-18`): respaldo (`pg_dump`) antes de ejecutar; los correos de prueba terminan siempre en `@test.local`; nunca se usa `@test.local` en cuentas reales (la limpieza borra el negocio completo de ese usuario).
- Antes de levantar API/Vite para el navegador: puertos libres (3099 API de pruebas, 5199 Vite; **3001/5173 son del entorno de desarrollo, no se tocan**), `CORS_ORIGIN=http://localhost:<puerto>` y cerrar al terminar.

## Mapa del repo

```
src/api/client.js            fetch + objeto `api` (Bearer, token en localStorage `barberflow_token`)
src/context/AuthContext.jsx  sesión: user, business, login, register, logout
src/routes/                  ProtectedRoute, RoleRoute
src/pages/landing|auth|master
src/pages/dashboard/         Dashboard.jsx + views/ hooks/ components/ navigation.js theme.js dates.js
server/src/app.js            montaje de rutas bajo /api/v1
server/src/routes/           una por recurso (auth, appointments, services, products, ...)
server/src/services/         appointmentService, clientService, analyticsService
server/src/middleware/       auth.js (authenticate, requireRole, requireBusinessContext), errorHandler.js
server/src/lib/              utils.js, jwt.js, password.js, bootstrapMaster.js, zodEs.js
server/prisma/schema.prisma  modelos y enums
server/prisma/demo/          demo-data.json + dataset.js (datos demo); server/scripts/seed-demo.js
server/tests/                unit/ + integration/ + demo/ (por módulo) + helpers.js
```
Ubicar un recurso: ruta `server/src/routes/<recurso>.js` + servicio + vista `views/<Vista>.jsx` + hook; pruebas `server/tests/demo/NN-<módulo>.test.js` y `src/**/<Vista>.test.jsx`.

## Reglas de dominio (no negociables)

- **Dinero en centavos** (campos `*Cents`, enteros). En UI se formatea con `fmtCOP` / `fmtCompact` (`es-CO`).
- **Aislamiento por negocio**: toda consulta filtra por `req.businessId`. La seguridad real está en el servidor; los chequeos de rol del frontend son solo UX. Un `employee` solo ve y modifica sus propias citas y ventas.
- **Zona horaria**: «hoy» y las validaciones de fecha usan `BUSINESS_TZ` (`America/Bogota`). `appointmentDate` es `@db.Date`; `startTime` es string `"HH:MM"`. Para instantes usa `businessDateOf/businessTimeOf/businessDayStart/End` (`lib/utils.js`), **nunca** UTC (`toISOString().slice(0,10)`, `new Date('…T00:00:00Z')`).
- **Borrado suave**: servicios y productos se desactivan (`isActive=false`), no se borran.
- **Stock**: descontar con `updateMany` + `stock: { gte }`; ajustes y ediciones bajo `SELECT … FOR UPDATE`. **Invariante: la suma de `StockAdjustment` de un producto = su stock** (alta, PATCH, `adjust-stock` y venta dejan su ajuste).
- **Citas**: no en el pasado, máx. 365 días vista, sin terminar después de medianoche; sin solape por barbero según duración; las canceladas liberan el horario; finalizar crea `ServiceTransaction` y suma `timesPerformed`.
- **Master** solo se crea por `bootstrapMaster` (`MASTER_EMAIL`/`MASTER_PASSWORD`); no hay endpoint para crear uno.

## Convenciones de código

- **Estilo**: ESM, comillas simples, punto y coma, 2 espacios. Parámetros sin usar con prefijo `_`.
- **Rutas Express**: `try { ... } catch (err) { next(err) }`; validar con Zod; errores con `createError(status, msg, code)` y códigos en MAYÚSCULAS (`NOT_FOUND`, `FORBIDDEN`, ...). Respuesta de error: `{ error, code }`, mensajes en español (mapa global `zodEs.js`).
- **Idioma**: UI, comentarios y mensajes de error en español; identificadores del backend en inglés; el frontend usa nombres de dominio en español (`useCitas`, `AgendaView`, `ClientesView`). Tuteo («Ingresa», «Regístrate»), no voseo.
- **Contrato de API bilingüe**: citas/servicios/productos/clientes responden con campos en español (`hora`, `nombre`, `precio`, `stockMinimo`...) mapeados en una función `mapXToUi` por ruta; la entrada de citas es en inglés (`clientName`, `serviceId`, `startTime`). Al añadir un campo, copia la convención del recurso vecino y toca su `mapXToUi`.
- **Respuestas**: las rutas de auth devuelven `{ ok, ... }`; el resto devuelve `{ recurso }`.
- **Frontend**: vistas y componentes con `export` nombrado; páginas con `export default`. Los hooks de escritura devuelven `{ ok, error, ...extra }` mediante `attempt()` (propaga lo que devuelve la acción, p. ej. `pendingAppointments`). Estados de carga/error con `EstadoCarga`. `authRequest` no lanza excepción; `request` sí — no los mezcles.
- **Estilos** (dos sistemas; respeta el de cada zona):
  - **Landing y acceso** «Esmalte»: naval `#0D1B3A`, cobalto `#1F4FCC`, rojo de poste `#D7283A`, Archivo; CSS plano con scope (`.barberflow-landing`, `.barberflow-auth`, resets con `:where()`). **La landing no se toca sin pedirlo.**
  - **Dashboard y master** «Turno»: lienzo blanco, tinta `#12201F`, tónico `#007A6E` (acción/confirmado; caléndula = pendiente, coral = peligro, índigo = Tienda); Bricolage (`bd-display`) + Instrument Sans; cabecera con pestañas, secciones sin caja (`SectionCard`), `KpiCard`/`StatLine`, `Sillas.jsx`. Tokens en `dashboard/theme.js` (`C`, `INV`): **sin hex sueltos**; los colores del servidor (`STAFF_COLORS`, `PAYMENT_COLORS`) se alinean a mano.
  - **Las pruebas localizan diálogos con `.max-w-md`, `.max-w-sm`, `.fixed.inset-0.z-50.flex.justify-end` y `.bd-row`**: no uses esas clases en componentes persistentes.
  - Evita: eyebrows en mayúsculas, tarjetas idénticas con sombra, animaciones de entrada por sección, enlaces con «→», cremas/terracota, fondo oscuro con acento ácido.

## Datos de demostración

- `server/prisma/demo/demo-data.json` (fechas relativas), `dataset.js` (`buildDataset(hoy)` puro; las pruebas calculan los esperados desde aquí), `server/scripts/seed-demo.js` (idempotente; se niega con `NODE_ENV=production`).
- Dominio `@demo.barberflow.com` (3 negocios: La Navaja, El Fade, Barbería Nueva + master). Las pruebas que **crean o modifican** usan negocios `@test.local` nuevos; las que leen agregados van contra el seed **solo en lectura**.
- Las fechas son relativas al día de carga: si cambia el día, recarga (`requireSeed()` avisa). `tests/demo/` no corre con `npm test` (se excluye en `vitest.config.js`).
- Los teléfonos de prueba **no** deben coincidir con los del seed (`30011100xx`).

## Reglas por área (el porqué está en `docs/HALLAZGOS.md`)

Antes de cambiar o relajar una de estas reglas, haz `Grep` de los IDs de su `(→ …)` en `docs/HALLAZGOS.md` y lee esas entradas (el defecto que la originó); el índice de esa página lleva de módulo a regla.

- **Modales y campos**: todo modal usa `Modal` (portal al `<body>`, `role="dialog"`, Escape, foco atrapado) y todo campo `Field`; no escribas el envoltorio `fixed inset-0` a mano. Todo `<form>` con `type="email"` lleva `noValidate`; Enter envía; errores con `role="alert"`. Cancelar una cita usa `CancelarCitaModal`, nunca `window.confirm`. (→ U1, U5, U8, U11, U13, U17; `noValidate`: nota de lecciones del Módulo 3)
- **Transacciones**: interactivas con cerrojo o tras un bcrypt → `{ maxWait: 15000, timeout: 15000 }`; el hash se calcula **antes**. Orden de cerrojos: fila/cita (o barbero+día) y después clientes. (→ H7, H14, H28; notas de lecciones de los Módulos 3, 5 y 8)
- **Migraciones**: `npx prisma migrate dev --name x --create-only`, **revisar el SQL** (renombrar → `RENAME COLUMN`), `npx prisma migrate deploy`. Nunca reiniciar la base (tiene datos reales). (→ nota «Migraciones nuevas» del Módulo 3: `RENAME COLUMN` escrito a mano)
- **Sesiones**: `User.sessionsValidFrom` invalida tokens anteriores (cambio de clave, baja); `RevokedToken` invalida uno concreto (logout); cada token lleva `jti`. (→ H8, H15, H16)
- **Mi negocio** no es pestaña: botón de la tienda en la cabecera (`TopNav` prop `onNegocio`, solo dueño). Las pestañas ya llenan 1280 px. (→ U3)
- **Servicios**: precio entero 0–10.000.000, duración 1–600 min, nombre único entre los activos (409); eliminar y alargar devuelven avisos (`pendingAppointments`, `scheduleConflicts`). (→ H25, H26, H28, H30, H31)
- **Inventario**: stock/mínimo 0–1.000.000, precios enteros 0–10.000.000, nombre único; el barbero no recibe `precioCosto`; historial en `GET /products/:id/stock-history`. (→ H36, H37, H41; nota «Historial de movimientos» del Módulo 6)
- **Clientes**: ficha por cita o venta (`upsertClientFromInteraction`, bajo cerrojo); teléfono por **dígitos sin 57**; mismo nombre + otro teléfono = otra persona; etiquetas Nuevo 0–1, Frecuente 2+, VIP 15+, Inactivo >35 días con ≥1 visita (manda sobre las demás). (→ H46, H48, H48b, H49)
- **Citas**: el estado cambia solo por `changeAppointment` y la creación por `createAppointmentIfFree`; pendiente ⇄ confirmada → finalizada | cancelada (no se reabren); `paymentMethod` solo al finalizar o para corregirlo en una finalizada. (→ H57, H58, H59, H60)
- **Ventas**: `clientId` de un cliente **del negocio** (404 si no); la ficha se crea dentro de la transacción de la venta. (→ H65, H66)
- **Analíticas**: variaciones contra el **mismo tramo** del período anterior; porcentajes que suman 100 con `splitPercents`; capacidad = activos + quien atendió ese día; `period` solo `week|month` (400); fechas de texto con `formatDateEs`. (→ H68, H70, H71, H72)
- **Búsquedas de texto**: nunca `contains`/`ILIKE` de Prisma con lo que escribe el usuario; filtra con `normalizeText`. **Master**: solo lectura, con `total` del sistema, sin datos de sesión. (→ H45, H76, H77; Master: nota «Limitación» del Módulo 11, `T-15`)

## Prohibiciones

- No commitear `.env` (existe `server/.env` local, ignorado por git) ni pegar secretos en archivos o commits.
- No usar el `JWT_SECRET` de ejemplo (`change-this...`) fuera de desarrollo; la API se niega a arrancar así en producción.
- No editar la migración `20250914120000_init`; los cambios de esquema van en una migración nueva.
- No debilitar seguridad existente (comparación contra `DUMMY_HASH` en login, mismo 401 para usuario inexistente/clave errónea, `helmet`, rate limits, recarga de usuario en cada request).
- No introducir mocks de datos de negocio en el dashboard: ya está conectado a la API.
- No usar `git reset`, `git clean`, `git checkout/restore -- …`, `git stash` ni `git add .`/`-A` sin que el usuario lo pida: hay trabajo sin versionar (`T-17`).

## Flujo de trabajo con IA

- Rama por feature (`feature/…`), no directo en `main`; un tema por commit; mensajes en español con prefijo (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`); atribución `Co-Authored-By` según indique la sesión. **No se commitea sin que el usuario lo pida**, y la documentación va en un commit aparte del código.
- Antes de commitear: regresión global (ver «Flujo de pruebas»).
- Cambios que afecten el contrato de la API: actualiza `src/api/client.js`, los hooks y la tabla de endpoints del `README.md`.
- **Al cerrar una sesión o tarea**, el protocolo de `CLAUDE.md` (primero `TASKS.md`, con evidencia real).
- Antes de repetir un procedimiento (probar un módulo, correr todo, nuevo endpoint, cambio de esquema) usa la skill correspondiente.
