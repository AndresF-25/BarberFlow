# HALLAZGOS — Historia de las pruebas módulo a módulo (datos demo)

Registro **append-only** de los defectos que encontraron las pruebas de `server/tests/demo/` y de cómo se corrigieron. Se lee **bajo demanda** (no se importa en `CLAUDE.md`): busca con `Grep` por módulo o por id (`H48`, `U11`…) en vez de leerlo entero.

- **Qué es y qué no es:** historia de defectos y sus correcciones. El **estado vigente** de cualquier tarea vive solo en [`TASKS.md`](../TASKS.md); todo hallazgo que quede abierto debe tener allí su `T-nn`. Las lecciones transversales se resumen en [`MEMORY.md`](../MEMORY.md).
- **Convención de las pruebas:** un hallazgo confirmado se escribe como `it.fails('HALLAZGO Hn [severidad] …')` (describe el comportamiento **esperado**: pasa mientras el defecto exista y se pone roja al corregirlo; entonces se quita el `.fails`). Los módulos 1–11 se corrigieron en el momento y sus pruebas son normales (vigilan que no vuelvan).
- **Nota de traslado (2026-10-08):** las secciones de los módulos 1–11 se movieron aquí **sin cambios** desde `MEMORY.md`. Se descartó únicamente la frase introductoria «Nada de esto está corregido todavía; la decisión es del dueño», porque dejó de ser cierta (los 11 módulos están corregidos). Las cifras de pruebas de cada sección son las del momento en que se escribió.

| Módulo | Tema | Archivo de pruebas |
|---|---|---|
| 1 | Registro | `01-registro.test.js` |
| 2 | Login y sesión | `02-login-sesion.test.js`, `src/context/AuthContext.session.test.jsx` |
| 3 | Empleados | `03-empleados.test.js`, `Modal.test.jsx`, `EmpleadosView.test.jsx`, `ChangePasswordModal.test.jsx` |
| 4 | Negocio | `04-negocio.test.js`, `NegocioView.test.jsx` |
| 5 | Servicios | `05-servicios.test.js`, `ServiciosView.test.jsx` |
| 6 | Productos e inventario | `06-productos.test.js`, `InventarioView.test.jsx` |
| 7 | Clientes | `07-clientes.test.js`, `ClientesView.test.jsx`, `CitaModal.test.jsx` |
| 8 | Citas | `08-citas.test.js`, `AgendaView.test.jsx`, `CitaModal.test.jsx` |
| 9 | Ventas de productos | `09-ventas.test.js`, `VentasView.test.jsx` |
| 10 | Analíticas | `10-analiticas.test.js`, `Analiticas.test.jsx` |
| 11 | Panel Master | `11-master.test.js`, `MasterDashboard.test.jsx` |

## Índice de IDs y enlaces
Añadido el 2026-10-08 (T-01) **fuera** de las secciones de los módulos 1–11, que no se tocaron. Úsalo para localizar un ID y saltar a la regla vigente o a la tarea; para el detalle, abre la sección del módulo (`Grep` del ID).

- **Series:** `H` = comportamiento, API, datos y seguridad (H1–H77); `U` = interfaz (U1–U19). Un ID con sufijo (`H23b`, `H47b`, `H48b`) está en el mismo módulo que su número base.
- **Huecos de numeración:** no hay entrada para `H27` (entre H26 y H28, módulo 5), `H51` (entre H50 y H52, módulos 7–8) ni `H69` (entre H68 y H70, módulo 10); la búsqueda de texto no encuentra ninguna mención y no consta si fueron números reservados o descartados. No se renumera nada ni se reutilizan.

| Módulo | IDs | Regla vigente en `AGENTS.md §«Reglas por área»` (viñeta) | Seguimiento en `TASKS.md` |
|---|---|---|---|
| 1 Registro | H1–H7 | «Transacciones» (H7: el hash va antes de la transacción) | — |
| 2 Login y sesión | H8–H12 | «Sesiones» (H8: `RevokedToken` y `jti`) | — |
| 3 Empleados | H13–H17, U1–U2 | «Sesiones» (H15, H16), «Modales y campos» (U1), «Transacciones» (H14: cerrojo por negocio) | — |
| 4 Negocio | H18–H22, U3 | «Mi negocio» | — |
| 5 Servicios | H23–H26, H28–H31 (+H23b), U4–U5 | «Servicios» | — |
| 6 Productos e inventario | H32–H41, U6–U8 | «Inventario» | — |
| 7 Clientes | H42–H50 (+H47b, H48b), U9–U12 | «Clientes», «Modales y campos» (U11, U12) | — |
| 8 Citas | H52–H60, U13–U16 | «Citas», «Modales y campos» (U13: diálogo propio de cancelación en vez de `window.confirm`) | `T-13` (nota «Decisión documentada»: finalizar citas futuras) |
| 9 Ventas de productos | H61–H67, U17 | «Ventas» | `T-14` (nota «Pendiente de diseño»: historial sin paginar) |
| 10 Analíticas | H68, H70–H75, U18 | «Analíticas» | — |
| 11 Panel Master | H76–H77, U19 | «Búsquedas de texto» (incluye la regla del master) | `T-15` (nota «Limitación»: solo lectura, sin paginación; `T-31` depende de `T-15`) |

Un hallazgo corregido no tiene `T-nn`; solo los que quedan abiertos o como decisión (ver la nota de «Qué es y qué no es»).

---

### Módulo 1 · Registro — CORREGIDO (57 pruebas) — `01-registro.test.js`
Los 6 hallazgos se corrigieron en `server/src/routes/auth.js` y sus pruebas son ahora normales (vigilan que no vuelvan). Al corregir H6 apareció una causa raíz más seria, **H7**:

| # | Hallazgo | Corrección |
|---|---|---|
| H1 | bcrypt solo usa 72 **bytes**; la validación contaba caracteres, y dos claves distintas podían iniciar sesión como una | La clave se limita a 72 **bytes** (`MAX_PASSWORD_BYTES`; los acentos cuentan doble) en registro y empleados, y el login rechaza una clave de más de 72 bytes |
| H2 | Nombre de solo espacios aceptado | `nameSchema`: `.trim().min(2)` |
| H3 | Nombre sin recortar (avatar del panel vacío) | `.trim()` + el avatar de `Header.jsx` ignora espacios sobrantes |
| H4 | Nombre sin longitud máxima | `.max(80)` |
| H5 | Correo con espacios se rechazaba | `emailSchema`: `.trim().max(254).email()` (también en login y empleados) |
| H6 | Dos altas simultáneas con el mismo correo daban 500 | P2002 → 409 `EMAIL_TAKEN` (registro y empleados) |
| **H7** | **Una ráfaga de altas con correos DISTINTOS también daba 500 (P2028, «no se pudo iniciar la transacción a tiempo»)**: el hash bcrypt se calculaba *dentro* de la transacción y la saturaba | El hash se calcula **antes**; negocio+dueño se crean con una escritura anidada (atómica, sin transacción interactiva). Comprobado: sin la corrección la prueba falla, con ella pasa |

Mensajes de validación en español: `El nombre debe tener al menos 2 caracteres.`, `El nombre es demasiado largo (máximo 80 caracteres).`, `La contraseña es demasiado larga (máximo 72 bytes; …)`. También se corrigió un resto de voseo del servidor («No tenés permiso» → «No tienes permiso»).

### Módulo 2 · Login y sesión — CORREGIDO (72 pruebas de API + 15 de cliente) — `02-login-sesion.test.js`, `src/context/AuthContext.session.test.jsx`
Los 5 hallazgos se corrigieron y se comprobaron en el navegador:

| # | Hallazgo | Corrección |
|---|---|---|
| **H11** | Un fallo de red/429/5xx al arrancar **borraba el token válido** y expulsaba al usuario | `AuthContext`: **solo un 401 cierra la sesión**; cualquier otro fallo conserva el token y expone `connectionError`/`retrySession`. `ProtectedRoute` muestra `SessionUnavailable` («No pudimos conectar con el servidor», botón Reintentar) y reintenta solo al volver la conexión (evento `online`) |
| H8 | `logout` no invalidaba el token (válido 7 días) | **Migración `20261008042922_revoked_tokens`**: tabla `revoked_tokens(jti, expires_at)`. Cada token lleva un `jti` único; `POST /logout` lo revoca y `authenticate` lo comprueba. Revoca **solo esa sesión** (la del celular no cierra la de la tablet). Limpieza oportunista de los ya caducados. **Limitación:** los tokens emitidos antes de este cambio no llevan `jti` y valen hasta caducar (≤7 días) |
| H10 | El 429 era texto plano en inglés (el usuario veía «Error en la solicitud.») | JSON `{ error, code:'RATE_LIMITED', retryAfter }` en español: «Demasiados intentos de acceso. Vuelve a intentarlo en 15 minutos.» |
| H12 | El login mostraba mensajes de Zod en inglés («Invalid email») | **Mapa global de Zod en español** (`server/src/lib/zodEs.js`) para TODA la API, más validación previa en `Login.jsx` («Ingresa tu correo.» / «Ingresa tu contraseña.») |
| H9 | `bearer` en minúsculas se rechazaba | `bearerToken()` sin distinguir mayúsculas (RFC 7235) |

Además: el límite de `/auth` (100/15 min) **ya solo cubre `login` y `register`** (antes incluía `/me`, que el cliente llama en cada carga: una barbería entera tras una IP lo agotaba y, junto con H11, expulsaba sesiones).

**Higiene de pruebas (error propio, corregido):** una prueba del módulo 1 registraba `ana+tag…@sub.test.local`, que **no termina en `@test.local`**, así que el limpiador no lo borraba: se acumularon 13 barberías basura en la BD (visibles en el panel Master). Se borraron (solo esas, por dominio exacto) y `00-seed.test.js` ahora falla si queda algún usuario con dominio parecido a `test.local` pero distinto. **Regla:** todo correo de prueba debe terminar en `@test.local`.

Lo que **sí** estaba bien desde el principio (probado): login correcto por rol con la forma exacta, el master sin negocio, correo sin distinguir mayúsculas ni espacios, respuesta idéntica para clave incorrecta y usuario inexistente (tarda lo mismo: compara contra un hash falso), la cuenta desactivada no se revela con clave incorrecta, tokens manipulados / `alg:none` / otro secreto / caducados / de un usuario borrado → 401, el **rol sale de la BD y no del token**, un usuario desactivado pierde el acceso al instante, `/health` público, CORS solo para el origen configurado y cabeceras de helmet.

### Módulo 3 · Empleados — CORREGIDO (77 pruebas de API + 44 de interfaz) — `03-empleados.test.js`, `Modal.test.jsx`, `EmpleadosView.test.jsx`, `ChangePasswordModal.test.jsx`
Todos los hallazgos se corrigieron y se comprobaron en el navegador:

| # | Hallazgo | Corrección |
|---|---|---|
| **H15** (alta) | No había forma de desactivar a un empleado: quien se iba conservaba el acceso | `PATCH /auth/employees/:id {active}`. Desactivar **cierra sus sesiones para siempre** (`sessionsValidFrom`) y devuelve `pendingAppointments` (citas futuras que le quedan); reactivar no resucita tokens viejos. `GET /auth/employees?includeInactive=true` (solo dueño) lista a los desactivados |
| H16 (media) | No se podía editar ni cambiar contraseñas | El mismo `PATCH` edita nombre, especialidad y **restablece la contraseña** (cierra sus sesiones). Nuevo `POST /auth/change-password` (cualquier rol): verifica la actual (400, no 401), cierra las demás sesiones y devuelve un token nuevo; comparte el límite de intentos de acceso. UI: botón de la llave en la cabecera (dashboard y master) |
| U1 (media) | Modales sin nombre accesible, sin `role="dialog"`, Escape no cerraba, foco libre | Componentes `Modal` y `Field` (`dashboard/components/Modal.jsx`) en los **9 modales y el cajón de Clientes**: `role="dialog"`+`aria-modal`+título, Escape, foco al primer campo, Tab atrapado, foco devuelto al cerrar, bloqueo de scroll; cada `<label>` enlazado a su campo |
| U2 (baja) | La tabla no mostraba especialidad ni color y tenía una columna «Rol» inútil | Barbero (color + especialidad), correo, estado y acciones por fila; aviso tras desactivar/reactivar |
| H13/H14/H17 | Especialidad sin límite; altas simultáneas repetían orden/color; la lista ignoraba `displayOrder` | `specialty` recortada y ≤60; alta bajo `pg_advisory_xact_lock` por negocio; lista ordenada por `displayOrder` |

**Migraciones nuevas:** `20261008042922_revoked_tokens` (tabla de tokens revocados) y `…_password_changed_at` + `…_sessions_valid_from` (columna que se creó y se renombró; la segunda es un `RENAME COLUMN` escrito a mano porque Prisma proponía borrar y crear). Hoy `User.sessionsValidFrom` cierra las sesiones anteriores.

**Lecciones del módulo (importantes):**
- `type="email"` hace que el **navegador** bloquee el envío con su propio mensaje antes del nuestro: todo `<form>` con campo de correo lleva `noValidate` (Registro y Login ya; ahora también Empleados).
- Mi arreglo de H14 introdujo un fallo **intermitente** (P2028 «no se pudo iniciar la transacción a tiempo» en una ráfaga de 8 altas): el cerrojo abre una transacción y los hashes bcrypt acaparan el proceso. Se corrigió con `{ maxWait: 15000, timeout: 15000 }`; 4 corridas completas seguidas, estables. **Cualquier transacción interactiva que siga a un hash bcrypt necesita ese margen.**
- El flujo de `prisma migrate dev` propone `DROP + ADD` al renombrar: hay que usar `--create-only` y editar el SQL. Si `prisma generate` da `EPERM … query_engine-windows.dll.node` (bloqueo de Windows/OneDrive) el cliente JS igualmente queda regenerado.

Observaciones (no son defectos): un barbero puede listar el equipo y ve el correo de sus compañeros; el 409 por correo repetido revela si un correo existe (igual que el registro público).

### Módulo 4 · Negocio — CORREGIDO (31 pruebas de API + 13 de interfaz) — `04-negocio.test.js`, `NegocioView.test.jsx`
| # | Hallazgo | Corrección |
|---|---|---|
| **U3** (alta) | No había ninguna pantalla para ver ni editar el perfil del negocio, y su nombre no aparecía en ningún lugar de la app | Vista **«Mi negocio»** (`views/NegocioView.jsx`, solo dueño): nombre, teléfono, dirección, descripción (contador /500) y logo con vista previa. Se abre desde un botón con icono de tienda en la cabecera (o pulsando el nombre del negocio bajo el logo); **no es una pestaña** porque con 11 pestañas «Ventas Extra» se salía de pantalla a 1440 px. El nombre del negocio se ve bajo «BarberFlow» y en el título de la pestaña del navegador. `AuthContext.updateBusiness` deja el resultado en `business` para toda la app |
| **H21** (seguridad) | `logoUrl` aceptaba `javascript:`, `data:`, `ftp://` y 2.100+ caracteres | Solo `http(s)` válido y ≤2048; vacío = quitar el logo. La vista previa del cliente nunca pinta un esquema peligroso |
| H18/H19/H20 | Nombre sin recortar/máximo; teléfono con cualquier texto; dirección y descripción sin máximo | `trim` en todo; nombre 1–80; teléfono vacío o dígitos/espacios/`+-()` de 7 a 20; dirección ≤200; descripción ≤500 |
| H22 | GET devolvía `logo` pero PATCH solo aceptaba `logoUrl` (se perdía en silencio) | PATCH acepta `logo` y `logoUrl` (si llegan los dos, gana `logoUrl`) |

Lo que **sí** estaba bien (probado): forma exacta del GET, un barbero ve lo mismo que su dueño, `/businesses/me` = `/auth/me`, cada campo se edita solo, `updatedAt` avanza, ediciones simultáneas no se pisan, matriz de roles y aislamiento entre negocios (nunca existió `/businesses/:id`).

### Módulo 5 · Servicios — CORREGIDO (43 pruebas de API + 25 de interfaz) — `05-servicios.test.js`, `ServiciosView.test.jsx`
| # | Hallazgo | Corrección |
|---|---|---|
| **H23b** (media) | **Finalizar la misma cita a la vez (dos pestañas, doble clic) daba 500**: las dos transacciones veían «sin cobro» y la segunda chocaba con la restricción única de `appointment_id`. El dato quedaba bien, el usuario veía un error | `completeAppointment` bloquea la fila con `SELECT … FOR UPDATE`; la segunda espera, ve «ya finalizada» y devuelve el mismo resultado. `veces` y la transacción de cobro se cuentan una sola vez |
| **H25** (media) | `precio` aceptaba decimales (35000.5 → se guardaba redondeado), valores enormes (10¹², 3·10⁹) y `1e400`: **500** por desbordar el entero de la base | Entero de pesos, 0 a **10.000.000**; mensajes en español |
| **H26** (media) | `duracion` sin máximo: 100000 min dejaba al barbero ocupado «para siempre»; 3·10⁹ daba **500** | 1 a **600** minutos (la jornada de 10 h) |
| H23/H24 | Nombre y categoría sin recortar, de solo espacios y sin máximo | `trim`; nombre ≤80; categoría ≤40 |
| H28 | Dos servicios activos con el mismo nombre (en el desplegable de citas son indistinguibles) | **409 `DUPLICATE_NAME`** sin distinguir mayúsculas ni espacios, también al renombrar; un servicio eliminado libera el nombre; negocios distintos sí pueden repetir. Comprobación bajo cerrojo por negocio (6 altas simultáneas con el mismo nombre dejan 1) |
| H29 | Editar o volver a eliminar un servicio ya eliminado daba 200 | 404 (igual que en el catálogo no existe) |
| H30 | Eliminar un servicio con citas futuras no avisaba | `DELETE` devuelve `{ ok, pendingAppointments }` (citas de hoy en adelante pendientes/confirmadas); la UI lo muestra |
| H31 | Alargar la duración dejaba citas futuras del mismo barbero solapadas sin aviso | `PATCH` devuelve `scheduleConflicts` (pares de citas que se pisan); no bloquea el cambio, la UI avisa |
| U4 (media) | La interfaz mentía: «Más solicitado … 56 veces **este mes**» (es el acumulado), «Ingreso total» con catálogo vacío mostraba **$1**, «Rentabilidad» era solo el peso en ingresos, «Solicitudes» contaba finalizadas | «Más realizado · N veces en total», «Ingreso estimado (realizados × precio actual)» con $0 si está vacío, columnas «Realizados» y «Peso en ingresos» |
| U5 (baja) | Modal de servicio: sin Enter, botón desactivado sin explicar por qué, sin `role=alert`, acciones sin nombre, una categoría fuera de la lista saltaba a «Cortes» | `<form>` con validación visible (mismas reglas que el servidor), `aria-label` por fila, la categoría propia se conserva |

Comportamiento documentado (no es defecto): al finalizar una cita el cobro usa el **precio vigente** del servicio en ese momento; lo ya cobrado conserva su monto (`ServiceTransaction.amountCents`) aunque cambie el precio. Cambiar el precio no altera el historial.

**Lecciones del módulo:**
- La lección del cerrojo se repitió: la primera versión de H28 (transacción + `pg_advisory_xact_lock`) daba P2028 en una ráfaga de 10 altas hasta añadir `{ maxWait: 15000, timeout: 15000 }`. **Toda transacción interactiva con cerrojo necesita ese margen**, no solo las que siguen a un bcrypt.
- `attempt()` (hooks) ahora **propaga lo que devuelve la acción** (`{ ok: true, ...extra }`): así los avisos del servidor (`pendingAppointments`, `scheduleConflicts`) llegan a la vista sin cambiar el contrato `{ ok, error }`.
- Al probar en el navegador con la API en otro puerto, la API solo acepta el origen de `CORS_ORIGIN` (por defecto 5173): con Vite en 5199 hay que arrancarla con `CORS_ORIGIN=http://localhost:5199` o el login da «Failed to fetch».

### Módulo 6 · Productos e inventario — CORREGIDO (42 pruebas de API + 32 de interfaz) — `06-productos.test.js`, `InventarioView.test.jsx`
**Invariante central** (ahora probado en el seed y en cada operación): la suma del historial de ajustes (`StockAdjustment`) de un producto = su stock.

| # | Hallazgo | Corrección |
|---|---|---|
| **H34** (media) | `adjust-stock` leía y luego escribía el valor absoluto: **10 ajustes simultáneos de +1 se perdían** (lost update) | Transacción con `SELECT … FOR UPDATE` de la fila; ajustes y ventas simultáneos se ponen en fila. Probado con 10×+1, 10×−1 sobre 5 y mezcla de ajustes y ventas |
| **H32** (media) | Un producto eliminado se podía **editar y volver a eliminar** (200) | 404 en PATCH y DELETE (como ya hacían ajustar y vender) |
| **H33** (media) | `PATCH {stock}` cambiaba el stock **sin dejar rastro** en el historial | El servidor calcula la diferencia sobre el stock real (bajo bloqueo) y la registra como `correction`; el mismo valor no genera ajuste vacío |
| H35 | Al pedir −100 con 3 en stock, el historial guardaba −100 pero el stock quedaba en 0 | Se registra el cambio **real** (−3); si no cambia nada, no se registra |
| H40 | El stock inicial al crear no entraba al historial (el seed sí) | Alta con stock > 0 registra un ajuste `manual` por el total |
| **H37** (media) | Stock, mínimo y precios sin tope: valores enormes, decimales y `1e400` daban **500** o se guardaban redondeados | Stock/mínimo enteros 0–1.000.000; precios enteros de pesos 0–10.000.000 |
| H36 (media) | `delta` enorme daba 500; `delta: 0` creaba un ajuste vacío | delta entero distinto de 0 en ±1.000.000; resultado > 1.000.000 → 400 `STOCK_LIMIT` |
| H38 | Productos activos con el mismo nombre | 409 `DUPLICATE_NAME` (mismo criterio y cerrojo que servicios) |
| H39 | Nombre, categoría y unidad sin recortar ni máximo | `trim`; 80 / 40 / 20 caracteres |
| H41 (media) | **El barbero recibía el precio de costo** de todos los productos (dato del dueño) | `GET /products` omite `precioCosto` para `employee` |
| U6 | La tabla decía «5 **unidads**» y «250 **mls**» | `fmtStock`: «1 unidad / 5 unidades», «2 paquetes», «250 ml»; «Agotado» en 0 |
| U7 (media) | El ajuste de stock (`adjust-stock`) **no tenía interfaz**: para recibir mercancía había que «editar» el producto y calcular el stock a mano | Botón «Ajustar stock» por fila: entra/sale mercancía, cantidad, y cuánto quedará («Solo hay N: quedará en 0») |
| U8 (baja) | Modal sin Enter, botón desactivado sin explicar, sin `role=alert`, acciones sin nombre, categoría/unidad fuera de la lista saltaban a la primera, categorías no listadas invisibles en el filtro | `<form>` con validación visible, `aria-label` por fila, valores propios conservados, chips de categoría con `aria-pressed` e incluyen las no estándar |

Otros cambios: «Editar» ya no hace dos peticiones (PATCH + ajuste con el stock en memoria, que podía estar desactualizado y no era atómico): ahora es **un solo PATCH**. Los datos demo usaban la unidad `"un"`; pasó a `"unidad"` (la que ofrece la interfaz).

**Historial de movimientos (añadido después):** `GET /products/:id/stock-history?limit=` (solo dueño, 1–200, por defecto 50) devuelve `{ movements: [{ id, fecha, motivo: venta|ajuste|correccion, cambio, saldo, ventaId }], total }`, del más reciente al más antiguo. `saldo` se calcula hacia atrás desde el stock actual, así es coherente incluso en productos anteriores al historial. UI: botón «Historial de stock de X» por fila (diálogo con fecha en hora de Bogotá, movimiento, cambio y «Quedó»).

Lo que **sí** estaba bien: forma exacta del GET, filtro `category` (exacto, sensible a mayúsculas) y `lowStock` (stock ≤ mínimo, incluye agotados), baja lógica que conserva ventas e historial, la venta descuenta con `updateMany + gte` (atómica), `reason: 'sale'` rechazada a mano, matriz de roles y aislamiento entre negocios.

### Módulo 7 · Clientes — CORREGIDO (44 pruebas de API + 20 de interfaz + 6 de «Nueva cita») — `07-clientes.test.js`, `ClientesView.test.jsx`, `CitaModal.test.jsx`
| # | Hallazgo | Corrección |
|---|---|---|
| **H48** (media) | **Un mismo teléfono escrito distinto (`300 555 6666`, `+57 300…`, `(300) 555-6666`) creaba clientes duplicados** | El teléfono se compara solo por dígitos y sin el 57 |
| **H48b** (media) | **Dos personas con el mismo nombre se fundían en una sola ficha** aunque tuvieran teléfonos distintos (y el teléfono nuevo se perdía) | Con teléfono, el nombre solo reconoce a una ficha **sin** teléfono (se le completa); si ya tiene otro, es otra persona |
| **H49** (media) | 8 citas simultáneas de un cliente nuevo creaban 8 fichas (lectura + escritura sin cerrojo) | Cerrojo por negocio (`pg_advisory_xact_lock('clients:…')`) en el alta; probado con 8 en paralelo |
| **H47** (media) | Los días «sin venir» se contaban en horas desde UTC: la visita de la noche (después de las 19:00 en Bogotá) se adelantaba un día y el historial mostraba la fecha de mañana | Todo se compara por **fecha del negocio** (`businessDateOf`); `enrichClients(..., { today })` es inyectable para probarlo |
| **H46** | Un cliente con **una** visita de hace meses seguía «Nuevo» para siempre | Inactivo = más de 35 días sin venir con ≥1 visita (manda sobre VIP). **Decisión de producto mía**: Nuevo = 0–1 visitas recientes; Frecuente 2+; VIP 15+. El dato demo `ivan` pasó a «Inactivo» |
| H42 | «Servicio favorito» era en realidad el último (incluso un producto) y la tabla mostraba el favorito como «Último servicio» | Campos separados: `ultimoServicio` (más reciente) y `favorito` (el más frecuente, empate: el más reciente); los productos no cuentan |
| H43 | «Frecuencia» decía «2 sem / 5+ sem» = **hace cuánto vino**, no cada cuánto | «Cada 10 días» / «Cada 4 semanas» (promedio entre días de visita); «—» con menos de 2 días |
| H44 | La lista salía por `updatedAt` de la ficha (casi creación) | Orden por visita más reciente, sin visitas al final, empate por nombre |
| H45 (media) | Buscar «sebastian» no encontraba a «Sebastián»; el teléfono con espacios o +57 tampoco | Búsqueda sin mayúsculas ni tildes; el teléfono se busca por dígitos. `?tag=` inválido → 400; `search` > 100 → 400; `%` y `_` son texto |
| **H50** (media) | **No había forma de corregir una ficha** (un error de tipeo creaba duplicados para siempre; `notes` existía en la tabla y no se usaba) | `PATCH /clients/:id` (**solo dueño**): nombre, teléfono, notas; recorta, junta espacios; teléfono repetido (aunque escrito distinto) → 409 `DUPLICATE_PHONE`; los homónimos sí se permiten. UI: «Editar ficha» en el perfil. Las citas ya tomadas conservan el nombre/teléfono con que se agendaron |
| H47b | El historial de ventas y cobros usaba la fecha UTC; el de servicios la del cobro, no la de la cita | `fecha` = día de la cita (o del negocio si el cobro no viene de una cita) |
| U9 | «Última visita» y el historial mostraban `2026-10-07` (nota del módulo 0) | `fmtFecha` → «7 oct 2026» (`dates.js`, sin depender del navegador) |
| U10 | Filtros sin `aria-pressed`, «Ver historial» sin saber de quién, «HISTORIAL» en mayúsculas, sin contador, la lista parpadeaba al buscar | Corregido (conserva las filas mientras recarga) |
| **U11** (media) | **Los diálogos se dibujaban dentro de la vista** (que anima su entrada y crea su propia capa): la **cabecera fija quedaba por encima**, y en el cajón del cliente tapaba el título y el botón de cerrar | `Modal` usa un **portal al `<body>`** |
| **U12** (media) | Si se abría «Nueva cita» antes de que cargaran servicios/equipo, el estado nacía vacío y «Guardar cita» quedaba desactivado sin explicación aunque el desplegable mostrara una opción. Lo destapó el smoke al ir más lento | `CitaModal` usa el id elegido o, si no hay, el primero disponible |

Contrato nuevo: cada cliente trae `{ id, nombre, telefono, notas, ultima, frecuencia, ultimoServicio, favorito, gasto, visitas, etiqueta }`. `telefono`, `ultima`, `favorito`, `ultimoServicio` y `frecuencia` devuelven `'—'` cuando no hay dato (la interfaz ya lo trata así).

**Lecciones:**
- Una prueba mía usó un teléfono del seed (`3001110001`) dentro de un negocio de prueba y rompió `00-seed` solo al correr en paralelo. **Los teléfonos de prueba no deben coincidir con los del seed** (`30011100xx`).
- Quedó una API vieja ocupando el puerto 3099 (por eso un arranque nuevo fallaba y el navegador daba «Failed to fetch»). Antes de levantar la API para el navegador, comprobar con `netstat` que el puerto esté libre y mirar la cabecera `Access-Control-Allow-Origin`.
- Los heredocs de bash con `'` dentro siguen fallando: para parches largos, escribir el archivo con la herramienta Write.

### Módulo 8 · Citas — CORREGIDO (43 pruebas de API + 19 de Agenda + 17 de «Nueva cita») — `08-citas.test.js`, `AgendaView.test.jsx`, `CitaModal.test.jsx`
| # | Hallazgo | Corrección |
|---|---|---|
| **H57** (alta) | **Doble reserva**: 6 peticiones simultáneas al mismo barbero y horario creaban 2 citas (se leía y luego se insertaba, sin cerrojo) | Comprobación de cruce + inserción en una transacción bajo `pg_advisory_xact_lock('appointments:{barbero}:{día}')`. Probado con 6 iguales y con 5 que se cruzan en parte |
| **H60** (media) | **Cancelar y finalizar a la vez** dejaba una cita **cancelada con cobro** (la comprobación de estado y el cambio eran pasos separados) | `changeAppointment`: transacción con `SELECT … FOR UPDATE` de la fila; el estado se lee y se cambia bajo bloqueo |
| **H58** (media) | Se podía pasar una cita **finalizada a pendiente/confirmada** (quedaba el cobro y la visita contada, sin cita finalizada) y reabrir una cancelada | Máquina de estados: pendiente ⇄ confirmada → finalizada o cancelada; finalizada y cancelada **no se reabren** (repetir el mismo estado es inocuo). 400 `INVALID_STATUS` |
| **H52** (media) | `GET /appointments?status=inventado` daba **500** | Se valida el estado (en inglés o español, distingue mayúsculas): 400 «Estado no válido…» |
| **H53** (media) | `clientName` de solo espacios pasaba y la cita quedaba **sin nombre**; sin máximo | `trim`, espacios juntos, 1–80; antes de crear la cita |
| H54 | `clientPhone` aceptaba cualquier texto (`<script>`, 1.000 caracteres) | Vacío o formato de teléfono (7–20) y se recorta |
| H55 | Se podía agendar al año 9999 | Máximo 365 días vista: 400 `TOO_FAR` |
| H56 | Una cita de 23:30 con servicio de 60 min cruzaba la medianoche (y el cruce con el día siguiente no se detectaba) | 400 `PAST_MIDNIGHT` si termina después de las 24:00 |
| H59 (media) | `paymentMethod` sin finalizar se **ignoraba en silencio** (200); no había cómo corregir cómo pagó el cliente | Sin finalizar → 400; en una finalizada **corrige el método** (monto y `veces` intactos) |
| U13 | «Cancelar» usaba `window.confirm` del navegador (sin estilo, inaccesible, no probable) | Diálogo propio «¿Cancelar la cita?» con cliente, servicio y hora; «Volver» / «Cancelar cita» |
| U14 | Títulos «8 De Octubre» (cada palabra en mayúscula) y «Semana del jueves, 5 de octubre al miércoles, 11 de octubre»; acciones solo con `title`; filtros sin `aria-pressed`; días del mes sin nombre; estado solo por color | «Jueves, 8 de octubre», «Semana del 5 al 11 de octubre», `aria-label` por cita, `aria-pressed`, el estado en texto, formulario con Enter y validación visible |
| U15 | La hora por defecto era «10:00» fijo: el primer intento de hoy daba «en el pasado» | Próxima media hora (tope 23:30) |
| U16 | Las finalizadas no mostraban cuánto ni cómo se cobró; una cita abierta de un día anterior no avisaba | `valor` y `metodoPago` en la respuesta y en la fila («$38.000 · Tarjeta»); aviso «Sin cerrar» en citas abiertas de días anteriores |

Contrato nuevo: cada cita trae además `metodoPago` (`cash|card|transfer`) y `valor` (pesos), `null` si no está finalizada.

**Decisión documentada (no es defecto):** se puede finalizar una cita de una fecha futura. No lo bloqueé porque el smoke del frontend depende de ello (no se puede crear una cita en el pasado ni al final del día); si quieres impedirlo, hay que preparar las pruebas con citas insertadas por Prisma.

**Lecciones:**
- Un `pg_advisory_xact_lock` + `$transaction` interactivo necesita `{ maxWait: 15000, timeout: 15000 }` (también aquí).
- Orden de cerrojos: primero el de la cita (barbero/día o la fila), después el de clientes; así no hay interbloqueos.
- Al arrancar la API para el navegador **antes** de lanzar otra, cierra la anterior: había un proceso viejo en el 3099 sin que me diera cuenta.

### Módulo 9 · Ventas de productos — CORREGIDO (26 pruebas de API + 19 de interfaz) — `09-ventas.test.js`, `VentasView.test.jsx`
| # | Hallazgo | Corrección |
|---|---|---|
| **H66** (alta) | **`POST /product-sales` aceptaba el `clientId` de OTRO negocio** (201) y vinculaba la venta con la ficha ajena (y un `clientId` inexistente daba 500) | La ficha debe ser del negocio: 404 «Cliente no encontrado.» (uuid mal formado → 400); el stock no cambia |
| **H61** (media) | `?from=basura` / `?to=2030-13-01` daban **500** (fecha inválida llegaba a Prisma) | 400 «Fecha inválida.» (`from`/`to` repetidos usan el primero; vacío = sin filtro) |
| **H62** (media) | La fecha de la venta y los filtros `from/to` usaban **UTC**: una venta de las 9:30 p. m. en Bogotá aparecía en el día siguiente y quedaba fuera de `to=ese día` | `businessDateOf` + `businessTimeOf`; los filtros usan `businessDayStart/End` (00:00–23:59:59 del negocio, con el desfase real de `BUSINESS_TZ`). Cada venta trae `hora` |
| **H63** (media) | **Un barbero veía el historial completo** (todas las ventas y los clientes de los demás) | Un `employee` solo ve las suyas (como con las citas); el dueño ve todas. Cada venta trae `vendedor` |
| H65 | Con `clientId` válido la venta no mostraba el nombre del cliente; con `clientId` y `clientName` se creaba además una ficha con el nombre escrito | La ficha manda; el nombre mostrado es el canónico de la ficha (también al reconocer por nombre) |
| H67 | Una venta rechazada por falta de stock dejaba **creada la ficha** del cliente | La ficha se crea/reconoce dentro de la transacción, después del descuento |
| H64 | `clientName` sin máximo | Recortado, espacios juntos, ≤80; solo espacios = «sin cliente» |
| U17 (media) | La tabla mostraba `2026-10-08`; el formulario era un `div` (sin Enter), con cantidad `NaN`/decimal y el botón desactivado sin explicar; sin vendedor; los KPI eran del historial entero sin decirlo | `fmtFecha` + hora, formulario validado («Solo hay 5 en stock»), columna «Vendió» (dueño), y **filtro de período** (Hoy / 7 días / 30 días / Todo; por defecto 30 días) que gobierna tabla e indicadores |

Contrato nuevo: cada venta trae `{ id, fecha, hora, productoId, producto, cantidad, precioUnitario, total, cliente, vendedor }`. `precioUnitario` queda fijado al vender (cambiar el precio después no altera ventas pasadas).

**Pendiente de diseño (no defecto):** la vista carga todo el historial y filtra el período en el cliente; con años de ventas habrá que paginar o pedir `from/to` al servidor.

### Módulo 10 · Analíticas — CORREGIDO (38 pruebas de API + 12 de interfaz) — `10-analiticas.test.js`, `Analiticas.test.jsx`
Los valores esperados se calculan desde el dataset con lógica **independiente** de la del servidor (citas, ingresos, ocupación, clientes nuevos, demanda por hora, etc.); coincidían, salvo en lo que sigue. Lo que **sí** estaba bien: todas las cifras base del panel, ingresos y métricas, las fechas del negocio (ya usaban `businessDateOf`: una venta de las 9:30 p. m. cae en su día), ceros y `null` en un negocio vacío, `?date`/`anchorDate` inválidos → 400, solo el dueño (barbero 403, master 403 `NO_BUSINESS`).

| # | Hallazgo | Corrección |
|---|---|---|
| **H68** (media) | **Las tendencias comparaban el período en curso (incompleto) con el anterior ya completo**: un lunes «Semana» mostraba ≈ −85 %, a mitad de mes «Mes» ≈ −60 % | Semana y mes se comparan con el **mismo tramo** del período anterior (hasta el día elegido). También `clientesNuevos` y `revenue.trendMes`. Los importes mostrados siguen siendo los del período completo |
| **H70** (media) | La ocupación dividía entre los barberos **activos de hoy**: citas de un barbero dado de baja inflaban el % (80 % en vez de 40 %) | La capacidad cuenta a los activos **y** a quien atendió citas ese día (panel y métricas) |
| **H71** (media) | Los porcentajes de métodos de pago sumaban **101 %** (cada parte redondeada por separado) | Método del mayor resto: siempre suman 100 (también nuevos vs. recurrentes) |
| **H72** (media) | `?period=year` (o `MONTH`) se tomaba como «week» **en silencio** | 400 «Período no válido. Usa week o month.»; vacío = semana |
| H73 | «Servicio más vendido» era **no determinista** en empates (dependía del orden de llegada) | Más veces → más ingresos → nombre |
| **H74** (media) | Alerta de stock: orden arbitrario, «2 unidad(s)», y un producto **agotado** no era urgente | Los agotados primero; «2 unidades» / «Agotado»; prioridad **alta** si hay agotados |
| **H75** (media) | **No había aviso de citas de días anteriores sin cerrar** (sin cobro, fuera de los ingresos para siempre) | Alerta nueva `sincerrar` (prioridad alta, la más antigua primero, lleva a la agenda) |
| (alertas) | «Última visita: 2026-07-15» (fecha técnica); las alertas no estaban ordenadas por urgencia | `formatDateEs` («15 jul 2026»); alta → media → baja |
| U18 (media) | «4 finalizadas · **2 pendientes**» ignoraba las confirmadas (el servidor ya contaba pendientes+confirmadas); la variación de «Semana/Mes vs. anterior» no decía contra qué; «Días más rentables» y «Servicio más vendido» eran ingresos y servicios realizados; métodos de pago solo cuentan servicios; el **0 %** salía como subida verde; píldora de prioridad en mayúsculas; selector Semana/Mes y flechas sin texto para lector de pantalla | «por atender», subtítulos que explican la base de cada variación, «Ingresos por día de la semana», «Servicio más realizado», «Cómo pagaron los servicios», 0 % neutro, `aria-pressed`, flechas ocultas y «más/menos/sin cambio» solo para lectores |

Contrato: `GET /analytics/alerts` puede traer `tipo: 'sincerrar'`; `revenue` y `metrics` rechazan `period` desconocido (400). Los importes de `dashboard`/`revenue` no cambian de forma; solo `trends.*` y `resumen.trendMes`.

**Observaciones (no son defectos):** `ingresosHoy` se compara con el mismo día de la semana pasada **completo** (no se puede comparar por horas); `ticketPromedio` solo cuenta servicios aunque `ingresosMes` incluya productos; los ingresos van por la fecha en que se finaliza/cobra (no la de la cita); la ocupación del período usa «días con actividad», no días laborables.

### Módulo 11 · Panel Master — CORREGIDO (16 pruebas de API + 11 de interfaz) — `11-master.test.js`, `MasterDashboard.test.jsx`
Lo que **sí** estaba bien: solo el rol `master` entra (dueño y barbero 403 `FORBIDDEN`, anónimo y token falso 401), sin hashes ni datos de sesión, el filtro por rol/negocio, el rol inválido → 400, y el master no opera sobre ningún negocio (403 `NO_BUSINESS` en todas las rutas de negocio).

| # | Hallazgo | Corrección |
|---|---|---|
| **H76** (media) | La búsqueda de negocios usaba `contains` de la base: **`%` y `_` eran comodines** (buscar «%» devolvía todos) y las tildes contaban («barberia» no encontraba «Barbería») | Búsqueda en el servidor sin comodines, sin mayúsculas ni tildes; encuentra por el nombre del negocio **o por el nombre/correo de su dueño**; máx. 100 caracteres (400) |
| **H77** (media) | **Un empleado dado de baja era indistinguible de uno activo** en `/master/users` (no venía su estado) | Cada usuario trae `active`, `businessName` y `createdAt` |
| (negocios) | La lista solo traía el perfil: sin dueño, sin empleados, sin fecha de registro; los conteos los armaba la pantalla cruzando con la lista completa de usuarios | Cada negocio trae `owner {name,email}`, `employees` (activos), `inactiveEmployees` y `createdAt`; ambas listas traen `total` (del sistema, no cambia al buscar) |
| (`?role=a&role=b`) | Un parámetro repetido daba 400 | Se usa el primero |
| **U19** (media) | **Si la carga fallaba, la pantalla decía «No hay negocios registrados todavía»** (el `catch` vaciaba las listas en silencio); «Negocios registrados» y «Usuarios totales» cambiaban al buscar; el rol salía en inglés (`owner`); sin estado de los usuarios; columna de uuid; tablas sin scroll horizontal en móvil | Aviso de error con **Reintentar**; totales del servidor y «N de M negocios» al buscar; roles en español; columna «Estado»; dueño y empleados activos/desactivados y fecha de registro (día de Bogotá) en vez del uuid (queda en el `title`); con una búsqueda activa los usuarios son los de los negocios encontrados |

Contrato nuevo (solo master): `GET /master/businesses` → `{ businesses: [{ id, name, logo, description, phone, address, createdAt, owner, employees, inactiveEmployees }], total }`; `GET /master/users` → `{ users: [{ id, name, email, role, businessId, businessName, active, createdAt }], total }`.

**Limitación (no es defecto):** el panel es de solo lectura; el master no puede suspender un negocio ni desactivar a su dueño. Tampoco hay paginación (se cargan todos los negocios y usuarios).

