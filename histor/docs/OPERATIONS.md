# Operación de Histor

> Histor es un producto independiente: **no** se despliega sobre la
> infraestructura de Flota ni de FlotaDSP de este repositorio. Las plantillas de
> `infra/fly/` usan nombres propios (`histor-web`, `histor-worker`) que el
> propietario debe cambiar por los suyos.

## 1. Poner en marcha un entorno nuevo

1. **Base de datos:** PostgreSQL 15+ gestionado (Neon, Supabase, RDS, Fly
   Postgres, Crunchy…). Copias automáticas activadas.
2. **Secretos** (ver `.env.example`): como mínimo `DATABASE_URL`,
   `PUBLIC_BASE_URL`, `SESSION_SECRETS`, `DATA_ENCRYPTION_KEY`, `ANALYTICS_SALT`.
   Comprueba con `node apps/worker/dist/cli.js check:env`.
3. **Imágenes:**
   ```bash
   docker build --target web -t histor-web .
   docker build --target worker -t histor-worker .
   ```
   El worker aplica las migraciones al arrancar (idempotente).
4. **Datos de referencia y administrador:**
   ```bash
   docker run --rm --env-file .env histor-worker node apps/worker/dist/cli.js seed
   docker run --rm --env-file .env histor-worker node apps/worker/dist/cli.js create-admin
   ```
   Al entrar en `/admin` por primera vez el panel obliga a activar el 2FA.
5. **Fuentes reales:** `node apps/worker/dist/cli.js sources:check --update`
   (respeta robots.txt; pausa las que no respondan o no tengan piezas).
6. **Encender la ingesta:** `INGEST_ENABLED=1` en el worker.
7. **Datos legales:** rellena `LEGAL_*`, `CONTACT_EMAIL`, `DPO_EMAIL` y haz
   revisar los textos de `packages/core/src/legal/pages.ts` por un abogado en
   cada país donde operes. Mientras falten, la web muestra `[PENDIENTE: …]`.
8. **Integraciones opcionales:** Stripe (y su webhook), Resend, VAPID, Google/Apple,
   IA, Sentry, `METRICS_TOKEN`.

### Con Fly.io, en un paso (recomendado)

`infra/fly/desplegar.sh` (desde `histor/`) crea o reutiliza las tres apps propias
(`histor-db` con PostgreSQL y volumen de 3 GB con instantáneas diarias de 14 días,
`histor-worker` y `histor-web`, región `fra`), carga los secretos de
`~/.histor-secretos-prod.env` sin mostrarlos, despliega, ejecuta `seed`,
`create-admin` (y borra `ADMIN_PASSWORD`), `sources:check --update` y `check:env`,
y comprueba salud, portadas, robots y sitemaps. Se niega a tocar apps que no se
llamen `histor-*`. Coste orientativo: ~10–12 USD/mes (tres máquinas de 512 MB).

La base propia hace además un `pg_dump` diario a las 03:17 UTC en `/data/backups`
(14 días). Descargar una copia: `fly ssh sftp get -a histor-db /data/backups/<archivo>.dump`.

### Con Fly.io, a mano

```bash
fly apps create <tu-app-web> && fly apps create <tu-app-worker>     # nombres propios
fly secrets set -a <tu-app-web> DATABASE_URL=… SESSION_SECRETS=… DATA_ENCRYPTION_KEY=… ANALYTICS_SALT=… PUBLIC_BASE_URL=https://…
fly secrets set -a <tu-app-worker> (los mismos) INGEST_ENABLED=1
fly deploy . -c infra/fly/web.toml --dockerfile Dockerfile --build-target web -a <tu-app-web>        # desde histor/
fly deploy . -c infra/fly/worker.toml --dockerfile Dockerfile --build-target worker -a <tu-app-worker>
```

### Con Docker Compose (un servidor)

`cp .env.example .env`, rellena lo mínimo y `docker compose up -d --build`.
Pon delante un proxy con TLS (Caddy, Traefik, Cloudflare).

### CDN

Las páginas públicas no usan nonce en la CSP, así que una CDN puede cachearlas
unos segundos. Para la geolocalización por país, la CDN debe añadir
`cf-ipcountry` (Cloudflare) o `x-vercel-ip-country`; Histor nunca guarda la IP.

## 2. Del modo DEMO a producción

1. `DEMO_MODE=0` (o sin definir).
2. `node apps/worker/dist/cli.js demo:purge` borra todo lo DEMO.
3. Comprueba `/robots.txt` (ya no debe decir `Disallow: /`) y `/sitemap.xml`.

## 3. Procesos

| Proceso | Qué hace | Salud |
|---|---|---|
| web | páginas, panel, API | `GET /api/health` |
| worker | pipeline cada `PIPELINE_INTERVAL_SEC`, cola cada 2 s, newsletters/redes cada 5 min, mantenimiento cada 6 h | `GET :8081/health` (503 si el pipeline lleva >10 min sin correr) |

Se pueden ejecutar varias réplicas del worker: solo una ejecuta el pipeline a la
vez (candado de Postgres) y la cola reparte los trabajos sin duplicarlos.

CLI (`node apps/worker/dist/cli.js …` o `npm run cli -w @histor/worker -- …`):
`migrate`, `seed`, `create-admin`, `demo:seed [--phase=2]`, `demo:purge`,
`sources:check [--update] [--only=slug]`, `run-once`, `newsletter:send`, `check:env`.

## 4. Copias de seguridad y recuperación

- **Diarias:** `infra/backup.sh` (pg_dump comprimido, comprobado con
  `pg_restore --list`, subida a S3 compatible si hay `S3_*`, rotación de
  `BACKUP_KEEP_DAYS` días). Prográmalo con cron o una máquina programada.
- **Del proveedor:** activa además las copias y el PITR de tu Postgres gestionado.
- **Restaurar:** `DATABASE_URL=<base vacía> infra/restore.sh backups/histor-….dump`;
  comprueba la web contra esa base y después cambia `DATABASE_URL`.
- **Objetivos orientativos:** RPO 24 h con `backup.sh` (minutos con PITR),
  RTO < 1 h (restaurar + desplegar).
- **Prueba de recuperación:** restaurar una copia en una base temporal una vez al mes.

## 5. Rotación de secretos

| Secreto | Cómo rotar |
|---|---|
| `SESSION_SECRETS` | añade el nuevo delante: `nuevo,viejo`. Todo se firma con el nuevo y se aceptan ambos. Pasados 30 días, quita el viejo. |
| `DATA_ENCRYPTION_KEY` | no se rota sin migración: los 2FA existentes dejarían de valer. Si hay que hacerlo, los usuarios reactivan su 2FA. |
| `ANALYTICS_SALT` | rotarlo rompe la continuidad de los identificadores anónimos (aceptable; es seudonimización). |
| `STRIPE_*`, `RESEND_API_KEY`, `VAPID_*`, IA | crea la nueva en el proveedor, actualiza el secreto, redespliega y revoca la vieja. |
| `ADMIN_PASSWORD` | solo se usa en `create-admin`; bórrala del entorno tras crear el admin. |

## 6. Guías rápidas

- **Una fuente falla:** tras 5 errores seguidos pasa a `failing` y se abre una
  tarea de revisión. Mira «Operación → errores de lectura». Si la fuente cambió
  de URL, edítala en `config/sources.ts` o pausa desde el panel.
- **El pipeline no corre:** `GET :8081/health` del worker y «Operación →
  Pipeline». Un candado colgado se libera solo al cerrarse la conexión del worker caído.
- **Trabajos fallidos:** «Operación → Trabajos fallidos»; se reintentan con espera
  exponencial hasta 5 veces.
- **Pagos que fallan:** Stripe reintenta (Smart Retries). Histor mantiene el
  acceso 7 días en `past_due`; después se pierde el Premium automáticamente.
- **Webhook de Stripe con 400:** firma incorrecta → revisa `STRIPE_WEBHOOK_SECRET`.
  Los eventos no procesados se reenvían desde el panel de Stripe (Histor es idempotente).
- **Gasto de IA:** `AI_MONTHLY_BUDGET_USD`. Al alcanzarlo se vuelve a las
  plantillas deterministas; «Operación → Uso de IA» muestra coste por tarea y modelo.
- **Una noticia está mal:** panel → historia → «Corregir» (nota pública
  obligatoria) o «Retirar» (queda visible y marcada). Nunca se borra en silencio.
- **Aviso de un lector:** llega a «Revisión» con prioridad según el tipo.

## 7. Observabilidad

- Logs JSON (pino) con redacción de cabeceras de autenticación y cookies.
- `GET /api/metrics` (Prometheus) con `METRICS_TOKEN`: piezas, historias por
  estado, publicaciones, tareas abiertas, trabajos, coste de IA…
- Sentry si hay `SENTRY_DSN`.
- Panel → Resumen: métricas editoriales, de audiencia, de negocio y de coste.
