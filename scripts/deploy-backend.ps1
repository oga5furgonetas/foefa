# DESPLEGAR EL BACKEND Y COMPROBAR QUE SIGUE EN PIE.
# ═══════════════════════════════════════════════════════════════════════════
# Por que existe: `fly deploy` dice "deployed" en cuanto sube la imagen, y ahi
# se acaba. El 15-09-2026 eso dejo un 500 en la pantalla de Incorporaciones
# —la que Dani estaba usando— y no se supo hasta probarla a mano un rato
# despues. "Desplegado" y "funcionando" no son lo mismo.
#
# Aqui se despliega y ACTO SEGUIDO se llama a las pantallas principales. Si
# alguna no contesta, se dice en rojo y el script sale con error.
$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "destino.ps1")
$d = Get-Destino -Requiere backend
# `fly deploy` sube a la app que diga fly.toml, sin preguntar: se mira antes.
$toml = Get-Content (Join-Path $raiz "backend\fly.toml") -Raw
if ($toml -match '(?m)^app\s*=\s*"[^"]*flotadsp') { throw "backend/fly.toml apunta a una app de FlotaDSP. Cambia `app =` por la tuya." }

Write-Host "==> Desplegando el backend..."
Push-Location (Join-Path $raiz "backend")
try {
  # SIN TUBERIA. `fly` escribe su progreso por stderr, y en PowerShell 5.1
  # canalizar la salida de un .exe convierte cada linea de stderr en un
  # ErrorRecord: con `$ErrorActionPreference = 'Stop'` el despliegue se caia
  # aunque fly fuera bien. Se deja escribir en pantalla y se mira el codigo de
  # salida, que es lo unico que dice la verdad.
  $anterior = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  # La salida entera va a un fichero y solo se enseña lo que dice algo: `fly`
  # escupe sesenta lineas de capas de Docker que no aportan nada. Si falla, ahi
  # esta el registro completo para mirarlo.
  $log = Join-Path $env:TEMP "flota-fly-deploy.log"
  fly deploy --strategy immediate *>&1 | Out-File -FilePath $log -Encoding utf8
  $codigo = $LASTEXITCODE
  $ErrorActionPreference = $anterior
  Get-Content $log | Where-Object { $_ -match "image size|Visit your|Error|error:|failed" }
  if ($codigo -ne 0) { Write-Host "Registro completo en $log" }
  if ($codigo -ne 0) { throw "fly deploy ha fallado (codigo $codigo)" }
} finally { Pop-Location }

Write-Host ""
Write-Host "==> Comprobando que las pantallas siguen contestando..."
# El Python 3.12 del usuario (el PC de Winiw, el de casa de Dani: 30-10-2026) o, si no, el del PATH.
$py = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
if (-not (Test-Path $py)) { $py = "C:\Users\Usuario\AppData\Local\Programs\Python\Python312\python.exe" }
if (-not (Test-Path $py)) { $py = "python" }
# humo.py firma una sesion de mantenimiento con SECRET_KEY: sin ella en el entorno (el PC de casa no la tiene,
# 30-10-2026) no puede probar las pantallas, y decir «PRODUCCION ESTA ROTA» seria mentira. Entonces se mira
# /api/health (la API en pie y con Mongo) y se dice que las pantallas quedan sin probar.
if (-not $env:SECRET_KEY) {
  Write-Host "    (sin SECRET_KEY en el entorno: las pantallas no se pueden probar desde aqui; se mira /api/health)" -ForegroundColor Yellow
  try { $salud = Invoke-RestMethod -Uri "$($d.backend)/api/health" -TimeoutSec 60 } catch { $salud = $null }
  if (-not $salud -or "$($salud.status)" -ne "ok") {
    Write-Host ""
    Write-Host "PRODUCCION NO CONTESTA /api/health. Mira los logs (fly logs) y vuelve a desplegar." -ForegroundColor Red
    exit 1
  }
  Write-Host ""
  Write-Host "OK - backend desplegado y /api/health contesta: $($salud | ConvertTo-Json -Compress)"
  exit 0
}
& $py (Join-Path $PSScriptRoot "humo.py") $d.backend
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "PRODUCCION ESTA ROTA. Arreglalo y vuelve a desplegar." -ForegroundColor Red
  exit 1
}
Write-Host ""
Write-Host "OK - backend desplegado Y respondiendo."
