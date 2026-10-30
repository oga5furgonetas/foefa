package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.Antes
import com.flotadsp.fds.data.Parada
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/** Los textos que la app compone para la persona: el WhatsApp al cliente y «la última vez en esa puerta». */
class TextosHojaTest {
    private val parada = Parada(id = "p1", cliente = "Marta", direccion = "Rúa Real 5", telefono = "612345678")

    @Test
    fun whatsapp_con_hora_y_enlace_de_seguimiento() {
        val t = textoWhatsapp(parada.copy(eta = "11:20", seguimiento = "abc123"), empresa = "Súper Lola")
        assertThat(t).isEqualTo("Hola, soy el repartidor de Súper Lola. Voy de camino con su pedido, llegada aproximada a las 11:20. Puede seguirlo aquí: https://flotadsp.com/s/abc123")
    }

    @Test
    fun whatsapp_sin_hora_ni_enlace_es_el_mensaje_de_siempre() {
        assertThat(textoWhatsapp(parada, empresa = "")).isEqualTo("Hola, soy el repartidor. Voy de camino con su pedido.")
        assertThat(textoWhatsapp(parada.copy(tipo = "recogida"), empresa = "")).isEqualTo("Hola, soy el repartidor. Voy de camino a hacer la recogida.")
    }

    @Test
    fun la_ultima_vez_dice_donde_se_dejo_o_por_que_no_se_pudo() {
        assertThat(textoAntes(Antes(fecha = "2026-10-12", estado = "entregado", donde = "porteria"))).isEqualTo("La última vez (12/10): en portería")
        assertThat(textoAntes(Antes(fecha = "2026-10-12", estado = "entregado", donde = "vecino", nota = "2º B"))).isEqualTo("La última vez (12/10): al vecino · 2º B")
        assertThat(textoAntes(Antes(fecha = "2026-10-12", estado = "fallido", motivo = "No había nadie"))).isEqualTo("La última vez (12/10): no se pudo: No había nadie")
        assertThat(textoAntes(Antes(fecha = "2026-10-12", estado = "entregado", nota = "Llamar antes"))).isEqualTo("La última vez (12/10): Llamar antes")
    }
}
