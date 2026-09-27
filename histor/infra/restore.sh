#!/usr/bin/env bash
# Restaura una copia sobre una base VACÍA (nunca sobre producción en marcha).
#   DATABASE_URL=postgres://…/histor_restore ./infra/restore.sh backups/histor-2026….dump
set -euo pipefail
: "${DATABASE_URL:?Falta DATABASE_URL (base de destino vacía)}"
FILE="${1:?Uso: restore.sh <archivo.dump>}"
pg_restore --no-owner --no-privileges --exit-on-error --dbname "$DATABASE_URL" "$FILE"
psql "$DATABASE_URL" -Atc "select 'artículos: ' || count(*) from articles; select 'historias: ' || count(*) from stories;"
echo "✓ restaurado. Comprueba la web contra esta base antes de cambiar DATABASE_URL."
