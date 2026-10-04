# BarberFlow

Plataforma web para administrar una barbería: agenda de citas, clientes, servicios, inventario, ventas de productos, ingresos y métricas. Cada negocio ve únicamente sus propios datos (multi-negocio) y hay tres roles: **propietario**, **empleado** y **master** (administrador de la plataforma).

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
│           ├── components/      Sidebar, Topbar y piezas comunes
│           └── hooks/           Carga y guardado de datos (useServicios, useTienda, ...)
├── server/                      Backend
│   ├── prisma/                  Esquema y migraciones
│   ├── src/                     routes/, services/, middleware/, lib/
│   ├── tests/                   unit/ e integration/
│   └── scripts/                 Utilidades (limpieza de datos de prueba)
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

Desde `server/`: `npm run dev`, `npm start`, `npm run db:deploy` (aplica migraciones), `npm run db:migrate` (crea una migración nueva tras cambiar el esquema), `npm run db:studio` (explorador de la base de datos), `npm test` y `npm run test:cleanup`.

## Pruebas

**Servidor** (112 pruebas: utilidades, seguridad, autenticación, citas, servicios, inventario y ventas, clientes, analíticas y panel master). Usan la base de datos real, así que necesitan `docker compose up -d`; si no hay base de datos, las de integración se omiten solas.

```bash
npm run test:server
```

Solo crean y borran datos con correos `@test.local`; tus datos no se tocan. Si una corrida se interrumpe, `npm run test:cleanup --prefix server` elimina los restos.

**Frontend** (prueba de humo del Dashboard completo contra la API real). Levanta la API en un puerto aparte y apunta la prueba hacia él:

```bash
# terminal 1
cd server
PORT=3099 AUTH_RATE_LIMIT_MAX=100000 npm run dev      # PowerShell: $env:PORT=3099; $env:AUTH_RATE_LIMIT_MAX=100000; npm run dev

# terminal 2 (raíz)
VITE_API_URL=http://localhost:3099/api/v1 npm test    # PowerShell: $env:VITE_API_URL="http://localhost:3099/api/v1"; npm test
npm run test:cleanup --prefix server                  # borra los datos de prueba
```

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
| Negocio | `GET /businesses/me`, `PATCH /businesses/me` (propietario) |
| Citas | `GET /appointments?date=&from=&to=&status=&employeeId=`, `POST /appointments`, `PATCH /appointments/:id` |
| Clientes | `GET /clients?search=&tag=`, `GET /clients/:id` |
| Servicios | `GET /services`, `POST`, `PATCH /:id`, `DELETE /:id` (escritura: propietario) |
| Productos | `GET /products?category=&lowStock=true`, `POST`, `PATCH /:id`, `DELETE /:id`, `POST /:id/adjust-stock` (escritura: propietario) |
| Ventas | `GET /product-sales?from=&to=`, `POST /product-sales` |
| Analíticas (propietario) | `GET /analytics/dashboard`, `/revenue`, `/metrics`, `/alerts` |
| Master | `GET /master/businesses`, `GET /master/users?role=&businessId=` |
| Estado | `GET /health` |

## Reglas de negocio

- **Citas:** no se pueden crear en el pasado; la hora debe ser `HH:MM` válida; un barbero no puede tener dos citas que se crucen según la duración del servicio (las canceladas liberan el horario). Una cita finalizada registra el cobro, el método de pago y suma una visita al cliente.
- **Clientes:** se crean solos al agendar una cita o vender un producto con nombre de cliente, y se reconocen por teléfono o por nombre. Las etiquetas (Nuevo, Frecuente, VIP, Inactivo) se calculan según sus visitas.
- **Dinero:** se guarda en centavos (enteros) y se muestra en pesos.
- **Inventario:** el descuento de stock al vender es atómico: dos ventas simultáneas por la última unidad no pueden dejar el stock negativo. Los productos y servicios "eliminados" se ocultan, pero su historial se conserva.
- **Ocupación de la agenda:** minutos agendados sobre una jornada de 10 horas por barbero activo.
- **Zona horaria:** "hoy" y la fecha de cada cobro se calculan en `BUSINESS_TZ`, no en UTC.

## Seguridad

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
