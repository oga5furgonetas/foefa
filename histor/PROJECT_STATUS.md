# Histor: estado del proyecto

> Periódico digital global, multidioma, geolocalizado y automatizado, con
> verificación por diseño. **Regla n.º 1: no publicar información no
> verificada como hecho.** Prioridades: veracidad > velocidad > relevancia >
> crecimiento > monetización.

Última actualización: 29-09-2026.

## Resumen

El producto está **construido y probado con fuentes reales** (27-09-2026, en el
PC de Dani): 35 de 41 fuentes leen bien y el pipeline publica noticias reales
en los 6 idiomas, cada una con al menos 2 fuentes independientes y el recuadro
«Cómo verificamos esta noticia». La ingesta, la verificación, la redacción, los
controles, la web, el panel, las cuentas, los pagos (a falta de claves), las
newsletters, las alertas, la medición y el worker 24/7 están probados.

**En producción desde el 27-09-2026:** https://histor-web.fly.dev (panel en
`/admin`). Apps propias en la cuenta nueva de Fly de Dani, región `fra` (nunca las
de Flota): `histor-db` (PostgreSQL 16 con volumen de 3 GB, instantáneas diarias
14 días y `pg_dump` diario a las 03:17 UTC en `/data/backups`), `histor-worker`
(ingesta real encendida) e `histor-web`. Coste ~10–12 USD/mes. Redesplegar:
`infra/fly/desplegar.sh` (con `HISTOR_SKIP_DB=1` para no tocar la base). Secretos
en `~/.histor-secretos-prod.env` y acceso al panel en `~/.histor-admin.txt` (fuera
de git; `ADMIN_PASSWORD` ya no está en Fly). **Falta que Dani active el 2FA** al
entrar en `/admin`. Fuentes en producción: 72/79 (ampliadas el 27-09 con 38 medios más en los 6 idiomas; Corriere responde 403 a las IP
de centros de datos; en local sí leía).

**Datos legales del titular** (persona física) cargados el 27-09-2026 como secretos
`LEGAL_*`, `CONTACT_EMAIL` y `DPO_EMAIL` (no están en el repositorio): el aviso legal
ya no muestra `[PENDIENTE]` en ningún idioma. Recomendable que un abogado revise los
textos legales antes de crecer.

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

## 29-09-2026: calidad de las noticias, ediciones por país y difusión

Revisada la portada de producción como lectora y corregido todo lo que se veía mal, cada
fallo con su prueba (`packages/core/test/unit/quality-29-09.test.ts`):

- **Texto:** entidades HTML completas («S&aacute;nchez»); firma de agencia fuera
  («MADRID, 29 OpenAI…»); titulares de al menos 5 palabras, con comillas emparejadas y
  que no sean una cita suelta («Alba Carrillo» salía de titular); entradillas que se
  entienden solas (fuera «Su partido…», «Esta empresa…», «Es que…»); la entrada es la
  frase que mejor cuenta lo del titular y ya no lo repite; una frase del cuerpo solo es
  titular si cuenta lo mismo que el titular de alguna fuente; fuera la publicidad de las
  webs («téléchargez l'application», «À lire aussi»); «Datos clave» solo con cifras que se
  entienden solas; el inciso «selon l'Insee, …» ya no corta el dato; se puede quitar la
  finalidad («pour demander…») para que quepa un titular.
- **Verificación:** la copia de un teletipo (Infobae con el texto de Europa Press) ya no
  cuenta como otra fuente: la firma con fecha se reconoce y la procedencia y la huella se
  recalculan al leer el artículo completo.
- **Sección y país** por consenso de todas las piezas (antes, los de la primera que llegó:
  Trump + Anthropic en «Deportes», OpenAI como «Francia»); sin lugar citado, las secciones
  de internacional y las cadenas internacionales no ponen su país.
- **Falsos bloqueos:** «54 000 000 000 €» se tomaba por un teléfono y paraba la noticia.
- **Rendimiento:** el verificador atiende primero lo que puede publicarse; las alertas
  verdes de GDACS (decenas al día) ya no son noticia.
- **Ediciones por país:** 29 fuentes nuevas comprobadas (México, Colombia, Chile, Perú,
  EE. UU. nacional, Canadá); CBS y ABC con sus feeds generales; edición de Perú.
  **100/106 fuentes en verde** (en local). El Universal, Axios y The Globe and Mail no
  se leen porque su robots.txt no lo permite.
- **Geolocalización por IP** (DB-IP Lite, CC BY 4.0; en memoria, la IP nunca se guarda):
  Fly no da el país. La portada abre con lo de tu país si pesa y sigue con el mundo.
- **Difusión:** IndexNow al publicar (Bing, Yahoo, DuckDuckGo…; clave `INDEXNOW_KEY`
  generada), metaetiquetas de Search Console y Bing, botones de WhatsApp, Telegram, X,
  Facebook, LinkedIn y correo.
- Pruebas: 190 del núcleo + 2 del worker + 47/47 E2E; build correcto.

**Sin desplegar todavía**: falta que Dani autorice usar el token de Fly del PC (la
protección automática lo bloquea sin su permiso expreso).

## Bloqueos (externos: solo los puede resolver el propietario)

1. **Desplegar lo del 29-09**: permiso para usar el token de Fly (`~/.flotia-fly-token.txt`).
2. **Dominio `histor.es`**: comprado por Dani en Nominalia el 29-09-2026. Falta: `fly certs
   add histor.es` (y www) en `histor-web`, los registros A/AAAA en el DNS de Nominalia y
   `PUBLIC_BASE_URL=https://histor.es` (redespliegue).
3. **Redactor con IA**: sin él, el texto son frases de las fuentes (máx. 22 palabras cada
   una por el límite de copia) cosidas con «según X»; no se puede escribir como un
   periodista ni traducir a los 6 idiomas. Hace falta una clave de pago (Gemini de AI
   Studio con facturación, o Anthropic) y un tope mensual. La de Flota NO: es gratuita y
   Flota ya se queda sin cuota.
4. **Activar el 2FA del panel** (obligatorio en producción). Dani dice que no puede entrar
   en su usuario: revisar los registros de `histor-web` con el token.
5. **Integraciones** (todas opcionales; sin ellas se desactivan de forma explícita):
   Stripe + webhook, Resend (correo), Google/Apple, Sentry, S3/R2 para copias fuera de
   Fly, cuentas de Bluesky/Mastodon/X para publicar en redes. VAPID ya está generado.

## Pendiente (no bloqueado)

- **Traducción con IA** (`AI_PROVIDER_TRANSLATION` + clave + `AI_MONTHLY_BUDGET_USD`): sin ella
  cada noticia solo sale en el idioma de sus fuentes, por eso la portada en español
  tiene poco. Con ella, cada historia verificada sale en los 6 idiomas.

- Imágenes: desde el 27-09-2026, imagen ilustrativa del LUGAR de la noticia desde
  Wikimedia Commons (solo licencias libres, nunca personas; `media/wikimedia.ts`,
  `cli images:backfill`). Las historias solo de país no tienen (la imagen del país
  en Wikipedia es la bandera). Falta un banco propio o de agencia.
- `/.well-known/security.txt` con el contacto definitivo.
- Idiomas preparados (nl, ja, ko, ar, hi): faltan diccionario, rutas y frases.
- Búsqueda: pasar a OpenSearch/Meilisearch si el volumen lo pide.

## Próximas acciones tras desplegar

1. Activar el 2FA del panel y vigilar las primeras 48 h (Resumen, Revisión, Operación).
2. Rellenar los datos legales y, con dominio, cambiar `PUBLIC_BASE_URL`.
3. Copia fuera de Fly: bucket S3/R2 propio de Histor (no el de Flota) para `infra/backup.sh`.
4. Afinar umbrales con datos reales (el primer arranque procesa ~2.000 piezas: la
   cola tarda unos 30 min en vaciarse).
