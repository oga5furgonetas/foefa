package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.Incidencia
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.ui.tx
import java.text.Normalizer

/* LO QUE PIDE LA CALLE (30-10-2026, docs/NECESIDADES-REPARTIDOR-30-10.md): los cálculos pequeños de la pantalla
   de Hoy, sin Android dentro para poder probarlos: el retraso frente a la hora prevista, el buscador de paradas y
   la hora de una entrega. */
object Calle {
    /** Minutos que se va por detrás de la hora prevista de la siguiente parada («10:05») a la hora de ahora
     *  («10:30»): 25. Sin hora prevista, o yendo bien, 0. */
    fun retraso(etaSiguiente: String?, ahora: String): Int {
        val eta = minutos(etaSiguiente) ?: return 0
        val ya = minutos(ahora) ?: return 0
        return (ya - eta).coerceAtLeast(0)
    }

    private fun minutos(hhmm: String?): Int? {
        val m = Regex("^(\\d{1,2}):(\\d{2})$").find(hhmm?.trim().orEmpty()) ?: return null
        val h = m.groupValues[1].toInt()
        val mi = m.groupValues[2].toInt()
        return if (h in 0..23 && mi in 0..59) h * 60 + mi else null
    }

    fun sinAcentos(s: String): String =
        Normalizer.normalize(s, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "").lowercase()

    /** El buscador de la ruta (con muchas paradas y un cliente al teléfono): cliente, calle, teléfono, código o notas. */
    fun coincide(p: Parada, buscado: String): Boolean {
        val q = sinAcentos(buscado).trim()
        if (q.isEmpty()) return true
        val texto = sinAcentos(listOf(p.cliente, p.direccion, p.telefono, p.codigo, p.contenido, p.notas).joinToString(" "))
        return q.split(Regex("\\s+")).all { it in texto }
    }

    /** «11:02» de una fecha ISO (en la hora del móvil); vacío si no se puede leer. */
    fun hora(iso: String?): String = runCatching {
        java.time.Instant.parse(iso).atZone(java.time.ZoneId.systemDefault()).toLocalTime().let { "%02d:%02d".format(it.hour, it.minute) }
    }.getOrDefault("")

    /* EL MAPA (30-10-2026): lo que calcula sin Android dentro. */

    /** El centro (la media de las esquinas) de un polígono [[lat, lng]…] de la DGT, para ponerle la etiqueta ZBE. */
    fun centroide(poligono: List<List<Double>>): Pair<Double, Double>? {
        val puntos = poligono.filter { it.size >= 2 }
        if (puntos.isEmpty()) return null
        return puntos.sumOf { it[0] } / puntos.size to puntos.sumOf { it[1] } / puntos.size
    }

    /** Metros en línea recta entre dos puntos (la Tierra como esfera: de sobra para «la furgoneta a 180 m»). */
    fun metros(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Int {
        val r = Math.PI / 180
        val x = (lng2 - lng1) * r * Math.cos((lat1 + lat2) / 2 * r)
        val y = (lat2 - lat1) * r
        return Math.round(Math.sqrt(x * x + y * y) * 6371000).toInt()
    }

    /** «180 m» hasta el kilómetro; después «1,4 km» (y «508 km» si el GPS dice una barbaridad). En millas (EE. UU.,
     *  Reino Unido): «530 ft» hasta un décimo de milla y después «0.4 mi». Los números, en el idioma de la app. */
    fun distancia(metros: Int, millas: Boolean = false, locale: java.util.Locale = java.util.Locale("es")): String = when {
        millas && metros < 161 -> "${Math.round(metros * 3.28084)} ft"
        millas -> "%.1f mi".format(locale, metros / 1609.344)
        metros < 1000 -> "$metros m"
        metros < 10000 -> "%.1f km".format(locale, metros / 1000.0)
        else -> "${Math.round(metros / 1000.0)} km"
    }

    /** La forma con que se dibuja cada clase de incidencia de la DGT (la misma que en la web): disco con barra
     *  (corte), triángulo (accidente, obstáculo), rombo (obras), coche (retención), nube (meteo) o «i» (lo demás). */
    fun formaIncidencia(clase: String): String = when (clase) {
        "corte" -> "disco"
        "accidente", "obstaculo" -> "triangulo"
        "obras" -> "rombo"
        "retencion" -> "coche"
        "meteo" -> "nube"
        else -> "info"
    }

    fun colorIncidencia(clase: String): Long = when (clase) {
        "corte", "accidente" -> 0xFFDC2626
        "retencion" -> 0xFFEA580C
        "obras", "obstaculo" -> 0xFFF59E0B
        "meteo" -> 0xFF0369A1
        else -> 0xFF475569
    }

    /** Dónde está una incidencia, en una línea: «AC-12 · pk 2,0 · A Coruña · a 0,4 km de la parada 3». */
    fun dondeIncidencia(i: Incidencia): String = listOfNotNull(
        i.carretera.takeIf { it.isNotBlank() },
        i.pk.takeIf { it.isNotBlank() }?.let { tx("pk") + " $it" },
        i.municipio.takeIf { it.isNotBlank() },
        i.distanciaKm?.let { d ->
            val km = "%.1f".format(com.flotadsp.fds.ui.Idioma.locale, d)
            if (i.parada != null) tx("a {km} km de la parada {n}", "km" to km, "n" to i.parada) else tx("a {km} km de tu ruta", "km" to km)
        },
    ).joinToString(" · ")
}
