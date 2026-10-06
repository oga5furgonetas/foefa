# -----------------------------------------------------------------
# A DONDE SE DESPLIEGA. Un solo sitio, y nunca escrito en los scripts.
#
# Este repositorio nacio como copia de otro producto (FlotaDSP) cuyos scripts
# llevaban SU produccion clavada dentro: lanzar uno desde aqui habria subido
# esta app encima de la suya. Por eso:
#   · el destino se lee de `despliegue.local.json` (en la raiz, fuera de git) o
#     de variables de entorno, y si falta el script PARA y dice que falta;
#   · si el destino es INFRAESTRUCTURA de FlotaDSP (el proyecto de Pages
#     `flotadsp-v2` o una app de Fly `flotadsp-...`), se niega en redondo.
#     El DOMINIO flotadsp.com si vale: desde el 26-09-2026 es de esta app
#     (Dani: «vuelca la app en flotadsp.com, utiliza ese dominio»).
#
# despliegue.local.json (ejemplo en despliegue.ejemplo.json):
#   { "pages": "<proyecto de Cloudflare Pages>",
#     "web": "https://<tu-dominio>",
#     "backend": "https://<tu-api>",
#     "staging_web": "https://staging.<proyecto>.pages.dev",
#     "staging_api": "https://<tu-api-staging>/api" }
# Variables equivalentes: FLOTA_PAGES, FLOTA_WEB, FLOTA_BACKEND,
# FLOTA_STAGING_WEB, FLOTA_STAGING_API, FLOTA_META_PIXEL, FLOTA_TIKTOK_PIXEL.
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
        # Los pixeles van en la COMPILACION de la web (VITE_*): sin ellos, un
        # despliegue con el script los quitaba sin avisar (06-10-2026).
        meta_pixel   = $env:FLOTA_META_PIXEL
        tiktok_pixel = $env:FLOTA_TIKTOK_PIXEL
    }
    $fichero = Join-Path $PSScriptRoot "..\despliegue.local.json"
    if (Test-Path $fichero) {
        $j = Get-Content $fichero -Raw | ConvertFrom-Json
        foreach ($k in @($d.Keys)) {
            $v = $j.$k
            if ($v) { $d[$k] = "$v".TrimEnd("/") }
        }
    }

    # Lo que es de FlotaDSP y no se toca: su proyecto de Pages y sus apps de
    # Fly (flotadsp-v2.pages.dev, flotadsp-backend.fly.dev...).
    $infraVieja = '(^flotadsp(-|$))|flotadsp-v2|flotadsp[\w-]*\.(pages\.dev|fly\.dev)'
    foreach ($k in @($d.Keys)) {
        if ("$($d[$k])" -match $infraVieja) {
            throw "El destino '$k' ($($d[$k])) es infraestructura de FlotaDSP. Este repositorio es otro producto: no se despliega ahi."
        }
    }
    $faltan = @($Requiere | Where-Object { -not $d[$_] })
    if ($faltan.Count -gt 0) {
        throw ("Falta el destino: " + ($faltan -join ", ") +
               ". Ponlo en despliegue.local.json (copia despliegue.ejemplo.json) o en variables FLOTA_*.")
    }
    return $d
}
