---
name: add-api-endpoint
description: Añadir o extender un endpoint REST de BarberFlow (Express + Zod + Prisma) y su consumo en el frontend (api/client.js, hook, vista). Úsala al crear rutas nuevas o campos nuevos en recursos existentes.
---

# Añadir un endpoint

Antes de empezar, abre una ruta vecina del mismo recurso (p. ej. `server/src/routes/services.js`) y copia su forma. Las reglas obligatorias (aislamiento por negocio, dinero en centavos, zona horaria, borrado suave, errores con `createError` + `next(err)`, forma de las respuestas) están en `AGENTS.md` §«Reglas de dominio» y §«Convenciones de código»: léelas y cúmplelas; esta skill solo da los pasos.

## Backend (`server/`)
1. **Validación**: schema Zod en el archivo de la ruta; `schema.parse(req.body)` dentro del `try`.
2. **Ruta** en `src/routes/<recurso>.js`:
   - Middlewares: `authenticate`, `requireRole(...)` (escritura de catálogo = solo `owner`), `requireBusinessContext`.
   - **Toda** consulta Prisma filtra por `req.businessId`. Un `employee` solo accede a lo suyo (ver `appointments.js`).
   - Errores, dinero, fechas y borrado: según `AGENTS.md` (ver arriba), sin copiarlo aquí.
3. **Mapper**: respuesta vía `mapXToUi` de la ruta (campos en español). Si añades un campo, actualiza el mapper. Forma de respuesta: `{ recurso }` (no `{ ok }`, salvo auth).
4. **Montaje**: si es un recurso nuevo, `app.use('/api/v1/<recurso>', ...)` en `server/src/app.js`.
5. Lógica reutilizable o compleja → `src/services/`.

## Tests
- Test de integración en `server/tests/integration/<recurso>.test.js` usando `tests/helpers.js` (`registerOwner`, `createEmployee`, `createService`, `createAppointment`, `createMaster`).
- Cubre: caso feliz, 401 sin token, 403 por rol, aislamiento entre negocios, validación (400).
- Ejecutar según `AGENTS.md` §«Flujo de pruebas»: primero el archivo del cambio, repetido ×2, y la regresión de área `cd server; npm test` (confirma que no quedaron `skipped`); la regresión global con la skill `run-full-test-suite` (ábrela y síguela) solo al cerrar el módulo o la tarea o si tocaste código compartido.

## Frontend
1. Método en el objeto `api` de `src/api/client.js` (usa `request`, que lanza error con `status` y `data`).
2. Hook en `src/pages/dashboard/hooks/` (patrón `useServicios`/`useTienda`; escrituras con `attempt()` → `{ ok, error }`).
3. Consumirlo desde la vista; estados de carga/error con `EstadoCarga`.

## Cierre
- Actualiza `src/api/client.js`, los hooks y la tabla de endpoints del `README.md` (`README.md` §«API»; es la única fuente de la API pública).
- `npm run lint`.
- Si la decisión es duradera, anótala en `MEMORY.md`; luego `CLAUDE.md` §«Cierre de sesión o de tarea».
