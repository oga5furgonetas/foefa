package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.Parada

/* LA FURGONETA POR HUECOS (01-11-2026): los seis huecos de siempre, en filas; qué fila va primero según por dónde se
   carga (el ajuste «carga_por» del servidor), y las paradas de cada hueco. Puro: se prueba sin pantalla (CargaTest). */
object Carga {
    val HUECOS = listOf("Delante · izq", "Delante · der", "Medio · izq", "Medio · der", "Detrás · izq", "Detrás · der")
    val FILAS = listOf(listOf("Delante · izq", "Delante · der"), listOf("Medio · izq", "Medio · der"), listOf("Detrás · izq", "Detrás · der"))

    /** Las filas en el orden en que se cargan: la de la puerta primero (detrás con las puertas traseras; delante con la lateral). */
    fun filasEnOrden(cargaPor: String?): List<List<String>> = if (cargaPor == "lateral") FILAS else FILAS.reversed()

    private val porOrden = compareBy<Parada>({ it.orden ?: Int.MAX_VALUE }, { it.cliente })

    fun porHueco(paradas: List<Parada>): Map<String, List<Parada>> =
        HUECOS.associateWith { h -> paradas.filter { it.hueco == h }.sortedWith(porOrden) }

    fun sinHueco(paradas: List<Parada>): List<Parada> = paradas.filter { it.hueco !in HUECOS }.sortedWith(porOrden)

    fun cargadas(paradas: List<Parada>): Int = paradas.count { it.cargada }
}
