# ARREGLOS-3: lo que encontró la SEGUNDA revisión (14-11-2026)

Los cinco informes completos (cómo se reproduce cada cosa, arreglo propuesto, pruebas temporales) están en
`...\scratchpad\crecer\perito\revision2\{enlace,servidor2,panel2,publico2,flota}\INFORME.md`; el JSON, en
`...\revision2\resultado\result.json` (64 hallazgos). Lo que el integrador ya cerró (no lo repitas): «c» en la
analítica, el cargador de ruta en papel, «anual pagando 10 meses», el héroe y el ejemplo con la misma historia (las dos
fotos del golpe de la puerta las hizo Luis P.), `total_con_repaso` leído por la ficha de la inspección. Su informe:
`...\perito\informe3-integrar.md`.

Cada arreglo: se reproduce, se arregla en la causa, deja una prueba permanente que falla antes y pasa después. Si un
hallazgo no es verdad al leer el código actual (copia `C:\Users\dlvie\foefa-p1` en 901524a), se dice y no se toca.

## Decisiones (ya tomadas; no las reabras)

### Zona ACCESO (el enlace del conductor, la entrada y el arranque)
A1. **[BLOQUEA] Una sesión nacida de un enlace NO puede crear ni cambiar una contraseña, nunca**, ni crear la cuenta
    del conductor. (Hoy lleva `at` = ahora y durante 15 minutos deja cambiarla sin saber la actual: quien tenga el
    enlace reenviado se quedaría con la cuenta.) Con su prueba: toda ruta que crea o cambia contraseña o correo de
    acceso contesta 403 a una sesión `via: "enlace"`.
A2. **La contraseña inicial compartida no se queda abierta para siempre, y no se obliga a nadie que no haga falta**
    (hallazgo 2 y 5 de `revision2\enlace\INFORME.md`, 4 de `flota`):
    - Quien entra CON la contraseña inicial compartida: como siempre, tiene que elegir la suya (no cambia).
    - Quien entra con CÓDIGO o con ENLACE no está obligado a elegir contraseña (`configurar_cuenta: false`), pero
      si su única cuenta es la inicial compartida, el servidor la RETIRA en ese momento para él (queda marcada: la
      inicial ya no le abre la cuenta; escritura condicionada, con su prueba de carrera). Desde entonces entra con
      código o con su enlace; si quiere contraseña, la elige desde su cuenta (solo sesión de código o de contraseña:
      ver A1). Si después escribe la inicial, el fallo es el de siempre («correo o contraseña incorrectos», sin dar
      pistas) y la pantalla le recuerda que puede dejar la contraseña en blanco para recibir un código (A9).
    - `/auth/renovar` conserva `via` y `lk` del token que renueva y contesta `configurar_cuenta` con la MISMA regla
      que la entrada de ese `via` (código o enlace → `false`). La app de Android, que renueva a partir del quinto
      día, no puede recibir un valor distinto del que recibió al entrar. `mi-ficha`, igual.
A3. **Cuando el enlace se renueva, se anula o la sesión caduca**, el portal no dice «vuelve a entrar con tu correo»
    a quien entró con enlace: dice «Este acceso ya no vale. Pide a tu empresa que te mande el enlace otra vez.» Y la
    web renueva sola la sesión del enlace mientras siga vivo (como hace la app), para que no caduque a los 30 días.
A4. **El enlace aguanta lo normal de un móvil**: recargar antes de entrar no lo rompe (el token se guarda en
    `sessionStorage` hasta que se canjea y se borra al entrar); si el teléfono perdió su secreto (otro navegador,
    modo privado, datos borrados) el mensaje lo explica («Este enlace ya se abrió en otro teléfono o en otro
    navegador de este. Ábrelo donde lo abriste la primera vez o pide uno nuevo a tu empresa.») y en el panel el dueño
    ve junto a «Abierto el…» el botón «Mandar uno nuevo». Los fallos de OTRO teléfono no dejan fuera al teléfono
    bueno: el límite por enlace solo cuenta y solo castiga los intentos sin el secreto correcto.
A5. **La IP de los límites** sale de la cabecera que pone Fly (`Fly-Client-IP`) y, solo si falta, del ÚLTIMO valor
    de `X-Forwarded-For`; nunca del primero, que lo escribe quien llama. Vale para todos los límites del servidor.
A6. **Crear, renovar, ver y anular enlaces exige poder ver la pantalla de Conductores** (y el centro del conductor).
A7. **El número de WhatsApp**: con `+` se respeta; 9 cifras que empiezan por 6 o 7 → `34`; cualquier otra cosa →
    sin destinatario (WhatsApp pregunta a quién). Nunca un número inventado. En pantalla, los móviles agrupados
    como en Conductores.
A8. **`/c` limpio**: sin la hoja de cookies ni píxeles de anuncios; los errores de JavaScript nunca mandan el `#` al
    servidor ni a Telegram (se quita siempre antes de informar, en toda la web); los textos de error en el idioma de
    la pantalla.
A9. **La entrada con correo no rompe la costumbre de nadie**: un solo formulario con el correo y la contraseña
    (opcional) y un botón «Entrar»; con contraseña escrita entra con ella; con la contraseña en blanco manda el
    código al correo y pide las 6 cifras. Debajo: «¿No tienes contraseña? Déjala en blanco y te mandamos un código
    al correo.» Intro hace lo mismo que el botón. Sin `fds_dr_metodo`.
A10. **El conductor de una cuenta sin lector automático no lee nada de la IA**: el servidor dice en la ficha del
    portal (`sin_ia: true`) y la revisión del conductor no enseña «la IA lee los km», «Verificando IA…», «La IA está
    leyendo…» ni «Foto revisada»: pide los km a mano desde el principio y dice «Foto guardada». En las cuentas con
    IA no cambia nada. La app de Android no se toca.
A11. **El arranque**: las líneas pegadas con cabecera («Nombre, Teléfono», «Matrícula») no crean un conductor ni una
    furgoneta; lo que no parece una matrícula («Furgo 1», «Calle 5») se enseña aparte con «¿Seguro que es una
    matrícula?» y solo entra si se confirma; los nombres con coma («López García, Ana») no se parten mal (si la
    segunda parte no es un teléfono, es parte del nombre); los motivos y errores que manda el servidor llegan con un
    CÓDIGO y la pantalla los dice en su idioma; la espera de la primera revisión enseña quién ha abierto ya su
    enlace, qué hacer si no llega y un enlace para volver a «Dales acceso»; fechas y horas con el mismo formato en
    todo el recorrido; la ventana «El acceso de…» opaca y por encima de la barra del móvil; el filtro «sin acceso»
    de Conductores cuenta como CON acceso a quien tiene un enlace abierto, y la lista enseña de un vistazo quién ha
    entrado.
A12. **«Sigue con el arranque» no pregunta al servidor para siempre**: en cuanto el arranque está completo (hay
    furgonetas, conductores y una primera revisión) se apunta en el navegador y no se vuelve a preguntar; y la
    respuesta de `/api/alta/estado` es barata (cuentas, no listas enteras).
A13. Idioma del portal del conductor cuando el teléfono está en uno que no tenemos: español, no inglés.
A14. Los días y horas del alta salen en la zona de la empresa (el ayudante que ya usa el resto), no fijos en Madrid.

### Zona SERVIDOR (libro, IA, planes)
S1. **Ninguna llamada a Gemini para una empresa sin IA** (`ia_danos: False` y sin `IA_DANOS_DE_PAGO=1`): además de la
    revisión, el asistente (`/assistant/ask`), importar con IA, el cuadrante con IA y cualquier otra que mande datos
    de la empresa contestan 403 «Esta cuenta no tiene esa función.» sin llamar. La respuesta de `/org/billing` (o la
    que ya lea el panel al arrancar) lleva `ia: false` para que el panel esconda el asistente. Con una prueba que
    recorre todas las rutas con un doble de Gemini que revienta si se le llama. Las cuentas de autónomo de la app
    de reparto siguen con su propia regla (`_rep_ia_permitida`): no la cambies.
S2. **`update_damage` (taller, coste, estado de un daño) escribe con condición**, como el resto: no puede pisar un
    golpe marcado a la vez.
S3. **El cierre de entradas del libro**: una entrada sin dueño con golpes enlazados se cierra cuando todos sus daños
    están reparados; cerrar una entrada por orden de taller o «reparar pieza» marca como reparados (con su fecha) los
    golpes enlazados que esa reparación cubre, para que no reaparezcan como abiertos ni desaparezcan de «Ya
    apuntado» sin estado; deshacer con la lista de `golpe_ids` a la vez no deja ids muertos; un deshacer que falla
    al reescribir no deja un golpe sin lado (se revierte entero y contesta 409 para reintentar).
S4. **«Reconstruir flota»** no resucita lo archivado al deshacer después un golpe, respeta `ia_danos`, y no deja
    revisiones de una empresa sin IA en «pendiente».
S5. **El PDF de una revisión ya firmada no cambia**: lleva lo que había al firmar. Los golpes confirmados DESPUÉS de
    la firma van en un bloque aparte, «Añadido después de la firma», con su fecha y quién, fuera de lo firmado.
S6. **La IA no repite cada día la misma escalada** sobre una pieza con entrada humana abierta: se apunta una vez.
S7. **«Origen de daños» nunca da más certeza a la IA sola que a una persona** (`danos_atribucion`, hallazgo 2 de
    `revision2\flota\INFORME.md`, con su prueba `test_flota_origen.py`):
    - Lo que SOLO marcó la IA (nadie lo confirmó): como mucho «media», con el motivo «solo lo marcó la IA: nadie lo
      ha confirmado». Nunca «alta».
    - Lo confirmado en «Revisión rápida» (entrada `human` que no viene del repaso): la regla de SIEMPRE (la de antes
      de esta tanda: mismo conductor la revisión anterior y la del golpe → «alta»). Quien confirma allí lo hace con
      la foto anterior al lado (el comparador), así que el motivo `anterior_sin_repasar` del expediente NO la baja;
      los motivos de hecho (`varios_conductores`, `varios_dias`, `sin_conductor`, `ya_estaba`) sí.
    - Los golpes del repaso (`golpe_id`): la regla del expediente, entera.
    Resultado que tiene que dar la prueba del revisor con sus 10 furgonetas: las 6 confirmadas, «alta»; las 4 que
    solo dijo la IA, «media». La respuesta lleva `confirmado` (bool) en cada fila y `OrigenDanos.jsx` enseña una
    etiqueta discreta «Confirmado por una persona» / «Solo lo marcó la IA» (esa pantalla es tuya en esta tanda).
S8. **El número del menú no persigue a quien no usa el Repaso**: `GET /repaso/pendientes` lleva `avisar` (bool):
    `false` para una empresa con la IA activa que nunca ha dado un veredicto en el Repaso; `true` en los demás casos.
S9. **El expediente no esconde lo que la IA marcó, pero no lo confunde**: para empresas con la IA activa,
    `GET /vehicles/{id}/antes-del-perito` lleva `posibles_ia`: los daños nuevos que marcó la IA y nadie ha confirmado
    ni descartado (pieza tal como la dijo la IA, fecha de la revisión, foto con su caja, foto anterior del mismo
    lado), sin conductor y sin entrar en ninguna cuenta. Para empresas sin IA, lista vacía.
S10. Los planes no nombran la IA: fuera de Pro «Revisión rápida, solo en las cuentas con la IA activa…» (quien
    compra hoy no la recibe). `frontend/src/lib/precios.js`, igual que el servidor.
S11. La migración de permisos da también «repaso» a quien solo tenía «revision» (Revisión rápida).
S12. Una empresa nueva tiene sus índices (incluido el único del libro) desde su primer uso, no desde el siguiente
    arranque.
S13. Los menores que queden en `revision2\servidor2\INFORME.md` y los de «CERRAR» de `revision2\flota\INFORME.md`.
    Regenera los ejemplos si cambia una respuesta y dilo.

### Zona PANEL (expediente, repaso, menú)
P1. El expediente imprime `posibles_ia` (S9) como anexo final: «Posibles daños que marca la IA, sin confirmar por una
    persona», con la nota «La IA se equivoca a menudo: nada de esto está confirmado.»; no cuenta en las cifras.
P2. Con periodos largos, el calendario se compacta (una fila por trimestre o cuadraditos más pequeños) para que el
    primer golpe siga cabiendo en la hoja 1.
P3. En el ejemplo y en el documento, los sellos de «Antes» y «Con el golpe» llevan nombre con la misma regla en todos
    los golpes atribuibles.
P4. El menú honra `avisar` (S8): sin número mientras sea `false`. Y esconde el asistente si la cuenta no tiene IA (S1).
P5. Las claves muertas `ob.titulo`, `ob.sub`, `ob.progreso`, `ob.bloqueado` se borran si de verdad no se usan.

### Zona PÚBLICO
U1. La portada cuenta el alta como es ahora: cuatro pasos (matrículas, conductores, su enlace por WhatsApp, la primera
    revisión), «cada conductor entra con su enlace, sin correo ni contraseña», sin «el enlace de tu empresa y su
    correo» ni «subir el Excel».
U2. `/planes` en los 6 idiomas ENTERA: lo que lleva cada plan, los complementos y las preguntas se traducen con `tx()`
    (son frases fijas de `precios.js`); fuera el aviso de «está en español».
U3. `/registro`: respeta la noche; el plan por defecto y ante un plan desconocido es Esencial (el del «Desde 5 €»);
    sin «inspecciones con foto e IA»; sin «2 meses gratis»; su selector de sector y de plan, con la identidad nueva.
U4. Un vocabulario: «sede» (ni delegación, ni centro, ni estación, ni nave, salvo «nave» en la frase de la casa);
    «correo» (no email); «revisión» (no inspección ni auditoría) en todo lo público y en el arranque; importes
    siempre «60 € al mes». Repasa el recorrido «/» → `/registro` → «Cuenta creada».
U5. La descripción para buscadores de «/», de 155 caracteres como mucho.
U6. El formulario de contacto: el servidor contesta sin exclamaciones (o la página no enseña ese texto).

### Zona DEVOLUCIÓN
D1. Alphabet: la frase de cobro de la pág. 9 es del HABITÁCULO; no justifica «se factura» para daños de fuera, y la
    pág. 6 limita la factura de lo exterior a los contratos sin seguro ni servicio de daños. Vuelve a leer el
    documento y deja cada «se factura» de Alphabet con su base exacta y su condición a la vista; lo que no la tenga,
    a «no lo acepta».
D2. Las frases rotas o contradictorias del resultado (BMW limpieza, Volkswagen «no lo dice expresamente» bajo «no
    acepta», etc.) y los demás hallazgos de la herramienta en `revision2\publico2\INFORME.md`.

## Añadidos (14-11, al repartir las zonas)

S14. (servidor, hallazgo IMPORTANTE 2 de `revision2\servidor2\INFORME.md`) **Un golpe grave marcado por una persona no
    puede leerse como «Sin daños · 0 daños»**: `severidad_con_repaso` y `total_con_repaso` llegan en TODAS las
    respuestas que hoy llevan `severity`/`total_damages_count` de una revisión (listas con proyección incluidas), la
    cabecera del PDF firmado dice la gravedad con el repaso, y las cuentas por gravedad del servidor (las de
    ~32484 y ~32496) cuentan con ellos. La cola de «Revisión rápida» y la autorrevisión de la IA siguen con lo de la IA.
P6. (panel) Las pantallas que enseñan gravedad o número de daños de una revisión leen «con el repaso si lo hay»:
    `Inspecciones.jsx` (lista y detalle), `Vehiculos.jsx` (línea de tiempo), `Actividad.jsx` y `Asignacion.jsx`, con
    un único ayudante compartido (`frontend/src/lib/analisis.js`: `gravedadDe(analysis)` y `danosDe(analysis)`), y su
    prueba con una revisión «IA: sin daños + golpe grave a mano».
P7. (panel) R10: con `ia === false` en `/org/billing`, el panel no enseña la burbuja del asistente ni los botones que
    llaman a las rutas de R11 (búscalos por las funciones de `frontend/src/panel/api.js` que llaman a esas rutas). Si
    uno de esos botones está en un fichero de la zona acceso (Arranque, Conductores, AccesoConductor, EntradaArranque,
    ImportarConductores, Activacion, Dashboard), no lo toques y dilo.

## Vocabulario único (todas las zonas, en todo texto nuevo o que toques)
«sede» (no delegación, centro, estación ni nave, salvo «nave» donde la casa ya lo usa en el aviso a conductores);
«correo» (no email ni e-mail); «revisión» (no inspección ni auditoría) de cara a quien usa el producto; «furgoneta»
para el caso general («vehículo» solo donde cabe un coche: la herramienta de devolución); importes «60 € al mes»,
«3 € por furgoneta al mes»; de tú; sin exclamaciones; sin «IA» como reclamo.

## Zonas y ficheros (nadie toca lo de otro)
- ACCESO → `C:\Users\dlvie\foefa-p7`, puerto 4477. Hallazgos: enlace 1-15; servidor2 6 (EntradaArranque) y el coste
  de `/alta/estado`; panel2 (los de InspectionFlow, EntrarConEnlace, AccesoConductor, Conductores, Arranque,
  `_alta_parece_matricula`, Dashboard/EntradaArranque, i18n.jsx); flota 3, 4 y 9.
- SERVIDOR → `C:\Users\dlvie\foefa-p1`, puerto 4401. Hallazgos: servidor2 1-5, 7-12 (menos el 6); publico2 «detalle de
  planes» (solo `server.py`); flota 1, 2, 5 (R7), 6 (R8), 8; R9, R10, R11; S14.
- PANEL → `C:\Users\dlvie\foefa-p3`, puerto 4403. P1-P7; panel2 «expediente.css»; publico2 «/expediente-ejemplo».
- PÚBLICO → `C:\Users\dlvie\foefa-p4`, puerto 4404. U1-U6; publico2 (Planes, Empresas, Registro, precios.js,
  functions/index.js, recorrido).
- DEVOLUCIÓN → `C:\Users\dlvie\foefa-p6`, puerto 4406. D1-D2; publico2 «Alphabet» y «Resultados de la herramienta».
`backend/server.py` lo tocan DOS (acceso: solo entrada, sesiones, contraseñas, enlace, límites por IP, alta y arranque;
servidor: todo lo demás). `frontend/src/i18nDict.js` lo tocan cuatro: cada uno pone sus claves nuevas JUNTO a su
bloque, nunca al final del fichero.
