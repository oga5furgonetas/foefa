package com.flotadsp.fds.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* LOS COLORES DE FDS: el cian de la marca, el papel cálido de la app y la tinta. Con el tema oscuro del
   móvil, su versión de noche (o el que se elija en Ajustes). */
val Cian = Color(0xFF0FC2BC)
val CianClaro = Color(0xFF14E7D8)
val Tinta = Color(0xFF111114)
val Papel = Color(0xFFF7F6F3)

private val Claro = lightColorScheme(
    primary = Cian, onPrimary = Color(0xFF04161A),
    primaryContainer = Color(0xFFD3F5F2), onPrimaryContainer = Color(0xFF00413E),
    secondary = Color(0xFF0E7C77), onSecondary = Color.White,
    secondaryContainer = Color(0xFFE2F1EF), onSecondaryContainer = Color(0xFF0B3B39),
    tertiary = Color(0xFF16804A), onTertiary = Color.White,
    tertiaryContainer = Color(0xFFD4F2DF), onTertiaryContainer = Color(0xFF07391F),
    error = Color(0xFFB3261E), errorContainer = Color(0xFFF9DEDC), onErrorContainer = Color(0xFF410E0B),
    background = Papel, onBackground = Tinta,
    surface = Papel, onSurface = Tinta,
    surfaceVariant = Color(0xFFECEBE7), onSurfaceVariant = Color(0xFF55555E),
    surfaceContainerLowest = Color.White, surfaceContainerLow = Color(0xFFFCFBF9),
    surfaceContainer = Color(0xFFF1F0EC), surfaceContainerHigh = Color(0xFFEBEAE6), surfaceContainerHighest = Color(0xFFE4E3DF),
    outline = Color(0xFFC9C8C3), outlineVariant = Color(0xFFDFDED9),
    inverseSurface = Color(0xFF1F2024), inverseOnSurface = Color(0xFFF2F1EE), inversePrimary = CianClaro,
)

private val Oscuro = darkColorScheme(
    primary = CianClaro, onPrimary = Color(0xFF00201E),
    primaryContainer = Color(0xFF00504C), onPrimaryContainer = Color(0xFFB3F3EE),
    secondary = Color(0xFF7FD6CF), onSecondary = Color(0xFF00201E),
    secondaryContainer = Color(0xFF1C3533), onSecondaryContainer = Color(0xFFCCE8E5),
    tertiary = Color(0xFF6FD69B), onTertiary = Color(0xFF00391C),
    tertiaryContainer = Color(0xFF0F5130), onTertiaryContainer = Color(0xFFC2F0D3),
    background = Color(0xFF0B0E14), onBackground = Color(0xFFE6E8EC),
    surface = Color(0xFF0B0E14), onSurface = Color(0xFFE6E8EC),
    surfaceVariant = Color(0xFF1D232D), onSurfaceVariant = Color(0xFFAAB2BF),
    surfaceContainerLowest = Color(0xFF070A0F), surfaceContainerLow = Color(0xFF11151C),
    surfaceContainer = Color(0xFF151A22), surfaceContainerHigh = Color(0xFF1B2029), surfaceContainerHighest = Color(0xFF222833),
    outline = Color(0xFF3A4250), outlineVariant = Color(0xFF2A303B),
    inverseSurface = Color(0xFFE6E8EC), inverseOnSurface = Color(0xFF151A22), inversePrimary = Color(0xFF00807A),
)

/** Colores de estado que Material no trae: entregado (verde) y cobrar (ámbar). */
@Immutable
data class Extra(val entregado: Color, val enEntregado: Color, val cobrar: Color, val enCobrar: Color, val aviso: Color, val enAviso: Color)

val LocalExtra = staticCompositionLocalOf {
    Extra(Color(0xFF15803D), Color.White, Color(0xFFFFF1D6), Color(0xFF7A4A00), Color(0xFFE0F2FE), Color(0xFF075985))
}

private val Letra = Typography().run {
    copy(
        headlineMedium = headlineMedium.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp),
        headlineSmall = headlineSmall.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.3).sp),
        titleLarge = titleLarge.copy(fontWeight = FontWeight.Bold),
        titleMedium = titleMedium.copy(fontWeight = FontWeight.SemiBold, fontSize = 17.sp),
        bodyLarge = bodyLarge.copy(fontSize = 16.sp, lineHeight = 22.sp),
        bodyMedium = bodyMedium.copy(fontSize = 15.sp, lineHeight = 20.sp),
        labelLarge = labelLarge.copy(fontWeight = FontWeight.SemiBold, fontSize = 15.sp),
    )
}

private val Formas = Shapes(
    small = RoundedCornerShape(10.dp), medium = RoundedCornerShape(16.dp), large = RoundedCornerShape(22.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

@Composable
fun TemaFds(tema: String, contenido: @Composable () -> Unit) {
    val noche = when (tema) { "oscuro" -> true; "claro" -> false; else -> isSystemInDarkTheme() }
    val colores: ColorScheme = if (noche) Oscuro else Claro
    val extra = if (noche) Extra(Color(0xFF22A55A), Color.White, Color(0xFF3A2C10), Color(0xFFFFD58A), Color(0xFF0C2A3A), Color(0xFFBAE6FD))
    else Extra(Color(0xFF15803D), Color.White, Color(0xFFFFF1D6), Color(0xFF7A4A00), Color(0xFFE0F2FE), Color(0xFF075985))
    androidx.compose.runtime.CompositionLocalProvider(LocalExtra provides extra) {
        MaterialTheme(colorScheme = colores, typography = Letra, shapes = Formas, content = contenido)
    }
}

val TextoNumero = TextStyle(fontFeatureSettings = "tnum")

/** Los textos de la app están en español: fechas e importes también («domingo, 25 de octubre», «24,50 €»),
    aunque el móvil esté en otro idioma. */
val ESPANOL: java.util.Locale = java.util.Locale.forLanguageTag("es-ES")

/** Desde el 30-10-2026 la app habla el idioma del móvil (Idioma): las fechas y los números de las pantallas van con
 *  este; ESPANOL queda para lo que es de España (los euros de «invita y gana»). */
val LOCALE_APP: java.util.Locale get() = Idioma.locale

/** El patrón de una fecha escrito para el español («EEEE, d 'de' MMMM») en los demás idiomas: sin el «de» y, en
 *  alemán, con el punto del día («Freitag, 30. Oktober»). */
fun patronFecha(es: String): String = when (Idioma.actual) {
    "es" -> es
    "de" -> es.replace(" 'de' ", ". ")
    else -> es.replace(" 'de' ", " ")
}

/** El país de la ruta (llega con mi-ruta) y, con él, la moneda de lo que se cobra en la puerta, como en la web
 *  (frontend/src/lib/region.js): un repartidor de México cobra pesos, no euros. Es estado de Compose: cuando llega
 *  la ruta, los importes se vuelven a pintar en su moneda. */
object Region {
    var pais by mutableStateOf("es")
    private val MONEDAS = mapOf(
        "es" to "EUR", "mx" to "MXN", "ar" to "ARS", "co" to "COP", "cl" to "CLP", "pe" to "PEN", "ve" to "VES", "ec" to "USD",
        "bo" to "BOB", "py" to "PYG", "uy" to "UYU", "cr" to "CRC", "pa" to "USD", "gt" to "GTQ", "hn" to "HNL", "sv" to "USD",
        "ni" to "NIO", "do" to "DOP", "pr" to "USD", "cu" to "CUP", "br" to "BRL", "cn" to "CNY",
        "pt" to "EUR", "fr" to "EUR", "it" to "EUR", "de" to "EUR", "ie" to "EUR", "be" to "EUR", "nl" to "EUR", "at" to "EUR",
        "ad" to "EUR", "gb" to "GBP", "ch" to "CHF", "us" to "USD",
    )
    private val moneda: java.util.Currency
        get() = runCatching { java.util.Currency.getInstance(MONEDAS[pais] ?: "EUR") }.getOrElse { java.util.Currency.getInstance("EUR") }
    /** Los números como en el país (es-MX «$250.00», es-AR «$ 250,00»); Brasil, en portugués. */
    private val locale: java.util.Locale
        get() = when (pais) { "es" -> ESPANOL; "br" -> java.util.Locale.forLanguageTag("pt-BR"); else -> java.util.Locale.forLanguageTag("es-${pais.uppercase()}") }

    fun importe(v: Double): String = java.text.NumberFormat.getCurrencyInstance(locale).apply { currency = moneda }.format(v)
    val simbolo: String get() = moneda.getSymbol(locale)

    /** Millas en EE. UU. y Reino Unido (y Liberia y Birmania), km en el resto: como el servidor (`unidades` en
     *  mi-ruta) y la web (30-10-2026). Los km se guardan siempre en km; solo cambia lo que se enseña y se escribe. */
    val unidades: String get() = if (pais in setOf("us", "gb", "lr", "mm")) "mi" else "km"
    const val KM_POR_MILLA = 1.609344
    /** «3,1 km» o «1.9 mi», con los números del idioma de la app. */
    fun distancia(km: Double, decimales: Int = 1): String {
        val millas = unidades == "mi"
        val f = java.text.NumberFormat.getNumberInstance(Idioma.locale).apply { maximumFractionDigits = decimales; minimumFractionDigits = 0 }
        return "${f.format(if (millas) km / KM_POR_MILLA else km)} ${if (millas) "mi" else "km"}"
    }

    /** Cómo puede pagar el cliente en la puerta: Bizum solo existe en España y Pix en Brasil (como la web). */
    val metodosCobro: List<Pair<String, String>>
        get() = listOf("efectivo" to "Efectivo", "tarjeta" to "Tarjeta") +
            (when (pais) { "es" -> listOf("bizum" to "Bizum"); "br" -> listOf("pix" to "Pix"); else -> emptyList() }) +
            listOf("transferencia" to "Transferencia")
}
