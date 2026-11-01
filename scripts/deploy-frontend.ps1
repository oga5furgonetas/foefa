# -----------------------------------------------------------------
# Despliega el FRONTEND a PRODUCCION (el destino sale de destino.ps1)
#
# Usa esto en vez del comando a mano. Motivo: "--branch main" no es
# opcional (gotcha 16) y aqui va cosido, no se puede olvidar. Ademas
# comprueba al final que la web sirve de verdad lo compilado,
# y falla a gritos si no.
#
#   .\scripts\deploy-frontend.ps1
#   .\scripts\deploy-frontend.ps1 -ForzarApk   # coser a sabiendas un APK mas viejo que el de produccion (volver atras)
#   .\scripts\deploy-frontend.ps1 -SinApk      # desplegar aunque no haya ningun APK que coser (la descarga quedaria rota)
#   .\scripts\deploy-frontend.ps1 -SinCI       # sin mirar el CI de GitHub (01-11-2026: por defecto, nada se despliega en rojo)
# -----------------------------------------------------------------
param(
    [switch]$ForzarApk,
    [switch]$SinApk,
    [switch]$SinCI
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # sin la barra de progreso Invoke-WebRequest baja el APK de produccion en segundos
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$raiz = Join-Path $PSScriptRoot ".."
. (Join-Path $PSScriptRoot "destino.ps1")
. (Join-Path $PSScriptRoot "ci-verde.ps1")
$d = Get-Destino -Requiere pages, web, backend
Write-Host "==> Mirando el CI de GitHub..."
Assert-CiVerde -Raiz $raiz -SinCI:$SinCI

$nodeExe = Join-Path $env:ProgramFiles "nodejs\node.exe"
if (-not (Test-Path $nodeExe)) { $nodeExe = "node" }
# El Python 3.12 del usuario (el PC de Winiw, el de casa de Dani: 30-10-2026) o, si no, el del PATH.
$py = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
if (-not (Test-Path $py)) { $py = "C:\Users\Usuario\AppData\Local\Programs\Python\Python312\python.exe" }
if (-not (Test-Path $py)) { $py = "python" }

Set-Location (Join-Path $raiz "frontend")

# NINGUN HOOK DETRAS DE UN RETURN. `vite build` compila igual y la pantalla se
# cae entera en el navegador con el error 310 de React — paso el 16-09-2026 con
# Incorporaciones. Esto para el despliegue antes de subirlo.
Write-Host "==> Comprobando los hooks de React..."
& $nodeExe (Join-Path $PSScriptRoot "check-hooks.mjs")
if ($LASTEXITCODE -ne 0) { throw "hay hooks mal puestos: la pantalla se caeria" }

Write-Host "==> Compilando frontend (produccion)..."
# La API y los pixeles se cosen en la compilacion. Antes `npm run build` iba sin
# ellos: la web llamaba a /api del propio dominio y sin pixeles no se media nada.
$env:VITE_API_URL = "$($d.backend)/api"
if ($d.meta_pixel)   { $env:VITE_META_PIXEL_ID   = $d.meta_pixel }   else { Write-Host "    (sin pixel de Meta)" }
if ($d.tiktok_pixel) { $env:VITE_TIKTOK_PIXEL_ID = $d.tiktok_pixel } else { Write-Host "    (sin pixel de TikTok)" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "la compilacion ha fallado, no se despliega nada" }

# EL APK DE LA APP NATIVA (29-10-2026; reglas contra el retroceso, 01-11-2026). Lo que se sirve en /descargas/FDS.apk
# sale, por este orden, de:
#   1. el ultimo que firmo GitHub (app-release.yml), si `gh` esta instalado y con sesion;
#   2. si no, el compilado en este PC (app-android/.../release/app-release.apk), siempre que sea el paquete de la web
#      (com.flotadsp.flota.web), este firmado y lleve el versionCode de build.gradle.kts (con uno mas bajo alguien
#      subio la version sin recompilar: esta viejo y no vale);
#   3. si no, EL QUE YA SIRVE PRODUCCION, que se baja y se vuelve a coser: la web nunca se queda sin APK.
# Y sea cual sea, NUNCA uno mas viejo que el que sirve produccion ni que el que anuncia el servidor (APP_ANDROID_WEB):
# la app instalada desde la web pediria «actualizar» a una version anterior. Solo -ForzarApk lo salta, a sabiendas.
# Hasta el 31-10-2026 el repo llevaba de reserva frontend/public/descargas/FDS.apk, que era la 1.0.3 (code 4): sin
# `gh`, cualquier despliegue pasadas 24 h del ultimo APK local la habria servido como «nueva». Ya no hay APK en el
# repo. La version la lee scripts/apk_version.py del propio fichero (los nombres pueden mentir; el manifiesto, no).
# El servidor anuncia la version con APP_ANDROID_WEB (lo pone desplegar.yml; a mano:
# fly secrets set -a flota-backend APP_ANDROID_WEB="21 2.4.2").
$apkVersion = Join-Path $PSScriptRoot "apk_version.py"
function Get-InfoApk([string]$ruta) {
  $json = & $py -X utf8 $apkVersion $ruta
  if ($LASTEXITCODE -ne 0) { throw "no se puede leer el APK $ruta" }
  return (($json -join "`n") | ConvertFrom-Json)
}
Write-Host "==> El APK de /descargas/FDS.apk..."
$descargas = Join-Path "dist" "descargas"
New-Item -ItemType Directory -Force $descargas | Out-Null
$apkDestino = Join-Path $descargas "FDS.apk"
if (Test-Path $apkDestino) { Remove-Item $apkDestino -Force }   # por si vite copio algo desde public/

# Lo que sirve produccion ahora mismo (si hay; si no hay, el catch-all devuelve el HTML y el lector lo rechaza).
$apkProd = Join-Path $env:TEMP "fds-apk-produccion.apk"
$prod = $null
try {
  Invoke-WebRequest -Uri "$($d.web)/descargas/FDS.apk" -OutFile $apkProd -UseBasicParsing -TimeoutSec 300
  $prod = Get-InfoApk $apkProd
  Write-Host "    produccion sirve hoy la $($prod.nombre) (code $($prod.code))"
} catch { Write-Host "    (produccion no sirve ningun APK legible: $($_.Exception.Message))" -ForegroundColor Yellow }
# Lo que anuncia el servidor (APP_ANDROID_WEB), si anuncia algo.
$anunciado = $null
try { $anunciado = (Invoke-RestMethod -Uri "$($d.backend)/api/app/version" -TimeoutSec 30).web.code } catch {}
if ($anunciado) { Write-Host "    el servidor anuncia el code $anunciado" }

# 1. El ultimo firmado por GitHub.
$candidato = $null
$origen = ""
$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($gh) {
  $runId = (& gh run list --workflow app-release.yml --branch main --status success --limit 1 --json databaseId -q ".[0].databaseId" 2>$null)
  if ($runId) {
    $tmp = Join-Path $env:TEMP "fds-apk-$runId"
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    & gh run download $runId --dir $tmp 2>$null
    $apk = Get-ChildItem -Path $tmp -Recurse -Filter "FDS-*.apk" | Where-Object { $_.Name -notlike "*SIN-FIRMAR*" } | Select-Object -First 1
    if ($apk) { $candidato = $apk.FullName; $origen = "GitHub, run $runId" }
    else { Write-Host "    (el run $runId no trae un APK firmado)" -ForegroundColor Yellow }
  } else { Write-Host "    (ningun run de app-release en verde)" -ForegroundColor Yellow }
} else { Write-Host "    (sin gh no se mira GitHub; instala GitHub CLI para coser siempre el ultimo firmado)" -ForegroundColor Yellow }
# 2. El compilado en este PC.
$apkLocal = Join-Path $raiz "app-android\app\build\outputs\apk\release\app-release.apk"
if (-not $candidato -and (Test-Path $apkLocal)) {
  $gradle = Get-Content (Join-Path $raiz "app-android\app\build.gradle.kts") -Raw
  $codeGradle = 0
  if ($gradle -match 'versionCode\s*=\s*(\d+)') { $codeGradle = [int]$Matches[1] }
  $local = Get-InfoApk $apkLocal
  $horas = [math]::Round(((Get-Date) - (Get-Item $apkLocal).LastWriteTime).TotalHours, 1)
  if ($local.paquete -ne "com.flotadsp.flota.web") { Write-Host "    (el APK local es el paquete $($local.paquete), no el de la web: no se cose)" -ForegroundColor Yellow }
  elseif (-not $local.firmado) { Write-Host "    (el APK local no esta firmado: no se cose)" -ForegroundColor Yellow }
  elseif ($local.code -lt $codeGradle) { Write-Host "    (el APK local es el code $($local.code) y build.gradle.kts dice $codeGradle`: esta viejo, no se cose)" -ForegroundColor Yellow }
  else { $candidato = $apkLocal; $origen = "compilado en este PC hace $horas h" }
}
# 3. El que ya sirve produccion.
if (-not $candidato) {
  if ($prod) { $candidato = $apkProd; $origen = "el que ya servia produccion" }
  elseif ($SinApk) { Write-Host "    AVISO: no hay ningun APK que coser; la web sale sin /descargas/FDS.apk por -SinApk." -ForegroundColor Yellow }
  else { throw "no hay ningun APK que coser (ni GitHub, ni local valido, ni produccion): la web saldria con la descarga rota. Si es a proposito, repite con -SinApk." }
}
if ($candidato) {
  $info = Get-InfoApk $candidato
  if ($info.paquete -ne "com.flotadsp.flota.web") { throw "el APK ($origen) es el paquete $($info.paquete), no com.flotadsp.flota.web" }
  if (-not $info.firmado) { throw "el APK ($origen) no esta firmado" }
  $retrocesos = @()
  if ($prod -and $info.code -lt $prod.code) { $retrocesos += "produccion sirve el code $($prod.code) ($($prod.nombre))" }
  if ($anunciado -and $info.code -lt $anunciado) { $retrocesos += "el servidor anuncia el code $anunciado" }
  if ($retrocesos.Count -gt 0) {
    $msg = "el APK a coser es el code $($info.code) ($($info.nombre), $origen) y " + ($retrocesos -join " y ") + ": seria un RETROCESO"
    if ($ForzarApk) { Write-Host "    AVISO: $msg. Se cose igual por -ForzarApk." -ForegroundColor Yellow }
    else { throw "$msg. Si es a proposito (volver atras), repite con -ForzarApk." }
  }
  Copy-Item $candidato $apkDestino -Force
  Write-Host "    APK $($info.nombre) (code $($info.code), $origen) -> /descargas/FDS.apk"
}

# EL SELLO DE LA COMPILACION. La app lo pide cada pocos minutos y avisa si el
# suyo ya no es el ultimo: sin esto, una pestaña abierta desde hace horas sigue
# enseñando lo de antes SIN fallar, que es peor que un error.
& $nodeExe (Join-Path $PSScriptRoot "sellar-build.mjs")
if ($LASTEXITCODE -ne 0) { throw "no se pudo sellar la compilacion" }

Write-Host "==> Subiendo a Cloudflare Pages, rama main (produccion)..."
npx wrangler pages deploy dist --project-name $d.pages --branch main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw "wrangler ha fallado al desplegar" }

Write-Host ""
Write-Host "==> Comprobando que produccion sirve de verdad esta compilacion..."
# El edge tarda unos segundos en propagar: se le dan 90.
& (Join-Path $PSScriptRoot "verificar-produccion.ps1") -Esperar 90
$verif = $LASTEXITCODE

# Y AHORA LOS CHUNKS, QUE ES LO QUE SE ENVENENA (gotcha 8).
# Lo de arriba comprueba el index.html; el problema esta en los .js y .css,
# que tardan mas en propagarse. Mientras no estan, el catch-all de _redirects
# devuelve la PAGINA HTML con codigo 200 bajo la URL .js, y el navegador se la
# guarda 4 horas. Pedirlos aqui los deja cacheados en el edge antes de que
# llegue nadie, y de paso delata la ventana, que hoy no se ve.
# LAS PANTALLAS, NO SOLO EL FICHERO. Que el bundle se sirva no dice nada de si
# la pantalla tendra datos: el 15-09-2026 el frontend estaba perfecto y la
# pantalla de Incorporaciones salia vacia porque su endpoint daba 500.
Write-Host ""
Write-Host "==> Comprobando que las pantallas devuelven datos..."
& $py (Join-Path $PSScriptRoot "humo.py") $d.backend
if ($LASTEXITCODE -ne 0) {
  Write-Host "AVISO: el frontend esta subido pero alguna pantalla no trae datos." -ForegroundColor Yellow
}

Write-Host ""
& (Join-Path $PSScriptRoot "calentar-edge.ps1") -Web $d.web

exit $verif
