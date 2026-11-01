package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.ClienteDice
import com.flotadsp.fds.data.Parada
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/** El briefing por voz (01-11-2026): lo que se dice de la siguiente parada, en una frase, como en la web. */
class BriefingTest {
    @Test
    fun el_hueco_se_dice_como_se_habla() {
        assertThat(Briefing.huecoHablado("Detrás · izq")).isEqualTo("detrás, a la izquierda")
        assertThat(Briefing.huecoHablado("Medio · der")).isEqualTo("en medio, a la derecha")
        assertThat(Briefing.huecoHablado("Delante")).isEqualTo("delante")
        assertThat(Briefing.huecoHablado("")).isEqualTo("")
        assertThat(Briefing.huecoHablado("Maletero")).isEqualTo("Maletero")
    }

    @Test
    fun el_briefing_dice_lo_que_hay_que_saber_en_una_frase() {
        val p = Parada(id = "p1", cliente = "Farmacia Sol", direccion = "Rúa Real 5", hueco = "Detrás · izq", bultos = 3, cobrar = 12.5,
            notas = "Timbre 2", ventanaHasta = "11:00", clienteDice = ClienteDice(estare = "no", dejar = "vecino"))
        val t = Briefing.texto(p).replace(' ', ' ').replace(' ', ' ')
        assertThat(t).isEqualTo("Siguiente parada: Farmacia Sol, Rúa Real 5. hasta las 11:00. el cliente dice: No estará · Al vecino. " +
            "en la furgoneta, detrás, a la izquierda. 3 bultos. cobro a la entrega: 12,50 €. nota: Timbre 2.")
    }

    @Test
    fun sin_nada_mas_solo_la_direccion_y_el_horario_escrito_a_mano() {
        assertThat(Briefing.texto(Parada(id = "p2", direccion = "Rúa Real 5", bultos = 1))).isEqualTo("Siguiente parada: Rúa Real 5.")
        assertThat(Briefing.texto(Parada(id = "p3", direccion = "Rúa Real 5", horario = "mañanas"))).isEqualTo("Siguiente parada: Rúa Real 5. mañanas.")
    }
}
