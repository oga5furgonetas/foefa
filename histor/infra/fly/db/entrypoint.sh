#!/bin/bash
# Lanza el bucle de copias y cede el control al arranque normal de la imagen oficial.
set -e
/usr/local/bin/backup-loop.sh &
exec docker-entrypoint.sh "$@"
