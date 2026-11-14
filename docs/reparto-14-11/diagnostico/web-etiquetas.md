# El escáner de etiquetas y la carga de la furgoneta en la web (primer uso)

Mirado como Iván: autónomo, 80-120 bultos de MRW, SEUR, GLS, Correos Express, CTT o DHL según el día, sin lista, viene de Circuit.
Fecha: 14-11-2026. Repo: `C:/Users/dlvie/foefa-p0` (solo lectura, la web ya compilada en `frontend/dist`).

Carpeta de trabajo (todo lo de aquí sale de ella):
`C:/Users/dlvie/AppData/Local/Temp/claude/34f2eefc27d3445b/9022e766-4683-4c72-a196-f839ddac5172/scratchpad/reparto/diag/web-etiquetas`
(abajo la llamo `<carpeta>`).

## En pocas palabras

- **Leer el código funciona bien.** La cámara de mentira de Chromium enseñó 15 etiquetas distintas y la web leyó el código de las
  15 a la primera, en 1,6-1,8 s contando desde que se toca «Escanear», también la torcida y las de poca luz.
- **Las etiquetas que traen la dirección dentro del código 2D (SEUR/DPD con Aztec, GLS con DataMatrix, GS1) entran solas y bien:**
  5 de 5, con calle, número, nombre y teléfono, y sin tocar nada. Esto es «como Circuit».
- **Las que solo llevan código de barras (MRW, Correos Express, CTT, Correos, DHL, Nacex, UPS) nunca entran solas.** La dirección sale de
  leer el texto de la foto, y cada paquete pide una hoja con su casilla de «Revisa lo leído» y «Añadir a mi ruta»: 3 toques y unos 5-6 s
  de máquina más lo que tarde Iván en leer la hoja. El propio código dice que esas agencias no publican qué llevan sus códigos.
- **El fallo grave: cuando la etiqueta trae el REMITENTE arriba, la app se queda con la dirección del remitente.** En la prueba,
  un paquete para A Coruña entró como «Calle de Alcalá 200, 28028 Madrid», con un ✓ verde de «En el mapa», y la ruta ordenada pasó
  a 699,8 km con hora de fin 04:09. Por el botón de foto pasa incluso con el remitente en una sola línea pequeña.
- **Respuesta sin rodeos: tal como está, el escáner NO aguanta una mañana de 100 bultos de agencias que solo traen código de barras.**
  Sí la aguantaría si todos fueran SEUR o GLS con la dirección en el 2D (y eso, con códigos fabricados por nosotros, no con etiquetas
  reales de esas agencias).

## Qué he hecho y cómo repetirlo

1. **Servidor y web.** El servidor real de FDS con la base en memoria y el buscador de direcciones de verdad por Internet:
   `python -X utf8 <reparto>/servidor_reparto.py C:/Users/dlvie/foefa-p0 8802 <carpeta>/servidor` y la web compilada con
   `API_DEV_URL=http://127.0.0.1:8802 npx vite preview --port 4462 --strictPort` (desde `foefa-p0/frontend`). Ojo: vite escucha en
   `localhost` (IPv6), no en `127.0.0.1`. Al acabar los paré por su PID (`netstat -ano`, `taskkill`).
2. **El móvil.** Playwright de `foefa-p0/frontend/node_modules`, Chromium con pantalla de 390x844, toque, español, Android en el
   agente de usuario, geolocalización en A Coruña (43.3623, -8.4115) y la cámara concedida. Chromium de escritorio no trae el lector
   de códigos del navegador (`barcodeDetectorNativo: false` en `resultados.jsonl`), así que se usó el lector propio de la web (zxing en
   WebAssembly), **el mismo que usan el iPhone y los navegadores sin lector**. El de Chrome en Android no lo he podido probar aquí.
3. **Altas nuevas** por la pantalla de registro (`explora.mjs`): «Iván» (`ivan.prueba@fds.test`), «Iván Dos» y «Iván Tres»
   (`@fds.test`, solo en el servidor local).
4. **Las etiquetas** (`gen/`): `gen/codigos.mjs` fabrica los códigos con zxing (el mismo motor que la web, formatos como
   `app-android/pruebas/generar-etiquetas.mjs`: Aztec Geopost de SEUR/DPD, DataMatrix «A|…» de GLS, GS1, Code128).
   `gen/etiquetas.py` compone 15 etiquetas de 10x15 cm con datos INVENTADOS (personas y teléfonos inventados, calles reales de
   A Coruña para que el buscador las encuentre), las pega en una caja de cartón, les pone algo de desenfoque y ruido, y las convierte en
   vídeo `.y4m` de 1080x1920 para `--use-file-for-fake-video-capture`. `python etiquetas.py secuencia` hace el vídeo de las 15 seguidas
   (3 s cada una y 1 s de caja vacía; lo borré al acabar porque ocupaba 373 MB).
   Las imágenes que «vio» la cámara: `gen/etiquetas/E01-camara.jpg` … `E15-camara.jpg`.
5. **Escaneo de una en una** con el botón de siempre (`escanea_una.mjs E04`): un Chromium nuevo con el vídeo de esa etiqueta, toca
   «Escanear paquetes», mide cuándo se cierra la cámara (código leído) y cuándo está la parada dentro o la hoja rellena, y guarda lo
   que quedó en el servidor. Resultados: `resultados.jsonl`; capturas `capturas/esc-Exx-*.png`.
6. **Escanear seguidos** con las 15 pasando por delante (`seguidos.mjs`): el camino de la bienvenida hasta la cámara continua, lo que
   cuenta mientras escanea, «Listo» y la revisión de los que no entraron solos. `seguidos.log`, capturas `capturas/seg-*.png`.
7. **Carga guiada con 30 paradas** (`carga.mjs`): las 15 escaneadas más 15 añadidas por la API local, «Ordenar ruta» y «Cargar»
   escaneando con la cámara. `carga.log`, capturas `capturas/carga-*.png`.
8. **El botón «Primer paquete»** (foto con la cámara del sistema; aquí, un fichero): `primer_paquete.mjs`, capturas `capturas/foto-*.png`.
9. **La regla sin OCR por medio** (`remitente.mjs` → `remitente.txt`): el texto de la etiqueta escrito a mano, pasado por
   `interpretaTicket` del repo, para separar lo que es fallo del OCR de lo que es fallo de la regla.
10. **Lo de dentro**, leído: `frontend/e2e/escaneo-real.spec.js`, el plugin `ocrLocal` de `frontend/vite.config.js`,
    `frontend/src/lib/codigos.js`, `codigoEtiqueta.js`, `leerTicket.js`, `interpretaEtiqueta.js`, `MiRuta.jsx` (escáner, `buscar`,
    escanear seguidos), `CargaGuiada.jsx`, `backend/server.py` (`/reparto/escanear/lote`, el hueco al ordenar), `backend/reparto.py`
    (`hueco_sugerido`), y el lector nativo `app-android/.../etiqueta/LectorEtiqueta.kt`, `TextoDelCodigo.kt` y sus pruebas. Pasé
    `node scripts/check-leer-etiqueta.mjs` («ok — 23 etiquetas de 13 países y 7 etiquetas por sus códigos») y
    `node scripts/check-escaneo-2d.mjs` («los 10 casos bien»). Las pruebas de Android (gradle) no las he ejecutado.

Límites de la prueba, para no engañar: las etiquetas son limpias (letra de ordenador, sin arrugas, sin cinta encima, sin reflejos), el
OCR corrió en un PC (más rápido que un móvil) y la cámara es un vídeo, no una mano que se mueve. **Los 2D de SEUR y GLS están hechos
por nosotros según lo que publican esas empresas; no son etiquetas reales** (`codigoEtiqueta.js:18-19`: «no se ha probado con etiquetas
reales de cada empresa»).

## Cómo funciona el escáner por dentro

- **Lee códigos, no letras, en directo.** La cámara mira cada 250 ms con el lector de códigos (el de Chrome en Android; si no hay, zxing
  en WebAssembly servido desde la propia web: `frontend/src/lib/codigos.js`). Formatos: Code128, EAN, QR, Code39, ITF, UPC, DataMatrix,
  Codabar, PDF417 y Aztec (`codigos.js`, `FORMATOS`). Al leer uno espera medio segundo más por si la etiqueta trae otro código y guarda
  el fotograma (`MiRuta.jsx`, `Escaner`).
- **Qué hace con lo leído** (`codigoEtiqueta.js`, `datosDeCodigos`): si un 2D trae la dirección (GS1 «Scan4Transport», Aztec de
  SEUR/DPD, DataMatrix de GLS, ANSI de UPS/FedEx, o trozos separados por «|»), la parada se crea al momento. Si solo hay número, se lee
  el TEXTO del fotograma con tesseract (OCR en el móvil, tres pasadas: `leerTicket.js:86`), se rellena una hoja y el repartidor la
  revisa y guarda.
- **UPS:** su MaxiCode no se lee en una etiqueta real (`codigoEtiqueta.js:31`); de UPS se lee la barra 1Z y la dirección sale de la foto.
- **MRW, Nacex, CTT, Correos Express:** «no publican qué llevan sus códigos» (`codigoEtiqueta.js:34`). En la práctica: foto y OCR.
- **El OCR se sirve desde la web** (plugin `ocrLocal` de `vite.config.js`): la primera vez baja unos 6 MB (`dist/ocr/t7-spa4-1/`:
  núcleo 3,9 MB + español 2,1 MB + lector 0,1 MB); el lector de códigos, 1,1 MB más.
- **La app nativa** hace lo mismo con ML Kit (códigos y texto) y las MISMAS reglas pasadas a Kotlin (`LectorEtiqueta.kt`, cabecera);
  `TextoDelCodigo.kt` arregla los 2D impresos en Latin-1. En ninguna de las dos hay nada que separe remitente de destinatario
  (`grep -i remit` en `LectorEtiqueta.kt`, en sus pruebas y en `check-leer-etiqueta.mjs`: cero resultados; en `interpretaEtiqueta.js`
  solo aparece «destinatario» para sacar el nombre, línea 45).

## La tabla: etiqueta → qué leyó → bien o mal → segundos

Botón «Escanear» de siempre, una etiqueta cada vez, cuenta recién creada. «Código» = segundos desde el toque hasta que la cámara lee el
código (incluye encender la cámara). «Listo» = hasta que la parada está dentro o la hoja rellena. «Con guardar» = tras marcar la casilla y
«Añadir a mi ruta». Prueba: `resultados.jsonl` y `capturas/esc-Exx-*.png`.

| Etiqueta | Qué leyó (lo que quedó guardado) | ¿Bien? | Código | Listo | Con guardar | Toques |
|---|---|---|---|---|---|---|
| E01 SEUR (Aztec) | Ana Prieto Souto · Rúa Sinfónica de Galicia 8, 3º A, 15004 A Coruña · 611111101 | Bien, entra sola | 1,6 | 1,6 | — | 1 |
| E02 GLS (DataMatrix) | Bar O Peto · Rúa Marcial del Adalid 5, A Coruña · 611111103 (sin CP: GLS no lo pone en ese código) | Bien, entra sola | 1,7 | 1,7 | — | 1 |
| E03 GS1 | Pedro Lago · Rua San Andres 30, 15003 A Coruna · 611111105 | Bien, entra sola | 1,6 | 1,8 | — | 1 |
| E04 MRW | Marta Rey Castro · **Avenida de Finisterre 120, 29**, 15004 A Coruña · 611111106 | **Mal**: el «2º» lo lee «29» y la parada queda fuera del mapa («No la encuentro») | 1,6 | 3,4 | ~5 | 3 |
| E05 Correos Express | Juan Pérez Mosquera · Rúa Real 25, **1\*D**, 15003 A Coruña · 611111107 | Casi: piso mal escrito, pero en el mapa | 1,6 | 3,1 | ~6 | 3 |
| E06 CTT | Sara Bouzas · Rúa Juana de Vega 14, 15004 A Coruña · 611111108 | Bien | 1,6 | 3,2 | 6,3 | 3 |
| E07 DHL | Iker Fernández · Ronda de Outeiro 200, 15010 A Coruña · 611111109 | Bien (mapa: «calle encontrada, sin el portal») | 1,6 | 3,2 | 6,3 | 3 |
| E08 Correos | Rosa Díaz Neira · Rúa Barcelona 50, 15010 A Coruña · 611111110 | Bien | 1,6 | 3,2 | 6,5 | 3 |
| E09 Nacex | Xoán Castro · Avenida de Oza 100, 15006 A Coruña · 611111111 | Bien | 1,7 | 3,4 | 6,6 | 3 |
| E10 UPS (barra 1Z) | Nuria Ares · Praza de Pontevedra 5, 15003 A Coruña · 611111112 | Bien | 1,6 | 2,9 | 6,1 | 3 |
| E11 MRW torcida 15º | (sin nombre) · **Rua Ramón y caja 20**, 15006 A coruña · (sin teléfono) | A medias: en el mapa, pero pierde nombre y teléfono | 1,6 | 2,7 | 5,9 | 3 |
| E12 Correos Express, poca luz | Brais Otero · Rúa do Orzán 80, 15003 A Coruña · 611111114 | Bien | 1,7 | 4,2 | 7,4 | 3 |
| E13 MRW, remitente arriba | Lucía Villar · **Calle de Alcalá 200, 28028 Madrid · 910000000** (todo del remitente menos el nombre) | **Mal, y grave**: ✓ «En el mapa» en Madrid | 1,7 | 3,4 | 6,6 | 3 |
| E14 SEUR torcida y con poca luz | Luis Varela · Rúa Emilia Pardo Bazán 14, 15005 A Coruña · 611111102 | Bien, entra sola | 1,7 | 1,7 | — | 1 |
| E15 GLS (calle sin «Rúa») | Carmen Iglesias · Ronda de Nelle 50, A Coruña · 611111104 | Bien, entra sola | 1,7 | 2,1 | — | 1 |

Cuenta: **código leído a la primera 15 de 15. Dirección buena del todo 11 de 15; aprovechable 12 de 15; mal 3 de 15 (una de ellas, en
otra ciudad).** De las 10 que solo traen código de barras: 6 bien, 1 casi, 3 mal. Repetido en el modo «Escanear seguidos» con el mismo
vídeo, el resultado fue el mismo (E11 salió aún peor: «RUa Ramón N caa 20»; `seguidos.log`).

## Lo encontrado, de más a menos grave

### 1. Se queda con la dirección del remitente (grave)
- **Qué pasa:** con el remitente en bloque encima del destinatario (E13), la parada se guarda en «Calle de Alcalá 200, 28028 Madrid» con
  el nombre del destinatario y el teléfono del remitente, y la hoja dice ✓ «En el mapa» en verde. No avisa de que está a 600 km de donde
  está Iván. Captura `capturas/esc-E13-3-hoja.png`.
- **Y luego:** al ordenar la ruta de 30 paradas, esa parada va la 30 y la ruta pasa a «Acabas ≈ 04:09 · 699,8 km» (`carga.log`:
  `RUTA: {"km":699.8,"min":2253,"fin":"04:09"}`; captura `capturas/carga-03-ordenada.png`).
- **No es solo el OCR, es la regla:** con el texto escrito limpio, `interpretaTicket` da la dirección del remitente también cuando
  el remitente va en UNA línea («Remite: Moda Inventada SL · C/ Alcalá 200 · 28028 Madrid» → dirección = esa línea entera, CP 28028,
  Madrid). Solo acierta si el destinatario va primero. Prueba: `remitente.txt`. En la prueba con cámara, las etiquetas con el remitente en
  una línea pequeña salieron bien porque el OCR leyó esa línea a trozos; con el botón de foto (imagen más nítida) la de DHL (E07) salió
  «Remite: Deportes Prueba SL - C/ Aragón 300 - 08009 Barcelona, 15010, A Coruña» (`capturas/foto-E07.png`). Es decir: cuanto mejor lee
  el OCR, más fácil que se equivoque de dirección.
- **Por qué importa:** casi todas las etiquetas de paquetería llevan el remitente. Un paquete en la ciudad equivocada estropea la ruta
  entera y Iván se entera en la calle.

### 2. Las agencias de solo código de barras nunca entran solas (frena, y mucho)
- MRW, Correos Express, CTT, Correos, DHL, Nacex y UPS: 10 de las 15 etiquetas. Ninguna entró sola. Con el botón «Escanear», cada una
  abre una hoja «El código … no está en la lista» con la dirección leída, una casilla «Revisa lo leído del ticket antes de guardar»
  obligatoria y «Añadir a mi ruta»: **3 toques por paquete** y 6-7 s de máquina en un PC (`resultados.jsonl`, `sTotalConGuardar`).
- Con «Escanear seguidos» la cámara no se para, pero esos paquetes se apilan como «Revisar 10 paquetes sin dirección»
  (`capturas/seg-12-listo.png`), y después hay que abrirlos uno a uno: 3 toques y 5-6 s cada uno (`seguidos.log`). Y el texto miente:
  sí tienen dirección, en la etiqueta.
- El servidor lo hace a propósito: en el lote solo crea lo que trae la dirección completa en el código; el resto vuelve «revisar»
  (`backend/server.py`, `reparto_escanear_lote`, la docstring «Solo crea sin preguntar a Photon las direcciones que ya llegaron completas»).

### 3. El piso («2º», «1º D») se lee mal y ensucia la dirección (frena)
- «Avenida de Finisterre 120, 2º» → «… 120, 29»: el buscador ya no la encuentra y la parada queda sin punto
  (`capturas/esc-E04-4-guardada.png`: «No la encuentro: elige una sugerencia o …»). «Rúa Real 25, 1º D» → «1\*D», «19D», «19 D».
- La hoja de revisión se llena: 4 sugerencias del mapa + 3 lecturas del OCR + la casilla, siete versiones de la misma calle
  (`capturas/seg-15-revisar-2.png`). A las 7 de la mañana, con una mano, eso no se lee en 2 segundos.
- Casi todas las direcciones de ciudad llevan piso.

### 4. El modo bueno está escondido (frena)
- El botón grande «Escanear» escanea UN paquete y cierra la cámara. Para el siguiente, otro toque («Escanear otro» o el icono de arriba).
- La cámara continua («Escanear seguidos») es el botón secundario, con borde, dentro de «Cargar paquetes»; el principal de esa hoja es
  «Primer paquete», que abre la cámara del sistema para hacer una FOTO (`capturas/seg-04-cargar-paquetes-hoja.png`,
  `MiRuta.jsx` alrededor de la línea 2061).
- Toques desde que acaba el alta hasta tener la cámara: 4 al escáner de uno en uno («Empezar mi ruta», «Ahora no, seguir en la web»,
  cerrar la bienvenida, «Escanear») y 5 a la cámara continua por el camino de la bienvenida («Sí, cargarlas ahora» → «Etiquetas en los
  paquetes» → «Escanear seguidos») (`seguidos.log`: «toques hasta la cámara: 4» desde la pantalla de instalar). Capturas
  `c-06-tras-alta.png`, `d-01-inicio.png`, `e-02-web.png`, `seg-03-tras-si.png`.
- Lo bueno: «Escanear» se ve a la primera, grande y verde, en «Carga tus paradas de hoy» (`capturas/e-02-web.png`).

### 5. Con el botón de foto se guarda un código que no es el del paquete (frena; grave si usa la foto)
- «Primer paquete» / «Foto etiqueta» lee la foto con OCR y, si el OCR encuentra algo con pinta de código, **ese gana al código de
  barras**: `MiRuta.jsx:768` `if (codigoFoto && !data.codigo) data.codigo = codigoFoto`.
- En la prueba, las dos etiquetas quedaron con el código «4471-ABC» (la referencia del pedido impresa en la etiqueta), no con su código
  de barras; la segunda la rechazó el servidor: «Ese código ya está en los pedidos de ese día» (`capturas/foto-tras.png`). Y al escanear
  luego el código de barras de verdad para cargarla en la furgoneta: `{"encontrado":false,"codigo":"JJD000390007712345678"}`.
- (En mis etiquetas la referencia es la misma en todas; en las reales cambiará, pero el código guardado seguirá sin ser el del bulto.)

### 6. Textos que asustan o despistan (molesta)
- Cada paquete nuevo abre una hoja titulada «El código 0261000123456 no está en la lista» (`capturas/esc-E04-3-hoja.png`). Iván no
  tiene lista: suena a error, y es lo normal en su caso (`MiRuta.jsx:2078`).
- «Revisar 10 paquetes sin dirección» cuando sí la tienen (punto 2).
- Escanear dos veces el mismo paquete (pasa siempre) dice «bulto 2 de 1» y pregunta «¿Dónde lo dejas en la furgoneta?», en vez de
  «ya lo tienes» (`capturas/esc-E04-2-resultado.png`; el contador sube en el servidor con cada escaneo, `server.py`, `$inc escaneos`).

### 7. La pila de «para revisar» solo vive en la memoria de la página (sospecha, no reproducido)
- Los paquetes que no entraron solos, con su foto, se guardan solo en el estado de la pantalla (`MiRuta.jsx:822`, `useState`); no
  están en el servidor (el lote los devuelve como «revisar» sin crearlos) ni en el móvil. Si Android cierra la pestaña mientras Iván
  contesta un WhatsApp, esa pila se pierde y hay que volver a escanear esos paquetes. No lo he provocado; lo digo por el código.

### 8. Después del 31-12, tope de 15 paradas al día en gratis (sospecha de efecto, no reproducido)
- La pantalla de alta lo dice: «Después, gratis hasta 15 paradas al día» (`capturas/b-02-crear.png`). Con 100 bultos, Iván tiene que
  pagar. Y en «Escanear seguidos» lo que pase del tope vuelve como «limite» y la web lo mete en «para revisar» sin decir por qué
  (`MiRuta.jsx:846`, `else revisar.push(...)`). Hoy no se nota porque hasta el 31-12 no hay tope.

### 9. La velocidad en un móvil de verdad (sospecha)
- En el PC el OCR tarda 1,5-2 s por etiqueta (3 pasadas, `leerTicket.js:86`). Frenando el procesador de la página x6 subió a 5-6 s
  (`resultados.jsonl`, `lento: "6"`), pero el OCR corre en un worker que ese freno quizá no alcanza. En un Android de gama media
  calculo 5-15 s por etiqueta de solo barra; no lo he podido medir.

## La carga guiada y encontrar el paquete en la furgoneta

Probado con 30 paradas (`carga.log`, capturas `carga-*.png`):
- **Funciona y se entiende.** Tras «Ordenar ruta» (unos 8 s con el buscador de verdad), cada parada recibe uno de seis huecos
  (delante/medio/detrás × izquierda/derecha): 5 y 5 y 5… exacto (`HUECOS: {"Detrás · izq":5,…}`). El botón «Cargar 0/30» abre
  «Cargar la furgoneta»; al escanear dice en grande «Parada 18 · Marta Rey Castro → Medio · der», lo dice por voz si está activada, y
  la furgoneta dibujada cuenta cuántos van en cada hueco (`capturas/carga-06-carga-camara-1.png`, `carga-09-carga-tras.png`).
  En la cámara continua cargó 7 de 30 en 33 s (8 al pulsar «Listo»), al ritmo del vídeo (unos 4 s por paquete).
- **En la lista de paradas cada fila lleva su hueco** («Detrás · izq»), así que al llegar a la parada se sabe en qué sexto de la
  furgoneta buscar (`capturas/carga-03-ordenada.png`).
- **Lo que no resuelve:** con 100 bultos son unos 17 por hueco (`reparto.py`, `hueco_sugerido`: seis zonas fijas a propósito), sin orden
  dentro del hueco y sin un número que escribir en la caja. Ayuda a acotar, no a encontrar el bulto. No es un adorno, pero tampoco es el
  «busca la caja con el número 18» de otras apps.
- **Cuesta una segunda pasada:** sin lista, Iván tiene que escanear cada paquete DOS veces (una para meterlo en la ruta, otra, ya
  ordenada, para cargarlo). 100 bultos ≈ 5-7 min más.
- Una parada mal leída arrastra el error: la de Madrid recibió hueco «Delante · der» como si nada (`carga.log`, línea `MADRID`).

## ¿Cuántos toques y cuántos minutos para 100 paquetes?

Con lo medido (máquina en un PC; el tiempo de leer de Iván lo pongo aparte y es una estimación):

| Mezcla | Escanear (pasada) | Revisar | Corregir | Total aprox. |
|---|---|---|---|---|
| Todo SEUR/GLS con 2D (si sus etiquetas reales lo traen) | 100 × ~3 s, 0 toques por paquete | 0 | ~0 | **~5 min**, ~5 toques |
| 80 de solo barra + 20 con 2D, modo «Escanear seguidos» | 100 × ~3 s ≈ 5 min | 80 × (5-6 s de máquina + ~8 s de leer la hoja) ≈ 17-19 min, **240 toques** | 3 de cada 10 salieron mal: ~24 × ~30 s ≈ 12 min | **~35 min, ~300 toques** |
| Lo mismo con el botón «Escanear» de uno en uno | 100 × (1 toque + ~3 s) | dentro: 3 toques por cada uno de barra | igual | **~30-40 min, ~280 toques** |

Más 5-7 min de la segunda pasada si quiere la carga guiada. En un móvil real el OCR será más lento (punto 9). Circuit, según el
encargo: apuntar, pitido, siguiente (unos 5 min); no lo he medido.

## Lo que funciona bien y no hay que tocar

- La lectura de códigos: 15/15 a la primera, ~1,6 s desde el toque, torcidas y con poca luz incluidas; también en «Escanear seguidos»
  (la cámara no se cierra, no repite un código ya visto, y el contador de abajo dice lo que va: `capturas/seg-08-camara-3.png`).
- Las etiquetas con la dirección en el 2D (SEUR/DPD, GLS, GS1): entran solas, con calle, número, piso, nombre y teléfono exactos, y un
  aviso claro «Añadida a tu ruta · Ana Prieto Souto — Escanear otro · Corregir» (`capturas/esc-E01-2-resultado.png`).
- El OCR en el propio móvil, sin mandar la foto a nadie, y bastante bueno cuando el destinatario va primero: 6 de 10 perfectas.
- Las pruebas del repo pasan (`check-leer-etiqueta.mjs`, `check-escaneo-2d.mjs`).
- La carga guiada: clara, grande, con voz y contador; el hueco sale en cada fila de la lista.
- El botón «Escanear» se ve a la primera, grande, en la pantalla de una ruta vacía.

## Las tres cosas que yo arreglaría primero y por qué

1. **Que nunca coja el remitente.** Saltar el bloque que empieza por «Remitente», «Remite», «De:», «Sender», «Expedidor», y preferir
   lo que va tras «Destinatario», «Para», «Entregar a»; y, si la dirección leída cae a más de ~50 km de las demás paradas o de donde
   está el móvil, no darla por buena (aviso rojo, no ✓ verde). Es un error silencioso que manda una parada a Madrid y estropea la ruta
   entera; un repartidor que lo sufre una vez no vuelve. Mismo arreglo en `interpretaEtiqueta.js` y en `LectorEtiqueta.kt`.
2. **Que los paquetes de solo código de barras entren solos cuando la lectura es clara.** Si el OCR da calle + número + CP que el
   buscador encuentra en el mapa, cerca del resto, crear la parada sin hoja (como las de 2D, con «Corregir» al lado) y dejar la hoja
   solo para las dudosas. Y arreglar el piso («2º» → «29»): quitarlo antes de buscar en el mapa y guardarlo aparte. Es lo que separa
   35 minutos y 300 toques de 5 minutos: la diferencia entre irse en el minuto dos o quedarse.
3. **Que el escáner continuo sea EL escáner.** El botón grande «Escanear» tiene que abrir la cámara que no se cierra, con su pitido y
   el contador; la revisión, al final y guardada en el servidor (que no se pierda si se cierra la pestaña). Y que el código guardado
   sea siempre el de barras, no un texto leído por OCR (`MiRuta.jsx:768`), o la carga guiada y el «ya está» del segundo escaneo no
   encuentran el paquete.
