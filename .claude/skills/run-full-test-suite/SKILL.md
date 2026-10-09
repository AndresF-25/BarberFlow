---
name: run-full-test-suite
description: Regresión global de BarberFlow (backend + suite demo + frontend con smoke contra API real + lint + build) con límite de tiempo y código de salida, sin falsos verdes y sin dañar los datos reales. Úsala al cerrar un módulo o tarea, antes de commitear, tras tocar código compartido (middleware, lib/utils, Modal, theme, esquema) o antes de decir que todo funciona. Para probar un solo cambio usa probar-modulo.
---

# Regresión global sin falsos verdes

Cuándo corresponde esta regresión: `AGENTS.md` §«Flujo de pruebas». Los tests de integración y el smoke usan servicios reales y se **omiten sin avisar** si no los encuentran. Una corrida solo vale con **`EXIT=0` + recuentos leídos del log recién creado + `skipped = 0`**. `EXIT=124` = se agotó el tiempo = **no válida**. Nunca des cifras de memoria.

## 0. Antes de empezar (obligatorio)
1. **Respaldo de la base** (las pruebas usan la misma base `barberflow` que tus datos reales). Si no hay uno de hoy:
   `docker exec barberflow-postgres pg_dump -U postgres -d barberflow -Fc -f /tmp/r.dump` → `docker cp barberflow-postgres:/tmp/r.dump <carpeta fuera de OneDrive>\barberflow.dump` → `docker exec barberflow-postgres rm -f /tmp/r.dump`. (Git Bash: anteponer `MSYS_NO_PATHCONV=1` y usar rutas `C:/…` en `docker cp`.)
2. **Postgres arriba:** `docker compose ps` (healthy). Primera vez: `cd server; npm run db:deploy`.
3. **Puertos** (PowerShell): `foreach ($p in 3099,5199) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue }` debe salir vacío. **3001/5173 son del entorno de desarrollo del usuario: no se tocan.** Si 3099/5199 están ocupados por algo ajeno, **para y pregunta**.

## 1. Envoltorio con límite de tiempo y código de salida (PowerShell 5.1, probado)
En PowerShell `timeout` es una pausa de Windows (no el de GNU) y `npm`/`npx` son `.ps1`: usa `npm.cmd`/`npx.cmd` con `Start-Process`. Pasa los argumentos **sin comillas ni espacios internos**.
```powershell
function Invoke-Limitado {
  param([string]$Archivo, [string[]]$Argumentos, [string]$Log, [int]$Segundos = 900, [string]$Carpeta = (Get-Location).Path)
  $p = Start-Process -FilePath $Archivo -ArgumentList $Argumentos -WorkingDirectory $Carpeta -PassThru -NoNewWindow -RedirectStandardOutput $Log -RedirectStandardError "$Log.err"
  $null = $p.Handle   # sin esto ExitCode puede salir vacío en PS 5.1
  if ($p.WaitForExit($Segundos * 1000)) { $p.WaitForExit(); $codigo = $p.ExitCode } else { $p.Kill(); $p.WaitForExit(); Start-Sleep -Milliseconds 500; $codigo = 124 }
  [IO.File]::AppendAllText($Log, "EXIT=$codigo`r`n")
  return $codigo
}
```
El log se **sobrescribe** al lanzar (no se lee uno viejo). Para correr en segundo plano usa la herramienta de la sesión con `run_in_background`, no `&`. **Git Bash:** `( timeout 900 npm run test:demo > log 2>&1; echo "EXIT=$?" >> log )` (probado: 124 al agotarse).

## 2. Pasos y límites (carpeta del repo = `$R`; logs fuera del repo, p. ej. `$env:TEMP\bf`)
| # | Qué | Orden (con `Invoke-Limitado`) | Límite |
|---|---|---|---|
| 1 | Lint | `npm.cmd run lint` en `$R` | 120 s |
| 2 | Backend | `npm.cmd test` en `$R\server` | 600 s |
| 3 | Demo completa | `npm.cmd run test:demo` en `$R\server` (recarga el seed; ~10 min) | 900 s |
| 4 | API de pruebas | con `$env:PORT=3099; $env:CORS_ORIGIN='http://localhost:5199'; $env:AUTH_RATE_LIMIT_MAX=100000; $env:RATE_LIMIT_MAX=100000`: `Start-Process npm.cmd -ArgumentList 'run','dev' -WorkingDirectory $R\server -PassThru -NoNewWindow`; esperar `http://localhost:3099/api/v1/health` = 200 | 60 s |
| 5 | Frontend + smoke | `$env:VITE_API_URL='http://localhost:3099/api/v1'; npx.cmd vitest run` en `$R` | 600 s |
| 6 | Cerrar la API | `Get-NetTCPConnection -LocalPort 3099 -State Listen -ErrorAction SilentlyContinue \| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }` y comprobar el puerto libre (solo si **tú** lo arrancaste; probado sobre un servidor desechable) | — |
| 7 | Build | `npm.cmd run build` en `$R` | 180 s |
| 8 | Limpieza | `npm.cmd run test:cleanup --prefix server` (solo borra `@test.local`) | 60 s |
| 9 | Datos reales | `docker exec barberflow-postgres psql -U postgres -d barberflow -At -c "select count(*) from users where email not like '%@test.local' and email not like '%@demo.barberflow.com'"` (debe coincidir con `PROJECT_STATUS.md` §«Salud verificada», fila «Datos reales») y 0 usuarios `@test.local` | — |

## 3. Interpretar y reportar
Por **cada** paso: `EXIT`, recuento (`Test Files` / `Tests`, de `Select-String -Path $log -Pattern 'Test Files|Tests |skipped'`) y `skipped`. Informa por separado lint, backend, demo, frontend/smoke, build y datos reales; lo que no se ejecutó o no valió (`EXIT≠0`, 124) se dice explícitamente. El resultado va a `TASKS.md` como **evidencia** y, si cambian cifras, a `PROJECT_STATUS.md` (`CLAUDE.md` §«Cierre de sesión o de tarea»).
