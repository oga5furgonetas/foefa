/* LA AYUDA DE CADA PANTALLA, EN UN SOLO SITIO
   (Se llama `ayudaFichas` y no `ayuda` a proposito: `Ayuda.jsx` es el
   componente, y dos ficheros que solo se diferencian en la mayuscula
   conviven mal — Windows no los distingue y el import se resolvia al que no
   era, con un error de build que no señala la causa.)
   ═══════════════════════════════════════════════════════════════════════
   Por qué existe: hay 30 pantallas y se siguen añadiendo. Quien entra nuevo
   —o quien lleva meses y se encuentra un módulo que no estaba— no tiene
   forma de saber para qué sirve cada cosa ni por dónde empezar.

   TRES REGLAS AL ESCRIBIR ESTO
   ────────────────────────────
   1. `que` se lee en dos segundos y dice PARA QUÉ, no qué es. "Ver
      vehículos" no vale; "saber si una furgoneta puede salir mañana" sí.
   2. `pasos` es lo que hace una persona un martes, en orden. No es una
      lista de funciones: es el camino corto.
   3. `ojo` es lo que confunde de verdad, y solo se pone si existe. Un
      campo vacío es mejor que una advertencia inventada: si cada pantalla
      tiene un aviso, se dejan de leer todos.

   Y una cuarta que es la que hace que esto no se pudra: `scripts/check-ayuda.mjs`
   falla en CI si una entrada del menú no tiene ficha aquí. Sin ese cerrojo,
   dentro de tres meses la mitad de las pantallas no tendrían ayuda — que es
   exactamente lo que ya pasó dos veces con los permisos (gotcha 27).

   IDIOMA: castellano, a propósito. El panel tiene seis idiomas y 1.805
   claves, pero traducir 30 fichas a seis idiomas es trabajo que se queda a
   medias y envejece mal. Cuando haya un cliente que lo necesite, la forma
   del fichero admite el cambio sin tocar los componentes.

   `estado` es opcional y solo se pone cuando es verdad: sirve para avisar
   de que una pantalla está construida pero hoy no se usa, y así quien entra
   no pierde media hora intentando entenderla.                             */

export const AYUDA = {
  // ── Hoy ────────────────────────────────────────────────────────────────
  dashboard: {
    que: 'La foto del día: qué se ha entregado, qué está parado y qué necesita a alguien.',
    pasos: [
      'Míralo al llegar por la mañana, antes de abrir nada más.',
      'Lo que salga en rojo o ámbar tiene una pantalla detrás: pulsa y te lleva.',
    ],
  },
  'mi-dia': {
    que: 'Lo tuyo, no lo de todos: lo que tienes asignado y lo que te falta hacer hoy.',
    pasos: ['Repásalo antes de salir de la oficina: lo que quede aquí, queda sin hacer.'],
  },
  actividad: {
    que: 'Quién ha tocado qué y cuándo. Sirve para reconstruir por qué algo cambió.',
    pasos: ['Filtra por persona o por fecha cuando alguien pregunte "¿quién ha hecho esto?".'],
  },

  // ── Operación diaria ───────────────────────────────────────────────────
  empleo: {
    que: 'Tus ofertas de trabajo con su enlace publico, el cuestionario que quieras y quien se apunta. Al contratar se crea la ficha del conductor sola.',
    pasos: [
      'Crea la oferta y ELIGE EL CENTRO: eso decide en que tablero salen sus candidatos y en qué centro nace la ficha al contratar.',
      'Anade las preguntas que quieras: si/no, elegir una, marcar varias, texto o un numero.',
      'Si marcas una respuesta como «descarta», quien la elija se aparta solo y sale en la columna Descartado con el motivo. Se puede deshacer moviendolo de columna.',
      'Copia el enlace y pegalo en Indeed como URL de candidatura, o mandalo por WhatsApp. El de Indeed lleva `?de=indeed` para saber que anuncio trae gente.',
      'Cuando alguien se apunta, sale en Nuevo. Abre la tarjeta para ver sus respuestas y escribirle por WhatsApp.',
      'Al darle a Contratar se crea la ficha del conductor con sus datos, y ya puede entrar a su portal.',
    ],
    ojo: 'Lo que descarta NO lo ve el candidato: si supiera que respuesta le deja fuera, contestaria eso. Y los datos se borran solos a los 12 meses; si alguien pide que los quites antes, la papelera de su tarjeta lo hace de verdad.',
  },
  asignacion: {
    que: 'Qué furgoneta lleva cada conductor hoy.',
    pasos: [
      'Asigna antes de que salgan las rutas.',
      'Una furgoneta en el taller no debería asignarse: mira Órdenes de taller si dudas.',
    ],
  },
  diarios: {
    que: 'Los paquetes que el cliente dice que no recibió (DNR), por conductor y en euros, a partir del Daily Report de Amazon.',
    pasos: [
      'Descarga el Daily Report (.html) de cada día desde el portal de Amazon y súbelo con «Subir Daily Report». Se pueden subir varios a la vez.',
      'Sin fichero, copia las tablas de la pantalla del portal y usa «Pegar».',
      'Cada DNR se cuelga de la persona por su Transporter ID. Si sale un código en vez de un nombre, ponle la persona desde «Transporter IDs».',
    ],
    ojo: 'Amazon rellena la columna DSC (si el DNR puntúa) 2-4 días tarde. Vuelve a subir el mismo reporte unos días después: actualiza sin duplicar.',
  },
  plantilla: {
    que: 'La hoja de salida del día: ruta, conductor, móvil, vehículo y horas, en Excel.',
    pasos: [
      'Pega la lista de quién lleva qué vehículo (o sube una captura). Si tienes la de rutas con su hora, pégala al lado y se cruzan por nombre.',
      'Si la Asignación del día ya está hecha, «Usar la asignación» monta la hoja sin pegar nada.',
      'Revisa los avisos: nombres, matrículas y horas que no cuadran con la empresa, con la corrección a un clic.',
      'Marca colores (no vino, incidencia, vehículo especial) y descarga. Se guarda en el historial del centro.',
    ],
    ojo: 'Varias personas pueden editar la misma hoja a la vez: cada celda se guarda sola y los cambios de los demás aparecen en 2-3 segundos.',
  },
  turnos: {
    que: 'El cuadrante: quién trabaja qué día, con los códigos y las horas.',
    pasos: [
      'Elige el rango de fechas arriba y pinta con el pincel de código.',
      'Los días aprobados salen en rosa y no se pueden mover sin el permiso correspondiente.',
      'Descarga a Excel cuando lo tengas cerrado.',
    ],
    ojo: 'Las preguntas del mes ("¿está esta persona en el cuadrante?") se contestan con el mes entero, no con lo que ves en pantalla.',
  },
  'checklist-operativo': {
    que: 'La lista de comprobación del turno, para que no se olvide nada al abrir o cerrar.',
    pasos: ['Ábrela al empezar el turno y ve marcando. Queda registrado quién y cuándo.'],
  },
  chat: {
    que: 'Mensajes internos entre la oficina y el equipo.',
    pasos: ['Escribe y se envía. Los avisos importantes van por Telegram, no por aquí.'],
    estado: 'Poco usada: 8 mensajes en total y el último hace más de un mes.',
  },

  // ── Flota ──────────────────────────────────────────────────────────────
  vehiculos: {
    que: 'La ficha de cada furgoneta: estado, papeles, daños y su gemelo en 3D.',
    pasos: [
      'Busca por matrícula.',
      'La pestaña Documentación tiene seguro, ITV y contrato de renting.',
      'El visor 3D pinta los daños abiertos sobre la carrocería.',
    ],
    ojo: 'Las furgonetas de baja no salen en los listados. Están en su propia pestaña, y no cuentan en ningún contador.',
  },
  revision: {
    que: 'Validar lo que la IA ve en las fotos, para que aprenda. Es lo único que la hace mejorar.',
    pasos: [
      'Pulsa "Revisar en 5 segundos" y contesta con uno de los cuatro botones.',
      '"Sí, pero no ahí" es para cuando el daño existe y el recuadro está mal puesto.',
      '"No se ve" cuando la foto no permite juzgarlo. No es un fallo de la IA.',
    ],
    ojo: 'El recuadro se equivoca de sitio a menudo. Mira la furgoneta entera antes de contestar: hubo un retrovisor izquierdo marcado en la trasera.',
  },
  inspecciones: {
    que: 'Las inspecciones con foto que hacen los conductores al coger y dejar la furgoneta.',
    pasos: [
      'Filtra por fecha o furgoneta.',
      'Abre una para ver las fotos y lo que detectó la IA.',
    ],
  },
  incidencias: {
    que: 'Partes de golpes, averías y sucesos, con sus fotos.',
    pasos: [
      'Crea la incidencia con foto en cuanto pase algo.',
      'Desde ella se puede abrir una orden de taller sin volver a escribirlo todo.',
    ],
  },
  talleres: {
    que: 'La agenda de talleres: quién arregla qué, dónde y con qué teléfono.',
    pasos: [
      'Añade el teléfono de cada uno. Sin él no se les puede escribir ni por WhatsApp ni desde el parte, y hay que salir de la app para llamar.',
      'Si tienes su correo, ponlo también: es el único canal que funciona cuando WhatsApp falla.',
    ],
    ojo: 'Un taller sin teléfono ni correo no recibe nada. Al preparar un parte se proponen primero los que sí se pueden avisar.',
  },
  ordenes: {
    que: 'Mandar una furgoneta al taller y seguirla sin llamar por teléfono.',
    pasos: [
      'En «Furgonetas paradas», pulsa el «sin parte» rojo: el parte se abre con sus daños, sus fotos y el taller sugerido ya puestos.',
      'Manda el enlace al taller por WhatsApp desde el propio parte. Entra sin registrarse y desde el móvil.',
      'A partir de ahí la app pregunta sola cada pocos días. En «Canal con el taller» eliges cada cuánto, qué días y qué se les dice.',
      'Lo que ellos contesten aparece en «Lo que dicen los talleres», aunque no les hayamos preguntado.',
    ],
    ojo: 'El enlace es público: quien lo tenga entra. No lleva datos del conductor, solo la furgoneta y el problema. Y pon la fecha de salida cuando el taller la diga: sin ella no se puede prever con qué flota cuentas la semana que viene.',
  },
  aparcamiento: {
    que: 'Dónde está aparcada cada furgoneta en el centro.',
    pasos: ['Marca la plaza al aparcar para que el siguiente turno la encuentre.'],
    estado: 'Poco usada: 11 registros y el último hace más de un mes.',
  },
  vencimientos: {
    que: 'Qué caduca y cuándo: ITV, seguro, permisos. Para que no te pille ninguno.',
    pasos: [
      'El calendario enseña el mes; la lista, lo que vence antes.',
      'Lo que esté en rojo ya ha caducado.',
    ],
  },
  'avisos-itv': {
    que: 'Los avisos de ITV que se han mandado y a quién.',
    pasos: ['Comprueba aquí si un aviso llegó antes de volver a mandarlo.'],
  },
  importaciones: {
    que: 'Subir ficheros: furgonetas, conductores y datos que vienen de fuera.',
    pasos: ['Elige el tipo, arrastra el fichero y revisa la vista previa antes de confirmar.'],
    ojo: 'Importar dos veces el mismo fichero puede crear fichas duplicadas. Comprueba la vista previa.',
  },
  renting: {
    que: 'Los contratos de renting de las furgonetas.',
    pasos: ['Consulta aquí de quién es una furgoneta y hasta cuándo.'],
  },
  'casas-alquiler': {
    que: 'Las empresas a las que alquilas furgonetas de refuerzo.',
    pasos: ['Guarda contacto y condiciones para no buscarlos cuando haga falta una furgoneta ya.'],
    estado: 'Poco usada: última anotación hace casi dos meses.',
  },

  // ── Equipo ─────────────────────────────────────────────────────────────
  conductores: {
    que: 'La ficha de cada persona: contacto, sede, nº de empleado e historial.',
    pasos: [
      'Si empiezas: pulsa «Importar Excel» y sube la hoja que ya tengas. No hace falta ningún formato nuestro — vale con que haya una columna de nombre.',
      'Antes de guardar se enseña lo que se ha entendido: compruébalo ahí, no después.',
      'Para entrar al portal no hay que hacer nada más: el conductor escribe su correo y ya está. '
        + 'Si prefieres que además haga falta contraseña, se la pones desde el aviso de arriba — pero entonces '
        + 'con el correo solo ya no les vale, así que hay que repartirlas el mismo día.',
    ],
    ojo: 'Importar da de alta lo que falta y nunca pisa una ficha que ya existe. Si alguien aparece con el historial corto, comprueba si tiene otra ficha con el mismo correo.',
  },
  /* Las dos pantallas viven ahora bajo una sola entrada, con pestañas: la
     ficha de la entrada tiene que hablar de las dos, porque es la que se abre
     con el «?» desde cualquiera de ellas. Las de `diarios` y `whc` se quedan:
     siguen siendo dos permisos distintos y quien tenga uno solo ve su
     pestaña. */
  incorporaciones: {
    que: 'Quién está entrando, qué papel le falta y el WhatsApp escrito para pedírselo.',
    pasos: [
      'Pega el listado de la ETT entero: se puede pegar todos los días, quien ya esté no se duplica.',
      'Cada papel se pulsa y avanza: falta → se lo he pedido → en revisión → correcto.',
      'Marca lo que falte y abre el WhatsApp; luego «ya se lo he enviado» para que quede constancia.',
    ],
    ojo: 'Las contraseñas del listado NO se guardan en el pegado — la cuenta de onboarding sí, para poder entrar a revisarla. Y una persona sin nada marcado está SIN REVISAR, no completa: por eso empieza en «Pendiente de revisar» hasta que alguien dice qué le falta.',
  },
  contactos: {
    que: 'La agenda: talleres, proveedores, clientes y quien haga falta.',
    pasos: ['Busca por nombre o por lo que hace.'],
  },
  conversaciones: {
    que: 'Lo que escriben por WhatsApp los conductores y talleres, y lo que la app les manda (avisos de ITV, incidencias y resúmenes).',
    pasos: [
      'Elige una persona a la izquierda: ves el hilo entero por hora, con las marcas de entregado y leído.',
      'Si te ha escrito en las últimas 24 h puedes contestarle aquí mismo.',
    ],
    ojo: 'Pasadas 24 h desde su último mensaje WhatsApp solo deja mandarle plantillas (los avisos automáticos), no texto libre.',
  },

  // ── Sistema ────────────────────────────────────────────────────────────
  'origen-danos': {
    que: 'De cada golpe, la última foto en la que la furgoneta estaba limpia.',
    pasos: [
      'Dice quién la LLEVABA, no quién dio el golpe: pudo ser un tercero en un parking.',
      'Mira siempre las dos fotos antes de hablar con nadie.',
      'Solo se señala a una persona con un día de ventana y un único conductor.',
    ],
  },
  'ia-peritaje': {
    que: 'Peritaje técnico de daños con IA, para valorar un golpe.',
    pasos: ['Sube las fotos del daño y la IA propone una valoración.'],
    estado: 'Poco usada: 4 peritajes y el último hace tres meses.',
  },
  tienda: {
    que: 'La ropa que le vendes a tu gente: qué falta para poder venderla, tus prendas y los pedidos.',
    pasos: [
      'Los pasos de arriba se marcan solos cuando los completas: el logo, el precio, abrir la tienda.',
      'En «Tus prendas» las montas y les pones precio. Sin precio no se pueden publicar.',
      'La tienda nace APAGADA: mientras lo esté, en el móvil del conductor no aparece ni la entrada.',
      'Cada tanda se cierra el día que elijas y hay un mínimo: por debajo no compensa lanzarla.',
    ],
    ojo: 'Lo que se emite es un justificante, no una factura: hasta que exista la sociedad no hay NIF con el que emitirla.',
  },
  configuracion: {
    que: 'Ajustes de la cuenta, centros, avisos y quién recibe qué.',
    pasos: ['Los avisos de Telegram y los destinatarios se configuran aquí.'],
  },
  analitica: {
    que: 'Cuánta gente entra en la web y en la app, por dónde pasa y dónde se va.',
    pasos: [
      'Los embudos dicen cuántos llegan a cada paso: de la web al registro, de la tienda al pago.',
      'La tabla de pantallas enseña en cuál se queda la gente y a cuál salta después.',
    ],
    ojo: 'Son visitas, no personas: la medición es anónima y se olvida al cerrar la pestaña, así que quien vuelve otro día cuenta dos veces.',
  },
  gastos: {
    que: 'De qué son las facturas que llegan y cuánto se gasta cada mes.',
    pasos: [
      'Lo más rápido es «Pegar del banco»: pega las líneas del extracto y él saca la fecha, el importe y de quién es.',
      'Cada factura dice en cristiano qué es ese proveedor. Lo que no reconozca te lo pregunta UNA vez y lo aprende.',
      'El botón «Taller» trae el importe final de las órdenes de taller: eso no hay que apuntarlo a mano.',
    ],
    ojo: 'Son solo las facturas apuntadas aquí, no la contabilidad: lo que no esté puesto no sale en los totales. La pantalla la ve únicamente el dueño.',
  },
  admin: {
    que: 'El negocio: cuentas, planes, cobros y la salud de la infraestructura.',
    pasos: [
      'La tarjeta de Salud avisa si la base de datos o el almacenamiento van justos.',
      'Aquí se ven las altas, los pagos y las reservas de la oferta fundador.',
    ],
    ojo: 'Solo la ve el super-admin. Es la pantalla de la empresa, no la de la operación diaria.',
  },
  bandeja: {
    que: 'Los mensajes que llegan del formulario de la web, sin que se pierda ninguno.',
    pasos: [
      'Cada envío del formulario entra aquí como un mensaje.',
      'Contesta desde tu correo: esta pantalla es para leer y no perderlos, no para responder.',
    ],
    ojo: 'Solo la ve el super-admin, y no avisa sola: hay que entrar. Los avisos van por Telegram.',
  },
  usuarios: {
    que: 'Quién entra a la app y qué puede ver cada uno.',
    pasos: [
      'Marca las casillas de los módulos que quieres que vea.',
      'El cambio se nota en su pantalla en menos de dos minutos, sin que tenga que volver a entrar.',
    ],
    ojo: 'Si alguien dice que "no le sale" una pantalla, es casi siempre una casilla sin marcar. No es caché.',
  },
}

/* LOS PRIMEROS PASOS.
   No es un tour de doce ventanas —esos se cierran sin leer—: son las cuatro
   pantallas que se usan de verdad todos los días, en el orden del día. Se
   filtran por lo que la persona puede ver, así que quien no tenga taller no
   ve el paso del taller y no se queda con la duda. */
export const PRIMEROS_PASOS = [
  { clave: 'dashboard', cuando: 'Al llegar', texto: 'Mira qué está parado o necesita a alguien.' },
  { clave: 'asignacion', cuando: 'Antes de salir', texto: 'Comprueba que cada conductor tiene vehículo.' },
  { clave: 'checklist-operativo', cuando: 'Al cerrar el turno', texto: 'Marca lo hecho: el resumen del día sale de aquí.' },
  { clave: 'revision', cuando: 'Diez minutos sueltos', texto: 'Valida daños: es lo único que hace mejorar a la IA.' },
]
