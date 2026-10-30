package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.Incidencia
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/** Los iconos y lo que se toca en el mapa (30-10-2026): lo que se calcula sin Android dentro. */
class MapaTest {
    @Test
    fun el_centro_de_una_zbe_es_la_media_de_sus_esquinas() {
        val c = Calle.centroide(listOf(listOf(43.0, -8.0), listOf(43.0, -8.2), listOf(43.2, -8.2), listOf(43.2, -8.0), listOf(1.0)))
        assertThat(c).isNotNull()
        assertThat(c!!.first).isWithin(1e-9).of(43.1)
        assertThat(c.second).isWithin(1e-9).of(-8.1)
        assertThat(Calle.centroide(emptyList())).isNull()
    }

    @Test
    fun los_metros_en_linea_recta_salen_bien() {
        // Un centésimo de grado de latitud son 1.112 m en cualquier sitio.
        assertThat(Calle.metros(43.0, -8.0, 43.01, -8.0)).isIn(1100..1125)
        assertThat(Calle.metros(43.36, -8.41, 43.36, -8.41)).isEqualTo(0)
        // De la Marina al Obelisco de A Coruña hay unos 300 m.
        assertThat(Calle.metros(43.3686, -8.3975, 43.3706, -8.3999)).isIn(250..350)
        assertThat(Calle.distancia(180)).isEqualTo("180 m")
        assertThat(Calle.distancia(1430)).isEqualTo("1,4 km")
        assertThat(Calle.distancia(508182)).isEqualTo("508 km")
    }

    @Test
    fun cada_incidencia_tiene_su_forma_y_su_color() {
        assertThat(Calle.formaIncidencia("corte")).isEqualTo("disco")
        assertThat(Calle.formaIncidencia("accidente")).isEqualTo("triangulo")
        assertThat(Calle.formaIncidencia("obras")).isEqualTo("rombo")
        assertThat(Calle.formaIncidencia("retencion")).isEqualTo("coche")
        assertThat(Calle.formaIncidencia("meteo")).isEqualTo("nube")
        assertThat(Calle.formaIncidencia("lo que sea")).isEqualTo("info")
        assertThat(Calle.colorIncidencia("corte")).isEqualTo(0xFFDC2626)
        assertThat(Calle.colorIncidencia("obras")).isEqualTo(0xFFF59E0B)
        assertThat(Calle.colorIncidencia("")).isEqualTo(0xFF475569)
    }

    @Test
    fun donde_esta_la_incidencia_en_una_linea() {
        val i = Incidencia(clase = "retencion", que = "retención", carretera = "AC-12", pk = "2,0", municipio = "A Coruña", lat = 43.366, lng = -8.3985, distanciaKm = 0.4, parada = 3)
        assertThat(Calle.dondeIncidencia(i)).isEqualTo("AC-12 · pk 2,0 · A Coruña · a 0,4 km de la parada 3")
        val sinNada = Incidencia(lat = 43.0, lng = -8.0, distanciaKm = 1.25)
        assertThat(Calle.dondeIncidencia(sinNada)).isEqualTo("a 1,3 km de tu ruta")
    }

    @Test
    fun la_punta_de_la_chincheta_cae_abajo_del_dibujo() {
        assertThat(puntaChincheta(false)).isAtLeast(0.85f)
        assertThat(puntaChincheta(false)).isAtMost(0.99f)
        assertThat(puntaChincheta(true)).isAtLeast(0.85f)
        assertThat(puntaChincheta(true)).isAtMost(0.99f)
    }
}
