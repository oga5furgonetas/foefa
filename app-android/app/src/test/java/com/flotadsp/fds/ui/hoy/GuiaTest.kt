package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.Guia
import com.flotadsp.fds.data.ManiobraGuia
import com.flotadsp.fds.data.PasoGuia
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/** La guía dentro de la app (01-11-2026): las cuentas y el motor, sin Android. Mismas reglas que la web (guia.js). */
class GuiaTest {
    private val a = Punto(43.0, -8.0)

    private fun paso(tipo: String, mod: String? = null, salida: Int? = null, calle: String = "", icono: String = "recto", punto: Punto? = null, texto: String = "") =
        PasoGuia(texto = texto, icono = icono, punto = punto?.let { listOf(it.lat, it.lng) } ?: emptyList(), calle = calle,
            maniobra = ManiobraGuia(tipo = tipo, mod = mod, salida = salida))

    @Test
    fun metros_y_rumbo_con_valores_conocidos() {
        // Un centésimo de grado de latitud son 1.112 m en cualquier sitio; de longitud, a 43°, unos 814 m.
        assertThat(Navegador.metrosEntre(a, Punto(43.01, -8.0))).isWithin(2.0).of(1112.0)
        assertThat(Navegador.metrosEntre(a, Punto(43.0, -7.99))).isWithin(3.0).of(814.0)
        assertThat(Navegador.metrosEntre(a, a)).isEqualTo(0.0)
        assertThat(Navegador.rumbo(a, Punto(43.01, -8.0))).isWithin(0.01).of(0.0)
        assertThat(Navegador.rumbo(a, Punto(43.0, -7.99))).isWithin(0.1).of(90.0)
        assertThat(Navegador.rumbo(a, Punto(42.99, -8.0))).isWithin(0.01).of(180.0)
        assertThat(Navegador.rumbo(a, Punto(43.0, -8.01))).isWithin(0.1).of(270.0)
    }

    @Test
    fun proyectar_sobre_una_linea_de_tres_vertices() {
        // Una «L»: 814 m hacia el este y luego 1.112 m hacia el norte.
        val prep = Navegador.prepararLinea(listOf(a, Punto(43.0, -7.99), Punto(43.01, -7.99)))
        assertThat(prep.total).isWithin(5.0).of(1926.0)
        // A mitad del primer tramo, sobre la línea.
        val dentro = Navegador.proyectar(prep, Punto(43.0, -7.995))
        assertThat(dentro.hecho).isWithin(5.0).of(407.0)
        assertThat(dentro.fuera).isWithin(1.0).of(0.0)
        // A 111 m al norte de ese mismo sitio: fuera de la línea, pero lo recorrido es lo mismo.
        val fuera = Navegador.proyectar(prep, Punto(43.001, -7.995))
        assertThat(fuera.hecho).isWithin(5.0).of(407.0)
        assertThat(fuera.fuera).isWithin(2.0).of(110.5)
        // Antes del principio y después del final: se queda en los extremos.
        assertThat(Navegador.proyectar(prep, Punto(43.0, -8.01)).hecho).isEqualTo(0.0)
        val pasado = Navegador.proyectar(prep, Punto(43.02, -7.99))
        assertThat(pasado.hecho).isWithin(0.01).of(prep.total)
        assertThat(pasado.fuera).isWithin(5.0).of(1105.0)
        // Sin línea, o con un solo punto.
        assertThat(Navegador.proyectar(Navegador.prepararLinea(emptyList()), a).fuera).isEqualTo(Double.POSITIVE_INFINITY)
        assertThat(Navegador.proyectar(Navegador.prepararLinea(listOf(a)), Punto(43.01, -8.0)).fuera).isWithin(2.0).of(1112.0)
    }

    @Test
    fun el_proximo_paso_tiene_8_metros_de_margen_y_la_salida_no_cuenta() {
        val pasos = listOf(0.0, 100.0, 300.0, 500.0).map { PasoSituado(paso("turn"), it) }
        assertThat(Navegador.proximoPaso(pasos, 0.0)).isEqualTo(1)      // la salida (0) no cuenta
        assertThat(Navegador.proximoPaso(pasos, 50.0)).isEqualTo(1)
        assertThat(Navegador.proximoPaso(pasos, 91.0)).isEqualTo(1)     // 100 > 91 + 8
        assertThat(Navegador.proximoPaso(pasos, 92.0)).isEqualTo(2)     // 100 > 100 no: ya está hecha
        assertThat(Navegador.proximoPaso(pasos, 600.0)).isEqualTo(3)    // pasado todo: el último
        assertThat(Navegador.proximoPaso(listOf(PasoSituado(paso("hacia_parada"), 50.0)), 0.0)).isEqualTo(0)
        assertThat(Navegador.proximoPaso(emptyList(), 0.0)).isEqualTo(-1)
    }

    @Test
    fun la_distancia_escrita_y_hablada() {
        assertThat(Navegador.textoDistancia(4.0)).isEqualTo("10 m")
        assertThat(Navegador.textoDistancia(123.0)).isEqualTo("120 m")
        assertThat(Navegador.textoDistancia(1234.0)).isEqualTo("1,2 km")
        assertThat(Navegador.textoDistancia(null)).isEqualTo("")
        assertThat(Navegador.distanciaHablada(4.0)).isEqualTo("10 metros")
        assertThat(Navegador.distanciaHablada(296.0)).isEqualTo("300 metros")
        assertThat(Navegador.distanciaHablada(1049.0)).isEqualTo("1 kilómetro")
        assertThat(Navegador.distanciaHablada(1234.0)).isEqualTo("1,2 kilómetros")
        assertThat(Navegador.distanciaHablada(2000.0)).isEqualTo("2 kilómetros")
    }

    @Test
    fun la_frase_de_cada_maniobra() {
        assertThat(Navegador.textoPaso(paso("roundabout", salida = 2, calle = "Rúa Real"))).isEqualTo("En la rotonda, toma la segunda salida por Rúa Real")
        assertThat(Navegador.textoPaso(paso("rotary"))).isEqualTo("Entra en la rotonda")
        assertThat(Navegador.textoPaso(paso("turn", mod = "right", calle = "Rúa Real"))).isEqualTo("Gira a la derecha por Rúa Real")
        assertThat(Navegador.textoPaso(paso("turn", mod = "sharp left"))).isEqualTo("Gira cerrado a la izquierda")
        assertThat(Navegador.textoPaso(paso("depart", calle = "Rúa Real"))).isEqualTo("Sal por Rúa Real")
        assertThat(Navegador.textoPaso(paso("depart"))).isEqualTo("Empieza la ruta")
        assertThat(Navegador.textoPaso(paso("arrive", calle = "Rúa Real"))).isEqualTo("Has llegado")
        assertThat(Navegador.textoPaso(paso("fork", mod = "slight left"))).isEqualTo("En la bifurcación, mantente a la izquierda")
        assertThat(Navegador.textoPaso(paso("fork", mod = "slight right", calle = "AC-12"))).isEqualTo("En la bifurcación, mantente a la derecha por AC-12")
        assertThat(Navegador.textoPaso(paso("end of road", mod = "left"))).isEqualTo("Al final de la calle, gira a la izquierda")
        assertThat(Navegador.textoPaso(paso("roundabout turn", mod = "right"))).isEqualTo("En la rotonda, gira a la derecha")
        assertThat(Navegador.textoPaso(paso("continue"))).isEqualTo("Sigue recto")
        assertThat(Navegador.textoPaso(paso("new name", mod = "slight right"))).isEqualTo("Ligeramente a la derecha")
        assertThat(Navegador.textoPaso(paso("merge", calle = "AP-9"))).isEqualTo("Incorpórate por AP-9")
        assertThat(Navegador.textoPaso(paso("hacia_parada"))).isEqualTo("Ve hacia la parada")
        // Sin maniobra (respuestas guardadas de antes): la frase del servidor.
        assertThat(Navegador.textoPaso(PasoGuia(texto = "Gira a la derecha"))).isEqualTo("Gira a la derecha")
        assertThat(Navegador.textoPaso(null)).isEqualTo("")
    }

    @Test
    fun el_rumbo_sale_del_gps_en_marcha_y_de_los_puntos_parado() {
        val r = RumboGps()
        assertThat(r.nueva(a, 90.0, 5.0)).isWithin(0.01).of(90.0)
        assertThat(r.nueva(Punto(43.00001, -8.0), 45.0, 0.0)).isWithin(0.01).of(90.0)   // 1 m: no cambia nada
        assertThat(r.nueva(Punto(43.0001, -8.0), 45.0, 0.3)).isWithin(0.1).of(0.0)       // 11 m al norte, despacio
        assertThat(RumboGps().nueva(a, null, 0.0)).isNull()
    }

    /* El motor: una calle recta de 2.224 m hacia el norte con un giro a la derecha a mitad. */
    private val destino = Punto(43.02, -8.0)
    private val guia = Guia(fuente = "carreteras", linea = listOf(listOf(43.0, -8.0), listOf(43.02, -8.0)), metros = 2224, minutos = 10.0,
        pasos = listOf(paso("depart", punto = a, calle = "Rúa Real"), paso("turn", mod = "right", punto = Punto(43.01, -8.0), icono = "derecha"),
            paso("arrive", punto = destino, icono = "llegada")))

    private fun motor(reloj: () -> Long = { 0L }) = MotorGuia(reloj).apply { pedida(); cargar("p1", guia) }

    @Test
    fun anuncia_cada_maniobra_una_vez_de_lejos_y_otra_de_cerca() {
        val m = motor()
        assertThat(m.posicion(a, "p1", destino)).isEqualTo(Decision.Nada)                           // a 1,1 km: nada aún
        assertThat(m.posicion(Punto(43.0073, -8.0), "p1", destino)).isEqualTo(Decision.Anunciar("En 300 metros, gira a la derecha."))
        assertThat(m.posicion(Punto(43.0074, -8.0), "p1", destino)).isEqualTo(Decision.Nada)       // no se repite
        assertThat(m.posicion(Punto(43.0097, -8.0), "p1", destino)).isEqualTo(Decision.Anunciar("Gira a la derecha."))
        assertThat(m.posicion(Punto(43.0098, -8.0), "p1", destino)).isEqualTo(Decision.Nada)
        // Pasado el giro, la próxima es la llegada: no se anuncia.
        assertThat(m.posicion(Punto(43.015, -8.0), "p1", destino)).isEqualTo(Decision.Nada)
        // Y lo que se pinta: el giro, lo que falta y lo que queda (minutos proporcionales).
        val v = m.vista("p1", Punto(43.0073, -8.0))!!
        assertThat(v.paso!!.paso.icono).isEqualTo("derecha")
        assertThat(v.luego!!.paso.icono).isEqualTo("llegada")
        assertThat(v.falta!!).isWithin(2.0).of(300.0)
        assertThat(v.restante).isWithin(2.0).of(1412.0)
        assertThat(v.minutos!!).isWithin(0.05).of(6.35)
        assertThat(m.vista("otra", a)).isNull()
    }

    @Test
    fun ha_llegado_a_menos_de_40_metros_y_solo_lo_dice_una_vez() {
        val m = motor()
        assertThat(m.posicion(Punto(43.0199, -8.0), "p1", destino)).isEqualTo(Decision.Llegado)
        assertThat(m.llegado).isEqualTo("p1")
        assertThat(m.posicion(Punto(43.0199, -8.0), "p1", destino)).isEqualTo(Decision.Nada)
        // Otra parada: se vuelve a empezar.
        assertThat(m.posicion(a, "p2", destino)).isEqualTo(Decision.Nada)
        assertThat(m.tocaPedir("p2", fallida = false)).isTrue()
    }

    @Test
    fun recalcula_solo_tras_tres_posiciones_fuera_y_15_segundos() {
        var ahora = 0L
        val m = motor { ahora }
        val fuera = Punto(43.005, -8.002)   // a 160 m de la línea
        ahora = 10_000
        assertThat(m.posicion(fuera, "p1", destino)).isEqualTo(Decision.Nada)
        assertThat(m.posicion(fuera, "p1", destino)).isEqualTo(Decision.Nada)
        assertThat(m.posicion(fuera, "p1", destino)).isEqualTo(Decision.Nada)   // tres fuera, pero solo han pasado 10 s
        ahora = 16_000
        assertThat(m.posicion(fuera, "p1", destino)).isEqualTo(Decision.Recalcular)
        // Pedida la nueva ruta, no se vuelve a pedir mientras llega.
        m.pedida()
        assertThat(m.posicion(fuera, "p1", destino)).isEqualTo(Decision.Nada)
        // Volver a la línea pone el contador a cero: hacen falta otras tres.
        m.cargar("p1", guia)
        ahora = 40_000
        assertThat(m.posicion(Punto(43.003, -8.0), "p1", destino)).isEqualTo(Decision.Nada)
        assertThat(m.posicion(fuera, "p1", destino)).isEqualTo(Decision.Nada)
        assertThat(m.posicion(fuera, "p1", destino)).isEqualTo(Decision.Nada)
        assertThat(m.posicion(fuera, "p1", destino)).isEqualTo(Decision.Recalcular)
    }

    @Test
    fun en_linea_recta_no_se_recalcula_nunca() {
        var ahora = 0L
        val m = MotorGuia { ahora }
        m.pedida()
        m.cargar("p1", Guia(fuente = "linea_recta", linea = listOf(listOf(43.0, -8.0), listOf(43.02, -8.0)), metros = 2224,
            pasos = listOf(paso("hacia_parada", punto = destino, texto = "Ve hacia la parada"))))
        ahora = 60_000
        val fuera = Punto(43.005, -8.002)
        repeat(4) { assertThat(m.posicion(fuera, "p1", destino)).isEqualTo(Decision.Nada) }
        assertThat(m.posicion(Punto(43.0199, -8.0), "p1", destino)).isEqualTo(Decision.Llegado)
    }

    @Test
    fun cuando_toca_pedir_la_ruta() {
        var ahora = 0L
        val m = MotorGuia { ahora }
        assertThat(m.tocaPedir("p1", fallida = false)).isTrue()
        m.pedida()
        assertThat(m.tocaPedir("p1", fallida = false)).isFalse()       // ya se está pidiendo
        m.fallida()
        ahora = 5_000
        assertThat(m.tocaPedir("p1", fallida = true)).isFalse()        // tras un fallo, se espera 15 s
        ahora = 15_000
        assertThat(m.tocaPedir("p1", fallida = true)).isTrue()
        m.pedida(); m.cargar("p1", guia)
        assertThat(m.tocaPedir("p1", fallida = false)).isFalse()       // esta ya está
        assertThat(m.tocaPedir("p2", fallida = false)).isTrue()        // la siguiente parada, sí
    }

    @Test
    fun las_frases_de_salida_y_de_llegada() {
        assertThat(Navegador.fraseVamos("Farmacia Sol", 1234)).isEqualTo("Vamos a Farmacia Sol. 1,2 kilómetros.")
        assertThat(Navegador.fraseLlegado("Farmacia Sol", "Detrás · izq")).isEqualTo("Has llegado a Farmacia Sol. Va detrás, a la izquierda.")
        assertThat(Navegador.fraseLlegado("la parada", "")).isEqualTo("Has llegado a la parada.")
    }
}
