# Histor: estado del proyecto

> Periódico digital global, multidioma, geolocalizado y automatizado, con
> verificación por diseño. **Regla n.º 1: no publicar información no
> verificada como hecho.** Prioridades: veracidad > velocidad > relevancia >
> crecimiento > monetización.

Última actualización: 27-09-2026.

## Resumen

El producto está **construido y probado con fuentes reales** (27-09-2026, en el
PC de Dani): 35 de 41 fuentes leen bien y el pipeline publica noticias reales
en los 6 idiomas, cada una con al menos 2 fuentes independientes y el recuadro
«Cómo verificamos esta noticia». La ingesta, la verificación, la redacción, los
controles, la web, el panel, las cuentas, los pagos (a falta de claves), las
newsletters, las alertas, la medición y el worker 24/7 están probados.

**Despliegue: preparado, pendiente de ejecutar.** `infra/fly/desplegar.sh` lo hace
todo en un paso (apps propias `histor-db`, `histor-worker`, `histor-web` en la
cuenta nueva de Fly de Dani, región `fra`; nunca las de Flota). Los secretos de
producción ya están generados en `~/.histor-secretos-prod.env` (fuera de git) y la
contraseña del panel en `~/.histor-admin.txt`. Falta la autorización para crear
las apps (el despliegue a producción quedó bloqueado por los permisos de la
sesión) y, después, que Dani active el 2FA al entrar en `/admin`.

**No anunciar todavía:** faltan los datos legales del titular (LSSI).

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
| 5. Ingesta | ✅ conectores RSS, Atom, JSON Feed, GeoJSON, News Sitemap, metadatos HTML y APIs de Reddit, X, YouTube, Bluesky y Mastodon; robots.txt, reserva TDM, GET condicional, anti-SSRF con IP resuelta, Content-Signal `ai-input=no`, juego de caracteres declarado, filtro de lo que no es noticia; 41 fuentes con feed, **35 validadas en red** (27-09-2026) |
| 6. Verificación | ✅ determinista y explicable; 18 casos adversarios + calibración |
| 7. Redacción con guardarraíles | ✅ redactor determinista en 6 idiomas, IA opcional intercambiable, validador frase a frase, 11 controles |
| 8. Multidioma + geolocalización | ✅ es, en, de, fr, it, pt (nl, ja, ko, ar, hi preparados); rutas localizadas; edición por país |
| 9. SEO | ✅ canónicas, hreflang, NewsArticle/Organization/Breadcrumb JSON-LD, sitemaps, News sitemap, RSS, OG, robots (DEMO = noindex) |
| 10. Cuentas + suscripciones | ✅ registro, 2FA, Google/Apple (OIDC), RGPD (exportar/borrar), Stripe Checkout/portal/webhooks, 14 mercados con precios propios |
| 11. Analítica + recomendación | ✅ medición propia con consentimiento, «Para ti» anti-burbuja, A/B de titulares por lectura real |
| 12. Observabilidad | ✅ logs JSON con redacción, Prometheus, Sentry opcional, salud de web y worker, pipeline_runs |
| 13. Testing | ✅ 160 pruebas del núcleo + 2 del worker + 47 E2E (escritorio y móvil) |
| 14. Producción | 🟡 Docker probado; `infra/fly/desplegar.sh` (base propia en Fly con copias diarias, worker y web); secretos generados. **Falta ejecutar el despliegue** (autorización) |

## Cómo arrancarlo

Ver `README.md` (local en 5 minutos, sin claves) y `docs/OPERATIONS.md`
(producción, copias, rotación de secretos, guías de incidencias).

## Resultados de las pruebas (27-09-2026, Windows del propietario)

| Suite | Resultado |
|---|---|
| Tipos (núcleo, web, worker) y ESLint (web) | ✅ sin errores ni avisos |
| Núcleo: unitarias, adversarias, calibración, integración con Postgres 16 | ✅ 160/160 |
| Worker | ✅ 2/2 |
| E2E Playwright contra `next start` (escritorio + móvil) | ✅ 47/47 |
| `next build` y bundle del worker | ✅ |
| `scripts/check-secrets.mjs` | ✅ sin secretos |
| `sources:check` con red real | ✅ 35/41 (ver `docs/SOURCES.md`) |
| Pipeline con fuentes reales, sin DEMO, 20+ min | ✅ publica en es, en, de, fr, it y pt, todo con ≥ 2 fuentes |

Fallos encontrados con fuentes reales y corregidos (cada uno con su prueba):

- **Verificación:** una afirmación se daba por confirmada por otra fuente que
  solo compartía protagonistas («negocia comprar terrenos» ≠ «estudia abrir un
  campus»); entre idiomas bastaba compartir el lugar («Green flood alert in
  Ukraine» salió verificada con 3 fuentes sobre Lavrov); el agrupador juntaba
  historias por un topónimo (el filtro comparaba «ukraine» con «UA») y por
  países que faltaban en el diccionario («Arabia Saudita», «Faixa de Gaza» se
  tomaban por personas; añadidos 52 países y territorios).
- **Política editorial:** 2 fuentes independientes para publicar y ninguna
  fuente sola como «verificada» (antes la portada alemana era el feed de DER
  SPIEGEL, con opinión y viñetas); BOE, GDACS, GOV.UK, BCE, Fed y NASA solo
  corroboran. Ajustable en el panel → Umbrales.
- **Redacción:** BOE en ISO-8859-1 («Resoluci�n»); enlaces HTML que metían
  espacios («three - day») y párrafos pegados; frases cortadas (subordinada
  sola, «…, warnen aber davor», relativo abierto); titulares con «Live:»,
  «EN DIRECT,» u horas de directo; plantilla de terremotos («registró a las 26
  de septiembre»); entradilla igual al titular; «1 fuentes».
- **Fuentes:** DW (es, pt-BR) y Corriere corregidas; ONU, El País, Il Post y OMS
  en pausa (robots.txt, 403 o feed abandonado); `Content-Signal: ai-input=no`
  respetado (esas historias nunca pasan por la IA).
- **Pruebas en Windows:** la base E2E no se recreaba (psql ignoraba los `-c`).

## Bloqueos (externos: solo los puede resolver el propietario)

1. **Autorizar el despliegue.** Todo está listo: `cd histor && FLY_API_TOKEN=… infra/fly/desplegar.sh`
   (token de la cuenta nueva de Fly). Coste: ~10–12 USD/mes (tres máquinas de 512 MB
   en `fra` + volumen de 3 GB). Tras desplegar, entrar en `/admin` con los datos de
   `~/.histor-admin.txt` y **activar el 2FA** (obligatorio en producción).
2. **Datos legales** del titular (nombre/razón social, NIF, domicilio, correo de
   contacto y de privacidad; registro solo si es sociedad): hoy salen como
   `[PENDIENTE: …]`. Obligatorio (LSSI) antes de anunciar la web. Se añaden como
   `LEGAL_*`, `CONTACT_EMAIL` y `DPO_EMAIL` en `~/.histor-secretos-prod.env` y se
   relanza el script.
3. **Dominio.** `histor.news` (25,20 USD/año) y `histor.media` (35,20 USD/año) estaban
   libres el 27-09-2026. Hay que comprarlo (Cloudflare Registrar) y apuntarlo con
   `fly certs add <dominio> -a histor-web`; después, `PUBLIC_BASE_URL` con él.
4. **Integraciones** (todas opcionales; sin ellas se desactivan de forma explícita):
   Stripe + webhook, Resend (correo), IA (proveedor, clave y tope), Google/Apple,
   Sentry, S3/R2 para copias fuera de Fly. VAPID ya está generado.

## Pendiente (no bloqueado)

- Imágenes con licencia: integración con Wikimedia Commons y banco propio (el
  modelo `media` con licencia, autor y rótulos «ilustrativa»/«IA» ya existe; hoy
  las noticias sin foto con licencia se presentan tipográficamente).
- `/.well-known/security.txt` con el contacto definitivo.
- Idiomas preparados (nl, ja, ko, ar, hi): faltan diccionario, rutas y frases.
- Búsqueda: pasar a OpenSearch/Meilisearch si el volumen lo pide.

## Próximas acciones tras desplegar

1. Activar el 2FA del panel y vigilar las primeras 48 h (Resumen, Revisión, Operación).
2. Rellenar los datos legales y, con dominio, cambiar `PUBLIC_BASE_URL`.
3. Copia fuera de Fly: bucket S3/R2 propio de Histor (no el de Flota) para `infra/backup.sh`.
4. Afinar umbrales con datos reales (el primer arranque procesa ~2.000 piezas: la
   cola tarda unos 30 min en vaciarse).
