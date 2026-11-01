package com.flotadsp.fds.ui.compartir

import com.flotadsp.fds.data.JSON
import com.flotadsp.fds.data.Pegado
import com.google.common.truth.Truth.assertThat
import kotlinx.serialization.json.decodeFromJsonElement
import org.junit.Test

/** «COMPARTIR CON FDS» (01-11-2026): qué es un PDF y qué una foto, cómo se junta lo leído de varias páginas, y lo que
 *  contesta el servidor al enseñar o añadir lo compartido. */
class CompartidoTest {
    @Test
    fun pdf_o_foto_por_el_tipo_o_por_el_nombre() {
        assertThat(Compartir.esPdf("application/pdf")).isTrue()
        assertThat(Compartir.esPdf("application/octet-stream", "Hoja de ruta.PDF")).isTrue()
        assertThat(Compartir.esPdf("image/jpeg", "foto.jpg")).isFalse()
        assertThat(Compartir.esImagen("image/png")).isTrue()
        assertThat(Compartir.esImagen("text/plain")).isFalse()
        assertThat(Compartir.esHoja(0)).isFalse()
        assertThat(Compartir.esHoja(2)).isTrue()
    }

    @Test
    fun lo_leido_de_varias_paginas_se_junta_limpio() {
        val t = Compartir.juntar(listOf("  Rúa Real 5 \r\n\r\n\n  15003   A Coruña ", "", "Avda. Montero Ríos 12\n"))
        assertThat(t).isEqualTo("Rúa Real 5\n15003 A Coruña\nAvda. Montero Ríos 12")
        assertThat(Compartir.juntar(listOf("", "   \n  "))).isEmpty()
    }

    @Test
    fun lo_que_contesta_el_servidor_se_lee() {
        val vista = JSON.decodeFromJsonElement<Pegado>(JSON.parseToJsonElement(
            """{"filas":[{"codigo":"ZX1","cliente":"Bar Pepe","direccion":"Rúa Real 5","telefono":"981223344"},{"direccion":"Praza de Lugo 1"}],"n":2}"""))
        assertThat(vista.n).isEqualTo(2)
        assertThat(vista.filas.map { it.direccion }).containsExactly("Rúa Real 5", "Praza de Lugo 1").inOrder()
        assertThat(vista.filas[1].cliente).isEmpty()
        val hecho = JSON.decodeFromJsonElement<Pegado>(JSON.parseToJsonElement("""{"creados":2,"repetidos":1,"fecha":"2026-11-01","sin_hueco":0}"""))
        assertThat(hecho.creados).isEqualTo(2)
        assertThat(hecho.repetidos).isEqualTo(1)
        assertThat(hecho.filas).isEmpty()
    }
}
