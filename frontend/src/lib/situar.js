/* SITUAR UNA PARADA (02-11-2026). Dani, probando la app con una cuenta nueva: «el primer paquete que escaneo no
   encuentra la dirección y tiene que ir por Maps; eso es un pedazo de mierda, hazlo bien». Una parada sin punto ya no
   se manda a Google Maps: la ficha dice si la dirección está en el mapa (POST /reparto/ubicar) y la persona elige una
   sugerencia o la pone en NUESTRO mapa (pages/driver/SituarParada.jsx). Aquí va lo que se decide sin pantalla y sin
   Leaflet (MiRuta lo importa sin cargar el mapa): qué dijo el servidor, si una sugerencia es de la calle escrita, el
   orden de las sugerencias, dónde empieza el mapa y el piso que no hay que perder. Lo mismo que hace la app nativa en
   ui/hoy/Situar.kt.
   UNA SOLA REGLA AL ELEGIR (03-11-2026, igual en la app nativa): lo que queda al elegir una sugerencia lo decide
   alElegir, con la dirección de la PARADA y nunca con el texto del buscador de «Situar», en la lista de la ficha, en
   «Situar la parada» desde la ficha y desde la ruta («Es aquí»: cambioEsAqui); las que no tocan se quitan con lo
   buscado (noToca) y la marca «Otra calle» se pone con la dirección de la parada (juntarSugerencias).
   LA MISMA CALLE EN EL MISMO SITIO Y EL PORTAL ENTERO (03-11-2026 de madrugada, la revisión; igual en la app nativa):
   el revisor encontró más caminos que guardaban la dirección escrita con el punto de OTRA calle, a 8 km. «Calle 2 de
   Mayo 14» daba el portal 2 (se tomaba el primer número suelto; ahora, el primero que vale: leer); «Rúa Brétema 23,
   15011 A Coruña» y «Rúa Brétema, 15179 Oleiros» pasaban por la misma calle (ahora hace falta también el mismo sitio,
   por el CP o el pueblo: mismoSitio); «Calle Real 5B» tomaba el punto de «Calle Real 5» como su portal (portalDe); y
   al juntar el mismo portal de varias fuentes, el CP y el pueblo van por orden: servidor (con las suyas), móvil,
   Photon (ORDEN_FUENTE).
   LOS ÚLTIMOS DETALLES DE LA LECTURA (K, 03-11-2026; igual en la app nativa): el piso con todas las letras detrás de
   «º» («3ºDerecha») y «OG» (PISO); los espacios raros, como uno normal (espacios); la marca del número detrás de la
   primera coma («, n.º4»: leer); el número que solo lleva delante el tipo de vía no es el portal de un piso («Calle 2
   3 B» es el 3B: sinPiso); y el piso que ya va en la elegida se mira por palabras enteras (conPiso).
   LA QUINTA TANDA (03-11-2026 a media mañana, el revisor y el emulador; igual en la app nativa): el nombre de la capital
   con el CP de otro municipio es la provincia («15179 A Coruña» es Oleiros) y «España» o «Galicia» nunca son un pueblo
   (cuentaComoPueblo); el número del nombre seguido de una palabra no es el portal («Calle de las 3 Cruces 12» es el 12:
   portalEn); la letra suelta del portal no es el piso (conPiso); el U+FEFF y el U+000B, como un espacio (espacios); y a
   Photon va lo buscado sin el piso (lib/direcciones.js).
   LA SEXTA TANDA (03-11-2026 a mediodía, el revisor y el verificador; igual en la app nativa): el número del nombre,
   solo detrás de un artículo («Calle Mayor 5 Escala 2» vuelve a ser el 5: portalEn); un sitio escrito que no es un
   pueblo («Asturias», «Galicia», «España») ya no es no decir nada (mismoSitio, sitioEscrito); y todas las provincias,
   también las de varias palabras (PROVINCIAS, NO_SON_PUEBLO, esProvincia).
   LA SÉPTIMA TANDA (03-11-2026 por la tarde, el revisor y el verificador; igual en la app nativa): la provincia detrás
   de «de» es del nombre del pueblo («Alhama de Murcia» no es «Alhama de Granada»: provinciaDetras); «No.» y las letras
   sueltas no son artículos («Calle Hidalgo No. 25 Col. Centro» es el 25: trasArticulo); y U+001C-U+001F y U+0085, como
   un espacio (espacios). */

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const claveTexto = (s) => sinTildes(s).replace(/[^a-z0-9]+/g, ' ').trim()
/* LOS ESPACIOS RAROS (K2, 03-11-2026; igual en la app nativa): el duro (U+00A0), el de las cifras (U+2007), el fino
   (U+202F), los demás separadores (\p{Z}) y el tabulador pasan a un espacio normal al empezar a leer una dirección:
   \s no es lo mismo en Android, en el JDK y en el navegador. «Calle Mayor 5\u00a02 B» es «Calle Mayor 5 2 B». H2
   (03-11-2026, igual en la app nativa): también el U+FEFF y el U+000B, que en el navegador son \s y en Android no. C
   (03-11-2026, la séptima tanda): y los de control U+001C-U+001F y U+0085, que Kotlin recorta (isWhitespace) y Java
   toma por un fin de línea («$», «.»), y el navegador no. */
// eslint-disable-next-line no-control-regex -- el U+000B y U+001C-U+001F van a propósito (H2, C), escritos como en Situar.kt
const ESPACIOS_RAROS = /[\p{Z}\t\u000B\u001C-\u001F\u0085\uFEFF]/gu
const espacios = (s) => String(s || '').replace(ESPACIOS_RAROS, ' ')

/** [lat, lng] si es un punto de verdad (el 0,0 de un «callejero» sin coordenadas no lo es); si no, null. */
export function punto(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return null
  const a = Number(lat)
  const b = Number(lng)
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && (a !== 0 || b !== 0) ? [a, b] : null
}

export function metros(a, b) {
  const r = Math.PI / 180
  const x = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2
  return 12742000 * Math.asin(Math.sqrt(x))
}

/* El piso, la puerta, la escalera… (como reparto._PISO_RE del servidor y Situar.kt), para no perderlos al elegir una
   sugerencia: los buscadores nunca los traen. Más prudente que aquellos con tres palabras que también son de calle:
   «der» («An der Alster»), «of» («Avenue of the Americas») e «int» solo cuentan con su punto («der.», «of.», «int.»).
   El ordinal admite la letra pegada (02-11-2026, revisión de la app): «1ºB», «3ºA» o «2ºIzq» es como lo traen casi
   todas las etiquetas, y con la letra detrás no contaba como piso (se buscaba con él y se perdía al elegir una
   sugerencia). Con la «g»: sinPiso mira cada palabra de piso, no solo la primera. Sin \b detrás de «1er», «2nd»… (J,
   03-11-2026): para \b, una letra que no es ASCII es letra en Android y no en el navegador. Como en la app nativa (K1,
   03-11-2026): detrás de «º», todas las letras («3ºDerecha», que se leía como un pueblo), y «OG» suelto. */
const PISO = /(?:^|[\s,])(?:\d{1,3}\s*[ºª°]\p{L}*|\d+(?:er|e|ème|st|nd|rd|th)(?![A-Za-z0-9_])|\d+\.\s*(?:og|stock|etage)|piso|planta|pta\.?|puerta|esc\.?|escalera|bajo|bj\.?|entlo\.?|entresuelo|[áa]tico|s[óo]tano|izq\.?|izda\.?|dcha\.?|der\.|dcho\.?|ctro\.?|apto\.?|apt\.?|apartamento|apartment|appt\.?|depto\.?|dpto\.?|departamento|int\.|interior|bloque|blq\.?|torre|unit|suite|ste\.?|floor|fl\.?|flat|local|oficina|of\.|room|rm\.?|[ée]tage|[ée]tg\.?|b[âa]t\.?|b[âa]timent|stock|og|wohnung|whg\.?|andar|sala|edif\.?|edificio|portal)(?=[\s,.:]|$)/giu
// Los trozos de una dirección: por comas, puntos y comas o « - ».
const TROZOS = /\s*[,;]\s*|\s+-\s+/
const recorta = (s) => s.replace(/^[\s,.-]+|[\s,.-]+$/g, '')
const CP_EN_TROZO = /\d{4,5}/

/** Un trozo de la dirección sin el piso: «Calle Mayor 5 2 B» → «Calle Mayor 5»; «2º B» → «».
 *  LA REGLA DE LA APP NATIVA (02-11-2026, revisión de la app: Situar.kt, sinPiso(trozo, primero)). En el primer trozo
 *  (la calle) una palabra de piso solo cuenta si lo que va delante tiene una cifra, es decir, detrás del número:
 *  «Calle de la Torre 5», «Puerta del Sol 1» o «Portal de Belén 3» son calles, y «Calle Real 1 bajo» lleva el piso.
 *  Antes valía la primera que hubiera, y al elegir una sugerencia se guardaba «…, 28001 Madrid, Torre 5 bajo». En los
 *  demás trozos el piso va solo («2º B», «Portal 2»), pero no detrás de un CP («29740 Torre del Mar» es un pueblo). */
function sinPiso(trozo, primero = false, conLetra = false) {
  let s = String(trozo || '').trim()
  for (const m of s.matchAll(PISO)) {
    const antes = s.slice(0, m.index)
    if (primero ? /\d/.test(antes) : !CP_EN_TROZO.test(antes)) { s = recorta(antes); break }
  }
  // F (03-11-2026): en la calle, lo de detrás del portal, si es todo piso, también es el piso («Calle Mayor 15 2 dcha»).
  if (primero) {
    const p = portalEn(s)
    if (p && esPisoCola(s.slice(p.fin))) return s.slice(0, p.fin).trim()
  }
  // Sin \b delante del número (J, 03-11-2026): para \b, «º» es letra en Android y no en el navegador, y «n.º4 2 B»
  // quedaba distinto. Delante, el principio o lo que no sea letra ni cifra; «º» y «ª» no cuentan (como en numeroEn).
  // K4 (03-11-2026): en la calle, el que solo lleva delante el tipo de vía es del nombre: «Calle 2 3 B» es el 3B.
  const np = NUMERO_Y_PISO.exec(s)
  s = (np && !(primero && soloTipo(s.slice(0, np.index + np[1].length))) ? s.slice(0, np.index) + np[1] + np[2] : s).trim()
  // `conLetra` (03-11-2026): la letra suelta detrás del número se queda, que puede ser la del portal («5 B»: portalDe).
  return conLetra ? s : s.replace(/(^|[^\p{L}\p{N}]|[ºª])(\d{1,4})\s+[A-Ha-h]$/u, '$1$2').trim()
}
const NUMERO_Y_PISO = /(^|[^\p{L}\p{N}]|[ºª])(\d{1,4})\s+\d{1,2}\s*[A-Ha-h]$/u     // «5 2 B» → «5»

/** Los trozos de una dirección sin el piso; el primero que no está vacío es la calle (sinPiso). */
function trozosSinPiso(direccion, conLetra = false) {
  let primero = true
  return espacios(direccion).split(TROZOS).map((t) => t.trim()).filter(Boolean).map((t) => {
    const s = sinPiso(t, primero, conLetra)
    primero = false
    return s
  })
}

/** La dirección sin el piso, como la buscan los buscadores: «Rúa Real 2, 1º B» → «Rúa Real 2». */
export const paraBuscar = (direccion, conLetra = false) => trozosSinPiso(direccion, conLetra).filter(Boolean).join(', ')

/* LA CALLE Y SU NÚMERO, COMO EN LA APP NATIVA (03-11-2026: Situar.kt). El número va detrás de la calle, suelto o
   pegado a «nº» («nº4», «no109»); una cifra mal leída dentro de una palabra no es el portal («R/ Desiderio Vare1a 1»
   → 1; «Lugar O Barreir0 6» → 6, no 0), ni uno de cinco cifras (un CP). Se mira a mano lo que va delante de cada
   número porque la expresión de la app lo hace con «lookbehind», que Safari no entiende hasta la 16.4 (y una expresión
   que no entiende tira la página entera).
   EL ÚLTIMO NÚMERO QUE VALE (03-11-2026 de madrugada, la revisión; igual en la app nativa: Situar.kt numeroDe, calleDe
   y portalDe). Se tomaba el PRIMER número suelto: «Calle 2 de Mayo 14» daba el portal 2 y la calle «Calle», y
   «Estrada AC-173 12», el 173 (la marca «Otra calle» y lo que queda al elegir salían de ahí). Se pasó al ÚLTIMO número
   que vale del primer trozo (antes de la primera coma), con la calle todo lo de delante. No vale el seguido de
   « de <palabra>» («2 de Mayo», «18 de Julio»), el de un código de carretera («AC-173», «N-550», «A-6») ni un piso
   («2º», «3ª»). Sin ninguno, el que va justo después de la primera coma («Calle Real, 5, 2º»); el único y delante, el
   formato de fuera («12 rue de Rivoli»). El portal lleva su letra («5B», «5 B», «5-B»), «bis» o su rango («12-14»):
   portalDe lo da entero y numeroDe, solo las cifras.
   EL PRIMERO QUE VALE, OTRA VEZ (03-11-2026 por la mañana, la revisión; igual en la app nativa). Con el último, el piso
   escrito sin «º» pasaba a ser el portal: «Calle Mayor 15 2 dcha» daba el 2, y «Carrer de Sants 5 2n 1a», el 1A.
   Ahora, como el servidor (geocodificador.leer_etiqueta), el PRIMERO que vale, saltando el que solo lleva delante el
   tipo de vía («Calle 2 3» → 3) y el del principio; lo de detrás, si es todo piso, es el piso (sinPiso). */
const LETRA = /\p{L}/u
const CIFRA = /[0-9]/
const NUM_DE_PALABRA = /^\s+[dD][eE]\s+\p{L}/u       // «2 de Mayo», «18 de Julio»: es el nombre
const PISO_DETRAS = /^\s*[ºª°]/                       // «2º», «3ª»: el piso
const RANGO = /^-(\d{1,4})(?![\dºª°])/                // «12-14»
const BIS = /^[\s-]?bis(?!\p{L})/iu                   // «5 bis», «5bis», «5-bis»
const LETRA_PEGADA = /^-?(\p{L})(?!\p{L})/u           // «5B», «5-B»
const LETRA_SUELTA = /^\s+(\p{L})\s*$/u               // «5 B», al final del trozo

/** El portal que empieza en `i` (una cifra que no va detrás de otra) del trozo `t`, si vale: {inicio, fin, cifras,
 *  entero}, con `fin` dónde acaba con su sufijo; si no, null (Situar.kt numeroEn). */
function numeroEn(t, i) {
  let j = i
  while (j < t.length && CIFRA.test(t[j])) j++
  if (j - i < 1 || j - i > 4) return null                                   // un CP (5 cifras) no es un portal
  if (i > 0) {
    const c = t[i - 1]
    // Pegado por delante a una letra no («Vare1a 1»), salvo a «nº» o «n.º» (la «º» y la «ª» no cuentan) y a «no»
    // («no109», «No109», con la «n» al principio de una palabra).
    const trasNo = (c === 'o' || c === 'O') && i >= 2 && (t[i - 2] === 'n' || t[i - 2] === 'N') && (i < 3 || !/[\p{L}\p{Nd}]/u.test(t[i - 3]))
    if (CIFRA.test(c) || (LETRA.test(c) && c !== 'º' && c !== 'ª' && !trasNo)) return null
    if (c === '-' && i >= 2 && LETRA.test(t[i - 2])) return null           // una carretera: «AC-173», «N-550», «A-6»
  }
  const resto = t.slice(j)
  if (PISO_DETRAS.test(resto) || NUM_DE_PALABRA.test(resto)) return null
  const cifras = t.slice(i, j)
  const rango = RANGO.exec(resto)
  if (rango) return { inicio: i, fin: j + rango[0].length, cifras, entero: `${cifras}-${rango[1]}` }
  const bis = BIS.exec(resto)
  if (bis) return { inicio: i, fin: j + bis[0].length, cifras, entero: `${cifras}BIS` }
  const letra = LETRA_PEGADA.exec(resto) || LETRA_SUELTA.exec(resto)
  if (letra) return { inicio: i, fin: j + letra[0].length, cifras, entero: cifras + letra[1].toUpperCase() }
  if (LETRA.test(resto[0] || '')) return null                              // «21st», «1er», «5Bajo»: no es un portal
  return { inicio: i, fin: j, cifras, entero: cifras }
}

/** Los portales que valen de un trozo, en orden (Situar.kt numerosEn). */
function numerosEn(t) {
  const out = []
  let i = 0
  while (i < t.length) {
    if (!CIFRA.test(t[i])) { i++; continue }
    const n = numeroEn(t, i)
    if (n) { out.push(n); i = n.fin } else while (i < t.length && CIFRA.test(t[i])) i++
  }
  return out
}

/** La calle sin «Nº», «s/n» ni la coma, el punto o el guion del final. */
const limpia = (calle) => calle.replace(MARCA_NUMERO, '').replace(/^[ ,.-]+|[ ,.-]+$/g, '')

/** ¿Lleva delante solo el tipo de vía («Calle », «C/ », «Avda. »)? Entonces el número es del nombre («Calle 2»). Detrás
 *  de un tipo que también es el nombre de una calle (TIPOS_NOMBRE), no: es su portal. */
function soloTipo(antes) {
  const w = plano(antes).split(NO_LETRA).filter(Boolean)
  return w.length === 1 && TIPOS.has(w[0]) && !TIPOS_NOMBRE.has(w[0])
}

/** El portal de la calle (el primer trozo, F: 03-11-2026): el PRIMER número que vale con el nombre delante, no solo el
 *  tipo de vía («Calle 2 3» → 3; «Calle 2» no tiene); si no hay y el primero va al principio, el formato de fuera
 *  («12 rue de Rivoli» → «rue de Rivoli»). {n, calle, fin}, con `fin` dónde acaba; si no, null (Situar.kt). F2
 *  (03-11-2026, igual en la app nativa): el que va seguido de una palabra que no es de piso y, más adelante, de otro que
 *  vale es del nombre y se salta (delNombre): «Calle de las 3 Cruces 12» → 12; «Rúa de 4 Caminos 38» → 38.
 *  F3 (03-11-2026, la sexta tanda; igual en la app nativa): solo detrás de un artículo (trasArticulo), y ya sin hacer
 *  falta otro número detrás. Con F2, «Calle Mayor 5 Escala 2» daba el 2; y «Calle de las 3 Cruces, 28013 Madrid», el 3. */
function portalEn(primero) {
  const ns = numerosEn(primero)
  for (const n of ns) {
    const antes = primero.slice(0, n.inicio)
    if (antes.trim() && !soloTipo(antes) && !(trasArticulo(antes) && delNombre(primero.slice(n.fin) + ' '))) return { n, calle: limpia(antes), fin: n.fin }
  }
  const n = ns[0]
  // El único va al principio: el formato de fuera. Solo él, no.
  if (n && !primero.slice(0, n.inicio).trim() && primero.slice(n.fin).trim()) return { n, calle: limpia(primero.slice(n.fin)), fin: primero.length }
  return null
}

/** F2 (03-11-2026, Situar.kt delNombre): ¿empieza lo de detrás del número por una palabra de 3 letras o más que no es de
 *  piso (esPisoCola)? «Cruces 12» sí; «2 dcha», «y 7» o «Nave 4», no. portalEn lo mira con un espacio añadido al final
 *  (F3, 03-11-2026): «Cruces» vale también al final del trozo. La palabra, entera hasta lo que la separa en esPisoCola
 *  (un espacio, «.», «,», «/» o «-»): «Apt\u200Bo 4», con un espacio de ancho cero dentro, no es «Apt» («ESTRADA N-550
 *  núm. 14A Apt\u200Bo 4» daba el 4). */
function delNombre(resto) {
  const w = PALABRA_DETRAS.exec(resto)
  return !!w && !esPisoCola(w[1])
}
const PALABRA_DETRAS = /^\s+(\p{L}{3,})(?=[\s.,/-])/u

/** F3 (03-11-2026, la sexta tanda; Situar.kt trasArticulo): ¿acaba lo de delante del número en un artículo o una
 *  preposición (ARTICULOS) con alguna palabra más delante? «Calle de las » sí; «Calle Mayor 5 Escala », no. F4
 *  (03-11-2026, la séptima tanda; igual en la app nativa): de dos letras o más y no «no», que es la marca del número
 *  («Calle Hidalgo No. 25 Col. Centro» es el 25), ni la letra del nombre («Avenida Juan Carlos I 12», «Calle A 5»); y
 *  sin los espacios de ancho cero, para que «d\u200Be» siga siendo «de». */
function trasArticulo(antes) {
  const w = sinTildes(antes.replace(ANCHO_CERO, '')).split(/[^a-z0-9]+/).filter(Boolean)
  const u = w[w.length - 1]
  return w.length > 1 && u.length > 1 && u !== 'no' && ARTICULOS.has(u)
}
const ANCHO_CERO = /[\u200B-\u200D\u2060\uFEFF]/g

/** La calle y el portal de una dirección ya sin el piso (paraBuscar): {calle, cifras, entero, fin}, el portal del
 *  primer trozo (portalEn) y, si no hay, el que va justo detrás de la primera coma; `fin`, dónde acaba (lo de detrás
 *  es el CP, el pueblo…: trasLaCalle), y -1 sin portal (Situar.kt leer). */
function leer(direccion) {
  const d = espacios(direccion)
  const coma = TROZOS.exec(d)
  const primero = coma ? d.slice(0, coma.index) : d
  const p = portalEn(primero)
  if (p) return { calle: p.calle, cifras: p.n.cifras, entero: p.n.entero, fin: p.fin }
  if (coma) {
    const desde = coma.index + coma[0].length
    const otra = new RegExp(TROZOS.source, 'g')
    otra.lastIndex = desde
    const hasta = otra.exec(d)
    const segundo = d.slice(desde, hasta ? hasta.index : d.length)
    // K3 (03-11-2026): con su marca delante, como en el primer trozo («, n.º4 2 B», «, Nº 5», «, núm. 3»).
    const i = MARCA_DELANTE.exec(segundo)[0].length
    const n = CIFRA.test(segundo[i] || '') ? numeroEn(segundo, i) : null
    if (n) return { calle: limpia(primero), cifras: n.cifras, entero: n.entero, fin: desde + n.fin }
  }
  return { calle: limpia(primero), cifras: '', entero: '', fin: -1 }
}
// La marca del número delante de él: «nº», «n.º», «no», «núm.» o «número» (K3).
const MARCA_DELANTE = /^\s*(?:n[uú]mero|n[uú]m\.?|n\.?\s*[º°o]\.?)?\s*/iu

/** El número del portal, solo las cifras: «Rúa Real, 12-14» → «12»; «Calle 2 de Mayo 14» → «14»; «12 rue de la Paix»
 *  → «12»; un CP no lo es. */
export const numeroDe = (direccion) => leer(paraBuscar(direccion)).cifras

/** EL PORTAL ENTERO (03-11-2026, igual en la app nativa: Situar.portalDe), con su letra, «bis» o su rango y en
 *  mayúsculas: «Calle Real 5B», «5 B» y «5-B» → «5B»; «Rúa Real 5 bis» → «5BIS»; «Calle Real 12-14» → «12-14». Se
 *  lee con la letra suelta («5 B»), que para buscar es la puerta y se quita (paraBuscar). Para saber si una sugerencia
 *  es el MISMO portal (alElegir, 3a): «5B» no es «5». */
export const portalDe = (direccion) => leer(paraBuscar(direccion, true)).entero

/** La dirección elegida con el piso de lo escrito: «Rúa Real 1, 2º B, 15003 A Coruña» + «Calle Real, 1, 15003 A
 *  Coruña» → «Calle Real, 1, 15003 A Coruña, 2º B». Lo que ya va en la elegida no se repite: sus palabras enteras, en
 *  orden (K5, 03-11-2026: el «2» de «Calle Mayor 15 2» no va en el 28013 de «Calle Mayor 15, 28013 Madrid»). La letra
 *  suelta del portal es del portal, no el piso (G2, 03-11-2026, igual en la app nativa): «Calle Real 3 B, 15003 A
 *  Coruña» + «Calle Real 3B, 15003 A Coruña» → «Calle Real 3B, 15003 A Coruña», sin «, B». */
export function conPiso(escrita, elegida) {
  const trozos = espacios(escrita).split(TROZOS).map((t) => t.trim()).filter(Boolean)
  const pisos = trozosSinPiso(escrita, true).map((limpio, i) => {
    const t = trozos[i]
    if (limpio === t) return ''
    if (!limpio) return t
    return t.startsWith(limpio) ? recorta(t.slice(limpio.length)) : ''
  }).filter(Boolean)
  const dicho = ` ${palabrasDe(elegida).join(' ')} `
  return [String(elegida || '').trim(), ...pisos.filter((p) => !dicho.includes(` ${palabrasDe(p).join(' ')} `))].filter(Boolean).join(', ')
}

/** Las palabras de un texto, sin acentos y en minúsculas: «2º B» → [2º, b] (K5). */
const palabrasDe = (s) => sinTildes(s).split(NO_LETRA).filter(Boolean)

/* LA MISMA CALLE, ESTRICTA (03-11-2026: la de la app nativa, Situar.kt calleDe, palabrasCalle, parecidas y
   mismaCalle, con sus mismas listas). La revisión vio que la web daba por buena cualquier sugerencia que compartiera
   UNA palabra con lo escrito: «Rúa Brétema, 15179 Oleiros» salía como normal para «Rúa Brétema Mariñeira 23, 15011 A
   Coruña» y, al tocarla, la parada se guardaba con el punto de Oleiros, a 8 km. Ahora, como en la app: el nombre sin
   el tipo de vía (calle, rúa y carrer valen igual), los artículos ni los acentos; la palabra distintiva (la última del
   nombre) en las dos, y las demás de la más corta, en la otra. Con un carácter de tolerancia para el OCR. */
const TIPOS = new Set(('calle c cl cll rua r carrer cr kalea k rueiro ruela carrero callejon calexa calleja avenida avda av avd ' +
  'avinguda etorbidea hiribidea plaza praza pza pz pl placa pca pr enparantza pracina plazuela plazoleta placeta paseo po passeig ' +
  'pg pasealekua ronda rda rolda travesia trav trv travessera tv travesa camino cmno cno cami bidea carretera ctra estrada ' +
  'errepidea lugar lg lug aldea glorieta gta urbanizacion urb barrio bo bairro auzoa poligono pol costa cuesta costanilla alameda ' +
  'parque bulevar boulevard pasaje pasaxe passatge muelle peirao rambla explanada via sector senda vereda subida baixada bajada ' +
  'calzada cc pasadizo rue avenue ave street st road rd strasse str viale piazza corso vicolo largo travessa praca chemin impasse ' +
  'allee quai').split(' '))
// Los que van detrás: en euskera («Errosario Santua kalea»), en alemán o en inglés («Main Street»).
const TIPOS_DETRAS = new Set(('kalea k etorbidea hiribidea plaza enparantza pasealekua bidea errepidea zumarkalea auzoa strasse ' +
  'str weg platz allee gasse street st road rd avenue ave lane ln drive boulevard blvd').split(' '))
// Los tipos que también son el nombre de una calle (03-11-2026, el laboratorio): «ESTRADA 24, 36004, A PARDA» es la Rúa
// da Estrada 24, y CartoCiudad tiene calles que se llaman «Rambla», «Estrada», «Pasaxe», «Costa», «Pasaje» y «Alameda».
// Detrás de ellos el número es el portal; detrás de los demás, del nombre («Calle 2»: soloTipo).
const TIPOS_NOMBRE = new Set('estrada rambla costa pasaxe pasaje alameda'.split(' '))
const ARTICULOS = new Set(('de del la el los las da do das dos a o os as d l dels les en na nas no nos y e i al ao aos of the der ' +
  'die den des du le di della dei van von am an im zum zur').split(' '))
// Lo que se antepone al nombre y a veces falta («Doctor Fleming» y «Fleming», «San Andrés» y «Andrés»).
const TITULOS = new Set(('doctor dr doutor pintor poeta escritor escultor musico maestro mestre profesor alcalde general xeneral ' +
  'capitan comandante almirante coronel teniente sargento san santa santo sant padre madre sor fray frei beato beata virgen virxe ' +
  'nuestra nosa senora rey rei reina raina infanta infante duque duquesa conde condesa marques marquesa presidente cardenal obispo ' +
  'bispo arzobispo arcebispo don dona ingeniero arquitecto periodista compositor').split(' '))
const OCR = { 0: 'o', 1: 'l', 5: 's', 8: 'b', 6: 'g', 4: 'a', 3: 'e' }
// «Nº», «N.º», «Núm.» o «s/n» al final del nombre (delante del número, o sin él).
const MARCA_NUMERO = /[\s,]+(?:n\.?\s*[º°o]?\.?|nro\.?|n[uú]m\.?|n[uú]mero|s\.?\s*\/?\s*n\.?)\s*$/iu

/** Sin acentos, en minúsculas y con «º» como «o» (NFKD): para comparar nombres. */
const plano = (s) => String(s || '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/ß/g, 'ss')

/** El nombre de la calle de una dirección, sin el número ni lo que va detrás: «Trav. de Meicende Nº 50, 15140,
 *  Arteixo» → «Trav. de Meicende»; «Calle 2 de Mayo 14, 28004 Madrid» → «Calle 2 de Mayo»; «12 rue de Rivoli, Paris»
 *  → «rue de Rivoli»; sin número, el primer trozo («Estrada AC-174, 15179 Oleiros» → «Estrada AC-174»). */
export const calleDe = (direccion) => leer(paraBuscar(direccion) || String(direccion || '').trim()).calle

/** Las palabras que dicen qué calle es, sin el tipo de vía, los artículos ni los acentos: «P.º Manuel Núñez» →
 *  [manuel, nunez]; «Trav. de Meicende» → [meicende]; «Errosario Santua kalea» → [errosario, santua]. */
export function palabrasCalle(nombre) {
  // «P.º» y «B.º» (paseo, barrio) son una palabra: sin esto, «p» y «o» por separado. Sin \b (J): lo mismo en Android.
  // Con los espacios raros como uno normal (K2, 03-11-2026), como en la app nativa.
  const s = plano(espacios(nombre)).replace(/^\s*([pb])\s*\.?\s*o(?![A-Za-z0-9_])/, '$1o').replace(/\([^)]*\)/g, ' ')
  let t = s.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  while (t.length > 1 && TIPOS.has(t[0])) t = t.slice(1)
  while (t.length > 1 && TIPOS_DETRAS.has(t[t.length - 1])) t = t.slice(0, -1)
  // G (03-11-2026): las cifras del nombre se quedan («Calle 1 de Mayo» → [1, mayo]); solo se van las letras sueltas.
  const w = t.filter((x) => !ARTICULOS.has(x) && (x.length > 1 || CIFRA.test(x)))
  return w.length ? w : t
}

/** Las cifras del nombre de una calle, en orden y sin repetir: [1, mayo] → «1» (G, 03-11-2026). */
const cifrasDelNombre = (palabras) => [...new Set(palabras.filter((w) => /^[0-9]+$/.test(w)))].sort().join(' ')

/** Una palabra con las confusiones del OCR deshechas: las cifras entre letras («Lug0», «Vare1a») y «rn» por «m»
 *  («Rarnbla»). Es una forma más de comparar, nunca en lugar de lo leído. */
const desOcr = (w) => (/\p{L}/u.test(w) && /\d/.test(w) ? [...w].map((c) => OCR[c] || c).join('') : w).replace(/rn/g, 'm')

/** ¿Como mucho un carácter cambiado, de más, de menos o dos cambiados de sitio? */
function unCaracter(a, b) {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (a.length > b.length) return a.slice(i + 1) === b.slice(i)
  if (a.length < b.length) return a.slice(i) === b.slice(i + 1)
  return a.slice(i + 1) === b.slice(i + 1) || (i + 1 < a.length && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
}

/** ¿Es la misma palabra? Igual, igual sin las confusiones del OCR, o con un carácter de diferencia si las dos tienen
 *  6 letras o más («Montccelo» y «Montecelo» sí; «Pinar» y «Pilar», no: son dos calles). En un nombre de tres
 *  palabras o más (`largo`), también con 4 o 5 («José Luls Estrada» es «José Luis Estrada»). */
function parecidas(a, b, largo = false) {
  if (a === b) return true
  const oa = desOcr(a)
  const ob = desOcr(b)
  if (oa === ob) return true
  return Math.min(a.length, b.length) >= (largo ? 4 : 6) && (unCaracter(a, b) || unCaracter(oa, ob))
}

/** ¿Es la misma calle? (de dos direcciones, o de dos nombres de calle). La palabra distintiva (la última del nombre:
 *  «Pita», «Meicende», «Bazán», «Mariñeira») tiene que estar en las dos, y las demás palabras de la más corta, en la
 *  otra: «Calle Emilia Pardo Bazán» y «Rúa Pardo Bazán» sí; «Rúa Brétema Mariñeira» y «Rúa Brétema» no (le falta
 *  «Mariñeira»), ni «Rúa Real» y «Rúa Nova», ni «Rúa Real» y «Rúa Real Alta». Una sola palabra dentro de un nombre más
 *  largo, solo si lo que sobra son títulos («Fleming» y «Doctor Fleming»): «Rúa da Cruz» no es «Rúa Madre Soledad de
 *  la Cruz». */
export function mismaCalle(escrita, sugerida) {
  const a = palabrasCalle(calleDe(escrita))
  const b = palabrasCalle(calleDe(sugerida))
  if (!a.length || !b.length) return false
  // Las cifras del nombre, las mismas en las dos o ninguna (G, 03-11-2026): «Calle 1 de Mayo» no es «Calle 2 de Mayo»,
  // ni «Calle Mayo», ni «Calle Dos de Mayo» (mejor «Otra calle» que el punto de otra).
  if (cifrasDelNombre(a) !== cifrasDelNombre(b)) return false
  const [corta, larga] = a.length <= b.length ? [a, b] : [b, a]
  const casa = (x, y) => parecidas(x, y, corta.length >= 3)
  const ultima = larga[larga.length - 1]
  if (!corta.every((w) => larga.some((x) => casa(w, x))) || !corta.some((w) => casa(w, ultima))) return false
  return corta.length > 1 || larga.every((w) => TITULOS.has(w) || casa(corta[0], w))
}

/* COMPARTE EL NOMBRE (03-11-2026: la de la app nativa tal cual, Situar.kt comparteNombre, con sus mismas listas).
   Con una calle que no conoce, el buscador de mapas (Photon) contesta lo más parecido que tiene: otras calles del mismo
   CP con el mismo número («Rúa Almirante Mourelle 41», «Rúa Virrey Osorio 41»… para «Rúa Valtrenxo 41, 15011 A
   Coruña»). Lo que NO es la misma calle pero comparte una palabra que la distingue puede ser la que se quiso escribir
   («Rúa Brétema» para «Rúa Brétema Mariñeira»); lo que no comparte ninguna, no. La revisión vio que la de la web no
   era la de la app: contaba como palabra que distingue casi cualquier título («Almirante Mourelle» y «Almirante
   Cervera» compartían «almirante»), no quitaba los artículos de fuera («van», «zum»…), decía que sí sin ninguna
   palabra con qué comparar y tomaba «1234 Main Street» por un CP. */
// Lo que no distingue una calle: los títulos, «São», «Nostra Senyora» y las marcas del número que se quedan dentro del
// nombre («Núm.», «Bis»).
const NO_DISTINGUEN = new Set([...TITULOS, ...'sao nostra senyora num numero nro bis'.split(' ')])
const NO_LETRA = /[^\p{L}\p{N}]+/u

/** Cuántos cambios de letra hay de una palabra a otra (Levenshtein: las palabras de una calle son cortas). */
function distancia(a, b) {
  let fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const nueva = [i]
    for (let j = 1; j <= b.length; j++) nueva[j] = Math.min(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    fila = nueva
  }
  return fila[b.length]
}

/** ¿Se parecen lo bastante para compartir el nombre? Como parecidas() y, desde 5 letras, a un cambio (a dos desde 8)
 *  con como mucho dos letras más o menos; y la palabra que aún se está tecleando, por su principio («Rivo» por
 *  «Rivoli»). */
function parecidasLaxa(a, b, tecleando) {
  if (parecidas(a, b)) return true
  if (tecleando && a.length >= 3 && b.startsWith(a)) return true
  const n = Math.min(a.length, b.length)
  return n >= 5 && Math.abs(a.length - b.length) <= 2 && distancia(a, b) <= (n >= 8 ? 2 : 1)
}

/** ¿Comparten el nombre? Al menos una palabra de la calle escrita que la distinga (de 3 letras o más, que no sea un
 *  título ni un tipo de vía: «San», «Doctor», «Almirante» o «Alcalde» no distinguen nada; si solo hay de esas,
 *  cualquiera) está en la otra, con el margen del OCR. Sin palabras con qué comparar, no. «Rúa Brétema Mariñeira 23,
 *  15011 A Coruña» y «Rúa Brétema, 15179 Oleiros» sí; «Rúa Valtrenxo 41» y «Rúa Almirante Mourelle 41», no; ni «Rúa
 *  Almirante Mourelle 41» y «Rúa Almirante Cervera 41» (solo comparten el título). */
export function comparteNombre(escrita, otra) {
  const todas = palabrasCalle(calleDe(escrita))
  const distintas = todas.filter((w) => w.length >= 3 && !NO_DISTINGUEN.has(w) && !TIPOS.has(w))
  const mias = distintas.length ? distintas : todas
  const suyas = palabrasCalle(calleDe(otra))
  if (!mias.length || !suyas.length) return false
  // La última palabra de lo escrito puede estar a medias («12 rue de Rivo»).
  const ultima = plano(escrita).split(NO_LETRA).filter(Boolean).pop()
  return mias.some((a) => suyas.some((b) => parecidasLaxa(a, b, a === ultima)))
}

/** ¿Es de OTRA calle que la escrita? (Situar.kt deOtraCalle.) Solo se juzga con el número de portal ya escrito (sin
 *  él, la persona aún teclea o busca un sitio por su nombre: «Hospital Abente y Lago», «Mercadona Oleiros») y con un
 *  nombre de calle con qué comparar: entonces lo es lo que no sea la misma calle (mismaCalle, la estricta) EN EL MISMO
 *  SITIO (mismoSitio, 03-11-2026: «Rúa Brétema, 15179 Oleiros» lo es de «Rúa Brétema 23, 15011 A Coruña», a 8 km).
 *  `sugerida`, su texto o la sugerencia (con su CP y su población); `cp` y `localidad`, los de la parada si los tiene. */
export function deOtraCalle(escrita, sugerida, cp = '', localidad = '') {
  if (!numeroDe(escrita) || !palabrasCalle(calleDe(escrita)).length) return false
  const s = sugerida && typeof sugerida === 'object' ? sugerida : { direccion: String(sugerida || '') }
  return !mismaCalle(escrita, s.direccion) || !mismoSitio(escrita, s, cp, localidad)
}

/** LAS QUE NO TOCAN (03-11-2026, igual en la app nativa). De un buscador (el de mapas, Photon; en la app, también el
 *  del móvil), la que es de otra calle que lo BUSCADO con su número y no comparte con ello ninguna palabra que
 *  distinga la calle no sale: con «Rúa Valtrenxo 41» no salen «Rúa Almirante Mourelle 41» ni «Rúa Virrey Osorio 41»
 *  del mismo CP. Lo buscado es lo que se escribe en la ficha o en el buscador de «Situar». Sin número en lo buscado no
 *  se quita nada (un sitio buscado por su nombre sale). */
export const noToca = (buscado, sugerida) => deOtraCalle(buscado, sugerida) && !comparteNombre(buscado, sugerida)

// El piso, la puerta o la escalera como palabra suelta, ya sin acentos y con «º» como «o» (Situar.kt PISO_PALABRA, la
// de geocodificador.PISO_TOK del servidor): para saber si un trozo de la dirección es el piso y no el pueblo.
const PISO_PALABRA = new RegExp('^(?:\\d{1,2}o?[a-z]?|\\d{1,2}(?:o|a|n|r|t|er|na|ra|ta|do|ro|to)|bajo|bajos|bj|baixo|' +
  'baixos|entlo|entresuelo|entreplanta|entl|pral|principal|atico|atic|sotano|semisotano|local|izq|izda|izquierda|' +
  'dcha|dcho|derecha|dta|dereita|esq|esquerda|centro|ctro|esc|escalera|escaleira|portal|pta|puerta|porta|piso|planta|' +
  'bloque|blq|bl|edificio|edif|behea|ezk|esk|eskuma|ezkerra|eskuina|bis|dup|duplicado|[a-h])$')
// Una palabra del piso que va detrás del portal (F, 03-11-2026; las de geocodificador.PISO_TOK, con «casa» y «nave»):
// «2», «1o», «2n», «3r», «4.», «Baixo», «Pral.», «Àtic», «eskuma»… y una letra de la A a la H.
const PISO_COLA = new RegExp('^(?:\\d{1,2}(?:°|o|a|n|r|t|er|na|ra|ta|do|ro|to)?|bajo|bajos|bj|baixo|baixos|entlo|' +
  'entresuelo|entreplanta|entl|pral|principal|atico|atic|sotano|semisotano|local|izq|izqda|izda|izquierda|dcha|dcho|' +
  'dch|der|derecha|dta|dereita|esq|esquerda|centro|ctro|int|ext|esc|escalera|escaleira|portal|pta|puerta|porta|piso|' +
  'planta|bloque|blq|bl|edificio|edif|behea|ezk|esk|eskuma|ezkerra|eskuina|dup|duplicado|casa|nave|[a-h])$')
// Las provincias, las comunidades y el país que no son el nombre de ningún pueblo (B, 03-11-2026; igual en la app
// nativa): nunca cuentan. P (03-11-2026, la sexta tanda): todas, también en las otras lenguas; son también de PROVINCIAS.
const NO_SON_PUEBLO = new Set(('alava,araba,asturias,bizkaia,vizcaya,cantabria,gipuzkoa,guipuzcoa,navarra,nafarroa,' +
  'la rioja,rioja,illes balears,islas baleares,baleares,galicia,euskadi,pais vasco,catalunya,cataluna,andalucia,aragon,' +
  'castilla y leon,castilla la mancha,extremadura,comunidad valenciana,comunitat valenciana,region de murcia,' +
  'comunidad de madrid,canarias,principado de asturias,espana,spain').split(','))
// Las provincias (y el país) que las etiquetas ponen detrás del pueblo: como pueblo solo cuentan si no hay otro y,
// desde el 03-11-2026, con el CP de la capital o sin CP (cuentaComoPueblo). P (03-11-2026, igual en la app nativa):
// todas las que se llaman como su capital, también en las otras lenguas, y las de NO_SON_PUEBLO. Con unas 20,
// «Calle Mayor 5, 30800 Lorca, Murcia» pasaba por el mismo sitio que «Calle Mayor, 30001 Murcia», a 60 km.
const PROVINCIAS = new Set([...NO_SON_PUEBLO, ...('a coruna,coruna,la coruna,albacete,alicante,alacant,almeria,avila,' +
  'badajoz,barcelona,burgos,caceres,cadiz,castellon,castello,castellon de la plana,ciudad real,cordoba,cuenca,girona,' +
  'gerona,granada,guadalajara,huelva,huesca,jaen,las palmas,leon,lleida,lerida,lugo,madrid,malaga,murcia,ourense,' +
  'orense,palencia,pontevedra,salamanca,santa cruz de tenerife,segovia,sevilla,soria,tarragona,teruel,toledo,valencia,' +
  'valladolid,zamora,zaragoza,ceuta,melilla').split(',')])
// Lo que va delante de una provincia que es del nombre del pueblo («Alhama de Murcia», «Sant Joan d'Alacant»): P2
// (03-11-2026, la séptima tanda; Situar.kt DE_DELANTE).
const DE_DELANTE = new Set(['de', 'del', 'd'])
/** Las listas de la regla, para comprobar en las pruebas que son las de la app nativa (y su palabra de piso). */
export const LISTAS_CALLE = { TIPOS, TIPOS_DETRAS, TIPOS_NOMBRE, ARTICULOS, TITULOS, NO_DISTINGUEN, PROVINCIAS, NO_SON_PUEBLO, DE_DELANTE }
export const PISO_PALABRA_FUENTE = PISO_PALABRA.source
export const PISO_COLA_FUENTE = PISO_COLA.source
// Las expresiones de K (03-11-2026), para comprobar en las pruebas que son las de la app nativa; y la de F4.
export const EXPRESIONES_K = { PISO, MARCA_DELANTE, ESPACIOS_RAROS, ANCHO_CERO }

/** Lo escrito detrás de la calle y el portal: el CP, el pueblo, la provincia… (Situar.kt trasLaCalle) */
function trasLaCalle(direccion) {
  const d = paraBuscar(direccion) || espacios(direccion).trim()
  const l = leer(d)
  if (l.fin >= 0) return d.slice(l.fin)
  const coma = TROZOS.exec(d)
  return coma ? d.slice(coma.index + coma[0].length) : ''
}

/** ¿Es un trozo solo el piso, la puerta o la escalera («Baixo», «2º B», «Esc. A»)? */
function esPiso(trozo) {
  const t = plano(trozo).split(/[\s.,/-]+/).filter(Boolean)
  return t.length > 0 && t.every((w) => PISO_PALABRA.test(w))
}

/** ¿Es todo piso lo de detrás del portal («2 dcha», «2n 1a», «Baixo 2», «1o IZQ.»)? Con una palabra que no lo es, no:
 *  en «Calle Real 1 A Coruña» la «A» es del pueblo (F, 03-11-2026, como el servidor). */
function esPisoCola(cola) {
  const t = plano(cola).split(/[\s.,/-]+/).filter(Boolean)
  return t.length > 0 && t.every((w) => PISO_COLA.test(w))
}

/** Un pueblo en palabras: sin acentos ni cifras (el CP), sin el piso delante, sin el artículo del final («CORUÑA (A)»)
 *  y sin la provincia detrás si queda el pueblo: «15011 A Coruña» → [a, coruna]; «Sada Coruña» → [sada]. P
 *  (03-11-2026, igual en la app nativa): la provincia de detrás, la más larga, también de varias palabras («Telde Las
 *  Palmas» → [telde]); la que ya es entera una provincia se queda («Región de Murcia» no es [region]). */
function clavePueblo(s) {
  let t = plano(s).split(NO_LETRA).filter((w) => w && /\p{L}/u.test(w))
  while (t.length > 1 && PISO_PALABRA.test(t[0]) && !ARTICULOS.has(t[0])) t = t.slice(1)
  while (t.length > 1 && ARTICULOS.has(t[t.length - 1])) t = t.slice(0, -1)
  for (let n = provinciaDetras(t); n > 0; n = provinciaDetras(t)) {
    t = t.slice(0, -n)
    while (t.length > 1 && ARTICULOS.has(t[t.length - 1])) t = t.slice(0, -1)
  }
  return t
}

/** Cuántas palabras del final de `t` son una provincia (la más larga), con algo delante que no es un artículo; 0 si no
 *  hay o si `t` ya es entera una (esProvincia). P (03-11-2026). P2 (03-11-2026, la séptima tanda; igual en la app nativa
 *  y en loc_limpia del servidor): detrás de «de», «del» o «d» no se quita, que es del nombre del pueblo: «Alhama de
 *  Murcia» y «Alhama de Granada» no son los dos [alhama], ni «Sant Joan d'Alacant» [sant, joan]. */
function provinciaDetras(t) {
  if (t.length < 2 || esProvincia(t)) return 0
  for (let n = t.length - 1; n > 0; n--) {
    if (PROVINCIAS.has(t.slice(-n).join(' ')) && t.slice(0, -n).some((w) => !ARTICULOS.has(w)) && !DE_DELANTE.has(t[t.length - n - 1])) return n
  }
  return 0
}

/** ¿Son las palabras `t` (de clavePueblo) una de la `lista`, con su artículo o sin él? «a coruna» y «coruna»; «las
 *  palmas», «la rioja» o «santa cruz de tenerife», enteras (P, 03-11-2026: las de varias palabras, como las de una). */
const esProvincia = (t, lista = PROVINCIAS) => lista.has(t.join(' ')) || lista.has(sinArticulo(t).join(' '))

/* EL MISMO SITIO (03-11-2026 de madrugada, la revisión; igual en la app nativa: Situar.kt pueblosEscritos, mismoPueblo
   y mismoSitio, con sus mismas listas). «Rúa Brétema 23, 15011 A Coruña» y «Rúa Brétema, 15179 Oleiros» son la misma
   calle (mismaCalle) pero no el mismo sitio: están a 8 km, y la parada se quedaba con lo escrito y el punto de
   Oleiros. Una sugerencia es de la calle de la parada solo si es la misma calle Y el mismo sitio, por el CP o por el
   pueblo; si no, es «Otra calle» y al elegirla queda SU dirección (alElegir, 4). */
const sinArticulo = (t) => (t.length > 1 && ARTICULOS.has(t[0]) ? t.slice(1) : t)
const sinArticulos = (t) => {
  const x = t.filter((w) => !ARTICULOS.has(w))
  return x.length ? x : t
}
const conLetras = (t) => t.some((w) => [...w].filter((c) => LETRA.test(c)).length >= 3)

/** EL PUEBLO Y SU MUNICIPIO (H, 03-11-2026; igual en la app nativa). CartoCiudad escribe «15670 O Burgo (Culleredo)»
 *  (uno de cada cuatro resultados del laboratorio), y «Culleredo» no era «o burgo culleredo»: «X (Y)» son dos pueblos,
 *  X e Y, en palabras (clavePueblo). Y no cuenta si es solo un artículo («CORUÑA (A)» sigue siendo A Coruña) ni si es
 *  una provincia («Ames (A Coruña)» es Ames: si no, cualquier pueblo de la provincia pasaría por la ciudad). */
function clavesPueblo(s) {
  const t = String(s || '')
  const ys = [...t.matchAll(/\(([^)]*)\)/g)].map((m) => clavePueblo(m[1]))
    .filter((y) => y.some((w) => !ARTICULOS.has(w)) && !esProvincia(y))
  return [clavePueblo(t.replace(/\([^)]*\)/g, ' ')), ...ys]
}

/** EL NOMBRE DE LA CAPITAL CON EL CP DE OTRO MUNICIPIO (B, 03-11-2026, la revisión; igual en la app nativa: Situar.kt
 *  cuentaComoPueblo). «Rúa Rosalía de Castro 5, 15179 A Coruña» es de Oleiros y pasaba por la de la ciudad (15004), a 8
 *  km. ¿Cuenta como pueblo `t` (de clavePueblo) escrito con el CP `cp`? Lo que no es de PROVINCIAS, sí; «España»,
 *  «Galicia», «Bizkaia»…, nunca (NO_SON_PUEBLO); el nombre de una capital («A Coruña», «Lugo», «Madrid»), con un CP de
 *  España (5 cifras, de 01 a 52) solo si es de la capital (la tercera cifra es 0: 15004, 27002, 28013) y, sin CP o con
 *  uno de fuera, sí. */
function cuentaComoPueblo(t, cp) {
  if (!esProvincia(t)) return true
  if (esProvincia(t, NO_SON_PUEBLO)) return false
  const c = soloCp(cp)
  return !/^(?:0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}$/.test(c) || c[2] === '0'
}

/** Los pueblos que dice una dirección, sin el piso, el CP ni la provincia si hay otro, y la población de la parada
 *  (esa siempre), cada uno en palabras: «Rúa Real 5, 15179 Oleiros, A Coruña» → [«oleiros»]; «…, 15011 A Coruña» →
 *  [«a coruna»]; «Martinete 27, O Martinete, A Coruña» con la población «A Coruña» → [«a coruna», «o martinete»];
 *  «…, 15670 O Burgo (Culleredo)» → [«o burgo», «culleredo»] (clavesPueblo). Los dos, con el CP de la parada (`cp`) o,
 *  sin él, el escrito (B, 03-11-2026: cuentaComoPueblo): «…, 15179 A Coruña» → []. */
export function pueblosEscritos(direccion, localidad = '', cp = '') {
  const c = cpDe(direccion, cp)
  const cuenta = (t) => conLetras(t) && cuentaComoPueblo(t, c)
  const ps = trasLaCalle(direccion).split(TROZOS).filter((x) => x.trim() && !esPiso(x)).flatMap(clavesPueblo).filter(cuenta)
  const sinProvincia = ps.filter((t) => !esProvincia(t))
  const loc = clavesPueblo(localidad).filter(cuenta)
  const vistos = new Set()
  const out = []
  for (const t of [...loc, ...(sinProvincia.length ? sinProvincia : ps)]) {
    const k = sinArticulos(t).join(' ')
    if (!vistos.has(k)) { vistos.add(k); out.push(t.join(' ')) }
  }
  return out
}

/** ¿Es `suyo` uno de los `pueblos` (los de pueblosEscritos)? El mismo nombre, con o sin sus artículos («Coruña» y «A
 *  Coruña», «Santiago Compostela» y «Santiago de Compostela») y con un carácter de tolerancia en los largos
 *  («Vilardevós» y «Villardevós»); o, si el más corto tiene dos palabras o más, dentro del otro («As Pontes» y «As
 *  Pontes de García Rodríguez»). Uno de una palabra no vale dentro de otro: «Burgos» no es «San Mamés de Burgos».
 *  «O Burgo (Culleredo)» es O Burgo o Culleredo (clavesPueblo, 03-11-2026). `suyo`, con su CP (`cp`, B: el nombre de
 *  la capital con el CP de otro municipio no es un pueblo; «España», nunca). */
export function mismoPueblo(suyo, pueblos, cp = '') {
  const dentro = (a, b) => b.length > 0 && b.length <= a.length
    && a.slice(0, a.length - b.length + 1).some((_, i) => b.every((w, j) => parecidas(a[i + j], w)))
  const casan = (a, b) => (a.length === b.length && dentro(a, b)) || (Math.min(a.length, b.length) >= 2 && (dentro(a, b) || dentro(b, a)))
  return clavesPueblo(suyo).filter((t) => conLetras(t) && cuentaComoPueblo(t, cp)).some((r) => (pueblos || []).some((p) => {
    const w = String(p || '').split(' ').filter(Boolean)
    return casan(w, r) || casan(sinArticulos(w), sinArticulos(r))
  }))
}

const soloCp = (cp) => String(cp || '').toUpperCase().replace(/[^\p{L}\p{Nd}]/gu, '')
/** El CP de una dirección: el dado o, sin él, el escrito detrás de la calle (cinco cifras sueltas). */
const cpDe = (direccion, cp = '') => soloCp(cp) || (/(?:^|[^0-9])([0-9]{5})(?![0-9])/.exec(trasLaCalle(direccion)) || [])[1] || ''

/** B2 (03-11-2026, igual en la app nativa: Situar.kt diceSitio): ¿dice la parada algún sitio, cuente o no como pueblo?
 *  Un trozo detrás de la calle que no es el piso, o su población, con letras (como en pueblosEscritos, sin mirar
 *  cuentaComoPueblo): «…, Asturias», «…, Galicia» o la población «Bizkaia», sí; «Rúa Real 5» o «Rúa Real 5, 2º B», no. */
const sitioEscrito = (direccion, localidad = '') =>
  [...trasLaCalle(direccion).split(TROZOS).filter((x) => x.trim() && !esPiso(x)), localidad].flatMap(clavesPueblo).some(conLetras)

/** ¿Es la sugerencia `s` ({direccion, cp, localidad}, o su texto) del mismo sitio que `escrita`, la dirección de la
 *  parada, con su CP (`cp`) y su población (`localidad`) si los tiene? El CP de cada una es el suyo o el escrito en su
 *  dirección; los pueblos de la parada, los escritos y su población; el de la sugerencia, su población o, sin ella,
 *  los de su texto. Con CP en la parada: el mismo CP o, si no, el mismo pueblo («Avenida de Finisterre 120, 15004 A
 *  Coruña» y «Avenida de Finisterre, 15005 A Coruña» lo son); sin CP y con pueblo: el mismo pueblo; sin CP ni pueblo,
 *  sí (no hay con qué comparar, como hasta ahora). Una sugerencia sin CP ni pueblo no lo es de una parada que los dice.
 *  B (03-11-2026, igual en la app nativa): los pueblos de cada una, con su CP (cuentaComoPueblo); sin otro pueblo,
 *  decide el CP: «Rúa Rosalía de Castro 5, 15179 A Coruña» no es «Rúa Rosalía de Castro, 15004 A Coruña».
 *  B2 (03-11-2026, la sexta tanda): el «sí» sin CP ni pueblo queda para la parada que no dice ningún sitio
 *  (sitioEscrito); la que dice uno que no cuenta («Calle Uría 5, Asturias») no es el mismo sitio («Otra calle»). Antes
 *  pasaba por la misma calle de cualquier pueblo y se quedaba con su punto (el de Gijón, o el de Arteixo). */
export function mismoSitio(escrita, s, cp = '', localidad = '') {
  const sug = s && typeof s === 'object' ? s : { direccion: String(s || '') }
  const cpParada = cpDe(escrita, cp)
  const cpSug = cpDe(sug.direccion, sug.cp)
  const pueblos = pueblosEscritos(escrita, localidad, cpParada)
  if (!cpParada && !pueblos.length) return !sitioEscrito(escrita, localidad)
  if (cpParada && cpParada === cpSug) return true
  const suyo = String(sug.localidad || '').trim()
  return (suyo ? [suyo] : pueblosEscritos(sug.direccion, '', cpSug)).some((p) => mismoPueblo(p, pueblos, cpSug))
}

/** LA REGLA AL ELEGIR UNA SUGERENCIA (03-11-2026; la misma en la app nativa, Situar.kt alElegir, y en TODOS los
 *  caminos: la lista de la ficha, «Situar la parada» abierta desde la ficha y «Situar la parada» abierta desde la ruta).
 *  El emulador y la revisión vieron caminos donde «Rúa Brétema Mariñeira 23, 15011 A Coruña» se guardaba con el punto
 *  de «Rúa Brétema, 15179 Oleiros», a 8 km, y la guía llevaba a Oleiros: la marca «Otra calle» se ponía comparando con
 *  el texto del buscador de «Situar» y la búsqueda corregida a «Rúa Brétema, Oleiros» la daba por buena. Ahora decide
 *  esto, en un solo sitio:
 *  `escrita` es la dirección de la PARADA (la escrita en la ficha o, desde la ruta, la guardada), NUNCA el texto del
 *  buscador de «Situar», que la persona puede haber cambiado, y `cp` y `localidad`, los de la parada si los tiene;
 *  `s`, la sugerencia elegida, de cualquier fuente (el servidor, las suyas, el buscador de mapas), esté marcada o no.
 *  Devuelve la dirección que queda, la precisión («portal» o «calle»), el CP y la población que van con ella y `caso`:
 *   · «suya» (1): una de «Ya estuviste aquí» (`fuente` «suya»; la que se juntó con una del servidor en el mismo sitio
 *     es la del servidor, como en la app), tal cual, con la precisión que dice el servidor (sin ella, «portal»);
 *   · «sin-numero» (2): lo escrito no trae el portal: la de la sugerencia con el piso escrito (conPiso), y su
 *     precisión («Hospital Abente y Lago» pasa a ser la dirección del hospital);
 *   · «portal» (3a): la misma calle (mismaCalle, la estricta) en el mismo sitio (mismoSitio) y el mismo portal ENTERO
 *     (portalDe, 03-11-2026: «Calle Real 5» no es el portal de «Calle Real 5B»): la suya con el piso escrito;
 *   · «calle» (3b): la misma calle en el mismo sitio sin ese portal («Sin el portal», «Calle Real 85» para «Rúa Real
 *     999», o «Calle Real 5» para «5B»): se queda lo escrito con su portal y su piso, con el CP y el pueblo de la
 *     sugerencia detrás solo si no los traía;
 *   · «otra» (4): otra calle, u otro sitio («Rúa Brétema, 15179 Oleiros» para «Rúa Brétema 23, 15011 A Coruña»): la
 *     suya con el piso escrito, su CP, su población y su precisión («portal» si trae número, «calle» si no). Nunca lo
 *     escrito con el punto de otra calle. Es lo que anuncia la marca «Otra calle» de la lista (juntarSugerencias). */
export function alElegir(escrita, s, cp = '', localidad = '') {
  const e = String(escrita || '').trim()
  const suya = String(s?.direccion || '').trim()
  const precision = s?.precision === 'calle' ? 'calle' : 'portal'
  const suCp = String(s?.cp || '').trim()
  const suLocalidad = String(s?.localidad || '').trim()
  const queda = (direccion, prec, caso) => ({ direccion, precision: prec, cp: suCp, localidad: suLocalidad, caso })
  if (s?.fuente === 'suya') return queda(suya, precision, 'suya')
  if (!numeroDe(e)) return queda(conPiso(e, suya), precision, 'sin-numero')
  if (deOtraCalle(e, { ...s, direccion: suya }, cp, localidad)) return queda(conPiso(e, suya), precision === 'portal' && numeroDe(suya) ? 'portal' : 'calle', 'otra')
  if (precision === 'portal' && portalDe(suya) === portalDe(e)) return queda(conPiso(e, suya), 'portal', 'portal')
  const faltan = [suCp && !CP_EN_TROZO.test(trasLaCalle(e)) ? suCp : '', suLocalidad && !pueblosEscritos(e).length ? suLocalidad : ''].filter(Boolean)
  const texto = faltan.length ? `${e}, ${faltan.join(' ')}` : e
  const dicho = sinTildes(texto)
  const siEsta = (x) => (x && dicho.includes(sinTildes(x)) ? x : '')
  return { direccion: texto, precision: 'calle', cp: siEsta(suCp), localidad: siEsta(suLocalidad), caso: 'calle' }
}

/** «ES AQUÍ» DESDE LA RUTA (03-11-2026, Situar.kt esAqui): lo que se manda con el punto. Con la chincheta donde la puso
 *  una sugerencia (`origen` «sugerencia»), la regla de alElegir con la dirección GUARDADA (y su CP y su población):
 *  `precision` «calle» si sale la calle y, si la dirección que queda es otra (otra calle u otro sitio, el CP y el pueblo
 *  que le faltaban, la de una suya, la de lo elegido para una sin número o la del mismo portal escrita de otra forma),
 *  esa dirección con su CP y su población. Con el mapa movido a mano o «Mi ubicación» («mapa»), nada: la puerta
 *  («manual»), y la dirección no cambia. */
export function cambioEsAqui(direccion, origen, s, cp = '', localidad = '') {
  if (origen !== 'sugerencia' || !s) return { precision: '' }
  const el = alElegir(direccion, s, cp, localidad)
  const precision = el.precision === 'calle' ? 'calle' : ''
  return el.direccion === String(direccion || '').trim() ? { precision } : { precision, direccion: el.direccion, cp: el.cp, localidad: el.localidad }
}

/** ¿Es de la calle BUSCADA? Para «No encuentro esa dirección» de «Situar» (Situar.kt deLaBuscada): las marcas de «Otra
 *  calle» van con la dirección de la parada y lo buscado se pudo cambiar. Las suyas, siempre; las demás, si lo buscado
 *  no trae número o son de su misma calle en el mismo sitio. */
export const deLaBuscada = (buscado, s) => s?.fuente === 'suya' || !deOtraCalle(buscado, s || '')

/** Lo que contestó POST /reparto/ubicar, listo para pintar: el estado («portal», «calle» o «no»: la zona sola no vale
 *  para ir), el centro de la zona si lo dio, los candidatos que son una puerta o una calle (como mucho 6) y de dónde
 *  salen los datos. null si la respuesta no es de ese servicio (un servidor de antes, o una prueba que contesta {}):
 *  entonces no se dice nada, mejor que decir algo falso. */
export function deUbicar(data) {
  if (!data || typeof data !== 'object' || typeof data.encontrada !== 'boolean') return null
  const precision = data.precision || ''
  const estado = precision === 'portal' ? 'portal' : precision === 'calle' ? 'calle'
    : precision === 'zona' ? 'no' : (data.encontrada ? 'calle' : 'no')
  const crudos = Array.isArray(data.candidatos) ? data.candidatos : []
  const candidatos = crudos
    .filter((c) => c && c.precision !== 'zona' && String(c.direccion || '').trim() && punto(c.lat, c.lng))
    .slice(0, 6)
    .map((c) => ({ direccion: String(c.direccion).trim(), lat: Number(c.lat), lng: Number(c.lng), precision: c.precision === 'calle' ? 'calle' : 'portal', fuente: 'servidor' }))
  // Un servidor que da lo encontrado pero no la lista: lo encontrado es el primer candidato.
  if (!candidatos.length && estado !== 'no' && String(data.direccion || '').trim() && punto(data.lat, data.lng)) {
    candidatos.push({ direccion: String(data.direccion).trim(), lat: Number(data.lat), lng: Number(data.lng), precision: estado, fuente: 'servidor' })
  }
  const zonaCand = crudos.find((c) => c && c.precision === 'zona' && punto(c.lat, c.lng))
  const zona = precision === 'zona' && punto(data.lat, data.lng) ? punto(data.lat, data.lng) : (zonaCand ? punto(zonaCand.lat, zonaCand.lng) : null)
  return { estado, encontrada: estado !== 'no', direccion: String(data.direccion || ''), zona, candidatos, atribucion: String(data.atribucion || '') }
}

// Las del buscador de mapas que se enseñan como mucho (Situar.kt TOPE_MAPA), ya quitadas las que no tocan.
const TOPE_MAPA = 5
// EL CP Y LA POBLACIÓN DE LO JUNTADO (03-11-2026, igual en la app nativa: Situar.rango): de la primera fuente que los
// traiga, en este orden (el servidor con las suyas, el móvil, Photon; las demás, detrás), cada dato por su lado. Antes
// la web se quedaba los de la que llegara antes y la app, ninguno.
const ORDEN_FUENTE = { servidor: 0, suya: 1, movil: 2, photon: 3 }

/** ¿Son la misma sugerencia? La misma dirección escrita igual, o el mismo número a menos de 25 m. */
function repetida(a, b) {
  if (claveTexto(a.direccion) === claveTexto(b.direccion)) return true
  const pa = punto(a.lat, a.lng)
  const pb = punto(b.lat, b.lng)
  return !!(pa && pb && numeroDe(a.direccion) === numeroDe(b.direccion) && metros(pa, pb) < 25)
}

/** Las sugerencias en el orden en que se enseñan: lo que encuentra el servidor primero, luego las suyas («Ya estuviste
 *  aquí») y las del buscador de mapas (Photon). La misma dirección escrita igual, o el mismo número a menos de 25 m, es
 *  la misma: se queda la primera, con el cliente, el teléfono y las veces de la suya. Solo las que traen su punto.
 *  OTRA CALLE (03-11-2026, igual en la app nativa: Situar.ordenar). Con el número de portal en `escrita`, que es la
 *  dirección de la PARADA (la de la ficha, o la guardada desde la ruta) y no lo buscado en «Situar», toda la que no
 *  es su misma calle en el mismo sitio (deOtraCalle, con el CP y la población de la parada: `cp`, `localidad`), venga
 *  de donde venga menos las suyas, lleva `otraCalle` y va al final, como en la app nativa: elegirla pone su dirección
 *  (alElegir, caso «otra»). La marca la pone siempre esto: la que trajera una de antes no vale. Si una es el mismo
 *  sitio que otra de antes, se queda la de antes, con el CP y la población de la primera fuente que los traiga por
 *  ORDEN_FUENTE (servidor, móvil, Photon).
 *  EL CORTE DE PHOTON (03-11-2026, Situar.kt TOPE_MAPA): lib/direcciones.js pide 10 y quita las que no tocan; aquí,
 *  marcadas, las de la calle de la parada delante, y solo entonces se dejan 5. */
export function juntarSugerencias(servidor = [], suyas = [], mapa = [], n = 6, escrita = '', cp = '', localidad = '') {
  const out = []
  const juntas = []                                      // las que son cada una de `out` (la primera, la que se queda)
  const marcada = (s) => ({ ...s, otraCalle: s.fuente !== 'suya' && deOtraCalle(escrita, s, cp, localidad) })
  const delMapa = mapa.filter(Boolean).map(marcada)
  const todas = [...servidor.filter(Boolean).map(marcada), ...suyas.filter(Boolean).map((s) => ({ ...s, otraCalle: false })),
    ...[...delMapa.filter((x) => !x.otraCalle), ...delMapa.filter((x) => x.otraCalle)].slice(0, TOPE_MAPA)]
  for (const s of [...todas.filter((x) => !x.otraCalle), ...todas.filter((x) => x.otraCalle)]) {
    if (!String(s.direccion || '').trim() || !punto(s.lat, s.lng)) continue
    const i = out.findIndex((x) => repetida(x, s))
    if (i < 0) { out.push(s); juntas.push([s]); continue }
    juntas[i].push(s)
    const a = out[i]
    out[i] = { ...a, cliente: a.cliente || s.cliente || '', telefono: a.telefono || s.telefono || '', veces: Math.max(a.veces || 0, s.veces || 0),
      conocida: a.conocida || s.conocida || false }
  }
  const orden = (x) => ORDEN_FUENTE[x.fuente] ?? 4
  return out.slice(0, n).map((s, i) => {
    if (juntas[i].length < 2) return s
    const fuentes = [...juntas[i]].sort((a, b) => orden(a) - orden(b))
    const primero = (k) => fuentes.find((x) => String(x[k] || '').trim())?.[k] || s[k] || ''
    return { ...s, cp: primero('cp'), localidad: primero('localidad') }
  })
}

/** Dónde empieza el mapa de «Situar la parada» y con qué zoom: su propio punto si ya lo tiene (para corregirlo), la zona
 *  que encontró el servidor (el barrio del CP), la base, o la primera parada situada de la ruta. null: donde esté el
 *  móvil. */
export function centroInicial(p, base, otras = []) {
  const suyo = punto(p?.lat, p?.lng)
  if (suyo) return { punto: suyo, zoom: 18 }
  const zona = punto(p?.zona_lat, p?.zona_lng)
  if (zona) return { punto: zona, zoom: 15 }
  const b = punto(base?.lat, base?.lng)
  if (b) return { punto: b, zoom: 14 }
  const o = (otras || []).map((x) => punto(x?.lat, x?.lng)).find(Boolean)
  return o ? { punto: o, zoom: 14 } : null
}

/** El estado de una parada ya guardada, por su punto y su `geo`: «portal» (el del servidor, la puerta aprendida o el
 *  puesto a mano), «calle» (sin el portal) o «no». */
export const estadoDeParada = (p) => (!punto(p?.lat, p?.lng) ? 'no' : p.geo === 'aprox' ? 'calle' : 'portal')
