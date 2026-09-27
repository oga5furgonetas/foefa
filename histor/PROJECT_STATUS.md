# Histor: estado del proyecto

> Periódico digital global, multidioma, geolocalizado y automatizado, con
> verificación por diseño. **Regla n.º 1: no publicar información no
> verificada como hecho.** Prioridades: veracidad > velocidad > relevancia >
> crecimiento > monetización.

Última actualización: 27-09-2026.

## Resumen

El producto está **construido y funcionando en local** de punta a punta: la
ingesta, la verificación, la redacción, los controles, la publicación en
6 idiomas, la web pública, el panel, las cuentas, los pagos (a falta de claves), las
newsletters, las alertas, la medición y el worker 24/7. Todo está probado con
tests automáticos y con el escenario DEMO pasando por el pipeline real. Las
imágenes Docker se construyen y arrancan.

**No está desplegado en Internet** porque no hay cuenta de alojamiento para
este producto (y no se debe usar la infraestructura de Flota/FlotaDSP de este
repositorio). Las fuentes reales no se han podido leer desde el entorno de
desarrollo porque su política de red las bloquea.

## Nombre

**Histor** (griego ἵστωρ, «el que sabe porque ha visto; testigo»), raíz de
*historia*. Descartados tras investigar: Verum, Nuntia, Fontis, Relata, Crivo,
Gnomon, Atesta, Verax. Detalle en `docs/BRAND.md`.

## Arquitectura

```
fuentes → INGEST (robots, ritmo, TDM, anti-SSRF) → NORMALIZE/CLASSIFY → CLUSTER/DEDUP
        → VERIFY (afirmaciones, evidencias, contradicciones, tiempo, imágenes)
        → SCORE (EVIDENCE CONFIDENCE ⟂ NEWS MOMENTUM) → DECISIÓN
        → WRITE (plantilla | LLM) → FACT CHECK → 11 CONTROLES → PUBLISH/UPDATE/RETRACT
        → DISTRIBUTE (alertas, redes, newsletters) → MONITOR
```

Monorepo TypeScript: `packages/core` (dominio), `apps/web` (Next.js 15: web,
panel y API), `apps/worker` (24/7 + CLI). PostgreSQL 16 es la única pieza
obligatoria (datos, búsqueda por idioma, cola de trabajos). Detalle en
`docs/ARCHITECTURE.md` y `docs/VERIFICATION.md`.

## Fases

| Fase | Estado |
|---|---|
| 1. Arquitectura + proyecto base | ✅ |
| 2. Base de datos + backend | ✅ 59 tablas, índices, FTS por idioma, 2 migraciones, API v1 documentada (`docs/API.md`) |
| 3. Frontend + diseño | ✅ portada geolocalizada, noticia con «Cómo verificamos», secciones, país/región/ciudad, tema, autor, fuente, historia, listas, búsqueda, cuenta, suscripción, newsletters, aviso de error, páginas legales; modo oscuro; móvil |
| 4. CMS / panel | ✅ resumen, historias con cadena de evidencia, corregir/retirar/bloquear/re-verificar, revisión, fuentes, umbrales y pesos, precios, secciones e idiomas, usuarios, experimentos, operación y auditoría; RBAC + 2FA + lista de IPs |
| 5. Ingesta | ✅ conectores RSS, Atom, JSON Feed, GeoJSON, News Sitemap, metadatos HTML y APIs de Reddit, X, YouTube, Bluesky y Mastodon; robots.txt, reserva TDM, GET condicional, anti-SSRF con IP resuelta, ~40 fuentes reales configuradas (**sin validar en red**, ver bloqueos) |
| 6. Verificación | ✅ determinista y explicable; 18 casos adversarios + calibración |
| 7. Redacción con guardarraíles | ✅ redactor determinista en 6 idiomas, IA opcional intercambiable, validador frase a frase, 11 controles |
| 8. Multidioma + geolocalización | ✅ es, en, de, fr, it, pt (nl, ja, ko, ar, hi preparados); rutas localizadas; edición por país |
| 9. SEO | ✅ canónicas, hreflang, NewsArticle/Organization/Breadcrumb JSON-LD, sitemaps, News sitemap, RSS, OG, robots (DEMO = noindex) |
| 10. Cuentas + suscripciones | ✅ registro, 2FA, Google/Apple (OIDC), RGPD (exportar/borrar), Stripe Checkout/portal/webhooks, 14 mercados con precios propios |
| 11. Analítica + recomendación | ✅ medición propia con consentimiento, «Para ti» anti-burbuja, A/B de titulares por lectura real |
| 12. Observabilidad | ✅ logs JSON con redacción, Prometheus, Sentry opcional, salud de web y worker, pipeline_runs |
| 13. Testing | ✅ 111 pruebas del núcleo + 2 del worker + 47 E2E (escritorio y móvil) |
| 14. Producción | 🟡 Docker (web y worker) probado; plantillas de Fly; CI de GitHub; copias de seguridad. **Falta desplegar** (sin cuenta de hosting) |

## Cómo arrancarlo

Ver `README.md` (local en 5 minutos, sin claves) y `docs/OPERATIONS.md`
(producción, copias, rotación de secretos, guías de incidencias).

## Resultados de las pruebas (27-09-2026)

| Suite | Resultado |
|---|---|
| Tipos (núcleo, web, worker) | ✅ sin errores |
| ESLint (web) | ✅ sin avisos |
| Núcleo: unitarias, adversarias, calibración, integración con Postgres | ✅ 111/111 |
| Worker (candado del pipeline, distribución) | ✅ 2/2 |
| E2E Playwright contra `next start` (escritorio + móvil) | ✅ 47/47 |
| `next build` de producción | ✅ |
| Imágenes Docker web y worker (construidas y arrancadas contra Postgres) | ✅ |
| `scripts/check-secrets.mjs` | ✅ sin secretos |
| Checkers de Flota del repositorio (`check-existe`, `huerfanos`, `marca`, `i18n`, `permisos`, `modulos`) | ✅ intactos |

Fallos reales encontrados al probar y ya corregidos (con prueba de regresión):
el separador de frases cortaba en los ordinales alemanes («1. Januar») y dejaba
titulares a medias; una historia actualizada que ya estaba confirmada seguía
«en desarrollo»; el recuadro de verificación daba por confirmada una cifra ya
superada (41 % → 43 %); el subtítulo decía «4 fuentes» y nombraba 3; el
mantenimiento diario fallaba al pasar fechas en SQL crudo.

## Bloqueos (externos: solo los puede resolver el propietario)

1. **Red del entorno de desarrollo.** La política de red rechaza los dominios de
   las fuentes (p. ej. `earthquake.usgs.gov`, `feeds.bbci.co.uk`, `www.boe.es`,
   `www.tagesschau.de`), Wikimedia, Stripe y WHOIS/RDAP. Para leer fuentes reales
   aquí habría que ampliar el acceso de red del entorno (Network access en su
   configuración). En producción no aplica: validar con `npm run sources:check`.
2. **Alojamiento y dominio.** Sin cuenta de hosting ni dominio registrado para
   Histor. Candidatos: `histor.news`, `histor.media`, `readhistor.com`.
   Plantillas listas en `infra/fly/` y `docker-compose.yml`.
3. **Credenciales** (todas opcionales; sin ellas cada integración se desactiva
   de forma explícita): Stripe + webhook, proveedor de IA, Resend, VAPID,
   Google/Apple, Reddit/X/YouTube, Bluesky/Mastodon, Sentry, S3. Ver `.env.example`.
4. **Datos legales** del titular (razón social, domicilio, NIF, registro,
   responsable editorial, DPO): aparecen como `[PENDIENTE: …]`. Los textos
   legales son una base cuidada que debe revisar un abogado en cada país.

## Pendiente (no bloqueado)

- Imágenes con licencia: integración con Wikimedia Commons y banco propio (el
  modelo `media` con licencia, autor y rótulos «ilustrativa»/«IA» ya existe; hoy
  las noticias sin foto con licencia se presentan tipográficamente).
- `/.well-known/security.txt` con el contacto definitivo.
- Idiomas preparados (nl, ja, ko, ar, hi): faltan diccionario, rutas y frases.
- Búsqueda: pasar a OpenSearch/Meilisearch si el volumen lo pide.

## Próximas acciones al desplegar

1. Crear Postgres gestionado, secretos y las dos apps (web y worker) con nombres propios.
2. `seed`, `create-admin`, activar 2FA, `sources:check --update`, `INGEST_ENABLED=1`.
3. Rellenar datos legales; configurar Stripe (y su webhook), Resend y VAPID.
4. Vigilar las primeras 48 h desde el panel (Resumen, Revisión, Operación) y
   ajustar umbrales si hace falta.
