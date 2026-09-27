#!/usr/bin/env bash
# Copia de seguridad lógica de PostgreSQL (formato custom, comprimida) con
# rotación local y subida opcional a S3 compatible (R2, S3, B2, MinIO).
#   DATABASE_URL=… ./infra/backup.sh
# Programar: cron diario (p. ej. 03:17) o una máquina programada de Fly.
set -euo pipefail
: "${DATABASE_URL:?Falta DATABASE_URL}"
DIR="${BACKUP_DIR:-backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$DIR"
FILE="$DIR/histor-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-privileges --compress=9 --file "$FILE" "$DATABASE_URL"
# Comprobación: el archivo se puede leer.
pg_restore --list "$FILE" > /dev/null
echo "✓ copia local: $FILE ($(du -h "$FILE" | cut -f1))"
if [[ -n "${S3_BUCKET:-}" && -n "${S3_ACCESS_KEY_ID:-}" ]]; then
  AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    aws s3 cp "$FILE" "s3://$S3_BUCKET/postgres/$(basename "$FILE")" ${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"} --only-show-errors
  echo "✓ subida a s3://$S3_BUCKET/postgres/"
else
  echo "Aviso: sin S3_BUCKET/S3_ACCESS_KEY_ID, la copia solo está en este disco."
fi
find "$DIR" -name 'histor-*.dump' -mtime +"$KEEP_DAYS" -delete
