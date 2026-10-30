package com.flotadsp.fds.ui.acceso

import com.flotadsp.fds.ui.tx
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.LocalGasStation
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ArchivoMultipart
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.ui.SIN_CAMARA
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.JsonPrimitive
import java.io.ByteArrayOutputStream
import java.io.File

private data class CapturaPendiente(val clave: String, val archivo: File, val uri: Uri)
private data class PuntoRevision(val id: String, val titulo: String)
private val ANGULOS = listOf("frontal" to tx("Frontal"), "trasera" to tx("Trasera"), "lateral_izq" to tx("Lateral izquierdo"), "lateral_der" to tx("Lateral derecho"))
private val PUNTOS = listOf(
    PuntoRevision("neumaticos", tx("Neumáticos")), PuntoRevision("luces", tx("Luces")),
    PuntoRevision("chapa", tx("Chapa y carrocería")), PuntoRevision("puertas", tx("Puertas")),
    PuntoRevision("espejos", tx("Espejos")), PuntoRevision("interior", tx("Interior")),
    PuntoRevision("combustible", tx("Combustible")), PuntoRevision("limpieza", tx("Limpieza")),
)

@Composable
fun AuditoriaConductorNativa(alVolver: () -> Unit, alCompletar: () -> Unit) {
    val ctx = LocalContext.current
    val app = ctx.applicationContext as FdsApp
    val scope = rememberCoroutineScope()
    var paso by remember { mutableIntStateOf(0) }
    var cargando by remember { mutableStateOf(true) }
    var enviando by remember { mutableStateOf(false) }
    var vehiculos by remember { mutableStateOf<JsonArray>(JsonArray(emptyList())) }
    var asignado by remember { mutableStateOf<String?>(null) }
    var yaInspeccionada by remember { mutableStateOf(false) }
    var puedeAuditar by remember { mutableStateOf(true) }
    var motivo by remember { mutableStateOf("") }
    var vehiculo by remember { mutableStateOf<String?>(null) }
    var matricula by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val fotos = remember { mutableStateMapOf<String, ByteArray>() }
    val checklist = remember { mutableStateMapOf<String, String>() }
    var combustible by remember { mutableStateOf<Int?>(null) }
    var rueda by remember { mutableStateOf<String?>(null) }
    var notas by remember { mutableStateOf("") }
    var km by remember { mutableStateOf<Int?>(null) }
    var kmManual by remember { mutableStateOf("") }
    var kmMin by remember { mutableStateOf<Int?>(null) }
    var kmMax by remember { mutableStateOf<Int?>(null) }
    var kmActual by remember { mutableStateOf<Int?>(null) }
    var kmDias by remember { mutableStateOf(1) }
    var procesando by remember { mutableStateOf<String?>(null) }
    var captura by remember { mutableStateOf<CapturaPendiente?>(null) }
    var confirmarSalida by remember { mutableStateOf(false) }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        try {
            val r = app.repo.vehiculosPortal()
            puedeAuditar = r["puede_auditar"]?.jsonPrimitive?.contentOrNull != "false"
            motivo = r["motivo"]?.jsonPrimitive?.contentOrNull.orEmpty()
            vehiculos = r["vehicles"]?.jsonArray ?: JsonArray(emptyList())
            val a = app.repo.vehiculoAsignado()
            val v = a["vehicle"]?.takeUnless { it is kotlinx.serialization.json.JsonNull }?.jsonObject
            asignado = v?.get("id")?.jsonPrimitive?.contentOrNull
            yaInspeccionada = a["already_inspected"]?.jsonPrimitive?.contentOrNull == "true"
        } catch (e: ErrorApi) { error = e.message }
        finally { cargando = false }
    }

    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val item = captura
        captura = null
        if (item == null) return@rememberLauncherForActivityResult
        if (!ok) { item.archivo.delete(); error = tx("No se hizo la foto. Puedes intentarlo de nuevo."); return@rememberLauncherForActivityResult }
        scope.launch {
            procesando = item.clave
            error = null
            try {
                val jpg = withContext(Dispatchers.IO) { comprimirFoto(ctx, item.uri) }
                when {
                    item.clave in ANGULOS.map { it.first } -> {
                        try {
                            val validacion = app.repo.validarFotoInspeccion(vehiculo.orEmpty(), item.clave, jpg)
                            if (validacion["valid"]?.jsonPrimitive?.contentOrNull == "false") {
                                error = validacion["reason"]?.jsonPrimitive?.contentOrNull ?: tx("Foto no válida. Repite la foto de {x}.", "x" to item.clave)
                            } else fotos[item.clave] = jpg
                        } catch (e: ErrorApi) {
                            // La IA falla en abierto; un fallo de servicio no debe borrar una foto válida.
                            fotos[item.clave] = jpg
                            error = tx("La foto se guardó; no se pudo verificar ahora.")
                        }
                    }
                    item.clave == "odometro" -> {
                        fotos[item.clave] = jpg
                        // Si el lector no contesta (sin red, el servidor tarda, un error), la foto se queda y los km se
                        // escriben a mano. Hasta el 29-10-2026 el campo de escribirlos solo salía con la respuesta del
                        // servidor: un conductor avisó de que «no deja subir los km ni la IA ni manual».
                        val lectura = try { app.repo.leerOdometroInspeccion(vehiculo.orEmpty(), jpg) } catch (e: ErrorApi) { null }
                        if (lectura == null) {
                            km = null; kmMin = null; kmMax = null
                            error = tx("No se ha podido leer el cuentakilómetros ahora mismo. Escribe los kilómetros que marca el cuadro.")
                        } else {
                            val aceptada = lectura["aceptada"]?.jsonPrimitive?.contentOrNull == "true"
                            kmActual = lectura["current_mileage"]?.jsonPrimitive?.contentOrNull?.toIntOrNull()
                            kmMin = lectura["manual_min"]?.jsonPrimitive?.contentOrNull?.toIntOrNull()
                            kmMax = lectura["manual_max"]?.jsonPrimitive?.contentOrNull?.toIntOrNull()
                            kmDias = lectura["dias"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() ?: 1
                            km = if (aceptada) lectura["km"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() else null
                            if (!aceptada) error = lectura["motivo"]?.jsonPrimitive?.contentOrNull ?: tx("No se pudieron leer los kilómetros. Revisa la foto y escribe el valor dentro del rango indicado.")
                        }
                    }
                    else -> fotos[item.clave] = jpg
                }
            } catch (e: ErrorApi) { error = e.message }
            catch (_: Exception) { error = tx("No se pudo procesar la foto. Inténtalo de nuevo.") }
            finally { item.archivo.delete(); procesando = null }
        }
    }

    fun abrirCamara(item: CapturaPendiente) {
        try { camera.launch(item.uri) } catch (_: Exception) {
            captura = null; item.archivo.delete()
            error = tx("No se pudo abrir la cámara. Comprueba que tienes una aplicación de cámara instalada.")
        }
    }
    // La app declara el permiso de cámara (lo usa el escáner) y, entonces, Android no deja abrir la cámara del sistema
    // sin él: se pide antes, como en ui/Foto.kt. Sin esto, un conductor que nunca usó el escáner no podía hacer ni una foto.
    val permisoCamara = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        val item = captura
        if (item == null) return@rememberLauncherForActivityResult
        if (ok) abrirCamara(item) else { captura = null; item.archivo.delete(); error = SIN_CAMARA }
    }
    fun hacerFoto(clave: String) {
        val item = try {
            val dir = File(ctx.cacheDir, "fotos").apply { mkdirs() }
            val archivo = File.createTempFile("auditoria_${clave}_", ".jpg", dir)
            CapturaPendiente(clave, archivo, FileProvider.getUriForFile(ctx, "${ctx.packageName}.fotos", archivo))
        } catch (_: Exception) { error = tx("No se pudo preparar la foto. Inténtalo de nuevo."); return }
        captura = item
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) abrirCamara(item)
        else permisoCamara.launch(Manifest.permission.CAMERA)
    }

    BackHandler { if (paso > 0) paso-- else alVolver() }
    Scaffold(topBar = { TopAppBar(
        title = { Text(tx("Auditoría · {n} de 3", "n" to paso + 1)) },
        navigationIcon = { IconButton(onClick = { if (paso > 0) paso-- else alVolver() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = tx("Volver")) } },
    ) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            if (cargando) { CircularProgressIndicator() }
            else if (!puedeAuditar) {
                Text(if (motivo == "suspendido") tx("Hoy no tienes turno asignado.") else tx("Hoy no tienes una furgoneta asignada en el cuadrante. Habla con tu coordinador antes de salir."), style = MaterialTheme.typography.bodyLarge)
                Button(onClick = alVolver, modifier = Modifier.fillMaxWidth()) { Text(tx("Volver al inicio")) }
            } else when (paso) {
                0 -> {
                    Text(tx("Elige la furgoneta de hoy"), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    if (vehiculos.isEmpty()) Text(tx("No hay vehículos disponibles para tu cuenta. Si hoy te corresponde uno, consulta con la oficina."))
                    vehiculos.forEach { el ->
                        val o = el.jsonObject
                        val id = o["id"]?.jsonPrimitive?.contentOrNull.orEmpty()
                        val placa = o["license_plate"]?.jsonPrimitive?.contentOrNull ?: tx("Vehículo")
                        val marca = listOf("brand", "model").mapNotNull { k -> o[k]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() } }.joinToString(" ")
                        Card(onClick = { vehiculo = id; matricula = placa; paso = 1; error = null }, colors = CardDefaults.cardColors(containerColor = if (id == asignado) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant)) {
                            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                                Icon(Icons.Default.DirectionsCar, contentDescription = null)
                                Column(Modifier.weight(1f)) { Text(placa, fontWeight = FontWeight.Bold); Text(marca, style = MaterialTheme.typography.bodySmall) }
                                if (id == asignado && yaInspeccionada) Text(tx("Enviada hoy"), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
                1 -> {
                    Text(matricula, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(tx("Haz las cuatro fotos del vehículo, el cuentakilómetros y el indicador de combustible."))
                    ANGULOS.forEach { (id, label) -> CapturaCard(label, fotos[id] != null, procesando == id) { hacerFoto(id) } }
                    CapturaCard("Cuentakilómetros", fotos["odometro"] != null, procesando == "odometro") { hacerFoto("odometro") }
                    // A mano siempre que la foto no haya dado un número: con el rango del servidor si lo dio, y si no
                    // (el lector no contestó) cualquier km creíble, que el servidor juzga al subir la auditoría.
                    if (km == null && fotos["odometro"] != null) {
                        Text(if (kmMin != null && kmMax != null) tx("La foto no dio una lectura fiable. Indica los kilómetros reales (entre {min} y {max}; último registro {km}, hace {dias} días).", "min" to kmMin, "max" to kmMax, "km" to (kmActual ?: 0), "dias" to kmDias)
                            else tx("El lector no ha contestado: escribe los kilómetros que marca el cuadro. La oficina los revisa."), style = MaterialTheme.typography.bodySmall)
                        OutlinedTextField(kmManual, { kmManual = it.filter(Char::isDigit).take(7) }, label = { Text(tx("Kilómetros")) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                    } else if (km != null) Text(tx("Kilometraje leído: {km} km", "km" to km), color = MaterialTheme.colorScheme.primary)
                    CapturaCard(tx("Foto del combustible"), fotos["combustible"] != null, procesando == "combustible") { hacerFoto("combustible") }
                    Text(tx("¿Cuánto combustible queda?"))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf(10, 25, 50, 75, 100).forEach { v -> FilterChip(selected = combustible == v, onClick = { combustible = v }, label = { Text(if (v == 10) tx("Reserva") else if (v == 100) tx("Lleno") else "$v%") }) } }
                    val kmFinal = km ?: kmManual.toIntOrNull()
                    val kmValido = kmFinal != null && kmFinal > 0 && kmFinal < 1_000_000 && (kmMin == null || kmFinal >= kmMin!!) && (kmMax == null || kmFinal <= kmMax!!)
                    Button(onClick = { paso = 2; error = null }, enabled = fotos.keys.containsAll(ANGULOS.map { it.first }) && fotos["odometro"] != null && kmValido && fotos["combustible"] != null && combustible != null && procesando == null, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text(tx("Continuar · checklist")) }
                }
                else -> {
                    Text(tx("Revisa el estado"), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(tx("Si marcas un elemento como malo o dañado, adjunta una foto para dejar constancia."), style = MaterialTheme.typography.bodySmall)
                    PUNTOS.forEach { punto ->
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(punto.titulo, fontWeight = FontWeight.SemiBold)
                                Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                    listOf("ok" to "OK", "regular" to tx("Regular"), "malo" to tx("Malo"), "danado" to tx("Daño")).forEach { (id, label) ->
                                        FilterChip(selected = checklist[punto.id] == id, onClick = { checklist[punto.id] = id }, label = { Text(label) })
                                    }
                                }
                                if (checklist[punto.id] in listOf("malo", "danado")) CapturaCard(tx("Foto del daño") + (if (fotos["check_${punto.id}"] != null) tx(" · lista") else tx(" · obligatoria")), fotos["check_${punto.id}"] != null, procesando == "check_${punto.id}") { hacerFoto("check_${punto.id}") }
                            }
                        }
                    }
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(tx("Rueda de repuesto"), fontWeight = FontWeight.SemiBold)
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { listOf("si" to tx("Sí"), "no" to tx("No"), "no_se" to tx("No he podido verlo")).forEach { (v, t) -> FilterChip(selected = rueda == v, onClick = { rueda = v }, label = { Text(t) }) } }
                            CapturaCard(tx("Foto de la rueda (opcional)"), fotos["check_rueda_repuesto"] != null, procesando == "check_rueda_repuesto") { hacerFoto("check_rueda_repuesto") }
                        }
                    }
                    OutlinedTextField(notas, { notas = it }, label = { Text(tx("Notas (opcional)")) }, minLines = 2, modifier = Modifier.fillMaxWidth())
                    val faltaFotoDanio = checklist.any { (id, v) -> v in listOf("malo", "danado") && fotos["check_$id"] == null }
                    Button(onClick = {
                        val fotosEnviar = buildList {
                            ANGULOS.forEachIndexed { i, (id, _) -> fotos[id]?.let { add(ArchivoMultipart("files", "angle_${i}_$id.jpg", it)) } }
                            fotos["odometro"]?.let { add(ArchivoMultipart("files", "odometro.jpg", it)) }
                            fotos["combustible"]?.let { add(ArchivoMultipart("files", "combustible.jpg", it)) }
                            fotos.filterKeys { it.startsWith("check_") }.forEach { (id, bytes) -> add(ArchivoMultipart("files", "checklist_${id.removePrefix("check_")}.jpg", bytes)) }
                        }
                        val notasJson = buildJsonObject {
                            put("checklist", buildJsonObject { checklist.forEach { (k, v) -> put(k, v) } })
                            put("notes", notas)
                            put("driver_name", app.cuenta.nombre.value)
                            put("center", app.cuenta.centro.value)
                            put("odometer_km", km ?: kmManual.toIntOrNull() ?: 0)
                            put("odometer_manual", km == null)
                            put("combustible_pct", combustible ?: 0)
                            put("checklist_photo_items", buildJsonArray {
                                fotos.keys.filter { it.startsWith("check_") }.forEach { k ->
                                    val id = k.removePrefix("check_")
                                    val label = PUNTOS.firstOrNull { it.id == id }?.titulo ?: tx("Rueda de repuesto")
                                    add(JsonPrimitive(label))
                                }
                            })
                            put("rueda_repuesto", rueda.orEmpty())
                            put("rueda_repuesto_foto", fotos.containsKey("check_rueda_repuesto"))
                        }.toString()
                        enviando = true; error = null
                        scope.launch {
                            try {
                                var intento = 0
                                while (true) {
                                    intento++
                                    try { app.repo.subirInspeccion(vehiculo.orEmpty(), notasJson, fotosEnviar); break }
                            catch (e: ErrorApi) { if ((e.estado in 400..499) || intento >= 3) throw e; kotlinx.coroutines.delay(2500L * intento) }
                                }
                                alCompletar()
                            } catch (e: ErrorApi) { error = e.message }
                            catch (_: Exception) { error = tx("No se pudo enviar la inspección. Las fotos siguen guardadas en esta pantalla; vuelve a intentarlo con conexión.") }
                            finally { enviando = false }
                        }
                    }, enabled = !enviando && procesando == null && rueda != null && !faltaFotoDanio && fotos.keys.containsAll(ANGULOS.map { it.first }) && fotos["odometro"] != null && fotos["combustible"] != null && combustible != null && (km ?: kmManual.toIntOrNull())?.let { it > 0 && (kmMin == null || it >= kmMin!!) && (kmMax == null || it <= kmMax!!) } == true, modifier = Modifier.fillMaxWidth().height(54.dp)) {
                        if (enviando) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text(tx("Enviar auditoría"))
                    }
                }
            }
            TextButton(onClick = { confirmarSalida = true }, modifier = Modifier.fillMaxWidth()) { Text(tx("Salir de la auditoría")) }
            Spacer(Modifier.height(20.dp))
        }
    }
    if (confirmarSalida) AlertDialog(
        onDismissRequest = { confirmarSalida = false },
        title = { Text(tx("¿Salir de la auditoría?")) },
        text = { Text(tx("Las fotos aún no se han enviado. Si sales, se descartarán y tendrás que empezar de nuevo.")) },
        confirmButton = { TextButton(onClick = { confirmarSalida = false; alVolver() }) { Text(tx("Salir y descartar")) } },
        dismissButton = { TextButton(onClick = { confirmarSalida = false }) { Text(tx("Seguir revisando")) } },
    )
}

@Composable
private fun CapturaCard(titulo: String, lista: Boolean, procesando: Boolean, alHacer: () -> Unit) {
    Card(onClick = alHacer, enabled = !procesando, colors = CardDefaults.cardColors(containerColor = if (lista) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant)) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (procesando) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            else Icon(if (lista) Icons.Default.CheckCircle else Icons.Default.CameraAlt, contentDescription = null)
            Text(titulo, modifier = Modifier.weight(1f), fontWeight = FontWeight.Medium)
            if (lista) Text(tx("Repetir"), style = MaterialTheme.typography.labelSmall)
        }
    }
}

private suspend fun comprimirFoto(context: Context, uri: Uri): ByteArray = withContext(Dispatchers.IO) {
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
        ?: error(tx("No se pudo leer la imagen"))
    var sample = 1
    while (options.outWidth / sample > 1280 || options.outHeight / sample > 1280) sample *= 2
    val bitmap = context.contentResolver.openInputStream(uri)?.use {
        BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
    } ?: error(tx("No se pudo procesar la imagen"))
    var orientada: Bitmap? = null
    try {
        val orientacion = context.contentResolver.openInputStream(uri)?.use { ExifInterface(it).getAttributeInt(
            ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL,
        ) } ?: ExifInterface.ORIENTATION_NORMAL
        val grados = when (orientacion) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        val imagen = if (grados == 0f) bitmap else
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(grados) }, true).also { orientada = it }
        ByteArrayOutputStream().use { out ->
            check(imagen.compress(Bitmap.CompressFormat.JPEG, 78, out)) { tx("No se pudo codificar la imagen") }
            out.toByteArray()
        }
    } finally {
        orientada?.takeIf { it !== bitmap }?.recycle()
        bitmap.recycle()
    }
}
