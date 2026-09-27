# Arquitectura de Histor

## Visión general

```
                ┌────────────────────────── apps/worker (24/7) ──────────────────────────┐
 fuentes ──────▶│ INGEST → NORMALIZE → CLASSIFY → CLUSTER → DEDUP → VERIFY → SCORE        │
 (RSS, Atom,    │   → WRITE (plantilla | LLM) → FACT CHECK → 11 CONTROLES → PUBLISH        │
  JSON Feed,    │   → DISTRIBUTE (alertas, redes, newsletters) → MONITOR (re-verificación) │
  GeoJSON,      └───────────────┬─────────────────────────────────────────────────────────┘
  News Sitemap,                 │  PostgreSQL 16 (única infraestructura obligatoria)
  HTML meta,                    │  datos · búsqueda full-text por idioma · cola de trabajos
  APIs oficiales)               ▼
                ┌──────────────────────── apps/web (Next.js 15) ───────────────────────────┐
  lectores ────▶│ web pública SSR en 6 idiomas · panel /admin (RBAC + 2FA) · API /api/v1   │
                │ middleware: idioma/edición, CSP, cabeceras de seguridad                  │
                └──────────────────────────────────────────────────────────────────────────┘
```

Todo el conocimiento del dominio vive en `packages/core` (TypeScript puro, sin
framework), que usan tanto la web como el worker. La web nunca ejecuta el
pipeline; el worker nunca sirve HTML.

## Stack

| Capa | Elección | Motivo |
|---|---|---|
| Lenguaje | TypeScript 5.9 (Node 20+/22) | un solo lenguaje y tipos compartidos |
| Web | Next.js 15.5 (App Router, RSC), React 19 | SSR para SEO, rutas localizadas, route handlers |
| BD | PostgreSQL 16 + Drizzle ORM (postgres.js) | relacional, JSONB, FTS por idioma, `SKIP LOCKED` |
| Cola | tabla `jobs` + `FOR UPDATE SKIP LOCKED` | sin Redis; varias réplicas sin pisarse |
| Candado del pipeline | `pg_try_advisory_lock` | una sola vuelta del pipeline a la vez |
| Búsqueda | `tsvector` por idioma (trigger) + `pg_trgm` | suficiente hasta millones de artículos |
| Límite de ritmo | memoria o Redis (`REDIS_URL`) | Redis solo si hay varias réplicas web |
| IA | capa intercambiable: Anthropic (SDK oficial), OpenAI-compatible, Gemini | ninguna dependencia de un proveedor; sin claves, plantillas |
| Pagos | Stripe Checkout + Customer Portal + webhooks | tarjeta nunca en nuestros servidores |
| Correo | Resend (o registro local) | sin clave, los correos quedan en `mail_outbox` |
| Push | Web Push (VAPID) | sin claves, «dry_run» |
| Observabilidad | pino (logs JSON con redacción), Prometheus, Sentry opcional | |
| Pruebas | Vitest (núcleo/worker), Playwright (E2E) | |
| Empaquetado | Next standalone; worker con esbuild | imágenes Docker pequeñas |

## Paquetes

### `packages/core`

| Carpeta | Contenido |
|---|---|
| `domain.ts` | estados editoriales y transiciones, tipos de fuente, señales, roles y permisos (RBAC) |
| `env.ts` | todas las variables de entorno validadas con zod; comprobaciones de producción |
| `db/` | esquema (59 tablas), cliente, migraciones, datos de referencia |
| `config/` | idiomas, países (38; 12 ediciones), regiones, ~90 ciudades, 15 secciones, fuentes reales, precios, mesas, newsletters, umbrales |
| `text/` | normalización, frases (abreviaturas, decimales, ordinales), idioma, fechas, cifras con unidades, citas, atribución, modalidad, entidades, similitud (MinHash, coseno) |
| `ingest/` | URL canónicas, robots.txt, `PoliteFetcher` (ritmo por host, GET condicional, reserva TDM, hosts públicos), parsers y conectores |
| `verification/` | independencia, extracción de afirmaciones, emparejamiento con evidencias, contradicciones, tiempo, imágenes, confianza, impulso, decisión |
| `writing/` | ficha de hechos, redactor determinista (6 idiomas), redactor LLM, validador de alucinaciones, 11 controles de calidad, notas públicas |
| `pipeline/` | ingest, normalize, classify, cluster, verify, publish, run (una vuelta + mantenimiento) |
| `ai/` | proveedores, enrutador por tarea, presupuesto y registro de uso |
| `auth/`, `security/` | contraseñas (scrypt), sesiones de servidor, TOTP, OIDC (Google/Apple), CSRF, firmas con rotación, cifrado AES-GCM, límites de ritmo |
| `billing/` | planes regionales, Checkout, portal, webhooks idempotentes, periodo de gracia |
| `services/` | consultas públicas (portada, listas, búsqueda, artículo), panel, auditoría, ajustes |
| `analytics/`, `reco/`, `experiments/`, `newsletter/`, `notify/`, `social/` | medición con consentimiento, recomendador anti-burbuja, A/B sin clickbait, newsletters, alertas, redes |
| `seo/`, `i18n/`, `geo/`, `legal/` | JSON-LD, sitemaps, RSS, rutas y textos en 6 idiomas, detección de idioma/edición, páginas legales |
| `demo/` | escenario DEMO (fuentes y piezas ficticias marcadas) y siembra por el pipeline real |

### `apps/web`

- `src/middleware.ts`: redirección de `/` al idioma (cookie > Accept-Language > país de la CDN), edición detectada, cabeceras de seguridad, CSP (estricta con nonce en `/admin` y `/api`), protección de `/admin`.
- `src/app/(site)/[lang]/…`: portada, resolvedor de rutas localizadas (`[...path]`), RSS, 404 y error localizados.
- `src/app/(admin)/admin/…`: panel (resumen, historias con cadena de evidencia, revisión, fuentes, umbrales, precios, secciones e idiomas, usuarios, experimentos, operación).
- `src/app/api/…`: API v1, salud, métricas, imagen OG. `sitemap.xml`, `sitemaps/[file]`, `news-sitemap.xml`, `robots.txt`, `manifest.webmanifest`.
- `src/views/`: vistas de servidor. `src/components/client/`: islas de cliente (consentimiento, medición, formularios, «Para ti»).

### `apps/worker`

- `src/index.ts`: bucles de pipeline (con candado), cola de trabajos, periódicos (newsletters, redes, liberación de trabajos colgados) y mantenimiento; salud en `:8081/health`; parada limpia con SIGTERM.
- `src/cli.ts`: `migrate`, `seed`, `create-admin`, `demo:seed`, `demo:purge`, `sources:check`, `run-once`, `newsletter:send`, `check:env`.
- `src/fixtures/server.ts`: feeds DEMO por HTTP local.

## Modelo de datos (resumen)

| Área | Tablas |
|---|---|
| Geografía y taxonomía | `languages`, `countries`, `regions`, `cities`, `categories`, `entities`, `topics`, `tags`, `authors` |
| Fuentes e ingesta | `sources`, `source_reliability` (Beta), `fetch_log`, `raw_items`, `image_fingerprints` |
| Historias y verificación | `stories`, `story_items`, `story_entities`, `events`, `claims`, `evidence`, `contradictions`, `verifications` |
| Publicación | `media`, `articles` (con `search_vector`), `article_versions`, `corrections`, `article_tags`, `article_entities`, `article_topics`, `quality_reports` |
| Lectores | `users`, `oauth_accounts`, `sessions`, `auth_tokens`, `user_follows`, `saved_articles`, `reading_history`, `interest_profiles`, `recommendations` |
| Negocio | `price_plans`, `subscriptions`, `invoices`, `webhook_events` |
| Distribución | `newsletters`, `newsletter_subscriptions`, `newsletter_issues`, `push_subscriptions`, `notifications`, `social_posts` |
| Medición | `analytics_events`, `experiments` |
| Operación | `reports`, `review_tasks`, `settings`, `audit_log`, `jobs`, `pipeline_runs`, `ai_usage`, `mail_outbox` |

Índices clave: `articles(language, slug)` único, `articles(story_id, language)` único,
publicados por fecha (parcial), GIN sobre `search_vector`, trigramas en titulares,
`jobs(status, run_at)`, `sources(status, next_fetch_at)`.

Migraciones en `packages/core/migrations` (Drizzle Kit + SQL propio para
extensiones, trigger de búsqueda e índices parciales).

## Decisiones y alternativas

- **Postgres como cola**: se cambia por BullMQ/Redis si se superan ~cientos de trabajos por segundo; la interfaz (`enqueue`, `work`) no cambiaría.
- **FTS de Postgres**: el siguiente paso es OpenSearch/Meilisearch cuando la búsqueda necesite facetas complejas o varios millones de documentos por idioma.
- **Verificación determinista**: la IA puede redactar, pero nunca decide qué es verdad. Todas las decisiones quedan en `verifications` con su desglose.
- **Contenido DEMO separado**: bandera `is_demo` en fuentes, piezas, historias y artículos; la web filtra por `DEMO_MODE`. Lo DEMO no se indexa ni sale en sitemaps.
- **Páginas dinámicas**: la portada y el menú dependen de la edición (país) y de la sesión; la CDN puede cachear las páginas públicas porque su CSP no usa nonce.

## Escalado

- Web sin estado: réplicas horizontales detrás de CDN (con `REDIS_URL` para compartir el límite de ritmo).
- Worker: varias réplicas seguras (candado del pipeline y `SKIP LOCKED`); se puede separar por colas.
- Base de datos: índices ya preparados; réplicas de lectura para la web cuando haga falta; `raw_items.content_text` se poda a los 30 días.
- Imágenes: solo con licencia, servidas desde su origen o un bucket S3 compatible.
