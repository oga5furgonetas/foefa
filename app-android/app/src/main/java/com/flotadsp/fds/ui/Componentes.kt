// diseño compacto
package com.flotadsp.fds.ui

/* LAS PIEZAS DEL DISEÑO COMPACTO (06-11-2026, §4 de la especificación): las mismas medidas y las mismas palabras que
   las de la web (frontend/src/pages/driver/piezas/). Las pantallas las usan tal cual y no ponen encima tamaños de
   letra, colores a mano ni alturas fijas: lo vigila scripts/check-tokens-nativa.mjs. Todo botón de solo icono lleva
   nombre, y el texto visible va siempre dentro del nombre accesible. */

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.PriorityHigh
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.automirrored.filled.StickyNote2
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarData
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.TopAppBarScrollBehavior
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.ui.hoy.Calle
import com.flotadsp.fds.ui.hoy.Situar
import com.flotadsp.fds.ui.hoy.textoAntes
import com.flotadsp.fds.ui.hoy.textoClienteDice
import com.flotadsp.fds.ui.hoy.textoMemoria

/** Los espacios (§3.2): solo estos. Margen de pantalla 16, entre bloques 12, entre botones y chips 8, icono-texto 8. */
object Esp { val xs = 4.dp; val s = 8.dp; val m = 12.dp; val l = 16.dp; val xl = 24.dp }

/** Las alturas (§3.3): el botón principal 52, lo demás pulsable 48, los chips 32 (con 48 de toque), la etiqueta de
 *  estado 24 y la fila de parada 56 como mínimo. Nunca `.height()` en algo con texto: `heightIn(min = …)`. */
object Alto { val principal = 52.dp; val boton = 48.dp; val campo = 48.dp; val chip = 32.dp; val etiqueta = 24.dp; val fila = 56.dp }

/** Los tonos con significado (§3.6): marca (acción general y lo elegido), ok (entregado, verificada), peligro (no
 *  entregado, tarde, error), aviso (cobrar, sin situar, reordenar), zona (solo capas del mapa) y neutro (lo demás). */
enum class Tono { MARCA, NEUTRO, OK, PELIGRO, AVISO, ZONA }

/** El relleno de cada tono y la letra que va encima. */
@Composable
private fun rellenoDe(tono: Tono): Pair<Color, Color> {
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    return when (tono) {
        Tono.MARCA -> c.primary to c.onPrimary
        Tono.NEUTRO -> c.surfaceVariant to c.onSurfaceVariant
        Tono.OK -> x.entregado to x.enEntregado
        Tono.PELIGRO -> x.peligro to x.enPeligro
        Tono.AVISO -> x.aviso to x.enAviso
        Tono.ZONA -> x.zona to x.enZona
    }
}

/** El tinte (fondo suave) de cada tono y su letra: lo tonal, los avisos, la promo y los números pendientes. */
@Composable
private fun tinteDe(tono: Tono): Pair<Color, Color> {
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    return when (tono) {
        Tono.MARCA -> c.primaryContainer to c.onPrimaryContainer
        Tono.NEUTRO -> c.surfaceVariant to c.onSurfaceVariant
        Tono.OK -> c.tertiaryContainer to c.onTertiaryContainer
        Tono.PELIGRO -> c.errorContainer to c.onErrorContainer
        Tono.AVISO -> x.aviso to x.enAviso
        Tono.ZONA -> x.zona to x.enZona
    }
}

/** El texto de cada tono sobre la superficie (§3.6, «texto»); el neutro hereda el color de donde está. */
@Composable
private fun textoDe(tono: Tono): Color {
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    return when (tono) {
        Tono.MARCA -> c.secondary
        Tono.NEUTRO -> LocalContentColor.current
        Tono.OK -> x.entregadoTexto
        Tono.PELIGRO -> c.error
        Tono.AVISO -> x.enAviso
        Tono.ZONA -> x.enZona
    }
}

/** El nombre accesible de un botón con texto visible: si no se da, vale el texto. */
private fun Modifier.nombre(n: String?): Modifier = if (n == null) this else semantics { contentDescription = n }

/** El texto de un botón (§3.8): dos líneas como mucho y, si aun así no cabe, la letra baja hasta 12 antes que cortarse. */
@Composable
private fun TextoBoton(texto: String, estilo: TextStyle) {
    Text(texto, style = estilo, maxLines = 2, textAlign = TextAlign.Center, overflow = TextOverflow.Ellipsis,
        autoSize = TextAutoSize.StepBased(minFontSize = 12.sp, maxFontSize = estilo.fontSize))
}

/* ───────────── Cabecera ───────────── */

/** La cabecera de una pantalla: 56, el título en una línea con el subtítulo gris al lado, ← (o ✕) de 48 y hasta tres
 *  botones de icono. En «Hoy» se esconde al bajar con su `scrollBehavior`, como hoy. */
@Composable
fun Cabecera(
    titulo: String, subtitulo: String? = null, alVolver: (() -> Unit)? = null, cerrar: Boolean = false,
    scrollBehavior: TopAppBarScrollBehavior? = null, acciones: @Composable RowScope.() -> Unit = {},
) {
    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(titulo, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.alignByBaseline().weight(1f, fill = false))
                if (!subtitulo.isNullOrBlank()) {
                    Spacer(Modifier.width(Esp.s))
                    Text(subtitulo, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.alignByBaseline())
                }
            }
        },
        navigationIcon = {
            if (alVolver != null) BotonIcono(if (cerrar) Icons.Default.Close else Icons.AutoMirrored.Filled.ArrowBack, if (cerrar) tx("Cerrar") else tx("Volver"), alVolver)
        },
        actions = acciones,
        expandedHeight = 56.dp,
        scrollBehavior = scrollBehavior,
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background,
            scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer),
    )
}

/* ───────────── Botones ───────────── */

/** La acción principal de la pantalla: 52 como mínimo, radio 12, letra `nombre`, icono de 20. Tonos: marca (con la
 *  tinta oscura), ok y peligro (con blanco). `cargando` cambia el icono por el círculo y lo desactiva mientras. */
@Composable
fun BotonPrincipal(
    texto: String, onClick: () -> Unit, icono: ImageVector? = null, tono: Tono = Tono.MARCA, enabled: Boolean = true,
    cargando: Boolean = false, nombre: String? = null, modifier: Modifier = Modifier,
) {
    val (fondo, letra) = rellenoDe(tono)
    Button(
        onClick = onClick, enabled = enabled && !cargando, shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.buttonColors(containerColor = fondo, contentColor = letra),
        contentPadding = PaddingValues(horizontal = Esp.l, vertical = Esp.s),
        modifier = modifier.heightIn(min = Alto.principal).nombre(nombre),
    ) {
        if (cargando) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = LocalContentColor.current)
        else if (icono != null) Icon(icono, contentDescription = null, modifier = Modifier.size(20.dp))
        if (cargando || icono != null) Spacer(Modifier.width(Esp.s))
        TextoBoton(texto, MaterialTheme.typography.titleMedium)
    }
}

/** Un botón normal: 48 como mínimo, radio 12, letra `boton`; tonal (el tinte del tono) o de contorno (el borde de
 *  control y el texto del tono). Tonos: marca, neutro, ok, peligro y aviso. */
@Composable
fun BotonNormal(
    texto: String, onClick: () -> Unit, icono: ImageVector? = null, tono: Tono = Tono.MARCA, contorno: Boolean = false,
    enabled: Boolean = true, nombre: String? = null, modifier: Modifier = Modifier,
) {
    val forma = MaterialTheme.shapes.medium
    val margen = PaddingValues(horizontal = Esp.l, vertical = Esp.s)
    val m = modifier.heightIn(min = Alto.boton).nombre(nombre)
    val contenido: @Composable RowScope.() -> Unit = {
        if (icono != null) { Icon(icono, contentDescription = null, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(Esp.s)) }
        TextoBoton(texto, MaterialTheme.typography.labelLarge)
    }
    if (contorno) {
        OutlinedButton(onClick = onClick, modifier = m, enabled = enabled, shape = forma, contentPadding = margen,
            colors = ButtonDefaults.outlinedButtonColors(contentColor = textoDe(tono)),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline), content = contenido)
    } else {
        val (fondo, letra) = tinteDe(tono)
        FilledTonalButton(onClick = onClick, modifier = m, enabled = enabled, shape = forma, contentPadding = margen,
            colors = ButtonDefaults.filledTonalButtonColors(containerColor = fondo, contentColor = letra), content = contenido)
    }
}

/** Un botón de solo icono: 48 × 48 con el icono de 24, con relleno (el del tono) o sin fondo. El nombre es obligatorio. */
@Composable
fun BotonIcono(
    icono: ImageVector, nombre: String, onClick: () -> Unit, tono: Tono = Tono.NEUTRO, relleno: Boolean = false,
    enabled: Boolean = true, modifier: Modifier = Modifier,
) {
    val m = modifier.size(Alto.boton)
    if (relleno) {
        val (fondo, letra) = rellenoDe(tono)
        FilledTonalIconButton(onClick = onClick, modifier = m, enabled = enabled,
            colors = IconButtonDefaults.filledTonalIconButtonColors(containerColor = fondo, contentColor = letra)) {
            Icon(icono, contentDescription = nombre, modifier = Modifier.size(24.dp))
        }
    } else {
        IconButton(onClick = onClick, modifier = m, enabled = enabled, colors = IconButtonDefaults.iconButtonColors(contentColor = textoDe(tono))) {
            Icon(icono, contentDescription = nombre, modifier = Modifier.size(24.dp))
        }
    }
}

/** Un botón de texto: 40 a la vista y 48 de toque; en marca, en peligro si borra, o neutro (hereda el color de donde está). */
@Composable
fun BotonTexto(texto: String, onClick: () -> Unit, tono: Tono = Tono.MARCA, enabled: Boolean = true, nombre: String? = null, modifier: Modifier = Modifier) {
    TextButton(
        onClick = onClick, enabled = enabled, shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.textButtonColors(contentColor = textoDe(tono)),
        contentPadding = PaddingValues(horizontal = Esp.m, vertical = Esp.xs),
        modifier = modifier.heightIn(min = 40.dp).nombre(nombre),
    ) { TextoBoton(texto, MaterialTheme.typography.labelLarge) }
}

/** «No entregado» (contorno peligro, sin icono) y «✓ Entregado» (relleno ok), de 52, con hueco de 8 y pesos 1 : 1,2.
 *  En las recogidas, «No recogido» / «Recogido». El texto pasa a dos líneas antes de cortarse. */
@Composable
fun FilaCierre(recogida: Boolean = false, alFallar: () -> Unit, alEntregar: () -> Unit, enabled: Boolean = true, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Esp.s)) {
        OutlinedButton(
            onClick = alFallar, enabled = enabled, shape = MaterialTheme.shapes.medium,
            contentPadding = PaddingValues(horizontal = Esp.s, vertical = Esp.s),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.error),
            modifier = Modifier.weight(1f).heightIn(min = Alto.principal),
        ) { TextoBoton(if (recogida) tx("No recogido") else tx("No entregado"), MaterialTheme.typography.titleMedium) }
        BotonPrincipal(if (recogida) tx("Recogido") else tx("Entregado"), alEntregar, icono = Icons.Default.Check, tono = Tono.OK,
            enabled = enabled, modifier = Modifier.weight(1.2f))
    }
}

/* ───────────── Número, etiquetas y chips ───────────── */

/** El tamaño del número de parada: 32 en la fila, 40 en la siguiente, la hoja y la guía, 80 en el paquete encontrado. */
enum class TamNumero(val alto: Dp) { FILA(32.dp), GRANDE(40.dp), PAQUETE(80.dp) }

enum class EstadoNumero { SIGUIENTE, PENDIENTE, HECHA, FALLIDA }

/** La píldora con el número de parada: ancho mínimo igual al alto (crece con tres cifras), relleno 6; cifra tabular.
 *  Siguiente, relleno de marca; pendiente, tinte de marca; hecha, chip neutro; fallida, tinte de peligro; sin número, «·». */
@Composable
fun NumeroParada(n: Int?, tam: TamNumero = TamNumero.FILA, estado: EstadoNumero = EstadoNumero.PENDIENTE, modifier: Modifier = Modifier) {
    val c = MaterialTheme.colorScheme
    val (fondo, letra) = when (estado) {
        EstadoNumero.SIGUIENTE -> c.primary to c.onPrimary
        EstadoNumero.PENDIENTE -> c.primaryContainer to c.onPrimaryContainer
        EstadoNumero.HECHA -> c.surfaceVariant to c.onSurfaceVariant
        EstadoNumero.FALLIDA -> c.errorContainer to c.onErrorContainer
    }
    // El único peso puesto encima de un token: el número de la fila (16) va en negrita, como el de la siguiente.
    val estilo = when (tam) {
        TamNumero.FILA -> MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
        TamNumero.GRANDE -> MaterialTheme.typography.titleLarge
        TamNumero.PAQUETE -> MaterialTheme.typography.displayMedium
    }.merge(TextoNumero)
    Box(modifier.heightIn(min = tam.alto).widthIn(min = tam.alto).background(fondo, CircleShape).padding(horizontal = 6.dp),
        contentAlignment = Alignment.Center) {
        Text(n?.toString() ?: "·", style = estilo, color = letra, maxLines = 1, softWrap = false)
    }
}

/** Un chip de estado, que no se toca: 24, radio 8, relleno 8, letra `etiqueta`, icono de 14 opcional, una línea.
 *  El tono ok va con relleno (verde con blanco); los demás, con su tinte. */
@Composable
fun Etiqueta(texto: String, tono: Tono = Tono.NEUTRO, icono: ImageVector? = null, modifier: Modifier = Modifier) {
    val (fondo, letra) = if (tono == Tono.OK) rellenoDe(tono) else tinteDe(tono)
    Surface(color = fondo, contentColor = letra, shape = MaterialTheme.shapes.small, modifier = modifier) {
        Row(Modifier.heightIn(min = Alto.etiqueta).padding(horizontal = Esp.s), verticalAlignment = Alignment.CenterVertically) {
            if (icono != null) { Icon(icono, contentDescription = null, modifier = Modifier.size(14.dp)); Spacer(Modifier.width(Esp.xs)) }
            Text(texto, style = MaterialTheme.typography.labelMedium.merge(TextoNumero), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/** Un chip de acción: 32 a la vista y 48 de toque, radio 8, letra `boton`, icono de 16. Neutro va de contorno; marca y
 *  aviso, con relleno. `cargando` pone el círculo en el sitio del icono («Ordenando por tiempo…»). */
@Composable
fun ChipAccion(
    texto: String, onClick: () -> Unit, icono: ImageVector? = null, tono: Tono = Tono.NEUTRO, nombre: String? = null,
    enabled: Boolean = true, cargando: Boolean = false, modifier: Modifier = Modifier,
) {
    val colores = if (tono == Tono.NEUTRO) AssistChipDefaults.assistChipColors() else {
        val (fondo, letra) = rellenoDe(tono)
        AssistChipDefaults.assistChipColors(containerColor = fondo, labelColor = letra, leadingIconContentColor = letra)
    }
    AssistChip(
        onClick = onClick, enabled = enabled, shape = MaterialTheme.shapes.small, colors = colores,
        border = if (tono == Tono.NEUTRO) AssistChipDefaults.assistChipBorder(enabled) else null,
        label = { Text(texto, style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        leadingIcon = if (icono == null && !cargando) null else ({
            if (cargando) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = LocalContentColor.current)
            else Icon(icono!!, contentDescription = null, modifier = Modifier.size(16.dp))
        }),
        modifier = modifier.nombre(nombre),
    )
}

/** Un chip de opción («¿Dónde?», el método de cobro): el elegido, en relleno de marca. */
@Composable
fun ChipOpcion(texto: String, elegido: Boolean, onClick: () -> Unit, icono: ImageVector? = null, modifier: Modifier = Modifier) {
    val c = MaterialTheme.colorScheme
    FilterChip(
        selected = elegido, onClick = onClick, shape = MaterialTheme.shapes.small, modifier = modifier,
        label = { Text(texto, style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        leadingIcon = icono?.let { { Icon(it, contentDescription = null, modifier = Modifier.size(16.dp)) } },
        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = c.primary, selectedLabelColor = c.onPrimary, selectedLeadingIconColor = c.onPrimary),
        border = FilterChipDefaults.filterChipBorder(enabled = true, selected = elegido),
    )
}

/** Una sola línea de chips que se desliza a lo ancho, con hueco de 8: nunca salta de línea (en alemán tampoco). */
@Composable
fun FilaDeChips(modifier: Modifier = Modifier, contenido: @Composable RowScope.() -> Unit) {
    Row(modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Esp.s),
        verticalAlignment = Alignment.CenterVertically, content = contenido)
}

/* ───────────── Avisos ───────────── */

/** Un aviso: 48 como mínimo, radio 12, relleno 12/8; icono de 18, texto de una o dos líneas, una acción de texto y la ✕
 *  de 48 con el nombre que toque («Ahora no», «Entendido»). Con dos acciones, van en una segunda línea. */
@Composable
fun Aviso(
    texto: String, tono: Tono = Tono.NEUTRO, icono: ImageVector? = null, accion: String? = null, alAccion: () -> Unit = {},
    alCerrar: (() -> Unit)? = null, nombreCerrar: String = tx("Cerrar"), accion2: String? = null, alAccion2: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val (fondo, letra) = tinteDe(tono)
    val dosAcciones = accion != null && accion2 != null
    Surface(color = fondo, contentColor = letra, shape = MaterialTheme.shapes.medium,
        modifier = modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }) {
        Column {
            Row(Modifier.heightIn(min = Alto.boton).padding(start = Esp.m, end = if (alCerrar == null && (accion == null || dosAcciones)) Esp.m else Esp.xs),
                verticalAlignment = Alignment.CenterVertically) {
                if (icono != null) { Icon(icono, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(Esp.s)) }
                Text(texto, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f).padding(vertical = Esp.s))
                if (accion != null && !dosAcciones) BotonTexto(accion, alAccion, tono = Tono.NEUTRO)
                if (alCerrar != null) BotonIcono(Icons.Default.Close, nombreCerrar, alCerrar)
            }
            if (dosAcciones) {
                Row(Modifier.fillMaxWidth().padding(start = Esp.xs, end = Esp.xs, bottom = Esp.xs), horizontalArrangement = Arrangement.End) {
                    BotonTexto(accion, alAccion, tono = Tono.NEUTRO)
                    BotonTexto(accion2, alAccion2, tono = Tono.NEUTRO)
                }
            }
        }
    }
}

/** Una línea fija de 40 que no se cierra («● En jornada · la oficina ve tu ubicación» + «Terminar»). */
@Composable
fun LineaEstado(texto: String, accion: String? = null, alAccion: () -> Unit = {}, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().heightIn(min = 40.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(texto, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f).padding(end = Esp.s))
        if (accion != null) BotonTexto(accion, alAccion)
    }
}

/** El aviso pasajero (snackbar): 48 como mínimo, radio 12, superficie inversa, letra `texto` y una acción. Se va solo:
 *  corto 4 s, largo con acción. Va en `SnackbarHost(estado, snackbar = { SnackbarFds(it) })`, o con AvisoFlotante. */
@Composable
fun SnackbarFds(datos: SnackbarData) {
    val c = MaterialTheme.colorScheme
    Snackbar(datos, shape = MaterialTheme.shapes.medium, containerColor = c.inverseSurface, contentColor = c.inverseOnSurface,
        actionColor = c.inversePrimary, dismissActionContentColor = c.inverseOnSurface)
}

@Composable
fun AvisoFlotante(estado: SnackbarHostState, modifier: Modifier = Modifier) {
    SnackbarHost(estado, modifier) { SnackbarFds(it) }
}

/** Un botón de icono con su nombre, para la promo y la hoja. */
class AccionIcono(val icono: ImageVector, val nombre: String, val alPulsar: () -> Unit)

/** La promo (el bono, invitar): 48 como mínimo, radio 12, tinte ok o aviso; icono de 20 y una línea en `boton`; a la
 *  derecha la cifra («3/20») o un botón de icono, y la ✕ («Ahora no»); una barra de 2 si hay progreso (0..1); la pista
 *  en `sec` debajo. Tocarla abre lo que diga `alTocar` (su Ayuda con las condiciones). */
@Composable
fun Promo(
    texto: String, icono: ImageVector, tono: Tono = Tono.OK, cifra: String? = null, progreso: Float? = null,
    alTocar: (() -> Unit)? = null, accion: AccionIcono? = null, alCerrar: (() -> Unit)? = null, nombreCerrar: String = tx("Ahora no"),
    pista: String? = null, modifier: Modifier = Modifier,
) {
    val (fondo, letra) = tinteDe(tono)
    val contenido: @Composable () -> Unit = {
        Column {
            Row(Modifier.heightIn(min = Alto.boton).padding(start = Esp.m, end = if (accion == null && alCerrar == null) Esp.m else Esp.xs),
                verticalAlignment = Alignment.CenterVertically) {
                Icon(icono, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(Esp.s))
                Column(Modifier.weight(1f).padding(vertical = Esp.s)) {
                    Text(texto, style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (!pista.isNullOrBlank()) Text(pista, style = MaterialTheme.typography.bodySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                if (cifra != null) {
                    Spacer(Modifier.width(Esp.s))
                    Text(cifra, style = MaterialTheme.typography.labelLarge.merge(TextoNumero), maxLines = 1)
                }
                if (accion != null) { Spacer(Modifier.width(Esp.xs)); BotonIcono(accion.icono, accion.nombre, accion.alPulsar) }
                if (alCerrar != null) BotonIcono(Icons.Default.Close, nombreCerrar, alCerrar)
            }
            if (progreso != null) {
                LinearProgressIndicator(progress = { progreso.coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth().height(2.dp),
                    color = letra, trackColor = letra.copy(alpha = 0.2f), strokeCap = StrokeCap.Butt, gapSize = 0.dp, drawStopIndicator = {})
            }
        }
    }
    val m = modifier.fillMaxWidth()
    if (alTocar != null) Surface(onClick = alTocar, color = fondo, contentColor = letra, shape = MaterialTheme.shapes.medium, modifier = m, content = contenido)
    else Surface(color = fondo, contentColor = letra, shape = MaterialTheme.shapes.medium, modifier = m, content = contenido)
}

/* ───────────── Hoja, ayuda y menú ───────────── */

/** Una opción del menú ⋮: lo que borra va en peligro y con su diálogo de siempre, que abre `alPulsar`. `nombre` es el
 *  nombre accesible cuando no es el texto (07-11-2026, N2: se ve «Escuchar» y se llama «Escuchar la siguiente parada»). */
class Opcion(val texto: String, val icono: ImageVector? = null, val peligro: Boolean = false, val nombre: String? = null, val alPulsar: () -> Unit)

/** La hoja de abajo: radio 16 arriba; cabecera de 48 con el título en una línea, el subtítulo opcional, «?» y ⋮ si
 *  hacen falta y la ✕ de 48; el cuerpo se desplaza con 16 a los lados; el pie va FIJO, con separador, relleno 12 y la
 *  zona segura; como mucho el 92 % del alto. Se cierra con atrás, con la ✕ o deslizando. */
@Composable
fun Hoja(
    titulo: String, subtitulo: String? = null, alCerrar: () -> Unit, ayuda: String? = null, menu: List<Opcion> = emptyList(),
    pie: (@Composable () -> Unit)? = null, contenido: @Composable ColumnScope.() -> Unit,
) {
    val altoMax = with(LocalDensity.current) { (LocalWindowInfo.current.containerSize.height * 0.92f).toDp() }
    ModalBottomSheet(
        onDismissRequest = alCerrar, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
        dragHandle = { BottomSheetDefaults.DragHandle(modifier = Modifier.padding(vertical = Esp.s)) },
    ) {
        Column(Modifier.heightIn(max = altoMax)) {
            Row(Modifier.fillMaxWidth().heightIn(min = Alto.boton).padding(start = Esp.l, end = Esp.xs), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(titulo, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (!subtitulo.isNullOrBlank()) {
                        Text(subtitulo, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                if (ayuda != null) Ayuda(titulo, ayuda)
                if (menu.isNotEmpty()) Menu(menu)
                BotonIcono(Icons.Default.Close, tx("Cerrar"), alCerrar)
            }
            Column(
                Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(horizontal = Esp.l)
                    .padding(top = Esp.xs, bottom = if (pie == null) Esp.l else Esp.m)
                    .then(if (pie == null) Modifier.navigationBarsPadding() else Modifier),
                content = contenido,
            )
            if (pie != null) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Box(Modifier.fillMaxWidth().padding(Esp.m).navigationBarsPadding()) { pie() }
            }
        }
    }
}

/** El «?»: un botón de icono de 48 que abre la explicación larga en un diálogo con «Entendido». La frase se muda aquí
 *  con su misma clave, sin traducir de nuevo. */
@Composable
fun Ayuda(titulo: String, texto: String, modifier: Modifier = Modifier) {
    var abierta by remember { mutableStateOf(false) }
    BotonIcono(Icons.AutoMirrored.Outlined.HelpOutline, tx("Ayuda"), { abierta = true }, modifier = modifier)
    if (abierta) {
        AlertDialog(
            onDismissRequest = { abierta = false },
            confirmButton = { BotonTexto(tx("Entendido"), { abierta = false }) },
            title = { Text(titulo, style = MaterialTheme.typography.titleLarge) },
            text = { Text(texto, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.verticalScroll(rememberScrollState())) },
            shape = MaterialTheme.shapes.large,
        )
    }
}

/** El ⋮: un botón de icono de 48 («Más opciones») con filas de 48, icono de 20 y letra `boton`, de 200 de ancho como mínimo.
 *  `ancla` (07-11-2026, N2) pinta otra cosa en lugar del ⋮ y recibe `abrir`: el chip «Furgoneta aparcada» de «Hoy». */
@Composable
fun Menu(opciones: List<Opcion>, nombre: String = tx("Más opciones"), modifier: Modifier = Modifier, ancla: (@Composable (abrir: () -> Unit) -> Unit)? = null) {
    var abierto by remember { mutableStateOf(false) }
    val c = MaterialTheme.colorScheme
    Box(modifier) {
        if (ancla != null) ancla { abierto = true } else BotonIcono(Icons.Default.MoreVert, nombre, { abierto = true })
        DropdownMenu(expanded = abierto, onDismissRequest = { abierto = false }, shape = MaterialTheme.shapes.medium, containerColor = c.surfaceContainerLow) {
            opciones.forEach { o ->
                DropdownMenuItem(
                    text = { Text(o.texto, style = MaterialTheme.typography.labelLarge) },
                    onClick = { abierto = false; o.alPulsar() },
                    leadingIcon = o.icono?.let { { Icon(it, contentDescription = null, modifier = Modifier.size(20.dp)) } },
                    colors = if (o.peligro) MenuDefaults.itemColors(textColor = c.error, leadingIconColor = c.error) else MenuDefaults.itemColors(),
                    modifier = Modifier.widthIn(min = 200.dp).then(o.nombre?.let { n -> Modifier.semantics { contentDescription = n } } ?: Modifier),
                )
            }
        }
    }
}

/* ───────────── Las filas y la lista ───────────── */

/** La fila de una parada (≈ 60): el número de 32; línea 1, el nombre en una línea y la hora a la derecha («10:05 +8» en
 *  peligro si llega tarde); línea 2, la dirección en gris y UNA etiqueta como mucho (gana: sin situar > cobrar > urgente >
 *  recogida > horario > puerta conocida > ZBE > hueco). Hecha: «11:02 · Entregado · 24,50 €» en verde o «11:02 · {motivo}»
 *  en peligro. Toda la fila abre la hoja de la parada. */
@Composable
fun FilaParada(p: Parada, numero: Int?, enZbe: String = "", alTocar: () -> Unit, modifier: Modifier = Modifier) {
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    val hecha = !p.pendiente
    val tarde = p.pendiente && (p.tardeMin ?: 0) > 0
    Row(
        modifier.fillMaxWidth().clickable(onClick = alTocar).semantics(mergeDescendants = true) {}
            .heightIn(min = Alto.fila).padding(horizontal = Esp.m, vertical = Esp.s),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        NumeroParada(numero, TamNumero.FILA, when { p.estado == "fallido" -> EstadoNumero.FALLIDA; hecha -> EstadoNumero.HECHA; else -> EstadoNumero.PENDIENTE })
        Spacer(Modifier.width(Esp.m))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(p.cliente.ifBlank { p.direccion }, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f))
                if (!hecha && !p.eta.isNullOrBlank()) {
                    Spacer(Modifier.width(Esp.s))
                    Text(if (tarde) "${p.eta} +${p.tardeMin}" else p.eta, style = MaterialTheme.typography.labelMedium.merge(TextoNumero),
                        color = if (tarde) c.error else c.onSurfaceVariant, maxLines = 1)
                }
            }
            if (hecha) {
                val hora = Calle.hora(p.cerradoEn).takeIf { it.isNotBlank() }
                val que = if (p.estado == "entregado") tx("Entregado") else p.motivo?.takeIf { it.isNotBlank() } ?: tx("No entregado")
                val cobrado = p.cobradoImporte?.takeIf { p.estado == "entregado" && it > 0.0 }?.let { Region.importe(it) }
                Text(listOfNotNull(hora, que, cobrado).joinToString(" · "), style = MaterialTheme.typography.labelMedium.merge(TextoNumero),
                    color = if (p.estado == "entregado") x.entregadoTexto else c.error, maxLines = 1, overflow = TextOverflow.Ellipsis)
            } else {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(if (p.cliente.isNotBlank()) p.direccion else "", style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceVariant,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    etiquetaDeFila(p, enZbe)?.let { (t, tono, i) -> Spacer(Modifier.width(Esp.s)); Etiqueta(t, tono, i) }
                }
            }
        }
    }
}

/** La única etiqueta de la fila, por orden de importancia; null si no toca ninguna. */
private fun etiquetaDeFila(p: Parada, enZbe: String): Triple<String, Tono, ImageVector?>? = when {
    Situar.sinSituar(p) -> Triple(tx("Sin situar"), Tono.AVISO, Icons.Default.LocationOff)
    p.porCobrar -> Triple(tx("Cobrar") + " " + Region.importe(p.cobrar ?: 0.0), Tono.AVISO, Icons.Default.Payments)
    p.prioridad -> Triple(tx("Urgente"), Tono.PELIGRO, Icons.Default.PriorityHigh)
    p.tipo == "recogida" -> Triple(tx("Recogida"), Tono.NEUTRO, null)
    p.ventanaDesde != null -> Triple("${p.ventanaDesde}–${p.ventanaHasta.orEmpty()}", Tono.NEUTRO, Icons.Default.Schedule)
    p.geo == "puerta" -> Triple(tx("Puerta conocida"), Tono.OK, null)
    enZbe.isNotBlank() -> Triple(enZbe, Tono.ZONA, null)
    p.hueco.isNotBlank() -> Triple(tx(p.hueco), Tono.NEUTRO, Icons.Default.Inventory2)
    else -> null
}

private val RADIO_LISTA = 12.dp

/** La forma de una fila según su sitio: la primera redondea las esquinas de arriba, la última las de abajo (una sola,
 *  las cuatro); las de en medio, ninguna. Para el `LazyColumn` de «Hoy». */
fun formaDeLista(indice: Int, total: Int): Shape {
    val arriba = if (indice == 0) RADIO_LISTA else 0.dp
    val abajo = if (indice == total - 1) RADIO_LISTA else 0.dp
    return RoundedCornerShape(topStart = arriba, topEnd = arriba, bottomStart = abajo, bottomEnd = abajo)
}

/** El separador de 1 entre filas, desde el texto (a 56: relleno 12 + número 32 + hueco 12). `desde` lo mueve en las
 *  listas sin número de parada (07-11-2026, N7: los días del Historial, Cuenta y el portal). */
@Composable
fun SeparadorLista(modifier: Modifier = Modifier, desde: Dp = 56.dp) {
    HorizontalDivider(modifier.padding(start = desde), color = MaterialTheme.colorScheme.outlineVariant)
}

/** Una fila dentro de una lista que va en un `LazyColumn`: la superficie con la forma de su sitio y, si no es la última,
 *  el separador debajo. Sin hueco entre filas. */
@Composable
fun FilaDeLista(indice: Int, total: Int, modifier: Modifier = Modifier, separadorDesde: Dp = 56.dp, contenido: @Composable ColumnScope.() -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surfaceContainerLow, shape = formaDeLista(indice, total), modifier = modifier.fillMaxWidth()) {
        Column { contenido(); if (indice < total - 1) SeparadorLista(desde = separadorDesde) }
    }
}

/** Una lista entera en una sola superficie (radio 12, sin borde): `total` filas con su separador entre ellas. */
@Composable
fun ContenedorLista(total: Int, modifier: Modifier = Modifier, separadorDesde: Dp = 56.dp, fila: @Composable (Int) -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surfaceContainerLow, shape = MaterialTheme.shapes.medium, modifier = modifier.fillMaxWidth()) {
        Column { for (i in 0 until total) { fila(i); if (i < total - 1) SeparadorLista(desde = separadorDesde) } }
    }
}

/** Un dato de la puerta: el icono, lo que se ve y la frase entera (con su prefijo) como nombre accesible. */
class Nota(val icono: ImageVector, val texto: String, val nombre: String)

/** Los datos de la puerta en su orden: lo que dice el cliente, la memoria, las notas y la última vez. Sin prefijo a la
 *  vista («El cliente dice:», «La última vez (12/10):»): la frase entera queda en el nombre accesible. */
fun notasDe(p: Parada): List<Nota> = listOfNotNull(
    p.clienteDice?.let { textoClienteDice(it) }?.takeIf { it.isNotBlank() }?.let { Nota(Icons.Default.Forum, it, tx("El cliente dice: {t}", "t" to it)) },
    p.memoria?.let { textoMemoria(it) }?.takeIf { it.isNotBlank() }?.let { Nota(Icons.Default.Key, it, tx("Memoria de la puerta: {t}", "t" to it)) },
    p.notas.takeIf { it.isNotBlank() }?.let { Nota(Icons.AutoMirrored.Filled.StickyNote2, it, tx("Notas: {x}", "x" to it)) },
    p.antes?.takeIf { p.pendiente }?.let { textoAntes(it) }?.let { Nota(Icons.Default.History, sinPrefijo(it), it) },
)

/** «La última vez (12/10): en portería» → «en portería» (y «La dernière fois (12/10) : …» igual); si no hay prefijo, entera. */
internal fun sinPrefijo(frase: String): String =
    Regex("""\)\s*:\s*""").find(frase)?.let { frase.substring(it.range.last + 1) }?.takeIf { it.isNotBlank() } ?: frase

/** La caja de notas de la puerta (tinte neutro, radio 8, relleno 8): cada dato con su icono de 16 y `texto`; en la
 *  tarjeta, dos líneas como mucho (`maxLines = 2`); en la hoja, entero. No pinta nada si no hay nada. */
@Composable
fun NotasPuerta(p: Parada, maxLines: Int = 2, modifier: Modifier = Modifier) {
    val notas = notasDe(p)
    if (notas.isEmpty()) return
    val c = MaterialTheme.colorScheme
    Surface(color = c.surfaceVariant, contentColor = c.onSurface, shape = MaterialTheme.shapes.small, modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(Esp.s), verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
            notas.forEach { n ->
                Row(Modifier.semantics(mergeDescendants = true) { contentDescription = n.nombre }, verticalAlignment = Alignment.Top) {
                    Icon(n.icono, contentDescription = null, tint = c.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp).size(16.dp))
                    Spacer(Modifier.width(Esp.s))
                    Text(n.texto, style = MaterialTheme.typography.bodyMedium, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

/** Una fila de dato de la hoja: 36 como mínimo (48 si se toca); icono de 18 en gris y el valor en `texto`, dos líneas.
 *  Sin «Etiqueta:» a la vista: va en `nombre`, el nombre accesible («Teléfono: 613 403 123»). */
@Composable
fun FilaDato(icono: ImageVector, texto: String, nombre: String, alTocar: (() -> Unit)? = null, modifier: Modifier = Modifier) {
    val c = MaterialTheme.colorScheme
    Row(
        modifier.fillMaxWidth().then(if (alTocar != null) Modifier.clickable(onClick = alTocar) else Modifier)
            .semantics(mergeDescendants = true) { contentDescription = nombre }
            .heightIn(min = if (alTocar != null) Alto.boton else 36.dp).padding(vertical = Esp.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icono, contentDescription = null, tint = c.onSurfaceVariant, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(Esp.s))
        Text(texto, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

/* ───────────── Campo, segmentado, mapa ───────────── */

/** Un campo de texto de 48: radio 12, borde de control (2 de marca al escribir), icono de 20 a la izquierda, letra
 *  `campo`, el ejemplo dentro y la ayuda o el error debajo en `sec`. Sin etiqueta flotante: `nombre` es el nombre
 *  accesible de siempre. (El OutlinedTextField de Material no baja de 56.) */
@Composable
fun CampoTexto(
    valor: String, alCambiar: (String) -> Unit, icono: ImageVector? = null, ejemplo: String = "", nombre: String = ejemplo,
    teclado: KeyboardOptions = KeyboardOptions.Default, unaLinea: Boolean = true, error: String? = null, ayuda: String? = null,
    acciones: KeyboardActions = KeyboardActions.Default, enabled: Boolean = true, modifier: Modifier = Modifier,
) {
    val c = MaterialTheme.colorScheme
    val interaccion = remember { MutableInteractionSource() }
    val colores = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = c.secondary, unfocusedBorderColor = c.outline, errorBorderColor = c.error, cursorColor = c.secondary,
        focusedLeadingIconColor = c.secondary, unfocusedLeadingIconColor = c.onSurfaceVariant, errorLeadingIconColor = c.error,
        focusedPlaceholderColor = c.onSurfaceVariant, unfocusedPlaceholderColor = c.onSurfaceVariant,
    )
    val conError = error != null
    Column(modifier) {
        BasicTextField(
            value = valor, onValueChange = alCambiar, enabled = enabled, singleLine = unaLinea, keyboardOptions = teclado, keyboardActions = acciones,
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = c.onSurface), cursorBrush = SolidColor(c.secondary),
            interactionSource = interaccion,
            modifier = Modifier.fillMaxWidth().heightIn(min = Alto.campo).semantics { contentDescription = nombre },
            decorationBox = { campo ->
                OutlinedTextFieldDefaults.DecorationBox(
                    value = valor, innerTextField = campo, enabled = enabled, singleLine = unaLinea,
                    visualTransformation = VisualTransformation.None, interactionSource = interaccion, isError = conError,
                    placeholder = { Text(ejemplo, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    leadingIcon = icono?.let { { Icon(it, contentDescription = null, modifier = Modifier.size(20.dp)) } },
                    colors = colores, contentPadding = PaddingValues(Esp.m),
                    container = {
                        OutlinedTextFieldDefaults.Container(enabled = enabled, isError = conError, interactionSource = interaccion, colors = colores,
                            shape = MaterialTheme.shapes.medium, focusedBorderThickness = 2.dp, unfocusedBorderThickness = 1.dp)
                    },
                )
            },
        )
        (error ?: ayuda)?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = if (conError) c.error else c.onSurfaceVariant,
                modifier = Modifier.padding(start = Esp.m, top = Esp.xs))
        }
    }
}

/** El segmentado («Furgoneta | Lista por hueco»): 40 a la vista y 48 de toque, radio 12, letra `boton`, el elegido en
 *  tinte de marca. */
@Composable
fun Segmentado(opciones: List<String>, elegida: Int, alElegir: (Int) -> Unit, modifier: Modifier = Modifier) {
    val c = MaterialTheme.colorScheme
    SingleChoiceSegmentedButtonRow(modifier.fillMaxWidth().heightIn(min = 40.dp)) {
        opciones.forEachIndexed { i, t ->
            SegmentedButton(
                selected = i == elegida, onClick = { alElegir(i) },
                shape = SegmentedButtonDefaults.itemShape(index = i, count = opciones.size, baseShape = MaterialTheme.shapes.medium),
                colors = SegmentedButtonDefaults.colors(activeContainerColor = c.primaryContainer, activeContentColor = c.onPrimaryContainer,
                    activeBorderColor = c.outline, inactiveBorderColor = c.outline, inactiveContentColor = c.onSurface),
                icon = {}, label = { Text(t, style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            )
        }
    }
}

/** Un botón sobre el mapa: 48 redondo, superficie con sombra, icono de 24; activo, en marca. */
@Composable
fun BotonMapa(icono: ImageVector, nombre: String, activo: Boolean = false, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val c = MaterialTheme.colorScheme
    Surface(shape = CircleShape, shadowElevation = 3.dp, color = if (activo) c.primary else c.surfaceContainerLow,
        contentColor = if (activo) c.onPrimary else c.onSurface, modifier = modifier) {
        IconButton(onClick = onClick, modifier = Modifier.size(Alto.boton)) { Icon(icono, contentDescription = nombre, modifier = Modifier.size(24.dp)) }
    }
}

/** El zoom del mapa: una píldora de 48 × 96 con + («Acercar») y − («Alejar»), para quien reparte con guantes. */
@Composable
fun ZoomMapa(alAcercar: () -> Unit, alAlejar: () -> Unit, modifier: Modifier = Modifier) {
    val c = MaterialTheme.colorScheme
    Surface(shape = CircleShape, shadowElevation = 3.dp, color = c.surfaceContainerLow, contentColor = c.onSurface, modifier = modifier) {
        Column {
            IconButton(onClick = alAcercar, modifier = Modifier.size(Alto.boton)) { Icon(Icons.Default.Add, contentDescription = tx("Acercar"), modifier = Modifier.size(24.dp)) }
            IconButton(onClick = alAlejar, modifier = Modifier.size(Alto.boton)) { Icon(Icons.Default.Remove, contentDescription = tx("Alejar"), modifier = Modifier.size(24.dp)) }
        }
    }
}

/** Una pastilla sobre el mapa: 32 a la vista (48 de toque si se pulsa), redonda, letra `etiqueta` en UNA línea con «…»,
 *  con sombra y los tonos de §3.6 (neutro: la superficie). `color`/`contentColor` solo para las de la guía (Extra.guiaPildora). */
@Composable
fun Pastilla(
    texto: String, tono: Tono = Tono.NEUTRO, icono: ImageVector? = null, onClick: (() -> Unit)? = null,
    color: Color? = null, contentColor: Color? = null, modifier: Modifier = Modifier,
) {
    val c = MaterialTheme.colorScheme
    val (fondo, letra) = if (tono == Tono.NEUTRO) c.surfaceContainerLow to c.onSurface else rellenoDe(tono)
    val contenido: @Composable () -> Unit = {
        Row(Modifier.heightIn(min = Alto.chip).padding(horizontal = Esp.m), verticalAlignment = Alignment.CenterVertically) {
            if (icono != null) { Icon(icono, contentDescription = null, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(Esp.xs)) }
            Text(texto, style = MaterialTheme.typography.labelMedium.merge(TextoNumero), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
    if (onClick != null) Surface(onClick = onClick, shape = CircleShape, shadowElevation = 3.dp, color = color ?: fondo, contentColor = contentColor ?: letra, modifier = modifier, content = contenido)
    else Surface(shape = CircleShape, shadowElevation = 3.dp, color = color ?: fondo, contentColor = contentColor ?: letra, modifier = modifier, content = contenido)
}

/** La atribución del mapa: letra `pie` sobre la superficie al 85 %, radio 6, en una esquina (la pone quien la llama). */
@Composable
fun Atribucion(texto: String, modifier: Modifier = Modifier) {
    val c = MaterialTheme.colorScheme
    Surface(color = c.surface.copy(alpha = 0.85f), contentColor = c.onSurface, shape = RoundedCornerShape(6.dp), modifier = modifier) {
        Text(texto, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
    }
}
