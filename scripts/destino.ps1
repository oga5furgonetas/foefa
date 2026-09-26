# -----------------------------------------------------------------
# A DONDE SE DESPLIEGA. Un solo sitio, y nunca escrito en los scripts.
#
# Este repositorio nacio como copia de otro producto (FlotaDSP) cuyos scripts
# llevaban SU produccion clavada dentro: lanzar uno desde aqui habria subido
# esta app encima de la suya. Por eso:
#   · el destino se lee de `despliegue.local.json` (en la raiz, fuera de git) o
#     de variables de entorno, y si falta el script PARA y dice que falta;
#   · si el destino contiene «flotadsp», se niega en redondo.
#
# despliegue.local.json (ejemplo en despliegue.ejemplo.json):
#   { "pages": "<proyecto de Cloudflare Pages>",
#     "web": "https://<tu-dominio>",
#     "backend": "https://<tu-api>",
#     "staging_web": "https://staging.<proyecto>.pages.dev",
#     "staging_api": "https://<tu-api-staging>/api" }
# Variables equivalentes: FLOTA_PAGES, FLOTA_WEB, FLOTA_BACKEND,
# FLOTA_STAGING_WEB, FLOTA_STAGING_API.
#
#   . (Join-Path $PSScriptRoot "destino.ps1")
#   $d = Get-Destino -Requiere pages, web, backend
# -----------------------------------------------------------------
function Get-Destino {
    param([string[]]$Requiere = @())

    $d = @{
        pages       = $env:FLOTA_PAGES
        web         = $env:FLOTA_WEB
        backend     = $env:FLOTA_BACKEND
        staging_web = $env:FLOTA_STAGING_WEB
        staging_api = $env:FLOTA_STAGING_API
    }
    $fichero = Join-Path $PSScriptRoot "..\despliegue.local.json"
    if (Test-Path $fichero) {
        $j = Get-Content $fichero -Raw | ConvertFrom-Json
        foreach ($k in @($d.Keys)) {
            $v = $j.$k
            if ($v) { $d[$k] = "$v".TrimEnd("/") }
        }
    }

    foreach ($k in @($d.Keys)) {
        if ("$($d[$k])" -match "flotadsp") {
            throw "El destino '$k' ($($d[$k])) es de FlotaDSP. Este repositorio es otro producto: no se despliega ahi."
        }
    }
    $faltan = @($Requiere | Where-Object { -not $d[$_] })
    if ($faltan.Count -gt 0) {
        throw ("Falta el destino: " + ($faltan -join ", ") +
               ". Ponlo en despliegue.local.json (copia despliegue.ejemplo.json) o en variables FLOTA_*.")
    }
    return $d
}
