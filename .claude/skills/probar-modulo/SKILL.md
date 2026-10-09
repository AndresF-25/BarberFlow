---
name: probar-modulo
description: Probar un módulo o cambio de BarberFlow de punta a punta con el flujo usado en los módulos 1–11 — leer lo mínimo, escribir primero las pruebas del comportamiento esperado contra los datos demo, ver fallar, corregir, comprobar estabilidad, pruebas de interfaz, recorrido en navegador real y cierre documental. Úsala al empezar un módulo de pruebas (el que indique TASKS.md), al revisar una pantalla o endpoint, o al verificar una funcionalidad nueva. Para la regresión global usa run-full-test-suite.
---

# Probar un módulo (flujo repetido en los módulos 1–11)

Primero lo **específico del cambio**; la regresión global solo en los puntos definidos (`AGENTS.md` «Flujo de pruebas»). Toda ejecución larga con límite de tiempo y `EXIT=` (envoltorio en `run-full-test-suite`).

## 0. Antes de empezar
- Elige la tarea en `TASKS.md` (`T-nn`), abre los documentos y skills de su columna «Consultar» y márcala `doing`. **Respaldo de la base** si no hay uno de hoy (paso 0 de `run-full-test-suite`: ábrelo y síguelo) y **puertos** libres (`AGENTS.md` §«Flujo de pruebas»: 3099/5199 son los de pruebas; 3001/5173 son del usuario).
- Reglas de los datos de prueba: `AGENTS.md` §«Flujo de pruebas» (viñeta «Base de datos») y §«Datos de demostración» (negocios `@test.local` nuevos para lo que creas o modificas, seed demo solo en lectura, correos y teléfonos de prueba). Helpers: `registerOwner`, `createEmployee`, `createService`, `createAppointment` de `server/tests/helpers.js`; para leer el seed, `demoSessions()`, `biz('navaja')`…

## 1. Leer lo mínimo
Ruta `server/src/routes/<recurso>.js`, su servicio, la vista `src/pages/dashboard/views/<Vista>.jsx`, el hook y las pruebas existentes del recurso. Nada más (mapa del repo en `AGENTS.md`).

## 2. Escribir las pruebas primero (comportamiento **esperado**)
- Archivo `server/tests/demo/NN-nombre.test.js`; cabecera con el alcance; `beforeAll(requireSeed + demoSessions)`.
- Valores esperados **calculados desde el dataset** (`biz(key)`, `hoy`), con lógica independiente de la del servidor; nunca números escritos a mano.
- Cubrir: forma exacta de la respuesta, validaciones (400 en español, sin 500), límites, recorte de espacios, tipos erróneos, JSON inválido, concurrencia (ráfagas y carreras), matriz de roles (dueño/barbero/master/anónimo), aislamiento entre negocios, ids raros (404), fechas del negocio.
- Un defecto confirmado y aún sin corregir: `it.fails('HALLAZGO Hn [severidad] …')`.

## 3. Ejecutar → ver fallar → corregir
`cd server; npm run test:demo -- tests/demo/NN-nombre.test.js` (límite 300 s). Los rojos que son **defectos reales** se corrigen en el código siguiendo las reglas de `AGENTS.md`; los que son error de la prueba, se arreglan en la prueba (y se anota). Repite hasta verde y luego **×2** (×3 si hay concurrencia/cerrojos).

## 4. Interfaz
Pruebas con Testing Library junto a la vista (`<Vista>.test.jsx`; `vi.mock` del `api` y de `todayIso`). Comprueba textos, validación visible (`role="alert"`), Enter, Escape, nombres accesibles y estados vacío/error/carga. Si cambias código compartido (`Modal`, `theme`, `ui.jsx`), corre todo el frontend.

## 5. Recorrido en navegador (`agent-browser`)
- Puertos libres → API en 3099 con `CORS_ORIGIN=http://localhost:5199`, límites altos (`AUTH_RATE_LIMIT_MAX`, `RATE_LIMIT_MAX`) y Vite en 5199 con `VITE_API_URL=http://localhost:3099/api/v1`. Cierra todo al terminar.
- Datos reales de lectura: cuenta demo `dueno.navaja@demo.barberflow.com` / `Demo1234` (barbero `barbero1.navaja@…`, master `master@demo.barberflow.com`). Las **escrituras** en un negocio `@test.local` nuevo (se registra por API).
- **Windows:** el navegador y su configuración (Chrome oficial, `AGENT_BROWSER_EXECUTABLE_PATH`, Smart App Control) y el arranque de la skill `agent-browser` (`agent-browser skills get core`) están en `SKILLS.md` §«agent-browser — instalación»: ábrelo y síguelo antes del primer uso. `agent-browser --headed open <url>` (el primer arranque tarda 1–2 min; lánzalo en segundo plano), luego `set viewport 1440 900`, `snapshot -i` (refs `@eN`) → `fill`/`click` → verificar; capturas fuera del repo. Al final `agent-browser close` y `npm run test:cleanup --prefix server`. No apuntes la skill a sitios con sesiones reales.

## 6. Regresión y cierre
Regresión global con `run-full-test-suite` si es el cierre del módulo, se tocó código compartido o se va a commitear. Luego el **protocolo de cierre de `CLAUDE.md`** (`TASKS.md` con evidencia real → `PROJECT_STATUS.md` si cambian cifras → `docs/HALLAZGOS.md` con los defectos hallados/corregidos → `MEMORY.md` solo si hay lección duradera). **No** marques `done` lo que no ejecutaste.
