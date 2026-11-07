package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.MiRuta
import com.flotadsp.fds.data.Parada
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/** LA INVITACIÓN TRAS LA PRIMERA ENTREGA (02-11-2026): cuándo sale la tarjeta de Hoy, el enlace y el mensaje. */
class InvitarTest {
    private val enlace = "https://flotadsp.com/invita?ref=ABC123&utm_source=referido&utm_medium=app_android&utm_campaign=primera_entrega"

    @Test
    fun el_enlace_lleva_el_codigo_y_las_utm_de_la_tarjeta() {
        assertThat(Invitar.enlace("https://flotadsp.com", "ABC123")).isEqualTo(enlace)
        assertThat(Invitar.enlace("https://flotadsp.com", ""))
            .isEqualTo("https://flotadsp.com/invita?utm_source=referido&utm_medium=app_android&utm_campaign=primera_entrega")
        assertThat(Invitar.enlace("https://flotadsp.com", null)).doesNotContain("ref=")
    }

    @Test
    fun el_mensaje_dice_la_promocion_el_bono_del_invitado_y_el_premio() {
        val t = Invitar.texto(enlace, "31 de diciembre", 2500, 1000)
        assertThat(t).isEqualTo(
            "Uso FDS para ordenar mi ruta de reparto y navegar parada a parada. Es gratis y sin límite hasta el 31 de diciembre, solo registrarte: $enlace\n\n" +
                "Y tú ganas 25 € con tu primera ruta real (20 entregas en 2 días).\n\n" +
                "Si te registras con mi enlace y completas 20 entregas a direcciones distintas en 2 días diferentes, repartidas durante el día y dentro de tus primeros 30 días, gano 10 €.")
    }

    @Test
    fun sin_promocion_el_mensaje_es_el_de_probarla_gratis() {
        assertThat(Invitar.texto(enlace, null, 0, 0))
            .isEqualTo("Uso FDS para ordenar mi ruta de reparto y navegar parada a parada. Pruébala gratis, sin tarjeta: $enlace")
        // Sin bono para el invitado pero con premio para quien invita: solo la última frase.
        assertThat(Invitar.texto(enlace, "", 0, 250)).endsWith("gano 2,50 €.")
    }

    @Test
    fun la_tarjeta_sale_solo_a_quien_reparte_por_su_cuenta_con_una_entrega_y_enlace() {
        val autonomo = MiRuta(autonomo = true, fecha = "2026-11-02")
        assertThat(Invitar.seEnsena(autonomo, 1, "ABC123", null, "2026-11-02")).isTrue()
        assertThat(Invitar.seEnsena(autonomo, 0, "ABC123", null, "2026-11-02")).isFalse()            // aún sin entregar
        assertThat(Invitar.seEnsena(autonomo, 3, "", null, "2026-11-02")).isFalse()                  // sin enlace (sin red)
        assertThat(Invitar.seEnsena(autonomo, 3, "ABC123", "2026-11-02", "2026-11-02")).isFalse()    // «Ahora no» hoy
        assertThat(Invitar.seEnsena(autonomo, 3, "ABC123", "2026-11-01", "2026-11-02")).isTrue()     // el de ayer ya no cuenta
        assertThat(Invitar.seEnsena(autonomo.copy(prueba = true), 3, "ABC123", null, "2026-11-02")).isFalse()
        assertThat(Invitar.seEnsena(MiRuta(autonomo = false, empresa = "OGA5"), 3, "ABC123", null, "2026-11-02")).isFalse()
        assertThat(Invitar.seEnsena(null, 3, "ABC123", null, "2026-11-02")).isFalse()
    }

    @Test
    fun las_paradas_de_ejemplo_no_cuentan_como_entregas_reales() {
        // «Verlo en acción con 3 paradas de ejemplo» marca ejemplos como entregados: no valen para invitar (ni para el bono).
        val e = EstadoRuta(ruta = MiRuta(autonomo = true, fecha = "2026-11-02", pedidos = listOf(
            Parada(id = "a", estado = "entregado", ejemplo = true),
            Parada(id = "b", estado = "entregado"),
            Parada(id = "c", estado = "pendiente"))))
        assertThat(e.entregadas).isEqualTo(2)
        assertThat(e.entregadasReales).isEqualTo(1)
        assertThat(Invitar.seEnsena(e.ruta, e.entregadasReales, "ABC123", null, "2026-11-02")).isTrue()
        val soloEjemplos = e.copy(ruta = e.ruta!!.copy(pedidos = listOf(Parada(id = "a", estado = "entregado", ejemplo = true))))
        assertThat(soloEjemplos.entregadasReales).isEqualTo(0)
        assertThat(Invitar.seEnsena(soloEjemplos.ruta, soloEjemplos.entregadasReales, "ABC123", null, "2026-11-02")).isFalse()
    }

    @Test
    fun el_importe_se_escribe_sin_decimales_de_mas() {
        assertThat(Invitar.importe(1000)).isEqualTo("10 €")
        assertThat(Invitar.importe(2500)).isEqualTo("25 €")
        assertThat(Invitar.importe(750)).isEqualTo("7,50 €")
    }
}
