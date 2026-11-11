package com.flotadsp.fds.ui.acceso

import com.flotadsp.fds.data.Api
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.MisDnr
import com.flotadsp.fds.data.SemanaDnr
import com.flotadsp.fds.data.UnaDnr
import com.flotadsp.fds.data.misDnrDe
import com.flotadsp.fds.ui.Idioma
import com.flotadsp.fds.ui.Tono
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
 *  existiera. Y, al final, lo de la web final tras su revisión (R7). */
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
        val d = MisDnr(tiene_id = true, datos_hasta = "2026-11-10",
            semanas = listOf(semana(dnr("A", "no_cuenta"), dnr("B", "cuenta")), semana(dnr("C", "cuenta"))))
        assertThat(DnrConductor.lineaInicio(d)).isEqualTo("Esta semana: 2")
        assertThat(DnrConductor.lineaInicio(d.copy(semanas = listOf(semana())))).isEqualTo("Esta semana: ninguna")
        assertThat(DnrConductor.lineaInicio(MisDnr(tiene_id = false))).isNull()
    }

    @Test
    fun las_fechas_salen_cortas_y_sin_reportes_no_hay_linea_de_hasta_cuando() {
        assertThat(DnrConductor.rango(semana(desde = "2026-11-08", hasta = "2026-11-14"))).isEqualTo("Del 8/11 al 14/11")
        assertThat(DnrConductor.dia("2026-11-10")).endsWith("10/11")
        // Sin `datos_hasta`, ninguna línea pequeña: lo dice la frase grande («Aún no hay reportes de tu centro»).
        assertThat(DnrConductor.hastaCuando(null)).isNull()
        assertThat(DnrConductor.hastaCuando("")).isNull()
        assertThat(DnrConductor.hastaCuando("2026-11-10")).startsWith("Hay datos hasta el ")
        assertThat(DnrConductor.hastaCuando("2026-11-10")).contains("10/11")
        // Una fecha que no se entiende sale tal cual, sin romper la pantalla.
        assertThat(DnrConductor.dia("ayer")).isEqualTo("ayer")
    }

    @Test
    fun lo_nuevo_es_lo_que_no_vio_y_lo_que_amazon_ha_clasificado_desde_entonces() {
        val d = MisDnr(tiene_id = true, semanas = listOf(
            semana(dnr("A", "cuenta"), dnr("B", "no_cuenta")),
            semana(dnr("C", "sin_clasificar"), dnr("", "cuenta"), desde = "2026-11-01", hasta = "2026-11-07"),
        ))
        // La primera vez (nada apuntado en el móvil), todas son nuevas; la que no trae paquete no cuenta.
        assertThat(DnrConductor.novedades(d, null)).containsExactly("A", MarcaDnr.NUEVA, "B", MarcaDnr.NUEVA, "C", MarcaDnr.NUEVA)
        // Lo que se apunta es la HUELLA de cada paquete con su estado.
        val vistas = DnrConductor.vistasDe(d)
        assertThat(vistas).containsExactly(DnrConductor.huella("A"), "cuenta", DnrConductor.huella("B"), "no_cuenta",
            DnrConductor.huella("C"), "sin_clasificar")
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
    fun lee_cada_dnr_con_sus_12_claves_como_las_manda_el_servidor() = runBlocking {
        servidor.enqueue(MockResponse().setResponseCode(200).setBody("""
            {"tiene_id": true, "en_revision": false, "datos_hasta": "2026-11-10", "semanas": [
              {"semana": "2026-11-08", "hasta": "2026-11-14", "cuentan": 1, "no_cuentan": 0, "sin_clasificar": 0,
               "dnr": [{"dia": "2026-11-09", "entrega": "2026-11-07", "paquete": "TBA319455120318", "estado": "cuenta", "cp": "15704",
                        "como": "puerta", "lejos": true, "llamada": "no", "segundos": null, "fallo_contacto": true, "foto": "mal",
                        "foto_motivo": "borrosa"}]}
            ]}
        """.trimIndent()))
        val x = misDnrDe(api())!!.semanas[0].dnr[0]
        assertThat(x).isEqualTo(UnaDnr(dia = "2026-11-09", entrega = "2026-11-07", paquete = "TBA319455120318", estado = "cuenta",
            cp = "15704", como = "puerta", lejos = true, llamada = "no", segundos = null, fallo_contacto = true, foto = "mal",
            foto_motivo = "borrosa"))
        assertThat(DnrConductor.cabeceraTarjeta(x)).isEqualTo("Entregado el sáb, 7/11 · CP 15704")
        assertThat(DnrConductor.concesionTarjeta(x)).isEqualTo("DNR del lun, 9/11")
        // Como la tarjeta de la web: la puerta, a más de 25 m, no llamó (y entonces el fallo de contacto ya no se repite) y
        // la foto con su motivo; y la próxima vez, los dos consejos (el de llamar, no el de contactar: nunca los dos).
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
        // Todos los campos a null (no se sabe con seguridad).
        servidor.enqueue(MockResponse().setResponseCode(200).setBody("""
            {"tiene_id": true, "en_revision": false, "datos_hasta": "2026-11-10", "semanas": [
              {"semana": "2026-11-08", "hasta": "2026-11-14", "cuentan": 0, "no_cuentan": 0, "sin_clasificar": 1,
               "dnr": [{"dia": "2026-11-10", "entrega": null, "paquete": "TBA1", "estado": "sin_clasificar", "cp": null, "como": null,
                        "lejos": null, "llamada": null, "segundos": null, "fallo_contacto": null, "foto": null, "foto_motivo": null}]}
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
            // Sin entrega ni CP, solo el día de la DNR, y nada bajo el paquete.
            assertThat(DnrConductor.cabeceraTarjeta(x)).isEqualTo("DNR del mar, 10/11")
            assertThat(DnrConductor.concesionTarjeta(x)).isNull()
        }
        assertThat(DnrConductor.cabeceraTarjeta(viejo.copy(cp = "  "))).isEqualTo("DNR del mar, 10/11")
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
        // Llamó y aun así le apuntaron el contacto: salen las dos (como la web).
        assertThat(DnrConductor.quePaso(base.copy(llamada = "si", segundos = 12, fallo_contacto = true)).map { it.texto })
            .containsExactly("Llamaste al cliente (12 s)", "Te apuntaron un fallo de contacto con el cliente").inOrder()
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
        // Dentro de su frase, en minúscula y sin el punto de la abreviatura, como la web («sáb, 7/11»).
        assertThat(DnrConductor.dia("2026-11-10")).isEqualTo("mar, 10/11")
        assertThat(DnrConductor.dia("2026-11-08")).isEqualTo("dom, 8/11")
        assertThat(DnrConductor.dia("2026-11-07")).isEqualTo("sáb, 7/11")
        assertThat(DnrConductor.cabeceraTarjeta(dnr("TBA1", "cuenta").copy(cp = "15704"))).isEqualTo("DNR del mar, 10/11 · CP 15704")
        // Sin punto final (en alemán la fecha ya acaba en uno).
        assertThat(DnrConductor.hastaCuando("2026-11-10")).isEqualTo("Hay datos hasta el martes, 10/11")
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
            // Las frases nuevas de la web final (R7), traducidas.
            assertThat(DnrConductor.fraseSinNinguna(CasoSemana.SIN_DATOS_SEMANA)).isEqualTo("No reports for this week yet")
            assertThat(DnrConductor.proximaVez(dnr("TBA1", "cuenta").copy(fallo_contacto = true)))
                .containsExactly("Contact the customer before leaving the parcel.")
            assertThat(DnrConductor.actualizadas(2)).isEqualTo("2 updated")
        } finally {
            Idioma.arrancar("es", "es")
        }
    }

    /* ── La web final tras su revisión (R7, 11-11-2026): las mismas condiciones que MisDnr.jsx y dnrVistas.js. ── */

    @Test
    fun r7_con_el_dia_de_la_entrega_la_tarjeta_dice_que_dia_es_cada_cosa() {
        val x = UnaDnr(dia = "2026-11-09", entrega = "2026-11-07", paquete = "TBA319400000009", estado = "cuenta", cp = "15704")
        // Con entrega: arriba el día de la entrega y el CP; bajo el paquete, más discreto, el de la DNR.
        assertThat(DnrConductor.entregaDe(x)).isEqualTo("2026-11-07")
        assertThat(DnrConductor.cabeceraTarjeta(x)).isEqualTo("Entregado el sáb, 7/11 · CP 15704")
        assertThat(DnrConductor.concesionTarjeta(x)).isEqualTo("DNR del lun, 9/11")
        // Sin entrega: arriba el de la DNR y el CP, y nada bajo el paquete.
        val sin = x.copy(entrega = null)
        assertThat(DnrConductor.cabeceraTarjeta(sin)).isEqualTo("DNR del lun, 9/11 · CP 15704")
        assertThat(DnrConductor.concesionTarjeta(sin)).isNull()
        // Con entrega y sin CP, el día solo.
        assertThat(DnrConductor.cabeceraTarjeta(x.copy(cp = null))).isEqualTo("Entregado el sáb, 7/11")
        // Lo que no es AAAA-MM-DD no se toma por el día de la entrega (como `esDia` de la web): la forma sin entrega.
        for (raro in listOf("07/11/2026", "2026-11-07T10:00:00", "", "ayer")) {
            val r = x.copy(entrega = raro)
            assertThat(DnrConductor.entregaDe(r)).isNull()
            assertThat(DnrConductor.cabeceraTarjeta(r)).isEqualTo("DNR del lun, 9/11 · CP 15704")
            assertThat(DnrConductor.concesionTarjeta(r)).isNull()
        }
    }

    @Test
    fun r7_los_tres_casos_de_la_frase_grande_como_casoSemana_de_la_web() {
        val vacia = semana(desde = "2026-11-08", hasta = "2026-11-14")
        val pasada = semana(dnr("A", "cuenta", dia = "2026-11-05"), desde = "2026-11-01", hasta = "2026-11-07")
        // 1. Su centro sin ningún reporte: neutra, sin «Hay datos…», y la semana pasada cerrada.
        val sinReportes = MisDnr(tiene_id = true, datos_hasta = null, semanas = listOf(vacia, pasada))
        assertThat(DnrConductor.casoSemana(sinReportes)).isEqualTo(CasoSemana.SIN_REPORTES)
        assertThat(DnrConductor.fraseSinNinguna(CasoSemana.SIN_REPORTES)).isEqualTo("Aún no hay reportes de tu centro")
        assertThat(DnrConductor.hastaCuando(sinReportes.datos_hasta)).isNull()
        assertThat(DnrConductor.lineaInicio(sinReportes)).isEqualTo("Esta semana: aún sin datos")
        assertThat(DnrConductor.abiertaSinTocar(1, CasoSemana.SIN_REPORTES)).isFalse()
        // 2. Un lunes: los datos acaban el sábado, antes del domingo de esta semana. Neutra, con «Hay datos hasta…» y «La
        //    semana pasada» (y solo ella) abierta sin tocarla.
        val lunes = sinReportes.copy(datos_hasta = "2026-11-07")
        assertThat(DnrConductor.casoSemana(lunes)).isEqualTo(CasoSemana.SIN_DATOS_SEMANA)
        assertThat(DnrConductor.fraseSinNinguna(CasoSemana.SIN_DATOS_SEMANA)).isEqualTo("De esta semana aún no hay reportes")
        assertThat(DnrConductor.hastaCuando(lunes.datos_hasta)).isEqualTo("Hay datos hasta el sábado, 7/11")
        assertThat(DnrConductor.lineaInicio(lunes)).isEqualTo("Esta semana: aún sin datos")
        assertThat(DnrConductor.abiertaSinTocar(1, CasoSemana.SIN_DATOS_SEMANA)).isTrue()
        assertThat(DnrConductor.abiertaSinTocar(2, CasoSemana.SIN_DATOS_SEMANA)).isFalse()
        // 3. Con datos de esta semana (el mismo domingo ya cuenta) y ninguna: «no llevas ninguna», con su ✓ verde.
        for (hasta in listOf("2026-11-08", "2026-11-10")) {
            val ninguna = sinReportes.copy(datos_hasta = hasta)
            assertThat(DnrConductor.casoSemana(ninguna)).isEqualTo(CasoSemana.NINGUNA)
            assertThat(DnrConductor.lineaInicio(ninguna)).isEqualTo("Esta semana: ninguna")
            assertThat(DnrConductor.abiertaSinTocar(1, CasoSemana.NINGUNA)).isFalse()
        }
        assertThat(DnrConductor.fraseSinNinguna(CasoSemana.NINGUNA)).isEqualTo("Esta semana no llevas ninguna")
        // Con DNR esta semana manda «llevas», aunque `datos_hasta` fuera anterior (si las hay, hay datos de esta semana).
        val lleva = lunes.copy(semanas = listOf(semana(dnr("B", "sin_clasificar", dia = "2026-11-09")), pasada))
        assertThat(DnrConductor.casoSemana(lleva)).isEqualTo(CasoSemana.LLEVA)
        assertThat(DnrConductor.lineaInicio(lleva)).isEqualTo("Esta semana: 1")
        assertThat(DnrConductor.abiertaSinTocar(1, CasoSemana.LLEVA)).isFalse()
        // Sin semanas (sin ID o con todos sus ID en revisión), ningún caso ni línea.
        assertThat(DnrConductor.casoSemana(MisDnr(tiene_id = true, en_revision = true, datos_hasta = "2026-11-10"))).isNull()
    }

    @Test
    fun r7_nuevas_y_actualizadas_aparte_y_el_numero_rojo_solo_cuenta_las_nuevas() {
        val antes = MisDnr(tiene_id = true, datos_hasta = "2026-11-10", semanas = listOf(
            semana(dnr("A", "sin_clasificar"), dnr("B", "sin_clasificar")),
            semana(dnr("C", "sin_clasificar", dia = "2026-11-05"), desde = "2026-11-01", hasta = "2026-11-07"),
        ))
        val vistas = DnrConductor.vistasDe(antes)
        // Dos que solo cambian de estado: ninguna nueva, sin número rojo, y el subtítulo dice «2 actualizadas».
        val clasificadas = antes.copy(semanas = listOf(semana(dnr("A", "cuenta"), dnr("B", "sin_clasificar")),
            semana(dnr("C", "no_cuenta", dia = "2026-11-05"), desde = "2026-11-01", hasta = "2026-11-07")))
        val marcas = DnrConductor.novedades(clasificadas, vistas)
        assertThat(DnrConductor.contar(marcas, MarcaDnr.NUEVA)).isEqualTo(0)
        assertThat(DnrConductor.contar(marcas, MarcaDnr.ACTUALIZADA)).isEqualTo(2)
        assertThat(DnrConductor.filaInicio(clasificadas, vistas)).isEqualTo(FilaDnrInicio(0, "Esta semana: 2"))
        assertThat(DnrConductor.novedadesEnCorto(marcas)).isEqualTo("2 actualizadas")
        // Y llegan dos que no estaban: el número rojo cuenta esas dos, y la cabecera las dos cosas.
        val conNuevas = clasificadas.copy(semanas = listOf(
            semana(dnr("D", "cuenta"), dnr("E", "sin_clasificar"), dnr("A", "cuenta"), dnr("B", "sin_clasificar")),
            clasificadas.semanas[1].copy(dnr = listOf(dnr("C", "sin_clasificar", dia = "2026-11-05"))),
        ))
        val marcas2 = DnrConductor.novedades(conNuevas, vistas)
        assertThat(DnrConductor.filaInicio(conNuevas, vistas)).isEqualTo(FilaDnrInicio(2, "Esta semana: 4"))
        assertThat(DnrConductor.novedadesEnCorto(marcas2)).isEqualTo("2 nuevas · 1 actualizada")
        assertThat(DnrConductor.novedadesEnCorto(emptyMap())).isNull()
        // La primera vez (nada apuntado), todas son nuevas y todas suman.
        assertThat(DnrConductor.filaInicio(conNuevas, null).nuevas).isEqualTo(5)
        // Sus singulares y plurales.
        assertThat(DnrConductor.actualizadas(0)).isNull()
        assertThat(DnrConductor.actualizadas(1)).isEqualTo("1 actualizada")
        assertThat(DnrConductor.actualizadas(3)).isEqualTo("3 actualizadas")
    }

    @Test
    fun r7_el_desglose_de_cada_semana_anterior_con_alguna_dnr() {
        // Lo que sale bajo el rango de «La semana pasada» en la foto de la web final.
        assertThat(DnrConductor.desglose(semana(dnr("A", "cuenta"), dnr("B", "no_cuenta"), desde = "2026-11-01", hasta = "2026-11-07")))
            .isEqualTo("1 te cuenta · 1 no te cuenta")
        assertThat(DnrConductor.desglose(semana(dnr("A", "no_cuenta"), desde = "2026-10-18", hasta = "2026-10-24")))
            .isEqualTo("1 no te cuenta")
        // La que no tuvo ninguna no lleva desglose (dice «Ninguna»).
        assertThat(DnrConductor.desglose(semana(desde = "2026-10-25", hasta = "2026-10-31"))).isEmpty()
    }

    @Test
    fun r7_el_fallo_de_contacto_lleva_su_consejo_prudente_y_nunca_los_dos() {
        val base = dnr("TBA1", "cuenta")
        // Llamó 12 s y aun así le apuntaron el fallo de contacto: el consejo prudente, que no afirma que no llamara.
        assertThat(DnrConductor.proximaVez(base.copy(llamada = "si", segundos = 12, fallo_contacto = true)))
            .containsExactly("Contacta con el cliente antes de dejar el paquete.")
        assertThat(DnrConductor.proximaVez(base.copy(llamada = null, fallo_contacto = true)))
            .containsExactly("Contacta con el cliente antes de dejar el paquete.")
        // Con «no llamó», solo «Llama al cliente…» (y el de la foto si toca).
        assertThat(DnrConductor.proximaVez(base.copy(llamada = "no", fallo_contacto = true, foto = "mal")))
            .containsExactly("Llama al cliente antes de dejar el paquete.", "Saca la foto con el paquete y el sitio bien a la vista.").inOrder()
        // Sin fallo de contacto, nada.
        assertThat(DnrConductor.proximaVez(base.copy(llamada = "si", segundos = 12))).isEmpty()
    }

    @Test
    fun r7_no_te_cuenta_va_en_gris_y_te_cuenta_en_rojo() {
        assertThat(tonoEstado("cuenta").first).isEqualTo(Tono.PELIGRO)
        assertThat(tonoEstado("no_cuenta").first).isEqualTo(Tono.NEUTRO)
        assertThat(tonoEstado("sin_clasificar").first).isEqualTo(Tono.AVISO)
    }

    @Test
    fun r7_en_revision_con_semanas_vacias_sigue_diciendo_su_estado() = runBlocking {
        // Todos sus ID en revisión: el servidor manda `semanas` vacía y `datos_hasta` calculado.
        servidor.enqueue(MockResponse().setResponseCode(200).setBody(
            """{"tiene_id": true, "en_revision": true, "datos_hasta": "2026-11-10", "semanas": []}"""))
        val d = misDnrDe(api())!!
        assertThat(DnrConductor.avisoRevision(d))
            .isEqualTo("La oficina está revisando tu ID de reparto. Cuando lo confirme, aquí verás tus DNR.")
        assertThat(DnrConductor.casoSemana(d)).isNull()
        assertThat(DnrConductor.lineaInicio(d)).isNull()
        // Con alguno en revisión y semanas, el otro aviso; sin revisión, ninguno.
        val conSemanas = d.copy(semanas = listOf(semana()))
        assertThat(DnrConductor.avisoRevision(conSemanas))
            .isEqualTo("La oficina está revisando uno de tus ID de reparto: puede que aquí falte alguna.")
        assertThat(DnrConductor.avisoRevision(conSemanas.copy(en_revision = false))).isNull()
    }

    @Test
    fun r7_lo_apuntado_guarda_una_huella_corta_la_misma_que_la_web_y_nunca_el_codigo() {
        // Los mismos valores que da huella() de dnrVistas.js (FNV-1a de 32 bits en base 36).
        assertThat(DnrConductor.huella("TBA319400000009")).isEqualTo("osk4e4")
        assertThat(DnrConductor.huella("TBA318855201734")).isEqualTo("d15cx1")
        assertThat(DnrConductor.huella("TBA1")).isEqualTo("f6oyjp")
        assertThat(DnrConductor.huella("A")).isEqualTo("1ie980c")
        assertThat(DnrConductor.huella("")).isEqualTo("ztntfp")
        val d = MisDnr(tiene_id = true, semanas = listOf(semana(dnr("TBA319400000009", "cuenta"), dnr("TBA318855201734", "no_cuenta"))))
        val vistas = DnrConductor.vistasDe(d)
        assertThat(vistas).containsExactly("osk4e4", "cuenta", "d15cx1", "no_cuenta")
        assertThat(vistas.keys.joinToString() + vistas.values.joinToString()).doesNotContain("TBA")
        // Lo apuntado con el formato anterior (el código) no casa: salen como nuevas una vez, y nada se rompe.
        assertThat(DnrConductor.novedades(d, mapOf("TBA319400000009" to "cuenta")).values).containsExactly(MarcaDnr.NUEVA, MarcaDnr.NUEVA)
    }
}
