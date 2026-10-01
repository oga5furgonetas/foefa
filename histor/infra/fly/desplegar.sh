#!/usr/bin/env bash
# Despliegue completo de Histor en Fly.io con apps PROPIAS (nunca las de Flota/FlotaDSP):
#   histor-db (PostgreSQL + volumen), histor-worker (pipeline 24/7) y histor-web (web, panel y API).
#
# Uso, desde la carpeta histor/:
#   FLY_API_TOKEN=…  infra/fly/desplegar.sh          (o con `fly auth login` hecho en la cuenta buena)
#
# Secretos: se leen de $HISTOR_SECRETS (por defecto ~/.histor-secretos-prod.env, fuera de git).
# Nada se imprime. Es idempotente: se puede relanzar para redesplegar.
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash en Windows: no convertir «/health» en rutas de disco

DB_APP="${HISTOR_DB_APP:-histor-db}"
WEB_APP="${HISTOR_WEB_APP:-histor-web}"
WORKER_APP="${HISTOR_WORKER_APP:-histor-worker}"
ORG="${FLY_ORG:-personal}"
REGION="${FLY_REGION:-fra}"
SECRETS="${HISTOR_SECRETS:-$HOME/.histor-secretos-prod.env}"

# Guarda: solo apps de Histor.
for a in "$DB_APP" "$WEB_APP" "$WORKER_APP"; do
  [[ "$a" == histor-* ]] || { echo "✕ Nombre de app no permitido: $a (solo histor-*)"; exit 1; }
done
[ -f "$SECRETS" ] || { echo "✕ Falta el archivo de secretos $SECRETS"; exit 1; }
cd "$(dirname "$0")/../.." # histor/
set -a
# shellcheck disable=SC1090
. "$SECRETS"
set +a
: "${POSTGRES_PASSWORD:?}" "${DATABASE_URL:?}" "${PUBLIC_BASE_URL:?}" "${SESSION_SECRETS:?}" "${DATA_ENCRYPTION_KEY:?}" "${ANALYTICS_SALT:?}"

step() { printf '\n── %s\n' "$*"; }

# KEY=valor de las variables indicadas que tengan valor (para `fly secrets import`, sin mostrarlas).
lines() { for k in "$@"; do [ -n "${!k:-}" ] && printf '%s=%s\n' "$k" "${!k}"; done; return 0; }
COMMON=(DATABASE_URL PUBLIC_BASE_URL SESSION_SECRETS DATA_ENCRYPTION_KEY ANALYTICS_SALT METRICS_TOKEN
  VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT EMAIL_FROM RESEND_API_KEY CONTACT_EMAIL DPO_EMAIL
  LEGAL_ENTITY_NAME LEGAL_ADDRESS LEGAL_TAX_ID LEGAL_REGISTRY LEGAL_REPRESENTATIVE LEGAL_EDITOR_IN_CHARGE
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_AUTOMATIC_TAX AI_PROVIDER_WRITING AI_PROVIDER_TRANSLATION
  AI_PROVIDER_EXTRACTION AI_MONTHLY_BUDGET_USD ANTHROPIC_API_KEY OPENAI_API_KEY OPENAI_BASE_URL GEMINI_API_KEY
  SENTRY_DSN GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET APPLE_CLIENT_ID APPLE_TEAM_ID APPLE_KEY_ID BOT_CONTACT_URL
  INDEXNOW_KEY GOOGLE_SITE_VERIFICATION BING_SITE_VERIFICATION AI_DAILY_TOKEN_LIMIT AI_MIN_IMPORTANCE AI_REQUEST_TOKEN_CAP AI_REASONING_EFFORT AI_QUOTA_RESET_TZ AI_TRANSLATE_TO
  ADSENSE_CLIENT TELEGRAM_BOT_TOKEN TELEGRAM_CHANNELS SOCIAL_MIN_IMPORTANCE SOCIAL_MAX_PER_HOUR SOCIAL_MIN_INTERVAL_MIN
  BLUESKY_HANDLE BLUESKY_APP_PASSWORD BLUESKY_DID MASTODON_BASE_URL MASTODON_TOKEN)

step "Apps ($ORG, $REGION)"
for a in "$DB_APP" "$WORKER_APP" "$WEB_APP"; do
  if fly status -a "$a" >/dev/null 2>&1; then echo "✓ $a ya existe"; else fly apps create "$a" --org "$ORG" >/dev/null && echo "✓ $a creada"; fi
done

step "Volumen de la base (3 GB, instantáneas diarias 14 días)"
if fly volumes list -a "$DB_APP" 2>/dev/null | grep -q histor_pgdata; then echo "✓ ya existe"; else
  fly volumes create histor_pgdata -a "$DB_APP" -r "$REGION" -s 3 --snapshot-retention 14 --yes >/dev/null && echo "✓ creado"
fi

step "Secretos"
lines POSTGRES_PASSWORD | fly secrets import -a "$DB_APP" --stage >/dev/null
lines "${COMMON[@]}" | fly secrets import -a "$WEB_APP" --stage >/dev/null
{ lines "${COMMON[@]}" ADMIN_EMAIL ADMIN_PASSWORD; echo 'INGEST_ENABLED=1'; } | fly secrets import -a "$WORKER_APP" --stage >/dev/null
echo "✓ cargados (sin mostrarlos)"

# `fly ssh console` en Windows termina con «The handle is invalid» aunque el comando haya
# funcionado: se juzga por lo que responde el servidor, nunca por el código de salida.
sshc() { fly ssh console -a "$1" -C "$2" 2>&1 | grep -v 'The handle is invalid' || true; }
need() { printf '%s\n' "$1"; grep -q -- "$2" <<<"$1" || { echo "✕ no aparece «$2»"; exit 1; }; }

step "Base de datos ($DB_APP)"
if [ "${HISTOR_SKIP_DB:-}" = 1 ]; then echo "(no se redespliega: HISTOR_SKIP_DB=1)"; else
  (cd infra/fly/db && fly deploy . --config ../db.toml --dockerfile Dockerfile -a "$DB_APP" --ha=false --remote-only --yes)
fi
for i in $(seq 1 30); do
  if sshc "$DB_APP" "pg_isready -U histor -d histor" | grep -q "accepting connections"; then echo "✓ PostgreSQL listo"; break; fi
  [ "$i" = 30 ] && { echo "✕ PostgreSQL no responde"; exit 1; }
  sleep 5
done

step "Worker ($WORKER_APP): migra al arrancar"
fly deploy . --config infra/fly/worker.toml --dockerfile Dockerfile --build-target worker -a "$WORKER_APP" --ha=false --remote-only --yes

step "Web ($WEB_APP)"
fly deploy . --config infra/fly/web.toml --dockerfile Dockerfile --build-target web -a "$WEB_APP" --ha=false --remote-only --yes

step "Datos de referencia, administrador y fuentes"
cli() { sshc "$WORKER_APP" "node apps/worker/dist/cli.js $*"; }
need "$(cli seed)" "✓ referencia"
if [ -n "${ADMIN_PASSWORD:-}" ]; then
  need "$(cli create-admin)" "✓ admin"
  fly secrets unset ADMIN_PASSWORD -a "$WORKER_APP" >/dev/null && echo "✓ ADMIN_PASSWORD borrada de los secretos"
fi
cli sources:check --update | tail -3 # las que fallan quedan en pausa
cli check:env

step "Comprobaciones"
curl -sS -m 30 "$PUBLIC_BASE_URL/api/health" || true
echo
for p in /es /en /robots.txt /sitemap.xml /news-sitemap.xml; do
  printf '%-18s %s\n' "$p" "$(curl -s -m 30 -o /dev/null -w '%{http_code}' "$PUBLIC_BASE_URL$p")"
done
if curl -s -m 30 "$PUBLIC_BASE_URL/robots.txt" | grep -qx 'Disallow: /'; then echo "✕ robots.txt bloquea todo (¿DEMO_MODE?)"; else echo "✓ robots.txt no bloquea la indexación"; fi
sshc "$WORKER_APP" "node -e \"fetch('http://127.0.0.1:8081/health').then(r=>r.text()).then(t=>console.log(t))\""
echo
echo "Listo: $PUBLIC_BASE_URL  ·  panel: $PUBLIC_BASE_URL/admin (activa el 2FA al entrar)"
