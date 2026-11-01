package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.EntregaIa
import com.flotadsp.fds.data.JSON
import com.flotadsp.fds.data.Parada
import com.google.common.truth.Truth.assertThat
import kotlinx.serialization.json.decodeFromJsonElement
import org.junit.Test

/** LA ENTREGA VERIFICADA (01-11-2026): lo que manda el servidor con la parada se lee, y cada aviso tiene su frase. */
class EntregaIaTest {
    private fun parada(json: String) = JSON.decodeFromJsonElement<Parada>(JSON.parseToJsonElement(json))

    @Test
    fun la_parada_trae_lo_que_dijo_la_ia() {
        val p = parada("""{"id":"p1","direccion":"Rúa Real 5","estado":"entregado",
            "entrega_ia":{"nivel":"revisar","aviso":"otro_numero","numero":"7","portal":"5","lugar":"puerta","paquete":true,"cuando":"2026-11-01T09:00:00Z"}}""")
        assertThat(p.entregaIa).isEqualTo(EntregaIa(nivel = "revisar", aviso = "otro_numero", numero = "7", portal = "5", lugar = "puerta"))
        assertThat(parada("""{"id":"p2","direccion":"x","entrega_ia":null}""").entregaIa).isNull()
        assertThat(parada("""{"id":"p3","direccion":"x"}""").entregaIa).isNull()
    }

    @Test
    fun cada_aviso_tiene_su_frase() {
        assertThat(textoAvisoIa(EntregaIa("revisar", "otro_numero", "7", "5")))
            .isEqualTo("En la foto se lee el número 7 y la parada es el 5: comprueba que es la puerta buena.")
        assertThat(textoAvisoIa(EntregaIa("revisar", "personas"))).contains("personas")
        assertThat(textoAvisoIa(EntregaIa("revisar", "sin_paquete"))).contains("paquete")
        assertThat(textoAvisoIa(EntregaIa("parcial", "sin_numero"))).contains("número del portal")
        assertThat(textoAvisoIa(EntregaIa("verificada", null))).isEmpty()
        assertThat(textoAvisoIa(EntregaIa("pendiente", null))).isEmpty()
    }
}
