package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.JSON
import com.flotadsp.fds.data.Memoria
import com.flotadsp.fds.data.Parada
import com.google.common.truth.Truth.assertThat
import kotlinx.serialization.json.decodeFromJsonElement
import org.junit.Test

/** LA MEMORIA DE LA CALLE (01-11-2026): lo que manda el servidor con la parada se lee, se pinta en una frase y el
 *  briefing lo dice. */
class MemoriaTest {
    private fun parada(json: String) = JSON.decodeFromJsonElement<Parada>(JSON.parseToJsonElement(json))

    @Test
    fun la_parada_trae_la_memoria_de_su_puerta() {
        val p = parada("""{"id":"p1","direccion":"Rúa Real 22","memoria":{"portal":"1234B","dejar":"porteria","acceso":"Entrada por el garaje","por":"ANA","actualizado":"2026-11-01T09:00:00Z"}}""")
        assertThat(p.memoria).isEqualTo(Memoria("1234B", "porteria", "Entrada por el garaje", "ANA", "2026-11-01T09:00:00Z"))
        assertThat(parada("""{"id":"p2","direccion":"x","memoria":null}""").memoria).isNull()
        assertThat(parada("""{"id":"p3","direccion":"x"}""").memoria).isNull()
    }

    @Test
    fun la_frase_y_el_briefing() {
        assertThat(textoMemoria(Memoria("1234B", "porteria", "Entrada por el garaje"))).isEqualTo("portal 1234B, dejar en portería, Entrada por el garaje")
        assertThat(textoMemoria(Memoria(portal = "77"))).isEqualTo("portal 77")
        assertThat(textoMemoria(Memoria(dejar = "tejado"))).isEmpty()
        val p = parada("""{"id":"p1","cliente":"Bea","direccion":"Rúa Real 22","memoria":{"portal":"1234B","dejar":"buzon","acceso":""}}""")
        assertThat(Briefing.texto(p)).isEqualTo("Siguiente parada: Bea, Rúa Real 22. portal 1234B, dejar en el buzón.")
        assertThat(Briefing.texto(parada("""{"id":"p1","direccion":"Rúa Real 22"}"""))).isEqualTo("Siguiente parada: Rúa Real 22.")
    }
}
