# SKILLS — Índice de procedimientos repetibles de BarberFlow

Las skills **listas** viven en `.claude/skills/<nombre>/SKILL.md` (se invocan con `/nombre` o se activan por su descripción; su cuerpo se carga solo al usarlas). Criterio para crear una nueva: el procedimiento se ha usado **dos veces de verdad**. Los **borradores** de abajo esperan ese segundo uso (tareas `T-29`, `T-30` en `TASKS.md`). **Usar una skill es abrirla y seguirla**: invócala con la herramienta `Skill` o ábrela con `Read`; que otro documento nombre una skill no carga su contenido. El enrutado «qué skill para qué tarea» está en `CLAUDE.md` §«Qué abrir según la tarea».

| Skill | Cuándo usarla | Estado |
|---|---|---|
| `probar-modulo` | Probar un módulo/cambio de punta a punta: pruebas primero, estabilidad, interfaz, navegador, cierre | listo |
| `run-full-test-suite` | Regresión global con límite de tiempo, `EXIT=` y sin falsos verdes (backend + demo + frontend + lint + build) | listo |
| `add-api-endpoint` | Añadir o extender un endpoint REST y su consumo desde el frontend | listo |
| `change-db-schema` | Modificar `schema.prisma` (modelos, campos, enums) con migración | listo |
| `agent-browser` | Navegar y probar la UI con un navegador real (CLI de Vercel, desde skills.sh) | listo (stub; ver nota) |
| `security-review` | Revisar cambios de auth/roles/aislamiento (skill global + checklist de abajo) | usar global |
| `add-dashboard-view` | Nueva pestaña/vista en el Dashboard | **borrador** (1 uso: «Mi negocio») |
| `release-check` | Antes de desplegar/mergear a `main` | **borrador** (0 usos) |

## add-dashboard-view (borrador)
1. Crear `src/pages/dashboard/views/XView.jsx` con `export function XView`.
2. Si necesita datos: hook en `hooks/` (patrón de `useServicios`; escrituras con `attempt()`), método en `src/api/client.js`.
3. Registrar en `navigation.js` (`NAV_BY_ROLE` / `NAV_TIENDA_BY_ROLE`) para los roles que correspondan (las pestañas ya llenan 1280 px: ver `AGENTS.md` §«Reglas por área», viñeta «Mi negocio»).
4. Renderizar en `Dashboard.jsx` según `active`.
5. Estilos con tokens de `theme.js` (`C`, `INV`); no crear paleta nueva. Modales con `Modal`/`Field`.
6. Pruebas de la vista (`XView.test.jsx`) y, si es crítica, extender `Dashboard.smoke.test.jsx`.

## release-check (borrador)
1. `npm run lint` y regresión global (`run-full-test-suite`, sin `skipped`).
2. `docker compose --profile app up -d --build` y comprobar `GET /health` vía nginx (`:8080`).
3. Confirmar que `JWT_SECRET`, `POSTGRES_PASSWORD` y `MASTER_PASSWORD` no son los de ejemplo.
4. Actualizar README (endpoints/variables) y seguir `CLAUDE.md` §«Cierre de sesión o de tarea».

## Checklist de seguridad (para `security-review`)
Cada pregunta se responde contra la regla de `AGENTS.md`; ábrela al revisar (no se copia aquí).
- ¿Toda consulta nueva filtra por `req.businessId`? (`AGENTS.md` §«Reglas de dominio», aislamiento por negocio)
- ¿La ruta usa `authenticate` + `requireRole(...)` + `requireBusinessContext` donde corresponde? (`AGENTS.md` §«Qué es» y §«Mapa del repo»; `README.md` §«Roles y permisos»)
- ¿Un `employee` queda limitado a sus propios recursos? (`AGENTS.md` §«Reglas de dominio»; `README.md` §«Roles y permisos»)
- ¿Entrada validada con Zod? ¿Errores sin detalles internos? (`AGENTS.md` §«Convenciones de código», rutas Express)
- ¿Se mantiene `DUMMY_HASH`/401 uniforme en login? ¿Rate limits intactos? (`AGENTS.md` §«Prohibiciones»)

## agent-browser — instalación (el flujo de uso está en `probar-modulo`)
- Instalada con `npx skills add vercel-labs/agent-browser --skill agent-browser` (`skills-lock.json`; CLI `agent-browser` 0.38.2); la skill es un stub: antes de usarla, `agent-browser skills get core`. No la edites (se sobrescribe al actualizar).
- Navegador: Chrome oficial (`winget install Google.Chrome`); en esta máquina la variable `AGENT_BROWSER_EXECUTABLE_PATH` ya apunta a `C:\Program Files\Google\Chrome\Application\chrome.exe` (si no la ve, pasa `--executable-path`). El Chrome que baja `agent-browser install` no está firmado y **Smart App Control** lo bloquea: **no** lo desactives (es irreversible). Edge sirve de respaldo.
- Declara `allowed-tools: Bash(agent-browser:*)`; úsala solo contra `localhost`.
