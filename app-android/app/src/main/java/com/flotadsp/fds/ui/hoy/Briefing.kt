package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.ui.Region
import com.flotadsp.fds.ui.tx

/* EL BRIEFING DE LA PARADA (01-11-2026), igual que la web (frontend/src/lib/briefing.js): lo que el repartidor
   necesita oír antes de llegar, en una frase: la dirección, hasta qué hora, lo que dijo el cliente, en qué hueco de
   la furgoneta va, si hay que cobrar y la nota. Puro: se prueba sin pantalla (BriefingTest). */
object Briefing {
    /** «Detrás · izq» → «detrás, a la izquierda» (lo que se dice, no lo que se pinta). */
    fun huecoHablado(hueco: String): String {
        val h = hueco.trim()
        if (h.isEmpty()) return ""
        val trozos = h.split("·").map { it.trim() }
        val filas = mapOf("Delante" to tx("delante"), "Medio" to tx("en medio"), "Detrás" to tx("detrás"))
        val lados = mapOf("izq" to tx("a la izquierda"), "der" to tx("a la derecha"))
        val fila = filas[trozos[0]] ?: return tx(h)
        val lado = trozos.getOrNull(1)?.let { lados[it] }
        return if (lado != null) "$fila, $lado" else fila
    }

    fun texto(p: Parada): String {
        val partes = mutableListOf<String>()
        partes += tx("Siguiente parada: {d}", "d" to listOf(p.cliente, p.direccion).filter { it.isNotBlank() }.joinToString(", "))
        val hasta = p.ventanaHasta?.takeIf { it.isNotBlank() }
        if (hasta != null) partes += tx("hasta las {h}", "h" to hasta)
        else if (p.horario.isNotBlank()) partes += p.horario
        p.clienteDice?.let { textoClienteDice(it) }?.takeIf { it.isNotBlank() }?.let { partes += tx("el cliente dice: {t}", "t" to it) }
        // La memoria de la calle (01-11-2026): el portal, dónde dejar y cómo se entra, como lo apuntó quien estuvo antes.
        p.memoria?.let { textoMemoria(it) }?.takeIf { it.isNotBlank() }?.let { partes += it }
        if (p.hueco.isNotBlank()) partes += tx("en la furgoneta, {s}", "s" to huecoHablado(p.hueco))
        if (p.bultos > 1) partes += tx("{n} bultos", "n" to p.bultos)
        if (p.porCobrar) partes += tx("cobro a la entrega: {i}", "i" to Region.importe(p.cobrar ?: 0.0))
        if (p.notas.isNotBlank()) partes += tx("nota: {n}", "n" to p.notas)
        return partes.joinToString(". ") + "."
    }
}
