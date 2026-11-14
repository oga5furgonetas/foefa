# ARREGLOS-4: la tanda de DISEÑO (14-11-2026)

Sale de la revisión de diseño `...\scratchpad\crecer\perito\revision3\diseno-previa\INFORME.md` (21 hallazgos con su
foto, su fichero y su arreglo; las fotos, en `...\revision3\diseno-previa\fotos\` y `fotos-noche\`). Léela ENTERA antes
de tocar nada: el criterio es ese. El dueño: «que no se note que es IA, que sea bonito, elegante, esté bien conectado y
tenga sentido; no cosas básicas». La identidad: sección 3 de `...\perito\ENCARGO.md` y los bocetos de
`...\scratchpad\crecer\identidad\`.

Esto es oficio, no rediseño: no cambia lo que hace cada pantalla, lo que manda al servidor, sus teclas ni sus textos
de fondo (salvo los que se digan). Cada cambio se mira en foto a 390 y 1280 px, de día y de noche (y en los tres temas
del panel donde toque), ANTES de darlo por bueno. Las pruebas que fijen algo que se cambia a propósito se cambian y se
dice; lo demás tiene que seguir en verde.

## Decisiones (tomadas)

### Zona MARCO (el marco del panel)
M1. El menú, sin cuadraditos de colores: fuera `iconBg`/`iconCls` de colores por grupo (`PanelLayout.jsx`); iconos en
    gris, y en tinta el grupo y la pantalla activos; el acento cian solo marca la pantalla activa (como hoy la raya).
M2. Fuera la tarjeta «Acceso Fundador» del pie del menú (no hace nada). «Portal Conductor» se queda, como una línea
    del menú más, sin caja de color.
M3. La burbuja del asistente no sale en `/panel/repaso`, en el expediente (`/panel/vehiculos/:id/expediente`), en
    `/panel/arranque`, ni mientras haya una ventana abierta; y nunca tapa una foto ni un botón principal.
M4. La barra de abajo del móvil: una empresa SIN «Revisión rápida» (las nuevas) lleva «Repaso» en ese sitio, el
    segundo. Una empresa que tiene «Revisión rápida» (la flota que ya usa el producto) conserva su barra EXACTAMENTE
    como está hoy: no se le mueve nada.
M5. El selector de sede: sin mono espaciado; texto normal de la casa.
M6. Las ventanas del panel son opacas y van por encima de todo (barra de abajo y burbuja incluidas): una sola clase de
    ventana (fondo de superficie opaco, borde de 1 px, sin brillo) usada por «El acceso de…» y por las demás ventanas
    que hoy se montan con `.card` dentro de una capa `fixed inset-0`. Se comprueba en los tres temas.
M7. UN estado «desactivado» para los botones de todo el producto: tinta apagada sobre el color de hueco, nunca un cian
    lavado con letra blanca (`index.css`, las clases `.btn-*`, y la pieza `Boton` de la app de reparto solo si usa
    otra regla). Que se lea «todavía no», no «roto».
M8. `Conductores.jsx`: «Añadir conductor» en cian liso (sin degradado, sombra ni reflejo); avatares en gris liso con
    las iniciales en tinta; fuera el rótulo del centro en mono espaciado.

### Zona PÚBLICO
B1. `/planes` deja de ser la plantilla de tarjetas: los planes, en columnas separadas por reglas de 1 px; el
    recomendado, con una regla de tinta de 2 px encima (sin insignia); la oferta, una línea de texto (sin caja ámbar:
    el ámbar es para avisar, no para vender); lo que lleva cada plan, lista con reglas; complementos y «cómo se
    cuenta», listas de dos columnas con reglas, como las preguntas de la portada; cifras en Plex Mono tabular; la
    cabecera, la de la portada (`portadaComun.jsx`).
B2. La portada, del precio hacia abajo (hallazgos 10-13): la calculadora en tres líneas (etiqueta pequeña, la cifra
    sola, la nota); «Pedir la demostración» con borde (un solo cian por pantalla: «Probar con mis furgonetas»); los
    títulos de columna no se parten en 3 y 4 líneas; el paso 01 con cuatro fotos de la misma furgoneta (o cuatro
    dibujos: nunca mezclados); el «unas» va en la etiqueta, no delante de la cifra; en el móvil, los dos botones del
    héroe y del cierre a todo el ancho.
B3. NUEVO en la portada, una banda propia para la herramienta gratuita (hoy es una línea suelta al final de «Así
    funciona»): entre «Así funciona» y la banda oscura. Título «¿Qué te van a cobrar al devolverlo?» (el nombre único de la herramienta en toda la web). Debajo:
    «Elige tu compañía de renting y da una vuelta a la furgoneta con su propia guía de devolución. Sale lo que no da
    por bueno, con su página.» Las compañías que cubre, escritas (sin logotipos), en una línea en mono: «Ayvens ·
    Alphabet · Volkswagen Financial Services · BMW · Athlon · Arval · Hertz · Europcar» (compruébalas contra
    `frontend/src/lib/guiasRenting.js`: solo las que estén). Un botón con borde «Repasar mi furgoneta» a
    `/devolucion-renting` y la línea «Gratis. Sin registro. No guardamos nada de tu vehículo.» A la derecha (arriba en
    el móvil), el dibujo de la furgoneta vista desde arriba de `frontend/src/pages/devolucion/Vehiculo.jsx` con una
    zona marcada. Con sus 5 traducciones. Sin prometer ahorro ni decir «te lo cobrarán».
B4. `/registro` (hallazgo 15): el idioma, al pie; dos grupos con regla y subtítulo («Tu empresa» / «Tu acceso»); a
    partir de 1024 px, a la derecha, los cuatro pasos que vienen después (los del arranque, con sus mismas palabras);
    en «Cuenta creada», el correo entero en su línea (sin partirse por el guion) e «Ir al panel» como enlace de texto.
    Respeta la noche. SIN cambiar lo que envía ni el alta de la app de reparto ni la del iPhone (`sinPagos()`).

### Zona EXPEDIENTE
X1. El calendario ocupa el ancho de la hoja: el lado de cada día se calcula con el ancho útil y el número de semanas,
    con un tope (22 px): con un mes, casillas grandes; con doce, pequeñas pero a todo el ancho.
X2. «Cómo entró» y «Cómo está hoy», en una fila de dos columnas (como «Antes / Con el golpe»): una hoja menos al
    imprimir y ninguna hoja medio vacía. Compruébalo en el PDF real con 0, 1, 3 y 12 golpes.

### Zona ACCESO
C1. La espera de la primera revisión tiene vida (hallazgo 2; mira primero lo que dejó la tanda anterior y complétalo):
    la lista de conductores con su estado («Abrió el enlace · 14 NOV · 09:12» / «Sin abrir», con «Mandar otra vez»);
    la rejilla 2×2 de las cuatro fotos en vacío (borde de puntos de 1 px y «Frontal», «Trasera», «Lateral izquierdo»,
    «Lateral derecho» en gris) que se llenan al llegar, la misma que en «Ha llegado»; y una línea en mono «Comprobado
    hace 20 s».
C2. La barra de pasos del arranque: el actual en tinta, los hechos en tinta al 40 %; fuera «Paso 1 de 4» (lo dice la
    barra). Todas las fechas con el sello de la casa (`lib/sello.js`, «14 NOV 2026 · 09:12»). Las fotos de «Ha
    llegado», con el nombre del lado en la esquina, como «Antes/Hoy».
C3. La ventana «El acceso de…»: título centrado con la X; el estado en mono, en su línea, con su color.
C4. `/conductor`: un solo anillo de foco; «Portal del conductor» escrito como frase; nada que compita con «Entrar».
    `/c` en pantallas anchas: el botón justo debajo del texto; arriba, el nombre de la empresa si el servidor lo da
    sin riesgo (antes de canjear NO se sabe de quién es el enlace: si no se puede, se deja como está y se dice).
C5. La noche en el arranque, `/c` y `/conductor` cuando está elegida (hallazgo 18).

### Zona DEVOLUCIÓN
V1. El resultado: «Guardar o imprimir» también justo debajo de la cifra; «Lo que has contestado que no», plegado
    («8 zonas en las que has contestado que no»), sin perder nada al imprimir (impreso va desplegado); «Cambiar», gris,
    subrayado solo al pasar por encima.
V2. La página de cada compañía: el texto de «no acepta» en tinta con una regla roja de 2 px a la izquierda (no un
    muro rojo); un índice de zonas con anclas bajo el título; y arriba a la derecha el dibujo del vehículo.

## Zonas, copias y ficheros
- MARCO → `C:\Users\dlvie\foefa-p5`, puerto 4405: `frontend/src/panel/PanelLayout.jsx`, `panel/AsistenteBurbuja.jsx`,
  `panel/pages/Conductores.jsx` (solo M8), `frontend/src/index.css` (solo `.btn-*` desactivado y la clase de ventana),
  `panel/components/AccesoConductor.jsx` (solo ponerle la clase de ventana: lo demás es de la zona acceso), las demás
  ventanas del panel que usen `.card` en una capa fija (solo esa clase), sus claves de menú en `i18nDict.js`.
- PÚBLICO → `C:\Users\dlvie\foefa-p4`, puerto 4404: `pages/Planes.jsx`, `pages/Empresas.jsx`, `pages/portadaComun.jsx`,
  `pages/Registro.jsx`, `lib/textosRuta*.js`, sus specs.
- EXPEDIENTE → `C:\Users\dlvie\foefa-p3`, puerto 4403: `panel/components/expediente/*`, `pages/ExpedienteEjemplo.jsx`,
  `e2e/expediente.spec.js`.
- ACCESO → `C:\Users\dlvie\foefa-p7`, puerto 4477: `panel/pages/Arranque.jsx`, `panel/components/AccesoConductor.jsx`
  (todo menos la clase de ventana), `EntradaArranque.jsx`, `pages/driver/DriverLogin.jsx`, `EntrarConEnlace.jsx`,
  `pages/entradaComun.jsx`, sus claves y sus specs.
- DEVOLUCIÓN → `C:\Users\dlvie\foefa-p6`, puerto 4406: `pages/devolucion/*`, `pages/DevolucionRenting.jsx`, su spec.
- (REPASO ya está en marcha en `C:\Users\dlvie\foefa-p2`: `panel/pages/Repaso.jsx` y `components/repaso/*`.)
`frontend/src/i18nDict.js` lo tocan varios: cada uno, sus claves JUNTO a su bloque, nunca al final.

## Añadidos tras la tercera tanda (ya fusionada; tu copia la lleva: commit bddc2fd)
- (PÚBLICO) La herramienta se llama igual en todas partes: «¿Qué te van a cobrar al devolverlo?». En la portada el
  enlace lleva `data-testid="emp-devolucion"` y `frontend/e2e/devolucion-renting.spec.js` (prueba «la portada y el pie
  llevan a la herramienta») lo busca: la banda nueva (B3) conserva ese `data-testid` en su botón o enlace; si tienes que
  ajustar esa prueba, solo esas líneas (el resto del fichero es de la zona devolución).
- (PÚBLICO) Ninguna página clara da un fogonazo oscuro antes de cargar: `frontend/public/fondo-arranque.js` (lista
  `CLARAS`) y el cargador de ruta de `main.jsx` (solo ese color). Faltan `/registro` cuando es el alta de EMPRESA
  (ojo: `/registro` es también el alta oscura del repartidor: decide por los parámetros de la dirección, como hace la
  propia página), `/c` y `/conductor` si arrancan en papel. Compruébalo con una captura a los 50 ms de navegar.
  `main.jsx` es tuyo SOLO para ese color.
- (ACCESO) C6: en el portal del conductor, una sesión nacida de un enlace (`via: "enlace"` o `lk` en el token) no ve
  «Cambiar mi contraseña», «correo personal» ni «cambiar teléfono» (el servidor ya contesta 403
  `enlace_sin_contrasena` / `enlace_sin_cambiar_telefono`): en su lugar, una línea tranquila «Entras con tu enlace. Si
  quieres contraseña, pídesela a tu empresa.» Busca esas pantallas en `frontend/src/pages/driver/` (MiClave,
  MiCorreoPersonal y la del teléfono): son tuyas para esto.
- (ACCESO) C7: en la revisión de un conductor SIN lector automático (`sin_ia`), no sale un aviso flotante por cada
  foto («Foto guardada» cuatro veces apiladas): la propia casilla de la foto enseña que está guardada.
- (EXPEDIENTE) X3: el anexo «Posibles daños que marca la IA» ya llega del servidor en el ejemplo
  (`frontend/e2e/fixtures/expediente.json` trae dos); ojo: en `posibles_ia`, `vista` es TEXTO («frontal», «trasera»,
  «lateral_izq», «lateral_der» o null), no un número. Míralo en pantalla y en el PDF con esos datos de verdad.
- (MARCO) M9: en el menú, «Dashboard» ya se llama «Inicio»; que la barra de abajo del móvil diga lo mismo.
