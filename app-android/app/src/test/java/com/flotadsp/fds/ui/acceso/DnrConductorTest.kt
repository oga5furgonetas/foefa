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
        // Un 500 o un 502 no es «no existe»: sube como ErrorApi para que la pantalla diga que no ha podido cargarlas.
        for (codigo in listOf(500, 502)) {
            servidor.enqueue(MockResponse().setResponseCode(codigo).setBody("""{"detail":"x"}"""))
            try {
                misDnrDe(api())
                fail("con $codigo tenía que fallar")
            } catch (e: ErrorApi) {
                assertThat(e.estado).isEqualTo(codigo)
            }
        }
    }

    /* ── Segunda vuelta (11-11-2026): la forma final de la respuesta, «qué pasó» y el 403. ── */

    @Test
    fun con_403_su_ficha_esta_de_baja_y_es_como_el_404() = runBlocking {
        // «Tu ficha está de baja» (y «Solo para conductores»): ni fila en el inicio ni pantalla, y nada que reintentar.
        servidor.enqueue(MockResponse().setResponseCode(403).setBody("""{"detail":"Tu ficha está de baja"}"""))
        assertThat(misDnrDe(api())).isNull()
        servidor.enqueue(MockResponse().setResponseCode(404).setBody("""{"detail":"Not Found"}"""))
        assertThat(misDnrDe(api())).isNull()
        // Una sola petición cada vez: no vuelve a pedirla por su cuenta.
        assertThat(servidor.requestCount).isEqualTo(2)
    }

    @Test
    fun lee_cada_dnr_con_todos_sus_campos_y_sin_lo_de_diagnostico() = runBlocking {
        servidor.enqueue(MockResponse().setResponseCode(200).setBody("""
            {"tiene_id": true, "en_revision": false, "datos_hasta": "2026-11-10", "semanas": [
              {"semana": "2026-11-08", "hasta": "2026-11-14", "cuentan": 1, "no_cuentan": 0, "sin_clasificar": 0,
               "dnr": [{"dia": "2026-11-09", "paquete": "TBA319455120318", "estado": "cuenta", "cp": "15704", "como": "puerta",
                        "lejos": true, "llamada": "no", "segundos": null, "fallo_contacto": true, "foto": "mal",
                        "foto_motivo": "borrosa", "sin_interpretar": {"cc_tipo": "RARO", "foto": "X"}}]}
            ]}
        """.trimIndent()))
        val x = misDnrDe(api())!!.semanas[0].dnr[0]
        assertThat(x).isEqualTo(UnaDnr(dia = "2026-11-09", paquete = "TBA319455120318", estado = "cuenta", cp = "15704", como = "puerta",
            lejos = true, llamada = "no", segundos = null, fallo_contacto = true, foto = "mal", foto_motivo = "borrosa"))
        assertThat(DnrConductor.cabeceraTarjeta(x)).isEqualTo("Lun, 9/11 · CP 15704")
        // Como la tarjeta de la web: la puerta, a más de 25 m, no llamó (y entonces el fallo de contacto ya no se repite) y
        // la foto con su motivo; y la próxima vez, los dos consejos.
        assertThat(DnrConductor.quePaso(x).map { it.texto }).containsExactly(
            "Lo marcaste en la puerta", "Lo marcaste a más de 25 m del sitio", "No llamaste al cliente",
            "La foto no pasó la revisión: salió borrosa").inOrder()
        assertThat(DnrConductor.quePaso(x).map { it.color })
            .containsExactly(ColorHecho.DATO, ColorHecho.AVISO, ColorHecho.MAL, ColorHecho.MAL).inOrder()
        assertThat(DnrConductor.proximaVez(x)).containsExactly(
            "Llama al cliente antes de dejar el paquete.", "Saca la foto con el paquete y el sitio bien a la vista.").inOrder()
    }

    @Test
    fun todo_a_null_o_sin_los_campos_no_dice_nada_y_la_pantalla_sigue_igual() = runBlocking {
        // Todos los campos nuevos a null (no se sabe con seguridad).
        servidor.enqueue(MockResponse().setResponseCode(200).setBody("""
            {"tiene_id": true, "en_revision": false, "datos_hasta": "2026-11-10", "semanas": [
              {"semana": "2026-11-08", "hasta": "2026-11-14", "cuentan": 0, "no_cuentan": 0, "sin_clasificar": 1,
               "dnr": [{"dia": "2026-11-10", "paquete": "TBA1", "estado": "sin_clasificar", "cp": null, "como": null, "lejos": null,
                        "llamada": null, "segundos": null, "fallo_contacto": null, "foto": null, "foto_motivo": null, "sin_interpretar": {}}]}
            ]}
        """.trimIndent()))
        val nulos = misDnrDe(api())!!.semanas[0].dnr[0]
        // Un servidor de antes: solo dia, paquete y estado.
        servidor.enqueue(MockResponse().setResponseCode(200).setBody("""
            {"tiene_id": true, "semanas": [{"semana": "2026-11-08", "hasta": "2026-11-14",
              "dnr": [{"dia": "2026-11-10", "paquete": "TBA1", "estado": "sin_clasificar"}]}]}
        """.trimIndent()))
        val viejo = misDnrDe(api())!!.semanas[0].dnr[0]
        for (x in listOf(nulos, viejo)) {
            assertThat(x).isEqualTo(UnaDnr(dia = "2026-11-10", paquete = "TBA1", estado = "sin_clasificar"))
            assertThat(DnrConductor.quePaso(x)).isEmpty()
            assertThat(DnrConductor.proximaVez(x)).isEmpty()
            // Sin CP, solo el día.
            assertThat(DnrConductor.cabeceraTarjeta(x)).isEqualTo("Mar, 10/11")
        }
        assertThat(DnrConductor.cabeceraTarjeta(viejo.copy(cp = "  "))).isEqualTo("Mar, 10/11")
    }

    @Test
    fun un_valor_que_no_conoce_es_como_null_y_nunca_se_pinta_el_codigo() = runBlocking {
        servidor.enqueue(MockResponse().setResponseCode(200).setBody("""
            {"tiene_id": true, "semanas": [{"semana": "2026-11-08", "hasta": "2026-11-14",
              "dnr": [{"dia": "2026-11-10", "paquete": "TBA1", "estado": "cuenta", "como": "DELIVERED_TO_MOON", "llamada": "quizas",
                       "foto": "regular", "foto_motivo": "borrosa"},
                      {"dia": "2026-11-10", "paquete": "TBA2", "estado": "cuenta", "foto": "mal", "foto_motivo": "LENS_FLARE"}]}]}
        """.trimIndent()))
        val (raro, sinMotivo) = misDnrDe(api())!!.semanas[0].dnr
        // Ni el «como», ni la llamada, ni la foto que no conoce: nada (y nada de «la próxima vez»).
        assertThat(DnrConductor.quePaso(raro)).isEmpty()
        assertThat(DnrConductor.proximaVez(raro)).isEmpty()
        // La foto falló pero el motivo no se conoce: la frase sin motivo, nunca «LENS_FLARE».
        assertThat(DnrConductor.quePaso(sinMotivo).map { it.texto }).containsExactly("La foto no pasó la revisión")
        assertThat(DnrConductor.quePaso(sinMotivo).joinToString { it.texto }).doesNotContain("LENS")
        assertThat(DnrConductor.proximaVez(sinMotivo)).containsExactly("Saca la foto con el paquete y el sitio bien a la vista.")
        assertThat(DnrConductor.como("DELIVERED_TO_MOON")).isNull()
        assertThat(DnrConductor.motivoFoto("LENS_FLARE")).isNull()
    }

    @Test
    fun cada_dato_sale_solo_con_la_misma_condicion_que_la_web() {
        val base = dnr("TBA1", "cuenta")
        // Cada «como» con su frase.
        val frases = mapOf(
            "puerta" to "Lo marcaste en la puerta", "puerta_trasera" to "Lo marcaste en la puerta de atrás",
            "buzon" to "Lo marcaste en el buzón", "en_mano" to "Lo marcaste como entregado en mano",
            "familiar" to "Lo marcaste como entregado a alguien de la casa", "recepcion" to "Lo marcaste en recepción",
            "conserjeria" to "Lo marcaste en conserjería", "vecino" to "Lo marcaste como entregado a un vecino",
            "locker" to "Lo marcaste en un locker", "comercio" to "Lo marcaste en un comercio", "jardin" to "Lo marcaste en el jardín",
            "lugar_seguro" to "Lo marcaste en un lugar seguro", "garaje" to "Lo marcaste en el garaje", "cobertizo" to "Lo marcaste en el cobertizo",
        )
        for ((clave, frase) in frases) assertThat(DnrConductor.quePaso(base.copy(como = clave)).map { it.texto }).containsExactly(frase)
        // La distancia: más de 25 m es para fijarse; menos, está bien.
        assertThat(DnrConductor.quePaso(base.copy(lejos = false)).single()).isEqualTo(
            Hecho("lejos", "Lo marcaste a menos de 25 m del sitio", DibujoHecho.CERCA, ColorHecho.BIEN))
        assertThat(DnrConductor.quePaso(base.copy(lejos = true)).single().color).isEqualTo(ColorHecho.AVISO)
        // La llamada: con segundos, «(12 s)»; sin segundos (o a 0), sin ellos; y no dice «No llamaste» si no lo sabe.
        assertThat(DnrConductor.quePaso(base.copy(llamada = "si", segundos = 12)).map { it.texto }).containsExactly("Llamaste al cliente (12 s)")
        assertThat(DnrConductor.quePaso(base.copy(llamada = "si")).map { it.texto }).containsExactly("Llamaste al cliente")
        assertThat(DnrConductor.quePaso(base.copy(llamada = "si", segundos = 0)).map { it.texto }).containsExactly("Llamaste al cliente")
        assertThat(DnrConductor.quePaso(base.copy(llamada = null, segundos = 30)).map { it.texto }).isEmpty()
        assertThat(DnrConductor.quePaso(base.copy(llamada = null, fallo_contacto = true)).map { it.texto })
            .containsExactly("Te apuntaron un fallo de contacto con el cliente")
        // Llamó y aun así le apuntaron el contacto: salen las dos (como la web); sin llamada no hay consejo de llamar.
        assertThat(DnrConductor.quePaso(base.copy(llamada = "si", segundos = 12, fallo_contacto = true)).map { it.texto })
            .containsExactly("Llamaste al cliente (12 s)", "Te apuntaron un fallo de contacto con el cliente").inOrder()
        assertThat(DnrConductor.proximaVez(base.copy(llamada = "si", fallo_contacto = true))).isEmpty()
        assertThat(DnrConductor.proximaVez(base.copy(llamada = null, fallo_contacto = true))).isEmpty()
        assertThat(DnrConductor.proximaVez(base.copy(llamada = "no"))).containsExactly("Llama al cliente antes de dejar el paquete.")
        // La foto: nada si es null; «pasó» en verde; «no pasó» con cada motivo en llano.
        assertThat(DnrConductor.quePaso(base.copy(foto = null, foto_motivo = "borrosa"))).isEmpty()
        assertThat(DnrConductor.quePaso(base.copy(foto = "bien")).single()).isEqualTo(
            Hecho("foto", "La foto pasó la revisión", DibujoHecho.FOTO_BIEN, ColorHecho.BIEN))
        assertThat(DnrConductor.proximaVez(base.copy(foto = "bien"))).isEmpty()
        val motivos = mapOf("borrosa" to "salió borrosa", "oscura" to "salió muy oscura", "sin_paquete" to "no se veía el paquete",
            "muy_cerca" to "estaba hecha demasiado cerca", "persona" to "salía una persona",
            "en_furgoneta" to "el paquete estaba en la furgoneta", "sin_foto" to "no había foto")
        for ((m, frase) in motivos) assertThat(DnrConductor.quePaso(base.copy(foto = "mal", foto_motivo = m)).single().texto)
            .isEqualTo("La foto no pasó la revisión: $frase")
        // Nada de la DNR sin datos.
        assertThat(DnrConductor.quePaso(base)).isEmpty()
    }

    @Test
    fun las_fechas_de_la_tarjeta_y_de_los_reportes_como_la_web() {
        assertThat(DnrConductor.dia("2026-11-10")).isEqualTo("Mar, 10/11")
        assertThat(DnrConductor.dia("2026-11-08")).isEqualTo("Dom, 8/11")
        assertThat(DnrConductor.cabeceraTarjeta(dnr("TBA1", "cuenta").copy(cp = "15704"))).isEqualTo("Mar, 10/11 · CP 15704")
        assertThat(DnrConductor.hastaCuando("2026-11-10")).isEqualTo("Reportes subidos hasta el martes, 10/11.")
    }

    @Test
    fun en_ingles_las_mismas_frases_de_la_web_y_el_plural_en_su_sitio() {
        Idioma.arrancar("en", "en")
        try {
            assertThat(DnrConductor.fraseSemana(1)).isEqualTo("This week you have 1 DNR")
            assertThat(DnrConductor.fraseSemana(5)).isEqualTo("This week you have 5 DNRs")
            assertThat(DnrConductor.quePaso(dnr("TBA1", "cuenta").copy(llamada = "si", segundos = 8)).single().texto)
                .isEqualTo("You called the customer (8 s)")
            assertThat(DnrConductor.quePaso(dnr("TBA1", "cuenta").copy(foto = "mal", foto_motivo = "borrosa")).single().texto)
                .isEqualTo("The photo didn’t pass the review: it was blurry")
        } finally {
            Idioma.arrancar("es", "es")
        }
    }
}
