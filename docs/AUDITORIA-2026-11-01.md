# Auditoría completa de FDS — 01-11-2026

> Pedida por Dani el 31-10-2026 a las 23:1x: «una auditoría ultra completa, revisando todo, absolutamente todo. No
> quiero que saltes nada, ni porque sale verde en el test [...] qué podemos hacer para que la gente utilice más la app
> [...] llevo unos 5 meses o 6 con esta aplicación y aún no he facturado ni un solo euro [...] te prohíbo que me
> mientas o que me des cosas solo por contentarme [...] No quiero falsos positivos ni soluciones por decir».
>
> Este fichero se escribe CONFORME se audita (cada hallazgo, en cuanto se comprueba), para que nada se pierda. Cada
> hallazgo lleva cómo se comprobó. Lo que no se ha podido comprobar se dice tal cual. Al final: el veredicto, lo que
> se ha arreglado ya y el plan priorizado.

## Cómo se ha hecho (método)

Una sola sesión, del 31-10 a las 23:1x al 01-11 por la madrugada, desde el PC de casa de Dani (sin Mongo, sin
Docker, sin `gh`). Orden: chequeos automáticos leídos de verdad (no por el color) → inventario y lectura del
backend (los 649 endpoints por AST; los 64 públicos uno a uno; el núcleo de sesiones; escáner de riesgos sobre
los 585 autenticados) → web (lint, build, 206 pruebas de pantalla, cabeceras y rendimiento en producción desde un
móvil emulado) → app Android (manifiesto, dependencias y los 7 ficheros que importan) e iOS (App Store Connect) →
infraestructura (Fly, Mongo, Cloudflare, GitHub) → cifras reales en las consolas de Dani (Play, Search Console,
Meta) → mercado (lo que cambia respecto al informe del 29-10, con búsquedas de hoy) → arreglar lo que se podía
arreglar sin desplegar, con test, y subirlo. Cada hallazgo dice cómo se comprobó; lo que no se pudo comprobar está
marcado. Lo que el modo auto de Claude no dejó hacer (ejecutar el MongoDB descargado, Lighthouse, `fly ssh`, crear
variables en GitHub) se dice donde toca y pasa a la lista de Dani.

## 1. Entorno y chequeos automáticos

Tamaño real de lo auditado (medido con `wc`): backend 66.872 líneas de Python (`server.py` solo, **56.687**; 649
endpoints HTTP), tests del backend 22.816 líneas (119 ficheros), web 69.526 líneas en 223 ficheros JS/JSX (+7.686
de Playwright), app Android 9.234 líneas de Kotlin en 40 ficheros, 79 scripts y 8 herramientas; 489 commits desde el
25-09-2026 (350 desde el PC de Winiw, 135 de Claude, 3 de Dani).

- **Los 10 checkers del repo pasan** (`check-existe`, `huerfanos`, `marca`, `i18n` 1427 claves / 0 problemas,
  `permisos`, `modulos`, `promo`, `hooks`, `efectos`, `chunk-error`). `check-patrones` FALLABA (ver abajo).
- **ESLint: 0 errores, 21 avisos**, todos `react-hooks/exhaustive-deps`. La mayoría es la función `t` de traducción
  fuera de la lista de dependencias (inofensivo). Cuatro no lo son y se revisan en §3: `Configuracion.jsx:97`
  (`filas`), `Talleres.jsx:435` (`coords`, `fetchNearby`, `geoState`), `Vehiculos.jsx:172` (`cancel`),
  `Turnos.jsx:938`.
- **`vite build`: ok en 9,5 s**. Trozos grandes: `Vehicle3DViewer` 1.012 kB (three.js; se carga al abrirlo),
  `MiRuta` 326 kB, `textosRuta` 301 kB (los 7 idiomas de la app de reparto en UN trozo), `i18nDict` 288 kB (los 6
  idiomas del panel en UN trozo), `index` 225 kB. Para un repartidor con 4G, cada idioma que no es el suyo es peso
  muerto: ver §3.
- **Tests del backend sin Mongo: 1.365 pasan** (11 min 45 s en este PC).
- **Tests de API con Mongo (`test_api.py`)**: en este PC no hay MongoDB ni Docker; descargué el MongoDB 7.0.45 oficial
  (hash verificado contra el manifiesto de MongoDB) pero el modo auto de Claude no me dejó ejecutarlo («código
  externo») y no lo he rodeado. **Se cubren con el CI de GitHub**, que levanta `mongo:7` en cada push (run 41248148236
  y siguientes).
- **El CI de `main` llevaba EN ROJO desde las 19:24 del 31-10** (commit `fa554aa`): `check-patrones.mjs` marcaba
  `backend/cuadrante_motor.py:712` (división por `len(lunes)` sin guarda). La lista no puede estar vacía ahí (con una
  sola semana se vuelve antes), así que no era un bug, pero el CI estaba rojo y **el backend se desplegó esa noche
  con el CI en rojo sin que nadie lo supiera**: `deploy-backend.ps1` NO corre ni los tests ni los checkers antes de
  desplegar (solo `fly deploy` y `/api/health`), y `deploy-frontend.ps1` solo `check-hooks`. La regla «nada se
  despliega en rojo» solo la cumple GitHub, no los scripts del PC. Arreglado el síntoma (commit `3e03a1c`, CI verde);
  la causa (los scripts del PC no miran el CI) va en el plan.
- **El flujo de iPhone (`app-ios.yml`, runner de macOS, el más caro de GitHub) se lanza con cualquier push que toque
  `frontend/src/**` o `frontend/public/**`**, aunque sea un texto de la web. Cada push a `main` con un cambio de web
  compila la app de iPhone entera. Gasto de minutos de Mac sin sentido: ver §5.
- **`uptime.yml` existe pero no vigila nada**: el trabajo solo corre si la variable `BACKEND_URL` del repositorio está
  puesta, y no lo está (el run 41248006828 salió `skipped`). Producción no tiene vigilancia externa. Ver §5.

## 2. Backend (`backend/`)

**Cómo se ha mirado.** Inventario por AST de los 649 endpoints (`$T/inventario_endpoints.py`): 416 con
`require_admin`, 88 `require_any_auth`, 53 `require_superadmin`, 23 `get_current_user`, 10 `require_plataforma`,
**64 sin ninguna dependencia** (públicos o con autenticación a mano). Leídos UNO A UNO los 64 públicos (2.826 líneas),
el núcleo de sesiones (`create_token`, `decode_token`, `get_current_user`, `require_*`, los límites por IP), la
cabecera de seguridad, el CORS y el proxy de base por empresa (`_TenantDBProxy` + `set_current_org_db`). Sobre los
585 autenticados, un escáner por patrones (`$T/escaner_riesgos.py`: acceso directo a otra base con `client[...]`,
`org_id`/`db_name`/`slug` que llegan del cliente, `subprocess`, borrados masivos, filtros de Mongo que vienen del
cliente, escrituras en la base global) y lectura de los 14 que saltaron; y los 7 endpoints de conductor cuyo código
no mira quién pregunta.

**Lo que está bien (y es mucho).** Contraseñas con bcrypt; JWT HS con caducidad (72 h panel, 30 días conductor y
repartidor); la base manda sobre el token (un admin borrado o con permisos cambiados lo nota en ≤60 s); demo de solo
lectura bloqueada en el propio `get_current_user`; límites por IP y por usuario en todos los logins con pausa de 0,8 s
y aviso por Telegram; webhooks de Lemon Squeezy y Stripe que FALLAN CERRADOS sin secreto, verifican firma y son
idempotentes por índice único; el importe cobrado se contrasta con el pedido; la empresa se fija a mano en cada
endpoint sin sesión (el «gotcha 26» está en todas partes); `/docs` y `/openapi.json` cerrados en producción; cabeceras
HSTS/nosniff/DENY; CORS cerrado a la web propia (+ `capitalor://localhost` para el iPhone); registro de toda escritura
(30 días) sin cuerpos; la clave de firma nunca en el código; nada de `subprocess`/`eval`/`pickle`.

**Hallazgos.**

- 🔴 **FUGA ENTRE EMPRESAS (arreglada): `GET /api/auth/conductor-list`** exigía admin pero aceptaba `?slug=` y con él
  cambiaba de base sin comprobar de quién era: cualquier cuenta (las de prueba se crean solas en `/registro`) podía
  listar id, nombre, correo y centro de la plantilla de OTRA empresa sabiendo su slug, que es público (`/empleo/<slug>`,
  `/api/auth/org/<slug>`). Encontrado por el escáner («slug del cliente» en un endpoint con sesión). La web ya no lo
  usa (`grep` en `frontend/src`: 0 usos). Arreglo: el slug solo vale si es el de la propia empresa (o el super-admin);
  test `test_conductor_list_no_cambia_de_empresa_por_slug` en `test_api.py` (lo corre el CI con Mongo). Lo que NO sé:
  si alguien lo explotó; el registro de escrituras (`audit_requests`) solo guarda POST/PUT/PATCH/DELETE y esto es GET,
  así que no hay rastro posible.
- 🟡 **7 endpoints con `require_any_auth` que no miran quién pregunta** (un conductor obtiene lo mismo que la oficina,
  siempre dentro de SU empresa): `/inspections/{id}/forensic` (estado del peritaje de cualquier inspección de la
  empresa), `/push/unsubscribe` (podría dar de baja el push de otra persona si conociera su endpoint), `/vehicles/{id}/odometer-photo`
  (OCR del cuentakilómetros para cualquier vehículo), `/vehicles/plate/{plate}/provider-info` (datos del proveedor
  por matrícula), `/parts/search`, `/push/vapid-key`, `/tienda/prendas/{id}/foto` (estos tres, inofensivos). Riesgo
  bajo; conviene acotar los dos primeros al propio conductor.
- 🟡 **`/auth/reset-password` admite contraseñas de 6 caracteres; `/auth/register` exige 8.** Inconsistente: la
  recuperación es la puerta débil.
- 🟡 **Los límites por IP viven en memoria del proceso** (`_login_fails`, `_public_actions`): con UNA máquina en Fly
  funcionan, pero se vacían en cada despliegue, y `_public_actions` no borra claves vacías (crece una entrada por IP
  que haya tocado un endpoint público; se limpia solo al redesplegar). Bajo.
- 🟡 **El token de mantenimiento (`humo.py`) se fabrica con `SECRET_KEY` y entra como admin del dueño** saltándose la
  comprobación de existencia en base (`sub == "maintenance-claude"`). Es por diseño, pero significa que la clave de
  firma de producción tiene que estar en el PC desde el que se despliega para que la prueba de humo funcione (en este
  PC no está, y por eso `humo.py` nunca ha corrido aquí). Mejor: un token de mantenimiento de solo lectura emitido por
  el propio servidor con caducidad, o una llave aparte.
- 🟡 **Datos personales sensibles en claro**: el DNI/NIE de cada candidato de empleo se guarda tal cual en Mongo
  (`candidatos.dni`), y los CV van a R2 con URL pública permanente (`R2_PUBLIC_URL/cv/...`). El volumen de Fly va
  cifrado en reposo, pero el acceso por enlace no caduca nunca. Es el punto 7 de «Pendiente» de ESTADO desde
  septiembre, y sigue abierto (ver §5, R2).
- 🔴 **Bug de medianoche en «la inspección de hoy» (arreglado en las dos comprobaciones que importan)**: las marcas
  `created_at` se guardan en UTC y el día de negocio va en hora local, pero 15 sitios comparaban la FECHA UTC de la
  marca con el día local (`{"$regex": f"^{today}"}`): entre las 00:00 y la 01:00 de Madrid (02:00 en verano) la
  inspección recién subida «no era de hoy»: la app dejaba repetirla y `already_inspected` salía False. Lo delató la
  prueba de contrato del CI, que falló en los cuatro runs de esta noche entre las 00:06 y las 00:34 (hora de Madrid)
  y había pasado a las 23:52. Arreglado con `_rango_dia_negocio()` (el tramo del día local pasado a UTC) en
  `assigned-vehicle` y en `inspections/upload`, con 3 tests; **quedan 13 sitios con el mismo patrón** (informes por
  día, salud de la flota, calendario: líneas 15448-29463 de `server.py`) que hay que pasar al rango en una tanda
  aparte, con sus tests.
- 🟢 Tokens de conductor: todos los `create_token` llevan `db_name` (revisados los 8 sitios); el único sin empresa es
  el de mantenimiento, que cae en la base del dueño a propósito.

## 3. Web y panel (`frontend/`)

**Cómo se ha mirado.** ESLint (0 errores, 21 avisos revisados uno a uno), `vite build`, la prueba de humo de
Playwright en escritorio (**206 pruebas, todas pasan**, 1,3 min: todas las pantallas con la API simulada), las
cabeceras y redirecciones de producción con `curl`, y producción medida desde un Pixel 7 emulado con 4G acotada
(9 Mbps, 150 ms, CPU ×4) con Chromium de Playwright (`e2e/medir-produccion.mjs`; PageSpeed Insights agotó su cuota
pública y Lighthouse no se pudo instalar: el modo auto lo bloqueó).

| Página | TTFB | FCP | LCP | Peso | Peticiones | Tareas largas |
|---|---|---|---|---|---|---|
| `/` (portada) | 90 ms | 544 ms | **1,25 s** | **971 kB** (40 scripts, 1 vídeo) | 54 | 135 ms |
| `/planes` | 110 ms | 692 ms | 1,19 s | 160 kB | 16 | 117 ms |
| `/registro` | 87 ms | 700 ms | 0,98 s | 193 kB | 22 | 110 ms |
| `/repartidores` | 95 ms | 520 ms | 1,11 s | 346 kB | 30 | 122 ms |

Veredicto de rendimiento: bien (LCP por debajo de 2,5 s en todas, sin saltos de maquetación). La portada pesa casi
1 MB por el vídeo y 40 ficheros JS: en un móvil con datos es lo primero que se recorta.

**Hallazgos.**

- 🔴 **`http://flotadsp.com` se sirve EN CLARO con 200** (la página entera, 6,9 kB), sin redirigir a `https`, y la
  web no manda `Strict-Transport-Security` (la API sí). Quien teclee el dominio sin `https`, o abra un enlace
  antiguo, puede acabar en el login sin cifrar. Arreglo: en Cloudflare, SSL/TLS → Edge Certificates → «Always Use
  HTTPS» y HSTS (un clic de Dani); y, en el repo, el Worker del dominio redirige y `_headers` lleva HSTS (hecho en
  esta auditoría, pendiente de desplegar).
- 🟡 **Los 21 avisos de ESLint no son bugs**: 17 son `t` (traducción) fuera de las dependencias; `Configuracion.jsx:97`
  carga una vez al abrir (a propósito), `Talleres.jsx:435` re-busca solo al cambiar filtros (a propósito),
  `Vehiculos.jsx:172` cierra con Escape sobre el valor de cuando se abrió (inofensivo), `Turnos.jsx:938` recalcula al
  cambiar una referencia (a propósito). Conviene dejarlos silenciados con comentario para que un aviso nuevo se vea.
- 🟡 **Dependencias con avisos de seguridad (`npm audit --omit=dev`)**: 6 (3 altas, 3 moderadas): `react-router`
  (redirección abierta por barra invertida en `<Link>`/`useNavigate`, CVE-2025-68470: SÍ afecta a una SPA),
  `axios` (dos de proxy/SSRF, en navegador no aplican), `follow-redirects` y `form-data` (dependencias de Node de
  axios, no van al navegador), `fflate` vía `three-stdlib` (bucle infinito con un ZIP64 malformado: la web no abre
  ZIP). Todas tienen arreglo con `npm audit fix` (sin cambios de versión mayor).
- 🟡 **Un trozo con los 7 idiomas de la app de reparto (301 kB) y otro con los 6 del panel (288 kB)** se bajan
  enteros aunque el móvil solo use uno. Partirlos por idioma ahorra ~250 kB a cada repartidor.
- 🟢 Cabeceras de seguridad de la web en orden: CSP cerrada (`default-src 'self'`, sin `unsafe-eval`),
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `www` → 301 a la raíz; `robots.txt`
  y `sitemap.xml` (22 URL) servidos por funciones; títulos y `h1` propios por página.

## 4. App Android e iOS (`app-android/`, `frontend/ios/`)

**Cómo se ha mirado.** Manifiesto, `build.gradle.kts`, dependencias, y leídos `Api.kt`, `Cuenta.kt`,
`EnvioWorker.kt`, `Repositorio.kt`, `MainActivity.kt`, `Fcm.kt` y `Actualizacion.kt` (≈1.500 de las 9.234 líneas).
La 2.4.2 corrió en el emulador esta noche (aviso de actualización, auditoría con fotos). Lo que NO se ha podido:
un móvil físico.

**Lo que está bien.** Permisos mínimos y explicados (cámara, ubicación solo en uso, sin ubicación en segundo
plano, `FOREGROUND_SERVICE` quitado a propósito); `allowBackup=false` y la sesión fuera de la copia de Google; token
en el almacén privado y renovado solo al usar la app; la cola de entregas sin red va en orden, con reintentos
exponenciales por WorkManager y aviso a la persona cuando el servidor rechaza algo (12 reintentos ante 5xx);
detecta las wifis cautivas (HTML con 200) como «sin red»; R8 activado; firma v2/v3 comprobada en el CI; la
actualización in-app (Play) y por aviso (web) funcionan (probado anoche en el emulador); FCM opcional, con la
bandeja cada 15 min como respaldo; analítica anónima con sesión que muere con el proceso.

**Hallazgos.**

- 🔴 **La app de iPhone (2.4.1, build 9) está RECHAZADA por Apple desde el 31-10 a las 18:18** («Guideline 2.1 —
  Information Needed»), y ESTADO decía «enviada, nada pendiente hasta que Apple conteste». Apple pide un vídeo
  grabado en un iPhone físico (con el borrado de cuenta), cuentas de prueba de cada tipo, descripción, servicios
  externos y diferencias por región. Lo que hay que contestar está escrito, listo para pegar, en
  `docs/APP_STORE.md` → «RECHAZADA la 2.4.1». Dani no tiene iPhone: el vídeo lo tiene que grabar alguien con uno.
- 🟡 **Sin medición de fallos**: no hay Crashlytics, Sentry ni equivalente (confirmado en `build.gradle.kts`); lo
  único son los «Android vitals» de Play (hoy 0 fallos en ~25 móviles, poco dato). El servidor sí registra los
  errores de la web (`/client-error`), pero un fallo de Kotlin muere en silencio. Con 25 móviles se puede vivir;
  con 500 no.
- 🟡 **El 75 % de la base instalada seguía en el code 3** (la TWA del 4-10, canal alfa) según ESTADO del 30-10: Play
  solo los actualiza si están en la misma pista. Comprobar en Play Console → Estadísticas → por versión que la
  2.4.2 llega a todos; si no, pedirles reinstalar.
- 🟡 **Contraseña de conductor: mínimo 6 caracteres** en el portal web, en la app y en el panel (7 sitios
  coherentes entre sí); el alta de empresa pide 8 y, desde hoy, la recuperación también. Subir a 8 a los
  conductores es un cambio de producto (7 textos en 6 idiomas + Kotlin): decisión de Dani.
- 🟢 Sin `cleartext` en release (HTTP solo en la variante de pruebas), sin claves en el código (FCM y API entran al
  compilar), `queries` del manifiesto solo para Maps/Waze/WhatsApp/llamar.

## 5. Infraestructura y operación (Fly, Mongo, Cloudflare, GitHub)

- **Fly**: `flota-backend` = UNA máquina `shared-cpu-1x`, 1 GB, en `cdg` (París), `--ha=false`; `flota-mongo` = UNA
  máquina `mongo:7.0` con un volumen de 3 GB cifrado (23-10-2026), sin réplica. Un fallo del host de cualquiera de
  las dos deja la app caída hasta que Fly la relance (minutos a horas). Para 100 usuarios es asumible si (a) las
  copias en R2 funcionan y se prueban, (b) hay vigilancia que avise. Ver abajo.
- **Vigilancia externa: NO HAY**. `uptime.yml` solo corre si la variable `BACKEND_URL` del repositorio está puesta
  (no lo está); la caída de 31 h del 17-10 (Atlas) y la de 2 h 26 min del 20-08 se descubrieron a mano. Arreglo:
  poner `BACKEND_URL` y `FRONTEND_URL` en Settings → Variables del repo (1 minuto de Dani), o un servicio gratuito
  tipo UptimeRobot/Better Stack apuntando a `/api/vivo` y a la web, con aviso al móvil.
- **Dependencias del backend con avisos (`pip-audit`)**: `starlette 0.37.2` (14 avisos, p. ej. DoS por
  multipart → 0.40+), `python-multipart 0.0.29` (6), `pymongo 4.5.0` (7), `aiohttp 3.13.5` (36), `Pillow 12.2.0`
  (64 → 12.3.0; procesa las fotos que suben conductores y talleres SIN sesión), `python-jose 3.5.0` (1, sin
  arreglo publicado) y `ecdsa 0.19.2` (2, sin arreglo; viene con python-jose). Plan: subir fastapi/starlette,
  python-multipart, pymongo/motor, aiohttp y Pillow y pasar los 1.365 tests + el CI; cambiar `python-jose` por
  `PyJWT` (sin `ecdsa`) en una tanda aparte.
- **El flujo de iPhone se compila en cada push que toca la web** (`app-ios.yml`, `paths: frontend/src/**`): minutos
  de macOS (10× el precio de Linux) por cambios de texto. Mejor: solo a mano o por etiqueta de versión.
- **Cloudflare**: la web va por el Worker `flota-dominio` → Pages `flota`; sin «Always Use HTTPS» (§3); R2
  `flotadsp-uploads` en la cuenta de WINIW (no de Dani) con el dominio público `pub-…r2.dev` (pensado por
  Cloudflare para desarrollo, con límites de tráfico; un dominio propio exige que el bucket esté en la misma cuenta
  que el dominio). Desde este PC no se llega a las IP de r2.dev (puerto 443 cerrado para esa red): **no he podido
  comprobar que las fotos carguen**; la demo pública no tiene fotos. Prueba para Dani: abrir una foto de una
  inspección desde el móvil con datos (no wifi) y desde la wifi de casa.
- **Copias de seguridad**: existen en código (`copias_r2`, `ledger_copias`, `vigilante_bd` con tests) hacia R2
  (cuenta de Winiw). No he podido ver desde aquí la fecha de la última copia ni probar una restauración (sin
  acceso a la base ni a la máquina). Es lo primero que yo haría con Dani delante: restaurar la copia de anoche en
  una base `prueba_*` y contar documentos.

## 6. Uso real en producción (agregados, sin datos personales)

**Sin acceso a la base desde este PC** (el Mongo de Fly es de red privada y la cadena está en el PC de Winiw), lo
medido sale de las consolas de Dani (leídas en su Chrome, solo lectura) y de la última medición con base del 23-10.

- **Google Play** (consola, 4-30 oct): móviles con la app instalada **de 1 a ~25** en el mes (España la mayoría;
  Lituania ~3, Francia y Turquía testimoniales); **0 fallos y 0 ANR** en 28 días; **0 valoraciones**; la 2.4.2
  publicada ayer con 18 descargas en sus primeras horas.
- **Google (Search Console, 90 días)**: 117 clics, 1.040 impresiones, posición media 7,9, CTR 11 %. De los 117
  clics, 41 son la marca («flotadsp», «flota dsp») y casi todo lo demás son ofertas de empleo locales («repartidor
  vigo», «empleo ourense»). «ruta de reparto»: 6 impresiones, 0 clics. Las guías SEO (`/guia-*`) no aparecen.
  Google trae ~1 visita al día y ninguna de alguien buscando el producto.
- **Meta Ads** (gestor, 1 may → 31 oct): **la cuenta está RESTRINGIDA por un pago fallido: los anuncios no se
  publican**. Gasto visible: **358,88 €** en 12 campañas. La única que trajo altas medibles: «FDS Registros — Gratis
  15 paradas» (10-10): **69 registros a 1,34 €** (92,32 €). «Promoción del sitio web»: 1.014 visitas a 0,14 €
  (141,55 €) sin registros atribuidos; «Alta 7 días gratis»: 364 visitas (56,56 €); «Lead ES+PT»: 1 lead a 10,96 €.
  TikTok (PLAN-1000): 203 € y 0 altas. Total visible ≈ 560 € más bonos (25 €/10 €) y lo que haya en otras cuentas o
  plataformas: Dani habla de 1.000-2.000 €; la diferencia no la veo desde aquí.
- **Embudo** (PLAN-1000, 23-10, la última medición con base): 32 autónomos reales + 2 empresas de mensajería; de 32:
  13 vuelven otro día → 9 meten paradas suyas → 6 entregan algo → **0 hacen un día real de reparto**. 18 de 32 no
  vuelven nunca tras el día del alta. Hoy Dani habla de «100 personas»: no lo he podido contar (Negocio → «Cómo va el
  negocio» lo da en un clic).
- **Facturación: 0 €** en 5-6 meses (dato de Dani). Lo único que ha entrado por caja es la tienda de ropa de la
  propia nave.
- **Lo que no he podido medir**: usuarios activos de verdad (DAU/WAU), retención por cohorte, uso por pantalla en
  OGA5 (la flota de Dani, el único cliente real), tiempos de respuesta por endpoint. Lo da `tools/metricas/` donde
  haya `MONGO_URL`, o `/api/admin/activacion` con sesión de super-admin.

## 7. Mercado, competencia y crecimiento

Esto NO repite `docs/ESTRATEGIA-29-10.md` (402 líneas, de hace tres días, con fuentes: sigue valiendo casi entero).
Va a lo que ha cambiado y a lo que aquella no decía.

**Comprobado hoy (fuentes en §9).**
- Precios de referencia 2026: Fleetio 4-7 $/vehículo/mes; Whip Around 5 $ (Standard) y 9 $ (Pro); el software de
  inspección de flotas se mueve entre 3 y 50 $/vehículo/mes; WeProov (Francia, el más parecido en «inspección con
  foto + IA») no publica precio (packs de créditos; terceros lo sitúan en 25-75 $/mes); Pulpo (antes Pulpomatic,
  Madrid, 14 países, ronda de 8,1 M€) «desde 5 $» sin base clara. **El precio de Flota (5/9 €) está en mercado: el
  precio no es el problema.**
- DeCA: es para el transporte PÚBLICO de mercancías (por cuenta ajena) y exime a los vehículos de hasta 2 t de MMA;
  el reparto por cuenta propia y los autónomos con furgoneta pequeña casi seguro quedan fuera. La idea «DeCA desde la
  ruta» (A5 del 29-10) se cae salvo que la gestoría diga lo contrario.
- Conversión de referencia 2026: prueba gratis sin tarjeta 4-6 % («bien») a 10-15 % («muy bien»); con tarjeta ~30 %;
  freemium 3-5 % de los activos; 90-180 días hasta el primer pago. **La cuenta del autónomo no sale a este tamaño:**
  100 cuentas × 5 % × 9,99 € = 50 €/mes, y hoy hay 0 días reales de reparto. El B2C es embudo, no caja.
- Amazon DSP en España: no hay cifra pública de cuántas DSP hay; Amazon tiene ~4.800 empleados fijos en España y
  en 2025 metió 300 furgonetas Stellantis y 100 eléctricas en la red de socios; una DSP tiene 20-40 furgonetas y
  30-70 conductores (folleto de Amazon). Hera cobra en EE. UU. 9 $/conductor/mes por lo que Flota ya hace.
- Ventas en SaaS vertical: los primeros 10-30 clientes los cierra el fundador en persona, y «cada conversación es
  investigación» (consenso de las fuentes de 2026; ninguna da un atajo).

**Lo que la auditoría añade al informe del 29-10 (el «siguiente nivel»).**

1. **Dani tiene una ventaja que ninguna app de rutas tiene: ES una DSP.** 68 conductores en el cuadrante de OGA5,
   tres naves, furgonetas de renting, golpes, ITV, altas y bajas cada semana. Flota existe porque resuelve SU
   operación. Eso es exactamente lo que un dueño de DSP, de una mensajería o de una flota de furgonetas compra:
   «lo uso yo cada día con 68 personas» vale más que cualquier anuncio. Hoy ese argumento no aparece en ninguna
   página ni en ningún correo.
2. **La necesidad que ya existe y que nadie está cobrando: los golpes del renting.** Al devolver una furgoneta de
   renting o alquiler, la franquicia por daños va de 1.250 a 2.000 € por vehículo (National, 2026) y la empresa de
   alquiler cobra por «matriz de daños» salvo que el cliente pruebe que el daño ya estaba. Una DSP con 30 furgonetas
   rota flota cada 3-4 años: cada devolución sin fotos fechadas es dinero. Flota ya tiene inspección con foto, IA de
   daños, «quién causa los golpes» y peritaje con cadena de custodia (`/verify`): es el único módulo con un
   **retorno en euros calculable** (una franquicia evitada paga más de 10 años de Pro de esa furgoneta). Se vende
   como «la prueba que te ahorra la franquicia», no como «gestión de flotas con IA».
3. **El uso diario viene de la obligación, no de la motivación.** Lo que hace que 68 conductores abran la app cada
   mañana en OGA5 es que la inspección es OBLIGATORIA para coger la furgoneta (y la oficina lo ve). Ese es el
   mecanismo de retención: el jefe de nave exige la foto; el conductor la hace; la oficina tiene la prueba. En el
   autónomo no hay jefe, y por eso nadie vuelve. Primero clientes con jefe.
4. **Un solo producto en la calle: Flota para empresas con furgonetas (DSP, mensajería, reparto, servicio
   técnico).** FDS (autónomo) se queda viva, gratis, sin anuncios ni más desarrollo: es la puerta de entrada de los
   conductores que un día cambien de empresa y el escaparate en Play. Reparto (súper/distribución) solo si un
   cliente lo pide con contrato delante.
5. **Vender a mano, de uno en uno, con Dani delante.** Diez conversaciones con dueños de DSP y de mensajerías que
   Dani conoce (las naves de al lado, los grupos de WhatsApp de DSP, el delivery partner manager de Amazon que lo
   conoce), demo de 15 minutos con SUS datos (importar su Excel de furgonetas y conductores en la llamada), 45 días
   gratis con objetivos escritos, precio congelado 24 meses. Sin anuncios hasta tener 3 de pago. Es lo que dicen
   todas las fuentes de 2026 sobre SaaS vertical, y lo que un fundador que es del sector hace mejor que nadie.
6. **Lo que hay que arreglar ANTES de la primera llamada** (porque la primera pregunta de un dueño de DSP será «¿y
   mis datos?»): el plan A-G de Amazon (abierto desde el 24-09), las fotos y CV en un bucket público de otra cuenta
   (§5), «Always Use HTTPS», vigilancia que avise, copias probadas, y la fuga de plantilla que cerré esta noche.
   Nada de eso lo ve un cliente; todo lo pregunta.

## 8. Veredicto, lo arreglado y el plan priorizado

### El veredicto, sin adornos

**Técnica.** El producto está mucho mejor hecho de lo que cabría esperar de cinco semanas y 489 commits: 1.365
tests, 206 pruebas de pantalla, 10 checkers propios, aislamiento por empresa cuidado en cada endpoint sin sesión,
límites por IP en todo lo público, webhooks firmados e idempotentes, una app nativa correcta. He encontrado y
cerrado UNA fuga real entre empresas (nombre y correo de la plantilla), un retroceso posible del APK de la web, la
web en claro por http, y dependencias con avisos de seguridad; y he encontrado sin poder cerrar desde aquí: la
vigilancia que no vigila, las fotos y los CV en un bucket público de otra cuenta, una sola máquina sin réplica, y
un rechazo de Apple que llevaba un día sin que nadie lo viera. **Nada de esto explica los 0 €.**

**Negocio.** Los 0 € no son un problema de producto ni de precio. Son de a quién se vende y cómo. El dinero y el
tiempo se han ido a captar repartidores autónomos de uno en uno con anuncios (1,34 € por alta en el mejor caso,
0 días reales de reparto, 0 pagos) para un producto de 9,99 €/mes que compite con Spoke y Circuit, mientras el
producto que Dani usa cada día con 68 personas (Flota) no tiene ni una página de venta, ni una llamada hecha a un
dueño de DSP, ni el argumento «lo uso yo» escrito en ningún sitio. En el repo hay cuatro productos y medio; la
calle solo ha visto el más débil. Y el único módulo con un retorno en euros que un cliente puede calcular en una
servilleta (la prueba fotográfica que evita la franquicia del renting) está dentro, sin nombre y sin precio propio.

### Lo arreglado esta noche (todo subido a `main`, nada desplegado en producción salvo los secretos de la 2.4.2)

| Qué | Dónde | Commit |
|---|---|---|
| La web ya no puede retroceder al APK 1.0.3: la versión se lee del propio APK y los despliegues (PC y GitHub) se niegan a coser uno más viejo que el de producción; el APK viejo, fuera del repo | `scripts/apk_version.py`, `deploy-frontend.ps1`, `desplegar.yml`, 6 tests | `1228e82` |
| CI de `main` en verde otra vez (llevaba en rojo desde las 19:24) | `cuadrante_motor.py` | `3e03a1c` |
| **Fuga entre empresas cerrada** (`/auth/conductor-list` con slug ajeno), con test de API | `server.py`, `test_api.py` | `91f9028` |
| Siempre HTTPS: el Worker redirige `http://` y manda HSTS; la web también (pendiente de desplegar) | `infra/web-dominio/worker.js`, `_headers` | `9b7cd23` |
| Los despliegues del PC miran el CI de GitHub antes de subir nada (`-SinCI` a sabiendas) | `scripts/ci-verde.ps1`, los dos `deploy-*.ps1` | `d0076db` |
| El flujo de iPhone ya no se compila (ni sube una build a Apple) con cada texto de la web | `app-ios.yml` | `d0076db` |
| Peritaje solo de la propia inspección para un conductor; baja de push solo de la propia; recuperación de contraseña a 8 como el alta (servidor y web en 6 idiomas) | `server.py`, `ResetPassword.jsx`, `i18nDict.js` | `d0076db` |
| Dependencias de la web sin avisos (`npm audit fix`) y del backend al día (fastapi/starlette, pymongo, aiohttp, Pillow, python-multipart), con los 1.365 tests pasados en un entorno aparte | `requirements.txt`, `package.json` (+axios fijo en 1.17.0: 1.21 rompe los POST) | `292a55f`, `05c2b75` |
| El bug de medianoche de «la inspección de hoy» (repetible entre las 00:00 y la 01:00; el CI fallaba cada noche a esa hora), con 3 tests; el candado del CI admite un commit de solo documentos encima | `server.py` (`_rango_dia_negocio`), `ci-verde.ps1` | `49aaa82` |
| El texto para contestar a Apple, listo para pegar | `docs/APP_STORE.md` | `292a55f` |
| Medidor de producción desde un móvil emulado | `frontend/e2e/medir-produccion.mjs` | `292a55f` |

### Lo que solo puede hacer Dani (una hora en total, por orden)

1. **Cloudflare → flotadsp.com → SSL/TLS → Edge Certificates → «Always Use HTTPS» ON y HSTS ON** (2 minutos). El
   Worker ya redirige en el repo, pero hasta que se despliegue la web/Worker, el panel de Cloudflare es lo que vale.
2. **GitHub → Settings → Secrets and variables → Actions → Variables**: `BACKEND_URL = https://flota-backend.fly.dev`
   y `FRONTEND_URL = https://flotadsp.com` (1 minuto). Desde ese momento GitHub mira producción cada hora y manda
   correo si cae. (Mejor aún: UptimeRobot gratis con aviso al móvil, 10 minutos.)
3. **Meta**: pagar lo pendiente o cerrar la cuenta de anuncios. Hoy está restringida y no publica nada; si la
   decisión es parar los anuncios (recomendado), que sea una decisión y no un impago.
4. **Apple**: grabar el vídeo en un iPhone (alguien de confianza con TestFlight), crear dos cuentas de prueba, pegar
   las notas de `docs/APP_STORE.md` y reenviar. O decidir que iPhone espera (recomendado: espera hasta tener
   clientes de pago; la web funciona en iPhone).
5. **Desplegar** lo de esta noche cuando quiera (backend y web): `.\scripts\deploy-backend.ps1` y
   `.\scripts\deploy-frontend.ps1` (ahora exigen CI verde y árbol limpio). O decirme «despliega» y lo hago.
6. **Amazon, plan A-G** (`docs/REVISION_LEGAL.md`): sí o no. Lleva abierto desde el 24-09 y bloquea vender Flota a
   cualquier DSP.
7. **R2**: crear un bucket en SU cuenta de Cloudflare con dominio propio (`fotos.flotadsp.com`), mover los objetos y
   cambiar `R2_*` en Fly; después, enlaces firmados desde la API. Un fin de semana con alguien que lo haya hecho (o
   yo con su sesión de Cloudflare delante). Hasta entonces, quien tenga un enlace a una foto o a un CV lo abre para
   siempre.
8. **Dejar una cuenta de super-admin de solo lectura para auditar** (o un pase de 72 h cuando toque): sin eso
   nadie puede medir uso real desde fuera del PC de Winiw.

### El plan (lo que yo haría, en este orden, con sus puertas)

**Semana 1-2 — cerrar la casa y la primera llamada.**
- Desplegar lo de esta noche. Variables de uptime. HTTPS. Decidir Amazon. Restaurar una copia de seguridad en una
  base `prueba_*` y contar documentos (si esto falla, nada más importa).
- Escribir en UNA página (`/flota` o `/empresas`) lo que Flota hace para una DSP/mensajería contado por quien la usa
  con 68 conductores: inspección obligatoria con foto cada mañana, golpes con quién y cuánto, prueba para el
  renting, cuadrante que se hace solo, vencimientos, incorporaciones. Precio: 9 €/furgoneta, 45 días, congelado 24
  meses a los 10 primeros. Sin «IA» en el titular.
- Lista de 20 nombres: dueños de DSP y mensajerías que Dani conoce o puede conocer en una semana (naves vecinas,
  grupos de WhatsApp de DSP, proveedores de renting, el DPM de Amazon). Diez llamadas. Objetivo: 3 demos.
- **Puerta:** si en dos semanas no hay 3 demos agendadas, el problema es la red de contactos y hay que buscar canal
  (asociaciones de transportistas, el proveedor de renting como prescriptor), no producto.

**Semana 3-6 — tres pilotos.**
- Cada piloto: importar SU Excel en la llamada, sus conductores dentro el lunes, inspección obligatoria desde el
  primer día (el jefe la exige), un informe el viernes con lo que la app ha visto (fotos, golpes nuevos,
  vencimientos). Soporte por WhatsApp de Dani.
- Producto SOLO lo que los pilotos pidan y esté a un día de trabajo. Lo demás, no.
- **Puerta:** 3 pilotos con inspecciones diarias reales a las 4 semanas. Si no, el uso diario no está y hay que
  entender por qué antes de vender a nadie más.

**Semana 7-12 — cobrar.**
- Convertir los pilotos a pago (Stripe ya está): objetivo 3 clientes × 20 furgonetas × 9 € = 540 €/mes. Es poco
  dinero y es el primer dinero: vale más que 1.000 altas.
- Con 3 de pago: caso de éxito con cifras (franquicias evitadas, golpes atribuidos, horas de cuadrante), nota de
  prensa local, y entonces sí, anuncios dirigidos a dueños de flotas (LinkedIn/Meta, 15 €/día) con la página nueva.
- Técnica en paralelo (sin tocar lo que funciona): crash reporting en la nativa, R2 propio con enlaces firmados,
  segunda máquina de Fly (`--ha`), `python-jose` → `PyJWT`, partir `server.py` por dominios cuando haya que tocar
  un dominio entero.

**Qué NO hacer (hasta tener 3 clientes de pago).** Anuncios al autónomo. Más idiomas, más países, más pantallas.
iPhone. Tienda, mercadillo, casas, Valor (fuera del repo cuando haya un hueco). Bonos de 25 €. Promociones
superpuestas. Cualquier cosa que no venga de un piloto.

**Las tres cifras que mandan.** Empresas en piloto con inspecciones diarias reales (0 → 3). Euros facturados
(0 → 540 €/mes). Conductores de empresa que abren la app cada día laborable (68 de OGA5 → 150).

## 9. Fuentes consultadas el 01-11-2026

- Fleetio / Whip Around: [Capterra Whip Around pricing](https://www.capterra.com/p/148935/Whip-Around/pricing/),
  [PricingSaaS](https://pricingsaas.com/companies/whiparound), [SelectHub](https://www.selecthub.com/p/fleet-maintenance-software/whip-around/),
  [G2 Fleetio vs Whip Around](https://g2.com/compare/fleetio-vs-whip-around-whip-around)
- WeProov: [Capterra](https://www.capterra.com/p/186215/WeProov/), [Softwarefinder](https://softwarefinder.com/fleet-management-software/weproov),
  [WeProov Fleet](https://www.weproov.com/en/weproov-fleet-inspection-app); guía de precios de inspección 2026: [Heavy Vehicle Inspection](https://mail.heavyvehicleinspection.com/blog/post/fleet-inspection-software-buyers-guide)
- Pulpo (Pulpomatic): [Capterra ES](https://www.capterra.es/software/173091/pulpomatic), [ronda de 8,13 M€](https://marketing4ecommerce.net/ronda-financiacion-pulpo/)
- DeCA: [Veritas Gestión](https://veritasgestion.com/?p=7976), [GA_P guía](https://ga-p.com/publicaciones/guia-para-no-perderte-con-el-nuevo-deca/),
  [trans.info: arranque con polémica](https://trans.info/es/el-deca-arranca-con-polemica-transportistas-denuncian-costes-fallos-tecnicos-y-cargas-administrativas-impropias-508207)
- Franquicias de alquiler de furgonetas: [National Tarragona](https://www.nationalcar.com/es/oficinas-de-alquiler-de-autos/es/estacion-ave-de-camp-de-tarragona-e5wt.html),
  [National Reus](https://www.nationalcar.com/es/oficinas-de-alquiler-de-autos/es/reus-train-station-e5wx.html), [Consumo: objeciones a daños](https://portal-cec.consumo.gob.es/sites/default/files/plantillas/Objeciones_en_los_Danos.doc)
- Conversión SaaS 2026: [ChartMogul Conversion Report](https://chartmogul.com/reports/saas-conversion-report/), [Arcade (OpenView 2026)](https://www.arcade.software/post/free-trial-conversion-playbook-2026),
  [Userpilot](https://userpilot.com/blog/free-trial-conversion-rate/)
- Ventas fundador en SaaS vertical: [SaaStr](https://www.saastr.com/the-biggest-challenge-with-vertical-saas-your-sales-team-has-to-be-domain-experts),
  [Causo H1 2026](https://hub.causo.ai/guides/h1-2026-founder-led-sales-report), [Close](https://close.com/resources-and-guides/saas-sales-book)
- Amazon DSP España: [DPL News / El Economista](https://dplnews.com/?p=11044), [Stellantis 300 furgonetas (10-2025)](https://www.media.stellantis.com/es-es/corporate/press/mas-de-300-furgonetas-stellantis-pro-one-se-incorporan-a-la-red-de-reparto-de-amazon-en-espana),
  [Amazon 100 eléctricas](https://www.hibridosyelectricos.com/furgonetas/amazon-utilizara-100-furgonetas-electricas-entrega-ultima-milla-espana_35952_102.html), [Espacio Furgo](https://www.espaciofurgo.com/quieres-emprender-con-amazon-y-convertirte-en-socio-de-entrega-dsp-en-espana/)
- Vulnerabilidades: `pip-audit` (PyPI Advisory DB) y `npm audit` (GitHub Advisory DB), ejecutados el 01-11-2026.
