# Histor: estado del proyecto

> Periódico digital global, multidioma, geolocalizado y automatizado, con
> verificación por diseño. **Regla n.º 1: no publicar información no
> verificada como hecho.** Prioridades: veracidad > velocidad > relevancia >
> crecimiento > monetización.

Última actualización: 27-09-2026.

## Objetivo

Descubrir acontecimientos en fuentes públicas y legales, contrastarlos con
varias fuentes independientes, redactar noticias originales en 6 idiomas
(es, en, de, fr, it, pt), publicarlas, actualizarlas y retirarlas cuando
toca, con la mínima intervención humana y guardarraíles que impiden publicar
rumores como hechos.

## Nombre

**Histor**, del griego ἵστωρ: «el que sabe porque ha visto; testigo, juez».
Es la raíz de *historia* (Heródoto: *historíē* = investigación). Enlaza con
la idea del periodismo como «primer borrador de la historia».
- Corto (6 letras, 2 sílabas) y pronunciable en los 6 idiomas; la raíz se
  reconoce en todos (historia, history, Historie, histoire, storia, história).
- Descartados tras investigar (por choque con un medio o una marca en su
  sector): Verum (verumnetwork.com, medio «fact-based»), Nuntia/Nunti
  (resumen de noticias por IA en 8 idiomas), Fontis (Fontis Publishing, Ad
  Fontes Media), Relata (empresa de comunicación), Crivo (fintech y capital
  riesgo en Brasil), Gnomon (revista, escuela VFX, relojes), Atesta
  (verificación de identidad en EE. UU.), Verax (nombre en clave de Snowden).
- **Pendiente (bloqueo externo):** comprobar y registrar dominio y perfiles
  sociales. Desde este entorno WHOIS y RDAP están bloqueados por la política
  de red, y la búsqueda web no encontró webs en `histor.com`, `histor.news`
  ni `histor.media`. Candidatos, por orden: `histor.news`, `histor.media`,
  `readhistor.com`, `gethistor.com`.

## Arquitectura (resumen; detalle en `docs/ARCHITECTURE.md`)

```
fuentes (RSS/Atom/JSON Feed/GeoJSON/News Sitemap/HTML meta/APIs oficiales/redes con API)
  → INGEST (robots.txt, ritmo por host, GET condicional, reserva TDM)
  → NORMALIZE + CLASSIFY (idioma, lugares, sección, entidades, origen citado, MinHash)
  → CLUSTER + DEDUPLICATE (historia = acontecimiento; copias y agencias = 1 fuente)
  → VERIFY + SCORE (claims → evidencias → contradicciones → tiempo → imágenes →
                    EVIDENCE CONFIDENCE ⟂ NEWS MOMENTUM → decisión)
  → WRITE (IA opcional + redactor determinista) → FACT CHECK (validador de alucinaciones)
  → QUALITY (11 controles) → PUBLISH / UPDATE / RETRACT (versiones y correcciones públicas)
  → DISTRIBUTE (newsletters, alertas con prioridad, redes solo lo verificado)
  → MONITOR (re-verificación programada)
```

- Monorepo TypeScript (`histor/`): `packages/core` (dominio, verificación,
  pipeline, datos), `apps/web` (Next.js: web pública, panel y API),
  `apps/worker` (procesos 24/7).
- PostgreSQL es la única infraestructura obligatoria: datos, búsqueda
  full-text por idioma y cola de trabajos (`SKIP LOCKED`). Redis es opcional.

## Decisiones clave

| Decisión | Elección | Por qué |
|---|---|---|
| Lenguaje | TypeScript en todo | Tipos compartidos web/worker/core, un solo ecosistema |
| Web | Next.js 15 (App Router, RSC, SSR/ISR) | SEO, rendimiento, i18n por rutas |
| BD | PostgreSQL 16 + Drizzle ORM | Relacional, FTS nativo por idioma, JSONB, sin binarios externos |
| Cola | Tabla `jobs` con `FOR UPDATE SKIP LOCKED` | Sin Redis al empezar; varios workers sin pisarse |
| Búsqueda | FTS de Postgres (tsvector por idioma) + pg_trgm | Suficiente hasta ~millones de artículos; OpenSearch documentado como siguiente paso |
| IA | Capa intercambiable (Anthropic por SDK oficial, OpenAI-compatible, Gemini) + modo determinista | No depender de un proveedor; sin claves, el sistema funciona igual |
| Verificación | Determinista y explicable (reglas + estadística) | Auditable; la IA nunca es la última palabra |
| Pagos | Stripe (Checkout + Customer Portal + webhooks) | Suscripciones, impuestos, recuperación de pagos fallidos |
| Fuentes tipográficas | Autoalojadas (@fontsource) | Rendimiento y GDPR (sin Google Fonts CDN) |

## Fases

| Fase | Estado |
|---|---|
| 1. Arquitectura + proyecto base | ✅ monorepo, core, migraciones |
| 2. Base de datos + backend | ✅ 45 tablas, índices, FTS, migraciones · 🔄 API REST |
| 3. Frontend + diseño | ⏳ |
| 4. CMS/admin | ⏳ |
| 5. Ingesta | ✅ conectores, robots, fetcher, registro de ~40 fuentes reales |
| 6. Motor de verificación | ✅ probado con casos adversariales |
| 7. Redacción IA con guardarraíles | ✅ redactor determinista, IA opcional, validador, 11 controles |
| 8. Multidioma + geolocalización | 🔄 datos y plantillas en 6 idiomas; falta la web |
| 9. SEO | ⏳ |
| 10. Cuentas + suscripciones | ⏳ |
| 11. Analítica + recomendación | ⏳ |
| 12. Observabilidad | 🔄 pipeline_runs, fetch_log, ai_usage |
| 13. Testing | 🔄 63 pruebas (unitarias, adversariales, integración con Postgres) |
| 14. Producción | ⏳ |

## Bloqueos (externos)

- **Red del entorno de desarrollo:** solo permite npm, PyPI y GitHub. Los
  feeds reales (BBC, Guardian, Europa Press, tagesschau…), Wikimedia, Stripe y
  WHOIS/RDAP devuelven 403 desde la política de red. Por eso la ingesta real
  no se ha podido ejecutar aquí; el pipeline se prueba de extremo a extremo
  con el escenario DEMO (feeds ficticios en memoria, marcados como DEMO).
  Para validar las fuentes reales al desplegar: `npm run sources:check`.
- **Credenciales que solo puede dar el propietario:** Stripe, proveedor de
  IA, correo (Resend), VAPID (push), Google/Apple OAuth, APIs de Reddit/X/
  YouTube, S3, Sentry. Ver `.env.example`.
- **Datos legales de la empresa** (razón social, domicilio, NIF, registro,
  responsable editorial): se muestran como marcadores visibles `[PENDIENTE: …]`.
- **Despliegue:** sin cuenta de hosting para este producto (no se usa, ni
  se debe usar, la infraestructura de Flota/FlotaDSP de este repositorio).

## Siguientes acciones

1. API REST v1 y web pública (portada, secciones, noticia, búsqueda…).
2. Panel de administración con RBAC.
3. Cuentas, Stripe y precios regionales.
4. SEO técnico, analítica, recomendación, newsletters y alertas.
5. Observabilidad, E2E y build de producción. Documentación final.
