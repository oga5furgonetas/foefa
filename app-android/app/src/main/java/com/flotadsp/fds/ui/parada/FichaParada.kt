package com.flotadsp.fds.ui.parada

import android.content.Context
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DocumentScanner
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.etiqueta.Lectura
import com.flotadsp.fds.etiqueta.LectorEtiqueta
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.Region
import com.flotadsp.fds.ui.rememberHacerFoto
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Request
import java.io.File

/** Una dirección sugerida: de las suyas (ya estuvo allí) o del buscador de OpenStreetMap. */
data class Sugerencia(val direccion: String, val cp: String, val localidad: String, val lat: Double?, val lng: Double?,
                      val cliente: String = "", val telefono: String = "", val veces: Int = 0)

/* LA FICHA DE UNA PARADA: nueva, editar, o revisar lo leído de una etiqueta. Al escribir la dirección salen
   primero las suyas («Ya estuviste aquí»), con su cliente y teléfono, y después las del buscador; al tocar una,
   la parada entra con su punto exacto en el mapa. «Leer la etiqueta» hace una foto y la lee en el móvil. */
@Composable
fun FichaParada(
    pais: String,
    /** Dónde se reparte (la base o las paradas): las sugerencias de cerca salen primero, como en la web. */
    cerca: Pair<Double, Double>? = null,
    inicial: Lectura? = null,
    editar: Parada? = null,
    alCerrar: (guardada: Boolean) -> Unit,
) {
    val ctx = LocalContext.current
    val repo = (ctx.applicationContext as FdsApp).repo
    val ambito = rememberCoroutineScope()
    var direccion by remember { mutableStateOf(editar?.direccion ?: inicial?.let { listOf(it.direccion, it.cp, it.localidad).filter { s -> s.isNotBlank() }.joinToString(", ") } ?: "") }
    var cliente by remember { mutableStateOf(editar?.cliente ?: inicial?.cliente ?: "") }
    var telefono by remember { mutableStateOf(editar?.telefono ?: inicial?.telefono ?: "") }
    var notas by remember { mutableStateOf(editar?.notas ?: "") }
    var bultos by remember { mutableStateOf(editar?.bultos ?: 1) }
    var cobrar by remember { mutableStateOf(editar?.cobrar?.takeIf { it > 0 }?.let { "%.2f".format(it).replace('.', ',') } ?: "") }
    var tipo by remember { mutableStateOf(editar?.tipo ?: "entrega") }
    var urgente by remember { mutableStateOf(editar?.prioridad ?: false) }
    var punto by remember { mutableStateOf(inicial?.takeIf { it.lat != null }?.let { Sugerencia("", it.cp, it.localidad, it.lat, it.lng) }) }
    var sugerencias by remember { mutableStateOf<List<Sugerencia>>(emptyList()) }
    var elegida by remember { mutableStateOf(editar != null || inicial?.completa == true) }
    var leyendo by remember { mutableStateOf(false) }
    var guardando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var aviso by remember {
        mutableStateOf(when {
            inicial == null || editar != null -> null
            // Del escáner sin nada legible (la barra sola y la letra fuera del encuadre): decirlo, no «revisa lo leído».
            inicial.direccion.isBlank() && inicial.cliente.isBlank() && inicial.telefono.isBlank() ->
                "El código no trae la dirección y no se ha podido leer de la etiqueta. Escríbela, o pulsa «Leer la etiqueta con una foto» con la etiqueta entera en la foto."
            else -> "Revisa lo leído de la etiqueta antes de guardar."
        })
    }
    BackHandler { alCerrar(false) }

    // Sugerencias mientras escribe (con una pausa, para no preguntar en cada letra).
    LaunchedEffect(direccion, elegida) {
        if (elegida || direccion.trim().length < 4) { sugerencias = emptyList(); return@LaunchedEffect }
        delay(350)
        val q = direccion.trim()
        val suyas = runCatching { repo.direccionesConocidas(q) }.getOrDefault(emptyList()).map {
            Sugerencia(it.direccion, it.cp, it.localidad, it.lat, it.lng, it.cliente, it.telefono, it.veces)
        }
        val osm = withContext(Dispatchers.IO) { buscarEnMapa(repo.api.http, q, pais, cerca) }
        sugerencias = (suyas + osm.filter { o -> suyas.none { it.direccion.equals(o.direccion, true) } }).take(7)
    }

    val ocr = remember { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
    val uriFoto = remember { fotoEtiqueta(ctx) }
    val hacerFoto = rememberHacerFoto(uriFoto, alAvisar = { aviso = it }) { ok ->
        if (!ok) return@rememberHacerFoto
        leyendo = true
        ambito.launch {
            val texto = runCatching { ocr.process(InputImage.fromFilePath(ctx, uriFoto)).await().text }.getOrNull()
            leyendo = false
            val l = texto?.let { LectorEtiqueta.leerTexto(it, pais) }
            if (l == null || (l.direccion.isBlank() && l.telefono.isBlank() && l.cliente.isBlank())) {
                aviso = "No se ha podido leer la etiqueta. Prueba con más luz y la etiqueta recta, o escríbelo."
                return@launch
            }
            if (l.direccion.isNotBlank()) {
                direccion = listOf(l.direccion, l.cp, l.localidad).filter { it.isNotBlank() }.joinToString(", "); elegida = false; punto = null
            }
            if (cliente.isBlank()) cliente = l.cliente
            if (telefono.isBlank() && (l.telefonoRotulado || !Regex("\\b[A-Z]{1,4}\\d{6,}\\b", RegexOption.IGNORE_CASE).containsMatchIn(texto))) telefono = l.telefono
            aviso = "Revisa lo leído de la etiqueta antes de guardar."
        }
    }

    fun guardar() {
        if (direccion.trim().length < 4) { error = "Escribe la dirección: calle, número y población."; return }
        guardando = true; error = null
        ambito.launch {
            val c = buildMap<String, JsonElement> {
                put("direccion", JsonPrimitive(direccion.trim()))
                put("cliente", JsonPrimitive(cliente.trim())); put("telefono", JsonPrimitive(telefono.trim()))
                put("notas", JsonPrimitive(notas.trim())); put("bultos", JsonPrimitive(bultos))
                put("cobrar", JsonPrimitive(cobrar.replace(',', '.').trim())); put("tipo", JsonPrimitive(tipo))
                put("prioridad", JsonPrimitive(urgente))
                punto?.let { s ->
                    if (s.lat != null && s.lng != null) { put("lat", JsonPrimitive(s.lat)); put("lng", JsonPrimitive(s.lng)) }
                    if (s.cp.isNotBlank()) put("cp", JsonPrimitive(s.cp))
                    if (s.localidad.isNotBlank()) put("localidad", JsonPrimitive(s.localidad))
                }
                if (editar == null && inicial != null) {
                    if (inicial.codigo.isNotBlank()) put("codigo", JsonPrimitive(inicial.codigo))
                    if (inicial.codigos.isNotEmpty()) put("codigos", JsonArray(inicial.codigos.map { JsonPrimitive(it) }))
                    put("de_ticket", JsonPrimitive(true))
                }
                if (editar != null) {
                    put("contenido", JsonPrimitive(editar.contenido)); put("hueco", JsonPrimitive(editar.hueco))
                    put("horario", JsonPrimitive(if (editar.ventanaDesde != null) "de ${editar.ventanaDesde} a ${editar.ventanaHasta}" else ""))
                }
            }
            try {
                if (editar != null) repo.editarParada(editar.id, JsonObject(c)) else repo.nuevaParada(JsonObject(c))
                alCerrar(true)
            } catch (e: ErrorApi) {
                error = if (e.sinRed) "Sin conexión: para guardar una parada nueva hace falta red." else e.message
            } finally { guardando = false }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(when { editar != null -> "Editar parada"; inicial != null -> "Revisa la parada"; else -> "Nueva parada" }) },
                navigationIcon = { IconButton(onClick = { alCerrar(false) }) { Icon(Icons.Default.Close, contentDescription = "Cerrar") } },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
            if (editar == null) {
                OutlinedButton(onClick = hacerFoto, enabled = !leyendo, modifier = Modifier.fillMaxWidth().height(50.dp)) {
                    if (leyendo) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Icon(Icons.Default.DocumentScanner, contentDescription = null)
                    Spacer(Modifier.width(8.dp)); Text(if (leyendo) "Leyendo la etiqueta…" else "Leer la etiqueta con una foto")
                }
                Spacer(Modifier.height(12.dp))
            }
            aviso?.let {
                Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
                    Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(12.dp))
                }
                Spacer(Modifier.height(12.dp))
            }
            OutlinedTextField(
                value = direccion, onValueChange = { direccion = it; elegida = false; punto = null },
                label = { Text("Dirección") }, placeholder = { Text("Calle, número y población") },
                leadingIcon = { Icon(Icons.Default.Place, contentDescription = null) },
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth(),
            )
            if (sugerencias.isNotEmpty()) {
                Surface(color = MaterialTheme.colorScheme.surfaceContainerLowest, shape = MaterialTheme.shapes.small, tonalElevation = 2.dp,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
                    Column {
                        sugerencias.forEach { s ->
                            Surface(onClick = {
                                direccion = s.direccion; punto = s; elegida = true; sugerencias = emptyList()
                                if (cliente.isBlank()) cliente = s.cliente
                                if (telefono.isBlank()) telefono = s.telefono
                            }, color = MaterialTheme.colorScheme.surfaceContainerLowest) {
                                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(if (s.veces > 0) Icons.Default.History else Icons.Default.Place, contentDescription = null,
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Spacer(Modifier.width(12.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(s.direccion, style = MaterialTheme.typography.bodyLarge)
                                        if (s.veces > 0) {
                                            Text("Ya estuviste aquí · ${s.veces} ${if (s.veces == 1) "vez" else "veces"}${s.cliente.takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""}",
                                                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(cliente, { cliente = it }, label = { Text("Cliente") }, singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(telefono, { telefono = it }, label = { Text("Teléfono") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(notas, { notas = it }, label = { Text("Notas (portal, piso, horario…)") }, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(14.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Bultos", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                FilledTonalIconButton(onClick = { if (bultos > 1) bultos -= 1 }) { Icon(Icons.Default.Remove, contentDescription = "Uno menos") }
                Text("$bultos", style = MaterialTheme.typography.titleLarge.merge(TextoNumero), modifier = Modifier.padding(horizontal = 14.dp))
                FilledTonalIconButton(onClick = { if (bultos < 99) bultos += 1 }) { Icon(Icons.Default.Add, contentDescription = "Uno más") }
            }
            Spacer(Modifier.height(10.dp))
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf("entrega" to "Entrega", "recogida" to "Recogida").forEachIndexed { i, (k, t) ->
                    SegmentedButton(selected = tipo == k, onClick = { tipo = k }, shape = SegmentedButtonDefaults.itemShape(i, 2)) { Text(t) }
                }
            }
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(cobrar, { cobrar = it }, label = { Text("A cobrar (${Region.simbolo}, opcional)") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth().toggleable(urgente, role = Role.Switch) { urgente = it }.padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text("Urgente", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                Switch(checked = urgente, onCheckedChange = null)
            }
            error?.let { Spacer(Modifier.height(8.dp)); Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
            Spacer(Modifier.height(16.dp))
            Button(onClick = ::guardar, enabled = !guardando, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                if (guardando) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                else Text(if (editar != null) "Guardar cambios" else "Añadir a mi ruta")
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

private fun fotoEtiqueta(ctx: Context): Uri {
    val f = File(ctx.cacheDir, "fotos").apply { mkdirs() }.resolve("etiqueta.jpg")
    return FileProvider.getUriForFile(ctx, "${ctx.packageName}.fotos", f)
}

/** El buscador de direcciones de OpenStreetMap (Photon, sin clave), como en la web. Sin red: nada. */
private fun buscarEnMapa(http: okhttp3.OkHttpClient, q: String, pais: String, cerca: Pair<Double, Double>?): List<Sugerencia> = runCatching {
    val url = "https://photon.komoot.io/api/".toHttpUrl().newBuilder().addQueryParameter("q", q).addQueryParameter("limit", "8")
        .apply { cerca?.let { (la, lo) -> addQueryParameter("lat", "$la"); addQueryParameter("lon", "$lo") } }.build()
    http.newCall(Request.Builder().url(url).header("User-Agent", "FDS-Android").build()).execute().use { r ->
        if (!r.isSuccessful) return emptyList()
        val j = com.flotadsp.fds.data.JSON.parseToJsonElement(r.body?.string().orEmpty()).jsonObject
        j["features"]?.jsonArray.orEmpty().mapNotNull { f ->
            val p = f.jsonObject["properties"]?.jsonObject ?: return@mapNotNull null
            val c = f.jsonObject["geometry"]?.jsonObject?.get("coordinates")?.jsonArray ?: return@mapNotNull null
            fun t(k: String) = p[k]?.jsonPrimitive?.contentOrNull.orEmpty()
            val cc = t("countrycode").lowercase()
            if (pais.isNotBlank() && cc.isNotBlank() && cc != pais) return@mapNotNull null
            val calle = t("street").ifBlank { t("name") }
            if (calle.isBlank()) return@mapNotNull null
            val pueblo = t("city").ifBlank { t("town") }.ifBlank { t("village") }.ifBlank { t("district") }
            val linea1 = listOf(calle, t("housenumber")).filter { it.isNotBlank() }.joinToString(" ")
            val linea2 = listOf(t("postcode"), pueblo).filter { it.isNotBlank() }.joinToString(" ")
            Sugerencia(listOf(linea1, linea2).filter { it.isNotBlank() }.joinToString(", "), t("postcode"), pueblo,
                c.getOrNull(1)?.jsonPrimitive?.doubleOrNull, c.getOrNull(0)?.jsonPrimitive?.doubleOrNull)
        }.distinctBy { it.direccion }.take(5)
    }
}.getOrDefault(emptyList())
