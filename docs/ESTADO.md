# Estado de Flota y relevo entre sesiones

> **Si eres una sesión nueva: lee esto entero antes de tocar nada.**
> Al acabar tu trabajo, actualiza la sección «Última sesión» y «Pendiente»,
> haz commit y `git push`. Una sola sesión trabajando a la vez: antes de
> empezar, `git pull` y comprueba que nadie ha dejado nada a medias aquí.

Última actualización: **04-10-2026, madrugada** (sesión `e88d38c9`, Claude).

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

## Pendiente (por prioridad)

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
