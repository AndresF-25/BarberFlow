@AGENTS.md
@MEMORY.md
@PROJECT_STATUS.md
@TASKS.md

# Cómo trabajar en este repo (BarberFlow)

Lo anterior se carga solo: reglas (`AGENTS.md`), decisiones y lecciones (`MEMORY.md` del **proyecto**, no la memoria automática de Claude Code), estado y salud (`PROJECT_STATUS.md`) y tareas (`TASKS.md`, única fuente de su estado). **Bajo demanda:** `docs/HALLAZGOS.md` (historia de defectos: usa `Grep` por módulo o id, no lo leas entero), `README.md`, `SKILLS.md` y las skills.
Topes para que el contexto automático no crezca: `AGENTS.md` ≈ 125 líneas, `MEMORY.md` ≈ 55, `PROJECT_STATUS.md` ≈ 45, `TASKS.md` ≈ 70. Lo histórico va a `docs/HALLAZGOS.md`.

**Un `@import` carga el archivo; una mención o un enlace NO.** Todo lo «bajo demanda» (skills, `SKILLS.md`, `README.md`, `docs/HALLAZGOS.md`) solo lo conoces si lo abres: con la herramienta `Skill` o con `Read` (y `Grep` para `HALLAZGOS`). Si una tarea cae en la tabla de abajo, **abre y sigue ese documento antes de actuar**; recordar su nombre no basta.

## Una fuente por tipo de información
Cada dato vive en **un** sitio; los demás lo enlazan. Antes de escribir algo, comprueba si ya tiene fuente.

| Tipo de información | Única fuente |
|---|---|
| Reglas permanentes (dominio, seguridad, convenciones, prohibiciones, flujo de pruebas, datos de pruebas) | `AGENTS.md` |
| Decisiones con su porqué, lecciones, gotchas | `MEMORY.md` |
| Estado actual verificado: salud con cifras y fecha, entorno vivo, punto de continuación | `PROJECT_STATUS.md` |
| Tareas: estado, dependencias, aceptación y qué consultar | `TASKS.md` (nada de estados en otros archivos) |
| Defectos pasados y su evidencia, por módulo | `docs/HALLAZGOS.md` |
| Procedimientos repetibles | `.claude/skills/<nombre>/SKILL.md` (índice, borradores e instalación de `agent-browser`: `SKILLS.md`) |
| Uso, puesta en marcha, roles y tabla de endpoints para humanos | `README.md` |
| Protocolo de trabajo y de cierre, y este enrutado | `CLAUDE.md` |

## Qué abrir según la tarea
| Si vas a… | Abre y sigue, antes de empezar |
|---|---|
| Probar un módulo, pantalla o endpoint | la skill `probar-modulo` (`.claude/skills/probar-modulo/SKILL.md`), con `AGENTS.md` §«Flujo de pruebas» y §«Datos de demostración» |
| Regresión global: cerrar un módulo, antes de commitear, tras tocar código compartido o antes de decir «todo verde» | la skill `run-full-test-suite` (`.claude/skills/run-full-test-suite/SKILL.md`) |
| Crear o extender un endpoint (y su uso en el frontend) | la skill `add-api-endpoint` (`.claude/skills/add-api-endpoint/SKILL.md`) |
| Cambiar `server/prisma/schema.prisma` | la skill `change-db-schema` (`.claude/skills/change-db-schema/SKILL.md`) |
| Recorrer la interfaz en un navegador real | `SKILLS.md` §«agent-browser — instalación» y el paso «Recorrido en navegador» de `probar-modulo` |
| Revisar seguridad (auth, roles, aislamiento entre negocios) | `SKILLS.md` §«Checklist de seguridad (para `security-review`)» junto con `AGENTS.md` §«Reglas de dominio» y §«Prohibiciones» |
| Añadir una vista al dashboard o preparar un despliegue | los borradores de `SKILLS.md` (§«add-dashboard-view (borrador)», §«release-check (borrador)») |
| Elegir o ejecutar una tarea | su fila en `TASKS.md` y los documentos/skills de su columna «Consultar» |
| Saber si un defecto ya ocurrió o por qué existe una regla | `Grep` por módulo o id (`H48`, `U11`) en `docs/HALLAZGOS.md` |
| Documentar un contrato de API o la puesta en marcha | `README.md` (tabla de endpoints) |

## Antes de escribir o cambiar documentación
1. `Grep` del término en los `.md` y en `.claude/skills/`: si ya existe una fuente adecuada, **actualízala y enlázala**; no crees otra versión.
2. Referencias: archivo + sección, p. ej. `AGENTS.md §«Prohibiciones»` (el título exacto del encabezado; no se renombran encabezados sin actualizar sus referencias) y los IDs existentes (`T-nn`, `Hnn`/`Unn`). Una referencia debe decir **cuándo** consultar y, si es una skill, que hay que abrirla y seguirla.
3. No elimines ni fusiones un fragmento por parecer repetido: compara el texto completo (condiciones, excepciones, ejemplos); si no son equivalentes, consérvalos.

## Leer poco
1. No explores el repo: usa el «Mapa del repo» de `AGENTS.md` y abre solo los archivos que nombre la tarea.
2. `Grep` antes de leer; `Read` con `offset/limit`; nada de `cat` de archivos grandes; filtra la salida de las pruebas (`… | grep -E "×|Tests |Test Files"`).
3. Escribe archivos largos con la herramienta Write (los heredocs fallan con comillas).

## Probar
Abre y sigue la skill `probar-modulo` o `run-full-test-suite` (tabla de arriba) y «Flujo de pruebas» de `AGENTS.md`. Las pruebas usan la base con **datos reales**: respaldo antes (`AGENTS.md` §«Flujo de pruebas», viñeta «Base de datos»; `T-18`). Nunca declares «verde» ni marques `done` sin haber ejecutado y leído el resultado.

## Cierre de sesión o de tarea (obligatorio, en este orden)
1. Ejecuta la verificación que corresponda y **lee** los resultados.
2. `TASKS.md`: estado + **evidencia real** (comando, fecha, `EXIT`, recuentos). Siempre. Si algo no se ejecutó, el estado no es `done` y se anota «no ejecutada».
3. `PROJECT_STATUS.md`: **solo** si cambiaron cifras o «dónde estamos»; cifras copiadas de una ejecución real con su fecha, nunca estimadas.
4. `docs/HALLAZGOS.md`: **solo** si se halló o corrigió un defecto (anexar; si queda abierto, tiene su `T-nn`).
5. `MEMORY.md`: **solo** si hay una decisión o lección duradera. `README.md`: **solo** si cambia un contrato de API, un comando o la puesta en marcha. `AGENTS.md`: **solo** si cambia una regla permanente.
6. Si tocaste documentación: referencias y `@imports` resuelven, ningún estado de tarea fuera de `TASKS.md`, ningún ID huérfano. Ejecuta las «Comprobaciones de documentación» de abajo y lee su salida.

No hay commits sin que el usuario los pida (`T-17`); nunca `git add .`, `reset`, `clean`, `checkout/restore --` ni `stash`.

## Comprobaciones de documentación (Git Bash, desde la raíz; cada bloque debe terminar sin líneas de aviso)
```bash
D="CLAUDE.md AGENTS.md MEMORY.md PROJECT_STATUS.md TASKS.md SKILLS.md README.md docs/HALLAZGOS.md"
# a) todo T-nn citado tiene fila en TASKS.md (los números reservados también tienen fila y no se reutilizan)
for id in $(grep -ohE 'T-[0-9]{2}' $D .claude/skills/*/SKILL.md | sort -u); do grep -qE "^\| \**$id\b" TASKS.md || echo "T-nn huérfano: $id"; done
# b) los @imports existen
grep -oE '^@[^ ]+' CLAUDE.md | tr -d '@' | while read -r f; do [ -e "$f" ] || echo "import roto: $f"; done
# c) los enlaces locales de markdown resuelven
for f in $D; do d=$(dirname $f); grep -oE '\]\([^)#]+\)' $f | sed -E 's/^\]\(//; s/\)$//' | grep -vE '^https?:' | while read -r l; do [ -e "$d/$l" ] || echo "enlace roto en $f: $l"; done; done
# d) cada referencia archivo + sección apunta a un encabezado existente
grep -ohE '[A-Za-z_./-]+\.md`? §«[^»]+»' $D .claude/skills/*/SKILL.md | sed 's/\.md` §/.md §/' | sort -u | while IFS= read -r r; do f=${r%% §*}; t=${r#*§«}; t=${t%»}; grep -E '^#{1,4} ' "$f" 2>/dev/null | grep -qF "$t" || echo "sin encabezado: $r"; done
# e) revisión manual: estados de tarea fuera de TASKS.md (no debe haber ninguno)
grep -nE 'T-[0-9]{2}[^|]{0,80}\b(todo|doing|blocked|decision|done)\b' AGENTS.md MEMORY.md PROJECT_STATUS.md README.md SKILLS.md
```
