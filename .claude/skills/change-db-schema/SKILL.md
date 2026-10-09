---
name: change-db-schema
description: Modificar el esquema de base de datos de BarberFlow (server/prisma/schema.prisma) con migración, y propagar el cambio a mappers, limpieza de tests y frontend. Úsala al añadir/cambiar modelos, campos o enums.
---

# Cambiar el esquema de DB

Requiere Postgres arriba (`docker compose up -d`) y `server/.env` con `DATABASE_URL`. Antes de empezar, lee `AGENTS.md` §«Reglas por área» (viñeta «Migraciones») y §«Prohibiciones»: mandan sobre cualquier paso de esta skill.

1. **Editar** `server/prisma/schema.prisma`.
   - Campos camelCase con `@map("snake_case")`; IDs UUID; dinero como manda `AGENTS.md` §«Reglas de dominio» (campos `*Cents`, enteros).
   - Relaciones con `businessId` para mantener el aislamiento multi-tenant.
   - Piensa en el borrado (cascade de `Business`, restrict en `Appointment.service`/`employee` y su efecto en el limpiador de pruebas): `MEMORY.md` §«Gotchas» (viñeta «Cascade»).
2. **Migración** (en dos tiempos; `npm run db:migrate` es `prisma migrate dev`, que crea **y aplica** de una vez, así que no se usa directo):
   1. `cd server; npx prisma migrate dev --name <nombre_descriptivo> --create-only` (solo genera el SQL).
   2. **Revisa el SQL generado antes de aplicarlo**: ¿hay `NOT NULL` sin default sobre tablas con datos? Si renombras una columna, Prisma propone `DROP + ADD`: reescríbelo como `RENAME COLUMN`.
   3. Aplícala con `npx prisma migrate deploy` (o `npm run db:deploy`).
   **Nunca** editar `20250914120000_init` ni migraciones ya aplicadas, y nunca reiniciar la base (tiene datos reales).
3. **Cliente**: `npm run db:generate` (la migración normalmente ya lo hace).
4. **Propagar**:
   - `mapXToUi` de las rutas afectadas y `publicUser`/`publicBusiness` en `server/src/lib/utils.js` si aplica.
   - Schemas Zod de entrada.
   - `server/scripts/cleanupTestData.js`: si hay tabla nueva con FK, añade su borrado en el orden correcto (hijos antes que padres).
   - Frontend: `src/api/client.js`, hooks y vistas que muestren el campo.
5. **Tests**: añade/ajusta integración; corre la skill `run-full-test-suite`.
6. **Docker**: el contenedor `api` aplica `prisma migrate deploy` al arrancar; no hace falta paso extra, pero prueba `docker compose --profile app up -d --build` si el cambio es grande.
7. Si es una decisión duradera, anótala en `MEMORY.md`; actualiza el README si cambian modelos documentados. Cierra con `CLAUDE.md` §«Cierre de sesión o de tarea» (evidencia real en `TASKS.md`).
