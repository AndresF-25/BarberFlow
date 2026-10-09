# MEMORY — Decisiones duraderas, gotchas y lecciones de BarberFlow

Memoria **del proyecto** (versionable; `CLAUDE.md` la importa). **No** es la memoria automática de Claude Code (la de `C:\Users\mau99\.claude\projects\…\memory\`, personal y fuera del repo). Aquí **no hay estados de tareas** (→ `TASKS.md`), **ni cifras de pruebas** (→ `PROJECT_STATUS.md`), **ni la historia de cada defecto** (→ `docs/HALLAZGOS.md`). Las reglas imperativas están en `AGENTS.md`. Se actualiza solo si hay una decisión o lección duradera.

## Decisiones tomadas (y por qué)

**Diseño**
- **Dashboard «Turno» (2026-10-07):** cabecera superior con pestañas, lienzo blanco, secciones sin caja, un acento tónico y «Sillas de hoy» como pieza principal (ancho del bloque = duración real). Razón: el barbero necesita ver de un vistazo quién está libre o atrasado. Sustituye a la barra lateral naval. Tokens: `C.accent` (tónico), `C.ink`, `C.amberSolid`, `INV` (índigo, Tienda). Se eliminaron `SIDE`, `Sidebar` y `Topbar`.
- **Landing y acceso «Esmalte» (2026-10-07):** tinta naval + cobalto, rojo solo en el poste, Archivo. Reemplazó el pino/dorado/cuero (cliché y dos identidades distintas). Los colores de datos del servidor (`STAFF_COLORS`, `PAYMENT_COLORS`) se alinearon con la paleta; los empleados viejos conservan el color guardado.
- **Tono de UI:** tuteo (no voseo), app para Colombia.

**Seguridad y sesión**
- **`DUMMY_HASH` en login:** se compara siempre contra un hash → mismo tiempo y mismo 401 con usuario inexistente o clave errónea (sin enumeración).
- **bcryptjs, 12 rondas;** clave de 8–72 **bytes** con letra y número (en `Register.jsx` y `routes/auth.js`).
- **JWT con recarga del usuario en cada petición:** permite desactivar sin esperar la caducidad; el **rol sale de la BD**, no del token. `assertJwtSecret` rechaza secretos de ejemplo en producción.
- **Master solo por bootstrap** al arrancar y solo si no existe ninguno.

**Datos y dominio**
- **Borrado suave** en servicios y productos (no rompe historial). **Dinero en centavos.** Ocupación sobre jornada de 10 h (600 min por barbero).
- **Stock:** ventas con `updateMany + gte`; ajustes y ediciones bajo `SELECT … FOR UPDATE`; **editar el stock es un solo PATCH** que registra la corrección (el stock inicial también entra al historial).
- **Cobro de citas:** usa el **precio vigente** al finalizar; lo ya cobrado conserva su monto aunque cambie el precio.
- **Analíticas:** los ingresos van por la fecha en que se finaliza/cobra (no la de la cita); `ticketPromedio` solo cuenta servicios aunque los ingresos del mes incluyan productos; la ocupación del período usa «días con actividad»; `ingresosHoy` se compara con el mismo día de la semana pasada **completo**.
- **Clientes:** «Nuevo» = 0–1 visitas recientes, «Frecuente» 2+, «VIP» 15+, «Inactivo» = más de 35 días sin venir con ≥1 visita (manda sobre las demás; decisión de producto del módulo 7).
- **Frontend:** navegación del dashboard por estado (`active`), sin sub-rutas; menú por rol (`NAV_BY_ROLE`); hooks de escritura con `attempt()` que devuelve `{ ok, error, ...extra }`.
- **Tests contra Postgres real**, sin mocks; correos de prueba `@test.local` limpiados por `globalSetup` y `test:cleanup`.

**Documentación**
- **Sistema de conocimiento conectado (2026-10-08, `T-01`):** una fuente por tipo de información, `CLAUDE.md` como enrutado, referencias `archivo §«Sección»`, y los documentos «bajo demanda» se **abren y siguen**, no se suponen cargados. Razón: la prioridad es no duplicar ni contradecir; el peso en tokens es un efecto secundario (el criterio de 13 k se retiró) y no justifica borrar reglas, matices ni ID. Detalle y criterios: `CLAUDE.md` §«Una fuente por tipo de información» y `TASKS.md` `T-01`.

## Lecciones (qué nos costó y cómo evitarlo)

Cada lección guarda **lo que costó** y el porqué; la **regla vigente** vive en la fuente que cita (si no es un archivo cargado, ábrela antes de aplicarla).

1. **Transacciones interactivas con cerrojo o tras un bcrypt:** sin el margen de espera, o con el hash dentro de la transacción, hay P2028 intermitente en ráfagas (se repitió en los módulos 1, 3, 5 y 8). Regla: `AGENTS.md §«Reglas por área»` (Transacciones). (→ H7, H14, H28)
2. **Fechas: siempre del negocio:** UTC adelanta un día a partir de las 19:00 en Bogotá. Regla y helpers: `AGENTS.md §«Reglas de dominio»` (Zona horaria). (→ H47b, H62)
3. **Búsquedas de texto del usuario:** en `contains`/`ILIKE` de Prisma `%` y `_` son comodines y las tildes cuentan. Regla: `AGENTS.md §«Reglas por área»` (Búsquedas de texto). (→ H45, H76)
4. **Comparaciones de teléfono:** la regla completa (dígitos sin 57; mismo nombre + otro teléfono = otra persona) está en `AGENTS.md §«Reglas por área»` (Clientes). (→ H48, H48b)
5. **Formularios:** el navegador bloquea con su propio idioma el envío de un `type="email"` antes que nuestro mensaje. Regla (`noValidate`, Enter, `role="alert"`): `AGENTS.md §«Reglas por área»` (Modales y campos). (→ nota de lecciones del Módulo 3)
6. **Diálogos en un portal al `<body>`:** dentro de una vista (que anima su entrada) la cabecera fija los tapaba. Regla: `AGENTS.md §«Reglas por área»` (Modales y campos). (→ U11)
7. **Estado inicial de formularios con datos asíncronos:** usar «el elegido o el primero disponible»; si no, «Guardar» queda desactivado sin motivo. (Única fuente de esta regla: esta lección.) (→ U12)
8. **Porcentajes que deben sumar 100:** `splitPercents` usa el método del mayor resto (redondear cada parte sumaba 101 %). **Variaciones:** comparar el mismo tramo del período anterior, no el anterior completo (un lunes «Semana» mostraba ≈ −85 %). Regla: `AGENTS.md §«Reglas por área»` (Analíticas). (→ H68, H71)
9. **Migraciones:** Prisma propone `DROP + ADD` al renombrar una columna → se escribe `RENAME COLUMN` a mano. Si `prisma generate` da `EPERM … query_engine-windows.dll.node` (OneDrive/Windows) el cliente JS igual queda generado. Regla y procedimiento: `AGENTS.md §«Reglas por área»` (Migraciones) y la skill `change-db-schema`. (→ nota «Migraciones nuevas» del Módulo 3)
10. **Higiene de pruebas:** el limpiador solo ve el dominio `@test.local`; los teléfonos del seed (`30011100xx`) los cuenta `00-seed` y falla en paralelo. Reglas: `AGENTS.md §«Flujo de pruebas»` (viñeta «Base de datos») y `§«Datos de demostración»`. Un defecto confirmado y aún sin corregir se escribe como `it.fails('HALLAZGO Hn …')`: convención en `docs/HALLAZGOS.md` (cabecera, «Convención de las pruebas»).
11. **Entorno:** una API vieja en el puerto 3099 hace que el arranque nuevo falle en silencio y el navegador dé «Failed to fetch»; una vez se leyó un log viejo por error. Reglas: `AGENTS.md §«Flujo de pruebas»` (puertos, `CORS_ORIGIN`, log recién creado, `EXIT=`). Detalles de shell (PowerShell `timeout`/`npm.ps1`, `MSYS_NO_PATHCONV`): `PROJECT_STATUS.md §«Entorno (hechos comprobados)»`. Archivos largos con Write: `CLAUDE.md §«Leer poco»`.
12. **Datos reales en la misma base que las pruebas:** regla completa (respaldo antes de ejecutar; la limpieza borra el negocio entero de cada usuario `@test.local`) en `AGENTS.md §«Flujo de pruebas»` (viñeta «Base de datos»). (→ `T-18`)

## Gotchas

- **Zona horaria:** el cliente usa `todayIso()` (hora del navegador) y el servidor `BUSINESS_TZ`; si difieren, hay desfase de un día.
- **Rate limit:** `/auth` = 100 y el general = 1000 por 15 min. Para el smoke y las sesiones largas de capturas hay que subir `AUTH_RATE_LIMIT_MAX` **y** `RATE_LIMIT_MAX`; si no, la API responde 429 y las pruebas fallan por tiempo (6 s), lo que parece un fallo de la UI pero no lo es.
- **Errores de auth sin `code`** en 401/409 (`{ ok:false, error }`); el resto usa `{ error, code }`.
- **Cascade:** borrar un `Business` borra casi todo, pero `Appointment.service`/`employee` son restrict → el limpiador borra en orden concreto.
- **`master` no tiene `businessId`:** casi todas las rutas de negocio le devuelven 403 `NO_BUSINESS`.
- **`.dockerignore`** raíz excluye `server` y `README.md`; el de `server/` excluye `tests` y `scripts`.
- **Contenedor `api`** ejecuta `prisma migrate deploy` al arrancar y no arranca sin `JWT_SECRET`; no expone puerto al host (solo nginx en `WEB_PORT`, 8080).
- `server/.env` local usa el `JWT_SECRET` de ejemplo: válido en dev (con aviso), inválido en producción.
- Los tokens emitidos antes de la migración `revoked_tokens` no llevan `jti` y valen hasta caducar (≤7 días).
