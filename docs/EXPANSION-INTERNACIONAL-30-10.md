# FDS fuera de España: qué hay, qué se ha hecho hoy y qué falta por país (30-10-2026)

> Dani (30-10): «prepara la aplicación para expandirla… Europa, Alemania, Francia, Estados Unidos, Latinoamérica…
> que cuente con toda la legislación de allí… cómo funcionan las cargas y descargas… que si alguien la descarga en
> Estados Unidos la aplicación se le descargue en inglés… y cuando pague, pague en dólares… que todo tenga sentido».
>
> Sin falsos positivos: lo que es un hecho lleva su fuente (al final) o su `fichero:línea`; lo que es una propuesta
> lo dice. Lo investigado se leyó el 30-10-2026; las normas de circulación cambian cada año y antes de publicar en un
> país hay que volver a la fuente oficial que se cita.

## 0. En diez líneas

1. FDS ya era bastante internacional por dentro: web en 6 idiomas con español de Latinoamérica y portugués de
   Brasil, país por cuenta (36 países), prefijo telefónico, geocodificación por país, cobro en la puerta en la
   moneda del país, Bizum solo en España y Pix en Brasil. Lo que fallaba: **la app nativa estaba solo en español**,
   el precio del plan era «9,99 €» en todas partes, los km se enseñaban también en EE. UU., y los datos de cortes y
   zonas de bajas emisiones son solo de la DGT (España).
2. **Hecho hoy**: la app nativa habla el idioma del móvil (en, pt, fr, it, de; 319 textos, con las palabras de
   Latinoamérica y Brasil); el plan sale en la moneda del país (servidor, web y cuenta); millas en EE. UU. y Reino
   Unido; Stripe en el idioma del cliente; la ficha de Play en 7 idiomas lista para pegar.
3. **Pagar en dólares**: con Stripe basta añadir `currency_options` a los dos Price en el Dashboard (Checkout elige
   la moneda del cliente solo); en Google Play los precios por país salen del precio base y se ajustan uno a uno. La
   compra DENTRO de la app nativa (Play Billing) sigue pendiente (tarjeta «Tanda 1»).
4. **Cortes y zonas en el mapa fuera de España**: hay datos abiertos gratis en Francia, Reino Unido, Países Bajos y
   EE. UU. (y Alemania con registro); en Italia y Latinoamérica no hay un feed nacional comparable. Está el gancho en
   el servidor para enchufarlos por país (§9).
5. **Lo que de verdad cambia el reparto fuera**: en Latinoamérica mandan las restricciones por placa (Hoy No
   Circula, pico y placa, rodízio) y el pago contra entrega; en EE. UU. dejar en la puerta con foto es lo normal; en
   Alemania la «Abstellgenehmigung» (permiso de depósito) y el vecino; en Francia y Alemania las zonas de bajas
   emisiones son por pegatina (Crit'Air, Plakette). Nada de esto exige cambiar el producto: FDS ya tiene «dónde
   dejarlo», foto, firma, cobro y zonas; falta alimentarlo con los datos de cada país (§10).
6. **Impuestos**: vender fuera obliga a cosas concretas: IVA del país del cliente en la UE por encima de 10.000 €
   al año (ventanilla única OSS), registro en el SAT de México desde la primera venta (16 %), y en EE. UU. impuesto
   de ventas solo al pasar los umbrales de cada estado. Stripe Tax lo calcula; registrarse es cosa de Dani y su
   gestor (§6).
7. **Privacidad**: el RGPD ya cubre la UE; en Brasil aplica la LGPD a quien ofrece servicios allí; en California la
   CCPA no aplica a una empresa del tamaño de FDS (umbral ~26,6 M$ o 100.000 consumidores). Falta la política de
   privacidad y los términos en inglés (hoy solo en español) (§7).
8. **Orden propuesto**: Latinoamérica en español (ya casi todo hecho) → Portugal y Brasil → Reino Unido e Irlanda
   (inglés, millas, datos abiertos) → Francia → EE. UU. → Alemania e Italia. Las tandas con esfuerzo en §11.
9. **No se ha tocado producción**: ni se ha desplegado ni se ha subido nada a Play. Lo de hoy compila y pasa los
   tests, y la nativa se ha visto en inglés en el emulador.
10. **Lo no verificado** está en §12: las normas de circulación se han leído en prensa y portales oficiales, no en el
    texto legal; los precios por moneda son una propuesta; los feeds de datos extranjeros no se han conectado.

## 1. Lo que ya tenía FDS para fuera de España (comprobado en el código)

| Qué | Dónde | Estado |
|---|---|---|
| Web del repartidor y portada en 6 idiomas (es, en, pt, fr, it, de), con el idioma del móvil o el elegido en Cuenta | `frontend/src/lib/idioma.js`, `textosRuta{A,B,C}.js` (1.193 textos) | ✓ |
| Español de Latinoamérica (celular, camioneta, toma una foto) y portugués de Brasil (senha, parada…) por zona horaria o idioma del móvil | `idioma.js` (`aLatam`, `aBrasil`) | ✓ |
| País por cuenta: deducido de la región del idioma del móvil o de la zona horaria; 36 países con prefijo y zonas horarias | `server.py` `PAISES_REPARTO`, `_region_alta` | ✓ |
| Geocodificación restringida al país de la cuenta (Nominatim + Photon) | `server.py` `_rep_ubicar` (`countrycodes`) | ✓ |
| Moneda de lo que se cobra en la puerta por país; formato de números del móvil | `frontend/src/lib/region.js` `MONEDAS`, `importe()`; nativa `ui/Tema.kt` `Region` | ✓ |
| Métodos de cobro por país (Bizum solo España, Pix solo Brasil) | `region.js` `metodosCobro` | ✓ |
| WhatsApp con el prefijo del país | `server.py`, nativa `Acciones.whatsapp` | ✓ |
| Zonas de carga y descarga de OpenStreetMap (funciona en cualquier país donde estén dibujadas) | `reparto.py` Overpass | ✓ |
| País de la SIM en la nativa al registrarse | `Repositorio.paisDelMovil` | ✓ |
| «Invita y gana» solo en España; PayPal fuera de España | `PLAN-1000.md` | ✓ |

Y lo que NO tenía: la **app nativa solo en español** (1.762 literales en Kotlin, ninguno traducido; fechas con
`es-ES` a mano), el **precio del plan escrito «9,99 €»** en portada, alta, «Empezar» y Cuenta, **km en todas
partes**, la **página de pago de Stripe en español** (`locale: "es"`), **las páginas legales solo en español**
(`frontend/src/legal/`), **la ficha de Play solo en español**, y **datos de tráfico y zonas solo de España** (DGT).

## 2. Lo hecho hoy (30-10-2026), sin desplegar

### Servidor (`backend/server.py`, tests en `backend/tests/test_expansion.py`)
- `MONEDA_PAIS` (la moneda de cada país de `PAISES_REPARTO`), `PAISES_MILLAS` (us, gb, lr, mm) y `PRECIOS_REPARTIDOR`
  (el plan por moneda, §5); `_moneda_de`, `_unidades_de`, `_precios_repartidor(pais, tarifa_eur, catalogo)`.
- `GET /org/billing`: `precios` trae `moneda`, `mensual`, `anual` en la moneda del país de la cuenta (en euros manda
  la tarifa editable de siempre), y `unidades` («km» | «mi»). Se puede pisar la tabla desde el panel de negocio
  (`plan_catalog.precios_repartidor`, `{"MXN": [129, 1290]}`).
- `GET /billing/planes?pais=mx`: `precios_repartidor` para la portada sin cuenta.
- `GET /reparto/mi-ruta`: `unidades` y `moneda` junto a `pais` y `prefijo`.
- Stripe Checkout en el idioma del cliente (`locale: "auto"`): con `currency_options` en los Price, también en su
  moneda (§6).

### Web (`frontend/src/`)
- `lib/region.js`: `importeEn(n, moneda)`, `precioRepartidor(pais, servidor)`, `unidades()`, `distancia(km)`
  («3,1 km» / «1.9 mi» con `Intl`), `KM_POR_MILLA`; `lib/precios.js`: `PRECIOS_REPARTIDOR` (respaldo de la tabla).
- Portada, «Empezar» y alta rápida: el precio en la moneda del país de quien mira («$9.99/mes» en EE. UU., «MX$149»
  en México); Cuenta (`RutaCuenta.jsx`): el plan en la moneda de la cuenta (los regalos y «invita y gana» siguen en
  euros, que son de España).
- `MiRuta.jsx`: km de la ruta y del trazado en millas donde toca; «Gasolina por milla» con conversión al guardar
  (se guarda siempre por km).
- 12 textos nuevos en los 6 idiomas (`textosRutaB.js`).

### App nativa (`app-android/`)
- **`ui/Idioma.kt`**: `tx("texto en español")` como en la web; el idioma del móvil al arrancar (`FdsApp`), inglés si
  el móvil está en uno que no tenemos; español de Latinoamérica y portugués de Brasil con las mismas listas de
  palabras que la web; `Idioma.locale` para fechas y números.
- **`scripts/nativa-idioma.mjs`**: envuelve en `tx()` los textos visibles de los `.kt` (idempotente), genera
  `ui/Traducciones.kt` (319 textos: 111 de la web, 208 propios en `app-android/traducciones-nativa.json`) y
  comprueba que ningún `tx("…")` se queda sin sus 5 idiomas (`node scripts/nativa-idioma.mjs --comprobar`, para el CI).
- 17 ficheros envueltos y unas 90 plantillas con variables pasadas a mano (`tx("Quedan {n} paradas", "n" to q)`):
  Hoy, hojas, mapa, ficha, ajustes, acceso, escáner, mensajes del repositorio. Fechas en el idioma de la app
  (`LOCALE_APP`, `patronFecha`), millas en la cabecera y en «Gasolina por milla».
- Lo que sigue en español dentro de la nativa: las pantallas del **conductor de empresa** (portal, turnos,
  auditoría, referidos, extras, avisos) tienen sus textos fijos traducidos pero no las plantillas con variables
  (unas 36 líneas): son para empleados de empresas españolas y se dejan para cuando haya una empresa fuera.
- Ficha de Play en 7 idiomas: `app-android/play-listing/` (es-ES, es-419, en-US, pt-BR, fr-FR, de-DE, it-IT).

### Verificado
`check-textos-ruta` (1.116 textos usados, 1.193 traducidos), ESLint, `vite build`, Playwright (`calle`,
`escanear-etiqueta`, `humo`), `pytest backend/tests/test_expansion.py`, `nativa-idioma --comprobar`, Gradle
(`testDebugUnitTest` + `assembleDebug`), y la nativa en el emulador con el sistema en inglés (capturas
`docs/capturas-30-10/app-en-*.png`).

## 2b. Lo hecho el 30-10 a mediodía (Dani: «si no hay DGT en los otros países, algo que se adecue a esos países»)

`backend/trafico.py` (puro, con tests sobre muestras reales en `backend/tests/muestras/`) y `_fuente()` en `server.py`:
cortes y obras de Bison Futé (FR), NDW (NL) y WZDx (15 feeds estatales de EE. UU. comprobados uno a uno); zonas ZFE
(BNZFE), milieuzones/ZES (NDW), ULEZ/LEZ (GLA) y las de OSM (DE, IT, BE, AT, PT, CH, IE, AD) con `incompleto` si
Overpass no contesta; avisos por placa (rodízio, Hoy No Circula, pico y placa de Quito y San José; Bogotá, Medellín
y Santiago con enlace) con la matrícula guardada en Ajustes. Stripe cobra en la moneda del país (`currency` en
Checkout, `currency_options` con `backend/scripts/stripe_monedas.py`). Etiquetas y QR: el piso bien leído y los
formatos de 13 países; el buscador recibe la dirección sin piso. La nativa enseña los mensajes del servidor en el
idioma del móvil. Verificado con una cuenta de Seattle en el emulador (`docs/capturas-30-10/app-us-*.png`) y
Playwright `e2e/fuera.spec.js`. Detalle en ESTADO.md («30-10-2026 (mediodía)»).

## 2c. Lo hecho el 30-10 a mediodía (2): Reino Unido y Alemania con fuente, correos en fr/it/de, «Actualización disponible»

TfL (Gran Londres) y la API de la Autobahn GmbH (Alemania, autopistas) en `trafico.py`; las zonas de OSM con copia en
Mongo por si Overpass no contesta; los correos del ciclo (bienvenida, primer día, recordatorio, invita, bono,
opinión) en francés, italiano y alemán (`ciclo_correos.py`); el vocabulario de la carretera y los mensajes del
servidor en la app nativa en el idioma del móvil; y el aviso de actualizar al entrar (FDS 2.4.1, code 20).

## 3. Lo que falta, mercado por mercado

| | Idioma | Moneda del plan | Unidades | Cortes y obras en el mapa | Zonas / restricciones | Pago | Impuestos | Legal |
|---|---|---|---|---|---|---|---|---|
| Portugal | ✓ pt | EUR ✓ | km | ✗ (sin feed abierto) | **ZER por OSM ✓** (30-10 mediodía) | Stripe EUR ✓ | OSS si > 10 k€ | legal en pt ✗ |
| Francia | ✓ fr | EUR ✓ | km | **Bison Futé ✓** (DATEX II, 30-10 mediodía) | **ZFE ✓** (BNZFE, con la regla Crit'Air del día) | Stripe EUR ✓ | OSS | legal en fr ✗ |
| Alemania | ✓ de | EUR ✓ | km | **API de la Autobahn ✓** (autopistas; las calles no tienen feed abierto) | **Umweltzonen por OSM ✓** (con copia en Mongo) | Stripe EUR ✓ | OSS | legal en de ✗ |
| Italia | ✓ it | EUR ✓ | km | ✗ (sin feed nacional abierto) | **ZTL por OSM ✓** | Stripe EUR ✓ | OSS | legal en it ✗ |
| Países Bajos / Bélgica | en/fr/de | EUR ✓ | km | **NDW ✓** (Países Bajos) | **milieuzones y ZES ✓** (NDW); Bélgica por OSM ✓ | Stripe EUR | OSS | ✗ |
| Reino Unido / Irlanda | ✓ en | GBP / EUR (tabla) | **millas ✓** (GB) | **TfL ✓** (Gran Londres; fuera, National Highways pide clave) | **ULEZ + LEZ ✓** (GLA); Irlanda por OSM ✓ | **Stripe GBP ✓** (currency_options) | IVA UK digital | legal en inglés ✓ (cortesía, sin jurista) |
| Estados Unidos | ✓ en | USD ✓ (tabla) | **millas ✓** | **WZDx ✓** (15 feeds estatales sin clave) | sin LEZ | **Stripe USD ✓** / Play | sales tax por estado al pasar umbral | legal en inglés ✓ (cortesía, sin jurista) |
| México | ✓ es-419 | MXN ✓ (tabla) | km | ✗ | **Hoy No Circula ✓** (aviso por placa, con el engomado) | **Stripe MXN ✓** / Play | IVA 16 % con registro en el SAT | ✗ |
| Colombia | ✓ es-419 | COP ✓ (tabla) | km | ✗ | pico y placa: aviso con el enlace oficial (cambia por temporada) | Play / **Stripe COP ✓** | a verificar | ✗ |
| Chile | ✓ es-419 | CLP ✓ (tabla) | km | ✗ | restricción vehicular: aviso con el enlace oficial (mayo–agosto) | Play / **Stripe CLP ✓** | a verificar | ✗ |
| Argentina | ✓ es-419 | USD (sin precio fijo en ARS por la inflación) | km | BA Data «Tránsito» (con credenciales) | — | Play | a verificar | ✗ |
| Brasil | ✓ pt-BR + Pix | BRL ✓ (tabla) | km | ✗ | **rodízio de São Paulo ✓** (aviso por placa) | Play / **Stripe BRL ✓** | a verificar | LGPD ✗ |

## 4. Mercado por mercado: cómo se reparte y qué le pasa a la app

Lo que importa de verdad para un repartidor con FDS: dónde puede dejar el paquete y qué prueba vale, qué restricción
de circulación le puede costar una multa, y cómo le pagan. Los detalles con fuente; lo que no la tiene, no se afirma.

### 4.1 Francia
- **Idioma y textos**: la web y la nativa ya en francés. La ficha de Play en `play-listing/fr-FR`.
- **Zonas de bajas emisiones (ZFE-m)**: por pegatina Crit'Air. El Gran París restringe Crit'Air 3, 4, 5 y sin
  clasificar de lunes a viernes de 8 a 20 h desde el 1-1-2025 (las fuentes no coinciden en si 4 y 5 lo están las 24
  h), con un «pass 24h» de 24 días al año; la Metrópoli ha decidido **no multar a los Crit'Air 3 en 2026** y las
  sanciones se esperan para enero de 2027 (multa de 135 € para utilitarios). Hay una **Base Nacional Consolidada de
  ZFE** en data.gouv.fr (Licencia Abierta 2.0, esquema `etalab/schema-zfe`, con fechas de aplicación), más
  perímetros por metrópoli en GeoJSON (Rennes, Annemasse…): es el equivalente directo de los polígonos de ZBE de la
  DGT y se enchufa igual (§9). Un usuario avisa de que el perímetro de París en la base no estaba al día: cotejar
  con el arrêté.
- **Cortes y obras**: Bison Futé publica los eventos de la red nacional no concesionada (desvíos, obras, atascos) en
  DATEX II, en tiempo real y **sin login** (licencia opendata); los eventos peligrosos imprevistos van por el
  punto de acceso «Action c», con otras condiciones.
- **Reparto**: la firma a la entrega y el buzón son lo habitual; no se ha verificado la norma de dónde puede
  dejarse un paquete sin firma. Las opciones de FDS (buzón, portería/loge, vecino, lugar seguro, punto de recogida)
  ya cubren lo que hace Colissimo.

### 4.2 Alemania
- **Umweltzonen**: la pegatina verde vale en todas las zonas, también para eléctricos; el Umweltbundesamt publica un
  GeoPackage (`umweltzonen_de`) con las zonas (35 activas según el propio UBA en una comparación de 2025; OSM tiene
  30 de ellas como `boundary=low_emission_zone`). Se enchufa como las ZBE.
- **Cortes y obras**: la Mobilithek (BASt, el punto de acceso nacional) sirve DATEX II de los Länder (Baviera,
  Sajonia, Renania-Palatinado…); los datos son por lo general gratuitos pero piden registro, y cada oferta tiene sus
  condiciones: comprobar antes de conectar.
- **Reparto**: la figura clave es la **Abstellgenehmigung** (permiso de depósito): con ella el riesgo pasa al
  cliente en cuanto el paquete está en el sitio acordado; sin ella el repartidor debe conseguir firma o dejarlo a un
  vecino (que no está obligado a aceptarlo y responde si lo pierde). Para FDS: el enlace del cliente ya recoge «dónde
  dejarlo» y guarda la respuesta con fecha, que es exactamente la prueba que allí se necesita; en Alemania convendría
  enseñar ese consentimiento en la prueba de entrega.
- **Horas de conducción**: los furgones ≤ 3,5 t en reparto nacional no llevan tacógrafo; desde el **1-7-2026** los
  de más de 2,5 t en transporte **internacional** o cabotaje sí (tacógrafo inteligente 2 y normas de tiempos de
  conducción): no afecta a un repartidor urbano.

### 4.3 Italia
- **ZTL y Area B/C**: Milán cierra el acceso a los diésel más viejos de lunes a viernes de 7:30 a 19:30 (188 cámaras);
  las fechas para los diésel Euro 5 comerciales no coinciden entre fuentes (2026 o 2027). No se ha encontrado un
  dato abierto nacional con los perímetros: hay que ir ciudad a ciudad (Milán tiene portal de datos). Sin esto, FDS no
  debe dibujar ZTL en Italia (no inventar).
- **Cortes y obras**: no se ha encontrado un feed abierto nacional comparable a la DGT o Bison Futé.
- **Impuestos**: la facturación electrónica obligatoria (SDI) es para empresas italianas; FDS factura desde España.
- **Pago**: euros, nada que cambiar.

### 4.4 Reino Unido e Irlanda
- **Millas**: hecho hoy (`gb` en `PAISES_MILLAS`; Irlanda va en km). La app en inglés británico cuando el móvil está
  en `en-GB` (fechas «Friday, 30 October»).
- **ULEZ / LEZ / CAZ**: el London Datastore publica la ULEZ interior en GeoJSON (y la expansión de 2023 en
  shapefile), con licencia OGL; el servicio ArcGIS de la GLA sirve ULEZ y LEZ con `f=geojson`; TfL dice que **no hay
  API para saber si un punto está dentro**: se descargan los polígonos y se mira en el servidor, como con las ZBE.
  Fuera de Londres, las Clean Air Zones (Birmingham, Bristol, Sheffield…) van por ciudad.
- **Cortes y obras**: el portal de desarrolladores de National Highways (red estratégica) se abre con
  autorregistro; el servicio de cortes v2.0 da cierres planificados en DATEX II y desde marzo de 2025 también los
  imprevistos; 10 llamadas por minuto por clave.
- **Horas de conducción**: reglas domésticas GB para ≤ 3,5 t: **10 h de conducción y 11 h de servicio en 24 h**, más
  la normativa de tiempo de trabajo; Irlanda del Norte tiene las suyas.
- **Pago e impuestos**: libras en la tabla (8,99 / 89); Stripe con `currency_options`. El IVA británico de
  servicios digitales a consumidores obliga a registrarse (sin umbral para no establecidos): a verificar con el gestor.

### 4.5 Portugal
- La app ya estaba en portugués (de Portugal), con Pix solo en Brasil. La ZER de Lisboa (Avenidas Novas /
  Baixa-Chiado) restringe por año de matrícula en días laborables de 7 a 21 h, con eléctricos exentos; los horarios de
  carga y descarga de 2026 no se han podido confirmar en una fuente oficial. Sin feed nacional de cortes verificado.

### 4.6 Países Bajos y Bélgica
- NDW publica en principio todos sus datos como open data (tiempo real e histórico) en DATEX II; las obras públicas
  van por «Melvin». Las milieuzones están en OSM. Idiomas: neerlandés no está en FDS (la app saldría en inglés o
  francés según el móvil).

### 4.7 Estados Unidos
- **Inglés y millas**: hecho hoy. Dólares: `USD` 9,99 / 99 en la tabla; con Stripe `currency_options` o Adaptive
  Pricing, Checkout cobra en dólares sin tocar código; en Play, el precio por país se genera del base y se puede fijar
  a mano.
- **Reparto**: dejar el paquete en la puerta con foto es práctica común (UPS fotografía cientos de millones de
  entregas residenciales; Amazon fotografía el porche cuando deja el paquete), aunque no es universal ni hay cifras
  oficiales. FDS ya hace foto de la prueba de entrega; la opción «En un lugar seguro» es el «porch».
- **Cortes y obras**: el registro WZDx (Work Zone Data Exchange) del DOT llegó a **40 feeds activos en junio de
  2026** (obras, por estado o condado, JSON con esquema común); además cada estado tiene su 511 con API REST y clave
  gratuita (Nueva York `GetEvents`, Wisconsin, Idaho, Nevada —10 llamadas/min—, Arizona, 511 SF Bay con token).
  Para FDS lo sensato es WZDx (un solo formato) y después 511 por estado donde haya usuarios.
- **Zonas**: no hay zonas de bajas emisiones; Nueva York cobra peaje de congestión en Manhattan (desde 2025).
- **Horas de conducción**: las normas federales (FMCSA) empiezan en 10.001 libras de peso bruto; una furgoneta de
  reparto por debajo queda fuera salvo casos concretos, y hay exención para reparto minorista local en un radio de
  100 millas aéreas. Las reglas estatales pueden ser más estrictas.
- **Impuestos**: el impuesto de ventas se debe desde que se pasa el umbral de cada estado (normalmente 100.000 $ o
  200 transacciones; 500.000 $ en California, Nueva York y Texas) y además el SaaS está gravado o no según el estado
  (gravado en Connecticut, exento en California, al 80 % en Texas). Stripe Tax lo calcula y presenta en EE. UU.
- **Privacidad**: la CCPA aplica desde ~26,6 M$ de ingresos (cifra ajustada de 2026) o 100.000 consumidores
  californianos: FDS no entra. Play exige una política de privacidad enlazada; en inglés.

### 4.8 México
- **Hoy No Circula** (CDMX y Edomex, 5:00–22:00): según la prensa diaria, el transporte de carga está exento en el
  programa ordinario, pero en **contingencia** («Doble Hoy No Circula») los vehículos de carga con placa local o
  federal no circulan de 6 a 10 h salvo los del Programa de Autorregulación, y las placas foráneas quedan
  restringidas los sábados y en contingencia. No se ha encontrado publicación oficial 2026 de la CAMe que lo
  confirme para carga: antes de avisar en la app, confirmarlo con la CAMe/SEDEMA.
- **Pago contra entrega**: muy extendido (46 % como segundo método preferido según una encuesta citada por Forbes
  México/AMVO; otras fuentes dan del 13 % al 23 %; las cifras de proveedores logísticos no son fiables). FDS ya cobra
  en la puerta en pesos; conviene que «efectivo» salga el primero en México.
- **IVA**: los proveedores extranjeros de servicios digitales deben inscribirse en el RFC del SAT (sin umbral, en 30
  días naturales desde que empiezan), cobrar el 16 % y emitir comprobante; si no están en la lista del SAT, el
  servicio se trata como importación y pueden bloquearlo. **Es el paso administrativo más serio de la lista** (§6).
- **Cortes**: no se ha verificado un feed abierto de incidentes en tiempo real.

### 4.9 Colombia (Bogotá)
- **Pico y placa de carga**: en 2026 aplica a vehículos de carga de **más de 20 años**: lunes a viernes de 6 a 8 y de
  17 a 20 h sin importar la placa, y sábados de 5 a 21 h por último dígito (pares/impares según el sábado); domingos
  y festivos sin restricción. Las notas mensuales de bogota.gov.co no son del todo consistentes entre sí: la fuente es
  la resolución vigente de la Secretaría Distrital de Movilidad.
- Pesos colombianos en la tabla (29.900 / 299.000). IVA sobre servicios digitales extranjeros: a verificar.

### 4.10 Chile (Santiago)
- **Restricción vehicular**: del 1 de mayo al 31 de agosto, lunes a viernes de 7:30 a 21:00; los vehículos **sin
  sello verde** no entran en el anillo Américo Vespucio, y los de carga sin sello tienen horario propio de 10 a 18 h
  dentro del anillo; con sello verde, dos dígitos al día (los calendarios de las fuentes no coinciden: ir a la
  Resolución 1.698 exenta del 29-4-2026). Multa de 1 a 1,5 UTM.
- Pesos chilenos en la tabla (7.990 / 79.900).

### 4.11 Argentina (Buenos Aires)
- **Cortes de calles**: BA Data tiene un servicio «Tránsito» en tiempo real que incluye cortes en la vía pública,
  con credenciales (`client_id`/`client_secret`) que hay que pedir; también un dataset diario de cortes. Es el único
  feed de cortes de Latinoamérica que se ha encontrado con documentación.
- Precio: **sin precio fijo en pesos** (inflación): la tabla devuelve dólares; en Play el precio en ARS se ajusta
  solo con el tipo de cambio.

### 4.12 Brasil (São Paulo)
- **Rodízio municipal y ZMRC**: la Zona de Máxima Restrição de Circulação (desde 2008) funcionaba de lunes a viernes
  de 5 a 21 h y sábados de 10 a 14 h según la prefectura (2020); el rodízio de camiones dentro del minianillo de 7
  a 10 y de 17 a 20 h por final de placa; los **VUC** (vehículo urbano de carga) aparecen exentos del rodízio en
  comunicados de 2020 y sujetos a él en blogs de 2026: contradicción que hay que resolver en la CET antes de avisar.
- Portugués de Brasil y Pix ya estaban; reales en la tabla (39,90 / 399).
- **LGPD**: aplica a quien ofrece servicios a personas en Brasil aunque no tenga sede; los despachos recomiendan un
  representante o un encargado con canal accesible; la Resolución CD/ANPD 2/2022 da plazos dobles a pequeñas
  empresas pero no exime.

## 5. El plan Repartidor en cada moneda (PROPUESTA, editable desde el panel de negocio)

La competencia por conductor en EE. UU. cuesta entre 25 y 50 $ al mes (Zeo 26,6–35 $, Circuit desde ~25–40 $ por
conductor, Routific 49 $): a 9,99 $ FDS es claramente la barata, que es lo que Dani quiere para «ganar nombre».
En Latinoamérica el número se baja para que sea un precio local y no una conversión (lo que se cobra por entrega
allí es menos de la mitad que en España):

| Moneda | Mes | Año | Equivale (30-10) | Países |
|---|---|---|---|---|
| EUR | 9,99 | 99 | — | España, Portugal, Francia, Italia, Alemania, Irlanda, Bélgica, Países Bajos, Austria, Andorra |
| USD | 9,99 | 99 | 9,2 € | EE. UU., Ecuador, Panamá, El Salvador, Puerto Rico; y todo país sin moneda en la tabla (Argentina, Venezuela, Cuba) |
| GBP | 8,99 | 89 | 10,3 € | Reino Unido |
| CHF | 9,90 | 99 | 10,6 € | Suiza |
| MXN | 149 | 1.490 | 7,5 € | México |
| BRL | 39,90 | 399 | 6,4 € | Brasil |
| COP | 29.900 | 299.000 | 6,5 € | Colombia |
| CLP | 7.990 | 79.900 | 7,6 € | Chile |
| PEN | 29,90 | 299 | 7,3 € | Perú |
| UYU | 349 | 3.490 | 7,6 € | Uruguay |
| CRC | 4.990 | 49.900 | 8,6 € | Costa Rica |
| GTQ | 59 | 590 | 7,0 € | Guatemala |
| DOP | 499 | 4.990 | 7,2 € | Rep. Dominicana |
| BOB | 59 | 590 | 7,8 € | Bolivia |
| PYG | 59.900 | 599.000 | 7,0 € | Paraguay |
| HNL | 199 | 1.990 | 7,0 € | Honduras |
| NIO | 299 | 2.990 | 7,4 € | Nicaragua |
| CNY | 69 | 690 | 8,8 € | China |

Las equivalencias son aproximadas (cambios de octubre de 2026 de memoria, no consultados): sirven para ver la
intención, no para contabilidad. Donde se cobre a través de Play, Play aplica su tipo de cambio al precio base y
Dani puede fijar cada país a mano; **estos números son la referencia para que la web, la app y Play digan lo mismo**.

## 6. Cobrar fuera: Stripe, Play e impuestos

- **Stripe (web)**: FDS crea la sesión con un `price_…` de un Price en euros. Si en el Dashboard se añaden
  `currency_options` a ese Price (USD, GBP, MXN…), Checkout elige la moneda del cliente por su ubicación sin tocar
  código (todo lo de la sesión tiene que tener esa moneda; no se debe forzar `currency`). La alternativa es Adaptive
  Pricing (conversión automática), que los precios manuales pisan. Hoy se ha puesto además `locale: "auto"` para que
  la página de pago salga en el idioma del cliente.
- **Google Play (nativa)**: la compra dentro de la app sigue pendiente (tarjeta «Tanda 1: pagar dentro de la app
  nativa»). Cuando exista, los precios por país se gestionan producto a producto en Play Console (las plantillas de
  precios se retiraron y se aplicaron a cada producto); Play genera el precio local del precio base con el tipo de
  cambio y «patrones de precio» del país, y se puede fijar a mano. El precio que ve el usuario sale del SDK de Play,
  en su moneda.
- **IVA en la UE (B2C)**: por debajo de 10.000 € al año de ventas a consumidores de otros países de la UE se aplica
  IVA español; por encima, el IVA del país del cliente, declarado por la ventanilla única (OSS) en la AEAT. Los
  autónomos del reparto suelen comprar como empresa (B2B con NIF-IVA, inversión del sujeto pasivo): hay que pedirles
  el número de IVA en el alta para no cobrar IVA de más.
- **Reino Unido**: IVA británico sobre servicios digitales a consumidores sin umbral para empresas no establecidas (a
  confirmar con el gestor). **Suiza**: IVA suizo si se superan 100.000 CHF globales (no verificado hoy).
- **EE. UU.**: impuesto de ventas por estado al pasar el umbral de nexo económico (100.000 $/200 transacciones; 500.000
  $ en CA, NY y TX), y el SaaS tributa o no según el estado. Stripe Tax calcula y puede presentar en EE. UU.
- **México**: registro en el RFC del SAT, 16 % de IVA y comprobante fiscal desde la primera venta; sin registro el
  SAT puede bloquear el servicio. Es un trámite con asesor mexicano antes de cobrar allí.
- **Colombia, Chile, Argentina, Brasil**: tienen regímenes de IVA para servicios digitales extranjeros (no verificados
  hoy): consultar antes de vender.

## 7. Legal y privacidad

- **RGPD**: ya cumplido para la UE; la política de privacidad, los términos, el encargo de tratamiento y las cookies
  están **solo en español** (`frontend/src/legal/`). Para publicar en inglés, francés, alemán, italiano y portugués
  hacen falta versiones traducidas (con revisión jurídica, no traducción automática): Play pide una política de
  privacidad enlazada y comprensible para el usuario.
- **Reino Unido**: UK GDPR, equivalente.
- **Estados Unidos**: la CCPA/CPRA no aplica (umbral de ingresos ~26,6 M$ en 2026 o 100.000 consumidores de
  California); otras leyes estatales tienen umbrales parecidos. Basta la política en inglés y el formulario de
  seguridad de datos de Play.
- **Brasil**: LGPD aplica a quien ofrece servicios a personas en Brasil; representante o encargado con canal
  accesible recomendado; plazos dobles para pequeñas empresas (Resolución CD/ANPD 2/2022), no exención.
- **México**: LFPDPPP (aviso de privacidad); no verificado hoy en detalle.
- **Ubicación del repartidor**: FDS solo la usa con la app abierta y para el propio repartidor (autónomo) o su empresa
  (conductor); fuera de España la regla es la misma, pero en Alemania el seguimiento de empleados pasa por el comité
  de empresa (Betriebsrat) si lo hay: avisarlo en el contrato con empresas alemanas.

## 8. Google Play

- Ficha en 7 idiomas lista para pegar: `app-android/play-listing/` (título ≤ 30, corta ≤ 80, larga ≤ 4.000). Play
  ofrece además traducción automática gratuita a 29 idiomas (Grow users → Translations) sin revisión humana, y
  traducción profesional de pago; para los 7 nuestros vale lo escrito a mano.
- Capturas por idioma: poner el emulador en el idioma y repetir `docs/capturas-30-10` (hoy, las de inglés).
- Países de distribución: ya está en producción en 178 países (2.3.0). Falta: precio por país cuando exista Play
  Billing, el formulario de seguridad de datos revisado por país (igual para todos), y la política de privacidad en
  inglés enlazada.
- El nombre «FDS» no significa nada fuera: el título de la ficha lleva «delivery route planner» / «ruta de reparto».

## 9. Datos para el mapa fuera de España (dónde enchufarlos)

El servidor ya tiene el patrón: `_dgt_incidencias()` descarga un DATEX II, `reparto.incidencias_datex` lo lee y
`incidencias_cerca` lo filtra a la ruta; `_dgt_zbe()` hace lo mismo con polígonos (`GET /reparto/mi-ruta/incidencias`
y `/zbe`). Para otro país hace falta: (1) una tabla país → URL(s) y formato, (2) un lector por formato (DATEX II v3
ya está; WZDx es JSON; GeoJSON de ZFE/ULEZ es trivial), (3) que el texto de la fuente diga quién es («DGT» hoy fijo
en pantalla: pasarlo a `fuente` en la respuesta, ya viene en el JSON). Por orden de valor y facilidad:

| País | Cortes y obras | Zonas | Coste / acceso |
|---|---|---|---|
| Francia | Bison Futé DATEX II (red nacional no concesionada; tiempo real) | BNZFE (base nacional ZFE, GeoJSON/CSV) | gratis, sin login |
| Reino Unido | National Highways DATEX II (cortes planificados e imprevistos) | ULEZ/LEZ GeoJSON (London Datastore / ArcGIS GLA) | gratis con clave; 10 llamadas/min |
| Países Bajos | NDW open data DATEX II | milieuzones (OSM) | gratis |
| EE. UU. | WZDx (40 feeds; obras) y 511 por estado | — | gratis; clave por estado |
| Alemania | Mobilithek DATEX II (Länder) | UBA GeoPackage de Umweltzonen; OSM | gratis con registro; condiciones por oferta |
| Argentina | BA Data «Tránsito» (cortes) | — | credenciales a pedir |
| Italia, Portugal, México, Colombia, Chile, Brasil | nada nacional verificado | ciudad a ciudad (Milán, Lisboa, CDMX…) | — |
| Todos | — | carga y descarga de OSM (ya en FDS) | gratis |

Las **restricciones por placa** (Hoy No Circula, pico y placa, restricción vehicular, rodízio) no son un feed:
son reglas publicadas (dígito, horario, fechas, excepciones). Lo honesto es un aviso en la app con la regla de la
ciudad y el enlace oficial, pidiendo la placa al repartidor para decirle «hoy no circulas de 7 a 10», y revisar las
reglas cada temporada. Es la tanda B.

## 10. Normas de circulación que importan al reparto (resumen con fuente)

| Dónde | Qué | Qué debería hacer FDS |
|---|---|---|
| UE (todos) | furgones ≤ 3,5 t en reparto nacional: sin tacógrafo; > 2,5 t en internacional/cabotaje: tacógrafo inteligente 2 desde el 1-7-2026 | nada para el reparto urbano |
| GB | ≤ 3,5 t: 10 h de conducción y 11 h de servicio por día (reglas domésticas) | aviso opcional de jornada (FDS ya mide la jornada) |
| EE. UU. | FMCSA desde 10.001 lb; exención de reparto minorista local (100 millas aéreas) | nada para furgonetas ligeras |
| Francia (Gran París) | ZFE Crit'Air 3-5 y sin clasificar, L–V 8–20 h; sin multas a Crit'Air 3 en 2026; 135 € a utilitarios cuando empiecen | polígonos de la BNZFE en el mapa + pedir la pegatina en el alta |
| Alemania | Umweltzonen con pegatina verde (35 zonas) | polígonos del UBA en el mapa |
| Milán | Area B L–V 7:30–19:30, diésel viejos fuera; comerciales > 12 m siempre fuera | solo si hay dato oficial por ciudad |
| Londres | ULEZ en todo el Gran Londres; LEZ para pesados; CAZ en otras ciudades | polígonos del London Datastore |
| Lisboa | ZER L–V 7–21 h por año de matrícula; eléctricos exentos | sin dato abierto verificado: enlace oficial |
| CDMX | Hoy No Circula 5–22 h; carga exenta en el programa ordinario según prensa; en contingencia 6–10 h; foráneas restringidas | aviso con la regla oficial (CAMe) y la placa |
| Bogotá | carga > 20 años: L–V 6–8 y 17–20 h; sábados 5–21 h por dígito | aviso por antigüedad y placa |
| Santiago | mayo–agosto, L–V 7:30–21 h; sin sello verde fuera del anillo; carga sin sello 10–18 h | aviso por sello y dígito |
| São Paulo | ZMRC L–V 5–21 h y sáb. 10–14 h; rodízio de camiones 7–10 y 17–20 h; VUC: contradicción entre fuentes | aviso solo tras confirmar con la CET |

## 11. Qué hacer ahora (tandas, con esfuerzo estimado)

- **Tanda A (hecha hoy)**: idioma de la nativa, moneda del plan, millas, Stripe en el idioma del cliente, ficha de
  Play en 7 idiomas, este informe.
- **Tanda B — datos por país (2–3 días)**: Francia (Bison Futé + BNZFE), Reino Unido (National Highways + ULEZ),
  Países Bajos (NDW) y EE. UU. (WZDx) en `_incidencias_pais` con la `fuente` en pantalla; restricciones por placa de
  CDMX, Bogotá, Santiago y São Paulo como aviso con enlace oficial y placa del repartidor (reglas en una tabla
  revisable, con fecha de revisión).
- **Tanda C — cobrar (Dani + gestor, 1 día de código)**: `currency_options` en los dos Price de Stripe; Stripe Tax;
  decidir los precios de §5 en el panel de negocio; Play Billing en la nativa (tarjeta «Tanda 1») y precios por país
  en Play Console; trámite del SAT antes de vender en México; OSS cuando se pasen los 10.000 € en la UE.
- **Tanda D — legal (traductor jurídico)**: política de privacidad, términos y cookies en inglés primero (sirve
  para EE. UU., Reino Unido, Irlanda y como respaldo), luego fr/de/it/pt; aviso LGPD para Brasil.
- **Tanda E — pantallas que faltan (1–2 días)**: las plantillas de las pantallas del conductor de empresa en la
  nativa; `Planes.jsx` y `Registro.jsx` (empresas) siguen en español y en euros: solo hace falta si se vende a
  empresas fuera; «efectivo» primero en Latinoamérica; pedir el NIF-IVA/VAT en el alta de empresa de la UE.
- **Tanda F — marketing por país**: capturas por idioma, landing por país (la portada ya está en 6 idiomas), anuncios
  (`PLAN-1000.md` ya apunta a Latinoamérica por coste de clic).

## 12. Lo no verificado y los límites

- Las normas de circulación (§4, §10) vienen de portales oficiales (bogota.gov.co, prefeitura.sp.gov.br, Diario
  Oficial de Chile) y de prensa; en varios casos las fuentes se contradicen (horarios de Crit'Air 4-5, VUC en São
  Paulo, calendario de Santiago, carga en CDMX) y así se dice. Antes de avisar de una regla en la app hay que leer la
  norma vigente.
- Los precios por moneda son una propuesta; las equivalencias en euros son aproximadas.
- Los feeds extranjeros se han localizado, no conectado ni probado.
- Los umbrales fiscales (OSS, sales tax, SAT) salen de guías de Stripe, asesorías y prensa fiscal, no del texto legal;
  los confirma el gestor.
- La nativa se ha probado en inglés en el emulador (capturas); no en francés, alemán, italiano ni portugués (las
  traducciones son las mismas de la web, que sí se usan; las propias de la nativa las he escrito yo, sin revisor nativo).
- Nada desplegado ni subido a Play.

## Fuentes (leídas el 30-10-2026)

- Francia ZFE: [Base nationale consolidée des ZFE (data.gouv.fr)](https://www.data.gouv.fr/datasets/base-nationale-consolidee-des-zones-a-faibles-emissions),
  [ZFE Rennes Métropole (transport.data.gouv.fr)](https://transport.data.gouv.fr/datasets/zone-a-faibles-emissions-mobilite-zfe-m-de-rennes-metropole?locale=en),
  [Discusión sobre el perímetro de París](https://www.data.gouv.fr/datasets/zone-a-faibles-emissions-zfe/discussions),
  [Crit'Air 2026 por ciudad](https://www.toutsurmesfinances.com/argent/a/regles-de-la-vignette-critair-restrictions-et-amendes-par-ville),
  [ZFE Grand Paris: sin sanciones en 2026 (L'argus)](https://www.largus.fr/actualite-automobile/zfe-a-paris-toujours-pas-de-verbalisation-en-2026-30044944.html),
  [ZFE Grand Paris para empresas](https://hayot-expertise.fr/blog/zfe-metropole-grand-paris-2026-flotte-entreprise).
- Francia cortes: [Événements routiers sur le RRN non concédé (data.gouv.fr)](https://www.data.gouv.fr/datasets/62558686864eeafd3af07eac),
  [Bison Futé, datos sobre la RRN](https://www.bison-fute.gouv.fr/donnees-sur-le-rrn.html),
  [Bison Futé, punto de acceso nacional](https://www.bison-fute.gouv.fr/imprimer,article10589.html).
- Alemania: [OSM wiki Umweltzone](https://wiki.openstreetmap.org/wiki/Umweltzone), [UBA Umweltzonen](https://umweltbundesamt.de/print/3251),
  [Geodatenkatalog: umweltzonen_de](https://gdk.gdi-de.org/geonetwork/srv/api/records/56718d24-4087-4b8f-9340-8186721eec9a),
  [UBA vs OSM (mapatlas)](https://mapatlas.eu/de/blog/low-emission-zones-europe-openstreetmap),
  [Mobilithek: Baustelleninfo RLP](https://baustelleninfo.rlp.de/fileadmin/baustelleninfo/Dateien/Die_Infoveranstaltung/Workshop_2.pdf),
  [Sachsen Baustellen en Mobilithek](https://www.medienservice.sachsen.de/medien/news/1094935/download_pdf),
  [Abstellgenehmigung (ZDF)](https://www.zdfheute.de/panorama/post-pakete-ablage-urteil-100.html), [Trusted Shops](https://www.trustedshops.de/blog/paket-einfach-vor-die-tuer-gelegt-was-darf-der-paketdienst),
  [paketda](https://www.paketda.de/paket-abstellerlaubnis.php), [utopia](https://utopia.de/ratgeber/pakete-vor-haustuer-ablegen-wer-haftet-abstellgenehmigung_542794/).
- Paquete de movilidad: [Seety](https://seety.co/blog/july-1-2026-tachograph-deadline-for-vans), [RSA Irlanda](https://www.rsa.ie/services/professional-drivers/tachographs-information/smart-tachograph-2-(lcvs)),
  [BVRLA](https://bvrla.co.uk/home/support/guidance/tachograph-requirements-for-vans-–-what-bvrla-members-need-to-know).
- Italia: [Area B 2026 (Al Volante)](https://www.alvolante.it/da_sapere/legge-e-burocrazia/area-b-milano-mappa-limitazioni-e-ingressi-regole-379956),
  [ZTL Milano guida (Autovia)](https://www.autovia.it/ztl-milano-guida-completa/), [MilanoFree](https://www.milanofree.it/milano/trasporti/ztl-milano-2026-guida-ad-area-b-e-area-c-orari-prezzi-e-divieti.html).
- Reino Unido: [National Highways developer portal FAQ](https://developer.data.nationalhighways.co.uk/faq),
  [NTIS DATEX II (datex2.eu)](https://repo.datex2.eu/implementations/nodes_directory/national-traffic-information-service-england-datex-ii-service),
  [Traffic England services](https://www.trafficengland.com/services-info),
  [ULEZ expansión (London Datastore)](https://data.london.gov.uk/dataset/ultra_low_emissions_zone_expansion_new),
  [ULEZ 2023 (London Datastore)](https://data.london.gov.uk/dataset/london-wide-ultra-low-emission-zone-expansion-2023-296nj),
  [GLA ArcGIS LEZ](https://gis.london.gov.uk/arcgis/rest/services/apps/Air_Quality_map_service_01/MapServer/6),
  [TfL Tech Forum: no hay API de pertenencia](https://techforum.tfl.gov.uk/t/ulez-and-congestion-charge-zone/2728),
  [GB domestic rules (gov.uk)](https://www.gov.uk/drivers-hours/gb-domestic-rules), [DfT respuesta 10 h/11 h](https://www.judiciary.uk/wp-content/uploads/2022/05/2022-0151-Response-from-Department-for-Transport.pdf).
- Países Bajos: [NDW our data](https://english.ndw.nu/our-data), [docs.ndw.nu](https://docs.ndw.nu/en/dataformaten/).
- Portugal: [ZER Lisboa 2026 (Caetano)](https://caetano.pt/blog/zer-lisboa/), [Baixa só residentes (Postal)](https://postal.pt/nacional/transito-na-baixa-de-lisboa-so-para-residentes-e-portadores-de-distico-mapa/),
  [Obras na Baixa (Idealista)](https://www.idealista.pt/news/node/57573).
- EE. UU.: [WZDx 40 feeds (Volpe)](https://www.volpe.dot.gov/news/enhanced-work-zone-data-exchange-program-improves-roadway-safety),
  [WZDx Feed Registry](https://data.amerigeoss.org/dataset/work-zone-data-exchange-wzdx-feed-registry), [DOT WZDx](https://www.transportation.gov/av/data/wzdx),
  [511WI API](https://511wi.gov/developers/doc), [511NY (jentic)](https://jentic.com/apis/511ny), [NV roads API](https://www.nvroads.com/developers/doc),
  [511 SF Bay open data](https://511.org/open-data), [FMCSA exención reparto minorista](https://www.fmcsa.dot.gov/regulations/hours-service/exemption-contained-ss3951f-concerning-department-store-deliveries-during),
  [J.J. Keller 150 air-mile](https://jjkellercompliancenetwork.com/institute/150-air-mile-exception), [BigRoad HOS](https://bigroad.com/safety-corner/do-hours-of-service-regulations-apply-to-my-fleet/),
  [UPS fotos de entrega (parcelpath)](https://parcelpath.com/shipping-companies/ups/does-ups-take-pictures-of-delivery/), [Amazon foto del porche (iMore)](https://imore.com/amazon-may-now-take-photo-your-front-door-proof-delivery),
  [Stripe sales tax definitions](https://stripe.com/guides/sales-tax-definitions), [Stripe Tax](https://stripe.com/gb/Tax), [Stripe SaaS por estado](https://stripe.com/resources/more/what-sales-are-subject-to-tax),
  [CCPA umbrales 2026 (Jackson Lewis)](https://www.jacksonlewis.com/insights/navigating-california-consumer-privacy-act-30-essential-faqs-covered-businesses-including-clarifying-regulations-effective-1126),
  [CCPA umbrales (Clym)](https://www.clym.io/blog/ccpa-applicability-guide).
- Pagos: [Stripe manual currency prices (Checkout)](https://docs.stripe.com/payments/checkout/manual-currency-prices), [Stripe adaptive pricing](https://docs.stripe.com/payments/custom/localize-prices/adaptive-pricing),
  [Play: set up your app's prices](https://support.google.com/googleplay/android-developer/answer/6334373?hl=en), [Play: traducción de la ficha](https://support.google.com/googleplay/android-developer/answer/9844778?hl=en),
  [Zeo pricing (Capterra)](https://www.capterra.com/p/208151/Zeo-Route-Planner/pricing/), [Zeo pricing (Upper)](https://www.upperinc.com/blog/zeo-route-planner-pricing/), [Routific pricing (CostBench)](https://costbench.com/software/last-mile-delivery/routific/).
- Impuestos: [EU VAT guide 2026 (Kintsugi)](https://trykintsugi.com/sales-tax-guides/europe/european-union), [OSS/IOSS 2026 (Taxually)](https://www.taxually.com/blog/eu-vat-oss-ioss-distance-selling-2026),
  [hellotax: ventas digitales](https://helpdesk.hellotax.com/hc/en-150/articles/37994882719121), [SAT México: lista de proveedores (Sovos)](https://sovos.com/mx/cambios-regulatorios/iva/autoridad-fiscal-de-mexico-publica-lista-de-proveedores-extranjeros-de-servicios-digitales/),
  [VAT IT México](https://vatit.com/es/country-guide/mexico/), [IMCP noticias fiscales 2026](https://imcp.org.mx/wp-content/uploads/2026/05/NOTICIAS-FISCALES-2026-104-22-05-2026.pdf).
- Latinoamérica: [Hoy No Circula (adn40)](https://www.adn40.mx/hoy-no-circula), [Doble Hoy No Circula dic. 2025 (Publimetro)](https://www.publimetro.com.mx/noticias/2025/12/26/hoy-no-circula-viernes-26-de-diciembre-habra-doble-hoy-no-circula-en-cdmx-y-edomex/),
  [Pico y placa carga sept. 2026 (bogota.gov.co)](https://bogota.gov.co/mi-ciudad/movilidad/pico-y-placa-para-vehiculos-de-carga-bogota-1-al-30-septiembre-2026), [junio 2026](https://bogota.gov.co/mi-ciudad/movilidad/pico-y-placa-bogota-vehiculos-de-carga-1-30-de-junio-de-2026),
  [Restricción vehicular 2026 (El Dínamo)](https://www.eldinamo.cl/pais/2026/05/04/restriccion-vehicular-2026-conoce-el-calendario-los-horarios-y-las-multas/), [Resolución 1.698 (Diario Oficial de Chile)](https://www.diariooficial.interior.gob.cl/publicaciones/2026/04/30/44438/01/2805129.pdf),
  [BA Data APIs](https://buenosaires.gob.ar/datosabiertos/apis), [Taller API transporte GCBA](https://github.com/datosgcba/taller-api-transporte),
  [ZMRC y VUC (Prefeitura SP, 2020)](https://prefeitura.sp.gov.br/w/noticia/caminhoes-nao-estao-incluidos-no-rodizio-emergencial-em-sao-paulo), [Rodízio de caminhões (Zapay)](https://blog.usezapay.com.br/rodizio-sp/rodizio-de-caminhoes-em-sp),
  [Pago contra entrega México (Forbes/AMVO)](https://forbes.com.mx/?p=444185), [InformaBTL métodos de pago 2024](https://www.informabtl.com/ecommerce-cuales-son-los-metodos-de-pago-favoritos-de-los-mexicanos-en-2024/),
  [LGPD empresas estrangeiras (Barbieri)](https://www.barbieriadvogados.com/lgpd-para-empresas-estrangeiras/), [Resolução ANPD 2/2022 (MobileTime)](https://www.mobiletime.com.br/noticias/28/01/2022/resolucao-da-anpd-flexibiliza-lgpd-para-pequenas-empresas/).
