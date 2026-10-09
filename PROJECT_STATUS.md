# PROJECT_STATUS — Estado y salud verificados de BarberFlow

Última actualización: **2026-10-08**. Aquí solo hay **estado y cifras reales** (con su origen); las tareas y su estado están **únicamente** en [`TASKS.md`](TASKS.md).

## Qué es
SaaS multi-tenant para barberías (React + Vite / Express + Prisma + Postgres). Roles: `master`, `owner`, `employee`. Reglas y convenciones en [`AGENTS.md`](AGENTS.md).
Git: rama `feature/turno-sesiones-demo-pruebas` (sale de `main` en `d305c84`, que no se movió), con 5 commits del 2026-10-08 (`T-17`): `c7c3ee1` backend, `ff9d784` frontend, `47c7c44` datos demo, `8373b42` pruebas y, el último de la rama, documentación y skills. Árbol limpio tras ellos. Sin `push` ni fusión a `main` todavía.

Historia: (1) `c40ce41` landing + registro + login + dashboard con datos de ejemplo; (2) `4b9aad6` Docker + Postgres, registro y login reales; (3) `d305c84` dashboard conectado a la API (citas, clientes, servicios, productos, ventas, analíticas), roles, rate limit, pruebas, Docker/nginx. Después, en la rama de arriba: rediseño «Turno», datos demo y las pruebas por módulos (0–12) con sus correcciones.

## Salud verificada (copiada de ejecuciones reales; nunca estimada)
| Qué | Resultado | Cómo se leyó |
|---|---|---|
| Backend `npm test` (en `server/`) | 112 pruebas, 8 archivos, `EXIT=0` | log de la corrida del 2026-10-08 (cierre de `T-12`) |
| Demo `npm run test:demo` (en `server/`) | 581 pruebas, 13 archivos (módulos 0–12), `EXIT=0` | ídem (~10 min) |
| Frontend con API (`VITE_API_URL=…3098`) | 246 pruebas, 14 archivos, sin `skipped`, `EXIT=0` | ídem |
| `npm run lint` · `npm run build` | limpios, `EXIT=0` | ídem |
| Datos reales (consulta SQL del 2026-10-08, tras `test:cleanup`) | 8 usuarios reales, 2 negocios reales (+3 demo, 8 usuarios demo), 0 `@test.local` | `psql` en el contenedor |
Estas corridas ya registran el código de salida (protocolo `EXIT=`). El smoke del frontend deja un negocio `@test.local` («Smoke Owner»): `test:cleanup` va después de él.

## Dónde estamos
Punto de continuación: lo define `TASKS.md` §«En curso» (el estado de cada tarea vive **solo** allí). Para retomar, abre la fila de la tarea y los documentos/skills de su columna «Consultar» y sigue lo que indican antes de actuar; el enrutado general por tipo de tarea está en `CLAUDE.md` §«Qué abrir según la tarea». Lo que esta página aporta para retomar es lo vigente de arriba y de abajo: cifras de salud y entorno.

## Entorno (hechos comprobados)
- **Una sola base**: `barberflow` en el contenedor `barberflow-postgres` (`localhost:5432`, de `server/.env`); las pruebas la usan **junto con los datos reales**. Antes de ejecutar pruebas conviene tener un respaldo (`pg_dump`, ver `LEEME.txt` del respaldo).
- Shell real: **Windows PowerShell 5.1**. Allí `timeout` es `timeout.exe` (una pausa), no el de GNU; `npm`/`npx` son `.ps1` (usar `npm.cmd` con `Start-Process`). En Git Bash: `timeout` GNU sí existe, pero las rutas `/tmp/...` se convierten a rutas de Windows al llamar a `docker` (usar `MSYS_NO_PATHCONV=1` y rutas `C:/...` en `docker cp`). Envoltorios probados: skill `run-full-test-suite`.
- Puertos: **3001/5173 = entorno de desarrollo del usuario** (no tocar). **3099** lo ocupa un `node src/index.js` ajeno a las pruebas que se reinicia solo (PIDs 5184 → 21772 → 23496 durante `T-12`; el sistema no permitió cerrarlo): comprobar y preguntar antes de arrancar la API de pruebas. En `T-12` el usuario autorizó usar **3098** para la API (Vite sigue en 5199). Al cerrar `T-12` los puertos 3001/5173 ya no escuchaban (estaban ocupados al empezar; no se tocaron).
- Respaldo vigente: `C:\Users\mau99\respaldos\BARBERFLOW_2026-10-08\` (proyecto sin `node_modules`/`dist`, `pg_dump`, manifiestos y `LEEME.txt` con la restauración).
- Respaldo adicional previo a la edición documental de `T-01`: `C:\Users\mau99\respaldos\BARBERFLOW_T01_pre-edicion_2026-10-08\` (copia de los `.md` y las skills tal como estaban; el respaldo vigente de arriba no se tocó).
