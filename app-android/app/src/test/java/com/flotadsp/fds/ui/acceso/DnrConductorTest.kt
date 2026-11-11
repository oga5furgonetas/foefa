package com.flotadsp.fds.ui.acceso

import com.flotadsp.fds.data.Api
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.MisDnr
import com.flotadsp.fds.data.SemanaDnr
import com.flotadsp.fds.data.UnaDnr
import com.flotadsp.fds.data.misDnrDe
import com.flotadsp.fds.ui.Idioma
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/** «MIS DNR» EN LA APP (11-11-2026, tanda 2): la frase grande con su singular y su plural, el desglose, lo nuevo desde la
 *  última vez, a dónde lleva un aviso con `vista=dnr` y que con 404 (la empresa sin la DNR diaria) la app haga como si no
 *  existiera. */
class DnrConductorTest {
    private val servidor = MockWebServer()

    @Before
    fun preparar() {
        Idioma.arrancar("es", "es")
        servidor.start()
    }

    @After
    fun cerrar() { servidor.shutdown() }

    private fun dnr(paquete: String, estado: String, dia: String = "2026-11-10") = UnaDnr(dia = dia, paquete = paquete, estado = estado)
    private fun semana(vararg d: UnaDnr, desde: String = "2026-11-08", hasta: String = "2026-11-14") =
        SemanaDnr(semana = desde, hasta = hasta, dnr = d.toList())
    private fun api() = Api(token = { "t" }, alCaducar = {}, base = servidor.url("/api/").toString())

    @Test
    fun la_frase_grande_dice_cuantas_lleva_esta_semana_en_singular_y_en_plural() {
        assertThat(DnrConductor.fraseSemana(1)).isEqualTo("Esta semana llevas 1 DNR")
        assertThat(DnrConductor.fraseSemana(5)).isEqualTo("Esta semana llevas 5 DNR")
        assertThat(DnrConductor.fraseSemana(0)).isEqualTo("Esta semana no llevas ninguna")
        // El número se pinta aparte (más grande): la frase se parte en lo de antes y lo de después.
        assertThat(DnrConductor.partesFrase(1)).isEqualTo("Esta semana llevas " to " DNR")
        assertThat(DnrConductor.partesFrase(12)).isEqualTo("Esta semana llevas " to " DNR")
        assertThat(DnrConductor.partesFrase(0)).isEqualTo("Esta semana no llevas ninguna" to "")
    }

    @Test
    fun el_desglose_solo_dice_lo_que_hay_con_su_singular_y_su_plural() {
        assertThat(DnrConductor.desglose(semana(dnr("A", "cuenta"), dnr("B", "sin_clasificar"))))
            .isEqualTo("1 te cuenta · 1 sin clasificar")
        assertThat(DnrConductor.desglose(semana(dnr("A", "cuenta"), dnr("B", "cuenta"), dnr("C", "no_cuenta"))))
            .isEqualTo("2 te cuentan · 1 no te cuenta")
        assertThat(DnrConductor.desglose(semana(dnr("A", "no_cuenta"), dnr("B", "no_cuenta"), dnr("C", "sin_clasificar"), dnr("D", "sin_clasificar"))))
            .isEqualTo("2 no te cuentan · 2 sin clasificar")
        // Un estado que esta versión no conoce cuenta como sin clasificar, como en la fila.
        assertThat(DnrConductor.desglose(semana(dnr("A", "raro")))).isEqualTo("1 sin clasificar")
        assertThat(DnrConductor.textoEstado("raro")).isEqualTo("Sin clasificar")
        assertThat(DnrConductor.desglose(semana())).isEmpty()
    }

    @Test
    fun las_semanas_anteriores_y_la_fila_del_inicio_cuentan_bien() {
        assertThat(DnrConductor.cuantas(0)).isEqualTo("Ninguna")
        assertThat(DnrConductor.cuantas(1)).isEqualTo("1 DNR")
        assertThat(DnrConductor.cuantas(3)).isEqualTo("3 DNR")
        assertThat(DnrConductor.nuevas(0)).isNull()
        assertThat(DnrConductor.nuevas(1)).isEqualTo("1 nueva")
        assertThat(DnrConductor.nuevas(4)).isEqualTo("4 nuevas")
        // La línea del inicio habla de ESTA semana (la primera), le cuenten o no.
        val d = MisDnr(tiene_id = true, semanas = listOf(semana(dnr("A", "no_cuenta"), dnr("B", "cuenta")), semana(dnr("C", "cuenta"))))
        assertThat(DnrConductor.lineaInicio(d)).isEqualTo("Esta semana: 2")
        assertThat(DnrConductor.lineaInicio(d.copy(semanas = listOf(semana())))).isEqualTo("Esta semana: ninguna")
        assertThat(DnrConductor.lineaInicio(MisDnr(tiene_id = false))).isNull()
    }

    @Test
    fun las_fechas_salen_cortas_y_sin_reportes_lo_dice() {
        assertThat(DnrConductor.rango(semana(desde = "2026-11-08", hasta = "2026-11-14"))).isEqualTo("Del 8/11 al 14/11")
        assertThat(DnrConductor.dia("2026-11-10")).endsWith("10/11")
        assertThat(DnrConductor.hastaCuando(null)).isEqualTo("La oficina aún no ha subido ningún reporte.")
        assertThat(DnrConductor.hastaCuando("2026-11-10")).startsWith("Reportes subidos hasta el ")
        assertThat(DnrConductor.hastaCuando("2026-11-10")).contains("10/11")
        // Una fecha que no se entiende sale tal cual, sin romper la pantalla.
        assertThat(DnrConductor.dia("ayer")).isEqualTo("Ayer")
    }

    @Test
    fun lo_nuevo_es_lo_que_no_vio_y_lo_que_amazon_ha_clasificado_desde_entonces() {
        val d = MisDnr(tiene_id = true, semanas = listOf(
            semana(dnr("A", "cuenta"), dnr("B", "no_cuenta")),
            semana(dnr("C", "sin_clasificar"), dnr("", "cuenta"), desde = "2026-11-01", hasta = "2026-11-07"),
        ))
        // La primera vez (nada apuntado en el móvil), todas son nuevas; la que no trae paquete no cuenta.
        assertThat(DnrConductor.novedades(d, null)).containsExactly("A", MarcaDnr.NUEVA, "B", MarcaDnr.NUEVA, "C", MarcaDnr.NUEVA)
        // Lo que se apunta es cada paquete con su estado.
        val vistas = DnrConductor.vistasDe(d)
        assertThat(vistas).containsExactly("A", "cuenta", "B", "no_cuenta", "C", "sin_clasificar")
        // Al volver sin cambios, ninguna nueva.
        assertThat(DnrConductor.novedades(d, vistas)).isEmpty()
        // Amazon clasifica la C y llega una D: la C, actualizada; la D, nueva.
        val despues = d.copy(semanas = listOf(semana(dnr("D", "cuenta"), dnr("A", "cuenta"), dnr("B", "no_cuenta")),
            semana(dnr("C", "no_cuenta"), desde = "2026-11-01", hasta = "2026-11-07")))
        assertThat(DnrConductor.novedades(despues, vistas)).containsExactly("D", MarcaDnr.NUEVA, "C", MarcaDnr.ACTUALIZADA)
        assertThat(DnrConductor.textoMarca(MarcaDnr.NUEVA)).isEqualTo("Nueva")
        assertThat(DnrConductor.textoMarca(MarcaDnr.ACTUALIZADA)).isEqualTo("Actualizada")
    }

    @Test
    fun un_aviso_con_vista_dnr_abre_mis_dnr_y_los_demas_siguen_igual() {
        assertThat(destinoDeAviso("/conductor?vista=dnr")).isEqualTo("dnr")
        assertThat(destinoDeAviso("/conductor?vista=dnr", "Tienes 2 DNR nuevas")).isEqualTo("dnr")
        // Manda el enlace, aunque el título hable de otra cosa.
        assertThat(destinoDeAviso("/conductor?vista=dnr", "Inspección pendiente")).isEqualTo("dnr")
        // Lo de antes, sin cambios.
        assertThat(destinoDeAviso("/conductor", "Inspección pendiente")).isEqualTo("auditoria")
        assertThat(destinoDeAviso("/conductor?vista=extra")).isEqualTo("extras")
        assertThat(destinoDeAviso("/ruta")).isEqualTo("ruta")
        assertThat(destinoDeAviso("/conductor", "Tu petición de día libre")).isEqualTo("turnos")
        assertThat(destinoDeAviso("/conductor", "Tienes 2 DNR nuevas")).isEqualTo("avisos")
    }

    @Test
    fun con_404_la_empresa_no_tiene_la_dnr_diaria_y_no_hay_mis_dnr() = runBlocking {
        servidor.enqueue(MockResponse().setResponseCode(404).setBody("""{"detail":"Not Found"}"""))
        assertThat(misDnrDe(api())).isNull()
        val pedida = servidor.takeRequest()
        // La ruta, sin parámetros: quién es lo saca el servidor del token.
        assertThat(pedida.path).isEqualTo("/api/diarios/mias")
        assertThat(pedida.getHeader("Authorization")).isEqualTo("Bearer t")
    }

    @Test
    fun con_200_llegan_sus_semanas_y_nada_mas() = runBlocking {
        servidor.enqueue(MockResponse().setResponseCode(200).setBody("""
            {"tiene_id": true, "en_revision": false, "datos_hasta": "2026-11-10", "semanas": [
              {"semana": "2026-11-08", "hasta": "2026-11-14", "cuentan": 1, "no_cuentan": 0, "sin_clasificar": 1,
               "dnr": [{"dia": "2026-11-10", "paquete": "TBA111", "estado": "cuenta"}, {"dia": "2026-11-09", "paquete": "TBA222", "estado": "sin_clasificar"}]},
              {"semana": "2026-11-01", "hasta": "2026-11-07", "cuentan": 0, "no_cuentan": 0, "sin_clasificar": 0, "dnr": []}
            ], "otro_campo": 1}
        """.trimIndent()))
        val d = misDnrDe(api())!!
        assertThat(d.tiene_id).isTrue()
        assertThat(d.en_revision).isFalse()
        assertThat(d.datos_hasta).isEqualTo("2026-11-10")
        assertThat(d.semanas).hasSize(2)
        assertThat(d.semanas[0].dnr.map { it.paquete }).containsExactly("TBA111", "TBA222").inOrder()
        assertThat(DnrConductor.fraseSemana(d.semanas[0].dnr.size)).isEqualTo("Esta semana llevas 2 DNR")
        assertThat(DnrConductor.desglose(d.semanas[0])).isEqualTo("1 te cuenta · 1 sin clasificar")
        assertThat(d.semanas[1].dnr).isEmpty()
    }

    @Test
    fun sin_id_llega_vacio_y_lo_demas_es_un_fallo_que_se_dice() = runBlocking {
        servidor.enqueue(MockResponse().setResponseCode(200).setBody("""{"tiene_id": false, "en_revision": false, "datos_hasta": null, "semanas": []}"""))
        val sinId = misDnrDe(api())!!
        assertThat(sinId.tiene_id).isFalse()
        assertThat(sinId.semanas).isEmpty()
        assertThat(DnrConductor.lineaInicio(sinId)).isNull()
        // Un 500 o un 403 no es «no existe»: sube como ErrorApi para que la pantalla diga que no ha podido cargarlas.
        for (codigo in listOf(500, 403)) {
            servidor.enqueue(MockResponse().setResponseCode(codigo).setBody("""{"detail":"x"}"""))
            try {
                misDnrDe(api())
                fail("con $codigo tenía que fallar")
            } catch (e: ErrorApi) {
                assertThat(e.estado).isEqualTo(codigo)
            }
        }
    }
}
