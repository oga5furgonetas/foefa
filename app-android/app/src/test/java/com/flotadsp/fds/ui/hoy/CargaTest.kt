package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.Parada
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/** La furgoneta por huecos (01-11-2026): qué fila va primero según por dónde se carga, y qué parada va en cada hueco. */
class CargaTest {
    private fun p(id: String, orden: Int?, hueco: String, cargada: Boolean = false) =
        Parada(id = id, direccion = "Rúa $id", orden = orden, hueco = hueco, cargadoEn = if (cargada) "2026-11-01T07:00:00Z" else null)

    @Test
    fun la_fila_de_la_puerta_va_primero() {
        assertThat(Carga.filasEnOrden("traseras").first()).containsExactly("Detrás · izq", "Detrás · der").inOrder()
        assertThat(Carga.filasEnOrden(null).first()).containsExactly("Detrás · izq", "Detrás · der").inOrder()
        assertThat(Carga.filasEnOrden("lateral").first()).containsExactly("Delante · izq", "Delante · der").inOrder()
        assertThat(Carga.filasEnOrden("lateral").last()).containsExactly("Detrás · izq", "Detrás · der").inOrder()
    }

    @Test
    fun cada_hueco_con_sus_paradas_en_orden_y_las_sin_hueco_aparte() {
        val paradas = listOf(p("b", 2, "Detrás · izq"), p("a", 1, "Detrás · izq", cargada = true), p("c", 3, "Medio · der"),
            p("x", null, ""), p("y", 4, "Maletero"))
        val m = Carga.porHueco(paradas)
        assertThat(m.keys).containsExactlyElementsIn(Carga.HUECOS).inOrder()
        assertThat(m["Detrás · izq"]!!.map { it.id }).containsExactly("a", "b").inOrder()
        assertThat(m["Medio · der"]!!.map { it.id }).containsExactly("c")
        assertThat(m["Delante · izq"]).isEmpty()
        assertThat(Carga.sinHueco(paradas).map { it.id }).containsExactly("y", "x").inOrder()
        assertThat(Carga.cargadas(paradas)).isEqualTo(1)
        assertThat(paradas[1].cargada).isTrue()
        assertThat(paradas[0].cargada).isFalse()
    }
}
