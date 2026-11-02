package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.Guia
import com.flotadsp.fds.data.PasoGuia
import com.flotadsp.fds.ui.Idioma
import com.flotadsp.fds.ui.tx
import java.util.Locale
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong
import kotlin.math.sin
import kotlin.math.sqrt

/* LA GUÍA DENTRO DE LA APP (01-11-2026), la misma que la web desde el 04-10 (frontend/src/lib/guia.js y
   pages/driver/Navegacion.jsx). Dani: «debería ser nuestro propio navegador; si no, no nos destacamos en nada» (José
   Arturo pulsó «Navegar» y se le abrió Google Maps). Aquí va todo lo que se calcula, sin Android dentro, para poder
   probarlo (GuiaTest): distancias y rumbo, dónde cae el móvil sobre la línea de la ruta, cuál es la próxima maniobra y
   cómo se dice, y el motor que decide con cada posición si toca anunciar, si se ha llegado o si hay que recalcular. La
   pantalla (GuiaPantalla) solo pinta y habla. Las indicaciones salen del servidor de rutas de OpenStreetMap; la voz,
   del propio móvil. La ubicación se usa para guiar y NO se guarda. */

/** Un punto del mapa; el servidor los manda como [lat, lng]. */
data class Punto(val lat: Double, val lng: Double) {
    companion object {
        fun de(l: List<Double>?): Punto? = if (l != null && l.size >= 2) Punto(l[0], l[1]) else null
    }
}

/** Una línea con lo recorrido hasta cada vértice, para proyectar sobre ella. */
class LineaPreparada(val linea: List<Punto>, val acum: DoubleArray) {
    val total: Double get() = if (acum.isEmpty()) 0.0 else acum.last()
}

/** Dónde cae un punto sobre la línea: metros recorridos hasta ahí (`hecho`) y a cuántos está de ella (`fuera`). */
data class Proyeccion(val hecho: Double, val fuera: Double)

/** Una maniobra con lo recorrido hasta ella sobre la línea. */
data class PasoSituado(val paso: PasoGuia, val hecho: Double)

/** La ruta del servidor hasta una parada, ya preparada: la línea, las maniobras situadas y lo que dijo de metros y minutos. */
class RutaGuiada(val id: String, val fuente: String, val prep: LineaPreparada, val pasos: List<PasoSituado>, val metros: Int, val minutos: Double?)

/** Lo que decide el motor con cada posición. */
sealed interface Decision {
    data object Nada : Decision
    data class Anunciar(val frase: String) : Decision
    data object Llegado : Decision
    data object Recalcular : Decision
}

/** Lo que se pinta para una posición: la maniobra que toca, la de después, lo que falta hasta ella y lo que queda. */
data class Vista(val paso: PasoSituado?, val luego: PasoSituado?, val falta: Double?, val restante: Double, val minutos: Double?)

/* Las cuentas de geometría, sin librerías. Para tramos de calle (unos pocos km) basta proyectar en plano alrededor
   de la latitud de la ruta. */
object Navegador {
    private const val R = 6371000.0
    private const val RAD = Math.PI / 180

    fun metrosEntre(a: Punto, b: Punto): Double {
        val dLa = (b.lat - a.lat) * RAD
        val dLo = (b.lng - a.lng) * RAD
        val sa = sin(dLa / 2)
        val so = sin(dLo / 2)
        val h = sa * sa + cos(a.lat * RAD) * cos(b.lat * RAD) * so * so
        return 2 * R * asin(min(1.0, sqrt(h)))
    }

    /** Rumbo de a hacia b, en grados desde el norte (0-360). */
    fun rumbo(a: Punto, b: Punto): Double {
        val y = sin((b.lng - a.lng) * RAD) * cos(b.lat * RAD)
        val x = cos(a.lat * RAD) * sin(b.lat * RAD) - sin(a.lat * RAD) * cos(b.lat * RAD) * cos((b.lng - a.lng) * RAD)
        return ((atan2(y, x) / RAD) + 360) % 360
    }

    /** Prepara una línea: lo recorrido hasta cada vértice. */
    fun prepararLinea(linea: List<Punto>): LineaPreparada {
        val acum = DoubleArray(linea.size)
        for (i in 1 until linea.size) acum[i] = acum[i - 1] + metrosEntre(linea[i - 1], linea[i])
        return LineaPreparada(linea, acum)
    }

    /** Busca en toda la línea: con unos miles de vértices son microsegundos. */
    fun proyectar(prep: LineaPreparada, p: Punto): Proyeccion {
        val linea = prep.linea
        if (linea.size < 2) return Proyeccion(0.0, if (linea.isNotEmpty()) metrosEntre(linea[0], p) else Double.POSITIVE_INFINITY)
        val kx = cos(p.lat * RAD) * 111320
        val ky = 110540.0
        val px = p.lng * kx
        val py = p.lat * ky
        var mejor = Proyeccion(0.0, Double.POSITIVE_INFINITY)
        for (i in 0 until linea.size - 1) {
            val ax = linea[i].lng * kx; val ay = linea[i].lat * ky
            val bx = linea[i + 1].lng * kx; val by = linea[i + 1].lat * ky
            val dx = bx - ax; val dy = by - ay
            val l2 = dx * dx + dy * dy
            val t = if (l2 > 0) (((px - ax) * dx + (py - ay) * dy) / l2).coerceIn(0.0, 1.0) else 0.0
            val d = hypot(px - (ax + t * dx), py - (ay + t * dy))
            if (d < mejor.fuera) mejor = Proyeccion(prep.acum[i] + t * (prep.acum[i + 1] - prep.acum[i]), d)
        }
        return mejor
    }

    /** Cada maniobra con lo recorrido hasta ella sobre la línea. */
    fun situarPasos(prep: LineaPreparada, pasos: List<PasoGuia>): List<PasoSituado> =
        pasos.map { PasoSituado(it, Punto.de(it.punto)?.let { p -> proyectar(prep, p).hecho } ?: 0.0) }

    /** La próxima maniobra por delante (con 8 m de margen para no quedarse anunciando la que se acaba de hacer). La
     *  salida no cuenta. */
    fun proximoPaso(pasos: List<PasoSituado>, hecho: Double): Int {
        for (i in pasos.indices) {
            if (i == 0 && pasos.size > 1) continue
            if (pasos[i].hecho > hecho + 8) return i
        }
        return pasos.size - 1
    }

    private fun aDecenas(m: Double): Long = max(10L, (m / 10).roundToLong() * 10)

    // Los decimales con el idioma de la app (01-11-2026, revisión): «1,2 km» en español, «1.2 km» en inglés, y la voz
    // inglesa lee bien el número. Antes la coma iba fija.
    private fun unDecimal(v: Double): String =
        java.text.NumberFormat.getNumberInstance(Idioma.locale).apply { maximumFractionDigits = 1; minimumFractionDigits = 0 }.format(v)

    fun textoDistancia(m: Double?): String = when {
        m == null || !m.isFinite() -> ""
        m < 1000 -> "${aDecenas(m)} m"
        else -> unDecimal((m / 100).roundToLong() / 10.0) + " km"
    }

    /** Lo mismo pero para decirlo en voz alta. */
    fun distanciaHablada(m: Double): String {
        if (m < 1000) return tx("{n} metros", "n" to aDecenas(m))
        val km = (m / 100).roundToLong() / 10.0
        if (km == 1.0) return tx("1 kilómetro")
        return tx("{n} kilómetros", "n" to unDecimal(km))
    }

    /** La primera letra en minúscula, para meter una frase dentro de otra («En 300 metros, gira a la derecha.»). */
    fun minuscula(s: String): String = s.replaceFirstChar { it.lowercase(Locale.ROOT) }

    /** LA FRASE DE CADA MANIOBRA, EN EL IDIOMA DE LA APP. El servidor manda la maniobra en bruto (tipo, modificador y
     *  salida de OSRM) y aquí se escribe; si no viene, la frase del servidor. Misma lógica que la web. */
    fun textoPaso(paso: PasoGuia?): String {
        val m = paso?.maniobra
        if (m == null || m.tipo.isBlank()) return paso?.texto?.takeIf { it.isNotBlank() }?.let { tx(it) } ?: ""
        val calle = paso.calle.trim()
        fun por(accion: String) = if (calle.isNotEmpty()) tx("{accion} por {calle}", "accion" to accion, "calle" to calle) else accion
        val mod = m.mod.orEmpty()
        val giro = when (mod) {
            "uturn" -> tx("Da la vuelta")
            "sharp right" -> tx("Gira cerrado a la derecha")
            "right" -> tx("Gira a la derecha")
            "slight right" -> tx("Ligeramente a la derecha")
            "straight" -> tx("Sigue recto")
            "slight left" -> tx("Ligeramente a la izquierda")
            "left" -> tx("Gira a la izquierda")
            "sharp left" -> tx("Gira cerrado a la izquierda")
            else -> tx("Sigue")
        }
        return when (m.tipo) {
            "hacia_parada" -> tx("Ve hacia la parada")
            "depart" -> if (calle.isNotEmpty()) tx("Sal por {calle}", "calle" to calle) else tx("Empieza la ruta")
            "arrive" -> tx("Has llegado")
            "roundabout", "rotary" -> {
                val ordinales = listOf(tx("primera"), tx("segunda"), tx("tercera"), tx("cuarta"), tx("quinta"), tx("sexta"), tx("séptima"), tx("octava"), tx("novena"), tx("décima"))
                val salida = m.salida
                if (salida != null && salida in 1..ordinales.size) por(tx("En la rotonda, toma la {n} salida", "n" to ordinales[salida - 1]))
                else por(tx("Entra en la rotonda"))
            }
            "exit roundabout", "exit rotary" -> por(tx("Sal de la rotonda"))
            "roundabout turn" -> por(tx("En la rotonda, {giro}", "giro" to minuscula(giro)))
            "new name", "continue" -> if (mod.isEmpty() || mod == "straight") por(tx("Sigue recto")) else por(giro)
            "fork" -> {
                val lado = when {
                    "right" in mod -> tx("a la derecha")
                    "left" in mod -> tx("a la izquierda")
                    else -> tx("recto")
                }
                por(tx("En la bifurcación, mantente {lado}", "lado" to lado))
            }
            "merge" -> por(tx("Incorpórate"))
            "on ramp" -> por(tx("Toma la entrada"))
            "off ramp" -> por(tx("Toma la salida"))
            "end of road" -> por(tx("Al final de la calle, {giro}", "giro" to minuscula(giro)))
            else -> por(giro)
        }
    }

    /** Lo que se dice al tener la ruta: «Vamos a Farmacia Sol. 1,2 kilómetros.» */
    fun fraseVamos(destino: String, metros: Int): String =
        tx("Vamos a {destino}.", "destino" to destino) + " " + distanciaHablada(metros.toDouble()) + "."

    /** Lo que se dice al llegar, con el hueco de la furgoneta si lo hay: «Has llegado a Farmacia Sol. Va detrás, a la izquierda.» */
    fun fraseLlegado(destino: String, hueco: String): String =
        tx("Has llegado a {destino}.", "destino" to destino) +
            (if (hueco.isNotBlank()) " " + tx("Va {sitio}.", "sitio" to Briefing.huecoHablado(hueco)) else "")
}

/** El rumbo del móvil: el del GPS si va a más de 1 m/s; parado o despacio, el de los dos últimos puntos a más de
 *  4 m (el GPS inventa rumbos cuando no te mueves). */
class RumboGps {
    private var anterior: Punto? = null
    var rumbo: Double? = null
        private set

    fun nueva(p: Punto, rumboGps: Double?, velocidad: Double): Double? {
        val ant = anterior
        val movido = ant == null || Navegador.metrosEntre(ant, p) > 4
        if (rumboGps != null && velocidad > 1) rumbo = rumboGps
        else if (ant != null && movido) rumbo = Navegador.rumbo(ant, p)
        if (movido) anterior = p
        return rumbo
    }
}

/* EL MOTOR: con la ruta cargada y cada posición, decide qué hacer. Mismas reglas que la web: has llegado a menos de
   40 m de la puerta (o quedan menos de 25 m de línea y estás sobre ella); te has salido si estás a más de 45 m de la
   línea, y tras 3 posiciones seguidas fuera y 15 s desde la última petición se recalcula (nunca con una ruta en línea
   recta: no hay calles que seguir); cada maniobra se anuncia UNA vez de lejos (a 400 m o menos, más de 130) y otra
   de cerca (a 50 m o menos). El reloj se inyecta para probarlo. */
class MotorGuia(private val ahoraMs: () -> Long = System::currentTimeMillis) {
    companion object {
        const val LLEGADA_M = 40.0
        const val FUERA_M = 45.0
        const val RECALCULAR_CADA = 15_000L
    }

    var ruta: RutaGuiada? = null
        private set
    var pidiendo = false
        private set
    /** La parada a la que se ha llegado (no se vuelve a avisar ni se recalcula hasta que cambie la parada). */
    var llegado: String? = null
        private set
    /** «Ya he llegado» a mano (01-11-2026): igual que la llegada por GPS, deja de anunciar y de recalcular esa parada. */
    fun llegadoAMano(idParada: String) { llegado = idParada }
    private val dichos = HashSet<String>()
    private var ultimaPeticion = 0L
    private var fueraSeguidas = 0

    /** ¿Toca pedir la ruta hasta `idParada`? Parada sin ruta (nueva, o la primera posición); tras un fallo, no antes de 15 s. */
    fun tocaPedir(idParada: String, fallida: Boolean): Boolean =
        !pidiendo && ruta?.id != idParada && !(fallida && ahoraMs() - ultimaPeticion < RECALCULAR_CADA)

    /** Se acaba de lanzar la petición al servidor (la primera o un recálculo). */
    fun pedida() { ultimaPeticion = ahoraMs(); pidiendo = true }

    fun fallida() { pidiendo = false }

    /** La ruta del servidor para `idParada`: se sitúan los pasos y se empieza de cero con lo dicho (los pasos son otros). */
    fun cargar(idParada: String, g: Guia) {
        val prep = Navegador.prepararLinea(g.linea.mapNotNull { Punto.de(it) })
        ruta = RutaGuiada(idParada, g.fuente, prep, Navegador.situarPasos(prep, g.pasos), g.metros, g.minutos)
        pidiendo = false
        fueraSeguidas = 0
        dichos.clear()
    }

    fun posicion(p: Punto, idParada: String, destino: Punto): Decision {
        val r = ruta?.takeIf { it.id == idParada } ?: return Decision.Nada
        if (llegado == idParada) return Decision.Nada
        val (hecho, fuera) = Navegador.proyectar(r.prep, p)
        if (Navegador.metrosEntre(p, destino) < LLEGADA_M || (r.prep.total - hecho < 25 && fuera < FUERA_M)) {
            llegado = idParada
            return Decision.Llegado
        }
        if (r.fuente == "carreteras" && fuera > FUERA_M) {
            fueraSeguidas += 1
            val toca = fueraSeguidas >= 3 && ahoraMs() - ultimaPeticion > RECALCULAR_CADA && !pidiendo
            return if (toca) Decision.Recalcular else Decision.Nada
        }
        fueraSeguidas = 0
        val i = Navegador.proximoPaso(r.pasos, hecho)
        val paso = r.pasos.getOrNull(i) ?: return Decision.Nada
        if (paso.paso.icono == "llegada") return Decision.Nada
        val falta = paso.hecho - hecho
        val clave = "${r.id}:$i"
        if (falta <= 400 && falta > 130 && dichos.add("$clave:lejos")) {
            val redondeada = (falta / 50).roundToLong() * 50.0
            return Decision.Anunciar(tx("En {distancia}, {accion}.", "distancia" to Navegador.distanciaHablada(redondeada),
                "accion" to Navegador.minuscula(Navegador.textoPaso(paso.paso))))
        }
        if (falta <= 50 && dichos.add("$clave:cerca")) return Decision.Anunciar(Navegador.textoPaso(paso.paso) + ".")
        return Decision.Nada
    }

    /** Lo que se pinta para `idParada` desde `p` (sin posición aún, desde el principio de la ruta); null sin ruta. */
    fun vista(idParada: String, p: Punto?): Vista? {
        val r = ruta?.takeIf { it.id == idParada } ?: return null
        val proy = p?.let { Navegador.proyectar(r.prep, it) }
        val i = Navegador.proximoPaso(r.pasos, proy?.hecho ?: 0.0)
        val paso = r.pasos.getOrNull(i)
        val falta = if (paso != null && proy != null) max(0.0, paso.hecho - proy.hecho) else paso?.paso?.metros?.toDouble()
        val restante = max(0.0, r.prep.total - (proy?.hecho ?: 0.0))
        val minutos = r.minutos?.takeIf { r.prep.total > 0 }?.let { it * restante / r.prep.total }
        return Vista(paso, r.pasos.getOrNull(i + 1), falta, restante, minutos)
    }
}
