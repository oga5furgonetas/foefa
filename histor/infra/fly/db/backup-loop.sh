#!/bin/bash
# Copia lógica diaria (03:17 UTC) en /data/backups, comprobada con pg_restore y con rotación.
# Descargar una: fly ssh sftp get -a histor-db /data/backups/<archivo>.dump
set -u
DIR=/data/backups
KEEP="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$DIR"
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "today 03:17" +%s)
  [ "$next" -le "$now" ] && next=$(date -u -d "tomorrow 03:17" +%s)
  sleep $((next - now))
  f="$DIR/histor-$(date -u +%Y%m%dT%H%M%SZ).dump"
  if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges --compress=9 -f "$f.tmp" \
    && pg_restore --list "$f.tmp" > /dev/null; then
    mv "$f.tmp" "$f"
    echo "copia correcta: $f ($(du -h "$f" | cut -f1))"
  else
    rm -f "$f.tmp"
    echo "ERROR: la copia de seguridad ha fallado"
  fi
  find "$DIR" -name 'histor-*.dump' -mtime +"$KEEP" -delete
done
