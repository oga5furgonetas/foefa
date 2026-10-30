package com.flotadsp.fds.ui.hoy

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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import com.flotadsp.fds.BuildConfig
import com.flotadsp.fds.data.Antes
import com.flotadsp.fds.data.ClienteDice
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.ui.Acciones
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.Region
import com.flotadsp.fds.ui.rememberHacerFoto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.ByteArrayOutputStream
import java.io.File

private val DONDE = listOf("mano" to tx("En mano"), "vecino" to tx("Al vecino"), "buzon" to tx("En el buzón"), "porteria" to tx("En portería"), "seguro" to tx("En un lugar seguro"))
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

@Composable
fun ParadaHoja(
    p: Parada, prefijo: String, navegarCon: String, empresa: String = "",
    alCerrar: () -> Unit, alEntregar: () -> Unit, alFallar: () -> Unit, alDeshacer: () -> Unit, alEditar: () -> Unit, alQuitar: () -> Unit,
    /** El registro del intento (30-10-2026): «llamada» o «whatsapp» al pulsarlos. */
    alApuntar: (String) -> Unit = {},
) {
    val ctx = LocalContext.current
    var quitar by remember { mutableStateOf(false) }
    var deshacer by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = alCerrar, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 20.dp).navigationBarsPadding().verticalScroll(rememberScrollState())) {
            Text(p.cliente.ifBlank { "Parada" }, style = MaterialTheme.typography.headlineSmall)
            // La dirección ya suele llevar el CP y la población: no se repiten.
            Text((listOf(p.direccion) + listOf(p.cp, p.localidad).filter { it.isNotBlank() && !p.direccion.contains(it, ignoreCase = true) })
                .filter { it.isNotBlank() }.joinToString(", "),
                style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(8.dp))
            Etiquetas(p)
            val datos = listOfNotNull(
                p.telefono.takeIf { it.isNotBlank() }?.let { tx("Teléfono: {x}", "x" to it) },
                p.codigo.takeIf { it.isNotBlank() }?.let { tx("Código: {x}", "x" to it) },
                p.contenido.takeIf { it.isNotBlank() }?.let { tx("Lleva: {x}", "x" to it) },
                p.notas.takeIf { it.isNotBlank() }?.let { tx("Notas: {x}", "x" to it) },
                p.hueco.takeIf { it.isNotBlank() }?.let { tx("En la furgoneta: {x}", "x" to it) },
                if (p.ventanaDesde != null) tx("Horario: de {a} a {b}", "a" to p.ventanaDesde, "b" to p.ventanaHasta) else null,
                p.motivo?.takeIf { it.isNotBlank() && p.estado == "fallido" }?.let { tx("Motivo: {x}", "x" to it) },
                p.antes?.takeIf { p.pendiente }?.let { textoAntes(it) },
                p.clienteDice?.let { textoClienteDice(it) }?.takeIf { it.isNotBlank() }?.let { tx("El cliente dice: {t}", "t" to it) },
            )
            if (datos.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                datos.forEach { Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = 2.dp)) }
            }
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { Acciones.navegar(ctx, p, navegarCon) }, modifier = Modifier.weight(1f).height(50.dp)) {
                    Icon(Icons.Default.Navigation, contentDescription = null); Spacer(Modifier.width(6.dp)); Text(tx("Navegar"))
                }
                FilledTonalButton(onClick = { alApuntar("llamada"); Acciones.llamar(ctx, p.telefono) }, enabled = p.telefono.isNotBlank(), modifier = Modifier.height(50.dp)) {
                    Icon(Icons.Default.Call, contentDescription = tx("Llamar"))
                }
                FilledTonalButton(onClick = { alApuntar("whatsapp"); Acciones.whatsapp(ctx, p.telefono, prefijo, textoWhatsapp(p, empresa)) },
                    enabled = p.telefono.isNotBlank(), modifier = Modifier.height(50.dp)) {
                    Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = tx("WhatsApp"))
                }
            }
            Spacer(Modifier.height(10.dp))
            if (p.pendiente) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = alFallar, modifier = Modifier.weight(1f).height(54.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                        Text(tx("No entregado"), maxLines = 1)
                    }
                    Button(onClick = alEntregar, modifier = Modifier.weight(1.2f).height(54.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = LocalExtra.current.entregado, contentColor = LocalExtra.current.enEntregado)) {
                        Icon(Icons.Default.Check, contentDescription = null); Spacer(Modifier.width(4.dp)); Text(tx("Entregado"))
                    }
                }
            } else {
                // Una entregada vuelve atrás con pregunta: se borra su prueba de entrega (29-10-2026). Una no
                // entregada no tiene nada que perder.
                OutlinedButton(onClick = { if (p.estado == "entregado") deshacer = true else alDeshacer() }, modifier = Modifier.fillMaxWidth().height(50.dp)) {
                    Icon(Icons.AutoMirrored.Filled.Undo, contentDescription = null); Spacer(Modifier.width(6.dp)); Text(tx("Volver a «por entregar»"))
                }
            }
            Spacer(Modifier.height(8.dp))
            HorizontalDivider()
            Row {
                // Cerrada no se edita (el servidor solo deja cambiar la nota): primero «Volver a por entregar».
                if (p.pendiente) TextButton(onClick = alEditar) { Icon(Icons.Default.Edit, contentDescription = null); Spacer(Modifier.width(6.dp)); Text(tx("Editar")) }
                if (p.pendiente) {
                    TextButton(onClick = { quitar = true }, colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                        Icon(Icons.Default.Delete, contentDescription = null); Spacer(Modifier.width(6.dp)); Text(tx("Quitar de la ruta"))
                    }
                }
            }
        }
    }
    if (quitar) {
        AlertDialog(
            onDismissRequest = { quitar = false },
            title = { Text(tx("¿Quitar esta parada?")) },
            text = { Text(tx("{n} sale de tu ruta de hoy.", "n" to p.cliente.ifBlank { p.direccion })) },
            confirmButton = { TextButton(onClick = { quitar = false; alQuitar() }) { Text(tx("Quitar")) } },
            dismissButton = { TextButton(onClick = { quitar = false }) { Text(tx("Cancelar")) } },
        )
    }
    if (deshacer) {
        AlertDialog(
            onDismissRequest = { deshacer = false },
            title = { Text(tx("¿Volver a «por entregar»?")) },
            text = { Text(tx("Se borra la prueba de entrega de {n}: la foto, dónde se dejó, quién lo recogió y la hora.", "n" to p.cliente.ifBlank { p.direccion })) },
            confirmButton = { TextButton(onClick = { deshacer = false; alDeshacer() }) { Text(tx("Volver atrás")) } },
            dismissButton = { TextButton(onClick = { deshacer = false }) { Text(tx("Cancelar")) } },
        )
    }
}

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
    ModalBottomSheet(onDismissRequest = alCerrar, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 20.dp).navigationBarsPadding().verticalScroll(rememberScrollState())) {
            Text(tx("Entregar"), style = MaterialTheme.typography.headlineSmall)
            Text(p.cliente.ifBlank { p.direccion }, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (p.porCobrar) {
                Spacer(Modifier.height(16.dp))
                Text(tx("Cobro de {x}: ¿cómo ha pagado?", "x" to Region.importe(p.cobrar ?: 0.0)), style = MaterialTheme.typography.titleMedium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Region.metodosCobro.forEach { (k, t) -> FilterChip(selected = metodo == k, onClick = { metodo = k }, label = { Text(t) }) }
                }
                OutlinedTextField(importe, { importe = it }, label = { Text(tx("Importe cobrado")) }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
            }
            Spacer(Modifier.height(16.dp))
            Text(tx("¿Dónde lo has dejado? (opcional)"), style = MaterialTheme.typography.titleMedium)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DONDE.forEach { (k, t) -> FilterChip(selected = donde == k, onClick = { donde = if (donde == k) "" else k }, label = { Text(t) }) }
            }
            if (donde in setOf("mano", "vecino", "porteria")) {
                OutlinedTextField(recibe, { recibe = it }, label = { Text(tx("¿Quién lo recoge?")) }, singleLine = true, modifier = Modifier.fillMaxWidth())
            }
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(nota, { nota = it }, label = { Text(tx("Nota (opcional)")) }, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedButton(onClick = hacerFoto, enabled = !preparando) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = null); Spacer(Modifier.width(6.dp))
                    Text(if (foto == null) tx("Foto de la entrega") else tx("Repetir la foto"))
                }
                Spacer(Modifier.width(12.dp))
                if (preparando) CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                miniatura?.let { Image(it.asImageBitmap(), contentDescription = tx("Foto de la entrega"), contentScale = ContentScale.Crop, modifier = Modifier.size(56.dp)) }
            }
            Text(avisoFoto ?: tx("La foto, del paquete en la puerta: sin personas."), style = MaterialTheme.typography.bodySmall,
                color = if (avisoFoto != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(18.dp))
            Button(
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
                enabled = !falta && !preparando,
                modifier = Modifier.fillMaxWidth().height(56.dp),
                colors = ButtonDefaults.buttonColors(containerColor = LocalExtra.current.entregado, contentColor = LocalExtra.current.enEntregado),
            ) { Icon(Icons.Default.Check, contentDescription = null); Spacer(Modifier.width(6.dp)); Text(if (falta) tx("Elige cómo ha pagado") else tx("Confirmar la entrega")) }
        }
    }
}

@Composable
fun NoEntregadoHoja(alCerrar: () -> Unit, alConfirmar: (String, String) -> Unit) {
    var motivo by remember { mutableStateOf("") }
    var nota by remember { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = alCerrar, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 20.dp).navigationBarsPadding()) {
            Text(tx("No entregado"), style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(12.dp))
            Text(tx("¿Qué ha pasado?"), style = MaterialTheme.typography.titleMedium)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MOTIVOS.forEach { m -> FilterChip(selected = motivo == m, onClick = { motivo = m }, label = { Text(m) }) }
            }
            OutlinedTextField(nota, { nota = it }, label = { Text(tx("Nota (opcional)")) }, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(16.dp))
            Button(onClick = { alConfirmar(motivo, nota.trim()) }, enabled = motivo.isNotEmpty(), modifier = Modifier.fillMaxWidth().height(54.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text(tx("Marcar como no entregado")) }
        }
    }
}

private fun fotoNueva(ctx: Context): Uri {
    val f = File(ctx.cacheDir, "fotos").apply { mkdirs() }.resolve("entrega-${System.currentTimeMillis()}.jpg")
    return FileProvider.getUriForFile(ctx, "${ctx.packageName}.fotos", f)
}

/** La foto de la entrega en un JPEG pequeño (el servidor admite hasta 300 KB en base64) y su miniatura. Derecha:
 *  la cámara guarda muchas fotos giradas y lo dice en el EXIF, que al recomprimir se pierde; sin girarla aquí, la
 *  oficina y el cliente la veían tumbada (29-10-2026; la auditoría ya lo hacía). */
private fun comprimir(ctx: Context, uri: Uri): Pair<String, Bitmap>? = runCatching {
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
