// diseño compacto
package com.flotadsp.fds.ui.hoy

/* LAS HOJAS DE «HOY» EN EL DISEÑO COMPACTO (07-11-2026, §5.2 y §5.3 de la especificación): la hoja de la parada,
   «Entregar», «No entregado», «Avisar a todos por WhatsApp», la memoria de la puerta y «Mira la foto de entrega», todas
   sobre la Hoja y las piezas de ui/Componentes.kt: el título en una línea, la acción principal en el pie fijo y lo
   largo detrás del «?». Lo que hace cada botón y lo que se manda al servidor, como antes. Los textos que se componen
   (textoWhatsapp, textoClienteDice, textoAntes, textoMemoria, textoAvisoIa) no cambian: los prueban TextosHojaTest,
   MemoriaTest y EntregaIaTest. */

import com.flotadsp.fds.ui.tx
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EditLocationAlt
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PriorityHigh
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import com.flotadsp.fds.BuildConfig
import com.flotadsp.fds.data.Antes
import com.flotadsp.fds.data.ClienteDice
import com.flotadsp.fds.data.EntregaIa
import com.flotadsp.fds.data.Memoria
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.ui.Acciones
import com.flotadsp.fds.ui.Alto
import com.flotadsp.fds.ui.Aviso
import com.flotadsp.fds.ui.BotonIcono
import com.flotadsp.fds.ui.BotonNormal
import com.flotadsp.fds.ui.BotonPrincipal
import com.flotadsp.fds.ui.BotonTexto
import com.flotadsp.fds.ui.CampoTexto
import com.flotadsp.fds.ui.ChipAccion
import com.flotadsp.fds.ui.ChipOpcion
import com.flotadsp.fds.ui.Esp
import com.flotadsp.fds.ui.EstadoNumero
import com.flotadsp.fds.ui.Etiqueta
import com.flotadsp.fds.ui.FilaCierre
import com.flotadsp.fds.ui.FilaDato
import com.flotadsp.fds.ui.FilaDeChips
import com.flotadsp.fds.ui.Hoja
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.NotasPuerta
import com.flotadsp.fds.ui.NumeroParada
import com.flotadsp.fds.ui.Opcion
import com.flotadsp.fds.ui.Region
import com.flotadsp.fds.ui.TamNumero
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.Tono
import com.flotadsp.fds.ui.notasDe
import com.flotadsp.fds.ui.rememberHacerFoto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.ByteArrayOutputStream
import java.io.File

private val DONDE = listOf("mano" to tx("En mano"), "vecino" to tx("Al vecino"), "buzon" to tx("En el buzón"), "porteria" to tx("En portería"), "seguro" to tx("En un lugar seguro"))
/** «¿Dónde?» corto (07-11-2026, §4): lo que cabe en un chip, para los de «Entregar» y de la memoria. Las frases
 *  («La última vez (12/10): en portería», «dejar en portería») siguen con DONDE; las claves que se guardan no cambian. */
private val DONDE_CORTO = listOf("mano" to tx("Mano"), "vecino" to tx("Vecino"), "buzon" to tx("Buzón"), "porteria" to tx("Portería"), "seguro" to tx("Lugar seguro"))
private val MOTIVOS = listOf(tx("No había nadie"), tx("Dirección incorrecta"), tx("Rechazado"), tx("Fuera de horario"), tx("Otro"))

/** El WhatsApp al cliente, como en la web (29-10-2026): con la hora estimada y el enlace de seguimiento, que no
 *  lleva datos personales. Sin hora ni enlace, el mensaje de siempre. */
fun textoWhatsapp(p: Parada, empresa: String): String {
    val quien = if (empresa.isNotBlank()) tx("el repartidor de {empresa}", "empresa" to empresa) else tx("el repartidor")
    val que = if (p.tipo == "recogida") tx("a hacer la recogida") else tx("con su pedido")
    val cuando = p.eta?.takeIf { it.isNotBlank() }?.let { tx(", llegada aproximada a las {hora}", "hora" to it) } ?: ""
    val enlace = p.seguimiento?.takeIf { it.isNotBlank() }?.let { " " + tx("Puede seguirlo aquí:") + " ${BuildConfig.WEB_URL}/s/$it" } ?: ""
    return tx("Hola, soy {quien}. Voy de camino {que}", "quien" to quien, "que" to que) + "$cuando.$enlace"
}

/** EL CLIENTE TE AYUDA ANTES DE LLEGAR (30-10-2026): «No estará · Al vecino · Portal: 1234», como en la web. */
private val DEJAR_CLIENTE = mapOf("buzon" to tx("En el buzón"), "porteria" to tx("En portería o recepción"), "vecino" to tx("Al vecino"),
    "seguro" to tx("En un lugar seguro"), "punto_recogida" to tx("En un punto de recogida"))

fun textoClienteDice(c: ClienteDice): String {
    val partes = mutableListOf<String>()
    when {
        c.estare == "si" -> partes += tx("Estará en casa")
        c.estare == "no" -> partes += tx("No estará") + (DEJAR_CLIENTE[c.dejar]?.let { " · $it" } ?: "")
        c.franja != null && c.franja.size == 2 -> partes += tx("Mejor de {a} a {b}", "a" to c.franja[0], "b" to c.franja[1])
    }
    if (c.portal.isNotBlank()) partes += tx("Portal") + ": ${c.portal}"
    if (c.nota.isNotBlank()) partes += "«${c.nota}»"
    return partes.joinToString(" · ")
}

/** «La última vez (12/10): en portería», o por qué no se pudo. */
fun textoAntes(a: Antes): String {
    val f = a.fecha.takeIf { it.length == 10 }?.let { "${it.substring(8, 10)}/${it.substring(5, 7)}" } ?: a.fecha
    val donde = DONDE.firstOrNull { it.first == a.donde }?.second?.lowercase()
    val que = when {
        a.estado == "fallido" -> tx("no se pudo") + (a.motivo.takeIf { it.isNotBlank() }?.let { ": $it" } ?: "")
        donde != null && a.nota.isNotBlank() -> "$donde · ${a.nota}"
        donde != null -> donde
        else -> a.nota
    }
    return tx("La última vez ({f}): {que}", "f" to f, "que" to que)
}

/** El rótulo de un grupo de la hoja («¿Dónde?», «Cómo se entra»), en `boton` (07-11-2026). */
@Composable
private fun Rotulo(texto: String) {
    Text(texto, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(bottom = Esp.xs))
}

/** Los chips de «¿Dónde?» (DONDE_CORTO), en una fila que se desliza; tocar el elegido lo quita. */
@Composable
private fun ChipsDonde(elegido: String, alElegir: (String) -> Unit) {
    FilaDeChips { DONDE_CORTO.forEach { (k, t) -> ChipOpcion(t, elegido == k, { alElegir(if (elegido == k) "" else k) }) } }
}

/** EL CLIENTE AVISADO (01-11-2026): con la ruta ordenada, un WhatsApp a cada cliente con móvil, uno tras otro, con su
 *  hora y su enlace (textoWhatsapp). Lo que más fallidas evita, según la calle. Filas de 56 con el número, el nombre y
 *  «≈ 09:58 · 613 403 123», y a la derecha el WhatsApp de icono o «✓ Avisado» (07-11-2026). */
@Composable
fun AvisarHoja(paradas: List<Parada>, avisados: Set<String>, alAvisar: (Parada) -> Unit, alCerrar: () -> Unit) {
    Hoja(
        titulo = tx("Avisar a todos por WhatsApp"), subtitulo = tx("Su hora y su enlace, uno a uno"), alCerrar = alCerrar,
        ayuda = tx("Un WhatsApp a cada cliente con su hora aproximada y su enlace para seguirte. Se abre uno a uno: envía y vuelve."),
    ) {
        paradas.forEachIndexed { i, p ->
            val hecho = p.id in avisados
            Row(Modifier.fillMaxWidth().heightIn(min = Alto.fila).padding(vertical = Esp.xs), verticalAlignment = Alignment.CenterVertically) {
                NumeroParada(p.orden, TamNumero.FILA)
                Spacer(Modifier.width(Esp.m))
                Column(Modifier.weight(1f)) {
                    Text(p.cliente.ifBlank { p.direccion }, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(listOfNotNull(p.eta?.let { "≈ $it" }, p.telefono).joinToString(" · "), style = MaterialTheme.typography.bodySmall.merge(TextoNumero),
                        color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Spacer(Modifier.width(Esp.s))
                if (hecho) Etiqueta(tx("Avisado"), Tono.OK, Icons.Default.Check)
                else BotonIcono(Icons.AutoMirrored.Filled.Chat, tx("WhatsApp"), { alAvisar(p) }, tono = Tono.OK, relleno = true)
            }
            if (i < paradas.lastIndex) HorizontalDivider(Modifier.padding(start = 44.dp), color = MaterialTheme.colorScheme.outlineVariant)
        }
    }
}

/** LA MEMORIA DE LA CALLE (01-11-2026): «portal 1234, dejar en portería, entrada por el garaje», lo que se pinta y lo
 *  que se dice (la web tiene la misma en pages/driver/MemoriaPuerta.jsx). */
fun textoMemoria(m: Memoria): String {
    val partes = mutableListOf<String>()
    if (m.portal.isNotBlank()) partes += tx("portal {c}", "c" to m.portal)
    DONDE.firstOrNull { it.first == m.dejar }?.let { partes += tx("dejar {d}", "d" to it.second.lowercase()) }
    if (m.acceso.isNotBlank()) partes += m.acceso
    return partes.joinToString(", ")
}

/** LA MEMORIA DE LA CALLE (01-11-2026): la hoja para apuntar el portal, dónde dejar y cómo se entra. Si el cliente dio el
 *  portal en su enlace, ya viene puesto. Todo vacío (o «Borrar») lo borra. La frase larga, detrás del «?» (07-11-2026). */
@Composable
fun MemoriaHoja(p: Parada, alCerrar: () -> Unit, alGuardar: (portal: String, dejar: String, acceso: String) -> Unit) {
    var portal by remember { mutableStateOf(p.memoria?.portal?.ifBlank { null } ?: p.clienteDice?.portal ?: "") }
    var dejar by remember { mutableStateOf(p.memoria?.dejar ?: "") }
    var acceso by remember { mutableStateOf(p.memoria?.acceso ?: "") }
    Hoja(
        titulo = tx("Memoria de la puerta"), subtitulo = p.direccion, alCerrar = alCerrar,
        ayuda = tx("Lo verá quien venga a esta dirección, también un compañero. Se borra al año."),
        pie = {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Esp.s), verticalAlignment = Alignment.CenterVertically) {
                if (p.memoria != null) BotonTexto(tx("Borrar"), { alGuardar("", "", "") }, tono = Tono.PELIGRO)
                BotonPrincipal(tx("Guardar"), { alGuardar(portal.trim(), dejar, acceso.trim()) }, icono = Icons.Default.Key,
                    enabled = portal.isNotBlank() || dejar.isNotBlank() || acceso.isNotBlank(), modifier = Modifier.weight(1f))
            }
        },
    ) {
        Text(tx("La ven tus compañeros · se borra al año"), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(Esp.m))
        CampoTexto(portal, { portal = it.take(40) }, icono = Icons.Default.Key, ejemplo = tx("Código del portal"))
        Spacer(Modifier.height(Esp.m))
        Rotulo(tx("¿Dónde?"))
        ChipsDonde(dejar) { dejar = it }
        Spacer(Modifier.height(Esp.m))
        Rotulo(tx("Cómo se entra"))
        CampoTexto(acceso, { acceso = it.take(200) }, ejemplo = tx("Garaje, timbre 2, sin ascensor…"), nombre = tx("Cómo se entra"), unaLinea = false)
    }
}

/** LA ENTREGA VERIFICADA (01-11-2026): lo que la IA dijo de la foto de entrega, en una frase (la web tiene la misma en
 *  lib/entregaIa.js). El servidor manda el código y los datos; la frase se hace aquí, en su idioma. */
fun textoAvisoIa(ia: EntregaIa): String = when (ia.aviso) {
    "personas" -> tx("Se ven personas en la foto: repítela sin ellas.")
    "sin_paquete" -> tx("No se ve el paquete en la foto: repítela con el paquete donde lo dejas.")
    "otro_numero" -> tx("En la foto se lee el número {a} y la parada es el {b}: comprueba que es la puerta buena.", "a" to (ia.numero ?: ""), "b" to (ia.portal ?: ""))
    "sin_numero" -> tx("No se ve el número del portal: la próxima vez, con el número o la puerta en la foto.")
    else -> ""
}

/** LA ENTREGA VERIFICADA (01-11-2026): la IA pide mirar la foto de entrega. «Repetir la foto» abre la cámara y manda la
 *  nueva (la parada sigue entregada; el servidor la vuelve a mirar); «Está bien así» la deja. Nunca bloquea. Sobre la
 *  Hoja, como en la web (07-11-2026): el aviso tal cual y «Es tu prueba de entrega. ¿La repites?». */
@Composable
fun RevisarFotoDialogo(r: Revisar, alRepetir: (String) -> Unit, alCerrar: () -> Unit) {
    val ctx = LocalContext.current
    val ambito = rememberCoroutineScope()
    val uri = remember { fotoNueva(ctx) }
    var preparando by remember { mutableStateOf(false) }
    var avisoFoto by remember { mutableStateOf<String?>(null) }
    val hacerFoto = rememberHacerFoto(uri, alAvisar = { avisoFoto = it }) { ok ->
        if (ok) {
            preparando = true
            ambito.launch {
                val f = withContext(Dispatchers.IO) { comprimir(ctx, uri) }?.first
                preparando = false
                if (f != null) alRepetir(f) else avisoFoto = tx("No se pudo guardar la foto")
            }
        }
    }
    val x = LocalExtra.current
    Hoja(
        titulo = tx("Mira la foto de entrega"), alCerrar = alCerrar,
        pie = {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Esp.s), verticalAlignment = Alignment.CenterVertically) {
                BotonTexto(tx("Está bien así"), alCerrar, tono = Tono.NEUTRO)
                BotonPrincipal(if (preparando) tx("Guardando…") else tx("Repetir la foto"), hacerFoto, icono = Icons.Default.PhotoCamera,
                    cargando = preparando, modifier = Modifier.weight(1f))
            }
        },
    ) {
        textoAvisoIa(r.ia).takeIf { it.isNotBlank() }?.let {
            Row(verticalAlignment = Alignment.Top) {
                Icon(Icons.Default.PriorityHigh, contentDescription = null, tint = x.enAviso, modifier = Modifier.padding(top = 2.dp).size(18.dp))
                Spacer(Modifier.width(Esp.s))
                Text(it, style = MaterialTheme.typography.bodyMedium, color = x.enAviso)
            }
            Spacer(Modifier.height(Esp.s))
        }
        Text(tx("Es tu prueba de entrega. ¿La repites?"), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        avisoFoto?.let {
            Spacer(Modifier.height(Esp.s))
            Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
        }
    }
}

/** LA HOJA DE LA PARADA (07-11-2026, §5.2): el número de 40, la dirección y la hora; las acciones en una fila de chips
 *  que se desliza («Ir», llamar y WhatsApp solo con teléfono, situar si no tiene sitio); las etiquetas de la tarjeta sin
 *  el tope de 3; los datos con su icono y sin rótulo a la vista; el ⋮ con «Editar», «Memoria de la puerta» y «Quitar de
 *  la ruta»; y el pie fijo: «No entregado / Entregado» (pendiente) o «Volver a «por entregar»» (cerrada). */
@Composable
fun ParadaHoja(
    p: Parada, prefijo: String, empresa: String = "",
    alCerrar: () -> Unit, alEntregar: () -> Unit, alFallar: () -> Unit, alDeshacer: () -> Unit, alEditar: () -> Unit, alQuitar: () -> Unit,
    /** «Ir»: la guía de la app o el navegador elegido, lo decide «Hoy» (01-11-2026). */
    alNavegar: () -> Unit = {},
    /** El registro del intento (30-10-2026): «llamada» o «whatsapp» al pulsarlos. */
    alApuntar: (String) -> Unit = {},
    /** LA ENTREGA VERIFICADA (01-11-2026): repetir la foto de una entrega que la IA pide revisar. */
    alRepetirFoto: () -> Unit = {},
    /** LA MEMORIA DE LA CALLE (01-11-2026): la memoria de esta puerta, desde el ⋮. */
    alMemoria: () -> Unit = {},
    /** EL PRIMER PAQUETE BIEN SITUADO (02-11-2026): sin punto en el mapa, «Situar» la pone a mano. */
    alSituar: () -> Unit = {},
    /** La ZBE en la que cae (07-11-2026): su etiqueta, como en la tarjeta; «Hoy» la pasa si la sabe. */
    enZbe: String = "",
) {
    val ctx = LocalContext.current
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    var quitar by remember { mutableStateOf(false) }
    var deshacer by remember { mutableStateOf(false) }
    // Cerrada no se edita ni se quita (el servidor solo deja cambiar la nota): primero «Volver a por entregar».
    val menu = buildList<Opcion> {
        if (p.pendiente) add(Opcion(tx("Editar"), Icons.Default.Edit) { alEditar() })
        add(Opcion(tx("Memoria de la puerta"), Icons.Default.Key) { alMemoria() })
        if (p.pendiente) add(Opcion(tx("Quitar de la ruta"), Icons.Default.Delete, peligro = true) { quitar = true })
    }
    Hoja(
        titulo = p.cliente.ifBlank { tx("Cliente") }, alCerrar = alCerrar, menu = menu,
        pie = {
            if (p.pendiente) FilaCierre(recogida = p.tipo == "recogida", alFallar = alFallar, alEntregar = alEntregar)
            // Una entregada vuelve atrás con pregunta: se borra su prueba de entrega (29-10-2026). Una no entregada no
            // tiene nada que perder.
            else BotonNormal(tx("Volver a «por entregar»"), { if (p.estado == "entregado") deshacer = true else alDeshacer() },
                icono = Icons.AutoMirrored.Filled.Undo, tono = Tono.NEUTRO, contorno = true, modifier = Modifier.fillMaxWidth())
        },
    ) {
        val tarde = p.pendiente && (p.tardeMin ?: 0) > 0
        Row(verticalAlignment = Alignment.CenterVertically) {
            NumeroParada(p.orden, TamNumero.GRANDE, when { p.estado == "fallido" -> EstadoNumero.FALLIDA; !p.pendiente -> EstadoNumero.HECHA; else -> EstadoNumero.PENDIENTE })
            Spacer(Modifier.width(Esp.m))
            Column(Modifier.weight(1f)) {
                // La dirección ya suele llevar el CP y la población: no se repiten.
                Text((listOf(p.direccion) + listOf(p.cp, p.localidad).filter { it.isNotBlank() && !p.direccion.contains(it, ignoreCase = true) })
                    .filter { it.isNotBlank() }.joinToString(", "),
                    style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (!p.pendiente) {
                    // Cerrada: «11:02 · Entregado · 24,50 €» en verde o «11:02 · No entregado» en peligro, como en su fila.
                    val hora = Calle.hora(p.cerradoEn).takeIf { it.isNotBlank() }
                    val cobrado = p.cobradoImporte?.takeIf { p.estado == "entregado" && it > 0.0 }?.let { Region.importe(it) }
                    Text(listOfNotNull(hora, if (p.estado == "entregado") (if (p.tipo == "recogida") tx("Recogido") else tx("Entregado"))
                        else (if (p.tipo == "recogida") tx("No recogido") else tx("No entregado")), cobrado).joinToString(" · "),
                        style = MaterialTheme.typography.labelMedium.merge(TextoNumero), color = if (p.estado == "entregado") x.entregadoTexto else c.error,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            if (p.pendiente && !p.eta.isNullOrBlank()) {
                Spacer(Modifier.width(Esp.s))
                Text(if (tarde) "${p.eta} +${p.tardeMin}" else p.eta, style = MaterialTheme.typography.labelLarge.merge(TextoNumero),
                    color = if (tarde) c.error else c.onSurfaceVariant, maxLines = 1)
            }
        }
        Spacer(Modifier.height(Esp.m))
        FilaDeChips {
            ChipAccion(tx("Ir"), alNavegar, icono = Icons.Default.Navigation, tono = Tono.MARCA)
            if (p.telefono.isNotBlank()) {
                ChipAccion(tx("Llamar"), { alApuntar("llamada"); Acciones.llamar(ctx, p.telefono) }, icono = Icons.Default.Call)
                ChipAccion(tx("WhatsApp"), { alApuntar("whatsapp"); Acciones.whatsapp(ctx, p.telefono, prefijo, textoWhatsapp(p, empresa)) },
                    icono = Icons.AutoMirrored.Filled.Chat)
            }
            // Sin sitio, «Sin situar · Situar»; con solo la calle, «Situar en el mapa»: las dos abren «Situar la parada».
            if (Situar.sinSituar(p)) ChipAccion(tx("Sin situar") + " · " + tx("Situar"), alSituar, icono = Icons.Default.LocationOff, tono = Tono.AVISO)
            else if (p.pendiente && p.geo == "aprox") ChipAccion(tx("Situar en el mapa"), alSituar, icono = Icons.Default.EditLocationAlt)
        }
        EtiquetasHoja(p, enZbe)
        DatosHoja(p, alRepetirFoto)
    }
    if (quitar) {
        AlertDialog(
            onDismissRequest = { quitar = false },
            title = { Text(tx("¿Quitar esta parada?"), style = MaterialTheme.typography.titleLarge) },
            text = { Text(tx("{n} sale de tu ruta de hoy.", "n" to p.cliente.ifBlank { p.direccion }), style = MaterialTheme.typography.bodyMedium) },
            confirmButton = { BotonTexto(tx("Quitar"), { quitar = false; alQuitar() }, tono = Tono.PELIGRO) },
            dismissButton = { BotonTexto(tx("Cancelar"), { quitar = false }, tono = Tono.NEUTRO) },
            shape = MaterialTheme.shapes.large,
        )
    }
    if (deshacer) {
        AlertDialog(
            onDismissRequest = { deshacer = false },
            title = { Text(tx("¿Volver a «por entregar»?"), style = MaterialTheme.typography.titleLarge) },
            text = { Text(tx("Se borra la prueba de entrega de {n}: la foto, dónde se dejó, quién lo recogió y la hora.", "n" to p.cliente.ifBlank { p.direccion }),
                style = MaterialTheme.typography.bodyMedium) },
            confirmButton = { BotonTexto(tx("Volver atrás"), { deshacer = false; alDeshacer() }) },
            dismissButton = { BotonTexto(tx("Cancelar"), { deshacer = false }, tono = Tono.NEUTRO) },
            shape = MaterialTheme.shapes.large,
        )
    }
}

/** Las etiquetas de la hoja (§5.2): las de la tarjeta (cobrar, horario, urgente, recogida, puerta conocida, sin el
 *  portal, ZBE y el hueco), sin el tope de 3 y, si no caben, en otra línea. El horario y el hueco llevan su frase de
 *  siempre («Horario: de … a …», «En la furgoneta: …») como nombre accesible. */
@Composable
private fun EtiquetasHoja(p: Parada, enZbe: String) {
    val puerta = p.pendiente && p.geo == "puerta"
    val sinPortal = p.pendiente && p.geo == "aprox"
    val zbe = enZbe.takeIf { it.isNotBlank() && p.pendiente }
    if (!(p.porCobrar || p.ventanaDesde != null || p.prioridad || p.tipo == "recogida" || puerta || sinPortal || zbe != null || p.hueco.isNotBlank())) return
    Spacer(Modifier.height(Esp.m))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(Esp.s), verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
        if (p.porCobrar) Etiqueta(tx("Cobrar") + " " + Region.importe(p.cobrar ?: 0.0), Tono.AVISO, Icons.Default.Payments)
        if (p.ventanaDesde != null) Etiqueta("${p.ventanaDesde}–${p.ventanaHasta.orEmpty()}", Tono.NEUTRO, Icons.Default.Schedule,
            modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = tx("Horario: de {a} a {b}", "a" to p.ventanaDesde, "b" to p.ventanaHasta) })
        if (p.prioridad) Etiqueta(tx("Urgente"), Tono.AVISO, Icons.Default.PriorityHigh)
        if (p.tipo == "recogida") Etiqueta(tx("Recogida"))
        if (puerta) Etiqueta(tx("Puerta conocida"), Tono.OK)
        if (sinPortal) Etiqueta(tx("Sin el portal"))
        if (zbe != null) Etiqueta(zbe, Tono.ZONA)
        if (p.hueco.isNotBlank()) Etiqueta(tx(p.hueco), Tono.NEUTRO, Icons.Default.Inventory2,
            modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = tx("En la furgoneta: {x}", "x" to tx(p.hueco)) })
    }
}

/** Los datos de la parada (§5.2), cada uno con su icono y sin «Teléfono:», «Código:», «Lleva:»… a la vista (la frase
 *  entera queda en el nombre accesible); los cortos, de dos en dos; las notas de la puerta (el cliente dice, la
 *  memoria, las notas y la última vez), enteras, con NotasPuerta; la IA, verificada o con su aviso y «Repetir la foto»
 *  al lado; las estrellas del cliente y el motivo de una no entregada. */
@Composable
private fun DatosHoja(p: Parada, alRepetirFoto: () -> Unit) {
    val telefono = p.telefono.takeIf { it.isNotBlank() }
    val codigo = p.codigo.takeIf { it.isNotBlank() }
    val lleva = listOfNotNull(
        p.contenido.takeIf { it.isNotBlank() },
        if (p.bultos > 1) tx("{n} bultos", "n" to p.bultos) else null,
        when { p.escaneos > 1 -> tx("{n} escaneados", "n" to p.escaneos); p.escaneos == 1 -> tx("1 escaneado"); else -> null },
    ).joinToString(" · ")
    val ia = p.entregaIa?.takeIf { p.estado == "entregado" }
    val avisoIa = ia?.takeIf { it.nivel != "verificada" }?.let { textoAvisoIa(it) }?.takeIf { it.isNotBlank() }
    val estrellas = p.valoracion?.takeIf { it.estrellas in 1..5 }?.let { "★".repeat(it.estrellas) + "☆".repeat(5 - it.estrellas) }
    val motivo = p.motivo?.takeIf { it.isNotBlank() && p.estado == "fallido" }
    if (telefono == null && codigo == null && lleva.isBlank() && notasDe(p).isEmpty() && ia == null && estrellas == null && motivo == null) return
    Spacer(Modifier.height(Esp.s))
    if (telefono != null || codigo != null) {
        // F3, 08-11-2026: con la letra a 1,3 o más, uno debajo del otro: de dos en dos, a 360 dp el teléfono se partía por
        // dentro («+34 613 403 / 123») y con la letra a 2,0 también el código («ZX8100000 / 3»).
        if (LocalDensity.current.fontScale >= 1.3f) {
            Column(Modifier.fillMaxWidth()) {
                if (telefono != null) FilaDato(Icons.Default.Call, telefono, tx("Teléfono: {x}", "x" to telefono))
                if (codigo != null) FilaDato(Icons.Default.Receipt, codigo, tx("Código: {x}", "x" to codigo))
            }
        } else {
            Row(Modifier.fillMaxWidth()) {
                if (telefono != null) FilaDato(Icons.Default.Call, telefono, tx("Teléfono: {x}", "x" to telefono), modifier = Modifier.weight(1f))
                if (codigo != null) FilaDato(Icons.Default.Receipt, codigo, tx("Código: {x}", "x" to codigo), modifier = Modifier.weight(1f))
            }
        }
    }
    if (lleva.isNotBlank()) FilaDato(Icons.Default.Inventory2, lleva, tx("Lleva: {x}", "x" to lleva))
    NotasPuerta(p, maxLines = Int.MAX_VALUE, modifier = Modifier.padding(vertical = Esp.xs))
    if (ia != null && ia.nivel == "verificada") FilaDato(Icons.Default.Verified, tx("Entrega verificada por IA"), tx("Entrega verificada por IA"))
    // LA ENTREGA VERIFICADA (01-11-2026): el aviso de la IA y, si pide revisarla, «Repetir la foto» (la parada sigue
    // entregada; el servidor vuelve a mirar la nueva).
    // F3, 08-11-2026: el aviso de la IA entero (§6.3: lo que dice la foto se queda aunque sea largo): con las dos líneas de
    // `Aviso` se cortaba con «…» a 411 dp («…con el número o la p…») y, con la acción al lado, también a 360 dp con la letra a
    // 1,3 (necesita 7 líneas en media fila). Sin tope de líneas y con «Repetir la foto» debajo, a todo el ancho.
    if (avisoIa != null) Aviso(avisoIa, tono = Tono.AVISO, icono = Icons.Default.PhotoCamera,
        accion = if (ia.nivel == "revisar") tx("Repetir la foto") else null, alAccion = alRepetirFoto, maxLineas = Int.MAX_VALUE,
        accionAbajo = true, modifier = Modifier.padding(vertical = Esp.xs))
    if (estrellas != null) FilaDato(Icons.Default.Star, estrellas, tx("Valoración del cliente: {e}", "e" to estrellas))
    if (motivo != null) FilaDato(Icons.Default.ErrorOutline, motivo, tx("Motivo: {x}", "x" to motivo))
}

/** «ENTREGAR» (§5.3): el cobro si lo hay (la etiqueta «Cobrar {x}», «¿Cómo ha pagado?», los métodos en chips y el
 *  importe), «¿Dónde?», «¿Quién lo recoge?» (en mano, al vecino o en portería), la nota, la foto con su miniatura y, en
 *  el pie, «✓ Entregar» (o «Elige cómo ha pagado» mientras falte el método). Lo que se manda al servidor, igual. */
@Composable
fun EntregaHoja(p: Parada, alCerrar: () -> Unit, alConfirmar: (JsonObject) -> Unit) {
    val ctx = LocalContext.current
    val ambito = rememberCoroutineScope()
    var donde by remember { mutableStateOf("") }
    var recibe by remember { mutableStateOf("") }
    var nota by remember { mutableStateOf("") }
    var metodo by remember { mutableStateOf("") }
    var importe by remember { mutableStateOf(p.cobrar?.let { "%.2f".format(it).replace('.', ',') } ?: "") }
    var foto by remember { mutableStateOf<String?>(null) }
    var miniatura by remember { mutableStateOf<Bitmap?>(null) }
    var preparando by remember { mutableStateOf(false) }
    val uri = remember { fotoNueva(ctx) }
    var avisoFoto by remember { mutableStateOf<String?>(null) }
    val hacerFoto = rememberHacerFoto(uri, alAvisar = { avisoFoto = it }) { ok ->
        if (ok) {
            avisoFoto = null
            preparando = true
            ambito.launch {
                val r = withContext(Dispatchers.IO) { comprimir(ctx, uri) }
                foto = r?.first; miniatura = r?.second; preparando = false
            }
        }
    }
    val falta = p.porCobrar && metodo.isEmpty()
    Hoja(
        titulo = tx("Entregar") + " · " + p.cliente.ifBlank { p.direccion }, alCerrar = alCerrar,
        pie = {
            BotonPrincipal(
                if (falta) tx("Elige cómo ha pagado") else tx("Entregar"),
                onClick = {
                    val c = buildMap<String, kotlinx.serialization.json.JsonElement> {
                        if (donde.isNotEmpty()) put("donde", JsonPrimitive(donde))
                        if (recibe.isNotBlank()) put("recibe", JsonPrimitive(recibe.trim()))
                        if (nota.isNotBlank()) put("nota", JsonPrimitive(nota.trim()))
                        foto?.let { put("foto", JsonPrimitive(it)) }
                        if (p.porCobrar) {
                            put("metodo", JsonPrimitive(metodo))
                            importe.replace(',', '.').toDoubleOrNull()?.let { put("importe", JsonPrimitive(it)) }
                        }
                    }
                    alConfirmar(JsonObject(c))
                },
                icono = Icons.Default.Check, tono = Tono.OK, enabled = !falta && !preparando, modifier = Modifier.fillMaxWidth(),
            )
        },
    ) {
        if (p.porCobrar) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Etiqueta(tx("Cobrar") + " " + Region.importe(p.cobrar ?: 0.0), Tono.AVISO, Icons.Default.Payments)
                Spacer(Modifier.width(Esp.s))
                Text(tx("¿Cómo ha pagado?"), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(Esp.s))
            FilaDeChips { Region.metodosCobro.forEach { (k, t) -> ChipOpcion(tx(t), metodo == k, { metodo = k }) } }
            Spacer(Modifier.height(Esp.s))
            CampoTexto(importe, { importe = it }, icono = Icons.Default.Payments, ejemplo = tx("Importe cobrado"),
                teclado = KeyboardOptions(keyboardType = KeyboardType.Decimal))
            Spacer(Modifier.height(Esp.m))
        }
        Rotulo(tx("¿Dónde?"))
        ChipsDonde(donde) { donde = it }
        if (donde in setOf("mano", "vecino", "porteria")) {
            Spacer(Modifier.height(Esp.s))
            CampoTexto(recibe, { recibe = it }, ejemplo = tx("¿Quién lo recoge?"))
        }
        Spacer(Modifier.height(Esp.m))
        CampoTexto(nota, { nota = it }, ejemplo = tx("Nota"), unaLinea = false)
        Spacer(Modifier.height(Esp.m))
        Row(verticalAlignment = Alignment.CenterVertically) {
            BotonNormal(if (foto == null) tx("Foto de la entrega") else tx("Repetir la foto"), hacerFoto, icono = Icons.Default.PhotoCamera,
                tono = Tono.NEUTRO, contorno = true, enabled = !preparando)
            Spacer(Modifier.width(Esp.m))
            if (preparando) CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
            miniatura?.let {
                Image(it.asImageBitmap(), contentDescription = tx("Foto de la entrega"), contentScale = ContentScale.Crop,
                    modifier = Modifier.size(56.dp).clip(MaterialTheme.shapes.small))
            }
        }
        Spacer(Modifier.height(Esp.xs))
        Text(avisoFoto ?: tx("Foto del paquete, sin personas."), style = MaterialTheme.typography.bodySmall,
            color = if (avisoFoto != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** «NO ENTREGADO» (§5.3): «¿Por qué no se ha entregado?», los cinco motivos en una rejilla de dos por fila (se elige
 *  uno), la nota y, en el pie, «No entregado» en peligro con letra blanca, activo al elegir. El texto de los motivos no
 *  cambia (se guarda y se cuenta). `recogida` pone «¿Por qué no se ha recogido?» y «No recogido», como en la web. */
@Composable
fun NoEntregadoHoja(alCerrar: () -> Unit, alConfirmar: (String, String) -> Unit, recogida: Boolean = false) {
    var motivo by remember { mutableStateOf("") }
    var nota by remember { mutableStateOf("") }
    Hoja(
        titulo = if (recogida) tx("¿Por qué no se ha recogido?") else tx("¿Por qué no se ha entregado?"), alCerrar = alCerrar,
        pie = {
            BotonPrincipal(if (recogida) tx("No recogido") else tx("No entregado"), { alConfirmar(motivo, nota.trim()) }, tono = Tono.PELIGRO,
                enabled = motivo.isNotEmpty(), modifier = Modifier.fillMaxWidth())
        },
    ) {
        MOTIVOS.chunked(2).forEach { fila ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Esp.s)) {
                fila.forEach { m ->
                    val elegido = motivo == m
                    BotonNormal(m, { motivo = m }, tono = if (elegido) Tono.MARCA else Tono.NEUTRO, contorno = !elegido,
                        modifier = Modifier.weight(1f).semantics { selected = elegido })
                }
                if (fila.size == 1) Spacer(Modifier.weight(1f))
            }
            Spacer(Modifier.height(Esp.s))
        }
        Spacer(Modifier.height(Esp.xs))
        CampoTexto(nota, { nota = it }, ejemplo = tx("Nota"), unaLinea = false)
    }
}

internal fun fotoNueva(ctx: Context): Uri {
    val f = File(ctx.cacheDir, "fotos").apply { mkdirs() }.resolve("entrega-${System.currentTimeMillis()}.jpg")
    return FileProvider.getUriForFile(ctx, "${ctx.packageName}.fotos", f)
}

/** La foto de la entrega en un JPEG pequeño (el servidor admite hasta 300 KB en base64) y su miniatura. Derecha:
 *  la cámara guarda muchas fotos giradas y lo dice en el EXIF, que al recomprimir se pierde; sin girarla aquí, la
 *  oficina y el cliente la veían tumbada (29-10-2026; la auditoría ya lo hacía). */
internal fun comprimir(ctx: Context, uri: Uri): Pair<String, Bitmap>? = runCatching {
    val opc = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    ctx.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opc) }
    var muestra = 1
    while (maxOf(opc.outWidth, opc.outHeight) / muestra > 1600) muestra *= 2
    val leida = ctx.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = muestra }) } ?: return null
    val grados = when (ctx.contentResolver.openInputStream(uri)?.use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
    }
    val bmp = if (grados == 0f) leida else Bitmap.createBitmap(leida, 0, 0, leida.width, leida.height, Matrix().apply { postRotate(grados) }, true)
    val escala = minOf(1f, 1280f / maxOf(bmp.width, bmp.height))
    val chica = if (escala < 1f) Bitmap.createScaledBitmap(bmp, (bmp.width * escala).toInt(), (bmp.height * escala).toInt(), true) else bmp
    var calidad = 75
    var b64: String
    do {
        val out = ByteArrayOutputStream()
        chica.compress(Bitmap.CompressFormat.JPEG, calidad, out)
        b64 = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        calidad -= 15
    } while (b64.length > 280_000 && calidad > 10)
    b64 to Bitmap.createScaledBitmap(chica, 160, (160f * chica.height / chica.width).toInt().coerceAtLeast(1), true)
}.getOrNull()
