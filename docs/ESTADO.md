# Estado de Flota y relevo entre sesiones

> **Si eres una sesión nueva: lee esto entero antes de tocar nada.**
> Al acabar tu trabajo, actualiza la sección «Última sesión» y «Pendiente»,
> haz commit y `git push`. Una sola sesión trabajando a la vez: antes de
> empezar, `git pull` y comprueba que nadie ha dejado nada a medias aquí.

Última actualización: **30-09-2026, madrugada** (sesión `127edf58`, Claude Opus 5.5).

## Qué es y dónde está

- **Flota**: SaaS de gestión de flotas para cualquier empresa. Nació el 25-09-2026
  como copia depurada de FlotaDSP (sin extensión de Cortex ni nada que
  interfiera con Amazon). Dani lo usa también para **su propia flota**
  (reparto para Amazon, centros OGA5, DGA1, DGA2).
- Código: `C:\Users\Usuario\Downloads\flotia` (la carpeta NO se renombró),
  rama `main`, repo privado **github.com/oga5furgonetas/foefa**.
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
# backend (desde backend/)
fly deploy --remote-only -a flota-backend --strategy immediate --ha=false
# web (desde frontend/)
VITE_API_URL=https://flota-backend.fly.dev/api npx vite build
node ../scripts/sellar-build.mjs
npx wrangler pages deploy dist --project-name flota --branch main --commit-dirty=true
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
     menú; Cuadrante y Órdenes detrás de la suya («va con…»); «Ve N de 29
     pantallas»; vista «Quién ve cada pantalla» (pantallas × usuarios, la
     misma cuenta que el menú: `veLaPantalla`) con «Editar» por usuario.
   - **Cambio de centro programado**: `traslado` en la ficha +
     `POST/DELETE /drivers/{id}/traslado` + `_bucle_traslados` (15 min, todas
     las empresas, latido `traslados`, `historial_centros`). Fran Gil, a OGA5
     el 05-10 (programado en producción).

## Pendiente (por prioridad)

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
   pagar y Dani no quiere pagar). `cluster1` parece estar en esa misma
   organización: hace falta una organización NUEVA gratis, clúster M0, copiar
   `flota`, `flota_global`, `dsp_demo`, `edge_os` y cambiar `MONGO_URL` en Fly.
   Hay copia diaria en R2 (04:00) y la copia local, pero la app se caería.
3. Correo (Resend/Brevo), WhatsApp (claves `WHATSAPP_*`) y pagos: sin
   configurar. Telegram SÍ funciona (su config venía en los datos).
4. Investigaciones de DNR y portal `/dnr/t/` de FlotaDSP: no recuperados
   (están en el commit raíz `cfed72b` si Dani los pide).
5. Capturas para la portada (`ProductoReal.jsx` se oculta si no hay imágenes).
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
- El usuario de Atlas no puede `dropDatabase`: las bases de prueba se vacían
  colección a colección.
- La demo es de solo lectura (403 al escribir). Para probar escrituras:
  backend local contra bases `prueba_*` del clúster (ver cómo en la sesión
  c3af8cab: `api_prueba.py` con token de mantenimiento `maintenance-claude`).
- La caché DNS de Windows guarda los «no existe»: `ipconfig /flushdns` o
  `curl --resolve flotadsp.com:443:104.21.49.241`.
- El login de Cloudflare en el navegador integrado falla por la comprobación
  anti-robots: que Dani lo haga en su Chrome.
