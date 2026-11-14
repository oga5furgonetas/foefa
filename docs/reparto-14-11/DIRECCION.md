# La app de reparto: por qué no arranca y qué se hace — dirección (14-11-2026)

Este documento manda sobre los encargos de construcción. Lo escribe la sesión principal (la que dirige) después de leer
los trece informes del diagnóstico (`diag/*/INFORME.md`, en esta misma carpeta) y los datos de producción (panel de
Negocio y Play Console, leídos con la sesión de Dani). Quien construye o diseña: léelo entero antes de empezar.

## 1. El porqué, con sus pruebas

Los números (30 días, producción, leídos el 14-11): **98 altas reales → 33 abren otro día → 22 meten una parada →
19 navegan → 12 entregan → 1 hace un día real.** Por semana de alta: 49 (19-10), 23 (26-10), 19 (02-11), 7 (09-11).
Play (28 días): 1.320 impresiones, 51 instalaciones (24 por exploración, 22 directas o de pago), casi todas del 29-10 al
3-11; después, nada. 0 valoraciones. De 121 correos «¿qué te frenó?» contestaron 3: «todavía no he tenido reparto» (2)
y «no supe cómo meter los paquetes» (1).

Las causas, de más a menos grave (cada una está probada en el informe que se cita):

1. **La app de Android echa a quien se crea la cuenta dentro de ella** (`diag/android`, hallazgo 1). El alta del
   servidor no devolvía `app_destino` y la app borra, al releerla, la sesión de un admin sin destino «reparto». Vuelve
   al formulario y, al repetir, «Ese usuario ya existe». Desde el 28-10, en todas las versiones de Play.
   → ARREGLADO en el servidor (rama `reparto/arranque`, b2c106d), pendiente de publicar. Falta blindarlo en la app.
2. **Nadie la encuentra y la ficha de Play es de otra app** (`diag/captacion` 1-2, `diag/competencia` 1-2). En seis
   búsquedas de Play España FDS no sale nunca; la ficha viva es el texto del 04-10 («Probar sin cuenta», «7 días
   gratis», «eparto y rutas…» sin la R), con capturas viejas y del panel de oficina con la marca «Flota».
3. **Las altas fueron compradas a quien no reparte** (`diag/captacion` 3 y 9): Meta optimizando por «registro»
   (69 a 1,34 €), un correo a 270 candidatos de EMPLEO, la página de gracias de cada candidatura. Al pararse los
   anuncios (cuenta de Meta restringida el ~30-10) se pararon las altas. Nadie llegó solo.
4. **Quien sí reparte y pega su lista se queda con todo «sin situar»** (`diag/web-lista`, `diag/android` 3): una
   cuenta nueva no tiene zona y el servidor busca cada dirección sin saber la ciudad
   (`_rep_ubicar_pendientes` solo pasa `base`; `/reparto/pegar` no manda dónde está el móvil). 27 de 30 «sin
   situar»; con la misma lista, 8 de 30 situadas sin zona y 25 de 30 con la zona puesta. Y «Ordenar ruta» dice
   «30 paradas, acabas ≈ 16:23» cuando ha ordenado 6.
   Lo compartido entra con cabeceras y numeración como si fueran paradas.
5. **El escáner no aguanta una mañana de 100 bultos de las agencias de aquí** (`diag/web-etiquetas`): las etiquetas
   de solo código de barras (MRW, Correos Express, CTT, Correos, DHL, Nacex, UPS: la mayoría) nunca entran solas
   (hoja de revisión, 3 toques y 6 s cada una: ~35 min y ~300 toques por 100 bultos; Circuit, ~5 min); con el
   remitente arriba **se queda con la dirección del remitente y la da por buena** (una parada en Madrid, ruta de
   699 km); el piso («2º» leído «29») rompe la búsqueda; el escáner continuo está escondido; el botón de foto guarda
   un código que no es el del paquete.
6. **La app de Play no tiene las formas de meter muchas paradas que sí tiene la web** (`diag/android` 2 y e): ni
   pegar lista, ni foto de la hoja, ni ejemplo, ni la pregunta «¿cómo te llegan las paradas?».
7. **Instalar desde Play rompe la sesión** (`diag/web-noche` 4, `diag/captacion` 4): la web dice «Último paso:
   instala la app», Play no lleva la sesión y la app pide otra vez correo y contraseña. Los correos abren el
   navegador, no la app.
8. **Los motivos para volver se caen** (`diag/web-noche` 1-3): el aviso de la mañana se ofrece una sola vez y luego
   lo tapa «Instala la app»; quien se da de alta el sábado no recibe nada el lunes; la app nativa avisa cada 15
   minutos si Android la deja (sin FCM).
9. **Cosas que huelen a trampa** (`diag/limites` B-D, `diag/web-noche` 5-6): «25 € por tu primera ruta» que no se
   puede cobrar solo (retirada desde 60 €, escondida), «10 € por cada compañero que se registre» cuando exige 20
   entregas en 2 días, dos fechas distintas para el bono, y el 01-01-2027 un tope de 15 paradas al día sin forma de
   pagar en Android ni en iPhone.
10. **No se sabía nada de quién se cae** (`diag/medicion`): la cuenta no guardaba plataforma ni origen, la nativa
    no manda acciones ni errores, el embudo no es una escalera. → la plataforma y el origen ya se guardan (b2c106d).

Lo que NO es la causa (probado): no hay ningún muro de pago ni tope hoy (`diag/limites`); el alta es rápida (10 s,
7 toques); «un día real» es una vara baja; la app no parece una plantilla (`diag/android` f).

Y lo que se investigó y se TUMBÓ (no construir): la «foto sellada como justificante» y el «cuadre con la liquidación»
(`diag/camaras-sello`, `diag/dolor-dinero`, `diag/liquidacion`): cuatro apps ya lo intentan sin tracción, el ausente
no se cobra haya foto o no, y nadie pide el cuadre.

## 2. Lo que se decide

**A la app no le faltan funciones. Le sobran promesas y le falla lo primero que hace un repartidor: cargar.** Entre
el 25-10 y el 01-11 se escribieron seis estudios y se construyó casi todo lo que proponían. No se repite: nada de
funciones nuevas «para enganchar» hasta que lo de abajo esté hecho y medido.

**La promesa, una sola, y que se pueda enseñar en 10 segundos en la nave:**
> **Apunta, pita, siguiente.** 100 paquetes cargados y la ruta ordenada en 5 minutos, sin escribir.
> Y la segunda vez que vas a una puerta, la app ya se la sabe.

Tres verbos ordenan la app y todo lo que se diga de ella: **Cargar · Repartir · Recordar.**

- **Cargar** (lo que hay que ganar): el escáner que no pregunta, la lista que se sitúa sola, el hueco de la furgoneta.
- **Repartir**: la siguiente parada, la puerta buena, entregado de un toque. Ya funciona; no se toca salvo fallos.
- **Recordar**: la memoria de la puerta (portal, código, dónde dejarlo). Es lo que los repartidores piden con sus
  palabras en las reseñas de Spoke/Circuit y nadie da (`diag/competencia` 5-6). Ya existe; hay que ponerla delante.

**Dónde se gana:** en la hora de carga, en la nave, que es el único momento en que los repartidores están juntos y
se miran el móvil. Circuit creció así: del veterano al nuevo. La app tiene que verse más rápida que la del de al lado.

## 3. Reglas de diseño del producto (valen para todo)

- **Nunca una parada mal situada con un ✓ verde.** Una dirección que cae lejos de la zona del repartidor es una duda,
  no un acierto. Mejor «no lo sé» que Madrid.
- **La zona.** La app sabe dónde reparte cada persona (dónde está el móvil, dónde caen sus paradas, lo que dijo una
  vez) y lo usa para todo: situar direcciones sin ciudad, elegir entre remitente y destinatario, avisar de lo raro.
- **Lo claro entra solo; lo dudoso se junta al final.** Ni una hoja de revisión por paquete. Lo dudoso no se pierde
  si se cierra la app.
- **Una pantalla, una acción principal.** El botón grande hace lo que hace el 90 % (escanear seguidos).
- **La verdad en cada frase.** Nada de «gratis» con letra pequeña que se descubre al cobrar. Nada que no exista
  («Probar sin cuenta»). Los textos de dinero no van en la primera pantalla.
- **La IA no se promete** (regla del 14-11): se dice lo que hace la app («lee la etiqueta»), no «con IA».
- **Coste cero al mes.** Nada que necesite un servicio de pago ni cuentas nuevas (Firebase incluido). El OCR y los
  códigos se leen en el móvil. Los buscadores de direcciones son los que hay (CartoCiudad, Photon, Nominatim), con
  su ritmo: caché, contexto de zona y menos llamadas, no más.
- **Igual en la web y en la nativa.** Las reglas de lectura de etiquetas y de listas son las mismas en JavaScript y
  en Kotlin, con los MISMOS casos de prueba (un fichero de casos compartido).
- **Las empresas no notan nada.** El módulo de reparto también lo usan empresas con repartidores (panel →
  Reparto: pegar lista, zonas, conductores). Lo que se cambie en `reparto.py`, en el buscador de direcciones o en
  el escaneo no puede cambiarles el resultado sin querer: cada regla nueva dice a quién aplica y lleva su prueba
  de «la empresa sigue igual».
- Las reglas del repo siguen: piezas y tokens del diseño compacto (`check-tokens-ruta`, `check-tokens-nativa`),
  textos por `tx()` con sus 5 idiomas (`textosRutaA.js`, `traducciones-nativa.json`; `Traducciones.kt` se genera),
  la app de iPhone no enseña nada de pagos (`sinPagos()`), los textos legales no se tocan, los datos de los ejemplos
  son inventados, y `backend/server.py` va en UTF-8 con BOM y CRLF.

## 4. El orden

- **Tanda 0 (hecha, por publicar):** el alta de la app no expulsa; la cuenta guarda plataforma y origen; los
  enlaces de invitar enseñan la app de ruta.
- **Tanda 1, «Cargar» (servidor y web; no necesita subir app):** la zona; la lista pegada o compartida que se sitúa
  sola y entra limpia; las reglas nuevas de lectura de etiquetas (destinatario, piso, zona, lo claro entra solo) en
  la web y preparadas para la nativa; el escáner continuo como botón principal; lo dudoso guardado.
- **Tanda 2, «Medir y decir la verdad» (servidor, web, panel):** el origen desde la web; la autopsia de altas en el
  panel; el embudo en escalera; no mandar candidatos de empleo a crearse cuenta de repartidor; los textos del bono
  y de los invitados; el aviso de la mañana a la vista; el correo del lunes.
- **Tanda 3, la ficha de Play:** título, descripciones en los 6 idiomas y capturas nuevas con frase. (Cambiar la
  ficha es contenido público: lo decide Dani con un sí.)
- **Tanda 4, la app nativa 2.5.0 (una sola subida, probada a fondo):** el alta blindada; «¿cómo te llegan las
  paradas?» con pegar lista y foto de la hoja; el ejemplo; las reglas de lectura nuevas y el escáner continuo; la
  sesión que viaja de la web a la app (referrer de Play y enlace /pase); el aviso de la mañana puesto en el propio
  móvil (alarma local, sin Firebase); las acciones y los errores a la medición; pedir la valoración tras un día real.
- **Tanda 5, el aspecto:** la identidad nueva (tinta sobre papel, un cian, Archivo + IBM Plex Mono) en la app de
  reparto y en su portada. Antes de construir, un boceto que ve Dani.
- **Lo que queda para Dani** (no se toca sin él): el precio y el tope del 01-01-2027, el mínimo de 60 € para cobrar
  el bono, encender FCM, y cualquier publicación en sus redes.

## 5. Lo que no se hace

Funciones nuevas para enganchar; foto sellada; cuadre de liquidación; chat con IA; medallas; anuncios de pago; más
idiomas o países; rediseñar «Repartir» (funciona); tocar la parte de empresas («Antes del perito» está publicada y
en espera).
