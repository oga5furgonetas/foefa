/* LAS GUÍAS DE DEVOLUCIÓN DE CADA COMPAÑÍA (14-11-2026), para /devolucion-renting y sus páginas por compañía.

   DE DÓNDE SALE CADA CIFRA. Cada documento es el PDF público de su compañía, leído por una persona y vuelto a leer
   por otra contra el PDF (los .verificado.json de la carpeta de trabajo «crecer/guias», solo los que tienen
   "leido": true). DOCUMENTOS es ese JSON tal cual: cada regla con su zona, el daño, lo que no se cobra, lo que se
   cobra, la medida, el máximo, la condición, a qué vehículo vale, la PÁGINA y la cita literal. Ninguna cifra se
   «arregla» aquí: si una parece rara, se quita y se dice. Las medidas se enseñan como vienen (cm o mm), sin convertir.

   NO SE TOCA SIN QUERER. scripts/check-guias-renting.mjs compara DOCUMENTOS, regla a regla, con una copia de los
   .verificado.json guardada en el repo (scripts/guias-renting/verificado/), vigila lo que se concluye de las respuestas
   y guarda una huella de todo; quien cambie algo a propósito (una edición nueva de una guía) copia allí el nuevo
   .verificado.json, actualiza la huella con --huella y lo dice.

   Fuera quedan: Leasys (no se pudo leer) y cualquier guía sin "leido": true.

   Este módulo no usa nada del navegador: lo importan también las funciones de Pages (frontend/functions/). */

export const LEIDA_EL = '2026-11-14'
export const LEIDA_TEXTO = '14 de noviembre de 2026'

export const ZONAS = {
  carroceria: 'Carrocería', pintura: 'Pintura', paragolpes: 'Paragolpes', llantas: 'Llantas', neumaticos: 'Neumáticos',
  lunas: 'Lunas', faros_y_pilotos: 'Faros y pilotos', retrovisores: 'Retrovisores', zona_de_carga: 'Zona de carga',
  interior: 'Interior', limpieza: 'Limpieza', documentacion_y_llaves: 'Llaves y papeles', mecanica: 'Mecánica', otros: 'Otros',
}

/* El orden de las zonas en las tablas: la vuelta al vehículo y después el interior, las llaves y la limpieza. */
export const ORDEN_ZONAS = ['paragolpes', 'faros_y_pilotos', 'lunas', 'carroceria', 'pintura', 'retrovisores', 'llantas', 'neumaticos',
  'zona_de_carga', 'interior', 'documentacion_y_llaves', 'limpieza', 'mecanica', 'otros']

export const DOCUMENTOS = {
  "ayvens-furgonetas": {
    compania: "ayvens",
    titular: "Ayvens (antes LeasePlan)",
    nombre: "LeasePlan Fair Wear & Tear — Normativa para la devolución de Vehículos Industriales",
    corto: "Normativa de devolución de vehículos industriales",
    url: "https://www.leaseplan.com/-/media/leaseplan-digital/es/publicpages/documents/normativa_devolucion_vehiculos_comerciales.pdf",
    web: {"texto":"Fin de contrato, en la web de Ayvens","url":"https://www.ayvens.com/es-es/mi-vehiculo/finalizacion-del-contrato/"},
    edicion: "Sin fecha en el documento · código LPES.LCV.ES-17v1",
    edicionLeida: "No trae fecha. Código en la contraportada (PDF p.14, impresa 27): «LPES.LCV.ES-17v1»; el «17» apunta a 2017, versión 1, pero el documento no lo dice. Marca LeasePlan (anterior a Ayvens).",
    paginas: 15,
    paginasNota: "Las páginas son las del archivo PDF; la numeración impresa en el documento es otra.",
    aplica_a: "furgoneta",
    reglas: [
      {"zona":"carroceria","dano":"Arañazos, desconchados, rozaduras y abrasiones en la carrocería","no_se_cobra":"Hasta 10 cm, siempre que se quiten con un pulido mecánico.","se_cobra":"Más de 10 cm, o cualquiera que no se quite con un pulido mecánico (aunque mida menos).","medida":{"que":"largo","limite":10,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Que se pueda eliminar mediante un pulido mecánico.","aplica_a":"furgoneta","pagina":7,"cita":"abrasiones de hasta 10 cm que se puedan eliminar mediante un pulido mecánico"},
      {"zona":"carroceria","dano":"Abolladuras en la carrocería","no_se_cobra":"Hasta 2 cm, y no más de dos abolladuras por panel.","se_cobra":"Abolladuras de más de 2 cm, o más de dos abolladuras en el mismo panel.","medida":{"que":"otro","limite":2,"unidad":"cm","sentido":"hasta"},"maximo":"2 por panel","condicion":"La guía no dice si los 2 cm son de diámetro o de largo: solo «abolladuras de hasta 2 cm».","aplica_a":"furgoneta","pagina":7,"cita":"Abolladuras de hasta 2 cm, siempre que no haya más de dos abolladuras por panel"},
      {"zona":"pintura","dano":"Desconchados pequeños por piedras o gravilla","no_se_cobra":"Zonas pequeñas de desconchados por piedras que afecten a menos del 25% del panel.","se_cobra":"Desconchados por gravilla que cubran más del 25% del panel.","medida":{"que":"superficie","limite":25,"unidad":"por_ciento","sentido":"menos_de"},"maximo":null,"condicion":"Porcentaje de la superficie del panel afectado.","aplica_a":"furgoneta","pagina":7,"cita":"Áreas pequeñas de desconchados (ocasionados por piedras) que afecten a menos del 25% del panel"},
      {"zona":"pintura","dano":"Desconchados retocados y corrosión","no_se_cobra":"Desconchados que se hayan retocado correctamente antes de que salga corrosión.","se_cobra":"Corrosión en cualquier tipo de daño.","medida":null,"maximo":null,"condicion":"Retocado correctamente y antes de que aparezca el óxido.","aplica_a":"furgoneta","pagina":7,"cita":"Desconchados que se hayan retocado correctamente antes de que se produzca corrosión"},
      {"zona":"pintura","dano":"Reparaciones de pintura o chapa mal hechas","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Reparaciones de pintura mal hechas en las que se note diferencia de color, y cualquier trabajo de reparación incorrecto.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":7,"cita":"incorrectos en los que se pueda apreciar una diferencia de color"},
      {"zona":"pintura","dano":"Decoloración de la pintura de la carrocería","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Decoloración de la pintura debida a impactos externos.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":7,"cita":"Decoloración de la pintura debido a impactos externos"},
      {"zona":"pintura","dano":"Cambio de color del vehículo","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Cambios respecto al color original que no estén en el contrato.","medida":null,"maximo":null,"condicion":"Salvo que el cambio de color esté contemplado en el contrato.","aplica_a":"furgoneta","pagina":7,"cita":"Cambios de color respecto al color original y no contemplados en el contrato."},
      {"zona":"paragolpes","dano":"Arañazos, rozaduras y abrasiones en parachoques pintados y rejilla","no_se_cobra":"Hasta 10 cm, siempre que se quiten con un pulido mecánico.","se_cobra":"Desconchados, arañazos, rozaduras y abrasiones de más de 10 cm; y en parachoques pintados, cualquiera que no se quite con pulido mecánico.","medida":{"que":"largo","limite":10,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Que se pueda eliminar mediante un pulido mecánico (parachoques pintados).","aplica_a":"furgoneta","pagina":8,"cita":"Todos los arañazos, rozaduras y abrasiones de hasta 10 cm que se puedan eliminar"},
      {"zona":"paragolpes","dano":"Rozaduras, arañazos y marcas en parachoques con relieve o sin pintar","no_se_cobra":"Rozaduras, arañazos y marcas de hasta 10 cm (aquí la guía no pide que se quiten con pulido).","se_cobra":"Más de 10 cm.","medida":{"que":"largo","limite":10,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Solo parachoques con relieve (texturados) o no pintados.","aplica_a":"furgoneta","pagina":8,"cita":"En los parachoques con relieve o no pintados, resultan aceptables rozaduras, arañazos y marcas"},
      {"zona":"paragolpes","dano":"Abolladuras en parachoques o rejilla (parrilla)","no_se_cobra":"Hasta 2 cm, con un máximo de 2 abolladuras por parachoques o parrilla.","se_cobra":"Abolladuras de más de 2 cm, o más de dos por rejilla o parachoques.","medida":{"que":"otro","limite":2,"unidad":"cm","sentido":"hasta"},"maximo":"2 por parachoques o parrilla","condicion":"La guía no dice si los 2 cm son de diámetro o de largo.","aplica_a":"furgoneta","pagina":8,"cita":"Abolladuras de hasta 2 cm, con un máximo de 2 abolladuras por parachoques o parrilla"},
      {"zona":"paragolpes","dano":"Parachoques o rejilla rotos, agrietados o deformados","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Rejillas y parachoques rotos, agrietados o deformados.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":8,"cita":"Rejillas y parachoques rotos, agrietados o deformados"},
      {"zona":"paragolpes","dano":"Decoloración y daños por productos químicos en parachoques y rejilla","no_se_cobra":"Decoloración por agentes externos, por ejemplo el tiempo (sol, lluvia).","se_cobra":"Daños causados por usar mal productos químicos.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":8,"cita":"Decoloración debido a impactos externos, por ejemplo, a la climatología"},
      {"zona":"neumaticos","dano":"Profundidad del dibujo de los neumáticos","no_se_cobra":"Banda de rodadura de 1,6 mm o más, o la que cumpla los requisitos legales locales.","se_cobra":"La guía no lo escribe como «no aceptable»; se deduce que por debajo de 1,6 mm (o del mínimo legal) no es desgaste normal.","medida":{"que":"profundidad","limite":1.6,"unidad":"mm","sentido":"menos_de"},"maximo":null,"condicion":"Ojo con el sentido: aquí el límite marca lo que SÍ se cobra (menos de 1,6 mm). Aceptable con 1,6 mm o más, o con lo que exija la ley local.","aplica_a":"furgoneta","pagina":9,"cita":"Neumáticos con una banda de rodadura mínima de 1,6 mm"},
      {"zona":"neumaticos","dano":"Bultos, grietas, cortes y daños en flancos o banda de rodadura","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Neumáticos deformados por golpe con bordillos u otros objetos; salientes (bultos), grietas o cortes; daños en flancos o banda de rodadura.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":9,"cita":"Salientes, grietas o cortes en los neumáticos"},
      {"zona":"neumaticos","dano":"Objetos clavados en el neumático","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Neumáticos penetrados por objetos extraños.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":9,"cita":"Neumáticos penetrados por objetos extraños"},
      {"zona":"llantas","dano":"Arañazos, rozaduras o abrasiones en la cara de la llanta o del tapacubos","no_se_cobra":"Como máximo uno (arañazo, rozadura o abrasión) de hasta 10 cm, si la llanta o el tapacubos no está deformado.","se_cobra":"Arañazos o abrasiones de más de 10 cm. Que se cobre a partir del segundo es deducción: la guía solo dice «como máximo un».","medida":{"que":"largo","limite":10,"unidad":"cm","sentido":"hasta"},"maximo":"1 en la cara de cada llanta o tapacubos","condicion":"Que la llanta o el tapacubos no esté deformado.","aplica_a":"furgoneta","pagina":9,"cita":"En la llanta o tapacubos: como máximo un arañazo, rozadura o abrasión"},
      {"zona":"llantas","dano":"Arañazos, rozaduras o abrasiones en el borde de la llanta o del tapacubos","no_se_cobra":"Como máximo uno (arañazo, rozadura o abrasión) de hasta 10 cm en el borde, si la llanta o el tapacubos no está deformado.","se_cobra":"Arañazos o abrasiones de más de 10 cm. Que se cobre a partir del segundo es deducción: la guía solo dice «como máximo un».","medida":{"que":"largo","limite":10,"unidad":"cm","sentido":"hasta"},"maximo":"1 en el borde de cada llanta o tapacubos","condicion":"Que la llanta o el tapacubos no esté deformado. La guía lo pone aparte de la cara: no dice si el máximo es uno en total o uno en cada sitio.","aplica_a":"furgoneta","pagina":9,"cita":"En el borde de la llanta o tapacubos: como máximo un arañazo"},
      {"zona":"llantas","dano":"Llantas o tapacubos rotos, deformados u oxidados","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Tapacubos, llanta o aleación rotos o deformados; corrosión en tapacubos, llanta o aleación.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":9,"cita":"Tapacubos, llanta o aleación rotos o deformados"},
      {"zona":"neumaticos","dano":"Rueda de repuesto y kit de reparación de pinchazos","no_se_cobra":"Entregarlo completo: si el vehículo vino con rueda de repuesto, dentro del vehículo; si vino con kit (sellador y compresor de 12 V), dentro y funcionando.","se_cobra":"Devolverlo sin el kit de reparación, con piezas del kit que falten o sin la rueda de repuesto.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":9,"cita":"Devoluciones sin el kit de reparación de neumáticos o con ausencias de algunas partes"},
      {"zona":"neumaticos","dano":"Neumáticos de invierno o de verano incluidos en el contrato","no_se_cobra":"Devolver el juego completo de 4 ruedas, con pernos y llantas.","se_cobra":"La guía no da importe; remite al contrato de cada cliente para cómo devolverlos.","medida":null,"maximo":"Juego completo de 4 ruedas","condicion":"Solo si el contrato incluía neumáticos de invierno (o de verano, si se devuelve en invierno).","aplica_a":"furgoneta","pagina":4,"cita":"deberá devolverse el juego completo de 4 ruedas, incluidos los pernos y las llantas"},
      {"zona":"lunas","dano":"Impactos y grietas en lunas fuera de la zona A del parabrisas","no_se_cobra":"Marcas o grietas que, contando el impacto y sus ramificaciones, no pasen de 1 cm y no estén en la zona A del parabrisas.","se_cobra":"Impactos o grietas de más de 1 cm.","medida":{"que":"largo","limite":1,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Fuera de la zona A del parabrisas (el campo de visión del conductor); el centímetro cuenta impacto y ramificaciones.","aplica_a":"furgoneta","pagina":10,"cita":"longitud superior a 1 cm tanto el impacto como sus ramificaciones"},
      {"zona":"lunas","dano":"Impactos en la zona A del parabrisas","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Cualquier impacto en la zona A del parabrisas, aunque mida menos de 1 cm.","medida":null,"maximo":null,"condicion":"Solo zona A del parabrisas.","aplica_a":"furgoneta","pagina":10,"cita":"Chips smaller than 1 cm in the A zone of the windscreen"},
      {"zona":"lunas","dano":"Lunas rotas","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Cristales rotos (la guía dice que no se aceptan sea cual sea la edad o los km del vehículo).","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":10,"cita":"Broken glass or lights"},
      {"zona":"lunas","dano":"Adhesivos y láminas en los cristales","no_se_cobra":"Pequeños adhesivos en el cristal que exija la ley local.","se_cobra":"Láminas solares o tiras tintadas puestas por uno mismo hay que quitarlas del parabrisas si no son de profesional, están rotas o se despegan por las esquinas.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":10,"cita":"Pequeños adhesivos en el cristal requeridos por la legislación local"},
      {"zona":"faros_y_pilotos","dano":"Marcas, grietas o roturas en faros, antinieblas, intermitentes y pilotos","no_se_cobra":"Marcas de piedras en la superficie de luces, antinieblas o intermitentes que no rompan el cristal ni impidan que funcionen.","se_cobra":"Luces rotas; grietas o impactos que limiten el funcionamiento de la luz. Todas las bombillas deben funcionar.","medida":null,"maximo":null,"condicion":"Que no rompa el cristal y que la luz funcione.","aplica_a":"furgoneta","pagina":10,"cita":"Marcas provocadas por piedras en la superficie de las luces"},
      {"zona":"retrovisores","dano":"Arañazos y marcas en espejos y accesorios externos","no_se_cobra":"Arañazos y marcas de hasta 5 cm.","se_cobra":"Rozaduras, arañazos y marcas de más de 5 cm (en el original, en inglés: «larger than 5 cm»).","medida":{"que":"largo","limite":5,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"El límite está en el apartado «Espejos y accesorios externos», sin decir a qué pieza se refiere: se entiende que vale para espejos y accesorios de fuera.","aplica_a":"furgoneta","pagina":11,"cita":"Arañazos y marcas de hasta 5 cm"},
      {"zona":"retrovisores","dano":"Retrovisor o carcasa deformados","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Deformación del espejo o de su carcasa.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":11,"cita":"Deformation of the mirror and/or mirror case"},
      {"zona":"otros","dano":"Bacas, barras de techo y enganche de remolque","no_se_cobra":"Devolver el vehículo con las barras de remolque intactas; antenas y accesorios de techo funcionando, cumpliendo las normas y homologados para ese vehículo.","se_cobra":"Bacas o barras de techo y/o enganches de remolque dañados, rotos u oxidados.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":11,"cita":"Damaged, broken or rusted roof racks and/or tow bars"},
      {"zona":"carroceria","dano":"Rotativos y accesorios externos quitados o puestos","no_se_cobra":"Si se quitan accesorios externos, la zona debe quedar bien reparada.","se_cobra":"Rotativos (luces de señalización) que hayan dañado la estructura del vehículo al ponerlos o quitarlos.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":11,"cita":"Beacons that have damaged the structure of the vehicle through their fitment or removal"},
      {"zona":"faros_y_pilotos","dano":"Faros o luces añadidos","no_se_cobra":"Bien instalados, funcionando perfectamente y sin daños; deben cumplir la ley y, si lo exige, constar en la documentación del vehículo.","se_cobra":"La guía no lo lista como «no aceptable»; lo pone como requisito.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":11,"cita":"Los faros o luces deben estar instalados correctamente, en perfecto estado de funcionamiento"},
      {"zona":"zona_de_carga","dano":"Arañazos, rozaduras y deformaciones dentro del área de carga","no_se_cobra":"Todos, siempre que no impidan que las puertas funcionen ni se vean desde fuera.","se_cobra":"Daños dentro del área de carga que se vean desde el exterior.","medida":null,"maximo":null,"condicion":"Que no interfieran con las puertas y que no se vean desde fuera.","aplica_a":"furgoneta","pagina":5,"cita":"siempre que éstos no interfieran en el funcionamiento de las puertas ni se puedan ver"},
      {"zona":"zona_de_carga","dano":"Abrasiones, abolladuras y golpes en umbrales o paredes del área de carga","no_se_cobra":"Aceptables si no impiden el funcionamiento del compartimento ni se ven desde fuera.","se_cobra":"Si interfieren con el compartimento o se ven desde el exterior.","medida":null,"maximo":null,"condicion":"Que no afecten al compartimento y que no se vean desde fuera.","aplica_a":"furgoneta","pagina":5,"cita":"Abrasiones, abolladuras y golpes en los umbrales o en las paredes del área de carga"},
      {"zona":"zona_de_carga","dano":"Daños en la zona de carga con óxido","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Abolladuras, rozaduras y arañazos en la zona de carga con corrosión.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":5,"cita":"Abolladuras, rozaduras y arañazos en la zona de carga con corrosión"},
      {"zona":"zona_de_carga","dano":"Suelo de carga","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Agujeros en el suelo de carga o deformaciones importantes; desgarros, roturas o piezas del suelo que falten.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":5,"cita":"Orificios en el suelo de carga o deformaciones importantes"},
      {"zona":"zona_de_carga","dano":"Pasos de rueda y señales de carga mal sujeta","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Deformación de la carcasa de la rueda (paso de rueda) y señales de carga inadecuada o mercancía mal protegida.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":5,"cita":"Deformaciones de la carcasa de la rueda e indicios de cargas inadecuadas"},
      {"zona":"zona_de_carga","dano":"Revestimiento interior y mamparas del área de carga","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Revestimiento dañado, abollado o roto que limite el uso de puertas, ventanas o accesorios; revestimientos o mamparas (paredes de división) que falten.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":5,"cita":"Pérdida de revestimientos interiores o de paredes de división."},
      {"zona":"zona_de_carga","dano":"Deformación de carrocería, mamparas, puertas o ventanas del compartimento","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Deformaciones que interfieran con la función de los compartimentos.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":5,"cita":"que interfieran con la función de los compartimientos"},
      {"zona":"zona_de_carga","dano":"Accesorios añadidos en el área de carga","no_se_cobra":"Accesorios dejados en el vehículo si están bien instalados y cumplen la normativa del vehículo.","se_cobra":"La guía no lo detalla.","medida":null,"maximo":null,"condicion":"Bien instalados y conforme a la normativa del vehículo.","aplica_a":"furgoneta","pagina":5,"cita":"Accesorios adicionales dejados en el vehículo, siempre que se encuentren correctamente instalados"},
      {"zona":"zona_de_carga","dano":"Rozaduras en los umbrales del compartimento de carga","no_se_cobra":"Rozaduras, arañazos o abrasiones que no hayan afectado al funcionamiento de parachoques, luces, etc.","se_cobra":"Las mismas, si sí afectan al funcionamiento de parachoques, luces, etc.","medida":null,"maximo":null,"condicion":"Que no afecten a parachoques, luces, etc.","aplica_a":"furgoneta","pagina":6,"cita":"no hayan afectado al funcionamiento de los parachoques, luces, etc."},
      {"zona":"zona_de_carga","dano":"Abrasiones en los umbrales de las puertas trasera o lateral","no_se_cobra":"Si no afectan al funcionamiento de las puertas.","se_cobra":"Si afectan al funcionamiento de las puertas.","medida":null,"maximo":null,"condicion":"Que las puertas sigan funcionando bien.","aplica_a":"furgoneta","pagina":6,"cita":"Abrasiones en los umbrales de las puertas trasera o lateral de los compartimientos"},
      {"zona":"zona_de_carga","dano":"Umbral deformado y juntas de puerta","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Daños que hayan deformado el umbral; juntas de puertas dañadas.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":6,"cita":"Daños que hayan deformado el umbral"},
      {"zona":"interior","dano":"Suciedad y manchas en tapicería, asientos, moquetas y alfombrillas","no_se_cobra":"Las que se quiten con una limpieza general.","se_cobra":"Las que no se quiten con una limpieza general y necesiten limpieza especializada.","medida":null,"maximo":null,"condicion":"Que salgan con una limpieza general.","aplica_a":"furgoneta","pagina":12,"cita":"que se puedan eliminar mediante una limpieza general"},
      {"zona":"interior","dano":"Desgaste de asientos y tapicería","no_se_cobra":"Asientos con deformaciones y desgaste por el uso normal.","se_cobra":"Cortes, abrasiones, rasgaduras y deformaciones del material de revestimientos, asientos, moquetas y alfombrillas.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":12,"cita":"Cortes, abrasiones, rasgaduras y deformaciones del material de los revestimientos interiores"},
      {"zona":"interior","dano":"Decoloración de paneles interiores","no_se_cobra":"Decoloración de los paneles por el uso diario.","se_cobra":"La guía no pone caso que se cobre.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":12,"cita":"Decoloración de los paneles debido al uso y desgaste cotidiano"},
      {"zona":"interior","dano":"Agujeros en el salpicadero o la consola","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Agujeros en la consola por haber quitado equipos.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":12,"cita":"Orificios presentes en la consola debido a la extracción de equipos"},
      {"zona":"interior","dano":"Volante","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Cortes, agujeros o piezas sueltas en el volante.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":12,"cita":"Cortes, agujeros o elementos sueltos en el volante"},
      {"zona":"interior","dano":"Asientos o piezas del interior que falten","no_se_cobra":"Accesorios o soportes de teléfono olvidados en el vehículo (los acepta).","se_cobra":"Devolverlo sin asientos que se quitaron antes o sin cualquier pieza del equipamiento interior (bandejas, reposacabezas, cenicero, mechero, etc.).","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":12,"cita":"faltantes de cualquier elemento perteneciente al equipamiento interior del vehículo"},
      {"zona":"limpieza","dano":"Malos olores","no_se_cobra":"La guía no pone ningún caso aceptable.","se_cobra":"Olores desagradables que necesiten limpieza especializada para quitarlos.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":12,"cita":"Olores desagradables que requieran de limpieza especializada para ser eliminados"},
      {"zona":"limpieza","dano":"Vehículo sucio el día de la entrega","no_se_cobra":"La guía no da caso aceptable; pide entregarlo limpio por dentro y por fuera y deja al cliente decidir si hace limpieza profesional.","se_cobra":"Si está sucio el día de la entrega, la entrega puede cancelarse y puede tener que pagar una tarifa por reprogramar la recogida (sin importe).","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":4,"cita":"es posible que tenga que abonar una tarifa por la reprogramación de la recogida"},
      {"zona":"carroceria","dano":"Adhesivos publicitarios, rótulos y vinilos","no_se_cobra":"La guía no da caso aceptable: hay que quitarlos del todo, incluidos los restos de pegamento, sea cual sea su tamaño.","se_cobra":"Todos los costes de quitar adhesivos, rótulos y calcomanías (en carrocería o cristales). Remite al contrato de cada cliente.","medida":null,"maximo":null,"condicion":"Independientemente de su tamaño o estado.","aplica_a":"furgoneta","pagina":4,"cita":"Todos los costes derivados de la eliminación de los elementos anteriormente mencionados deberán ser abonados"},
      {"zona":"documentacion_y_llaves","dano":"Llaves","no_se_cobra":"Devolver todos los juegos de llaves, la principal y las de repuesto.","se_cobra":"La guía no da precio; dice que los elementos perdidos no se aceptan sea cual sea la edad o los km.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":3,"cita":"Todos los juegos de llaves, incluidas la llave principal y las de repuesto"},
      {"zona":"documentacion_y_llaves","dano":"Documentación del vehículo","no_se_cobra":"Devolver toda la documentación original: manual, libro de mantenimiento firmado/sellado, ITV en vigor (si toca), seguro con recibo pagado, tarjeta de transporte (frigoríficos, carrozados), tarjetas de código de radio, SD/CD/DVD del navegador.","se_cobra":"La guía no da precio por documentación que falte.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":3,"cita":"Toda la documentación original, como el manual del fabricante, etc."},
      {"zona":"documentacion_y_llaves","dano":"Equipamiento y accesorios entregados con el vehículo","no_se_cobra":"Devolver equipos de emergencia (gato, llave de ruedas, triángulo, botiquín), equipos de audio extraíbles y equipos opcionales no fijos (barras de remolque, bacas, contraventanas de seguridad, rieles de techo), rueda de repuesto y tornillo de seguridad.","se_cobra":"La guía no da precio; elementos perdidos no aceptables.","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":3,"cita":"Todos los equipos de emergencia suministrados con el vehículo"},
    ],
    precios: [

    ],
    proceso: {
      "quien_inspecciona": "Empresas independientes contratadas por LeasePlan: SGS Automotive y DEKRA Automotive Services; el proceso lo revisó TÜV Nord (guía, PDF p.2). La web de Ayvens dice que la peritación la hace un perito independiente y que no es inmediata.",
      "informe_al_cliente": "Sí: informe de estado con los daños que no son desgaste normal, el método de reparación y su coste, que se entrega al cliente de renting (PDF p.2-3). La guía no dice que lleve fotos. En la web de Ayvens, al entregar se firma un acta de devolución (daños exteriores, km, objetos devueltos, daños interiores no cubiertos) y hay que mandar copia a devolucionesresource.ayvens@ayvens.com; luego se hace el ajuste final (km, objetos que falten, daños no cubiertos, fianza).",
      "plazo_para_discutir": "No figura ni en la guía ni en la web de fin de contrato.",
      "se_puede_reparar_antes": "La guía no lo dice de forma expresa. Sí acepta desconchados bien retocados antes de que haya óxido, pide quitar adhesivos y láminas, reparar bien la zona si se quitan accesorios externos, y deja al cliente decidir si hace limpieza profesional. Dice que cobran por reparar en lugar de sustituir siempre que se pueda. Reparaciones mal hechas o con diferencia de color se cobran.",
      "recomendaciones_antes_de_devolver": [
        "Revisar el vehículo con la guía entera y apuntar todos los daños visibles.",
        "Tenerlo limpio por dentro y por fuera al revisarlo y el día de la entrega.",
        "Revisarlo con luz natural, sin sombras, y en seco.",
        "Mirar las abolladuras de perfil y desde varios ángulos.",
        "Revisar todos los paneles, luces, parabrisas, espejos, techo y bajo el parachoques.",
        "Ser objetivo y pedir ayuda a otra persona.",
        "Apuntar los km reales, el día y la hora exacta de la entrega.",
        "Devolver llaves, documentación, equipos y accesorios entregados con el vehículo.",
        "Quitar objetos personales y borrar direcciones guardadas en el navegador.",
        "Quitar adhesivos, rótulos y restos de pegamento.",
        "Valorar una limpieza profesional antes de devolverlo."
      ]
    },
  },
  "ayvens-turismos": {
    compania: "ayvens",
    titular: "Ayvens (antes LeasePlan)",
    nombre: "LeasePlan Fair Wear & Tear - Normativa para la devolución de Vehículos (Fair Wear & Tear Cars)",
    corto: "Normativa de devolución de turismos",
    url: "https://www.leaseplan.com/-/media/leaseplan-digital/es/publicpages/documents/normativa_devolucion_turismos.pdf",
    web: null,
    edicion: "Sin fecha en el documento · código LPES.CAR.ES-17v1",
    edicionLeida: "No figura fecha de edición en el texto. Código en el pie de la pág. 12 del PDF: «LPES.CAR.ES-17v1» (parece 2017, versión 1). Los metadatos del PDF tienen fechas de marzo a mayo de 2017. Marca LeasePlan (anterior a Ayvens).",
    paginas: 13,
    paginasNota: "Las páginas son las del archivo PDF; cada una lleva dos páginas impresas.",
    aplica_a: "turismo",
    reglas: [
      {"zona":"carroceria","dano":"Desconchados y arañazos en carrocería","no_se_cobra":"Desconchados y arañazos de hasta 10 cm que se puedan eliminar con un pulido mecánico","se_cobra":"Marcas y arañazos de más de 10 cm, y cualquier marca o arañazo que no se pueda eliminar con pulido mecánico","medida":{"que":"largo","limite":10,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Que se pueda eliminar mediante pulido mecánico","aplica_a":"turismo","pagina":5,"cita":"Todos los desconchados y arañazos de hasta 10 cm que se puedan eliminar"},
      {"zona":"carroceria","dano":"Rozaduras y abrasiones en carrocería","no_se_cobra":"Rozaduras y abrasiones de hasta 2 cm que se puedan eliminar con un pulido mecánico","se_cobra":"Rozaduras y abrasiones de más de 2 cm, y las que no se puedan eliminar con pulido mecánico","medida":{"que":"largo","limite":2,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Que se pueda eliminar mediante pulido mecánico","aplica_a":"turismo","pagina":5,"cita":"Rozaduras y abrasiones de hasta 2 cm que se puedan eliminar mediante un pulido mecánico"},
      {"zona":"carroceria","dano":"Abolladuras en carrocería","no_se_cobra":"Abolladuras de hasta 2 cm, siempre que no haya más de dos por panel","se_cobra":"Abolladuras de más de 2 cm, o más de dos abolladuras por panel","medida":{"que":"otro","limite":2,"unidad":"cm","sentido":"hasta"},"maximo":"2 por panel","condicion":"La guía dice solo «de hasta 2 cm» y no aclara si es diámetro, largo o la parte más ancha de la abolladura","aplica_a":"turismo","pagina":5,"cita":"Abolladuras de hasta 2 cm, siempre que no haya más de dos abolladuras por panel"},
      {"zona":"pintura","dano":"Marcas de gravilla (picotazos) en un panel","no_se_cobra":"Zonas de marcas de gravilla que afecten a menos del 25 % del panel y sin corrosión","se_cobra":"Marcas de gravilla que cubran más del 25 % del panel","medida":{"que":"superficie","limite":25,"unidad":"por_ciento","sentido":"menos_de"},"maximo":null,"condicion":"Sin corrosión; el porcentaje es sobre la superficie del panel","aplica_a":"turismo","pagina":5,"cita":"afecten a menos del 25% del panel y en los que no haya aparecido corrosión"},
      {"zona":"pintura","dano":"Retoques y reparaciones de pintura","no_se_cobra":"Marcas retocadas correctamente antes de que aparezca corrosión","se_cobra":"Reparaciones de pintura incorrectas con diferencia de color apreciable, y trabajos de reparación incorrectos","medida":null,"maximo":null,"condicion":"Retoque bien hecho y antes de la corrosión","aplica_a":"turismo","pagina":5,"cita":"Marcas que se hayan retocado correctamente antes de que se produzca corrosión"},
      {"zona":"carroceria","dano":"Corrosión en cualquier daño","no_se_cobra":"Nada: no hay tolerancia si hay corrosión","se_cobra":"Abolladuras, rozaduras o arañazos con corrosión; presencia de corrosión en cualquier tipo de daño","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":5,"cita":"Presencia de corrosión en cualquier tipo de daño"},
      {"zona":"pintura","dano":"Decoloración y cambios de color de la pintura","no_se_cobra":"La guía no da tolerancia para la carrocería","se_cobra":"Decoloración de la pintura por impactos externos, y cambios respecto al color original no previstos en el contrato","medida":null,"maximo":null,"condicion":"El cambio de color se cobra si no está contemplado en el contrato","aplica_a":"turismo","pagina":5,"cita":"Decoloración de la pintura debido a impactos externos"},
      {"zona":"paragolpes","dano":"Marcas y arañazos en rejilla y paragolpes pintados","no_se_cobra":"Marcas y arañazos de hasta 10 cm que se puedan eliminar con pulido mecánico","se_cobra":"Marcas y arañazos de más de 10 cm; en paragolpes pintados, cualquier marca, arañazo, rozadura o abrasión que no salga con pulido mecánico","medida":{"que":"largo","limite":10,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Que se pueda eliminar mediante pulido mecánico","aplica_a":"turismo","pagina":6,"cita":"Marcas y arañazos de hasta 10 cm que se puedan eliminar mediante un pulido mecánico"},
      {"zona":"paragolpes","dano":"Marcas y arañazos en paragolpes con relieve o sin pintar","no_se_cobra":"Arañazos y marcas de hasta 10 cm (aquí la guía no exige que salgan con pulido)","se_cobra":"Marcas y arañazos de más de 10 cm","medida":{"que":"largo","limite":10,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Paragolpes con relieve (texturizado) o no pintado","aplica_a":"turismo","pagina":6,"cita":"parachoques con relieve o no pintados: resultan aceptables arañazos y marcas de hasta 10 cm"},
      {"zona":"paragolpes","dano":"Rozaduras y abrasiones en rejilla y paragolpes pintados","no_se_cobra":"Rozaduras y abrasiones de hasta 2 cm que se puedan eliminar con pulido mecánico","se_cobra":"Rozaduras y abrasiones de más de 2 cm, o que no salgan con pulido mecánico","medida":{"que":"largo","limite":2,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Que se pueda eliminar mediante pulido mecánico","aplica_a":"turismo","pagina":6,"cita":"Rozaduras y abrasiones de hasta 2 cm, que se puedan eliminar mediante un pulido mecánico"},
      {"zona":"paragolpes","dano":"Rozaduras y abrasiones en paragolpes con relieve o sin pintar","no_se_cobra":"Rozaduras y abrasiones de hasta 2 cm","se_cobra":"Rozaduras y abrasiones de más de 2 cm","medida":{"que":"largo","limite":2,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Paragolpes con relieve (texturizado) o no pintado","aplica_a":"turismo","pagina":6,"cita":"resultan aceptables rozaduras y abrasiones de hasta 2 cm"},
      {"zona":"paragolpes","dano":"Abolladuras en rejilla y paragolpes","no_se_cobra":"Abolladuras de hasta 2 cm, con un máximo de 2 por paragolpes o rejilla","se_cobra":"Abolladuras de más de 2 cm, o más de dos por rejilla o paragolpes","medida":{"que":"otro","limite":2,"unidad":"cm","sentido":"hasta"},"maximo":"2 por paragolpes o rejilla","condicion":"La guía dice solo «de hasta 2 cm» y no aclara si es diámetro, largo o la parte más ancha de la abolladura","aplica_a":"turismo","pagina":6,"cita":"Abolladuras de hasta 2 cm, con un máximo de 2 abolladuras por parachoques o rejilla"},
      {"zona":"paragolpes","dano":"Roturas, grietas y deformaciones de rejilla y paragolpes","no_se_cobra":"Nada","se_cobra":"Rejillas y paragolpes rotos, agrietados o deformados","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":6,"cita":"Rejillas y parachoques rotos, agrietados o deformados"},
      {"zona":"paragolpes","dano":"Decoloración y daños químicos en rejilla y paragolpes","no_se_cobra":"Decoloración por impactos externos, por ejemplo la climatología","se_cobra":"Daños causados por el uso incorrecto de productos químicos","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":6,"cita":"Decoloración debido a impactos externos, por ejemplo, a la climatología"},
      {"zona":"llantas","dano":"Arañazos, rozaduras o abrasiones en llanta o tapacubos","no_se_cobra":"Como máximo un arañazo, rozadura o abrasión de hasta 10 cm, si la llanta o tapacubos no está deformado","se_cobra":"Arañazos, rozaduras o abrasiones de más de 10 cm; más de uno; llanta o tapacubos deformado","medida":{"que":"largo","limite":10,"unidad":"cm","sentido":"hasta"},"maximo":"1 por llanta o tapacubos","condicion":"Que la llanta o tapacubos no esté deformado. «Más de uno» se cobra porque lo aceptable es «como máximo un»; la columna «No aceptable» no lo repite","aplica_a":"turismo","pagina":7,"cita":"En la llanta o tapacubos: como máximo un arañazo, rozadura o abrasión"},
      {"zona":"llantas","dano":"Arañazos, rozaduras o abrasiones en el borde de la llanta o tapacubos","no_se_cobra":"Como máximo un arañazo, rozadura o abrasión de hasta 10 cm en el borde, si no está deformado","se_cobra":"Arañazos, rozaduras o abrasiones de más de 10 cm; más de uno; llanta o tapacubos deformado","medida":{"que":"largo","limite":10,"unidad":"cm","sentido":"hasta"},"maximo":"1 por llanta o tapacubos","condicion":"Que la llanta o tapacubos no esté deformado. «Más de uno» se cobra porque lo aceptable es «como máximo un»; la columna «No aceptable» no lo repite","aplica_a":"turismo","pagina":7,"cita":"En el borde de la llanta o tapacubos: como máximo un arañazo, rozadura o abrasión"},
      {"zona":"llantas","dano":"Roturas, deformación y corrosión de llanta o tapacubos","no_se_cobra":"Nada","se_cobra":"Tapacubos, llanta o aleación rotos o deformados; corrosión en tapacubos, llanta o aleación","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":7,"cita":"Tapacubos, llanta o aleación rotos o deformados"},
      {"zona":"llantas","dano":"Tapacubos desparejados o que faltan","no_se_cobra":"Devolver los tapacubos iguales","se_cobra":"Devolución sin los tapacubos iguales","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":7,"cita":"Devoluciones sin los tapacubos iguales"},
      {"zona":"neumaticos","dano":"Profundidad de la banda de rodadura","no_se_cobra":"Neumáticos con una banda de rodadura de 1,6 mm como mínimo, o que cumpla los requisitos legales locales","se_cobra":"La guía no lo escribe aparte en «No aceptable»; se deduce que por debajo de 1,6 mm (o del mínimo legal local) no es aceptable","medida":null,"maximo":null,"condicion":"Mínimo de 1,6 mm (no un máximo): se acepta de 1,6 mm hacia arriba. Se deja medida null porque «hasta»/«menos de» no expresan un mínimo","aplica_a":"turismo","pagina":7,"cita":"Neumáticos con una banda de rodadura mínima de 1,6 mm"},
      {"zona":"neumaticos","dano":"Daños en neumáticos","no_se_cobra":"Nada (solo el desgaste de la banda dentro del mínimo)","se_cobra":"Neumáticos deformados por choque con bordillos u objetos; salientes, grietas o cortes; daños en flancos o banda de rodadura; neumáticos con objetos clavados","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":7,"cita":"Salientes, grietas o cortes en los neumáticos"},
      {"zona":"neumaticos","dano":"Kit de reparación de neumáticos o rueda de repuesto que faltan","no_se_cobra":"Kit (sellador y compresor de 12 V) completo y que funcione, o rueda de repuesto dentro del coche si se entregó con ella","se_cobra":"Devolución sin el kit de reparación, con partes del kit que faltan y/o sin la rueda de repuesto","medida":null,"maximo":null,"condicion":"La rueda de repuesto solo si el vehículo se entregó con ella","aplica_a":"turismo","pagina":7,"cita":"el kit de reparación de neumáticos o con ausencias de algunas partes del mismo"},
      {"zona":"neumaticos","dano":"Neumáticos de invierno o de verano incluidos en el contrato","no_se_cobra":"Devolver el juego completo de 4 ruedas, con pernos y llantas","se_cobra":"La guía no dice el importe; remite al contrato local para el método de devolución","medida":null,"maximo":null,"condicion":"Solo si el contrato incluye neumáticos de invierno (o de verano si se devuelve en invierno)","aplica_a":"turismo","pagina":4,"cita":"deberá devolverse el juego completo de 4 ruedas, incluidos los pernos y las llantas"},
      {"zona":"lunas","dano":"Impactos y grietas en el parabrisas","no_se_cobra":"Marcas o grietas de no más de 1 cm, contando el impacto y sus ramificaciones, fuera de la zona A del parabrisas","se_cobra":"Marcas o grietas de más de 1 cm en el parabrisas; en la zona A, también las grietas de menos de 1 cm","medida":{"que":"largo","limite":1,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Que no esté en la «parte A» (o «zona A») del parabrisas; la guía no define esa zona. La medida cuenta el impacto y sus ramificaciones","aplica_a":"turismo","pagina":8,"cita":"no presenten una longitud superior a 1 cm tanto el impacto como sus ramificaciones"},
      {"zona":"lunas","dano":"Cristales rotos","no_se_cobra":"Nada","se_cobra":"Cristales rotos, sea cual sea la edad o el kilometraje del vehículo","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":8,"cita":"Cristales o luces rotos"},
      {"zona":"lunas","dano":"Láminas solares, bandas tintadas y adhesivos en cristales","no_se_cobra":"Pequeños adhesivos en el cristal que exija la ley local","se_cobra":"Hay que quitar del parabrisas la protección solar o bandas tintadas no instaladas por un profesional, rotas o despegándose en las esquinas","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":8,"cita":"Pequeños adhesivos en el cristal requeridos por la legislación local"},
      {"zona":"faros_y_pilotos","dano":"Marcas de gravilla, grietas y roturas en faros, pilotos, antiniebla e intermitentes","no_se_cobra":"Marcas de gravilla en la superficie de luces, antinieblas o intermitentes que no rompan el cristal ni impidan su funcionamiento","se_cobra":"Luces rotas; grietas o marcas que impidan que la luz funcione bien; todas las bombillas deben funcionar","medida":null,"maximo":null,"condicion":"Sin rotura del cristal y funcionando","aplica_a":"turismo","pagina":8,"cita":"no provoquen la rotura del cristal y no impidan su funcionamiento"},
      {"zona":"retrovisores","dano":"Rozaduras y arañazos en carcasa de retrovisor pintada","no_se_cobra":"Rozaduras y arañazos de hasta 5 cm que se puedan eliminar con pulido mecánico","se_cobra":"Rozaduras y arañazos de más de 5 cm, o arañazos que no salgan con pulido mecánico","medida":{"que":"largo","limite":5,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Que se pueda eliminar mediante pulido mecánico","aplica_a":"turismo","pagina":9,"cita":"Carcasas de espejos pintadas: rozaduras y arañazos de hasta 5 cm"},
      {"zona":"retrovisores","dano":"Rozaduras, arañazos y marcas en carcasa de retrovisor con relieve o sin pintar","no_se_cobra":"Rozaduras, arañazos y marcas de hasta 5 cm","se_cobra":"Rozaduras, arañazos y marcas de más de 5 cm","medida":{"que":"largo","limite":5,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Carcasa con relieve o no pintada","aplica_a":"turismo","pagina":9,"cita":"con relieve o no pintadas: rozaduras, arañazos y marcas de hasta 5 cm"},
      {"zona":"retrovisores","dano":"Retrovisor o carcasa deformados o rotos","no_se_cobra":"Nada","se_cobra":"Deformación o rotura del espejo y/o de la carcasa","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":9,"cita":"Deformación o rotura del espejo y/o de la carcasa del espejo"},
      {"zona":"otros","dano":"Bola o barra de remolque","no_se_cobra":"Devolver el vehículo con las barras de remolque intactas","se_cobra":"Daños causados al quitar la barra de remolque","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":9,"cita":"Daños ocasionados debido a la extracción de la barra de remolque"},
      {"zona":"otros","dano":"Faros o luces añadidos (accesorios)","no_se_cobra":"Faros o luces bien instalados, funcionando, sin daños, legales y, si la ley lo pide, reflejados en la documentación","se_cobra":"Faros que hayan dañado la estructura del vehículo al instalarlos o quitarlos","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":9,"cita":"Faros que hayan dañado la estructura del vehículo durante su instalación o retirada"},
      {"zona":"otros","dano":"Adhesivos publicitarios, rótulos y calcomanías","no_se_cobra":"Nada: deben quitarse todos, incluidos los restos de pegamento","se_cobra":"Todos los costes de quitarlos (carrocería o cristales), sea cual sea su tamaño o estado; remite al contrato local","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":4,"cita":"deben eliminarse por completo antes de la venta del vehículo"},
      {"zona":"interior","dano":"Suciedad y manchas en asientos, revestimientos, moquetas y alfombrillas","no_se_cobra":"Suciedad y manchas que salgan con una limpieza general","se_cobra":"Suciedad y manchas que no salgan con limpieza general y necesiten limpieza especializada","medida":null,"maximo":null,"condicion":"Que se elimine con limpieza general","aplica_a":"turismo","pagina":10,"cita":"que se puedan eliminar mediante una limpieza general"},
      {"zona":"interior","dano":"Desgaste de asientos y cortes o rasgaduras en revestimientos, alfombras y alfombrillas","no_se_cobra":"Asientos con deformaciones y desgaste por el uso general","se_cobra":"Cortes, abrasiones, rasgaduras y deformaciones del material de los revestimientos interiores, alfombras y alfombrillas","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":10,"cita":"Asientos con deformaciones y desgaste provocados por el uso general"},
      {"zona":"interior","dano":"Decoloración de paneles interiores","no_se_cobra":"Decoloración de los paneles por el uso y desgaste diario","se_cobra":"La guía no da caso cobrable","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":10,"cita":"Decoloración de los paneles debido al uso y desgaste cotidiano"},
      {"zona":"interior","dano":"Soportes de teléfono y agujeros en la consola","no_se_cobra":"Soportes o carcasas de teléfono olvidados, si no han dañado el vehículo","se_cobra":"Agujeros en la consola por quitar equipos","medida":null,"maximo":null,"condicion":"Que no hayan producido daño","aplica_a":"turismo","pagina":10,"cita":"Orificios presentes en la consola debido a la extracción de equipos"},
      {"zona":"interior","dano":"Volante dañado","no_se_cobra":"Nada","se_cobra":"Cortes, agujeros o piezas sueltas en el volante","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":10,"cita":"Cortes, agujeros o elementos sueltos en el volante"},
      {"zona":"interior","dano":"Elementos interiores que faltan","no_se_cobra":"Nada","se_cobra":"Asientos quitados o cualquier elemento del equipamiento interior que falte (bandejas, reposacabezas, cenicero, mechero, etc.)","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":10,"cita":"faltantes de cualquier elemento perteneciente al equipamiento interior del vehículo"},
      {"zona":"limpieza","dano":"Olores desagradables","no_se_cobra":"La guía no da tolerancia","se_cobra":"Olores desagradables que necesiten limpieza especializada para quitarse","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":10,"cita":"Olores desagradables que requieran de limpieza especializada para ser eliminados"},
      {"zona":"limpieza","dano":"Vehículo sucio el día de la entrega","no_se_cobra":"Vehículo limpio por dentro y por fuera","se_cobra":"Si está sucio, la entrega puede cancelarse y quizá haya que pagar una tarifa por reprogramar la recogida (sin importe en la guía)","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":4,"cita":"es posible que tenga que abonar una tarifa por la reprogramación de la recogida"},
      {"zona":"documentacion_y_llaves","dano":"Llaves, documentación y equipamiento que hay que devolver","no_se_cobra":"Devolver todo lo entregado con el coche: todos los juegos de llaves (principal y repuesto), documentación original (manual), libro de mantenimiento sellado, ITV válida si corresponde, seguro y recibo pagado, tarjetas de código de radio, SD/CD/DVD del navegador, equipos de audio extraíbles, equipos opcionales no fijos, equipo de emergencia (gato, llave de ruedas, triángulo, botiquín), rueda de repuesto y tornillo de seguridad, kit de reparación de neumáticos, tapacubos iguales","se_cobra":"Los elementos perdidos no son aceptables sea cual sea la edad o el kilometraje (la guía no da precios)","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":3,"cita":"Todos los juegos de llaves, incluidas la llave principal y las de repuesto"},
    ],
    precios: [

    ],
    proceso: {
      "quien_inspecciona": "Empresas independientes contratadas por LeasePlan: SGS Automotive y DEKRA Automotive Services; el proceso está revisado por TÜV Nord (pág. 2 del PDF)",
      "informe_al_cliente": "Sí: se hace un informe de estado (daños no aceptables como desgaste normal, con método y coste de reparación) y un informe de tasación, que se entregan a los clientes de renting. La guía no dice que lleve fotos (págs. 2 y 3)",
      "plazo_para_discutir": "La guía no lo dice",
      "se_puede_reparar_antes": "La guía no lo dice de forma general. Acepta marcas retocadas correctamente antes de la corrosión y cobra las reparaciones de pintura mal hechas (con diferencia de color). Recomienda valorar una limpieza profesional antes de devolver. LeasePlan dice que cobrará por reparar en lugar de sustituir siempre que pueda",
      "recomendaciones_antes_de_devolver": [
        "Usar la guía entera para revisar el coche y apuntar los daños visibles antes de la entrega",
        "Revisar el coche limpio por dentro y por fuera; si está sucio la entrega puede cancelarse",
        "Revisarlo con luz natural, sin sombras de árboles",
        "Revisarlo seco, no recién lavado ni con lluvia",
        "Buscar abolladuras mirando el coche de perfil y desde varios ángulos",
        "Revisar todos los paneles, luces, parabrisas, espejos, techo y bajos del paragolpes",
        "Ser objetivo; pedir ayuda a un amigo o conocido",
        "Quitar adhesivos publicitarios, rótulos y restos de pegamento",
        "Valorar una limpieza completa por una empresa profesional",
        "Devolver llaves, documentación, equipo de emergencia, rueda de repuesto o kit y tapacubos iguales",
        "Borrar del navegador las direcciones guardadas, como la de casa",
        "Retirar los objetos personales (revisar maletero, guantera, puertas, respaldos); no se devuelven después",
        "Anotar los kilómetros reales, el día y la hora exacta de la entrega en el punto autorizado"
      ]
    },
  },
  "alphabet": {
    compania: "alphabet",
    titular: "Alphabet",
    nombre: "Guía de uso y desgaste",
    corto: "Guía de uso y desgaste",
    url: "https://www.alphabet.com/content/dam/rcss/alphabetweb/alphabet_com/es_ES/guia-uso-y-desgaste/22052026_GuiaUsoYDesgaste.pdf",
    web: null,
    edicion: "Versión 1.1, 01/04/2026",
    edicionLeida: "Versión 1.1, 01/04/2026 (pie de todas las páginas). El nombre del archivo lleva la fecha 22052026.",
    paginas: 34,
    paginasNota: "Las páginas son las del pie del documento, que coinciden con las del PDF.",
    aplica_a: "ambos",
    reglas: [
      {"zona":"interior","dano":"Desgaste normal del habitáculo (mandos, molduras, plásticos)","no_se_cobra":"Deterioros por defecto de material en mandos, molduras, plásticos, etc., acordes a los kilómetros y sin roturas","se_cobra":"Si el origen es una fuente de calor externa o un agente externo, o hay roturas","medida":null,"maximo":null,"condicion":"Que no se deba a una fuente de calor externa o a un agente externo","aplica_a":"ambos","pagina":8,"cita":"Los deterioros por defecto de material, tanto en mandos, molduras, plásticos"},
      {"zona":"interior","dano":"Roces leves en el habitáculo","no_se_cobra":"Roces leves sin pérdida de material, no repetitivos en la misma pieza o zona","se_cobra":"Roces con pérdida de material o repetidos en la misma pieza o zona","medida":null,"maximo":null,"condicion":"Sin pérdida de material y no repetitivos en la misma pieza/zona","aplica_a":"ambos","pagina":8,"cita":"Los roces leves que no supongan pérdida de material, siempre y cuando no sean repetitivos"},
      {"zona":"interior","dano":"Roturas, rayados, quemaduras y deformaciones del habitáculo","no_se_cobra":"Nada, salvo que el daño ya estuviera en la entrega","se_cobra":"Todo daño que no tenía el vehículo al entregarse; ejemplos con foto: techo roto, asiento roto, revestimientos de puerta o pilar rayados, rotos o deformados, fuelle de palanca roto, embellecedor roto, quemaduras en moqueta, asiento, techo o puerta. También los daños de transformaciones sin autorización","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":9,"cita":"aquellos que no presentaba el vehículo en el momento de la entrega"},
      {"zona":"interior","dano":"Otros daños interiores","no_se_cobra":"No lo dice","se_cobra":"Ejemplos: falta de material, bandejas cóncavas o deformadas, aireadores rotos, grietas en cuero, arañazos en revestimientos de asientos o consolas traseras, accesorios rotos, ajuste de piezas, gomas o juntas, documentación o manuales, daños en cinturones","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":22,"cita":"Ejemplos de otros daños facturables"},
      {"zona":"zona_de_carga","dano":"Roces y arañazos en la zona de carga (vehículos no industriales)","no_se_cobra":"Roces y arañazos superficiales o leves en revestimientos, paneles interiores y chapa causados por la carga","se_cobra":"(página 13) Falta de material en la pieza, o más de un arañazo, corte o picadura en la misma pieza; daños por uso incorrecto o manipulación indebida","medida":null,"maximo":"Más de un arañazo, corte o picadura en una misma pieza se cobra (página 13)","condicion":"Sin reparación o sustitución por pérdida o deformación del material y sin acumulación excesiva","aplica_a":"turismo","pagina":11,"cita":"No serán facturables los roces y arañazos superficiales o leves"},
      {"zona":"zona_de_carga","dano":"Daños de chapa interior en zona de carga (vehículos no industriales)","no_se_cobra":"Zona dañada que no supera el 10% de la pieza y sin abolladuras ni deformaciones","se_cobra":"Si supera el 10% de la pieza o hay abolladura o deformación (para no industriales la guía solo da el lado de lo que no se cobra)","medida":{"que":"superficie","limite":10,"unidad":"por_ciento","sentido":"hasta"},"maximo":null,"condicion":"Sin abolladuras ni deformaciones en la pieza","aplica_a":"turismo","pagina":11,"cita":"cuando la zona dañada no supere el 10% de la pieza"},
      {"zona":"zona_de_carga","dano":"Roces y arañazos en la zona de carga (vehículos industriales)","no_se_cobra":"Roces y arañazos superficiales o leves en revestimientos, paneles interiores y chapa causados por la carga","se_cobra":"Cuando implican reparación o sustitución por pérdida o deformación del material, o hay acumulación excesiva","medida":null,"maximo":null,"condicion":"Sin reparación o sustitución por pérdida o deformación del material y sin acumulación excesiva","aplica_a":"furgoneta","pagina":15,"cita":"No serán facturables los roces y arañazos superficiales o leves"},
      {"zona":"zona_de_carga","dano":"Daños de chapa interior en zona de carga (vehículos industriales)","no_se_cobra":"Zona afectada que no supera el 10% de la pieza y sin abolladuras ni deformaciones","se_cobra":"Daños en superficies que superen el 10% de la superficie de la pieza (página 16)","medida":{"que":"superficie","limite":10,"unidad":"por_ciento","sentido":"hasta"},"maximo":null,"condicion":"Sin abolladuras ni deformaciones en la pieza","aplica_a":"furgoneta","pagina":15,"cita":"cuando la zona afectada no supere el 10% de la pieza"},
      {"zona":"zona_de_carga","dano":"Rotura del revestimiento del suelo de carga","no_se_cobra":"Una única y pequeña rotura localizada que no supere 25 cm2","se_cobra":"Si hay más de una rotura o supera 25 cm2","medida":{"que":"superficie","limite":25,"unidad":"cm2","sentido":"hasta"},"maximo":"Una única rotura","condicion":"Única, pequeña y localizada, en el revestimiento del suelo","aplica_a":"furgoneta","pagina":15,"cita":"rotura localizada en el revestimiento de suelo si no supera un área de 25 cm2"},
      {"zona":"zona_de_carga","dano":"Arañazos con pérdida de pintura o material en la zona de carga (largo)","no_se_cobra":"Hasta 100 mm de largo (y hasta 5 mm de ancho), por extensión o acumulación","se_cobra":"Más de 100 mm de largo y/o más de 5 mm de ancho, por extensión o acumulación","medida":{"que":"largo","limite":100,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":"Solo arañazos con pérdida de pintura o material; se suman por acumulación; además, ancho máximo 5 mm","aplica_a":"furgoneta","pagina":16,"cita":"que superen los 100 mm de longitud y/o los 5 mm de anchura"},
      {"zona":"zona_de_carga","dano":"Arañazos con pérdida de pintura o material en la zona de carga (ancho)","no_se_cobra":"Hasta 5 mm de ancho (y hasta 100 mm de largo)","se_cobra":"Más de 5 mm de ancho, por extensión o acumulación","medida":{"que":"ancho","limite":5,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":"Solo arañazos con pérdida de pintura o material; se suman por acumulación; además, largo máximo 100 mm","aplica_a":"furgoneta","pagina":16,"cita":"que superen los 100 mm de longitud y/o los 5 mm de anchura"},
      {"zona":"zona_de_carga","dano":"Cortes, desgarros, agujeros o taladros en la zona de carga","no_se_cobra":"No lo dice","se_cobra":"Cortes, desgarros, agujeros o taladros con falta de material","medida":null,"maximo":null,"condicion":"Que impliquen falta de material","aplica_a":"furgoneta","pagina":16,"cita":"Cortes, desgarros y agujeros o taladros que impliquen la falta de material"},
      {"zona":"zona_de_carga","dano":"Abolladuras en piezas interiores de la zona de carga","no_se_cobra":"No lo dice","se_cobra":"Abolladuras que implican reparación y pintura","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":16,"cita":"Abolladuras en las piezas interiores que implican reparación y pintura"},
      {"zona":"zona_de_carga","dano":"Daños que impiden el uso de puertas, ventanas y otros elementos","no_se_cobra":"No lo dice","se_cobra":"Daños del interior que afecten al funcionamiento o uso de puertas, ventanas y otros elementos","medida":null,"maximo":null,"condicion":null,"aplica_a":"furgoneta","pagina":16,"cita":"Daños del interior que afecten al funcionamiento o uso de puertas, ventanas"},
      {"zona":"limpieza","dano":"Suciedad y manchas en moquetas, asientos, techo y tejidos","no_se_cobra":"Suciedad y manchas que salen con una limpieza general básica; aspirado del vehículo","se_cobra":"(página 20) Limpieza especializada de manchas y olores, aspirado de pelo de animal, suciedad o basura que pida aspirado exhaustivo. Si son varias piezas, cuenta como limpieza alta","medida":null,"maximo":null,"condicion":"Si sale con limpieza básica (agua y jabón) no se cobra","aplica_a":"ambos","pagina":19,"cita":"Limpieza de la suciedad y de las manchas que salgan con una limpieza general básica"},
      {"zona":"lunas","dano":"Marcas o grietas en el parabrisas fuera de la zona A","no_se_cobra":"Marcas o grietas de hasta 1 cm (impacto más ramificaciones) fuera de la zona A","se_cobra":"Más de 1 cm, o la suma de los daños supera 1 cm","medida":{"que":"largo","limite":1,"unidad":"cm","sentido":"hasta"},"maximo":"La suma de los daños no puede superar 1 cm","condicion":"Fuera de la zona A (zona de visión del conductor); cuenta el impacto y sus ramificaciones","aplica_a":"ambos","pagina":28,"cita":"no presenten una longitud superior a 1 cm tanto el impacto como sus ramificaciones"},
      {"zona":"lunas","dano":"Impactos en la zona A del parabrisas","no_se_cobra":"Ninguno","se_cobra":"Cualquier impacto, aunque mida menos de 1 cm, en la zona de visión del conductor: cambio de luna","medida":null,"maximo":null,"condicion":"Dentro de la zona A (zona de visión del conductor)","aplica_a":"ambos","pagina":28,"cita":"Impactos de menos de 1 cm situados en Zona A del parabrisas"},
      {"zona":"lunas","dano":"Cristales rotos, picados u opacos","no_se_cobra":"No lo dice","se_cobra":"Cristales o luces rotos, picados, oscurecidos, dañados, con filtraciones u opacos","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":28,"cita":"Cristales o luces rotos, picados, oscurecidos, dañados, filtraciones u opacos"},
      {"zona":"faros_y_pilotos","dano":"Marcas de gravilla en faros, antiniebla e intermitentes","no_se_cobra":"Marcas de gravilla que no rompen el cristal ni impiden su funcionamiento","se_cobra":"Grietas o marcas que impiden el correcto funcionamiento; luces rotas, picadas, oscurecidas, con filtraciones u opacas","medida":null,"maximo":null,"condicion":"Que no rompan el cristal ni impidan su funcionamiento","aplica_a":"ambos","pagina":28,"cita":"Marcas provocadas por gravilla en la superficie de las luces"},
      {"zona":"llantas","dano":"Arañazos en tapacubos y llantas de chapa (largo)","no_se_cobra":"Hasta 8 cm de largo (y hasta 0,5 cm de ancho)","se_cobra":"Más de 8 cm de largo y/o más de 0,5 cm de ancho","medida":{"que":"largo","limite":8,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Además, ancho máximo 0,5 cm","aplica_a":"ambos","pagina":29,"cita":"llantas de chapa hasta 8 cm de longitud y/o 0,5 cm de anchura"},
      {"zona":"llantas","dano":"Arañazos en tapacubos y llantas de chapa (ancho)","no_se_cobra":"Hasta 0,5 cm de ancho (y hasta 8 cm de largo)","se_cobra":"Más de 0,5 cm de ancho","medida":{"que":"ancho","limite":0.5,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Además, largo máximo 8 cm","aplica_a":"ambos","pagina":29,"cita":"llantas de chapa hasta 8 cm de longitud y/o 0,5 cm de anchura"},
      {"zona":"llantas","dano":"Arañazos en llantas de aluminio (largo)","no_se_cobra":"Hasta 4 cm de largo (y 0,5 cm de ancho), máximo 2 por llanta, si se arreglan solo con pintura","se_cobra":"Golpes o arañazos de más de 4 cm de largo y/o 0,5 cm de ancho","medida":{"que":"largo","limite":4,"unidad":"cm","sentido":"hasta"},"maximo":"2 arañazos por llanta","condicion":"Subsanables aplicando solo una pintura; ancho máximo 0,5 cm","aplica_a":"ambos","pagina":29,"cita":"máximo de 2 arañazos por llanta siempre y cuando sean subsanables aplicando solo una pintura"},
      {"zona":"llantas","dano":"Arañazos en llantas de aluminio (ancho)","no_se_cobra":"Hasta 0,5 cm de ancho (y 4 cm de largo)","se_cobra":"Más de 0,5 cm de ancho","medida":{"que":"ancho","limite":0.5,"unidad":"cm","sentido":"hasta"},"maximo":"2 arañazos por llanta","condicion":"Subsanables aplicando solo una pintura; largo máximo 4 cm","aplica_a":"ambos","pagina":29,"cita":"llantas de aluminio de hasta 4 cm de longitud y/o 0,5 cm de ancho"},
      {"zona":"llantas","dano":"Número de arañazos en una llanta de aluminio","no_se_cobra":"Hasta 2 arañazos por llanta (cada uno dentro de 4 cm de largo y 0,5 cm de ancho y arreglable solo con pintura)","se_cobra":"Un tercer arañazo en la misma llanta (la guía solo da el máximo de 2, no lo dice con otras palabras)","medida":{"que":"cantidad","limite":2,"unidad":"unidades","sentido":"hasta"},"maximo":"2 arañazos por llanta","condicion":"Por llanta; arañazos subsanables aplicando solo una pintura","aplica_a":"ambos","pagina":29,"cita":"con un máximo de 2 arañazos por llanta"},
      {"zona":"llantas","dano":"Corrosión, malas reparaciones, tapacubos rotos, piezas no originales","no_se_cobra":"No lo dice","se_cobra":"Llantas con corrosión, malas reparaciones o sin reparar; tapacubos rotos o deformados; falta de tuercas y llaves antirrobo; llantas o tapacubos no originales del modelo","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":30,"cita":"Llantas que presenten corrosión, malas reparaciones o falta de reparación"},
      {"zona":"pintura","dano":"Impactos (picaduras) en laca o color","no_se_cobra":"Un impacto aislado de hasta 5 mm de diámetro; varios en la misma pieza si la suma del área no supera 5 mm de diámetro","se_cobra":"Impactos con corrosión o de más de 5 mm de diámetro (sin abolladura)","medida":{"que":"diametro","limite":5,"unidad":"mm","sentido":"hasta"},"maximo":"La suma del área de los impactos en la misma pieza no puede superar 5 mm de diámetro","condicion":"Sin corrosión; solo en las capas de laca o color","aplica_a":"ambos","pagina":31,"cita":"Un impacto aislado de 5 mm de diámetro máximo en las capas de laca"},
      {"zona":"pintura","dano":"Grupo de impactos en poca superficie","no_se_cobra":"Menos de 4 impactos en una superficie menor que un DIN A4 (la guía solo da el lado de lo que se cobra)","se_cobra":"4 o más impactos en una superficie menor que un DIN A4, sea cual sea su tamaño","medida":{"que":"cantidad","limite":4,"unidad":"unidades","sentido":"menos_de"},"maximo":"Menos de 4 impactos en una superficie menor que un DIN A4","condicion":"Superficie inferior a un DIN A4, independientemente del tamaño","aplica_a":"ambos","pagina":31,"cita":"4 o más impactos localizados en superficies inferiores a un DIN A4"},
      {"zona":"pintura","dano":"Arañazos en laca o color","no_se_cobra":"Arañazos de hasta 15 mm de largo; varios si la suma de su longitud no pasa de 15 mm","se_cobra":"Arañazos de más de 15 mm, o menores que se repiten en más de 3 ocasiones en la misma pieza","medida":{"que":"largo","limite":15,"unidad":"mm","sentido":"hasta"},"maximo":"Suma de longitudes hasta 15 mm; repetidos más de 3 veces en la misma pieza se cobran","condicion":"Solo en las capas de laca o color","aplica_a":"ambos","pagina":31,"cita":"Arañazos en las capas de laca o color siempre que no superen los 15 mm"},
      {"zona":"pintura","dano":"Arañazos pequeños repetidos en la misma pieza","no_se_cobra":"Hasta 3 arañazos menores de 15 mm en la misma pieza (y siempre que su suma no pase de 15 mm)","se_cobra":"Arañazos menores de 15 mm que se repiten en más de 3 ocasiones en la misma pieza","medida":{"que":"cantidad","limite":3,"unidad":"unidades","sentido":"hasta"},"maximo":"3 por pieza","condicion":"En la misma pieza; la suma de longitudes tampoco puede pasar de 15 mm","aplica_a":"ambos","pagina":31,"cita":"menores que se repiten en más de 3 ocasiones en la misma pieza"},
      {"zona":"pintura","dano":"Óxido","no_se_cobra":"Ninguno","se_cobra":"Cualquier tipo de óxido, en cualquier medida o lugar","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":31,"cita":"Cualquier tipo de óxido, en cualquier medida o lugar"},
      {"zona":"pintura","dano":"Pulido","no_se_cobra":"Pequeños pulidos que no superen 10 minutos de trabajo","se_cobra":"Pulidos de piezas completas, por daños o envejecimiento, o de más de 10 minutos","medida":null,"maximo":"10 minutos de trabajo","condicion":"Se mide en minutos de trabajo de pulido (el formato no tiene unidad de tiempo)","aplica_a":"ambos","pagina":31,"cita":"Pequeños trabajos de pulido que no superen los 10 minutos de trabajo"},
      {"zona":"pintura","dano":"Reparaciones mal hechas","no_se_cobra":"No lo dice","se_cobra":"Reparaciones que no llegan a los mínimos de calidad del fabricante","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":31,"cita":"Reparaciones que no superen los mínimos de calidad impuestos por fabricante"},
      {"zona":"carroceria","dano":"Abolladuras (impactos) en carrocería","no_se_cobra":"Un leve impacto de hasta 10 mm de diámetro que no afecte a la laca o color","se_cobra":"Impactos o deformaciones de más de 10 mm de diámetro; dos o más en la misma pieza aunque midan menos","medida":{"que":"diametro","limite":10,"unidad":"mm","sentido":"hasta"},"maximo":"1 por pieza: dos o más en la misma pieza se cobran aunque midan menos de 10 mm","condicion":"Que no afecte a las capas de laca o color","aplica_a":"ambos","pagina":32,"cita":"Un leve impacto de 10 mm de diámetro máximo en la carrocería"},
      {"zona":"carroceria","dano":"Número de abolladuras pequeñas en la misma pieza","no_se_cobra":"Un solo impacto leve (hasta 10 mm, sin dañar la laca) por pieza","se_cobra":"Dos o más impactos en la misma pieza, aunque cada uno mida menos de 10 mm","medida":{"que":"cantidad","limite":2,"unidad":"unidades","sentido":"menos_de"},"maximo":"1 por pieza","condicion":"En la misma pieza","aplica_a":"ambos","pagina":32,"cita":"Dos o más impactos, que aún siendo inferiores a 10 mm, se ubican en la misma pieza"},
      {"zona":"paragolpes","dano":"Roces y abrasiones en plásticos (paragolpes, molduras)","no_se_cobra":"Roces y abrasiones muy leves sin pérdida de material","se_cobra":"Roces y abrasiones con pérdida de material; deformaciones, holguras o piezas sueltas","medida":null,"maximo":null,"condicion":"Sin pérdida de material","aplica_a":"ambos","pagina":32,"cita":"Roces y abrasiones muy leves en elementos plásticos que no supongan pérdida"},
      {"zona":"retrovisores","dano":"Roces en carcasa de espejos (plástico)","no_se_cobra":"Roces y abrasiones muy leves sin pérdida de material","se_cobra":"Roces y abrasiones con pérdida de material; deformación, holgura o pieza suelta","medida":null,"maximo":null,"condicion":"Sin pérdida de material","aplica_a":"ambos","pagina":32,"cita":"Roces y abrasiones en elementos plásticos que supongan pérdida de material"},
      {"zona":"carroceria","dano":"Holguras, roturas o mal funcionamiento","no_se_cobra":"Lo que sea imputable a la garantía del vehículo","se_cobra":"Holguras, roturas o fallos no imputables a la garantía o causados por una reparación","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":32,"cita":"Holguras, roturas o un funcionamiento defectuoso no imputables a la garantía"},
      {"zona":"documentacion_y_llaves","dano":"Documentos, llaves y accesorios no devueltos","no_se_cobra":"Nada si se devuelve todo lo entregado","se_cobra":"Documentos y accesorios no devueltos (página 6); la segunda llave, por el coste íntegro del duplicado","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":4,"cita":"le será facturado el coste íntegro del duplicado de la llave"},
      {"zona":"otros","dano":"Vehículo rotulado","no_se_cobra":"Si el cliente contrató la desrotulación en la cuota","se_cobra":"Desrotulación y reparaciones para igualar el aspecto exterior, según el perito","medida":null,"maximo":null,"condicion":"Si no se contrató la desrotulación en la cuota","aplica_a":"ambos","pagina":5,"cita":"Alphabet le facturará el coste de la desrotulación"},
      {"zona":"otros","dano":"Transformaciones sin autorización","no_se_cobra":"Las incluidas en el contrato o autorizadas","se_cobra":"Trabajos de destransformación y daños de montaje o desmontaje","medida":null,"maximo":null,"condicion":"No incluidas en el contrato o sin autorización de Alphabet","aplica_a":"ambos","pagina":5,"cita":"pueden dar lugar a cargos adicionales"},
      {"zona":"mecanica","dano":"Carga de batería en eléctricos","no_se_cobra":"No lo dice","se_cobra":"La guía no da precio; solo exige devolverlo con un 30% de carga mínima","medida":null,"maximo":null,"condicion":"Mínimo 30% de batería al devolver","aplica_a":"ambos","pagina":5,"cita":"deben devolverse con un 30% de carga mínima de batería"},
    ],
    precios: [
      {"concepto":"ITV caducada: recogida en grúa","importe":"450 € más IVA","pagina":6},
      {"concepto":"Permiso de circulación","importe":"30 € sin IVA","pagina":25},
      {"concepto":"Ficha técnica","importe":"60 € sin IVA","pagina":25},
      {"concepto":"Libro de mantenimiento","importe":"60 € sin IVA","pagina":25},
      {"concepto":"Manual de usuario","importe":"30 € sin IVA","pagina":25},
      {"concepto":"Mechero","importe":"30 € sin IVA","pagina":25},
      {"concepto":"Cenicero","importe":"35 € sin IVA","pagina":25},
      {"concepto":"Tuerca antirrobo","importe":"35 € sin IVA","pagina":25},
      {"concepto":"Resto de elementos entregados (bandeja, radio, CD navegación, sistema antipinchazo, rueda de repuesto, cable de carga de eléctricos e híbridos enchufables)","importe":"Según peritación","pagina":25},
      {"concepto":"Segunda llave","importe":"Según peritación (coste íntegro del duplicado, página 4)","pagina":25},
      {"concepto":"Elementos faltantes que no están en la tabla","importe":"Precio de sustitución (pieza más mano de obra)","pagina":25},
      {"concepto":"Limpieza básica (aspirado normal, manchas que salen con agua y jabón)","importe":"0 €","pagina":26},
      {"concepto":"Limpieza intermedia (manchas en una pieza localizada con productos especiales)","importe":"50 €","pagina":26},
      {"concepto":"Limpieza alta (manchas en varias piezas, en una amplia extensión de una pieza o muy intensas, olores, pelo de animal, aspirado exhaustivo, tierra o desperdicios)","importe":"100 €","pagina":26},
      {"concepto":"Suciedad extrema que no sale con limpieza alta","importe":"Precio del elemento más mano de obra de sustitución (decide el perito)","pagina":26},
    ],
    proceso: {
      "quien_inspecciona": "Un perito de un proveedor externo, una vez el vehículo queda depositado en las instalaciones de Alphabet. Decide si cada pieza se repara o se sustituye.",
      "informe_al_cliente": "Alphabet anota en una nota de devolución, que firma quien devuelve el vehículo, la fecha y hora, los kilómetros y el estado general con los daños interiores y exteriores. La guía no menciona fotos ni informe aparte.",
      "plazo_para_discutir": "La guía no da ningún plazo ni forma de reclamar.",
      "se_puede_reparar_antes": "Solo si el seguro va por cuenta del cliente (renting sin seguro obligatorio ni servicio de reparaciones) hay que devolverlo totalmente reparado por fuera. Si no, los daños exteriores se facturan según el perito. No dice nada de reparar el interior antes.",
      "recomendaciones_antes_de_devolver": [
        "Devolverlo limpio por dentro y por fuera",
        "Devolver los documentos (manual de mantenimiento y garantía, ficha técnica y permiso de circulación, manual de instrucciones), mejor en la guantera",
        "Devolver las dos llaves",
        "Dejar en su sitio mechero, cenicero, bandeja trasera, asientos, reposacabezas, gato, rueda, tuerca antirrobo, compresor y los accesorios entregados (cables de carga incluidos)",
        "Eléctricos: al menos 30% de batería",
        "Borrar los datos personales de GPS, Bluetooth y telemática",
        "ITV en vigor (si no, grúa: 450 € más IVA)",
        "Quitar la rotulación si no está contratada la desrotulación",
        "Poner un forro protector en la zona de carga"
      ]
    },
  },
  "vwfs": {
    compania: "volkswagen-financial-services",
    titular: "Volkswagen Financial Services (Volkswagen Renting S.A.)",
    nombre: "Manual de devolución de Renting",
    corto: "Manual de devolución de Renting",
    url: "https://www.vwfs.es/content/dam/bluelabel/valid/www-vwfs-es/2025_Manual_Devolucio%CC%81n_Renting_V5.pdf",
    web: null,
    edicion: "Edición Octubre 2025",
    edicionLeida: "Edición Octubre 2025 (lo pone en la contraportada, página 16 del PDF). El nombre del archivo dice V5; el PDF se creó el 07-11-2025 y se modificó el 11-11-2025.",
    paginas: 16,
    paginasNota: "Las páginas son las del archivo PDF; la numeración impresa en el documento es otra.",
    aplica_a: "ambos",
    reglas: [
      {"zona":"neumaticos","dano":"Profundidad del dibujo del neumático","no_se_cobra":"Profundidad igual o superior a 2 mm en todas las ranuras principales de la banda que toca el suelo.","se_cobra":"La guía solo da el mínimo aceptable; por debajo de 2 mm deja de ser aceptable (no lo repite en la columna «No aceptable»).","medida":{"que":"profundidad","limite":2,"unidad":"mm","sentido":"menos_de"},"maximo":null,"condicion":"Ojo con el sentido: aquí el límite marca lo que SÍ se cobra (menos de 2 mm). Aceptable con 2 mm o más en todas las ranuras principales. Vale también para la rueda de repuesto si la hay.","aplica_a":"ambos","pagina":6,"cita":"profundidad del neumático es igual o superior a 2 mm en todas las ranuras"},
      {"zona":"neumaticos","dano":"Cortes, grietas y perforaciones en el neumático","no_se_cobra":"Pequeños cortes o pérdidas muy leves de material que no afecten a la seguridad.","se_cobra":"Grietas, cortes y perforaciones que afecten a la seguridad.","medida":null,"maximo":null,"condicion":"Que no afecte a la seguridad. Vale también para la rueda de repuesto si la hay.","aplica_a":"ambos","pagina":6,"cita":"Grietas, cortes y perforaciones en los neumáticos que afecten a la seguridad."},
      {"zona":"neumaticos","dano":"Neumáticos distintos en un mismo eje o no homologados","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Neumáticos de un mismo eje con distinta marca y/o modelo, o no homologados en la ficha técnica.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":6,"cita":"Neumáticos que un eje sean distintos tanto en marca y/o modelo"},
      {"zona":"neumaticos","dano":"Desgaste desigual del neumático","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Desgaste desigual que haga sospechar que la geometría de los ejes está desplazada; además se cobra la medición de los ejes.","medida":null,"maximo":null,"condicion":"El coste de medir los ejes se incluye en el cálculo.","aplica_a":"ambos","pagina":6,"cita":"desgaste desigual del perfil que permita sospechar un desplazamiento de la geometría"},
      {"zona":"llantas","dano":"Roces en llantas o tapacubos","no_se_cobra":"Pequeños roces de hasta 0,5 cm de largo, como mucho 3 roces por llanta.","se_cobra":"La guía no lo dice expresamente para roces más largos o más de 3; en «No aceptable» solo cita la corrosión con roturas o pérdidas importantes de material.","medida":{"que":"largo","limite":0.5,"unidad":"cm","sentido":"hasta"},"maximo":"3 roces por llanta","condicion":null,"aplica_a":"ambos","pagina":6,"cita":"tamaño máximo de 0,5 cm de longitud sin que superen 3 roces por llanta"},
      {"zona":"llantas","dano":"Corrosión en llantas o tapacubos","no_se_cobra":"La guía no da ningún caso aceptable de corrosión.","se_cobra":"Corrosión con roturas o pérdidas importantes de material.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":6,"cita":"Corrosión en las llantas y/o tapacubos con roturas o pérdidas importantes de material."},
      {"zona":"pintura","dano":"Arañazos en la pintura","no_se_cobra":"Arañazos leves que se quiten lijando y puliendo, sin dañar la pintura base.","se_cobra":"Deterioros graves de la pintura que lleguen a la capa base o a la imprimación.","medida":null,"maximo":null,"condicion":"Que se pueda quitar con lijado y pulido y no deteriore la pintura base. Con la póliza de seguros de VWFS no hace falta reparar pintura, chapa, paragolpes ni molduras en los 3 últimos meses del contrato.","aplica_a":"ambos","pagina":7,"cita":"Arañazos leves que puedan eliminarse mediante trabajos de lijado y pulido"},
      {"zona":"pintura","dano":"Arañazos y marcas en los anclajes de la baca o portaequipajes del techo","no_se_cobra":"Arañazos leves y marcas en la zona de fijación de la guía de techo por montar y desmontar el portaequipajes.","se_cobra":"Si superan los 5 cm y no se pueden arreglar puliendo.","medida":{"que":"largo","limite":5,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"Solo en la zona de anclaje de la guía de techo, por montar y desmontar el portaequipajes. Solo se cobra si pasa de 5 cm Y además no sale con pulido: más de 5 cm que sale puliendo sigue siendo aceptable.","aplica_a":"ambos","pagina":7,"cita":"salvo que superen los 5 cm y que no puedan ser subsanados mediante pulido"},
      {"zona":"pintura","dano":"Sal del deshielo y salpicaduras de alquitrán","no_se_cobra":"Efectos de la sal del deshielo en el paso de ruedas y salpicaduras de alquitrán.","se_cobra":"La guía no da ningún caso que se cobre.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":7,"cita":"Efectos de la sal del deshielo en el paso de ruedas, salpicaduras de alquitrán."},
      {"zona":"pintura","dano":"Incrustaciones industriales o químicas","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Superficies de pintura afectadas por incrustaciones industriales o químicas.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":7,"cita":"Superficies de pintura afectadas por incrustaciones industriales o químicas."},
      {"zona":"pintura","dano":"Excrementos de pájaro","no_se_cobra":"Si no hace falta pintar para repararlo (la guía solo cobra cuando requiere pintura).","se_cobra":"Manchas o desperfectos por excrementos de pájaro que necesiten trabajos de pintura.","medida":null,"maximo":null,"condicion":"Que su reparación requiera pintar.","aplica_a":"ambos","pagina":7,"cita":"excrementos de pájaros y que para su reparación, requieran trabajos de pintura"},
      {"zona":"pintura","dano":"Reparaciones de pintura mal hechas y diferencias de color","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Reparaciones de pintura fuera de los estándares profesionales y diferencias importantes de color por reparaciones parciales.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":7,"cita":"Diferencias importantes de color, como consecuencia de reparaciones parciales en la pintura."},
      {"zona":"pintura","dano":"Corrosión en la pintura","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Daños en la pintura por corrosión.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":7,"cita":"Daños en la pintura por corrosión."},
      {"zona":"pintura","dano":"Daños por rotulación, logotipos o vinilos","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Daños en la pintura por inscripciones, logotipos, vinilos, laminados, etc.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":7,"cita":"Daños en la pintura por inscripciones, logotipos, vinilos, laminadas"},
      {"zona":"carroceria","dano":"Abolladuras en la chapa","no_se_cobra":"Pequeñas abolladuras de menos de 1 cm de diámetro que no requieran pintar, como mucho dos por pieza.","se_cobra":"Más de dos impactos en la misma pieza (y, por lo que se deduce, las que midan 1 cm o más o necesiten pintura).","medida":{"que":"diametro","limite":1,"unidad":"cm","sentido":"menos_de"},"maximo":"2 por pieza","condicion":"Que no requiera reparación de la pintura. Con la póliza de seguros de VWFS no hace falta reparar chapa en los 3 últimos meses.","aplica_a":"ambos","pagina":8,"cita":"Pequeñas abolladuras inferiores a 1 cm de diámetro que no requieran reparación de la pintura"},
      {"zona":"carroceria","dano":"Granizo","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Deterioro por granizo.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":8,"cita":"Deterioro por granizo."},
      {"zona":"carroceria","dano":"Reparaciones de chapa no profesionales","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Reparaciones previas fuera de los estándares profesionales y arreglos no profesionales de daños por envejecimiento o accidente.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":8,"cita":"Reparaciones previas realizadas fuera de los cánones profesionales."},
      {"zona":"carroceria","dano":"Reparaciones con masilla o piezas no homologadas","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Reparaciones con masilla o relleno, o cambios de piezas de carrocería sin repuestos aprobados y homologados para el modelo.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":8,"cita":"Reparaciones con ayuda de masilla o material de relleno"},
      {"zona":"carroceria","dano":"Cerraduras exteriores","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Daños en las cerraduras exteriores que impidan entrar al vehículo.","medida":null,"maximo":null,"condicion":"Que impidan el acceso al interior.","aplica_a":"ambos","pagina":8,"cita":"Daños en las cerraduras exteriores que impidan el acceso al interior del vehículo."},
      {"zona":"carroceria","dano":"Carrocería interior (marcos de puerta)","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Daños en la carrocería interior, por ejemplo el marco interior de la puerta.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":8,"cita":"Daños en la carrocería interior, por ejemplo, el marco interior de la puerta."},
      {"zona":"carroceria","dano":"Vinilos, rótulos o pegatinas puestos por el cliente","no_se_cobra":"Los que estén incluidos en la operación de renting.","se_cobra":"Vinilos, rótulos o pegatinas no incluidos en la operación.","medida":null,"maximo":null,"condicion":"Que no estén incluidos en la operación.","aplica_a":"ambos","pagina":8,"cita":"Vinilos, rótulos o pegatinas no incluidos en la operación."},
      {"zona":"paragolpes","dano":"Rozaduras en la goma de paragolpes y embellecedores; deformaciones","no_se_cobra":"Ligeras abrasiones en la goma de embellecedores y paragolpes o alrededores sin deformaciones visibles y permanentes.","se_cobra":"Aplastamientos, cambios en la estructura del plástico, grietas, falta de partes, deformaciones y desperfectos del paragolpes.","medida":null,"maximo":null,"condicion":"Que no haya deformación visible y permanente. Con la póliza de seguros de VWFS no hace falta reparar paragolpes ni molduras en los 3 últimos meses.","aplica_a":"ambos","pagina":9,"cita":"Ligeras abrasiones en la goma de los embellecedores y parachoques"},
      {"zona":"paragolpes","dano":"Arañazos en la pintura del paragolpes","no_se_cobra":"Ligeras abrasiones de la pintura que no hayan llegado al material base.","se_cobra":"Arañazos que afecten a la pintura base y arañazos de gran tamaño aunque no lleguen a la pintura base.","medida":null,"maximo":null,"condicion":"La guía no dice cuántos centímetros es «gran tamaño».","aplica_a":"ambos","pagina":9,"cita":"Arañazos de gran tamaño sin que afecten a la pintura base."},
      {"zona":"paragolpes","dano":"Zona de los sensores de aparcamiento","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Deterioro de la zona de los sensores de aparcamiento integrados.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":9,"cita":"Deterioro de la zona relacionada con los sensores de aparcamiento"},
      {"zona":"paragolpes","dano":"Piezas que faltan y rejillas rotas","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Falta de componentes y rotura de rejillas o parrillas.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":9,"cita":"Rotura de las rejillas o parrillas."},
      {"zona":"faros_y_pilotos","dano":"Marcas de gravilla y roturas en faros y pilotos","no_se_cobra":"Marcas de gravilla en la superficie de las luces que no rompan el cristal ni impidan que funcionen.","se_cobra":"Cristales o luces rotas.","medida":null,"maximo":null,"condicion":"Que no haya roto el cristal ni impida su funcionamiento.","aplica_a":"ambos","pagina":10,"cita":"Marcas provocadas por gravilla en la superficie de las luces que no hayan roto"},
      {"zona":"faros_y_pilotos","dano":"Humedad dentro del faro","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Signos de humedad en el interior del faro.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":10,"cita":"Signos de humedad en el interior del faro."},
      {"zona":"lunas","dano":"Chinazos, brechas y grietas en las lunas","no_se_cobra":"La guía no da ningún caso aceptable de chinazo sin reparar.","se_cobra":"Brechas o grietas de chinazos no reparados en cualquier luna, y cristales rotos.","medida":null,"maximo":null,"condicion":"Chinazos no reparados, en cualquiera de las lunas.","aplica_a":"ambos","pagina":10,"cita":"Brechas o grietas procedentes de chinazos no reparados en cualquiera de las lunas"},
      {"zona":"lunas","dano":"Impactos en la zona del conductor","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Cualquier impacto en la zona del conductor.","medida":null,"maximo":null,"condicion":"En la zona del conductor; la guía no dice el tamaño ni delimita la zona.","aplica_a":"ambos","pagina":10,"cita":"Impactos en la zona del conductor."},
      {"zona":"retrovisores","dano":"Rozaduras, arañazos y marcas en la carcasa del retrovisor","no_se_cobra":"Hasta 2 cm inclusive.","se_cobra":"Rozaduras, arañazos y marcas de más de 2 cm.","medida":{"que":"largo","limite":2,"unidad":"cm","sentido":"hasta"},"maximo":null,"condicion":"2 cm justos todavía es aceptable (inclusive).","aplica_a":"ambos","pagina":10,"cita":"rozaduras, arañazos y marcas de hasta 2 cm inclusive"},
      {"zona":"interior","dano":"Desgaste de la tapicería","no_se_cobra":"Ligero desgaste en los puntos de contacto por el uso habitual.","se_cobra":"Deterioros que solo se quiten reparando o cambiando por piezas nuevas.","medida":null,"maximo":null,"condicion":"Por el uso habitual y en los puntos de contacto.","aplica_a":"ambos","pagina":12,"cita":"Ligero desgaste de la tapicería en los puntos de contacto motivado por el uso habitual"},
      {"zona":"limpieza","dano":"Suciedad en tapicería y revestimientos","no_se_cobra":"Ligera suciedad que se quite con un simple aspirado.","se_cobra":"Suciedad grave que no salga aspirando y necesite limpieza profesional con disolventes especiales.","medida":null,"maximo":null,"condicion":"Si sale con un aspirado normal no se cobra.","aplica_a":"ambos","pagina":12,"cita":"requiera de tratamiento profesional con disolventes especiales"},
      {"zona":"limpieza","dano":"Suciedad por transporte de animales","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Suciedad relacionada con llevar mascotas o cualquier animal.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":12,"cita":"Suciedad relacionada con el transporte de mascotas o cualquier tipo de animal."},
      {"zona":"interior","dano":"Quemaduras","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Marcas de quemaduras en asientos, alfombrillas, moqueta, revestimientos interiores y techo.","medida":null,"maximo":null,"condicion":"No da tamaño mínimo: cualquier quemadura.","aplica_a":"ambos","pagina":12,"cita":"Marcas de quemaduras en asientos, alfombrillas, moqueta, revestimientos interiores y techo."},
      {"zona":"interior","dano":"Desgaste del suelo del maletero y respaldo de los asientos abatibles","no_se_cobra":"Erosiones leves en el suelo del maletero y en la parte trasera de los asientos abatibles por el uso habitual.","se_cobra":"Deterioros que solo se quiten reparando o cambiando piezas; falta de revestimientos del maletero.","medida":null,"maximo":null,"condicion":"La guía habla de maletero; no tiene apartado propio para la zona de carga de furgonetas.","aplica_a":"ambos","pagina":12,"cita":"Erosiones leves en el suelo del maletero, panel posterior de los asientos abatibles"},
      {"zona":"interior","dano":"Revestimientos interiores","no_se_cobra":"Ligera erosión de los revestimientos interiores.","se_cobra":"Falta de revestimientos interiores o del maletero.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":12,"cita":"Falta de revestimientos interiores o del maletero."},
      {"zona":"interior","dano":"Cinturones, cerraduras interiores y rejillas de ventilación","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Deterioro de los cinturones, de las cerraduras de seguridad interiores y de las rejillas de ventilación.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":12,"cita":"Deterioro de los cinturones de seguridad, cerraduras de seguridad interiores y rejillas"},
      {"zona":"interior","dano":"Olores fuertes o moho","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Desperfectos o falta de mantenimiento que provoquen olores fuertes o moho.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":12,"cita":"falta de mantenimiento que desencadenen la generación de fuertes olores o moho"},
      {"zona":"interior","dano":"Juntas de puertas o portones","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Grietas o desprendimiento de las juntas de puertas o trampillas.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":12,"cita":"Grietas o desprendimiento de las juntas de puertas o trampillas."},
      {"zona":"interior","dano":"Piezas de uso o montaje que no funcionan","no_se_cobra":"La guía no da ningún caso aceptable.","se_cobra":"Deterioro de piezas operativas o de montaje que limiten el funcionamiento del vehículo.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":12,"cita":"Deterioro de piezas operativas o de montaje que limiten la capacidad de funcionamiento"},
      {"zona":"documentacion_y_llaves","dano":"Manuales de instrucciones y libro de mantenimiento","no_se_cobra":"Manuales y libros de mantenimiento sin desperfectos, y el resto de manuales de los extras entregados.","se_cobra":"Que falten o estén dañados.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":14,"cita":"Ausencia / desperfectos en los Manuales de instrucciones del vehículo y/o Libros de mantenimiento."},
      {"zona":"documentacion_y_llaves","dano":"Llaves","no_se_cobra":"Devolver la llave principal y su copia o copias de repuesto.","se_cobra":"Que falten o estén dañadas las llaves.","medida":null,"maximo":null,"condicion":"La guía no publica precio.","aplica_a":"ambos","pagina":14,"cita":"Llave principal y su/s copia/s de repuesto."},
      {"zona":"documentacion_y_llaves","dano":"Herramientas, rueda de repuesto o kit antipinchazos y botiquín","no_se_cobra":"Devolver el gato y la rueda de repuesto, o el compresor y el kit antipinchazos, tal como se entregaron, y el botiquín.","se_cobra":"Que falten o estén dañadas las herramientas básicas y accesorios de la entrega inicial.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":14,"cita":"Ausencias / desperfectos en llaves, herramientas básicas y accesorios"},
      {"zona":"documentacion_y_llaves","dano":"Sonido, navegación y antena","no_se_cobra":"Devolver radio, antena y extras de sonido y navegación.","se_cobra":"Que falten o estén dañados, incluidos CD, tarjetas SD y cables.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":14,"cita":"Ausencias / desperfectos en sistemas de sonido y elementos de navegación"},
      {"zona":"documentacion_y_llaves","dano":"Opcionales y accesorios del contrato","no_se_cobra":"Devolver cualquier opcional o accesorio incluido en el contrato.","se_cobra":"Que falte o esté dañado cualquier opcional o accesorio incluido en el contrato.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":14,"cita":"Ausencia / desperfecto en cualquier opcional o accesorio incluido en el contrato de Renting."},
      {"zona":"documentacion_y_llaves","dano":"Cables de carga (vehículos eléctricos)","no_se_cobra":"Devolverlos completos y en buen estado.","se_cobra":"Que falten o estén dañados.","medida":null,"maximo":null,"condicion":"Solo vehículos eléctricos.","aplica_a":"ambos","pagina":14,"cita":"Ausencia / desperfecto de cables de carga en caso de vehículos eléctricos."},
      {"zona":"documentacion_y_llaves","dano":"Permiso de circulación y ficha técnica","no_se_cobra":"Entregar los originales del permiso de circulación y de la ficha técnica.","se_cobra":"Que falten o estén dañados.","medida":null,"maximo":null,"condicion":"Originales, no copias.","aplica_a":"ambos","pagina":14,"cita":"Ausencias / desperfectos en la entrega del Permiso de Circulación y/o Ficha Técnica."},
      {"zona":"documentacion_y_llaves","dano":"Accesorios o documentos olvidados el día de la devolución","no_se_cobra":"Si se entregan en el concesionario dentro de las 48 h de cortesía tras la peritación y el concesionario lo confirma por correo con la matrícula y lo entregado.","se_cobra":"La guía no lo dice expresamente; se entiende que pasado ese plazo cuenta como faltante.","medida":null,"maximo":null,"condicion":"Plazo de cortesía de 48 h desde la peritación.","aplica_a":"ambos","pagina":4,"cita":"hay un plazo de cortesía de 48h para devolverlo una vez se haya peritado"},
      {"zona":"mecanica","dano":"Testigo de avería encendido","no_se_cobra":"La guía no lo trata como desgaste.","se_cobra":"La guía no dice importe: dice que no se cierra el contrato hasta saber el origen de la avería.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":4,"cita":"testigo de avería encendido, no podremos finalizar el contrato hasta determinar el origen"},
      {"zona":"otros","dano":"Bola de remolque añadida","no_se_cobra":"Si está homologada en la ITV como reforma (fija o desmontable).","se_cobra":"La guía no da importe; exige que la reforma esté homologada en la ITV.","medida":null,"maximo":null,"condicion":"Vale para bolas fijas y desmontables.","aplica_a":"ambos","pagina":4,"cita":"su instalación se considera una reforma y debe estar homologada en la ITV"},
    ],
    precios: [

    ],
    proceso: {
      "quien_inspecciona": "Un perito del colaborador de peritaciones de VWFS o el Asesor Comercial del concesionario oficial, que rellena el acta de devolución y peritación. La cita se pide con al menos 72 h de antelación (peritaciones.remarketing@vwfs.com o 93 260 85 04) y el vehículo se entrega en un concesionario oficial de la marca de la misma zona de matriculación (Península o Canarias); si no, el cliente paga traslado y aduanas.",
      "informe_al_cliente": "El cliente recibe una copia del acta de devolución y peritación, que debe enviar a terminaciones@vwfs.com; el acta es el justificante de devolución y cierra el contrato. Después se hace un informe de peritación con el que se liquida el contrato (días de uso, kilómetros, daños) en facturas de liquidación. La guía no dice que el informe lleve fotos ni que se le mande al cliente.",
      "plazo_para_discutir": "La guía no da ningún plazo para discutir la peritación. Solo da 48 h de cortesía para entregar accesorios o documentos olvidados. La fianza o saldo a favor se devuelve 60 días (SEPA CORE) o 20 días (SEPA B2B) después del último recibo, si no hay facturas impagadas.",
      "se_puede_reparar_antes": "Depende del seguro. Si el contrato incluye la póliza de seguros de VWFS, no hace falta hacer reparaciones estéticas (pintura, chapa, paragolpes y molduras) en los 3 últimos meses del contrato. Si el seguro es por cuenta del cliente, cualquier daño debe estar reparado antes de devolver: no se aceptan partes de reparación ni compromisos de reparar después.",
      "recomendaciones_antes_de_devolver": [
        "Pedir la cita de peritación con al menos 72 h de antelación, dando matrícula, concesionario y día y hora.",
        "Quitar los objetos personales y los accesorios que no sean del contrato.",
        "Comprobar que se devuelven todos los elementos entregados: CD, DVD, tarjetas de navegación, cables USB, botiquín, etc.",
        "En eléctricos, devolver los cables de carga completos y en buen estado.",
        "Borrar los datos personales restaurando el modo de fábrica desde el panel del coche.",
        "Lavar el vehículo por dentro y por fuera.",
        "Si lleva bola de remolque, que esté homologada en la ITV.",
        "Si el seguro no es de VWFS, reparar todos los daños antes de la devolución.",
        "Repasar la lista de comprobación rápida: manuales, libro de servicios, llaves, rueda de repuesto o compresor, antena, sonido y navegación, documentación, neumáticos, pintura, carrocería, paragolpes, habitáculo y maletero.",
        "Enviar la copia del acta a terminaciones@vwfs.com."
      ]
    },
  },
  "bmw": {
    compania: "bmw-financial-services",
    titular: "BMW Financial Services (BMW Bank GmbH, sucursal en España)",
    nombre: "Manual de devolución de vehículos. BMW Financial Services",
    corto: "Manual de devolución de vehículos",
    url: "https://www.bmw.es/content/dam/bmw/marketES/bmw_es/MANUAL-DE-DEVOLUCI%C3%93N-DE-VEH%C3%8DCULOS-BMW.pdf",
    web: null,
    edicion: "Sin fecha en el documento",
    edicionLeida: "El documento no muestra fecha, versión ni código en ninguna página. Pista: los metadatos del PDF dicen que se hizo con Canva el 30-06-2026 (CreationDate y ModDate D:20260630095908).",
    paginas: 17,
    paginasNota: "Las páginas son las del archivo PDF.",
    aplica_a: "turismo",
    reglas: [
      {"zona":"pintura","dano":"Impactos leves en la pintura (laca y color), tipo gravilla","no_se_cobra":"Hasta 3 impactos de 1 mm que no estén concentrados en una superficie del tamaño de un A4.","se_cobra":"Retoque o corrección: hasta 5 impactos de 1 mm no concentrados en un A4. Pintar: impactos con corrosión de más de 1 mm, más de 5 impactos o concentrados en un A4.","medida":{"que":"diametro","limite":1,"unidad":"mm","sentido":"hasta"},"maximo":"3 impactos, no concentrados en un A4","condicion":"Que no se concentren en una superficie de un A4.","aplica_a":"turismo","pagina":6,"cita":"3 impactos de 1 mm que no se concentren en una superficie de un A4."},
      {"zona":"pintura","dano":"Arañazos en los laterales de la carrocería","no_se_cobra":"Hasta 2 arañazos por lateral de hasta 30 mm, por debajo de la línea superior del pase de rueda.","se_cobra":"Corrección: 2 arañazos por lateral de entre 30 y 40 mm, nunca por encima de la línea superior del pase de rueda. Pintar: los que superen esas condiciones.","medida":{"que":"largo","limite":30,"unidad":"mm","sentido":"hasta"},"maximo":"2 por lateral","condicion":"Que no estén por encima de la línea superior del pase de rueda.","aplica_a":"turismo","pagina":6,"cita":"2 arañazos por lateral de hasta 30 mm"},
      {"zona":"pintura","dano":"Arañazos en techo, capó, portón o por encima de la línea del pase de rueda","no_se_cobra":"La guía no admite ninguno en estas zonas.","se_cobra":"Se pintan: arañazos en techo, capó, portón o por encima de la línea superior del pase de rueda.","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":6,"cita":"Arañazos en techo, capó, portón o por encima de la línea superior del pase de rueda."},
      {"zona":"pintura","dano":"Arañazos en la pintura (resumen final del manual)","no_se_cobra":"Arañazos que no superen los 3 cm de diámetro, como máximo 2 por panel.","se_cobra":"Lo que supere eso (el resumen no detalla cómo se cobra).","medida":{"que":"diametro","limite":3,"unidad":"cm","sentido":"hasta"},"maximo":"2 por panel","condicion":null,"aplica_a":"turismo","pagina":16,"cita":"Se aceptan sin valorar arañazos que no superen los 3 cm de diámetro. Máximo 2 por panel."},
      {"zona":"carroceria","dano":"Leves impactos (bollos) en la carrocería","no_se_cobra":"1 impacto por lateral de hasta 20 mm, por debajo de la línea superior del pase de rueda, que no afecte a la laca ni esté en vértices o aristas. No vale en techo, capó, portón ni en piezas ya repintadas.","se_cobra":"Corrección: hasta 1 leve impacto de 30 mm por lateral; por encima de la línea del pase de rueda, techo, capó o portón, no más de 1 por pieza. Pintar: más de 1 impacto por lateral, en techo, capó o portón, y cuando supere 30 mm de diámetro.","medida":{"que":"diametro","limite":20,"unidad":"mm","sentido":"hasta"},"maximo":"1 por lateral","condicion":"Por debajo de la línea superior del pase de rueda, sin afectar a la laca, fuera de vértices y aristas; excluidos techo, capó, portón y elementos repintados.","aplica_a":"turismo","pagina":7,"cita":"1 impacto por lateral de hasta 20 mm siempre por debajo de la línea superior"},
      {"zona":"carroceria","dano":"Daños de carrocería (resumen final del manual)","no_se_cobra":"Daños de hasta 2 cm de diámetro en piezas verticales, como máximo 1 por panel.","se_cobra":"Lo que supere eso (el resumen no detalla cómo se cobra).","medida":{"que":"diametro","limite":2,"unidad":"cm","sentido":"hasta"},"maximo":"1 por panel","condicion":"Solo en piezas verticales.","aplica_a":"turismo","pagina":16,"cita":"Se aceptan daños de hasta 2 cm de diámetro en piezas verticales. Máximo 1 por panel."},
      {"zona":"pintura","dano":"Daños que se quitan puliendo (solo afectan a la laca)","no_se_cobra":"Daños que solo afectan a la capa de laca, de no más de 40 mm «en capas verticales» (así lo escribe la guía; seguramente quiere decir piezas verticales) y no más de 4 ocasiones.","se_cobra":"Corrección: los que superen eso o afecten a la estética del vehículo (arañazos, resinas, etc.).","medida":{"que":"largo","limite":40,"unidad":"mm","sentido":"hasta"},"maximo":"4 ocasiones","condicion":"Que solo afecten a la capa de laca; el límite de 40 mm la guía lo pone «en capas verticales».","aplica_a":"turismo","pagina":7,"cita":"No superior a 40 mm en capas verticales. No más de 4 ocasiones."},
      {"zona":"paragolpes","dano":"Roces y arañazos en paragolpes","no_se_cobra":"1 roce o arañazo leve por paragolpes que no supere los 30 mm.","se_cobra":"Retocar o corrección: 1 arañazo de entre 20 y 40 mm. No se acepta: 1 arañazo de más de 40 mm o más de dos incidencias por paragolpes.","medida":{"que":"largo","limite":30,"unidad":"mm","sentido":"hasta"},"maximo":"1 por paragolpes","condicion":"Que sea leve.","aplica_a":"turismo","pagina":8,"cita":"1 leve roce o arañazo por paragolpers que no supere los 30 mm."},
      {"zona":"retrovisores","dano":"Componentes pintados (carcasas de retrovisores y similares)","no_se_cobra":"Roces leves que no superen 2 mm, siempre que no afecten a la pintura ni a la estética.","se_cobra":"Corrección: daños que afecten a la laca y al color o que superen 2 mm. Pintar: daños en laca y color o en el material base, holguras, roturas o mal funcionamiento.","medida":{"que":"otro","limite":2,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":"Que no afecte a la pintura ni a la estética del vehículo.","aplica_a":"turismo","pagina":8,"cita":"Leves roces que no superen 2 mm, siempre que no afecte a la pintura"},
      {"zona":"interior","dano":"Quemaduras en tejido de asientos y respaldos","no_se_cobra":"Quemadura superficial de no más de 4 mm.","se_cobra":"Corrección: cuando la quemadura o rotura ha decolorado, degradado o traspasado el material, nunca de más de 6 mm. No se acepta lo que no cumpla esas condiciones.","medida":{"que":"otro","limite":4,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":"Que sea superficial.","aplica_a":"turismo","pagina":9,"cita":"Quemadura superficial en tejidos de respaldo y asientos no superior a 4 mm."},
      {"zona":"interior","dano":"Marcas en guarnecidos o asientos de cuero","no_se_cobra":"Una sola marca por vehículo de no más de 4 mm.","se_cobra":"Corrección: cuando la quemadura o rotura ha decolorado, degradado o traspasado el material, nunca de más de 6 mm. No se acepta lo que no cumpla esas condiciones.","medida":{"que":"otro","limite":4,"unidad":"mm","sentido":"hasta"},"maximo":"1 por vehículo","condicion":null,"aplica_a":"turismo","pagina":9,"cita":"Guarnecidos o asientos de cuero con una sola marca por vehículo no superior a 4 mm."},
      {"zona":"interior","dano":"Quemaduras y cortes en moqueta del piso y del maletero","no_se_cobra":"Quemadura superficial en moqueta de no más de 5 mm que no afecte al aspecto.","se_cobra":"Corrección: quemaduras o cortes que afecten al material y no superen 10 mm. No se acepta: más de 10 mm o en zonas de paso o uso frecuente.","medida":{"que":"otro","limite":5,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":"Que sea superficial y no afecte al aspecto.","aplica_a":"turismo","pagina":9,"cita":"Quemadura superficial en moquetas que no supere los 5 mm y no afecte al aspecto."},
      {"zona":"interior","dano":"Marcas y roces en revestimientos de plástico, vinilos y similares","no_se_cobra":"Marcas o roces de uso de menos de 20 mm.","se_cobra":"Corrección: roces leves sin pérdida de material de no más de 60 mm. No se acepta: roces profundos, roturas, cortes y roces de más de 60 mm.","medida":{"que":"largo","limite":20,"unidad":"mm","sentido":"menos_de"},"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":10,"cita":"Marcas o roces de uso. Siempre inferiores a 20 mm."},
      {"zona":"interior","dano":"Guarnecido del techo interior","no_se_cobra":"La guía no admite ningún daño en el techo interior.","se_cobra":"Se valoran como sustitución: roces, quemaduras, deformaciones, deshilachados o roturas.","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":10,"cita":"Serán valorados como sustitución: roces, quemaduras, deformaciones, deshilachados o roturas."},
      {"zona":"interior","dano":"Autorradios y pantallas","no_se_cobra":"Solo los daños que cubra la garantía.","se_cobra":"Se valoran como sustitución: arañazos, impactos o cualquier daño, salvo lo que cubra la garantía.","medida":null,"maximo":null,"condicion":"Exceptuando daños que cubra la garantía.","aplica_a":"turismo","pagina":14,"cita":"Serán valorados como sustitución arañazos, impactos o cualquier tipo de daño"},
      {"zona":"neumaticos","dano":"Profundidad del dibujo de los neumáticos","no_se_cobra":"Neumáticos con 1,6 mm o más de profundidad total del dibujo (es un mínimo, no un máximo), siempre que no haya marcas, medidas o dibujos distintos en el mismo eje.","se_cobra":"Neumáticos por debajo de 1,6 mm o con desgaste irregular en toda su superficie.","medida":null,"maximo":null,"condicion":"Mínimo 1,6 mm de dibujo (iguales o superiores a 1,6 mm, según la página 16).","aplica_a":"turismo","pagina":11,"cita":"Neumáticos que presenten medidas del calado total del dibujo de 1,6 mm."},
      {"zona":"neumaticos","dano":"Estado, marca y tipo de los neumáticos","no_se_cobra":"La guía no da tolerancia para estos casos.","se_cobra":"No se aceptan: cortes, abombamientos, pérdidas de material o tacos deformados; pinchados o deshinchados; marcas, medidas o dibujos distintos en el mismo eje; neumáticos que no sean de primeras marcas; recauchutados en cualquiera de los cinco; neumáticos estacionales; los que no cumplan la especificación de origen (Runflat).","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":11,"cita":"Marcas, medidas o dibujos diferentes en el mismo eje"},
      {"zona":"llantas","dano":"Roces en el borde de las llantas","no_se_cobra":"Roces en el borde de la llanta que sumados no pasen de 40 mm (el texto añade «o exista pérdida de material», frase confusa).","se_cobra":"Reparación: los que no cumplan lo anterior. Sustitución: los que superen ampliamente esas medidas, dañen gravemente el material base o deformen la llanta de forma que no se pueda equilibrar.","medida":{"que":"largo","limite":40,"unidad":"mm","sentido":"hasta"},"maximo":"40 mm sumando todos los roces de la llanta","condicion":"La medida es la suma de todos los roces del borde.","aplica_a":"turismo","pagina":11,"cita":"Roces en el borde de la llanta que en la suma de ellos no superen los 40 mm"},
      {"zona":"lunas","dano":"Impactos en el parabrisas","no_se_cobra":"Hasta 5 impactos leves que no pasen de 2 mm de diámetro, fuera del ángulo de visión del conductor y que no puedan distraerle.","se_cobra":"Reparación especial: como máximo un impacto con fisuras, fuera del ángulo de visión, con la zona fisurada de no más de 2 mm de diámetro. Sustitución: si no se cumplen las condiciones anteriores.","medida":{"que":"diametro","limite":2,"unidad":"mm","sentido":"hasta"},"maximo":"5 por parabrisas","condicion":"Fuera del ángulo de visión del conductor (página 12). La página 16 añade, con una frase mal construida, que tampoco valen si, aun estando fuera, pueden distraer su atención.","aplica_a":"turismo","pagina":12,"cita":"5 leves impactos, que no superen los 2 mm y fuera del ángulo de visión del conductor."},
      {"zona":"lunas","dano":"Arañazos en lunas laterales y luneta trasera","no_se_cobra":"La guía no lo dice expresamente. Solo dice lo que no se acepta; de ahí se deduce, sin que lo escriba, que un único arañazo de más de 20 mm o arañazos de 20 mm o menos no entrarían en esa frase.","se_cobra":"No se acepta: más de 1 arañazo de más de 20 mm, cristales no homologados, etc. (no dice si se repara o se sustituye).","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":15,"cita":"Más de 1 arañazo superior a 20 mm, cristales no homologados, etc."},
      {"zona":"faros_y_pilotos","dano":"Roces e impactos en faros y pilotos (grupos ópticos)","no_se_cobra":"Roces leves e impactos leves de 1 mm sin astillamientos.","se_cobra":"Corrección: roces leves sin pérdida de material que se quitan con pulido. No se acepta: roturas, impactos de más de 1 mm, astillamientos y pilotos con condensación interior.","medida":{"que":"diametro","limite":1,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":"Sin astillamientos.","aplica_a":"turismo","pagina":12,"cita":"Leves roces, leves impactos de 1 mm que no presenten astillamientos."},
      {"zona":"carroceria","dano":"Cantos de puertas, por debajo de la línea del pase de rueda","no_se_cobra":"Daños que sumados no pasen de 40 mm, por debajo de la línea superior del pase de ruedas.","se_cobra":"No se aceptan los daños que superen esas condiciones.","medida":{"que":"largo","limite":40,"unidad":"mm","sentido":"hasta"},"maximo":"40 mm sumando todos los daños","condicion":"Por debajo de la línea superior del pase de ruedas.","aplica_a":"turismo","pagina":13,"cita":"Daños que en su suma no superen los 40 mm"},
      {"zona":"carroceria","dano":"Cantos de puertas, por encima de la línea del pase de rueda","no_se_cobra":"Daños que no pasen de 20 mm si están por encima de la línea superior del pase de ruedas.","se_cobra":"No se aceptan los daños que superen esas condiciones.","medida":{"que":"largo","limite":20,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":"Por encima de la línea superior del pase de ruedas.","aplica_a":"turismo","pagina":13,"cita":"de encontrarse por encima, que no superen los 20 mm."},
      {"zona":"carroceria","dano":"Roces en embellecedores de plástico","no_se_cobra":"Roces leves de menos de 10 mm que no afecten al aspecto general de la pieza.","se_cobra":"Corrección: roces leves de entre 10 y 30 mm. No se aceptan reparaciones con diferencias claras de tono o deterioradas.","medida":{"que":"largo","limite":10,"unidad":"mm","sentido":"menos_de"},"maximo":null,"condicion":"Sin afectar al aspecto general de la pieza.","aplica_a":"turismo","pagina":13,"cita":"Leves roces inferiores a 10 mm en elementos de plástico"},
      {"zona":"carroceria","dano":"Roces en embellecedores cromados","no_se_cobra":"Roces leves y superficiales de menos de 20 mm.","se_cobra":"Corrección: roces leves de entre 10 y 30 mm (así lo dice la guía para embellecedores, sin distinguir plástico y cromado).","medida":{"que":"largo","limite":20,"unidad":"mm","sentido":"menos_de"},"maximo":null,"condicion":"Que sean superficiales.","aplica_a":"turismo","pagina":13,"cita":"En cromados leves, roces superficiales menores a 20 mm"},
      {"zona":"carroceria","dano":"Impactos en embellecedores cromados","no_se_cobra":"Impactos leves de menos de 10 mm.","se_cobra":"Lo que supere eso; la guía no detalla más para impactos en cromados.","medida":{"que":"diametro","limite":10,"unidad":"mm","sentido":"menos_de"},"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":13,"cita":"o leves impactos inferiores a 10 mm."},
      {"zona":"pintura","dano":"Reparaciones anteriores mal hechas","no_se_cobra":"La guía no da tolerancia.","se_cobra":"No se aceptan reparaciones con diferencias claras de tono o deterioradas. El perito puede aplicar una reserva de daños si lo ve necesario.","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":13,"cita":"Reparaciones que presenten diferencias claras de tonalidad o se encuentren deterioradas."},
      {"zona":"limpieza","dano":"Limpieza general a la entrega","no_se_cobra":"El vehículo limpio por dentro y por fuera.","se_cobra":"Si no se entrega limpio, se podría reclamar el coste de la limpieza (sin importe publicado).","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":3,"cita":"En caso contrario, se podría reclamar el coste de la limpieza."},
      {"zona":"limpieza","dano":"Suciedad y manchas en el interior","no_se_cobra":"Retirar papeles, arena de playa y envoltorios en cantidad normal.","se_cobra":"Corrección: manchas que se quitan con una limpieza simple. Sustitución: manchas abrasivas, de humedad, decoloraciones, etc.","medida":null,"maximo":null,"condicion":"En cantidad normal.","aplica_a":"turismo","pagina":14,"cita":"Retirada de papeles, arena de playa y envoltorios en cantidad normal."},
      {"zona":"documentacion_y_llaves","dano":"Cerraduras y llaves","no_se_cobra":"La guía no da tolerancia.","se_cobra":"Sustitución: cerraduras forzadas, cilindros o llaves que no sean originales.","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":15,"cita":"Cerraduras forzadas, cilindros o llaves no originales."},
      {"zona":"documentacion_y_llaves","dano":"Documentación, llaves y accesorios a entregar","no_se_cobra":"Entregar: ficha técnica y permiso de circulación originales, impuesto de circulación del año pagado, todos los juegos de llaves, manuales y libro de mantenimiento original sellado, accesorios (navegador, etc.); además, DNI del titular o, en empresas, CIF, escrituras, poderes y la factura de venta por el Valor Futuro.","se_cobra":"La guía no dice qué se cobra si falta algo.","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":4,"cita":"Todos los juegos de llaves."},
      {"zona":"mecanica","dano":"Testigos de avería encendidos en el cuadro","no_se_cobra":"La guía no da tolerancia: cualquier aviso se anota.","se_cobra":"Si además hay encendido un testigo de avería según el manual de usuario, el vehículo no se puede devolver y se factura el Valor Final del contrato.","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":15,"cita":"EL VEHÍCULO NO PODRÁ SER DEVUELTO, facturándose el Valor Final establecido en contrato."},
      {"zona":"mecanica","dano":"Mantenimientos","no_se_cobra":"Haber cumplido el programa de mantenimientos en un Servicio Oficial BMW.","se_cobra":"La guía lo pone como condición para devolver, sin decir qué se cobra si no se cumple.","medida":null,"maximo":null,"condicion":"En un Servicio Oficial BMW.","aplica_a":"turismo","pagina":3,"cita":"Es necesario haber cumplido el programa de mantenimientos en un Servicio Oficial BMW."},
      {"zona":"otros","dano":"Exceso de kilómetros","no_se_cobra":"Los kilómetros dentro de lo contratado.","se_cobra":"El exceso de kilómetros se penaliza según el contrato (sin importe en la guía).","medida":null,"maximo":null,"condicion":null,"aplica_a":"turismo","pagina":3,"cita":"El exceso de kilometraje estará sujeto a penalización según contrato."},
    ],
    precios: [

    ],
    proceso: {
      "quien_inspecciona": "Un perito designado por BMW Financial Services (su proveedor de peritaciones), en el Concesionario Oficial BMW donde se entrega el coche, con un medidor de daños para carrocería y neumáticos. Deben llamar al cliente para la cita; si 48 horas antes del vencimiento no lo han hecho, hay que contactar con Gestión de Vencimientos (91 335 0772, vencimientos@bmw.es).",
      "informe_al_cliente": "Se firman los «controles de devolución» (titular, recepcionista del taller y perito). La guía no dice si el cliente recibe un informe con fotos.",
      "plazo_para_discutir": "La guía no da plazo para discutir la peritación; solo remite a Atención al Cliente (vencimientos@bmw.es) para dudas.",
      "se_puede_reparar_antes": "Sí. Si el coche no se devuelve totalmente reparado, hay que dar parte al seguro para que se abra una orden de reparación en el concesionario de entrega y así evitar que se cobren los daños de la peritación.",
      "recomendaciones_antes_de_devolver": [
        "Entregarlo limpio por dentro y por fuera.",
        "Mantener vigente el seguro a todo riesgo y no darlo de baja hasta confirmar que la aseguradora cubre todos los daños detectados.",
        "Comprobar si la aseguradora tiene concierto con el Concesionario Oficial BMW donde se hará la entrega.",
        "Tener hecho el programa de mantenimientos en un Servicio Oficial BMW.",
        "Llevar todos los juegos de llaves, la documentación y los accesorios.",
        "Estar al corriente de impuestos, tasas y cargas que afecten a la transferencia."
      ]
    },
  },
  "athlon": {
    compania: "athlon",
    titular: "Athlon",
    nombre: "Manual de devolución",
    corto: "Manual de devolución",
    url: "https://www.athlon.com/media/zhzf1acy/manual-de-devoluci%C3%B3n.pdf",
    web: null,
    edicion: "Sin fecha en el documento",
    edicionLeida: "No figura edición ni fecha en el documento (el primer lector vio en los metadatos del PDF la fecha de creación 10-01-2023; no la he podido volver a comprobar).",
    paginas: 16,
    paginasNota: "Las páginas son las del archivo PDF.",
    aplica_a: "ambos",
    reglas: [
      {"zona":"carroceria","dano":"Daños exteriores con el seguro contratado con Athlon","no_se_cobra":"Athlon se hace cargo de los daños","se_cobra":"Los daños en los que haya alguna negligencia","medida":null,"maximo":null,"condicion":"Solo si el seguro está contratado con Athlon","aplica_a":"ambos","pagina":9,"cita":"Si tienes el seguro contratado con Athlon, nosotros nos hacemos cargo de los daños, salvo que exista alguna negligencia"},
      {"zona":"carroceria","dano":"Daños exteriores con seguro contratado por cuenta del cliente","no_se_cobra":"No lo dice: no da margen de desgaste exterior","se_cobra":"El vehículo debe entregarse sin daños, incluidas llantas y lunas","medida":null,"maximo":null,"condicion":"Si el seguro lo contrató el cliente por su cuenta","aplica_a":"ambos","pagina":9,"cita":"el vehículo lo debes entregar sin daños, a la hora de la deolución, incluído llantas y lunas"},
      {"zona":"carroceria","dano":"Daños exteriores con seguro con franquicia","no_se_cobra":"No lo dice expresamente","se_cobra":"Todo daño que tenga el vehículo, hasta el importe máximo de la franquicia por parte, incluidas llantas y lunas","medida":null,"maximo":"Hasta el importe máximo de la franquicia «por parte» (el documento no aclara si parte es pieza o parte de siniestro)","condicion":"Si el seguro tiene franquicia","aplica_a":"ambos","pagina":9,"cita":"se te refacturará todo daño que tenga el vehículo hasta el importe máximo de la franquicia por parte"},
      {"zona":"llantas","dano":"Daños en llantas","no_se_cobra":"Con seguro de Athlon entran en «daños exteriores»: Athlon se hace cargo salvo negligencia (las llantas no se nombran en esa frase)","se_cobra":"Con seguro propio, hay que entregarlas sin daños; con franquicia, se refacturan hasta la franquicia por parte","medida":null,"maximo":"Con franquicia: hasta su importe por parte","condicion":"Depende del seguro contratado","aplica_a":"ambos","pagina":9,"cita":"incluyendo también llantas y lunas"},
      {"zona":"lunas","dano":"Daños en lunas","no_se_cobra":"Con seguro de Athlon entran en «daños exteriores»: Athlon se hace cargo salvo negligencia (las lunas no se nombran en esa frase)","se_cobra":"Con seguro propio, hay que entregarlas sin daños; con franquicia, se refacturan hasta la franquicia por parte","medida":null,"maximo":"Con franquicia: hasta su importe por parte","condicion":"Depende del seguro contratado","aplica_a":"ambos","pagina":9,"cita":"sin daños, a la hora de la deolución, incluído llantas y lunas"},
      {"zona":"zona_de_carga","dano":"Golpes internos por llevar la carga mal sujeta («daños positivos»)","no_se_cobra":"No lo dice","se_cobra":"No están cubiertos por el seguro","medida":null,"maximo":null,"condicion":"Cuando la carga no iba debidamente sujeta; apartado para turismos y furgonetas adaptados","aplica_a":"furgoneta","pagina":12,"cita":"Los golpes internos, consecuencia de no llevar la carga debidamente sujeta"},
      {"zona":"carroceria","dano":"Daños en el techo por transporte de material o carga incorrecta que dañen la chapa («daños positivos»)","no_se_cobra":"No lo dice","se_cobra":"Son daños positivos, no cubiertos por el seguro","medida":null,"maximo":null,"condicion":"Cuando el daño viene de transportar material o de carga incorrecta; apartado para turismos y furgonetas adaptados","aplica_a":"furgoneta","pagina":12,"cita":"Son también daños positivos los que se produzcan en el techo del vehículo"},
      {"zona":"zona_de_carga","dano":"Accesorios funcionales (equipos de frío, plataformas elevadoras)","no_se_cobra":"No lo dice","se_cobra":"No lo dice expresamente; deben devolverse en estado de uso","medida":null,"maximo":null,"condicion":"Si el vehículo lleva esos accesorios","aplica_a":"furgoneta","pagina":12,"cita":"han de devolverse en estado de uso"},
      {"zona":"zona_de_carga","dano":"Cerraduras adicionales instaladas (tipo FAQ u otra marca)","no_se_cobra":"No lo dice","se_cobra":"No lo dice; la cerradura debe quedar instalada con su llave","medida":null,"maximo":null,"condicion":"Si se instalaron cerraduras adicionales","aplica_a":"furgoneta","pagina":12,"cita":"se ha de dejar instalada la cerradura con su llave"},
      {"zona":"limpieza","dano":"Suciedad interior","no_se_cobra":"Suciedad de un uso normal que se quite con aspirado o limpieza estándar (p. 10)","se_cobra":"Manchas o suciedad no derivada de un uso normal (p. 11)","medida":null,"maximo":null,"condicion":"Que se elimine con aspirado o limpieza estándar","aplica_a":"ambos","pagina":10,"cita":"pueda ser eliminada con aspirado o limpieza estándar"},
      {"zona":"interior","dano":"Tapicería: manchas, quemaduras, cortes, desgarros, grietas en cuero","no_se_cobra":"No da ningún caso aceptable","se_cobra":"Toda mancha en la tapicería; quemaduras en el guarnecido; cortes, desgarros o grietas en el cuero","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":11,"cita":"Toda mancha en la tapicería. Quemaduras en el guarnecido"},
      {"zona":"interior","dano":"Techo y montantes, bandeja trasera","no_se_cobra":"No da ningún caso aceptable","se_cobra":"Quemaduras, daños, manchas, roces, arañazos, o desperfectos en la bandeja trasera","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":11,"cita":"Quemaduras, daños, manchas, roces, arañazos, o desperfectos en la bandeja trasera"},
      {"zona":"interior","dano":"Salpicadero y consola central","no_se_cobra":"Suciedad eliminable con una limpieza básica (p. 10)","se_cobra":"Rasguños, agujeros, adhesivos o suciedad que implique una limpieza intensiva","medida":null,"maximo":null,"condicion":"Que la suciedad se quite con limpieza básica","aplica_a":"ambos","pagina":11,"cita":"Rasguños, agujeros, adhesivos o suciedad que implique una limpieza intensiva"},
      {"zona":"interior","dano":"Paneles interiores de puertas","no_se_cobra":"Suciedad eliminable con una limpieza básica (p. 10)","se_cobra":"Rasguños, agujeros, adhesivos o suciedad que implique una limpieza intensiva","medida":null,"maximo":null,"condicion":"Que la suciedad se quite con limpieza básica","aplica_a":"ambos","pagina":11,"cita":"Rasguños, agujeros, adhesivos o suciedad que implique una limpieza intensiva"},
      {"zona":"interior","dano":"Moquetas y alfombrillas","no_se_cobra":"Desgaste habitual por kilometraje y antigüedad (p. 10)","se_cobra":"Quemaduras, agujeros en moqueta, desgarros o manchas químicas","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":11,"cita":"Quemaduras, agujeros en moqueta, desgarros o manchas químicas"},
      {"zona":"mecanica","dano":"Motor, escape y testigos de avería","no_se_cobra":"Motor con funcionamiento y ruido normal, o sin testigos de avería encendidos","se_cobra":"Testigos de avería encendidos o en señal de alerta en el cuadro, o ruido anómalo de motor o escape (daño no aceptable; no da importe)","medida":null,"maximo":null,"condicion":"Se arranca el vehículo al entregarlo; las anomalías se anotan en la tasación como comentarios","aplica_a":"ambos","pagina":7,"cita":"Si los testigos de avería están encendidos o en señal de alerta"},
      {"zona":"mecanica","dano":"Mantenimientos","no_se_cobra":"No lo dice","se_cobra":"No da importe; el vehículo debe entregarse con los mantenimientos hechos según la marca","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":7,"cita":"entregado con los mantenimientos realizados segun indica la marca"},
      {"zona":"documentacion_y_llaves","dano":"Elementos obligatorios a devolver","no_se_cobra":"No lo dice","se_cobra":"No da importe; deben devolverse: juego de llaves y sus códigos, código de radio, llaves antirrobo de ruedas, libro de revisiones y manuales de instrucciones (vehículo, radio, navegador…), permiso de circulación, ficha técnica y certificados de homologación, discos y tarjetas de navegación, rueda de repuesto con sus herramientas o kit de pinchazos, accesorios (navegador portátil, pantallas, DVD, manos libres), bandeja cubre-maletero, tarjeta de combustible y/o Via-T","medida":null,"maximo":null,"condicion":"Todo lo entregado al inicio o añadido durante el contrato","aplica_a":"ambos","pagina":6,"cita":"todos los documentos y elementos incluidos en la entrega incial"},
      {"zona":"otros","dano":"Accesorios y cables de carga","no_se_cobra":"No lo dice","se_cobra":"No da importe; deben dejarse visibles en el maletero los accesorios (bola de remolque…) y los cables de carga de híbridos enchufables o eléctricos","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":6,"cita":"Deben dejar visible dentro del maletero"},
    ],
    precios: [

    ],
    proceso: {
      "quien_inspecciona": "El documento no dice quién en concreto. Dice que se peritará todo el interior y que al entregarlo el vehículo se arranca y las anomalías se anotan en la tasación. Se devuelve en el concesionario del coche nuevo o se recoge a domicilio con transportista (lo coordina el departamento comercial); el cliente firma la hoja de recogida.",
      "informe_al_cliente": "No lo dice (no menciona informe con fotos; solo que las anomalías se anotan en la tasación como comentarios).",
      "plazo_para_discutir": "No lo dice.",
      "se_puede_reparar_antes": "No lo dice expresamente. Con seguro propio el vehículo debe entregarse sin daños, incluidas llantas y lunas.",
      "recomendaciones_antes_de_devolver": [
        "Dejar dentro todos los elementos obligatorios (llaves, códigos, documentación, rueda de repuesto, etc.)",
        "Dejar visibles en el maletero accesorios y cables de carga",
        "Firmar la hoja de recogida en el concesionario o al transportista",
        "Tener hechos los mantenimientos según la marca",
        "Vehículos adaptados: poner forro protector en la zona de carga",
        "Vehículos adaptados: devolver equipos de frío o plataformas en estado de uso",
        "Vehículos adaptados: dejar instaladas las cerraduras adicionales con su llave",
        "Llevar la carga bien sujeta (los golpes internos no los cubre el seguro)"
      ]
    },
  },
  "arval": {
    compania: "arval",
    titular: "Arval (Arval Service Lease, España)",
    nombre: "Fin de contrato (ficha de Arval España, 2 páginas)",
    corto: "Ficha de fin de contrato",
    url: "https://www.arval.es/sites/default/files/121/2026/11/Fin%20de%20contrato_Arval.pdf",
    web: null,
    edicion: "Sin fecha en el documento",
    edicionLeida: "El texto no trae fecha ni versión. Los datos internos del PDF dicen: título «ARVAL_DOCUMENTO FIN DE CONTRATO_PDF_09062026_V14», creado el 27-10-2026 y modificado el 28-10-2026; subido en la carpeta /2026/11/ de arval.es.",
    paginas: 2,
    paginasNota: "La ficha tiene dos páginas.",
    aplica_a: "ambos",
    reglas: [
      {"zona":"carroceria","dano":"Daños estéticos o menores del exterior (carrocería, pintura, paragolpes)","no_se_cobra":"No hace falta repararlos antes de devolver. La ficha no da ninguna medida ni dice qué cuenta como desgaste normal en el exterior.","se_cobra":"La ficha no dice qué daño exterior se cobra ni a partir de qué tamaño. Una empresa independiente perita el coche y los daños y faltantes se refacturan en un máximo de 2 meses tras la peritación.","medida":null,"maximo":null,"condicion":"Que el contrato tenga seguro de responsabilidad civil y servicio de reparación de daños propios; si no, ver la regla de contrato sin seguro.","aplica_a":"ambos","pagina":1,"cita":"No es necesario realizar reparaciones estéticas o menores del exterior"},
      {"zona":"carroceria","dano":"Daños exteriores por motivos de seguridad, siniestros con un contrario responsable, cobertura con participación (franquicia) o si se compra el vehículo","no_se_cobra":"Nada dice que no se cobre en estos casos.","se_cobra":"Son la excepción: hay que repararlos. Además es obligatorio comunicar cualquier siniestro y, cuando proceda, seguir las indicaciones de Arval para repararlo.","medida":null,"maximo":null,"condicion":"Motivos de seguridad, siniestro cuya responsabilidad sea de un contrario, cobertura con participación o compra del vehículo.","aplica_a":"ambos","pagina":1,"cita":"excepto por motivos de seguridad, siniestros cuya responsabilidad sea de un contrario"},
      {"zona":"carroceria","dano":"Cualquier daño, si el contrato no tiene seguro de responsabilidad civil ni servicio de reparación de daños propios","no_se_cobra":"Nada.","se_cobra":"Hay que devolver el vehículo totalmente reparado. La ficha no dice expresamente qué pasa si no se hace; se entiende que entra en «daños y faltantes», que se refacturan tras la peritación.","medida":null,"maximo":null,"condicion":"Contrato sin seguro de responsabilidad civil y sin servicio de reparación de daños propios.","aplica_a":"ambos","pagina":1,"cita":"devuelve el vehículo totalmente reparado"},
      {"zona":"interior","dano":"Daños interiores (guarnecido de techo, tapizado de asientos y respaldos, paneles de puerta, moqueta, volante, pomo de cambio, parasol, apoyabrazos, plásticos del maletero, salpicadero, guantera, otros)","no_se_cobra":"La ficha no dice qué daño interior no se cobra ni da medida de desgaste.","se_cobra":"Se factura cada reparación a tarifa fija por pieza (de 75 € a 250 € sin IVA, ver precios); «otros», según peritación.","medida":null,"maximo":null,"condicion":"La ficha no da tamaños de quemadura, mancha ni rotura.","aplica_a":"ambos","pagina":2,"cita":"este se facturará, junto con los daños detectados"},
      {"zona":"interior","dano":"Piezas irreparables","no_se_cobra":"Nada dice.","se_cobra":"Sustitución de piezas irreparables, según peritación (sin precio fijo).","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":2,"cita":"SUSTITUCIÓN DE PIEZAS IRREPARABLES"},
      {"zona":"documentacion_y_llaves","dano":"Llaves","no_se_cobra":"Devolverlo con los dos juegos de llaves.","se_cobra":"Si falta la 2ª llave: 390 € sin IVA (471,90 € con IVA), según la tabla de la pág. 2.","medida":null,"maximo":null,"condicion":"Se piden dos juegos de llaves (pág. 1).","aplica_a":"ambos","pagina":1,"cita":"Dos juegos de llaves."},
      {"zona":"documentacion_y_llaves","dano":"Permiso de circulación y documentación","no_se_cobra":"Devolverlo con la documentación (pág. 1).","se_cobra":"Si falta: 60 € sin IVA (72,60 € con IVA).","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":2,"cita":"PERMISO DE CIRCULACIÓN / DOCUMENTACIÓN"},
      {"zona":"documentacion_y_llaves","dano":"ITV","no_se_cobra":"Devolverlo con la ITV en vigor.","se_cobra":"La ficha no dice qué se cobra si la ITV está caducada.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":1,"cita":"ITV en vigor."},
      {"zona":"otros","dano":"Accesorios que faltan (chaleco, triángulos o baliza, cable de carga, kit de reparación de neumáticos, cubierta del maletero y todos los accesorios entregados al inicio)","no_se_cobra":"Devolver todos los accesorios incluidos al inicio del contrato.","se_cobra":"Kit de reparación de neumáticos 90 €, cubierta del maletero 350 €, cable de carga 290 € (sin IVA); otros faltantes, según peritación.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":1,"cita":"Chaleco, triángulos / baliza, cable de carga y todos los accesorios"},
      {"zona":"limpieza","dano":"Suciedad","no_se_cobra":"Devolverlo limpio y en las mismas condiciones en que se entregó.","se_cobra":"Limpieza completa: 80 € sin IVA (96,80 € con IVA), según la tabla de la pág. 2. La ficha no dice qué grado de suciedad la dispara.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":1,"cita":"Vehículo limpio y en las mismas condiciones que te fue entregado"},
      {"zona":"otros","dano":"Kilómetros no usados o de más","no_se_cobra":"Por los km no usados se abona dinero, como máximo el 20 % y según contrato (salvo cancelación anticipada).","se_cobra":"Cargo por los km que pasen de los contratados. Precios y tramos, en el contrato de cada cliente.","medida":{"que":"otro","limite":20,"unidad":"por_ciento","sentido":"hasta"},"maximo":"El abono por km no usados es como máximo del 20 % (no es un límite de cobro).","condicion":"En cancelaciones anticipadas el cálculo es proporcional.","aplica_a":"ambos","pagina":1,"cita":"Abono: por kms no utilizados (máx. 20% y según contrato)"},
      {"zona":"otros","dano":"Datos personales y dispositivos vinculados","no_se_cobra":"Borrar cualquier dato personal y desvincular los dispositivos.","se_cobra":"La ficha no dice que se cobre nada.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":1,"cita":"Elimina cualquier dato personal, y desvincula tus dispositivos."},
    ],
    precios: [
      {"concepto":"Reparación guarnecido de techo (tela)","importe":"220,00 € sin IVA / 266,20 € con IVA","pagina":2},
      {"concepto":"Reparación tapizado de asientos y respaldos (tela/cuero)","importe":"150,00 € sin IVA / 181,50 € con IVA","pagina":2},
      {"concepto":"Reparación paneles, guarnecidos de puerta (tela/plástico)","importe":"100,00 € sin IVA / 121,00 € con IVA","pagina":2},
      {"concepto":"Reparación moqueta del suelo (tela)","importe":"200,00 € sin IVA / 242,00 € con IVA","pagina":2},
      {"concepto":"Reparación volante (plástico/cuero)","importe":"100,00 € sin IVA / 121,00 € con IVA","pagina":2},
      {"concepto":"Reparación guarnecido / pomo de la palanca de cambio (tela/cuero)","importe":"80,00 € sin IVA / 96,80 € con IVA","pagina":2},
      {"concepto":"Reparación parasol (plástico/tela)","importe":"75,00 € sin IVA / 90,75 € con IVA","pagina":2},
      {"concepto":"Reparación apoyabrazos (tela/cuero)","importe":"120,00 € sin IVA / 145,20 € con IVA","pagina":2},
      {"concepto":"Reparación guarnecido plásticos del maletero (plástico)","importe":"95,00 € sin IVA / 114,95 € con IVA","pagina":2},
      {"concepto":"Reparación guarnecido salpicadero (plástico/cuero)","importe":"250,00 € sin IVA / 302,50 € con IVA","pagina":2},
      {"concepto":"Reparación guantera (plástico)","importe":"80,00 € sin IVA / 96,80 € con IVA","pagina":2},
      {"concepto":"Reparación otros elementos","importe":"Según peritación","pagina":2},
      {"concepto":"Falta 2ª llave","importe":"390,00 € sin IVA / 471,90 € con IVA","pagina":2},
      {"concepto":"Falta kit de reparación de neumáticos","importe":"90,00 € sin IVA / 108,90 € con IVA","pagina":2},
      {"concepto":"Falta cubierta del maletero","importe":"350,00 € sin IVA / 423,50 € con IVA","pagina":2},
      {"concepto":"Falta permiso de circulación / documentación","importe":"60,00 € sin IVA / 72,60 € con IVA","pagina":2},
      {"concepto":"Falta cable de carga","importe":"290,00 € sin IVA / 350,90 € con IVA","pagina":2},
      {"concepto":"Otros faltantes","importe":"Según peritación","pagina":2},
      {"concepto":"Limpieza completa","importe":"80,00 € sin IVA / 96,80 € con IVA","pagina":2},
      {"concepto":"Sustitución de piezas irreparables","importe":"Según peritación","pagina":2},
      {"concepto":"Kilómetros: abono por km no usados (máx. 20 % y según contrato) y cargo por km de más","importe":"Precios y tramos en el contrato de cada cliente","pagina":1},
    ],
    proceso: {
      "quien_inspecciona": "Una empresa independiente hace la peritación del estado del coche (pág. 1). Se firma un acta de devolución por ambas partes, con fecha y kilometraje.",
      "informe_al_cliente": "La ficha no habla de informe ni de fotos para el cliente.",
      "plazo_para_discutir": "La ficha no da ningún plazo para discutir la peritación. Plazos que sí da: los daños y faltantes se refacturan en un máximo de 2 meses tras la peritación (pág. 1); si se devuelve en taller o concesionario, el usuario debe enviar el acta en 48 horas como máximo (pág. 2).",
      "se_puede_reparar_antes": "No hace falta reparar los daños estéticos o menores del exterior, salvo por seguridad, siniestro con un contrario responsable, cobertura con participación o compra del vehículo. Si el contrato no tiene seguro de responsabilidad civil y servicio de reparación de daños propios, hay que devolverlo totalmente reparado (pág. 1).",
      "recomendaciones_antes_de_devolver": [
        "Limpiar el vehículo y devolverlo en las mismas condiciones en que se entregó.",
        "Llevar los dos juegos de llaves.",
        "Llevar la documentación y la ITV en vigor.",
        "Llevar chaleco, triángulos o baliza, cable de carga y todos los accesorios entregados al inicio.",
        "Borrar los datos personales y desvincular los dispositivos.",
        "Comunicar cualquier siniestro y, cuando proceda, seguir las indicaciones de Arval para repararlo.",
        "Pedir cita en la plataforma de devoluciones (por teléfono u online) y, si no llega confirmación, llamar al concesionario; para devolver en el domicilio o el trabajo, llamar al 919 100 900, opción 1.",
        "Si se devuelve en la empresa cliente, avisar a Arval 3 días laborables antes en Madrid y 15 en el resto de provincias para que la facturación acabe en la fecha de disponibilidad (pág. 2).",
        "Firmar el acta de devolución con fecha y kilometraje."
      ]
    },
  },
  "hertz": {
    compania: "hertz",
    titular: "Hertz (Hertz de España SL) - alquiler",
    nombre: "Condiciones de alquiler (con Condiciones de los vehículos eléctricos y Condiciones específicas del país - España)",
    corto: "Condiciones de alquiler",
    url: "https://images.hertz.com/pdfs/RT_FULL_ES_ES.pdf",
    web: null,
    edicion: "Septiembre 2026",
    edicionLeida: "Septiembre 2026 (figura arriba a la derecha de la página 1)",
    paginas: 36,
    paginasNota: "Las páginas son las del archivo PDF.",
    aplica_a: "ambos",
    reglas: [
      {"zona":"otros","dano":"Regla general: cualquier daño nuevo y cómo leer las medidas","no_se_cobra":"El desgaste normal causado por un uso razonable. Si la guía da una medida, no se cobra ningún daño menor que esa medida.","se_cobra":"Cualquier daño nuevo detectado tras la devolución que no figure en el Informe de estado del vehículo (VCR) de la recogida.","medida":null,"maximo":null,"condicion":"Los daños no anotados en el VCR al recoger se atribuyen al cliente, salvo que se demuestre que ya existían y no eran razonablemente evidentes (páginas 4-5).","aplica_a":"ambos","pagina":17,"cita":"Si se indica una medida, no se cobrará ningún daño menor que dicha medida."},
      {"zona":"carroceria","dano":"Arañazos en carrocería","no_se_cobra":"Arañazos de 10 mm o menos en los que no se ve el metal o el plástico de debajo.","se_cobra":"Arañazos de más de 10 mm, o de menos de 10 mm si se ve el metal/plástico subyacente.","medida":{"que":"largo","limite":10,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":"Solo si no se ve el metal/plástico subyacente; si se ve, se cobra aunque mida menos de 10 mm. La guía no dice qué pasa con uno de 10 mm justos con el metal a la vista.","aplica_a":"ambos","pagina":17,"cita":"Arañazos: mayores de 10 mm o menores de 10 mm si se ve el metal/plástico subyacente."},
      {"zona":"carroceria","dano":"Rozaduras (dos o más arañazos en la misma zona o varias marcas en la misma superficie)","no_se_cobra":"Rozaduras de 10 mm o menos en las que no se ve el metal o el plástico de debajo.","se_cobra":"Dos o más arañazos en la misma zona o múltiples marcas en la misma superficie mayores de 10 mm, o menores de 10 mm si se ve el metal/plástico subyacente.","medida":{"que":"otro","limite":10,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":"Solo si no se ve el metal/plástico subyacente. La guía no aclara si los 10 mm son de cada marca o del conjunto.","aplica_a":"ambos","pagina":17,"cita":"Rozaduras: dos o más arañazos en la misma zona o múltiples marcas"},
      {"zona":"carroceria","dano":"Abolladuras","no_se_cobra":"Abolladuras de 10 mm de diámetro o menos.","se_cobra":"Abolladuras de diámetro mayor de 10 mm.","medida":{"que":"diametro","limite":10,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":17,"cita":"Abolladuras: diámetro mayor de 10 mm."},
      {"zona":"lunas","dano":"Astillas y grietas en lunas","no_se_cobra":"La guía no admite ninguna como desgaste: no da tolerancia.","se_cobra":"Cualquier astilla o grieta.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":17,"cita":"Lunas: Cualquier astilla o grieta."},
      {"zona":"neumaticos","dano":"Daños en neumáticos","no_se_cobra":"La guía no admite ningún daño como desgaste (no habla del desgaste de la banda de rodadura).","se_cobra":"Cualquier daño en el neumático, incluidos daños en el flanco, pinchazos y haber circulado con el neumático desinflado.","medida":null,"maximo":null,"condicion":"Los daños en la llanta por circular con un neumático pinchado se consideran uso inadecuado (página 21).","aplica_a":"ambos","pagina":17,"cita":"Neumáticos: Cualquier daño en el neumático, incluyendo daños en el flanco, pinchazos"},
      {"zona":"interior","dano":"Molduras interiores","no_se_cobra":"La guía no da tolerancia.","se_cobra":"Cualquier daño en las molduras interiores.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":18,"cita":"Molduras: Cualquier daño en las molduras interiores."},
      {"zona":"interior","dano":"Tapicería: manchas y quemaduras","no_se_cobra":"La guía no da tolerancia.","se_cobra":"Cualquier mancha o quemadura en los asientos o las alfombrillas.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":18,"cita":"Tapicería: Cualquier mancha o quemadura en los asientos o las alfombrillas."},
      {"zona":"retrovisores","dano":"Grietas en espejos","no_se_cobra":"La guía no da tolerancia.","se_cobra":"Cualquier grieta en los espejos.","medida":null,"maximo":null,"condicion":"La guía dice «espejos» sin precisar si son solo los retrovisores exteriores.","aplica_a":"ambos","pagina":18,"cita":"Espejos: Cualquier grieta en los espejos."},
      {"zona":"llantas","dano":"Arañazos en llantas de aleación","no_se_cobra":"Arañazos de 10 mm o menos.","se_cobra":"Arañazos de más de 10 mm.","medida":{"que":"largo","limite":10,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":18,"cita":"Llantas de aleación: Arañazos de más de 10 mm."},
      {"zona":"llantas","dano":"Embellecedores de las llantas (tapacubos)","no_se_cobra":"Daños de 10 mm o menos.","se_cobra":"Cualquier daño de más de 10 mm.","medida":{"que":"otro","limite":10,"unidad":"mm","sentido":"hasta"},"maximo":null,"condicion":"La guía no dice si los 10 mm son largo o diámetro.","aplica_a":"ambos","pagina":18,"cita":"Embellecedores de las llantas: Cualquier daño de más de 10 mm."},
      {"zona":"faros_y_pilotos","dano":"Grietas en grupos de luces","no_se_cobra":"La guía no da tolerancia.","se_cobra":"Cualquier grieta en los grupos de luces.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":18,"cita":"Grupos de luces: Cualquier grieta en los grupos de luces."},
      {"zona":"otros","dano":"Piezas originales rotas o que faltan","no_se_cobra":"La guía no da tolerancia.","se_cobra":"Cualquier pieza original rota o que falte.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":18,"cita":"Piezas: Cualquier pieza original rota o que falte."},
      {"zona":"otros","dano":"Cerraduras","no_se_cobra":"La guía no da tolerancia.","se_cobra":"Cualquier daño en cerraduras.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":18,"cita":"Cerraduras: Cualquier daño."},
      {"zona":"mecanica","dano":"Contaminación del combustible","no_se_cobra":"La guía no da tolerancia.","se_cobra":"Contaminación del combustible (por ejemplo, poner un combustible equivocado; en la página 21 se cita también el depósito de AdBlue).","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":18,"cita":"Contaminación del combustible."},
      {"zona":"otros","dano":"Daño intencionado o por negligencia grave","no_se_cobra":"Nada: no hay tolerancia.","se_cobra":"Cualquier daño causado intencionadamente o por negligencia grave del cliente o de un conductor autorizado.","medida":null,"maximo":null,"condicion":"Además, en esos casos los seguros y coberturas parciales quedan anulados (página 10).","aplica_a":"ambos","pagina":18,"cita":"Cualquier daño causado intencionadamente o por negligencia grave por su parte"},
      {"zona":"otros","dano":"Accesorios o piezas que faltan o dañados (incluidos extras alquilados)","no_se_cobra":"La guía no da tolerancia.","se_cobra":"Cualquier pieza o accesorio (también extras como sillas o navegadores) que no se devuelva o esté dañado y deba sustituirse.","medida":null,"maximo":null,"condicion":"Las coberturas parciales no cubren las piezas desmontables que falten (llaves, llaveros, cables de carga, estantes para paquetes, chalecos, triángulos, botiquín, extintor...) salvo robo o accidente, ni los accesorios alquilados (página 22).","aplica_a":"ambos","pagina":14,"cita":"Se aplica si alguna pieza o accesorio (incluidos los extras opcionales"},
      {"zona":"documentacion_y_llaves","dano":"Pérdida o daño de la llave o tarjeta de entrada de un vehículo eléctrico","no_se_cobra":"La guía no da tolerancia.","se_cobra":"170 € por llave o 40 € por tarjeta para sustituirla; excluido de SuperCover.","medida":null,"maximo":null,"condicion":"Solo vehículos eléctricos (Condiciones de los vehículos eléctricos). Para el resto de vehículos la guía no publica precio de llaves.","aplica_a":"ambos","pagina":32,"cita":"le cobraremos 170 €/£ por llave o 40 €/£ por tarjeta"},
      {"zona":"documentacion_y_llaves","dano":"Llave de carga (para estaciones de la red) perdida o dañada","no_se_cobra":"El desgaste normal de la llave de carga.","se_cobra":"20 € (IVA incluido) para sustituirla si se pierde o se daña aparte del desgaste normal; excluido de SuperCover.","medida":null,"maximo":null,"condicion":"Solo vehículos eléctricos.","aplica_a":"ambos","pagina":32,"cita":"Si la llave de carga se pierde o se daña (aparte del desgaste normal)"},
      {"zona":"otros","dano":"Cables de carga perdidos o dañados (eléctricos e híbridos enchufables)","no_se_cobra":"En eléctricos, el desgaste normal del cable.","se_cobra":"El coste de sustitución si el cable se pierde o se daña aparte del desgaste normal; en España 450 € (modo 2 o modo 3, IVA incluido); excluido de SuperCover. En híbridos enchufables, el coste de sustitución si no se devuelve o está dañado (página 14, sin importe).","medida":null,"maximo":null,"condicion":"Si al recoger faltan cables y no se avisa al personal, se cobra la sustitución (página 30). Para híbridos la página 14 no menciona la excepción del desgaste normal.","aplica_a":"ambos","pagina":32,"cita":"Si un cable se pierde o se daña (aparte del desgaste normal)"},
      {"zona":"otros","dano":"Vehículo eléctrico devuelto con poca batería","no_se_cobra":"Devolverlo con al menos el mismo nivel de carga que al recogerlo o con el 80 % (lo que sea inferior) no genera gastos de recarga.","se_cobra":"Por debajo de ese nivel, la recarga a tarifa de Hertz; y si está por debajo del 10 %, además un cargo de servicio de 25 € (IVA incluido). Con batería críticamente baja que impida desbloquearlo, los costes de acceso y los daños que cause (excluido de SuperCover).","medida":null,"maximo":null,"condicion":"Solo vehículos eléctricos. Se deja sin medida porque aquí el límite va al revés que en los daños (se cobra por debajo del umbral, no por encima).","aplica_a":"ambos","pagina":32,"cita":"Si el estado de la batería del vehículo eléctrico está por debajo del 10 %"},
      {"zona":"limpieza","dano":"Suciedad excesiva, mal olor o manchas","no_se_cobra":"La suciedad que se quita con la limpieza estándar de Hertz entre alquileres.","se_cobra":"Cargo por limpieza extra si el vehículo vuelve excesivamente sucio, maloliente o manchado y necesita una limpieza más profunda que la estándar.","medida":null,"maximo":null,"condicion":"El importe remite a una «Lista de Cargos» que no está en este documento. Transportar materiales especialmente sucios o malolientes que obliguen a limpieza extra o quemen el interior cuenta como uso inadecuado (página 21).","aplica_a":"ambos","pagina":14,"cita":"devuelve el vehículo en un estado excesivamente sucio, maloliente o manchado"},
      {"zona":"limpieza","dano":"Olor a humo o vapeo","no_se_cobra":"Nada: está prohibido fumar y vapear en todos los vehículos.","se_cobra":"Cargo por fumar/vapear si el vehículo huele a humo o vapeo al devolverlo.","medida":null,"maximo":null,"condicion":"El importe remite a una «Lista de Cargos» que no está en este documento. La frase del olor sigue en la página 15.","aplica_a":"ambos","pagina":14,"cita":"Está prohibido fumar y vapear en todos los vehículos."},
    ],
    precios: [
      {"concepto":"Bloqueo en tarjeta al recoger (junto al importe del depósito de combustible): siempre un mínimo","importe":"mínimo 200 €","pagina":4},
      {"concepto":"Bloqueo en tarjeta adicional si no se contrata SuperCover (posibles daños)","importe":"500 €","pagina":4},
      {"concepto":"Vehículo eléctrico devuelto con menos del 10 % de batería: cargo de servicio además de la tarifa de recarga","importe":"25 € (IVA incluido)","pagina":32},
      {"concepto":"Vehículo eléctrico: sustitución de llave perdida o dañada","importe":"170 € por llave","pagina":32},
      {"concepto":"Vehículo eléctrico: sustitución de tarjeta de entrada perdida o dañada","importe":"40 € por tarjeta","pagina":32},
      {"concepto":"Cable de carga perdido o dañado en España (modo 2 o modo 3)","importe":"450 € (IVA incluido)","pagina":32},
      {"concepto":"Llave de carga (para estaciones de la red) perdida o dañada","importe":"20 € (IVA incluido)","pagina":32},
      {"concepto":"Penalización por conducir o devolver en un país prohibido (alquiler en España)","importe":"500 €","pagina":34},
      {"concepto":"Indemnización por repatriación del vehículo (alquiler en España, país prohibido)","importe":"2.317 €","pagina":34},
    ],
    proceso: {
      "quien_inspecciona": "El personal de Hertz en la oficina de devolución, junto con el cliente. En horas punta hay que prever entre 20 y 30 minutos. Si el cliente no tiene tiempo, los daños nuevos se evalúan en su ausencia. Los daños ocultos (motor, depósito, embrague, arañazos tapados por suciedad, oscuridad o lluvia) pueden detectarse después, al reacondicionar el coche (páginas 10 y 17).",
      "informe_al_cliente": "Sí. Hertz anota daños nuevos y accesorios que faltan en un Informe de valoración de daños (DAR) y lo envía por correo electrónico, con fotos. Los daños de la «matriz» de reparación se cobran según esa tabla (auditada por terceros y actualizada al menos cuatro veces al año) en la factura final; los que no están en la matriz pasan a un asesor de daños (objetivo 20 días, hasta 90 si interviene un tercero o la policía) y se facturan aparte, avisando al menos 7 días antes del cargo. Las pruebas deben incluir número de contrato, fecha y oficina, valoración del taller o factura, VCR firmado, parte de accidente si lo hay y fotos de los daños y del cuentakilómetros (páginas 17-19).",
      "plazo_para_discutir": "14 días desde el fin del alquiler, escribiendo a Atención al Cliente con el número de contrato o reserva y los justificantes; Hertz intenta responder en 14 días. Los cargos no fijados en la devolución (daños importantes u ocultos) se avisan por correo y no se cobran hasta 7 días después; los daños ocultos no se cobran si el cuentakilómetros marca más que en la devolución. Si no hay acuerdo: mediador independiente (ECRCS, vinculante para Hertz, si el cliente es residente de la UE o Reino Unido y alquiló en otro país), la red de Centros Europeos del Consumidor o los tribunales (páginas 2, 11, 17, 19 y 25).",
      "se_puede_reparar_antes": "No. El cliente no puede dejar que nadie haga mantenimiento ni repare el vehículo sin permiso de Hertz (página 7). Solo puede rellenar líquidos que pida un testigo (por ejemplo aceite), y Hertz lo reembolsa con recibo (página 5).",
      "recomendaciones_antes_de_devolver": [
        "Al recoger, comparar el coche con el Informe de estado (VCR) y pedir que se corrija cualquier diferencia antes de salir; si no, el daño se le atribuye al cliente (páginas 4-5 y 17).",
        "Reservar 20-30 minutos en horas punta para hacer la inspección con el personal y acordar los daños; si no, se valoran en su ausencia (páginas 10 y 17).",
        "Llenar el depósito a menos de 15 km (10 millas) de la oficina y llevar el recibo; si no, Hertz puede cobrar combustible más un cargo por servicio (página 16).",
        "Devolver todas las piezas y accesorios (también cables de carga, llaves y extras alquilados) (páginas 14, 22 y 32).",
        "No fumar ni vapear, y no devolverlo excesivamente sucio, maloliente o manchado (páginas 6 y 14-15).",
        "Fuera de horario, solo con acuerdo previo: aparcar en su aparcamiento, cerrar, dejar los documentos (recibo de combustible, parte de accidente, ticket) en el asiento del conductor y meter las llaves en el buzón seguro; si no, el cliente responde del coche hasta que lo localicen (páginas 10-11).",
        "Eléctricos: devolver con al menos el mismo nivel de carga o el 80 % (lo menor) y nunca por debajo del 10 % (páginas 27, 30, 31 y 32)."
      ]
    },
  },
  "europcar": {
    compania: "europcar",
    titular: "Europcar España (alquiler)",
    nombre: "Tabla de valoración de daños válida desde 10 diciembre 2025 Europcar España / Damages Assesment Matrix",
    corto: "Tabla de valoración de daños",
    url: "https://static.europcar.com/ctfassets/wmdwnw6l5vg5/1bB3O5WAkmeBkwmD2bNDRs/300a6df4ab55af600c230a9e38ee2a4f/Refresh_Matriz_LDAS_EC_SP_10_12_2025_Baliza_V16.pdf",
    web: {"texto":"Política de gestión de daños, en la web de Europcar","url":"https://www.europcar.es/es-es/p/informacion-legal/politica-de-gestion-de-danos"},
    edicion: "Válida desde el 10 de diciembre de 2025",
    edicionLeida: "Válida desde el 10 de diciembre de 2025 (título de las páginas 1 y 15); archivo Refresh_Matriz_LDAS_EC_SP_10_12_2025_Baliza_V16",
    paginas: 28,
    paginasNota: "Las páginas son las del archivo PDF.",
    aplica_a: "ambos",
    reglas: [
      {"zona":"carroceria","dano":"Arañazo en panel de chapa (puertas, aletas, laterales, capó, portón, techo, pilares)","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Tramos de la tabla: 2-5 cm, >5-15 cm y >15 cm (el más pequeño empieza en 2 cm). Precio fijo por pieza y tramo. Ej. turismo Intermediate, puerta delantera: 139,70 / 239,35 / 340,78 €; Medium Van: 159,03 / 279,90 / 400,88 €.","medida":null,"maximo":null,"condicion":"Precio según la longitud del arañazo, la pieza y el grupo del vehículo","aplica_a":"ambos","pagina":4,"cita":"Arañazo 2 - 5 cm | Scratch 2-5 cm"},
      {"zona":"carroceria","dano":"Abolladura en panel de chapa","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Tramos de la tabla: 2-5 cm, >5-15 cm y >15 cm (el más pequeño empieza en 2 cm). Precio fijo por pieza y tramo. Ej. turismo Intermediate, puerta delantera: 250,13 / 381,33 / 514,31 €; Medium Van: 269,63 / 422,10 / 574,68 €.","medida":null,"maximo":null,"condicion":"Precio según el tamaño de la abolladura, la pieza y el grupo","aplica_a":"ambos","pagina":4,"cita":"Abolladura 2 - 5 cm | Dent 2-5 cm"},
      {"zona":"carroceria","dano":"Rallón (rozadura) en panel","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Solo dos tramos: leve 2-5 cm y medio >5-15 cm; no hay fila de rallón de más de 15 cm. En toda la tabla el rallón vale lo mismo que el arañazo del mismo tramo (comprobado fila a fila). Ej. puerta delantera izquierda: turismo Intermediate 139,70 / 239,35 €; Medium Van 159,03 / 279,90 €.","medida":null,"maximo":null,"condicion":"No hay tramo de rallón >15 cm en la tabla; el capó no tiene filas de rallón","aplica_a":"ambos","pagina":4,"cita":"Rallón leve 2 - 5 c | Light Scuffed 2-5cm"},
      {"zona":"carroceria","dano":"Pieza deformada, rota o perdida","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Se cobra el precio de la pieza (sustitución). Ej. aleta trasera turismo Intermediate 2002,19 €; lateral trasero Medium Van 2741,23 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":7,"cita":"Deformado | Distorted"},
      {"zona":"paragolpes","dano":"Arañazo en paragolpes (completo, zona izquierda, derecha o central)","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Tramos de la tabla: 2-5 cm, >5-15 cm y >15 cm (el más pequeño empieza en 2 cm). Ej. paragolpes delantero completo: turismo Intermediate 94,92 / 148,65 / 192,42 €; Medium Van 108,43 / 174,96 / 234,18 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":1,"cita":"Paragolpes delantero completo | Front Bumper"},
      {"zona":"paragolpes","dano":"Abolladura en paragolpes","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Tramos de la tabla: 2-5 cm, >5-15 cm y >15 cm (el más pequeño empieza en 2 cm). Ej. paragolpes delantero completo: turismo Intermediate 205,34 / 290,63 / 365,95 €; Medium Van 219,03 / 317,16 / 407,98 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":1,"cita":"Abolladura 5 - 15 cm | Dent >5-15 cm"},
      {"zona":"paragolpes","dano":"Rallón en paragolpes","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Leve 2-5 cm y medio >5-15 cm. Ej. paragolpes trasero zona central: turismo Intermediate 93,45 / 154,28 €; Medium Van 95,83 / 149,07 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":8,"cita":"Rallón medio 5-15cm | Medium Scuffed >5-15cm"},
      {"zona":"paragolpes","dano":"Paragolpes roto, deformado o perdido","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Precio de sustitución. Ej. delantero completo: turismo Intermediate 628,05 €; Medium Van 908,83 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":1,"cita":"Roto | Broken"},
      {"zona":"llantas","dano":"Rallón en llanta (aleación o chapa)","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Leve 2-5 cm y medio >5-15 cm. Ej. llanta delantera izquierda: turismo Intermediate 61,52 / 66,82 €; Medium Van 79,06 / 83,51 €.","medida":null,"maximo":null,"condicion":"Las llantas no tienen filas de arañazo ni abolladura: solo rallón, deformado, perdido y roto","aplica_a":"ambos","pagina":14,"cita":"Llanta Aleación rueda DI | Front L. Wheel Rim Alloy"},
      {"zona":"llantas","dano":"Llanta deformada, rota o perdida","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Precio de la llanta. Ej. turismo Intermediate 187,56 €; Medium Van 135,52 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":14,"cita":"Deformado | Distorted"},
      {"zona":"llantas","dano":"Tapacubo deformado, roto o perdido","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Ej. turismo Intermediate 24,09 €; Medium Van 23,89 € (mismo precio deformado, perdido o roto). Las filas de rallón del tapacubo solo tienen precio en los grupos Mini/Economy y Compact de turismo; en el resto (y en todas las furgonetas) están vacías.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":14,"cita":"TapacuboAleación rueda DI | Front L. Wheel Hub Alloy"},
      {"zona":"neumaticos","dano":"Neumático cortado, roto o pinchado","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Mismo precio para cortado, roto y rueda pinchada. Ej. turismo Intermediate 109,80 €; Medium Van 119,34 €. Rueda de emergencia aparte (turismo Intermediate 96,02 €; Medium Van 120,45 €).","medida":null,"maximo":null,"condicion":"La tabla no da profundidad de dibujo ni otra medida","aplica_a":"ambos","pagina":14,"cita":"Rueda pinchada | Punctured (Tyres only)"},
      {"zona":"lunas","dano":"Impacto (chinazo) en el parabrisas","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Chinazo de menos de 10 mm: precio fijo (turismo Intermediate 47,25 €; Medium Van 48,00 €). No dice nada del campo de visión ni de chinazos mayores (fuera de eso solo hay luna rota).","medida":{"que":"diametro","limite":10,"unidad":"mm","sentido":"menos_de"},"maximo":null,"condicion":"La medida describe el tramo que SE COBRA (chinazo de menos de 10 mm), NO un margen libre de cobro. Solo existe esta fila para el parabrisas (FR21); ni lunetas ni ventanillas tienen fila de chinazo.","aplica_a":"ambos","pagina":2,"cita":"Chinazo cristal<10mm | Glass Chip <10mm"},
      {"zona":"lunas","dano":"Parabrisas, luneta o ventanilla rota","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Precio de sustitución. Parabrisas: turismo Intermediate 391,70 €, Medium Van 302,83 €. Luneta trasera turismo Intermediate 471,53 € (página 9); en furgonetas la luneta no tiene precio (celdas vacías, página 23).","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":3,"cita":"Luna parabrisas | Windscreen"},
      {"zona":"faros_y_pilotos","dano":"Faro, piloto, intermitente o antiniebla deformado, roto o perdido","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Precio por pieza. Ej. faro delantero izquierdo: turismo Intermediate 539,68 €; Medium Van 459,24 €. Piloto trasero izquierdo completo: 271,45 € / 192,60 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":2,"cita":"Faro Delantero Izquierdo"},
      {"zona":"retrovisores","dano":"Carcasa del retrovisor (arañazo, abolladura, rallón, rota)","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Un solo precio para cualquier daño y tamaño de la carcasa: turismo Intermediate 74,18 €; Medium Van 51,66 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":5,"cita":"Carcasa espejo retrovisor izquierdo | Left Mirror Cap/Housing"},
      {"zona":"retrovisores","dano":"Cristal del retrovisor o retrovisor completo","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Cristal: turismo Intermediate 69,02 €, Medium Van 54,98 €. Retrovisor completo roto o deformado: 265,85 € / 246,67 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":5,"cita":"Retrovisor Izquierdo completo | Left Mirror Complete"},
      {"zona":"interior","dano":"Tapicería de asientos y respaldos: cortada, quemada, sucia/manchada o perdida","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Mismo precio por pieza para cortado, quemadura y mancha. Ej. asiento delantero izquierdo: turismo Intermediate 326,08 €; Medium Van 335,20 €.","medida":null,"maximo":null,"condicion":"La tabla no da tamaño mínimo de quemadura o mancha","aplica_a":"ambos","pagina":3,"cita":"Quemadura | Burnt"},
      {"zona":"interior","dano":"Moqueta, alfombrillas y guarnecido de techo (cortado, quemado, sucio)","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Ej. moqueta completa sucia o manchada: turismo Intermediate 672,83 €; Medium Van 970,37 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":3,"cita":"Moqueta interior completa | Fitted Carpet Whole"},
      {"zona":"interior","dano":"Plásticos y mandos: salpicadero, guantera, manillas, elevalunas, volante, radio, cinturones","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Solo roto o perdido, precio por pieza (ej. salpicadero roto: turismo Intermediate 1261,10 €; Medium Van 1027,02 €). Ninguna pieza interior tiene filas de arañazo, abolladura ni rallón.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":3,"cita":"Salpicadero | Dashboard"},
      {"zona":"zona_de_carga","dano":"Lateral trasero y trasero angular de la furgoneta","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Tramos de la tabla: 2-5 cm, >5-15 cm y >15 cm (el más pequeño empieza en 2 cm). Lateral trasero izquierdo Medium Van: arañazo 246,63 / 413,75 / 581,19 €; abolladura 357,23 / 555,95 / 754,99 €; roto o deformado 2741,23 €. Trasero angular (Vans): sin arañazo ni abolladura; rallón 81,48 / 161,56 € y roto, deformado o perdido 971,14 €.","medida":null,"maximo":null,"condicion":"El trasero angular está entre las páginas 21 (deformado) y 22 (perdido, rallón, roto)","aplica_a":"furgoneta","pagina":21,"cita":"Lateral Trasero Izquierdo"},
      {"zona":"zona_de_carga","dano":"Puertas traseras / portón y puerta lateral corredera","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Portón (RE37, página 23), puerta trasera izquierda (LS02, página 19) y puerta trasera derecha (RS02, página 24): sin precio para ninguna furgoneta (celdas vacías). Puerta corredera izquierda (LS19) también vacía; la derecha (RS19) sí tiene precio en Small y Medium Van (Medium Van arañazo 184,68 / 327,85 / 471,38 €), no en Large Van. Cerradura portón 231,89 €; manilla portón 82,45 €; cerradura puerta trasera derecha 94,10 € (Medium Van).","medida":null,"maximo":null,"condicion":"Celdas vacías: la tabla no dice cómo se cobra ese daño en furgonetas","aplica_a":"furgoneta","pagina":23,"cita":"Portón Trasero | Hatchback"},
      {"zona":"zona_de_carga","dano":"Alfombrilla del maletero o zona de carga sucia o perdida","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Medium Van 2575,10 € (Small 439,54 €, Large 6400,83 €). Turismo Intermediate 266,11 €.","medida":null,"maximo":null,"condicion":"Importes copiados tal cual de la tabla (páginas 4 y 18)","aplica_a":"ambos","pagina":18,"cita":"Alfombrilla maletero | Boot/Hatchback Carpet"},
      {"zona":"documentacion_y_llaves","dano":"Guía del usuario perdida","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"10,00 € en todos los grupos. Las llaves NO aparecen en la tabla (solo la cerradura de la puerta delantera izquierda, LS52).","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":1,"cita":"Guía del usuario | User Guidebook"},
      {"zona":"limpieza","dano":"Limpieza exterior extra (sucio o manchado)","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"60,00 € en todos los grupos de turismo y furgoneta. No hay fila de limpieza interior.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":1,"cita":"Limpieza Externa Extra | External Extra Washing"},
      {"zona":"otros","dano":"Baliza V16 y gato perdidos o rotos","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Baliza V16: 50,00 € en todos los grupos. Gato: turismo Intermediate 106,01 €; Medium Van 106,37 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":1,"cita":"Baliza Emergencia V16 | Emergency Beacon V16"},
      {"zona":"mecanica","dano":"Repostaje con combustible equivocado","no_se_cobra":"La tabla no lo dice: es una lista de precios, no define desgaste normal ni un tamaño por debajo del cual no se cobre.","se_cobra":"Turismo Intermediate 92,32 €; Medium Van 90,00 €.","medida":null,"maximo":null,"condicion":null,"aplica_a":"ambos","pagina":4,"cita":"Repostaje incorrecto | Incorrect Refuelling"},
    ],
    precios: [
      {"concepto":"Turismo Intermediate/Standard · Paragolpes delantero completo (FR05) · Abolladura > 15 cm","importe":"365,95 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes delantero completo (FR05) · Abolladura 2-5 cm","importe":"205,34 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes delantero completo (FR05) · Abolladura >5-15 cm","importe":"290,63 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes delantero completo (FR05) · Arañazo > 15 cm","importe":"192,42 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes delantero completo (FR05) · Arañazo 2-5 cm","importe":"94,92 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes delantero completo (FR05) · Arañazo >5-15 cm","importe":"148,65 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes delantero completo (FR05) · Rallón leve 2-5 cm","importe":"94,92 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes delantero completo (FR05) · Rallón medio >5-15 cm","importe":"148,65 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes delantero completo (FR05) · Roto / Deformado (mismo importe en la tabla)","importe":"628,05 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes trasero (zona central) (RE05) · Abolladura > 15 cm","importe":"375,80 €","pagina":8},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes trasero (zona central) (RE05) · Abolladura 2-5 cm","importe":"203,88 €","pagina":8},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes trasero (zona central) (RE05) · Abolladura >5-15 cm","importe":"296,25 €","pagina":8},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes trasero (zona central) (RE05) · Arañazo > 15 cm","importe":"202,27 €","pagina":8},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes trasero (zona central) (RE05) · Arañazo 2-5 cm","importe":"93,45 €","pagina":8},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes trasero (zona central) (RE05) · Arañazo >5-15 cm","importe":"154,28 €","pagina":8},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes trasero (zona central) (RE05) · Rallón leve 2-5 cm","importe":"93,45 €","pagina":8},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes trasero (zona central) (RE05) · Rallón medio >5-15 cm","importe":"154,28 €","pagina":8},
      {"concepto":"Turismo Intermediate/Standard · Paragolpes trasero (zona central) (RE05) · Roto / Deformado (mismo importe en la tabla)","importe":"652,73 €","pagina":8},
      {"concepto":"Turismo Intermediate/Standard · Puerta delantera izquierda (LS01) · Abolladura > 15 cm","importe":"514,31 €","pagina":4},
      {"concepto":"Turismo Intermediate/Standard · Puerta delantera izquierda (LS01) · Abolladura 2-5 cm","importe":"250,13 €","pagina":4},
      {"concepto":"Turismo Intermediate/Standard · Puerta delantera izquierda (LS01) · Abolladura >5-15 cm","importe":"381,33 €","pagina":4},
      {"concepto":"Turismo Intermediate/Standard · Puerta delantera izquierda (LS01) · Arañazo > 15 cm","importe":"340,78 €","pagina":4},
      {"concepto":"Turismo Intermediate/Standard · Puerta delantera izquierda (LS01) · Arañazo 2-5 cm","importe":"139,70 €","pagina":4},
      {"concepto":"Turismo Intermediate/Standard · Puerta delantera izquierda (LS01) · Arañazo >5-15 cm","importe":"239,35 €","pagina":4},
      {"concepto":"Turismo Intermediate/Standard · Puerta delantera izquierda (LS01) · Rallón leve 2-5 cm","importe":"139,70 €","pagina":4},
      {"concepto":"Turismo Intermediate/Standard · Puerta delantera izquierda (LS01) · Rallón medio >5-15 cm","importe":"239,35 €","pagina":4},
      {"concepto":"Turismo Intermediate/Standard · Puerta delantera izquierda (LS01) · Roto / Deformado (mismo importe en la tabla)","importe":"1311,07 €","pagina":4},
      {"concepto":"Turismo Intermediate/Standard · Aleta delantera izquierda (LS25) · Abolladura > 15 cm","importe":"401,62 €","pagina":6},
      {"concepto":"Turismo Intermediate/Standard · Aleta delantera izquierda (LS25) · Abolladura 2-5 cm","importe":"191,86 €","pagina":6},
      {"concepto":"Turismo Intermediate/Standard · Aleta delantera izquierda (LS25) · Abolladura >5-15 cm","importe":"296,44 €","pagina":6},
      {"concepto":"Turismo Intermediate/Standard · Aleta delantera izquierda (LS25) · Arañazo > 15 cm","importe":"228,09 €","pagina":6},
      {"concepto":"Turismo Intermediate/Standard · Aleta delantera izquierda (LS25) · Arañazo 2-5 cm","importe":"81,43 €","pagina":6},
      {"concepto":"Turismo Intermediate/Standard · Aleta delantera izquierda (LS25) · Arañazo >5-15 cm","importe":"154,46 €","pagina":6},
      {"concepto":"Turismo Intermediate/Standard · Aleta delantera izquierda (LS25) · Rallón leve 2-5 cm","importe":"81,43 €","pagina":6},
      {"concepto":"Turismo Intermediate/Standard · Aleta delantera izquierda (LS25) · Rallón medio >5-15 cm","importe":"154,46 €","pagina":6},
      {"concepto":"Turismo Intermediate/Standard · Aleta delantera izquierda (LS25) · Roto / Deformado (mismo importe en la tabla)","importe":"634,97 €","pagina":6},
      {"concepto":"Turismo Intermediate/Standard · Aleta trasera izquierda (LS33) · Abolladura > 15 cm","importe":"516,17 €","pagina":7},
      {"concepto":"Turismo Intermediate/Standard · Aleta trasera izquierda (LS33) · Abolladura 2-5 cm","importe":"250,67 €","pagina":7},
      {"concepto":"Turismo Intermediate/Standard · Aleta trasera izquierda (LS33) · Abolladura >5-15 cm","importe":"381,83 €","pagina":7},
      {"concepto":"Turismo Intermediate/Standard · Aleta trasera izquierda (LS33) · Arañazo > 15 cm","importe":"342,63 €","pagina":7},
      {"concepto":"Turismo Intermediate/Standard · Aleta trasera izquierda (LS33) · Arañazo 2-5 cm","importe":"140,24 €","pagina":7},
      {"concepto":"Turismo Intermediate/Standard · Aleta trasera izquierda (LS33) · Arañazo >5-15 cm","importe":"239,85 €","pagina":7},
      {"concepto":"Turismo Intermediate/Standard · Aleta trasera izquierda (LS33) · Rallón leve 2-5 cm","importe":"140,24 €","pagina":7},
      {"concepto":"Turismo Intermediate/Standard · Aleta trasera izquierda (LS33) · Rallón medio >5-15 cm","importe":"239,85 €","pagina":7},
      {"concepto":"Turismo Intermediate/Standard · Aleta trasera izquierda (LS33) · Roto / Deformado (mismo importe en la tabla)","importe":"2002,19 €","pagina":7},
      {"concepto":"Turismo Intermediate/Standard · Portón trasero (RE37) · Abolladura > 15 cm","importe":"397,22 €","pagina":9},
      {"concepto":"Turismo Intermediate/Standard · Portón trasero (RE37) · Abolladura 2-5 cm","importe":"247,55 €","pagina":9},
      {"concepto":"Turismo Intermediate/Standard · Portón trasero (RE37) · Abolladura >5-15 cm","importe":"322,09 €","pagina":9},
      {"concepto":"Turismo Intermediate/Standard · Portón trasero (RE37) · Arañazo > 15 cm","importe":"223,69 €","pagina":9},
      {"concepto":"Turismo Intermediate/Standard · Portón trasero (RE37) · Arañazo 2-5 cm","importe":"137,12 €","pagina":9},
      {"concepto":"Turismo Intermediate/Standard · Portón trasero (RE37) · Arañazo >5-15 cm","importe":"180,12 €","pagina":9},
      {"concepto":"Turismo Intermediate/Standard · Portón trasero (RE37) · Rallón leve 2-5 cm","importe":"137,12 €","pagina":9},
      {"concepto":"Turismo Intermediate/Standard · Portón trasero (RE37) · Rallón medio >5-15 cm","importe":"180,12 €","pagina":9},
      {"concepto":"Turismo Intermediate/Standard · Portón trasero (RE37) · Roto / Deformado (mismo importe en la tabla)","importe":"1343,44 €","pagina":9},
      {"concepto":"Turismo Intermediate/Standard · Capó (FR31) · Abolladura > 15 cm","importe":"505,03 €","pagina":3},
      {"concepto":"Turismo Intermediate/Standard · Capó (FR31) · Abolladura 2-5 cm","importe":"306,73 €","pagina":3},
      {"concepto":"Turismo Intermediate/Standard · Capó (FR31) · Abolladura >5-15 cm","importe":"404,23 €","pagina":3},
      {"concepto":"Turismo Intermediate/Standard · Capó (FR31) · Arañazo > 15 cm","importe":"331,50 €","pagina":3},
      {"concepto":"Turismo Intermediate/Standard · Capó (FR31) · Arañazo 2-5 cm","importe":"196,30 €","pagina":3},
      {"concepto":"Turismo Intermediate/Standard · Capó (FR31) · Arañazo >5-15 cm","importe":"262,25 €","pagina":3},
      {"concepto":"Turismo Intermediate/Standard · Capó (FR31) · Roto / Deformado (mismo importe en la tabla)","importe":"1038,78 €","pagina":3},
      {"concepto":"Turismo Intermediate/Standard · Llanta de aleación delantera izquierda (WH05) · Rallón leve 2-5 cm","importe":"61,52 €","pagina":14},
      {"concepto":"Turismo Intermediate/Standard · Llanta de aleación delantera izquierda (WH05) · Rallón medio >5-15 cm","importe":"66,82 €","pagina":14},
      {"concepto":"Turismo Intermediate/Standard · Llanta de aleación delantera izquierda (WH05) · Roto / Deformado (mismo importe en la tabla)","importe":"187,56 €","pagina":14},
      {"concepto":"Turismo Intermediate/Standard · Llanta de chapa delantera izquierda (WH01) · Rallón leve 2-5 cm","importe":"61,52 €","pagina":13},
      {"concepto":"Turismo Intermediate/Standard · Llanta de chapa delantera izquierda (WH01) · Rallón medio >5-15 cm","importe":"66,82 €","pagina":13},
      {"concepto":"Turismo Intermediate/Standard · Llanta de chapa delantera izquierda (WH01) · Roto / Deformado (mismo importe en la tabla)","importe":"187,56 €","pagina":13},
      {"concepto":"Turismo Intermediate/Standard · Tapacubo delantero izquierdo (WH09) · Roto","importe":"24,09 €","pagina":14},
      {"concepto":"Turismo Intermediate/Standard · Retrovisor izquierdo completo (LS08) · Roto / Deformado (mismo importe en la tabla)","importe":"265,85 €","pagina":5},
      {"concepto":"Turismo Intermediate/Standard · Carcasa retrovisor izquierdo (LS07) · Arañazo 2-5 cm","importe":"74,18 €","pagina":5},
      {"concepto":"Turismo Intermediate/Standard · Carcasa retrovisor izquierdo (LS07) · Roto","importe":"74,18 €","pagina":5},
      {"concepto":"Turismo Intermediate/Standard · Cristal retrovisor izquierdo (LS06) · Roto","importe":"69,02 €","pagina":5},
      {"concepto":"Turismo Intermediate/Standard · Luna parabrisas (FR21) · Chinazo cristal<10mm","importe":"47,25 €","pagina":2},
      {"concepto":"Turismo Intermediate/Standard · Luna parabrisas (FR21) · Roto","importe":"391,70 €","pagina":3},
      {"concepto":"Turismo Intermediate/Standard · Luneta trasera térmica (RE21) · Roto","importe":"471,53 €","pagina":9},
      {"concepto":"Turismo Intermediate/Standard · Faro delantero izquierdo (FR14) · Roto","importe":"539,68 €","pagina":2},
      {"concepto":"Turismo Intermediate/Standard · Neumático delantero izquierdo (WH35) · Cortado","importe":"109,80 €","pagina":14},
      {"concepto":"Turismo Intermediate/Standard · Neumático delantero izquierdo (WH35) · Rueda pinchada","importe":"109,80 €","pagina":14},
      {"concepto":"Turismo Intermediate/Standard · Tapizado asiento delantero izquierdo (IN14) · Quemadura","importe":"326,08 €","pagina":3},
      {"concepto":"Turismo Intermediate/Standard · Tapizado asiento delantero izquierdo (IN14) · Sucio / Manchado","importe":"326,08 €","pagina":3},
      {"concepto":"Turismo Intermediate/Standard · Moqueta interior completa (IN29) · Sucio / Manchado","importe":"672,83 €","pagina":3},
      {"concepto":"Turismo Intermediate/Standard · Limpieza externa extra (AC03) · Sucio / Manchado","importe":"60,00 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Repostaje incorrecto (IN75) · Repostaje incorrecto","importe":"92,32 €","pagina":4},
      {"concepto":"Turismo Intermediate/Standard · Baliza de emergencia V16 (AC05) · Perdido","importe":"50,00 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Guía del usuario (AC06) · Perdido","importe":"10,00 €","pagina":1},
      {"concepto":"Turismo Intermediate/Standard · Gato hidráulico (AC04) · Perdido","importe":"106,01 €","pagina":1},
      {"concepto":"Furgoneta Medium Van · Paragolpes delantero completo (FR05) · Abolladura > 15 cm","importe":"407,98 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Paragolpes delantero completo (FR05) · Abolladura 2-5 cm","importe":"219,03 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Paragolpes delantero completo (FR05) · Abolladura >5-15 cm","importe":"317,16 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Paragolpes delantero completo (FR05) · Arañazo > 15 cm","importe":"234,18 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Paragolpes delantero completo (FR05) · Arañazo 2-5 cm","importe":"108,43 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Paragolpes delantero completo (FR05) · Arañazo >5-15 cm","importe":"174,96 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Paragolpes delantero completo (FR05) · Rallón leve 2-5 cm","importe":"108,43 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Paragolpes delantero completo (FR05) · Rallón medio >5-15 cm","importe":"174,96 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Paragolpes delantero completo (FR05) · Roto / Deformado (mismo importe en la tabla)","importe":"908,83 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Paragolpes trasero (zona central) (RE05) · Abolladura > 15 cm","importe":"366,70 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Paragolpes trasero (zona central) (RE05) · Abolladura 2-5 cm","importe":"206,43 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Paragolpes trasero (zona central) (RE05) · Abolladura >5-15 cm","importe":"291,27 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Paragolpes trasero (zona central) (RE05) · Arañazo > 15 cm","importe":"192,90 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Paragolpes trasero (zona central) (RE05) · Arañazo 2-5 cm","importe":"95,83 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Paragolpes trasero (zona central) (RE05) · Arañazo >5-15 cm","importe":"149,07 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Paragolpes trasero (zona central) (RE05) · Rallón leve 2-5 cm","importe":"95,83 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Paragolpes trasero (zona central) (RE05) · Rallón medio >5-15 cm","importe":"149,07 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Paragolpes trasero (zona central) (RE05) · Roto / Deformado (mismo importe en la tabla)","importe":"627,82 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Puerta delantera izquierda (LS01) · Abolladura > 15 cm","importe":"574,68 €","pagina":18},
      {"concepto":"Furgoneta Medium Van · Puerta delantera izquierda (LS01) · Abolladura 2-5 cm","importe":"269,63 €","pagina":18},
      {"concepto":"Furgoneta Medium Van · Puerta delantera izquierda (LS01) · Abolladura >5-15 cm","importe":"422,10 €","pagina":18},
      {"concepto":"Furgoneta Medium Van · Puerta delantera izquierda (LS01) · Arañazo > 15 cm","importe":"400,88 €","pagina":18},
      {"concepto":"Furgoneta Medium Van · Puerta delantera izquierda (LS01) · Arañazo 2-5 cm","importe":"159,03 €","pagina":18},
      {"concepto":"Furgoneta Medium Van · Puerta delantera izquierda (LS01) · Arañazo >5-15 cm","importe":"279,90 €","pagina":18},
      {"concepto":"Furgoneta Medium Van · Puerta delantera izquierda (LS01) · Rallón leve 2-5 cm","importe":"159,03 €","pagina":18},
      {"concepto":"Furgoneta Medium Van · Puerta delantera izquierda (LS01) · Rallón medio >5-15 cm","importe":"279,90 €","pagina":19},
      {"concepto":"Furgoneta Medium Van · Puerta delantera izquierda (LS01) · Roto / Deformado (mismo importe en la tabla)","importe":"1722,17 €","pagina":19},
      {"concepto":"Furgoneta Medium Van · Aleta delantera izquierda (LS25) · Abolladura > 15 cm","importe":"465,63 €","pagina":20},
      {"concepto":"Furgoneta Medium Van · Aleta delantera izquierda (LS25) · Abolladura 2-5 cm","importe":"216,12 €","pagina":20},
      {"concepto":"Furgoneta Medium Van · Aleta delantera izquierda (LS25) · Abolladura >5-15 cm","importe":"341,06 €","pagina":20},
      {"concepto":"Furgoneta Medium Van · Aleta delantera izquierda (LS25) · Arañazo > 15 cm","importe":"291,83 €","pagina":20},
      {"concepto":"Furgoneta Medium Van · Aleta delantera izquierda (LS25) · Arañazo 2-5 cm","importe":"105,52 €","pagina":20},
      {"concepto":"Furgoneta Medium Van · Aleta delantera izquierda (LS25) · Arañazo >5-15 cm","importe":"198,86 €","pagina":20},
      {"concepto":"Furgoneta Medium Van · Aleta delantera izquierda (LS25) · Rallón leve 2-5 cm","importe":"105,52 €","pagina":20},
      {"concepto":"Furgoneta Medium Van · Aleta delantera izquierda (LS25) · Rallón medio >5-15 cm","importe":"198,86 €","pagina":20},
      {"concepto":"Furgoneta Medium Van · Aleta delantera izquierda (LS25) · Roto / Deformado (mismo importe en la tabla)","importe":"734,01 €","pagina":20},
      {"concepto":"Furgoneta Medium Van · Lateral trasero izquierdo (zona de carga) (LS38) · Abolladura > 15 cm","importe":"754,99 €","pagina":21},
      {"concepto":"Furgoneta Medium Van · Lateral trasero izquierdo (zona de carga) (LS38) · Abolladura 2-5 cm","importe":"357,23 €","pagina":21},
      {"concepto":"Furgoneta Medium Van · Lateral trasero izquierdo (zona de carga) (LS38) · Abolladura >5-15 cm","importe":"555,95 €","pagina":21},
      {"concepto":"Furgoneta Medium Van · Lateral trasero izquierdo (zona de carga) (LS38) · Arañazo > 15 cm","importe":"581,19 €","pagina":21},
      {"concepto":"Furgoneta Medium Van · Lateral trasero izquierdo (zona de carga) (LS38) · Arañazo 2-5 cm","importe":"246,63 €","pagina":21},
      {"concepto":"Furgoneta Medium Van · Lateral trasero izquierdo (zona de carga) (LS38) · Arañazo >5-15 cm","importe":"413,75 €","pagina":21},
      {"concepto":"Furgoneta Medium Van · Lateral trasero izquierdo (zona de carga) (LS38) · Rallón leve 2-5 cm","importe":"246,63 €","pagina":21},
      {"concepto":"Furgoneta Medium Van · Lateral trasero izquierdo (zona de carga) (LS38) · Rallón medio >5-15 cm","importe":"413,75 €","pagina":21},
      {"concepto":"Furgoneta Medium Van · Lateral trasero izquierdo (zona de carga) (LS38) · Roto / Deformado (mismo importe en la tabla)","importe":"2741,23 €","pagina":21},
      {"concepto":"Furgoneta Medium Van · Puerta corredera derecha (RS19) · Abolladura > 15 cm","importe":"645,18 €","pagina":25},
      {"concepto":"Furgoneta Medium Van · Puerta corredera derecha (RS19) · Abolladura 2-5 cm","importe":"295,28 €","pagina":25},
      {"concepto":"Furgoneta Medium Van · Puerta corredera derecha (RS19) · Abolladura >5-15 cm","importe":"470,05 €","pagina":25},
      {"concepto":"Furgoneta Medium Van · Puerta corredera derecha (RS19) · Arañazo > 15 cm","importe":"471,38 €","pagina":25},
      {"concepto":"Furgoneta Medium Van · Puerta corredera derecha (RS19) · Arañazo 2-5 cm","importe":"184,68 €","pagina":25},
      {"concepto":"Furgoneta Medium Van · Puerta corredera derecha (RS19) · Arañazo >5-15 cm","importe":"327,85 €","pagina":25},
      {"concepto":"Furgoneta Medium Van · Puerta corredera derecha (RS19) · Rallón leve 2-5 cm","importe":"184,68 €","pagina":25},
      {"concepto":"Furgoneta Medium Van · Puerta corredera derecha (RS19) · Rallón medio >5-15 cm","importe":"327,85 €","pagina":25},
      {"concepto":"Furgoneta Medium Van · Puerta corredera derecha (RS19) · Roto / Deformado (mismo importe en la tabla)","importe":"1865,43 €","pagina":25},
      {"concepto":"Furgoneta Medium Van · Trasero angular izquierdo (Vans) (LS39) · Rallón leve 2-5 cm","importe":"81,48 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Trasero angular izquierdo (Vans) (LS39) · Rallón medio >5-15 cm","importe":"161,56 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Trasero angular izquierdo (Vans) (LS39) · Roto / Deformado (mismo importe en la tabla)","importe":"971,14 €","pagina":22},
      {"concepto":"Furgoneta Medium Van · Cerradura portón trasero (RE36) · Roto","importe":"231,89 €","pagina":23},
      {"concepto":"Furgoneta Medium Van · Manilla portón trasero (RE38) · Roto","importe":"82,45 €","pagina":23},
      {"concepto":"Furgoneta Medium Van · Cerradura puerta trasera derecha (RE42) · Roto","importe":"94,10 €","pagina":24},
      {"concepto":"Furgoneta Medium Van · Capó (FR31) · Abolladura > 15 cm","importe":"378,46 €","pagina":17},
      {"concepto":"Furgoneta Medium Van · Capó (FR31) · Abolladura 2-5 cm","importe":"246,98 €","pagina":17},
      {"concepto":"Furgoneta Medium Van · Capó (FR31) · Abolladura >5-15 cm","importe":"312,71 €","pagina":17},
      {"concepto":"Furgoneta Medium Van · Capó (FR31) · Arañazo > 15 cm","importe":"204,66 €","pagina":17},
      {"concepto":"Furgoneta Medium Van · Capó (FR31) · Arañazo 2-5 cm","importe":"136,38 €","pagina":17},
      {"concepto":"Furgoneta Medium Van · Capó (FR31) · Arañazo >5-15 cm","importe":"170,51 €","pagina":17},
      {"concepto":"Furgoneta Medium Van · Capó (FR31) · Roto / Deformado (mismo importe en la tabla)","importe":"977,28 €","pagina":17},
      {"concepto":"Furgoneta Medium Van · Llanta de aleación delantera izquierda (WH05) · Rallón leve 2-5 cm","importe":"79,06 €","pagina":28},
      {"concepto":"Furgoneta Medium Van · Llanta de aleación delantera izquierda (WH05) · Rallón medio >5-15 cm","importe":"83,51 €","pagina":28},
      {"concepto":"Furgoneta Medium Van · Llanta de aleación delantera izquierda (WH05) · Roto / Deformado (mismo importe en la tabla)","importe":"135,52 €","pagina":28},
      {"concepto":"Furgoneta Medium Van · Llanta de chapa delantera izquierda (WH01) · Rallón leve 2-5 cm","importe":"79,06 €","pagina":27},
      {"concepto":"Furgoneta Medium Van · Llanta de chapa delantera izquierda (WH01) · Rallón medio >5-15 cm","importe":"83,51 €","pagina":27},
      {"concepto":"Furgoneta Medium Van · Llanta de chapa delantera izquierda (WH01) · Roto / Deformado (mismo importe en la tabla)","importe":"135,52 €","pagina":27},
      {"concepto":"Furgoneta Medium Van · Tapacubo delantero izquierdo (WH09) · Roto","importe":"23,89 €","pagina":28},
      {"concepto":"Furgoneta Medium Van · Retrovisor izquierdo completo (LS08) · Roto / Deformado (mismo importe en la tabla)","importe":"246,67 €","pagina":19},
      {"concepto":"Furgoneta Medium Van · Carcasa retrovisor izquierdo (LS07) · Arañazo 2-5 cm","importe":"51,66 €","pagina":19},
      {"concepto":"Furgoneta Medium Van · Carcasa retrovisor izquierdo (LS07) · Roto","importe":"51,66 €","pagina":19},
      {"concepto":"Furgoneta Medium Van · Cristal retrovisor izquierdo (LS06) · Roto","importe":"54,98 €","pagina":19},
      {"concepto":"Furgoneta Medium Van · Luna parabrisas (FR21) · Chinazo cristal<10mm","importe":"48,00 €","pagina":17},
      {"concepto":"Furgoneta Medium Van · Luna parabrisas (FR21) · Roto","importe":"302,83 €","pagina":17},
      {"concepto":"Furgoneta Medium Van · Faro delantero izquierdo (FR14) · Roto","importe":"459,24 €","pagina":16},
      {"concepto":"Furgoneta Medium Van · Neumático delantero izquierdo (WH35) · Cortado","importe":"119,34 €","pagina":28},
      {"concepto":"Furgoneta Medium Van · Neumático delantero izquierdo (WH35) · Rueda pinchada","importe":"119,34 €","pagina":28},
      {"concepto":"Furgoneta Medium Van · Tapizado asiento delantero izquierdo (IN14) · Quemadura","importe":"335,20 €","pagina":17},
      {"concepto":"Furgoneta Medium Van · Tapizado asiento delantero izquierdo (IN14) · Sucio / Manchado","importe":"335,20 €","pagina":17},
      {"concepto":"Furgoneta Medium Van · Moqueta interior completa (IN29) · Sucio / Manchado","importe":"970,37 €","pagina":18},
      {"concepto":"Furgoneta Medium Van · Alfombrilla maletero / zona de carga (Boot/Hatchback Carpet) (IN72) · Perdido","importe":"2575,10 €","pagina":18},
      {"concepto":"Furgoneta Medium Van · Alfombrilla maletero / zona de carga (Boot/Hatchback Carpet) (IN72) · Sucio / Manchado","importe":"2575,10 €","pagina":18},
      {"concepto":"Furgoneta Medium Van · Limpieza externa extra (AC03) · Sucio / Manchado","importe":"60,00 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Repostaje incorrecto (IN75) · Repostaje incorrecto","importe":"90,00 €","pagina":18},
      {"concepto":"Furgoneta Medium Van · Baliza de emergencia V16 (AC05) · Perdido","importe":"50,00 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Guía del usuario (AC06) · Perdido","importe":"10,00 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Gato hidráulico (AC04) · Perdido","importe":"106,37 €","pagina":15},
      {"concepto":"Furgoneta Medium Van · Portón trasero (RE37) · todos los daños (arañazo, abolladura, rallón, roto)","importe":"sin precio (celdas vacías para Small, Medium y Large Van)","pagina":23},
      {"concepto":"Furgoneta Medium Van · Puerta trasera izquierda (LS02) · todos los daños","importe":"sin precio (celdas vacías para Small, Medium y Large Van)","pagina":19},
      {"concepto":"Furgoneta Medium Van · Puerta corredera izquierda (LS19) · todos los daños","importe":"sin precio (celdas vacías para Small, Medium y Large Van; la derecha RS19 sí tiene)","pagina":19},
      {"concepto":"Ambos · Llaves (pérdida, rotura o copia)","importe":"no figura en la tabla","pagina":1},
      {"concepto":"Furgoneta Medium Van · Puerta trasera derecha (RS02) · todos los daños","importe":"sin precio (celdas vacías para Small, Medium y Large Van)","pagina":24},
      {"concepto":"Furgoneta Medium Van · Luneta trasera térmica (RE21) · Roto / Deformado","importe":"sin precio (celdas vacías para Small, Medium y Large Van)","pagina":23},
      {"concepto":"Furgoneta Medium Van · Trasero angular izquierdo (Vans) (LS39) · Deformado","importe":"971,14 €","pagina":21},
      {"concepto":"Furgoneta Medium Van · Trasero angular izquierdo (Vans) (LS39) · Perdido","importe":"971,14 €","pagina":22},
      {"concepto":"Turismo Intermediate/Standard · Rueda de emergencia (WH13) · Cortado / Roto / Perdido / Pinchada","importe":"96,02 €","pagina":14},
      {"concepto":"Furgoneta Medium Van · Rueda de emergencia (WH13) · Cortado / Roto / Perdido / Pinchada","importe":"120,45 €","pagina":28},
      {"concepto":"Turismo Intermediate/Standard · Piloto trasero izquierdo completo (RE14) · Roto / Deformado / Perdido","importe":"271,45 €","pagina":9},
      {"concepto":"Furgoneta Medium Van · Piloto trasero izquierdo completo (RE14) · Roto / Deformado / Perdido","importe":"192,60 €","pagina":23},
      {"concepto":"Turismo Intermediate/Standard · Moqueta interior completa (IN29) · Cortado / Quemadura / Perdido","importe":"692,78 €","pagina":3},
    ],
    proceso: {
      "quien_inspecciona": "Europcar en la devolución: un agente de Europcar o su representante, con el cliente delante si está; si devuelve fuera de horario o sin estar, la revisa Europcar sola (página de política de gestión de daños).",
      "informe_al_cliente": "Si está presente y firma la declaración de devolución con los daños, recibe la factura después. Si no está, Europcar le envía el parte (si lo hay), la declaración de devolución con los daños, imágenes de los daños y la estimación de costes.",
      "plazo_para_discutir": "14 días desde el envío de los documentos por correo electrónico o postal. La página lo pone en el caso de devolución fuera de horario o sin el cliente (o si no firma la declaración); si no responde ni justifica su oposición en ese plazo, Europcar puede facturar la estimación. Reclamaciones: atención al cliente de Europcar o el servicio europeo de conciliación ECRCS.",
      "se_puede_reparar_antes": "Ni la tabla ni la página lo dicen.",
      "recomendaciones_antes_de_devolver": []
    },
  },
}

/* ── LO QUE NO SALE DEL JSON: cómo se enseña ─────────────────────────────────────────────────────────────────────────
   Todo lo de abajo es nuestro (cómo se agrupa, cómo se pregunta y cómo se dice), nunca una cifra nueva: las cifras y
   las frases de cada regla son las de DOCUMENTOS. */

/* Las compañías, en el orden de la lista. `documentos`: el que vale para cada tipo de vehículo. `voz`: cómo se llama
   su documento al hablar de él (los alquileres no tienen «guía» ni «perito»). `descripcion`: la de los buscadores
   (155 caracteres como mucho). `enOtra: false`: no sale en «Otra compañía» (Arval no publica su guía de daños). */
export const COMPANIAS = [
  { slug: 'ayvens', nombre: 'Ayvens', nombreLargo: 'Ayvens (antes LeasePlan)', tipo: 'renting', voz: 'guia',
    documentos: { furgoneta: 'ayvens-furgonetas', turismo: 'ayvens-turismos' },
    aviso: 'Ayvens tiene publicados dos documentos de LeasePlan, la marca que tenía antes: uno para furgonetas y vehículos industriales y otro para turismos. Ninguno trae fecha.',
    descripcion: 'Qué acepta Ayvens (antes LeasePlan) como desgaste normal al devolver un renting y qué no, criterio a criterio y con la página de su guía.' },
  { slug: 'alphabet', nombre: 'Alphabet', nombreLargo: 'Alphabet', tipo: 'renting', voz: 'guia',
    documentos: { furgoneta: 'alphabet', turismo: 'alphabet' }, aviso: null,
    descripcion: 'Qué daños da Alphabet por no facturables al devolver un renting y cuáles factura, criterio a criterio y con la página de su guía.' },
  { slug: 'volkswagen-financial-services', nombre: 'Volkswagen Financial Services', nombreLargo: 'Volkswagen Financial Services (Volkswagen Renting S.A.)', tipo: 'renting', voz: 'guia',
    documentos: { furgoneta: 'vwfs', turismo: 'vwfs' }, aviso: 'Su manual no separa turismos y furgonetas, ni tiene un apartado para la zona de carga.',
    descripcion: 'Qué acepta Volkswagen Financial Services al devolver un renting y qué no, criterio a criterio y con la página de su manual.' },
  { slug: 'bmw-financial-services', nombre: 'BMW Financial Services', nombreLargo: 'BMW Financial Services (BMW Bank GmbH, sucursal en España)', tipo: 'renting', voz: 'guia',
    objeto: 'el coche al final del contrato', documentos: { turismo: 'bmw' },
    aviso: 'El manual que hemos encontrado es solo de turismos. Es el de BMW Financial Services para devolver el coche al final del contrato: habla de Valor Futuro y de Valor Final.',
    descripcion: 'Qué acepta BMW Financial Services al devolver el coche al final del contrato y qué no, criterio a criterio y con la página de su manual.' },
  { slug: 'athlon', nombre: 'Athlon', nombreLargo: 'Athlon', tipo: 'renting', voz: 'guia',
    documentos: { furgoneta: 'athlon', turismo: 'athlon' }, aviso: 'Su manual no da ninguna medida ni dice cómo cobra lo que no acepta. Lo de fuera depende sobre todo de con quién tengas el seguro.',
    descripcion: 'Qué acepta Athlon al devolver un renting y qué no, zona a zona y con la página de su manual. Lo de fuera depende de tu seguro.' },
  { slug: 'arval', nombre: 'Arval', nombreLargo: 'Arval (Arval Service Lease, España)', tipo: 'renting', voz: 'ficha', enOtra: false,
    documentos: { furgoneta: 'arval', turismo: 'arval' },
    aviso: 'Arval no publica su guía de daños: la tiene en su área privada de clientes. Lo que sí publica es su ficha de fin de contrato, con precios. Sirve para las llaves, la documentación, los accesorios, la limpieza y el interior; de la carrocería no da ningún criterio.',
    descripcion: 'Lo que dice la ficha de fin de contrato de Arval: qué pide al devolver un renting y los precios que publica, con su página.' },
  { slug: 'hertz', nombre: 'Hertz', nombreLargo: 'Hertz de España SL', tipo: 'alquiler', voz: 'condiciones',
    documentos: { furgoneta: 'hertz', turismo: 'hertz' },
    aviso: 'Es un alquiler, no un renting. Sus condiciones de alquiler dicen qué daños se cobran, con medidas. No distinguen turismos y furgonetas.',
    descripcion: 'Qué daños cobra Hertz al devolver un vehículo de alquiler según sus condiciones, con las medidas y la página de cada uno.' },
  { slug: 'europcar', nombre: 'Europcar', nombreLargo: 'Europcar España', tipo: 'alquiler', voz: 'tabla',
    documentos: { furgoneta: 'europcar', turismo: 'europcar' },
    aviso: 'Es un alquiler, no un renting. Su tabla de daños no dice qué es desgaste normal: da costes medios de reparación estimados por la firma AUDATEX (pág. 1), por tramos de tamaño (de 2 a 5 cm, de más de 5 a 15 cm y de más de 15 cm), y no dice qué pasa por debajo de 2 cm. Su página de política de daños dice que con esa tabla se cobran los daños menores; los demás, con el presupuesto de un taller o la valoración de un experto independiente que contrata Europcar, más la inmovilización del vehículo y un cargo administrativo que no publica. La protección que contrates puede reducir o quitar lo que pagas. Los importes de ejemplo son de dos de sus grupos: turismo Intermediate/Standard y furgoneta Medium Van; los demás grupos tienen otros.',
    descripcion: 'Qué daños pone con precio la tabla de Europcar al devolver un vehículo de alquiler: costes medios estimados, por tramos y con su página.' },
]

/* Cómo se nombra el documento de cada compañía en las frases. */
const VOCES = {
  guia: { su: 'su guía', Su: 'Su guía', plural: false, noAcepta: 'Su guía no acepta' },
  ficha: { su: 'su ficha', Su: 'Su ficha', plural: false, noAcepta: 'Su ficha dice' },
  condiciones: { su: 'sus condiciones', Su: 'Sus condiciones', plural: true, noAcepta: 'Sus condiciones cobran' },
  tabla: { su: 'su tabla', Su: 'Su tabla', plural: false, noAcepta: 'Su tabla pone' },
}

/* La condición de Alphabet para lo de fuera (su pág. 6), con sus palabras: entera en el resultado y, corta, en cada
   paso de fuera. La frase admite dos lecturas («en caso contrario» puede ir con el contrato o con el «reparado»): por
   eso va entera y entre comillas, y la corta no la resume hacia ninguna. */
const ALPHABET_FUERA = 'Lo de fuera depende de tu contrato. Su pág. 6: «Sólo en el caso de que el contrato de renting no incluya el seguro obligatorio ni el servicio de reparaciones (es decir, en los casos en los que el seguro sea por cuenta del cliente), el vehículo deberá devolverse totalmente reparado exteriormente. En caso contrario, los daños exteriores serán facturados al cliente».'
const ALPHABET_FUERA_CORTA = 'Lo de fuera depende de tu contrato: su pág. 6 no lo trata igual si el renting incluye el seguro y el servicio de reparaciones que si el seguro va por tu cuenta. En el resultado tienes su frase entera.'

/* LA EDAD DE CADA DOCUMENTO, a la vista (en la entrada, en cada paso y en el resultado) cuando no trae fecha. */
const SIN_FECHA = 'sin fecha: puede no ser el que esté en vigor. Pide a tu compañía el vigente.'
export const VIGENCIA = {
  'ayvens-furgonetas': `Documento de LeasePlan (hoy Ayvens), ${SIN_FECHA}`,
  'ayvens-turismos': `Documento de LeasePlan (hoy Ayvens), ${SIN_FECHA}`,
  bmw: `Documento ${SIN_FECHA}`,
  athlon: `Documento ${SIN_FECHA}`,
  arval: `Documento ${SIN_FECHA}`,
}

/* De quién es el documento en las citas («LeasePlan (hoy Ayvens), pág. 7»): si no está aquí, el nombre de la compañía. */
export const AUTOR = { 'ayvens-furgonetas': 'LeasePlan (hoy Ayvens)', 'ayvens-turismos': 'LeasePlan (hoy Ayvens)' }

/* DÓNDE DICE CADA DOCUMENTO QUE COBRA. «Su guía dice que se factura» solo vale si el documento habla de cobro,
   factura, coste, cargo o importe para ese caso: o en la propia regla, o en una frase general que lo cubre (esta tabla,
   con su página y sus palabras, y los temas a los que alcanza). Lo demás que no acepta es «Su guía no lo acepta».
   Athlon, Volkswagen Financial Services y BMW (salvo el testigo de avería) no tienen frase general: sus manuales solo
   dicen qué es aceptable y qué no. scripts/check-guias-renting.mjs lo vigila paso a paso.
   Cada frase: `pagina` y `cita` (o `fuente` y `url` si está fuera del documento), o `apartado` cuando lo que lo dice es
   el rótulo «Facturables» de ese apartado; `aplica_a` si solo vale para un vehículo; `condicion` si el documento pone
   una condición a ese cobro (se enseña con la frase, en el paso y en el resultado).
   Alphabet: cada cosa con SU página. La 9 es la del habitáculo (no vale para lo de fuera); lo de fuera lo pone bajo
   «Facturables» en las págs. 28 a 32, con la condición de su pág. 6. */
const DANOS = ['paragolpes', 'lunas', 'aranazos', 'rozaduras', 'abolladuras', 'pintura', 'retrovisores', 'llantas', 'neumaticos', 'carga']
const AYVENS_COBRO = { pagina: 3, cita: 'intentaremos evaluar los recargos por daños de manera justa, cobrando por reparación en lugar de por sustitución siempre que sea posible', temas: DANOS }
const FACTURABLES = 'Facturables'
export const COBRO = {
  'ayvens-furgonetas': [AYVENS_COBRO],
  'ayvens-turismos': [AYVENS_COBRO],
  alphabet: [
    { pagina: 28, apartado: '8.1 Parabrisas, ópticas, etc', cita: FACTURABLES, temas: ['lunas'], condicion: ALPHABET_FUERA, condicionCorta: ALPHABET_FUERA_CORTA },
    { pagina: 30, apartado: '8.2 Llantas y tapacubos', cita: FACTURABLES, temas: ['llantas'], condicion: ALPHABET_FUERA, condicionCorta: ALPHABET_FUERA_CORTA },
    { pagina: 31, apartado: '8.3 Pintura', cita: FACTURABLES, temas: ['aranazos', 'pintura'], condicion: ALPHABET_FUERA, condicionCorta: ALPHABET_FUERA_CORTA },
    { pagina: 32, apartado: '8.4 Carrocería', cita: FACTURABLES, temas: ['abolladuras', 'paragolpes', 'retrovisores'], condicion: ALPHABET_FUERA, condicionCorta: ALPHABET_FUERA_CORTA },
    { pagina: 9, cita: 'Se considerarán daños facturables y, por tanto, serán facturados al cliente, aquellos que no presentaba el vehículo en el momento de la entrega', temas: ['interior'] },
    { pagina: 13, cita: 'Se considerará daños facturables aquellos elementos dañados por roces, abrasiones, rayaduras, que estén producidos por circunstancias distintas a un uso correcto o por manipulación indebida', temas: ['carga'], aplica_a: 'turismo' },
    { pagina: 16, cita: 'Se considerarán como daños facturables: […] Arañazos con pérdida de pintura o material, que superen los 100 mm de longitud y/o los 5 mm de anchura, por extensión o acumulación', temas: ['carga'], aplica_a: 'furgoneta' },
    { pagina: 4, cita: 'En el caso de no devolver la segunda llave en el momento de la devolución del vehículo, le será facturado el coste íntegro del duplicado de la llave', temas: ['llaves'] },
    { pagina: 6, cita: 'Alphabet facturará al cliente por los documentos y accesorios entregados con el vehículo al comienzo del contrato de renting y no devueltos a su finalización', temas: ['llaves'] },
    { pagina: 20, cita: 'Se facturarán las siguientes labores de limpieza', temas: ['limpieza'] },
  ],
  hertz: [
    { pagina: 17, cita: 'Si se detectan nuevos daños tras la devolución del vehículo, se le cobrarán, a menos que se trate de un desgaste normal causado por un uso razonable', temas: ['lunas', 'aranazos', 'abolladuras', 'retrovisores', 'llantas', 'neumaticos', 'interior', 'mecanica'] },
    { pagina: 14, cita: 'Cargos por accesorios/piezas que falten', temas: ['accesorios'] },
  ],
  europcar: [{ fuente: 'Su página de política de daños', url: 'https://www.europcar.es/es-es/p/informacion-legal/politica-de-gestion-de-danos', cita: 'Los Daños menores encontrados en el Vehículo en el momento de la devolución se le cobrarán de conformidad con dicha lista', temas: [...DANOS, 'interior', 'limpieza', 'accesorios'] }],
}

/* Lo que se enseña en lugar de lo que escribió el lector cuando era una deducción suya, una nota para nosotros o una
   palabra que no es la del documento («enseña solo lo que la guía afirma»): nunca una cifra. `null` en se_cobra: la
   guía solo dice lo que acepta. Los de Hertz cambian «la guía» por «sus condiciones» (es un alquiler); los de Europcar
   quitan «precio fijo» (su tabla da costes medios estimados, pág. 1). */
/* `paginaCobro`: la página donde está lo que no acepta o lo que cobra, cuando no es la de la regla (la del lector
   iba escrita dentro del texto, «(página 20) Limpieza…», y salían dos páginas en la misma línea). No es una cifra
   nueva: el comprobador exige que esa página la nombre el texto verificado o una frase de COBRO del documento. */
const SUS_CONDICIONES_SIN_TOLERANCIA = { no_se_cobra: 'Sus condiciones no dan tolerancia.' }
export const AJUSTES = {
  'ayvens-furgonetas': {
    12: { se_cobra: null, condicion: 'Aceptable con 1,6 mm o más, o con lo que exija la ley local.' },
    15: { se_cobra: 'Arañazos o abrasiones de más de 10 cm.' },
    16: { se_cobra: 'Arañazos o abrasiones de más de 10 cm.' },
    20: { condicion: 'Fuera de la zona A del parabrisas (la guía no dice qué es); el centímetro cuenta impacto y ramificaciones.' },
    25: { condicion: 'La guía lo pone en el apartado «Espejos y accesorios externos», sin decir a qué pieza se refiere.' },
    49: { se_cobra: 'Hay que pagar todos los costes de quitar adhesivos, rótulos y calcomanías (en carrocería o cristales). Remite al contrato de cada cliente.' },
  },
  'ayvens-turismos': {
    14: { se_cobra: 'Arañazos, rozaduras o abrasiones de más de 10 cm; llanta o tapacubos deformado.', condicion: 'Que la llanta o el tapacubos no esté deformado.' },
    15: { se_cobra: 'Arañazos, rozaduras o abrasiones de más de 10 cm; llanta o tapacubos deformado.', condicion: 'Que la llanta o el tapacubos no esté deformado.' },
    18: { se_cobra: null, condicion: null },
    31: { se_cobra: 'Hay que pagar todos los costes de quitarlos (carrocería o cristales), sea cual sea su tamaño o estado; remite al contrato local.' },
  },
  alphabet: {
    4: { se_cobra: 'Falta de material en la pieza, o más de un arañazo, corte o picadura en la misma pieza; daños por uso incorrecto o manipulación indebida', paginaCobro: 13 },
    5: { se_cobra: null },
    7: { se_cobra: 'Daños en superficies que superen el 10% de la superficie de la pieza', paginaCobro: 16 },
    14: { se_cobra: 'Limpieza especializada de manchas y olores, aspirado de pelo de animal, suciedad o basura que pida aspirado exhaustivo. Si son varias piezas, cuenta como limpieza alta', paginaCobro: 20 },
    19: { paginaCobro: 30 },
    20: { paginaCobro: 30 },
    21: { paginaCobro: 30 },
    22: { paginaCobro: 30 },
    23: { se_cobra: null },
    26: { no_se_cobra: 'La guía solo dice lo que se cobra.' },
    30: { condicion: 'Se mide en minutos de trabajo de pulido.' },
    37: { no_se_cobra: 'Devolver todo lo entregado.', se_cobra: 'La segunda llave, por el coste íntegro del duplicado; y los documentos y accesorios no devueltos (su pág. 6).' },
    38: { se_cobra: 'Si se devuelve rotulado sin haber contratado la desrotulación en la cuota, Alphabet factura su coste y las posibles reparaciones para igualar el aspecto exterior, según el perito.' },
    39: { se_cobra: 'Si se hicieron sin autorización o fuera del contrato, pueden dar lugar a cargos adicionales por la destransformación y por los daños de montaje o desmontaje.' },
  },
  athlon: {
    9: { no_se_cobra: 'Suciedad de un uso normal que se quite con aspirado o limpieza estándar', se_cobra: 'Manchas o suciedad no derivada de un uso normal', paginaCobro: 11 },
  },
  vwfs: {
    0: { se_cobra: null, condicion: 'Vale también para la rueda de repuesto si la hay.' },
    14: { se_cobra: 'Más de dos impactos en la misma pieza.' },
    47: { se_cobra: 'La guía no lo dice.' },
  },
  bmw: {
    6: { no_se_cobra: 'Daños que solo afectan a la capa de laca, de no más de 40 mm «en capas verticales» (así lo escribe la guía) y no más de 4 ocasiones.' },
    19: { no_se_cobra: 'La guía no lo dice: solo dice lo que no se acepta.' },
    30: { no_se_cobra: 'Entregar la ficha técnica y el permiso de circulación originales, el impuesto de circulación del año pagado, todos los juegos de llaves, los manuales y el libro de mantenimiento original sellado y los accesorios (navegador, etc.); además, el DNI del titular o, en empresas, CIF, escrituras, poderes y la factura de venta por el Valor Futuro.' },
  },
  arval: {
    0: { no_se_cobra: 'La ficha no da ninguna medida ni dice qué cuenta como desgaste normal en el exterior. Dice que no hace falta hacer reparaciones estéticas o menores del exterior antes de devolver.' },
    2: { se_cobra: 'Hay que devolver el vehículo totalmente reparado.' },
  },
  hertz: {
    0: { no_se_cobra: 'El desgaste normal causado por un uso razonable. Si sus condiciones dan una medida, no se cobra ningún daño menor que esa medida.' },
    1: { condicion: 'Solo si no se ve el metal/plástico subyacente; si se ve, se cobra aunque mida menos de 10 mm. Sus condiciones no dicen qué pasa con uno de 10 mm justos con el metal a la vista.' },
    2: { condicion: 'Solo si no se ve el metal/plástico subyacente. Sus condiciones no aclaran si los 10 mm son de cada marca o del conjunto.' },
    4: { no_se_cobra: 'Sus condiciones no admiten ninguna como desgaste: no dan tolerancia.' },
    5: { no_se_cobra: 'Sus condiciones no admiten ningún daño como desgaste (no hablan del desgaste de la banda de rodadura).' },
    6: SUS_CONDICIONES_SIN_TOLERANCIA,
    7: SUS_CONDICIONES_SIN_TOLERANCIA,
    8: { ...SUS_CONDICIONES_SIN_TOLERANCIA, condicion: 'Sus condiciones dicen «espejos» sin precisar si son solo los retrovisores exteriores.' },
    10: { condicion: 'Sus condiciones no dicen si los 10 mm son largo o diámetro.' },
    11: SUS_CONDICIONES_SIN_TOLERANCIA,
    12: SUS_CONDICIONES_SIN_TOLERANCIA,
    13: SUS_CONDICIONES_SIN_TOLERANCIA,
    14: SUS_CONDICIONES_SIN_TOLERANCIA,
    16: SUS_CONDICIONES_SIN_TOLERANCIA,
    17: { ...SUS_CONDICIONES_SIN_TOLERANCIA, condicion: 'Solo vehículos eléctricos (Condiciones de los vehículos eléctricos). Para el resto de vehículos sus condiciones no publican precio de llaves.' },
    20: { condicion: 'Solo vehículos eléctricos.' },
  },
  europcar: {
    0: { se_cobra: 'Tramos de la tabla: 2-5 cm, >5-15 cm y >15 cm (el más pequeño empieza en 2 cm). Coste medio estimado por pieza y tramo. Ej. turismo Intermediate, puerta delantera: 139,70 / 239,35 / 340,78 €; Medium Van: 159,03 / 279,90 / 400,88 €.' },
    1: { se_cobra: 'Tramos de la tabla: 2-5 cm, >5-15 cm y >15 cm (el más pequeño empieza en 2 cm). Coste medio estimado por pieza y tramo. Ej. turismo Intermediate, puerta delantera: 250,13 / 381,33 / 514,31 €; Medium Van: 269,63 / 422,10 / 574,68 €.' },
    12: { se_cobra: 'Chinazo de menos de 10 mm: coste medio estimado (turismo Intermediate 47,25 €; Medium Van 48,00 €). No dice nada del campo de visión ni de chinazos mayores (fuera de eso solo hay luna rota).', condicion: 'Es el tramo que tiene precio, no un margen sin cobro. Solo el parabrisas tiene fila de chinazo.' },
    22: { condicion: 'Así lo pone su tabla (págs. 4 y 18).' },
  },
}

/* Los precios que no son de daños y no van en la tabla de precios: se dicen aparte, con su página. */
export const PRECIOS_APARTE = {
  hertz: { indices: [0], texto: 'Su pág. 4 pone además un bloqueo de un mínimo de 200 € en la tarjeta, junto al depósito de combustible: es una retención al recoger el vehículo, no un cargo por daños.' },
}

/* Lo que su documento dice además y cambia lo que se paga: va en el paso y en el resultado. */
const NOTA_EUROPCAR = 'Su tabla pone precio desde 2 cm y no dice qué pasa por debajo.'
const NOTA_VWFS = 'Si tu contrato incluye la póliza de seguros de Volkswagen Financial Services, su manual dice que las reparaciones estéticas (pintura, chapa, parachoques y molduras) no serán necesarias en los últimos 3 meses del contrato (págs. 4, 7, 8 y 9).'
const NOTA_ZONA_A = 'La guía no dice qué es la zona A del parabrisas.'

/* EL RECORRIDO de cada documento: un paso por regla que se pregunta (`regla`, su índice en DOCUMENTOS), las que se
   preguntan en la misma pregunta (`junto`) y, en el mismo paso, «También mira» con las demás (`tambien`). `aparte`:
   las que no tienen pregunta y se enseñan en el resultado. Cada regla del documento sale UNA vez (lo comprueba
   scripts/check-guias-renting.mjs). Un paso o una regla que no vale para el vehículo elegido (su `aplica_a`) no se enseña.
   `si`: qué dice el resultado si la respuesta es «Sí, alguna»:
     'factura'      → «Su guía dice que se factura»: solo si el documento lo dice para ese caso (ver COBRO);
     'fuera'        → «Su guía no lo acepta»: no entra en lo que da por bueno y no dice cómo lo cobra;
     'sin_criterio' → «Su guía no lo dice» (o depende de algo que no preguntamos).
   La cifra grande del resultado cuenta las dos primeras.
   `sujeto`: con qué se compara la ayuda para medir («Si la abolladura es…»). `nota`: una línea nuestra, verdadera, que
   va en el paso y en el resultado. `piezas`: qué se marca en el dibujo si no es lo de su zona. */
export const RECORRIDOS = {
  'ayvens-furgonetas': {
    pasos: [
      { tema: 'paragolpes', zona: 'paragolpes', regla: 7, si: 'factura', pregunta: '¿Algún arañazo o rozadura en los paragolpes o la rejilla de más de 10 cm, o que no se vaya puliendo?', hallazgo: 'Arañazo en un paragolpes o la rejilla', tambien: [8, 9, 10, 11] },
      { tema: 'lunas', zona: 'lunas', regla: 20, junto: [21], si: 'factura', nota: NOTA_ZONA_A, pregunta: '¿Algún impacto o grieta en las lunas de más de 1 cm, contando sus ramas, o alguno, del tamaño que sea, en la zona A del parabrisas?', hallazgo: 'Impacto o grieta en una luna fuera de lo que acepta', tambien: [22, 23, 24, 29] },
      { tema: 'aranazos', zona: 'carroceria', regla: 0, si: 'factura', pregunta: '¿Algún arañazo o rozadura en la chapa de más de 10 cm, o que no se vaya puliendo?', hallazgo: 'Arañazo en la chapa', tambien: [28, 49] },
      { tema: 'abolladuras', zona: 'carroceria', regla: 1, si: 'factura', sujeto: 'la abolladura', pregunta: '¿Alguna abolladura de más de 2 cm, o más de dos en el mismo panel?', hallazgo: 'Abolladura de más de 2 cm, o más de dos en un panel', tambien: [] },
      { tema: 'pintura', zona: 'pintura', regla: 2, si: 'factura', pregunta: '¿Desconchados de gravilla que cubran más del 25 % de algún panel?', hallazgo: 'Desconchados en más del 25 % de un panel', tambien: [3, 4, 5, 6] },
      { tema: 'retrovisores', zona: 'retrovisores', regla: 25, si: 'factura', sujeto: 'el arañazo', pregunta: '¿Algún arañazo o marca de más de 5 cm en los retrovisores o los accesorios de fuera?', hallazgo: 'Arañazo de más de 5 cm en un retrovisor o un accesorio de fuera', tambien: [26] },
      { tema: 'llantas', zona: 'llantas', regla: 15, si: 'factura', pregunta: '¿Algún arañazo de más de 10 cm en la cara de una llanta o un tapacubos?', hallazgo: 'Arañazo de más de 10 cm en una llanta', tambien: [16, 17] },
      { tema: 'neumaticos', zona: 'neumaticos', regla: 13, si: 'factura', pregunta: '¿Algún neumático con bultos, grietas o cortes?', hallazgo: 'Neumático con bultos, grietas o cortes', tambien: [14, 12, 18, 19] },
      { tema: 'carga', zona: 'zona_de_carga', regla: 30, si: 'factura', pregunta: '¿Algún golpe o arañazo de la zona de carga que se vea desde fuera?', hallazgo: 'Daño de la zona de carga que se ve desde fuera', tambien: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40] },
      { tema: 'interior', zona: 'interior', regla: 41, si: 'fuera', pregunta: '¿Alguna mancha en asientos, moqueta o alfombrillas que no salga con una limpieza normal?', hallazgo: 'Manchas que no salen con una limpieza general', tambien: [42, 43, 44, 45, 46] },
      { tema: 'llaves', zona: 'documentacion_y_llaves', regla: 50, si: 'fuera', pregunta: '¿Te falta algún juego de llaves, el principal o el de repuesto?', hallazgo: 'Falta un juego de llaves', tambien: [51, 52] },
      { tema: 'limpieza', zona: 'limpieza', regla: 47, si: 'fuera', pregunta: '¿Algún mal olor que necesite una limpieza especial para irse?', hallazgo: 'Mal olor que pide limpieza especializada', tambien: [48] },
    ],
    aparte: [27],
  },
  'ayvens-turismos': {
    pasos: [
      { tema: 'paragolpes', zona: 'paragolpes', regla: 7, si: 'factura', pregunta: '¿Alguna marca o arañazo en los paragolpes o la rejilla de más de 10 cm, o que no se vaya puliendo?', hallazgo: 'Arañazo en un paragolpes o la rejilla', tambien: [8, 11, 12, 13] },
      { tema: 'rozaduras', zona: 'paragolpes', regla: 9, junto: [10], si: 'factura', sujeto: 'la rozadura', pregunta: '¿Alguna rozadura o abrasión de más de 2 cm en los paragolpes o la rejilla, o alguna que no se vaya puliendo?', hallazgo: 'Rozadura de más de 2 cm en un paragolpes o la rejilla', tambien: [] },
      { tema: 'lunas', zona: 'lunas', regla: 22, si: 'factura', nota: NOTA_ZONA_A, pregunta: '¿Algún impacto o grieta en el parabrisas de más de 1 cm, contando sus ramas, o alguna grieta, del tamaño que sea, en su zona A?', hallazgo: 'Impacto o grieta en el parabrisas fuera de lo que acepta', tambien: [23, 24, 25] },
      { tema: 'aranazos', zona: 'carroceria', regla: 0, si: 'factura', pregunta: '¿Algún arañazo o desconchado en la chapa de más de 10 cm, o que no se vaya puliendo?', hallazgo: 'Arañazo en la chapa', tambien: [5] },
      { tema: 'rozaduras', zona: 'carroceria', regla: 1, si: 'factura', sujeto: 'la rozadura', pregunta: '¿Alguna rozadura o abrasión en la chapa de más de 2 cm, o alguna que no se vaya puliendo?', hallazgo: 'Rozadura de más de 2 cm en la chapa', tambien: [] },
      { tema: 'abolladuras', zona: 'carroceria', regla: 2, si: 'factura', sujeto: 'la abolladura', pregunta: '¿Alguna abolladura de más de 2 cm, o más de dos en el mismo panel?', hallazgo: 'Abolladura de más de 2 cm, o más de dos en un panel', tambien: [] },
      { tema: 'pintura', zona: 'pintura', regla: 3, si: 'factura', pregunta: '¿Marcas de gravilla que cubran más del 25 % de algún panel?', hallazgo: 'Gravilla en más del 25 % de un panel', tambien: [4, 6] },
      { tema: 'retrovisores', zona: 'retrovisores', regla: 26, si: 'factura', sujeto: 'el arañazo', pregunta: '¿Algún arañazo o rozadura de más de 5 cm en la carcasa de un retrovisor, o que no se vaya puliendo?', hallazgo: 'Arañazo de más de 5 cm en un retrovisor', tambien: [27, 28] },
      { tema: 'llantas', zona: 'llantas', regla: 14, si: 'factura', pregunta: '¿Algún arañazo de más de 10 cm en una llanta o un tapacubos, o alguno deformado?', hallazgo: 'Arañazo de más de 10 cm o llanta deformada', tambien: [15, 16, 17] },
      { tema: 'neumaticos', zona: 'neumaticos', regla: 19, si: 'factura', pregunta: '¿Algún neumático con bultos, grietas, cortes o algo clavado?', hallazgo: 'Neumático dañado', tambien: [18, 20, 21] },
      { tema: 'interior', zona: 'interior', regla: 32, si: 'fuera', pregunta: '¿Alguna mancha en asientos, moqueta o alfombrillas que no salga con una limpieza normal?', hallazgo: 'Manchas que no salen con una limpieza general', tambien: [33, 34, 35, 36, 37] },
      { tema: 'llaves', zona: 'documentacion_y_llaves', regla: 40, si: 'fuera', pregunta: '¿Falta algo de lo que te dieron con el coche: llaves, documentación, rueda de repuesto o kit?', hallazgo: 'Falta algo de lo que se entregó con el coche', tambien: [] },
      { tema: 'limpieza', zona: 'limpieza', regla: 38, si: 'fuera', pregunta: '¿Algún mal olor que necesite una limpieza especial para irse?', hallazgo: 'Mal olor que pide limpieza especializada', tambien: [39] },
    ],
    aparte: [29, 30, 31],
  },
  alphabet: {
    pasos: [
      { tema: 'paragolpes', zona: 'paragolpes', regla: 34, si: 'factura', pregunta: '¿Algún roce en los paragolpes o las molduras que se haya llevado material?', hallazgo: 'Roce con pérdida de material en un plástico', tambien: [] },
      { tema: 'lunas', zona: 'lunas', regla: 15, junto: [16], si: 'factura', pregunta: '¿Alguna marca o grieta en el parabrisas de más de 1 cm, varias que sumen más, o alguna, del tamaño que sea, en la zona de visión del conductor?', hallazgo: 'Marca o grieta en el parabrisas fuera de lo que acepta', tambien: [17, 18] },
      { tema: 'abolladuras', zona: 'carroceria', regla: 32, si: 'factura', pregunta: '¿Alguna abolladura de más de 10 mm, o dos en la misma pieza?', hallazgo: 'Abolladura de más de 10 mm, o dos en una pieza', tambien: [33, 36] },
      { tema: 'aranazos', zona: 'pintura', regla: 27, si: 'factura', nota: 'Varios pequeños en la misma pieza que sumen más de 15 mm, sin pasar de tres, quedan fuera de lo que acepta, pero la guía no los pone entre los facturables.', pregunta: '¿Algún arañazo en la pintura de más de 15 mm, o más de tres pequeños en la misma pieza?', hallazgo: 'Arañazo de más de 15 mm, o más de tres en una pieza', tambien: [28, 30, 31] },
      { tema: 'pintura', zona: 'pintura', regla: 25, si: 'factura', pregunta: '¿Algún impacto de gravilla de más de 5 mm, o alguno con óxido?', hallazgo: 'Impacto de más de 5 mm o con óxido', tambien: [26, 29] },
      { tema: 'retrovisores', zona: 'retrovisores', regla: 35, si: 'factura', pregunta: '¿Algún roce en la carcasa de un retrovisor que se haya llevado material?', hallazgo: 'Roce con pérdida de material en un retrovisor', tambien: [] },
      { tema: 'llantas', zona: 'llantas', regla: 21, si: 'factura', pregunta: '¿Algún arañazo de más de 4 cm en una llanta de aluminio?', hallazgo: 'Arañazo de más de 4 cm en una llanta', tambien: [22, 23, 19, 20, 24] },
      { tema: 'carga', zona: 'zona_de_carga', regla: 9, si: 'factura', pregunta: '¿Algún arañazo en la zona de carga que se haya llevado pintura y mida más de 100 mm?', hallazgo: 'Arañazo de más de 100 mm en la zona de carga', tambien: [10, 6, 7, 8, 11, 12, 13] },
      { tema: 'carga', zona: 'zona_de_carga', regla: 4, si: 'factura', pregunta: '¿Algún roce en el maletero que se haya llevado material, o más de un arañazo en la misma pieza?', hallazgo: 'Roce con pérdida de material en el maletero', tambien: [5] },
      { tema: 'interior', zona: 'interior', regla: 2, si: 'factura', pregunta: '¿Algo roto, rayado, quemado o deformado por dentro que no tuviera al entregártelo?', hallazgo: 'Daño en el interior que no tenía al entregarse', tambien: [0, 1, 3] },
      { tema: 'llaves', zona: 'documentacion_y_llaves', regla: 37, si: 'factura', pregunta: '¿Falta la segunda llave, algún documento o algún accesorio?', hallazgo: 'Falta la segunda llave, un documento o un accesorio', tambien: [] },
      { tema: 'limpieza', zona: 'limpieza', regla: 14, si: 'factura', pregunta: '¿Manchas, olores o pelo de animal que no salgan con una limpieza normal?', hallazgo: 'Suciedad que pide limpieza especializada', tambien: [] },
    ],
    aparte: [38, 39, 40],
  },
  vwfs: {
    pasos: [
      { tema: 'paragolpes', zona: 'paragolpes', regla: 22, si: 'fuera', nota: NOTA_VWFS, pregunta: '¿Algún arañazo en un paragolpes que llegue a la pintura de base, o alguno muy grande?', hallazgo: 'Arañazo en un paragolpes hasta la pintura de base, o muy grande', tambien: [21, 23, 24] },
      { tema: 'lunas', zona: 'lunas', regla: 27, junto: [28], si: 'fuera', pregunta: '¿Algún chinazo sin reparar con brecha o grieta, algún cristal roto, o algún impacto en la zona del conductor?', hallazgo: 'Chinazo con grieta, cristal roto o impacto en la zona del conductor', tambien: [25, 26] },
      { tema: 'abolladuras', zona: 'carroceria', regla: 14, si: 'fuera', nota: NOTA_VWFS, pregunta: '¿Alguna abolladura de 1 cm o más, que necesite pintura, o más de dos en la misma pieza?', hallazgo: 'Abolladura fuera de lo que acepta', tambien: [15, 16, 17, 18, 19, 20] },
      { tema: 'aranazos', zona: 'pintura', regla: 6, si: 'fuera', nota: NOTA_VWFS, pregunta: '¿Algún arañazo en la pintura que llegue a la capa de base o a la imprimación?', hallazgo: 'Arañazo hasta la capa de base', tambien: [7, 8, 9, 10, 11, 12, 13] },
      { tema: 'retrovisores', zona: 'retrovisores', regla: 29, si: 'fuera', sujeto: 'el arañazo', pregunta: '¿Algún arañazo o marca de más de 2 cm en la carcasa de un retrovisor?', hallazgo: 'Arañazo de más de 2 cm en un retrovisor', tambien: [] },
      { tema: 'llantas', zona: 'llantas', regla: 4, si: 'fuera', pregunta: '¿Algún roce de más de 0,5 cm en una llanta o un tapacubos, o más de tres en la misma?', hallazgo: 'Roce de más de 0,5 cm, o más de tres en una llanta', tambien: [5] },
      { tema: 'neumaticos', zona: 'neumaticos', regla: 0, si: 'fuera', pregunta: '¿Algún neumático con menos de 2 mm de dibujo en sus ranuras principales?', hallazgo: 'Neumático con menos de 2 mm de dibujo', tambien: [1, 2, 3] },
      { tema: 'interior', zona: 'interior', regla: 33, si: 'fuera', pregunta: '¿Alguna quemadura en asientos, alfombrillas, moqueta, paneles o techo?', hallazgo: 'Quemadura en el interior', tambien: [30, 34, 35, 36, 37, 38, 39] },
      { tema: 'llaves', zona: 'documentacion_y_llaves', regla: 41, si: 'fuera', pregunta: '¿Falta la llave principal o alguna copia, o alguna está dañada?', hallazgo: 'Falta o está dañada una llave', tambien: [40, 42, 43, 44, 45, 46, 47] },
      { tema: 'limpieza', zona: 'limpieza', regla: 31, si: 'fuera', pregunta: '¿Suciedad que no salga aspirando y necesite una limpieza profesional?', hallazgo: 'Suciedad que no sale aspirando', tambien: [32] },
      { tema: 'mecanica', zona: 'mecanica', regla: 48, si: 'sin_criterio', pregunta: '¿Hay algún testigo de avería encendido en el cuadro?', hallazgo: 'Testigo de avería encendido', tambien: [] },
    ],
    aparte: [49],
  },
  bmw: {
    pasos: [
      { tema: 'paragolpes', zona: 'paragolpes', regla: 7, si: 'fuera', pregunta: '¿Algún roce o arañazo de más de 30 mm en un paragolpes, o más de uno en el mismo?', hallazgo: 'Roce de más de 30 mm, o más de uno, en un paragolpes', tambien: [] },
      { tema: 'lunas', zona: 'lunas', regla: 18, si: 'fuera', pregunta: '¿Algún impacto en el parabrisas de más de 2 mm, más de cinco, o alguno en el campo de visión del conductor?', hallazgo: 'Impacto en el parabrisas fuera de lo que acepta', tambien: [19, 20] },
      { tema: 'abolladuras', zona: 'carroceria', regla: 4, si: 'fuera', sujeto: 'el bollo', nota: 'Su pág. 16 lo resume de otra forma: acepta daños de hasta 2 cm de diámetro en piezas verticales, como máximo 1 por panel (no por lateral).', pregunta: '¿Algún bollo de más de 20 mm, más de uno en el mismo lateral, o alguno en el techo, el capó, el portón o por encima de la línea del pase de rueda?', hallazgo: 'Bollo fuera de lo que acepta', tambien: [5, 21, 22, 23, 24, 25] },
      { tema: 'aranazos', zona: 'pintura', regla: 1, junto: [2], si: 'fuera', nota: 'Su pág. 16 lo resume de otra forma: acepta arañazos de hasta 3 cm de diámetro, como máximo 2 por panel (no por lateral).', pregunta: '¿Algún arañazo de más de 30 mm en los laterales, más de dos en el mismo lateral, o alguno en el techo, el capó, el portón o por encima de la línea del pase de rueda?', hallazgo: 'Arañazo fuera de lo que acepta', tambien: [3, 0, 6, 26] },
      { tema: 'retrovisores', zona: 'retrovisores', regla: 8, si: 'fuera', pregunta: '¿Algún roce de más de 2 mm en la carcasa de un retrovisor, o que haya tocado la pintura?', hallazgo: 'Roce en un retrovisor', tambien: [] },
      { tema: 'llantas', zona: 'llantas', regla: 17, si: 'fuera', pregunta: '¿Roces en el borde de alguna llanta que, sumados, pasen de 40 mm, o alguno que se haya llevado material?', hallazgo: 'Roces de más de 40 mm, o con pérdida de material, en una llanta', tambien: [] },
      { tema: 'neumaticos', zona: 'neumaticos', regla: 16, si: 'fuera', pregunta: '¿Algún neumático con cortes o bultos, pinchado, o distinto del otro del mismo eje?', hallazgo: 'Neumático dañado o distinto en el mismo eje', tambien: [15] },
      { tema: 'interior', zona: 'interior', regla: 9, si: 'fuera', pregunta: '¿Alguna quemadura de más de 4 mm en el tejido de los asientos?', hallazgo: 'Quemadura de más de 4 mm en un asiento', tambien: [10, 11, 12, 13, 14] },
      { tema: 'llaves', zona: 'documentacion_y_llaves', regla: 30, si: 'fuera', pregunta: '¿Falta algún juego de llaves, algún documento o algún accesorio?', hallazgo: 'Falta una llave, un documento o un accesorio', tambien: [29] },
      { tema: 'limpieza', zona: 'limpieza', regla: 27, si: 'fuera', pregunta: '¿Lo vas a entregar sin limpiar, por dentro o por fuera?', hallazgo: 'Sin limpiar', tambien: [28] },
      { tema: 'mecanica', zona: 'mecanica', regla: 31, si: 'factura', nota: 'Su pág. 15 anota, además, cualquier otro aviso del cuadro: de fallo, de avería o de falta de mantenimiento.', pregunta: '¿Hay encendido en el cuadro algún testigo que el manual de usuario del coche dé como avería?', hallazgo: 'Testigo de avería encendido', tambien: [32] },
    ],
    aparte: [33],
  },
  athlon: {
    pasos: [
      { tema: 'exterior', zona: 'carroceria', regla: 1, si: 'sin_criterio', pregunta: '¿Tiene algún daño por fuera, llantas y lunas incluidas?', hallazgo: 'Daño por fuera', nota: 'Lo que se cobra depende de con quién tengas el seguro: con Athlon, por tu cuenta o con franquicia. Tienes las tres reglas en este paso.', tambien: [0, 2, 3, 4, 6] },
      { tema: 'carga', zona: 'zona_de_carga', regla: 5, si: 'sin_criterio', pregunta: '¿Algún golpe por dentro de la zona de carga por llevar la carga suelta?', hallazgo: 'Golpe por dentro por carga mal sujeta', tambien: [7, 8] },
      { tema: 'interior', zona: 'interior', regla: 10, si: 'fuera', pregunta: '¿Alguna mancha, quemadura, corte o grieta en la tapicería?', hallazgo: 'Daño en la tapicería', tambien: [11, 12, 13, 14] },
      { tema: 'llaves', zona: 'documentacion_y_llaves', regla: 17, si: 'fuera', pregunta: '¿Falta algo de lo que te dieron: llaves y sus códigos, documentación, rueda de repuesto o kit, accesorios?', hallazgo: 'Falta algo de lo que se entregó', tambien: [18] },
      { tema: 'limpieza', zona: 'limpieza', regla: 9, si: 'fuera', pregunta: '¿Manchas o suciedad que no salgan con un aspirado o una limpieza normal?', hallazgo: 'Suciedad que no sale con una limpieza estándar', tambien: [] },
      { tema: 'mecanica', zona: 'mecanica', regla: 15, si: 'fuera', pregunta: '¿Algún testigo de avería encendido, o un ruido raro de motor o escape?', hallazgo: 'Testigo encendido o ruido anómalo', tambien: [16] },
    ],
    aparte: [],
  },
  arval: {
    pasos: [
      { tema: 'exterior', zona: 'carroceria', regla: 0, si: 'sin_criterio', pregunta: '¿Tiene algún daño por fuera: carrocería, pintura o paragolpes?', hallazgo: 'Daño por fuera', tambien: [1, 2] },
      { tema: 'interior', zona: 'interior', regla: 3, si: 'factura', pregunta: '¿Algún daño por dentro: techo, asientos, paneles de puerta, moqueta, volante, salpicadero o guantera?', hallazgo: 'Daño en el interior', tambien: [4] },
      { tema: 'llaves', zona: 'documentacion_y_llaves', regla: 5, si: 'factura', pregunta: '¿Te falta la segunda llave?', hallazgo: 'Falta la segunda llave', tambien: [6, 7] },
      { tema: 'accesorios', zona: 'otros', regla: 8, si: 'factura', pregunta: '¿Falta algún accesorio: chaleco, triángulos o baliza, cable de carga, kit de pinchazos o cubierta del maletero?', hallazgo: 'Falta un accesorio', tambien: [] },
      { tema: 'limpieza', zona: 'limpieza', regla: 9, si: 'factura', pregunta: '¿Lo vas a devolver sin limpiar, por dentro o por fuera?', hallazgo: 'Sin limpiar', tambien: [] },
    ],
    aparte: [10, 11],
  },
  hertz: {
    pasos: [
      { tema: 'lunas', zona: 'lunas', regla: 4, si: 'factura', pregunta: '¿Alguna astilla o grieta en las lunas?', hallazgo: 'Astilla o grieta en una luna', tambien: [11] },
      { tema: 'aranazos', zona: 'carroceria', regla: 1, si: 'factura', pregunta: '¿Algún arañazo de más de 10 mm, o alguno que deje ver el metal o el plástico de debajo?', hallazgo: 'Arañazo de más de 10 mm, o hasta el metal', tambien: [2] },
      { tema: 'abolladuras', zona: 'carroceria', regla: 3, si: 'factura', pregunta: '¿Alguna abolladura de más de 10 mm de diámetro?', hallazgo: 'Abolladura de más de 10 mm', tambien: [] },
      { tema: 'retrovisores', zona: 'retrovisores', regla: 8, si: 'factura', pregunta: '¿Alguna grieta en los espejos?', hallazgo: 'Grieta en un espejo', tambien: [] },
      { tema: 'llantas', zona: 'llantas', regla: 9, si: 'factura', pregunta: '¿Algún arañazo de más de 10 mm en una llanta de aleación?', hallazgo: 'Arañazo de más de 10 mm en una llanta', tambien: [10] },
      { tema: 'neumaticos', zona: 'neumaticos', regla: 5, si: 'factura', pregunta: '¿Algún daño en un neumático: en el flanco, un pinchazo, o haber rodado desinflado?', hallazgo: 'Neumático dañado', tambien: [] },
      { tema: 'interior', zona: 'interior', regla: 7, si: 'factura', pregunta: '¿Alguna mancha o quemadura en los asientos o las alfombrillas?', hallazgo: 'Mancha o quemadura en la tapicería', tambien: [6] },
      { tema: 'accesorios', zona: 'otros', regla: 16, si: 'factura', pregunta: '¿Falta alguna pieza o accesorio, o hay alguno dañado?', hallazgo: 'Falta o está dañado un accesorio', tambien: [12, 13, 17, 18, 19] },
      { tema: 'limpieza', zona: 'limpieza', regla: 21, si: 'factura', pregunta: '¿Está excesivamente sucio, huele mal o tiene manchas?', hallazgo: 'Suciedad, mal olor o manchas', tambien: [22] },
      { tema: 'mecanica', zona: 'mecanica', regla: 14, si: 'factura', pregunta: '¿Le has puesto un combustible equivocado?', hallazgo: 'Combustible equivocado', tambien: [20] },
    ],
    aparte: [0, 15],
  },
  europcar: {
    pasos: [
      { tema: 'paragolpes', zona: 'paragolpes', regla: 4, si: 'factura', nota: NOTA_EUROPCAR, pregunta: '¿Algún arañazo de 2 cm o más en un paragolpes?', hallazgo: 'Arañazo en un paragolpes', tambien: [5, 6, 7] },
      { tema: 'lunas', zona: 'lunas', regla: 12, si: 'factura', nota: 'Si el chinazo es de 10 mm o más, su tabla no tiene fila para él: solo pone precio a la luna rota.', pregunta: '¿Algún chinazo de menos de 10 mm en el parabrisas?', hallazgo: 'Chinazo de menos de 10 mm en el parabrisas', tambien: [14] },
      { tema: 'lunas', zona: 'lunas', regla: 13, si: 'factura', pregunta: '¿Alguna luna rota: el parabrisas, la luneta o una ventanilla?', hallazgo: 'Luna rota', tambien: [] },
      { tema: 'aranazos', zona: 'carroceria', regla: 0, si: 'factura', nota: NOTA_EUROPCAR, pregunta: '¿Algún arañazo de 2 cm o más en la chapa?', hallazgo: 'Arañazo en la chapa', tambien: [2, 3] },
      { tema: 'abolladuras', zona: 'carroceria', regla: 1, si: 'factura', nota: NOTA_EUROPCAR, pregunta: '¿Alguna abolladura de 2 cm o más en la chapa?', hallazgo: 'Abolladura en la chapa', tambien: [] },
      { tema: 'retrovisores', zona: 'retrovisores', regla: 15, si: 'factura', pregunta: '¿Algún daño en la carcasa de un retrovisor?', hallazgo: 'Daño en la carcasa de un retrovisor', tambien: [16] },
      { tema: 'llantas', zona: 'llantas', regla: 8, si: 'factura', nota: NOTA_EUROPCAR, pregunta: '¿Algún rallón de 2 cm o más en una llanta?', hallazgo: 'Rallón en una llanta', tambien: [9, 10] },
      { tema: 'neumaticos', zona: 'neumaticos', regla: 11, si: 'factura', pregunta: '¿Algún neumático cortado, roto o pinchado?', hallazgo: 'Neumático cortado, roto o pinchado', tambien: [] },
      { tema: 'carga', zona: 'zona_de_carga', regla: 20, si: 'factura', pregunta: '¿Algún arañazo, abolladura o rallón en el lateral trasero de la furgoneta?', hallazgo: 'Daño en el lateral trasero', tambien: [21] },
      { tema: 'interior', zona: 'interior', regla: 17, si: 'factura', pregunta: '¿Algún asiento cortado, quemado o manchado?', hallazgo: 'Asiento cortado, quemado o manchado', tambien: [18, 19, 22] },
      { tema: 'limpieza', zona: 'limpieza', regla: 24, si: 'factura', pregunta: '¿Está sucio por fuera?', hallazgo: 'Sucio por fuera', tambien: [] },
      { tema: 'accesorios', zona: 'otros', regla: 25, si: 'factura', pregunta: '¿Falta o está roto el gato o la baliza V16?', hallazgo: 'Falta el gato o la baliza V16', tambien: [23, 26] },
    ],
    aparte: [],
  },
}

/* Los temas de «Otra compañía», en el orden de la vuelta al vehículo. */
export const TEMAS = [
  ['paragolpes', 'Paragolpes'], ['lunas', 'Lunas'], ['aranazos', 'Arañazos'], ['rozaduras', 'Rozaduras'], ['abolladuras', 'Abolladuras'],
  ['pintura', 'Pintura'], ['exterior', 'Daños por fuera'], ['retrovisores', 'Retrovisores'], ['llantas', 'Llantas'],
  ['neumaticos', 'Neumáticos'], ['carga', 'Zona de carga'], ['interior', 'Interior'], ['llaves', 'Llaves y papeles'],
  ['accesorios', 'Accesorios'], ['limpieza', 'Limpieza'], ['mecanica', 'Mecánica'],
]

/* ── Las cuentas (sin navegador: las usan también las funciones de Pages y el comprobador) ───────────────────────── */

export const vale = (aplica, vehiculo) => aplica === 'ambos' || aplica === vehiculo

/* Una regla tal como se enseña: la del JSON con sus AJUSTES encima. */
export function regla(docId, i) {
  const r = DOCUMENTOS[docId].reglas[i]
  const a = (AJUSTES[docId] || {})[i] || {}
  return { ...r, ...a, indice: i }
}

export const companiaDe = (slug) => COMPANIAS.find((c) => c.slug === slug) || null
export const companiaDelDocumento = (docId) => companiaDe(DOCUMENTOS[docId]?.compania)

/* Cómo se habla del documento de una compañía (o de la compañía de un documento). */
export function vozDe(x) {
  const c = typeof x === 'string' ? companiaDe(x) || companiaDelDocumento(x) : x
  const v = VOCES[c?.voz] || VOCES.guia
  const n = v.plural ? 'n' : ''
  return {
    ...v,
    voz: c?.voz || 'guia',
    alquiler: c?.tipo === 'alquiler',
    acepta: `${v.Su} acepta${n}`,
    pide: `${v.Su} pide${n}`,
    factura: `${v.Su} dice${n} que se factura`,
    fuera: `${v.Su} no lo acepta${n}`,
    sinCriterio: `${v.Su} no lo dice${n}`,
    soloAcepta: `${v.Su} solo dice${n} lo que acepta${n}.`,
    noAceptaNinguno: `${v.Su} no acepta${n} ninguno`,
    noDice: `${v.Su} no dice${n}`,
    dice: `${v.Su} dice${n}`,
  }
}

/* La etiqueta de cada respuesta «Sí» en el resultado y en la tabla. */
export const ETIQUETA_SI = { factura: (v) => v.factura, fuera: (v) => v.fuera, sin_criterio: (v) => v.sinCriterio }

/* LO QUE ACEPTA, dicho como lo dice el documento. Cuando el dato es «la guía no pone ningún caso aceptable», «la tabla
   no lo dice» o «Nada», se escribe la frase entera sin etiqueta (nunca «Acepta: Nada»); cuando es lo que hay que
   devolver, «Su guía pide». La etiqueta va encima o delante con dos puntos (`enLinea`, que pasa a minúscula). */
export const minuscula = (t) => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t)
export function aceptaDe(r, v) {
  const t = r.no_se_cobra
  let m
  if (/^(La guía|La tabla|La ficha|Sus condiciones|Nada dice|No da ningún caso)/.test(t)) return { etiqueta: null, texto: t }
  if ((m = t.match(/^No lo dice( expresamente)?(.*)$/s))) return { etiqueta: null, texto: `${v.noDice}${m[1] || ''} qué acepta${v.plural ? 'n' : ''}${m[2] || '.'}` }
  if ((m = t.match(/^(?:Nada|Ninguno)(?![ ]+(?:si|dice)\b)(.*)$/s))) return { etiqueta: null, texto: `${v.noAceptaNinguno}${m[1] || '.'}` }
  if (/^(Devolver|Entregar|Haber |Borrar |El vehículo limpio|Vehículo limpio)/.test(t)) return { etiqueta: v.pide, texto: t }
  return { etiqueta: v.acepta, texto: t }
}

/* LO QUE NO ACEPTA (o lo que cobra), con la etiqueta del paso si la hay. Cuando el dato es una frase que dice lo que
   pasa («Si está sucio, la entrega puede cancelarse…», «Con seguro propio…», «Hay que pagar…») va con «Su guía dice»,
   no con «Su guía no acepta» (que pegado a una frase así se contradice); «Si hay más de una rotura…» sí es lo que no
   acepta y se queda con su etiqueta. «No da importe; …» se escribe entero con su sujeto. */
const DICE_LO_QUE_PASA = /^(Si [^;]*?, (la entrega|se podría|el vehículo no se puede|Alphabet factura|pueden dar lugar)|Con |Hay que |El exceso |Los elementos perdidos )/
export function cobraDe(r, v, si = null) {
  const t = r.se_cobra
  let m
  if (t == null) return { etiqueta: null, texto: v.soloAcepta }
  if (/^(La guía|La tabla|La ficha|Sus condiciones|No lo dice|Nada dice)/.test(t)) return { etiqueta: null, texto: t }
  if (si === 'factura') return { etiqueta: v.factura, texto: t }
  if ((m = t.match(/^No da importe(.*)$/s))) return { etiqueta: null, texto: `${v.Su} no da${v.plural ? 'n' : ''} importe${m[1]}` }
  if (DICE_LO_QUE_PASA.test(t)) return { etiqueta: v.dice, texto: t }
  return { etiqueta: v.noAcepta, texto: t }
}

/* La página de lo que no acepta o cobra (a veces no es la de la regla: ver `paginaCobro` en AJUSTES). */
export const paginaCobroDe = (r) => r.paginaCobro ?? r.pagina
/* Las dos, para la columna de las tablas: «19 y 20». */
export const paginasDe = (r) => (r.paginaCobro != null && r.paginaCobro !== r.pagina ? `${r.pagina} y ${r.paginaCobro}` : `${r.pagina}`)

/* Una regla que no da ningún caso aceptable: lo que pide no tiene medida por debajo de la cual valga. */
export const sinTolerancia = (r) => /ningún caso aceptable|no (da|dan|pone) (caso aceptable|tolerancia)|no admiten? ningun|^(Nada|Ninguno)(?![ ]+dice)\b|no aceptan? ninguno/i.test(r.no_se_cobra || '')

/* EN EL RESULTADO, una cosa que su guía no acepta: lo que dice de ella y su página. Si el documento no describe lo que
   no acepta (solo dice lo que acepta, o «no lo dice expresamente»), se enseña lo que SÍ acepta o pide: de eso se ha
   pasado. `sinCobro`: el documento no dice cómo lo cobra (se dice una vez, y no si la propia frase ya habla de precio). */
const HABLA_DE_PRECIO = /precio|importe|cobr|coste|factur|cargo|penaliz|reclam|abon|pagar|€/i
export function noAceptaDe(r, v) {
  const t = r.se_cobra
  if (t == null || /no lo dice|no dice qu[ée] se cobra|solo dice lo que/i.test(t)) {
    return { texto: enLinea(aceptaDe(r, v)), pagina: r.pagina, sinCobro: true }
  }
  const sinImporte = t.match(/^No da importe(.*)$/s)
  return { texto: sinImporte ? `${v.Su} no da${v.plural ? 'n' : ''} importe${sinImporte[1]}` : t, pagina: paginaCobroDe(r), sinCobro: !HABLA_DE_PRECIO.test(t) }
}

/* Una de las dos en una sola línea: «Su guía acepta: hasta 10 cm…», o la frase entera si no lleva etiqueta. */
export const enLinea = ({ etiqueta, texto }) => (etiqueta ? `${etiqueta}: ${minuscula(texto)}` : texto)

/* Los documentos de una compañía, sin repetir (Alphabet es el mismo para los dos vehículos). */
export function documentosDe(c) {
  const vistos = []
  for (const [v, id] of Object.entries(c.documentos)) {
    const ya = vistos.find((x) => x.id === id)
    if (ya) ya.vehiculos.push(v); else vistos.push({ id, vehiculos: [v] })
  }
  return vistos
}

/* El vehículo con el que se abre una compañía: el pedido si lo tiene; si no, la furgoneta; si no, el que tenga. */
export const vehiculoPara = (c, pedido) => (c?.documentos[pedido] ? pedido : c?.documentos.furgoneta ? 'furgoneta' : Object.keys(c?.documentos || {})[0] || 'furgoneta')

/* El titular de la página de cada compañía (la pantalla y la función de Pages dicen lo mismo). */
export const tituloCompania = (c) => (c.tipo === 'alquiler'
  ? `Qué cobra ${c.nombre} por los daños al devolver un vehículo de alquiler`
  : `Qué cobra ${c.nombre} al devolver ${c.objeto || 'un vehículo de renting'}`)

/* La entradilla de la página de cada compañía. */
export function subtituloCompania(c) {
  if (c.voz === 'ficha') return 'Lo que dice su ficha de fin de contrato: qué pide al devolver el vehículo y qué factura, con la página de cada cosa.'
  if (c.voz === 'tabla') return 'Lo que su tabla de daños pone a cada daño al devolver el vehículo: costes medios estimados, por tramos, con la página de cada uno.'
  if (c.voz === 'condiciones') return 'Lo que sus condiciones de alquiler dicen que se cobra al devolver el vehículo, criterio a criterio, con la página de cada uno.'
  return 'Lo que su guía acepta como desgaste normal y lo que no, criterio a criterio, con la página de cada uno.'
}

/* Los pasos de un documento para un vehículo: solo los que valen, con su regla, las que van en la misma pregunta
   (`con`) y su «También mira» (`mas`). */
export function pasosDe(docId, vehiculo) {
  const rec = RECORRIDOS[docId]
  if (!rec) return []
  const de = (lista) => (lista || []).map((i) => regla(docId, i)).filter((x) => vale(x.aplica_a, vehiculo))
  return rec.pasos
    .filter((p) => vale(regla(docId, p.regla).aplica_a, vehiculo))
    .map((p) => ({ ...p, r: regla(docId, p.regla), con: de(p.junto), mas: de(p.tambien) }))
}

export const aparteDe = (docId, vehiculo) => (RECORRIDOS[docId]?.aparte || []).map((i) => regla(docId, i)).filter((x) => vale(x.aplica_a, vehiculo))

/* Todas las reglas de un documento que valen para un vehículo, en el orden del recorrido (para las tablas). */
export function reglasEnOrden(docId, vehiculo) {
  const vistas = []
  for (const p of pasosDe(docId, vehiculo)) vistas.push(p.r, ...p.con, ...p.mas)
  vistas.push(...aparteDe(docId, vehiculo))
  return vistas
}

/* Las frases de un documento que dicen que cobra lo de un tema (COBRO), para enseñarlas junto a lo que se factura.
   Con `vehiculo`, solo las que valen para él (la zona de carga de Alphabet tiene una página por tipo de vehículo). */
export const cobroDe = (docId, tema, vehiculo = null) => (COBRO[docId] || []).filter((b) => b.temas.includes(tema) && (!vehiculo || !b.aplica_a || vale(b.aplica_a, vehiculo)))

/* Una frase de COBRO dicha en llano: «Lo pone bajo «Facturables» (8.3 Pintura), en su pág. 31», «Lo dice en su
   pág. 3: «…»». La de Europcar está en su web, no en la tabla: va con su enlace (lo pinta la pantalla). */
export function baseTexto(b, v, lo = 'Lo') {
  const n = v.plural ? 'n' : ''
  if (b.apartado) return `${lo} pone${n} bajo «${b.cita}» (${b.apartado}), en su pág. ${b.pagina}.`
  return `${lo} dice${n} en su pág. ${b.pagina}: «${b.cita}».`
}

/* El titular del resultado: lo que cuenta la cifra grande, dicho con las palabras que caben. Con 0, según los pasos
   que tiene el documento (nunca «0 cosas que su guía dice que se facturan» en un manual que no dice cobrar nada). */
export function titularDe(pasos, { factura, fuera, cifra }, v) {
  const n = v.plural ? 'n' : ''
  const cosa = (uno, varios) => (cifra === 1 ? uno : varios)
  const hay = cifra ? { f: factura.length > 0, a: fuera.length > 0 } : { f: pasos.some((p) => p.si === 'factura'), a: pasos.some((p) => p.si === 'fuera') }
  if (hay.f && !hay.a) return cosa(`cosa que ${v.su} dice${n} que se factura`, `cosas que ${v.su} dice${n} que se facturan`)
  if (hay.a && !hay.f) return cosa(`cosa que ${v.su} no acepta${n}`, `cosas que ${v.su} no acepta${n}`)
  return cosa(`cosa fuera de lo que ${v.su} da${n} por bueno`, `cosas fuera de lo que ${v.su} da${n} por bueno`)
}

/* EL RESULTADO, sin pantalla (lo usan Resultado.jsx y el comprobador): qué respuesta cae en cada bloque y la cifra
   grande, que cuenta lo que queda fuera de lo que su guía da por bueno (lo que dice que se factura y lo que no
   acepta). «Su guía no lo dice», «No» y «No lo sé» no cuentan. */
export function resumen(pasos, respuestas) {
  const de = (f) => pasos.map((p, i) => ({ p, i })).filter(({ p, i }) => f(p, respuestas[i]))
  const factura = de((p, r) => r === 'si' && p.si === 'factura')
  const fuera = de((p, r) => r === 'si' && p.si === 'fuera')
  const sinCriterio = de((p, r) => r === 'si' && p.si === 'sin_criterio')
  const no = de((_, r) => r === 'no')
  const noSe = de((_, r) => r === 'nose')
  return { factura, fuera, sinCriterio, no, noSe, cifra: factura.length + fuera.length }
}

/* Una huella corta del recorrido (FNV-1a): va en el enlace compartido y dice si el resultado se hizo con estos datos. */
export function huellaRecorrido(docId, vehiculo) {
  const s = JSON.stringify(pasosDe(docId, vehiculo).map((p) => [p.regla, p.junto || [], p.si, p.pregunta, p.r.no_se_cobra, p.r.se_cobra, p.r.pagina]))
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36).slice(0, 6)
}

/* Las medidas como en la guía: «2 cm», «0,5 cm», «1,6 mm», «25 %». */
export function medidaTexto(m) {
  if (!m) return ''
  const n = String(m.limite).replace('.', ',')
  const u = { cm: 'cm', mm: 'mm', por_ciento: '%', cm2: 'cm²', unidades: '' }[m.unidad] ?? m.unidad
  return u ? `${n} ${u}` : n
}

/* LA AYUDA PARA MEDIR SIN REGLA: solo si la regla da un tope («hasta») en cm o mm y una medida real queda a menos de un
   10 % de él. Medidas reales: moneda de 10 céntimos 19,75 mm; de 1 € 23,25 mm; de 2 € 25,75 mm; tarjeta bancaria
   85,6 × 54 mm; folio A4 210 × 297 mm. Siempre «casi» o «algo más de», y siempre dice hacia qué lado se equivoca quien
   se fíe del objeto: lo que queda cerca del tope se mide con una regla. (Dos reglas guardan el sentido al revés, «menos
   de» lo que SÍ se cobra: Ayvens furgonetas 12 y Europcar 12. Por eso aquí y en «Otra compañía» solo vale «hasta».) */
export const OBJETOS = [
  { id: 'moneda10', mm: 19.75, nombre: 'Una moneda de 10 céntimos', corto: 'la moneda', dibujo: 'moneda', rotulo: '10 c' },
  { id: 'moneda1', mm: 23.25, nombre: 'Una moneda de 1 euro', corto: 'la moneda', dibujo: 'moneda', rotulo: '1 €' },
  { id: 'moneda2', mm: 25.75, nombre: 'Una moneda de 2 euros', corto: 'la moneda', dibujo: 'moneda', rotulo: '2 €' },
  { id: 'tarjeta-corto', mm: 54, nombre: 'El lado corto de una tarjeta bancaria', corto: 'ese lado', dibujo: 'tarjeta' },
  { id: 'tarjeta-largo', mm: 85.6, nombre: 'El lado largo de una tarjeta bancaria', corto: 'ese lado', dibujo: 'tarjeta' },
  { id: 'folio-corto', mm: 210, nombre: 'El lado corto de un folio A4', corto: 'ese lado', dibujo: 'folio' },
  { id: 'folio-largo', mm: 297, nombre: 'El lado largo de un folio A4', corto: 'ese lado', dibujo: 'folio' },
]
export const MARGEN_AYUDA = 0.1

export function ayudaParaMedir(paso) {
  const m = paso?.r?.medida
  if (!m || m.sentido !== 'hasta' || !['cm', 'mm'].includes(m.unidad) || !paso.sujeto) return null
  const limiteMm = m.unidad === 'cm' ? m.limite * 10 : m.limite
  let mejor = null
  for (const o of OBJETOS) {
    const d = Math.abs(o.mm - limiteMm) / limiteMm
    if (d <= MARGEN_AYUDA && (!mejor || d < mejor.d)) mejor = { ...o, d }
  }
  if (!mejor) return null
  const limite = medidaTexto(m)
  const real = `${String(mejor.mm).replace('.', ',')} mm`
  return {
    objeto: mejor,
    texto: mejor.mm < limiteMm
      ? `${mejor.nombre} mide ${real}: casi ${limite}. Si ${paso.sujeto} es claramente más grande que ${mejor.corto}, pasa de ${limite}; si es casi igual, mídelo con una regla.`
      : `${mejor.nombre} mide ${real}: algo más de ${limite}. Si ${paso.sujeto} llega a ${mejor.corto}, pasa de ${limite}; si se queda un poco corto, también puede pasar: mídelo con una regla.`,
  }
}

/* Cómo se nombra una página: «pág. 7». */
export const pag = (n) => `pág. ${n}`

/* «OTRA COMPAÑÍA»: lo que piden las compañías de renting que publican su guía, tema a tema, cada una con su nombre, su
   medida y su página. Sin rango «de X a Y»: dentro de un mismo tema las guías miden cosas distintas (un arañazo, roces
   sumados, el diámetro de un impacto, el largo con sus ramas), y juntarlas en un rango diría lo que ninguna dice. */
export function filasOtra(vehiculo) {
  const renting = COMPANIAS.filter((c) => c.tipo === 'renting' && c.enOtra !== false && c.documentos[vehiculo])
  return TEMAS.map(([tema, nombre]) => {
    const filas = []
    for (const c of renting) {
      const doc = c.documentos[vehiculo]
      for (const p of pasosDe(doc, vehiculo).filter((x) => x.tema === tema)) filas.push({ c, doc, p })
    }
    return { tema, nombre, zona: filas[0]?.p.zona, filas }
  }).filter((t) => t.filas.length)
}
