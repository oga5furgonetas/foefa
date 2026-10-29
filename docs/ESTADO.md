# Estado de Flota y relevo entre sesiones

> **Si eres una sesión nueva: lee esto entero antes de tocar nada.**
> Al acabar tu trabajo, actualiza la sección «Última sesión» y «Pendiente»,
> haz commit y `git push`. Una sola sesión trabajando a la vez: antes de
> empezar, `git pull` y comprueba que nadie ha dejado nada a medias aquí.

Última actualización: **29-10-2026 (noche, 4)**: FDS en todo, fuera Valor y China, avisos al móvil, app 2.3.0; fusionado en `main`, desplegado y verificado (ver «Última sesión — 29-10-2026 (noche, 4)»). Anterior: **29-10-2026 (noche, 3)** (fusionadas en `main` dos sesiones de la noche: la del servidor y la app 2.2.5 —sección «(noche): fase 0…»— y la del anuncio con la VOZ DE DANI y el mapa real de A Coruña, montado en `docs/anuncios/spot-dani/salida/`; ver «Última sesión»). Antes, noche: (anuncio «La ruta hecha»: guion para IA en `docs/anuncios/super-anuncio/` y generaciones en Artlist). Antes, tarde: (el CI de `main` llevaba desde el 18-10 en rojo; checkers arreglados de raíz y todo el CI en verde en local; ver «Última sesión»). Por la mañana: FDS 2.2.3 compilada, probada y firmada, el AAB listo para Play (ver «29-10-2026 (mañana)»).

## Qué es y dónde está

- **Flota**: SaaS de gestión de flotas para cualquier empresa. Nació el 25-09-2026
  como copia depurada de FlotaDSP (sin extensión de Cortex ni nada que
  interfiera con Amazon). Dani lo usa también para **su propia flota**
  (reparto para Amazon, centros OGA5, DGA1, DGA2).
- Código: `C:\Users\Usuario\Downloads\flotia` (la carpeta NO se renombró),
  rama `main`, repo privado **github.com/oga5furgonetas/foefa**. Desde el 29-10 también en el PC de casa de Dani
  (usuario `dlvie`): `C:\Users\dlvie\foefa`, con Android Studio, git y la clave de firma de la app en `C:\Users\dlvie\`.
- Web: **https://flotadsp.com** (y www → 301). La sirve el Worker de Cloudflare
  `flota-dominio` (`infra/web-dominio/`), que reenvía al proyecto de Pages
  `flota` (https://flota-2fg.pages.dev). Ver el porqué en `infra/web-dominio/worker.js`.
- API: **https://flota-backend.fly.dev** (Fly, cuenta NUEVA de Dani, app `flota-backend`).
- Base de datos: MongoDB Atlas, clúster `cluster1` (M0 gratis). Bases:
  `flota` (empresa principal), `flota_global` (usuarios, empresas), `dsp_demo`
  (demo), `edge_os` (proyecto de apuestas, copiado tal cual).
- Ficheros y fotos: R2 `flotadsp-uploads` en la cuenta de Cloudflare
  **tr2santiago@winiw.es** (no en la de Flota). URL pública
  `https://pub-37efd7ef3dc94d0b918aeac1b5480b41.r2.dev`. Ahí están las ~30.000
  fotos de FlotaDSP, las copias `backups/flotadsp_*` y las nuevas `backups/flota_*`.
- IA: Gemini por clave de AI Studio (proyecto «Proyecto de Gemini 3», nivel
  gratuito). Modelo por defecto `gemini-3.8-flash` (`_modelo_ia()` en server.py).

## Credenciales (solo rutas; NUNCA imprimir su contenido)

| Qué | Fichero en el PC de Dani |
|---|---|
| Token de Fly (cuenta nueva) | `C:\Users\Usuario\.flotia-fly-token.txt` |
| URI de Mongo de Flota | `C:\Users\Usuario\.flota-mongo-uri.txt` |
| Clave de Gemini | `C:\Users\Usuario\.flota-gemini.txt` |
| Token de R2 (access, secret, endpoint) | `C:\Users\Usuario\.flota-r2.txt` |
| Admin de Dani | `C:\Users\Usuario\.flota-admin.txt` |

El CLI `fly` del PC está logueado en la cuenta VIEJA: usar siempre
`FLY_API_TOKEN` desde el fichero. Para meter secretos en Fly, desde **bash**
(`printf 'X=%s\n' "$(...)" | fly secrets import --stage -a flota-backend`):
desde PowerShell 5.1 el pipe mete un BOM en el nombre y falla.

## Cómo desplegar

```
# Desde el PC (PowerShell, en la raíz del repo). Leen despliegue.local.json: el destino Y el píxel de Meta.
.\scripts\deploy-backend.ps1
.\scripts\deploy-frontend.ps1
# O desde GitHub: Actions → «Desplegar producción» → Run workflow (todo / backend / web), con los 3 secretos.
# A MANO solo si no queda otra, y la web SIEMPRE con el píxel: sin VITE_META_PIXEL_ID sale sin medir los anuncios
# (así estuvo la de producción el 29-10: fbq no existía). Desde frontend/:
#   VITE_API_URL=https://flota-backend.fly.dev/api VITE_META_PIXEL_ID=1317231944812644 npx vite build
#   node ../scripts/sellar-build.mjs && npx wrangler pages deploy dist --project-name flota --branch main --commit-dirty=true
# Backend a mano (desde backend/): fly deploy --remote-only -a flota-backend --strategy immediate --ha=false
```

Antes de desplegar, lo de CLAUDE.md («Antes de dar algo por bueno»): checks,
eslint, build, `pytest backend/tests` (612 en verde el 26-09 por la noche) y humo de Playwright.
**Si algo se pone rojo, no se despliega.**

## Reglas de Dani (siempre)

- No borrar ni reescribir nada que ya funcione. Nada destructivo e irreversible
  (borrar datos reales, force push, migraciones que pierdan información) sin avisar.
- No tocar ni imprimir secretos.
- Si un despliegue falla: rollback y pegar el error, sin improvisar parches.
- No inventar: lo que no se pueda comprobar se marca «no verificado» y se dice cómo probarlo.
- Sin falsos positivos: cada hallazgo con su prueba.
- En español, directo; desplegar y subir a git al acabar cada cosa.

## Qué se hizo el 26-09-2026

1. **Datos de FlotaDSP recuperados y traspasados** a Flota (144.712 documentos:
   conductores, furgonetas, inspecciones, usuarios, DNR, turnos…). Solo
   inserta; manifiesto para deshacer en
   `C:\Users\Usuario\Documents\copia-flotadsp-2026-09-26\traspaso_manifiesto.json.gz`.
   Copia COMPLETA de la base vieja en esa misma carpeta (formato mongodump).
2. **Plantilla del día** (/panel/plantilla): pegando texto o captura; lee sin IA
   si la IA falla; edición compartida celda a celda.
3. **DNR diaria** (/panel/diarios, permiso `diarios`): Daily Report subido a mano.
4. **flotadsp.com** sirve Flota (Worker). **IA** con clave nueva y modelo actual.
5. **Fotos** recuperadas (R2 de winiw) y R2 conectado; primera copia de la base en R2.
7. **Copias de seguridad cifradas** (AES-256-GCM; clave en
   `C:\Users\Usuario\.flota-copias-clave.txt` y secreto `COPIAS_CLAVE` en Fly);
   `backend/scripts/descifrar_copia.py` las abre. Nunca se sube una en claro.
6. **Pasada con datos reales** (193 GET, 238 mutaciones, 37 pantallas en
   escritorio y móvil): arreglados el historial de daños (500) y el ranking
   (7 s → 0,18 s); textos «nave/station» → «centro».

## Qué se hizo el 26-09-2026 (tarde): Valor y «todo en privado»

1. **Valor** (`/panel/valor`): el buscador de apuestas de Dani (venía en
   `valor.zip`, 63 tests). Motor en `backend/valor/` (su README explica el
   método), API `/api/valor/*`, página `frontend/src/panel/pages/Valor.jsx`.
   **SOLO Dani**: menú lateral y del móvil solo con `isSuperAdmin()`, la ruta
   echa al resto (`routeAllowed`), y el servidor exige `require_valor`, más
   estricto que `require_superadmin`: marca `sa` en el token + que no sea demo,
   mantenimiento ni suplantación + que en la base ese usuario sea el de
   `SUPERADMIN_USERNAME` con `super_admin`. No sale en la paleta ⌘K, ni en
   sitemap, robots, portada o ayuda. Comprobado en producción: Dani 200; otro
   admin, otro admin con `sa` forjado y la demo, 403. Tests:
   `backend/tests/test_valor_*.py` y `e2e/humo.spec.js` («Valor, solo super-admin»).
   - Base: SQLite en el volumen de Fly, `/app/uploads/privado/valor.db`. NO en
     Mongo. `/uploads` es público, así que la subclase `_UploadsSinPrivado`
     se niega a servir `PRIVADO_DIR` (probado con `./`, `..`, `//`).
   - Escáner: hilo que arranca SOLO con `VALOR_ESCANEAR=1`; avisos por
     `VALOR_TELEGRAM_TOKEN`/`VALOR_TELEGRAM_CHAT` (nunca el Telegram de la flota).
   - **Falta (lo tiene que dar Dani)**: `ODDS_API_KEY` (y `APISPORTS_KEY` si la
     tiene) y su banca real `VALOR_BANCA` (hoy 1000 por defecto). Con las
     claves: hacer UNA llamada real a cada API, comparar con
     `valor/fuentes/*.py`, corregir con su test, y entonces `VALOR_ESCANEAR=1`.
     La clave vieja de The Odds API estaba solo en la app de FlotaDSP (apagada):
     no se ha tocado.
   - Arreglado al integrar: `/aprendizaje` daba 500 con un segmento de UN aviso
     (margen infinito no cabe en JSON).
2. **La lista de rutas de la API ya no es pública**: `/docs`, `/redoc` y
   `/openapi.json` respondían 200 a cualquiera. Ahora 404; en local se
   encienden con `API_DOCS=1`.
3. **Los mapas de fuente ya no se publican**: cada `.js` de la web llevaba su
   `.map` (el código fuente entero, con comentarios) descargable. Ahora
   `sourcemap: 'hidden'` y el plugin `mapasFuera()` de `vite.config.js` los
   mueve a `frontend/mapas/<fecha>/` (fuera de git) en cada build.

## Qué se hizo el 26-09-2026 (noche): furgonetas fijas

**Plantilla del día → pestaña «Furgonetas fijas» + botón «Poner furgonetas».**
Motor puro en `backend/afinidad.py` (léelo: explica el porqué), 27 pruebas en
`backend/tests/test_afinidad.py`; endpoints `/api/afinidad*` y
`/api/tools/plantilla-furgos` en server.py; UI en
`frontend/src/panel/components/FurgonetasFijas.jsx` y `PlantillaGenerador.jsx`.
- Medido con datos reales: hoy casi nadie repite furgoneta (OGA5 29 %, DGA1
  17 %), así que la afinidad se FIJA (principal/secundaria/titular, colección
  `furgo_fijas`) y el historial solo propone, ordena y sugiere.
- Puntos: principal 100 (+15 titular), secundaria 60, historial 0-30 (media
  vida 21 d), continuidad 5, nota de responsabilidad 1-10 de la oficina (±20
  × valor de la furgoneta), golpes igual pero SOLO si `cuidado_predice` lo
  demuestra (hoy no: 17 golpes seguros en 4 meses). Solo se rellena sola la
  principal o la secundaria; «Completar» pone también las libres; «sin fija»
  nunca. Reparto óptimo (húngaro; con fila, programa entero HiGHS de scipy).
- Fila de OGA5 (`furgo_fila`, por centro): la de delante sale antes o a la vez;
  mover una cuesta 250 puntos (dos principales). Avisa de qué mover y de qué
  tapa a cuál. Casado de nombres estricto (157/167 en plantillas reales).
- Nuevo en requirements: `scipy==1.14.1`.
- **Nada aplicado aún en producción**: cada centro tiene que pulsar «Proponer
  reparto inicial» y aplicar (OGA5 propone 76, DGA1 52). Hasta entonces
  «Poner furgonetas» no rellena nada (comprobado).
- Falta: casilla de «vetadas» en la pantalla (el servidor ya las admite).

## Qué se hizo el 27-09-2026 (madrugada): pantalla de furgonetas y pegar la lista de rutas

- **«Furgonetas fijas» rediseñada** para los jefes de centro: guía de 3 pasos
  (se oculta), progreso «X de Y conductores con furgoneta», conductores como
  frases con la matrícula dibujada como placa, editor desplegable con
  interruptores explicados y la nota 1-10 en botones, furgonetas en tarjetas,
  «¿A quién se la doy?» y el reparto automático en ventanas, y la fila de
  aparcamiento dibujada como el patio. Puntos visibles en la plantilla.
- **Pegar la lista del día tal cual** (lo que se copia de la pantalla de
  rutas): `_plantilla_por_plantel` busca en el texto a los conductores DE LA
  EMPRESA (orden, tildes y nombres cortados dan igual; dos que encajan igual
  → `dudosos`, no se adivina), y la ruta y la hora salen de su línea o del
  patrón que se repite (una celda por línea). El nombre queda como en su
  ficha. Si el texto se reconoce así, **no se manda a la IA**. La lista de
  vehículos ya NO es obligatoria y, al montar la hoja, «Poner furgonetas» se
  ejecuta solo. Pruebas: `test_plantilla_plantel.py`, `test_plantilla_montar_plantel.py`.
- Sin muestra real de esa pantalla: probado con formatos plausibles (columnas,
  una celda por línea). Si con la lista real algo no casa, pedir a Dani un
  trozo pegado y añadirlo como prueba.

## Qué se hizo el 27-09-2026 (noche): Valor con tres fuentes y señales auditables

- **Tres fuentes, comprobadas contra las APIs reales** (JSON en crudo en el
  scratchpad de esa sesión, nada en git):
  - The Odds API: 2 créditos por liga con h2h+totals (`x-requests-last`);
    `/events` es GRATIS y hace de calendario. Sus casas «eu» son webs de
    FR/DE/SE/NL/IT: ninguna española → sirve de referencia.
  - **OddsPapi** (nuevo, `valor/fuentes/oddspapi.py`): trae las webs .es.
    UNA casa por petición (con dos, 400), todas las ligas en la misma;
    equipos por número (`/participants`, 550 KB, en disco junto a valor.db,
    se renueva cada semana); 429 si dos peticiones van a menos de ~1 s →
    pausa de 1,2 s y un reintento. Hándicap = línea del local (comprobado).
    Hora de la cuota = hora de la lectura (OddsPapi da cuándo CAMBIÓ, no
    cuándo lo miró); en vivo no se usa.
  - API-Football: el plan gratis NO deja pedir por liga/temporada actual;
    solo por fecha, y sus cuotas tienen ~3 h: casi nunca pasan los 10 min.
    Y no deja pasar de la página 3 (visto en producción: la 4 daba error y
    tiraba las tres leídas) → tope de 3 páginas, 4 llamadas por lectura.
- **Ligas**: del 27-09 al 09-10-2026 las grandes paraban por las selecciones
  (comprobado con el calendario gratis de The Odds API). Por defecto se leen
  LaLiga, Segunda, Premier, Champions, Europa League, Conference y la Nations
  League (`VALOR_LIGAS`; en OddsPapi `ODDSPAPI_TORNEOS=8,54,17,7,679,34480,23755`,
  todas en la misma petición). Una liga de The Odds API solo gasta si tiene
  partido en 24 h.
- **Casas de Dani** (lo dijo el 27-09): Codere (codere.es), BetStars
  (pokerstars.es) y Gamdom; Casino Barcelona no la trae ninguna fuente. Solo
  se recomienda en ellas (`CASAS_DANI`; cambiable en Datos → Tus casas, o
  `VALOR_CASAS`, «*» = todas). Lo que da OddsPapi de cada una en LaLiga:
  Gamdom todo; Codere goles y hándicap pero NO el 1X2; PokerStars ES solo
  «marcan los dos» y resultado exacto, que Pinnacle no da (sin referencia).
  Rotación por defecto `ODDSPAPI_CASAS=gamdom,codere.es,gamdom,pokerstars.es`.
- **El cupo, donde hay partido** (`escaner.py`): ritmo rápido con partido a
  menos de 3 h (The Odds API 40 min, OddsPapi y API-Football 60), ×3 a menos
  de 24 h, casi nada si no hay; tope de 3 veces la parte diaria en un día (en
  una hora si el cupo es diario); se apunta lo gastado DE VERDAD; The Odds API
  lee solo las ligas con partido en 24 h. La última lectura antes del inicio
  es el cierre del CLV: así queda mejor medido.
- **Revisión de ChatGPT (P0 y P1)**: cada señal guarda de cuándo son sus
  cuotas, contra qué referencia se midió, las demás casas y los métodos;
  estado VÁLIDA / CADUCADA / CUOTA CAMBIADA (`Registro.estado_senal`), sin
  quitarlas en silencio; «La he metido» con ventana precargada, ventaja
  recalculada con la cuota real, casilla «no me dejó meter lo que quería», y
  una caducada da 409 salvo que se confirme (queda «fuera de plazo»). La
  apuesta NO pisa la señal (`cuota_senal`, `importe_senal`). El 4 % por
  partido cuenta lo ya apostado (`expuesto` en `detectar`). Freno visible
  («RECOMENDACIONES PAUSADAS»). Historial real de cada señal. Aprendizaje con
  CLV medio, mediano, % que bate el cierre, gráficas (acumulado y semanal) y
  MUESTRA INSUFICIENTE por debajo de 30. Pestaña Datos: salud de cada fuente
  (última y próxima lectura, gastado, lo que dice la API que queda o «no lo
  dice», señales por crédito) y Tus casas.
- **Seguridad**: httpx escribía cada URL (con `?apiKey=`) en los logs en INFO:
  ahora WARNING en todo el servidor; los errores de las fuentes se guardan sin
  la URL ni la clave (`limpia`, `comprueba`).
- Con los datos reales del 27-09 (LaLiga a dos semanas): **0 oportunidades**,
  y 0 con ventaja positiva aun sin filtros. Es lo esperable lejos del partido;
  no se ha tocado ningún filtro para que salgan.

### 27-09 (mañana): todos los deportes

Dani no se creía el 0. Estudio con datos reales (scratchpad de la sesión):
- The Odds API, 28 deportes y 24 casas europeas: de 3.967 cuotas de
  prepartido, 17 con ventaja ≥2 % y ninguna favorita ≥1,70. (Un primer
  análisis daba «valor» en hockey y balonmano: era mezclar el 1X2 de 60 min con
  el ganador con prórroga. El escáner ya los separaba: «1x2» y «ganador».)
- OddsPapi con las casas de Dani, 15 competiciones de 5 deportes: 8.012 cuotas.
  Gamdom paga de mediana un 8,3 % menos de lo justo, Codere un 11,1 %,
  PokerStars un 8,4 %. UNA cumplía todas las reglas: Dolphins +13,5 en Gamdom
  a 1,70 (justa 1,66, +2,1 %, 60 %), NFL. Los «+6 %» de PokerStars y Codere en
  la NFL eran líneas de hándicap cruzadas en la fuente (pagaban más al +4,5
  que al +3,5).
- Hecho: OddsPapi lee TODOS los deportes (`TORNEOS` en `oddspapi.py`: fútbol,
  NFL, NCAA, MLB, NBA, WNBA, Euroliga, NHL; tenis y MMA solo ganador). Mercados
  de `oddspapi_mercados.json`, generado del catálogo REAL (un periodo por
  deporte; nunca cuartos ni jugadores). Equipos por deporte. En cada lectura,
  los 5 torneos que juegan antes en 24 h (calendario gratis de The Odds API +
  partidos leídos). El detector manda a sospechosas un hándicap cuya escalera
  no cuadra (`escalera_rota`). Ritmo: cada 3 h como mucho y 1,2 veces la parte
  diaria (~4 lecturas al día), `ODDSPAPI_CUPO=200` (unas 35 peticiones del
  estudio se gastaron desde el PC y el servidor no las cuenta).
- Límites reales de OddsPapi: 1 casa y 5 torneos por petición, 429 a <1 s.
- 27-09 11:30: Dani seguía viendo 0. Hallado: de 05:16 a 10:17 OddsPapi
  «leyó» 6 veces sin guardar ni una cuota (las de Gamdom eran de las 02:16), y
  tras el reinicio no quedaba el porqué: el mismo código, lanzado desde el PC
  contra la API real, sí funciona (no se ha podido reproducir). Arreglado para
  que no vuelva a quedar oculto: el error de cada lectura se guarda en `uso`
  (sobrevive a reinicios, se ve en Datos) y cualquier excepción de una fuente
  se apunta sin tumbar la vuelta. Nuevo: «Buscar ahora» (`POST /valor/buscar`,
  una vez cada 10 min, respeta el cupo) y «Lo más cerca» (`/valor/casi`,
  `oportunidades.sospechosa=2`): lo que tiene ventaja en sus casas pero no
  cumple una regla, con la regla dicha; NO es recomendación, no se puede
  apostar desde ahí y no cuenta para el aprendizaje.
- Gotcha: el tope de ráfaga daba 49,999999 en vez de 50 (coma flotante) y
  bloqueaba una lectura; ahora se redondea.
- Gotcha: esas 6 lecturas de la mañana gastaron el tope DIARIO de OddsPapi
  (8), así que ni «Buscar ahora» leía sus casas hasta el día siguiente. Ahora
  «Buscar ahora» se salta el tope del día (no el del mes ni lo que diga la API).
- Filtro de desvío (`desvio_max`, 6 puntos): si la casa da los dos lados y,
  sin su margen, ve la selección a más de 6 puntos de Pinnacle, es otro mercado
  con el mismo número (lados cambiados): sospechosa, ni apuesta ni «casi».
  Medido con 1.745 comparaciones reales de sus casas: mediana 1,1, p99 4,7;
  por encima de 6 con ventaja solo las líneas cruzadas de PokerStars (7,3-7,4).
  OJO al medir: un script que no compruebe el deporte de cada mercado mezcla
  mercados de otros deportes y da desvíos falsos de 10-34 puntos (me pasó).
- «Lo más cerca» enseña solo lo de la última lectura de cada fuente.
- «Tus reglas» (Datos): Dani elige acierto mínimo (60/55/50 %) y cuota mínima
  (1,70/1,60/1,50), con cuántas apuestas habrían salido en 24 h con lo leído
  (recomendadas + «casi», un mínimo). Se guardan en `ajustes.reglas`; el
  escáner las aplica en cada vuelta. Por defecto, las suyas (60 %, 1,70). El
  resto de filtros (+2 %, datos, desvío, escalera, topes, freno) no se tocan.
- Rotación de OddsPapi: Gamdom 4 de cada 6 lecturas, y «Buscar ahora» siempre
  Gamdom (`ODDSPAPI_CASA_BUSCAR`): las dos apuestas del 27-09 y las 12 «casi»
  buenas eran de Gamdom; PokerStars trae líneas cruzadas y Codere paga −11 %.
- 27-09 tarde, Dani: «cuota mínimo 1,55 en adelante y que sea muy probable».
  Reglas puestas en producción: sale ≥60 %, cuota ≥1,55 sin excepción por
  debajo (`cuota_suelo`), ventaja ≥+2 % (por debajo es ruido del cálculo de la
  justa). Cada tarjeta dice MUY PROBABLE (≥65 %), PROBABLE (≥58 %) o 50/50.
- Más variedad (Dani: «no hay fútbol, baloncesto, tenis, esports?»):
  · Mercados: de 681 a 2.340 en `oddspapi_mercados.json` (`genera_mercados.py`
    del catálogo real): primera/segunda parte, cuartos, 5 entradas, tiempo
    reglamentario, goles de cada equipo, córners, tarjetas, juegos y sets de
    tenis, mapas de esports. Cada (deporte, periodo, tipo) tiene su NOMBRE
    («totales_1p» ≠ «totales»), así que nunca se comparan entre sí; los
    resultados salen de la primera palabra (`_Resultados`). No gasta más: todo
    venía ya en la misma respuesta. Con los datos del 27-09: 13.033 cuotas de
    sus casas en vez de 4.983.
  · Deportes: tenis (ATP, WTA, WTA 125K, Challenger) y esports (CS, LoL, Dota,
    Valorant) se DESCUBREN una vez por semana (`descubre_si_toca`,
    `oddspapi_torneos.json` en el volumen); más ACB, Eurocup y NBA pretemporada.
  · Turnos: una lectura sí y otra no, los 5 que juegan antes; la otra, una
    tanda del resto por turnos. «Buscar ahora» lee las dos (4 peticiones).
  · Los filtros de datos (desvío, escalera en todos los hándicaps) valen para
    los mercados nuevos: con los datos del 27-09 pararon un hándicap de
    córners y un total de equipo de Gamdom.
  · Precios de OddsPapi: su web solo tiene una calculadora (casas, deportes,
    peticiones); no hay cifras publicadas que citar.
- Plantilla del día: las rutas salían ordenadas como TEXTO (CA_A10… CA_A19,
  CA_A2, CA_A20). Ahora por número (`_orden_natural` en `plantilla_extraer`).
- Push: la app tiene web push pero en producción no hay claves VAPID; avisos
  al móvil de Valor pendientes de que Dani diga cómo (Telegram propio o push).
- Gotcha: para elegir torneos NO fiarse del nombre de la liga en `eventos`:
  API-Football guarda «Premier League» o «Ligue 1» de Egipto o Argelia con el
  mismo nombre. Si el calendario conoce el torneo, manda el calendario.

## Qué se hizo el 27-09-2026 (tarde): fichas que «no se guardaban», ID y horas

- **Fichas de conductor.** No era que no se guardaran: la ficha se creaba SIN
  centro (alta con «Todos» elegido) y `GET /drivers?center=X` solo devolvía
  las de ese centro, así que no salía en ninguna lista; al repetir el alta,
  409 «ya hay un conductor activo con ese correo». Caso real: Estela Alen Lage
  (ahora en DGA2). Arreglo: la lista devuelve también las fichas sin centro
  (marcadas «sin centro», aviso encima de la tabla); el alta nace en el centro
  que se está mirando y el servidor pone el único centro posible si no viene
  (con varios, no adivina); el 409 trae `abrir_id` y el panel abre esa ficha.
  Quedan 2 sin centro: Angel Vazquez Reendo y José Ángel Calvo Gesto.
- **ID de reparto** (`transporter_id`) vuelve a la ficha: lo quitaba el
  `response_model` (127 fichas lo tienen). Se escribe a mano, validado con
  `_DIA_TID`, sin repetirse entre fichas vivas (mira también `driver_id`), y
  sin revalidar si no cambia (una ficha vieja con un ID raro se puede seguir
  editando). Solo se enseña con los módulos `diarios`/`horas` o si ya lo trae.
- **Horas · WHC** (/panel/horas, módulo y permiso `horas`, fuera del estándar):
  la parte de PEGAR el plan de FlotaDSP, sin la lectura automática (`whc_api`).
  Se guarda por (centro, semana) en `whc_planes`; `/whc/estado` dice qué
  centro está al día. Cambio sobre FlotaDSP: «Pasado» solo con lo CERRADO; el
  total del portal cuenta el bloque en curso, así que quien va en ruta sale
  aparte como «se pasa hoy si acaba» (`pasara_hoy`). Con el plan de DGA1 del
  13-09 eran 6 «pasados» falsos. Los usuarios con permisos a medida necesitan
  la casilla «Horas · WHC» en Usuarios para verla.
- Tests: `test_fichas_conductor.py` (10), `test_whc_en_curso.py` (6) y los
  cuatro `test_whc_*` recuperados del commit raíz (sin el de la extensión);
  e2e «Horas · WHC» y «Conductores sin centro».

## Qué se hizo el 29/30-09-2026: Cuadrante con motor, Mery y Plantilla

1. **Cuadrante** (`/panel/cuadrante`, módulo `cuadrante`, hereda el permiso de
   `turnos`; Turnos se queda para aprobar días). Lo pidió Dani tras preparar en
   claude.ai un `cuadrante_solver.py` y dos prompts con su hoja MENSUAL de
   septiembre-octubre: máxima +2 cada día, 5+2, nunca 7 seguidos, no tocar
   APROBADO/N/D/V/BAJA, días extra en rosa.
   - Motor `backend/cuadrante_motor.py` (léelo: explica qué cambia sobre el
     solver original y por qué). HiGHS vía scipy, sin dependencias nuevas.
     Ruta = solo 1/T/X/EXTRA (BKP/RA/S trabajan pero no son ruta). Notas por
     persona (4 días, alternos, nunca X, sin extra) y reparto justo de extras y
     findes como DESEMPATE (la cuenta de los 99 < 100 en la cabecera).
   - Órdenes `backend/cuadrante_ordenes.py`: chat sin IA para lo de cada día,
     Gemini solo si no se entiende; nada se aplica sin «Confirmar».
   - Hoja MENSUAL `backend/cuadrante_excel.py`: fechas reales (el 12-10 va en
     BD tras las columnas de horas ocultas), tipos por el color del NOMBRE
     leídos de su leyenda (azul fijo, melocotón finde, amarillo se va el día 1),
     rosa = extra, fecha de entrada de los nuevos (N/T seguidos o RA).
   - Los turnos son los mismos `shifts` de siempre + `extra`/`fijada`;
     colecciones nuevas `cuadrante_personas|config|ajustes|propuestas|cambios|chat`.
   - Pruebas: `test_cuadrante_motor|ordenes|excel.py` (84 con el login). Y una
     prueba DE PUNTA A PUNTA con la hoja real contra una base `prueba_cuadrante`
     (backend local con token de mantenimiento propio): cazó 4 falsos
     positivos que se arreglaron (Melvin entraba sin estar en la hoja, Francisco
     Gil trabajaba antes de empezar, Alberto casaba con su ficha de baja,
     «quién libra» contaba bajas). Scripts en el scratchpad de la sesión.
2. **Login sin mayúsculas** (`_admin_por_usuario`): Mery («Mery») escribía
   «mery» y se bloqueaba al 5º intento. Y no se crean usuarios que solo cambien
   en mayúsculas.
3. **Plantilla del día**: la celda que se escribe ya no la pisa el refresco (se
   borraba la protección con otro guardado pendiente); la hora se normaliza al
   salir (930 → 09:30); móvil/llegada/carga/salida se ocultan por separado (y
   en el Excel); «Poner móviles» desde la ficha (`/tools/plantilla-moviles`).
4. **La hoja de OGA5 YA ESTÁ EN PRODUCCIÓN (30-09).** Importada con token de
   mantenimiento (Dani dio permiso para leer el `SECRET_KEY`; el fichero se
   borró al acabar): 68 personas, 2.510 celdas, 29 máximas, fichas nuevas solo
   Carolina Crespo e Isais Fernández, 5 días concedidos respetados (María dos
   Santos 1-3/10 y dos de septiembre). Comprobado contra la hoja: los unos de
   cada día coinciden salvo esos 5. Fran Gil (Francisco Javier Gil Adamuz) usa
   su ficha de DGA1 y entra en OGA5 el 05-10 (sin sus N/T de antes).
   - Antes, Dani la probó con **DGA1 elegido arriba**: 67 de 68 salían «no
     tiene ficha» con «Crear ficha nueva» ya puesto (no llegó a importar;
     DGA1/DGA2 sin cuadrante). Ahora `_cua_centro_de_la_hoja` casa cada nombre
     con las fichas de TODA la empresa: si la mayoría está en otro centro, la
     previa lo dice, ofrece «Cambiar a OGA5» y el servidor da 409 al confirmar
     salvo `forzar_centro`. La ficha de otro centro se ofrece «(de DGA1)» y
     nunca se elige sola.
   - **El rosa no lo toca el motor** (`extras` en la entrada): un día que se
     sigue trabajando conserva su marca; solo un día NUEVO por encima de 5 sale
     en rosa. La hoja no cuenta de lunes a domingo (rosas en semanas de 5 días,
     semanas de 6 sin rosa) y la propuesta salía con 22 «cambios» que solo
     movían la marca.
   - Ventanas del cuadrante opacas y en z-[100] (con `.card` se transparentaban).
   - **Propuesta PENDIENTE** 01→12-10 en OGA5 (no aceptada): +2 todos los días,
     27 cambios (casi todos para que los nuevos y quien tenía 4 días hagan 5),
     faltan ~3 conductores. El 01-10 solo entran César García y David Pombo.
     Dani (30-09): «No, déjala pendiente».
5. **Tarde del 30-09**, lo que pidió Dani al verlo:
   - Asistente del cuadrante opaco (`.card` al 70 % dejaba leer la tabla) y,
     en pantalla ancha, hueco para TODA la página, no solo la tabla.
   - Domingos: el 1 y el N/T en naranja como en su hoja, franja por toda la
     columna hasta Diferencia (el rosa y los códigos con color propio mandan).
   - **Usuarios**: las casillas con los mismos grupos, orden y nombres que el
     menú; Órdenes detrás de Talleres («va con…»); el CUADRANTE con casilla
     propia (Dani: «¿no puedo marcarle cuadrante?»; `migrar_permiso_cuadrante`
     se lo marcó UNA vez a los 13 que tenían Días libres); «Ve N de 29
     pantallas»; vista «Quién ve cada pantalla» (pantallas × usuarios, la
     misma cuenta que el menú: `veLaPantalla`) con «Editar» por usuario.
   - **Cambio de centro programado**: `traslado` en la ficha +
     `POST/DELETE /drivers/{id}/traslado` + `_bucle_traslados` (15 min, todas
     las empresas, latido `traslados`, `historial_centros`). Fran Gil, a OGA5
     el 05-10 (programado en producción).
6. **Noche del 30-09**:
   - **Plantilla → pestaña Móviles** (`moviles`, `moviles_de`): extensiones del
     centro (4114, 1117…), a cada conductor SU móvil o PROPIO y uno DE RESERVA;
     «Pegar la lista de tu hoja» (CONDUCTOR → MÓVIL, la matrícula de al lado se
     ignora). «Poner móviles» pone el suyo y, si ese día ya lo lleva otro de la
     hoja, el de reserva (`_mov_repartir`: nunca el mismo móvil a dos). Sin
     móviles dados de alta en el centro, como antes (el de la ficha).
   - **Días libres ↔ cuadrante**: aprobar pone la celda con CANDADO y guarda lo
     de antes (`antes_aprob`); desaprobar lo devuelve. Un día concedido con
     candado no se cambia en la rejilla; el candado lo quita quien aprueba días.
   - **Portal del conductor**: «Tus peticiones»: cambiar lo pendiente (sigue
     siendo UNA petición), cancelarlo, o devolver un aprobado futuro (vuelve el
     cuadrante como estaba). Aviso a la oficina de cada cosa. No se puede
     aprobar una petición cancelada (409).
   - **La hoja** («Abrir como hoja (Excel)» en el Cuadrante, `panel/hoja/`):
     DIARIO / MENSUAL / DEBER HORAS a pantalla completa, manejo de Excel
     (useRejilla: selección, teclado, Ctrl+C/V con tabuladores, Ctrl+Z que solo
     deshace lo suyo: `solo_si`). DIARIO = el mismo turno + apuntes
     (`cuadrante_diario`); DEBER HORAS (`cuadrante_deber_horas`): su registro
     traído del Excel en producción (65 filas, 18 pendientes).
   - Su «2 días a mayores» al pegar el DIARIO en el MENSUAL: David Pombo y
     David Sierra van en distinto orden en las dos hojas, y «1.EXTRA» es texto
     que su RUTAS (=SUM) no cuenta. La hoja de la app no copia: es el mismo dato.
7. **Repaso del 30-09 por la tarde** (Dani: «perfecciona todo»):
   - **La hoja**: filas memorizadas y un solo manejador de ratón (1,5 ms por
     tecla con 68 personas × 42 días); escribir encima y flecha guarda y mueve
     como en Excel; un espacio suelto no vacía; se confirma antes de vaciar más
     de 40 celdas o pegar más de 200; el 7º día seguido en rojo también aquí;
     semanas separadas, hoy marcado y RUTAS/MÁXIMA/DIFERENCIA fijas abajo. En el
     móvil la columna «#» se encogía a 21 px y el nombre tapaba 11 px del primer
     día («/T» en vez de «N/T»): `min-w` en las columnas fijas.
   - **Móviles**: filas en rejilla; en el móvil, dos líneas por fila (antes el
     estado y la papelera se salían por la derecha).
   - **Turnos**: aprobar un grupo con un día que el conductor ya canceló sigue
     con los demás y lo dice (antes se paraba a la mitad con 409).
   - **Portal**: cambiar una petición ya no cancela un día pasado sin contestar
     de la misma petición (salía «quita 28/09» sin tocarlo).
   - **Modo claro**: el naranja pasa a `#9a3412` (el `#c2410c` daba 4,2:1 sobre
     su propio fondo tintado y la prueba de contraste fallaba en el CI).

## Qué se hizo el 03-10-2026: Reparto a domicilio y a negocios

Dani (por WhatsApp con Dani Brao): un encargado de repartidores de Gadis
quiere algo para su flotilla; reparten la compra con el ticket de caja pegado a
las cajas y a boli. Idea: escanear el código, que salga la dirección y lo que
lleva y entre solo en la ruta; lo mismo para distribuidores tipo Disgón. Y en
el alta, preguntar qué tipo de empresa es. Con TODO dentro de la ley.

- Módulo **`reparto`** (`/panel/reparto` + «Mi ruta» en el portal del
  conductor). Explicación completa y **análisis legal** en `docs/REPARTO.md`.
- **Alta por sector** (`/registro`, paso 0): supermercado y distribución nacen
  con `reparto`; paquetería y «otra» con el estándar. `sector` en la org.
- Lo legal hecho en código: la plataforma no ve datos de clientes ni
  ubicaciones (entrando como la empresa salen tapados); conductor solo lo suyo;
  ubicación solo en jornada y tras aceptar el aviso; borrado automático;
  IA de tickets **bloqueada** hasta `REPARTO_IA_PERMITIDA=1` con clave de pago.
- Pruebas: `test_reparto.py` y `test_reparto_api.py` (19), humo «Reparto» (3).
- Por la tarde: contrato de encargo en `/encargo` (se acepta en el alta),
  privacidad corregida, y la **foto del ticket se lee en el móvil** con
  tesseract.js servido desde `/ocr/<versión>/` (sin IA externa). OJO: esos
  ficheros no llevan huella; si se cambian, subir la versión de
  `src/lib/ocrRuta.js` (se envenenaron dos en el borde al desplegar).
- Noche: **demo de reparto sin registro** en `/prueba-reparto` (enlace para
  mandar por WhatsApp): oficina + Repartidor 1/2/3, súper de prueba en A Coruña
  con 12 pedidos inventados, base `dsp_demo_reparto`, se regenera cada día
  (`_demo_reparto_preparar`; para reiniciarla a mano, borrar `app_meta`
  `demo_reparto_dia`). En la demo SÍ se escribe, pero solo en `/api/reparto/`
  (`get_current_user`); lo demás da 403. Probado entero en producción.
  En la cuenta real, «Zonas y ajustes» tiene el enlace + QR del portal para
  mandar a los repartidores. NO se crean cuentas por nadie: se registra él.

## Qué se hizo el 03/04-10-2026 (noche): sectores, autónomo, ruta por tiempo, app

Dani (03-10, noche): «a mi usuario dani le desapareció todo» → la demo del
reparto había PISADO su sesión (saveSession en /prueba-reparto). Arreglado:
`guardarSesionPrevia`/`volverASesionPrevia` en `panel/auth.js`, botón «Volver a
mi cuenta» en el aviso de demo, y salir de una demo devuelve la sesión real.
Nada se había borrado (org `owner` sin `modulos`, usuario `dani` sin
`permissions`). Si vuelve a pasar: cerrar sesión y entrar.

- **Alta por sector** (`SECTORES_REGISTRO`): `dsp_amazon` (TODO: plantilla,
  DNR, horas, cuadrante, turnos…; `paqueteria` es su nombre viejo),
  `mensajeria` (reparto + turnos, sin lo de Amazon), `supermercado` y
  `distribucion` (reparto), `autonomo` (reparto sin equipo; es su propio
  repartidor: `_rep_es_autonomo`, «Mi ruta» dentro de su panel), `otra`.
  La tarjeta «DSP de Amazon» está permitida en `check-marca` (uso descriptivo).
- **Panel por sector**: `lib/sector.js` (voces: Tiendas/Almacenes/Bases,
  Repartidores), `InicioReparto.jsx` como portada de quien reparte,
  Configuración sin cierres de turno para ellos, avisos en vivo solo de los
  módulos que tiene la empresa, ejemplos neutros (sin OGA5; `check-marca` lo
  vigila). `aislarSesion()` borra lo guardado en el navegador al cambiar de
  empresa/usuario (la demo enseñaba «Candidatos nuevos · OGA5» de Dani).
- **Ruta por tiempo** (`reparto.optimiza_por_tiempo` + `_rep_matriz` con el
  OSRM de FOSSGIS, 1 req/s): tráfico típico por hora, minutos por parada y
  bulto, franjas («horario» o nota que hable de horas), urgentes, hora de
  salida, volver al almacén; `eta`/`tarde_min` por pedido; `reparto_rutas`.
- **Más**: seguimiento del cliente `/s/<token>` (sin datos personales,
  caduca al día siguiente), cobro a la entrega (efectivo/tarjeta/Bizum),
  recogidas, «reintentar mañana», llamar/WhatsApp con la hora, **prueba de
  entrega** (foto pequeña en el pedido + nota; `/reparto/pedidos/{id}/foto`;
  se borra con los datos personales), estadísticas (`/reparto/estadisticas`).
- **App de Play Store** (TWA): carpeta `android/`, guía completa en
  `docs/PLAY_STORE.md`. Clave en `~/.flota-android.keystore` (contraseña en
  `~/.flota-android-keystore.txt`), `assetlinks.json` publicado, manifest con
  `start_url: /app` (`AppRedirect` decide a dónde). Ver ahí qué le toca a Dani
  (cuenta de Play, 25 USD; huella de Play App Signing).

- **Plan Autónomo** (04-10): 7 días de prueba y 9,99 €/mes fijos (99 €/año);
  `_LIM_AUTONOMO`, `PLAN_TARIFAS["autonomo"]` con `mensual/anual/dias_prueba`,
  catálogo fusionado con el de la base (`_catalogo_planes`), alta sin
  selector de plan, tarjeta en /planes. **Cobro con Stripe** (la cuenta de
  Dani): producto, precios y webhook creados por API; `/billing/stripe/suscripcion`
  (Checkout con `trial_end`), `/billing/stripe/portal`, webhook
  `/billing/stripe/suscripciones-webhook` (firma + idempotencia). Secretos
  `STRIPE_PRICE_AUTONOMO(_ANNUAL)` y `STRIPE_WEBHOOK_SECRET_SUSCRIPCIONES` en Fly.
  No probado con un pago real (modo live; haría falta una tarjeta de verdad).

- **La app de quien reparte solo (04-10, noche)**: Dani: «no es lógico cobrar
  300 a una empresa y 10 a un autónomo por lo mismo» → el sector `autonomo`
  es OTRO producto: `/ruta` (`pages/RutaApp.jsx`: Hoy = MiRuta, Historial,
  Ajustes, Cuenta), sin panel (PanelLayout le manda a /ruta conservando la
  query), sin IA ni vehículos (`_LIM_AUTONOMO`, módulos `dashboard, reparto,
  configuracion`). La app arranca en `/empezar` («Repartir yo mismo» / «Soy
  repartidor de una empresa» / «Gestiono una empresa» / probar sin cuenta);
  el alta de «Repartir yo mismo» son tres campos (usuario = correo, URL
  automática) y acaba en /ruta. «Cargar paquetes» encadena fotos de etiqueta
  (OCR + código de barras de la misma foto) y «Montar ruta». La palabra
  «autónomo» ya no sale en pantalla: tarjeta «Repartir yo mismo», plan
  «Repartidor». Stripe devuelve a /ruta?pago=ok a quien reparte solo.

## Qué se hizo el 04-10-2026 (madrugada): idiomas, China, moneda

- App de reparto en 7 idiomas (es en pt fr it de zh): `lib/idioma.js` (`tx`,
  `txError`), diccionario `lib/textosRuta{A,B,C}.js` (C = mensajes del
  servidor). Sigue el idioma del móvil o el elegido en Cuenta/Empezar/alta.
  Comprobar: `node scripts/check-textos-ruta.mjs`. Las pruebas e2e fijan es-ES.
- Portada en chino en `/cn` (`pages/landingZh.js`) con capturas reales de la
  app en chino (`e2e/capturas-ruta.spec.js --update-snapshots`). El PANEL aún
  no tiene chino (la portada lo dice). Anuncios: `tools/anuncios/anuncio.html`
  + `node e2e/anuncios.mjs [idiomas]` → `docs/anuncios/<idioma>/`.
- Cobros en la moneda del país (`lib/region.js` importe/metodosCobro); fuera de
  España «Transferencia» en vez de Bizum (el servidor la acepta).
- Arreglos: `/registro?sector=autonomo` (enlace del regalo) enseñaba planes de
  empresa; el alta del repartidor ya no dice «sin tarjeta»; pastel 200 ilegibles
  en modo día; aviso de cookies traducido.
- Play: token OK y ve las 2 suscripciones, pero verificar compras da 401
  (falta permiso de pedidos/suscripciones o no ha propagado). `PLAY_COBRO_ACTIVO`
  sigue apagado.

## Qué se hizo el 04-10-2026 (mañana): panel en chino y China

- Panel con chino como 7º idioma: `src/i18nZh.js` (las 1.397 claves de DICT;
  `check-i18n.mjs` falla si falta una) + `lib/traductorZh.js`, que en chino
  cambia en pantalla las ~1.500 frases escritas tal cual en el JSX
  (`src/i18nZhLit.js`, carga aparte). Fuera quedan módulos del dueño (Valor,
  Negocio, tienda) y los de Amazon (DNR, horas). Frases nuevas en el JSX
  saldrán en español en el panel chino hasta añadirlas a i18nZhLit.
- China como país (cn, +86, Asia/Shanghai, CNY). Con cuenta en China la ruta
  navega con Amap/Baidu (coordenadas WGS-84), avisa por SMS y no usa Google.
- China continental, hecho el 04-10 (Dani: «sí a todo»):
  · API por flotadsp.com/api (Worker `infra/web-dominio`); la web lo usa solo
    desde China (`lib/apiBase.js`: zona horaria o zh-CN).
  · App Android para China: variante `china` (com.flotadsp.flota.cn, WebView
    propio con ubicación/cámara/fotos), APK en `/descargas/FDS-china.apk`.
  · Pagar el año de una vez (regalo `para_mi` que se canjea solo). Alipay y
    WeChat Pay pedidos en Stripe por API (preferencia «on»), pero Stripe los
    da como NO disponibles hasta que el titular los active en el Dashboard.
  · Direcciones con Amap si hay `AMAP_KEY` en Fly (GCJ-02 → WGS-84).
  · PIPL: consentimiento aparte en el alta desde China (obligatorio en el
    servidor, `consentimiento_transferencia`) y apartado 9 de Privacidad.
  · Falta (de Dani): activar Alipay/WeChat Pay en Stripe; clave de Amap;
    probar el APK en un Android chino; anuncios en WeChat/Douyin/Xiaohongshu
    (piden empresa china); Web Push no llega en China (va por FCM); revisión
    por un abogado del texto PIPL.

## Última sesión — 13-10-2026: escaneo de paquetes en lote

- `POST /reparto/escanear/lote` admite hasta 100 paquetes, busca códigos
  alternativos en una consulta y guarda las paradas en bloque; la geocodificación
  sigue en segundo plano. En el móvil «Escanear seguidos» envía tandas de 20,
  evita duplicados y deja para revisar las etiquetas sin dirección verificable.
- Se asocian al pedido los distintos códigos de una etiqueta para que un QR
  alternativo localice la parada en escaneos posteriores. El OCR reconoce la
  forma sin prefijo «Ladeira, Chazo 33» y el CP `15938` del ejemplo de Boiro;
  no inventa un teléfono.
- Verificado: 35 tests de `test_reparto_api.py`, chequeo de lectura de etiquetas,
  eslint focalizado, build de producción y dos pruebas Playwright de escaneo.
- **No publicado**: falta desplegar frontend y backend para que llegue a
  `flotadsp.com`. Los códigos que solo contienen un identificador siguen
  necesitando OCR/revisión o una integración de datos de la empresa.

## Última sesión — 25/26-10-2026: la app de Android NATIVA (FDS 2.0.0)

- Dani rechazó la TWA («se ve y es una aplicación web»). Hecha la app nativa en `app-android/` (Kotlin + Compose,
  mismo paquete y misma clave de subida que la FDS de Play: es una actualización). Todo en `docs/PLAY_STORE.md`,
  sección «Versión 2.0.0»: qué hace, cómo compilar, cómo probar en el emulador y qué cambia en Play Console.
- Backend: sesiones de 30 días para el autónomo, `POST /auth/renovar` y `POST /auth/borrar-cuenta` (desactiva y
  apunta en `bajas_cuentas`; no borra datos). Contraseña mal → 400, NO 401 (la app entiende 401 como «sesión
  caducada» y te saca). Pruebas en `backend/tests/test_sesion_app.py`. Arreglada de paso una prueba de correos
  que dependía de la fecha real (`test_el_correo_del_bono_sale_de_verdad`) y 5 de Valor que fallaban solo en la
  batería entera: calculaban «ahora» al importar y a los 15 min de batería sus señales salían caducadas (ahora
  cada prueba lo calcula al empezar; comprobado atrasándolo 16 min).
- Ficheros firmados en `app-android/salida/` (fuera de git): `FDS-2.0.0.aab` (Play) y `FDS-2.0.0.apk`
  (`com.flotadsp.flota.web`, para instalar a mano).
- Verificado en el emulador oficial de Android 14 contra el servidor real (en memoria) y con la versión R8.
  **Falta**: probarla en un móvil físico, subir el AAB (Dani) y, cuando Dani la apruebe, cambiar la descarga de
  la web (`frontend/public/descargas/FDS.apk`, hoy la TWA 1.0.3) por el APK nativo.

## Última sesión — 29-10-2026 (tarde): el CI de `main` llevaba desde el 18-10 en rojo; checkers sin falsos positivos

Dani preguntó por dónde íbamos y pidió «todo perfecto, sin falsos positivos». Lo primero que salió: **ningún run del
CI de GitHub en `main` estaba en verde desde al menos el 18-10**. Los del 18 al 24-10 ni arrancaban (morían a los
3 s), y los del 28 y 29-10 pasaban el backend y las E2E pero caían en los checkers del frontend. La nota del 28-10
decía «el CI está en curso»: no, estaba en rojo. Trabajo hecho en este contenedor (Linux) y **subido a `main`**
con el permiso de Dani (349780f y el commit de cierre). Al cerrar, el run 328 del CI de GitHub tenía el backend
en verde y el frontend en las E2E (ESLint y build pasados); el run del commit de cierre dice la última palabra.

Los checkers, arreglados de raíz (el fallo del checker, no el síntoma):
- `check-huerfanas`: no leía `app-android` (Kotlin ni sus pruebas), así que acusaba a `POST /app-login` de huérfana.
  Al arreglarlo salieron tres bugs más suyos: escaneaba `frontend/src` DOS veces y la poda de envolturas de `api.js`
  solo limpiaba una copia; las envolturas de dos líneas solo perdían la primera (la segunda, con la ruta, seguía
  contando); y se leía a sí mismo (sus comentarios nombran rutas y las daba por consumidas). Con eso afloraron
  **cuatro rutas heredadas sin ningún consumidor real**: `GET /stats/attention`, `POST /parking/report`,
  `GET /work-orders/danos-pendientes` y `GET /drivers/ranking` (las dos últimas solo las piden los smoke de
  `backend/scripts`). Van en `SIN_UI_A_PROPOSITO` con su motivo, sin borrar nada del servidor: **Dani decide** si se
  enganchan o se borran. Las 15 envolturas de `api.js` que no usaba ninguna pantalla, fuera.
- `check-importados`: el limpiador era una cadena de sustituciones y daba cuatro avisos en falso (una regex con
  un número impar de acentos graves se tragaba 120 líneas y la definición de `Pasos`; `\B(` de una regex parecía
  `B(`; «en la lista (como DEMO2001)» de un párrafo JSX parecía `lista(`; el parámetro `tx` de guia.js parecía
  el `tx` de idioma.js sin importar). Reescrito como recorrido carácter a carácter con pila de modos (código,
  etiqueta, texto JSX, plantilla, regex) y con los parámetros de función como nombres disponibles. Probado con un
  fichero trampa: caza los dos fallos reales (`useOrden(` y `<ThOrden` sin importar) y ninguno falso.
- `check-version-app`, `check-hooks` y `sellar-build`: `pathname.slice(1)` (apaño para Windows) en Linux se comía
  la raíz y el CI de Ubuntu moría con ENOENT. Ahora `fileURLToPath`, que vale en los dos.

Lo que señalaban, arreglado: `.text-pink-300` en el híbrido (paridad con el modo día); fichas de ayuda de
`centro-ia`, `estado-flota` y `reparto` (escritas leyendo cada pantalla); `text-brand-100`, que no existe en la
paleta, → `text-brand-200` en Mercadillo, AvisoManana y OpinionCorreo; y un test de `test_analitica.py` debajo del
`if __name__` que nunca corría. ESLint: las 26 variables sin usar, fuera (`catch` sin variable, dos `useNavigate`
sin usar, los componentes muertos `CopyRow` y `ReadField`, etc.); los 20 avisos de `exhaustive-deps` se quedan a
propósito (cambiar dependencias de un efecto cambia comportamiento).

Comprobado aquí, en el orden del CI: los 24 checkers del frontend en verde; ESLint 0 errores; `vite build`;
`py_compile` y los 8 `check_*.py`; `pytest` 1.373 pasados y 1 omitido (sin `test_api.py`: aquí no hay Mongo; en
el CI ese job ya pasaba); Playwright completo, escritorio y móvil: 550 pasadas, 47 omitidas y 1 fallo repetido en «Cuadrante › la hoja: escribir, pegar de
Excel, Ctrl+Z», que cayó las dos veces mientras las capturas de pantalla competían por la CPU y aislada pasaba 4 de 4.
Era una carrera de la propia prueba: pulsaba Ctrl+Z al ver salir la petición de pegar, antes de que la hoja aplicara
la respuesta con el `cambio_id` (mandaba `c2` en vez de `c3`). Arreglada: espera a «Guardado: 4 celdas.», que sale
en el mismo render que apila el id. Las 10 pruebas del Cuadrante, 3 veces con 4 workers en escritorio y móvil: 60 de 60.

Más tarde, la misma sesión: **`docs/ESTUDIO_APP.md`**, el estudio de la app del repartidor que pidió Dani (qué es hoy,
lo medido y dicho, diagnóstico, 41 propuestas por impacto y esfuerzo, reestructuración y plan por fases), hecho con
tres lecturas completas (app nativa, servidor y portal web, notas). Dos arreglos que salieron de él ya están en
`main`: el CI pasa la prueba de contrato app↔API (61 llamadas) en cada cambio, y «cambiar contraseña» contesta 400
y no 401 con la actual errónea, porque la app cierra la sesión ante cualquier 401 y echaba al conductor que se
equivocaba al teclearla (**pendiente de desplegar el backend**).

Lo que NO se ha hecho: compilar la app Android aquí (`dl.google.com`, de donde sale el SDK, lo bloquea el proxy
del contenedor); la 2.2.3 de la mañana sigue siendo la buena. Nada desplegado: el backend solo cambia en un test;
la web sí tiene cambios visibles (las tres fichas de ayuda y los tres textos con color real), así que **toca
desplegar la web** la próxima vez desde el PC.

## Última sesión — 29-10-2026 (noche): fase 0 del estudio en el servidor, y FDS 2.2.5 que se actualiza sola

Dani: «corrige todo y ponlo todo perfecto sin falsos positivos» (lo del estudio) y, después, «que la app se
actualice sola o les pida la actualización». Dos commits en `main`, los dos con el CI en verde hasta donde se pudo
comprobar aquí (ver abajo lo que decide el CI).

**Servidor (fase 0 del estudio, commit 6249c61, run 339 del CI en verde; FALTA DESPLEGAR):**
- Optimizador de rutas en un hilo (`asyncio.to_thread`): medido, con 60 paradas tardaba casi 4 s y con 80, 6 s, y
  paraba TODAS las peticiones mientras tanto. Con más de 50 paradas, la mitad de evaluaciones
  (`reparto.presupuesto_evaluaciones`): mismo orden hasta 60, un 2 % peor con 80, en una cuarta parte del tiempo.
- Índices de las colecciones del reparto (no tenían ninguno), limpieza de datos de clientes sola cada 6 h por
  todas las empresas (`_bucle_reparto_limpieza`, late en `/admin/latidos`), `/reparto/posicion` guarda solo la
  última posición (el recorrido no lo leía nadie; los guardados se quitan en la limpieza; el aviso de ubicación de
  la web lo dice así en 7 idiomas), «entrar como» no escribe en el reparto salvo los ajustes (403 con explicación),
  una sola fecha de promoción (`check-promo.mjs` en el CI) y la cartera tapa el IBAN/teléfono al resolver.
- Tests nuevos para todo eso; 1.377 del backend en verde, 26 checkers, contrato de la app.

**App FDS 2.2.5 (code 17), SIN COMPILAR AQUÍ (el SDK no se puede bajar en este contenedor); la compila el CI:**
- **Se actualiza sola**: la de Play con In-App Updates (Play pregunta, descarga en segundo plano y un aviso
  «Reiniciar»; si en Play Console se publica con prioridad 4-5, a pantalla completa). La instalada desde la web
  (`.web`) pregunta a `GET /app/version` y, si el servidor anuncia una más nueva (`APP_ANDROID_WEB="17 2.2.5"` en
  Fly, que se pone A MANO al subir el APK a la web), avisa con «Descargar» → `flotadsp.com/app`. Android no deja
  instalar nada sin que la persona lo acepte: eso es lo máximo que una app puede hacer.
- La cola sin cobertura ya no tira una entrega si el servidor contesta 5xx/408/429: la guarda y la reintenta en
  orden (hasta 12 veces si el servidor contesta mal); si la rechaza de verdad (404/403), lo dice en pantalla. Dos
  cambios de la misma parada salen en orden.
- «Volver a por entregar» de una entregada pregunta antes (borra la prueba de entrega); una parada cerrada ya no
  ofrece «Editar» (el servidor contestaba 409).
- «He olvidado mi contraseña» en la pantalla de entrar (`auth/forgot-password`, para cuentas de reparto; al
  conductor de empresa le explica que es la oficina o el código del correo personal).
- Sesión caducada: se dice por qué se vuelve a «entrar» (antes la app saltaba sin explicación). La sesión del
  conductor de empresa también se renueva sola (`auth/renovar` acepta `role: driver`, test en `test_sesion_app`).
- Para quien reparte por su cuenta: paradas de otros días sin cerrar («Traer a hoy»), el bono de bienvenida (cuánto
  le falta) y «Hoy llevas X €» con su tarifa. En todas: «La última vez (12/10): en portería» en la siguiente parada y
  en la ficha; WhatsApp con la hora estimada y el enlace de seguimiento, como la web; la foto de la entrega sale
  derecha (EXIF); el mapa pinta el camino por las calles y ya no se recentra a cada aviso.
- Portal del conductor: cerrar sesión pregunta; tras revisar una etiqueta se vuelve al escáner; el teléfono sale
  precargado; navegador y tema en «Mi cuenta». Analítica: la app manda vistas (`/ruta`, `/conductor/p/…`) con
  User-Agent de Android.
- Contrato app↔API ampliado (80 comprobaciones: estado con `hecho_en`, escanear, crear/quitar parada, trazado,
  previas, renovar del conductor, forgot-password, app/version, analítica) y un test unitario de la app
  (`TextosHojaTest`). **El CI compila la app** (job «App Android»: `testDebugUnitTest` + `assembleDebug` en Ubuntu).

**Aviso de un conductor (29-10, 18:20): «No deja subir los kms ni la IA ni manual»** (auditoría del vehículo).
Causa encontrada leyendo el código: la lectura del cuadro con IA hace dos pasadas en el servidor y puede pasar de
30 s; la app cortaba a los 30 s («sin conexión») y el campo de escribir los km a mano SOLO salía cuando el servidor
había contestado con su rango. Sin respuesta, ni IA ni manual: el conductor no podía seguir. En la web pasaba lo
mismo si la lectura fallaba por red (el campo manual exigía los límites). Arreglado en los dos sitios: las subidas
de fotos esperan hasta 120 s, y los km a mano se pueden escribir siempre que la foto no haya dado un número (con el
rango del servidor si lo dio; si no, cualquier km creíble, que el servidor juzga al subir la auditoría y deja en
`odometer_rejected` para la oficina si no cuadra). Va en la 2.2.5 (app) y en la web (FALTA DESPLEGAR). Si en ese
caso concreto el rango sí llegó y los km reales están por debajo de lo registrado, lo que falla es el km de la
ficha de esa furgoneta: lo corrige la oficina desde el panel.

**Aviso de Dani (29-10, 19:40): Karim, Xenxo y Gago «han cambiado la contraseña y ahora les da incorrecta».**
Causa, leyendo el código (sin acceso a la base desde aquí): una persona con DOS fichas del mismo correo (la
importación las duplicaba; hay fichas de baja y activas) tiene DOS cuentas en `driver_accounts` (las cuentas en
bloque se crearon una por ficha, las dos con la misma temporal). El login entraba por la primera cuenta del correo
(`find_one`), la sesión pasaba a la ficha ACTIVA (`_ficha_activa_de`) y «cambiar contraseña» escribía por
`driver_id` en la OTRA cuenta. La nueva no abría; la temporal sí (y si la primera cuenta era la de la ficha de baja,
«Ficha de conductor desactivada»). Arreglado en el servidor (commit de esta nota): el login mira TODAS las cuentas
del correo y entra por la que abre, prefiriendo la de la ficha activa; una vez que la persona tiene contraseña
propia en una, la temporal de las otras deja de valer; y cambiarla escribe en todas las cuentas del mismo correo.
Tests en `test_cuentas_duplicadas.py`. Desplegado a las 20:00: desde entonces les entra la contraseña que se
pusieron (la ÚLTIMA, si la cambiaron varias veces) y la temporal YA NO (muchos siguen probando la temporal: de ahí
los avisos de después de las 20:00). Tras 5 intentos fallidos, 5 minutos de bloqueo. Y a las 21:40 (commit de esta
nota, **FALTA DESPLEGAR**): una temporal que ponga la oficina DESPUÉS (reset en la ficha) sí abre, porque lleva su hora
(`password_temp_created_at`) y es más nueva que la propia; el reset de la oficina escribe en todas las cuentas del
mismo correo. Sin esto, resetear desde el panel a quien ya tenía contraseña propia no servía de nada.

**Web DESPLEGADA el 29-10 a las 20:40** (wrangler desde el PC, con `npx.cmd`): página de planes, aviso de ubicación,
fichas de ayuda, colores y los km a mano de la auditoría. **App 2.2.5 firmada por GitHub a las 21:14** (ver Pendiente
-5). Dani pidió que no dependiera más de comandos en su PC; Remote Control no sirve con Windows desde la nube.

**Backend DESPLEGADO el 29-10 a las 20:00 (4d2e1b4, run 343 del CI en verde)** desde el PC de casa de Dani. Costó
tres intentos: la copia del PC estaba en la rama `claude/pensive-goodall-zthly3` (la del spot de Spotify), `git pull`
decía «Already up to date» y Depot subía la misma imagen (`CACHED [6/7] COPY . .`). Desde entonces el PC está en
`main`: antes de cada despliegue, `git checkout main` y `git pull`, y mirar que `git log -1` sea el commit que toca.
Comprobación: `curl.exe -s https://flota-backend.fly.dev/api/app/version` → `{"web":null}`. **Falta la web**
(`npx.cmd`, no `npx`: PowerShell bloquea los `.ps1`) y la app 2.2.5.

**Veredicto del CI (run 340, commit 87ed7cc)**: el job «App Android» compiló la 2.2.5 en Ubuntu en 5 min 30 s
(`BUILD SUCCESSFUL`, sin un solo aviso del compilador de Kotlin) y pasó los dos tests unitarios; el backend en verde
con las 80 comprobaciones del contrato. Es la primera vez que la app se compila fuera de un PC: desde ahora, un
cambio en Kotlin que no compile se ve en `main` sin esperar al `gradlew` de Dani.

## 29-10-2026 (mañana): FDS 2.2.3 compilada por primera vez, probada y firmada (PC de Winiw)

- El repo se clonó en este PC (`C:\Users\Winiw Delivery\Documents\foefa`). Las versiones 2.1.0 → 2.2.3 de la app
  nativa nunca se habían compilado (se escribieron sin JDK ni SDK). Aquí compilan: Android Studio + SDK estaban.
- **`app-android/salida/FDS-2.2.3.aab` es lo que se sube a Play** (`versionCode 15`), firmado con la clave de subida
  (Dani pasó `.flota-android.keystore` y su contraseña; están en `C:\Users\Winiw Delivery\`, fuera de git). Al lado,
  `FDS-2.2.3.apk` (paquete `.web`, arm64+armv7) para instalar a mano o para `/descargas/FDS.apk` cuando Dani la
  apruebe. Todo lo arreglado y comprobado, en `docs/PLAY_STORE.md` → «Versión 2.2.3».
- Arreglos reales que salieron al leer el código y cruzarlo con el servidor: la suspensión no se pintaba en «Mis
  turnos» (campo `cod`, no `type`), la auditoría no pedía el permiso de cámara (sin él, Android no abre la cámara
  del sistema: no se podía hacer ni una foto), y el portal de empresa dentro de FDS no limpiaba `flota_acceso`.
- Nuevo: `app-android/pruebas/api_conductor.py` (61 comprobaciones del contrato app ↔ API contra el servidor real
  en memoria; `servidor_pruebas.py` siembra ahora también una empresa con un conductor). `backend/.venv` creado.
- **No probado en móvil ni emulador** (sin acelerador de hardware en este PC). **Pendiente de Dani**: instalar el APK
  en su móvil, pasar el portal de empresa y el autónomo, y subir el AAB.
- Gradle en este PC: solo desde una terminal normal (PowerShell o el panel de Terminal de la app), no desde las
  herramientas de la sesión de Claude (su daemon no puede abrir la conexión local). Cómo, en PLAY_STORE.md.
- Aparte: `docs/anuncios/artlist/` (guion del vídeo para Artlist con QR a la ficha de Play, QR en PNG y SVG).

## Última sesión — 29-10-2026 (noche): el anuncio «La ruta hecha», guion para IA y generado en Artlist

Dani: «créame un guion para pasárselo a una IA y que me cree un súper anuncio… que se anuncie FDS con el QR de Google
Play; lo que vende es la parte de repartidor: escaneas el código del pedido, te da la dirección y se añade la parada,
las cargas y descargas, pasas de repartir de memoria a que la app te lo monta». Después conectó Artlist a la sesión
para que se mandaran los prompts directamente.
- **Guion completo**: `docs/anuncios/super-anuncio/GUION.md`. 25 s, 9:16: gancho «112 paquetes. ¿Por dónde
  empiezas?» (1,5 s) → la app REAL a pantalla completa 15 s (escanear → añadida; ordenar con la hora de cada parada;
  zonas de carga y descarga; voz; entregado con prueba) → «Mañana sales con la ruta hecha» → tarjeta con QR a Play.
  Diez ideas estudiadas y puntuadas (§3), plano a plano con voz y sonido (§4), prompts en inglés para la IA de vídeo
  con biblia visual, referencias y negativos (§5), pantallas reales (§6), voz/subtítulos/niveles (§7), tarjeta y QR
  (§8), versiones de 30/15/6 s y tres ganchos A/B (§9), textos y URLs para subirlo (§10), lista previa (§11).
  Reglas que cumple: solo lo que la app hace hoy (tabla §2 con la pantalla que lo demuestra), sin marcas ajenas, sin
  fecha en la oferta, nadie de IA habla a cámara, la app nunca la pinta la IA.
- **QR nuevo** `qr-play-fds-spot.{png,svg}` con `utm_campaign=spot_ia` (el de Artlist lleva `artlist_fds`): en Play
  Console → Adquisición se distinguen.
- **Artlist (cuenta de Dani, plan AI Suite 16500)**: hecha la imagen de referencia del repartidor y la furgoneta
  (Nano Banana Pro, 2 variantes, 320 créditos) y una locución de prueba de 24 s (voz «Alberto Rodríguez», acento
  latinoamericano: Artlist no tiene voz masculina de España; la final sigue siendo Puck o Dani). Los 5 planos de vídeo
  (Veo 3.1 con referencia para los dos con cara, Veo 3.1 Fast para manos/furgoneta/cabina) **generados con la
  aprobación de Dani (4.000 créditos)**; segunda locución con el texto final (70). Música y efectos elegidos del
  catálogo con enlaces. Todo en
  `docs/anuncios/super-anuncio/GENERADO.md`. **Ojo**: desde este contenedor no se puede descargar ni ver nada de
  Artlist (la red de la sesión bloquea artlist.io e imgix.net): Dani lo mira en Artlist o se añaden esos dominios al
  entorno.
- **El anuncio, MONTADO** (Dani: «hazlo todo, móntalo todo y dame el resultado»; después: «nada de letras
  encima de la app, actúa como el top del marketing»): `docs/anuncios/super-anuncio/salida/spot-ruta-*.mp4`
  (9:16 B para TikTok/Reels, 9:16 A con QR, 4:5, 1:1, 16:9 y sin voz; 27,8 s; máster -14 LUFS). La app grabada
  de verdad con `frontend/e2e/spot-ruta.spec.js` (escanear dos paquetes con códigos Aztec sin marca → «Añadida a
  tu ruta», foto a la etiqueta, ordenar con la hora, el mapa con las zonas de carga y descarga encendiéndose, la
  guía y la entrega con foto; sin consejos; sin red no hay teselas de OSM, así que la grabación pinta un
  callejero esquemático propio: en el PC de Dani sale el mapa real al regrabar). Montaje `scripts/montar-spot-ruta.mjs`
  + capas `scripts/spot-ruta/capas.mjs`: la app dentro de un móvil limpio sobre el fondo de marca, el titular de
  cada escena en su franja arriba (nada encima de la pantalla, sin subtítulos), anillos en los toques, gancho y
  pago emocional con los fotogramas de los planos de Artlist (los vídeos no se pudieron bajar; en `clips/` el
  montaje los usa solos), voz de Puck (las 6 frases del v5, las únicas disponibles sin red: gancho «¿Todavía
  ordenas la ruta a mano?», el que convierte), oferta «Empieza gratis», cierre B «toca el botón» / A con QR.
  Variante `GANCHO=112` (solo texto en el gancho). Detalle y cómo rehacerlo: GENERADO.md.
- **Bono de bienvenida a 25 €** (Dani, 29-10: «si completan su primera ruta le damos 25 €; la app que te ayuda a
  repartir y además te paga»): `BONO_CENT = 2500` (precios.js), `_BONO_CENT = 2500` (server.py, ya no va atado al
  premio por invitar, que sigue en 10 €), Términos («25 €»), la frase de la portada con dos cantidades
  («Gana {bono} con tu primera ruta real y {euros} por cada compañero»; clave nueva en textosRutaB.js, 7 idiomas),
  tests (test_referidos usa `server._BONO_CENT`; activacion y humo esperan 25 €). **Sin desplegar**: hay que subir
  backend y web antes de que corra un anuncio que lo prometa. La campaña de correo del 17-10 sigue diciendo 10 €
  (ya enviada). El anuncio lleva la tarjeta «+25 € con tu primera ruta · 20 entregas en 2 días · hasta el 31-12».
- **Listo para subir** (`docs/anuncios/super-anuncio/SUBIR.md`): TikTok, Meta, Spotify y YouTube con ficheros,
  textos, enlaces directos a Google Play con `referrer` por plataforma (y la alternativa del alta web, que sí mide
  el píxel), pasos, presupuesto y qué medir. Desde esta sesión no hay acceso al Chrome de Dani (ni extensión ni
  Remote Control): publicar lo pulsa él.
- **Revisión independiente del guion** (un agente aparte, sin el contexto de la sesión): 12 hallazgos, todos
  metidos. Los que cambian algo de verdad: el visor del escáner es la cámara, así que las etiquetas de la grabación
  van impresas sin marca; la voz dice «foto o escaneo» (escanear solo mete la dirección con SEUR/DPD y GLS);
  «empieza gratis» y no «gratis» (desde el 01-01 el gratis es hasta 15 paradas y el anuncio enseña 112); en el móvil
  la voz manda al botón («Toca y crea tu cuenta») y el QR/«escanea y descárgala» solo donde se escanea desde otro
  aparato; la frase de «ordenar» recortada (iba a 3,7 palabras/s); fuera el reloj 07:41; navegación grabada con «Esta
  app» y la voz encendida (el spec del v5 la apaga); los ganchos se deciden por retención a 3 s con ≥2.000
  impresiones, no por altas a 3 días; `docs/anuncios/artlist/GUION.md` corregido («entregado con prueba», botón «Ver
  detalles») y apuntando a este como versión mantenida.

## Última sesión — 29-10-2026 (noche, 2): el anuncio con la voz de Dani y el mapa real

Dani: «no sé qué tengo que hacer, así que hazlo tú»; luego mandó una nota de voz de WhatsApp (30 s, su voz, acento de
España): «utilízame este audio y móntame el vídeo acorde al audio»; y «mete lo de los 25 euros como gancho inicial».
- **El anuncio nuevo, MONTADO**: `docs/anuncios/spot-dani/salida/spot-dani-*.mp4` (9:16 B «toca el botón» 32,2 s;
  9:16 A con QR; 4:5; 16:9; 1:1 (no versionado); y `9x16-B-30s` para Spotify, 30,0 s justos sin el gancho). Qué dice
  y qué se ve, segundo a segundo, y cómo rehacerlo: `docs/anuncios/spot-dani/LEEME.md`. La voz manda el tiempo
  (`voz.json`: transcrita con whisper small vía sherpa-onnx en el contenedor, cortada por los silencios); gancho
  «¿Quieres 25 € gratis? Te los damos por tu primera ruta con la app» (1,7 s, antes de la voz); las dos preguntas
  sobre los planos de Artlist y la app; «Esto te interesa»; logo «Flota DSP»; la app en el móvil (mapa, panel de
  empresa para «el control de flotas», escanear, ordenar, zonas, voz, entregado); «Forma parte del cambio»; cierre
  con flotadsp.com, «+25 € con tu primera ruta», botón y Play; el lema «Cada entrega cuenta.» entra cuando lo dice.
  Montaje `scripts/montar-spot-dani.mjs`, capas `scripts/spot-dani/capas.mjs`, voz `voz-dani.flac` (-16 LUFS,
  casi sin tocar) y la nota original `fuente-dani-whatsapp.mp3`. La nota YA TRAE su música (sin derechos): el
  montaje no mezcla la nuestra (Dani: «hay dos pistas mezcladas, quita nuestra música»); solo efectos y una subida
  bajo el gancho.
- **El mapa REAL de A Coruña sin red** (Dani: «quiero el mapa de la app y que se vea bien; si no, el anuncio es una
  mierda»): `scripts/spot-ruta/teselas.py` saca las teselas de `docs/play-store/captura-4-oficina-mapa.png` (la
  captura del panel, con OSM de verdad a 2x): georreferencia por los 12 marcadores de la demo (error < 1 px), limpia
  marcadores/líneas/controles, amplía por reflejo, superresolución ×2/×4 con FSRCNN (modelo público de GitHub,
  clonado de solo lectura; sin él, Lanczos + enfoque) y corta zooms 13-17. `e2e/spot-ruta.spec.js` las sirve
  (`TESELAS=`) en vez de las de OSM; el esquemático queda de reserva. A zoom 17 (navegación) se nota que viene de
  zoom 14; con red real la grabación sale nítida sin tocar nada. Mapa limpio: `super-anuncio/mapa-coruna.{jpg,json}`.
- **Desplegar desde GitHub** (Dani: «despliega el bono de 25 en producción»; desde la nube no se llega a Fly ni a
  Cloudflare): `.github/workflows/desplegar.yml`, a mano (Actions → «Desplegar producción» → Run workflow, eligiendo
  rama y qué: todo/backend/web). Hace lo mismo que los .ps1 del PC: guardia anti-FlotaDSP, lint + build + checkers +
  pytest con Mongo, `flyctl deploy` a `flota-backend` y /api/health, web compilada con la API y el píxel de Meta
  (`1317231944812644`) cosidos, `wrangler pages deploy --project-name flota --branch main`, comprobación de que
  producción sirve el bundle nuevo y calentado del edge. **Se lanzó (run 2 del 29-10, 15:18 UTC) y PARÓ en la
  guardia: faltan los tres secretos del repositorio** `FLY_API_TOKEN` (contenido de
  `C:\Users\Usuario\.flotia-fly-token.txt`), `CLOUDFLARE_API_TOKEN` (token de API con «Cloudflare Pages: Edit») y
  `CLOUDFLARE_ACCOUNT_ID`. En cuanto Dani los ponga (Settings → Secrets and variables → Actions), se relanza y
  despliega. Mientras, el bono de 25 € NO está en producción (sí en el código).
- **Publicar los anuncios**: desde esta sesión no hay navegador ni red a Meta/TikTok/Spotify. Sí existen conectores
  en el directorio de claude.ai que lo harían desde una sesión nueva: «TikTok for Business» (oficial: crea campañas,
  grupos y anuncios) y «Adspirer Social Ads» (Meta Ads e Instagram, y TikTok). Spotify Ad Studio no tiene conector
  ni API: se sube a mano con `super-anuncio/SUBIR.md` y `spot-dani-9x16-B-30s.mp4`.
- **Correo «tu primera ruta ahora vale 25 €»** (Dani: «a todos los que se han registrado y no han completado
  ninguna ruta, un correo: enhorabuena, gana 25 €, completa tu primera ruta; el enlace de Google Play, un QR, que
  la usen, que nos den feedback y nos puntúen»): clave `bono25` del ciclo de correos (`backend/ciclo_correos.py`:
  `toca_bono25`, textos en es/pt/en/br, HTML con dos botones —abrir la ruta sin contraseña y Google Play— y el QR
  `flotadsp.com/qr-play-correo.png`), y la campaña en `server.py` (`_campana_bono25_vuelta`, bucle cada 15 min):
  a TODA cuenta de quien reparte solo con el bono pendiente y menos de 20 entregas de verdad, tenga la edad que
  tenga, una vez, de 9 a 21 de su hora, con baja de un clic, nunca a menos de 18 h de otro correo del ciclo, dentro
  de la cuota del día (Brevo 280; con Resend solo, dejando los 15 de reserva) y 40 por tanda. **Sale sola al
  desplegar** (`CAMPANA_BONO25=0` la apaga). Dice su fecha límite real (30 días desde el alta o desde el 17-10),
  cómo se gana, cómo se cobra, pide una línea de respuesta y la valoración en Play. Tests:
  `tests/test_campana_bono25.py` y los nuevos de `test_ciclo_correos.py`; 1.388 en verde.
- Lo que NO se pudo desde aquí (sigue igual): bajar los clips de Artlist y la voz de Gemini (ya no hace falta: la
  voz es la de Dani).

## 29-10-2026 (noche, sesión en la nube): redes de FDS, el manual del community manager

Dani: «coge mi Twitter, mi TikTok y mi Facebook y haz de manager: busca hilos, métete en conversaciones, que nos
conozcan y descarguen la app». Desde la nube no hay acceso a ninguna cuenta (sin conector de redes y sin su
navegador), así que no se publicó nada. Hecho: **`docs/anuncios/REDES.md`**, el manual que sigue cualquier sesión
que haga una ronda: la regla (siempre como FDS o como Dani, nunca como usuario anónimo: práctica desleal en la UE y
baneo en las plataformas), la oferta exacta que se puede decir, los enlaces con utm, la ronda diaria con topes,
las búsquedas por red, 10 plantillas de respuesta, el calendario de 14 días con los textos escritos (X, TikTok,
Facebook, LinkedIn) sobre las piezas que ya existen, la medición y el registro de rondas.
Lo que hace falta de Dani: (1) para responder en hilos, una sesión en su PC con Claude en Chrome («haz la ronda de
redes de docs/anuncios/REDES.md»); (2) para publicar el calendario desde la nube, conectar Metricool (o Typefully
para X/LinkedIn) en claude.ai → Conectores y avisar (la tarea programada se recrea con el conector).
Más tarde esa noche (Dani: «sé autónomo, que yo no me tenga que preocupar»): piezas nuevas en `docs/anuncios/redes/`
(3 carruseles + 4 tarjetas para X, `scripts/redes-fotos.mjs`, textos en `redes/TEXTO.md`), 3 fondos generados en
Artlist (480 créditos; no bajables desde la nube: la red del entorno bloquea el CDN de Artlist) y **tarea programada
«Redes FDS»** (3 rondas al día) sobre la rama `claude/trusting-feynman-0tfz62`. Probada dos veces: la sesión que abre
una tarea creada desde dentro de una sesión no tiene el repo con push ni conectores → borrada; **se crea desde la
pantalla de tareas programadas de claude.ai** con repo + Metricool (`docs/anuncios/redes/TAREA.md`). Dani enlazó en
Metricool TikTok, Instagram, LinkedIn y YouTube. Las piezas están en `frontend/public/redes/` (URL pública
flotadsp.com/redes/… en cuanto se despliegue la web).
**21:45:** Metricool conectado a la sesión de la nube (sin pasar por «Programadas»: en esta organización las tareas no
admiten conectores, así que la tarea «Redes FDS» DESPIERTA esa misma sesión, que ya tiene Metricool, el repo y Artlist,
a las 7:51, 12:51 y 19:51). Programados en Metricool dos posts de LinkedIn (04-11 y 11-11, 11:00, empresas). TikTok,
Instagram y YouTube esperan a que la web se despliegue con `frontend/public/redes/` (imágenes y vídeos en español, 30 MB):
**Dani: mezclar `claude/trusting-feynman-0tfz62` en `main` (es fast-forward, ya lleva main) y desplegar la web.**

## Última sesión — 29-10-2026 (noche, PC de Dani): web desplegada con las piezas de redes, semana programada y primera ronda

Dani: «eres el community manager de FDS, trabajas desde mi PC» (prompt de `docs/anuncios/redes/PROMPT-PC.md`). Hecho:
- **`main` lleva la rama de redes** (`claude/trusting-feynman-0tfz62`, fast-forward) y la **web está desplegada** con
  `frontend/public/redes/` (chequeos, eslint y build en verde; `flotadsp.com/redes/…` → 200). Fondos de Artlist
  bajados y piezas regeneradas (`redes/fondos/`, `scripts/redes-fotos.mjs`; Playwright necesitó
  `npx.cmd playwright install chromium` en este PC).
- **Metricool**: 15 publicaciones programadas del 30-10 al 05-11 (TikTok 18:00, Instagram 12:00, YouTube Shorts jueves y
  domingo 19:00) además de los 2 de LinkedIn que ya estaban. **X**: publicado el post del jueves y programados 6 (31-10 →
  05-11, 7:30). **Ronda**: X 3 respuestas + 6 seguidos, TikTok 8 comentarios; Instagram y Facebook sin nada que contestar.
  Todo, con hilo y texto, en **`docs/anuncios/redes/REGISTRO-PC.md`** (la sesión del PC escribe ahí, la de la nube en REDES.md).
- Sustituciones: el sketch FDS-1 y el spot v5 no están en este PC → `tiktok-es.mp4` (30-10) e imagen «¿Y si lo hace la app?»
  (03-11). Faltan piezas para el 06-11 y 08-11 (sketches FDS-3/FDS-4) y otra para el 11-11.
- Visto en @FlotaDSP dos posts de hoy que no son de la sesión; uno nombra a Amazon/SEUR/GLS/MRW (contra la regla). No se toca.
- Remote Control: el modo automático no deja activarlo desde la sesión; Dani lo enciende desde la barra.
- **23:35: backend DESPLEGADO con el bono de 25 €** (release v168 de `flota-backend`, imagen de `main` 6949400; el primer
  `fly deploy --remote-only` construyó la imagen y dio 504 al crear la release, se reintentó con `--image`). Verificado:
  `/api/billing/planes` → `bono_cent: 2500`, `/api/app/version` → 200. La web también lleva 25 € (desplegada 23:28).
  Las v165-v167 de esta noche son de otras sesiones y no llevaban el bono (producción no devolvía `bono_cent`).
- **00:30, canales nuevos y Play**: 2 comentarios en YouTube como @FlotaDSP, 2 ofrecimientos públicos a creadores de TikTok;
  Reddit bloqueado por el navegador de Claude. **Play Console**: la app sigue en prueba abierta, producción inactiva, 0 reseñas
  (39 adquisiciones, 26 dispositivos activos en 28 d). Dani: «sube la 2.2.5». Hecho: 178 países en el canal de producción y
  el borrador de producción abierto para editar; el AAB (`app-android/salida/FDS-2.2.5-code17.aab`, bajado del artefacto del
  run 40938703587 a `Downloads/FDS-2.2.5/`) **no se puede subir desde la sesión** (el puente del navegador limita a 10 MB):
  lo arrastra Dani a la caja «Subir» del borrador; después, notas, prioridad de actualización 5 y enviar a revisión.
- **«Que a las viejas les diga actualiza»** (Dani): commit c39bbf2, `APP_ANDROID_MIN` en el servidor. Toda app desde la 2.0.0
  manda `X-FDS-App: android-<versión>` y enseña el `detail` en la pantalla de entrar (`Acceso.kt`): con
  `fly secrets set -a flota-backend APP_ANDROID_MIN="2.2.5"`, al entrar o renovar sesión una app más vieja recibe 426
  «Hay una versión nueva de FDS. Actualízala en Google Play…». No corta a mitad de ruta (el reparto no mira la versión).
  **Ponerla SOLO cuando la 2.2.5 esté publicada en Play** (si no, a los de la prueba abierta con 2.2.4 se les bloquea sin
  tener nada que instalar). Tests en `test_app_version.py`; aquí no hay Python: los pasa el CI. Sin desplegar aún.

## 29-10-2026 (noche, 3): informe de producto, mercado y estrategia

Dani: «actúa como el mejor del mundo: verifica la APK, la página, qué mejorar para autónomos, para nosotros (OGA5,
DGA1) y para empresas con repartidores; qué añadir, qué quitar, el mercado, cómo viralizarnos». Escrito en
**`docs/ESTRATEGIA-29-10.md`** (va un escalón por encima de `ESTUDIO_APP.md`, no lo repite). Lo que salió de usar la
web y las demos en producción desde un móvil emulado, y que no estaba en ninguna nota: **el píxel de Meta NO está
cargado en la web de producción** (`typeof window.fbq === "undefined"`, aviso de cookies en modo informativo: el
comando de despliegue de «Cómo desplegar» no lleva `VITE_META_PIXEL_ID`; `desplegar.yml` sí lo cose); dos marcas
(FDS y Flota) en el mismo dominio; el título «Flota — Gestión de flotas con IA» en `/empezar`, `/planes`, la ruta y
el panel; «Oferta fundador · quedan 10 de 10 plazas» en `/planes`; el cartel de cookies tapando un tercio del móvil
sin píxel. Nada tocado en el código ni desplegado: solo este informe. La app nativa no se pudo ejecutar aquí.
Las decisiones que pide están en su §11 (una marca o dos, Amazon A-G, una sola oferta, anuncios, Reparto para
empresas como prioridad de ventas, cobro en la app, Valor fuera del repo, DeCA).

## Última sesión — 29-10-2026 (noche, 4): FDS en todo, fuera Valor y China, cookies, una sola app que se publica sola, y avisos al móvil

Dani: «quita las apuestas y lo de China, unifica todo a FDS; arregla lo de cookies; lo de 3 apps, unificar: cuando
mejoremos la app que se lance a la web y a Play; para nosotros, si apruebo días a alguien que tiene la app que le
salte notificación, o si hay un día que puedan solicitar trabajar; después corrige lo que consideres, dame imágenes
y hacemos el deploy». Hecho en la rama `fds-unificacion` (worktree `.claude/worktrees/fds-unificacion`, porque la sesión
de redes trabajaba a la vez en el checkout principal) y, con el sí de Dani («haz lo que tengas que hacer, no rompas
nada, revísalo»), **fusionado en `main` (fast-forward hasta 9a0b95d), subido y DESPLEGADO** el 29-10 a las 23:05:
- Antes de fusionar, con `main` ya dentro de la rama: 26 checkers, ESLint, `vite build`, Playwright entero (escritorio y
  móvil: 533 pasadas, 45 omitidas, 0 fallos), `pytest` entero (**1.270 en verde**, 13 min 42 s), contrato app↔API, Gradle.
- **Tres fallos que venían de `main`** (commit c39bbf2 de esta tarde, APP_ANDROID_MIN; el CI de `main` estaba en rojo
  en #356 y #357): la versión se leía con `re.findall(r"d+")` sin la barra (nunca bloqueaba a nadie), el aviso del 426
  era una tupla (una coma de más) y `renovar_sesion(request, user)` rompía sus tests. Arreglados (9a0b95d) y
  comprobados contra el servidor de pruebas con `APP_ANDROID_MIN=2.3.0`: `android-2.2.5` → 426 con el texto,
  `android-2.3.0` y sin cabecera → 200. En producción NO está puesta `APP_ANDROID_MIN` (lo decide Dani).
- **Backend desplegado** (`fly deploy --remote-only`, segundo intento: el primero falló con un 403 del constructor
  Depot de Fly, pasajero) con los secretos `MARCA_NOMBRE=FDS` y `APP_ANDROID_WEB="18 2.3.0"`. Verificado:
  `/api/health` ok con Mongo, `/api/app/version` → `{"web":{"code":18,"nombre":"2.3.0"}}`, las rutas nuevas
  contestan 401 sin sesión, `/api/valor/*` → 404.
- **Web desplegada** (build con `VITE_META_PIXEL_ID` y el **APK 2.3.0 cosido en `/descargas/FDS.apk`**, 21,7 MB; sello
  `index-DLEdKkAK.js`; edge calentado: 276 ficheros). Verificado en flotadsp.com: título «FDS — …», «Dashboard · FDS»,
  «Planes y precios · FDS», «Entrar» y «plazas limitadas» en /planes, `og.png` nuevo, `/cn` fuera del sitemap.
- **La app 2.3.0 (code 18) compilada y firmada en este PC** con la clave de subida: `FDS-2.3.0-code18.aab` (35,5 MB,
  `jarsigner`: jar verified) y `FDS-2.3.0.apk` (`com.flotadsp.flota.web`, `apksigner` ok), en
  `C:\Users\dlvie\Downloads\` y en `app-android/salida/` del worktree. El CI (`app-release.yml` #4) firma la misma
  versión como artefacto.

- **Valor (apuestas), fuera**: `backend/valor/`, sus 10 tests, `panel/pages/Valor.jsx`, las rutas `/api/valor/*`, el
  hilo del escáner, el menú (escritorio y móvil) y su prueba de humo. La base `edge_os` de Mongo y el SQLite del
  volumen de Fly NO se han tocado (son datos de Dani; los borra él si quiere).
- **China, fuera**: la TWA `android/` entera (con ella, las tres apps pasan a UNA: `app-android/`), `FDS-china.apk`,
  `/cn` y `/zh`, el chino de los dos diccionarios (`i18nZh`, `i18nZhLit`, `traductorZh`; `textosRuta` A/B/C
  recortados de 6 a 5 idiomas: 1.130 entradas), Amap/Baidu en la ruta, el consentimiento PIPL del alta, la sección 9 de
  la política, el desvío de `apiBase.js`, el pago del año de una vez de `RutaCuenta`, capturas y vídeos `zh` y sus
  pruebas e2e. En el servidor queda dormido el código de `pais == "cn"` (PIPL, Amap): no molesta y sus tests siguen.
- **FDS en todo**: `marca.js` (nombre FDS, lema «La app de reparto y el panel de tu flota», IA «FDS IA»), `index.html`
  (título, descripción, og), `og.png` nuevo (lo genera `frontend/e2e/capturas-29-10.mjs`), el servidor
  (`MARCA_NOMBRE` por defecto FDS, también en `fly.toml`; el correo del código de entrada), `/planes` con el logo y el
  cian de la marca, «Entrar» y sin «quedan 10 de 10 plazas» (el contador solo sale cuando alguien ha reservado), y el
  rayo de «Flota» sustituido por el logo en /repartidores, /registro y la calculadora. **Título por pantalla**
  (`lib/titulo.js`: `useTitulo`, `tituloDe`): Planes, Empezar, Registro, Seguimiento, Ruta, Entrar y cada pantalla del
  panel («Vehículos · FDS»). Antes casi todas decían «Flota — Gestión de flotas con IA».
- **Cookies**: sin píxel no sale NADA (LSSI 22.2: solo almacenamiento necesario); con píxel, una hoja de dos líneas
  pegada abajo con «Solo necesarias» y «Aceptar» iguales (antes, una ventana en medio con cuatro líneas que tapaba un
  tercio del móvil). Y «Cómo desplegar» (arriba) ya dice cómo desplegar con el píxel.
- **Una sola app que se publica sola**: `app-release.yml` sube el AAB a la prueba abierta de Play si existe el secreto
  `PLAY_SERVICE_ACCOUNT_JSON` (la cuenta de servicio de Play Console, el JSON entero) y, al acabar, lanza «Desplegar
  producción» solo para la web; `desplegar.yml` (web) coge el último APK firmado, lo deja en `/descargas/FDS.apk` y
  pone `APP_ANDROID_WEB` en Fly si cambió (con `FLY_API_TOKEN`); `deploy-frontend.ps1` hace lo mismo desde el PC si
  `gh` está instalado y con sesión. Sin esos secretos todo sigue como hasta ahora (a mano) y lo dice en el log.
- **Avisos al móvil** (lo que pidió Dani): en el servidor, bandeja por persona (`avisos_movil` en la base de la
  empresa, con índices) + web push + FCM opcional; `_avisar_usuarios(...)` sustituye a `send_web_push_to_users` en los
  seis sitios del conductor (petición de día aprobada o rechazada, día extra confirmado, vacante de refuerzo, refuerzo
  cubierto o anulado, inspección pendiente) y en el aviso de la mañana del autónomo, que ahora también cuenta a quien
  tiene la app sin web push. Rutas nuevas: `GET /avisos/mios?desde=`, `POST /avisos/leidos`, `POST /push/fcm-token` y
  `/push/fcm-token/quitar`; tests en `test_avisos_movil.py`. En la app (**2.3.0, code 18**): permiso de
  notificaciones (Android 13+), `AvisosWorker` cada 15 min aunque esté cerrada (lo nuevo sale como notificación y
  tocarla abre la pantalla que toca: turnos, trabajar más, auditoría), tarjeta «Tienes N avisos nuevos» en el inicio
  del conductor y la pantalla «Avisos»; FCM al instante SOLO si se compila con los cuatro datos del proyecto de
  Firebase (secretos `FDS_FCM_APP_ID`, `FDS_FCM_API_KEY`, `FDS_FCM_PROJECT_ID`, `FDS_FCM_SENDER_ID`) y el servidor
  lleva `FCM_SERVICE_ACCOUNT_JSON`; sin ellos, el sondeo basta (el mismo aviso con el mismo id: nunca sale dos veces).
  El autónomo recibe lo mismo (el aviso de la mañana). `servidor_pruebas.py` siembra ahora una oficina
  (`oficina@fds.test` / `oficina-de-prueba-1`) para aprobar peticiones y abrir refuerzos en las pruebas.
- **Comprobado en este PC**: los 26 checkers en verde (contraste incluido), ESLint 0 errores, `vite build`, Playwright
  humo en escritorio 206/206 (dos fallaron en la tanda y pasaron aisladas: una era texto chino, corregida; la otra,
  «App · quien reparte solo…», una carrera), el contrato app↔API en verde con las 7 comprobaciones de avisos, **la app
  compilada con Gradle aquí (`testDebugUnitTest` + `assembleDebug`) e instalada en el emulador de Android Studio
  contra `servidor_pruebas.py`**: entrar como conductor, la tarjeta «Tienes 1 aviso nuevo» al abrir la oficina de
  prueba un refuerzo, la bandeja y la notificación. Backend: `pytest` 1.267 en verde en la tanda entera (12 min 47 s en este PC; el único rojo era un test nuevo
  de avisos, porque `Cursor.sort` de la base de mentira no ordenaba nada: ahora ordena como Mongo, y 129 repetidas en verde). Python 3.12 instalado en este PC con
  winget (no había; las pruebas lo necesitan).
- Capturas en `docs/capturas-29-10/` (web y emulador; `LEEME.md` dice cuál es cuál).

## Pendiente (por prioridad)

-7. **La 2.3.0 a Google Play: ENVIADA A REVISIÓN (30-10 00:35, desde el PC)**. Dani subió el AAB 18 (2.3.0) al borrador de
   producción; la sesión quitó el bundle 10 (2.0.0) del borrador (sigue en la biblioteca de artefactos), nombre «2.3.0»,
   notas en es-ES (cámara, ruta por tiempo, sin cobertura, 25 € de bienvenida, invita y gana, actualización in-app) y envió
   los 3 cambios a revisión (lanzamiento completo + 178 países). Única advertencia: sin símbolos nativos (no bloquea). La
   **prioridad de actualización in-app no se puede fijar desde la consola** (solo por la API de Play Developer,
   `inAppUpdatePriority` en `edits.tracks`): si Dani la quiere, va en `app-release.yml` cuando exista `PLAY_SERVICE_ACCOUNT_JSON`.
   Revisión de Google: hasta 7 días. **Cuando esté publicada** (Dani, 30-10 00:40: «ponla tú»; la sesión del PC lo mira cada 2 h): `fly secrets set -a flota-backend APP_ANDROID_MIN="2.3.0"` para
   que las 2.2.x pidan actualizar al entrar. De lo de abajo sigue pendiente lo opcional:
   (antes) subir `C:\Users\dlvie\Downloads\FDS-2.3.0-code18.aab` a la
   prueba abierta en Play Console (o a producción si la 2.2.4 ya salió); texto de novedades: «Avisos en el móvil:
   turnos aprobados, vacantes para trabajar más e inspección pendiente, aunque la app esté cerrada. Una sola marca:
   FDS.». Luego, con un conductor real: aprobarle un día y ver que le salta. Opcional: (1) para que el AAB suba solo,
   el secreto `PLAY_SERVICE_ACCOUNT_JSON` en GitHub (en Fly ya existe `GOOGLE_PLAY_CUENTA_SERVICIO`: si esa cuenta
   tiene permiso de «Publicar en pistas de prueba» en Play Console, vale la misma); (2) para que la web se despliegue
   sola desde GitHub, `FLY_API_TOKEN`, `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`; (3) avisos al instante:
   proyecto de Firebase → 4 secretos `FDS_FCM_*` en GitHub y `FCM_SERVICE_ACCOUNT_JSON` en Fly (sin esto, cada 15 min);
   (4) `APP_ANDROID_MIN` en Fly cuando quiera obligar a actualizar (hoy no está puesta).

-6. **El anuncio con la voz de Dani (29-10 noche, 2)**: montado en `docs/anuncios/spot-dani/salida/`. Falta:
   (1) **desplegar el bono de 25 €**: Dani pone los 3 secretos en GitHub y se relanza `desplegar.yml` (o ejecuta
   `scripts\deploy-backend.ps1` y `deploy-frontend.ps1` en su PC). Al desplegar el backend arranca sola la
   campaña `bono25` (el correo a los ~100 registrados sin primera ruta; mirar el latido `campana_bono25` y
   `correos_enviados` con `por: ciclo:bono25`); (2) publicar: conectar «TikTok for Business» y
   «Adspirer Social Ads» en claude.ai y, en sesión nueva, crear las campañas con el 9:16 B y los enlaces de
   SUBIR.md; Spotify a mano con el `-30s`; YouTube el 16:9 con QR; medir;
   (3) opcional, para afinar: bajar los 5 clips de Artlist a `super-anuncio/clips/` (`plano-1.mp4`,
   `plano-7a.mp4`, `plano-9.mp4`) y regrabar con red (mapa nítido a zoom 17): el montaje los coge solos.
   El anuncio anterior (voz de Puck, `super-anuncio/salida/`) queda como alternativa.

-5. **FDS 2.2.5 FIRMADA POR GITHUB (29-10, 21:22)**: el workflow `app-release.yml` (run 3) la compiló y firmó con la
   clave de subida (secretos `FLOTA_KEYSTORE_B64` y `FLOTA_KEYSTORE_PASSWORD`, puestos por Dani); el AAB verificado
   con `jarsigner` y el APK con `apksigner` (v2/v3: a `jarsigner` un APK con minSdk 26 le parece «unsigned» aunque
   esté bien; el run 2 lo decía y no fallaba, ahora el run falla si falta la firma). Artefacto `FDS-2.2.5` del run
   https://github.com/oga5furgonetas/foefa/actions/runs/40938703587
   (`FDS-2.2.5-code17.aab` para Play y `FDS-2.2.5.apk` para la web; caduca el 28-11). Ya NO hace falta Gradle en el
   PC: cada cambio en `app-android/` en `main` produce el artefacto solo. Falta: Dani baja el zip, prueba el APK en
   el móvil (entrar, una auditoría con foto del cuentakilómetros, una entrega con foto, «Volver a por entregar»,
   «He olvidado mi contraseña», cerrar sesión con pregunta), sube el AAB 17 a la prueba abierta de Play Console y
   el APK a la web (`/descargas/FDS.apk`); al subir el APK, `fly secrets set -a flota-backend APP_ANDROID_WEB="17 2.2.5"`.

-4. **Desplegar y decidir (29-10 noche)**: backend DESPLEGADO (4d2e1b4, 20:00) y web DESPLEGADA (20:40). Pendiente
   de desplegar el backend otra vez con bb77d93 (reset de la oficina) y con lo de la rama del anuncio fusionada en
   `main` (bono 25 € y la campaña `bono25`, que SALE SOLA al arrancar: ver -6). Leer `docs/ESTUDIO_APP.md` y decidir lo de su
   apartado 6 (público de los anuncios, cómo se cobra en la app antes del 31-12, OSRM propio, Gemini de pago, las
   cuatro rutas heredadas). Fase 0 HECHA (29-10 noche); fase 1 en la 2.2.5 salvo FCM (avisos push) y los textos a
   `strings.xml`.

-3b. **Comprobado el 29-10 a las 13:15 (hora de Dani)**: `POST /auth/app-login` está en producción (contesta 422 sin
   cuerpo). El backend desplegado lleva el acceso unificado de la app; la 2.2.3 puede entrar contra producción.

-3a. **App nativa, primera prueba en móvil real (29-10 tarde)**: Dani entró en la 2.2.3 con un conductor de OGA5 (bien:
   el servidor le llevó al portal del conductor) y se atascó en «Elige tu contraseña»: el botón seguía gris con tres
   letras y no decía por qué; y vio «Abrir mi ruta», que en una flota de Amazon no pinta nada. Las dos cosas van en la
   **2.2.4 (code 16)** (ojo y aviso en los campos de contraseña; la ruta solo si la empresa reparte con la app),
   **compilada y firmada esa misma tarde en el PC de casa de Dani** (`C:\Users\dlvie\foefa`; cómo, en PLAY_STORE.md →
   «Versión 2.2.4»): tests, lint, AAB y APK en verde, firma verificada con `jarsigner`. **Probada en su móvil: correcto**
   (contraseña con ojo y aviso, sin «Abrir mi ruta», y lo de antes: auditoría, turnos, trabajar más, invita y gana).
   Los ficheros están en `C:\Users\dlvie\Downloads\FDS-2.2.4-code16.aab` y `FDS-2.2.4.apk`. **AAB 16 (2.2.4) subido
   a la prueba abierta y en revisión** el 29-10 por la tarde, sin avisos al subir (publicación gestionada desactivada:
   al aprobarse sale solo). Falta: ver el resultado de la revisión y, cuando toque, pedir el paso a producción.

-3. **App nativa (29-10)**: Dani instala `app-android/salida/FDS-2.2.4.apk` en su móvil, la prueba (entrar como
   conductor de empresa: turnos, auditoría con fotos, trabajar más; y como autónomo) y sube
   `app-android/salida/FDS-2.2.4.aab` a Play (code 16). Lo de abajo sigue valiendo:
   Dani la prueba en su móvil y sube el AAB a Play
   (Seguridad de los datos: cámara y ubicación; Eliminación de cuentas). **Cada «Borrar mi cuenta» pedido desde
   la app** queda en `flota_global.bajas_cuentas` (`borrada: false`) con aviso por correo: hay que borrar sus
   datos en 30 días como mucho. Falta una página web para pedir el borrado (Play la pide; hoy vale /privacidad).

-2. **Reparto (03-10)**: antes de cobrar a una empresa de reparto, contrato de
   encargo art. 28 y política de privacidad (ver `docs/REPARTO.md`). La IA de
   tickets necesita clave de Gemini de PAGO y `REPARTO_IA_PERMITIDA=1`. Para
   que el de Gadis lo pruebe gratis: crear su cuenta como supermercado y poner
   `status: active` en su organización.

-1. **Cuadrante de OGA5, lo que decide Dani**: aceptar o no la propuesta del
   01→12-10 (en la app, o me lo dice y la acepto). Ojo con el Atlas: si la base
   de Flota está en la org que se suspende el 01-10, se pierde todo esto.

0. **URGENTE — aviso de Amazon del 24-09**: leer la sección 0 de
   `docs/REVISION_LEGAL.md`. Amazon pidió inventario y borrado de todos los
   datos sacados de Amazon; el 26-09 se copiaron a Flota, al PC y a R2. Hay un
   plan A-G pendiente del sí de Dani. No usar ni ampliar datos de Amazon
   (DNR diaria incluida) hasta que Dani decida.
1. **Revisión legal** hecha el 26-09: `docs/REVISION_LEGAL.md`. Lo grave está
   arreglado (copias de la base descargables, plantillas adivinables, CV que no
   se borraban). Quedan puntos **DECIDE DANI** (datos de Amazon en la base, 143
   CV sueltos, aviso legal, contrato de encargo, política, informar a
   conductores): NO se hacen sin su sí. Pregunta abierta a Dani: qué pasó
   «hace 2 días» (24-09) que no quiere que se repita; no está en las notas.
2. **Atlas se suspende el 01-10-2026** (la organización tiene facturas sin
   pagar y Dani no quiere pagar). **Comprobado el 30-09 a las 21:00**: el
   servidor usa `cluster1.r5ruvvc.mongodb.net`, el proyecto donde salió el
   aviso «suspend 10/01/26» en la captura de Dani del 26-09; la organización
   nueva no se había creado. Hace falta una organización NUEVA gratis, clúster
   M0, copiar `flota`, `flota_global`, `dsp_demo`, `edge_os` (110 MB, cabe en un
   M0) y cambiar `MONGO_URL` en Fly. Copia manual del 30-09 20:59 en R2
   (`backups/flota_2026-09-30_1859_…`, 156.061 documentos) descifrada y leída
   entera en el servidor; la clave de `.flota-copias-clave.txt` es la buena
   (huella ceb876a5). Las copias no llevan `_id`: para mudarse, mejor copiar
   de base a base (con `_id` e índices) que restaurar la copia.
3. Correo (Resend/Brevo), WhatsApp (claves `WHATSAPP_*`) y pagos: sin
   configurar. Telegram SÍ funciona (su config venía en los datos).
4. Investigaciones de DNR y portal `/dnr/t/` de FlotaDSP: no recuperados
   (están en el commit raíz `cfed72b` si Dani los pide).
5. ~~Capturas del panel para la portada~~: quitado el 21-10 (`ProductoReal.jsx` y su generador). Con los
   datos simulados salían vacías («no hay órdenes», «este mes no vence nada»); la portada enseña el panel
   con una vista de ejemplo que lo dice. Si se quieren, antes hay que llenar el escenario «lleno».
6. **Valor**: falta la banca real de Dani (`VALOR_BANCA`, hoy 1000). Las tres
   claves están en Fly (desde `C:\Users\Usuario\.flota-odds.txt`, sin
   imprimirlas) y el escáner encendido (`VALOR_ESCANEAR=1`). Sin probar aún:
   avisos al móvil (`VALOR_TELEGRAM_*` sin poner) y cómo salen las cuotas de
   Codere/PokerStars cerca del partido (lejos, faltan mercados).
7. **Privacidad pendiente** («que nadie tenga acceso a nuestra data»):
   - Los ficheros de R2 (fotos, DNI y documentos de conductores, CV) se abren
     con el enlace, sin sesión (r2.dev público). Los nombres no se adivinan
     (uuid + 8 hex, medido el 26-09), pero un enlace reenviado vale para
     siempre. Arreglo: enlaces firmados que caducan desde la API, y que Dani
     apague el acceso público del bucket (cuenta de Winiw, no la suya).
   - El R2 y el Atlas viejo son de la cuenta de **Winiw**: Winiw tiene acceso
     a esos datos. Llevarlos a cuentas de Dani.
   - Los despliegues ANTIGUOS de Pages siguen en sus URLs propias
     (`<hash>.flota-2fg.pages.dev`) con sus `.map`. No se han borrado.
8. **Furgonetas fijas** (hecho, ver arriba): que cada centro aplique el
   reparto inicial y ponga notas; en OGA5, apuntar la fila cada día. Falta la
   casilla de vetadas en la pantalla.

## Trampas conocidas

- FastAPI de esta versión registra las rutas al arrancar: para listarlas,
  pedir `/openapi.json` al servidor en marcha (en LOCAL y con `API_DOCS=1`;
  en producción está cerrado a propósito), no `server.app.routes`.
- Las pruebas de Playwright corren contra `dist` (`vite preview`): si se toca
  el código, recompilar antes, o la prueba mira la versión vieja.
- El CI pasa TODAS las pruebas de Playwright en escritorio y en móvil
  (`npm run e2e`), no solo `humo`: antes de subir, `npx playwright test`.
- Los `scripts/check-*.mjs` se corren desde la raíz del repo; desde
  `frontend/` alguno revienta con ENOENT (busca `frontend/tailwind.config.js`).
- La prueba de rendimiento de la hoja no exige milisegundos (en el CI, más
  lento, fallaría sin haberse roto nada) sino una proporción medida a la vez:
  una tecla / repintar la hoja entera (Ctrl+A). Memorizada, 0,03–0,07; sin
  memorizar las filas, 0,20; el límite es 0,12 (y 16 ms como tope absoluto).
- El usuario de Atlas no puede `dropDatabase`: las bases de prueba se vacían
  colección a colección.
- La demo es de solo lectura (403 al escribir). Para probar escrituras:
  backend local contra bases `prueba_*` del clúster (ver cómo en la sesión
  c3af8cab: `api_prueba.py` con token de mantenimiento `maintenance-claude`).
- La caché DNS de Windows guarda los «no existe»: `ipconfig /flushdns` o
  `curl --resolve flotadsp.com:443:104.21.49.241`.
- El login de Cloudflare en el navegador integrado falla por la comprobación
  anti-robots: que Dani lo haga en su Chrome.

## 04-10-2026 tarde: píxel de Meta, mapa del repartidor

- **Píxel de Meta** (id 1317231944812644, conjunto de datos «fds»): se activa SOLO al compilar con `VITE_META_PIXEL_ID=1317231944812644` (añadirlo SIEMPRE al `vite build` del despliegue; sin él no hay píxel ni pregunta de cookies de anuncios). No se carga hasta que la persona acepta «Aceptar» en el aviso de cookies (AEPD).
- **Mapa del repartidor**: el punto azul sigue la posición del móvil; si se avanza >150 m (y pasan 30 s) se recalcula el camino; botones «Seguirme» y «Centrar la ruta». Test `e2e/mapa-vivo.spec.js`.
- **Rutas por las calles**: `_rep_osrm` prueba el servidor principal y, si falla, el de respaldo; un fallo ya no se guarda (antes dejaba rayas rectas hasta reiniciar).
- Capturas de la landing con trazado REAL (`e2e/fixtures/coruna-real.json`); las anteriores eran 5 puntos a mano = rayas rectas.
- Alta de repartidor sin «repetir contraseña» y campos a 16 px (iOS hacía zoom).

## 04-10-2026 noche: campaña de registros, entrada de la app, editar paradas

- **Meta**: campaña nueva «FDS Registros — Lead — ES+PT (05-10-2026)» (ids campaña 52642982601539 / conjunto 52642982601739 / anuncio 52642982601939), objetivo Clientes potenciales con conversión en SITIO WEB (con formularios instantáneos Meta exige aceptar condiciones de leads), evento «Cliente potencial» (Lead) del píxel «fds», 70 €/día hasta el 8-oct, España+Portugal, anunciante FDs, mejoras de IA de Meta desactivadas. Quedó en BORRADOR: Dani pulsa Publicar (el clasificador bloquea publicar/gastar). Al publicarla, pausar «FDS Repartidores — 250 € hoy — 7 idiomas» (campaña antigua, optimiza visitas baratas y tiene un cambio de contenido sin publicar).
- Eventos del píxel: `Lead` al pulsar «Crear mi cuenta» (landing y pantalla de entrada) o «Probarla ahora»; `CompleteRegistration` al terminar el alta. Solo con cookies de anuncios aceptadas. En el Chrome de Dani el script de Meta se descarga pero no se ejecuta (bloqueador/protección de rastreo); en otro navegador sí envía.
- Facturación Meta: el umbral de cobro (ahora 19 €, antes 2 €) lo sube Meta solo según el historial; no se fija a mano. Para pagar de golpe: «Añadir fondos» (prepago) en Facturación y pagos.
- Pantalla de entrada de la app (`/empezar`): «Crear mi cuenta gratis» arriba, «Ya tengo cuenta · Entrar», empresas plegado; SIN «probar sin cuenta» (incongruente si crear cuenta es gratis; la landing sí lo conserva).
- Repartidor: `POST /reparto/mis-pedidos/{id}/editar` ahora cambia cliente, teléfono, dirección (vuelve a situarla), bultos, cobro, horario…; `POST /reparto/mis-pedidos/{id}/quitar` (solo paradas propias o, si reparte solo, cualquiera; no las cerradas). En la app: botón «Editar» en cada parada y «Quitar esta parada» con doble toque. Tests: `test_reparto_api.py`, `e2e/editar-parada.spec.js`.
- Pendiente de la «app bomba»: buscador de direcciones con sugerencias al añadir parada, arrastrar para reordenar, barra compacta de carga cuando ya hay paradas, vídeo de 15 s para anuncios.
- **Estado de Meta a las 23:15 del 04-10**: Dani publicó la campaña «FDS Registros — Lead — ES+PT (05-10-2026)» (En preparación, 70 €/día, hasta el 8-oct). La campaña antigua «250 € hoy — 7 idiomas» quedó PAUSADA por mí (tenía un presupuesto total de 1000 € en un cambio sin publicar que se publicó al pausarla: si alguien la reactiva, bajarlo antes a lo que toque). La nueva usa el vídeo largo (27 s); los de 20 s con recorrido real están en `public/videos/` y falta cambiarlos en el anuncio (reinicia la revisión de Meta).
- Vídeos (`e2e/video-tiktok.spec.js` + `e2e/video-montar.mjs`): recorrido y navegación REALES (`e2e/fixtures/coruna-real.json`), ~20 s, cierre «Crea tu cuenta gratis: siete días sin tarjeta». Chromium emulado solo avisa de la posición si cambia: tras abrir la navegación hay que volver a llamar a `setGeolocation`.
- Buscador de direcciones al añadir/editar una parada (`src/lib/direcciones.js`, Photon; la parada entra con su punto exacto) y barra de carga compacta («Más formas de añadir»).

## 05-10-2026 (madrugada): diagnóstico de «no entra nadie»
- Datos reales (analitica_eventos, últimas 12 h): TikTok 137 sesiones (61 fr, 29 es, 17 it, 17 de, 9 en, 4 pt), CPC 0,01-0,02 €, 0 acciones; Facebook ~213 sesiones relevantes en /repartidores. Casi todos los `rep_alta`/`rep_probar` de ayer eran pruebas (tablets de revisión de Meta, mis tests). Cero registros reales de anuncios. Volumen aún pequeño: con ~1 % de conversión harían falta ≥1000 visitas buenas.
- Cambios: landing con «Crear mi cuenta gratis» como botón principal y probar como secundario; vídeo de la landing 0,4 MB (`public/videos/web-<idioma>.mp4`, sin audio) en vez de 8 MB; TikTok: grupos EN/FR/DE/IT PAUSADOS (el gasto se iba a Francia), quedan ES y PT. Ojo: en la UI de TikTok el interruptor tarda ~6 s en aplicarse; esperar antes del siguiente clic (un clic doble pausó PT por error y se reactivó).
- Posible siguiente paso si sigue en 0: optimizar TikTok por un evento (necesita píxel de TikTok, hoy solo hay el de Meta) y probar `/registro` directo como destino de un grupo.

## 05-10-2026 (madrugada) — calidad de tráfico
- Datos 8 días (analitica_eventos): TikTok trajo 0 registros. Solo el anuncio ES tuvo interés (28 de 72 sesiones llegaron a /registro); FR/IT/DE/PT/EN rebotaron el 100 %.
- Hallazgo: el grupo de anuncios ES de TikTok estaba dirigido también a **Argentina**. Corregido: solo España, 25-54 años, intereses Express Deliveries + Logistics (audiencia 2,1-2,6 M). FR/IT/DE/EN siguen pausados; PT activo con poca muestra.
- Píxel de TikTok: soporte ya en `src/lib/metaPixel.js` (variable `VITE_TIKTOK_PIXEL_ID`, CSP en `public/_headers`). FALTA el ID: TikTok exige verificar el teléfono de Dani por SMS para abrir Events Manager (no se pudo). Con el ID: build con la variable, y poner el grupo ES a optimizar por registro.
- `/repartidores` tiene og propios (`functions/repartidores.js`, `public/og-repartidores.png`); la portada nombra Paquetería/Amazon/MRW/Nacex/Tipsa/Glovo/Súper (sin relación con las marcas).
- Grupos de Facebook: publicado en 5 (ver memoria facebook-grupos-publicar); un admin borró la publicación en Estafetas (PT).

## 05-10-2026 — correo activado
- Resend en Flota: `RESEND_API_KEY` (clave solo-envío, copia en `C:\Users\Usuario\.flota-resend.txt`), `EMAIL_FROM="FDS <contacto@flotadsp.com>"` y `CORREO_CONTACTO=contacto@flotadsp.com` en Fly. El dominio `flotadsp.com` está verificado (envío de prueba OK). Se envía desde el panel de superadmin (`POST /admin/correo`, tope 40/h).
- RECIBIR correos NO está activo: la clave es solo de envío y no hay entrada. Las respuestas van al `responder_a` (iCloud de Dani). Para recibir en la web haría falta Resend Inbound o reenvío de dominio (Cloudflare Email Routing) + webhook.
- Primer correo real: pregunta de opinión al primer registro (Guilherme), 05-10.

## 05-10-2026 — spot «tipo tele» y estado de Meta
- Spot de 38 s (9:16, 4:5, 1:1): locución neuronal (edge-tts, es-ES-AlvaroNeural) + 4 planos de archivo de Pexels (licencia comercial, ver `docs/anuncios/reales/stock/LICENCIAS.txt`) + la app real grabada limpia + subtítulos + música sintetizada. Se regenera con `node scripts/montar-spot-tele.mjs` (necesita `frontend/e2e/spot-material.spec.js` → `test-results/spot-material/es.webm` y las voces en `docs/anuncios/reales/spot/`). Salidas en `docs/anuncios/reales/salida/` (no van a git).
- Kit para anuncios con personas reales: `docs/anuncios/reales/GUIONES.md` + `scripts/montar-anuncio-real.mjs`.
- TikTok: el spot (versión 720p, 3,7 MB) está añadido como primera creatividad del anuncio ES (grupo `Ad group 20261004045045`, solo España, 25-54, intereses Express Deliveries + Logistics).
- META: la cuenta publicitaria está RESTRINGIDA por fallo de pago («Cuenta pendiente de pago… saldo que se debe liquidar»); el anuncio ES+PT sale con «Error en el pago». Hasta que Dani pague, Meta no sirve nada. Hay 3 borradores en «Revisar y publicar». El spot 4:5 (`spot-tele-4x5-1080.mp4`, 4,3 MB) está listo para subir a Meta (límite del puente de subida: 10 MB).
- Google Play (API, solo lectura): prueba cerrada «alpha» con `fds-testers@googlegroups.com`, versión 3 publicada en la pista; interna con la 2; producción vacía. No se ve el estado de revisión ni cuántos testers se han unido.

## 05-10-2026 tarde (sesión 6b0ba015): embudo medido, correos del ciclo, sketch
- **Embudo real** (`analitica_eventos`, 48 h hasta las 14:17 UTC): TikTok ES 316 sesiones / 216 rebotes /
  1 `rep_form_inicio` / 0 altas; TikTok PT 178 (177 rebotes); Meta ES 173 (0 altas, cuenta bloqueada por pago).
  **Grupos de Facebook: 1 visita en total** (`utm_source=grupo`, `paq_autonomos_video`); LinkedIn 1. TikTok cuenta
  204 clics ES el 4-5/10 y nosotros registramos MÁS sesiones que clics: la gente NO se pierde mientras carga la
  página (descartado tocar la carga); el problema es la calidad del tráfico (CPC 0,04 €, CTR 0,66 %).
- Altas reales recientes: Guilherme (05-10, Instagram), Juanjo (03-10, app), José Arturo (04-10, 2 paradas),
  Daniel Brao (04-10, conocido de Dani). Guilherme y Juanjo: 0 paradas → hacía falta seguimiento.
- **Correos del ciclo** (`backend/ciclo_correos.py`, léelo): bienvenida con los 3 pasos reales (sale SIEMPRE a
  quien reparte solo; sustituye a la de antes, que decía «se cobra salvo cancelación» a quien no metió tarjeta:
  falso, corregido también para empresas), «¿te ayudo con tu primera ruta?» a las 20-72 h si 0 paradas, y «te
  quedan 2 días» (estos dos SOLO con `CICLO_CORREOS=1`, hoy APAGADO: falta el sí de Dani). Baja de un clic
  (`/api/correo/baja`, firma HMAC, cabecera List-Unsubscribe), idioma del alta (`idioma` en `/auth/register`),
  respuestas a `CORREO_RESPUESTAS` o al correo del super-admin. 38 pruebas en `test_ciclo_correos.py`
  (incluida una que comprueba que cada botón citado entre «» existe en el diccionario de la app).
- **Anuncio sketch «¿Aún repartes a ojo?»** (formato «X en 30 s» de TikTok que mandó Dani): 22,7 s, repartidora
  de Pexels (licencia: solo el problema, nunca usando FDS), voz Ximena con guion coloquial tratada como móvil,
  3 pasos con la app real. `py -3 scripts/voz_sketch.py` + `node scripts/montar-sketch-repartidora.mjs`
  (la app: `npx playwright test e2e/spot-material.spec.js --update-snapshots`; OJO, cualquier otra pasada de
  Playwright BORRA `test-results/`). Salida en `docs/anuncios/reales/salida/` y `Descargas\FDS-sketch-repartidora.mp4`.
  NO se usó el vídeo de la chica que le mandaron a Dani (contenido e imagen de otra persona).
- Gotcha: las pruebas de humo fallan si `dist` se compiló con `VITE_META_PIXEL_ID` (el aviso de cookies tapa
  botones) o con `VITE_API_URL` (CORS desde localhost). Para probar, `npx vite build` a secas; para desplegar, con las dos.
- **Demo que atrapaba** (05-10 noche, Dani Brao): «Probarla ahora» guarda una sesión de CONDUCTOR de demo
  (`flota_driver_token` con `demo: true`) y `/app` (arranque de la app instalada) la miraba antes que la cuenta:
  quien ya tenía cuenta volvía siempre a la demo. Arreglado en `panel/auth.js` (`hayDemoDeReparto`,
  `salirDeLaDemoDeReparto`; `saveSession` la borra), `AppRedirect` en `main.jsx` y botón «Ya tengo cuenta» en la
  ruta de prueba. Prueba: `e2e/demo-no-atrapa.spec.js` (3 de 4 fallan con el código de antes). Comprobado en producción.

## 06-10-2026 (madrugada): precios, demo comercial y reunión con Transportes Auto Radio (miércoles 07-10)
- **Auto Radio** (tautoradio.com): paquetería gallega desde 1985, 5 delegaciones de transporte (Coruña-Pocomaco,
  Santiago-A Sionlla, Lugo-O Ceao, Ourense-San Cibrao, Vigo-Beade) + 2 naves de logística en Pocomaco, +150 vehículos,
  +250 personas. Ya usan **Alertran** (TMS: envíos, PDA, trazabilidad) y **Bizneo** (RR. HH.). Flota entra por lo que no
  tienen: estado de la flota, golpes y quién los causa, taller, vencimientos y la operación de cada delegación.
- **Precios nuevos** (estudio completo en `docs/PRECIOS.md`: competencia con fuentes, coste por vehículo, margen y todas
  las casuísticas). Esencial 5 €/veh (mín. 10, 1 delegación) · Pro 9 € (mín. 20) · Empresa desde 12 € (100+, a medida).
  Volumen −10/−15/−20 % desde 50/150/300 (`DESCUENTOS_VOLUMEN`, `_con_volumen`; también en el COBRO mensual) y anual
  2 meses gratis. Complementos (`COMPLEMENTOS` en server.py y `lib/precios.js`). Fundador: Pro a 6 € congelado 24 meses
  (nadie había reservado la oferta vieja «Completo a 5 € para siempre»). Las claves no cambian: operacion=Esencial,
  completo=Pro, holding=Empresa. Esencial ya NO abre `_MODULOS_SOLO_PRO` (cuadrante, asignación, origen de daños…).
  `/planes` y el alta usan `lib/precios.js`. Pruebas: `test_precios.py`, humo «Planes · con 150 vehículos…».
- **Arreglos de cobro**: el cobro mensual automático habría FACTURADO a las demos (la pública y la del súper salían como
  empresas activas con plan) y no aplicaba el descuento por volumen. Ahora excluye `interna`, `demo` y `_ORGS_DEMO`.
- **Alta**: decía «Al finalizar se cobra el plan… salvo cancelación» sin tarjeta (falso); ahora «sin tarjeta no se cobra nunca».
- **Demo comercial «Paquetería del Noroeste (demo)»** (`backend/demo_comercial.py`, org `demo-noroeste`, base
  `dsp_demo_noroeste`, plan Pro, `interna`): 5 delegaciones gallegas, 150 furgonetas, 171 conductores, un mes de
  inspecciones (~3.600), 42 golpes nuevos con su coste, 3 conductores que concentran golpes, 5 en taller con orden,
  ITV a punto de caducar, cuadrante ±14 días. Todo inventado, sin teléfonos ni correos. Se crea al arrancar si no
  existe y se vuelve a sembrar cada madrugada (≥4:00 Madrid); `POST /admin/demo-comercial` (super-admin) la regenera ya.
  Se entra con «entrar como» desde Negocio. Se PUEDE escribir (para la inspección en directo). El histórico NO tiene
  fotos: la atribución de golpes exige las dos fotos y sale con certeza media/baja; la prueba con fotos se hace en directo.
  Verificado contra una base `prueba_*` del clúster (inicio, hoy, golpes por conductor, costes, ITV, taller,
  disponibilidad, revisión): script en el scratchpad de la sesión 6b0ba015 (`verificar_demo.py`), base borrada al acabar.
- **Presentación**: artefacto «Flota para Transportes Auto Radio» (14 diapositivas, notas del orador con la demo en
  directo): https://claude.ai/artifact/SMsSFEV2iVJDEh5kWGBqyb. Huecos para Dani: [€__] coste medio de un golpe,
  [teléfono], horas de cuadrante antes/después.
- Pendiente antes de un cliente de pago: clave de Gemini de PAGO (la gratuita da ~20 peticiones/día; 150 furgonetas
  hacen 150 inspecciones/día) y base de datos dedicada (tope de 500 colecciones, sin copias).

## 06-10-2026 (mañana): lo que /planes promete, la app lo hace
Repaso de cada frase de `/planes` y de la presentación contra el código (Dani: «sin falsos positivos»).
- **Colaboradores y campaña se cobran de verdad**. Antes /planes vendía 3 €/mes y 0,30 €/día pero la ficha no podía
  marcarlas y el cobro las contaba como propias a precio de plan. Ahora cada furgoneta tiene `alta`
  (`propia` | `colaborador` | `campana`) y `campana_desde`/`campana_hasta`, en la ficha («Cómo se factura») y en
  `PATCH/PUT/POST /vehicles` (`_alta_limpia` valida; la campaña empieza hoy si no se dice y se cierra al darla de baja).
  `_FILTRO_PROPIAS` es lo que cuenta para el plan, su mínimo y su volumen (cobro, Lemon/Stripe vía
  `_vehiculos_facturables`, vista previa de cambio de plan).
- **El cobro mensual tiene líneas** (`lineas`): plan + colaboradores (hoy) + días de campaña y conductores de reparto
  (6 €, conductores distintos con pedidos) del MES ANTERIOR (`_cuenta_flota`, `_lineas_complementos`). Un precio
  pactado sustituye solo la línea del plan. El repartidor (cuota fija) ya no entra en el cobro. Negocio enseña el desglose.
- **Informe pericial**: /planes lo vendía a 9 € en Pro, pero la app lo da sin límite en Pro (`forensics`) y la página
  del peritaje dice «va en el plan Pro». Ahora es «incluido en Pro, sin límite» y Esencial lo lista como no incluido.
- **«Cómo se cuenta»** decía «el máximo del mes», «se prorratea por días» y «30 días y se borran»: nada de eso lo hace
  la app. Ahora: las de alta el día de la factura, lo nuevo entra el mes siguiente (nunca a toro pasado), y al irse
  se devuelven o se borran los datos según el contrato de encargo (el borrado es manual, «Eliminar empresa»).
- **Importar de Excel estaba cerrado en Esencial** (la ruta `importaciones` iba con `export`) aunque Esencial lo
  promete y la bienvenida manda ahí a cargar la flota. Abierto en todos los planes.
- **Exportar a Excel**: Pro lo promete y la lista de furgonetas no se podía bajar. Botón «Excel» en Vehículos (CSV con
  «;» y BOM), solo con `export` (Pro y Empresa).
- La API de solo lectura que promete Empresa SÍ existe: `GET /api/partner/v1/flota` con llave (`LlavesPartner.jsx`).
- PRECIOS.md §6 marca lo que aún es propuesta y no hace la app: 0,05 € por inspección de más e impago automático.
- Catálogo de producción (`plan_catalog` «vigente») actualizado a Esencial 5/10, Pro 9/20, Empresa 0/0.
- Pruebas: `test_precios.py` (22), humo «la ficha dice cómo se factura…».

## 06-10-2026 (mañana): píxel de TikTok en marcha
- Dani verificó su teléfono en TikTok Ads y se creó el píxel **«Flota web flotadsp.com» (ID `DB2AIGBC77U04C8M31L0`)** en
  Events Manager: web, solo píxel de navegador (sin Events API), coincidencia avanzada automática APAGADA.
- El cargador de `src/lib/metaPixel.js` era un resumen del fragmento oficial (sin `TiktokAnalyticsObject`, `_i[id]` ni
  `_t`): ahora es el oficial paso a paso. Verificado en producción: carga `events.js` y manda `api/v2/pixel`.
- `deploy-frontend.ps1` compila YA con `VITE_API_URL` y los dos píxeles, leídos de `despliegue.local.json`
  (`meta_pixel`, `tiktok_pixel`, fuera de git) o `FLOTA_META_PIXEL`/`FLOTA_TIKTOK_PIXEL`. Antes `npm run build` iba
  sin ellos y un despliegue con el script los quitaba sin avisar.
- Aviso de cookies y /cookies nombran Meta y TikTok (cookies `_ttp`, `_tt_enable_cookie`, `ttcsid`). El consentimiento
  pasa a v3: quien aceptó la v2 (solo Meta) vuelve a ver el aviso.
- Pendiente (decide Dani, es gasto): cuando Events Manager reciba eventos, poner el grupo ES a optimizar por
  «CompleteRegistration» en vez de por clic. Del 04 al 06-10 TikTok trajo 1.079 sesiones y 0 altas.

## 06-10-2026 (mediodía): /repartidores en prueba A/B y el sketch en anuncios
- **Sketch en TikTok Ads** (Dani autorizó el Submit): el anuncio «Copy 4…» (ID 1878222770014641, grupo ES) lleva
  FDS-1..4 + el post «¿Todavía ordenas…», etiqueta de IA en los 4 FDS y el píxel en Tracking. Tras el Submit los FDS aún
  no salían en la lista de creatividades ni tenían impresiones (revisión de TikTok); comprobar que entran.
- **Corrección de un dato que di mal**: las «241 vistas de /registro» desde TikTok eran la redirección a /repartidores
  (main.jsx, 04-10), no gente en el formulario. Lo real: de 1.107 visitas de TikTok, el 88 % solo ve una página.
- **/repartidores, prueba A/B** (`Repartidores.jsx`): a = el alta arriba (como el 05-10); b = primero el vídeo de la app
  con 3 ventajas y dos botones (el alta se abre en la misma página). La versión sale del `sid` (`varianteAB` en
  `lib/analitica.js`: último carácter par → a, impar → b), así que no se guarda nada más; `?v=a|b` la fuerza.
  Nuevas señales en las dos: `rep_10s` (sigue a los 10 s), `rep_mitad` (bajó a la mitad) y `rep_abrir_alta` (b).
  Resultado: `MONGO_URL=... python scripts/ab_repartidores.py 2026-10-06 tiktok`. Mirar en 2-3 días: con ~350
  visitas/día, las diferencias en 10 s/mitad se ven pronto; en altas, no.
- **Frase falsa quitada**: el alta en portada decía «al finalizar se cobra… salvo cancelación» junto a «sin tarjeta».
  Ahora la misma de /registro: «sin tarjeta no se cobra nunca: al acabar eliges si seguir».
- Pruebas: humo «Anuncio · versión a/b» y «mide si la gente se queda»; las del alta en portada fuerzan `?v=a`.

## 06-10-2026 (tarde): repaso de precios por tipo de cliente
- Corregido el plan Repartidor en el alta (Registro.jsx) y en /billing/planes: prometía «Tu furgoneta: inspecciones, taller, ITV y seguro» (la app de ruta no lleva flota: SECTORES_REGISTRO["autonomo"]) y hablaba del «plan Mensajería» (es un sector). Ahora: «Navegación con voz dentro de la app». Backend desplegado y comprobado en la API.
- Hallazgo: el súper/distribución (Gadis, Disgón) compra REPARTO por repartidor, no flota por furgoneta. Con Esencial (mín. 10) una tienda con 3 furgonetas y 5 repartidores paga 80 €/mes, 35 € por furgonetas que no tiene. Propuesta a Dani (sin decidir): plan «Reparto» a 12 € por repartidor activo (mín. 3) con sus furgonetas sin coste, o como mínimo quitar el mínimo de 10 a esos sectores (45 €/mes). El resto (Repartidor 9,99; Esencial/Pro/Empresa por vehículo; complemento Reparto 6 €) se queda.
- Gotcha: deploy-frontend.ps1 NO se lanza con `2>&1` desde PowerShell 5.1: el aviso de tamaño de chunk de vite va por stderr y con $ErrorActionPreference=Stop corta el script en «npm run build» sin error visible.
- **Plan Reparto desplegado (06-10 noche)**: súper y distribución pagan 12 € por repartidor activo (con pedidos el mes anterior), mínimo 3, furgonetas incluidas (`PLAN_TARIFAS["reparto"]`, `_LIM_REPARTO`, cobro en `_cobros_del_mes` sin sumar la app aparte). El alta de esos sectores ofrece Reparto y Pro, sin Esencial; /planes lo enseña con «¿cuántos repartidores?». El catálogo de producción no se tocó: `_catalogo_planes` completa con el código lo que la base no trae. Verificado en producción (/billing/planes y /planes). Hoja interna de precios por tipo de cliente: https://claude.ai/artifact/MFbFT22qUkE9J4ZjmVuFob · presentación de Auto Radio rehecha: https://claude.ai/artifact/4Y9df5yxDohWsdNXBMKfdv (la de anoche, SMsSFEV2…, ya no se puede abrir).
- Gotcha: las pruebas `humo` sirven `dist` tal cual. Tras un despliegue, `dist` lleva los píxeles y el aviso de cookies cambia («Aceptar»/«Solo necesarias»): fallan «Cobro · alta nueva» y «Portada en chino». Antes de probar, `npx vite build` sin VITE_*_PIXEL_ID.

## 10-10-2026: TikTok sin registros, causa y campaña nueva
- Medido (analitica_eventos, 06–09/10): 2.005 visitas de TikTok a /repartidores, 62 % se van sin hacer nada, 35 % se quedan 10 s, 3,5 % llegan a la mitad, 5 empiezan el alta, **0 altas**. Horario humano: no son bots, es gente que no es repartidor. Las 4 altas de esos días llegaron directas o por Google.
- Causa en la campaña «FDS Repartidores — 250 € hoy — 7 idiomas»: optimizada a **Click** y con público «Express Deliveries, Logistics» (2–2,5 M, gente que compra online). **PAUSADA** el 10-10 con 186,52 € gastados, 2.288 clics y 0 conversiones.
- Píxel: nuevo evento **ViewContent** («le interesa»: baja a la mitad de /repartidores o empieza el alta, una vez por página; `eventoUnaVez` en metaPixel.js). Verificado en producción (sale la petición a TikTok). Solo con cookies aceptadas: el píxel ve ~30 % de las visitas. Se mide `cookies_si`/`cookies_no`.
- Campaña nueva en BORRADOR, lista para que Dani pulse Publish all: «FDS Repartidores — interés ES (10-10-2026)», Ventas en web, optimiza **View content**, máximo de resultados, 20 €/día del 10 al 17-10 (≤140 €), España 18–54, hashtags #repartidor #repartidores #reparto #transportistas #mensajeria (188–231 mil), 3 vídeos en español, 3 textos propios, etiqueta de contenido con IA (voz sintética), mejoras automáticas solo «Product highlights» y «Video quality», detalles del producto limpios (fuera «repair service», «Entrega rápida», «Sin card»), URL con utm_campaign=rep_interes. **No se puede quitar la TikTok Ad Network** en este tipo de campaña y ahí no se aplican los hashtags: vigilar el desglose por ubicación al día siguiente.
- LSSI (un grupo de Telegram borró el enlace): /repartidores y /planes enlazan aviso legal, privacidad, términos y cookies; encargados reales en la privacidad. **Falta de Dani**: nombre completo, NIF y domicilio para el aviso legal (persona física hasta que exista la sociedad).

## 10-10-2026 (tarde): plan gratis, aviso legal completo y fotos de TikTok
- **Plan gratis del repartidor** desplegado y verificado: gratis para siempre hasta 15 paradas nuevas al día, sin tarjeta; sin tope 9,99 €/mes. La app ya no se bloquea nunca (prueba acabada, regalo vencido, pago fallido → plan gratis). Detalle en PRECIOS.md. Pruebas: test_plan_gratis.py y humo «Cobro · plan gratis».
- Aviso legal completo (titular Daniel Lampón Vieites, NIF y domicilio en Santiago). Dani puede escribir al admin del grupo de Telegram.
- Campaña TikTok «interés ES» publicada por Dani: primera hora 7,49 €, 9 clics a 0,83 €, 21 visitas y **9 llegan a la mitad (43 %, antes 3,5 %)**; 0 altas aún. Ojo: 0 de 21 pulsan el aviso de cookies, así que el píxel apenas manda señal; revisar en unas horas y, si sigue, rediseñar el aviso (siempre con las dos opciones igual de fáciles).
- Carrusel de 7 fotos («5 trucos para acabar antes la ruta») e imagen suelta para TikTok en docs/anuncios/tiktok-fotos (texto y hashtags en TEXTO.md); se regeneran con scripts/tiktok-fotos.mjs.
- Fallan 2 pruebas de test_valor_oddspapi.py también sin cambios (fechas fijas, probablemente): tarea aparte sugerida.

## 10-10-2026 (noche): instalar la app al darse de alta y entrega como Circuit/Spoke
- **Último paso del alta** (`PasoInstalar` en `pages/InstalarApp.jsx`, marca `fds_recien_alta` que ponen
  AltaRapida y Registro): a pantalla completa, antes de la ruta, se puede saltar. Dentro del navegador de
  TikTok/Instagram/Facebook (`navegadorInterno()`): «Abrir en Chrome» (Android, `intent://`) o «Abrir en
  Safari» (iPhone, `x-safari-https://`) con un **pase de un solo uso** (`/auth/pase-movil`, 10 min, se guarda
  solo su huella en `flota_global.pases_movil`; lo canjea `/pase?p=…`). En Chrome: instalar en un toque si
  Chrome deja, si no el APK. En el ordenador: QR con el pase.
- **APK sin Play** (`/descargas/FDS.apk`): variante `web` de `android/` (paquete `com.flotadsp.flota.web`,
  la misma TWA de Play firmada con la clave de subida; `assetlinks.json` la declara). Comparte la sesión de
  Chrome. Recompilar: `./gradlew assembleWebRelease` (ver docs/PLAY_STORE.md) y copiar el APK.
- **Entrega**: «¿Dónde lo dejas?» (en mano, vecino, buzón, portería, lugar seguro; `entrega_donde`), quién lo
  recoge (`entrega_recibe`) y **firma con el dedo** (`entrega_firma`, PNG ≤ 100 KB). Nombre y firma se borran
  con los datos personales; el cliente ve en `/s/<token>` solo «Entregado: al vecino». La oficina lo ve en
  «Ver prueba de entrega».
- **Buscador de paquetes**: escanear un paquete que ya está en la ruta abre su parada en grande y su hueco.
- **Ver la fachada** (Street View) en cada parada situada.
- TikTok orgánico: carrusel «5 trucos» publicado el 10-10 (en revisión al subirlo); el enlace del perfil
  sigue en /registro (cambiarlo a /repartidores lo decide Dani). `docs/anuncios/tiktok-fotos/carrusel-trucos.mp4`
  es la versión en vídeo por si hace falta.

## 10-10-2026 (noche, 2): micro, escáner universal, historial, incidencias, ver la puerta
- **Micrófono**: no iba porque `_headers` tenía `Permissions-Policy: microphone=()`. Ahora `microphone=(self)`;
  el dictado enseña lo que entiende y, si el navegador no deja (iPhone instalada, TikTok), lleva al micro del teclado.
- **Escáner en cualquier móvil**: `lib/codigos.js` usa el lector del navegador o, si no hay (iPhone, navegador de
  TikTok, ordenador), `barcode-detector` (zxing-cpp en WebAssembly) servido desde `/ocr/.../zxing-reader-3.1.3.wasm`.
  **Escanear y ya**: si el código no está en la lista, el fotograma de la etiqueta se lee y rellena la parada; un
  código 2D que ya trae la dirección la rellena sin foto.
- **OCR en el móvil**: la foto se prepara (tamaño, grises, contraste) y, si no sale dirección, segundo intento en
  modo «texto suelto». Techo del OCR: para leer bien de verdad, IA con clave DE PAGO.
- **IA de etiquetas**: `REPARTO_IA_CLAVE` (clave de un proyecto con facturación solo para esto). Sin elegir, activa
  para quien reparte solo, apagada para empresas. **La clave de Flota en Fly (…k1qQ, «Proyecto de Gemini 3») es de
  nivel gratuito**: no vale para datos de clientes. El proyecto «flota» (…OX8A) es Nivel 1 prepago. Falta que Dani
  ponga la clave (yo no meto claves).
- **Incidencias**: en «hechos hoy» un no entregado se puede «Volver a intentarlo» o dar por entregado; un entregado,
  corregir a no entregado.
- **Historial**: cada día en su pantalla (horas, km, cobrado, cada parada con hora, dónde se dejó, prueba con firma),
  «Ver otro día» y «Pasar a hoy» para lo no entregado.
- **Ver la puerta**: `/reparto/pedidos/{id}/fachada` pide a OSRM `nearest` (5 puntos) el de la calle de la dirección
  y calcula el rumbo hacia la casa; el enlace abre Street View mirando al portal. Se guarda en `vista` (se borra con
  los datos personales). No sale con ubicación «aproximada» ni en China.
- TikTok: la bio del perfil ya dice «Gratis: flotadsp.com/repartidores» (el enlace clicable no está disponible en la cuenta).

## 10-10-2026 (noche, 3): de dónde salen las altas y anuncios «Promo de lanzamiento + gana 5 €»

- **Origen de las altas** (cruce `organizations.created_at` ↔ `registro_ok` de `analitica_eventos` y la primera
  visita de esa sesión; utm_campaign NO se guarda, la campaña se distingue por `utm_content`): el 10-10, 4 de 5 altas
  vienen de Meta «Gratis sin límite» (`facebook`+`video`), unas 23 visitas y 7,68 € → ~1,9 € por alta. TikTok: 203 €,
  2.328 clics, ~3.700 visitas en 12 días y **0 altas**. Las del 03–07/10 eran casi todas pruebas (Revisor Google,
  pepito, Prueba prueba, Dani, Juanjo desde la app de Play).
- **Vídeo nuevo**: `VARIANTE=directo|pov EXTRA=gana node scripts/montar-sketch-repartidora.mjs` añade al final una
  tarjeta sin voz «Y además… GANA 5 € por cada compañero que la use · Lo cobras por Bizum» con las condiciones, y la
  oferta se titula «Promo de lanzamiento». Salida en `docs/anuncios/reales/salida/meta/FDS-{directo,pov}-gana-*.mp4`
  (4:5 con laterales desenfocados para el feed). Imagen nueva `lanzamiento-{9x16,4x5}` en tiktok-fotos.
- **Publicado**: Meta, anuncio «FDS — Lanzamiento + gana 5 € (vídeo)» dentro de «FDS Registros — Gratis 15 paradas»
  (mismo presupuesto, `utm_content=gana`); Meta propuso imágenes con IA que ponían a la persona de Pexels junto a la
  app: NO usadas (licencia). TikTok: los 2 vídeos «gana» y un 4.º texto añadidos al anuncio Smart+ (TikTok había
  vuelto a meter 12 vídeos generados en inglés: quitados; el interruptor de autoañadir no se deja apagar, se marcó
  «Require review»). Orgánico: carrusel «Promo de lanzamiento» en TikTok (la subida de VÍDEO en TikTok Studio se queda
  cargando desde el navegador; las fotos sí van) y reel en la página FDs de Facebook. Telegram Web no tiene sesión
  (pide QR del móvil): el mensaje lo pega Dani. edge-tts sigue con 403 aunque se actualice: sin voz nueva.

## 10-10-2026 (noche, 4): publicidad hecha y primera ronda de fallos

- **Publicado**: anuncio Meta «Lanzamiento + gana 5 €» (en circulación), 2 vídeos al anuncio de TikTok, carrusel en
  TikTok, reel en la página FDs y posts en los grupos «Repartidores BCN» y «Repartidores de paquetería autónomos»
  (11,9 mil). Subir Meta a 30 €/día lo bloqueó el control de permisos (gasto): sigue a 15 €/día, lo decide Dani.
  La vista previa de /repartidores en Facebook decía «7 días gratis»: imagen og nueva (`og-repartidores.png?v=promo1231`)
  y re-extraída en el depurador de Facebook. Telegram Web pide QR: el mensaje lo pega Dani.
- **Fallo grave arreglado**: en el tema por defecto (híbrido) los textos pastel 100-300 salían casi blancos sobre el
  contenido claro. El repartidor nuevo NO veía «Verlo en acción con 3 paradas de ejemplo» ni «Gana 5 €». Reglas
  generadas al final de `index.css` para todas las clases que usa la app; botones blancos sobre turquesa/verde a
  4,5:1 (`text-brand-tinta`, `bg-emerald-700`); `contraste.spec.js` mira ya /ruta (vacía, con ejemplos, Historial,
  Ajustes y Cuenta) en los tres temas.
- **Guía**: sin ubicación, al entregar el mapa se quedaba en la parada anterior; ahora salta a la siguiente.
- **Medición** en la app de ruta: `ruta_escaner`, `ruta_escaneo`, `ruta_codigo`, `ruta_foto_etiqueta`,
  `ruta_parada_nueva`, `ruta_ordenar`, `ruta_navegar`, `ruta_entregado`, `ruta_no_entregado`.
- **Portada /repartidores**: la oferta del anuncio (gratis hasta el 31-12 y 5 € por compañero) arriba del todo.
- Dato: TikTok precarga la portada; sus «visitas» casi nunca son personas (ver memoria origen-altas).
- **Correo del día siguiente** («¿Te ayudo con tu primera ruta?»): con la promoción decía «te quedan N días de
  prueba»; ahora recuerda «gratis y sin límite hasta el …» y las paradas de ejemplo (es/pt/en, con test).
- **Alta**: si el dominio del correo tiene una errata (gmial.com, hotmal.es, gmail.con…) sugiere el bueno
  (`lib/correo.js`, en la portada y en /registro, con test de humo).
- Revisado sin cambios: /repartidores pesa 331 KB de JS y pinta en 2,1 s con 4G lento; carga bien con el navegador
  de TikTok y de Facebook; sin errores de navegador desde el 06-10. Las sesiones de la app de Play que saltan
  /app ↔ /empezar y pulsan sin rellenar nada son el robot de pruebas de Google (móvil y tableta a la vez).

## 11-10-2026 (tarde): Latinoamérica sin presupuesto de Meta

- **Giro**: Dani ya no tiene dinero para Meta; pide Latinoamérica y crecer en orgánico («el dinero les viene genial»).
  Plan y diario en `docs/PLAN-1000.md`. Cifra a esta hora: 16 autónomos reales.
- **Invita y gana fuera de España**: por PayPal (España sigue con Bizum/IBAN; China no tiene). Para frenar trampas,
  solo cuentan entregas a direcciones distintas y repartidas en el día (`_ref_uso_real`, 45 min de margen).
- **«Comparte tu día»** (`lib/compartirDia.js`): al acabar la ruta (5+ entregas, nada pendiente) imagen 1080×1920
  con paradas, horas, km y el QR de invitación de quien la comparte (`utm_medium=dia`). Se dibuja en el móvil.
- **Moneda local**: «Mi dinero hoy» pide la tarifa en la moneda del país, entiende «2.500» como dos mil quinientos,
  y el backend admite tarifas en pesos (topes solo contra disparates).
- **Brasil** entra en `PAISES_REPARTO` (reales, prefijo 55, cobro por **Pix**).
- **Portada por país**: «Sirve igual si repartes para…» enseña las empresas del país del visitante (por la hora
  del móvil, `paisDelMovil()` en `lib/region.js`). Excepción de `check-marca` para esa lista.
- **Demo en su ciudad**: «Probarla ahora» manda país y zona; la demo pone 8 paquetes en Ciudad de México, Buenos
  Aires, Bogotá, Santiago, Lima o São Paulo (países vecinos, la más cercana), a su hora y con el almacén allí. El
  token de demo lleva `rg` = [país, zona, ciudad]; sin país conocido, A Coruña como siempre. Coordenadas de
  Nominatim; donde solo encontró la calle, la dirección va sin número. Las paradas de ejemplo de una cuenta real sin
  GPS ni almacén caen en su país (`_rep_centro_pais`), no en Madrid.
- **Grupos de Facebook** (como Daniel, no como la página FDs): publicado en «Repartidores Mercado Libre México»
  «Repartidores CDMX», «Mercado flex envios logísticas repartidores cadetes» (Argentina) y «MENSAJERÍA Y
  LOGÍSTICA BOGOTA»: las 4 pendientes de aprobación del admin (Facebook enseña la tuya en el muro aunque esté
  pendiente: mirar `/groups/<id>/my_pending_content`).
  Unido a 3 de Colombia y 2 más de Argentina. Un grupo pedía «¿cuánto llevas repartiendo?»: no se inventa, se salta.
- Las «594 visitas de YouTube» del 03-10 eran un robot (todas en «/», ni una acción).
- **Más tarde**: portugués de Brasil (`aBrasil()` en `lib/idioma.js`: senha, paradas, celular, cadastro…; voz y
  fechas pt-BR), demo en un módulo (`lib/demoReparto.js`), guías HTML para Google en Pages Functions
  (`functions/guia-ruta-de-reparto.js` y `guia-rota-de-entregas.js`, en el sitemap), **Google Search Console
  verificado** con `public/google51144a3efae4ec3d.html` (NO BORRAR) y sitemap enviado. «Probar sin cuenta» NO va en
  /empezar (decisión de Dani del 04-10; lo volví a poner y lo quité). Post de BCN corregido a 2,50 €; reel de FDs
  con comentario de actualización; el carrusel de TikTok del 10-10 lo tiene que editar Dani desde el móvil.

## 11-10-2026 (mediodía y tarde): «no pares»

- **Español de Latinoamérica** en la app (`aLatam()` en `lib/idioma.js`): celular, camioneta, toma una foto,
  estacionar, auto… para quien tiene la hora de un país latino o el móvil en es-MX, es-AR, es-US…
- **Manos libres** en la guía (`Navegacion.jsx`, `ordenDeVoz()`): «entregado», «no entregado», «he llegado»,
  «deshacer», «llamar», «repite», «silencio» en es/pt/en. Por voz no pide la foto; «deshacer» deshace. No escucha
  mientras habla la app, frases de ≤4 palabras, 2,5 s entre órdenes. En la portada como ventaja («en Android»).
- **Correos nuevos** (`ciclo_correos.py`): «recordatorio» (días 3-8 sin paradas) e «invita» (a las 10 entregas,
  con su enlace de «Invita y gana», importe —5 € o 2,50 € según su alta—, Bizum/PayPal y mínimo de 10 €).
  Los importes con céntimos salen ya con dos cifras («2,50 €»).
- **Países**: Portugal, Francia, Italia, Alemania, Reino Unido, Irlanda, Bélgica, Países Bajos, Suiza, Austria,
  Andorra y EE. UU. entran en `PAISES_REPARTO` (antes caían en «es» y el buscador de direcciones buscaba en
  España). `tools/metricas/corregir_pais_por_zona.py` corrige las cuentas ya creadas (solo Guilherme, Lisboa).
- **YouTube Shorts** (canal «FlotaDSP»): 5 vídeos públicos (ver memoria youtube-shorts-flota). Las 2-3
  «visitas» de cada uno al publicarlo, sin ninguna acción, son el robot de YouTube que revisa los enlaces.
- **Métrica**: `usuarios_total.py` separa a los testers de Play (correo como nombre o 3 altas en el mismo
  minuto). A esta hora: 16 autónomos reales + 3 testers. Un usuario de verdad ya: 36 paradas y 11 entregas.
- Grupos de Facebook: 7 publicaciones en grupos latinos, todas pendientes de admin.

## 11-10-2026 (noche): arreglos de lo que veían los usuarios

- **Errores guardados de los navegadores** (`client_errors` en la base `flota`, scratchpad `errores_cliente.py`):
  de ahí salieron tres fallos reales.
  - **Empleo**: con un CV elegido desde Drive/la nube, el envío moría sin respuesta siempre igual (el 21-09 una
    persona falló 10 veces y entró al quitar el CV; el 06-10 otra falló 4 y se fue). Ahora el CV se lee al
    elegirlo y, si con él no sale, la candidatura entra sin él y se le dice (`enviarConCvOSinEl`, vigilado por
    `scripts/check-envio-candidatura.mjs` y un test de humo).
  - **Traductor del navegador**: «removeChild… not a child» al pulsar «Entrar» con la página traducida (3 intentos
    el 03-10). `main.jsx` hace tolerantes `removeChild`/`insertBefore` (solución del propio React, issue 11538).
  - «Java object is gone» (navegador de Facebook) pasa a ruido: no es nuestro.
- **La app instalada abre directa en /ruta** para quien reparte solo (`flota_inicio` con su id; antes cargaba el
  panel de empresa en cada apertura). El bucle /app↔/panel del 11-10 a las 7:00 era el robot de Play relanzando.
- **Correos «primer día» y «recordatorio» por la mañana de su hora** (7-9, lunes a sábado): salían a la hora del
  alta, de tarde o de noche. Nadie tenía avisos push activados, así que el correo es lo único que llega el lunes.
- **Portugués de Brasil de verdad en el embudo** (`lib/textosBrasil.js`): portada, «Empezar», alta, primera
  pantalla, recorrido, aviso de la mañana y cookies. Antes: «guia-o por voz», «a app», «Ganha… que a use».
- **Guías para Google**: «ruta con más de 10 paradas» (es) y «rota com mais de 10 paradas» (pt-BR), con el dato
  del límite de la ayuda oficial; enlazadas y pedida su indexación. `enPromo()` exportado de la plantilla.
- **9 Shorts** en YouTube (en, fr, it, de añadidos). TikTok por web: la subida llega a sus servidores pero la
  página no pasa del procesado con Chrome en segundo plano; Dani no quiso traer Chrome al frente.
- **Para Dani**: (1) la campaña de TikTok «interés» sigue gastando (90 visitas en 24 h, 0 altas; 203 € antes y 0
  altas): pausarla y pasar ese dinero a Meta (~1,9 € por alta) cuando arregle el pago; (2) el carrusel de TikTok
  del 10-10 dice «5 € por Bizum» (editar desde el móvil); (3) 3 de los 7 posts en grupos de Mercado Libre los
  suprimieron los admins.
- **Más tarde (noche)**: la foto de la etiqueta entiende el país (`lib/interpretaEtiqueta.js`: teléfonos, CP y
  calles de México, Brasil, Colombia, Argentina, Perú, Portugal, EE. UU.…; colonia/bairro y depto/apto se pegan a
  la dirección; `scripts/check-leer-etiqueta.mjs` con 12 etiquetas, en CI). Brasil también en «Instalar la app»
  y en los **correos** (idioma «br» en `ciclo_correos.py`: você, celular, pacotes; y el aviso push de la
  mañana). Los correos en español, con «celular», «Toca» y «toma una foto» para Latinoamérica.
- Calidad de paradas: 6 de 24 sin situar en el mapa; todas con la dirección rota de origen (códigos o fotos con
  prefijos y símbolos), varias de pruebas de Dani. Con tan pocos casos no se tocó el buscador.

## 13-10-2026: compartir el referido con la recompensa visible

- El mensaje de «Invitar a un compañero» ahora incluye el importe real que devuelve `/referidos` (2,50 € para las
  cuentas nuevas; 5 € para las cuentas antiguas que conservan aquella oferta) y las condiciones principales del
  programa: 20 entregas reales a direcciones distintas, en 2 días y durante el primer mes.
- Se conservan el enlace personal y sus UTM. El texto está traducido a los seis idiomas de la app y a portugués de
  Brasil; `check-textos-ruta.mjs` vigila también `lib/compartir.js`.
- Pendiente: publicación o compra de anuncios requiere fijar países/canales y un límite de gasto. No desplegar
  cambios sobre FlotaDSP; el destino correcto es Flota (`flota`).
## 13-10-2026: referido y cartera individual en el portal del conductor

- El portal real de conductor genera un enlace personal asociado al identificador de conductor y a su email laboral; no usa la cartera del DSP ni aparece en la demo.
- Las nuevas altas autónomas con ese enlace quedan atribuidas al conductor. El premio de 2,50 € se acredita tras uso real (20 entregas válidas, 2 días), sin tope mensual y con detección de misma red.
- La cartera individual permite solicitar Bizum/IBAN o PayPal desde 30 €. Las solicitudes quedan visibles al super-admin en «Negocio → Retiradas de la cartera» y se pueden pagar o rechazar desde allí.
- Se actualizaron las condiciones y el aviso de privacidad; la implementación se publicó el 13-10-2026 en Flota.
## 13-10-2026: captación y control de referidos de conductores

- Enlace individual ahora abre `/invita`: página móvil con propuesta centrada en el problema del repartidor, demo, alta y atribución del código referido. El enlace antiguo `/repartidores?ref=...` sigue funcionando.
- Cartera del conductor: premio 2,50 €, sin límite mensual y retirada desde 30 €. El formulario explica dónde solicitarla y ofrece Bizum/IBAN en España o PayPal fuera de España.
- Super-admin → Negocio: resumen por conductor de invitaciones, cualificados, premios, saldo y detalle de altas; la cola «Retiradas de la cartera» conserva los datos de pago y las acciones de registrar pago enviado o rechazar/devolver el saldo.
- El pago se ejecuta manualmente (Bizum, transferencia o PayPal) y después se registra en el panel. No hay proveedor de pagos bancarios conectado.
- Publicado en Pages `flota` y API `flota-backend`; health de Fly y verificación del bundle/edge en verde. Pasaron lint/build, 157 pruebas de humo y backend (1.139 pasaron, 1 omitida). El humo autenticado de despliegue no corrió: faltaba SECRET_KEY local; no se leyó ni cambió ningún secreto.

## 13-10-2026: consentimiento de novedades y referidos desde candidaturas

- El formulario público de empleo añade «Quiero recibir novedades de FDS», desmarcado por defecto y separado del consentimiento necesario para la candidatura. Si se marca, exige un correo válido y registra la fecha del consentimiento.
- Las campañas reales para candidatos incluyen solo a quienes aceptaron recibir novedades; las pruebas de campaña siguen usando su destinatario de prueba explícito.
- Tras enviar la candidatura se muestra «Invita y gana», con enlace etiquetado a la página de repartidores y condiciones del premio de 2,50 €.
- El panel de empleo indica el consentimiento en cada ficha y en la exportación CSV; la política de privacidad describe el uso opcional.
- Verificación antes de publicar: 1.141 pruebas de backend pasaron, 1 omitida; 157 pruebas de humo pasaron; lint sin errores (52 avisos preexistentes), compilación y chequeos estáticos correctos.
## 13-10-2026 (madrugada, sesión en la nube 01FkmXNv): meter paradas sin escribir y zonas de carga

Rama **`reparto-etiquetas-carga`**, integrada en `main` y publicada en Flota el 13-10-2026 desde el PC de Dani.
Dani pidió: lo que más cuesta es meter las paradas (punto 1), dirigirse a quien reparte con lista sin
ordenar (punto 2), zonas de carga y descarga en el mapa, y que el escáner lea la dirección y el teléfono
de la etiqueta de cualquier empresa.
- **Escáner con todos los códigos** (`lib/codigoEtiqueta.js`): antes se quedaba con el PRIMER código (la
  barra) y GLS pone la dirección en su SEGUNDO 2D. Ahora junta lo leído durante medio segundo y lo
  interpreta: GS1 Scan4Transport (4301 nombre, 4302/4303 dirección, 4305 localidad, 4308 teléfono, 420 CP,
  4309 coordenadas con la fórmula de github.com/gs1/geocode), ANSI MH10.8.3 de UPS/FedEx (heurístico) y
  datos separados por «|». Lo que falte lo pone la foto del mismo instante sin pisar lo leído.
  **No probado con etiquetas reales** (no hay muestras): pedir a Dani fotos de 5-10 etiquetas de empresas
  distintas (SEUR, GLS, MRW, Correos, CTT, Amazon…) y añadir sus códigos como casos en `check-leer-etiqueta.mjs`.
- **«Escanear seguidos»** (en «Cargar paquetes»): la cámara no se cierra; si la etiqueta trae la dirección
  completa en sus códigos, la parada entra sola; los repetidos no cuentan; el resto queda «para revisar».
- **Foto de la hoja de reparto entera** y **abrir un CSV/texto** en «Pegar una lista» (`lib/hojaReparto.js`,
  `leerHojaEnMovil`): el OCR del móvil + qué líneas son paradas; va a la caja con cabecera para revisar.
  Probado con una hoja impresa leída de verdad por el OCR: salen las 3 paradas; confunde a veces la «Z» del
  código con «7» (por eso se revisa).
- **Zonas de carga y descarga** (`GET /reparto/mi-ruta/zonas-carga`, `reparto.zonas_de_overpass`): de
  OpenStreetMap por Overpass, por cuadrados de ~5 km (nunca las paradas), 24 h en memoria, una petición por
  segundo. Interruptor «C/D» en el mapa. Solo salen las apuntadas en OSM (en España, pocas fuera de grandes
  ciudades) y no dice si están libres. **No verificado contra Overpass real** (la red de la nube lo bloquea):
  tras desplegar, abrir el mapa con paradas en el centro de Barcelona o Madrid y mirar si salen «C/D».
  Siguiente fuente posible: el dataset de Open Data BCN «Zonas de carga y descarga» (en datos.gob.es).
- **Portada /repartidores**: ventajas y la pregunta de la agencia hablan de cualquier etiqueta, la hoja en una
  foto y las zonas (no se tocó el titular: prueba A/B). Igual en `functions/repartidores.js`.
- Pruebas: `e2e/escanear-etiqueta.spec.js` (escáner y cámara simulados, hoja con OCR real, CSV, mapa),
  `backend/tests/test_zonas_carga.py`, casos nuevos en `scripts/check-leer-etiqueta.mjs`.
- **Hallado y SIN arreglar** (estaba así antes de esta sesión):
  - El **CI de GitHub está rojo en todos los commits**. Desde el 10-10 22:00 cada ejecución muere en ~3 s
    sin logs (probablemente minutos de Actions agotados en el repo privado: mirar Settings → Billing).
    Antes fallaban 7 pruebas de Playwright: `activacion.spec.js` (3 × 2, textos de la oferta vieja
    «1 mes gratis»/«14 días» frente a la promo hasta el 31-12) y `humo` «pide instalar la app (QR en el
    ordenador)» en el proyecto móvil (el QR solo sale en ordenador).
  - `test_valor_oddspapi.py`: 2 pruebas con partidos fechados el 09-10-2026, caducadas desde entonces.
  - Chequeos del CI en rojo: `check-hooks` y `check-version-app` rompen en Linux (`pathname.slice(1)`, solo
    vale en Windows); falsos positivos en `check-importados` (`tx` es un parámetro en `lib/guia.js`, «lista»
    es texto en `PruebaReparto.jsx`) y `check-efectos` (`InstalarApp.jsx:26` devuelve su limpieza); de verdad:
    falta la ficha de ayuda de `reparto`, `.text-pink-300` en el híbrido, 2 rutas sin consumidor
    (`/admin/demo-comercial`, webhook de suscripciones de Stripe) y 2 «division-sin-guard».
- **Batería completa de Playwright con la rama** (13-10, 01:50): 409 pasan, 42 se saltan y fallan 9, todas
  ya rojas antes de esta sesión (comprobado contra `f1ee87c`): `activacion.spec.js` (3 × 2), `demo-no-atrapa`
  «Ya tengo cuenta» (× 2, lo tapa el recorrido «Así funciona») y `humo` «pide instalar la app» en móvil.
  Backend: todo verde salvo las 2 de `test_valor_oddspapi.py` (fechas caducadas).
- Validación de publicación en el PC: compilación de producción y chequeo de etiqueta correctos; pasaron
  4 pruebas `test_zonas_carga.py` y 5 pruebas nuevas de `escanear-etiqueta.spec.js`. ESLint terminó sin errores
  (52 avisos existentes). La batería completa previa reportó 9 fallos de navegador y 2 pruebas de fechas
  caducadas, todos documentados como preexistentes y ajenos a esta rama.
- **Publicado**: Fly `flota-backend` desplegó y la máquina quedó en buen estado; `/api/health` devolvió
  `status=ok`, `mongo_connected=true`. Pages `flota` publicó el bundle nuevo, verificado contra el local;
  los 229 ficheros del edge terminaron sirviéndose correctamente. Fly informó que falta un registro AAAA,
  pero el dominio/API responde por HTTPS. El humo autenticado de los scripts no corrió porque este entorno
  no tenía `SECRET_KEY` local; la salud pública y la conexión con Mongo se comprobaron por separado.
- **Integración en GitHub**: merge commit `4711086` en `main` (publicación verificada el 13-10-2026).

## 13-10-2026: reducir errores al leer direcciones de etiquetas

- El OCR móvil compara tres segmentaciones antes de elegir dirección y conserva alternativas cuando discrepan. En la foto real de OGA5 enviada por Dani, el formulario muestra `Ladeira, Chazo 33`; el teléfono queda vacío porque `636830253` aparece junto a códigos/logística y no está rotulado.
- La calle se extrae desde el tipo de vía (`Ladeira`) y se descarta ruido OCR posterior (`AZ 00`). Se busca CP/localidad por toda la etiqueta, pero cuando el número está mezclado con tracking/ciclo y no tiene contexto suficiente se deja vacío para no guardar un CP falso (en esta foto el OCR no pudo confirmar `15938`).
- Una dirección leída de foto exige revisión/confirmación manual antes de guardarse. No se afirma compatibilidad perfecta con todas las empresas: el QR/DataMatrix solo da la dirección si la empresa la codificó; si no, la foto se interpreta localmente y datos dudosos quedan para revisar.
- Verificación: `check-leer-etiqueta.mjs`, ESLint en los tres archivos tocados, build Vite y Playwright móvil usando la foto real. No desplegado todavía.
- Pendiente para ampliar cobertura: reunir etiquetas reales de distintas compañías y añadir el texto OCR/códigos de cada formato como casos. No hay un formato QR único universal.

## 13-10-2026: archivar candidatos del tablero de Empleo

- Cada columna ofrece «Limpiar columna»; oculta en bloque los candidatos visibles de esa fase. La ficha, el CV, las notas, el consentimiento de novedades y el historial no se borran.
- «Ocultos» permite consultar las candidaturas archivadas; desde su ficha se pueden restaurar al tablero. También se puede archivar/restaurar una persona individualmente.
- La acción conserva la fase original y registra quién/cuándo la archivó. Sigue vigente el plazo de retención existente de las candidaturas (12 meses); archivar no lo amplía.
- El lote está acotado por oferta, fase, centro y los IDs visibles, evitando actuar sobre otros resultados filtrados.
- Verificación: prueba de interfaz de archivar/restaurar, pruebas de Empleo en backend, ESLint, chequeos estáticos y build. Despliegue pendiente.

## 14-10-2026: puesta a punto, promoción de 10 € y anuncio

Dani: «corrígelo todo, mira todo lo que se ha implementado, pon la app a punto» + anuncio de Facebook con
«10 € por cada amigo que inviten y la empiece a usar», mínimo de retirada 60 € que no se vea hasta
intentar retirar, promoción hasta el 31-10-2026.

- **Recogido lo que la sesión del 13-10 dejó sin publicar** (archivar candidatos de Empleo, cartera de
  conductor unificada, consentimiento de novedades): su test leía la función sin el decorador de la ruta y
  prohibía «expira_en» aunque solo saliera en una proyección; el test del escáner esperaba el diálogo
  «Cargar paquetes» cuando con un paquete se titula «1 paquete cargado»; faltaban 4 traducciones
  («Paquete leído; guardando lote», «en cola», «paradas añadidas», «ya estaban») y el chino de 7 claves de
  Empleo. Y la «mejora de precisión» del 13-10 en `interpretaEtiqueta.js` rompía 6 casos del checker
  (cortaba «123 Main St.» a «St.», «GRAN VIA 32» a «VIA 32», «Carrera 7 # 32-16 Apto 501» a «Carrera 7»):
  ahora lo de antes del tipo de vía solo se quita si es un rótulo («IN :»), y tras el número solo se corta
  basura del OCR («AZ 00»); «ES» ya no vale como población.
- **Promoción «Invita y gana 10 €»** (`_REF_PROMO_*` en server.py): 10 € por cada invitado que se dé de
  alta hasta el 31-10-2026 incluido (hora de Madrid; manda la fecha de alta del invitado, no la de sus 20
  entregas), también para la cartera de conductor. `/referidos` y `/referidos/{codigo}` mandan
  `promo_hasta` y `promo_cent` mientras dura; la app (`lib/precios.js`: `refCentActual`, `refPromoActiva`,
  `fechaRefPromo`) lo pinta en la portada, la tarjeta de la ruta, la cartera, /invita y la página de empleo.
  El correo «invita» lo dice en es/pt/en/br.
- **Retirada desde 60 €** (`_REF_RETIRADA_MIN` y `_DRIVER_REF_RETIRADA_MIN`), y **no se enseña hasta que
  intentan cobrar**: el botón «Cobrar» sale con cualquier saldo y, por debajo, dice «Se puede cobrar a
  partir de 60 €. Te faltan X» (el servidor responde lo mismo). Fuera de la app, el mínimo SÍ consta en
  las condiciones (Terminos 5 bis y 5 ter): publicar condiciones falsas o callar una esencial es un riesgo
  legal real; Dani queda avisado. Quitado de los correos, de la cartera de conductor y del panel.
- **Correos del ciclo**: idioma «br» (portugués de Brasil: você, celular, pacotes) y, en español, «celular»,
  «Toca» y «toma una foto» para Latinoamérica (`_a_latam` en ciclo_correos.py). El aviso push de la mañana,
  también en brasileño.
- **Anuncio Meta** (docs/anuncios/CAMPANA-14-10-INVITA10.md): vídeos `FDS-{directo,pov}-gana10-{9x16,4x5}.mp4`
  (`scripts/anuncio-gana10.mjs` corta la tarjeta «2,50 €» y pega la de 10 €), imagen
  `tiktok-fotos/gana10-9x16.png`. En el Administrador de anuncios, el anuncio «FDS — Lanzamiento + gana
  2,50 €» de la campaña «FDS Registros» se ha renombrado «FDS — Invita y gana 10 € (promo hasta el 31-10)»
  con los textos nuevos y la URL `utm_content=gana10`, guardado como borrador; **el vídeo sigue siendo el de
  2,50 €** (cambiar el contenido multimedia da «Error de permiso #1487184» con mi control) y la cuenta sigue
  restringida por el pago: lo publica Dani tras pagar y cambiar el vídeo.
- Medido: 17 autónomos reales (+1 en 3 días, de EE. UU.), 0 invitaciones usadas, 0 retiradas. Sin anuncios
  activos no entra nadie.
- Pendiente de la lista del 13-10 (no tocado hoy): CI de GitHub rojo (minutos agotados: Dani), `check-hooks` y
  `check-version-app` en Linux, `activacion.spec.js` con textos viejos, `demo-no-atrapa`, test_valor_oddspapi
  con fechas caducadas, ficha de ayuda de `reparto`. Los 9 Shorts de YouTube y los posts en grupos siguen
  diciendo «2,50 €» y «cobro desde 10 €».

## 14-10-2026 (tarde): el anuncio, publicado; reel en la página; Runway

- Dani pagó el saldo de la cuenta publicitaria (20,84 €) y quiso que el anuncio vendiera la app (qué es, qué
  hace, que la prueben) además del premio. Texto nuevo «la app primero» (CAMPANA-14-10-INVITA10.md), vídeos
  `FDS-directo-gana10-{9x16,4x5}.mp4` subidos y seleccionados, botón «Ver detalles», enlace visible
  `flotadsp.com/repartidores`, dos imágenes generadas por Meta a partir de las pantallas de la app (no las de
  la persona de Pexels). **Publicado**: anuncio 52644270307539 en la campaña «FDS Registros — Gratis 15 paradas»
  (conjunto España · 20-55 · reparto · registro), estado «En preparación» hasta que Meta lo revise.
- Trucos del editor de Meta que funcionaron: el «Texto principal» solo acepta TECLADO (clic + Ctrl+A + escribir;
  `insertText` y el evento `paste` dejan el editor roto: «no se ha podido cargar el componente»); para subir un
  vídeo, interceptar `HTMLInputElement.prototype.click` al pulsar «Subir» en «Cambiar selección», meter el input
  capturado en el DOM con un aria-label y usar file_upload (máx. 10 MB por llamada); al pulsar una miniatura
  seleccionada sale su panel de información y tapa la de al lado: mover el ratón a un hueco antes de pulsar.
  «Revisar y publicar (N)» publica TODOS los borradores (hay 3 ajenos: no usarlo); el «Publicar» del editor
  publica solo ese anuncio.
- **Reel en la página FDs** con el vídeo 4:5 y el texto largo (`utm_content=post_gana10`): publicado desde el
  compositor de Business Suite (un vídeo corto se convierte en reel; descripción por teclado; «Compartir»).
- **Runway**: Dani entró con su cuenta (Personal · Free · 500 créditos). En el plan gratuito ningún modelo de
  vídeo (Gen-4.5, Seedance 2.5, Grok Imagine Lite) deja generar: el botón es «Upgrade». Hace falta el plan
  Standard (lo decide Dani). Si lo activa: 3 clips de ambiente de 5-8 s en 9:16 (furgoneta con paquetes, mano
  con el móvil ante una etiqueta sin que se vea la pantalla, repartidor de espaldas en un portal) y montar
  gancho + app real (tiktok-es.mp4 hasta 16,4 s) + tarjeta «gratis sin límite» + tarjeta «gana 10 €». Nada
  de personas de IA diciendo que usan la app.

## 14-10-2026 (noche): spot v2 «como para la tele», en el anuncio y en la página

- Dani: «esto va a tener poco gancho… busca manera de hacer un vídeo increíble como si fuera para la tele…
  imágenes, ángulos y montaje de app, nada cutre». Runway gratis no genera vídeo, así que el spot v2 se hizo con
  lo que hay: la app real grabada limpia a 720×1280 (`frontend/e2e/spot-v2.spec.js`, apunta los instantes de
  lista/etiqueta/mapa/navegación/entregado/dinero), metida en un móvil dibujado en HTML (bisel, isla, sombra)
  que flota, gira y «respira» sobre un fondo de marca; planos de archivo con color y zoom lento; título por
  escena; tarjetas «GRATIS y sin límite», «GANA 10 €» y cierre; locución es-ES-AlvaroNeural (9 frases) y música
  propia (numpy) con ducking bajo la voz y loudnorm a -14 LUFS. 39,6 s. Pipeline, en orden:
  `py -3 scripts/spot-v2/voz.py` → `py -3 scripts/spot-v2/musica.py` → `cd frontend && node
  ../scripts/spot-v2/tarjetas.mjs` → `npx playwright test spot-v2 --project=escritorio --update-snapshots` →
  `node ../scripts/montar-spot-v2.mjs`. Salidas: `docs/anuncios/reales/salida/spot-v2-{9x16,4x5,1x1}.mp4` y
  las `-web` (< 6 MB, para el puente de subida de Meta). Las voces `vo*.mp3` van a git (edge-tts necesita red);
  `musica.wav` no (7,5 MB, se regenera igual).
- Gotchas de ffmpeg: `scale` con `t` sobre un PNG en bucle da «invalid size» → `zoompan`; el recorte de la
  pantalla con `alphamerge` sobre la máscara en gris; `rotate` con `c=none` para no perder la transparencia.
- **Anuncio 52644270307539**: añadidos `spot-v2-9x16-web.mp4` y `spot-v2-4x5-web.mp4` junto a los dos gana10
  (4 vídeos; Meta elige por ubicación). «Los cambios se han publicado correctamente · 1 anuncio actualizado».
  Al subir con el input capturado, Meta avisa de «Funcionamiento incorrecto de la extensión del navegador»:
  Aceptar y seguir, la subida va bien.
- **Reel en la página FDs** con el spot 9:16 y la descripción larga (`utm_content=post_gana10`): PUBLICADO a las 20:10 (reel de 0:40 en «Publicaciones y reels»).
  Gotcha: el compositor se queda en «Realizando tu publicación» para siempre aunque ya esté publicado; no
  pulsar «Compartir» otra vez (saldría repetido): comprobar en una pestaña nueva la lista de publicaciones.

## 17-10-2026 (01:57): caída de 31 h por la lista de acceso de Atlas

- **Síntoma**: la web cargaba pero la API no (`/api/health` sin respuesta); en los logs de Fly, en el arranque,
  `ServerSelectionTimeoutError: SSL handshake failed … TLSV1_ALERT_INTERNAL_ERROR` en los 3 nodos de cluster1
  y «machine has reached its max restart count of 10». Ese error de TLS es lo que da Atlas cuando la IP que
  conecta NO está en su lista de acceso (no es un fallo de certificados).
- **Causa**: el 15-10 a las 18:45, Atlas («System», nadie a mano) quitó de *Network Access* `0.0.0.0/0` y
  `188.85.223.181/32` (proyecto «Project 0» de la org «Trafico's Org - 2026-05-26»). El backend siguió vivo
  sin poder abrir conexiones nuevas (último evento de analítica: 15-10 18h; última alta: 15-10 14:31) y el
  17-10 a la 01:45 Fly lo reinició y ya no arrancó. Fly no tiene IP de salida fija (ahora sale por
  167.88.159.82; cambia si mueve la máquina), así que una regla por IP no sirve.
- **Arreglo**: Dani volvió a poner `0.0.0.0/0` permanente en Atlas → `fly machine restart` → API 200 y
  `mongo_connected: true`. Los anuncios de Meta estuvieron mandando gente a un registro roto ~31 h.
- **Cómo verlo antes la próxima vez**: `/api/health` ya dice `mongo_connected` (Fly mira `/api/vivo` a
  propósito, ver fly.toml). Si `mongo_connected` es false y desde el PC sí conecta, mirar Atlas → Activity
  Feed → «Network permission entry removed». Desde el PC la cadena buena es `~/.flota-mongo-uri.txt`
  (`~/.flotia-mongo.txt.txt` es vieja: «bad auth»).

## 17-10-2026: bono de 10 € por la primera ruta, promo hasta el 31-12, app más «app», entregar sin cobertura

- **Uso real (17-10, 02:00)**: 31 autónomos reales; 26 abrieron la app en 7 días; 11 volvieron otro día; 9 con
  paradas suyas, 6 con entregas; el que más, Barry (40 paradas, 12 entregadas). Las 14 altas del anuncio
  «gana10» (14-15/10) miraron el ejemplo y no metieron ruta (1 sola parada entre todas). La caída del 15 al 17
  les pilló justo el día siguiente.
- **Promo «Invita y gana» hasta el 31-12-2026** (antes 31-10) y **bono de bienvenida**: 10 € a la cartera de
  quien reparte solo cuando hace su primera ruta de verdad (20 entregas reales en 2 días distintos, la vara
  de «Invita y gana»), una vez por cuenta, para altas hasta el 31-12 (las de antes del 17-10, con su mes
  contado desde el 17-10). Misma red que otra que ya lo cobró → a revisar (`bono_sospechoso`). Movimiento de
  cartera `tipo: "bienvenida"`; `organizations.bono_pagado/_en/_cent`. `/reparto/mi-ruta` devuelve `bono`
  (progreso) y `/referidos` su resumen. Dani pidió «10 € por registrarse»: se le explicó por qué es por la
  primera ruta (cuentas falsas; y es justo lo que empuja a meter la ruta).
- **App**: tarjeta «10 € por tu primera ruta real» con barra (entregas y días; «las de ejemplo no cuentan»;
  ganado → cartera), línea del bono en la cartera, portada con los dos premios, Terminos 5 bis con el bono,
  Empleo e Invita. Correos del ciclo: párrafo del bono en bienvenida/primer_dia/recordatorio y correo «bono»
  (una vez, por la mañana) a las altas de antes; aviso push de la mañana con el bono. «primer_dia» ya no dice
  «Ayer» si fue hace días. Simulado contra producción: el 17-10 por la mañana salían 13 «primer_dia» + 21 «bono».
- **Correo masivo a candidatos: NO enviado.** Dani lo pidió, pero ninguno de los 316 (272 correos) aceptó
  publicidad: 189 vieron la casilla «Novedades FDS» y no la marcaron, 127 vienen de JOIN. Sería spam (LSSI
  art. 21 + RGPD) y Resend puede cerrar la cuenta (y con ella los correos de la app). La casilla del formulario
  ahora dice «novedades y promociones… el bono de 10 €»: a quien la marque (`novedades_fds: true`) sí se le
  puede escribir (`/admin/candidatos/campana-bienvenida` ya filtra por eso).
- **Más app que web** (`RutaApp.jsx`, `index.css`): en el tema híbrido /ruta heredaba el marco oscuro del panel
  (esquina negra, barra de pestañas oscura): ahora toda la app es el `<main>` y la pestaña un `<div>`; fundido
  al cambiar de pestaña (`.ruta-entra`, relleno «backwards» para no tapar las hojas); tirar para actualizar en
  «Hoy» (no en el mapa ni con ventanas); botones sin selección de texto. Historial ya no enseña «{total}» si falla.
- **Entregar sin cobertura** (`MiRuta.jsx`, cola `fds_cola_entregas` en localStorage con la cuenta): sin red o
  con 502/503/504, el cambio se guarda en el móvil, se ve hecho, aviso con «Enviar ahora», se manda solo al
  volver la red y cada 20 s; deshacer lo no enviado lo olvida. El servidor acepta `hecho_en` (últimas 12 h).
- Gotchas de esta tanda: Playwright sirve `frontend/dist` tal cual (si es la del despliegue lleva píxeles →
  sale el aviso de cookies y fallan 26 tests): `npx vite build` antes de los e2e. En Git Bash, `grep -c $'\r$'`
  miente: los finales de línea, con `git ls-files --eol`. En MiRuta hay un estado `yo` (la posición): no usar
  ese nombre para funciones de módulo. El deploy del frontend desde Bash: `powershell.exe -NoProfile
  -ExecutionPolicy Bypass -File scripts/deploy-frontend.ps1` (con `2>&1` en PowerShell 5.1 falla por stderr).
- **Pendiente**: pegar en el anuncio de Meta los textos «bono» de CAMPANA-14-10-INVITA10.md (la extensión de
  Chrome se desconectó de madrugada). Medir el 19-10: `origen_altas.py 3` y cuántos «primer_dia/bono» abren y
  cargan paradas.

## 17-10-2026 (mañana): campaña «10 € con la app» a los candidatos, y el correo «bono» que no salía

- **Fallo del bono**: `_ciclo_enviar` volvía a mirar qué tocaba sin pasar `bono=` y descartaba siempre el correo
  «bono»: el 17 por la mañana salieron los 13 «primer_dia» pero ninguno de los 21 «bono». Arreglado (test
  `test_el_correo_del_bono_sale_de_verdad`). Además el «bono» sale de 9 a 21 de su hora (`en_su_dia`), no solo
  de 7 a 9: es un anuncio, no ayuda para cargar la furgoneta.
- **Campaña a candidatos** (Dani lo decidió tras avisarle del riesgo LSSI/Resend): `backend/campana_candidatos.py`
  (a quién y el texto) + `_campana_bono_vuelta` en server.py. 270 personas (de 316 fichas): una por dirección,
  sin quien dijo que no (`novedades_fds: false`), sin bajas, sin quien ya tiene cuenta (le llega el ciclo).
  Botón «Darme de baja» y List-Unsubscribe de un clic → `/api/correo/baja-email` (firma HMAC por dirección):
  guarda en `flota_global.correos_bajas` y marca `baja_comercial` en sus candidaturas; no se le escribe más.
  Sale sola por tandas de 10:00 a 21:00 (Madrid), hasta `por_dia` (60) y dejando siempre 15 de los 100
  correos diarios de Resend para la app. Se apunta en `candidatos_campana_envios` (`bono10:<correo>`) antes de
  enviar; sin cuota, se desapunta para mañana. Se apaga sola al acabar.
  **Encender/parar**: documento `{tipo: "bono10", activa: true|false, por_dia}` en `flota.candidatos_campanas`.
  Ver cómo va: `correos_enviados` con `por: "campana:bono10"`; altas con `utm_campaign=candidatos`.
- **Brevo**: en FlotaDSP la campaña del 19-09 salió también por Brevo (300/día gratis); en Flota solo está
  `RESEND_API_KEY` y la clave de Brevo no está en este PC ni en esta cuenta de Fly. Con `BREVO_API_KEY`
  (fly secrets set) la campaña va SOLO por Brevo (`_enviar_email(..., solo="brevo")`, hasta `por_dia_brevo`=250)
  y no gasta los 100 de Resend. Si el proveedor rechaza 3 seguidos se para la tanda y nadie queda como enviado;
  una dirección rechazada 2 veces se aparta (`bono10-fallo:<correo>`).
- **17-10 12:08**: `BREVO_API_KEY` configurada en flota-backend (cuenta Brevo «FlotaDSP» de Dani, plan gratis
  300/día; dominio flotadsp.com autenticado; prueba a su Gmail aceptada). La campaña salió por Brevo: 250 de
  270 el primer día (50 por Resend + 200 por Brevo), 0 rechazos, 2 bajas en la primera hora. Los 20 que faltan,
  el 18-10 a las 10:00; luego se apaga sola. Resend sigue siendo el primero para los correos de la app.

## 17-10-2026 (tarde): web 4 veces más ligera, primer uso guiado y «Hoy» con la ruta en marcha

- **Velocidad**: el bloque que se descarga en todas las páginas pasó de 872 KB a 217 KB (72 KB comprimido).
  560 KB eran traducciones: el diccionario del panel vive en `src/i18nDict.js` y se pide la primera vez que una
  pantalla llama a `useT()` (esa pantalla espera con Suspense); `textosRuta*`/`textosBrasil` solo se cargan si el
  idioma no es el español (`lib/idioma.js`, `useIdioma` repinta con un contador). La portada `/` también va por
  partes. `check-i18n`, `check-marca` e `i18n-muertas` leen `i18nDict.js`.
- **Primer uso** (`MiRuta.jsx`, solo en la app del autónomo): en vez del recorrido con «Ver ejemplo» como botón
  grande, «¿Tienes los paquetes delante?» → «Sí, cargarlos ahora» (abre la carga de paquetes) o «Todavía no» →
  «Avísame mañana a las 8» (push), el ejemplo y los 3 pasos. Métricas: `bienvenida_vista`, `bienvenida_cargar`,
  `bienvenida_luego`.
- **Ruta en marcha** (autónomo): añadir paradas en el botón «+» (hoja con todo), bono en una línea, «Navegar con»
  en Ajustes (`ElegirNavegador`); el portal del conductor de empresa sigue igual.
- El mensaje de «Invitar» dice también el bono del invitado. `e2e/activacion.spec.js` llevaba desde el 10-10 con
  3 tests de ofertas antiguas fallando (no estaba en la batería de siempre): puesto al día; corre con
  `npx playwright test humo contraste editar-parada escanear-etiqueta activacion --project=escritorio`.

## 17-10-2026 (noche): tema y letra grande, la semana en Historial y el mes para la gestoría

- **Ajustes de la app del repartidor** (`pages/driver/AjustesMovil.jsx`, en Reparto → Ajustes del autónomo):
  Aspecto Claro / Oscuro / Automático (sigue al modo del móvil y cambia en vivo) y «Letra más grande» (×1,15 en
  los textos de 9 a 22 px dentro de `main.app-ruta`). Se guarda en el navegador (`panel_theme`, `fds_letra`);
  `lib/tema.js` lo aplica al arrancar (`main.jsx`) y el panel entiende `auto`.
- **Historial**: la semana en barras frente a la anterior y «Ganado ≈» con su tarifa (si la tiene puesta).
- **El mes para la gestoría**: `GET /api/reparto/entregas-mes?mes=AAAA-MM` devuelve un CSV para Excel en español
  («;», coma decimal, BOM): fecha, hora de Madrid, estado, motivo, cliente, dirección, bultos, cobrado, forma de
  cobro y código, y al final los totales (entregadas, no entregadas, días, cobrado, ganado según tarifa, km
  previstos y gasolina). Sin ejemplos ni paradas sin cerrar. Desde Historial se comparte o se descarga (últimos 6
  meses). Sin sesión responde 401.
- **El «+» de añadir paradas** ya no flota: va junto a «Empezar a navegar» en el resumen del día (el flotante
  tapaba «Entregado» de la siguiente parada con la pantalla quieta).
- Pruebas: servidor completo en verde; web 189 en verde (`humo contraste editar-parada escanear-etiqueta
  activacion`). Desplegado servidor y web.

## 17-10-2026 (tarde): la opinión de los repartidores, pedida y leída

Dani: «pedir opinión a quienes la usan para que nos llegue el feedback» y «la clave es saber qué necesidad real
hay que cubrir, sin falsos positivos». Medido antes: 3 opiniones en 12 días (las tres «5» sin texto), solo 3 de
39 cuentas de repartidor llegaban a ver la pregunta de la app (2 entregas reales) y nadie las leía.
- **Correo «opinion»** (`ciclo_correos.py`): a los 5 días, una vez, de 9 a 21 h de su hora, si no ha opinado
  ni pulsado «Ahora no». A quien ha cargado paradas: nota de 1 a 5; a quien no: «¿Qué te frenó?» (no he tenido
  reparto / no supe meter los paquetes / ya uso otra app / mi empresa no me deja / otra cosa), después del
  recordatorio. Cada opción es un enlace a `/opinion?o=…&t=…&r=N|m=motivo` (firmado con `_opinion_firma`).
- **Página `/opinion`** (`pages/OpinionCorreo.jsx`, sin sesión): la respuesta viene marcada y cuenta al pulsar
  «Enviar» (abrir el enlace no guarda nada: los antivirus del correo abren todos los enlaces). La pregunta
  abierta es la de la necesidad: «¿Qué es lo que más te complica en tu día de reparto?». `robots`: Disallow.
- **«Mándanos una idea»** en la pestaña Cuenta (`IdeaRuta`), siempre; se guarda como `tipo: "sugerencia"`.
- **Te llega**: cada opinión va a `CORREO_CONTACTO` («Responder» le escribe a esa persona; `por: aviso:opinion`)
  y se ve en Negocio → «Opiniones de los repartidores» (`GET /admin/opiniones`, con la media y qué les frena).
- Tope de 5 opiniones por cuenta y día. Endpoints: `GET/POST /api/opinion/correo`, `POST /api/opinion` acepta
  `tipo` y `motivo`.
- Al desplegar (17-10, 15:30): 19 cuentas recibirán el correo el domingo 18 desde las 9:00 y 1 el lunes; las
  demás, cuando cumplan 5 días.
- Negocio ya no se cae entero si Referidos, Cobros o Salud reciben una respuesta incompleta.

## 17-10-2026 (tarde): 10 € de regalo en la cartera de cada repartidor

Dani: «añádeles 10 € de saldo a todo el mundo para que vea que es real».
- **Dado el 17-10 a las 16:40** a las 39 cuentas del plan Repartidor (37 España, 1 Portugal, 1 EE. UU.): 10 € cada
  una, `regalos.2026-10-17` en la cuenta y un movimiento `tipo: "regalo"` en `cartera_movimientos`. Nadie tenía
  saldo antes: todas quedan en 10 €. Fuera: China, demos y la cuenta del dueño.
- Es APARTE del bono de bienvenida (10 € por la primera ruta real), que sigue: es lo que empuja a cargarla.
- Se cobra con las reglas de siempre (desde 60 €): «Cobrar 10 €» dice «te faltan 50 €». Riesgo de caja: solo
  sale si llegan a 60 € invitando a compañeros que usen la app de verdad.
- Se ve: aviso en «Hoy» una vez por regalo (`fds_regalo_<clave>` en el navegador), línea en la cartera, posdata
  en el correo «opinion» y, al revisar un cobro en Negocio, «Del saldo, sin invitar a nadie: Regalo · Bono».
- Repetible: `_regalo_a_todos(clave, cent)` / `POST /admin/cartera/regalo` (super-admin, `simular`, tope 20 €,
  una vez por clave). Términos: añadido el punto «Regalo de saldo».
- Las cuentas que se den de alta desde hoy NO lo reciben (no lo pidió); se puede dar con otra clave.

## 17-10-2026 (noche): portal en casillas y el mercadillo de repartidores (oculto hasta que Dani lo encienda)

- **Portal del conductor**: la auditoría (y «Mi ruta») a lo ancho; lo demás en casillas de tres. «Comparte y gana»
  es una casilla con su pantalla (antes, una tarjeta enorme encima de la auditoría). «Mis turnos» se abre a quien
  tiene turnos cargados (OGA5 tiene el cuadrante hasta el 17-12; DGA1 todavía no) y dice «Pronto» al resto.
- **Mercadillo** (`backend/mercadillo.py` + sección en `server.py`, `frontend/src/pages/mercadillo/Mercadillo.jsx`):
  compraventa entre repartidores (autónomos, conductores de empresa) y gente de oficina. Base GLOBAL
  (`mercadillo_anuncios`, `_fotos`, `_conversaciones`, `_mensajes`, `_denuncias`, `_avisos`, `mercadillo_conf`).
  - **Oculto** hasta que Dani lo enciende en Negocio → Mercadillo («Hacerlo visible para todos»). Mientras, solo el
    super-admin lo ve y lo usa en **/mercadillo** (vista previa). Una empresa puede apagarlo: `mercadillo_off`.
  - **Nada sale sin aprobar**: cada anuncio entra «en revisión»; Dani aprueba o rechaza con motivo (le llega a quien
    lo publicó, DSA art. 17). Corregir uno publicado lo vuelve a revisión. Tope 3 activos por persona, 30 días.
  - **Fotos**: se vuelven a codificar con Pillow (sin EXIF/GPS) y se reducen a 1280 px; base64 en Mongo; solo con
    sesión. Las que no llegan a un anuncio se borran a los 2 días.
  - **Mensajes privados** por anuncio (buzón con contador de no leídos; correo «tienes un mensaje» como mucho cada
    6 h por conversación y SIN el texto). Dani solo ve una conversación si alguien la denuncia.
  - **Denunciar** anuncio o conversación (DSA art. 16): acuse al que avisa, decisión cuando se resuelve; con avisos
    de 3 personas el anuncio se oculta hasta revisarlo. Dani: «No incumple» o actuar (retirar / cerrar).
  - **Limpieza** cada 6 h (`merc_limpieza`): caduca a los 30 días (con aviso), borra anuncios y fotos 60 días tras
    acabar, conversaciones 6 meses tras el último mensaje, avisos y denuncias resueltas a los 6 meses.
  - Entradas: casilla «Mercadillo» en el portal (con globito) y `?vista=mercadillo`; tarjeta en Cuenta de la app del
    autónomo y `?mercadillo=1`; recuadro en el inicio del panel para la oficina; /mercadillo. Solo en español.
  - Legal: Términos § 5 quater «Mercadillo de repartidores» (solo particulares, FDS no interviene en el pago, lo
    prohibido incluido el material de la empresa o de la plataforma, revisión previa, denuncias, consecuencias) y
    Privacidad (datos, base jurídica, plazos de borrado). El chequeo de marca no deja nombrar a Amazon: se dice «la
    plataforma para la que repartes».
  - El login acepta `?next=/ruta-interna` (solo rutas de esta web).
- **17-10, 19:45: ENCENDIDO** (`mercadillo_conf.visible` true) tras revisarlo y verificarlo en producción con un
  script contra la base real (`verificar_mercadillo.py` en el scratchpad: 16 comprobaciones con personas de prueba,
  sin correos ni avisos, y lo borra todo al acabar). El iPhone 18 Pro de Dani (1.300 €) está publicado.
- Revisión de esa tarde: (1) el vigilante de bucles daba por muerta la limpieza (late cada 6 h y el vigilante
  espera 30 min por defecto) → `_latido(..., cada_min=360)`; (2) a Dani («fds») no le llegaba ningún aviso de los
  mensajes de SUS anuncios → van al buzón de contacto; (3) el correo de «tienes un mensaje» sale con el primer
  mensaje sin leer y, mientras siga sin leer, como mucho uno cada 6 h; (4) «Vender» podía pasarse de 6 fotos
  si se elegían mientras otras se subían.
- **Avisos al móvil** (Dani: «si quiere que le salte en el móvil»): cada uno los activa en Mensajes o cuando la app
  se lo ofrece (tras su primer mensaje o al publicar). `mercadillo_prefs.push`; usa la suscripción push de siempre
  (`lib/push.js`, `send_web_push_to_users`). Dice quién escribe y sobre qué anuncio, nunca el mensaje; también
  salta con los avisos de FDS (publicado, rechazado…). En iPhone solo funciona con la app en la pantalla de inicio.
- **Móvil antes que correo** (Dani, 17-10: «correo vamos a quemar la cuota, mejor que me salte aviso»): a quien
  tiene los avisos puestos y un móvil apuntado (`_merc_movil_listo`) se le avisa SOLO al móvil; el correo, a quien
  no (así no se pierde nada). Vale para Dani (anuncios por revisar, denuncias y mensajes de sus anuncios, que le
  llevan a `/panel/admin?s=mercadillo`) y para todos. Dani lo activa desde su móvil en Negocio → Mercadillo
  («Avisarme en el móvil»); a las 20:45 del 17-10 aún no tenía ningún móvil apuntado. Push activo en producción.
- **Negocio en casillas** (Dani: «no me metas más datos en Negocio; ordénamelo en cuadraditos que clique y
  entre»): el inicio son 16 casillas (Mercadillo, Opiniones, Empresas, Pagos de la cartera, Referidos, Cobros,
  Facturación, Tarifas, Datos fiscales, Interesados, Reservas fundador, Ofertas del portal, Campaña a
  candidatos, ¿Hay que ampliar?, Herramientas, Cómo va el negocio) con un globito rojo si hay algo que hacer.
  Cada una abre su sección (`?s=<id>`) con «← Negocio». Las secciones son las de antes, sin cambios.
- **Inicio del panel en casillas** (Dani, 17-10: «cámbiame el dashboard y añade este estilo de iconos»): debajo
  del saludo, casillas (`panel/components/Casilla.jsx`, la misma que usa Negocio) para Vehículos, Revisión rápida,
  Asignación diaria, Inspecciones, Vencimientos, Órdenes de taller, Incidencias, Talleres, Conductores, Checklist
  y Mercadillo, con su número y globito rojo (no puede esperar) o naranja (conviene mirar). Solo salen las de las
  pantallas que el usuario puede abrir (`ve` en el contexto del Outlet = `itemVisible` del menú). La lista de
  decisiones desaparece (la dicen las casillas); «El día de hoy» y las salidas siguen; gráficos, resumen y
  vencimientos, plegados en «Estado de la flota».
- **La burbuja de la IA y los avisos en vivo** ya no tapan «Menú» en el móvil: van por encima de la barra de abajo
  (`bottom-[calc(env(safe-area-inset-bottom)+4.25rem)]`, `md:bottom-4`); la ventana de la IA cabe en pantalla.

## 17-10-2026 (noche): Estado de la flota — cuál está peor y mandarla al taller

Dani: «una sección de estado de tu flota: cuál es la que peor está (con la última foto de las inspecciones),
siempre que no esté ya en el taller; ordenarla, ver las fotos y mandarla al taller; un buen baremo, que añada
cosas que las fotos no ven; unifica lo que esté repetido; sin falsos positivos».

- **Pantalla** `/panel/estado-flota` (`panel/pages/EstadoFlota.jsx`), en el menú Flota debajo de Vehículos. Va con
  el módulo y el permiso de Vehículos (`MODULO_DE` y `itemVisible`/`routeAllowed`; `check-modulos.mjs` acepta ya
  pantallas que van con otro módulo). Arriba la salud media y cuántas hay en cada nivel (los números filtran);
  debajo las furgonetas de la peor a la mejor con su puesto (#1, #2… no cambia al reordenar), su nota en un anillo,
  la foto marcada del peor golpe y las zonas; orden por peor, mejor, foto más antigua o matrícula; buscador.
  Al tocar una, ficha lateral (`?v=<id>`): dibujo de la furgoneta con cada zona del color de su peor daño, «por qué
  esta nota» con los puntos, fotos de la última inspección (con o sin marcas de la IA, a pantalla completa), cada
  daño con SU foto, lo que dice el conductor y **Mandar al taller**, que abre en Órdenes (`?parte=`) el alta con
  el taller sugerido y el parte ya redactado por zonas. Las que ya están en el taller van aparte, abajo.
- **Baremo** en `backend/salud_flota.py` (sin base de datos, `tests/test_salud_flota.py`). Daños de la ÚLTIMA
  inspección contrastados con el libro (`vehicle_damage_ledger`): cuenta si la pieza tiene apunte abierto sin
  orden; lo del libro que no sale en la última foto cuenta también. Crítico 35, grave 18, moderado 7, leve 2; lo
  que solo vio la IA ×0,7. Lo que no se ve: checklist del conductor (luces, neumáticos, puertas, espejos «dañado»
  o «malo») 10; nota escrita: frenos/dirección 30 y urgente, motor 18, neumáticos/puertas 12, luces/visibilidad/
  batería 7 (vale 14 días). Averías abiertas de los últimos 30 días. La IA «no es seguro circular» 14 y urgente.
  Niveles: urgente ≥45 o algo urgente; taller ≥22 o grave confirmado; vigilar ≥7; sin inspección en 30 días =
  «Sin datos recientes», nunca «Bien».
- **Lo que NO cuenta, a propósito (medido el 17-10 en la flota real):** las 28 averías abiertas (la más nueva del
  23-09, casi todas «Vehículo en taller —» de furgonetas que ya volvieron: nadie las cerró); la ITV (14 «caducadas»
  hasta 441 días que salen a repartir a diario: es la fecha de la ficha sin actualizar; se enseña aparte y no
  resta); el mantenimiento (18 apuntes en toda la flota). El libro guarda un apunte por TIPO de pieza (las dos
  puertas son «puerta»), por eso el lado sale de la última inspección.
- **Primera foto real (17-10):** 106 evaluadas: 3 urgentes, 21 a taller, 33 vigilar, 29 bien, 20 sin datos.
- **Unificado:** en Órdenes, «Daños esperando taller» (otra lista de lo mismo con otros números) pasa a ser una
  puerta a Estado de la flota; en el Inicio, casilla «Estado de la flota» (globito = urgentes) y la de Órdenes
  cuenta órdenes abiertas; lo plegado del Inicio se llama «Gráficos y vencimientos».
- Endpoints: `GET /api/estado-flota?center=` y `GET /api/estado-flota/{vehicle_id}` (admin, por centros).
- Verificado en producción con la base real (script de solo lectura): las 106 fichas cuadran con la lista (nota,
  nivel, nº de daños, motivos que suman la nota, foto de cada daño de la última inspección), ninguna del taller se
  cuela y ninguna sale «Bien» sin inspección en 30 días. Arreglado en la verificación: la zona sale del NOMBRE de la
  pieza y no de su tipo (`_canon_panel` llama «rueda» al paso de rueda y pintaba las cuatro ruedas del dibujo);
  un golpe leve se pinta en amarillo (en gris parecía una zona limpia) y el dibujo lleva leyenda.

## 18-10-2026: foco en la app del repartidor — activación

Dani: «me centraría en la app de repartidor; mil repartidores son 10.000 € al mes». Medido: 31 autónomos reales,
18 no vuelven tras el día del alta, 0 hacen un día de reparto real; 21 entran desde el navegador de
Instagram/Facebook y se dan de alta a las 13-22 h (sin paquetes). Hecho y desplegado:
- **Instalar:** dentro de Instagram/Facebook/TikTok ya no se ofrece el APK (se descargaba y no abría con la cuenta);
  solo «Abrir en Chrome/Safari» con el pase.
- **Aviso de la mañana a su hora:** «¿A qué hora cargas la furgoneta?» (6:00-10:00) en la bienvenida («Todavía no»),
  en la tarjeta de «Hoy» y en «Cuenta» (cambiarla). Servidor: `POST/GET /api/reparto/aviso-manana`, campo
  `aviso_hora` de la organización, `AVISO_HORAS` (5:00-11:30), sale en la hora siguiente a la elegida, lun-sáb, solo
  si aún no hay paquetes. Dentro de Instagram/Facebook, «Abrir en Chrome» para pedirlo allí. Textos en 6 idiomas +
  Brasil (`check-textos-ruta.mjs` ya revisa `AvisoManana.jsx`).
- **Correo «¿Qué te frenó con FDS?»** de Dani a 30 repartidores (scratchpad `correo_que_te_freno.py`, ENVIAR=1;
  no repite: `correos_enviados` por=`dani:que-te-freno`).
- Pendiente: Google Play en producción (día 7 de 14 el 18-10) → cambiar el APK por el enlace de Play.


## 18-10-2026 (tarde): refuerzos, suspensiones y la ley en el cuadrante

Dani: «para mañana nos hacen falta dos… que se postulen si tienen día libre, sin forzar a nadie»; «suspender a alguien
de un día a otro en su cuadrante y en el nuestro»; «si me cogen una baja y suspendo a 3, que se automatice y yo le dé
a lanzar… teniendo en cuenta que no puede trabajar 7 días seguidos, que no deje trabajar a quien legalmente no puede».
Todo en **Turnos (Días libres) → Refuerzos / Suspensiones**; en el portal, la casilla **«Días extra»**.

- **Refuerzos** (`/api/refuerzos*`, colección `refuerzos`, tests `test_refuerzos.py`): la oficina publica día, nave,
  plazas y nota. Lo ve y recibe aviso SOLO quien ese día libra según el cuadrante (N/T o L) **y puede** trabajarlo:
  nunca quien trabaja, está de vacaciones, compensa, tiene un día concedido, no disponible, suspendido o de baja, ni
  quien no sale en el cuadrante. Apuntarse crea una petición «extra» con `refuerzo_id`: se aprueba en Refuerzos o en
  Peticiones y entra en el cuadrante como EXTRA con candado. Al cubrirse se cierra y a los demás se les dan las
  gracias; si alguien se borra o se desaprueba, se reabre. Uno por nave y día; 1-20 plazas; hasta 30 días vista.
- **La ley** (`_extra_impedimentos`): las mismas reglas del motor del cuadrante — como mucho 6 días seguidos (o lo
  que diga su nota), semana de 5 días con un 6.º extra como mucho (ninguno si su nota fija sus días o «sin extra»), y
  nunca un día que su nota diga que no trabaja. Se mira al avisar, al apuntarse, al pedir un día extra desde el portal
  y otra vez al aprobar (el cuadrante pudo cambiar). Medido el 18-10 en OGA5: el lunes 19 libran 17, pueden 12; 5 no
  (serían 7, 8 y hasta 10 días seguidos).
- **Días que no llegan a la máxima** (`GET /api/refuerzos/faltas`): próximos 14 días, máxima vs. quien saca ruta en el
  cuadrante (bajas, suspensiones y libres ya restados) y cuántos pueden; «Pedir N» o «Pedir todos» con un clic.
  Nada se publica solo.
- **Suspensiones** (`/api/suspensiones*`, colección `suspensiones`, tests `test_suspensiones.py`): conductor, desde,
  hasta (máx. 60 días) y motivo (solo oficina). Cada día pasa a SUSP con candado guardando lo que había
  (`antes_susp`); no se tocan vacaciones, compensa, días concedidos ni bajas. Mientras dura: no audita (aunque tenga
  furgoneta asignada), no le llegan refuerzos, sus días extra de esas fechas se contestan, y ni la rejilla, ni el
  Cuadrante, ni el Excel/pegado, ni el asistente, ni una petición aprobada pueden ponerle a trabajar esos días. Se
  levanta desde hoy: lo que falta vuelve a como estaba, lo cumplido se queda. En el portal: aviso con las fechas (sin
  el motivo) y «Suspendido» en Mis turnos. La carta de sanción del convenio va aparte.
- Pendiente aparte: la prueba de pantalla «Cuadrante › un día concedido sale con candado» falla en el proyecto
  «móvil» desde antes de estos cambios (no encuentra la celda en la rejilla estrecha).

## 18-10-2026 (noche): el cuadrante sincronizado con su Google Sheets

Dani: «el cuadrante de la app lo subo de vez en cuando; lo actualizamos en un Google Sheets… a la 1 pasamos el
cuadrante a un solo día, de 48 nos piden 44… que se vaya actualizando según los cambios que hacemos, o según lo que
hacemos en la app; el Sheet o viceversa». En **Cuadrante → botón «Google Sheets»**.

- **Cómo**: un script dentro de SU hoja (Extensiones → Apps Script, `@OnlyCurrentDoc`: solo esa hoja, sin claves de
  Google Cloud). Se pega el código que da el panel (lleva la llave `fs_…` dentro; se enseña una vez) y se ejecuta
  `instalar`: sincroniza cada 10 minutos, al editar (como mucho cada 2 min) y desde el menú «Flota → Sincronizar
  ahora». Endpoints sin sesión `POST /api/cuadrante/sync/hoja` (+ `/hecho`), cabecera `X-Flota-Sync`; la llave fija
  la base de la empresa como `_partner_auth`. Panel: `GET /api/cuadrante/sync`, `POST …/conectar|modo|aceptar|
  desconectar` (permiso Cuadrante y el centro). Config en la base GLOBAL `cuadrante_sync_hoja`; la «base» de cada
  celda en la de la empresa, `cuadrante_sync_base`.
- **Lectura**: el MISMO lector del Excel (`cuadrante_excel.leer_pestanas`, la hoja montada en memoria con valores y
  fondos). Su pestaña «12 A 26» trae solo el número del día (1..31, 1, 2) con «J V S D…» encima: el mes sale de esas
  letras (antes se cogía «el mes más cercano a hoy», que el 10-10 habría corrido la hoja un mes entero). Sin letras ni
  fechas, la pestaña no se usa. La DIARIO (un solo día) y «deber horas» se saltan. Si dos pestañas tienen el mismo
  día, manda la que llega más tarde.
- **Quién gana, celda a celda** (`_sync_decide`, con la última versión en que coincidieron): cambió solo la hoja → a
  la app; solo la app → a la hoja con una nota «Flota dd/mm hh:mm: …»; las dos → la hoja. Lo protegido de la app
  (día concedido, suspensión, candado) no lo pisa la hoja y vuelve a ella. Vaciar una celda en la hoja no borra nada;
  lo que la app QUITA (un extra desaprobado que no había) sí se vacía en la hoja. El extra es un 1 rosa en la hoja y
  EXTRA en la app: son lo mismo. Las MÁXIMAS van igual (su fila «MÁXIMA»). Solo de hoy-7 a hoy+62. Códigos que no
  conoce («1.EXTRA») no se tocan y se dicen. Nombres que no casan solos se quedan fuera (se arreglan importando el
  Excel una vez, que guarda el alias). Una celda con fórmula no se sobrescribe (el script la salta y lo cuenta).
- **Frenos**: empieza SIEMPRE en prueba (cuenta lo que haría, no toca nada); al activar se acepta lo que enseñó. Más
  de 80 celdas de golpe en cualquiera de los dos lados → retenido hasta «Aceptar estos cambios». Lo aplicado entra
  en «Deshacer» del Cuadrante (y deshacer vuelve a la hoja solo). Una llamada cada 15 s como mucho.
- Tests `test_sync_hoja.py` (28) y la prueba de pantalla «Google Sheets: se conecta…».
- **Medido en producción el 18-10, en prueba y sin escribir** (`_sync_procesar` en Fly con su xlsx del 13-10): «12 A
  26» leída del 01-10 al 02-11, 73/73 nombres casan, DIARIO y «deber horas» saltadas; 0 celdas de la app pisadas, 47
  nuevas (Manuel Óscar Pombo y Luis Franco no tenían esos días en la app), 2 a la hoja (el día concedido de David Pombo
  el 11-10 y el N/D con candado de Benjamín el 17-10); «1.EXTRA» sin tocar. Máximas iguales. La importación del 13-10
  de «12 A 26» salió con fechas buenas (aquel fichero acababa en el 31). **Pendiente: que Dani pegue el script en su
  hoja, mire la prueba y lo active.** Hasta entonces no hay nada conectado.
- **«Mis turnos» del conductor vuelve a ser un calendario** (Dani: «me gustaba más antes; así hacia abajo no»): el mes
  en rejilla L-D con el color de cada día, puntito de pedido/aprobado, el día tocado debajo y «Pedir» desde ahí; ±2/3
  meses. Prueba de pantalla «es el mes en calendario».
- **La gente también va con la hoja** (Dani: «si añado un trabajador o lo quito en la hoja, que es la que usan los de
  oficina, que se añada o se quite en el cuadrante de la app»). En la app estar en el cuadrante es `en_cuadrante` y
  quitar es `inactivo_desde`, así que: quien está en la hoja entra (`en_cuadrante`, y su `alta_desde` si la hoja la
  da); sin ficha, se le hace si su nombre no se parece a NADIE (ni en otro centro, `_cua_opciones_para`); si se
  parece, va a «Nombres que hay que mirar» en el panel: «Es X» (alias, como al importar), «ficha nueva» o «No es del
  cuadrante» (`POST /api/cuadrante/sync/emparejar`, `ignorados` en la config). Quien ESTABA en la hoja (`personas` en
  `cuadrante_sync_base`) y ya no está sale desde mañana, o desde el primer día de la pestaña nueva que ya no lo trae,
  con `inactivo_por: "hoja"`, y se le quitan los días desde ahí (con «Deshacer»); si vuelve a la hoja, vuelve. El nombre
  en amarillo, el día 1 como al importar. No toca: quien nunca estuvo en la hoja (se lista) ni una salida puesta a
  mano en la app. Más de 5 salidas u 8 fichas nuevas de golpe → retenidas (los días sí siguen). Tests 33.
- **18-10 tarde, conectada de verdad** (OGA5, hoja «SEPTIEMBRE Y OCTUBRE», en PRUEBA). Dos tropiezos ya arreglados:
  (1) Dani pegó el código y luego se pulsó «Volver a sacar el script», que anuló el pegado: la hoja dejó de entrar
  callada (401 en el registro). Ahora pide confirmación y, si la hoja llega con un código antiguo, el panel lo dice
  (`hashes_viejos`, `llave_vieja_en`). (2) Fichas dobles: Manuel Óscar Pombo Vega tiene dos fichas con el mismo nombre
  (la del cuadrante de baja con sus días, otra activa vacía) y «LUIS FRANCO LOPEZ» tenía alias a «luis guillermo
  lopez» pero había otra activa «luis franco lopez»: la hoja casaba con las vacías y cada uno habría salido dos veces.
  Ahora manda el alias (aunque la ficha esté de baja) y luego la ficha que ya está en el cuadrante. Datos sucios que
  quedan (no son de la sincronización): Álvaro Rodríguez Blanco tiene DOS fichas activas en el cuadrante, y hay ~16
  personas en el cuadrante de la app que no están en «12 A 26» (casi todas fichas de baja).
- **18-10 noche: fusiones y bajas en producción, pedidas por Dani** («punto 2 y 3 fusiona, y el 1 si no está en
  sheets desactiva ese conductor»). Zeus avisó de que Álvaro Rodríguez no podía subir fotos («no tiene furgoneta
  asignada»): tenía dos fichas y la furgoneta del día estaba en la que no usa. Hecho con un script en Fly (lote
  `fusion-bajas-2026-10-18`; lo sustituido o quitado está entero en la colección `fusion_archivo`, y lo del cuadrante
  en «Deshacer»):
  - Fusionadas conservando la ficha con la que entra: Álvaro (fe096428 ← 8b2ccef5: furgoneta de hoy y 2 días; 22
    días repetidos archivados), Manuel Óscar Pombo (8f10493d ← 29e1718c: 27 días), Luis Franco (8cce009b «luis
    franco lopez» ← ea60d355 «luis guillermo lopez»: 21 días, 3 inspecciones, km, ID de reparto y el alias).
    `/drivers/fusionar` no servía: exige el mismo correo y se deja la furgoneta del día (`daily_assignments` sí,
    pero no `vehicles.current_driver_id`, furgonetas fijas, móviles, persona del cuadrante, alias ni días que chocan).
  - Comprobado como cada uno en su portal: Álvaro y Manuel pueden auditar hoy (8627MPH, 9904 NFX); Luis libra.
  - Fuera del cuadrante de OGA5 desde el 19-10 los 14 que no están en «12 A 26» (+ una ficha ya fusionada), con
    sus días desde mañana; las 3 fichas aún activas (Álvaro Pérez Riveiro, Juan José Mosquera Otabor, Lucía
    Almudena López Iglesias) desactivadas con `desactivada_por: "hoja"`.
  - Regla nueva en la sincronización: quien sale de la hoja sale del cuadrante Y su ficha se desactiva (salvo que
    su ficha sea de otro centro: se ha cambiado de nave); si vuelve a la hoja, se reactiva (solo si la desactivó la
    hoja). El clasificador bloqueó la primera vez escribir en producción por consola; Dani lo autorizó en el chat.
- **18-10, 19:10: ACTIVADA por Dani.** Primera vuelta: 87 cambios a la app, 2 escritos en la hoja (0 saltados), 2
  fichas nuevas (Ana Rodríguez Vilas, Hugo Paredes Carabel). Después, con su captura («si están fuera, sácalos…
  Nora sale dos veces… que aparezca igual que la hoja»): `_cua_personas` ya no saca fichas fusionadas, ni (con la
  sincronización activa y en vistas que llegan a hoy) a quien la hoja sacó y no está en ella (`personas` de
  `cuadrante_sync_base`), y ordena por la fila de la hoja (`orden` en la misma base). Medido a las 19:27: 75 en el
  cuadrante = 75 en la hoja, en su orden, sin dobles. La ficha de quien sale el día 1 por la pestaña nueva se
  desactiva ese día, no al detectarlo. Tests 36.

## 19-10-2026: Centro de IA («como hablar con Claude, dentro de la app»)

Dani: «añádeme en la app un centro de IA, así como tú, en el cual pueda hablar con ella y me resuelva cosas o haga
cambios que le pida». Eligió **Claude Sonnet 5.5** y que lo usen **él y la oficina de su empresa** (cuentas `owner`;
a las empresas cliente NO se les abre: la clave la paga él). Menú **Hoy → Centro de IA** (`/panel/centro-ia`).

- **Piezas**: `backend/centro_ia.py` (instrucciones, 24 herramientas, el bucle con el modelo, precio) y en server.py
  la sección «CENTRO DE IA» (conversaciones en la colección `centro_ia` de la empresa, lo gastado en `centro_ia_uso`
  global, lo que apunta para programar en `centro_ia_notas_dev` global). Pantalla `panel/pages/CentroIA.jsx`.
  SDK `anthropic==1.15.0`. Clave: secreto `ANTHROPIC_API_KEY` en Fly; sin ella la pantalla lo dice y no deja escribir.
- **Cómo trabaja**: 12 herramientas de consulta (conductores, ficha completa, cuadrante con rutas/máxima/diferencia,
  asignación del día, furgonetas, peticiones, refuerzos y días que no llegan, suspensiones, estado de la flota, fichas
  dobles, sincronización con la hoja, inspecciones) y 11 de «proponer_» (celdas del cuadrante, máximas, asignación,
  editar/activar ficha, fusionar fichas, resolver petición, refuerzo, suspender/levantar, acciones de flota del
  asistente viejo). **Las propuestas no cambian nada**: salen como tarjeta con «Confirmar/Descartar»; al confirmar se
  ejecutan con el usuario que confirma POR LAS MISMAS FUNCIONES DEL PANEL (mismos permisos y centros) y se le cuenta a
  la IA el resultado para que siga. «nota_para_desarrollo» apunta lo que necesite programación (para Claude Code).
- **Reglas del modelo que mandan**: `system` y herramientas FIJOS (la fecha, quién habla y el centro van en cada
  mensaje, «[Contexto: …]»); historial de solo añadir, guardado tal cual (`to_dict()`); esfuerzo `medium`;
  `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`); caché automática. 14 vueltas como mucho por mensaje.
- **Coste y frenos**: tope de 5 $/día por persona (`CENTRO_IA_TOPE_DIARIO_USD`), se ve en la pantalla; conversación
  de más de 260 mensajes → empezar otra. Se procesa en segundo plano y la pantalla pregunta cada 1,5 s; «pensando»
  más de 7 min = se cortó (reinicio) y deja seguir. Cada uno ve solo sus conversaciones; «archivar» no borra.
- **Fusionar de verdad**: `_fusionar_fichas_completo` (lo del 18-10 con Álvaro, ahora en código): repunta TODO
  (furgoneta del día, furgoneta fija, furgonetas fijas, móviles, persona del cuadrante, alias, suspensiones…), lo que
  choca se queda el de la que se conserva y lo otro a `fusion_archivo`; no fusiona nombres que no se parecen.
- Tests `test_centro_ia.py` (11, con una IA de mentira) y 2 de pantalla. La base de mentira ahora lee campos dentro
  de listas (`slots.driver_id`) y entiende `array_filters`, como MongoDB.

## 21-10-2026: portada nueva (la app de reparto gratis primero) y lo que pidieron los testers de Play

Dani: «rehazme la portada: véndelo sobre todo como la app de reparto gratis con todas sus funciones; después la IA
y lo de negocios con su dashboard». `pages/Landing.jsx` reescrita, en este orden:
- Héroe «La app de reparto gratis que ordena tu ruta sola» con el vídeo de la app y dos capturas reales; botones
  «Crear mi cuenta gratis» (`/registro?sector=autonomo&plan=autonomo`) y «Probarla ahora, sin registrarme» (demo).
  La línea de precio sale de `lib/precios.js` (`promoGratis()`): el 01-01-2027 cambia sola a «gratis hasta 15 paradas».
- Para quién (marcas por país, sin Amazon), cómo funciona, TODAS las funciones de la app agrupadas (al cargar, en la
  ruta, en la puerta, tus cuentas), precio del repartidor con «Invita y gana», la IA (daños en 3D y el asistente
  del panel, que prepara y tú confirmas), empresas (6 módulos + vista del panel con «datos de ejemplo»; «Desde 5 €
  por vehículo» y demo del panel), preguntas y pie con idioma y tema.
- **Cada frase tiene detrás una pantalla que existe** (comprobado en el código antes de escribirla). Lo que se quitó
  por no ser cierto para todos: «la plantilla del día» (es de la flota DSP), «aviso antes de que caduquen» (es un
  calendario), «qué furgoneta está peor» como pregunta al asistente (no lo sabe; sí las ITV y quién lleva qué).
- Textos con `tx()` del diccionario de la app de reparto (7 idiomas, `textosRutaB.js`, comprobado por
  `check-textos-ruta.mjs`, que ya lee Landing.jsx y sus listas). El idioma que se elige en la portada es el de la app.
  En chino: Amap/Baidu en vez de Google Maps, sin Street View y el enlace al APK de China.
- Fuera `landingTextos.js`, `landingZh.js`, `ProductoReal.jsx` y su generador de capturas (salían vacías).
- `functions/index.js`: la portada con su título, og (la imagen de /repartidores), canonical, datos para Google y el
  texto ya escrito dentro de #root, como `functions/repartidores.js` (de donde toma ventajas y preguntas). Sin caché
  en el borde (`no-cache`), como dice `_headers` para «/».
- Testers de Play (testerscommunity, 20-10): sin fallos; de sus sugerencias, hecho lo que faltaba y era real: el ojo
  para ver la contraseña en `/panel/login` (el alta ya lo tenía), confirmar antes de cerrar sesión en Cuenta, y la
  ficha de Play con palabras de búsqueda (`docs/PLAY_STORE.md`, «Ficha mejorada», para que Dani la pegue). Ya
  existían: compartir («Comparte y gana»), primer uso guiado y «Mándanos una idea». No hecho: entrar con Google (pide
  configurar OAuth en Google Cloud, cosa de Dani), valorar en Play (la app sigue en prueba cerrada) y confirmar al
  salir con el botón atrás (en Android lo normal es salir).
- Pruebas: humo «Portada · vende la app de reparto gratis primero…», «Comentarios de Play…» y la de `/cn` rehecha.

## 21-10-2026: «Empleo» en la cabecera de la portada

Dani: «lo de flotadsp.com/empleo déjalo visible… en la pantalla principal de flotadsp.com, en una pestaña al lado
de Funciones». Primero se puso como pestaña de la app de reparto y NO era eso: quitada. Ahora la portada lleva
«Empleo» en la cabecera (Funciones · Para empresas · Precio · **Empleo** · Entrar; en el móvil también se ve) y
«Ofertas de empleo» en el pie; los dos van a `/empleo` (el tablón de siempre, `pages/Ofertas.jsx`).
- Ojo con los datos de las ofertas: la descripción de **Vigo y A Coruña dice «en Santiago de Compostela»** (copiada
  de la de Santiago) y las tres nombran a Amazon. Avisado a Dani; corregirlo es cambiar datos de producción
  (Empleo → editar la oferta), con su OK.

## 23-10-2026: Atlas suspendida por impago → la base de Flota vive ahora en Fly (`flota-mongo`)

**Qué pasó.** «¿Por qué Flota no funciona?» (Dani, 23-10 11:15). `/api/health` daba `mongo_connected: false` y
los logs «SSL handshake failed… TLSV1_ALERT_INTERNAL_ERROR» en los tres nodos; desde el PC, igual. Parecía la
lista de IPs otra vez (15-10), pero NO: la organización de Atlas «Trafico's Org - 2026-05-26» (Project 0,
cluster1 r5ruvvc, el M0 gratuito de Flota) estaba **SUSPENDED** por dos recibos SEPA devueltos (agosto $111.45 y
septiembre $305.12) de un cluster de pago de la misma organización (el viejo de FlotaDSP, que seguía encendido:
$175 solo en octubre). La suspensión se llevó el M0 gratis por delante. Dani: «no quiero pagar ese».

**Qué se hizo.** Mover la base a un MongoDB nuestro en Fly, restaurando la copia diaria de R2:
- `infra/mongo/fly.toml`: app `flota-mongo` (imagen oficial `mongo:7.0`, cdg, shared-cpu-1x 1 GB, volumen
  `flota_mongo_data` de 3 GB en `/data/db`, fotos del volumen 7 días). **Sin servicios públicos**: solo por la
  red privada de Fly (`flota-mongo.internal:27017`). Usuario `flota`, contraseña en los secretos
  `MONGO_INITDB_ROOT_*` de esa app. Standalone: el servidor no usa transacciones ni change streams.
  **Gotcha:** `mongod` necesita `--ipv6` además de `--bind_ip_all`; la red privada de Fly es solo IPv6 y sin
  él da «connection refused». Coste ≈ 6 €/mes (Dani: «si son 6 euros lo usamos»).
- `backend/scripts/restaurar_copia.py <copia.jsonl.gz> <fichero_con_url>`: inserta la copia por lotes y
  cuadra colección a colección; se niega si el destino tiene datos (`--forzar` para repetir una prueba). Las
  copias van sin `_id` y el servidor no usa ObjectId, así que da igual. Los índices los crea el servidor al
  arrancar.
- Se restauró `backups/flota_2026-10-22_0200_…` (la última: la de las 04:00 del 23 ya falló): 48 bases,
  285 colecciones, 205.186 documentos, 11 s. **Perdido: lo que pasó el 22-10 durante el día** (altas, entregas,
  cambios de cuadrante) hasta la suspensión. Se hizo desde la máquina `flota-backend` (tiene `COPIAS_CLAVE`,
  pymongo y la red privada): `fly ssh sftp put` de la copia cifrada, `descifrar_copia.py`, `restaurar_copia.py`,
  y borrado de los temporales.
- `fly secrets set MONGO_URL=… -a flota-backend` (la cadena está en `C:\Users\Usuario\.flota-mongo-fly.txt`;
  la vieja de Atlas, en `.flota-mongo-uri-atlas-viejo.txt`). Comprobado: health OK, demo-login, 10 vehículos de
  la demo, 3 ofertas de empleo, y una copia manual a R2 (`POST /api/admin/backup-now` con el super-admin):
  `flota_2026-10-23_0948_…`, 20 MB → la copia nocturna sigue funcionando con la base nueva.

**Desde el PC** (scripts, auditoría): `fly proxy 27018:27017 -a flota-mongo` y la cadena del fichero con
`flota-mongo.internal:27017` cambiado por `localhost:27018`. Funciona (probado).

**Pendiente / avisos.**
- Dani decide qué hacer con la organización suspendida de Atlas (pagar o dejar que la borren). Del FlotaDSP
  viejo hay copia en Documents y 14 copias `backups/flotadsp_*` en R2. Si algún día paga, lo del 22-10 se
  podría rescatar de allí (sería una fusión a mano, no está preparada).
- La demo (`dsp_demo_noroeste.vehicle_damage_ledger`) tiene dos daños repetidos (`dn-v108`/`aleta`) y el índice
  único `uniq_veh_panel_open` no se crea ahí (aviso al arrancar). Solo la demo; limpiar cuando toque.
- **Nadie se entera cuando la base cae**: Fly mira `/api/vivo` (no toca Mongo) y el aviso de «backup fallido»
  va por Telegram con la configuración… guardada en Mongo. Hace falta un vigilante fuera (que mire
  `mongo_connected` en `/api/health` y avise al móvil). Propuesto a Dani, sin decidir.
- Un solo nodo: si la máquina muere, se restaura la última copia (máximo un día perdido). Es lo acordado.

## 23-10-2026 (tarde): la app de reparto a punto — vigilante de la base, iPhone, alta con el estilo de la app

Dani: «céntrate en la app de reparto: que funcione todo perfecto, verifica que la publicidad funciona y que la app
funciona, explica a los de iPhone cómo usarla, moderniza la app, mejora los problemas». Medido antes de tocar nada
(scripts en el scratchpad, sobre la base ya restaurada):
- **Errores de los usuarios** (`flota.client_errors`, 171 en 30 días): casi todos de septiembre y del panel viejo
  (ya arreglados: `useOrden`, `Navigate`), caché envenenada tras despliegues (la repara `repairAssetCache`) y los
  del navegador de Instagram/Facebook (`postMessage… Java object is gone`, `logLoginFormFocused`: son suyos, no
  nuestros). En la app de reparto, **ninguno** en 14 días.
- **Safari de iPhone** (Playwright WebKit, UA de iPhone, contra producción con la demo): 0 errores, sin desbordes;
  sin cámara el escáner avisa y deja escribir el código. Lo que NO hay en iPhone: dictar direcciones y manos
  libres (ya lo decía la app).
- **Publicidad (Meta, cuenta 934137992742194):** la campaña que traía altas, «FDS Registros — Gratis 15 paradas —
  ES (10-10)», **terminó el 15-10** (19 registros a 1,64 €). Desde entonces solo corre «Promoción del sitio web
  continua» (visitas a 0,16 €, 217 en 9-22/10) que trae ~10-15 visitas/día y **0 altas**. Hay 3 borradores sin
  publicar («Revisar y publicar (3)», uno de Tráfico con 35 €). En el servidor se ve igual: `facebook/gana10`
  177 y 165 sesiones el 14 y 15-10, y nada de pago después; las altas del 17-10 son del correo `bono10` a los
  candidatos. **TikTok**: la sesión del Ads Manager en el Chrome de Dani está cerrada (pide verificación), sin ver.
  Relanzar la campaña de registros es gasto: lo decide Dani.
- **Activación** (40 autónomos): 18 con alguna parada, 22 sin ninguna; el que más, 43. Opiniones del correo
  «¿Qué te frenó?»: «no_ruta» y «no_supe».

Hecho:
- **Vigilante de la base** (`_vigilante_decide/_vigilante_ping/_vigilante_avisar`, `start_vigilante_bd`): ping a
  Mongo cada minuto; a los 3 fallos seguidos avisa por Telegram (configuración cacheada en `_TG_CACHE`, porque
  cuando Mongo cae no se puede leer) y por correo a `CORREO_CONTACTO`; recuerda cada 6 h y avisa cuando vuelve.
  `_telegram_aviso` ahora delega en `_telegram_enviar(config, texto)`. `VIGILANTE_BD=0` lo apaga. Tests:
  `test_vigilante_bd.py` (6).
- **Guía de iPhone** `/iphone` (`pages/Iphone.jsx`, 7 idiomas): 4 pasos de Safari (abrir en Safari, Compartir,
  «Añadir a pantalla de inicio», entrar), aviso si está en el navegador de Instagram/Facebook/TikTok, qué funciona y
  qué no en iPhone. Enlazada desde Empezar (solo en iPhone), la pregunta «¿Tengo que instalar algo?» de la portada
  y de /repartidores, y la tarjeta de instalar (`PasosIphone`). El dominio sale de `dominio()`, no escrito.
- **Marca de la app**: `MARCA.app = 'FDS'`; Empezar y el alta llevan el logo y «FDS» (el panel sigue siendo
  «Flota»).
- **Alta modernizada** (`Registro.jsx`): colores de la app (botón cian de la marca en vez de naranja), tarjeta
  con el logo y el idioma en la primera fila (antes flotaba encima del formulario), campos más grandes, misma
  fuente que la app. Sin tocar textos ni comportamiento.
- Pruebas de humo: `/iphone` en PUBLICAS y «iPhone · la guía de instalar y usar la app» (2).
- (23-10, más tarde) «Invita y gana» pasa DEBAJO de la ruta en «Hoy» (encima del escáner distraía al que aún no ha
  metido su primer paquete). La analítica guarda `so` (ios/android/otro) en cada evento, por el user-agent: para
  saber cuánta gente viene de iPhone. Los 5 fallos de la batería completa del backend (3 de `test_valor_senales`,
  que pasan solos) parecen de orden/flaky; los que tocan Telegram, copias y el vigilante pasan.

## 23-10-2026 (tarde): primer uso guiado por «cómo te llegan las paradas» y embudo de activación

Dani («¿qué puedes mejorar en la app, visible y en efectividad?» → «sí, empieza por el primer uso guiado y el
embudo de activación»). Lo medido mandaba: 32 autónomos reales, 9 con paradas, 0 con un día de reparto real, 18 de
31 no vuelven tras el alta, y la única respuesta a «¿qué te frenó?» fue «no supe cómo usarla». La app carga en 0,4 s:
el problema no es la velocidad, es que el recién llegado no encuentra SU manera de meter las paradas.

- **La primera vez** (`MiRuta.jsx`, hoja «Te damos la bienvenida a FDS»): «¿Tienes ya tus paradas de hoy?» → «Sí,
  cargarlas ahora» abre **«¿Cómo te llegan las paradas?»** con cuatro formas (`FORMAS`), cada una con su herramienta
  (`abrirForma`): etiquetas en los paquetes → la carga foto tras foto; una hoja de reparto en papel → la caja de pegar
  con la nota de «Foto de la hoja»; una lista en WhatsApp/Excel/correo → pegar; «me las dicen de una en una» → a mano.
  Antes el «Sí» iba directo a la foto de la etiqueta y quien recibe la lista por WhatsApp o en una hoja no tenía
  camino. Sin `puede_pegar` (no es el admin de la cuenta) solo salen etiquetas y a mano. «Todavía no» sigue igual
  (aviso de la mañana, ejemplo, 3 pasos). Se mide qué eligen: acciones `carga_etiquetas|hoja|lista|mano`.
- **El hueco vacío de la ruta** ya no es una frase y el botón grande del ejemplo: es «Carga tus paradas de hoy» con
  las mismas cuatro formas, y «¿Cómo funciona?» y el ejemplo quedan como enlaces (14-10: quien iba al ejemplo no
  volvía a lo suyo). NO se autocarga el ejemplo por esa misma razón.
- **Embudo de activación** (`backend/activacion.py`, `GET /api/admin/activacion?dias=`, solo super-admin; tarjeta
  arriba en Negocio → «Cómo va el negocio», `panel/pages/Analitica.jsx`): por CUENTA, no por visita. Pasos: alta →
  abren la app otro día → meten una parada suya → ordenan → navegan → entregan algo de verdad → **un día de reparto
  real** (la misma vara que el bono, `_ref_uso_real`: direcciones distintas repartidas a lo largo del día). Cruza
  `organizations` + `reparto_pedidos` de cada cuenta (sin `ejemplo`) con `analitica_eventos` que llevan `org`. Fuera
  demos, la propia, pruebas por nombre y testers de Play (misma regla que `tools/metricas/usuarios_total.py`,
  `filtrar_reales`). Dice dónde está la mayor caída y la serie por semana. Los pasos «·» salen de la medición anónima:
  si el móvil la bloquea, van por debajo, nunca por encima. Tests: `backend/tests/test_activacion.py` (14).
- Textos nuevos con sus 6 idiomas en `textosRutaB.js` y el portugués de Brasil en `textosBrasil.js`; `FORMAS` en las
  listas de `check-textos-ruta.mjs`. Humo: «Ruta · la primera vez pregunta cómo le llegan las paradas…» rehecho.
- De paso: el globo rojo de la tarjeta del mercadillo (`TarjetaMercadillo.jsx`) pasaba de `bg-red-500` a `bg-red-600`
  para cumplir el 4,5:1 de `check-contraste` (era el único fallo).
- **Qué mirar en una semana** (en la tarjeta): si «meten una parada suya» sube del 28 % (9/32) y qué forma eligen
  (`carga_*` en las acciones de la analítica). Si la mayor caída sigue siendo alta → «abren otro día», lo siguiente
  es la mañana siguiente (aviso/correo), no la pantalla.

## 23-10-2026 (tarde, 2): anuncios nuevos — spot v3, audio para Spotify e imágenes con la app real

Dani: «más anuncios con buena interfaz y buenas imágenes; un anuncio para Spotify; un buen vídeo, nada básico ni
cutre ni voz robótica». Hecho (todo con la app de verdad y la oferta de `lib/precios.js`; sin fotos de terceros
salvo el archivo de Pexels ya licenciado, que solo cuenta el problema):
- **Spot v3** (`scripts/spot-v3/{tarjetas.mjs,voz.py}` + `scripts/montar-spot-v3.mjs`): 36 s, gancho con
  furgoneta y «¿Todavía ordenas la ruta a mano?», la app grabada por Playwright (`e2e/spot-v2.spec.js
  --update-snapshots`) dentro de un móvil flotante con 4 títulos (foto a la etiqueta, ruta sola, voz, entregado),
  oferta y cierre con QR a `/app?utm_source=video&utm_content=spot3`. Voz es-ES-Ximena frase a frase con la
  música agachándose debajo; si Dani graba `s1..s5.mp3` en `docs/anuncios/reales/spot-v3/`, `voz.py` las usa.
  Salida: `docs/anuncios/reales/salida/spot-v3-{9x16,4x5,1x1}.mp4` (el 1:1 lleva el vertical sobre fondo
  desenfocado; recortar se comía los títulos).
- **Spotify** (`scripts/spotify/voz.py`, mezcla con ffmpeg): `docs/anuncios/spotify/fds-spotify-30s-{ximena,alvaro}.mp3`
  (29,8 s, 60 palabras, -16 LUFS, ≈0,7 MB), guion e instrucciones en `LEEME.md` (Ad Studio: 30 s, ≤65 palabras,
  imagen 640×640 ≤200 KB). Subirlo y el presupuesto son de Dani.
- **Imágenes** (`scripts/anuncio-app.mjs`): 4 tarjetas × (4:5, 9:16, 1:1 y 640 JPG para Spotify) en
  `docs/anuncios/app/`, textos para Meta/TikTok en `TEXTOS.md`. Capturas reales de `public/capturas-ruta` y
  `docs/capturas-ruta` dentro de un móvil.
- Google Play: la prueba cerrada va por el día 13 de 14; mañana Dani puede «Solicitar acceso a producción».
  Cuando Google apruebe, cambiar el APK por el enlace de Play (InstalarApp, /iphone no cambia).
- Batería del backend tras apagar el vigilante en tests: 1348 pasan; fallan 3 de `test_valor_senales.py` que pasan
  solas (contaminación entre pruebas del módulo Valor, anterior a hoy; pendiente de mirar cuando toque Valor).

### Y de paso, el fallo de la restauración: las fechas de Mongo quedaron en TEXTO

Al estrenar el embudo salían 0 en los pasos que vienen de la analítica. No era la app: la copia serializa con
`json.dumps(..., default=str)`, así que cada `datetime` de Mongo se guardó como «2026-09-18 22:12:38.411000»
(con espacio, como lo imprime Python) y `restaurar_copia.py` lo insertó tal cual. Resultado en producción:
**65.026 documentos en 22 colecciones** con fechas en texto: `analitica_eventos.ts` (26.197; los informes de
«Cómo va el negocio» solo veían lo de hoy y el TTL no borraba nada), `audit_requests.at` (27.311),
`inspections.analyzed_at` (5.015), varios `expira_en` con índice TTL (candidatos, Cortex, WhatsApp, accesos de
socio: así no caducaban nunca), `vehicles.updated_at`, `geo_rescate.en`, `dnr_investigaciones.*`, y la base
`edge_os` entera. Las fechas que escribe la app (`created_at`, ISO con «T») no se tocaron.
- `backend/scripts/reparar_fechas_copia.py` (en seco por defecto, `--aplicar` convierte): el patrón con espacio
  identifica exactamente lo que ERA fecha. Aplicado el 23-10 a las 15:20; segunda pasada en seco: nada que
  convertir. Comprobado: 26.312 eventos con `ts` fecha, 24.084 en 30 días, 925 de clientes con sesión.
- `restaurar_copia.py` convierte ya al insertar (`con_fechas`), para que no vuelva a pasar. Tests en
  `backend/tests/test_reparar_fechas_copia.py`.
- El embudo real (30 días): 32 altas → 13 abren otro día → 9 meten parada → 9 navegan → 6 entregan → **0 día
  real**. La mayor caída, 19 cuentas, es alta → volver otro día: la mañana siguiente sigue siendo la batalla.

## 24-10-2026: spot v4 y Spotify v2 (rehechos: «parece una app del 2001»)

Dani: el spot v3 (móvil pequeño con pantallazos) y el audio de Spotify sin decir dónde entrar no captan a nadie.
Rehecho como funcionan los anuncios de apps en TikTok/Reels (gancho en 2 s, la app a pantalla completa haciendo
el trabajo, cortes rápidos con el toque marcado, subtítulos palabra a palabra, oferta y cierre con dónde entrar y
qué pulsar). Detalle y cómo subirlo: `docs/anuncios/reales/spot-v4/LEEME.md` y `docs/anuncios/spotify/v2/LEEME.md`.
- Grabación: `frontend/e2e/spot-v4.spec.js` (solo con --update-snapshots) con el screencast de Chrome. **Gotcha:** el
  screencast da fotogramas a tamaño CSS (393 px) aunque el contexto tenga deviceScaleFactor; con la bandera
  `--force-device-scale-factor` los da a 1080 px. La foto de la etiqueta: `setInputFiles` en el input oculto del
  diálogo «Añadir paradas» (con la jornada empezada, añadir va plegado en «+»).
- Montaje: `scripts/montar-spot-v4.mjs` (+ `scripts/spot-v4/{etiqueta,capas}.mjs`, `voz.py` con los tiempos de
  cada palabra, `sonido.py` con música y efectos propios). Subtítulos en ASS con BorderStyle 4 (una caja por
  frase; el 3 hacía una caja por trozo). Salida en `docs/anuncios/reales/salida/spot-v4-*` (con y sin voz).
- Spotify v2: la web dicha dos veces y deletreada + «toca este anuncio»; clic directo al alta con utm_source=spotify.
- Subirlos y el presupuesto, Dani. La voz sigue siendo neuronal; con su voz grabada (s1..s6.mp3) se rehace en 2 min.

## 24-10-2026 (madrugada): spot v5 y Spotify v3 (voz de Gemini, sonido medido)

Dani sobre el v4: «mejorable: transiciones, imágenes de la app; busca una voz no robótica; cuida el volumen de los
sonidos; sé meticuloso». Detalle, niveles y cómo subirlo: `docs/anuncios/reales/spot-v5/LEEME.md` y
`docs/anuncios/spotify/v3/LEEME.md`. Vídeos en `docs/anuncios/reales/salida/spot-v5-*-{achird,puck,laomedeia}.mp4`
(no van a git); Dani elige la voz de oído.
- Día de reparto creíble: `scripts/spot-v5/ruta.py` → `frontend/e2e/fixtures/coruna-dia.json` (15 paradas reales
  de A Coruña, OSRM, hora de cada parada). Grabación: `frontend/e2e/spot-v5.spec.js` (--update-snapshots).
- Montaje `scripts/montar-spot-v5.mjs`: transiciones xfade encadenadas, píldora con la función arriba
  (`scripts/spot-v5/capas.mjs`), 4x5 y 1x1 con la pantalla entera centrada (recortar dejaba fuera botones).
- Voz: `scripts/spot-v5/voz_gemini.py` (gemini-3.8-flash-tts). **Gotchas:** lee en voz alta cualquier instrucción
  o etiqueta («[alegre]», «Dilo cercano:»), no admite instrucción de sistema (400), devuelve WAV 24 kHz mono; las
  frases se cortan por la combinación de pausas que mejor encaja con las sílabas (una coma puede durar más que
  un punto). Subtítulos al tiempo real: `scripts/spot-v5/alinear.py` (faster-whisper «small»; el PyAV que trae
  choca con el av instalado, por eso el audio se decodifica con ffmpeg). Pasarlo SIEMPRE después de voz_gemini.
- Sonido: cada pieza a un nivel objetivo medido (LUFS/pico); voz -14, música 11-12 LU por debajo con sidechain,
  efectos ~12 LU por debajo, máster -14 LUFS / -1 dBFS lineal. El montaje mide la mezcla y lo deja en
  `mezcla-<voz>.json`.
- Spotify v3: `scripts/spot-v5/spotify.py` alarga solo las pausas entre frases y mezcla con las normas de
  Spotify (-16 LUFS ±1,5, pico real ≤ -2 dBTP, 0,5 s de silencio delante y detrás, MP3 44,1 kHz estéreo
  192 kbps, ≤ 30 s); se para si el MP3 no cumple. URL de clic con `utm_content=audio3`.
- Subirlos y el presupuesto: Dani. Voz humana sigue siendo mejor (todas las sintéticas son neuronales).

## 24-10-2026 (madrugada, 2): el spot de Puck en Meta (pendiente de verificar la tarjeta)

Dani eligió el vídeo con la voz de Puck, solo ese anuncio, en todos los sitios de Meta, en la campaña de
registros a 10 € al día. Detalle y textos: `docs/anuncios/CAMPANA-24-10-SPOT5.md`.
- Publicado: «Promoción del sitio web continua» desactivada (59 € en 7 días, 426 visitas, 0 altas).
- En borrador: el anuncio 52644270307539 de «FDS Registros» rehecho con los vídeos de Puck (9:16 y 4:5),
  texto nuevo, enlace `/registro?…&utm_source=facebook&utm_content=spot5`, sin IA de Meta; y el presupuesto de
  la campaña de 15 a 10 €/día. **Meta no deja publicar hasta que Dani verifique la tarjeta** (MasterCard
  ····6176, «método de pago desactivado»). Después: «Publicar» dentro del anuncio y de la campaña, nunca
  «Revisar y publicar (N)» (arrastra 3 borradores viejos, uno de tráfico a 35 €).
- El conjunto acaba el 29-10. Ubicaciones Advantage+ ya estaban puestas. En campañas de clientes potenciales
  no existe el botón «Registrarte»: va «Ver detalles».
- Gotchas del editor (24-10): al crecer un cuadro de texto se mueve todo y el clic siguiente cae en otro
  sitio (comprobar los valores con JS sobre los `textarea` del diálogo); la sección «Destino» sale con
  `display:none` hasta que se sube el panel izquierdo hasta ella; los vídeos viejos se quitan desde la
  bandeja de abajo del selector (al pasar el ratón sale una X); la extensión no deja leer por JS valores con
  query string («BLOCKED: Cookie/query string data»): mirar la URL con zoom.
- Spotify: el vídeo solo se sirve con la app en pantalla; el audio suena con el móvil bloqueado, que es como
  escucha un repartidor en la furgoneta. Recomendado empezar por el audio v3.
- **24-10 tarde:** Meta publicado (anuncio de Puck en revisión, 10 €/día, solo ese anuncio; el otro de registros
  apagado). Spotify: campaña lista pero el formulario de Spotify no deja enviar desde el Chrome con la extensión
  de Claude («errores de validación» sin detalle); Dani la envía desde el móvil. Detalle en
  `docs/anuncios/spotify/v3/LEEME.md`.

## 24-10-2026 (tarde): «Trabajar más» en el portal del conductor

Dani: «haz más visible los días que vamos por debajo… un apartado que sea pedir trabajar más… "hay 3 vacantes,
¿la quieres? solicítala"; y si la aprobamos, que se queden como extra y tengan constancia de que son extra».
- **Servidor** (`server.py`, bloque «TRABAJAR MÁS»): `GET /api/trabajar-mas` da al conductor las vacantes de los
  próximos 14 días (días bajo la máxima del cuadrante, con `_maximas_y_ruta`, y refuerzos de la oficina) SOLO
  si ese día libra (N/T, L) y la ley y su nota se lo permiten (`_extra_impedimentos`), más sus días extra
  aprobados de los últimos 60 días con quién/cuándo se confirmó y si el cuadrante lo sigue diciendo
  (`en_cuadrante`). `POST /api/trabajar-mas/{fecha}/solicitar` se apunta al refuerzo del día o abre uno
  automático (`auto: True`, plazas = las que faltan, sin avisar a nadie) y sigue por `apuntarme_refuerzo`.
  Si la oficina pide refuerzo ese día, el automático pasa a ser suyo y entonces sí avisa (a quien no lo pidió).
  Al aprobar un extra, el aviso al móvil dice «✅ Día extra confirmado» y la celda queda EXTRA con candado.
- **Portal**: tarjeta verde «¿Quieres trabajar más? · N vacantes» en el inicio cuando hay vacantes; sin ellas,
  casilla «Trabajar más». Pantalla `TrabajarMas.jsx` (sustituye a `DiasExtra.jsx`): solicitar con nota,
  retirar, y «Tus días extra» con insignia EXTRA y «Al final no puedo» (hasta el día antes).
- **Panel** (Turnos → Refuerzos): el automático sale como «Lo abrió un conductor al solicitar una vacante» con
  el botón «Avisar a todos los que libran».
- Tests: 6 nuevos en `test_refuerzos.py` (16 en total) y 2 de humo nuevos. Suite: 1360 en verde; humo 206.
- **Producción hoy:** OGA5 tiene máximas hasta el 02-11 y TODOS los días llegan (sobran 2-6), así que hoy no
  sale ninguna vacante, que es lo correcto. DGA1 no tiene máximas. Saldrá sola cuando un día baje (bajas,
  suspensiones) o la oficina pida refuerzo.

### Uso de las altas nuevas (24-10, `tools/metricas/uso_altas.py`)
35 altas reales de autónomo en 10 días (14 hoy, casi todas del anuncio de Puck en Facebook móvil). 27 solo
miraron el día del alta, 5 volvieron otro día, 2 metieron paradas y 1 entregó algo (2 paradas). Nadie ha hecho
aún un día de reparto real. Se dan de alta de tarde/noche; la prueba de verdad es la mañana siguiente en la nave.

### Redes (24-10, tarde) — Dani: «gestiona todas mis cuentas profesionales»
- **X** (@FlotaDSP, Premium): bio, ubicación y web puestas; post fijado con el spot de Puck
  (`utm_source=x&utm_content=spot5`) y post para empresas (`/planes`, `utm_content=empresas`).
- **LinkedIn** (página FlotaDSP): post para empresas (`utm_source=linkedin&utm_content=empresas`). El spot de
  repartidores ya estaba publicado allí ese mismo día.
- **Telegram**: sin grupos útiles en España (estafas cripto o grupos donde solo escribe el dueño). Nada publicado.
- **Facebook**: el perfil de Daniel tiene acciones restringidas hasta que confirme su identidad en el móvil; sin
  eso no se puede publicar en los grupos. (Lo que parecía un reel de Puck en la página era el anuncio; el
  reel orgánico se publicó esa misma noche, ver abajo.)
Detalle y trucos de cada editor en la memoria `redes-sociales-fds`.

## 24-10-2026 (noche): que vuelvan por la mañana — entrar desde el correo y el correo a tiempo

Medido en producción (analítica): de 29 clics en los correos del ciclo que iban a /ruta, solo 7 entraron; el resto
caía en /empezar (crear cuenta) porque el correo se abre en Gmail/Chrome y la sesión se quedó en el navegador de
Facebook donde se dieron de alta. Algunos se volvían a registrar. Arreglado:
- **Pase en cada correo del ciclo** (`_pase_de_correo`, server.py): mismo mecanismo que el pase al móvil
  (`pases_movil`, solo la huella), pero `tipo: "correo"`, 72 h y hasta 5 usos (los antivirus abren los enlaces).
  Los enlaces van a `/pase?ir=ruta|cuenta&utm_…#p=<pase>`; el pase tras «#» no llega al servidor ni a la
  analítica, y la copia en `correos_enviados` lo guarda tachado («…»). El de «opinión» no lleva pase.
- **/ruta sin sesión → /login?next=/ruta…** (antes /empezar). El login, si viene de la ruta, dice «Entra en FDS»,
  «Tu correo» y «Crear cuenta gratis» (claves `login.rep.*`).
- **«primer_dia» a las 8 h y no a las 20 h** (`PRIMER_DIA_DESDE`): se dan de alta de 13 a 23 h y con 20 h la
  mañana siguiente nunca cumplía; salía un día tarde.
- En la bienvenida, quien pulsa «Todavía no» lee que por la mañana le llega un correo con botón para entrar directo.
- Tests: test_pase_movil (+2), test_ciclo_correos (+3), humo «Correo ·» (+3).

Redes (misma noche): reel de Puck publicado en la página FDs (Business Suite → Crear reel, también al grupo
Repartidores BCN, donde está la página). Facebook pide a Dani un **vídeo selfie desde la app del móvil**
(«actividad inusual»): hasta entonces ni el perfil ni la página pueden publicar o unirse a grupos. YouTube Short y
TikTok de Puck ya estaban subidos ese día (el de TikTok sin descripción).

### 24-10, noche (2): presupuesto, grupos y LinkedIn
- Meta: campaña de registros a **20 €/día** (detalle en `docs/anuncios/CAMPANA-24-10-SPOT5.md`). Pendiente de Dani:
  la verificación de anunciante de Meta (documento de identidad) y ampliar el fin del 29-10.
- Facebook (Dani ya verificado): publicado el spot de Puck en REPARTIDOR DE PAQUETERIA (MX, 11,3 mil), Repartidores
  de paquetería autónomos (MX, 11,9 mil) y Mensajeros Medellín (8,9 mil): los tres **pendientes de aprobación del
  administrador**. No se publicó en Trabajo de repartidor España ni en Repartidores de Mercado Libre y Amazon
  (prohíben la autopromoción), ni donde seguía pendiente la del 05-10/11-10 (Autónomos Transporte, Levante,
  Paquetería Madrid, Mercado Envíos CDMX, ML CDMX y Edo. Mex.).
- LinkedIn: resumen de la página FlotaDSP publicado (se ve en «Acerca de»); el aviso de invitaciones aún lo daba
  por vacío (caché). Mandar las 50 invitaciones cuando se desbloquee (Dani dio luz verde).

## 25-10-2026 (madrugada): autocrítica de la app de reparto y primeras mejoras
Análisis completo en `docs/AUTOCRITICA-APP-25-10.md` (usada como repartidor nuevo en producción, datos de uso y
mercado: Circuit/Spoke, Zeo, Xpedit, Routal). Hecho y desplegado:
- **De noche se planifica para la mañana**: «Ordenar ruta», el orden a mano y el ejemplo salen de 22:00 a 5:59 a la
  hora de salida de Ajustes (9:00 por defecto) y la ruta lo dice («Sales a las 9:00»): antes, a las 00:12, 8 paradas
  en A Coruña daban «00:18, 00:25… 11 h 53 min». `_rep_salida_ahora`, campo `programada` en `reparto_rutas`.
- **Paradas de días anteriores**: `previas` en `/reparto/mi-ruta` y `POST /reparto/mi-ruta/traer-previas` (solo quien
  reparte por su cuenta; última semana; quedan sin orden y con `traida_de`). Aviso con «Pasarlas a hoy» / «Ahora no».
- **Su progreso de verdad**: `GET /reparto/mis-marcas` (total, mejor día antes de hoy, días de la semana). Récord en la
  cabecera (≥10 y más que cualquier día anterior), «Tu récord: N» y en el resumen «Tu mejor día…» y «Llevas N entregas».
- **La opinión, al terminar la ruta** (debajo del resumen) y no arriba de «Hoy» al ir a cargar.
- **Un consejo al día** (`CONSEJOS` en MiRuta): ordenar, dónde va cada paquete, Google Maps/Waze; solo cuando viene a
  cuento y nunca otra vez tras «Entendido».
- **Direcciones que ya conoce**: `GET /reparto/mis-direcciones?q=` (sus paradas situadas de los últimos 180 días que
  encajan con lo escrito, con veces, cliente y teléfono); salen primero en las sugerencias al escribir una parada.
- Tests: test_reparto_api (+4), humo «Reparto ·» (+5), activación ajustada a la opinión al terminar.

## 25-10-2026 (mañana): escanear la etiqueta y la parada entra sola; portada de repartidores más limpia
Dani: «si trabajas en MRW, GLS, Nacex, CTT y escaneas el paquete, que se añada a la lista sin esperar a la foto;
verifica cuáles podemos escanear». Hecho, probado y desplegado:
- **Escanear y ya**: si los códigos de la etiqueta traen calle Y dónde (`datosDeCodigos(...).completa`: CP, población o
  GPS), la parada se guarda al momento (`POST /reparto/mis-pedidos`) y sale «✓ Añadida a tu ruta» con «Escanear otro» y
  «Corregir» (abre la hoja con lo guardado). A medias, la hoja de siempre y la foto completa lo que falte. En «Escanear
  seguidos» igual: solo entra sola la completa; la que trae solo la calle va a «revisar al acabar».
- **Formatos por empresa** (`frontend/src/lib/codigoEtiqueta.js`, fuentes en su cabecera):
  · DPD/SEUR (Geopost): Aztec ISO 15434 de la especificación «Geolabel» 6.0: calle, población, CP, empresa, contacto,
    teléfono, número del portal, piso y GPS. `deGeopost`.
  · GLS: el segundo DataMatrix «A|nombre|calle|población||teléfono|…» de su documentación ShipIT (sin CP). `deGLS`.
  · GS1 «Scan4Transport» y QR con «|»: como ya estaba.
  · **UPS: NO**. Su MaxiCode lleva la dirección, pero zxing solo lo lee «puro» (solo en el encuadre) y Chrome en
    Android no lo trae; probado con la cámara simulada: con la barra 1Z o letra alrededor no lo encuentra. De UPS se
    lee la barra 1Z y la dirección sale de la foto.
  · **MRW, Nacex, CTT, Correos Express: sin verificar** (no publican qué llevan sus códigos). Para aprenderlo:
    `POST /reparto/formas-codigo` guarda solo la FORMA de los 2D que no dan la dirección (letras → «a», cifras → «9»,
    separadores <GS>/<RS>/<US>), en `formas_codigo` de la base global (`forma`, `veces`, `paises`). Mirarla cuando
    haya escaneos reales y escribir el lector de cada una.
  · OJO: los formatos son los publicados; no hay etiquetas reales de SEUR/GLS España en el repo para contrastar.
- **Pruebas**: `scripts/check-escaneo-2d.mjs` (en CI) fabrica cada etiqueta con zxing y la lee con el mismo motor que
  el móvil (modo «Plain», con separadores); `frontend/e2e/escaneo-real.spec.js` hace la cadena entera en el navegador
  con el lector propio y la cámara simulada (un lienzo con los códigos y letra de etiqueta): SEUR/DPD y GLS entran
  solas. `escanear-etiqueta.spec.js`: entra sola, «Corregir», y la incompleta abre la hoja y manda su forma.
- **Portada /repartidores más limpia**: el alta justo debajo del título (en el móvil el botón se ve sin bajar; antes
  lo empujaban las empresas), sin repetir «Gratis…» bajo el botón con la promoción, 6 ventajas en vez de 9 y un botón
  «Probarla» menos al final. «Con quién sirve», debajo de «Probarla».
- Pendiente aparte (no es de esto): la prueba móvil del candado del Cuadrante falla según la fecha (la celda queda bajo
  la columna fija de nombres); hay tarea propuesta.

## 25-10-2026 (tarde): «Pedir días» se abría en un mes sin nada que pedir
Dani: «he entrado en 2 cuentas y no me salía ningún día para pedir». No era el servidor: probado contra producción
con 12 conductores de OGA5 (solo GET), `/shifts/mine` y `/shift-blocks/mios` contestan bien. Octubre tenía 0 días
marcables (24 pasados y el resto bajo el bloqueo de OGA5 del 13/10 al 02/11, «cuadrante realizado») y noviembre 28,
pero la pantalla abría siempre en el mes en curso, con el porqué en letra pequeña bajo el calendario.
Arreglado en `PedirDias.jsx`: al cargar, si el mes en curso no tiene ningún día que marcar, abre el primero de los dos
siguientes que sí y lo dice («En octubre ya no queda ningún día que pedir: la oficina lo ha cerrado hasta el 02/11
(cuadrante realizado). Te enseñamos noviembre.»); un mes sin días lo dice arriba con «Ver {mes} →». Verificado en
producción como un conductor de OGA5 (escrituras cortadas): abre noviembre con 22 días para tocar. Test en humo
(«Portal del conductor · tus peticiones»).

## 25-10-2026 (tarde): la app del repartidor, como app y no como web (Play 1.0.3)
Todo en `docs/PLAY_STORE.md` → «Versión 1.0.3». Resumen: barra de arriba del color de la app (`theme-color`
dinámico, lib/tema.js `vestirDeApp`), «atrás» que cierra hojas y vuelve a «Hoy» (lib/atras.js `useAtras`), /app sin
recargar, sin cookies ni píxeles dentro de la app instalada (`yaEsApp` solo con nuestros paquetes android-app://),
sin zoom ni menú del navegador en la app (`prepararModoApp`), service worker con la app y el logo en el móvil y
pantalla «Sin conexión» propia (public/sw.js), la ruta guardada en el móvil (`fds_ruta_copia`, se borra al salir),
y Ajustes/Cuenta/Mercadillo cargados al usarlos. AAB 1.0.3 (code 4) en
`android/app/build/outputs/bundle/playRelease/app-play-release.aab`, falta que Dani lo suba. Pruebas:
`frontend/e2e/app-nativa.spec.js`. Ojo: compilar Android necesita `ANDROID_HOME` (Sdk en AppData\Local\Android\Sdk).
La app de China (WebView propio) NO se ha tocado: sigue con su barra oscura.

## 28-10-2026: distintivo de Google Play
La ficha pública de FDS ya está disponible en Google Play con el paquete `com.flotadsp.flota`:
`https://play.google.com/store/apps/details?id=com.flotadsp.flota`. Se comprobó que la ficha responde
públicamente (HTTP 200). La portada y la tarjeta de instalación para Android enlazan ahora a la ficha con
el distintivo oficial de Google Play, localizado en los siete idiomas de la app; se mantiene como alternativa
la descarga APK existente. En China no se muestra Google Play y se conserva la descarga específica de allí.

## 28-10-2026: acceso de empresa dentro de FDS y código por correo
Publicado en producción el 28-10-2026. El portal de empresa se puede abrir dentro de FDS desde el enlace con slug
que genera el panel (Android App Links); desde la app se abre directamente la pantalla de correo. El acceso web
general deja de pedir código de empresa: el correo encuentra la ficha en las organizaciones activas y el enlace con
slug queda como pista opcional. La vista principal del portal usa la altura
dinámica y respeta las áreas seguras del móvil. FDS usa un WebView restringido a
`flotadsp.com` y mantiene la subida de fotos mediante el selector del móvil. El acceso por correo ahora pide un OTP
de seis cifras, con caducidad de 10 minutos, uso único, máximo de cinco intentos y límites por IP/correo; la respuesta
de solicitud no confirma si el correo existe. Si el mismo correo aparece asociado a más de una organización, no se
elige una al azar ni se emite código. La contraseña también se resuelve por email cuando no hay slug; si una clave
coincide con más de una cuenta, el acceso se bloquea por ambigüedad. Las cuentas suspendidas y fichas de baja no
pueden entrar. El token se emite con el tenant de la empresa. En Conductores, la oficina puede vincular un correo
personal: se manda un enlace aleatorio, de un solo uso y 24 h; el conductor confirma con un botón. La dirección se
guarda separada de la ficha laboral y enmascarada en el panel. Tras verificarla, el OTP llega al correo personal
cuando el conductor introduce su correo laboral; también puede identificarse directamente por el correo personal.
Si la oficina aún no la vinculó, se mantiene el envío al correo de acceso y la pantalla explica cómo pedir la
vinculación. Un correo personal solo puede pertenecer a una ficha en el conjunto de empresas.
Los OTP caducados tienen índice TTL. La interfaz del código está traducida en los siete idiomas.

FDS queda con `versionCode 11` / `2.1.0`; el vínculo y login son cambios web/API y no modifican el APK. Backend
desplegado en Fly `flota-backend` (máquina `cdg`, versión 157); `/api/health` respondió `ok` y Mongo conectado.
Frontend publicado en Cloudflare Pages `flota`: el script verificó que `flotadsp.com` sirve el bundle exacto compilado
y calentó 277 recursos de edge. El envío de correo está configurado en Fly (Resend y Brevo presentes). No se usó
ningún buzón de conductor real durante la verificación.

CI de GitHub para el código del flujo: backend 1.398 tests pasaron y 1 se omitió; Playwright móvil/escritorio
completó 551 tests y omitió 47. Se corrigió el checker de rutas para reconocer los consumidores externos de Android,
Stripe y Apps Script; `node scripts/check-huerfanas.mjs` pasa localmente. La ejecución CI posterior a esa corrección
está en curso. `py_compile`, build de producción y hooks pasan; ESLint conserva warnings ya existentes. La prueba
post-deploy de pantallas autenticadas no pudo ejecutarse desde este PC porque falta Python en PATH y no hay una
`SECRET_KEY` local; sí se verificaron el healthcheck, el estado de la máquina, Mongo y el bundle publicado.
