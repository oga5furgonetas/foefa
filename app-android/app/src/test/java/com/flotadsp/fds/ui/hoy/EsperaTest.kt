package com.flotadsp.fds.ui.hoy

import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Test

/** LAS ESPERAS DEL MÓVIL (02-11-2026, revisión A6 y A7): el tope de verdad para el geocodificador que bloquea (Android
 *  12 o menos: withTimeoutOrNull no cortaba) y una sola búsqueda por parada (pulsar «Navegar» mientras la pasada de
 *  fondo busca esa misma parada espera esa búsqueda). Sin Android. */
class EsperaTest {
    @Test
    fun el_tope_corta_aunque_la_llamada_no_vuelva() = runBlocking {
        val t0 = System.nanoTime()
        val r = GeoMovil.conTope(200) { Thread.sleep(3000); listOf("tarde") }
        val ms = (System.nanoTime() - t0) / 1_000_000
        assertThat(r).isNull()
        assertThat(ms).isLessThan(1500L)
        assertThat(GeoMovil.conTope(2000) { listOf("a tiempo") }).containsExactly("a tiempo")
        // Lo que falla (sin red, el Geocoder lanza IOException) es null, como sin respuesta.
        assertThat(GeoMovil.conTope<List<String>>(2000) { throw java.io.IOException("sin red") }).isNull()
    }

    @Test
    fun una_busqueda_por_parada_y_quien_llega_espera_esa() = runBlocking {
        val enVuelo = EnVuelo<String, Int>(this)
        var veces = 0
        val sigue = CompletableDeferred<Unit>()
        val fondo = async { enVuelo.una("p1") { veces += 1; sigue.await(); 7 } }
        yield()
        assertThat(enVuelo.claves).containsExactly("p1")
        // «Navegar» con la pasada de fondo buscando esa misma parada: espera esa, no empieza otra ni la da por perdida.
        val navegar = async { enVuelo.una("p1") { veces += 1; 8 } }
        yield()
        sigue.complete(Unit)
        assertThat(fondo.await()).isEqualTo(7)
        assertThat(navegar.await()).isEqualTo(7)
        assertThat(veces).isEqualTo(1)
        assertThat(enVuelo.claves).isEmpty()
        // Acabada, la siguiente vuelve a buscar; y otra parada, a la vez, va por su cuenta.
        assertThat(enVuelo.una("p1") { veces += 1; 9 }).isEqualTo(9)
        assertThat(enVuelo.una("p2") { veces += 1; 10 }).isEqualTo(10)
        assertThat(veces).isEqualTo(3)
    }
}
