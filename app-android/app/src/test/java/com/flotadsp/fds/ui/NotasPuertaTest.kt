package com.flotadsp.fds.ui

import com.flotadsp.fds.data.Antes
import com.flotadsp.fds.data.ClienteDice
import com.flotadsp.fds.data.Memoria
import com.flotadsp.fds.data.Parada
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/** LA CAJA DE NOTAS DE LA PUERTA (F3, 08-11-2026): en la tarjeta de «Hoy» y en la del mapa enseña solo los primeros datos
 *  (como la web: la tarjeta de 10-hoy medía 310 dp con tres líneas de notas y §5.1 d pide 284 como mucho); en la hoja, todos. */
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
    fun la_tarjeta_ensena_solo_los_primeros_datos_y_la_hoja_todos() {
        val notas = notasDe(parada.copy(estado = "pendiente"))
        assertThat(notasVisibles(notas, maxLines = 2)).containsExactlyElementsIn(notas.take(2)).inOrder()
        assertThat(notasVisibles(notas, maxLines = 1)).containsExactlyElementsIn(notas.take(1))
        assertThat(notasVisibles(notas, maxLines = Int.MAX_VALUE)).containsExactlyElementsIn(notas).inOrder()
    }

    @Test
    fun sin_datos_no_hay_caja() {
        assertThat(notasDe(Parada(id = "p2", cliente = "Bar"))).isEmpty()
        assertThat(notasVisibles(emptyList(), maxLines = 2)).isEmpty()
    }
}
