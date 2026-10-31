# -----------------------------------------------------------------
# NADA SE DESPLIEGA EN ROJO, TAMBIEN DESDE EL PC (01-11-2026).
#
# Por que existe: el 31-10-2026 el backend se desplego desde el PC con el CI de
# `main` en rojo desde hacia dos horas, y nadie lo supo: deploy-backend.ps1 no
# corria ni un test ni un checker antes de `fly deploy`, y deploy-frontend.ps1
# solo check-hooks. La regla «nada se despliega en rojo» solo la cumplia GitHub.
#
# Esto mira, con la API de GitHub (el token del credential manager de git, que
# nunca se imprime), el ultimo run del CI sobre el commit que hay en HEAD:
#   · verde            -> sigue;
#   · rojo             -> PARA y dice que;
#   · aun corriendo    -> PARA (espera a que acabe, o -SinCI a sabiendas);
#   · sin ningun run   -> PARA (ese commit no esta en GitHub: haz push);
#   · arbol sucio      -> PARA (lo que vas a desplegar no es lo que el CI probo).
# Con -SinCI se salta todo (se escribe en la consola que se ha saltado).
#
#   . (Join-Path $PSScriptRoot "ci-verde.ps1"); Assert-CiVerde -Raiz $raiz -SinCI:$SinCI
# -----------------------------------------------------------------
function Get-TokenGitHub {
    $salida = "protocol=https`nhost=github.com`n`n" | git credential fill 2>$null
    foreach ($linea in $salida) { if ($linea -like "password=*") { return $linea.Substring(9) } }
    return $null
}

function Assert-CiVerde {
    param([string]$Raiz, [switch]$SinCI, [string]$Flujo = "ci.yml", [string]$Repo = "oga5furgonetas/foefa")
    if ($SinCI) { Write-Host "    AVISO: desplegando SIN mirar el CI (-SinCI)." -ForegroundColor Yellow; return }
    Push-Location $Raiz
    try {
        $sucio = git status --porcelain 2>$null
        $sha = (git rev-parse HEAD 2>$null).Trim()
    } finally { Pop-Location }
    if ($sucio) {
        throw "Hay cambios sin commit en el arbol de trabajo: lo que vas a desplegar no es lo que el CI probo. Haz commit y push (o -SinCI a sabiendas)."
    }
    $token = Get-TokenGitHub
    if (-not $token) { throw "No hay token de GitHub en el credential manager de git: no se puede mirar el CI (o -SinCI a sabiendas)." }
    $cab = @{ Authorization = "Bearer $token"; Accept = "application/vnd.github+json"; "User-Agent" = "fds-ci-verde/1.0" }
    # HEAD puede no tener run (un commit solo de documentos con «[skip ci]»): se busca hacia atras el ultimo commit
    # que si lo tenga, y se exige que lo que hay por encima sean SOLO documentos (docs/ y *.md).
    Push-Location $Raiz
    try { $shas = @(git rev-list --max-count=15 HEAD 2>$null) } finally { Pop-Location }
    $run = $null
    $base = $null
    foreach ($s in $shas) {
        try {
            $r = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/actions/workflows/$Flujo/runs?head_sha=$s&per_page=1" -Headers $cab -TimeoutSec 30
        } catch {
            throw "No se ha podido consultar el CI de GitHub: $($_.Exception.Message) (o -SinCI a sabiendas)."
        }
        if ($r.workflow_runs -and $r.workflow_runs.Count -gt 0) { $run = $r.workflow_runs[0]; $base = $s; break }
    }
    if (-not $run) { throw "Ninguno de los ultimos $($shas.Count) commits tiene un run del CI en GitHub: haz push y espera a que acabe (o -SinCI a sabiendas)." }
    if ($base -ne $sha) {
        Push-Location $Raiz
        try { $cambiados = @(git diff --name-only $base HEAD 2>$null) } finally { Pop-Location }
        $noDocs = @($cambiados | Where-Object { $_ -notmatch '^docs/' -and $_ -notmatch '\.md$' })
        if ($noDocs.Count -gt 0) {
            throw "HEAD ($($sha.Substring(0,7))) no tiene run del CI y, desde el ultimo que lo tiene ($($base.Substring(0,7))), hay cambios que no son documentos: $($noDocs -join ', '). Haz push sin [skip ci] y espera al CI (o -SinCI a sabiendas)."
        }
        Write-Host "    (HEAD $($sha.Substring(0,7)) no tiene run; el ultimo con CI es $($base.Substring(0,7)) y por encima solo hay documentos)"
    }
    if ($run.status -ne "completed") { throw "El CI del commit $($base.Substring(0,7)) todavia esta '$($run.status)': espera a que acabe ($($run.html_url)) (o -SinCI a sabiendas)." }
    if ($run.conclusion -ne "success") { throw "EL CI DEL COMMIT $($base.Substring(0,7)) ESTA EN ROJO ($($run.conclusion)): no se despliega. Mira $($run.html_url) (o -SinCI a sabiendas)." }
    Write-Host "    CI verde para $($base.Substring(0,7)) ($($run.html_url))"
}
