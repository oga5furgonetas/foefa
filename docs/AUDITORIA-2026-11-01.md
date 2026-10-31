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

_(se rellena al cerrar)_

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
- 🟢 Tokens de conductor: todos los `create_token` llevan `db_name` (revisados los 8 sitios); el único sin empresa es
  el de mantenimiento, que cae en la base del dueño a propósito.

_(sigue: §3 web, §4 app, §5 infraestructura, §6 uso real, §7 mercado, §8 veredicto)_

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

_(hallazgos: ver más abajo, se completan en el siguiente bloque)_

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

## 7. Mercado, competencia y crecimiento

## 8. Veredicto, lo arreglado y el plan priorizado
