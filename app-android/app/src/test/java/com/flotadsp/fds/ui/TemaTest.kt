package com.flotadsp.fds.ui

import androidx.compose.ui.graphics.Color
import com.google.common.truth.Truth.assertWithMessage
import org.junit.Test
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/** EL DISEÑO COMPACTO (06-11-2026, §7.2 de la especificación): cada pareja de colores de §3.5 y §3.6, medida con la
 *  fórmula WCAG sobre los valores de Paleta. Falla por debajo de 4,5:1 en el texto y de 3:1 en los bordes de control
 *  (y el de énfasis); la guía, con blanco, 5:1 o más. Sin pantalla: es puro cálculo. */
class TemaTest {
    private fun canal(v: Float): Double { val s = v.toDouble(); return if (s <= 0.03928) s / 12.92 else ((s + 0.055) / 1.055).pow(2.4) }
    private fun luminancia(c: Color) = 0.2126 * canal(c.red) + 0.7152 * canal(c.green) + 0.0722 * canal(c.blue)
    private fun contraste(a: Color, b: Color): Double { val l1 = luminancia(a); val l2 = luminancia(b); return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05) }

    /** El fondo, lo que va encima y el mínimo que pide la especificación. */
    private class Pareja(val nombre: String, val fondo: Color, val encima: Color, val minimo: Double = 4.5)

    private val p = Paleta

    private val deDia = listOf(
        Pareja("marca, relleno", p.cian, p.enMarca),
        Pareja("marca, texto sobre blanco", p.blanco, p.marcaTexto),
        Pareja("marca, texto sobre papel", p.papel, p.marcaTexto),
        Pareja("marca, tinte", p.marcaTinte, p.enMarcaTinte),
        Pareja("marca, suave", p.marcaSuave, p.enMarcaSuave),
        Pareja("ok, relleno", p.ok, p.blanco),
        Pareja("ok, texto sobre blanco", p.blanco, p.ok),
        Pareja("ok, texto sobre papel", p.papel, p.ok),
        Pareja("ok, tinte", p.okTinte, p.enOkTinte),
        Pareja("peligro, relleno", p.peligro, p.blanco),
        Pareja("peligro, texto sobre blanco", p.blanco, p.peligro),
        Pareja("peligro, texto sobre papel", p.papel, p.peligro),
        Pareja("peligro, tinte", p.peligroTinte, p.enPeligroTinte),
        Pareja("aviso", p.aviso, p.enAviso),
        Pareja("aviso, texto sobre blanco", p.blanco, p.enAviso),
        Pareja("zona", p.zona, p.enZona),
        Pareja("neutro, texto sobre blanco", p.blanco, p.tinta),
        Pareja("neutro, texto sobre papel", p.papel, p.tinta),
        Pareja("neutro, secundario sobre blanco", p.blanco, p.secundario),
        Pareja("neutro, secundario sobre papel", p.papel, p.secundario),
        Pareja("neutro, chip", p.chip, p.secundario),
        Pareja("inverso (el aviso flotante)", p.inverso, p.enInverso),
        Pareja("borde de control sobre blanco", p.blanco, p.borde, 3.0),
        Pareja("borde de control sobre papel", p.papel, p.borde, 3.0),
        Pareja("borde de énfasis sobre blanco", p.blanco, p.marcaTexto, 3.0),
    )

    private val deNoche = listOf(
        Pareja("marca, relleno", p.cianClaro, p.enMarcaNoche),
        Pareja("marca, texto sobre el fondo", p.fondoNoche, p.marcaTextoNoche),
        Pareja("marca, texto sobre la superficie", p.superficieNoche, p.marcaTextoNoche),
        Pareja("marca, tinte", p.marcaTinteNoche, p.enMarcaTinteNoche),
        Pareja("marca, suave", p.marcaSuaveNoche, p.enMarcaSuaveNoche),
        Pareja("ok, relleno", p.ok, p.blanco),
        Pareja("ok, texto sobre el fondo", p.fondoNoche, p.okTextoNoche),
        Pareja("ok, texto sobre la superficie", p.superficieNoche, p.okTextoNoche),
        Pareja("ok, tinte", p.okTinteNoche, p.enOkTinteNoche),
        Pareja("peligro, relleno", p.peligro, p.blanco),
        Pareja("peligro, texto sobre el fondo", p.fondoNoche, p.peligroTextoNoche),
        Pareja("peligro, texto sobre la superficie", p.superficieNoche, p.peligroTextoNoche),
        Pareja("aviso", p.avisoNoche, p.enAvisoNoche),
        Pareja("aviso, texto sobre el fondo", p.fondoNoche, p.enAvisoNoche),
        Pareja("zona", p.zonaNoche, p.enZonaNoche),
        Pareja("neutro, texto sobre el fondo", p.fondoNoche, p.textoNoche),
        Pareja("neutro, texto sobre la superficie", p.superficieNoche, p.textoNoche),
        Pareja("neutro, secundario sobre el fondo", p.fondoNoche, p.secundarioNoche),
        Pareja("neutro, secundario sobre la superficie", p.superficieNoche, p.secundarioNoche),
        Pareja("neutro, chip", p.chipNoche, p.secundarioNoche),
        Pareja("inverso (el aviso flotante)", p.textoNoche, p.superficieMediaNoche),
        Pareja("borde de control sobre el fondo", p.fondoNoche, p.bordeNoche, 3.0),
        Pareja("borde de control sobre la superficie", p.superficieNoche, p.bordeNoche, 3.0),
        Pareja("borde de énfasis sobre la superficie", p.superficieNoche, p.cianClaro, 3.0),
    )

    private val guiaYEscaner = listOf(
        Pareja("la banda de la guía", p.guia, p.blanco, 5.0),
        Pareja("la banda de la guía, aviso", p.guiaAviso, p.blanco, 5.0),
        Pareja("«Luego» de la guía", p.guiaLuego, p.blanco, 5.0),
        Pareja("la píldora de la guía", p.guiaPildora, p.blanco, 5.0),
        Pareja("el escáner, blanco", p.tinta, p.blanco),
        Pareja("el escáner, ok", p.tinta, p.escanerOk),
        Pareja("el escáner, aviso", p.tinta, p.escanerAviso),
        Pareja("el escáner, error", p.tinta, p.escanerError),
    )

    private fun comprueba(cuando: String, parejas: List<Pareja>) {
        for (q in parejas) {
            val c = contraste(q.fondo, q.encima)
            assertWithMessage("$cuando · ${q.nombre}: %.2f:1 (mínimo ${q.minimo}:1)".format(c)).that(c).isAtLeast(q.minimo)
        }
    }

    @Test
    fun de_dia_todo_se_lee_al_sol() = comprueba("de día", deDia)

    @Test
    fun de_noche_todo_se_lee() = comprueba("de noche", deNoche)

    @Test
    fun la_guia_y_el_escaner_se_leen_conduciendo() = comprueba("la guía y el escáner", guiaYEscaner)

    /** Las cifras que da la especificación, por si alguien cambia un color «un poco». */
    @Test
    fun las_cifras_son_las_de_la_especificacion() {
        val esperado = listOf(
            Triple("marca relleno de día", contraste(p.cian, p.enMarca), 8.3),
            Triple("marca texto de día", contraste(p.blanco, p.marcaTexto), 5.0),
            Triple("marca tinte de día", contraste(p.marcaTinte, p.enMarcaTinte), 9.9),
            Triple("ok relleno", contraste(p.ok, p.blanco), 5.5),
            Triple("peligro con blanco", contraste(p.peligro, p.blanco), 6.5),
            Triple("aviso de día", contraste(p.aviso, p.enAviso), 6.7),
            Triple("secundario de día", contraste(p.blanco, p.secundario), 7.4),
            Triple("chip de día", contraste(p.chip, p.secundario), 6.2),
            Triple("borde de control de día", contraste(p.blanco, p.borde), 3.4),
            Triple("marca relleno de noche", contraste(p.cianClaro, p.enMarcaNoche), 11.0),
            // De noche, la especificación mide el texto sobre la superficie (#11151C), no sobre el fondo.
            Triple("marca texto de noche", contraste(p.superficieNoche, p.marcaTextoNoche), 11.7),
            Triple("marca tinte de noche", contraste(p.marcaTinteNoche, p.enMarcaTinteNoche), 7.5),
            Triple("ok texto de noche", contraste(p.superficieNoche, p.okTextoNoche), 10.5),
            Triple("peligro texto de noche", contraste(p.superficieNoche, p.peligroTextoNoche), 10.7),
            Triple("aviso de noche", contraste(p.avisoNoche, p.enAvisoNoche), 9.8),
            Triple("secundario de noche", contraste(p.superficieNoche, p.secundarioNoche), 8.6),
            Triple("chip de noche", contraste(p.chipNoche, p.secundarioNoche), 7.4),
            Triple("borde de control de noche", contraste(p.superficieNoche, p.bordeNoche), 3.6),
        )
        for ((nombre, medido, cifra) in esperado) {
            assertWithMessage("$nombre: %.2f:1, la especificación dice $cifra:1".format(medido)).that(medido).isWithin(0.15).of(cifra)
        }
    }
}
