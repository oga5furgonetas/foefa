package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.ClienteDice
import com.flotadsp.fds.data.Parada
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/** Lo que pide la calle (30-10-2026): el retraso, el buscador, la hora y lo que dice el cliente. */
class CalleTest {
    @Test
    fun el_retraso_es_lo_que_se_va_por_detras_de_la_hora_prevista() {
        assertThat(Calle.retraso("10:05", "10:30")).isEqualTo(25)
        assertThat(Calle.retraso("10:05", "09:50")).isEqualTo(0)
        assertThat(Calle.retraso(null, "10:30")).isEqualTo(0)
        assertThat(Calle.retraso("ahora", "10:30")).isEqualTo(0)
        assertThat(Calle.retraso("9:05", "10:05")).isEqualTo(60)
    }

    @Test
    fun el_buscador_mira_cliente_calle_telefono_y_codigo_sin_acentos() {
        val p = Parada(id = "p", cliente = "Lucía M.", direccion = "Rúa Emilia Pardo Bazán 14", telefono = "600000002", codigo = "ZX81001")
        assertThat(Calle.coincide(p, "lucia")).isTrue()
        assertThat(Calle.coincide(p, "pardo bazan")).isTrue()
        assertThat(Calle.coincide(p, "zx81001")).isTrue()
        assertThat(Calle.coincide(p, "6000")).isTrue()
        assertThat(Calle.coincide(p, "")).isTrue()
        assertThat(Calle.coincide(p, "bar pepe")).isFalse()
    }

    @Test
    fun la_hora_de_una_entrega_sale_de_su_fecha() {
        assertThat(Calle.hora("2026-10-30T11:02:10Z")).matches("\\d{2}:\\d{2}")
        assertThat(Calle.hora(null)).isEmpty()
        assertThat(Calle.hora("ayer")).isEmpty()
    }

    @Test
    fun lo_que_dice_el_cliente_se_lee_en_una_linea() {
        assertThat(textoClienteDice(ClienteDice(estare = "no", dejar = "porteria", portal = "1234"))).isEqualTo("No estará · En portería o recepción · Portal: 1234")
        assertThat(textoClienteDice(ClienteDice(estare = "franja", franja = listOf("16:00", "18:00"), nota = "2º izq"))).isEqualTo("Mejor de 16:00 a 18:00 · «2º izq»")
        assertThat(textoClienteDice(ClienteDice(estare = "si"))).isEqualTo("Estará en casa")
        assertThat(textoClienteDice(ClienteDice())).isEmpty()
    }
}
