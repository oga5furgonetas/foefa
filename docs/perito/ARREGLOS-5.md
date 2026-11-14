# ARREGLOS-5: segunda tanda de DISEÑO y cierre (14-11-2026)

Sale de la tercera revisión, lentes de pantallas: `...\perito\revision3\diseno3\INFORME.md` (13 hallazgos; uno
BLOQUEA: el Inicio del panel), `...\revision3\panel3\INFORME.md` y `...\revision3\publico3\INFORME.md`. Sus fotos, en
la carpeta `fotos\` de cada una. Léelos ENTEROS antes de tocar nada. El dueño: «que no se note que es IA, que sea
bonito, elegante, esté bien conectado y tenga sentido; no cosas básicas». La identidad: sección 3 de
`...\perito\ENCARGO.md` y los bocetos de `...\scratchpad\crecer\identidad\`.

Es oficio: no cambia lo que hace cada pantalla ni lo que manda al servidor. La flota que YA usa el producto cada día
no puede perder ni un dato ni un atajo: cambia cómo se compone, no lo que hay. Cada cambio se mira en foto a 390 y
1280 px, en los tres temas del panel (y día y noche en lo público), ANTES de darlo por bueno.

## Decisiones (tomadas)

### Zona INICIO (`/panel`, lo primero que ve cada cliente cada día) — hallazgo 1 de diseno3, BLOQUEA
I1. La cabecera: la línea de la fecha y la sede, en texto normal de la casa, gris (sin mono, sin mayúsculas
    espaciadas): «sábado, 14 de noviembre · NORTE». El saludo y la frase del día se quedan.
I2. Fuera la rejilla de tarjetas con un icono en un cuadradito. Los MISMOS atajos, en el MISMO orden, con los MISMOS
    enlaces y cifras, pasan a ser una lista compacta con reglas finas (dos columnas en el ordenador, una en el
    móvil): nombre en tinta, su dato debajo o al lado en gris, y a la derecha, en Plex Mono tabular, lo pendiente
    (en el color de aviso de la casa solo si hay algo pendiente; sin insignias amarillas ni cajas). Nada de lo que
    hoy enseña una tarjeta se pierde.
I3. «El día de hoy»: rótulo normal (sin mono espaciado ni punto verde); la barra de avance en tinta (no verde
    menta); las cifras en Plex Mono tabular; el «2 golpes nuevos» LLEVA a algún sitio: al Repaso del día si la
    empresa lo usa (`avisar !== false` en `/repaso/pendientes`) y, si no, a Revisión rápida si la tiene.
I4. El Repaso, que es el producto, está en el Inicio: para la empresa con el módulo «repaso» y `avisar !== false`,
    encima de «El día de hoy», UNA línea con su acción: «Repaso de hoy · 31 de 48 · 2 golpes nuevos» y el botón
    cian «Repasar» (el único cian de la pantalla; con todo repasado, la línea lo dice y el botón va con borde).
    Los números salen de `/repaso/pendientes` (y, si hace falta lo repasado, de lo que ya pide la pantalla; NO
    inventes rutas: si el dato no está, solo «N por repasar»). Para la empresa con `avisar === false`, nada nuevo.
I5. La empresa recién dada de alta (el arranque sin acabar): el Inicio es SOLO el arranque (título, en qué paso va y
    su botón), con una línea tranquila debajo («Cuando llegue la primera revisión, aquí verás tu día.»). Sin lista
    de atajos a cero ni «Todavía no hay flota».
I6. «Salidas de hoy»: la matrícula con la pieza `Matricula` (`frontend/src/components/Matricula.jsx`); el estado
    («sin revisar», «Moderado»…) en texto con su color de la casa, sin pastillas de color pastel; la zona en gris.
I7. Los bloques propios de la flota completa (checklist, cuadrante, lo que haya): mismos datos y enlaces, con la
    misma regla (reglas finas, tinta, mono para cifras, sin cajas de colores ni brillos).

### Zona EXPEDIENTE, ARRANQUE y REPASO
E1. El anexo «Posibles daños que marca la IA» es para el DUEÑO, no para el perito (con la IA activa, unos 75 de
    cada 100 son falsos, y hoy pueden ser 8 de las 15 hojas): en pantalla sigue como está; en PAPEL no sale salvo
    que se marque una casilla junto a «Imprimir»: «Incluir en el papel los posibles daños que marca la IA, sin
    confirmar» (desmarcada por defecto; no se recuerda entre visitas). Con su prueba sobre el PDF real.
E2. El PDF del ejemplo público cabe en dos hojas: cada lado de «Cómo entró / Cómo está hoy» mide siempre lo que su
    celda de la rejilla 2×2, también cuando solo hay un lado; así «Qué prueba este documento y qué no» entra en la
    hoja 2. Sin achicar las fotos de los golpes.
E3. El calendario de 12 meses rotula todos los meses (falta «dic»). El anexo usa un solo formato de fecha, el de
    los golpes.
E4. El ejemplo público es coherente consigo mismo (`frontend/src/lib/expedienteEjemplo.js`): el golpe de la puerta
    corredera (12 NOV) sigue «pendiente de reparar», así que las fotos POSTERIORES de ese lado (13 y 14 NOV y «Cómo
    está hoy») enseñan la puerta con el bollo: usa las fotos de la demo que lo llevan (`van-lateral-golpe-puerta`
    y `van-lateral-golpe-puerta-aleta`, mira qué enseña cada una). No cambies la forma de lo que exporta.
E5. La espera de la primera revisión, en el ordenador: la lista de conductores ARRIBA y las cuatro casillas en una
    fila (unos 215 px cada una), para que en un portátil se vea todo sin bajar; en el móvil, como está. El aviso de
    «sin conexión», junto a «Comprobado hace…». En el paso 1, «Matrícula» no se parte letra a letra a 390 px.
E6. El Repaso en el móvil: la fila de acciones («No se ve bien», «Hay un golpe nuevo», «Está igual · siguiente»)
    queda SIEMPRE a la vista, pegada encima de la barra de abajo (fondo de superficie, regla de 1 px arriba), sin
    tapar las fotos ni el formulario del golpe.

### Zona CONDUCTORES y MARCO (segunda parte; se lanza cuando el remate de pantallas esté fusionado)
N1. Conductores sin lo heredado: las columnas que están vacías en TODA la lista no se pintan (alojamiento, contrato,
    nivel…); las dos franjas de contraseña (inicial y temporal común) pasan a un «Más opciones» plegado; la etiqueta
    «sin correo» no sale en quien entra con su enlace (no le falta nada); sin emoji en «Ranking»; «Acceso» escrito
    como las demás cabeceras; el día con el sello de la casa; un solo guion para lo vacío; «Mandar su acceso» como
    enlace subrayado (acción) y el estado en mono con su color (estado).
N2. Conductores vacío: UNA acción («Importar la lista», cian) y «Añadir uno a uno» como enlace; texto a la izquierda
    con regla; sin caja de puntos ni icono; el «Añadir conductor» de la cabecera, con borde mientras esté vacío.
N3. Un solo cian por pantalla en el panel: el avatar de la cabecera, gris; la burbuja del asistente, en tinta y sin
    sombra, y en el móvil nunca encima de la columna de acciones de una lista.

### Zona PÚBLICO y PORTAL (segunda parte; se lanza cuando el remate de pantallas esté fusionado)
U1. `frontend/e2e/planes.spec.js` («tanda 4 · complementos…»): espera a que la sección esté pintada antes de contar
    (hoy falla siempre contra la web compilada y pondría la CI en rojo).
U2. Títulos de pestaña propios en `/empleo` y `/repartidores`.
U3. Vocabulario de los planes, en servidor y web A LA VEZ (las pruebas comparan letra a letra `backend/server.py`,
    `frontend/src/lib/precios.js` y las claves de `frontend/src/lib/textosRutaA.js`): «revisión» donde dice
    «inspección»; y de tú en todas las frases (hoy mezcla «tienes» con «repartís», «os hagan falta», «con
    vosotros», «os vais», «vuestras»). Solo esas palabras: ni precios ni lo que incluye cada plan.
U4. En portugués, «revisão / revisões» donde hoy dice «inspeção / inspeções» (portada).
U5. Paso 01 de la portada: «cuando lo diga tu empresa» (no hay un ajuste de hora).
U6. La banda de la herramienta: los «·» no cuelgan al final de línea; de noche, las ruedas del dibujo no son bloques
    blancos. El cierre de la portada en el ordenador: los dos botones en una fila. En `/planes`, las cifras de
    «Complementos» en Plex Mono tabular, como las de arriba.
U7. El conductor lee lo mismo que el dueño: «Hacer la revisión» (no «auditoría») y «Correo» (no «Email») en
    `frontend/src/pages/driver/DriverPortal.jsx`, `DriverLogin.jsx` e `InspectionFlow.jsx`, con sus traducciones.
    En `/registro`, o las dos contraseñas llevan pista o ninguna.

## Zonas, copias y ficheros
- INICIO → `C:\Users\dlvie\foefa-p3`, puerto 4403: `frontend/src/panel/pages/Dashboard.jsx` y los componentes que
  solo usa el Inicio (búscalos), sus claves de `i18nDict.js`, sus specs (`tanda2-inicio`, lo del Inicio en `humo`).
  `EntradaArranque.jsx` es tuya para I5.
- EXPEDIENTE → `C:\Users\dlvie\foefa-p6`, puerto 4406: `panel/components/expediente/*`, `panel/pages/Expediente.jsx`,
  `pages/ExpedienteEjemplo.jsx`, `lib/expedienteEjemplo.js`, `panel/pages/Arranque.jsx`, `panel/pages/Repaso.jsx` y
  `panel/components/repaso/*` (solo E6), sus specs.
- CONDUCTORES → `C:\Users\dlvie\foefa-p5`, puerto 4405: `panel/pages/Conductores.jsx`, `panel/AsistenteBurbuja.jsx`,
  `panel/PanelLayout.jsx` (solo el avatar), sus claves y specs.
- PÚBLICO → `C:\Users\dlvie\foefa-p4`, puerto 4404: `pages/Empresas.jsx`, `pages/Planes.jsx`, `pages/Registro.jsx`,
  `lib/precios.js`, `lib/textosRuta*.js`, las frases de los planes de `backend/server.py` (SOLO esas cadenas, con
  Edit por trozos exactos: es UTF-8 con BOM y CRLF), las páginas de `/empleo` y `/repartidores` (solo el título),
  `pages/driver/DriverPortal.jsx`, `DriverLogin.jsx`, `InspectionFlow.jsx` (solo U7), `pages/devolucion/Vehiculo.jsx`
  (solo las ruedas de noche), sus specs.
`frontend/src/i18nDict.js` lo tocan varios: cada uno, sus claves JUNTO a su bloque, nunca al final.

## Añadidos (tras el remate de pantallas, ya fusionado: tu copia lo lleva, commit 9bf161d)
- (PÚBLICO) U8: `frontend/e2e/portada.spec.js` («…los títulos de columna caben en 2 líneas», hacia la línea 647)
  falla siempre: mide la altura del `h2`, que es un hijo de la rejilla y se estira a lo alto de su columna. Mide las
  líneas de verdad (con un `Range` sobre el texto o con `getClientRects()`), en español y en alemán a 1280 px; si en
  alemán algún título ocupa 3 líneas de verdad, arréglalo en la página (ancho de columna o tamaño), no en la prueba.
- (PÚBLICO) El remate ya hizo: `Vehiculo.jsx` acepta la prop `marca` y la portada la pasa en tinta; el fogonazo de
  `/c`, `/conductor` y `/registro` está resuelto; `BTN_PRIMARIO` desactivado va en hueco. No lo rehagas.
- (PÚBLICO) U7, además: `PantallaEnlace` (portal del conductor) tiene los títulos «Contraseña» y «Correo de
  recuperación» sin `tx()`: pásalos.
- (CONDUCTORES) El remate ya hizo: la etiqueta del acceso con el sello («Abierto el 14 NOV») y la ventana del acceso
  dentro de `<main>` (misma superficie en Mixto). No lo rehagas.
