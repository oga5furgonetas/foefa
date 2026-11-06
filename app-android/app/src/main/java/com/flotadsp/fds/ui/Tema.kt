// diseño compacto
package com.flotadsp.fds.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* LOS COLORES DE FDS: el cian de la marca, el papel cálido de la app y la tinta. Con el tema oscuro del
   móvil, su versión de noche (o el que se elija en Ajustes). */
val Cian = Paleta.cian
val CianClaro = Paleta.cianClaro
val Tinta = Paleta.tinta
val Papel = Paleta.papel

/** EL DISEÑO COMPACTO (06-11-2026): todos los colores de la app, medidos (§3.5 y §3.6 de la especificación). De aquí
 *  salen Claro, Oscuro y Extra, y TemaTest mide cada pareja con la fórmula WCAG: nada por debajo de 4,5:1 en el texto
 *  ni de 3:1 en los bordes de control. Un color nuevo se pone aquí y en ningún otro sitio. */
internal object Paleta {
    // La marca y el papel.
    val cian = Color(0xFF0FC2BC)
    val cianClaro = Color(0xFF14E7D8)
    val tinta = Color(0xFF111114)
    val papel = Color(0xFFF7F6F3)
    val blanco = Color.White

    // De día: marca.
    val enMarca = Color(0xFF04161A)              // texto sobre el relleno de marca (8,3:1)
    val marcaTexto = Color(0xFF0E7C77)           // el acento en texto y el borde de énfasis (5,0:1 sobre blanco)
    val marcaTinte = Color(0xFFD3F5F2)
    val enMarcaTinte = Color(0xFF00413E)         // 9,9:1
    val marcaSuave = Color(0xFFE2F1EF)           // secondaryContainer
    val enMarcaSuave = Color(0xFF0B3B39)
    // De día: ok (verde), peligro (rojo), aviso (ámbar) y zona (morado, solo capas del mapa).
    val ok = Color(0xFF047857)                   // relleno con blanco (5,5:1) y texto
    val okTinte = Color(0xFFD4F2DF)              // tertiaryContainer
    val enOkTinte = Color(0xFF07391F)
    val peligro = Color(0xFFB3261E)              // texto y relleno (con blanco, 6,5:1)
    val peligroTinte = Color(0xFFF9DEDC)         // errorContainer
    val enPeligroTinte = Color(0xFF410E0B)
    val aviso = Color(0xFFFFF1D6)
    val enAviso = Color(0xFF7A4A00)              // 6,7:1
    val zona = Color(0xFFEDE9FE)
    val enZona = Color(0xFF6D28D9)
    // De día: neutros, superficies y bordes.
    val secundario = Color(0xFF55555E)           // 7,4:1 sobre blanco
    val chip = Color(0xFFECEBE7)                 // con secundario, 6,2:1
    val superficie = blanco                      // tarjetas, lista y hojas (surfaceContainerLow)
    val superficieMedia = Color(0xFFF1F0EC)
    val superficieAlta = Color(0xFFEBEAE6)
    val superficieMasAlta = Color(0xFFE4E3DF)
    val separador = Color(0xFFDFDED9)
    val borde = Color(0xFF8C8B86)                // borde de control, 3,4:1 (antes #C9C8C3, 1,7:1)
    val inverso = Color(0xFF1F2024)
    val enInverso = Color(0xFFF2F1EE)

    // De noche: marca.
    val enMarcaNoche = Color(0xFF00201E)         // 11,0:1 sobre el cian claro
    val marcaTextoNoche = Color(0xFF5FE3D8)      // 11,7:1
    val marcaTinteNoche = Color(0xFF00504C)
    val enMarcaTinteNoche = Color(0xFFB3F3EE)    // 7,5:1
    val marcaSuaveNoche = Color(0xFF1C3533)
    val enMarcaSuaveNoche = Color(0xFFCCE8E5)
    val inversoPrimarioNoche = Color(0xFF00807A)
    // De noche: ok, peligro, aviso y zona.
    val okTextoNoche = Color(0xFF4ADE80)         // 10,5:1
    val okSuaveNoche = Color(0xFF6FD69B)         // tertiary
    val enOkSuaveNoche = Color(0xFF00391C)
    val okTinteNoche = Color(0xFF0F5130)
    val enOkTinteNoche = Color(0xFFC2F0D3)
    val peligroTextoNoche = Color(0xFFF2B8B5)    // el error de Material de noche, 10,7:1
    val avisoNoche = Color(0xFF3A2C10)
    val enAvisoNoche = Color(0xFFFFD58A)         // 9,8:1
    val zonaNoche = Color(0xFF2E1F4D)
    val enZonaNoche = Color(0xFFC4B5FD)
    // De noche: neutros, superficies y bordes.
    val textoNoche = Color(0xFFE6E8EC)
    val secundarioNoche = Color(0xFFAAB2BF)      // 8,6:1
    val chipNoche = Color(0xFF1D232D)            // con secundarioNoche, 7,4:1
    val fondoNoche = Color(0xFF0B0E14)
    val superficieNoche = Color(0xFF11151C)      // más clara que el fondo
    val superficieMediaNoche = Color(0xFF151A22)
    val superficieAltaNoche = Color(0xFF1B2029)
    val superficieMasAltaNoche = Color(0xFF222833)
    val superficieBajaNoche = Color(0xFF070A0F)  // surfaceContainerLowest: ya no la usa ninguna tarjeta
    val separadorNoche = Color(0xFF2A303B)
    val bordeNoche = Color(0xFF64707F)           // 3,6:1 (antes #3A4250, 1,8:1)

    // La guía y el escáner, iguales de día y de noche (todos con blanco, 5:1 o más).
    val guia = ok
    val guiaAviso = Color(0xFFB45309)
    val guiaLuego = Color(0xFF064E3B)
    val guiaPildora = Color(0xFF9A3412)
    val escaner = Color(0xEE111114)
    val escanerOk = Color(0xFF6EE7B7)
    val escanerAviso = Color(0xFFFCD34D)
    val escanerError = Color(0xFFFCA5A5)
}

private val Claro = lightColorScheme(
    primary = Paleta.cian, onPrimary = Paleta.enMarca,
    primaryContainer = Paleta.marcaTinte, onPrimaryContainer = Paleta.enMarcaTinte,
    secondary = Paleta.marcaTexto, onSecondary = Paleta.blanco,
    secondaryContainer = Paleta.marcaSuave, onSecondaryContainer = Paleta.enMarcaSuave,
    tertiary = Paleta.ok, onTertiary = Paleta.blanco,
    tertiaryContainer = Paleta.okTinte, onTertiaryContainer = Paleta.enOkTinte,
    error = Paleta.peligro, errorContainer = Paleta.peligroTinte, onErrorContainer = Paleta.enPeligroTinte,
    background = Paleta.papel, onBackground = Paleta.tinta,
    surface = Paleta.papel, onSurface = Paleta.tinta,
    surfaceVariant = Paleta.chip, onSurfaceVariant = Paleta.secundario,
    surfaceContainerLowest = Paleta.blanco, surfaceContainerLow = Paleta.superficie,
    surfaceContainer = Paleta.superficieMedia, surfaceContainerHigh = Paleta.superficieAlta, surfaceContainerHighest = Paleta.superficieMasAlta,
    outline = Paleta.borde, outlineVariant = Paleta.separador,
    inverseSurface = Paleta.inverso, inverseOnSurface = Paleta.enInverso, inversePrimary = Paleta.cianClaro,
)

private val Oscuro = darkColorScheme(
    primary = Paleta.cianClaro, onPrimary = Paleta.enMarcaNoche,
    primaryContainer = Paleta.marcaTinteNoche, onPrimaryContainer = Paleta.enMarcaTinteNoche,
    secondary = Paleta.marcaTextoNoche, onSecondary = Paleta.enMarcaNoche,
    secondaryContainer = Paleta.marcaSuaveNoche, onSecondaryContainer = Paleta.enMarcaSuaveNoche,
    tertiary = Paleta.okSuaveNoche, onTertiary = Paleta.enOkSuaveNoche,
    tertiaryContainer = Paleta.okTinteNoche, onTertiaryContainer = Paleta.enOkTinteNoche,
    background = Paleta.fondoNoche, onBackground = Paleta.textoNoche,
    surface = Paleta.fondoNoche, onSurface = Paleta.textoNoche,
    surfaceVariant = Paleta.chipNoche, onSurfaceVariant = Paleta.secundarioNoche,
    surfaceContainerLowest = Paleta.superficieBajaNoche, surfaceContainerLow = Paleta.superficieNoche,
    surfaceContainer = Paleta.superficieMediaNoche, surfaceContainerHigh = Paleta.superficieAltaNoche, surfaceContainerHighest = Paleta.superficieMasAltaNoche,
    outline = Paleta.bordeNoche, outlineVariant = Paleta.separadorNoche,
    inverseSurface = Paleta.textoNoche, inverseOnSurface = Paleta.superficieMediaNoche, inversePrimary = Paleta.inversoPrimarioNoche,
)

/** Colores de estado que Material no trae (06-11-2026, §3.6): entregado (verde), cobrar y aviso (ámbar), peligro
 *  (rojo con letra blanca, solo para confirmar), zona (morado, solo capas del mapa), la banda y las píldoras de la
 *  guía, la barra del escáner y el borde de énfasis (la tarjeta de la siguiente). `aviso` es el mismo ámbar que
 *  `cobrar`: fuera el azul cielo. */
@Immutable
data class Extra(
    val entregado: Color, val enEntregado: Color,
    /** «Entregado · 11:02» y lo demás escrito en verde: 4,5:1 o más sobre la superficie. */
    val entregadoTexto: Color,
    val cobrar: Color, val enCobrar: Color,
    val aviso: Color, val enAviso: Color,
    val peligro: Color, val enPeligro: Color,
    val zona: Color, val enZona: Color,
    val guia: Color, val guiaAviso: Color, val guiaLuego: Color, val guiaPildora: Color,
    val escaner: Color, val escanerOk: Color, val escanerAviso: Color, val escanerError: Color,
    /** El borde de 2 de la tarjeta de la siguiente: el cian da 2,2:1 sobre blanco de día. */
    val enfasis: Color,
)

private val ExtraClaro = Extra(
    entregado = Paleta.ok, enEntregado = Paleta.blanco, entregadoTexto = Paleta.ok,
    cobrar = Paleta.aviso, enCobrar = Paleta.enAviso, aviso = Paleta.aviso, enAviso = Paleta.enAviso,
    peligro = Paleta.peligro, enPeligro = Paleta.blanco, zona = Paleta.zona, enZona = Paleta.enZona,
    guia = Paleta.guia, guiaAviso = Paleta.guiaAviso, guiaLuego = Paleta.guiaLuego, guiaPildora = Paleta.guiaPildora,
    escaner = Paleta.escaner, escanerOk = Paleta.escanerOk, escanerAviso = Paleta.escanerAviso, escanerError = Paleta.escanerError,
    enfasis = Paleta.marcaTexto,
)

private val ExtraOscuro = ExtraClaro.copy(
    entregadoTexto = Paleta.okTextoNoche,
    cobrar = Paleta.avisoNoche, enCobrar = Paleta.enAvisoNoche, aviso = Paleta.avisoNoche, enAviso = Paleta.enAvisoNoche,
    zona = Paleta.zonaNoche, enZona = Paleta.enZonaNoche,
    enfasis = Paleta.cianClaro,
)

val LocalExtra = staticCompositionLocalOf { ExtraClaro }

/* LA LETRA DEL DISEÑO COMPACTO (06-11-2026, §3.1): once tamaños, los mismos que la web. Cada token pone también el
   peso: en las pantallas no va ningún fontSize ni fontWeight encima (salvo el del número de parada). */
private val Letra = Typography().run {
    copy(
        labelSmall = labelSmall.copy(fontSize = 11.sp, lineHeight = 14.sp, fontWeight = FontWeight.Medium),       // pie
        bodySmall = bodySmall.copy(fontSize = 12.sp, lineHeight = 16.sp),                                         // sec
        labelMedium = labelMedium.copy(fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.SemiBold),   // etiqueta
        bodyMedium = bodyMedium.copy(fontSize = 14.sp, lineHeight = 20.sp),                                       // texto
        labelLarge = labelLarge.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),     // boton
        titleSmall = titleSmall.copy(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),     // boton (opciones)
        titleMedium = titleMedium.copy(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),   // nombre
        bodyLarge = bodyLarge.copy(fontSize = 16.sp, lineHeight = 22.sp),                                         // campo
        titleLarge = titleLarge.copy(fontSize = 18.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold),         // titulo
        headlineSmall = headlineSmall.copy(fontSize = 18.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold),   // titulo
        headlineMedium = headlineMedium.copy(fontSize = 24.sp, lineHeight = 30.sp, fontWeight = FontWeight.Bold, fontFeatureSettings = "tnum"),      // cifra
        displaySmall = displaySmall.copy(fontSize = 30.sp, lineHeight = 34.sp, fontWeight = FontWeight.Bold, fontFeatureSettings = "tnum"),          // guia
        displayMedium = displayMedium.copy(fontSize = 40.sp, lineHeight = 44.sp, fontWeight = FontWeight.ExtraBold, fontFeatureSettings = "tnum"),   // paquete
    )
}

/* Los radios (§3.4): 4 la barra de progreso, 8 chips y celdas, 12 botones, campos, tarjetas y avisos, 16 la
   tarjeta de la siguiente y las hojas. Los botones van con `shapes.medium`, no con la píldora de Material. */
private val Formas = Shapes(
    extraSmall = RoundedCornerShape(4.dp), small = RoundedCornerShape(8.dp), medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp), extraLarge = RoundedCornerShape(16.dp),
)

/** Si toca la noche: el tema elegido en Ajustes («oscuro», «claro») o, con «sistema», el del móvil. Lo usan el tema
 *  de la app y el mapa de la guía (01-11-2026), que tiene su estilo de día y de noche. */
@Composable
fun esNoche(tema: String): Boolean = when (tema) { "oscuro" -> true; "claro" -> false; else -> isSystemInDarkTheme() }

@Composable
fun TemaFds(tema: String, contenido: @Composable () -> Unit) {
    val noche = esNoche(tema)
    val colores: ColorScheme = if (noche) Oscuro else Claro
    CompositionLocalProvider(LocalExtra provides if (noche) ExtraOscuro else ExtraClaro) {
        MaterialTheme(colorScheme = colores, typography = Letra, shapes = Formas, content = contenido)
    }
}

/** LA LETRA GRANDE DEL MÓVIL (06-11-2026, §3.8): hasta 1,3 todo se ve igual de ordenado; a 2,0 nada se corta. Este tope
 *  SOLO va en la etiqueta de las pestañas, la banda de la guía, las píldoras y botones del mapa, las celdas de la
 *  furgoneta y la fila de contadores del escáner; en lo demás, el texto crece con el móvil. */
@Composable
fun LetraMax(max: Float = 1.3f, contenido: @Composable () -> Unit) {
    val d = LocalDensity.current
    CompositionLocalProvider(LocalDensity provides Density(d.density, fontScale = minOf(d.fontScale, max)), content = contenido)
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
    /** Los números con el idioma de la app y el país de la ruta (30-10-2026): en-US «$9.99», es-MX «$250.00»,
     *  es-AR «$ 250,00», fr-FR «9,99 €». Antes era siempre español, y un móvil en inglés veía «US$9.99». */
    private val locale: java.util.Locale
        get() = java.util.Locale.forLanguageTag("${Idioma.actual}-${pais.uppercase()}")

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
