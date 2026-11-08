package com.flotadsp.fds.ui

import com.flotadsp.fds.data.Antes
import com.flotadsp.fds.data.ClienteDice
import com.flotadsp.fds.data.Memoria
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.ui.hoy.largoSinNotaClienteDice
import com.flotadsp.fds.ui.hoy.textoClienteDice
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/** LA CAJA DE NOTAS DE LA PUERTA (F3, 08-11-2026): en la tarjeta de «Hoy» y en la del mapa enseña dos líneas en total
 *  (como la web: la tarjeta de 10-hoy medía 310 dp con tres líneas de notas y §5.1 d pide 284 como mucho); en la hoja, todos.
 *  RN, 08-11-2026: de esas dos líneas, lo que dice el cliente tiene prioridad y se lee entero, con su portal, hasta en dos. */
class NotasPuertaTest {
    private val parada = Parada(
        id = "p1", cliente = "Farmacia Sol", direccion = "Rúa Sinfónica de Galicia 8", notas = "Timbre 2º B",
        clienteDice = ClienteDice(estare = "no", dejar = "porteria", portal = "4521", nota = "Si no estoy, al portero"),
        memoria = Memoria(portal = "1234", dejar = "porteria"),
        antes = Antes(fecha = "2026-10-27", estado = "entregado", donde = "porteria"),
    )

    @Test
    fun los_datos_van_en_su_orden_el_cliente_dice_la_memoria_las_notas_y_la_ultima_vez() {
        val nombres = notasDe(parada.copy(estado = "pendiente")).map { it.nombre.substringBefore(":") }
        assertThat(nombres).hasSize(4)
        assertThat(nombres[0]).startsWith("El cliente dice")
        assertThat(nombres[1]).startsWith("Memoria de la puerta")
        assertThat(nombres[2]).startsWith("Notas")
    }

    @Test
    fun lo_que_dice_el_cliente_es_el_unico_dato_prioritario_y_va_el_primero() {
        val notas = notasDe(parada.copy(estado = "pendiente"))
        assertThat(notas.map { it.prioritaria }).containsExactly(true, false, false, false).inOrder()
    }

    @Test
    fun en_la_tarjeta_lo_que_dice_el_cliente_toma_las_dos_lineas_y_lo_demas_espera() {
        val notas = notasDe(parada.copy(estado = "pendiente"))
        // Sin medirlo aún, o si de verdad ocupa las dos: solo el cliente, en dos líneas, para que se lea el portal.
        assertThat(lineasDeNotas(notas, maxLines = 2)).containsExactly(2)
        assertThat(lineasDeNotas(notas, maxLines = 2, usadaPrimera = 2)).containsExactly(2)
        // Si le basta una línea, la otra es del dato siguiente (una línea, como siempre).
        assertThat(lineasDeNotas(notas, maxLines = 2, usadaPrimera = 1)).containsExactly(2, 1).inOrder()
    }

    @Test
    fun con_una_sola_linea_de_sitio_el_cliente_va_en_una_y_no_sale_nada_mas() {
        val notas = notasDe(parada.copy(estado = "pendiente"))
        assertThat(lineasDeNotas(notas, maxLines = 1)).containsExactly(1)
        assertThat(lineasDeNotas(notas, maxLines = 1, usadaPrimera = 1)).containsExactly(1)
    }

    @Test
    fun sin_lo_del_cliente_van_los_dos_primeros_datos_de_una_linea_cada_uno() {
        val notas = notasDe(parada.copy(clienteDice = null, estado = "pendiente"))
        assertThat(notas.map { it.prioritaria }).doesNotContain(true)
        assertThat(lineasDeNotas(notas, maxLines = 2)).containsExactly(1, 1).inOrder()
        assertThat(lineasDeNotas(notas, maxLines = 2, usadaPrimera = 1)).containsExactly(1, 1).inOrder()
        assertThat(lineasDeNotas(notas.take(1), maxLines = 2)).containsExactly(1)
    }

    @Test
    fun solo_lo_del_cliente_en_dos_lineas_y_en_la_hoja_todos_sin_tope() {
        val solo = notasDe(Parada(id = "p3", cliente = "Bar", clienteDice = ClienteDice(estare = "no", dejar = "porteria", portal = "4521")))
        assertThat(lineasDeNotas(solo, maxLines = 2)).containsExactly(2)
        val notas = notasDe(parada.copy(estado = "pendiente"))
        assertThat(lineasDeNotas(notas, maxLines = Int.MAX_VALUE)).containsExactly(Int.MAX_VALUE, Int.MAX_VALUE, Int.MAX_VALUE, Int.MAX_VALUE)
    }

    @Test
    fun el_portal_va_antes_de_lo_que_el_cliente_escribe_a_mano() {
        // Si la frase no cabe, lo que se corta es el final (la nota libre), no el número del portal.
        val frase = textoClienteDice(parada.clienteDice!!)
        assertThat(frase.indexOf("4521")).isLessThan(frase.indexOf("Si no estoy"))
    }

    @Test
    fun lo_que_no_puede_faltar_es_todo_menos_lo_que_el_cliente_escribe_a_mano() {
        val c = parada.clienteDice!!
        val frase = textoClienteDice(c)
        val importante = largoSinNotaClienteDice(c)
        assertThat(frase.substring(0, importante)).isEqualTo("No estará · En portería o recepción · Portal: 4521")
        assertThat(frase.substring(importante)).startsWith(" · «")
        // Sin nada escrito a mano, todo es importante; con solo la franja, también.
        assertThat(largoSinNotaClienteDice(c.copy(nota = ""))).isEqualTo(textoClienteDice(c.copy(nota = "")).length)
        val franja = ClienteDice(franja = listOf("12:00", "14:00"), nota = "Timbre roto")
        assertThat(textoClienteDice(franja).substring(0, largoSinNotaClienteDice(franja))).isEqualTo("Mejor de 12:00 a 14:00")
    }

    @Test
    fun sin_datos_no_hay_caja() {
        assertThat(notasDe(Parada(id = "p2", cliente = "Bar"))).isEmpty()
        assertThat(lineasDeNotas(emptyList(), maxLines = 2)).isEmpty()
    }
}
