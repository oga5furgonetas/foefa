# API de Histor (v1)

Base: `https://TU-DOMINIO/api/v1`. Respuestas JSON (`cache-control: no-store`
salvo que se indique). Errores: `{"error": "código", "message": "…"}` con el
código HTTP adecuado (400 entrada no válida, 401 sin sesión, 402 requiere
Premium, 403 prohibido/CSRF/2FA, 404, 409, 413, 429 límite de ritmo con
`retry after Ns`, 503 integración no configurada).

## Seguridad de las peticiones que cambian datos

1. `GET /api/v1/csrf` → `{"token": "…"}` y cookie `histor_csrf` (legible por el cliente).
2. Enviar el mismo valor en la cabecera `x-csrf-token`.
3. La cabecera `Origin` (o `Referer`) debe ser la de la web.

La sesión va en la cookie `histor_session` (HttpOnly, Secure, SameSite=Lax).
Límites de ritmo por IP (hash diario, nunca la IP): entrar 8/10 min, registro
5/h, recuperación 5/h, avisos 10/h, newsletter 10/h, búsqueda 60/min,
eventos 240/min, resto 300/min.

## Lectura pública

En modo DEMO estas rutas devuelven solo contenido DEMO; en producción, nunca.

| Método y ruta | Descripción |
|---|---|
| `GET /articles?lang=es&category=economy&country=ES&breaking=1&order=recent\|importance\|momentum&since=ISO&limit=20&offset=0` | lista de tarjetas (`cache-control: public, s-maxage=60`) |
| `GET /articles/{lang}/{slug}` | artículo completo: cuerpo por bloques, recuadro de verificación, fuentes, cronología, versiones, correcciones, idiomas alternativos, entidades |
| `GET /stories/{slug}?lang=es` | cronología pública de la historia: qué fuente dijo qué y cuándo |
| `GET /sources` | directorio de fuentes con tipo y fiabilidad aprendida |
| `GET /search?lang=es&q=…&category=…&offset=0` | búsqueda full-text (con respaldo por similitud en titulares) |
| `GET /recommendations?lang=es&limit=8` | «Para ti», solo con consentimiento de personalización (o cuenta con la opción) |

Ejemplo (tarjeta):

```json
{ "id": 12, "url": "/es/2026/09/27/madrid-acoge-la-feria…-3", "headline": "…", "summary": "…",
  "publishedAt": "2026-09-27T04:41:00.000Z", "categoryId": "technology", "countryCode": "ES",
  "isBreaking": false, "isDeveloping": false, "isDemo": true, "evidenceConfidence": 0.91,
  "sourcesCount": 4, "version": 1 }
```

## Cuenta

| Método y ruta | Cuerpo | Notas |
|---|---|---|
| `POST /auth/register` | `{email, password, name?, lang, country?, marketing?}` | 201; responde igual si el correo ya existe (no revela cuentas); envía verificación |
| `GET /auth/verify?token=&lang=` | | redirige a la página de entrar |
| `POST /auth/login` | `{email, password, totp?}` | `{ok, needsTotp}`; bloqueo progresivo tras 8 fallos |
| `POST /auth/logout` | `{}` | |
| `POST /auth/mfa` | `{code}` | supera el segundo factor en la sesión actual |
| `POST /auth/reset/request` | `{email, lang}` | misma respuesta exista o no |
| `POST /auth/reset/confirm` | `{token, password}` | cierra todas las sesiones |
| `GET /auth/oauth/{google\|apple}?lang=&next=` | | OIDC con state, nonce y PKCE; 404 si no está configurado |
| `GET\|POST /auth/oauth/{provider}/callback` | | Apple usa `form_post` |
| `GET /me` | | `{user: {name, email, role, …} \| null, premium}` |
| `GET /account` | | perfil sin datos sensibles |
| `PATCH /account` | `{language?, countryCode?, name?, personalization?, marketingConsent?, alertsMaxPerDay?, quietHoursStart?, quietHoursEnd?}` | |
| `DELETE /account` | `{confirm: true}` | derecho de supresión: cancela suscripciones y borra la cuenta |
| `GET /account/export` | | derecho de acceso y portabilidad: JSON descargable |
| `POST /account/totp` · `PUT /account/totp` | `{}` · `{secret, code}` | activar 2FA en dos pasos |
| `GET\|POST\|DELETE /saved/{articleId}` | | noticias guardadas |
| `GET\|POST\|DELETE /follow` | `{kind, ref}` | seguir temas, secciones, países, ciudades, fuentes |

## Suscripción y pagos

| Método y ruta | Cuerpo | Notas |
|---|---|---|
| `POST /billing/checkout` | `{interval: "month"\|"year", lang}` | `{url}` de Stripe Checkout con el precio del mercado del lector; 409 si ya es Premium; 503 sin Stripe |
| `POST /billing/portal` | `{lang}` | `{url}` del portal de cliente |
| `POST /stripe/webhook` | cuerpo crudo de Stripe | firma verificada; idempotente (`webhook_events`); 503 sin configurar |

## Newsletters, alertas y avisos

| Método y ruta | Cuerpo | Notas |
|---|---|---|
| `POST /newsletters/subscribe` | `{slug, email, lang}` | doble confirmación por correo; 402 si es Premium |
| `GET /newsletters/confirm?token=` · `GET\|POST /newsletters/unsubscribe?token=` | | baja con un clic (RFC 8058) |
| `GET /push/subscribe` | | `{publicKey}` VAPID o `null` |
| `POST /push/subscribe` · `DELETE` | `{subscription, lang, categories?}` · `{endpoint}` | |
| `POST /reports` | `{kind, articleId?, url?, description, name?, email?}` | cada aviso crea una tarea de revisión |
| `POST /events` | `{events: [{type, articleId?, path?, value?, props?}]}` | medición con consentimiento; mismo origen obligatorio |

## Panel (editor / admin)

Exigen sesión con el permiso correspondiente, 2FA superado (obligatorio en
producción) e IP autorizada si `ADMIN_IP_ALLOWLIST` está definida.

`GET /admin/metrics?hours=24` → métricas del panel.

`POST /admin/{acción}`:

| Acción | Permiso | Cuerpo |
|---|---|---|
| `story.recheck` | stories.edit | `{id}` |
| `story.block` / `story.unblock` | stories.block | `{id, reason}` / `{id}` |
| `story.retract` | articles.retract (admin) | `{id, note}` (nota pública ≥ 20 caracteres) |
| `article.correct` | articles.correct | `{id, kind: correction\|clarification\|update, headline?, paragraphs?: [{index, text}], note}` |
| `source.status` | sources.block / sources.manage | `{id, status: active\|paused\|blocked, reason?}` |
| `source.update` | sources.manage | `{id, sourceType?, ownershipGroup?, isSatire?, fetchIntervalMinutes?}` |
| `settings.editorial` | settings.manage | umbrales (ver `config/settings.ts`) |
| `settings.weights` | settings.manage | `{weights: {tipo: {weight, credible}}}` |
| `plan.update` | pricing.manage | `{id, monthlyCents?, yearlyCents?, trialDays?, active?, stripePriceMonthly?, stripePriceYearly?}` |
| `category.update` | categories.manage | `{id, enabled?, sort?, keywords?}` |
| `language.enabled` | languages.manage | `{code, enabled}` |
| `user.role` / `user.premium` | users.manage | `{id, role}` / `{id, days}` |
| `task.resolve` | reports.manage | `{id, status: done\|dismissed\|in_progress, resolution?}` |
| `experiment.create` / `experiment.stop` | experiments.manage | `{articleId, headlines}` / `{id, winner?}` |
| `pipeline.run` / `newsletters.send` | settings.manage / newsletters.manage | `{}` (encola para el worker) |

## Otras rutas

| Ruta | Descripción |
|---|---|
| `GET /api/health` | `{ok, db}`; 503 si la base no responde |
| `GET /api/metrics` | Prometheus; `Authorization: Bearer $METRICS_TOKEN` |
| `GET /api/og?lang=&slug=` | imagen 1200×630 tipográfica (nunca una foto inventada) |
| `GET /sitemap.xml`, `/sitemaps/static.xml`, `/sitemaps/articles-{lang}-{n}.xml`, `/news-sitemap.xml` | con hreflang |
| `GET /{lang}/rss.xml` | RSS por idioma |
| `GET /robots.txt` | en DEMO: `Disallow: /` |
