# PostgreSQL propio de Histor en Fly (app histor-db, sin puertos públicos: solo red privada .internal).
# Imagen oficial + copia lógica diaria dentro del volumen (además de las instantáneas diarias del volumen de Fly).
FROM postgres:16-bookworm
ENV PGDATA=/data/pgdata
COPY backup-loop.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup-loop.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]
CMD ["postgres", "-c", "shared_buffers=128MB", "-c", "max_connections=60"]
