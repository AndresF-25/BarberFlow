# BarberFlow

Plataforma web para administrar una barbería: agenda de citas, clientes, servicios, inventario, ventas de productos, ingresos y métricas. Cada negocio ve únicamente sus propios datos (multi-negocio) y hay tres roles: **propietario**, **empleado** y **master** (administrador de la plataforma).

Si colaboras (persona o agente de IA), empieza por `CLAUDE.md`: enruta a las reglas (`AGENTS.md`), el estado (`PROJECT_STATUS.md`) y las tareas (`TASKS.md`).

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS, Recharts, lucide-react |
| Backend | Node.js (ESM), Express 4, Prisma 5, Zod, JWT, bcrypt, Helmet |
| Base de datos | PostgreSQL 16 (Docker) |
| Pruebas | Vitest, Supertest, Testing Library |
| Calidad | ESLint 9 |

## Estructura

```
├── src/                         Frontend
│   ├── api/client.js            Cliente HTTP de la API
│   ├── context/AuthContext.jsx  Sesión (login, registro, empleados)
│   ├── routes/                  ProtectedRoute y RoleRoute
│   └── pages/
│       ├── landing/  auth/  master/
│       └── dashboard/           Panel del propietario y del empleado
│           ├── Dashboard.jsx    Estructura general y navegación
│           ├── views/           Una vista por pantalla (Agenda, Clientes, Servicios, ...)
│           ├── components/      Header (cabecera con pestañas), Modal, Sillas y piezas comunes
│           └── hooks/           Carga y guardado de datos (useServicios, useTienda, ...)
├── server/                      Backend
│   ├── prisma/                  Esquema, migraciones y demo/ (datos de demostración)
│   ├── src/                     routes/, services/, middleware/, lib/
│   ├── tests/                   unit/, integration/ y demo/ (pruebas por módulo)
│   └── scripts/                 Utilidades (datos demo y limpieza de datos de prueba)
├── docker/nginx.conf            Configuración del servidor web de producción
├── docker-compose.yml           Base de datos (+ API y web con --profile app)
└── Dockerfile, server/Dockerfile
```

## Puesta en marcha (desarrollo)

Requisitos: **Node.js 20 o superior** y **Docker Desktop**.

```bash
# 1. Base de datos
docker compose up -d

# 2. Servidor: variables de entorno, dependencias y tablas
cd server
cp .env.example .env            # en Windows: copy .env.example .env
npm install
npm run db:deploy               # aplica las migraciones
cd ..

# 3. Frontend y arranque de todo
npm install
npm run dev:all                 # API en :3001 y web en :5173
```

Abre <http://localhost:5173>, crea una cuenta desde **Registro** y entrarás como propietario de un negocio nuevo.

> **Antes de publicar nada:** genera tu propio `JWT_SECRET` (ver abajo). El valor de ejemplo de `.env.example` es público; en desarrollo la API solo muestra una advertencia, pero en producción **se niega a arrancar** con él.

### Variables de entorno del servidor (`server/.env`)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión de PostgreSQL |
| `JWT_SECRET` | Sí | Firma de los tokens, mínimo 16 caracteres. Genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | No | Duración de la sesión (por defecto `7d`) |
| `PORT` | No | Puerto de la API (por defecto `3001`) |
| `CORS_ORIGIN` | No | Origen permitido del frontend (por defecto `http://localhost:5173`) |
| `BUSINESS_TZ` | No | Zona horaria del negocio (por defecto `America/Bogota`). Define qué es "hoy" y a qué día pertenece cada cobro |
| `TRUST_PROXY` | No | Número de proxies delante de la API (con nginx: `1`) |
| `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` | No | Peticiones por IP cada 15 min: general (1000) y de `/auth` (100) |
| `MASTER_EMAIL`, `MASTER_PASSWORD`, `MASTER_NAME` | No | Crean el usuario master al arrancar, solo si todavía no existe ninguno |

## Scripts

Desde la raíz:

| Comando | Qué hace |
|---|---|
| `npm run dev:all` | API y frontend en modo desarrollo |
| `npm run build` | Genera el frontend en `dist/` |
| `npm run lint` | ESLint sobre frontend y servidor |
| `npm run test:server` | Pruebas del servidor |
| `npm test` | Prueba de humo del frontend (necesita la API, ver abajo) |

Desde `server/`: `npm run dev`, `npm start`, `npm run db:deploy` (aplica migraciones), `npm run db:migrate` (crea una migración nueva tras cambiar el esquema; ojo: es `prisma migrate dev` y también la **aplica**: el procedimiento seguro, con revisión del SQL, está en `AGENTS.md` §«Reglas por área», viñeta «Migraciones»), `npm run db:studio` (explorador de la base de datos), `npm test` y `npm run test:cleanup`.

## Pruebas

Hay **tres suites**. Las de integración y el smoke usan servicios reales (Postgres y la API) y **se omiten solas si no los encuentran**: un resultado verde solo vale si el recuento de pruebas es el esperado y no hay `skipped`. Qué ejecutar y cuándo (específica → estabilidad → regresión), con límites de tiempo y código de salida: `AGENTS.md` §«Flujo de pruebas» y la skill `run-full-test-suite`.

> **Las pruebas usan la misma base de datos que la aplicación** (`barberflow`). Solo crean y borran datos con correos `@test.local` (y recargan los datos demo `@demo.barberflow.com`), pero la limpieza borra el negocio completo de cualquier usuario con correo `@test.local`: **nunca uses ese dominio en cuentas reales** y haz un respaldo (`pg_dump`) antes de ejecutarlas. Si una corrida se interrumpe, `npm run test:cleanup --prefix server` elimina los restos.

**1. Servidor** (utilidades, seguridad, autenticación y cada recurso). Necesita `docker compose up -d`.

```bash
npm run test:server        # o: cd server && npm test
```

**2. Datos demo, por módulo** (`server/tests/demo/`, no corren con `npm test`; recargan antes los datos demo y la suite completa tarda unos 10 minutos):

```bash
cd server
npm run test:demo -- tests/demo/05-servicios.test.js   # un módulo
npm run test:demo                                       # todos
```

**3. Frontend** (pruebas de componentes y el smoke del Dashboard contra la API real). El smoke necesita la API en un puerto aparte; sin ella, esa prueba se omite:

```bash
# terminal 1 (carpeta server)
PORT=3099 AUTH_RATE_LIMIT_MAX=100000 RATE_LIMIT_MAX=100000 npm run dev
# PowerShell: $env:PORT=3099; $env:AUTH_RATE_LIMIT_MAX=100000; $env:RATE_LIMIT_MAX=100000; npm run dev

# terminal 2 (raíz)
VITE_API_URL=http://localhost:3099/api/v1 npx vitest run
# PowerShell: $env:VITE_API_URL="http://localhost:3099/api/v1"; npx vitest run
npm run test:cleanup --prefix server                  # borra los datos de prueba
```

Para probar la interfaz en un navegador con Vite en otro puerto, arranca la API con `CORS_ORIGIN=http://localhost:<puerto>`.

## Aplicación completa con Docker

Levanta la base de datos, la API y la web (con nginx) en <http://localhost:8080>:

```bash
# 1. Crea un archivo .env en la raíz (ver .env.example) con, como mínimo, JWT_SECRET
# 2.
docker compose --profile app up -d --build
```

- La API aplica las migraciones sola al arrancar.
- Sin `--profile app`, `docker compose up -d` levanta únicamente la base de datos (modo desarrollo).
- La base de datos solo es accesible desde la propia máquina (`127.0.0.1:5432`). En un servidor real cambia `POSTGRES_PASSWORD`.
- Si falta `JWT_SECRET`, o es el valor de ejemplo, la API se detiene y lo explica en `docker compose logs api`.

## Roles y permisos

| | Propietario | Empleado | Master |
|---|:-:|:-:|:-:|
| Panel, agenda y clientes | ✓ | ✓ (solo sus citas) | — |
| Crear y cambiar citas | ✓ | ✓ (solo las suyas) | — |
| Ver servicios | ✓ | ✓ | — |
| Crear, editar y borrar servicios | ✓ | — | — |
| Inventario (productos, stock, costos) | ✓ | — | — |
| Registrar ventas de productos | ✓ | ✓ | — |
| Ingresos, métricas y alertas | ✓ | — | — |
| Crear empleados y editar el negocio | ✓ | — | — |
| Ver todos los negocios y usuarios | — | — | ✓ |

## API

Base: `/api/v1`. Todas las rutas, salvo `register`, `login` y `health`, requieren `Authorization: Bearer <token>`.

| Recurso | Endpoints |
|---|---|
| Sesión | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Empleados | `GET /auth/employees`, `POST /auth/employees` (propietario) |
| Negocio | `GET /businesses/me`, `PATCH /businesses/me` (propietario; acepta `logo` o `logoUrl`, solo http/https) |
| Citas | `GET /appointments?date=&from=&to=&status=&employeeId=` (estado en inglés o español; inválido → 400), `POST /appointments` (409 si el barbero está ocupado; 400 `PAST_APPOINTMENT`/`TOO_FAR`/`PAST_MIDNIGHT`), `PATCH /appointments/:id` (`status`, `paymentMethod`; 400 `INVALID_STATUS` si la cita ya está finalizada o cancelada). Cada cita trae `metodoPago` y `valor` si está finalizada |
| Clientes | `GET /clients?search=&tag=` (sin tildes ni mayúsculas; `tag` Todos/Nuevo/Frecuente/VIP/Inactivo), `GET /clients/:id`, `PATCH /clients/:id` (propietario: `name`, `phone`, `notes`; 409 `DUPLICATE_PHONE`) |
| Servicios | `GET /services`, `POST`, `PATCH /:id` (devuelve `scheduleConflicts`), `DELETE /:id` (devuelve `pendingAppointments`); escritura: propietario; nombre único (409 `DUPLICATE_NAME`) |
| Productos | `GET /products?category=&lowStock=true` (el barbero no recibe `precioCosto`), `POST`, `PATCH /:id` (un `stock` nuevo queda como corrección), `DELETE /:id`, `POST /:id/adjust-stock` (`delta` ≠ 0, `reason` manual\|correction), `GET /:id/stock-history?limit=` (propietario); escritura: propietario; nombre único (409 `DUPLICATE_NAME`) |
| Ventas | `GET /product-sales?from=&to=` (días del negocio, inclusive; fecha inválida → 400; el barbero solo ve las suyas), `POST /product-sales` (`productId`, `quantity`, `clientId` de una ficha propia o `clientName`; 404 si la ficha es ajena). Cada venta trae `fecha`, `hora` y `vendedor` |
| Analíticas (propietario) | `GET /analytics/dashboard?date=`, `/revenue?period=week\|month&anchorDate=`, `/metrics?period=&anchorDate=`, `/alerts` (incluye «citas sin cerrar»). `period` inválido y fechas inválidas → 400. Las variaciones comparan el mismo tramo del período anterior |
| Master | `GET /master/businesses?search=` (nombre del negocio o del dueño; trae dueño, empleados activos/inactivos y fecha), `GET /master/users?role=&businessId=` (trae `active` y `businessName`); ambas con `total`. Solo lectura |
| Estado | `GET /health` |

## Reglas de negocio

Resumen para leer; la **fuente normativa**, con todos los límites y excepciones, es `AGENTS.md` §«Reglas de dominio» y §«Reglas por área» (si difieren, manda `AGENTS.md`).

- **Citas:** no se pueden crear en el pasado; la hora debe ser `HH:MM` válida; un barbero no puede tener dos citas que se crucen según la duración del servicio (las canceladas liberan el horario). Una cita finalizada registra el cobro, el método de pago y suma una visita al cliente.
- **Clientes:** se crean solos al agendar una cita o vender un producto con nombre de cliente, y se reconocen por teléfono o por nombre. Las etiquetas (Nuevo, Frecuente, VIP, Inactivo) se calculan según sus visitas.
- **Dinero:** se guarda en centavos (enteros) y se muestra en pesos.
- **Inventario:** el descuento de stock al vender es atómico: dos ventas simultáneas por la última unidad no pueden dejar el stock negativo. Los productos y servicios "eliminados" se ocultan, pero su historial se conserva.
- **Ocupación de la agenda:** minutos agendados sobre una jornada de 10 horas por barbero activo.
- **Zona horaria:** "hoy" y la fecha de cada cobro se calculan en `BUSINESS_TZ`, no en UTC.

## Seguridad

Resumen para leer; las reglas que no se pueden debilitar están en `AGENTS.md` §«Prohibiciones» y §«Reglas de dominio», y el porqué de las decisiones en `MEMORY.md` §«Decisiones tomadas (y por qué)».

- Contraseñas con bcrypt; mínimo 8 caracteres con letras y números.
- Tokens JWT firmados con `JWT_SECRET`; la API verifica en cada petición que el usuario siga activo.
- Aislamiento por negocio en todas las consultas, y permisos por rol en el servidor (no solo en la interfaz).
- Helmet, CORS restringido, límite de tamaño del cuerpo y límite de peticiones por IP (más estricto en `/auth`).
- El inicio de sesión responde igual y tarda lo mismo si el correo no existe, para no revelar qué cuentas están registradas.

## Solución de problemas

- **`JWT_SECRET no está definido o es muy corto`**: configúralo en `server/.env` (o en `.env` para Docker).
- **`Can't reach database server`**: la base de datos no está arriba; ejecuta `docker compose up -d` y revisa `DATABASE_URL`.
- **Error 429 en pruebas o en uso intensivo**: se alcanzó el límite de peticiones; ajusta `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` o reinicia la API.
- **Los datos de "hoy" salen desfasados un día**: revisa `BUSINESS_TZ`.
- **«Failed to fetch» al iniciar sesión en el navegador**: suele ser una API vieja ocupando el puerto (el arranque nuevo falla en silencio) o un `CORS_ORIGIN` que no coincide con el origen de Vite; comprueba el puerto y reinicia la API con el origen correcto.
- **Las pruebas de datos demo fallan por «datos de otro día»**: las fechas demo son relativas al día de carga; `npm run db:seed:demo` las recarga.
