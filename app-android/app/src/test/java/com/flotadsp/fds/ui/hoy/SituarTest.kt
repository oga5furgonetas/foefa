package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.Base
import com.flotadsp.fds.data.CandidatoUbicar
import com.flotadsp.fds.data.DireccionConocida
import com.flotadsp.fds.data.Direcciones
import com.flotadsp.fds.data.JSON
import com.flotadsp.fds.data.MiRuta
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.data.PuntoPendiente
import com.flotadsp.fds.data.Repositorio
import com.flotadsp.fds.ui.parada.Sugerencia
import com.flotadsp.fds.ui.parada.buscarEnMapa
import com.flotadsp.fds.ui.parada.leerPhoton
import com.flotadsp.fds.ui.parada.urlPhoton
import com.google.common.truth.Truth.assertThat
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Test

/** EL PRIMER PAQUETE BIEN SITUADO (02-11-2026): qué respuesta del geocodificador del móvil se acepta y con qué
 *  precisión, cuándo una parada cuenta como sin situar, dónde empieza el mapa de «Situar», el orden de las
 *  sugerencias y qué se prueba solo en segundo plano. Sin Android. Solo direcciones públicas (el Concello de A Coruña
 *  en la Praza de María Pita). */
class SituarTest {
    private val maria = ResultadoMovil(43.3713, -8.3960, pais = "ES", calle = "Praza de María Pita", numero = "1", cp = "15001",
        localidad = "A Coruña", texto = "Praza de María Pita, 1, 15001 A Coruña")

    @Test
    fun el_movil_vale_con_el_pais_la_calle_y_el_mismo_cp() {
        assertThat(Situar.aceptar(maria, "es", "Praza de María Pita 1, 15001 A Coruña", "15001", "A Coruña", emptyList())).isEqualTo("portal")
        // De otro país, o con la cuenta sin país: no.
        assertThat(Situar.aceptar(maria.copy(pais = "PT"), "es", "Praza de María Pita 1", "15001", "", emptyList())).isNull()
        assertThat(Situar.aceptar(maria, "", "Praza de María Pita 1", "15001", "", emptyList())).isNull()
        // Sin calle (el pueblo solo, o un comercio): no.
        assertThat(Situar.aceptar(maria.copy(calle = ""), "es", "Praza de María Pita 1", "15001", "", emptyList())).isNull()
        // Sin un punto de verdad: no.
        assertThat(Situar.aceptar(maria.copy(lat = 0.0, lng = 0.0), "es", "Praza de María Pita 1", "15001", "", emptyList())).isNull()
    }

    @Test
    fun con_otro_cp_solo_si_es_el_mismo_pueblo() {
        val otroCp = maria.copy(cp = "15003")
        assertThat(Situar.aceptar(otroCp, "es", "Praza de María Pita 1", "15001", "", emptyList())).isNull()
        // La distancia sola ya no vale (02-11-2026, visto en el emulador): con la zona al lado y sin el pueblo, no.
        assertThat(Situar.aceptar(otroCp, "es", "Praza de María Pita 1", "15001", "", listOf(Punto(43.3700, -8.4000)))).isNull()
        // Con el pueblo escrito (con o sin su artículo, o en la población de la parada): vale.
        assertThat(Situar.aceptar(otroCp, "es", "Praza de María Pita 1, 15001 A Coruña", "15001", "", listOf(Punto(43.3700, -8.4000)))).isEqualTo("portal")
        assertThat(Situar.aceptar(otroCp, "es", "Praza de María Pita 1, 15001 Coruña", "15001", "", emptyList())).isEqualTo("portal")
        assertThat(Situar.aceptar(otroCp, "es", "Praza de María Pita 1, 15001", "15001", "A Coruña", emptyList())).isEqualTo("portal")
        // El mismo nombre de pueblo, pero a más de 15 km de la zona o de la base (sería otro que se llama igual): no.
        assertThat(Situar.aceptar(otroCp, "es", "Praza de María Pita 1, 15001 A Coruña", "15001", "", listOf(Punto(42.8806, -8.5456)))).isNull()
        // Sin CP en la respuesta, pero con su población escrita en la dirección: vale.
        assertThat(Situar.aceptar(maria.copy(cp = ""), "es", "Praza de María Pita 1, A Coruña", "15001", "", emptyList())).isEqualTo("portal")
    }

    @Test
    fun el_caso_del_emulador_otra_calle_en_otro_pueblo_no_se_acepta() {
        // 02-11-2026, visto en el emulador: «Rúa Brétema Mariñeira 23, 15011 A Coruña» (no existe), y el móvil contestó
        // «Rúa Brétema, 15179 Oleiros», a 8 km del centro del 15011: quedó guardada sola, en segundo plano.
        val zona15011 = Punto(43.3600, -8.4150)
        val oleiros = ResultadoMovil(43.3283313, -8.3493802, pais = "ES", calle = "Rúa Brétema", cp = "15179", localidad = "Oleiros",
            texto = "Rúa Brétema, 15179 Oleiros, A Coruña, España")
        val dir = "Rúa Brétema Mariñeira 23, 15011 A Coruña"
        assertThat(Situar.aceptar(oleiros, "es", dir, "15011", "", listOf(zona15011))).isNull()
        assertThat(Situar.aceptar(oleiros.copy(numero = "23"), "es", dir, "15011", "", listOf(zona15011))).isNull()
        assertThat(Situar.mejor(listOf(oleiros), "es", dir, "15011", "", listOf(zona15011))).isNull()
        // Ni aunque fuera esa misma calle: otro CP y otro pueblo, aunque esté a 8 km.
        assertThat(Situar.aceptar(oleiros.copy(calle = "Rúa Brétema Mariñeira", numero = "23"), "es", dir, "15011", "", listOf(zona15011))).isNull()
        // La provincia detrás del pueblo no hace de pueblo: «15179 Oleiros, A Coruña» no es la ciudad de A Coruña.
        val real5 = ResultadoMovil(43.3700, -8.4000, pais = "ES", calle = "Rúa Real", numero = "5", cp = "15003", localidad = "A Coruña")
        assertThat(Situar.aceptar(real5, "es", "Rúa Real 5, 15179 Oleiros, A Coruña", "15179", "", emptyList())).isNull()
        // Revisión A3: otra calle con el mismo número y el mismo CP, tampoco.
        val nova = ResultadoMovil(43.3690, -8.4010, pais = "ES", calle = "Rúa Nova", numero = "1", cp = "15003", localidad = "A Coruña")
        assertThat(Situar.aceptar(nova, "es", "Rúa Real 1, 15003 A Coruña", "15003", "A Coruña", emptyList())).isNull()
    }

    @Test
    fun los_buenos_del_emulador_siguen_valiendo() {
        // Lo que contestó el móvil en el emulador (02-11-2026) para el Concello de Vilardevós.
        val vilardevos = ResultadoMovil(41.906444, -7.312111, pais = "ES", calle = "P.º Manuel Núñez", numero = "37", cp = "32616",
            localidad = "Villardevós", texto = "P.º Manuel Núñez, 37, 32616 Villardevós, Ourense, España")
        assertThat(Situar.aceptar(vilardevos, "es", "Paseo Manuel Núñez Nº 37, 32616, Vilardevós", "32616", "", emptyList())).isEqualTo("portal")
        // Sin el CP en la respuesta: el pueblo, con un carácter de diferencia («Vilardevós» y «Villardevós»).
        assertThat(Situar.aceptar(vilardevos.copy(cp = ""), "es", "Paseo Manuel Núñez Nº 37, 32616, Vilardevós", "32616", "", emptyList())).isEqualTo("portal")
        val meicende = ResultadoMovil(43.341652, -8.453945, pais = "ES", calle = "Travesía Meicende", numero = "50", cp = "15140", localidad = "Arteixo")
        assertThat(Situar.aceptar(meicende, "es", "Trav. de Meicende Nº 50, 15140, Arteixo", "15140", "", emptyList())).isEqualTo("portal")
        // Camariñas: la etiqueta dice 15124 y el CP de verdad es 15123; es el mismo pueblo, y no hay nada con qué comparar.
        val camarinas = ResultadoMovil(43.1302874, -9.1807226, pais = "ES", calle = "Praza da Insuela", numero = "57", cp = "15123", localidad = "Camariñas")
        assertThat(Situar.aceptar(camarinas, "es", "Pza. da Insuela 57, 15124, Camariñas", "15124", "", emptyList())).isEqualTo("portal")
        // Montecelo con la falta del OCR («Montccelo») y el piso detrás.
        val montecelo = ResultadoMovil(42.242464, -8.706081, pais = "ES", calle = "Rúa Montecelo", numero = "1", cp = "36207", localidad = "Vigo")
        assertThat(Situar.aceptar(montecelo, "es", "Rúa de Montccelo 1 Bajo, 36207, Vigo", "36207", "", emptyList())).isEqualTo("portal")
    }

    @Test
    fun la_misma_calle_sin_tipo_articulos_ni_acentos_y_con_un_caracter_del_ocr() {
        fun misma(escrita: String, otra: String) = Situar.mismaCalle(Situar.calleDe(escrita), otra)
        assertThat(misma("Paseo Manuel Núñez Nº 37, 32616, Vilardevós", "P.º Manuel Núñez")).isTrue()
        assertThat(misma("Trav. de Meicende Nº 50, 15140, Arteixo", "Travesía Meicende")).isTrue()
        assertThat(misma("Pza. da Insuela 57, 15124, Camariñas", "Praza da Insuela")).isTrue()
        // Calle, rúa y carrer valen igual.
        assertThat(misma("Calle Real 1, 15003 A Coruña", "Rúa Real")).isTrue()
        assertThat(misma("Carrer Major 3", "Calle Major")).isTrue()
        assertThat(misma("C/Mallorca 401, Barcelona", "Carrer de Mallorca")).isTrue()
        assertThat(misma("12 rue de Rivoli, Paris", "Rue de Rivoli")).isTrue()
        // Un carácter del OCR: una letra en una palabra larga, o una cifra por una letra.
        assertThat(misma("Rúa de Montccelo 1 Bajo, 36207, Vigo", "Rúa Montecelo")).isTrue()
        assertThat(misma("R/ Desiderio Vare1a 1, 15102, Carballo", "Rúa Desiderio Varela")).isTrue()
        assertThat(misma("Pza. de Lug0 30, 15003, A Coruña", "Praza de Lugo")).isTrue()
        // Lo que sobra delante, si la más corta tiene dos palabras o si es un título.
        assertThat(misma("Calle Emilia Pardo Bazán 3", "Rúa Pardo Bazán")).isTrue()
        assertThat(misma("Calle Fleming 2", "Calle Doctor Fleming")).isTrue()
        // Otra calle: le falta la palabra distintiva, es otra, o le sobra lo de detrás.
        assertThat(misma("Rúa Brétema Mariñeira 23, 15011 A Coruña", "Rúa Brétema")).isFalse()
        assertThat(misma("Rúa Real 1, 15003 A Coruña", "Rúa Nova")).isFalse()
        assertThat(misma("Rúa Real 1", "Rúa Real Alta")).isFalse()
        assertThat(misma("Rúa da Cruz 12, 32660, Allariz", "Rúa Madre Soledad de la Cruz")).isFalse()
        // Una letra de diferencia en una palabra corta son dos calles; y sin nombre, nada con qué comparar.
        assertThat(misma("Calle Pinar 2", "Calle Pilar")).isFalse()
        assertThat(Situar.mismaCalle("", "Rúa Real")).isFalse()
    }

    @Test
    fun el_numero_es_el_suelto_no_una_cifra_mal_leida() {
        assertThat(Situar.numeroDe("R/ Desiderio Vare1a 1, 15102, Carballo")).isEqualTo("1")
        assertThat(Situar.numeroDe("Lugar O Barreir0 6, 36471, Salceda de Caselas")).isEqualTo("6")
        assertThat(Situar.numeroDe("R/ Celso Emilio Ferreiro nº4, 15624, Ares")).isEqualTo("4")
        assertThat(Situar.numeroDe("Avinguda de la Mare de Deu de Montserrat no109, 08024, Barcelona")).isEqualTo("109")
        assertThat(Situar.calleDe("Trav. de Meicende Nº 50, 15140, Arteixo")).isEqualTo("Trav. de Meicende")
        assertThat(Situar.calleDe("Avenida de Galicia s/n, 15620, Mugardos")).isEqualTo("Avenida de Galicia")
        assertThat(Situar.calleDe("12 rue de Rivoli, Paris")).isEqualTo("rue de Rivoli")
    }

    @Test
    fun los_pueblos_escritos_sin_el_cp_el_piso_ni_la_provincia() {
        assertThat(Situar.pueblosEscritos("Rúa Real 5, 15179 Oleiros, A Coruña")).containsExactly("oleiros")
        assertThat(Situar.pueblosEscritos("Rúa Brétema Mariñeira 23, 15011 A Coruña")).containsExactly("a coruna")
        assertThat(Situar.pueblosEscritos("Rúa do Río, 19, Baixo, 15160, Sada Coruña")).containsExactly("sada")
        assertThat(Situar.pueblosEscritos("Ronda das Fontiñas 171 Baixo B 27002 Lugo, 27002, Lugo")).containsExactly("lugo")
        // La población de la parada cuenta siempre, aunque sea también una provincia.
        assertThat(Situar.pueblosEscritos("Martinete 27, O Martinete, A Coruña", "A Coruña")).containsExactly("a coruna", "o martinete").inOrder()
        assertThat(Situar.mismoPueblo("A Coruña", listOf("coruna"))).isTrue()
        assertThat(Situar.mismoPueblo("Santiago de Compostela", listOf("santiago compostela"))).isTrue()
        assertThat(Situar.mismoPueblo("As Pontes de García Rodríguez", listOf("as pontes"))).isTrue()
        assertThat(Situar.mismoPueblo("Oleiros", listOf("a coruna"))).isFalse()
        // Uno de una palabra no vale dentro de otro, como en el servidor.
        assertThat(Situar.mismoPueblo("Burgos", listOf("san mames de burgos"))).isFalse()
    }

    @Test
    fun el_piso_pegado_a_su_letra_tambien_es_el_piso() {
        // Revisión A5 (02-11-2026): «1ºB», «3ºA» o «2ºIzq», lo normal en las etiquetas, solo valían con un espacio.
        assertThat(Situar.paraBuscar("Rúa Real 2, 1ºB, 15003 A Coruña")).isEqualTo("Rúa Real 2, 15003 A Coruña")
        assertThat(Situar.paraBuscar("Calle Mayor 5 3ºA, Madrid")).isEqualTo("Calle Mayor 5, Madrid")
        assertThat(Situar.paraBuscar("Rúa Real 2 2ºIzq")).isEqualTo("Rúa Real 2")
        assertThat(Situar.conPiso("Rúa Real 2, 1ºB, 15003 A Coruña", "Calle Real 2, 15003 A Coruña")).isEqualTo("Calle Real 2, 15003 A Coruña, 1ºB")
        assertThat(Situar.conPiso("Calle Mayor 5 3ºA, Madrid", "Calle Mayor, 5, 28013 Madrid")).isEqualTo("Calle Mayor, 5, 28013 Madrid, 3ºA")
        assertThat(Situar.conPiso("Rúa Real 2 2ºIzq, A Coruña", "Rúa Real, 2, 15003 A Coruña")).isEqualTo("Rúa Real, 2, 15003 A Coruña, 2ºIzq")
        assertThat(Situar.numeroDe("Rúa Real 2, 1ºB")).isEqualTo("2")
    }

    @Test
    fun sin_cp_tiene_que_caer_cerca_de_la_ruta_o_en_el_pueblo_escrito() {
        // Sin nada con qué comparar ni pueblo en la dirección: podría ser la misma plaza de otro sitio.
        assertThat(Situar.aceptar(maria, "es", "Praza de María Pita 1", "", "", emptyList())).isNull()
        assertThat(Situar.aceptar(maria, "es", "Praza de María Pita 1, A Coruña", "", "", emptyList())).isEqualTo("portal")
        assertThat(Situar.aceptar(maria, "es", "Praza de María Pita 1", "", "A Coruña", emptyList())).isEqualTo("portal")
        // Con paradas de la ruta en A Coruña: vale; con la ruta en Madrid, a 500 km: no.
        assertThat(Situar.aceptar(maria, "es", "Praza de María Pita 1", "", "", emptyList(), listOf(Punto(43.36, -8.41)))).isEqualTo("portal")
        assertThat(Situar.aceptar(maria, "es", "Praza de María Pita 1", "", "", emptyList(), listOf(Punto(40.4168, -3.7038)))).isNull()
        // Con otro pueblo escrito, aunque caiga cerca de la ruta: no (02-11-2026).
        assertThat(Situar.aceptar(maria, "es", "Praza de María Pita 1, Oleiros", "", "", emptyList(), listOf(Punto(43.36, -8.41)))).isNull()
    }

    @Test
    fun es_el_portal_solo_con_el_mismo_numero() {
        assertThat(Situar.aceptar(maria.copy(numero = "3"), "es", "Praza de María Pita 1, 15001", "15001", "", emptyList())).isEqualTo("calle")
        assertThat(Situar.aceptar(maria.copy(numero = ""), "es", "Praza de María Pita 1, 15001", "15001", "", emptyList())).isEqualTo("calle")
        // Sin número en la dirección, el que ponga el móvil no es el portal (y el CP no es un número).
        assertThat(Situar.aceptar(maria, "es", "Praza de María Pita, 15001 A Coruña", "15001", "", emptyList())).isEqualTo("calle")
        // «1, 2º B» en la dirección: el número es el 1. «1-3» en la respuesta ya no es el 1: el portal entero (D,
        // 03-11-2026), como al elegirla.
        assertThat(Situar.aceptar(maria.copy(numero = "1-3"), "es", "Praza de María Pita 1, 15001", "15001", "", emptyList())).isEqualTo("calle")
        assertThat(Situar.aceptar(maria.copy(numero = "1-3"), "es", "Praza de María Pita 1-3, 15001", "15001", "", emptyList())).isEqualTo("portal")
        assertThat(Situar.aceptar(maria, "es", "Praza de María Pita 1, 2º B, 15001 A Coruña", "15001", "", emptyList())).isEqualTo("portal")
    }

    @Test
    fun la_mejor_es_la_primera_con_el_portal() {
        val calle = maria.copy(numero = "")
        val lejos = maria.copy(cp = "28013", lat = 40.4155, lng = -3.7074)
        val r = Situar.mejor(listOf(lejos, calle, maria), "es", "Praza de María Pita 1, 15001", "15001", "", emptyList())
        assertThat(r?.first).isEqualTo(maria)
        assertThat(r?.second).isEqualTo("portal")
        assertThat(Situar.mejor(listOf(lejos, calle), "es", "Praza de María Pita 1, 15001", "15001", "", emptyList())?.second).isEqualTo("calle")
        assertThat(Situar.mejor(listOf(lejos), "es", "Praza de María Pita 1, 15001", "15001", "", emptyList())).isNull()
        assertThat(Situar.mejor(emptyList(), "es", "Praza de María Pita 1", "15001", "", emptyList())).isNull()
    }

    @Test
    fun sin_situar_es_por_entregar_y_sin_punto() {
        assertThat(Situar.sinSituar(Parada(id = "a", lat = 43.37, lng = -8.39, geo = "ok"))).isFalse()
        assertThat(Situar.sinSituar(Parada(id = "b", geo = "no"))).isTrue()
        assertThat(Situar.sinSituar(Parada(id = "c", geo = "zona", zonaLat = 43.37, zonaLng = -8.40))).isTrue()
        // Una «zona» con lat/lng (un servidor que no cumple el contrato) es el centro del CP, no la puerta.
        val zonaConPunto = Parada(id = "d", geo = "zona", lat = 43.37, lng = -8.40)
        assertThat(zonaConPunto.ubicada).isFalse()
        assertThat(Situar.sinSituar(zonaConPunto)).isTrue()
        // La calle sin el portal ya se navega.
        assertThat(Situar.sinSituar(Parada(id = "e", lat = 43.37, lng = -8.39, geo = "aprox"))).isFalse()
        // Cerrada ya no se guía; «en ruta» sí cuenta.
        assertThat(Situar.sinSituar(Parada(id = "f", geo = "no", estado = "entregado"))).isFalse()
        assertThat(Situar.sinSituar(Parada(id = "g", geo = "pendiente", estado = "en_ruta"))).isTrue()
    }

    @Test
    fun el_punto_puesto_desde_la_app_queda_manual_y_sin_zona() {
        val p = Repositorio.conPunto(Parada(id = "a", geo = "zona", zonaLat = 43.37, zonaLng = -8.40), 43.3713, -8.3960, "mapa")
        assertThat(p.ubicada).isTrue()
        assertThat(p.geo).isEqualTo("manual")
        assertThat(p.geoOrigen).isEqualTo("mapa")
        assertThat(p.zonaLat).isNull()
        assertThat(Situar.sinSituar(p)).isFalse()
    }

    @Test
    fun el_mapa_empieza_en_su_punto_la_zona_la_base_o_las_paradas() {
        val base = Base(lat = 43.35, lng = -8.42)
        val situada = Parada(id = "x", lat = 43.36, lng = -8.41, geo = "ok")
        assertThat(Situar.centro(Parada(id = "a", lat = 43.3713, lng = -8.3960, geo = "aprox"), base, emptyList())).isEqualTo(Punto(43.3713, -8.3960) to 18.0)
        assertThat(Situar.centro(Parada(id = "a", geo = "zona", zonaLat = 43.37, zonaLng = -8.40), base, listOf(situada))).isEqualTo(Punto(43.37, -8.40) to 15.0)
        assertThat(Situar.centro(Parada(id = "a", geo = "no"), base, listOf(situada))).isEqualTo(Punto(43.35, -8.42) to 14.0)
        assertThat(Situar.centro(Parada(id = "a", geo = "no"), Base(), listOf(situada))).isEqualTo(Punto(43.36, -8.41) to 14.0)
        assertThat(Situar.centro(Parada(id = "a", geo = "no"), null, emptyList())).isNull()
        // Con qué se compara: la zona y la base para un CP distinto; con las paradas, para cuando no hay CP.
        val p = Parada(id = "a", geo = "zona", zonaLat = 43.37, zonaLng = -8.40)
        assertThat(Situar.cerca(p, base)).containsExactly(Punto(43.37, -8.40), Punto(43.35, -8.42)).inOrder()
        assertThat(Situar.dondeReparte(p, base, listOf(situada, p))).containsExactly(Punto(43.37, -8.40), Punto(43.35, -8.42), Punto(43.36, -8.41)).inOrder()
    }

    @Test
    fun la_direccion_se_busca_sin_el_piso_ni_la_puerta() {
        assertThat(Situar.paraBuscar("Rúa Real 2, 1º B")).isEqualTo("Rúa Real 2")
        assertThat(Situar.paraBuscar("Calle Mayor 5 2 B, Madrid")).isEqualTo("Calle Mayor 5, Madrid")
        assertThat(Situar.paraBuscar("Avenida da Mariña 6, bajo, 15001 A Coruña")).isEqualTo("Avenida da Mariña 6, 15001 A Coruña")
        assertThat(Situar.paraBuscar("Praza de María Pita 1")).isEqualTo("Praza de María Pita 1")
        assertThat(Situar.paraBuscar("Calle Real 1 bajo, Madrid")).isEqualTo("Calle Real 1, Madrid")
        assertThat(Situar.paraBuscar("Calle Sol 3, Portal 2, Esc. A")).isEqualTo("Calle Sol 3")
        // Calles y pueblos con esas palabras no se cortan: la calle va delante del número, el pueblo detrás de su CP.
        assertThat(Situar.paraBuscar("Puerta del Sol 1, 28013 Madrid")).isEqualTo("Puerta del Sol 1, 28013 Madrid")
        assertThat(Situar.paraBuscar("Calle de la Torre 5, 2º A, 28001 Madrid")).isEqualTo("Calle de la Torre 5, 28001 Madrid")
        assertThat(Situar.paraBuscar("An der Alster 5, 20099 Hamburg")).isEqualTo("An der Alster 5, 20099 Hamburg")
        assertThat(Situar.paraBuscar("Calle Sol 3, 29740 Torre del Mar")).isEqualTo("Calle Sol 3, 29740 Torre del Mar")
        assertThat(Situar.paraBuscar("1200 Avenue of the Americas, New York")).isEqualTo("1200 Avenue of the Americas, New York")
        assertThat(Situar.numeroDe("Puerta del Sol 1, 28013 Madrid")).isEqualTo("1")
        assertThat(Situar.numeroDe("Rúa Real, 12-14, 15003 A Coruña")).isEqualTo("12")
        assertThat(Situar.numeroDe("Rúa Real 2B, 1º B")).isEqualTo("2")
        assertThat(Situar.numeroDe("12 rue de Rivoli, Paris")).isEqualTo("12")
        assertThat(Situar.numeroDe("Praza de María Pita, 15001 A Coruña")).isEmpty()
    }

    @Test
    fun la_consulta_lleva_el_cp_el_pueblo_y_el_pais_sin_repetirlos() {
        assertThat(Situar.consulta("Calle Real 1, 15003, A Coruña", "15003", "A Coruña", "España")).isEqualTo("Calle Real 1, 15003, A Coruña, España")
        assertThat(Situar.consulta("Rúa Real 2, 1º B", "15003", "A Coruña", "España")).isEqualTo("Rúa Real 2, 15003, A Coruña, España")
        assertThat(Situar.consulta("Praza de María Pita 1", "", "", "")).isEqualTo("Praza de María Pita 1")
    }

    @Test
    fun al_elegir_una_sugerencia_se_queda_el_piso_de_lo_escrito() {
        assertThat(Situar.conPiso("Rúa Real 1, 2º B, 15003 A Coruña", "Calle Real, 1, 15003 A Coruña")).isEqualTo("Calle Real, 1, 15003 A Coruña, 2º B")
        assertThat(Situar.conPiso("Calle Mayor 5 2 B, Madrid", "Calle Mayor, 5, 28013 Madrid")).isEqualTo("Calle Mayor, 5, 28013 Madrid, 2 B")
        assertThat(Situar.conPiso("Praza de María Pita 1", "Praza de María Pita, 1, 15001 A Coruña")).isEqualTo("Praza de María Pita, 1, 15001 A Coruña")
        assertThat(Situar.conPiso("Calle de la Torre 5 bajo, Madrid", "Calle de la Torre, 5, 28001 Madrid")).isEqualTo("Calle de la Torre, 5, 28001 Madrid, bajo")
    }

    @Test
    fun las_sugerencias_del_servidor_van_primero_y_sin_repetir() {
        val servidor = Sugerencia("Praza de María Pita, 1, 15001 A Coruña", "", "", 43.3713, -8.3960, precision = "portal", fuente = "servidor")
        // La suya, el mismo portal escrito de otra manera (a 5 m): se queda la del servidor, con su cliente y sus veces.
        val suya = Sugerencia("Plaza María Pita 1, A Coruña", "15001", "A Coruña", 43.37134, -8.39605, cliente = "Concello", telefono = "981000000", veces = 3, fuente = "suya")
        val suyaOtra = Sugerencia("Rúa Real 5, A Coruña", "15003", "A Coruña", 43.3700, -8.4000, veces = 1, fuente = "suya")
        val movil = Sugerencia("Praza de María Pita, 1, 15001 A Coruña", "15001", "A Coruña", 43.3714, -8.3961, precision = "portal", fuente = "movil")
        // El 3 de la misma plaza, a 20 m: otro portal, no se junta.
        val movil3 = Sugerencia("Praza de María Pita, 3, 15001 A Coruña", "15001", "A Coruña", 43.3715, -8.3962, precision = "portal", fuente = "movil")
        val photon = Sugerencia("Praza de María Pita, 15001 A Coruña", "15001", "A Coruña", 43.3718, -8.3958, precision = "calle", fuente = "photon")
        val r = Situar.ordenar(listOf(servidor), listOf(suya, suyaOtra), listOf(movil, movil3), listOf(photon))
        assertThat(r.map { it.direccion }).containsExactly(servidor.direccion, suyaOtra.direccion, movil3.direccion, photon.direccion).inOrder()
        assertThat(r[0].fuente).isEqualTo("servidor")
        assertThat(r[0].cliente).isEqualTo("Concello")
        assertThat(r[0].veces).isEqualTo(3)
        // Como mucho n.
        assertThat(Situar.ordenar(emptyList(), List(10) { i -> Sugerencia("Rúa $i", "", "", null, null) }, emptyList(), emptyList(), n = 7)).hasSize(7)
    }

    @Test
    fun las_de_otra_calle_van_al_final_y_se_dicen() {
        // 02-11-2026, visto en el emulador: con una calle que no existe, Photon da otras calles del mismo CP con ese número.
        // Desde el 03-11-2026 solo sale (al final y como «Otra calle») la que comparte el nombre: las otras, no.
        val q = "Rúa Brétema Mariñeira 41, 15011 A Coruña"
        val mourelle = Sugerencia("Rúa Almirante Mourelle 41, 15011 A Coruña", "15011", "A Coruña", 43.3601, -8.4201, precision = "portal", fuente = "photon")
        val osorio = Sugerencia("Rúa Virrey Osorio 41, 15011 A Coruña", "15011", "A Coruña", 43.3611, -8.4211, precision = "portal", fuente = "photon")
        val esa = Sugerencia("Rúa Brétema Mariñeira, 15011 A Coruña", "15011", "A Coruña", 43.3621, -8.4221, precision = "calle", fuente = "photon")
        val movil = checkNotNull(Situar.deMovil(ResultadoMovil(43.3283313, -8.3493802, pais = "ES", calle = "Rúa Brétema", cp = "15179",
            localidad = "Oleiros", texto = "Rúa Brétema, 15179 Oleiros, A Coruña, España"), "es", q))
        val r = Situar.ordenar(emptyList(), emptyList(), listOf(movil), listOf(mourelle, osorio, esa), buscado = q)
        assertThat(r.map { it.direccion }).containsExactly(esa.direccion, movil.direccion).inOrder()
        assertThat(r.map { it.otraCalle }).containsExactly(false, true).inOrder()
        // Las del servidor nunca se quitan, pero desde el 03-11-2026 también se marcan si son de otra calle (elegirla
        // cambia la dirección); mientras se teclea la calle (sin número), ninguna.
        val servidor = Sugerencia("Calle Real, 15003 A Coruña", "", "", 43.37, -8.40, precision = "calle", fuente = "servidor")
        assertThat(Situar.ordenar(listOf(servidor), emptyList(), emptyList(), emptyList(), buscado = q).single().otraCalle).isTrue()
        assertThat(Situar.ordenar(listOf(servidor), emptyList(), emptyList(), emptyList(), buscado = "Rúa Real 5").single().otraCalle).isFalse()
        val tecleando = Situar.ordenar(emptyList(), emptyList(), listOf(movil), listOf(mourelle), buscado = "Rúa Brét")
        assertThat(tecleando).hasSize(2)
        assertThat(tecleando.none { it.otraCalle }).isTrue()
    }

    @Test
    fun otra_calle_solo_si_comparte_el_nombre_y_si_no_ni_sale() {
        // LA REGLA DEL 03-11-2026 (igual en la web), con los casos que tienen que salir así.
        // 1) «Rúa Brétema Mariñeira 23» + «Rúa Brétema, 15179 Oleiros»: comparte «Brétema», pero no es esa calle → al final, «Otra calle».
        val bretema = "Rúa Brétema Mariñeira 23, 15011 A Coruña"
        val oleiros = Sugerencia("Rúa Brétema, 15179 Oleiros", "15179", "Oleiros", 43.3283, -8.3494, precision = "calle", fuente = "movil")
        val esa = Sugerencia("Rúa Brétema Mariñeira 23, 15011 A Coruña", "15011", "A Coruña", 43.3621, -8.4221, precision = "portal", fuente = "photon")
        assertThat(Situar.ordenar(emptyList(), emptyList(), listOf(oleiros), listOf(esa), buscado = bretema).map { it.direccion to it.otraCalle })
            .containsExactly(esa.direccion to false, oleiros.direccion to true).inOrder()
        // 2) «Rúa Valtrenxo 41» (no existe) + calles cualquiera del mismo CP con el 41 → no sale ninguna (5 de 5 en la ficha, visto en el emulador).
        val valtrenxo = "Rúa Valtrenxo 41, 15011 A Coruña"
        val del41 = listOf("Rúa Almirante Mourelle 41", "Rúa Virrey Osorio 41", "Rúa Ramón Cabanillas 41", "Avenida de Finisterre 41", "Rúa Doctor Fleming 41")
            .mapIndexed { i, d -> Sugerencia("$d, 15011 A Coruña", "15011", "A Coruña", 43.36 + i / 1000.0, -8.42, precision = "portal", fuente = if (i % 2 == 0) "photon" else "movil") }
        assertThat(Situar.ordenar(emptyList(), emptyList(), del41.filter { it.fuente == "movil" }, del41.filter { it.fuente == "photon" }, buscado = valtrenxo)).isEmpty()
        // Las del servidor y las suyas, siempre (no se quitan); la del servidor de la misma calle («Valtreixo», una letra
        // del OCR), sin marcar, y las suyas nunca se marcan.
        val servidor = Sugerencia("Rúa Valtreixo, 15011 A Coruña", "", "", 43.3605, -8.4105, precision = "calle", fuente = "servidor")
        val suya = Sugerencia("Rúa Nova 1, A Coruña", "15003", "A Coruña", 43.3700, -8.4000, veces = 1, fuente = "suya")
        assertThat(Situar.ordenar(listOf(servidor), listOf(suya), emptyList(), del41, buscado = valtrenxo).map { it.direccion to it.otraCalle })
            .containsExactly(servidor.direccion to false, suya.direccion to false).inOrder()
        // 3) «Calle Emilia Pardo Bazán 5» + «Rúa Pardo Bazán 5»: la misma calle (la regla estricta) → normal.
        val pardo = Sugerencia("Rúa Pardo Bazán 5, 15005 A Coruña", "15005", "A Coruña", 43.365, -8.405, precision = "portal", fuente = "photon")
        assertThat(Situar.ordenar(emptyList(), emptyList(), emptyList(), listOf(pardo), buscado = "Calle Emilia Pardo Bazán 5").single().otraCalle).isFalse()
        // 4) Sin número (aún se teclea, o se busca un sitio por su nombre) → ni se filtra ni se marca nada.
        val hospital = Sugerencia("Hospital Abente y Lago, 15001 A Coruña", "15001", "A Coruña", 43.369, -8.391, precision = "calle", fuente = "movil")
        val sinNumero = Situar.ordenar(emptyList(), emptyList(), listOf(hospital), del41, buscado = "Hospital Abente y Lago")
        assertThat(sinNumero).hasSize(6)
        assertThat(sinNumero.none { it.otraCalle }).isTrue()
        assertThat(Situar.ordenar(emptyList(), emptyList(), emptyList(), del41, buscado = "Mercadona Oleiros").none { it.otraCalle }).isTrue()
    }

    @Test
    fun comparte_el_nombre_con_una_palabra_que_distingue_la_calle() {
        assertThat(Situar.comparteNombre("Rúa Brétema Mariñeira 23, 15011 A Coruña", "Rúa Brétema, 15179 Oleiros")).isTrue()
        assertThat(Situar.comparteNombre("Rúa Valtrenxo 41, 15011 A Coruña", "Rúa Almirante Mourelle 41, 15011 A Coruña")).isFalse()
        // Los títulos no distinguen nada: «San» no hace de «San Andrés» la «San Roque», ni «Doctor» del Fleming el Cadaval.
        assertThat(Situar.comparteNombre("Rúa San Andrés 5", "Rúa San Roque 5")).isFalse()
        assertThat(Situar.comparteNombre("Calle Doctor Fleming 2", "Rúa Doctor Cadaval 2")).isFalse()
        // Con el margen del OCR («Montccelo») y lo que aún se teclea («12 rue de Rivo»), como en la web.
        assertThat(Situar.comparteNombre("Rúa de Montccelo Alto 1, Vigo", "Rúa Montecelo, Vigo")).isTrue()
        assertThat(Situar.comparteNombre("12 rue de Rivo", "Rue de Rivoli, Paris")).isTrue()
        // Sin nombre con qué comparar, no.
        assertThat(Situar.comparteNombre("", "Rúa Real")).isFalse()
    }

    @Test
    fun al_elegir_una_sin_el_portal_no_se_pisa_lo_escrito() {
        // 02-11-2026, visto en el emulador: «Rúa Real 999, 15003 A Coruña» + «Calle Real, 15003 A Coruña · Sin el portal»
        // quedaba «Calle Real, 15003 A Coruña», sin el número, y «En el mapa».
        val calle = Sugerencia("Calle Real, 15003 A Coruña", "15003", "A Coruña", 43.37, -8.40, precision = "calle", fuente = "servidor")
        assertThat(Situar.alElegir("Rúa Real 999, 15003 A Coruña", calle)).isEqualTo(Situar.Elegida("Rúa Real 999, 15003 A Coruña", "calle", "15003", "A Coruña"))
        // Sin el CP ni el pueblo escritos, se completan; el piso se queda.
        assertThat(Situar.alElegir("Rúa Real 999, 2º B", calle)).isEqualTo(Situar.Elegida("Rúa Real 999, 2º B, 15003 A Coruña", "calle", "15003", "A Coruña"))
        // Otro número (de Photon) tampoco es el portal: lo escrito se queda.
        val otroNumero = Sugerencia("Rúa Real 85, 15003 A Coruña", "15003", "A Coruña", 43.37, -8.40, precision = "portal", fuente = "photon")
        assertThat(Situar.alElegir("Rúa Real 999", otroNumero)).isEqualTo(Situar.Elegida("Rúa Real 999, 15003 A Coruña", "calle", "15003", "A Coruña"))
        // Con otro CP ya escrito, no se añade el de la sugerencia ni se manda (el pueblo escrito, sí). Si es de OTRA calle
        // («Rúa Brétema, 15179 Oleiros» para «Rúa Brétema Mariñeira 23»), ya no se queda lo escrito: ver el test de abajo.
        val real15003 = Sugerencia("Calle Real, 15003 A Coruña", "15003", "A Coruña", 43.37, -8.40, precision = "calle", fuente = "servidor")
        assertThat(Situar.alElegir("Rúa Real 999, 15011 A Coruña", real15003)).isEqualTo(Situar.Elegida("Rúa Real 999, 15011 A Coruña", "calle", "", "A Coruña"))
        // El mismo portal: la de la sugerencia, con el piso de lo escrito (como antes).
        val portal = Sugerencia("Calle Real, 1, 15003 A Coruña", "15003", "A Coruña", 43.37, -8.40, precision = "portal", fuente = "movil")
        assertThat(Situar.alElegir("Rúa Real 1, 2º B, 15003 A Coruña", portal)).isEqualTo(Situar.Elegida("Calle Real, 1, 15003 A Coruña, 2º B", "portal", "15003", "A Coruña"))
        // Las suyas («Ya estuviste aquí»), tal cual.
        val suya = Sugerencia("Rúa Real 9, A Coruña", "15003", "A Coruña", 43.37, -8.40, veces = 2, fuente = "suya")
        assertThat(Situar.alElegir("Rúa Real 9", suya).direccion).isEqualTo("Rúa Real 9, A Coruña")
    }

    @Test
    fun al_elegir_otra_calle_queda_su_direccion_nunca_lo_escrito() {
        // 03-11-2026: lo grave era esto: «Rúa Brétema Mariñeira 23, 15011 A Coruña» se quedaba escrita con el punto de
        // «Rúa Brétema, 15179 Oleiros», a 8 km.
        val escrita = "Rúa Brétema Mariñeira 23, 15011 A Coruña"
        val oleiros = Sugerencia("Rúa Brétema, 15179 Oleiros", "15179", "Oleiros", 43.3283, -8.3494, precision = "calle", fuente = "movil", otraCalle = true)
        assertThat(Situar.alElegir(escrita, oleiros)).isEqualTo(Situar.Elegida("Rúa Brétema, 15179 Oleiros", "calle", "15179", "Oleiros"))
        // Con el piso de lo escrito.
        assertThat(Situar.alElegir("Rúa Brétema Mariñeira 23, 2º B, 15011 A Coruña", oleiros).direccion).isEqualTo("Rúa Brétema, 15179 Oleiros, 2º B")
        // Aunque no venga marcada (la de «Situar» se pudo buscar con otro texto), y venga de donde venga (03-11-2026: también
        // del servidor, que antes dejaba lo escrito con su punto): de otra calle que lo escrito, igual.
        assertThat(Situar.alElegir(escrita, oleiros.copy(otraCalle = false))).isEqualTo(Situar.Elegida("Rúa Brétema, 15179 Oleiros", "calle", "15179", "Oleiros"))
        assertThat(Situar.alElegir(escrita, oleiros.copy(otraCalle = false, fuente = "servidor"))).isEqualTo(Situar.Elegida("Rúa Brétema, 15179 Oleiros", "calle", "15179", "Oleiros"))
        // De otra calle y con su portal: la suya, y «portal».
        val conPortal = Sugerencia("Rúa Brétema 31, 15179 Oleiros", "15179", "Oleiros", 43.3283, -8.3494, precision = "portal", fuente = "photon", otraCalle = true)
        assertThat(Situar.alElegir(escrita, conPortal)).isEqualTo(Situar.Elegida("Rúa Brétema 31, 15179 Oleiros", "portal", "15179", "Oleiros"))
        // La MISMA calle «Sin el portal» (de un buscador o del servidor): lo escrito, con su número, y la precisión «calle».
        val sinPortal = Sugerencia("Calle Real, 15003 A Coruña", "15003", "A Coruña", 43.37, -8.40, precision = "calle", fuente = "photon")
        val real999 = Situar.Elegida("Rúa Real 999, 15003 A Coruña", "calle", "15003", "A Coruña")
        assertThat(Situar.alElegir("Rúa Real 999, 15003 A Coruña", sinPortal)).isEqualTo(real999)
        assertThat(Situar.alElegir("Rúa Real 999, 15003 A Coruña", sinPortal.copy(fuente = "servidor"))).isEqualTo(real999)
    }

    @Test
    fun la_calle_sin_el_portal_se_manda_con_su_precision() {
        // 03-11-2026, visto en el emulador: «Rúa Real 999» + «Sin el portal» quedaba en geo «manual» y al reabrirla decía
        // «En el mapa» (la guía la trataría como la puerta): la precisión no se mandaba.
        val calle = Sugerencia("Rúa Real 999, 15003 A Coruña", "15003", "A Coruña", 43.37, -8.40, precision = "calle", fuente = "servidor")
        val cuerpo = checkNotNull(Situar.cuerpoPunto(calle))
        assertThat(cuerpo.keys).containsExactly("lat", "lng", "geo_origen", "precision")
        assertThat(cuerpo["precision"]?.jsonPrimitive?.content).isEqualTo("calle")
        assertThat(cuerpo["geo_origen"]?.jsonPrimitive?.content).isEqualTo("sugerencia")
        assertThat(cuerpo["lat"]?.jsonPrimitive?.double).isEqualTo(43.37)
        // El portal, lo puesto a mano en el mapa o lo leído de la etiqueta: sin precisión («manual», como hasta ahora).
        assertThat(Situar.cuerpoPunto(calle.copy(precision = "portal"))?.keys).containsExactly("lat", "lng", "geo_origen")
        val mapa = checkNotNull(Situar.cuerpoPunto(calle.copy(fuente = "mapa")))
        assertThat(mapa.keys).containsExactly("lat", "lng", "geo_origen")
        assertThat(mapa["geo_origen"]?.jsonPrimitive?.content).isEqualTo("mapa")
        assertThat(Situar.cuerpoPunto(Sugerencia("", "15003", "A Coruña", 43.37, -8.40))?.keys).containsExactly("lat", "lng")
        assertThat(Situar.cuerpoPunto(calle.copy(lat = null))).isNull()
        // «Es aquí»: «calle» solo con la chincheta donde la puso una sugerencia que deja la calle; movida a mano («mapa»), no.
        val real999 = "Rúa Real 999, 15003 A Coruña"
        assertThat(Situar.esAqui(real999, "sugerencia", calle).precision).isEqualTo("calle")
        assertThat(Situar.esAqui(real999, "mapa", calle).precision).isEmpty()
        assertThat(Situar.esAqui(real999, "sugerencia", calle.copy(precision = "portal")).precision).isEmpty()
        assertThat(Situar.esAqui(real999, "sugerencia", null).precision).isEmpty()
        assertThat(Repositorio.cuerpoPunto(43.37, -8.40, "sugerencia", "calle").keys).containsExactly("lat", "lng", "geo_origen", "precision")
        assertThat(Repositorio.cuerpoPunto(43.37, -8.40, "mapa", "portal").keys).containsExactly("lat", "lng", "geo_origen")
        // Sin red, la ruta del móvil la ve como la dejará el servidor: «aprox» («Calle encontrada, sin el portal»).
        val p = Repositorio.conPunto(Parada(id = "a", geo = "no"), 43.37, -8.40, "sugerencia", "calle")
        assertThat(p.geo).isEqualTo("aprox")
        assertThat(Situar.estadoDe(p)).isEqualTo("calle")
    }

    @Test
    fun lo_que_ya_esperaba_en_el_movil_sin_la_precision_sigue_saliendo() {
        // Un punto guardado sin red antes de esto (sin «precision»): se lee igual y sale como siempre, «manual».
        val viejo = JSON.decodeFromString(ListSerializer(PuntoPendiente.serializer()),
            """[{"quien":"q","id":"a","lat":43.37,"lng":-8.4,"origen":"mapa","nombre":"Concello"}]""").single()
        assertThat(viejo.precision).isEmpty()
        assertThat(Repositorio.cuerpoPunto(viejo.lat, viejo.lng, viejo.origen, viejo.precision).keys).containsExactly("lat", "lng", "geo_origen")
        // Vacía no se escribe (el fichero queda como antes); con «calle», va y vuelve y sale con ella.
        assertThat(JSON.encodeToString(PuntoPendiente.serializer(), viejo)).doesNotContain("precision")
        val calle = viejo.copy(origen = "sugerencia", precision = "calle")
        val vuelta = JSON.decodeFromString(PuntoPendiente.serializer(), JSON.encodeToString(PuntoPendiente.serializer(), calle))
        assertThat(vuelta).isEqualTo(calle)
        assertThat(Repositorio.cuerpoPunto(vuelta.lat, vuelta.lng, vuelta.origen, vuelta.precision)["precision"]?.jsonPrimitive?.content).isEqualTo("calle")
    }

    @Test
    fun lo_del_servidor_y_del_movil_como_sugerencias_y_como_estado() {
        assertThat(Situar.deServidor(CandidatoUbicar(43.3713, -8.3960, "portal", "Praza de María Pita, 1, 15001 A Coruña"))?.fuente).isEqualTo("servidor")
        // Solo la zona (el centro del CP), sin punto o sin texto: no es una sugerencia.
        assertThat(Situar.deServidor(CandidatoUbicar(43.37, -8.40, "zona", "15001 A Coruña"))).isNull()
        assertThat(Situar.deServidor(CandidatoUbicar(null, null, "portal", "Praza de María Pita 1"))).isNull()
        assertThat(Situar.deServidor(CandidatoUbicar(43.37, -8.40, "calle", ""))).isNull()
        assertThat(Situar.deMovil(maria, "es", "Praza de María Pita 1")?.precision).isEqualTo("portal")
        assertThat(Situar.deMovil(maria.copy(pais = "FR"), "es", "Praza de María Pita 1")).isNull()
        assertThat(Situar.deMovil(maria.copy(texto = ""), "es", "Praza de María Pita 1")?.direccion).isEqualTo("Praza de María Pita 1, 15001 A Coruña")
        assertThat(Situar.estado(true, "portal")).isEqualTo("portal")
        assertThat(Situar.estado(true, "calle")).isEqualTo("calle")
        assertThat(Situar.estado(false, "zona")).isEqualTo("no")
        assertThat(Situar.estado(false, null)).isEqualTo("no")
        assertThat(Situar.estadoDe(Parada(id = "a", lat = 43.37, lng = -8.40, geo = "aprox"))).isEqualTo("calle")
        assertThat(Situar.estadoDe(Parada(id = "a", lat = 43.37, lng = -8.40, geo = "manual"))).isEqualTo("portal")
        assertThat(Situar.estadoDe(Parada(id = "a", geo = "no"))).isEqualTo("no")
    }

    @Test
    fun en_segundo_plano_cada_una_una_vez_y_nunca_con_algo_en_vuelo() {
        val a = Parada(id = "a", direccion = "Rúa Real 5, A Coruña", geo = "no")
        val b = Parada(id = "b", direccion = "Praza de María Pita 1, A Coruña", geo = "zona", zonaLat = 43.37, zonaLng = -8.40)
        val situada = Parada(id = "c", direccion = "Rúa Nova 1", lat = 43.37, lng = -8.40, geo = "ok")
        val cerrada = Parada(id = "d", direccion = "Rúa Nova 2", geo = "no", estado = "fallido")
        val ejemplo = Parada(id = "e", direccion = "Rúa Nova 3", geo = "no", ejemplo = true)
        val corta = Parada(id = "f", direccion = "Rú", geo = "no")
        val todas = listOf(a, b, situada, cerrada, ejemplo, corta)
        assertThat(Situar.porSituar(todas, emptySet(), emptySet()).map { it.id }).containsExactly("a", "b").inOrder()
        // Ya probada en esta sesión con esa dirección: no; con la dirección cambiada, otra vez.
        val probadas = setOf(Situar.clave(a))
        assertThat(Situar.porSituar(todas, probadas, emptySet()).map { it.id }).containsExactly("b")
        assertThat(Situar.porSituar(listOf(a.copy(direccion = "Rúa Real 7, A Coruña")), probadas, emptySet()).map { it.id }).containsExactly("a")
        // Con algo en vuelo (esperando a salir o situándose ahora mismo): no.
        assertThat(Situar.porSituar(todas, emptySet(), setOf("a")).map { it.id }).containsExactly("b")
        // El tope; y la misma parada dos veces (la recién añadida y la de la ruta) cuenta una.
        assertThat(Situar.porSituar(listOf(a, a, b), emptySet(), emptySet(), tope = 1).map { it.id }).containsExactly("a")
        assertThat(Situar.porSituar(listOf(a, a, b), emptySet(), emptySet()).map { it.id }).containsExactly("a", "b").inOrder()
        // Una lista pegada que el servidor aún está ubicando (geo «pendiente»): primero el servidor (revisión A2).
        val pegada = Parada(id = "g", direccion = "Rúa Real 9, A Coruña", geo = "pendiente")
        assertThat(Situar.porSituar(listOf(pegada, a), emptySet(), emptySet()).map { it.id }).containsExactly("a")
    }

    // ── UN SOLO SITIO QUE DECIDE (03-11-2026): la regla en todos los caminos ─────────────────────────────────────────

    @Test
    fun la_regla_al_elegir_los_casos_que_tienen_que_salir_asi() {
        // 4) D con número y S de OTRA calle, venga de donde venga y marcada o no: la de S, con su CP y su pueblo; «calle»
        //    (no trae número). Lo grave del emulador: «Rúa Brétema Mariñeira 23» quedaba con el punto de Oleiros.
        val bretema = "Rúa Brétema Mariñeira 23, 15011 A Coruña"
        for (fuente in listOf("servidor", "photon", "movil")) {
            val conSitio = fuente != "servidor"      // los del servidor no traen el CP ni el pueblo aparte
            val oleiros = Sugerencia("Rúa Brétema, 15179 Oleiros", if (conSitio) "15179" else "", if (conSitio) "Oleiros" else "",
                43.3283, -8.3494, precision = "calle", fuente = fuente)
            val el = Situar.alElegir(bretema, oleiros)
            assertThat(el).isEqualTo(Situar.Elegida("Rúa Brétema, 15179 Oleiros", "calle", oleiros.cp, oleiros.localidad))
            assertThat(Situar.alElegir(bretema, oleiros.copy(otraCalle = true))).isEqualTo(el)
        }
        // De otra calle y con su portal: la suya, «portal».
        val bretema31 = Sugerencia("Rúa Brétema 31, 15179 Oleiros", "15179", "Oleiros", 43.3285, -8.3495, precision = "portal", fuente = "servidor")
        assertThat(Situar.alElegir(bretema, bretema31)).isEqualTo(Situar.Elegida("Rúa Brétema 31, 15179 Oleiros", "portal", "15179", "Oleiros"))
        // 3b) La misma calle con OTRO número («Calle Real 85» para «Rúa Real 999») o la calle sin el portal: D, «calle».
        val real999 = "Rúa Real 999, 15003 A Coruña"
        val real85 = Sugerencia("Calle Real 85, 15003 A Coruña", "15003", "A Coruña", 43.3702, -8.3990, precision = "portal", fuente = "photon")
        val realCalle = Sugerencia("Calle Real, 15003 A Coruña", "15003", "A Coruña", 43.37, -8.40, precision = "calle", fuente = "servidor")
        for (s in listOf(real85, realCalle, real85.copy(fuente = "servidor"), realCalle.copy(fuente = "movil"))) {
            assertThat(Situar.alElegir(real999, s)).isEqualTo(Situar.Elegida(real999, "calle", "15003", "A Coruña"))
        }
        // 3a) El mismo portal: la de S con el piso de D, «portal».
        val real5 = Sugerencia("Calle Real, 5, 15003 A Coruña", "15003", "A Coruña", 43.3701, -8.3995, precision = "portal", fuente = "servidor")
        assertThat(Situar.alElegir("Rúa Real 5, 2º B, 15003 A Coruña", real5)).isEqualTo(Situar.Elegida("Calle Real, 5, 15003 A Coruña, 2º B", "portal", "15003", "A Coruña"))
        // 2) D sin número («Hospital Abente y Lago»): la de S, sea cual sea, con su precisión.
        for (s in listOf(real85, realCalle, real5, bretema31, Sugerencia("Rúa Brétema, 15179 Oleiros", "15179", "Oleiros", 43.3283, -8.3494, precision = "calle", fuente = "movil"))) {
            val el = Situar.alElegir("Hospital Abente y Lago", s)
            assertThat(el.direccion).isEqualTo(s.direccion)
            assertThat(el.precision).isEqualTo(s.precision)
        }
        // 1) Una suya, tal cual, con la precisión que manda el servidor (sin ella, «portal», como hasta ahora).
        val suya = Situar.deSuya(DireccionConocida("Rúa Real 9, 15003 A Coruña", "15003", "A Coruña", 43.371, -8.401, "Concello", "981000000", 2, precision = "calle"))
        assertThat(Situar.alElegir(real999, suya)).isEqualTo(Situar.Elegida("Rúa Real 9, 15003 A Coruña", "calle", "15003", "A Coruña"))
        assertThat(Situar.alElegir(bretema, suya).direccion).isEqualTo("Rúa Real 9, 15003 A Coruña")
        assertThat(Situar.alElegir(real999, suya.copy(precision = "")).precision).isEqualTo("portal")
    }

    @Test
    fun desde_situar_se_quita_con_lo_buscado_y_se_marca_con_la_parada() {
        // «Situar» desde Hoy o desde la ficha con la búsqueda corregida a «Rúa Brétema, Oleiros»: lo buscado no trae
        // número y no se quita nada; con D, la dirección de la parada, se marcan las de otra calle de cualquier fuente
        // menos las suyas, y al elegirla la dirección pasa a ser la suya.
        val d = "Rúa Brétema Mariñeira 23, 15011 A Coruña"
        val buscado = "Rúa Brétema, Oleiros"
        val servidor = Sugerencia("Rúa Brétema, 15179 Oleiros", "", "", 43.3283, -8.3494, precision = "calle", fuente = "servidor")
        val photon = Sugerencia("Rúa Brétema 2, 15179 Oleiros", "15179", "Oleiros", 43.3290, -8.3500, precision = "portal", fuente = "photon")
        val suya = Sugerencia("Rúa Nova 1, 15179 Oleiros", "15179", "Oleiros", 43.3300, -8.3510, veces = 1, fuente = "suya")
        val r = Situar.ordenar(listOf(servidor), listOf(suya), emptyList(), listOf(photon), buscado = buscado, direccion = d)
        assertThat(r.map { it.direccion to it.otraCalle })
            .containsExactly(suya.direccion to false, servidor.direccion to true, photon.direccion to true).inOrder()
        // «Es aquí» desde Hoy: la dirección nueva va con el punto, y «calle» si es la calle.
        assertThat(Situar.esAqui(d, "sugerencia", r[1])).isEqualTo(Situar.Cambio("calle", "Rúa Brétema, 15179 Oleiros", "", ""))
        assertThat(Situar.esAqui(d, "sugerencia", r[2])).isEqualTo(Situar.Cambio("", "Rúa Brétema 2, 15179 Oleiros", "15179", "Oleiros"))
        // Desde la ficha, igual con lo escrito en ella.
        assertThat(Situar.alElegir(d, r[1]).direccion).isEqualTo("Rúa Brétema, 15179 Oleiros")
        // Con número en lo buscado, las del móvil y Photon que ni comparten el nombre se quitan; las del servidor, nunca.
        val mourelle = Sugerencia("Rúa Almirante Mourelle 23, 15011 A Coruña", "15011", "A Coruña", 43.36, -8.42, precision = "portal", fuente = "photon")
        val conNumero = Situar.ordenar(listOf(servidor), emptyList(), listOf(mourelle.copy(fuente = "movil")), listOf(mourelle, photon), buscado = d, direccion = d)
        assertThat(conNumero.map { it.direccion }).containsExactly(servidor.direccion, photon.direccion)
        assertThat(conNumero.all { it.otraCalle }).isTrue()
        // «No encuentro esa dirección» va con lo buscado: «Rúa Brétema, Oleiros» sí se encuentra; la de D, no.
        assertThat(r.any { Situar.deLaBuscada(buscado, it) }).isTrue()
        assertThat(conNumero.none { Situar.deLaBuscada(d, it) }).isTrue()
    }

    @Test
    fun es_aqui_manda_la_precision_y_la_direccion_cuando_cambia() {
        val real999 = "Rúa Real 999, 15003 A Coruña"
        val real85 = Sugerencia("Calle Real, 85, 15003 A Coruña", "15003", "A Coruña", 43.3702, -8.3990, precision = "portal", fuente = "photon")
        // 3b: «Calle Real 85» para «Rúa Real 999» es la calle: "precision": "calle" (antes iba como la puerta), y la
        // dirección no cambia.
        assertThat(Situar.esAqui(real999, "sugerencia", real85)).isEqualTo(Situar.Cambio("calle"))
        // 3b sin el CP ni el pueblo escritos: se añaden y se mandan.
        assertThat(Situar.esAqui("Rúa Real 999", "sugerencia", real85)).isEqualTo(Situar.Cambio("calle", "Rúa Real 999, 15003 A Coruña", "15003", "A Coruña"))
        // 3a: el mismo portal, la puerta (sin precisión) y la dirección de S con el piso de D.
        val real5 = Sugerencia("Calle Real, 5, 15003 A Coruña", "15003", "A Coruña", 43.3701, -8.3995, precision = "portal", fuente = "servidor")
        assertThat(Situar.esAqui("Rúa Real 5, 2º B, 15003 A Coruña", "sugerencia", real5)).isEqualTo(Situar.Cambio("", "Calle Real, 5, 15003 A Coruña, 2º B", "15003", "A Coruña"))
        // 2: D sin número, la de S.
        assertThat(Situar.esAqui("Hospital Abente y Lago", "sugerencia", real5)).isEqualTo(Situar.Cambio("", "Calle Real, 5, 15003 A Coruña", "15003", "A Coruña"))
        // 1: una suya con «calle», tal cual y con "precision": "calle".
        val suya = Situar.deSuya(DireccionConocida("Rúa Real 9, 15003 A Coruña", "15003", "A Coruña", 43.371, -8.401, veces = 2, precision = "calle"))
        assertThat(Situar.esAqui(real999, "sugerencia", suya)).isEqualTo(Situar.Cambio("calle", "Rúa Real 9, 15003 A Coruña", "15003", "A Coruña"))
        assertThat(Situar.esAqui("Rúa Real 9, 15003 A Coruña", "sugerencia", suya)).isEqualTo(Situar.Cambio("calle"))
        // Movido el mapa a mano o con «Mi ubicación»: la puerta y la dirección de siempre.
        assertThat(Situar.esAqui(real999, "mapa", null)).isEqualTo(Situar.Cambio())
        assertThat(Situar.esAqui(real999, "mapa", real85)).isEqualTo(Situar.Cambio())
    }

    @Test
    fun el_cuerpo_y_la_cola_llevan_la_direccion_nueva() {
        // «Es aquí» desde Hoy con otra calle: la dirección, el CP y la población van con el punto.
        val d = "Rúa Brétema Mariñeira 23, 15011 A Coruña"
        val c = Situar.esAqui(d, "sugerencia", Sugerencia("Rúa Brétema, 15179 Oleiros", "15179", "Oleiros", 43.3283, -8.3494, precision = "calle", fuente = "movil"))
        val cuerpo = Repositorio.cuerpoPunto(43.3283, -8.3494, "sugerencia", c.precision, c.direccion, c.cp, c.localidad)
        assertThat(cuerpo.keys).containsExactly("lat", "lng", "geo_origen", "precision", "direccion", "cp", "localidad")
        assertThat(cuerpo["direccion"]?.jsonPrimitive?.content).isEqualTo("Rúa Brétema, 15179 Oleiros")
        assertThat(cuerpo["cp"]?.jsonPrimitive?.content).isEqualTo("15179")
        assertThat(cuerpo["localidad"]?.jsonPrimitive?.content).isEqualTo("Oleiros")
        assertThat(cuerpo["precision"]?.jsonPrimitive?.content).isEqualTo("calle")
        // Sin dirección nueva, como siempre: ni "direccion" ni "cp" ni "localidad".
        assertThat(Repositorio.cuerpoPunto(43.37, -8.40, "mapa").keys).containsExactly("lat", "lng", "geo_origen")
        // Sin red, a la cola con la dirección (va y vuelve del fichero igual) y la ruta del móvil ya la ve así.
        val pt = PuntoPendiente("q", "a", 43.3283, -8.3494, "sugerencia", "Concello", c.precision, c.direccion, c.cp, c.localidad)
        val vuelta = JSON.decodeFromString(PuntoPendiente.serializer(), JSON.encodeToString(PuntoPendiente.serializer(), pt))
        assertThat(vuelta).isEqualTo(pt)
        val parada = Parada(id = "a", direccion = d, cp = "15011", localidad = "A Coruña", geo = "no")
        val otra = Parada(id = "b", direccion = "Rúa Real 5", geo = "no")
        val ruta = MiRuta(pedidos = listOf(parada, otra))
        val vista = Repositorio.aplicar(ruta, emptyList(), listOf(vuelta), "q")
        val a = vista.pedidos.first { it.id == "a" }
        assertThat(listOf(a.direccion, a.cp, a.localidad, a.geo)).containsExactly("Rúa Brétema, 15179 Oleiros", "15179", "Oleiros", "aprox").inOrder()
        assertThat(a.lat).isEqualTo(43.3283)
        assertThat(vista.pedidos.first { it.id == "b" }).isEqualTo(otra)
        // Lo de otra cuenta no se aplica.
        assertThat(Repositorio.aplicar(ruta, emptyList(), listOf(vuelta), "otra")).isEqualTo(ruta)
        // Lo que ya esperaba sin la dirección: sale y se aplica como antes, solo el punto.
        val viejo = JSON.decodeFromString(PuntoPendiente.serializer(), """{"quien":"q","id":"a","lat":43.37,"lng":-8.4,"origen":"mapa","nombre":"Concello"}""")
        assertThat(listOf(viejo.direccion, viejo.cp, viejo.localidad)).containsExactly("", "", "")
        assertThat(Repositorio.cuerpoPunto(viejo.lat, viejo.lng, viejo.origen, viejo.precision, viejo.direccion, viejo.cp, viejo.localidad).keys)
            .containsExactly("lat", "lng", "geo_origen")
        val conViejo = Repositorio.aplicar(ruta, emptyList(), listOf(viejo), "q").pedidos.first { it.id == "a" }
        assertThat(listOf(conViejo.direccion, conViejo.cp, conViejo.geo)).containsExactly(d, "15011", "manual").inOrder()
        // Vacíos no se escriben: el fichero queda como antes.
        assertThat(JSON.encodeToString(PuntoPendiente.serializer(), viejo)).doesNotContain("direccion")
        // Con red, la ruta que se ve toma la dirección que devuelve el servidor (RutaVM.poner), sin perder lo demás; y
        // sin red o con un servidor de antes, la de «Es aquí» (Situar.situada).
        val delServidor = parada.copy(direccion = "Rúa Brétema, 15179 Oleiros", cp = "15179", localidad = "Oleiros", lat = 43.3283, lng = -8.3494,
            geo = "aprox", geoOrigen = "sugerencia")
        val puesta = Situar.conPuntoDe(parada.copy(cliente = "Concello"), delServidor)
        assertThat(listOf(puesta.direccion, puesta.cp, puesta.localidad, puesta.cliente, puesta.geo))
            .containsExactly("Rúa Brétema, 15179 Oleiros", "15179", "Oleiros", "Concello", "aprox").inOrder()
        assertThat(Situar.conPuntoDe(parada, delServidor.copy(direccion = "")).direccion).isEqualTo(d)
        val situada = Situar.situada(parada, 43.3283, -8.3494, "sugerencia", c)
        assertThat(listOf(situada.direccion, situada.cp, situada.localidad, situada.geo)).containsExactly("Rúa Brétema, 15179 Oleiros", "15179", "Oleiros", "aprox").inOrder()
        assertThat(Situar.situada(parada, 43.37, -8.40, "mapa", Situar.Cambio()).direccion).isEqualTo(d)
    }

    @Test
    fun comparte_el_nombre_no_con_un_titulo_solo() {
        // Un título en común («Almirante», «Marqués», «Alcalde») no es compartir el nombre (igual en la web).
        assertThat(Situar.comparteNombre("Rúa Almirante Mourelle 41", "Rúa Almirante Cervera 41")).isFalse()
        assertThat(Situar.comparteNombre("Rúa Marqués de Amboage 7", "Rúa Marqués de Figueroa 7")).isFalse()
        assertThat(Situar.comparteNombre("Avenida Alcalde Alfonso Molina 3", "Rúa Alcalde Lens 3")).isFalse()
        // Así, con el número escrito, de los buscadores ni salen.
        val cervera = Sugerencia("Rúa Almirante Cervera 41, 15011 A Coruña", "15011", "A Coruña", 43.36, -8.42, precision = "portal", fuente = "photon")
        assertThat(Situar.ordenar(emptyList(), emptyList(), listOf(cervera.copy(fuente = "movil")), listOf(cervera), buscado = "Rúa Almirante Mourelle 41, 15011 A Coruña")).isEmpty()
    }

    @Test
    fun photon_se_pide_hasta_10_y_se_corta_a_5_despues_de_quitar() {
        // Se le piden hasta 10, con el punto redondeado a 2 decimales (≈1 km), igual que la web.
        val url = urlPhoton("Rúa Brétema Mariñeira 23", 43.36789 to -8.41234)
        assertThat(url.queryParameter("limit")).isEqualTo("10")
        assertThat(url.queryParameter("lat")).isEqualTo("43.37")
        assertThat(url.queryParameter("lon")).isEqualTo("-8.41")
        assertThat(urlPhoton("Rúa Real 5", null).queryParameter("lat")).isNull()
        // Contesta 6 calles cualquiera del mismo CP con el 23 y, detrás, 4 de la calle buscada. Cortado a 5 antes de
        // quitar (como hasta hoy), de las buenas no quedaba ninguna.
        fun f(calle: String, numero: String, i: Int) = """{"type":"Feature","geometry":{"type":"Point","coordinates":[${-8.42 + i / 1000.0},${43.36 + i / 1000.0}]},""" +
            """"properties":{"countrycode":"ES","street":"$calle","housenumber":"$numero","postcode":"15011","city":"A Coruña"}}"""
        val malas = listOf("Rúa Almirante Mourelle", "Rúa Virrey Osorio", "Rúa Ramón Cabanillas", "Avenida de Finisterre", "Rúa Doctor Fleming", "Rúa Marqués de Amboage")
        val numeros = listOf("21", "23", "25", "27")
        val json = """{"features":[${(malas.mapIndexed { i, c -> f(c, "23", i) } + numeros.mapIndexed { i, n -> f("Rúa Brétema Mariñeira", n, 10 + i) }).joinToString(",")}]}"""
        val leidas = leerPhoton(json, "es")
        assertThat(leidas).hasSize(10)
        val r = Situar.ordenar(emptyList(), emptyList(), emptyList(), leidas, buscado = "Rúa Brétema Mariñeira 23, 15011 A Coruña")
        assertThat(r.map { it.direccion }).containsExactlyElementsIn(numeros.map { "Rúa Brétema Mariñeira $it, 15011 A Coruña" }).inOrder()
        // Con más de 5 que tocan, se enseñan 5.
        val muchas = List(8) { i -> Sugerencia("Rúa Brétema Mariñeira ${i + 1}, 15011 A Coruña", "15011", "A Coruña", 43.36 + i / 1000.0, -8.42, precision = "portal", fuente = "photon") }
        assertThat(Situar.ordenar(emptyList(), emptyList(), emptyList(), muchas, buscado = "Rúa Brétema Mariñeira 23, 15011 A Coruña")).hasSize(5)
        // Lo de otro país no sale.
        assertThat(leerPhoton(json.replace("\"ES\"", "\"PT\""), "es")).isEmpty()
    }

    @Test
    fun la_poblacion_del_movil_nunca_es_la_provincia() {
        // Visto en el emulador: sin `locality`, la de Oleiros quedaba «A Coruña» (la provincia, subAdminArea) con el CP 15179.
        val linea = "Rúa Brétema, 15179 Oleiros, A Coruña, España"
        assertThat(Situar.localidadDe(null, linea, "15179")).isEqualTo("Oleiros")
        assertThat(Situar.localidadDe("", linea, "")).isEqualTo("Oleiros")
        assertThat(Situar.localidadDe("Oleiros", "", "")).isEqualTo("Oleiros")
        assertThat(Situar.localidadDe(null, "P.º Manuel Núñez, 37, 32616 Villardevós, Ourense, España", "32616")).isEqualTo("Villardevós")
        // Sin CP en la línea, o con nada detrás de él: nada (lo siguiente puede ser la provincia).
        assertThat(Situar.localidadDe(null, "Rúa Brétema, A Coruña, España", "")).isEmpty()
        assertThat(Situar.localidadDe(null, "Rúa Brétema, 15179, A Coruña, España", "15179")).isEmpty()
        // Y la provincia ya no pasa por el pueblo escrito: «Rúa Real 5, 15179 Oleiros» no es «Rúa Real 5, 15003 A Coruña».
        val oleiros = ResultadoMovil(43.3283, -8.3494, pais = "ES", calle = "Rúa Real", numero = "5", cp = "15179",
            localidad = Situar.localidadDe(null, "Rúa Real, 5, 15179 Oleiros, A Coruña, España", "15179"))
        assertThat(oleiros.localidad).isEqualTo("Oleiros")
        val zona = listOf(Punto(43.37, -8.40))
        assertThat(Situar.aceptar(oleiros, "es", "Rúa Real 5, 15003 A Coruña", "15003", "A Coruña", zona)).isNull()
        // Con la provincia como población (lo de antes), se guardaba sola en segundo plano como el portal; desde el
        // 03-11-2026 (B), «A Coruña» con el CP 15179 es la provincia, no la ciudad, y tampoco.
        assertThat(Situar.aceptar(oleiros.copy(localidad = "A Coruña"), "es", "Rúa Real 5, 15003 A Coruña", "15003", "A Coruña", zona)).isNull()
    }

    @Test
    fun el_movil_da_la_precision_de_lo_que_quedara_al_elegirla() {
        val real = ResultadoMovil(43.3702, -8.3990, pais = "ES", calle = "Rúa Real", numero = "85", cp = "15003", localidad = "A Coruña",
            texto = "Rúa Real, 85, 15003 A Coruña, España")
        // La misma calle con otro número: «Sin el portal» (al elegirla se queda D: 3b).
        assertThat(Situar.deMovil(real, "es", "Rúa Real 999, 15003 A Coruña")?.precision).isEqualTo("calle")
        // El mismo número, o D sin número: el portal.
        assertThat(Situar.deMovil(real, "es", "Rúa Real 85, 15003 A Coruña")?.precision).isEqualTo("portal")
        assertThat(Situar.deMovil(real, "es", "Hospital Abente y Lago")?.precision).isEqualTo("portal")
        // De otra calle y con su número: su portal (al elegirla, su dirección: 4).
        val bretema31 = ResultadoMovil(43.3285, -8.3495, pais = "ES", calle = "Rúa Brétema", numero = "31", cp = "15179", localidad = "Oleiros",
            texto = "Rúa Brétema, 31, 15179 Oleiros, A Coruña, España")
        val d = "Rúa Brétema Mariñeira 23, 15011 A Coruña"
        val s = checkNotNull(Situar.deMovil(bretema31, "es", d))
        assertThat(s.precision).isEqualTo("portal")
        assertThat(Situar.alElegir(d, s)).isEqualTo(Situar.Elegida(bretema31.texto, "portal", "15179", "Oleiros"))
        // Sin número: la calle.
        assertThat(Situar.deMovil(bretema31.copy(numero = ""), "es", d)?.precision).isEqualTo("calle")
    }

    @Test
    fun las_suyas_traen_la_precision_del_servidor() {
        val leidas = JSON.decodeFromString(Direcciones.serializer(),
            """{"direcciones":[{"direccion":"Rúa Real 9, 15003 A Coruña","cp":"15003","lat":43.371,"lng":-8.401,"veces":2,"precision":"calle"},""" +
                """{"direccion":"Rúa Nova 1","lat":43.37,"lng":-8.40}]}""").direcciones
        assertThat(leidas.map { it.precision }).containsExactly("calle", "").inOrder()
        val s = Situar.deSuya(leidas[0])
        assertThat(listOf(s.fuente, s.precision, s.direccion)).containsExactly("suya", "calle", "Rúa Real 9, 15003 A Coruña").inOrder()
        // Elegida en la ficha, se manda con "precision": "calle"; una de antes (sin el campo), como la puerta.
        val punto = s.copy(precision = Situar.alElegir("Rúa Real 9", s).precision)
        assertThat(Situar.cuerpoPunto(punto)?.get("precision")?.jsonPrimitive?.content).isEqualTo("calle")
        val antes = Situar.deSuya(leidas[1])
        val elegida = Situar.alElegir("Rúa Nova 1", antes)
        assertThat(elegida.precision).isEqualTo("portal")
        assertThat(Situar.cuerpoPunto(antes.copy(precision = elegida.precision))?.keys).containsExactly("lat", "lng", "geo_origen")
    }

    // ── EL PORTAL Y EL SITIO (03-11-2026): la regla de esta tanda, igual que en la web (lib/situar.js) ───────────────

    @Test
    fun el_portal_es_el_que_vale_de_la_calle() {
        // A) Los que tienen que salir así, igual en la web: la calle, las cifras del portal y el portal entero.
        fun lee(d: String) = Triple(Situar.calleDe(d), Situar.numeroDe(d), Situar.portalDe(d))
        assertThat(lee("Calle 2 de Mayo 14, 28004 Madrid")).isEqualTo(Triple("Calle 2 de Mayo", "14", "14"))
        assertThat(lee("Calle 2 de Mayo, 28004 Madrid")).isEqualTo(Triple("Calle 2 de Mayo", "", ""))
        assertThat(lee("Avenida 18 de Julio 5")).isEqualTo(Triple("Avenida 18 de Julio", "5", "5"))
        assertThat(lee("Estrada AC-173 12, 15179 Oleiros")).isEqualTo(Triple("Estrada AC-173", "12", "12"))
        assertThat(lee("Estrada AC-174, 15179 Oleiros")).isEqualTo(Triple("Estrada AC-174", "", ""))
        assertThat(lee("Calle Real 5B")).isEqualTo(Triple("Calle Real", "5", "5B"))
        assertThat(lee("Rúa Real 5 bis")).isEqualTo(Triple("Rúa Real", "5", "5BIS"))
        assertThat(lee("Calle Real 12-14")).isEqualTo(Triple("Calle Real", "12", "12-14"))
        assertThat(lee("Trav. de Meicende Nº 50, 15140, Arteixo")).isEqualTo(Triple("Trav. de Meicende", "50", "50"))
        assertThat(Situar.numeroDe("R/ Desiderio Vare1a 1")).isEqualTo("1")
        assertThat(Situar.numeroDe("Lugar O Barreir0 6")).isEqualTo("6")
        assertThat(lee("12 rue de Rivoli, Paris")).isEqualTo(Triple("rue de Rivoli", "12", "12"))
        assertThat(lee("Calle Real, 5, 2º")).isEqualTo(Triple("Calle Real", "5", "5"))
        assertThat(lee("Rúa Real 5, 2º B, 15003 A Coruña")).isEqualTo(Triple("Rúa Real", "5", "5"))
        // La letra también con espacio o con guion, «bis» pegado y el rango detrás de la coma.
        assertThat(listOf("Calle Real 5 B", "Calle Real 5-B", "Calle Real, 5 B").map { Situar.portalDe(it) }).containsExactly("5B", "5B", "5B")
        assertThat(Situar.portalDe("Rúa Real 5bis")).isEqualTo("5BIS")
        assertThat(Situar.portalDe("Rúa Real, 12-14, 15003 A Coruña")).isEqualTo("12-14")
        // Más nombres con « de <palabra>» y de carretera; el CP pegado detrás no es el portal.
        assertThat(lee("Calle 8 de Marzo 14, 28004 Madrid")).isEqualTo(Triple("Calle 8 de Marzo", "14", "14"))
        assertThat(lee("Avenida 25 de Abril 5, 15001 A Coruña")).isEqualTo(Triple("Avenida 25 de Abril", "5", "5"))
        assertThat(lee("Carretera N-550 km 3, 15890 Santiago").second).isEqualTo("3")
        assertThat(Situar.calleDe("Calle N-6 3")).isEqualTo("Calle N-6")
        assertThat(lee("Rúa Real 5 15003 A Coruña")).isEqualTo(Triple("Rúa Real", "5", "5"))
        // Lo que ya valía, igual.
        assertThat(lee("Paseo Manuel Núñez Nº 37, 32616, Vilardevós")).isEqualTo(Triple("Paseo Manuel Núñez", "37", "37"))
        assertThat(lee("R/ Celso Emilio Ferreiro nº4, 15624, Ares")).isEqualTo(Triple("R/ Celso Emilio Ferreiro", "4", "4"))
        assertThat(lee("Avenida de Galicia s/n, 15620, Mugardos")).isEqualTo(Triple("Avenida de Galicia", "", ""))
        assertThat(lee("Praza de María Pita, 15001 A Coruña")).isEqualTo(Triple("Praza de María Pita", "", ""))
        assertThat(lee("1200 Avenue of the Americas, New York")).isEqualTo(Triple("Avenue of the Americas", "1200", "1200"))
    }

    @Test
    fun la_misma_calle_es_tambien_el_mismo_sitio() {
        // B) «Rúa Brétema 23, 15011 A Coruña» + «Rúa Brétema, 15179 Oleiros, A Coruña», de cualquier fuente: «Otra calle»
        //    y la regla 4 (su dirección con el piso de D, 15179, Oleiros, «calle»). Antes pasaba por la misma calle (3b) y la
        //    parada se quedaba escrita con el punto de Oleiros, a 8 km.
        val d = "Rúa Brétema 23, 15011 A Coruña"
        val el = Situar.Elegida("Rúa Brétema, 15179 Oleiros, A Coruña", "calle", "15179", "Oleiros")
        for (fuente in listOf("servidor", "movil", "photon")) {
            val s = Sugerencia("Rúa Brétema, 15179 Oleiros, A Coruña", "15179", "Oleiros", 43.3283, -8.3494, precision = "calle", fuente = fuente)
            val lista = when (fuente) {
                "servidor" -> Situar.ordenar(listOf(s), emptyList(), emptyList(), emptyList(), buscado = d)
                "movil" -> Situar.ordenar(emptyList(), emptyList(), listOf(s), emptyList(), buscado = d)
                else -> Situar.ordenar(emptyList(), emptyList(), emptyList(), listOf(s), buscado = d)
            }
            assertThat(lista.single().otraCalle).isTrue()
            assertThat(Situar.alElegir(d, s)).isEqualTo(el)
            assertThat(Situar.alElegir("Rúa Brétema 23, 2º B, 15011 A Coruña", s).direccion).isEqualTo("Rúa Brétema, 15179 Oleiros, A Coruña, 2º B")
            // Con el CP y la población de la parada, igual; desde Hoy, «Es aquí» manda la dirección nueva con el punto.
            assertThat(Situar.alElegir(d, s, "15011", "A Coruña")).isEqualTo(el)
            assertThat(Situar.esAqui(d, "sugerencia", s, "15011", "A Coruña")).isEqualTo(Situar.Cambio("calle", el.direccion, "15179", "Oleiros"))
        }
        // Una del servidor sin el CP ni la población aparte: el sitio se lee en su texto, y es otra calle igual.
        val sinDatos = Sugerencia("Rúa Brétema, 15179 Oleiros", "", "", 43.3283, -8.3494, precision = "calle", fuente = "servidor")
        assertThat(Situar.alElegir(d, sinDatos).direccion).isEqualTo("Rúa Brétema, 15179 Oleiros")
        assertThat(Situar.deLaBuscada(d, sinDatos)).isFalse()
        // «Rúa Real 999, 15003 A Coruña» + «Calle Real, 15179 Oleiros» → «Otra calle», regla 4.
        val realOleiros = Sugerencia("Calle Real, 15179 Oleiros", "15179", "Oleiros", 43.3290, -8.3500, precision = "calle", fuente = "photon")
        assertThat(Situar.ordenar(emptyList(), emptyList(), emptyList(), listOf(realOleiros), buscado = "Rúa Real 999, 15003 A Coruña").single().otraCalle).isTrue()
        assertThat(Situar.alElegir("Rúa Real 999, 15003 A Coruña", realOleiros)).isEqualTo(Situar.Elegida("Calle Real, 15179 Oleiros", "calle", "15179", "Oleiros"))
        // «Rúa Real 5, 15003 A Coruña» + «Rúa Real, 15003 A Coruña» → 3b, como ahora (el mismo CP).
        val real15003 = Sugerencia("Rúa Real, 15003 A Coruña", "15003", "A Coruña", 43.3700, -8.4000, precision = "calle", fuente = "photon")
        assertThat(Situar.alElegir("Rúa Real 5, 15003 A Coruña", real15003)).isEqualTo(Situar.Elegida("Rúa Real 5, 15003 A Coruña", "calle", "15003", "A Coruña"))
        // «Avenida de Finisterre 120, 15004 A Coruña» + «Avenida de Finisterre, 15005 A Coruña» → 3b: otro CP, el mismo pueblo.
        val finisterre = Sugerencia("Avenida de Finisterre, 15005 A Coruña", "15005", "A Coruña", 43.3600, -8.4200, precision = "calle", fuente = "photon")
        assertThat(Situar.ordenar(emptyList(), emptyList(), emptyList(), listOf(finisterre), buscado = "Avenida de Finisterre 120, 15004 A Coruña").single().otraCalle).isFalse()
        assertThat(Situar.alElegir("Avenida de Finisterre 120, 15004 A Coruña", finisterre))
            .isEqualTo(Situar.Elegida("Avenida de Finisterre 120, 15004 A Coruña", "calle", "", "A Coruña"))
        // «Rúa Real 5» (sin CP ni pueblo, y la parada tampoco) + «Rúa Real, 15179 Oleiros» → 3b, como ahora.
        val realO = Sugerencia("Rúa Real, 15179 Oleiros", "15179", "Oleiros", 43.3290, -8.3500, precision = "calle", fuente = "photon")
        assertThat(Situar.alElegir("Rúa Real 5", realO)).isEqualTo(Situar.Elegida("Rúa Real 5, 15179 Oleiros", "calle", "15179", "Oleiros"))
        // Pero con el CP y la población guardados de la parada (desde Hoy), ya es otro sitio: la regla 4, y se marca.
        assertThat(Situar.alElegir("Rúa Real 5", realO, "15003", "A Coruña")).isEqualTo(Situar.Elegida("Rúa Real, 15179 Oleiros", "calle", "15179", "Oleiros"))
        assertThat(Situar.ordenar(emptyList(), emptyList(), emptyList(), listOf(realO), buscado = "Rúa Real 5", cp = "15003", localidad = "A Coruña").single().otraCalle).isTrue()
        // mismoSitio, sus cuatro casos.
        assertThat(Situar.mismoSitio("Rúa Real 5, 15003 A Coruña", "", "", "Rúa Real 5, 15003 A Coruña")).isTrue()
        assertThat(Situar.mismoSitio("Rúa Real 5, 15003 A Coruña", "", "", "Calle Real, 15011 A Coruña")).isTrue()   // otro CP, el mismo pueblo
        assertThat(Situar.mismoSitio("Rúa Real 5, 15003 A Coruña", "", "", "Calle Real, 15179 Oleiros")).isFalse()
        assertThat(Situar.mismoSitio("Rúa Real 5, 15003 A Coruña", "", "", "Calle Real, A Coruña")).isTrue()        // S sin CP, su pueblo
        assertThat(Situar.mismoSitio("Rúa Real 5, 15003", "", "", "Calle Real")).isFalse()                           // S sin CP ni pueblo
        assertThat(Situar.mismoSitio("Rúa Real 5, Oleiros", "", "", "Calle Real, 15179 Oleiros")).isTrue()           // D sin CP, con pueblo
        assertThat(Situar.mismoSitio("Rúa Real 5, Oleiros", "", "", "Calle Real, 15003 A Coruña")).isFalse()
        assertThat(Situar.mismoSitio("Rúa Real 5, Oleiros", "", "", "Calle Real")).isFalse()
        assertThat(Situar.mismoSitio("Rúa Real 5", "", "", "Calle Real, 27001 Lugo")).isTrue()                       // D sin nada
        // El CP y la población de la parada cuentan como los de D; la población de S, antes que lo de su texto.
        assertThat(Situar.mismoSitio("Rúa Real 5", "", "Oleiros", "Calle Real, 15003 A Coruña")).isFalse()
        assertThat(Situar.mismoSitio("Rúa Real 5", "15179", "", "Calle Real, 15179 Oleiros")).isTrue()
        assertThat(Situar.mismoSitio("Rúa Real 5, Oleiros", "", "", "Calle Real, 15003 A Coruña", "", "Oleiros")).isTrue()
    }

    @Test
    fun el_mismo_portal_es_el_portal_entero() {
        // C) 3a solo si el portal entero de S es el de D; si no, 3b: D, «calle».
        fun s(dir: String) = Sugerencia(dir, "", "", 43.3700, -8.4000, precision = "portal", fuente = "photon")
        assertThat(Situar.alElegir("Calle Real 5B", s("Calle Real 5"))).isEqualTo(Situar.Elegida("Calle Real 5B", "calle", "", ""))
        assertThat(Situar.alElegir("Calle Real 5", s("Calle Real 5B"))).isEqualTo(Situar.Elegida("Calle Real 5", "calle", "", ""))
        assertThat(Situar.alElegir("Calle Real 5B", s("Calle Real 5B"))).isEqualTo(Situar.Elegida("Calle Real 5B", "portal", "", ""))
        assertThat(Situar.alElegir("Rúa Real 5 bis", s("Calle Real 5")).precision).isEqualTo("calle")
        assertThat(Situar.alElegir("Calle Real 12-14", s("Calle Real 12")).precision).isEqualTo("calle")
        // «5 B» y «5-B» son «5B»; el piso no cuenta («Rúa Real 5, 2º B» es el 5).
        assertThat(Situar.alElegir("Calle Real 5 B", s("Calle Real, 5-B"))).isEqualTo(Situar.Elegida("Calle Real, 5-B", "portal", "", ""))
        assertThat(Situar.alElegir("Rúa Real 5, 2º B", s("Calle Real, 5")).direccion).isEqualTo("Calle Real, 5, 2º B")
        // «Es aquí» y el móvil, con la misma regla: la misma calle con otro portal entero es la calle.
        assertThat(Situar.esAqui("Calle Real 5B", "sugerencia", s("Calle Real 5")).precision).isEqualTo("calle")
        val movil5 = ResultadoMovil(43.37, -8.40, pais = "ES", calle = "Calle Real", numero = "5", cp = "15003", localidad = "A Coruña",
            texto = "Calle Real, 5, 15003 A Coruña, España")
        assertThat(Situar.deMovil(movil5, "es", "Calle Real 5B, 15003 A Coruña")?.precision).isEqualTo("calle")
        assertThat(Situar.deMovil(movil5, "es", "Calle Real 5, 15003 A Coruña")?.precision).isEqualTo("portal")
        // Y el móvil de la misma calle en otro sitio (con el CP guardado de la parada) es su portal: al elegirlo, su dirección.
        assertThat(Situar.deMovil(movil5.copy(cp = "15179", localidad = "Oleiros", texto = "Calle Real, 5, 15179 Oleiros, España"), "es", "Calle Real 5", "15003", "A Coruña")?.precision)
            .isEqualTo("portal")
    }

    @Test
    fun al_juntar_el_cp_y_la_poblacion_son_de_la_primera_fuente_que_los_traiga() {
        // E) El mismo portal del servidor (sin CP ni población aparte) y de Photon: queda el del servidor con los de Photon
        //    (antes, vacíos); con el del móvil también, con los del móvil. Por este orden: servidor, móvil, Photon.
        val servidor = Sugerencia("Rúa Real 5, 15003 A Coruña", "", "", 43.37000, -8.40000, precision = "portal", fuente = "servidor")
        val movil = Sugerencia("Rúa Real, 5, 15003 A Coruña, España", "15003", "A Coruña", 43.37001, -8.40001, precision = "portal", fuente = "movil")
        val photon = Sugerencia("Rúa Real 5, 15003 A Coruña", "15003", "Coruña", 43.37002, -8.40002, precision = "portal", fuente = "photon")
        val conPhoton = Situar.ordenar(listOf(servidor), emptyList(), emptyList(), listOf(photon)).single()
        assertThat(listOf(conPhoton.fuente, conPhoton.direccion, conPhoton.cp, conPhoton.localidad))
            .containsExactly("servidor", servidor.direccion, "15003", "Coruña").inOrder()
        val conLosTres = Situar.ordenar(listOf(servidor), emptyList(), listOf(movil), listOf(photon)).single()
        assertThat(listOf(conLosTres.fuente, conLosTres.cp, conLosTres.localidad)).containsExactly("servidor", "15003", "A Coruña").inOrder()
        // Cada dato de la primera que lo traiga: el CP del móvil, la población de Photon.
        val sinPueblo = Situar.ordenar(listOf(servidor), emptyList(), listOf(movil.copy(localidad = "")), listOf(photon)).single()
        assertThat(listOf(sinPueblo.cp, sinPueblo.localidad)).containsExactly("15003", "Coruña").inOrder()
        // El orden es el de las fuentes, no el de la lista: Photon delante y el móvil detrás (de otra calle, al final)
        // son el mismo portal a 2 m: quedan los del móvil.
        val nova = movil.copy(direccion = "Rúa Nova, 5, 15003 A Coruña, España", localidad = "A Coruña")
        val r = Situar.ordenar(emptyList(), emptyList(), listOf(nova), listOf(photon), buscado = "Rúa Real", direccion = "Rúa Real 5, 15003 A Coruña").single()
        assertThat(listOf(r.fuente, r.cp, r.localidad)).containsExactly("photon", "15003", "A Coruña").inOrder()
        // La que queda sigue siendo la primera: su dirección, su precisión, su marca; y lo de las suyas, como antes.
        assertThat(r.direccion).isEqualTo(photon.direccion)
        assertThat(r.otraCalle).isFalse()
    }

    @Test
    fun al_cambiar_el_texto_de_la_ficha_no_va_nada_del_punto_de_antes() {
        // D) La ficha borra el punto al cambiar el texto (FichaParada) y, al guardar, del punto solo va lo que es de lo escrito:
        //    el de «Situar la parada» con «Rúa Brétema, 15179 Oleiros» y la dirección reescrita mandaba el punto de Oleiros,
        //    «sugerencia», «calle», 15179 y Oleiros.
        val oleiros = Sugerencia("Rúa Brétema, 15179 Oleiros", "15179", "Oleiros", 43.3283, -8.3494, precision = "calle", fuente = "sugerencia")
        val todo = Situar.loDelPunto("Rúa Brétema, 15179 Oleiros", oleiros)
        assertThat(todo.keys).containsExactly("lat", "lng", "geo_origen", "precision", "cp", "localidad")
        assertThat(todo["cp"]?.jsonPrimitive?.content).isEqualTo("15179")
        assertThat(todo["localidad"]?.jsonPrimitive?.content).isEqualTo("Oleiros")
        assertThat(Situar.loDelPunto("Rúa Brétema Mariñeira 23, 15011 A Coruña", oleiros)).isEmpty()
        assertThat(Situar.loDelPunto("Rúa Brétema, 15179 Oleiros", null)).isEmpty()
        // Puesto a mano en el mapa, igual: con otro texto, nada.
        val aMano = oleiros.copy(cp = "", localidad = "", precision = "portal", fuente = "mapa")
        assertThat(Situar.loDelPunto("Rúa Brétema, 15179 Oleiros", aMano).keys).containsExactly("lat", "lng", "geo_origen")
        assertThat(Situar.loDelPunto("Rúa Brétema 2, 15179 Oleiros", aMano)).isEmpty()
        // Lo leído de la etiqueta (sin origen) con su texto: el punto, el CP y la población.
        val etiqueta = Sugerencia("Rúa Real 5, 15003, A Coruña", "15003", "A Coruña", 43.37, -8.40)
        assertThat(Situar.loDelPunto(" Rúa Real 5, 15003, A Coruña ", etiqueta).keys).containsExactly("lat", "lng", "cp", "localidad")
    }

    @Test
    fun la_sugerencia_sigue_siendolo_mientras_la_chincheta_no_se_aleje_mas_de_3_m() {
        // Acercar o alejar no mueve el centro (SituarPantalla fija el foco del zoom): la sugerencia se olvida solo a más
        // de 3 m de ella, como la web en moveend; arrastrar de verdad sigue olvidándola. A zoom 18, el de la puerta (8 dp
        // son 1,7 m: desde el 03-11-2026 cuenta también la pantalla, sigueEnElla).
        val s = Sugerencia("Rúa Brétema, 15179 Oleiros", "15179", "Oleiros", 43.3283, -8.3494, precision = "calle", fuente = "movil", otraCalle = true)
        assertThat(Situar.sigueEnElla(s, Punto(43.3283, -8.3494), 18.0)).isTrue()
        assertThat(Situar.sigueEnElla(s, Punto(43.32832, -8.3494), 18.0)).isTrue()       // a 2,2 m
        assertThat(Situar.sigueEnElla(s, Punto(43.32834, -8.3494), 18.0)).isFalse()      // a 4,4 m
        assertThat(Situar.sigueEnElla(s, Punto(43.3290, -8.3494), 18.0)).isFalse()       // arrastrada, a 78 m
        assertThat(Situar.sigueEnElla(s.copy(lat = null), Punto(43.3283, -8.3494), 18.0)).isFalse()
        // Con ella, «Es aquí» es la regla (la dirección de S), no D con un punto de Oleiros.
        assertThat(Situar.esAqui("Rúa Brétema Mariñeira 23, 15011 A Coruña", "sugerencia", s).direccion).isEqualTo("Rúa Brétema, 15179 Oleiros")
    }

    @Test
    fun la_sugerencia_solo_la_olvida_un_arrastre_nunca_el_zoom() {
        // ALTA DEL EMULADOR (03-11-2026): tras elegir «Rúa Brétema, 15179 Oleiros · Otra calle», alejar el mapa sin
        // arrastrarlo hasta el zoom 12-13 la olvidaba (el centro se desviaba unos metros con cada zoom) y «Es aquí» mandaba
        // el punto de Oleiros como la puerta de la parada de A Coruña. Un arrastre la olvida a más de 3 m Y a más de 8 dp
        // con el zoom de ese momento; el zoom, nunca, y al pararse el mapa vuelve a centrarse en ella.
        val s = Sugerencia("Rúa Brétema, 15179 Oleiros", "15179", "Oleiros", 43.3283, -8.3494, precision = "calle", fuente = "movil", otraCalle = true)
        val ella = Punto(43.3283, -8.3494)
        fun alNorte(m: Double) = Punto(43.3283 + m / 111_194.93, -8.3494)     // a m metros (Navegador.metrosEntre)
        // Los metros de un dp, como en MapLibre (teselas de 512 dp).
        assertThat(Situar.metrosPorDp(0.0, 0.0)).isWithin(0.01).of(78_271.52)
        assertThat(Situar.metrosPorDp(43.3283, 12.5)).isWithin(0.01).of(9.83)
        assertThat(Situar.metrosPorDp(43.3283, 18.0)).isWithin(0.001).of(0.217)
        // A zoom 12,5 un desfase de 4 m (menos de medio dp) no la olvida, ni uno de 70 m (7 dp); uno de 100 m (10 dp), sí.
        assertThat(Situar.sigueEnElla(s, alNorte(4.0), 12.5)).isTrue()
        assertThat(Situar.sigueEnElla(s, alNorte(70.0), 12.5)).isTrue()
        assertThat(Situar.sigueEnElla(s, alNorte(100.0), 12.5)).isFalse()
        // A zoom 18 (8 dp son 1,7 m), un arrastre de 5 m la olvida y uno de 2 m, no; a zoom 17 (3,5 m), 3,3 m no y 4 m sí.
        assertThat(Situar.sigueEnElla(s, alNorte(5.0), 18.0)).isFalse()
        assertThat(Situar.sigueEnElla(s, alNorte(2.0), 18.0)).isTrue()
        assertThat(Situar.sigueEnElla(s, alNorte(3.3), 17.0)).isTrue()
        assertThat(Situar.sigueEnElla(s, alNorte(4.0), 17.0)).isFalse()
        // Al pararse tras acercar o alejar (sin arrastre), nunca se olvida, por mucho que se haya desviado: se centra en ella.
        assertThat(Situar.alPararse(s, alNorte(4.0), 12.5, arrastre = false)).isEqualTo(Situar.AlParar(centrarEn = ella))
        assertThat(Situar.alPararse(s, alNorte(0.6), 17.0, arrastre = false)).isEqualTo(Situar.AlParar(centrarEn = ella))
        assertThat(Situar.alPararse(s, alNorte(500.0), 18.0, arrastre = false)).isEqualTo(Situar.AlParar(centrarEn = ella))
        // Ya centrada (a menos de 1 cm), nada.
        assertThat(Situar.alPararse(s, ella, 12.5, arrastre = false)).isEqualTo(Situar.AlParar())
        assertThat(Situar.alPararse(s, alNorte(0.005), 12.5, arrastre = false)).isEqualTo(Situar.AlParar())
        // Tras la inercia de un arrastre: lejos, se olvida; cerca, se vuelve a centrar.
        assertThat(Situar.alPararse(s, alNorte(5.0), 18.0, arrastre = true)).isEqualTo(Situar.AlParar(olvidar = true))
        assertThat(Situar.alPararse(s, alNorte(2.0), 18.0, arrastre = true)).isEqualTo(Situar.AlParar(centrarEn = ella))
        assertThat(Situar.alPararse(s, alNorte(4.0), 12.5, arrastre = true)).isEqualTo(Situar.AlParar(centrarEn = ella))
        // Sin sugerencia, o sin su punto, nada.
        assertThat(Situar.alPararse(null, ella, 12.5, arrastre = true)).isEqualTo(Situar.AlParar())
        assertThat(Situar.alPararse(s.copy(lat = null), alNorte(4.0), 12.5, arrastre = false)).isEqualTo(Situar.AlParar())
        // Con ella, «Es aquí» manda la regla: la dirección de Oleiros, nunca D con el punto de Oleiros; sin ella, nada.
        val d = "Rúa Brétema Mariñeira 23, 15011 A Coruña"
        assertThat(Situar.esAqui(d, "sugerencia", s, "15011", "")).isEqualTo(Situar.Cambio("calle", "Rúa Brétema, 15179 Oleiros", "15179", "Oleiros"))
        assertThat(Situar.esAqui(d, "mapa", null, "15011", "")).isEqualTo(Situar.Cambio())
    }

    // ── LOS ÚLTIMOS DETALLES DE LA LECTURA (K, 03-11-2026): los mismos casos en la web (situar.spec.js) ─────────────

    @Test
    fun k1_el_piso_con_todas_sus_letras_detras_de_la_o_y_og_suelto() {
        // La web leía «3ºDerecha» como un pueblo («3oderecha»), marcaba «Otra calle» y aplicaba la regla 4 sin el piso.
        val d = "Calle Real 5 3ºDerecha, 28013 Madrid"
        assertThat(Situar.paraBuscar(d)).isEqualTo("Calle Real 5, 28013 Madrid")
        assertThat(Situar.pueblosEscritos(d)).containsExactly("madrid")
        assertThat(Situar.conPiso(d, "Calle Real 5, 28012 Madrid")).isEqualTo("Calle Real 5, 28012 Madrid, 3ºDerecha")
        val s = Sugerencia("Calle Real 5, 28012 Madrid", "", "", 40.4155, -3.7074, precision = "portal", fuente = "servidor")
        assertThat(Situar.mismoSitio(d, "", "", s.direccion)).isTrue()
        assertThat(Situar.ordenar(listOf(s), emptyList(), emptyList(), emptyList(), buscado = d).single().otraCalle).isFalse()
        assertThat(Situar.alElegir(d, s)).isEqualTo(Situar.Elegida("Calle Real 5, 28012 Madrid, 3ºDerecha", "portal", "", ""))
        assertThat(Situar.paraBuscar("Calle Real 5 2ºIzquierda")).isEqualTo("Calle Real 5")
        // «OG» (Obergeschoss) suelto, como «5. OG».
        assertThat(Situar.paraBuscar("Hauptstrasse 5 OG, 10115 Berlin")).isEqualTo("Hauptstrasse 5, 10115 Berlin")
        assertThat(Situar.conPiso("Hauptstrasse 5 OG, 10115 Berlin", "Hauptstraße 5, 10115 Berlin")).isEqualTo("Hauptstraße 5, 10115 Berlin, OG")
    }

    @Test
    fun k2_los_espacios_raros_son_un_espacio_normal() {
        // `\s` no es lo mismo en Android (ICU), en el JDK y en el navegador: el duro, el de las cifras, el fino, los demás
        // separadores y el tabulador pasan a un espacio normal al leer la dirección.
        fun lee(d: String) = listOf(Situar.paraBuscar(d), Situar.numeroDe(d), Situar.calleDe(d), Situar.portalDe(d), Situar.conPiso(d, "Calle Mayor 5, 28013 Madrid"))
        val normal = lee("Calle Mayor 5 2 B")
        assertThat(normal).containsExactly("Calle Mayor 5", "5", "Calle Mayor", "5", "Calle Mayor 5, 28013 Madrid, 2 B").inOrder()
        for (raro in listOf(" ", " ", " ", " ", "　", " ", " ", "\t")) {
            assertThat(lee("Calle Mayor 5${raro}2 B")).isEqualTo(normal)
            assertThat(lee("Calle${raro}Mayor${raro}5${raro}2${raro}B")).isEqualTo(normal)
        }
        // H2 (03-11-2026): el U+FEFF (para JavaScript es `\s`, para Android no) y el U+000B (no lo es en Android), igual.
        for (raro in listOf("\uFEFF", "\u000B")) {
            assertThat(lee("Calle Mayor 5${raro}2 B")).isEqualTo(normal)
            assertThat(lee("Calle${raro}Mayor${raro}5${raro}2${raro}B")).isEqualTo(normal)
        }
        val horreo = "Carrer de Hórreo,\uFEFF 120 bis, 15320 As Pontes"
        assertThat(listOf(Situar.calleDe(horreo), Situar.numeroDe(horreo), Situar.portalDe(horreo))).containsExactly("Carrer de Hórreo", "120", "120BIS").inOrder()
        assertThat(Situar.portalDe("Carrer de Hórreo,\u000B120 bis, 15320 As Pontes")).isEqualTo("120BIS")
        // Y a los lados se recorta como en la web: al elegir, D sin el U+FEFF del principio.
        val real = Sugerencia("Rúa Real, 15003 A Coruña", "", "", 43.3700, -8.4000, precision = "calle", fuente = "servidor")
        assertThat(Situar.alElegir("\uFEFFRúa Real 5, 15003 A Coruña\uFEFF", real)).isEqualTo(Situar.Elegida("Rúa Real 5, 15003 A Coruña", "calle", "", ""))
        assertThat(Situar.esAqui("\uFEFFRúa Real 5, 15003 A Coruña", "sugerencia", real)).isEqualTo(Situar.Cambio("calle"))
        // Detrás de la coma, en el piso y en el pueblo, igual.
        assertThat(Situar.paraBuscar("Calle Mayor, 5 2 B, Madrid")).isEqualTo("Calle Mayor, 5, Madrid")
        assertThat(Situar.conPiso("Rúa Real 1, 2º B", "Calle Real, 1, 15003 A Coruña, 2º B")).isEqualTo("Calle Real, 1, 15003 A Coruña, 2º B")
        assertThat(Situar.pueblosEscritos("Rúa Real 5, 15179 Oleiros")).containsExactly("oleiros")
        assertThat(Situar.palabrasCalle("P. º Manuel\tNúñez")).containsExactly("manuel", "nunez").inOrder()
    }

    @Test
    fun k3_la_marca_del_numero_detras_de_la_primera_coma() {
        fun lee(d: String) = Triple(Situar.calleDe(d), Situar.numeroDe(d), Situar.portalDe(d))
        val d = "Avenida Primero de Mayo, n.º4 2 B"
        assertThat(lee(d)).isEqualTo(Triple("Avenida Primero de Mayo", "4", "4"))
        assertThat(Situar.conPiso(d, "Avenida Primero de Mayo 4, 15001 A Coruña")).isEqualTo("Avenida Primero de Mayo 4, 15001 A Coruña, 2 B")
        for ((dir, n) in listOf("Rúa Real, nº5" to "5", "Rúa Real, Nº 5, 15003 A Coruña" to "5", "Rúa Real, no 5" to "5", "Rúa Real, No5" to "5",
            "Rúa Real, núm. 3" to "3", "Rúa Real, Núm 3" to "3", "Rúa Real, número 12, 15003 A Coruña" to "12", "Rúa Real, NÚMERO 12" to "12",
            "Rúa Real, n.º 7 bajo" to "7")) {
            assertThat(lee(dir)).isEqualTo(Triple("Rúa Real", n, n))
        }
        // Lo de siempre: el número suelto detrás de la coma; sin número detrás de la marca, nada; un CP no es un portal.
        assertThat(Situar.numeroDe("Calle Real, 5, 2º")).isEqualTo("5")
        assertThat(Situar.numeroDe("Rúa Real, nave 5")).isEqualTo("")
        assertThat(Situar.numeroDe("Rúa Real, nº 15003 A Coruña")).isEqualTo("")
        // El mismo portal: 3a, con el piso.
        val s = Sugerencia("Avenida Primero de Mayo 4, 15001 A Coruña", "", "", 43.37, -8.40, precision = "portal", fuente = "servidor")
        assertThat(Situar.alElegir(d, s)).isEqualTo(Situar.Elegida("Avenida Primero de Mayo 4, 15001 A Coruña, 2 B", "portal", "", ""))
    }

    @Test
    fun k4_el_numero_que_solo_lleva_delante_el_tipo_de_via_no_es_el_portal_de_un_piso() {
        // sinPiso cortaba «3 B» como el piso del 2 de «Calle 2» y se quedaba sin portal.
        fun lee(d: String) = Triple(Situar.calleDe(d), Situar.numeroDe(d), Situar.portalDe(d))
        assertThat(lee("Calle 2 3 B")).isEqualTo(Triple("Calle 2", "3", "3B"))
        assertThat(lee("Calle Real 3 B")).isEqualTo(Triple("Calle Real", "3", "3B"))
        assertThat(Situar.paraBuscar("Calle 2 3 B")).isEqualTo("Calle 2 3")
        assertThat(lee("Calle 2 3 1º B")).isEqualTo(Triple("Calle 2", "3", "3"))
        assertThat(Situar.conPiso("Calle 2 3 1º B, 15003 A Coruña", "Calle 2, 3, 15003 A Coruña")).isEqualTo("Calle 2, 3, 15003 A Coruña, 1º B")
        assertThat(lee("Calle 2 3")).isEqualTo(Triple("Calle 2", "3", "3"))
        assertThat(lee("Calle 2")).isEqualTo(Triple("Calle 2", "", ""))
        assertThat(lee("C/ 2 3 B, 15003 A Coruña")).isEqualTo(Triple("C/ 2", "3", "3B"))
        assertThat(lee("Calle 2 3B, 15003 A Coruña")).isEqualTo(Triple("Calle 2", "3", "3B"))
        // Con el nombre delante, sigue siendo el portal con su piso; y detrás de la coma, también.
        assertThat(lee("Calle Mayor 5 2 B")).isEqualTo(Triple("Calle Mayor", "5", "5"))
        assertThat(Situar.paraBuscar("Calle 2, 5 2 B")).isEqualTo("Calle 2, 5")
        // Al elegir el 3B de la Calle 2: el mismo portal (3a); el 3 a secas no lo es (3b, D tal cual).
        val d = "Calle 2 3 B, 15003 A Coruña"
        val s3b = Sugerencia(d, "", "", 43.37, -8.40, precision = "portal", fuente = "servidor")
        assertThat(Situar.alElegir(d, s3b)).isEqualTo(Situar.Elegida(d, "portal", "", ""))
        val s3 = s3b.copy(direccion = "Calle 2 3, 15003 A Coruña")
        assertThat(Situar.alElegir(d, s3)).isEqualTo(Situar.Elegida(d, "calle", "", ""))
        assertThat(Situar.ordenar(listOf(s3), emptyList(), emptyList(), emptyList(), buscado = d).single().otraCalle).isFalse()
    }

    @Test
    fun k5_el_piso_que_ya_va_en_la_elegida_por_palabras_enteras() {
        // El «2» de «Calle Mayor 15 2» se perdía por el de 28013.
        assertThat(Situar.conPiso("Calle Mayor 15 2", "Calle Mayor 15, 28013 Madrid")).isEqualTo("Calle Mayor 15, 28013 Madrid, 2")
        assertThat(Situar.conPiso("Rúa Real 1, 2º B", "Calle Real, 1, 15003 A Coruña, 2º B")).isEqualTo("Calle Real, 1, 15003 A Coruña, 2º B")
        assertThat(Situar.conPiso("Rúa Real 1, 2º B", "Calle Real, 1, 15003 A Coruña, 12º B")).isEqualTo("Calle Real, 1, 15003 A Coruña, 12º B, 2º B")
        assertThat(Situar.conPiso("Rúa Real 1 bajo", "Rúa Real 1, Bajo, 15003 A Coruña")).isEqualTo("Rúa Real 1, Bajo, 15003 A Coruña")
        assertThat(Situar.conPiso("Rúa Real 1 1 dcha", "Rúa Real 11, 15003 A Coruña")).isEqualTo("Rúa Real 11, 15003 A Coruña, 1 dcha")
        // Al elegir el mismo portal (3a), con el piso entero.
        val s = Sugerencia("Calle Mayor 15, 28013 Madrid", "", "", 40.4155, -3.7074, precision = "portal", fuente = "servidor")
        assertThat(Situar.alElegir("Calle Mayor 15 2", s)).isEqualTo(Situar.Elegida("Calle Mayor 15, 28013 Madrid, 2", "portal", "", ""))
    }

    // ── EL PORTAL, LAS CIFRAS Y EL MUNICIPIO (03-11-2026 por la mañana): la cuarta tanda, igual que en la web ─────────

    @Test
    fun el_portal_es_el_primero_que_vale_y_lo_de_detras_si_es_piso_es_el_piso() {
        // F) Con el último, el piso escrito sin «º» pasaba a ser el portal: «Calle Mayor 15 2 dcha» daba el 2 y la calle
        //    «Calle Mayor 15», y la buena de su calle salía «Otra calle». Ahora, como el servidor, el primero que vale.
        fun lee(d: String) = Triple(Situar.calleDe(d), Situar.numeroDe(d), Situar.portalDe(d))
        val mayor = "Calle Mayor 15 2 dcha, 28013 Madrid"
        assertThat(lee(mayor)).isEqualTo(Triple("Calle Mayor", "15", "15"))
        assertThat(Situar.paraBuscar(mayor)).isEqualTo("Calle Mayor 15, 28013 Madrid")
        assertThat(Situar.conPiso(mayor, "Calle Mayor 15, 28013 Madrid")).isEqualTo("Calle Mayor 15, 28013 Madrid, 2 dcha")
        assertThat(lee("Carrer de Sants 5 2n 1a")).isEqualTo(Triple("Carrer de Sants", "5", "5"))
        assertThat(Situar.conPiso("Carrer de Sants 5 2n 1a, 08014 Barcelona", "Carrer de Sants 5, 08014 Barcelona"))
            .isEqualTo("Carrer de Sants 5, 08014 Barcelona, 2n 1a")
        for ((d, n) in listOf("Rúa Real 5 1 dcha, 15003 A Coruña" to "5", "Calle Mayor 15 2" to "15", "Calle Mayor 15 1o IZQ." to "15",
            "Calle Real 3 3o B" to "3", "Carrer Gran 7 3r 2a" to "7", "Carrer Nou 9 Pral. 2a" to "9", "Carrer Nou 9 Entl. 2a" to "9",
            "Carrer Nou 9 Àtic 1a" to "9", "Nagusia kalea 4 4. eskuma" to "4", "Nagusia kalea 4 3. ezk." to "4", "Rúa do Sol 8 Baixo 2" to "8",
            "Lugar Pastel 12 Casa 2" to "12", "Polígono Sabón 12 Nave 3" to "12", "Avenida 18 de Julio 5 2 B" to "5")) {
            assertThat(Situar.numeroDe(d)).isEqualTo(n)
        }
        assertThat(Situar.paraBuscar("Rúa do Sol 8 Baixo 2, 15003 A Coruña")).isEqualTo("Rúa do Sol 8, 15003 A Coruña")
        // La calle es el primer trozo que no está vacío, como en la web (con una coma delante era el vacío), y el piso
        // sale sin el espacio que no se parte.
        assertThat(Situar.conPiso(", Calle Mayor 15 2 dcha, 28013 Madrid", "Calle Mayor 15, 28013 Madrid")).isEqualTo("Calle Mayor 15, 28013 Madrid, 2 dcha")
        assertThat(Situar.paraBuscar(", Puerta del Sol 1, 28013 Madrid")).isEqualTo("Puerta del Sol 1, 28013 Madrid")
        assertThat(Situar.conPiso("Calle Mayor\u00a015\u00a02 dcha, 28013 Madrid", "Calle Mayor 15, 28013 Madrid"))
            .isEqualTo("Calle Mayor 15, 28013 Madrid, 2 dcha")
        // El que solo lleva delante el tipo de vía es del nombre.
        assertThat(lee("Calle 2 3")).isEqualTo(Triple("Calle 2", "3", "3"))
        assertThat(lee("Calle 2")).isEqualTo(Triple("Calle 2", "", ""))
        assertThat(lee("Calle 2, 15003 A Coruña")).isEqualTo(Triple("Calle 2", "", ""))
        // Detrás de un tipo que también es el nombre de una calle, sí es el portal (en el laboratorio: la Rúa da Estrada 24).
        assertThat(lee("ESTRADA 24, 36004, A PARDA")).isEqualTo(Triple("ESTRADA", "24", "24"))
        assertThat(lee("Rambla 98, 08002 Barcelona")).isEqualTo(Triple("Rambla", "98", "98"))
        assertThat(Situar.conPiso("Calle Mayor 15 1o IZQ.", "Calle Mayor 15, 28013 Madrid")).isEqualTo("Calle Mayor 15, 28013 Madrid, 1o IZQ")
        // Una letra suelta con más nombre detrás no es piso: «A Coruña» sigue en lo que se busca.
        assertThat(Situar.numeroDe("Calle Real 1 A Coruña")).isEqualTo("1")
        assertThat(Situar.paraBuscar("Calle Real 1 A Coruña")).isEqualTo("Calle Real 1 A Coruña")
        // Al elegir: el mismo portal con todo su piso detrás (3a); la calle sola o el 1 de «5 1 dcha», D tal cual (3b).
        fun s(dir: String, prec: String) = Sugerencia(dir, "", "", 40.4155, -3.7074, precision = prec, fuente = "servidor")
        assertThat(Situar.alElegir(mayor, s("Calle Mayor 15, 28013 Madrid", "portal")))
            .isEqualTo(Situar.Elegida("Calle Mayor 15, 28013 Madrid, 2 dcha", "portal", "", ""))
        assertThat(Situar.alElegir(mayor, s("Calle Mayor, 28013 Madrid", "calle"))).isEqualTo(Situar.Elegida(mayor, "calle", "", ""))
        val real = "Rúa Real 5 1 dcha, 15003 A Coruña"
        assertThat(Situar.alElegir(real, s("Rúa Real 1, 15003 A Coruña", "portal"))).isEqualTo(Situar.Elegida(real, "calle", "", ""))
        assertThat(Situar.esAqui(real, "sugerencia", s("Rúa Real 1, 15003 A Coruña", "portal").copy(fuente = "photon"))).isEqualTo(Situar.Cambio("calle"))
        assertThat(Situar.ordenar(listOf(s("Calle Mayor 15, 28013 Madrid", "portal")), emptyList(), emptyList(), emptyList(), buscado = mayor)
            .single().otraCalle).isFalse()
        // En segundo plano, el 1 del móvil no es el portal de «Rúa Real 5 1 dcha»; el 5, sí.
        val movil1 = ResultadoMovil(43.3700, -8.4000, pais = "ES", calle = "Rúa Real", numero = "1", cp = "15003", localidad = "A Coruña")
        assertThat(Situar.aceptar(movil1, "es", real, "15003", "A Coruña", emptyList())).isEqualTo("calle")
        assertThat(Situar.aceptar(movil1.copy(numero = "5"), "es", real, "15003", "A Coruña", emptyList())).isEqualTo("portal")
    }

    @Test
    fun las_cifras_del_nombre_cuentan() {
        // G) palabrasCalle quitaba las cifras sueltas: «Calle 1 de Mayo», «Calle 2 de Mayo» y «Plaza 1 de Mayo» eran [mayo],
        //    y «Calle 2 de Mayo, 28004 Madrid» pasaba por la calle de «Calle 1 de Mayo 4» (3b: D con el punto de otra).
        assertThat(Situar.palabrasCalle("Calle 1 de Mayo")).containsExactly("1", "mayo").inOrder()
        assertThat(Situar.palabrasCalle("Calle 2")).containsExactly("2")
        assertThat(Situar.mismaCalle("Calle 1 de Mayo", "Calle 2 de Mayo")).isFalse()
        assertThat(Situar.mismaCalle("Calle 1 de Mayo", "Calle Mayo")).isFalse()
        assertThat(Situar.mismaCalle("Avenida 18 de Julio", "Av. 18 de Julio")).isTrue()
        assertThat(Situar.mismaCalle("Calle 2 de Mayo", "Calle Dos de Mayo")).isFalse()
        assertThat(Situar.mismaCalle("Estrada AC-173", "Estrada AC-173")).isTrue()
        // En segundo plano, el móvil con la otra calle no se guarda.
        val dosDeMayo = ResultadoMovil(40.4290, -3.7040, pais = "ES", calle = "Calle 2 de Mayo", numero = "4", cp = "28004", localidad = "")
        assertThat(Situar.aceptar(dosDeMayo, "es", "Calle 1 de Mayo 4, 28004 Madrid", "28004", "Madrid", emptyList())).isNull()
        val plaza = ResultadoMovil(43.3700, -8.4000, pais = "ES", calle = "Plaza 2 de Mayo", numero = "3", cp = "15001", localidad = "A Coruña")
        assertThat(Situar.aceptar(plaza, "es", "Plaza 1 de Mayo 3", "", "", emptyList(), listOf(Punto(43.37, -8.40)))).isNull()
        assertThat(Situar.aceptar(plaza.copy(calle = "Plaza 1 de Mayo"), "es", "Plaza 1 de Mayo 3", "", "", emptyList(), listOf(Punto(43.37, -8.40))))
            .isEqualTo("portal")
        // Al elegir: «Otra calle» y la regla 4, nunca D con el punto de la otra.
        val d = "Calle 1 de Mayo 4, 28004 Madrid"
        val s = Sugerencia("Calle 2 de Mayo, 28004 Madrid", "", "", 40.4290, -3.7040, precision = "calle", fuente = "servidor")
        assertThat(Situar.ordenar(listOf(s), emptyList(), emptyList(), emptyList(), buscado = d).single().otraCalle).isTrue()
        assertThat(Situar.alElegir(d, s)).isEqualTo(Situar.Elegida("Calle 2 de Mayo, 28004 Madrid", "calle", "", ""))
    }

    @Test
    fun el_pueblo_entre_parentesis_es_su_municipio() {
        // H) CartoCiudad escribe «15670 O Burgo (Culleredo)»: «culleredo» no era «o burgo culleredo», salía «Otra calle» y la
        //    regla 4 perdía el 5. «X (Y)» son dos pueblos; Y no cuenta si es solo un artículo ni si es una provincia.
        assertThat(Situar.pueblosEscritos("Rúa Conservatorio, 15670 O Burgo (Culleredo)")).containsExactly("o burgo", "culleredo").inOrder()
        assertThat(Situar.pueblosEscritos("Rúa Real 5, 15003 CORUÑA (A)")).containsExactly("coruna")
        assertThat(Situar.pueblosEscritos("Rúa Real 5, 15895 Ames (A Coruña)")).containsExactly("ames")
        assertThat(Situar.pueblosEscritos("Rúa Real 5", "O Burgo (Culleredo)")).containsExactly("o burgo", "culleredo").inOrder()
        assertThat(Situar.mismoPueblo("CORUÑA (A)", listOf("a coruna"))).isTrue()
        assertThat(Situar.mismoPueblo("O Burgo (Culleredo)", listOf("culleredo"))).isTrue()
        assertThat(Situar.mismoPueblo("O Burgo (Culleredo)", listOf("o burgo"))).isTrue()
        assertThat(Situar.mismoPueblo("Ames (A Coruña)", listOf("a coruna"))).isFalse()
        assertThat(Situar.mismoPueblo("A Coruña", Situar.pueblosEscritos("Rúa Real 5, 15003 CORUÑA (A)"))).isTrue()
        // D «Rúa Conservatorio 5, Culleredo» + S «…, 15670 O Burgo (Culleredo)»: el mismo sitio, 3b, D con su 5.
        val conservatorio = Sugerencia("Rúa Conservatorio, 15670 O Burgo (Culleredo)", "", "", 43.3270, -8.3700, precision = "calle", fuente = "servidor")
        val d = "Rúa Conservatorio 5, Culleredo"
        assertThat(Situar.mismoSitio(d, "", "", conservatorio.direccion)).isTrue()
        assertThat(Situar.ordenar(listOf(conservatorio), emptyList(), emptyList(), emptyList(), buscado = d).single().otraCalle).isFalse()
        assertThat(Situar.alElegir(d, conservatorio)).isEqualTo(Situar.Elegida(d, "calle", "", ""))
        // Lo mismo con la población de la parada y sin pueblo escrito, y con la de S aparte.
        assertThat(Situar.alElegir("Rúa Conservatorio 5", conservatorio, "", "Culleredo")).isEqualTo(Situar.Elegida("Rúa Conservatorio 5", "calle", "", ""))
        assertThat(Situar.mismoSitio(d, "", "", "Rúa Conservatorio", "15670", "O Burgo (Culleredo)")).isTrue()
        // D «Lugar Pastel 12, Cambre» + S «Lugar Pastel, 15668 O Pastel (Cambre)»: 3b.
        val pastel = Sugerencia("Lugar Pastel, 15668 O Pastel (Cambre)", "", "", 43.2900, -8.3400, precision = "calle", fuente = "servidor")
        assertThat(Situar.alElegir("Lugar Pastel 12, Cambre", pastel)).isEqualTo(Situar.Elegida("Lugar Pastel 12, Cambre", "calle", "", ""))
        // D «Rúa Brétema 23, Oleiros» + S «Rúa Brétema, 15011 A Coruña (A Coruña)»: la provincia no hace de pueblo, «Otra calle».
        val coruna = Sugerencia("Rúa Brétema, 15011 A Coruña (A Coruña)", "", "", 43.3600, -8.4150, precision = "calle", fuente = "servidor")
        for (dir in listOf("Rúa Brétema 23, Oleiros", "Rúa Brétema 23, Oleiros, A Coruña")) {
            assertThat(Situar.ordenar(listOf(coruna), emptyList(), emptyList(), emptyList(), buscado = dir).single().otraCalle).isTrue()
            assertThat(Situar.alElegir(dir, coruna)).isEqualTo(Situar.Elegida(coruna.direccion, "calle", "", ""))
        }
        // «Ames (A Coruña)» no pasa por la ciudad.
        assertThat(Situar.mismoSitio("Rúa Real 5, 15003 A Coruña", "", "", "Rúa Real, 15895 Ames (A Coruña)")).isFalse()
    }

    @Test
    fun el_piso_detras_del_numero_es_el_mismo_que_en_la_web() {
        // J) Para \b, «º» es letra en Android y en el JDK 17 y no en el navegador: «n.º4 2 B» dejaba de piso «B» aquí y
        //    «2 B» en la web.
        val d = "Avenida Primero de Mayo, n.º4 2 B"
        assertThat(Situar.paraBuscar(d)).isEqualTo("Avenida Primero de Mayo, n.º4")
        assertThat(Situar.conPiso(d, "Avenida Primero de Mayo 4, 15001 A Coruña")).isEqualTo("Avenida Primero de Mayo 4, 15001 A Coruña, 2 B")
        // «º» y «ª» delante no cuentan como letra (como en numeroEn); otra letra sí: el número no va pegado a ella.
        assertThat(Situar.paraBuscar("Rúa Real, nº5 2 B")).isEqualTo("Rúa Real, nº5")
        assertThat(Situar.paraBuscar("Rúa Real, Peñ5 2 B")).isEqualTo("Rúa Real, Peñ5 2")
        // Lo de siempre, igual: «5 2 B» y «5 B» detrás de la coma.
        assertThat(Situar.paraBuscar("Calle Mayor, 5 2 B, Madrid")).isEqualTo("Calle Mayor, 5, Madrid")
        assertThat(Situar.paraBuscar("Calle Mayor, 5 B")).isEqualTo("Calle Mayor, 5")
    }

    @Test
    fun photon_la_poblacion_es_la_de_la_web_sin_district() {
        // I) Con la misma respuesta de Photon, la app guardaba «Rúa Real 5, 15179 Santa Cristina» con la población «Santa
        //    Cristina» y la web «Rúa Real 5, 15179» sin población: district va en el texto, no en la población.
        val json = """{"features":[{"geometry":{"coordinates":[-8.315,43.3412]},"properties":{"countrycode":"ES","street":"Rúa Real",""" +
            """"postcode":"15179","district":"Santa Cristina","county":"A Coruña","state":"Galicia"}},{"geometry":{"coordinates":[-8.3152,43.3413]},""" +
            """"properties":{"countrycode":"ES","street":"Rúa Real","housenumber":"5","postcode":"15179","district":"Santa Cristina"}}]}"""
        val l = leerPhoton(json, "es")
        assertThat(l.map { listOf(it.direccion, it.cp, it.localidad, it.precision) }).containsExactly(
            listOf("Rúa Real, 15179 Santa Cristina", "15179", "", "calle"), listOf("Rúa Real 5, 15179 Santa Cristina", "15179", "", "portal")).inOrder()
        assertThat(Situar.alElegir("Rúa Real 5", l[0])).isEqualTo(Situar.Elegida("Rúa Real 5, 15179", "calle", "15179", ""))
        assertThat(Situar.alElegir("Rúa Real 5", l[1])).isEqualTo(Situar.Elegida("Rúa Real 5, 15179 Santa Cristina", "portal", "15179", ""))
        // Con town (o city, o village), esa es la población, y la del texto.
        val conTown = leerPhoton(json.replace(""""district":"Santa Cristina"}}]}""", """"district":"Santa Cristina","town":"Oleiros"}}]}"""), "es")
        assertThat(listOf(conTown.last().direccion, conTown.last().localidad)).containsExactly("Rúa Real 5, 15179 Oleiros", "Oleiros").inOrder()
    }

    // ── LA QUINTA TANDA (03-11-2026 a media mañana): los mismos casos en la web (situar.spec.js) ─────────────────────

    @Test
    fun b_el_nombre_de_la_capital_con_el_cp_de_otro_municipio_es_la_provincia() {
        // «Rúa Rosalía de Castro 5, 15179 A Coruña» es de Oleiros, y la de la ciudad (15004, a 8 km) pasaba por el mismo
        // sitio: sin «Otra calle», la 3b dejaba D con el punto de la ciudad y, en segundo plano, se guardaba sola.
        val ciudad = Sugerencia("Rúa Rosalía de Castro, 15004 A Coruña", "", "", 43.3660, -8.4050, precision = "calle", fuente = "servidor")
        val movil = ResultadoMovil(43.3660, -8.4050, pais = "ES", calle = "Rúa Rosalía de Castro", numero = "5", cp = "15004", localidad = "A Coruña")
        val oleiros = listOf(Punto(43.3330, -8.3120))
        for ((d, loc) in listOf("Rúa Rosalía de Castro 5, 15179 A Coruña" to "", "Rúa Rosalía de Castro 5, 15179 Oleiros" to "A Coruña")) {
            assertThat(Situar.mismoSitio(d, "", loc, ciudad.direccion)).isFalse()
            assertThat(Situar.ordenar(listOf(ciudad), emptyList(), emptyList(), emptyList(), buscado = d, localidad = loc).single().otraCalle).isTrue()
            assertThat(Situar.alElegir(d, ciudad, "", loc)).isEqualTo(Situar.Elegida(ciudad.direccion, "calle", "", ""))
            assertThat(Situar.aceptar(movil, "es", d, "15179", loc, oleiros)).isNull()
            assertThat(Situar.aceptar(movil, "es", d, "", loc, oleiros)).isNull()
        }
        assertThat(Situar.pueblosEscritos("Rúa Rosalía de Castro 5, 15179 A Coruña")).isEmpty()
        assertThat(Situar.pueblosEscritos("Rúa Rosalía de Castro 5, 15179 Oleiros", "A Coruña")).containsExactly("oleiros")
        assertThat(Situar.pueblosEscritos("Rúa Rosalía de Castro 5", "A Coruña", "15179")).isEmpty()
        assertThat(Situar.pueblosEscritos("Rúa Rosalía de Castro 5", "A Coruña", "15004")).containsExactly("a coruna")
        assertThat(Situar.mismoPueblo("A Coruña", listOf("a coruna"), "15179")).isFalse()
        assertThat(Situar.mismoPueblo("A Coruña", listOf("a coruna"), "15004")).isTrue()
        // Con el CP de la capital, o sin CP, es la ciudad (como hasta ahora): el mismo sitio y la 3b.
        fun sitio(d: String, s: String) = Situar.mismoSitio(d, "", "", s)
        assertThat(sitio("Avenida de Finisterre 120, 15004 A Coruña", "Avenida de Finisterre, 15005 A Coruña")).isTrue()
        val fin = Sugerencia("Avenida de Finisterre, 15005 A Coruña", "", "", 43.3600, -8.4100, precision = "calle", fuente = "servidor")
        assertThat(Situar.alElegir("Avenida de Finisterre 120, 15004 A Coruña", fin))
            .isEqualTo(Situar.Elegida("Avenida de Finisterre 120, 15004 A Coruña", "calle", "", ""))
        assertThat(sitio("Rúa Real 5, A Coruña", "Rúa Real, 15003 A Coruña")).isTrue()
        assertThat(sitio("Calle Mayor 5, 28013 Madrid", "Calle Mayor, 28005 Madrid")).isTrue()
        // Con el de otro municipio, otra calle; y «España» o «Galicia» no hacen de pueblo.
        assertThat(sitio("Calle Mayor 5, 28220 Madrid", "Calle Mayor, 28013 Madrid")).isFalse()
        assertThat(sitio("Rúa Brétema 23, 15179, A Coruña", "Rúa Brétema, 15011 A Coruña")).isFalse()
        assertThat(sitio("Calle Real 5, 27002 Lugo, España", "Rúa Real, 15003 A Coruña, España")).isFalse()
        assertThat(Situar.pueblosEscritos("Calle Real 5, 27002 Lugo, España")).containsExactly("lugo")
        assertThat(Situar.pueblosEscritos("Calle Real 5, Galicia, España")).isEmpty()
        val coruna = Sugerencia("Rúa Real, 15003 A Coruña, España", "", "", 43.3700, -8.4000, precision = "calle", fuente = "servidor")
        assertThat(Situar.ordenar(listOf(coruna), emptyList(), emptyList(), emptyList(), buscado = "Calle Real 5, 27002 Lugo, España").single().otraCalle).isTrue()
        val bretema = Sugerencia("Rúa Brétema, 15011 A Coruña", "", "", 43.3500, -8.4200, precision = "calle", fuente = "servidor")
        assertThat(Situar.alElegir("Rúa Brétema 23, 15179, A Coruña", bretema)).isEqualTo(Situar.Elegida(bretema.direccion, "calle", "", ""))
        // En segundo plano, Madrid con el CP de Alcobendas no es la ciudad; con el suyo, sí.
        val sol = ResultadoMovil(40.4154, -3.7096, pais = "ES", calle = "Calle Mayor", numero = "5", cp = "28013", localidad = "Madrid")
        assertThat(Situar.aceptar(sol, "es", "Calle Mayor 5, 28100 Madrid", "28100", "", listOf(Punto(40.5410, -3.6410)))).isNull()
        assertThat(Situar.aceptar(sol.copy(cp = "28005"), "es", "Calle Mayor 5, 28013 Madrid", "28013", "", listOf(Punto(40.4160, -3.7030)))).isEqualTo("portal")
    }

    @Test
    fun c_a_photon_va_lo_buscado_sin_el_piso() {
        // Photon tomaba el piso por el portal: con «Trav. de Meicende nº50 2 B, 15140, Arteixo» daba «Travesía de Meicende
        // 2B», a 380 m del 50, y al elegirla se guardaba D con ese punto.
        fun q(buscado: String) = urlPhoton(buscado, null).queryParameter("q")
        assertThat(q("Trav. de Meicende nº50 2 B, 15140, Arteixo")).isEqualTo("Trav. de Meicende nº50, 15140, Arteixo")
        assertThat(q("Rúa Real 5 1 dcha, 15003 A Coruña")).isEqualTo("Rúa Real 5, 15003 A Coruña")
        assertThat(q("Rúa Real 1, 2º B, 15003 A Coruña")).isEqualTo("Rúa Real 1, 15003 A Coruña")
        // Sin piso, tal cual; si sin él no queda nada, lo buscado.
        assertThat(q("Hospital Abente y Lago")).isEqualTo("Hospital Abente y Lago")
        assertThat(q("2º B")).isEqualTo("2º B")
        // La llamada de verdad (buscarEnMapa), sin red: lo que sale hacia Photon va sin el piso.
        var pedida: HttpUrl? = null
        val http = OkHttpClient.Builder().addInterceptor { c ->
            pedida = c.request().url
            Response.Builder().request(c.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("""{"features":[]}""".toResponseBody("application/json".toMediaType())).build()
        }.build()
        assertThat(buscarEnMapa(http, "Trav. de Meicende nº50 2 B, 15140, Arteixo", "es", 43.31 to -8.45)).isEmpty()
        assertThat(pedida?.host).isEqualTo("photon.komoot.io")
        assertThat(pedida?.queryParameter("q")).isEqualTo("Trav. de Meicende nº50, 15140, Arteixo")
        // Lo que se quita y se marca sigue mirando lo buscado y D: el 2B de Photon es el mismo portal que D no tiene (3b).
        val d = "Trav. de Meicende nº50 2 B, 15140, Arteixo"
        val dosB = Sugerencia("Travesía de Meicende 2B, 15140 Arteixo", "15140", "Arteixo", 43.3060, -8.4560, precision = "portal", fuente = "photon")
        assertThat(Situar.ordenar(emptyList(), emptyList(), emptyList(), listOf(dosB), buscado = d).single().otraCalle).isFalse()
        assertThat(Situar.alElegir(d, dosB).precision).isEqualTo("calle")
    }

    @Test
    fun f2_el_numero_del_nombre_seguido_de_una_palabra_no_es_el_portal() {
        // Con el primero que vale, «Calle de las 3 Cruces 12» daba el 3, y la 3a podía cambiar de edificio.
        fun lee(d: String) = Triple(Situar.calleDe(d), Situar.numeroDe(d), Situar.portalDe(d))
        assertThat(lee("Calle de las 3 Cruces 12")).isEqualTo(Triple("Calle de las 3 Cruces", "12", "12"))
        assertThat(lee("Rúa de 4 Caminos 38")).isEqualTo(Triple("Rúa de 4 Caminos", "38", "38"))
        assertThat(lee("Calle de las 13 Rosas 7")).isEqualTo(Triple("Calle de las 13 Rosas", "7", "7"))
        assertThat(lee("Plaza de los 2 Caminos 4")).isEqualTo(Triple("Plaza de los 2 Caminos", "4", "4"))
        // Siguen igual: el piso, la «y», la nave, el pueblo y el CP detrás no son del nombre.
        for ((d, n) in listOf("Calle Mayor 15 2 dcha" to "15", "Carrer de Sants 5 2n 1a" to "5", "Calle 2 3" to "3", "Calle Real 5 y 7" to "5",
            "Polígono de Sabón Parcela 10 Nave 4" to "10", "Calle Real 1 A Coruña" to "1", "Calle Velázquez 5 Madrid 28001" to "5",
            "Calle 2 de Mayo 14" to "14", "Estrada AC-173 12" to "12", "12 rue de Rivoli" to "12")) {
            assertThat(Situar.numeroDe(d)).isEqualTo(n)
        }
        // La palabra, entera: con un espacio de ancho cero dentro («Apt\u200Bo», visto por el revisor) no es una palabra;
        // con un punto o una barra detrás, sí.
        assertThat(Situar.numeroDe("ESTRADA N-550 núm. 14A Apt\u200Bo 4 - 36416 Mos")).isEqualTo("14")
        assertThat(Situar.numeroDe("Calle de las 3 Cruces. 12")).isEqualTo("12")
        assertThat(Situar.numeroDe("Calle de las 3 Cruces/12")).isEqualTo("12")
        // Con el piso detrás, el portal y su piso.
        val d = "Calle de las 3 Cruces 12 2 dcha, 28013 Madrid"
        assertThat(Situar.paraBuscar(d)).isEqualTo("Calle de las 3 Cruces 12, 28013 Madrid")
        // Al elegir: el 12 de su calle es el mismo portal (3a, con el piso); el 3, no (3b, D tal cual).
        val s12 = Sugerencia("Calle de las 3 Cruces 12, 28013 Madrid", "", "", 40.4150, -3.7050, precision = "portal", fuente = "servidor")
        assertThat(Situar.alElegir(d, s12)).isEqualTo(Situar.Elegida("Calle de las 3 Cruces 12, 28013 Madrid, 2 dcha", "portal", "", ""))
        val s3 = s12.copy(direccion = "Calle de las 3 Cruces 3, 28013 Madrid")
        assertThat(Situar.alElegir(d, s3)).isEqualTo(Situar.Elegida(d, "calle", "", ""))
        assertThat(Situar.ordenar(listOf(s3), emptyList(), emptyList(), emptyList(), buscado = d).single().otraCalle).isFalse()
    }

    @Test
    fun g2_la_letra_suelta_del_portal_no_es_piso_al_juntar() {
        // «Calle Real 3 B» + «Calle Real 3B, 15003 A Coruña» daba «…, B», y con otra calle la «B» quedaba de piso.
        assertThat(Situar.conPiso("Calle Real 3 B, 15003 A Coruña", "Calle Real 3B, 15003 A Coruña")).isEqualTo("Calle Real 3B, 15003 A Coruña")
        assertThat(Situar.conPiso("Rúa Brétema Mariñeira 23 B, 15011 A Coruña", "Rúa Brétema, 15179 Oleiros")).isEqualTo("Rúa Brétema, 15179 Oleiros")
        // Siguen igual: el piso con su letra.
        assertThat(Situar.conPiso("Calle Mayor 5 2 B", "Calle Mayor 5, 28013 Madrid")).isEqualTo("Calle Mayor 5, 28013 Madrid, 2 B")
        assertThat(Situar.conPiso("Rúa Real 1, 2º B", "Calle Real, 1, 15003 A Coruña")).isEqualTo("Calle Real, 1, 15003 A Coruña, 2º B")
        assertThat(Situar.conPiso("Calle Mayor 15 2", "Calle Mayor 15, 28013 Madrid")).isEqualTo("Calle Mayor 15, 28013 Madrid, 2")
        // Al elegir: el mismo portal (3a) y otra calle (4), sin la «B» detrás.
        val s = Sugerencia("Calle Real 3B, 15003 A Coruña", "", "", 43.3700, -8.4000, precision = "portal", fuente = "servidor")
        assertThat(Situar.alElegir("Calle Real 3 B, 15003 A Coruña", s)).isEqualTo(Situar.Elegida("Calle Real 3B, 15003 A Coruña", "portal", "", ""))
        val oleiros = Sugerencia("Rúa Brétema, 15179 Oleiros", "", "", 43.3300, -8.3100, precision = "calle", fuente = "servidor")
        assertThat(Situar.alElegir("Rúa Brétema Mariñeira 23 B, 15011 A Coruña", oleiros)).isEqualTo(Situar.Elegida("Rúa Brétema, 15179 Oleiros", "calle", "", ""))
    }

    @Test
    fun d_en_segundo_plano_solo_el_portal_entero() {
        // «Calle Real 5B» con «Calle Real 5» del móvil se guardaba sola como la puerta (y al revés), y como sugerencia ya
        // era la calle (3b). Ahora «portal» solo con el portal entero, escrito como sea.
        fun movil(numero: String, calle: String = "Calle Real") =
            ResultadoMovil(43.3700, -8.4000, pais = "ES", calle = calle, numero = numero, cp = "15003", localidad = "A Coruña")
        fun acepta(d: String, numero: String) = Situar.aceptar(movil(numero, Situar.calleDe(d)), "es", "$d, 15003 A Coruña", "15003", "A Coruña", emptyList())
        assertThat(acepta("Calle Real 5B", "5")).isEqualTo("calle")
        assertThat(acepta("Calle Real 5", "5B")).isEqualTo("calle")
        assertThat(acepta("Calle Real 5", "5")).isEqualTo("portal")
        assertThat(acepta("Rúa Real 5 bis", "5 bis")).isEqualTo("portal")
        assertThat(acepta("Calle Real 12-14", "12")).isEqualTo("calle")
        assertThat(acepta("Calle Real 5B", "5 B")).isEqualTo("portal")
        assertThat(acepta("Calle Real 5 B", "5-b")).isEqualTo("portal")
        assertThat(acepta("Calle Real 12-14", "12-14")).isEqualTo("portal")
        // Como sugerencia, lo mismo; y mejor() se queda con la del portal entero.
        assertThat(Situar.deMovil(movil("5"), "es", "Calle Real 5B, 15003 A Coruña", "15003", "A Coruña")?.precision).isEqualTo("calle")
        val r = Situar.mejor(listOf(movil("5"), movil("5B")), "es", "Calle Real 5B, 15003 A Coruña", "15003", "A Coruña", emptyList())
        assertThat(r?.first?.numero).isEqualTo("5B")
        assertThat(r?.second).isEqualTo("portal")
    }

    // ── LA SEXTA TANDA (03-11-2026 a mediodía): los mismos casos en la web (situar.spec.js) ─────────────────────────

    @Test
    fun f3_el_numero_del_nombre_solo_detras_de_un_articulo() {
        // Con F2 bastaban cualquier palabra y otro número detrás: «Calle Mayor 5 Escala 2» daba el 2, y «Calle de las 3
        // Cruces, 28013 Madrid» tenía el portal 3 (salía «Otra calle» y se perdía el 12 de D).
        fun lee(d: String) = Triple(Situar.calleDe(d), Situar.numeroDe(d), Situar.portalDe(d))
        assertThat(lee("Calle de las 3 Cruces 12")).isEqualTo(Triple("Calle de las 3 Cruces", "12", "12"))
        assertThat(lee("Rúa de 4 Caminos 38")).isEqualTo(Triple("Rúa de 4 Caminos", "38", "38"))
        assertThat(lee("Calle de las 13 Rosas 7")).isEqualTo(Triple("Calle de las 13 Rosas", "7", "7"))
        assertThat(lee("Plaza de los 2 Caminos 4")).isEqualTo(Triple("Plaza de los 2 Caminos", "4", "4"))
        // Detrás de un artículo y al final del trozo, también es del nombre: sin portal.
        assertThat(lee("Calle de las 3 Cruces, 28013 Madrid")).isEqualTo(Triple("Calle de las 3 Cruces", "", ""))
        assertThat(lee("Avenida del 4 Caminos, 15003 A Coruña")).isEqualTo(Triple("Avenida del 4 Caminos", "", ""))
        // Sin artículo delante es el portal, aunque detrás vengan una palabra que no es de piso y otro número.
        for ((d, n) in listOf("Calle Mayor 5 Escala 2" to "5", "Carrer de Balmes 100 Entresol 2a" to "100",
            "Calle Velázquez 50 Despacho 3" to "50", "Calle Real 5 Bloq. 2 3ºB" to "5", "Calle de Alcalá 100 Exterior 3 Izda" to "100",
            "Av. Brasil 2000 Bloco 2 Apto 301" to "2000", "Rua Augusta 5 Lote 3" to "5", "Calle Real no 5 Bajo" to "5",
            // Y los de las tandas de antes, igual.
            "Calle Mayor 15 2 dcha" to "15", "Carrer de Sants 5 2n 1a" to "5", "Calle 2 3" to "3", "Calle Real 5 y 7" to "5",
            "Polígono de Sabón Parcela 10 Nave 4" to "10", "Calle Real 1 A Coruña" to "1", "Calle 2 de Mayo 14" to "14",
            "Estrada AC-173 12" to "12", "12 rue de Rivoli" to "12", "Calle de las 3 Cruces. 12" to "12", "Calle de las 3 Cruces/12" to "12")) {
            assertThat(Situar.numeroDe(d)).isEqualTo(n)
        }
        assertThat(Situar.calleDe("Calle Mayor 5 Escala 2")).isEqualTo("Calle Mayor")
        // Al elegir: la de su calle sin portal es la misma calle en el mismo sitio (3b) y D se queda con su 12.
        val d = "Calle de las 3 Cruces 12, 28013 Madrid"
        val calle = Sugerencia("Calle de las 3 Cruces, 28013 Madrid", "", "", 40.4150, -3.7050, precision = "calle", fuente = "servidor")
        assertThat(Situar.alElegir(d, calle)).isEqualTo(Situar.Elegida(d, "calle", "", ""))
        assertThat(Situar.alElegir(d, calle.copy(precision = "portal"))).isEqualTo(Situar.Elegida(d, "calle", "", ""))
        assertThat(Situar.ordenar(listOf(calle), emptyList(), emptyList(), emptyList(), buscado = d).single().otraCalle).isFalse()
        // «Calle Mayor 5 Escala 2»: el 5 de su calle es el mismo portal (3a); el 2, no (3b, D tal cual).
        val e = "Calle Mayor 5 Escala 2, 28013 Madrid"
        val cinco = Sugerencia("Calle Mayor 5, 28013 Madrid", "", "", 40.4154, -3.7096, precision = "portal", fuente = "servidor")
        assertThat(Situar.alElegir(e, cinco)).isEqualTo(Situar.Elegida("Calle Mayor 5, 28013 Madrid", "portal", "", ""))
        assertThat(Situar.alElegir(e, cinco.copy(direccion = "Calle Mayor 2, 28013 Madrid"))).isEqualTo(Situar.Elegida(e, "calle", "", ""))
    }

    @Test
    fun b2_un_sitio_escrito_que_no_es_pueblo_no_es_no_decir_nada() {
        // «Calle Uría 5, Asturias» se quedaba sin pueblos y pasaba por el caso sin CP ni pueblo: en segundo plano se
        // guardaba sola como el portal de «Calle Uría 5, 33201 Gijón» (12 de los 14 casos del revisor) y, al elegir, era el
        // mismo sitio (3b: D con el punto de Gijón).
        val coruna = Punto(43.3623, -8.4115)
        val bilbao = Punto(43.2630, -2.9350)
        val oviedo = Punto(43.3614, -5.8494)
        data class Caso(val d: String, val loc: String, val calle: String, val num: String, val cp: String, val suLoc: String,
                        val lat: Double, val lng: Double, val zona: Punto)
        for (c in listOf(
            // La provincia con el CP de otro municipio, solo en el texto (sin CP en el campo).
            Caso("Calle Real 5, 15179 A Coruña", "", "Calle Real", "5", "", "Culleredo", 43.2887, -8.3880, coruna),
            Caso("Calle Real 5, 15179 A Coruña", "", "Calle Real", "5", "", "Arteixo", 43.3046, -8.5098, coruna),
            Caso("Calle Real 5, 15179 A Coruña", "", "Calle Real", "5", "15142", "Arteixo", 43.3046, -8.5098, coruna),
            Caso("Calle Real 5, 15179 A Coruña", "A Coruña", "Calle Real", "5", "", "Ferrol", 43.4832, -8.2369, coruna),
            // Solo la comunidad, la provincia que no se llama como un pueblo o el país.
            Caso("Calle Real 5, Galicia", "", "Calle Real", "5", "15401", "Ferrol", 43.4832, -8.2369, coruna),
            Caso("Rúa Real 5, Galicia", "", "Rúa Real", "5", "15142", "Arteixo", 43.3046, -8.5098, coruna),
            Caso("Calle Real 5, España", "", "Calle Real", "5", "15142", "Arteixo", 43.3046, -8.5098, coruna),
            Caso("Calle Real 5", "Galicia", "Calle Real", "5", "15142", "Arteixo", 43.3046, -8.5098, coruna),
            Caso("Calle Mayor 5, Bizkaia", "", "Calle Mayor", "5", "48990", "Getxo", 43.3569, -3.0116, bilbao),
            Caso("Calle Mayor 5", "Bizkaia", "Calle Mayor", "5", "48990", "Getxo", 43.3569, -3.0116, bilbao),
            Caso("Kale Nagusia 5, Gipuzkoa", "", "Kale Nagusia", "5", "20800", "Zarautz", 43.2843, -2.1697, Punto(43.3183, -1.9812)),
            Caso("Calle Uría 5, Asturias", "", "Calle Uría", "5", "33201", "Gijón", 43.5357, -5.6615, oviedo),
            Caso("Calle Uría 5, Oviedo, Asturias", "", "Calle Uría", "5", "33201", "Gijón", 43.5357, -5.6615, oviedo),
            // «Torre del Mar» se lee como el piso y queda «Bizkaia» sola.
            Caso("ESTRADA GALERA Nº12, Torre del Mar, Bizkaia", "", "Estrada Galera", "12", "15142", "Arteixo", 43.3046, -8.5098, coruna))) {
            val r = ResultadoMovil(c.lat, c.lng, pais = "ES", calle = c.calle, numero = c.num, cp = c.cp, localidad = c.suLoc)
            assertThat(Situar.aceptar(r, "es", c.d, "", c.loc, listOf(c.zona))).isNull()
        }
        // Al elegir, «Otra calle»: queda la suya, nunca D con su punto.
        val gijon = Sugerencia("Calle Uría, 33201 Gijón", "", "", 43.5357, -5.6615, precision = "calle", fuente = "servidor")
        assertThat(Situar.mismoSitio("Calle Uría 5, Asturias", "", "", gijon.direccion)).isFalse()
        assertThat(Situar.ordenar(listOf(gijon), emptyList(), emptyList(), emptyList(), buscado = "Calle Uría 5, Asturias").single().otraCalle).isTrue()
        assertThat(Situar.alElegir("Calle Uría 5, Asturias", gijon)).isEqualTo(Situar.Elegida(gijon.direccion, "calle", "", ""))
        val galera = "ESTRADA GALERA Nº12B, Torre del Mar, Bizkaia"
        val arteixo = Sugerencia("Estrada Galera 12, 15142 Arteixo", "", "", 43.3046, -8.5098, precision = "portal", fuente = "servidor")
        assertThat(Situar.mismoSitio(galera, "", "", arteixo.direccion)).isFalse()
        assertThat(Situar.ordenar(listOf(arteixo), emptyList(), emptyList(), emptyList(), buscado = galera).single().otraCalle).isTrue()
        assertThat(Situar.alElegir(galera, arteixo).direccion).startsWith(arteixo.direccion)
        assertThat(Situar.mismoSitio("Calle Real 5", "", "Galicia", "Calle Real, 15142 Arteixo")).isFalse()
        assertThat(Situar.mismoSitio("Calle Real 5, España", "", "", "Calle Real, 27002 Lugo")).isFalse()
        // Sin ningún sitio escrito, como hasta ahora: el mismo sitio (3b) y, en segundo plano, por la distancia.
        val oleiros = Sugerencia("Rúa Real, 15179 Oleiros", "15179", "Oleiros", 43.3330, -8.3120, precision = "calle", fuente = "servidor")
        assertThat(Situar.mismoSitio("Rúa Real 5", "", "", oleiros.direccion, oleiros.cp, oleiros.localidad)).isTrue()
        assertThat(Situar.alElegir("Rúa Real 5", oleiros)).isEqualTo(Situar.Elegida("Rúa Real 5, 15179 Oleiros", "calle", "15179", "Oleiros"))
        assertThat(Situar.alElegir("Rúa Real 5, 2º B", oleiros)).isEqualTo(Situar.Elegida("Rúa Real 5, 2º B, 15179 Oleiros", "calle", "15179", "Oleiros"))
        val real = ResultadoMovil(43.3330, -8.3120, pais = "ES", calle = "Rúa Real", numero = "5", cp = "15179", localidad = "Oleiros")
        assertThat(Situar.aceptar(real, "es", "Rúa Real 5", "", "", listOf(coruna))).isEqualTo("portal")
        assertThat(Situar.aceptar(real, "es", "Rúa Real 5", "", "", listOf(oviedo))).isNull()
    }

    @Test
    fun p_todas_las_provincias_tambien_las_de_varias_palabras() {
        // Con unas 20 provincias, la de detrás del pueblo contaba como otro pueblo: «Calle Mayor 5, 30800 Lorca, Murcia»
        // pasaba por el mismo sitio que «Calle Mayor, 30001 Murcia», a 60 km (3b con el punto de Murcia).
        fun sitio(d: String, s: String) = Situar.mismoSitio(d, "", "", s)
        assertThat(sitio("Calle Mayor 5, 30800 Lorca, Murcia", "Calle Mayor, 30001 Murcia")).isFalse()
        assertThat(sitio("Calle Reina Victoria 5, 03201 Elche, Alicante", "Calle Reina Victoria, 03001 Alicante")).isFalse()
        assertThat(sitio("Calle Larga 5, 11403 Jerez de la Frontera, Cádiz", "Calle Larga, 11001 Cádiz")).isFalse()
        // La capital con su CP, o sin CP, sigue siendo la ciudad.
        assertThat(sitio("Calle Mayor 5, 30001 Murcia", "Calle Mayor, 30002 Murcia")).isTrue()
        assertThat(sitio("Calle Mayor 5, Murcia", "Calle Mayor, 30001 Murcia")).isTrue()
        val lorca = "Calle Mayor 5, 30800 Lorca, Murcia"
        val murcia = Sugerencia("Calle Mayor, 30001 Murcia", "", "", 37.9840, -1.1280, precision = "calle", fuente = "servidor")
        assertThat(Situar.ordenar(listOf(murcia), emptyList(), emptyList(), emptyList(), buscado = lorca).single().otraCalle).isTrue()
        assertThat(Situar.alElegir(lorca, murcia)).isEqualTo(Situar.Elegida(murcia.direccion, "calle", "", ""))
        // En segundo plano, con la base en Murcia, la de la capital tampoco vale para Lorca.
        val movil = ResultadoMovil(37.9840, -1.1280, pais = "ES", calle = "Calle Mayor", numero = "5", cp = "30001", localidad = "Murcia")
        assertThat(Situar.aceptar(movil, "es", lorca, "30800", "", listOf(Punto(37.9922, -1.1307)))).isNull()
        assertThat(Situar.aceptar(movil, "es", lorca, "", "", listOf(Punto(37.9922, -1.1307)))).isNull()
        // Las de varias palabras, enteras: detrás del pueblo se van, y solas no son un pueblo (ni un trozo suyo).
        assertThat(Situar.pueblosEscritos(lorca)).containsExactly("lorca")
        assertThat(Situar.pueblosEscritos("Calle Real 5, 24400 Ponferrada, Castilla y León")).containsExactly("ponferrada")
        assertThat(Situar.pueblosEscritos("Calle Real 5, Logroño La Rioja")).containsExactly("logrono")
        assertThat(Situar.pueblosEscritos("Calle Real 5, 35200 Telde, Las Palmas")).containsExactly("telde")
        assertThat(Situar.pueblosEscritos("Calle Real 5, 13500 Puertollano, Ciudad Real")).containsExactly("puertollano")
        assertThat(Situar.pueblosEscritos("Calle Real 5, 38400 Puerto de la Cruz, Santa Cruz de Tenerife")).containsExactly("puerto de la cruz")
        assertThat(Situar.pueblosEscritos("Calle Real 5, Ponferrada (Castilla y León)")).containsExactly("ponferrada")
        for (d in listOf("Calle Real 5, Castilla y León", "Calle Real 5, Región de Murcia", "Calle Real 5, Comunidad de Madrid",
            "Calle Real 5, Islas Baleares", "Calle Real 5, Principado de Asturias", "Calle Real 5, Catalunya, España")) {
            assertThat(Situar.pueblosEscritos(d)).isEmpty()
        }
        // La capital, con su CP o sin él, sí: también las de varias palabras.
        assertThat(Situar.pueblosEscritos("Calle Real 5, 13001 Ciudad Real")).containsExactly("ciudad real")
        assertThat(Situar.pueblosEscritos("Calle Real 5, 38001 Santa Cruz de Tenerife")).containsExactly("santa cruz de tenerife")
        assertThat(Situar.pueblosEscritos("Calle Real 5, 12001 Castellón de la Plana")).containsExactly("castellon de la plana")
        assertThat(Situar.pueblosEscritos("Calle Real 5, 30001", "Murcia")).containsExactly("murcia")
        assertThat(Situar.pueblosEscritos("Calle Real 5, 30800", "Murcia")).isEmpty()
    }

    @Test
    fun t_los_bordes_como_el_trim_de_la_web() {
        // El trim() de Kotlin quita también los de control U+001C-U+001F y el de la web no: «\u001CCalle Real 5\u001C»
        // daba aquí «Calle Real 5» y en la web lo escrito (los juegos del verificador, casos5_trim y dir5_trim). Desde C
        // (03-11-2026, la séptima tanda) son un espacio al leer, en las dos (c_los_de_control_son_un_espacio_como_en_la_web).
        assertThat(Situar.paraBuscar("\u001CCalle Real 5\u001C")).isEqualTo("Calle Real 5")
        assertThat(Situar.calleDe("\u001CCalle Real 5\u001C")).isEqualTo("Calle Real")
        assertThat(Situar.numeroDe("\u001CCalle Real 5\u001C")).isEqualTo("5")
        assertThat(Situar.paraBuscar("Calle Real 5 2 B\u001E")).isEqualTo("Calle Real 5")
        assertThat(Situar.calleDe("Calle Real\u001C 5")).isEqualTo("Calle Real")
        assertThat(Situar.calleDe("\u001F")).isEqualTo("")
        // Lo escrito tal cual (D al elegir) se sigue recortando como el trim() de la web, que los deja.
        val real = Sugerencia("Rúa Real, 15003 A Coruña", "", "", 43.3700, -8.4000, precision = "calle", fuente = "servidor")
        assertThat(Situar.alElegir("\u001CRúa Real 5, 15003 A Coruña\u001C", real))
            .isEqualTo(Situar.Elegida("\u001CRúa Real 5, 15003 A Coruña\u001C", "calle", "", ""))
        // Los espacios de verdad, fuera, como siempre.
        assertThat(Situar.paraBuscar("  Calle Real 5 \u00A0")).isEqualTo("Calle Real 5")
        assertThat(Situar.calleDe("\uFEFFRúa Real 5")).isEqualTo("Rúa Real")
    }

    // ── LA SÉPTIMA TANDA (03-11-2026 por la tarde): los mismos casos en la web (situar.spec.js) ──────────────────────

    @Test
    fun p2_x_de_provincia_es_un_pueblo_entero() {
        // Con P, «Alhama de Murcia» y «Alhama de Granada» (a 200 km) quedaban las dos en [alhama]: la sugerencia del otro
        // pueblo salía sin «Otra calle» y, sin zona ni base, el móvil en segundo plano la guardaba como el portal. Los 18
        // pares del revisor, con el CP y el pueblo en el texto, el pueblo solo o los dos en la ficha.
        val cps = mapOf("Alhama de Murcia" to "30840", "Alhama de Granada" to "18120", "Alhama de Almería" to "04400",
            "Alhama de Aragón" to "50230", "Priego de Córdoba" to "14800", "Priego" to "16800", "Villaviciosa de Córdoba" to "14300",
            "Villaviciosa" to "33300", "Beas de Granada" to "18184", "Beas" to "21630", "Burguillos de Toledo" to "45112",
            "Burguillos" to "41220", "Portillo de Toledo" to "45512", "Portillo" to "47160", "Solana de Ávila" to "05692",
            "La Solana" to "13240", "El Barco de Ávila" to "05600", "O Barco" to "32300", "Villafranca de Córdoba" to "14420",
            "Villafranca" to "31330", "Montalbán de Córdoba" to "14548", "Montalbán" to "44700", "Fuentes de Andalucía" to "41420",
            "Fuentes" to "16193", "Daroca de Rioja" to "26373", "Daroca" to "50360", "San Cristóbal de Segovia" to "40197",
            "San Cristóbal de La Laguna" to "38200", "Sant Joan d'Alacant" to "03550", "Sant Joan Despí" to "08970",
            "San Juan de Alicante" to "03550", "San Juan de Aznalfarache" to "41920", "Pozuelo de Aragón" to "50547", "Pozuelo" to "02520")
        val pares = listOf("Alhama de Murcia" to "Alhama de Granada", "Alhama de Murcia" to "Alhama de Almería",
            "Alhama de Granada" to "Alhama de Aragón", "Priego de Córdoba" to "Priego", "Villaviciosa de Córdoba" to "Villaviciosa",
            "Beas de Granada" to "Beas", "Burguillos de Toledo" to "Burguillos", "Portillo de Toledo" to "Portillo",
            "Solana de Ávila" to "La Solana", "El Barco de Ávila" to "O Barco", "Villafranca de Córdoba" to "Villafranca",
            "Montalbán de Córdoba" to "Montalbán", "Fuentes de Andalucía" to "Fuentes", "Daroca de Rioja" to "Daroca",
            "San Cristóbal de Segovia" to "San Cristóbal de La Laguna", "Sant Joan d'Alacant" to "Sant Joan Despí",
            "San Juan de Alicante" to "San Juan de Aznalfarache", "Pozuelo de Aragón" to "Pozuelo")
        for ((suyo, otro) in pares) {
            val cpD = cps.getValue(suyo)
            val cpS = cps.getValue(otro)
            for ((d, cp, loc) in listOf(Triple("Calle Real 5, $cpD $suyo", "", ""), Triple("Calle Real 5, $suyo", "", ""), Triple("Calle Real 5", cpD, suyo))) {
                for (s in listOf(Sugerencia("Calle Real, $cpS $otro", "", "", 40.0, -3.0, precision = "calle", fuente = "photon"),
                    Sugerencia("Calle Real 5", cpS, otro, 40.0, -3.0, precision = "portal", fuente = "servidor"))) {
                    assertThat(Situar.mismoSitio(d, cp, loc, s.direccion, s.cp, s.localidad)).isFalse()
                    val del = { f: String -> if (s.fuente == f) listOf(s) else emptyList() }
                    assertThat(Situar.ordenar(del("servidor"), emptyList(), emptyList(), del("photon"), buscado = d, cp = cp, localidad = loc)
                        .single().otraCalle).isTrue()
                    // Al elegir la de la calle sin el portal: la suya (4), nunca D con su punto (3b).
                    if (s.fuente == "photon") assertThat(Situar.alElegir(d, s, cp, loc).direccion).isEqualTo(s.direccion)
                }
                // En segundo plano, sin zona ni base: nunca el portal del otro pueblo.
                val r = ResultadoMovil(40.0, -3.0, pais = "ES", calle = "Calle Real", numero = "5", cp = cpS, localidad = otro)
                assertThat(Situar.aceptar(r, "es", d, cp, loc, emptyList())).isNull()
            }
        }
        // El pueblo, entero, también con la provincia detrás; y lo de la sexta, igual.
        assertThat(Situar.pueblosEscritos("Calle Real 5, 30840 Alhama de Murcia")).containsExactly("alhama de murcia")
        assertThat(Situar.pueblosEscritos("Calle Real 5, 30840 Alhama de Murcia, Murcia")).containsExactly("alhama de murcia")
        assertThat(Situar.pueblosEscritos("Calle Real 5, Villaviciosa de Córdoba")).containsExactly("villaviciosa de cordoba")
        assertThat(Situar.pueblosEscritos("Calle Real 5, 05600 El Barco de Ávila")).containsExactly("el barco de avila")
        assertThat(Situar.pueblosEscritos("Calle Real 5, 23170 La Guardia de Jaén")).containsExactly("la guardia de jaen")
        assertThat(Situar.pueblosEscritos("Calle Real 5, Sant Joan d'Alacant")).containsExactly("sant joan d alacant")
        assertThat(Situar.mismoSitio("Calle Mayor 5, 30800 Lorca, Murcia", "", "", "Calle Mayor, 30001 Murcia")).isFalse()
        assertThat(Situar.pueblosEscritos("Calle Real 5, 24400 Ponferrada, Castilla y León")).containsExactly("ponferrada")
        assertThat(Situar.pueblosEscritos("Calle Real 5, Región de Murcia")).isEmpty()
        assertThat(Situar.pueblosEscritos("Calle Real 5, Castilla y León")).isEmpty()
        // El mismo pueblo, con su CP o sin él, sigue siendo el mismo sitio.
        assertThat(Situar.mismoSitio("Calle Real 5, 30840 Alhama de Murcia", "", "", "Calle Real, 30840 Alhama de Murcia")).isTrue()
        assertThat(Situar.mismoSitio("Calle Real 5, Alhama de Murcia", "", "", "Calle Real, Alhama de Murcia")).isTrue()
        assertThat(Situar.mismoSitio("Calle Real 5", "30840", "Alhama de Murcia", "Calle Real, Alhama de Murcia")).isTrue()
    }

    @Test
    fun f4_no_y_las_letras_sueltas_no_son_articulos() {
        // Con F3, «No.» (la marca del número) y la letra del nombre («Juan Carlos I», «Calle A», «Virgen de la O») eran
        // artículos y se saltaba el único portal: la dirección se quedaba sin él (en 1100 y en 1335 se leía bien).
        for ((d, n) in listOf("Calle Hidalgo No. 25 Col. Centro" to "25", "Av. Juárez No. 100 Colonia Centro, 06000 Ciudad de México" to "100",
            "Calle 10 No. 5-20 Barrio Centro" to "5", "Calle Mayor No 5 Madrid" to "5", "Avenida Juan Carlos I 12 Urb. Los Pinos" to "12",
            "Avenida Juan Carlos I 12 Esquina Calle Real, 28013 Madrid" to "12", "Calle A 5 Polígono Industrial, 15008 A Coruña" to "5",
            "Calle A 12 Polígono Industrial Sabón, 15142 Arteixo" to "12", "Calle E 7 Polígono de Pocomaco, 15190 A Coruña" to "7",
            "Calle Virgen de la O 5 Sevilla" to "5", "Calle Real No. 5 Escala 2" to "5", "Avenida Juan Carlos I 12 Bloq. 2 3ºB" to "12",
            "Carrer de Jaume I 5 Entresol 2a" to "5", "Calle de la Paz No 153 Col. Roma, 2n 1a, 36202 Vigo" to "153",
            // Los de F3, igual.
            "Calle de las 3 Cruces 12" to "12", "Rúa de 4 Caminos 38" to "38", "Calle de las 13 Rosas 7" to "7",
            "Plaza de los 2 Caminos 4" to "4", "Calle de las 3 Cruces, 28013 Madrid" to "", "Calle Mayor 5 Escala 2" to "5",
            // Con un espacio de ancho cero dentro, «d\u200Be» sigue siendo «de» (dos de las 20000 de lectura).
            "Rúa d\u200Be 4 Caminos 38" to "38", "Calle d\u200Be 4 Caminos, Nº 3-14, 08901 L'Hospitalet de Llobregat" to "3")) {
            assertThat(Situar.numeroDe(d)).isEqualTo(n)
        }
        assertThat(Situar.calleDe("Calle Hidalgo No. 25 Col. Centro")).isEqualTo("Calle Hidalgo")
        assertThat(Situar.calleDe("Avenida Juan Carlos I 12 Urb. Los Pinos")).isEqualTo("Avenida Juan Carlos I")
        assertThat(Situar.portalDe("Avenida Juan Carlos I 12 Bloq. 2 3ºB")).isEqualTo("12")
        // Con su portal: otro número de su calle es la calle (3b, D tal cual), y el móvil en segundo plano da «portal».
        val d = "Calle A 12 Polígono Industrial Sabón, 15142 Arteixo"
        val catorce = Sugerencia("Calle A 14, 15142 Arteixo", "", "", 43.3046, -8.5098, precision = "portal", fuente = "servidor")
        assertThat(Situar.alElegir(d, catorce)).isEqualTo(Situar.Elegida(d, "calle", "", ""))
        val r = ResultadoMovil(43.3046, -8.5098, pais = "ES", calle = "Calle A", numero = "12", cp = "15142", localidad = "Arteixo")
        assertThat(Situar.aceptar(r, "es", d, "15142", "Arteixo", emptyList())).isEqualTo("portal")
    }

    @Test
    fun c_los_de_control_son_un_espacio_como_en_la_web() {
        // U+001C-U+001F: el isWhitespace de Kotlin los quitaba en conPiso y la web no; U+0085: para Java es un fin de
        // línea en «$» y en «.», y para el navegador no (264 y 264 diferencias en el juego del verificador). Ahora, al
        // leer, son un espacio (espacios), y conPiso recorta con recorta, como la web.
        for (raro in listOf("\u001C", "\u001D", "\u001E", "\u001F", "\u0085")) {
            assertThat(Situar.paraBuscar("Calle Mayor 5${raro}2 B")).isEqualTo("Calle Mayor 5")
            assertThat(Situar.numeroDe("Calle${raro}Mayor${raro}5${raro}2${raro}B")).isEqualTo("5")
            assertThat(Situar.paraBuscar("${raro}Calle Real 5$raro")).isEqualTo("Calle Real 5")
            assertThat(Situar.calleDe("${raro}Calle Real 5$raro")).isEqualTo("Calle Real")
            assertThat(Situar.paraBuscar("Calle Real 5 bajo$raro")).isEqualTo("Calle Real 5")
            assertThat(Situar.portalDe("Calle Real 25 B$raro")).isEqualTo("25B")
            assertThat(Situar.conPiso("Calle Mayor 5, 2º B$raro, 28013 Madrid", "Calle Mayor 5, 28013 Madrid")).isEqualTo("Calle Mayor 5, 28013 Madrid, 2º B")
            assertThat(Situar.conPiso("Avenida 18 de Julio 50 Local 2$raro, Gijón", "Rúa E 50, 48990 Getxo")).isEqualTo("Rúa E 50, 48990 Getxo, Local 2")
        }
        // Y al elegir, el piso sin ellos (antes «…, 2º B\u001C» aquí o en la web).
        val s = Sugerencia("Plaça de La Rioja 1230, 30840 Alhama de Murcia", "", "", 37.8517, -1.4251, precision = "portal", fuente = "photon")
        assertThat(Situar.alElegir("Plaça de Galicia # 1230 Zona Centro 2º B\u001C, 28220 Majadahonda (Madrid)", s).direccion)
            .isEqualTo("Plaça de La Rioja 1230, 30840 Alhama de Murcia, 2º B")
    }
}
