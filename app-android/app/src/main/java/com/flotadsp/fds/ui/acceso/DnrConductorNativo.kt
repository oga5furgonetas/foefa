// diseño compacto
package com.flotadsp.fds.ui.acceso

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DoorFront
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MarkunreadMailbox
import androidx.compose.material.icons.filled.NoPhotography
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.Park
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PhoneDisabled
import androidx.compose.material.icons.filled.PhoneInTalk
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.RoomService
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Store
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.MisDnr
import com.flotadsp.fds.data.SemanaDnr
import com.flotadsp.fds.data.UnaDnr
import com.flotadsp.fds.ui.Alto
import com.flotadsp.fds.ui.Aviso
import com.flotadsp.fds.ui.Cabecera
import com.flotadsp.fds.ui.ContenedorLista
import com.flotadsp.fds.ui.Esp
import com.flotadsp.fds.ui.Etiqueta
import com.flotadsp.fds.ui.LOCALE_APP
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.SeparadorLista
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.Tono
import com.flotadsp.fds.ui.tx
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/* «MIS DNR» EN LA APP (11-11-2026, tanda 2; para la próxima versión de Play, no se publica ahora). La misma pantalla que el
   portal web (frontend/src/pages/driver/MisDnr.jsx y dnrVistas.js), con la misma ruta (GET /diarios/mias), las mismas
   frases, las mismas condiciones y en el mismo orden. Dani: «que le ponga por ejemplo "esta semana llevas 1 DNR" y cuál
   es, o "llevas 5" o así, y que esté bien montado», y después: «hazlo más bonito y mejor… entrega tipo "marcaste puerta y
   no llamaste ni sacaste bien la foto"… y un recordatorio»:
     1. La semana («Del 8/11 al 14/11») y, en grande, la frase de ESTA semana con su número (todas las DNR de la semana, le
        cuenten o no), o «Esta semana no llevas ninguna» con su ✓ verde SOLO si hay datos de esta semana. Si no los hay
        (de domingo a martes, más o menos, la semana en curso aún no tiene ninguno) lo dice, neutra, y «La semana pasada»,
        la que acaba de llegar, sale abierta sin tocarla (revisión final, R7: F3/F6). Debajo, el desglose (solo con 2 o
        más) y «Hay datos hasta el …».
     2. El RECORDATORIO, siempre a la vista bajo la frase, con las palabras de Dani.
     3. Cuáles son: una tarjeta por DNR con, arriba y en su propia fila, su estado y «Nueva»/«Actualizada»; debajo, qué día
        es cada cosa (R7, F8/F9: «Entregado el sáb, 7/11» si el servidor sabe el día de la entrega, y siempre «DNR del lun,
        9/11», el día por el que cuenta) y su CP; el paquete, entero en su línea; y, debajo de una línea, QUÉ PASÓ en
        frases cortas con su icono, solo lo que el servidor ha entendido con seguridad (lo que llega a null, o con un valor
        que esta versión no conoce, no se dice) y, si toca, «Lo que puedes hacer la próxima vez».
     4. Las semanas anteriores, discretas: una línea por semana con su recuento y, bajo su rango, su desglose (R7, F17),
        que se abre al tocarla, con las mismas tarjetas.
     5. Qué es cada estado (cada frase bajo su etiqueta) y, siempre que tiene ID, «¿Alguna no es tuya? Díselo a la
        oficina.» (qué ID es de quién lo decide la oficina; la app no tiene otra forma de saberlo).
   SIN euros ni el ID, nunca (Dani, 11-11): el servidor no los manda y aquí no hay dónde ponerlos. Solo con las piezas de
   ui/Componentes.kt y los tokens de ui/Tema.kt (lo vigila scripts/check-tokens-nativa.mjs). */

/** Lo nuevo desde la última vez que abrió la pantalla en este móvil: lo que no estaba (NUEVA) o lo que cambió de estado
 *  (ACTUALIZADA). Se cuentan APARTE (R7, F4/F16): una que solo cambió de estado no es una DNR nueva y no suma al número
 *  rojo de la fila del inicio. */
internal enum class MarcaDnr { NUEVA, ACTUALIZADA }

/** En cuál de los casos está ESTA semana, como `casoSemana` de la web (R7, F3/F6):
 *  - LLEVA: tiene DNR esta semana (si las hay, hay datos de esta semana);
 *  - SIN_REPORTES: `datos_hasta` es null, su centro aún no tiene ningún reporte;
 *  - SIN_DATOS_SEMANA: los datos acaban antes del domingo de esta semana;
 *  - NINGUNA: hay datos de esta semana y ninguna DNR suya.
 *  Nada calcula «hoy»: la semana y `datos_hasta` los da el servidor. */
internal enum class CasoSemana { LLEVA, SIN_REPORTES, SIN_DATOS_SEMANA, NINGUNA }

/** El color de una frase de «qué pasó», como en la web: un dato sin más (gris), lo que estuvo bien (verde), lo que es
 *  para fijarse (ámbar) y lo que le hizo fallar (rojo). */
internal enum class ColorHecho { DATO, BIEN, AVISO, MAL }

/** El dibujo de cada frase de «qué pasó» (el icono se elige al pintar: así la lógica se prueba sin Compose). */
internal enum class DibujoHecho { PUERTA, BUZON, MANO, RECEPCION, VECINO, LOCKER, COMERCIO, JARDIN, SITIO, LEJOS, CERCA, LLAMO, NO_LLAMO, CONTACTO, FOTO_MAL, FOTO_BIEN }

/** Una frase de «qué pasó»: `clave` dice de qué habla (como, lejos, llamada, contacto o foto). */
internal data class Hecho(val clave: String, val texto: String, val dibujo: DibujoHecho, val color: ColorHecho)

/** Lo que se calcula sin pintar nada, aparte para probarlo (DnrConductorTest): las frases con su singular y su plural,
 *  las fechas, qué pasó con cada DNR y qué hay de nuevo. */
internal object DnrConductor {
    /** El sitio del número en la frase grande: se traduce con este hueco y el número se pinta aparte, más grande, así cada
     *  idioma lo pone donde le toca (como la web). */
    const val HUECO = "\u0001"

    /** La frase grande partida por el número: lo de antes y lo de después. El singular lleva su propia clave ({uno}):
     *  en español se escribe igual, pero en inglés y en alemán no («1 DNR» / «5 DNRs»). Con 0, la frase entera y nada
     *  después: no hay número que destacar. */
    fun partesFrase(n: Int): Pair<String, String> {
        if (n <= 0) return tx("Esta semana no llevas ninguna") to ""
        val f = if (n == 1) tx("Esta semana llevas {uno} DNR", "uno" to HUECO) else tx("Esta semana llevas {n} DNR", "n" to HUECO)
        val p = f.split(HUECO, limit = 2)
        return p[0] to p.getOrElse(1) { "" }
    }

    /** La frase grande entera: «Esta semana llevas 1 DNR», «… 5 DNR», «Esta semana no llevas ninguna». */
    fun fraseSemana(n: Int): String {
        val (antes, despues) = partesFrase(n)
        return if (n <= 0) antes else antes + n + despues
    }

    /** ESTA semana, en cuál de los casos está; null si no hay semanas (sin ID, o con todos sus ID en revisión). */
    fun casoSemana(d: MisDnr): CasoSemana? {
        val s = d.semanas.firstOrNull() ?: return null
        if (s.dnr.isNotEmpty()) return CasoSemana.LLEVA
        val hasta = d.datos_hasta
        if (hasta.isNullOrEmpty()) return CasoSemana.SIN_REPORTES
        // Las dos son AAAA-MM-DD: se comparan como texto, igual que la web.
        if (hasta < s.semana) return CasoSemana.SIN_DATOS_SEMANA
        return CasoSemana.NINGUNA
    }

    /** La frase grande cuando no lleva ninguna: «no llevas ninguna» (con su ✓ verde) solo si hay datos de esta semana; si
     *  no, lo que pasa, neutra. */
    fun fraseSinNinguna(caso: CasoSemana?): String = when (caso) {
        CasoSemana.SIN_REPORTES -> tx("Aún no hay reportes de tu centro")
        CasoSemana.SIN_DATOS_SEMANA -> tx("De esta semana aún no hay reportes")
        else -> fraseSemana(0)
    }

    /** «La semana pasada» (la primera de las anteriores, i = 1) sale abierta sin tocarla cuando de esta semana aún no hay
     *  datos: es la que acaba de llegar. */
    fun abiertaSinTocar(i: Int, caso: CasoSemana?): Boolean = i == 1 && caso == CasoSemana.SIN_DATOS_SEMANA

    /** El aviso de la revisión de la oficina; null si no hay. Va ANTES que las semanas: con todos sus ID en revisión el
     *  servidor manda `semanas` vacía y lo único que hay que decir es esto. */
    fun avisoRevision(d: MisDnr): String? = when {
        !d.en_revision -> null
        d.semanas.isEmpty() -> tx("La oficina está revisando tu ID de reparto. Cuando lo confirme, aquí verás tus DNR.")
        else -> tx("La oficina está revisando uno de tus ID de reparto: puede que aquí falte alguna.")
    }

    /** El desglose de la semana («1 te cuenta · 1 sin clasificar»): solo lo que hay, con su singular y su plural. */
    fun desglose(s: SemanaDnr): String {
        val c = s.dnr.count { it.estado == "cuenta" }
        val nc = s.dnr.count { it.estado == "no_cuenta" }
        val sc = s.dnr.size - c - nc
        return listOfNotNull(
            if (c == 0) null else if (c == 1) tx("1 te cuenta") else tx("{n} te cuentan", "n" to c),
            if (nc == 0) null else if (nc == 1) tx("1 no te cuenta") else tx("{n} no te cuentan", "n" to nc),
            if (sc == 0) null else if (sc == 1) tx("1 sin clasificar") else tx("{n} sin clasificar", "n" to sc),
        ).joinToString(" · ")
    }

    /** Cuántas tuvo una semana anterior: «1 DNR», «3 DNR» o «Ninguna». */
    fun cuantas(n: Int): String = when {
        n <= 0 -> tx("Ninguna")
        n == 1 -> tx("1 DNR")
        else -> tx("{n} DNR", "n" to n)
    }

    /** «1 nueva», «3 nuevas»; null si no hay ninguna. */
    fun nuevas(n: Int): String? = when {
        n <= 0 -> null
        n == 1 -> tx("1 nueva")
        else -> tx("{n} nuevas", "n" to n)
    }

    /** «1 actualizada», «3 actualizadas»; null si no hay ninguna. */
    fun actualizadas(n: Int): String? = when {
        n <= 0 -> null
        n == 1 -> tx("1 actualizada")
        else -> tx("{n} actualizadas", "n" to n)
    }

    /** Cuántas marcas de un tipo hay. */
    fun contar(marcas: Map<String, MarcaDnr>, cual: MarcaDnr): Int = marcas.values.count { it == cual }

    /** El subtítulo de la cabecera: «2 nuevas · 1 actualizada», o lo que haya; null si no hay nada. */
    fun novedadesEnCorto(marcas: Map<String, MarcaDnr>): String? =
        listOfNotNull(nuevas(contar(marcas, MarcaDnr.NUEVA)), actualizadas(contar(marcas, MarcaDnr.ACTUALIZADA)))
            .joinToString(" · ").ifEmpty { null }

    /** La línea de la fila del inicio, como la casilla de la web: «Esta semana: 2», «Esta semana: ninguna» o, si de esta
     *  semana aún no hay datos (o su centro no tiene ninguno), «Esta semana: aún sin datos». */
    fun lineaInicio(d: MisDnr): String? = when (casoSemana(d)) {
        null -> null
        CasoSemana.LLEVA -> tx("Esta semana: {n}", "n" to d.semanas.first().dnr.size)
        CasoSemana.NINGUNA -> tx("Esta semana: ninguna")
        else -> tx("Esta semana: aún sin datos")
    }

    /** La fila del inicio: el número rojo cuenta SOLO las nuevas (las actualizadas no suman, R7 F4/F16). */
    fun filaInicio(d: MisDnr, vistas: Map<String, String>?): FilaDnrInicio =
        FilaDnrInicio(contar(novedades(d, vistas), MarcaDnr.NUEVA), lineaInicio(d))

    fun textoMarca(m: MarcaDnr): String = if (m == MarcaDnr.NUEVA) tx("Nueva") else tx("Actualizada")

    /** Los tres estados, en su orden, con lo que quieren decir; lo que no se conozca (un servidor más nuevo), como «sin
     *  clasificar». */
    val ESTADOS = listOf("cuenta", "no_cuenta", "sin_clasificar")
    fun textoEstado(estado: String): String = when (estado) {
        "cuenta" -> tx("Te cuenta")
        "no_cuenta" -> tx("No te cuenta")
        else -> tx("Sin clasificar")
    }
    fun explicaEstado(estado: String): String = when (estado) {
        "cuenta" -> tx("Amazon te la apunta como fallo.")
        "no_cuenta" -> tx("Amazon la revisó y no te la apunta.")
        else -> tx("Amazon aún no la ha revisado; suele tardar unos días.")
    }

    /* ── Qué pasó (11-11-2026, segunda vuelta): las MISMAS frases y condiciones que quePaso() y proximaVez() de la web. ── */

    /** Cómo lo marcó, con su frase y su dibujo; null si no viene o es un valor que esta versión no conoce. */
    fun como(como: String?): Pair<String, DibujoHecho>? = when (como) {
        "puerta" -> tx("Lo marcaste en la puerta") to DibujoHecho.PUERTA
        "puerta_trasera" -> tx("Lo marcaste en la puerta de atrás") to DibujoHecho.PUERTA
        "buzon" -> tx("Lo marcaste en el buzón") to DibujoHecho.BUZON
        "en_mano" -> tx("Lo marcaste como entregado en mano") to DibujoHecho.MANO
        "familiar" -> tx("Lo marcaste como entregado a alguien de la casa") to DibujoHecho.MANO
        "recepcion" -> tx("Lo marcaste en recepción") to DibujoHecho.RECEPCION
        "conserjeria" -> tx("Lo marcaste en conserjería") to DibujoHecho.RECEPCION
        "vecino" -> tx("Lo marcaste como entregado a un vecino") to DibujoHecho.VECINO
        "locker" -> tx("Lo marcaste en un locker") to DibujoHecho.LOCKER
        "comercio" -> tx("Lo marcaste en un comercio") to DibujoHecho.COMERCIO
        "jardin" -> tx("Lo marcaste en el jardín") to DibujoHecho.JARDIN
        "lugar_seguro" -> tx("Lo marcaste en un lugar seguro") to DibujoHecho.SITIO
        "garaje" -> tx("Lo marcaste en el garaje") to DibujoHecho.SITIO
        "cobertizo" -> tx("Lo marcaste en el cobertizo") to DibujoHecho.SITIO
        else -> null
    }

    /** El motivo de la foto en llano; null si no viene o no se conoce (entonces la frase va sin motivo). */
    fun motivoFoto(m: String?): String? = when (m) {
        "borrosa" -> tx("salió borrosa")
        "oscura" -> tx("salió muy oscura")
        "sin_paquete" -> tx("no se veía el paquete")
        "muy_cerca" -> tx("estaba hecha demasiado cerca")
        "persona" -> tx("salía una persona")
        "en_furgoneta" -> tx("el paquete estaba en la furgoneta")
        "sin_foto" -> tx("no había foto")
        else -> null
    }

    /** QUÉ PASÓ: solo lo que se sabe, en el orden en que pasó (dónde lo dejó, a qué distancia, la llamada y la foto).
     *  «No llamaste» solo con `llamada` = «no»; el fallo de contacto, si no se ha dicho ya que no llamó; de la foto, nada
     *  si `foto` no es «mal» ni «bien». */
    fun quePaso(x: UnaDnr): List<Hecho> {
        val out = mutableListOf<Hecho>()
        como(x.como)?.let { (texto, dibujo) -> out += Hecho("como", texto, dibujo, ColorHecho.DATO) }
        when (x.lejos) {
            true -> out += Hecho("lejos", tx("Lo marcaste a más de 25 m del sitio"), DibujoHecho.LEJOS, ColorHecho.AVISO)
            false -> out += Hecho("lejos", tx("Lo marcaste a menos de 25 m del sitio"), DibujoHecho.CERCA, ColorHecho.BIEN)
            null -> {}
        }
        if (x.llamada == "si") {
            val s = x.segundos
            out += Hecho("llamada", if (s != null && s > 0) tx("Llamaste al cliente ({n} s)", "n" to s) else tx("Llamaste al cliente"),
                DibujoHecho.LLAMO, ColorHecho.DATO)
        }
        if (x.llamada == "no") out += Hecho("llamada", tx("No llamaste al cliente"), DibujoHecho.NO_LLAMO, ColorHecho.MAL)
        else if (x.fallo_contacto == true) out += Hecho("contacto", tx("Te apuntaron un fallo de contacto con el cliente"), DibujoHecho.CONTACTO, ColorHecho.MAL)
        if (x.foto == "mal") {
            val motivo = motivoFoto(x.foto_motivo)
            out += Hecho("foto", if (motivo != null) tx("La foto no pasó la revisión: {motivo}", "motivo" to motivo) else tx("La foto no pasó la revisión"),
                DibujoHecho.FOTO_MAL, ColorHecho.MAL)
        }
        if (x.foto == "bien") out += Hecho("foto", tx("La foto pasó la revisión"), DibujoHecho.FOTO_BIEN, ColorHecho.BIEN)
        return out
    }

    /** Lo que puede hacer la próxima vez: solo si SE SABE que no llamó, que le apuntaron un fallo de contacto o que la foto
     *  falló. Con el fallo de contacto (y sin «no llamó»), un consejo prudente que no afirma que no llamara (R7, F30);
     *  nunca salen los dos. */
    fun proximaVez(x: UnaDnr): List<String> = listOfNotNull(
        when {
            x.llamada == "no" -> tx("Llama al cliente antes de dejar el paquete.")
            x.fallo_contacto == true -> tx("Contacta con el cliente antes de dejar el paquete.")
            else -> null
        },
        if (x.foto == "mal") tx("Saca la foto con el paquete y el sitio bien a la vista.") else null,
    )

    private fun fecha(iso: String, patron: String): String = runCatching {
        LocalDate.parse(iso).format(DateTimeFormatter.ofPattern(patron, LOCALE_APP))
    }.getOrDefault(iso)

    /** «Del 8/11 al 14/11» (la semana de Amazon va de domingo a sábado). */
    fun rango(s: SemanaDnr): String = tx("Del {desde} al {hasta}", "desde" to fecha(s.semana, "d/M"), "hasta" to fecha(s.hasta, "d/M"))

    /** Un día, en corto y en minúscula, como la web dentro de su frase: «sáb, 7/11» (sin el punto que Java pone a la
     *  abreviatura: «sáb.»). Una fecha que no se entiende sale tal cual. */
    fun dia(iso: String): String = runCatching {
        val d = LocalDate.parse(iso)
        "${d.format(DateTimeFormatter.ofPattern("EEE", LOCALE_APP)).trimEnd('.')}, ${d.format(DateTimeFormatter.ofPattern("d/M", LOCALE_APP))}"
    }.getOrDefault(iso)

    private val ISO = Regex("^\\d{4}-\\d{2}-\\d{2}$")

    /** El día de la entrega, solo si llega como fecha AAAA-MM-DD (el servidor ya manda null lo dudoso; esto es por si
     *  acaso, como `esDia` de la web). */
    fun entregaDe(x: UnaDnr): String? = x.entrega?.takeIf { ISO.matches(it) }

    /** «DNR del lun, 9/11»: el día por el que cuenta (la concesión), el que agrupa las semanas. */
    fun dnrDel(x: UnaDnr): String = tx("DNR del {dia}", "dia" to dia(x.dia))

    /** La línea de encima del paquete (R7, F8/F9): con el día de la entrega, «Entregado el sáb, 7/11 · CP 15704»; sin él,
     *  «DNR del lun, 9/11 · CP 15704». Sin CP, solo el día. */
    fun cabeceraTarjeta(x: UnaDnr): String = listOfNotNull(
        entregaDe(x)?.let { tx("Entregado el {dia}", "dia" to dia(it)) } ?: dnrDel(x),
        x.cp?.trim()?.takeIf { it.isNotEmpty() }?.let { tx("CP {cp}", "cp" to it) },
    ).joinToString(" · ")

    /** La línea discreta de bajo el paquete: «DNR del lun, 9/11», solo si arriba va el día de la entrega. */
    fun concesionTarjeta(x: UnaDnr): String? = if (entregaDe(x) != null) dnrDel(x) else null

    /** Hasta qué día hay datos («Hay datos hasta el martes, 10/11», sin punto final: en alemán la fecha ya acaba en uno);
     *  null si `datos_hasta` es null (entonces la frase grande ya dice que su centro no tiene reportes). */
    fun hastaCuando(datosHasta: String?): String? =
        if (datosHasta.isNullOrBlank()) null
        else tx("Hay datos hasta el {fecha}", "fecha" to fecha(datosHasta, "EEEE, d/M"))

    /** La huella de un paquete, la misma que la web (dnrVistas.js, R7 F13): FNV-1a de 32 bits en base 36. En un móvil
     *  compartido, lo apuntado no dice qué paquetes eran. */
    fun huella(paquete: String): String {
        var h = 0x811c9dc5.toInt()
        for (ch in paquete) {
            h = h xor ch.code
            h *= 0x01000193
        }
        return (h.toLong() and 0xffffffffL).toString(36)
    }

    /** Lo que se apunta al abrir la pantalla: la huella de cada paquete con su estado (de las 4 semanas). */
    fun vistasDe(d: MisDnr): Map<String, String> =
        d.semanas.flatMap { it.dnr }.filter { it.paquete.isNotBlank() }.associate { huella(it.paquete) to it.estado }

    /** Lo nuevo frente a lo que vio la última vez (`vistas`, por huella; null = nunca abrió la pantalla en este móvil, y
     *  entonces todas son nuevas, como en la web), por paquete: lo que no estaba, «nueva»; lo que cambió de estado,
     *  «actualizada». */
    fun novedades(d: MisDnr, vistas: Map<String, String>?): Map<String, MarcaDnr> {
        val out = LinkedHashMap<String, MarcaDnr>()
        for (x in d.semanas.flatMap { it.dnr }) {
            if (x.paquete.isBlank()) continue
            val h = huella(x.paquete)
            when {
                vistas == null || !vistas.containsKey(h) -> out[x.paquete] = MarcaDnr.NUEVA
                vistas[h] != x.estado -> out[x.paquete] = MarcaDnr.ACTUALIZADA
            }
        }
        return out
    }
}

/** El color y el icono de cada estado (el color solo no se distingue al sol ni sin ver colores): le cuenta, en peligro;
 *  no le cuenta, en gris (R7, F31: en verde relleno pesaba más a la vista que «Te cuenta», que es la que importa); sin
 *  clasificar, en aviso. Como la web. */
internal fun tonoEstado(estado: String): Pair<Tono, ImageVector> = when (estado) {
    "cuenta" -> Tono.PELIGRO to Icons.Default.Warning
    "no_cuenta" -> Tono.NEUTRO to Icons.Default.Check
    else -> Tono.AVISO to Icons.Default.Schedule
}

private fun iconoDe(d: DibujoHecho): ImageVector = when (d) {
    DibujoHecho.PUERTA -> Icons.Default.DoorFront
    DibujoHecho.BUZON -> Icons.Default.MarkunreadMailbox
    DibujoHecho.MANO -> Icons.Default.PanTool
    DibujoHecho.RECEPCION -> Icons.Default.RoomService
    DibujoHecho.VECINO -> Icons.Default.Group
    DibujoHecho.LOCKER -> Icons.Default.Lock
    DibujoHecho.COMERCIO -> Icons.Default.Store
    DibujoHecho.JARDIN -> Icons.Default.Park
    DibujoHecho.SITIO, DibujoHecho.CERCA -> Icons.Default.Place
    DibujoHecho.LEJOS -> Icons.Default.LocationOff
    DibujoHecho.LLAMO -> Icons.Default.PhoneInTalk
    DibujoHecho.NO_LLAMO -> Icons.Default.PhoneDisabled
    DibujoHecho.CONTACTO -> Icons.Default.Phone
    DibujoHecho.FOTO_MAL -> Icons.Default.NoPhotography
    DibujoHecho.FOTO_BIEN -> Icons.Default.PhotoCamera
}

/** El color de cada frase de «qué pasó», con lo que ya tiene el tema: gris, el verde de «entregado», el ámbar del aviso y
 *  el rojo del error (todos medidos sobre la superficie en TemaTest). */
@Composable
private fun colorDe(c: ColorHecho): Color = when (c) {
    ColorHecho.DATO -> MaterialTheme.colorScheme.onSurfaceVariant
    ColorHecho.BIEN -> LocalExtra.current.entregadoTexto
    ColorHecho.AVISO -> LocalExtra.current.enAviso
    ColorHecho.MAL -> MaterialTheme.colorScheme.error
}

/** La pantalla. Con 404 (la empresa no tiene la DNR diaria) o 403 (su ficha está de baja) vuelve sin enseñar nada y sin
 *  volver a pedirla: para la app, no existe. */
@Composable
fun DnrConductorNativo(alVolver: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    var datos by remember { mutableStateOf<MisDnr?>(null) }
    var marcas by remember { mutableStateOf<Map<String, MarcaDnr>>(emptyMap()) }
    var error by remember { mutableStateOf(false) }
    var intento by remember { mutableIntStateOf(0) }
    BackHandler(onBack = alVolver)
    LaunchedEffect(intento) {
        error = false
        try {
            val d = app.repo.misDnr()
            if (d == null) { alVolver(); return@LaunchedEffect }
            // Lo nuevo se calcula con lo apuntado la vez anterior y, al momento, se apunta lo de ahora: la marca se ve
            // esta vez y la próxima ya no (como la web). Si el móvil no lo puede guardar, solo saldrán otra vez como nuevas.
            marcas = DnrConductor.novedades(d, runCatching { app.cuenta.dnrVistas() }.getOrNull())
            runCatching { app.cuenta.guardarDnrVistas(DnrConductor.vistasDe(d)) }
            datos = d
        } catch (_: ErrorApi) {
            error = true
        }
    }
    Scaffold(
        topBar = { Cabecera(tx("Mis DNR"), subtitulo = DnrConductor.novedadesEnCorto(marcas), alVolver = alVolver) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { inset ->
        val d = datos
        when {
            d == null && error -> Column(Modifier.fillMaxSize().padding(inset).padding(Esp.l)) {
                Aviso(tx("No se han podido cargar tus DNR."), tono = Tono.PELIGRO, accion = tx("Reintentar"), alAccion = { intento++ })
            }
            d == null -> Box(Modifier.fillMaxSize().padding(inset), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            else -> Column(
                Modifier.fillMaxSize().padding(inset).verticalScroll(rememberScrollState()).padding(horizontal = Esp.l)
                    .padding(top = Esp.s, bottom = Esp.xl),
                verticalArrangement = Arrangement.spacedBy(Esp.xl),
            ) {
                val caso = DnrConductor.casoSemana(d)
                if (!d.tiene_id) Aviso(tx("La oficina aún no ha enlazado tu ID de reparto. Cuando lo haga, aquí verás tus DNR."),
                    icono = Icons.Default.Inventory2, maxLineas = 4)
                // La revisión, antes que las semanas: con todos sus ID en revisión, `semanas` llega vacía.
                DnrConductor.avisoRevision(d)?.let { Aviso(it, tono = Tono.AVISO, icono = Icons.Default.Schedule, maxLineas = 4) }
                d.semanas.firstOrNull()?.let { EstaSemana(it, caso, marcas, DnrConductor.hastaCuando(d.datos_hasta)) }
                val anteriores = d.semanas.drop(1)
                if (anteriores.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(Esp.s)) {
                        TituloBloque(tx("Semanas anteriores"))
                        ContenedorLista(anteriores.size, separadorDesde = 0.dp) { i ->
                            SemanaAnterior(anteriores[i], i + 1, marcas, abiertaSinTocar = DnrConductor.abiertaSinTocar(i + 1, caso))
                        }
                    }
                }
                if (d.semanas.isNotEmpty()) QueEsCadaEstado()
                if (d.tiene_id) NoEsMia()
            }
        }
    }
}

/** La cabecera de un bloque, en `etiqueta` gris (como las secciones de Ajustes y la web). */
@Composable
private fun TituloBloque(texto: String) {
    Text(texto, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = Esp.xs).semantics { heading() })
}

/** ESTA semana: las fechas, la frase grande, el desglose, hasta cuándo hay datos, el recordatorio y, debajo, cuáles son. */
@Composable
private fun EstaSemana(s: SemanaDnr, caso: CasoSemana?, marcas: Map<String, MarcaDnr>, hasta: String?) {
    val c = MaterialTheme.colorScheme
    val n = s.dnr.size
    Column(verticalArrangement = Arrangement.spacedBy(Esp.l)) {
        Column(Modifier.padding(horizontal = Esp.xs), verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
            Text(DnrConductor.rango(s), style = MaterialTheme.typography.bodySmall.merge(TextoNumero), color = c.onSurfaceVariant)
            if (n > 0) FraseSemana(n, cuentan = s.dnr.any { it.estado == "cuenta" })
            else SinNinguna(caso)
            if (n > 1) Text(DnrConductor.desglose(s), style = MaterialTheme.typography.bodyMedium.merge(TextoNumero), color = c.onSurfaceVariant)
            hasta?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = c.onSurfaceVariant) }
        }
        Recordatorio()
        if (n > 0) Tarjetas(s.dnr, marcas)
    }
}

/** La frase grande cuando no lleva ninguna. Con el ✓ en su círculo verde SOLO si hay datos de esta semana (que se vea de
 *  un vistazo que no hay nada de qué preocuparse); si no, neutra, con el reloj en un círculo gris (R7, F3/F6). */
@Composable
private fun SinNinguna(caso: CasoSemana?) {
    val ninguna = caso == CasoSemana.NINGUNA
    val x = LocalExtra.current
    val c = MaterialTheme.colorScheme
    Row(verticalAlignment = Alignment.CenterVertically) {
        Surface(shape = CircleShape, color = if (ninguna) x.entregado else c.surfaceVariant,
            contentColor = if (ninguna) x.enEntregado else c.onSurfaceVariant) {
            Icon(if (ninguna) Icons.Default.Check else Icons.Default.Schedule, contentDescription = null,
                modifier = Modifier.padding(Esp.s).size(24.dp))
        }
        Spacer(Modifier.width(Esp.m))
        Text(DnrConductor.fraseSinNinguna(caso), style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.weight(1f).semantics { heading() })
    }
}

/** «Esta semana llevas N DNR» en la letra `cifra`, con el número en la de `paquete` (como la web, text-paquete): en rojo
 *  si alguna le cuenta; si no, en el color del texto (una sin clasificar o que no cuenta no es para alarmarse). La línea
 *  toma el alto del número, para que, si la frase salta de línea, el número no pise la de arriba. */
@Composable
private fun FraseSemana(n: Int, cuentan: Boolean) {
    val grande = MaterialTheme.typography.displayMedium
    val color = if (cuentan) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
    val (antes, despues) = DnrConductor.partesFrase(n)
    val texto = buildAnnotatedString {
        append(antes)
        withStyle(grande.toSpanStyle().copy(color = color)) { append(n.toString()) }
        append(despues)
    }
    Text(texto, style = MaterialTheme.typography.headlineMedium.copy(lineHeight = grande.lineHeight), modifier = Modifier.semantics { heading() })
}

/** El recordatorio de Dani, siempre a la vista bajo la frase grande: en el tinte de la marca, con la bombilla. Entero,
 *  sin cortar (con la letra grande ocupa más líneas). */
@Composable
private fun Recordatorio() {
    val c = MaterialTheme.colorScheme
    Surface(color = c.primaryContainer, contentColor = c.onPrimaryContainer, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(Esp.m), verticalAlignment = Alignment.Top) {
            Icon(Icons.Default.Lightbulb, contentDescription = null, modifier = Modifier.padding(top = 2.dp).size(20.dp))
            Spacer(Modifier.width(Esp.m))
            Text(tx("Recuerda: si el cliente tiene preferencia de entrega, llama y saca bien la foto; así no te cuenta."),
                style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        }
    }
}

/** Las DNR de una semana, una tarjeta cada una, con 8 entre ellas. */
@Composable
private fun Tarjetas(dnr: List<UnaDnr>, marcas: Map<String, MarcaDnr>) {
    Column(verticalArrangement = Arrangement.spacedBy(Esp.s)) { dnr.forEach { TarjetaDnr(it, marcas[it.paquete]) } }
}

/** Una DNR, en su tarjeta, como la web final: arriba, en su propia fila, el estado y «Nueva»/«Actualizada» (al lado del
 *  día, unas veces cabían y otras no, y cada tarjeta salía de una forma); debajo, qué día es y el CP; el paquete, entero
 *  en una línea (es lo que se busca en el reporte, y partido se lee mal: R7, F27); si arriba va el día de la entrega,
 *  «DNR del …» más discreto; y, debajo de una línea, qué pasó y, si toca, lo que puede hacer la próxima vez. */
@Composable
private fun TarjetaDnr(x: UnaDnr, marca: MarcaDnr?) {
    val c = MaterialTheme.colorScheme
    val (tono, icono) = tonoEstado(x.estado)
    val hechos = DnrConductor.quePaso(x)
    val consejos = DnrConductor.proximaVez(x)
    Surface(color = c.surfaceContainerLow, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(Esp.m)) {
            Column(Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(Esp.xs), verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
                    Etiqueta(DnrConductor.textoEstado(x.estado), tono = tono, icono = icono)
                    marca?.let { Etiqueta(DnrConductor.textoMarca(it), tono = Tono.MARCA) }
                }
                Text(DnrConductor.cabeceraTarjeta(x), style = MaterialTheme.typography.bodySmall.merge(TextoNumero), color = c.onSurfaceVariant,
                    modifier = Modifier.padding(top = Esp.s))
                Text(x.paquete, style = MaterialTheme.typography.titleMedium.merge(TextoNumero).copy(fontFamily = FontFamily.Monospace),
                    maxLines = 1, softWrap = false)
                DnrConductor.concesionTarjeta(x)?.let {
                    Text(it, style = MaterialTheme.typography.labelSmall.merge(TextoNumero), color = c.onSurfaceVariant)
                }
            }
            if (hechos.isNotEmpty()) {
                SeparadorLista(Modifier.padding(top = Esp.m), desde = 0.dp)
                Column(Modifier.padding(top = Esp.m), verticalArrangement = Arrangement.spacedBy(Esp.s)) {
                    hechos.forEach { h ->
                        Row(Modifier.semantics(mergeDescendants = true) {}, verticalAlignment = Alignment.Top) {
                            Icon(iconoDe(h.dibujo), contentDescription = null, tint = colorDe(h.color), modifier = Modifier.padding(top = 1.dp).size(18.dp))
                            Spacer(Modifier.width(Esp.s))
                            Text(h.texto, style = MaterialTheme.typography.bodyMedium.merge(TextoNumero), modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
            if (consejos.isNotEmpty()) ProximaVez(consejos, Modifier.padding(top = Esp.m))
        }
    }
}

/** «Lo que puedes hacer la próxima vez», en ámbar: el título con la bombilla, en `boton` para que mande sobre sus
 *  consejos, que van en letra normal (R7, F29), alineados con su texto (no con el icono), como la web. */
@Composable
private fun ProximaVez(consejos: List<String>, modifier: Modifier = Modifier) {
    val x = LocalExtra.current
    Surface(color = x.aviso, contentColor = x.enAviso, shape = MaterialTheme.shapes.small, modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(Esp.m).semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Lightbulb, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(Esp.s))
                Text(tx("Lo que puedes hacer la próxima vez"), style = MaterialTheme.typography.labelLarge)
            }
            consejos.forEach { Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(start = 16.dp + Esp.s)) }
        }
    }
}

/** Una semana anterior: una línea con su recuento y, bajo su rango, su desglose (R7, F17) y sus nuevas y actualizadas,
 *  cada una en su etiqueta (F4/F16), que se abre al tocarla, con las mismas tarjetas. La que no tuvo ninguna lo dice en
 *  esa línea, en verde, y no se abre (no hay nada que ver). `abiertaSinTocar`: «La semana pasada» cuando de esta semana
 *  aún no hay datos; al tocarla, se cierra. */
@Composable
private fun SemanaAnterior(s: SemanaDnr, i: Int, marcas: Map<String, MarcaDnr>, abiertaSinTocar: Boolean) {
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    val n = s.dnr.size
    // null mientras no la toque: entonces manda `abiertaSinTocar`.
    var tocada by rememberSaveable(s.semana) { mutableStateOf<Boolean?>(null) }
    val abierta = tocada ?: abiertaSinTocar
    val suyas = s.dnr.mapNotNull { marcas[it.paquete] }
    val nuevasAqui = DnrConductor.nuevas(suyas.count { it == MarcaDnr.NUEVA })
    val actualizadasAqui = DnrConductor.actualizadas(suyas.count { it == MarcaDnr.ACTUALIZADA })
    val tocar = if (n > 0) Modifier.clickable(onClickLabel = if (abierta) tx("Cerrar") else tx("Abrir"), role = Role.Button) { tocada = !abierta } else Modifier
    Column {
        Row(
            Modifier.fillMaxWidth().then(tocar).semantics(mergeDescendants = true) {}.heightIn(min = Alto.boton)
                .padding(horizontal = Esp.m, vertical = Esp.s),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(if (i == 1) tx("La semana pasada") else DnrConductor.rango(s), style = MaterialTheme.typography.bodyMedium.merge(TextoNumero))
                if (i == 1) Text(DnrConductor.rango(s), style = MaterialTheme.typography.bodySmall.merge(TextoNumero), color = c.onSurfaceVariant)
                if (n > 0) Text(DnrConductor.desglose(s), style = MaterialTheme.typography.bodySmall.merge(TextoNumero), color = c.onSurfaceVariant)
                if (nuevasAqui != null || actualizadasAqui != null) {
                    FlowRow(Modifier.padding(top = Esp.xs), horizontalArrangement = Arrangement.spacedBy(Esp.xs),
                        verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
                        nuevasAqui?.let { Etiqueta(it, tono = Tono.MARCA) }
                        actualizadasAqui?.let { Etiqueta(it, tono = Tono.NEUTRO) }
                    }
                }
            }
            Spacer(Modifier.width(Esp.s))
            if (n == 0) {
                Icon(Icons.Default.Check, contentDescription = null, tint = x.entregadoTexto, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(Esp.xs))
                Text(DnrConductor.cuantas(0), style = MaterialTheme.typography.labelLarge, color = x.entregadoTexto)
            } else {
                Text(DnrConductor.cuantas(n), style = MaterialTheme.typography.labelLarge.merge(TextoNumero))
                Spacer(Modifier.width(Esp.xs))
                Icon(if (abierta) Icons.Default.ExpandLess else Icons.Default.ExpandMore, contentDescription = null,
                    tint = c.onSurfaceVariant, modifier = Modifier.size(20.dp))
            }
        }
        // Abierta, sus tarjetas sobre el fondo de la pantalla, para que se vea que son de esa semana.
        if (abierta && n > 0) {
            SeparadorLista(desde = 0.dp)
            Column(Modifier.fillMaxWidth().background(c.background).padding(Esp.s)) { Tarjetas(s.dnr, marcas) }
        }
    }
}

/** Qué quiere decir cada estado: al final, con la etiqueta tal cual se ve en las tarjetas y su frase DEBAJO, a todo el
 *  ancho (R7, F32: al lado, en alemán o francés la etiqueta larga dejaba a la frase una columna estrecha). */
@Composable
private fun QueEsCadaEstado() {
    Column(verticalArrangement = Arrangement.spacedBy(Esp.s)) {
        TituloBloque(tx("Qué es cada estado"))
        Column(verticalArrangement = Arrangement.spacedBy(Esp.m)) {
            DnrConductor.ESTADOS.forEach { e ->
                val (tono, icono) = tonoEstado(e)
                Column(Modifier.fillMaxWidth().padding(horizontal = Esp.xs).semantics(mergeDescendants = true) {},
                    verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
                    Etiqueta(DnrConductor.textoEstado(e), tono = tono, icono = icono)
                    Text(DnrConductor.explicaEstado(e), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

/** Al final, en pequeño: qué ID es de quién lo decide la oficina (revisión de seguridad, 11-11-2026, D2). */
@Composable
private fun NoEsMia() {
    val gris = MaterialTheme.colorScheme.onSurfaceVariant
    Row(Modifier.padding(horizontal = Esp.xs).semantics(mergeDescendants = true) {}, verticalAlignment = Alignment.Top) {
        Icon(Icons.AutoMirrored.Filled.HelpOutline, contentDescription = null, tint = gris, modifier = Modifier.padding(top = 1.dp).size(16.dp))
        Spacer(Modifier.width(Esp.s))
        Text(tx("¿Alguna no es tuya? Díselo a la oficina."), style = MaterialTheme.typography.bodySmall, color = gris, modifier = Modifier.weight(1f))
    }
}
