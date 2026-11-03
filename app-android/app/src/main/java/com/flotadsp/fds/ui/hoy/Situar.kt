package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.Base
import com.flotadsp.fds.data.CandidatoUbicar
import com.flotadsp.fds.data.DireccionConocida
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.data.Repositorio
import com.flotadsp.fds.ui.parada.Sugerencia
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.text.Normalizer

/* EL PRIMER PAQUETE BIEN SITUADO (02-11-2026). Dani, probando la app con una cuenta nueva: «el primer paquete que
   escaneo no encuentra la dirección y tiene que ir por Maps; eso es un pedazo de mierda, hazlo bien». Una parada que
   el servidor no sabe poner en el mapa ya NO se manda a Google Maps: primero lo intenta el geocodificador del móvil (el
   de Google en casi todos los Android, que entiende el gallego, el catalán y las faltas) y, si tampoco, la persona la
   pone en NUESTRO mapa (SituarPantalla) con las sugerencias del servidor (POST /reparto/ubicar), del móvil y de Photon.
   Aquí va lo que se decide sin Android, para probarlo (SituarTest): qué respuesta del móvil se acepta y con qué
   precisión, cuándo una parada cuenta como sin situar, dónde empieza el mapa, el orden de las sugerencias y qué
   paradas se intentan solas en segundo plano.
   LA MISMA CALLE Y EL MISMO SITIO (02-11-2026, prueba en el emulador y revisión): el móvil siempre contesta su mejor
   parecido, y con una calle que no conoce da otra. «Rúa Brétema Mariñeira 23, 15011 A Coruña» quedó guardada sola,
   en segundo plano, en «Rúa Brétema 31, 15179 Oleiros», a 8 km, y «Rúa Real 1» podía quedar en «Rúa Nova 1» del
   mismo CP. Ahora hace falta la misma calle (mismaCalle) y, con CP, el mismo CP o el mismo pueblo (mismoPueblo); en
   segundo plano solo se guarda el portal (RutaVM), y lo que no es esa calle sale aparte como «Otra calle».
   OTRA CALLE, SOLO SI SE PARECE (03-11-2026, prueba de la 2.4.5 en el emulador): con «Rúa Valtrenxo 41» (no existe)
   seguían saliendo calles cualquiera del mismo CP con el 41, todas «Otra calle», y tocar una cambiaba la calle escrita
   por otra. Ahora solo sale, al final, la que comparte el nombre (comparteNombre); elegirla pone SU dirección, nunca lo
   escrito con el punto de otra calle (alElegir); y la calle sin el portal llega al servidor como tal ("precision":
   "calle", geo «aprox»: cuerpoPunto y esAqui), no como la puerta. La misma regla que la web (lib/situar.js).
   UN SOLO SITIO QUE DECIDE (03-11-2026, el emulador y la revisión): por «Situar la parada» abierta desde Hoy, al elegir
   «Rúa Brétema, 15179 Oleiros · Otra calle» y pulsar «Es aquí» solo se mandaba el punto: la parada seguía siendo «Rúa
   Brétema Mariñeira 23, 15011 A Coruña» con el punto de Oleiros, a 8 km, y la guía llevaba a Oleiros. Ahora TODOS los
   caminos (la lista de la ficha, «Situar» desde la ficha, «Situar» desde Hoy y la cola sin conexión) pasan por alElegir
   con D, la dirección de la PARADA (nunca lo escrito en el buscador de «Situar»), sea cual sea la fuente de la
   sugerencia; «Es aquí» manda también la dirección nueva cuando cambia (esAqui), y la lista se ordena con dos textos:
   lo buscado para quitar y D para marcar (ordenar).
   EL PORTAL Y EL SITIO (03-11-2026, la revisión de la tanda anterior: nueve caminos más con el mismo caso grave, D con
   el punto de OTRA calle). La misma regla que la web (lib/situar.js), con cinco cambios: el portal se lee bien («Calle
   2 de Mayo 14» es el 14, no el 2; «Estrada AC-173 12», el 12: leer) y entero, con su sufijo (portalDe: «5B», «5BIS»,
   «12-14»); la misma calle es también el mismo sitio, con el CP y la población de la parada (mismoSitio: «Rúa Brétema
   23, 15011 A Coruña» no es «Rúa Brétema, 15179 Oleiros»); el mismo portal es el portal entero («5B» no es «5»); al
   juntar el mismo portal de varias fuentes, el CP y la población de la primera que los traiga (servidor, móvil, Photon:
   ordenar); y en la ficha, cambiar el texto borra el punto, venga de donde venga (FichaParada, loDelPunto).
   EL PORTAL, LAS CIFRAS Y EL MUNICIPIO (03-11-2026 por la mañana, la revisión de la tanda anterior; igual que la web):
   el portal vuelve a ser el PRIMERO que vale, como en el servidor, y lo de detrás, si es todo piso, es el piso («Calle
   Mayor 15 2 dcha» es el 15 con el piso «2 dcha»: portalEn, sinPiso); las cifras del nombre cuentan («Calle 1 de Mayo»
   no es «Calle 2 de Mayo»: palabrasCalle, mismaCalle); «O Burgo (Culleredo)» son dos pueblos (clavesPueblo); y nada
   de \b junto a una cifra, que en Android no es lo mismo que en el navegador (sinPiso).
   LOS ÚLTIMOS DETALLES DE LA LECTURA (K, 03-11-2026; igual que la web): los espacios raros, como uno normal
   (espacios); la marca del número detrás de la primera coma («, n.º4»: leer); el número que solo lleva delante el
   tipo de vía no es el portal de un piso («Calle 2 3 B» es el 3B: sinPiso); y el piso que ya va en la elegida, por
   palabras enteras (conPiso). Y la sugerencia elegida ya no se olvida al alejar el mapa, solo al arrastrarlo
   (sigueEnElla, alPararse).
   LA QUINTA TANDA (03-11-2026 a media mañana, el revisor y el emulador; igual que la web): el nombre de la capital con
   el CP de otro municipio es la provincia («15179 A Coruña» es Oleiros, no la ciudad), y «España» o «Galicia» nunca
   son un pueblo (cuentaComoPueblo); a Photon va lo buscado sin el piso (FichaParada, urlPhoton); el número del nombre
   seguido de una palabra no es el portal («Calle de las 3 Cruces 12» es el 12: portalEn); la letra suelta del portal no
   es piso (conPiso); el U+FEFF y el U+000B, como un espacio (espacios); y en segundo plano, el portal entero (aceptar).
   LA SEXTA TANDA (03-11-2026 a mediodía, el revisor y el verificador; igual que la web): el número del nombre, solo
   detrás de un artículo («Calle de las 3 Cruces 12» es el 12 y «Calle Mayor 5 Escala 2», otra vez el 5: portalEn); un
   sitio escrito que no es un pueblo («Asturias», «Galicia», «España») ya no es no decir nada (aceptar, mismoSitio:
   diceSitio); todas las provincias (PROVINCIAS, NO_SON_PUEBLO); y los bordes, como el trim() de la web (recorta).
   LA SÉPTIMA TANDA (03-11-2026 por la tarde, el revisor y el verificador; igual que la web): «X de <provincia>» es el
   pueblo entero («Alhama de Murcia» no es «Alhama de Granada»: clavePueblo); «No.» y las letras sueltas no son
   artículos («Calle Hidalgo No. 25 Col. Centro» es el 25: trasArticulo); y U+001C-U+001F y U+0085, como un espacio
   (espacios, conPiso). */

/** Lo que importa de un android.location.Address (GeoMovil lo copia aquí): el país en dos letras («ES»), la calle
 *  («Calle Real»), el número («1»), el CP, la población y la dirección escrita como la da el móvil. */
data class ResultadoMovil(
    val lat: Double, val lng: Double,
    val pais: String = "", val calle: String = "", val numero: String = "", val cp: String = "", val localidad: String = "",
    val texto: String = "",
)

object Situar {
    /** Con OTRO código postal y el mismo pueblo (el de la etiqueta puede venir mal leído, y la calle de un borde cae en
     *  el CP de al lado), a cuántos metros de la zona o de la base como mucho: un pueblo que se llama igual en otra
     *  provincia no es. La distancia sola ya no vale (02-11-2026): Oleiros está a 8 km del centro de A Coruña. */
    const val CERCA_CP_M = 15_000.0
    /** Sin código postal: lo que cae a más de esto de todo lo de la ruta (la zona, la base, las paradas) no es. */
    const val CERCA_SIN_CP_M = 50_000.0
    /** Dos sugerencias con el mismo número a menos de esto son el mismo sitio. */
    const val MISMO_SITIO_M = 25.0
    /** Paradas que se prueban con el móvil en segundo plano cada vez que se carga la ruta. */
    const val TOPE_FONDO = 8
    /** EL CORTE DE PHOTON DESPUÉS DE QUITAR (03-11-2026, igual que la web): se le piden hasta PIDE_MAPA y, ya quitadas
     *  las que no tocan (ordenar), se enseñan TOPE_MAPA. Cortadas antes, las calles cualquiera del mismo CP con ese
     *  número dejaban fuera a las buenas. */
    const val PIDE_MAPA = 10
    const val TOPE_MAPA = 5

    /** Sin situar para navegar: por entregar y sin punto en el mapa (geo «no», «zona» o «pendiente»). Una ya cerrada no
     *  se guía (el servidor no la deja), así que no cuenta. */
    fun sinSituar(p: Parada): Boolean = p.pendiente && !p.ubicada

    private fun valido(lat: Double?, lng: Double?): Punto? =
        if (lat != null && lng != null && lat.isFinite() && lng.isFinite() && lat in -90.0..90.0 && lng in -180.0..180.0 && (lat != 0.0 || lng != 0.0))
            Punto(lat, lng) else null

    /** El centro de la zona que encontró el servidor (el CP o el pueblo), si lo hay. */
    fun zona(p: Parada): Punto? = valido(p.zonaLat, p.zonaLng)

    private fun base(b: Base?): Punto? = valido(b?.lat, b?.lng)

    /** Dónde empieza el mapa de «Situar la parada» y con qué zoom: su propio punto si ya lo tiene (para corregirlo), la
     *  zona que encontró el servidor (el barrio del CP), la base, o la primera parada situada de la ruta. null si no hay
     *  nada: entonces, donde está el móvil. */
    fun centro(p: Parada, base: Base?, paradas: List<Parada>): Pair<Punto, Double>? {
        if (p.ubicada) valido(p.lat, p.lng)?.let { return it to 18.0 }
        zona(p)?.let { return it to 15.0 }
        base(base)?.let { return it to 14.0 }
        return paradas.firstNotNullOfOrNull { o -> if (o.id != p.id && o.ubicada) valido(o.lat, o.lng) else null }?.let { it to 14.0 }
    }

    /** Con qué se compara una respuesta con otro CP del mismo pueblo (a menos de 15 km): la zona de la parada y la base.
     *  La primera es también el centro de la búsqueda del móvil. */
    fun cerca(p: Parada, base: Base?): List<Punto> = listOfNotNull(zona(p), base(base))

    /** Además de eso, las paradas ya situadas de la ruta (como mucho 30): sin CP, lo que caiga a más de 50 km de todo
     *  ello no es. */
    fun dondeReparte(p: Parada, base: Base?, paradas: List<Parada>): List<Punto> =
        cerca(p, base) + paradas.asSequence().filter { it.id != p.id && it.ubicada }.mapNotNull { valido(it.lat, it.lng) }.take(30).toList()

    // El piso, la puerta, la escalera… (como reparto._PISO_RE del servidor): los buscadores no lo entienden. «der», «of»
    // e «int» solo con su punto: sin él son de calle («An der Alster», «Avenue of the Americas»), igual que en la web.
    // El piso pegado a su letra («1ºB», «3ºA», «2ºIzq», lo normal en las etiquetas) también (02-11-2026, revisión A5):
    // antes solo valía con un espacio («1º B»), y «1ºB» se buscaba con él y se perdía al elegir una sugerencia. Sin \b
    // detrás de «1er», «2nd»… (J, 03-11-2026, igual que la web): lo de JavaScript. Detrás de «º», todas las letras
    // («3ºDerecha»), y «OG» suelto: desde el 03-11-2026 la web lo lee igual (K1).
    private val PISO = Regex(
        "(?iu)(?:^|[\\s,])(?:\\d{1,3}\\s*[ºª°]\\p{L}*|\\d+(?:er|e|ème|st|nd|rd|th)(?![A-Za-z0-9_])|\\d+\\.\\s*(?:og|stock|etage)|piso|planta|pta\\.?|puerta|esc\\.?|escalera|bajo|bj\\.?|entlo\\.?|" +
            "entresuelo|[áa]tico|s[óo]tano|izq\\.?|izda\\.?|dcha\\.?|der\\.|dcho\\.?|ctro\\.?|apto\\.?|apt\\.?|apartamento|apartment|appt\\.?|depto\\.?|dpto\\.?|" +
            "departamento|int\\.|interior|bloque|blq\\.?|torre|unit|suite|ste\\.?|floor|fl\\.?|flat|local|oficina|of\\.|room|rm\\.?|[ée]tage|[ée]tg\\.?|" +
            "b[âa]t\\.?|b[âa]timent|stock|og|wohnung|whg\\.?|andar|sala|edif\\.?|edificio|portal)(?=[\\s,.:]|$)")
    private val CP_EN_TROZO = Regex("\\d{4,5}")
    /** Los trozos de una dirección: por comas, puntos y comas o « - ». */
    private val TROZOS = Regex("\\s*[,;]\\s*|\\s+-\\s+")
    /** LOS ESPACIOS RAROS (K2, 03-11-2026; igual que la web): el duro (U+00A0), el de las cifras (U+2007), el fino
     *  (U+202F), los demás separadores (\p{Z}) y el tabulador pasan a un espacio normal al empezar a leer una dirección:
     *  `\s` no es lo mismo en Android (ICU), en el JDK y en el navegador. «Calle Mayor 5 2 B» con el duro entre el 5 y
     *  el 2 es «Calle Mayor 5 2 B». H2 (03-11-2026): también el U+FEFF (para JavaScript es `\s`, para Android no) y el
     *  U+000B (`\s` en el JDK y en el navegador, no en Android). C (03-11-2026, igual que la web): también los de control
     *  U+001C-U+001F (el trim() de Kotlin los quita y el de la web no) y el U+0085 (Java lo toma por un fin de línea en
     *  «$» y en «.», y el navegador no). */
    private val ESPACIOS_RAROS = Regex("[\\p{Z}\\t\\u000B\\u001C-\\u001F\\u0085\\uFEFF]")
    private fun espacios(s: String): String = s.replace(ESPACIOS_RAROS, " ")
    /** Sin los espacios de los lados, como el trim() de la web (H2, 03-11-2026): también el U+FEFF, que el de Kotlin deja
     *  («\uFEFFRúa Real 5» se quedaba así al elegir), y no los de control U+001C-U+001F, que la web deja. Y lo que se
     *  diga en `tambien` (C, 03-11-2026: «,.-» en conPiso, como el recorta de la web). */
    private fun recorta(s: String, tambien: String = ""): String =
        s.trim { (it.isWhitespace() && it !in '\u001C'..'\u001F') || it == '\uFEFF' || it in tambien }

    /** Un trozo de la dirección sin el piso. En el primero (la calle) solo cuenta lo que va DETRÁS del número: «Puerta
     *  del Sol 1», «Calle de la Torre 5» o «Portal de Belén 3» son calles; «Calle Real 1 bajo» lleva el piso. En los
     *  demás, el piso va solo («2º B», «Portal 2»), pero no detrás de un CP («29740 Torre del Mar» es un pueblo).
     *  F (03-11-2026, igual que la web): en la calle, lo de detrás del portal (portalEn), si es todo piso (esPisoCola),
     *  también es el piso: «Calle Mayor 15 2 dcha» → «Calle Mayor 15»; «Carrer de Sants 5 2n 1a» → «Carrer de Sants 5».
     *  T (03-11-2026, igual que la web): los lados, con recorta; el trim() de Kotlin quita también U+001C-U+001F. */
    private fun sinPiso(trozo: String, primero: Boolean, conLetra: Boolean = false): String {
        var s = recorta(trozo)
        PISO.findAll(s).firstOrNull { m ->
            val antes = s.substring(0, m.range.first)
            if (primero) antes.any { it.isDigit() } else !CP_EN_TROZO.containsMatchIn(antes)
        }?.let { s = s.substring(0, it.range.first).trim(' ', ',', '.', '-') }
        if (primero) portalEn(s)?.let { p -> if (esPisoCola(s.substring(p.fin))) return recorta(s.substring(0, p.fin)) }
        // K4 (03-11-2026, igual que la web): en la calle, el que solo lleva delante el tipo de vía es del nombre, no el
        // portal de un piso: «Calle 2 3 B» es el 3B (la letra, con conLetra), no el 2 con el piso «3 B».
        val np = NUMERO_Y_PISO.find(s)
        if (np != null && !(primero && soloTipo(s.substring(0, np.range.first + np.groupValues[1].length))))
            s = s.substring(0, np.range.first) + np.groupValues[1] + np.groupValues[2]
        s = recorta(s)
        return if (conLetra) s else recorta(s.replace(NUMERO_Y_LETRA, "$1$2"))
    }
    // J) SIN \b DELANTE DEL NÚMERO (03-11-2026, el verificador; igual que la web): para \b, «º» es letra en Android y en
    // el JDK 17 y no en el navegador, y «Avenida Primero de Mayo, n.º4 2 B» dejaba de piso «B» aquí y «2 B» en la web.
    // Delante, el principio o lo que no sea letra ni cifra; «º» y «ª» no cuentan (como en numeroEn).
    private val NUMERO_Y_PISO = Regex("(^|[^\\p{L}\\p{N}]|[ºª])(\\d{1,4})\\s+\\d{1,2}\\s*[A-Ha-h]$")   // «5 2 B» → «5»
    private val NUMERO_Y_LETRA = Regex("(^|[^\\p{L}\\p{N}]|[ºª])(\\d{1,4})\\s+[A-Ha-h]$")              // «5 B» → «5»

    /** «Rúa Real 2, 1º B» → «Rúa Real 2»; «Calle Mayor 5 2 B, Madrid» → «Calle Mayor 5, Madrid». Cada trozo (por comas) se
     *  corta donde empieza el piso, y un trozo que solo era piso desaparece: como reparto.direccion_para_buscar, pero
     *  sin comerse las calles que llevan esas palabras (sinPiso). */
    fun paraBuscar(direccion: String): String = trozosSinPiso(direccion).map { it.second }.filter { it.isNotEmpty() }.joinToString(", ")

    /** Como paraBuscar, pero con la letra suelta detrás del número (03-11-2026): «Calle Real 5 B» para buscar es la
     *  puerta y se quita; para el portal entero es «5B» (portalDe). */
    private fun conLaLetra(direccion: String): String =
        trozosSinPiso(direccion, conLetra = true).map { it.second }.filter { it.isNotEmpty() }.joinToString(", ")

    /** Los trozos que no están vacíos, cada uno con lo que queda sin el piso; la calle es el primero de ellos, como en la
     *  web (03-11-2026: con «, Calle Mayor 15 2 dcha» la calle era el trozo vacío del principio y el piso quedaba «dcha»).
     *  Recortados con recorta, como en la web (T, 03-11-2026). */
    private fun trozosSinPiso(direccion: String, conLetra: Boolean = false): List<Pair<String, String>> =
        espacios(direccion).split(TROZOS).map { recorta(it) }.filter { it.isNotEmpty() }.mapIndexed { i, t -> t to sinPiso(t, primero = i == 0, conLetra = conLetra) }

    /** El piso de lo escrito («2º B», «bajo») en la dirección elegida de un buscador, que nunca lo trae:
     *  «Rúa Real 1, 2º B, 15003 A Coruña» + «Calle Real, 1, 15003 A Coruña» → «Calle Real, 1, 15003 A Coruña, 2º B».
     *  G2 (03-11-2026, igual que la web): la letra suelta detrás del número es del portal, no un piso («Calle Real 3 B» +
     *  «Calle Real 3B, 15003 A Coruña» ya no deja «…, B» detrás). */
    fun conPiso(escrita: String, elegida: String): String {
        val pisos = trozosSinPiso(escrita, conLetra = true).mapNotNull { (t, limpio) ->
            when {
                limpio == t -> null
                limpio.isEmpty() -> t
                // Sin los espacios (también el que no se parte), comas, puntos ni guiones de los lados, como en la web: con
                // recorta (C, 03-11-2026), no con el isWhitespace de Kotlin, que quita también U+001C-U+001F.
                t.startsWith(limpio) -> recorta(t.substring(limpio.length), ",.-").ifEmpty { null }
                else -> null
            }
        }
        // Lo que ya va en la elegida no se repite: sus palabras enteras, en orden (K5, 03-11-2026, igual que la web). El
        // «2» de «Calle Mayor 15 2» no va en el 28013 de «Calle Mayor 15, 28013 Madrid».
        val dicho = " ${palabrasDe(elegida).joinToString(" ")} "
        return (listOf(recorta(elegida)) + pisos.filter { " ${palabrasDe(it).joinToString(" ")} " !in dicho }).joinToString(", ")
    }

    /** Las palabras de un texto, sin acentos y en minúsculas: «2º B» → [2º, b] (K5). */
    private fun palabrasDe(s: String): List<String> = Calle.sinAcentos(s).split(NO_LETRA).filter { it.isNotEmpty() }

    /** El número del portal de una dirección, solo las cifras: «Rúa Real, 12-14» → «12», «Rúa Real 2B» → «2»,
     *  «12 rue de la Paix» → «12». Un CP («Praza de María Pita, 15001 A Coruña») no es un portal: como mucho 4 cifras.
     *  Ni una cifra mal leída dentro de una palabra (02-11-2026): «R/ Desiderio Vare1a 1» → «1», no «1» de «Vare1a»;
     *  «Lugar O Barreir0 6» → «6», no «0». Desde el 03-11-2026, el primero que vale de la calle (leer, portalEn):
     *  «Calle 2 de Mayo 14» → «14», no «2»; «Estrada AC-173 12» → «12», no «173»; «Calle Mayor 15 2 dcha» → «15», no «2».
     *  Con su letra, «bis» o rango: portalDe. */
    fun numeroDe(direccion: String): String = leer(paraBuscar(direccion)).cifras

    /** EL PORTAL ENTERO (03-11-2026, igual que la web): sus cifras con el sufijo, normalizado: «Calle Real 5B», «5 B» o
     *  «5-B» → «5B»; «Rúa Real 5 bis» → «5BIS»; «Calle Real 12-14» → «12-14». Con él se sabe si una sugerencia es EL
     *  MISMO portal (alElegir, 3a): «5B» no es «5». Sin portal, "". */
    fun portalDe(direccion: String): String = leer(conLaLetra(direccion)).entero

    /** La consulta para el geocodificador del móvil: la dirección sin piso, y el CP, la población y el país si no están
     *  ya escritos en ella. */
    fun consulta(direccion: String, cp: String, localidad: String, nombrePais: String): String {
        val d = paraBuscar(direccion).ifBlank { espacios(direccion).trim() }
        val dichos = mutableListOf(Calle.sinAcentos(d))
        val extra = listOf(cp, localidad, nombrePais).map { it.trim() }.filter { x ->
            x.isNotEmpty() && dichos.none { Calle.sinAcentos(x) in it }.also { if (it) dichos += Calle.sinAcentos(x) }
        }
        return (listOf(d) + extra).filter { it.isNotBlank() }.joinToString(", ")
    }

    private fun soloCp(cp: String) = cp.uppercase().filter { it.isLetterOrDigit() }

    // ── LA MISMA CALLE Y EL MISMO SITIO (02-11-2026, prueba en el emulador y revisión A3) ─────────────────────────────
    // Como el geocodificador del servidor (geocodificador.nucleo y parecido): el nombre de la calle sin el tipo de vía,
    // los artículos ni los acentos («Pza. da Insuela» y «Praza Insuela» son «insuela»: calle, rúa y carrer valen igual),
    // con un carácter de tolerancia para el OCR («Montccelo», «Vare1a», «Lug0»); y el pueblo, sin la provincia que las
    // etiquetas añaden detrás («Oleiros, A Coruña» es Oleiros).

    /** Los tipos de vía que van delante del nombre (los de geocodificador.TIPO_FAMILIA y los de fuera más corrientes). */
    private val TIPOS = setOf(
        "calle", "c", "cl", "cll", "rua", "r", "carrer", "cr", "kalea", "k", "rueiro", "ruela", "carrero", "callejon",
        "calexa", "calleja", "avenida", "avda", "av", "avd", "avinguda", "etorbidea", "hiribidea", "plaza", "praza", "pza",
        "pz", "pl", "placa", "pca", "pr", "enparantza", "pracina", "plazuela", "plazoleta", "placeta", "paseo", "po",
        "passeig", "pg", "pasealekua", "ronda", "rda", "rolda", "travesia", "trav", "trv", "travessera", "tv", "travesa",
        "camino", "cmno", "cno", "cami", "bidea", "carretera", "ctra", "estrada", "errepidea", "lugar", "lg", "lug",
        "aldea", "glorieta", "gta", "urbanizacion", "urb", "barrio", "bo", "bairro", "auzoa", "poligono", "pol", "costa",
        "cuesta", "costanilla", "alameda", "parque", "bulevar", "boulevard", "pasaje", "pasaxe", "passatge", "muelle",
        "peirao", "rambla", "explanada", "via", "sector", "senda", "vereda", "subida", "baixada", "bajada", "calzada", "cc",
        "pasadizo", "rue", "avenue", "ave", "street", "st", "road", "rd", "strasse", "str", "viale", "piazza", "corso",
        "vicolo", "largo", "travessa", "praca", "chemin", "impasse", "allee", "quai",
    )
    /** Los que también son el nombre de una calle («Rúa da Estrada 24», «La Rambla 98», en el laboratorio; 03-11-2026,
     *  igual que la web): detrás de ellos el número es el portal; detrás de los demás, del nombre («Calle 2»: soloTipo). */
    private val TIPOS_NOMBRE = setOf("estrada", "rambla", "costa", "pasaxe", "pasaje", "alameda")
    /** Los que van detrás: en euskera («Errosario Santua kalea»), en alemán o en inglés («Main Street»). */
    private val TIPOS_DETRAS = setOf("kalea", "k", "etorbidea", "hiribidea", "plaza", "enparantza", "pasealekua", "bidea",
        "errepidea", "zumarkalea", "auzoa", "strasse", "str", "weg", "platz", "allee", "gasse", "street", "st", "road", "rd",
        "avenue", "ave", "lane", "ln", "drive", "boulevard", "blvd")
    /** Artículos y preposiciones (geocodificador.PREPS y los de fuera más corrientes). */
    private val ARTICULOS = setOf("de", "del", "la", "el", "los", "las", "da", "do", "das", "dos", "a", "o", "os", "as",
        "d", "l", "dels", "les", "en", "na", "nas", "no", "nos", "y", "e", "i", "al", "ao", "aos", "of", "the", "der", "die",
        "den", "des", "du", "le", "di", "della", "dei", "van", "von", "am", "an", "im", "zum", "zur")
    /** Las provincias, las comunidades y el país que no son el nombre de ningún pueblo (B, 03-11-2026; igual que la
     *  web): nunca cuentan. P (03-11-2026): todas, también en las otras lenguas; son también de PROVINCIAS. */
    private val NO_SON_PUEBLO = setOf("alava", "araba", "asturias", "bizkaia", "vizcaya", "cantabria", "gipuzkoa",
        "guipuzcoa", "navarra", "nafarroa", "la rioja", "rioja", "illes balears", "islas baleares", "baleares", "galicia",
        "euskadi", "pais vasco", "catalunya", "cataluna", "andalucia", "aragon", "castilla y leon", "castilla la mancha",
        "extremadura", "comunidad valenciana", "comunitat valenciana", "region de murcia", "comunidad de madrid", "canarias",
        "principado de asturias", "espana", "spain")
    /** Las provincias (y el país) que las etiquetas ponen detrás del pueblo (geocodificador.PROVINCIAS): como pueblo solo
     *  cuentan si no hay otro («A Coruña» sola es la ciudad) y, desde el 03-11-2026, con el CP de la capital o sin CP
     *  (cuentaComoPueblo). P (03-11-2026, igual que la web): todas las que se llaman como su capital, también en las
     *  otras lenguas, y las de NO_SON_PUEBLO; las de varias palabras, como las de una (esProvincia, clavePueblo). */
    private val PROVINCIAS = NO_SON_PUEBLO + setOf("a coruna", "coruna", "la coruna", "albacete", "alicante", "alacant",
        "almeria", "avila", "badajoz", "barcelona", "burgos", "caceres", "cadiz", "castellon", "castello",
        "castellon de la plana", "ciudad real", "cordoba", "cuenca", "girona", "gerona", "granada", "guadalajara", "huelva",
        "huesca", "jaen", "las palmas", "leon", "lleida", "lerida", "lugo", "madrid", "malaga", "murcia", "ourense", "orense",
        "palencia", "pontevedra", "salamanca", "santa cruz de tenerife", "segovia", "sevilla", "soria", "tarragona", "teruel",
        "toledo", "valencia", "valladolid", "zamora", "zaragoza", "ceuta", "melilla")
    /** Lo que se antepone al nombre y a veces falta («Doctor Fleming» y «Fleming», «San Andrés» y «Andrés»). */
    private val TITULOS = setOf("doctor", "dr", "doutor", "pintor", "poeta", "escritor", "escultor", "musico", "maestro",
        "mestre", "profesor", "alcalde", "general", "xeneral", "capitan", "comandante", "almirante", "coronel", "teniente",
        "sargento", "san", "santa", "santo", "sant", "padre", "madre", "sor", "fray", "frei", "beato", "beata", "virgen",
        "virxe", "nuestra", "nosa", "senora", "rey", "rei", "reina", "raina", "infanta", "infante", "duque", "duquesa",
        "conde", "condesa", "marques", "marquesa", "presidente", "cardenal", "obispo", "bispo", "arzobispo", "arcebispo",
        "don", "dona", "ingeniero", "arquitecto", "periodista", "compositor")
    /** Una palabra de piso, puerta o escalera (geocodificador.PISO_TOK), ya sin acentos y con «º» como «o». */
    private val PISO_PALABRA = Regex("^(?:\\d{1,2}o?[a-z]?|\\d{1,2}(?:o|a|n|r|t|er|na|ra|ta|do|ro|to)|bajo|bajos|bj|baixo|" +
        "baixos|entlo|entresuelo|entreplanta|entl|pral|principal|atico|atic|sotano|semisotano|local|izq|izda|izquierda|" +
        "dcha|dcho|derecha|dta|dereita|esq|esquerda|centro|ctro|esc|escalera|escaleira|portal|pta|puerta|porta|piso|planta|" +
        "bloque|blq|bl|edificio|edif|behea|ezk|esk|eskuma|ezkerra|eskuina|bis|dup|duplicado|[a-h])$")
    private val OCR = mapOf('0' to 'o', '1' to 'l', '5' to 's', '8' to 'b', '6' to 'g', '4' to 'a', '3' to 'e')
    private val NO_LETRA = Regex("[^\\p{L}\\p{N}]+")

    // ── EL PORTAL, BIEN LEÍDO (03-11-2026, la revisión; igual que la web: lib/situar.js) ─────────────────────────────
    // Se tomaba el PRIMER número suelto: «Calle 2 de Mayo 14» daba el portal 2 y la calle «Calle», y «Estrada AC-173
    // 12», el 173. Ahora se mira el primer trozo (hasta la primera coma) y, si no trae ninguno que valga, el que va justo
    // después de la primera coma («Calle Real, 5, 2º» → 5). Valen los de 1 a 4 cifras sueltos (no pegados por delante a
    // una letra ni a otra cifra: «Vare1a 1» → 1, «Barreir0 6» → 6) o pegados a «nº», «n.º» o «no» («nº4», «no109»); no
    // valen el de « de <palabra>» («2 de Mayo», «18 de Julio»), el de una carretera (letras, guion y cifras: «AC-173»,
    // «N-550», «A-6»), un piso («2º», «3ª») ni un CP (5 cifras). Se pasó a tomar el ÚLTIMO que vale del trozo, y con un
    // piso escrito sin «º» el piso pasaba a ser el portal («Calle Mayor 15 2 dcha» daba el 2; «Carrer de Sants 5 2n 1a»,
    // el 1A). Desde la mañana del 03-11-2026, como el servidor (geocodificador.leer_etiqueta): el PRIMERO que vale,
    // saltando el que solo lleva delante el tipo de vía («Calle 2 3» → 3; «Calle 2» no tiene), y la calle, todo lo de
    // delante (portalEn); si el único va al principio, es el formato de fuera («12 rue de Rivoli»). Con su sufijo: una
    // letra («5B», «5 B», «5-B»), «bis» («5 bis») o un rango («12-14»).

    /** Un portal leído en un trozo: dónde empieza, dónde acaba con su sufijo, sus cifras y el portal entero («5B»). */
    private class Num(val inicio: Int, val fin: Int, val cifras: String, val entero: String)

    /** Lo leído de una dirección ya sin el piso: la calle, el portal (sus cifras y entero) y dónde acaba (lo de detrás es
     *  el CP, el pueblo…: trasLaCalle). Sin portal, `fin` es -1. */
    private class Lectura(val calle: String, val cifras: String = "", val entero: String = "", val fin: Int = -1)

    private fun cifra(c: Char) = c in '0'..'9'
    private val DE_PALABRA = Regex("^\\s+[dD][eE]\\s+\\p{L}")      // «2 de Mayo», «18 de Julio»: es el nombre
    private val PISO_DETRAS = Regex("^\\s*[ºª°]")                    // «2º», «3ª»: el piso
    private val RANGO = Regex("^-(\\d{1,4})(?![\\dºª°])")           // «12-14»
    private val BIS = Regex("^[\\s-]?(?i:bis)(?!\\p{L})")           // «5 bis», «5bis», «5-bis»
    private val LETRA_PEGADA = Regex("^-?(\\p{L})(?!\\p{L})")       // «5B», «5-B»
    private val LETRA_SUELTA = Regex("^\\s+(\\p{L})\\s*$")          // «5 B», al final del trozo

    /** El portal que empieza en `i` (una cifra que no va detrás de otra) del trozo `t`, si vale; si no, null. */
    private fun numeroEn(t: String, i: Int): Num? {
        var j = i
        while (j < t.length && cifra(t[j])) j++
        if (j - i !in 1..4) return null                                   // un CP (5 cifras) no es un portal
        if (i > 0) {
            val c = t[i - 1]
            // Pegado por delante a una letra no («Vare1a 1»), salvo a «nº» o «n.º» (la «º» y la «ª» no cuentan, como
            // hasta ahora) y a «no» («no109», con la «n» al principio de una palabra).
            val trasNo = (c == 'o' || c == 'O') && i >= 2 && (t[i - 2] == 'n' || t[i - 2] == 'N') && (i < 3 || !t[i - 3].isLetterOrDigit())
            if (cifra(c) || (c.isLetter() && c != 'º' && c != 'ª' && !trasNo)) return null
            if (c == '-' && i >= 2 && t[i - 2].isLetter()) return null       // una carretera: «AC-173», «N-550», «A-6»
        }
        val resto = t.substring(j)
        if (PISO_DETRAS.containsMatchIn(resto) || DE_PALABRA.containsMatchIn(resto)) return null
        val cifras = t.substring(i, j)
        RANGO.find(resto)?.let { return Num(i, j + it.range.last + 1, cifras, "$cifras-${it.groupValues[1]}") }
        BIS.find(resto)?.let { return Num(i, j + it.range.last + 1, cifras, "${cifras}BIS") }
        (LETRA_PEGADA.find(resto) ?: LETRA_SUELTA.find(resto))?.let { return Num(i, j + it.range.last + 1, cifras, cifras + it.groupValues[1].uppercase()) }
        if (resto.firstOrNull()?.isLetter() == true) return null           // «21st», «1er», «5Bajo»: no es un portal
        return Num(i, j, cifras, cifras)
    }

    /** Los portales que valen de un trozo, en orden. */
    private fun numerosEn(t: String): List<Num> {
        val out = ArrayList<Num>()
        var i = 0
        while (i < t.length) {
            if (!cifra(t[i])) { i++; continue }
            val n = numeroEn(t, i)
            if (n != null) { out += n; i = n.fin } else while (i < t.length && cifra(t[i])) i++
        }
        return out
    }

    /** La calle sin «Nº», «s/n» ni la coma, el punto o el guion del final. */
    private fun limpia(calle: String): String = calle.replace(MARCA_NUMERO, "").trim(' ', ',', '.', '-')

    /** ¿Lleva delante solo el tipo de vía («Calle », «C/ », «Avda. »)? Entonces el número es del nombre («Calle 2»), salvo
     *  con los que también son un nombre («ESTRADA 24», «Rambla 98»: TIPOS_NOMBRE). */
    private fun soloTipo(antes: String): Boolean {
        val w = plano(antes).split(NO_LETRA).filter { it.isNotEmpty() }
        return w.size == 1 && w[0] in TIPOS && w[0] !in TIPOS_NOMBRE
    }

    /** El portal de la calle (el primer trozo; 03-11-2026, igual que la web): el PRIMERO que vale con el nombre
     *  delante, no solo el tipo de vía («Calle 2 3» → 3; «Calle 2» no tiene); si no hay y el primero va al principio,
     *  el formato de fuera («12 rue de Rivoli» → «rue de Rivoli»). null si no hay.
     *  F3 (03-11-2026, igual que la web): el número es del nombre y se salta SOLO detrás de un artículo con más nombre
     *  delante (trasArticulo) y seguido de una palabra que no es de piso (delNombre): «Calle de las 3 Cruces 12» → 12, y
     *  «Calle de las 3 Cruces, 28013 Madrid» no tiene. Con F2 bastaban cualquier palabra y otro número detrás, y «Calle
     *  Mayor 5 Escala 2» daba el 2; ahora el 5, como «Calle Real 5 y 7» o «Parcela 10 Nave 4». Los lados, con recorta (T). */
    private fun portalEn(primero: String): Lectura? {
        val ns = numerosEn(primero)
        for (n in ns) {
            val antes = primero.substring(0, n.inicio)
            if (recorta(antes).isEmpty() || soloTipo(antes) || (trasArticulo(antes) && delNombre(primero.substring(n.fin) + " "))) continue
            return Lectura(limpia(antes), n.cifras, n.entero, n.fin)
        }
        val n = ns.firstOrNull() ?: return null
        // El único va al principio: el formato de fuera. Solo él, no.
        return if (recorta(primero.substring(0, n.inicio)).isEmpty() && recorta(primero.substring(n.fin)).isNotEmpty())
            Lectura(limpia(primero.substring(n.fin)), n.cifras, n.entero, primero.length) else null
    }

    /** F3: ¿acaba lo de delante del número en un artículo o una preposición (ARTICULOS) con alguna palabra más delante?
     *  «Calle de las », «Rúa de », sí; «Calle Mayor », «Rambla » o «De », no. Las palabras, como en la web: sin tildes
     *  (sinTildes) y solo de a-z y 0-9 («Nº» es «n»).
     *  F4 (03-11-2026, igual que la web): solo los de dos letras o más, y no «no», que es la marca del número («Calle
     *  Hidalgo No. 25 Col. Centro» es el 25); la letra suelta es del nombre («Avenida Juan Carlos I 12 Urb. Los Pinos» es
     *  el 12; «Calle A 5 Polígono Industrial», el 5). Sin los espacios de ancho cero, para que «d\u200Be» siga siendo «de». */
    private fun trasArticulo(antes: String): Boolean {
        val w = sinTildes(antes.replace(ANCHO_CERO, "")).split(NO_AZ).filter { it.isNotEmpty() }
        val u = w.lastOrNull() ?: return false
        return w.size > 1 && u.length > 1 && u != "no" && u in ARTICULOS
    }
    private val NO_AZ = Regex("[^a-z0-9]+")
    private val ANCHO_CERO = Regex("[\\u200B-\\u200D\\u2060\\uFEFF]")
    /** Como sinTildes de la web: NFD, sin los acentos de U+0300 a U+036F y en minúsculas (Calle.sinAcentos quita todas
     *  las marcas, y plano, con NFKD, hace de «º» una «o»). */
    private fun sinTildes(s: String): String = Normalizer.normalize(s, Normalizer.Form.NFD).replace(TILDES, "").lowercase()
    private val TILDES = Regex("[\\u0300-\\u036F]")

    /** F2: ¿empieza lo de detrás del número por una palabra de 3 letras o más que no es de piso (esPisoCola)? «Cruces 12»
     *  sí; «2 dcha», «y 7» o «Nave 4», no. La palabra entera, hasta lo que la separa en esPisoCola (un espacio, «.», «,»,
     *  «/» o «-»): «Apt\u200Bo 4», con un espacio de ancho cero dentro, no es «Apt» (03-11-2026, la puerta de regresión:
     *  «ESTRADA N-550 núm. 14A Apt\u200Bo 4» daba el 4). F3: portalEn le añade un espacio al final, para que valga
     *  también la del final del trozo («Calle de las 3 Cruces, 28013 Madrid»). */
    private fun delNombre(resto: String): Boolean = PALABRA_DETRAS.find(resto)?.let { !esPisoCola(it.groupValues[1]) } == true
    private val PALABRA_DETRAS = Regex("^\\s+(\\p{L}{3,})(?=[\\s.,\\/-])")

    /** La calle y el portal de una dirección ya sin el piso (paraBuscar): el del primer trozo (portalEn) y, si no hay,
     *  el que va justo detrás de la primera coma. */
    private fun leer(direccion: String): Lectura {
        val d = espacios(direccion)
        val coma = TROZOS.find(d)
        val primero = if (coma == null) d else d.substring(0, coma.range.first)
        portalEn(primero)?.let { return it }
        if (coma != null) {
            val desde = coma.range.last + 1
            val segundo = d.substring(desde, TROZOS.find(d, desde)?.range?.first ?: d.length)
            // K3 (03-11-2026, igual que la web): con su marca delante, como en el primer trozo («, n.º4 2 B», «, Nº 5»).
            val i = MARCA_DELANTE.find(segundo)?.value?.length ?: 0
            val n = if (i < segundo.length && cifra(segundo[i])) numeroEn(segundo, i) else null
            if (n != null) return Lectura(limpia(primero), n.cifras, n.entero, desde + n.fin)
        }
        return Lectura(limpia(primero))
    }
    /** La marca del número delante de él, detrás de la primera coma: «nº», «n.º», «no», «núm.» o «número» (K3). */
    private val MARCA_DELANTE = Regex("(?iu)^\\s*(?:n[uú]mero|n[uú]m\\.?|n\\.?\\s*[º°o]\\.?)?\\s*")
    /** «Nº», «N.º», «Núm.» o «s/n» al final del nombre (delante del número, o sin él). */
    private val MARCA_NUMERO = Regex("(?iu)[\\s,]+(?:n\\.?\\s*[º°o]?\\.?|nro\\.?|n[uú]m\\.?|n[uú]mero|s\\.?\\s*/?\\s*n\\.?)\\s*$")

    /** Sin acentos, en minúsculas y con «º» como «o» (NFKD): para comparar nombres. */
    private fun plano(s: String): String =
        Normalizer.normalize(s, Normalizer.Form.NFKD).replace(Regex("\\p{M}+"), "").lowercase().replace("ß", "ss")

    /** El nombre de la calle de una dirección, sin el número ni lo que va detrás: «Trav. de Meicende Nº 50, 15140,
     *  Arteixo» → «Trav. de Meicende»; «12 rue de Rivoli, Paris» → «rue de Rivoli»; sin número, el primer trozo. Desde
     *  el 03-11-2026, todo lo de delante del portal (leer): «Calle 2 de Mayo 14» → «Calle 2 de Mayo»; «Estrada AC-173
     *  12» → «Estrada AC-173». Sin nada que buscar, lo escrito, recortado como en la web (T, 03-11-2026: recorta y, como
     *  el `||` de la web, solo si no queda nada). */
    fun calleDe(direccion: String): String = leer(paraBuscar(direccion).ifEmpty { recorta(direccion) }).calle

    /** Las palabras que dicen qué calle es, sin el tipo de vía, los artículos ni los acentos: «P.º Manuel Núñez» →
     *  [manuel, nunez]; «Trav. de Meicende» → [meicende]; «Errosario Santua kalea» → [errosario, santua]. Las cifras se
     *  quedan (G, 03-11-2026, igual que la web): «Calle 1 de Mayo» → [1, mayo]; solo se quitan las letras sueltas. */
    fun palabrasCalle(nombre: String): List<String> {
        // «P.º» y «B.º» (paseo, barrio) son una palabra: sin esto, «p» y «o» por separado. Sin \b (J): lo de JavaScript.
        val s = plano(espacios(nombre)).replace(Regex("^\\s*([pb])\\s*\\.?\\s*o(?![A-Za-z0-9_])"), "$1o").replace(Regex("\\([^)]*\\)"), " ")
        var t = s.split(NO_LETRA).filter { it.isNotEmpty() }
        while (t.size > 1 && t.first() in TIPOS) t = t.drop(1)
        while (t.size > 1 && t.last() in TIPOS_DETRAS) t = t.dropLast(1)
        return t.filter { it !in ARTICULOS && (it.length > 1 || cifra(it[0])) }.ifEmpty { t }
    }

    /** Las cifras del nombre de una calle (de palabrasCalle): «Calle 2 de Mayo» → {2}. */
    private fun cifrasDe(palabras: List<String>): Set<String> = palabras.filter { w -> w.all { cifra(it) } }.toSet()

    /** Una palabra con las confusiones del OCR deshechas (geocodificador.des_ocr): las cifras entre letras («Lug0»,
     *  «Vare1a») y «rn» por «m» («Rarnbla»). Es una forma más de comparar, nunca en lugar de lo leído. */
    private fun desOcr(w: String): String =
        (if (w.any { it.isLetter() } && w.any { it.isDigit() }) w.map { OCR[it] ?: it }.joinToString("") else w).replace("rn", "m")

    /** ¿Como mucho un carácter cambiado, de más, de menos o dos cambiados de sitio? */
    private fun unCaracter(a: String, b: String): Boolean {
        if (a == b) return true
        if (kotlin.math.abs(a.length - b.length) > 1) return false
        var i = 0
        while (i < a.length && i < b.length && a[i] == b[i]) i++
        return when {
            a.length > b.length -> a.substring(i + 1) == b.substring(i)
            a.length < b.length -> a.substring(i) == b.substring(i + 1)
            else -> a.substring(i + 1) == b.substring(i + 1) ||
                (i + 1 < a.length && a[i] == b[i + 1] && a[i + 1] == b[i] && a.substring(i + 2) == b.substring(i + 2))
        }
    }

    /** ¿Es la misma palabra? Igual, igual sin las confusiones del OCR, o con un carácter de diferencia si las dos tienen
     *  6 letras o más («Montccelo» y «Montecelo» sí; «Pinar» y «Pilar», no: son dos calles). En un nombre de tres
     *  palabras o más (`largo`), también con 4 o 5 («José Luls Estrada» es «José Luis Estrada»). */
    private fun parecidas(a: String, b: String, largo: Boolean = false): Boolean {
        if (a == b) return true
        val oa = desOcr(a)
        val ob = desOcr(b)
        if (oa == ob) return true
        return minOf(a.length, b.length) >= (if (largo) 4 else 6) && (unCaracter(a, b) || unCaracter(oa, ob))
    }

    /** ¿Es la misma calle? La palabra distintiva (la última del nombre: «Pita», «Meicende», «Bazán», «Mariñeira») tiene
     *  que estar en las dos, y las demás palabras de la más corta, en la otra: «Calle Emilia Pardo Bazán» y «Rúa Pardo
     *  Bazán» sí; «Rúa Brétema Mariñeira» y «Rúa Brétema» no (le falta «Mariñeira»), ni «Rúa Real» y «Rúa Nova», ni
     *  «Rúa Real» y «Rúa Real Alta». Una sola palabra dentro de un nombre más largo, solo si lo que sobra son títulos
     *  («Fleming» y «Doctor Fleming»): «Rúa da Cruz» no es «Rúa Madre Soledad de la Cruz» (visto en el corpus).
     *  LAS CIFRAS DEL NOMBRE (G, 03-11-2026, igual que la web): las mismas en las dos, o ninguna. «Calle 1 de Mayo» no es
     *  «Calle 2 de Mayo» ni «Calle Mayo», y «Calle 2 de Mayo» tampoco es «Calle Dos de Mayo»: mejor «Otra calle» que el
     *  punto de otra. */
    fun mismaCalle(escrita: String, otra: String): Boolean {
        val a = palabrasCalle(escrita)
        val b = palabrasCalle(otra)
        if (a.isEmpty() || b.isEmpty() || cifrasDe(a) != cifrasDe(b)) return false
        val (corta, larga) = if (a.size <= b.size) a to b else b to a
        val largo = corta.size >= 3
        fun casa(x: String, y: String) = parecidas(x, y, largo)
        if (!corta.all { w -> larga.any { casa(w, it) } } || corta.none { casa(it, larga.last()) }) return false
        return corta.size > 1 || larga.all { w -> w in TITULOS || casa(corta[0], w) }
    }

    // ── OTRA CALLE, SOLO SI SE PARECE (03-11-2026) ──────────────────────────────────────────────────────────────────
    // La regla laxa, la de la web (situar.js mismaCalle): para lo que NO es la misma calle pero puede ser la que se quiso
    // escribir («Rúa Brétema» para «Rúa Brétema Mariñeira»). Lo que no comparte nada («Rúa Almirante Mourelle 41» para
    // «Rúa Valtrenxo 41») es solo otra calle del mismo CP con ese número: no se enseña.

    /** Lo que no distingue una calle: los títulos de arriba, los de la web (situar.js NO_DISTINGUEN: «São», «Nostra
     *  Senyora») y las marcas del número que se quedan dentro del nombre («Núm.», «Bis»). */
    private val NO_DISTINGUEN = TITULOS + setOf("sao", "nostra", "senyora", "num", "numero", "nro", "bis")

    /** Cuántos cambios de letra hay de una palabra a otra (Levenshtein: las palabras de una calle son cortas). */
    private fun distancia(a: String, b: String): Int {
        var fila = IntArray(b.length + 1) { it }
        for (i in 1..a.length) {
            val nueva = IntArray(b.length + 1).also { it[0] = i }
            for (j in 1..b.length) nueva[j] = minOf(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + if (a[i - 1] == b[j - 1]) 0 else 1)
            fila = nueva
        }
        return fila[b.length]
    }

    /** ¿Se parecen lo bastante para la regla laxa? Como parecidas() y, como en la web (situar.js parecidas), desde 5
     *  letras a un cambio (a dos desde 8) con como mucho dos letras más o menos; y la palabra que aún se está
     *  tecleando, por su principio («Rivo» por «Rivoli»). */
    private fun parecidasLaxa(a: String, b: String, tecleando: Boolean): Boolean {
        if (parecidas(a, b)) return true
        if (tecleando && a.length >= 3 && b.startsWith(a)) return true
        val n = minOf(a.length, b.length)
        return n >= 5 && kotlin.math.abs(a.length - b.length) <= 2 && distancia(a, b) <= (if (n >= 8) 2 else 1)
    }

    /** ¿Comparten el nombre? Al menos una palabra de la calle escrita que la distinga (de 3 letras o más, y que no sea un
     *  título ni un tipo de vía: «San», «Doctor» o «General» no distinguen nada; si solo hay de esas, cualquiera) está en
     *  la otra, con el margen del OCR. Vale con la dirección entera o con la calle sola: «Rúa Brétema Mariñeira 23, 15011
     *  A Coruña» y «Rúa Brétema, 15179 Oleiros» sí; «Rúa Valtrenxo 41» y «Rúa Almirante Mourelle 41», no. */
    fun comparteNombre(escrita: String, otra: String): Boolean {
        val todas = palabrasCalle(calleDe(escrita))
        val mias = todas.filter { it.length >= 3 && it !in NO_DISTINGUEN && it !in TIPOS }.ifEmpty { todas }
        val suyas = palabrasCalle(calleDe(otra))
        if (mias.isEmpty() || suyas.isEmpty()) return false
        // La última palabra de lo escrito puede estar a medias («12 rue de Rivo»), como en la web.
        val ultima = plano(escrita).split(NO_LETRA).lastOrNull { it.isNotEmpty() }
        return mias.any { a -> suyas.any { b -> parecidasLaxa(a, b, tecleando = a == ultima) } }
    }

    /** ¿Es de otra calle que la escrita? Solo se juzga con el número ya escrito (sin él, la persona aún teclea o busca un
     *  sitio por su nombre: «Hospital Abente y Lago», «Mercadona Oleiros») y con un nombre de calle con qué comparar.
     *  LA MISMA CALLE ES TAMBIÉN EL MISMO SITIO (03-11-2026, igual que la web): la misma calle (mismaCalle) y el mismo
     *  sitio (mismoSitio, con el `cp` y la `localidad` de la parada y los de la sugerida, `cpS` y `locS`; sin ellos, lo
     *  escrito en cada una). «Rúa Brétema, 15179 Oleiros» es otra calle para «Rúa Brétema 23, 15011 A Coruña». */
    private fun deOtraCalle(escrita: String, sugerida: String, cp: String = "", localidad: String = "", cpS: String = "", locS: String = ""): Boolean {
        if (numeroDe(escrita).isEmpty()) return false
        val calle = calleDe(escrita)
        return palabrasCalle(calle).isNotEmpty() &&
            !(mismaCalle(calle, calleDe(sugerida)) && mismoSitio(escrita, cp, localidad, sugerida, cpS, locS))
    }

    /** Lo mismo con una sugerencia, con su CP y su población. */
    private fun deOtraCalle(escrita: String, cp: String, localidad: String, s: Sugerencia): Boolean =
        deOtraCalle(escrita, s.direccion, cp, localidad, s.cp, s.localidad)

    /** Lo escrito detrás de la calle y el número: el CP, el pueblo, la provincia… */
    private fun trasLaCalle(direccion: String): String {
        val d = paraBuscar(direccion).ifBlank { espacios(direccion).trim() }
        val l = leer(d)
        if (l.fin >= 0) return d.substring(l.fin)
        val coma = TROZOS.find(d) ?: return ""
        return d.substring(coma.range.last + 1)
    }

    /** ¿Es un trozo solo el piso, la puerta o la escalera («Baixo», «2º B», «Esc. A»)? (geocodificador.es_piso) */
    private fun esPiso(trozo: String): Boolean {
        val t = plano(trozo).split(Regex("[\\s.,/-]+")).filter { it.isNotEmpty() }
        return t.isNotEmpty() && t.all { PISO_PALABRA.matches(it) }
    }

    /** Una palabra del piso que va detrás del portal (F, 03-11-2026, igual que la web; las de geocodificador.PISO_TOK,
     *  con «casa» y «nave»): «2», «1o», «2n», «3r», «4.», «Baixo», «Pral.», «Àtic», «eskuma»… y una letra de la A a la H. */
    private val PISO_COLA = Regex("^(?:\\d{1,2}(?:°|o|a|n|r|t|er|na|ra|ta|do|ro|to)?|bajo|bajos|bj|baixo|baixos|entlo|" +
        "entresuelo|entreplanta|entl|pral|principal|atico|atic|sotano|semisotano|local|izq|izqda|izda|izquierda|dcha|dcho|" +
        "dch|der|derecha|dta|dereita|esq|esquerda|centro|ctro|int|ext|esc|escalera|escaleira|portal|pta|puerta|porta|piso|" +
        "planta|bloque|blq|bl|edificio|edif|behea|ezk|esk|eskuma|ezkerra|eskuina|dup|duplicado|casa|nave|[a-h])$")

    /** ¿Es todo piso lo de detrás del portal («2 dcha», «2n 1a», «Baixo 2», «1o IZQ.»)? Con una palabra que no lo es, no:
     *  en «Calle Real 1 A Coruña» la «A» es del pueblo (F, 03-11-2026, como el servidor). */
    private fun esPisoCola(cola: String): Boolean {
        val t = plano(cola).split(Regex("[\\s.,/-]+")).filter { it.isNotEmpty() }
        return t.isNotEmpty() && t.all { PISO_COLA.matches(it) }
    }

    /** Un pueblo para comparar, en palabras: sin acentos, sin cifras (el CP), sin el piso delante, sin el artículo del
     *  final («CORUÑA (A)») y sin la provincia detrás si queda el pueblo: «15011 A Coruña» → [a, coruna]; «Sada
     *  Coruña» → [sada]. */
    private fun clavePueblo(s: String): List<String> {
        var t = plano(s).split(NO_LETRA).filter { w -> w.isNotEmpty() && w.any { it.isLetter() } }
        // «Baixo B 27002 Lugo»: fuera el piso de delante, pero no el artículo («A Coruña»: la «a» también es una puerta).
        while (t.size > 1 && PISO_PALABRA.matches(t.first()) && t.first() !in ARTICULOS) t = t.drop(1)
        while (t.size > 1 && t.last() in ARTICULOS) t = t.dropLast(1)
        // P (03-11-2026, igual que la web): la provincia de varias palabras, entera y antes que una suya sola («Ponferrada
        // Castilla y León» → [ponferrada], no [ponferrada, castilla]; «Telde Las Palmas» → [telde]); la que ya es entera
        // una provincia se queda («Castilla y León» no es [castilla], ni «Región de Murcia» [region]: esProvincia).
        // P2 (03-11-2026, igual que la web y que loc_limpia del servidor): detrás de «de», «del» o «d» es del nombre y se
        // queda: «Alhama de Murcia» y «Alhama de Granada», a 200 km, eran las dos [alhama].
        while (!esProvincia(t)) {
            val k = (t.size - 1 downTo 1).firstOrNull { n ->
                t.takeLast(n).joinToString(" ") in PROVINCIAS && t.dropLast(n).any { it !in ARTICULOS } && t[t.size - n - 1] !in DE_DELANTE
            } ?: break
            t = t.dropLast(k)
            while (t.size > 1 && t.last() in ARTICULOS) t = t.dropLast(1)
        }
        return t
    }
    private val DE_DELANTE = setOf("de", "del", "d")

    private fun sinArticulo(t: List<String>) = if (t.size > 1 && t.first() in ARTICULOS) t.drop(1) else t

    /** EL NOMBRE DE LA CAPITAL CON EL CP DE OTRO MUNICIPIO (B, 03-11-2026, la revisión; igual que la web). «Rúa Rosalía
     *  de Castro 5, 15179 A Coruña» es de Oleiros y pasaba por la de la ciudad (15004), a 8 km. ¿Cuenta como pueblo `t`
     *  (de clavePueblo) escrito con el CP `cp`? Lo que no es de PROVINCIAS, sí; «España», «Galicia», «Bizkaia»…, nunca
     *  (NO_SON_PUEBLO); el nombre de una capital («A Coruña», «Lugo», «Madrid»), con un CP de España (5 cifras, de 01
     *  a 52) solo si es de la capital (la tercera cifra es 0: 15004, 27002, 28013) y, sin CP o con uno de fuera, sí. */
    private fun cuentaComoPueblo(t: List<String>, cp: String): Boolean {
        if (!esProvincia(t)) return true
        if (esProvincia(t, NO_SON_PUEBLO)) return false
        val c = soloCp(cp)
        return !(c.length == 5 && c.all { cifra(it) } && c.substring(0, 2).toInt() in 1..52) || c[2] == '0'
    }
    /** ¿Es `t` (de clavePueblo) una de la `lista`, con su artículo o sin él? «A Coruña» y «Coruña»; «Las Palmas», «La
     *  Rioja» o «Santa Cruz de Tenerife», enteras (P, 03-11-2026: las de varias palabras, como las de una). */
    private fun esProvincia(t: List<String>, lista: Set<String> = PROVINCIAS): Boolean =
        t.joinToString(" ") in lista || sinArticulo(t).joinToString(" ") in lista
    private fun sinArticulos(t: List<String>) = t.filter { it !in ARTICULOS }.ifEmpty { t }
    private fun conLetras(t: List<String>) = t.any { w -> w.count { it.isLetter() } >= 3 }

    /** EL PUEBLO Y SU MUNICIPIO (H, 03-11-2026; igual que la web). CartoCiudad escribe «15670 O Burgo (Culleredo)» (uno
     *  de cada cuatro resultados del laboratorio), y «Culleredo» no era «o burgo culleredo»: «X (Y)» son dos pueblos, X
     *  e Y, en palabras (clavePueblo). Y no cuenta si es solo un artículo («CORUÑA (A)» sigue siendo A Coruña) ni si es
     *  una provincia («Ames (A Coruña)» es Ames: si no, cualquier pueblo de la provincia pasaría por la ciudad). */
    private fun clavesPueblo(s: String): List<List<String>> {
        val ys = ENTRE_PARENTESIS.findAll(s).map { clavePueblo(it.groupValues[1]) }
            .filter { y -> y.any { it !in ARTICULOS } && !esProvincia(y) }.toList()
        return listOf(clavePueblo(s.replace(ENTRE_PARENTESIS, " "))) + ys
    }
    private val ENTRE_PARENTESIS = Regex("\\(([^)]*)\\)")

    /** Los pueblos que dice una dirección, sin el piso, el CP ni la provincia si hay otro, y la población de la parada
     *  (esa siempre): «Rúa Real 5, 15179 Oleiros, A Coruña» → [oleiros]; «…, 15011 A Coruña» → [a coruna]; «…, 15670 O
     *  Burgo (Culleredo)» → [o burgo, culleredo] (clavesPueblo, 03-11-2026). Los dos, con el CP de la parada (`cp`) o,
     *  sin él, el escrito (B, 03-11-2026: cuentaComoPueblo): «…, 15179 A Coruña» → []. */
    @JvmOverloads
    fun pueblosEscritos(direccion: String, localidad: String = "", cp: String = ""): List<String> {
        val c = soloCp(cp).ifEmpty { cpEscrito(direccion) }
        val ps = trasLaCalle(direccion).split(TROZOS).asSequence()
            .filter { it.isNotBlank() && !esPiso(it) }.flatMap { clavesPueblo(it).asSequence() }.filter { conLetras(it) && cuentaComoPueblo(it, c) }.toList()
        val sinProvincia = ps.filter { !esProvincia(it) }
        val loc = clavesPueblo(localidad).filter { conLetras(it) && cuentaComoPueblo(it, c) }
        return (loc + sinProvincia.ifEmpty { ps }).distinctBy { sinArticulos(it) }.map { it.joinToString(" ") }
    }

    /** ¿Está escrito en la dirección el pueblo que da el móvil? El mismo nombre, con o sin sus artículos («Coruña» y «A
     *  Coruña», «Santiago Compostela» y «Santiago de Compostela») y con un carácter de tolerancia en los largos
     *  («Vilardevós» y «Villardevós»); o, si el más corto tiene dos palabras o más, dentro del otro («As Pontes» y «As
     *  Pontes de García Rodríguez»). Uno de una palabra no vale dentro de otro, como en el servidor: «Burgos» no es «San
     *  Mamés de Burgos». «O Burgo (Culleredo)» es O Burgo o Culleredo (clavesPueblo, 03-11-2026). `suyo`, con su CP
     *  (`cp`, B: el nombre de la capital con el CP de otro municipio no es un pueblo; «España», nunca). */
    @JvmOverloads
    fun mismoPueblo(suyo: String, pueblos: List<String>, cp: String = ""): Boolean {
        fun dentro(a: List<String>, b: List<String>) =
            b.isNotEmpty() && b.size <= a.size && (0..a.size - b.size).any { i -> b.indices.all { j -> parecidas(a[i + j], b[j]) } }
        fun casan(a: List<String>, b: List<String>) =
            (a.size == b.size && dentro(a, b)) || (minOf(a.size, b.size) >= 2 && (dentro(a, b) || dentro(b, a)))
        return clavesPueblo(suyo).filter { conLetras(it) && cuentaComoPueblo(it, cp) }.any { r ->
            pueblos.any { p ->
                val w = p.split(' ').filter { it.isNotEmpty() }
                casan(w, r) || casan(sinArticulos(w), sinArticulos(r))
            }
        }
    }

    // ── LA MISMA CALLE ES TAMBIÉN EL MISMO SITIO (03-11-2026, la revisión; igual que la web) ─────────────────────────
    // «Rúa Brétema 23, 15011 A Coruña» y «Rúa Brétema, 15179 Oleiros» pasaban por la misma calle (mismaCalle solo mira
    // el nombre) y la parada se quedaba escrita con el punto de Oleiros, a 8 km. Ahora S es de la misma calle que D solo
    // si además es el mismo sitio: lo usan alElegir (3a y 3b), esAqui, la marca «Otra calle» y ordenar. aceptar (el móvil
    // en segundo plano) no: ya lo mira a su manera, con distancias.

    /** El CP escrito en una dirección, detrás de la calle y el número: el primero de 5 cifras suelto. */
    private fun cpEscrito(direccion: String): String = CP_SUELTO.find(trasLaCalle(direccion))?.value.orEmpty()

    /** ¿Es el mismo sitio? D (`direccion`, con el `cp` y la `localidad` de la parada si los tiene) y S (`otra`, con su
     *  `cpOtra` y su `locOtra`). El CP de cada una: el suyo o, si no, el escrito; los pueblos de D, pueblosEscritos (con
     *  la población de la parada); el de S, su población o, si no, los de su texto. Con los dos CP: el mismo CP o, si no,
     *  el mismo pueblo («Avenida de Finisterre 120, 15004 A Coruña» y «Avenida de Finisterre, 15005 A Coruña» sí; «…,
     *  15011 A Coruña» y «…, 15179 Oleiros», no); con el de D solo, el mismo pueblo (si S no lo dice, no); D sin CP y con
     *  pueblo, el mismo pueblo; D sin CP ni pueblo, sí: no hay con qué comparar (como hasta ahora).
     *  B (03-11-2026): los pueblos de cada una, con su CP (cuentaComoPueblo); sin otro pueblo, decide el CP: «Rúa Rosalía
     *  de Castro 5, 15179 A Coruña» no es «Rúa Rosalía de Castro, 15004 A Coruña».
     *  B2 (03-11-2026, igual que la web): D que dice un sitio que no cuenta y se queda sin CP ni pueblo («Calle Uría 5,
     *  Asturias», «…, Galicia», «…, España») no es el caso sin CP ni pueblo: no es el mismo sitio («Otra calle»). Ese
     *  «sí» queda para D sin ningún sitio escrito (diceSitio). */
    fun mismoSitio(direccion: String, cp: String, localidad: String, otra: String, cpOtra: String = "", locOtra: String = ""): Boolean {
        val cpD = soloCp(cp).ifEmpty { cpEscrito(direccion) }
        val cpS = soloCp(cpOtra).ifEmpty { cpEscrito(otra) }
        val pueblosD = pueblosEscritos(direccion, localidad, cpD)
        val pueblosS = recorta(locOtra).takeIf { it.isNotEmpty() }?.let { listOf(it) } ?: pueblosEscritos(otra, "", cpS)
        fun elMismoPueblo() = pueblosS.any { mismoPueblo(it, pueblosD, cpS) }
        return when {
            cpD.isNotEmpty() && cpS.isNotEmpty() -> cpD == cpS || elMismoPueblo()
            cpD.isNotEmpty() || pueblosD.isNotEmpty() -> elMismoPueblo()
            else -> !diceSitio(direccion, localidad)
        }
    }

    /** B2: ¿dice D algún sitio, cuente o no como pueblo? Un trozo detrás de la calle que no es el piso, o la población de
     *  la parada, con letras (como en pueblosEscritos, antes de cuentaComoPueblo): «…, Asturias», «…, Galicia» o la
     *  población «Bizkaia», sí; «Rúa Real 5» o «Rúa Real 5, 2º B», no. */
    private fun diceSitio(direccion: String, localidad: String): Boolean =
        (trasLaCalle(direccion).split(TROZOS).filter { it.isNotBlank() && !esPiso(it) }.flatMap { clavesPueblo(it) } + clavesPueblo(localidad))
            .any { conLetras(it) }

    /** ¿Se acepta lo que dice el móvil para una parada? null si no; si sí, «portal» (trae el mismo portal ENTERO que la
     *  dirección: portalDe y enteroDe, 03-11-2026; «5» no es el de «Calle Real 5B», ni «12» el de «12-14») o «calle».
     *  Tiene que ser del país de la cuenta, traer calle (un pueblo o un comercio solo, no) y ser LA MISMA CALLE
     *  (mismaCalle), y:
     *  · con CP en la parada: el mismo CP o el mismo pueblo (mismoPueblo; con otro CP, además, a menos de 15 km de la
     *    zona o de la base si las hay). La distancia sola no vale: «Rúa Brétema Mariñeira 23, 15011 A Coruña» no es
     *    «Rúa Brétema, 15179 Oleiros», a 8 km (visto en el emulador el 02-11-2026);
     *  · sin CP, con pueblo escrito: ese pueblo (y a menos de 50 km de la ruta, si hay con qué comparar);
     *  · sin CP ni pueblo: a menos de 50 km de algo de la ruta (`dondeReparte`); sin nada con qué comparar, no
     *    («Calle Real 1» sería la de cualquier pueblo).
     *  B (03-11-2026): los pueblos de la parada, con su CP (o el escrito), y el del móvil, con el suyo
     *  (cuentaComoPueblo); sin otro pueblo, con otro CP escrito, no.
     *  B2 (03-11-2026, el revisor: «Calle Uría 5, Asturias» se guardaba sola en «Calle Uría 5, 33201 Gijón»): el CP de la
     *  parada es el de su campo o, si no, el escrito en D, y con él decide lo de arriba; y D que dice un sitio pero se
     *  queda sin CP ni pueblo («…, Asturias», «…, Galicia», «…, España»: diceSitio) no es el caso sin CP ni pueblo: no. */
    fun aceptar(
        r: ResultadoMovil, pais: String, direccion: String, cp: String, localidad: String,
        cerca: List<Punto>, dondeReparte: List<Punto> = cerca,
    ): String? {
        if (pais.isBlank() || !r.pais.equals(pais, ignoreCase = true) || r.calle.isBlank()) return null
        val aqui = valido(r.lat, r.lng) ?: return null
        if (!mismaCalle(calleDe(direccion), r.calle)) return null
        fun aMenos(l: List<Punto>, m: Double) = l.any { Navegador.metrosEntre(it, aqui) < m }
        val cpD = soloCp(cp).ifEmpty { cpEscrito(direccion) }
        val cpR = soloCp(r.cp)
        val pueblos = pueblosEscritos(direccion, localidad, cpD)
        val vale = when {
            cpD.isNotEmpty() -> cpR == cpD ||
                (mismoPueblo(r.localidad, pueblos, cpR) && (cerca.isEmpty() || aMenos(cerca, CERCA_CP_M)))
            pueblos.isNotEmpty() -> mismoPueblo(r.localidad, pueblos, cpR) && (dondeReparte.isEmpty() || aMenos(dondeReparte, CERCA_SIN_CP_M))
            diceSitio(direccion, localidad) -> false        // dijo un sitio y no queda con qué compararlo (B2)
            else -> aMenos(dondeReparte, CERCA_SIN_CP_M)
        }
        if (!vale) return null
        val n = portalDe(direccion)
        return if (n.isNotEmpty() && enteroDe(r.numero) == n) "portal" else "calle"
    }

    /** El número del móvil como el portal entero de portalDe (D, 03-11-2026): «5 B» o «5-B» → «5B»; «5 bis» → «5BIS»;
     *  «12-14» → «12-14»; sin cifras delante, "". */
    private fun enteroDe(numero: String): String {
        val t = espacios(numero).trim()
        return if (t.isNotEmpty() && cifra(t[0])) numeroEn(t, 0)?.entero.orEmpty() else ""
    }

    /** La mejor respuesta aceptable del móvil: la primera con el portal y, si no hay, la primera con la calle. */
    fun mejor(
        rs: List<ResultadoMovil>, pais: String, direccion: String, cp: String, localidad: String,
        cerca: List<Punto>, dondeReparte: List<Punto> = cerca,
    ): Pair<ResultadoMovil, String>? {
        val buenas = rs.mapNotNull { r -> aceptar(r, pais, direccion, cp, localidad, cerca, dondeReparte)?.let { r to it } }
        return buenas.firstOrNull { it.second == "portal" } ?: buenas.firstOrNull()
    }

    /** La clave de una parada para no probarla dos veces con el móvil en la misma sesión: con otra dirección, se vuelve a probar. */
    fun clave(p: Parada): String = "${p.id}|${Calle.sinAcentos(p.direccion).trim()}"

    /** Las paradas que toca probar con el móvil en segundo plano, en orden: por entregar y sin punto, con dirección, que
     *  no se hayan probado ya en esta sesión con esa misma dirección (`probadas`, de clave()) ni tengan un cambio en
     *  vuelo (`ocupadas`: algo esperando a salir, o situándose ahora mismo). Como mucho `tope`. Las de geo «pendiente»
     *  (una lista pegada o compartida que el servidor aún está ubicando) no: primero el servidor, que lo que guarde el
     *  móvil ya no lo toca (02-11-2026, revisión A2). */
    fun porSituar(paradas: List<Parada>, probadas: Set<String>, ocupadas: Set<String>, tope: Int = TOPE_FONDO): List<Parada> =
        paradas.asSequence().distinctBy { it.id }
            .filter { sinSituar(it) && it.geo != "pendiente" && !it.ejemplo && it.direccion.trim().length >= 4 && it.id !in ocupadas && clave(it) !in probadas }
            .take(tope).toList()

    /** Un candidato de POST /reparto/ubicar como sugerencia (los de solo la zona no: el centro del CP no es una puerta). */
    fun deServidor(c: CandidatoUbicar): Sugerencia? {
        val p = valido(c.lat, c.lng) ?: return null
        val precision = c.precision.orEmpty()
        if (precision == "zona" || c.direccion.isNullOrBlank()) return null
        return Sugerencia(c.direccion, "", "", p.lat, p.lng, precision = precision, fuente = "servidor")
    }

    /** Una respuesta del móvil como sugerencia: solo las del país de la cuenta y con calle. `direccion` es D, la de la
     *  parada. La precisión, la de lo que quedará al elegirla (alElegir, 03-11-2026): «calle» sin número; con él,
     *  «portal» si es el número de D, si D no lo trae o si es de otra calle (su dirección pasa a ser la suya, con ese
     *  portal), y «calle» si es la misma calle con otro número (se queda D: «Sin el portal»). Desde el 03-11-2026 la
     *  decide alElegir misma, con el `cp` y la `localidad` de la parada: otro sitio es otra calle y otro portal entero
     *  («5» para «5B») es la calle. */
    fun deMovil(r: ResultadoMovil, pais: String, direccion: String, cp: String = "", localidad: String = ""): Sugerencia? {
        if (!r.pais.equals(pais, ignoreCase = true) || r.calle.isBlank()) return null
        val p = valido(r.lat, r.lng) ?: return null
        val texto = r.texto.ifBlank { listOf(listOf(r.calle, r.numero).filter { it.isNotBlank() }.joinToString(" "), listOf(r.cp, r.localidad).filter { it.isNotBlank() }.joinToString(" ")).filter { it.isNotBlank() }.joinToString(", ") }
        val s = Sugerencia(texto, r.cp, r.localidad, p.lat, p.lng, precision = "portal", fuente = "movil")
        if (r.numero.trim().takeWhile { it.isDigit() }.isEmpty()) return s.copy(precision = "calle")
        return s.copy(precision = alElegir(direccion, s, cp, localidad).precision)
    }

    /** Una de las suyas («Ya estuviste aquí», GET /reparto/mis-direcciones) como sugerencia, con la precisión que manda
     *  el servidor (03-11-2026: «calle» o «portal»; sin ella, "" y al elegirla «portal», como hasta ahora). */
    fun deSuya(d: DireccionConocida): Sugerencia =
        Sugerencia(d.direccion, d.cp, d.localidad, d.lat, d.lng, d.cliente, d.telefono, d.veces, precision = d.precision.trim(), fuente = "suya")

    /** LA POBLACIÓN DEL MÓVIL, NUNCA LA PROVINCIA (03-11-2026, visto en el emulador): GeoMovil tomaba `locality` o, sin
     *  ella, `subAdminArea`, que es la provincia: con Oleiros se guardó la población «A Coruña» con el CP 15179, y una
     *  provincia que se llama como su capital pasaba por el pueblo escrito (mismoPueblo). Sin `locality`, lo que va
     *  detrás del CP en la línea de la dirección (puebloTrasCp), o nada. */
    fun localidadDe(locality: String?, linea: String, cp: String = ""): String =
        locality?.trim()?.takeIf { it.isNotEmpty() } ?: puebloTrasCp(linea, cp)

    /** Lo que va detrás del CP, en su mismo trozo: «Rúa Brétema, 15179 Oleiros, A Coruña, España» → «Oleiros». El CP es
     *  el dado o, si no está escrito, el primero de 5 cifras suelto. Sin CP, o con nada detrás («…, 15179, A Coruña»: lo
     *  siguiente puede ser la provincia), "". */
    fun puebloTrasCp(linea: String, cp: String = ""): String {
        val dado = cp.trim().takeIf { it.isNotEmpty() }?.let { Regex("(?<![\\p{L}\\d])" + Regex.escape(it) + "(?![\\p{L}\\d])") }
        val trozos = espacios(linea).split(TROZOS).map { it.trim() }
        val m = dado?.let { d -> trozos.firstNotNullOfOrNull { t -> d.find(t)?.let { t to it } } }
            ?: trozos.firstNotNullOfOrNull { t -> CP_SUELTO.find(t)?.let { t to it } } ?: return ""
        val resto = m.first.substring(m.second.range.last + 1).trim(' ', ',', '.', '-')
        return if (resto.any { it.isLetter() }) resto else ""
    }
    private val CP_SUELTO = Regex("(?<!\\d)\\d{5}(?!\\d)")

    private fun claveTexto(s: String) = Calle.sinAcentos(s).replace(Regex("[^a-z0-9]+"), " ").trim()

    /** ¿Son la misma? La misma dirección escrita igual, o el mismo número a menos de 25 m. */
    private fun mismaSugerencia(a: Sugerencia, b: Sugerencia): Boolean {
        if (claveTexto(a.direccion) == claveTexto(b.direccion)) return true
        val pa = valido(a.lat, a.lng) ?: return false
        val pb = valido(b.lat, b.lng) ?: return false
        return numeroDe(a.direccion) == numeroDe(b.direccion) && Navegador.metrosEntre(pa, pb) < MISMO_SITIO_M
    }

    /** Las sugerencias en el orden en que se enseñan: lo que encuentra el servidor (POST /reparto/ubicar) primero, luego
     *  las direcciones suyas («Ya estuviste aquí»), las del geocodificador del móvil y las del buscador de mapas
     *  (Photon). La misma dirección escrita igual, o el mismo número a menos de 25 m, es la misma: se queda la primera,
     *  con el cliente, el teléfono y las veces de la suya si los tenía. Como mucho `n`.
     *  OTRA CALLE (02-11-2026, visto en el emulador; la regla, del 03-11-2026 e igual que en la web): con una calle que
     *  no existe, el móvil y Photon dan calles cualquiera del mismo CP con ese número («Rúa Almirante Mourelle 41» para
     *  «Rúa Valtrenxo 41»). Con DOS textos (03-11-2026): `buscado` (lo escrito en la ficha, o en el buscador de
     *  «Situar») para QUITAR, y `direccion` (D, la de la parada; en la ficha, lo mismo) para MARCAR:
     *  · con número en lo buscado (sin él no se mira: deOtraCalle), las del móvil y de Photon que no son su calle ni
     *    comparten el nombre (comparteNombre: «Rúa Brétema» sí para «Rúa Brétema Mariñeira 23») NO salen; de Photon,
     *    ya quitadas esas, TOPE_MAPA;
     *  · con número en D, toda la que no es la calle de D, de cualquier fuente menos las suyas (las del servidor
     *    también), va al final y con `otraCalle`: al elegirla, su dirección pasa a ser la de la parada (alElegir).
     *  EL SITIO Y EL CP AL JUNTAR (03-11-2026, igual que la web): la misma calle en otro sitio también es «Otra calle»
     *  (con el `cp` y la `localidad` de la parada: deOtraCalle), y la que queda al juntar el mismo portal de varias
     *  fuentes lleva el CP y la población de la primera que los traiga, por este orden: el servidor (con las suyas),
     *  el móvil y Photon (antes, los del servidor: ninguno). */
    fun ordenar(
        servidor: List<Sugerencia>, suyas: List<Sugerencia>, movil: List<Sugerencia>, mapa: List<Sugerencia>, n: Int = 7,
        buscado: String = "", direccion: String = buscado, cp: String = "", localidad: String = "",
    ): List<Sugerencia> {
        fun toca(s: Sugerencia) = !deOtraCalle(buscado, "", "", s) || comparteNombre(buscado, s.direccion)
        fun marcada(s: Sugerencia) = s.copy(otraCalle = s.fuente != "suya" && deOtraCalle(direccion, cp, localidad, s))
        val delMapa = mapa.filter(::toca).map(::marcada).let { l -> l.filterNot { it.otraCalle } + l.filter { it.otraCalle } }.take(TOPE_MAPA)
        val todas = servidor.map(::marcada) + suyas.map { it.copy(otraCalle = false) } + movil.filter(::toca).map(::marcada) + delMapa
        val out = ArrayList<Sugerencia>()
        val deCp = ArrayList<Int>()       // de qué fuente es el CP de cada una (rango)
        val deLoc = ArrayList<Int>()      // y su población
        for (s in todas.filterNot { it.otraCalle } + todas.filter { it.otraCalle }) {
            if (s.direccion.isBlank()) continue
            val i = out.indexOfFirst { mismaSugerencia(it, s) }
            if (i < 0) { out += s; deCp += rango(s, s.cp); deLoc += rango(s, s.localidad); continue }
            val a = out[i]
            val rCp = rango(s, s.cp)
            val rLoc = rango(s, s.localidad)
            out[i] = a.copy(cliente = a.cliente.ifBlank { s.cliente }, telefono = a.telefono.ifBlank { s.telefono }, veces = maxOf(a.veces, s.veces),
                lat = a.lat ?: s.lat, lng = if (a.lat != null) a.lng else s.lng,
                cp = if (rCp < deCp[i]) s.cp else a.cp, localidad = if (rLoc < deLoc[i]) s.localidad else a.localidad)
            deCp[i] = minOf(deCp[i], rCp)
            deLoc[i] = minOf(deLoc[i], rLoc)
        }
        return out.take(n)
    }

    /** El orden de las fuentes para el CP y la población de las que se juntan (03-11-2026): el servidor, las suyas, el
     *  móvil y Photon; sin el dato, detrás de todas. */
    private fun rango(s: Sugerencia, dato: String): Int =
        if (dato.isBlank()) Int.MAX_VALUE else when (s.fuente) { "servidor" -> 0; "suya" -> 1; "movil" -> 2; "photon" -> 3; else -> 4 }

    /** ¿Es de la calle buscada? Para «No encuentro esa dirección» de «Situar» (03-11-2026: las marcas ya son con D, la
     *  dirección de la parada, y lo buscado se pudo cambiar): las suyas siempre; las demás, si lo buscado no trae
     *  número o son de su misma calle (y, desde el 03-11-2026, del mismo sitio: deOtraCalle). */
    fun deLaBuscada(buscado: String, s: Sugerencia): Boolean = s.fuente == "suya" || !deOtraCalle(buscado, "", "", s)

    /** Lo que queda al elegir una sugerencia: la dirección, la precisión («portal» o «calle») y el CP y la población que
     *  se mandan con ella. */
    data class Elegida(val direccion: String, val precision: String, val cp: String, val localidad: String)

    /** AL ELEGIR UNA SUGERENCIA, EN TODOS LOS CAMINOS (la regla del 03-11-2026, igual que la web): la lista de la
     *  ficha, «Situar la parada» abierta desde la ficha, «Situar» abierta desde Hoy o la ruta, y la cola sin conexión.
     *  `direccion` es D, la de la PARADA: la escrita en la ficha, o la guardada si se sitúa desde Hoy; nunca lo escrito
     *  en el buscador de «Situar», que se pudo cambiar. `s` es la elegida, de cualquier fuente (servidor, suya, móvil,
     *  Photon) y marcada o no (aquí se vuelve a mirar):
     *  1. una de las suyas («Ya estuviste aquí»): tal cual, con la precisión que manda el servidor (sin ella, «portal»);
     *  2. D sin el número del portal: la de S con el piso de D (conPiso) y la precisión de S;
     *  3. D con número y S de la MISMA calle (mismaCalle estricta): a) S es un portal con ese mismo número → la de S con
     *     el piso de D, «portal»; b) si no (la calle sin el portal, u otro número: «Calle Real 85» para «Rúa Real 999»)
     *     → D con su número y su piso (02-11-2026, visto en el emulador: el 999 se perdía), con el CP y el pueblo de S
     *     detrás solo si D no los traía, «calle»;
     *  4. D con número y S de OTRA calle, venga de donde venga → la de S con el piso de D, su CP y su población, y su
     *     precisión («portal» si trae número, «calle» si no). Nunca D con el punto de otra calle: «Rúa Brétema Mariñeira
     *     23, 15011 A Coruña» se quedaba con el de «Rúa Brétema, 15179 Oleiros», a 8 km, y la guía llevaba a Oleiros.
     *  Desde el 03-11-2026 (igual que la web), con el `cp` y la `localidad` de la PARADA si los tiene: la misma calle es
     *  también el mismo sitio (mismoSitio: «Rúa Brétema 23, 15011 A Coruña» y «Rúa Brétema, 15179 Oleiros» ya no son la
     *  misma calle, y es 4), y 3a es con el MISMO portal entero (portalDe: «5B» y «5», «5 bis» y «5» o «12-14» y «12»
     *  son 3b). */
    fun alElegir(direccion: String, s: Sugerencia, cp: String = "", localidad: String = ""): Elegida {
        // Recortados como en la web (recorta, H2: 03-11-2026), también el CP y la población de S.
        val d = recorta(direccion)
        val suCp = recorta(s.cp)
        val suLoc = recorta(s.localidad)
        val deS = if (s.precision == "calle") "calle" else "portal"      // la precisión de S (sin ella, «portal»)
        if (s.fuente == "suya") return Elegida(recorta(s.direccion), deS, suCp, suLoc)
        val n = numeroDe(d)
        if (n.isEmpty()) return Elegida(conPiso(d, s.direccion), deS, suCp, suLoc)
        if (deOtraCalle(d, cp, localidad, s)) {
            val precision = if (deS == "portal" && numeroDe(s.direccion).isNotEmpty()) "portal" else "calle"
            return Elegida(conPiso(d, s.direccion), precision, suCp, suLoc)
        }
        if (deS == "portal" && portalDe(s.direccion) == portalDe(d)) return Elegida(conPiso(d, s.direccion), "portal", suCp, suLoc)
        val faltan = listOfNotNull(
            suCp.takeIf { it.isNotEmpty() && !CP_EN_TROZO.containsMatchIn(trasLaCalle(d)) },
            suLoc.takeIf { it.isNotEmpty() && pueblosEscritos(d).isEmpty() },
        )
        val texto = if (faltan.isEmpty()) d else "$d, ${faltan.joinToString(" ")}"
        val dicho = Calle.sinAcentos(texto)
        fun siEsta(x: String) = x.takeIf { it.isNotEmpty() && Calle.sinAcentos(it) in dicho }.orEmpty()
        return Elegida(texto, "calle", siEsta(suCp), siEsta(suLoc))
    }

    /** Lo que manda «Es aquí» de «Situar la parada» abierta desde Hoy o la ruta, además del punto: `precision` «calle»
     *  o "" (nada: «manual», la puerta) y, si cambia, la dirección nueva con su CP y su población ("" = no cambia). */
    data class Cambio(val precision: String = "", val direccion: String = "", val cp: String = "", val localidad: String = "")

    /** «ES AQUÍ» (03-11-2026). Con la chincheta donde la puso una sugerencia (`origen` «sugerencia»: no se ha movido el
     *  mapa), la regla de alElegir con D, la dirección GUARDADA de la parada: "precision": "calle" si sale la calle, y la
     *  dirección, el CP y la población cuando cambian (otra calle, el CP y el pueblo que le faltaban, o la de una suya).
     *  Con el mapa movido a mano o «Mi ubicación» («mapa»), nada: la puerta («manual»), y la dirección no cambia. Antes
     *  solo iba la precisión de la sugerencia (precisionDe): «Calle Real 85» para «Rúa Real 999» llegaba como la puerta,
     *  y la de otra calle dejaba la dirección vieja con su punto. Con el `cp` y la `localidad` GUARDADOS de la parada
     *  (03-11-2026: el mismo sitio, alElegir). */
    fun esAqui(direccion: String, origen: String, s: Sugerencia?, cp: String = "", localidad: String = ""): Cambio {
        if (origen != "sugerencia" || s == null) return Cambio()
        val el = alElegir(direccion, s, cp, localidad)
        val precision = if (el.precision == "calle") "calle" else ""
        return if (el.direccion == recorta(direccion)) Cambio(precision) else Cambio(precision, el.direccion, el.cp, el.localidad)
    }

    /** La parada como queda con «Es aquí» (sin red, o con un servidor que no guarda el punto): el punto, su precisión y,
     *  si la trae, la dirección nueva (Repositorio.conPunto). */
    fun situada(p: Parada, lat: Double, lng: Double, origen: String, c: Cambio): Parada =
        Repositorio.conPunto(p, lat, lng, origen, c.precision, c.direccion, c.cp, c.localidad)

    /** La parada de la ruta que se ve con lo que devolvió el servidor al situarla: el punto y, desde el 03-11-2026,
     *  también la dirección, el CP y la población, que «Es aquí» puede haber cambiado (RutaVM.poner). */
    fun conPuntoDe(actual: Parada, nueva: Parada): Parada = actual.copy(lat = nueva.lat, lng = nueva.lng, geo = nueva.geo,
        geoOrigen = nueva.geoOrigen, zonaLat = nueva.zonaLat, zonaLng = nueva.zonaLng,
        direccion = nueva.direccion.ifBlank { actual.direccion }, cp = if (nueva.direccion.isBlank()) actual.cp else nueva.cp,
        localidad = if (nueva.direccion.isBlank()) actual.localidad else nueva.localidad)

    /** El estado de una dirección para la ficha («En el mapa», «Calle encontrada, sin el portal» o «No la encuentro»),
     *  de lo que dijo POST /reparto/ubicar: «portal», «calle» o «no» (la zona sola tampoco vale para ir). Manda la
     *  precisión; sin ella, `encontrada` no basta para saber cuánto se encontró. */
    fun estado(encontrada: Boolean, precision: String?): String = when (precision) {
        "portal" -> "portal"
        "calle" -> "calle"
        null, "" -> if (encontrada) "calle" else "no"
        else -> "no"
    }

    /** El estado de una parada ya guardada, por su `geo`: con punto exacto (el del servidor, el de la puerta aprendida o
     *  el puesto a mano) «portal»; la calle sin el portal «calle»; sin punto, «no». */
    fun estadoDe(p: Parada): String = when {
        !p.ubicada -> "no"
        p.geo == "aprox" -> "calle"
        else -> "portal"
    }

    /** LA CALLE SIN EL PORTAL LLEGA AL SERVIDOR COMO TAL (03-11-2026, visto en el emulador: «Rúa Real 999» + «Sin el
     *  portal» se guardaba en geo «manual» y al reabrirla decía «En el mapa»: la guía la trataría como la puerta). Lo que
     *  se manda del punto de la ficha al añadir o editar la parada (Repositorio.cuerpoPunto): lat y lng, de dónde sale
     *  (geo_origen «mapa» si se puso a mano en el mapa, «sugerencia» si se eligió una; lo leído de la etiqueta, sin
     *  origen) y, si es una sugerencia de la calle sin el portal, "precision": "calle" (el servidor la guarda «aprox»).
     *  null sin punto. */
    fun cuerpoPunto(s: Sugerencia): JsonObject? {
        val lat = s.lat ?: return null
        val lng = s.lng ?: return null
        val origen = when (s.fuente) { "" -> ""; "mapa" -> "mapa"; else -> "sugerencia" }
        return Repositorio.cuerpoPunto(lat, lng, origen, if (origen == "sugerencia") s.precision else "")
    }

    /** AL GUARDAR LA FICHA (03-11-2026, la revisión): lo que va del punto con la parada (cuerpoPunto, y el CP y la
     *  población que vinieron con él) solo si es el punto de lo escrito: `punto.direccion` es el texto con el que se
     *  puso. Al cambiar el texto la ficha lo borra, venga de donde venga, y uno que ya no es el del texto no manda nada,
     *  ni su CP ni su población: el servidor busca lo escrito. Antes, «Situar la parada» con una sugerencia y la
     *  dirección reescrita mandaban el punto de Oleiros con «sugerencia», «calle», 15179 y Oleiros. */
    fun loDelPunto(direccion: String, punto: Sugerencia?): JsonObject {
        val s = punto?.takeIf { it.direccion.trim() == direccion.trim() } ?: return JsonObject(emptyMap())
        return JsonObject(buildMap {
            cuerpoPunto(s)?.let { putAll(it) }
            if (s.cp.isNotBlank()) put("cp", JsonPrimitive(s.cp))
            if (s.localidad.isNotBlank()) put("localidad", JsonPrimitive(s.localidad))
        })
    }

    // ── LA SUGERENCIA SOLO SE OLVIDA AL ARRASTRAR (03-11-2026, el emulador) ─────────────────────────────────────────
    // Tras elegir «Rúa Brétema, 15179 Oleiros · Otra calle» para «Rúa Brétema Mariñeira 23, 15011 A Coruña», alejar el
    // mapa sin arrastrarlo hasta el zoom 12-13 la olvidaba: cada zoom deja el centro a menos de un píxel de donde estaba
    // (el foco del zoom no era del todo el centro de MapLibre), eso se suma, a zoom 12,5 un píxel son 3,7 m y bastaban
    // 3 m. Al volver a acercar, «Es aquí» mandaba el punto de Oleiros como la puerta («mapa») de la parada de A Coruña.
    // Ahora el zoom nunca la olvida: solo un arrastre que deje la chincheta a más de 3 m de ella Y a más de 8 dp en la
    // pantalla, con el zoom de ese momento (sigueEnElla); y al pararse el mapa, vuelve a centrarse en ella (alPararse).

    /** Un arrastre la olvida a más de esto de ella y, a la vez, a más de SIGUE_EN_ELLA_DP en la pantalla. */
    const val SIGUE_EN_ELLA_M = 3.0
    const val SIGUE_EN_ELLA_DP = 8.0
    /** Más cerca que esto (1 cm), el mapa ya está centrado en ella. */
    const val CENTRADA_M = 0.01

    /** Los metros que ocupa un dp del mapa a esa latitud y ese zoom, como en MapLibre (teselas de 512 dp y el radio de
     *  la Tierra de su proyección): en A Coruña, unos 9,8 m a zoom 12,5 y 0,22 m a zoom 18. */
    fun metrosPorDp(lat: Double, zoom: Double): Double =
        2 * Math.PI * 6_378_137.0 * Math.cos(lat.coerceIn(-85.051129, 85.051129) * Math.PI / 180) / (512 * Math.pow(2.0, zoom))

    /** ¿Sigue siendo ella con la chincheta (el centro del mapa) en `centro` tras arrastrar el mapa, con el `zoom` de ese
     *  momento? Sí a 3 m o menos de ella, o a 8 dp o menos en la pantalla: a zoom 12,5, 4 m (menos de medio dp) lo son;
     *  a zoom 18, 2 m también, y 5 m ya no. Si no, «Es aquí» es el punto movido a mano («mapa») y la dirección no cambia. */
    fun sigueEnElla(s: Sugerencia, centro: Punto, zoom: Double): Boolean {
        val p = valido(s.lat, s.lng) ?: return false
        val m = Navegador.metrosEntre(p, centro)
        return m <= SIGUE_EN_ELLA_M || m <= SIGUE_EN_ELLA_DP * metrosPorDp(p.lat, zoom)
    }

    /** Lo que pasa con la sugerencia elegida al pararse el mapa: si se olvida, y dónde volver a centrarlo (sin animar). */
    data class AlParar(val olvidar: Boolean = false, val centrarEn: Punto? = null)

    /** AL PARARSE EL MAPA con la sugerencia `s` elegida, el centro en `centro` y ese `zoom`. Tras la inercia de un
     *  arrastre (`arrastre`), se olvida si ya no es ella (sigueEnElla). Si no (tras acercar o alejar de cualquier forma, o
     *  tras un arrastre que no la olvida), el mapa vuelve a centrarse en ella si el centro se ha desviado: la chincheta
     *  sigue encima, que es lo que manda «Es aquí», y el desfase del zoom no se suma. Sin sugerencia, nada. */
    fun alPararse(s: Sugerencia?, centro: Punto, zoom: Double, arrastre: Boolean): AlParar {
        if (s == null) return AlParar()
        val p = valido(s.lat, s.lng) ?: return AlParar()
        if (arrastre && !sigueEnElla(s, centro, zoom)) return AlParar(olvidar = true)
        return AlParar(centrarEn = p.takeIf { Navegador.metrosEntre(it, centro) > CENTRADA_M })
    }
}
