// diseño compacto
package com.flotadsp.fds.ui.parada

import com.flotadsp.fds.ui.tx
import android.content.Context
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.StickyNote2
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.etiqueta.Lectura
import com.flotadsp.fds.etiqueta.LectorEtiqueta
import com.flotadsp.fds.data.Ubicado
import com.flotadsp.fds.ui.Alto
import com.flotadsp.fds.ui.Aviso
import com.flotadsp.fds.ui.BotonIcono
import com.flotadsp.fds.ui.BotonNormal
import com.flotadsp.fds.ui.BotonPrincipal
import com.flotadsp.fds.ui.BotonTexto
import com.flotadsp.fds.ui.Cabecera
import com.flotadsp.fds.ui.CampoTexto
import com.flotadsp.fds.ui.ChipOpcion
import com.flotadsp.fds.ui.Esp
import com.flotadsp.fds.ui.FilaDeChips
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.Menu
import com.flotadsp.fds.ui.Opcion
import com.flotadsp.fds.ui.Segmentado
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.Tono
import com.flotadsp.fds.ui.Region
import com.flotadsp.fds.ui.hoy.Calle
import com.flotadsp.fds.ui.hoy.GeoMovil
import com.flotadsp.fds.ui.hoy.Punto
import com.flotadsp.fds.ui.hoy.Situar
import com.flotadsp.fds.ui.hoy.SituarPantalla
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
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Request
import java.io.File
import java.util.Locale

/* Los atajos del horario (30-10-2026): «Cierra a las 14:00» es lo que un repartidor con diez años de oficio hacía a
   mano (primero los comercios, luego la ruta). Y los seis huecos de la furgoneta, como en la web. Los rótulos, cortos
   desde el diseño compacto (07-11-2026, §5.9): «9–14», «16–20» y «Hasta 14:00»; lo que guardan, igual. */
private val ATAJOS_HORARIO = listOf("9–14" to "9-14", "16–20" to "16-20", tx("Hasta 14:00") to "8-14")
private val HUECOS = listOf(tx("Delante · izq"), tx("Delante · der"), tx("Medio · izq"), tx("Medio · der"), tx("Detrás · izq"), tx("Detrás · der"))

/** Una dirección sugerida: de las suyas (ya estuvo allí), del servidor, del móvil o del buscador de OpenStreetMap.
 *  EL PRIMER PAQUETE BIEN SITUADO (02-11-2026): con su `precision` si se sabe («portal», «calle») y su `fuente`
 *  («servidor», «suya», «movil», «photon»; «mapa» o «sugerencia» si se eligió en «Situar en el mapa»). `otraCalle`:
 *  de OTRA calle que la de la parada (Situar.ordenar; desde el 03-11-2026, de cualquier fuente menos las suyas, y las
 *  del móvil o de Photon que ni comparten el nombre con lo buscado ya no salen): va al final y se dice («Otra calle»);
 *  elegirla pone su dirección (Situar.alElegir). */
data class Sugerencia(val direccion: String, val cp: String, val localidad: String, val lat: Double?, val lng: Double?,
                      val cliente: String = "", val telefono: String = "", val veces: Int = 0,
                      val precision: String = "", val fuente: String = "", val otraCalle: Boolean = false)

/* LA FICHA DE UNA PARADA: nueva, editar, o revisar lo leído de una etiqueta. Al escribir la dirección salen
   primero las suyas («Ya estuviste aquí»), con su cliente y teléfono, y después las del buscador; al tocar una,
   la parada entra con su punto exacto en el mapa. «Leer la etiqueta» hace una foto y la lee en el móvil.
   EL PRIMER PAQUETE BIEN SITUADO (02-11-2026): debajo de la dirección se dice ANTES de guardar si el servidor la
   encuentra (POST /reparto/ubicar): «En el mapa», «Calle encontrada, sin el portal» o «No la encuentro»; sus
   candidatos van los primeros en las sugerencias, con las del móvil, y «Situar en el mapa» la pone a mano. */
@Composable
fun FichaParada(
    pais: String,
    /** Dónde se reparte (la base o las paradas): las sugerencias de cerca salen primero, como en la web. */
    cerca: Pair<Double, Double>? = null,
    inicial: Lectura? = null,
    editar: Parada? = null,
    alCerrar: (guardada: Boolean) -> Unit,
    /** Guardada: la parada como la devuelve el servidor (para decir si quedó sin situar). De serie, cerrar. */
    alGuardada: (Parada?) -> Unit = { alCerrar(true) },
    /** «Quitar de la ruta» en el ⋮ de «Editar parada» (07-11-2026, §5.9): quien llama quita la parada y cierra la
     *  ficha. null (de serie) = sin el ⋮, como hasta ahora. */
    alQuitar: (() -> Unit)? = null,
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
    // Qué lleva, el horario del cliente y el hueco en la furgoneta (30-10-2026): la web ya los tenía y aquí faltaban.
    var contenido by remember { mutableStateOf(editar?.contenido ?: "") }
    var horario by remember { mutableStateOf(editar?.ventanaDesde?.let { "$it-${editar.ventanaHasta}" } ?: "") }
    var hueco by remember { mutableStateOf(editar?.hueco ?: "") }
    // El punto elegido (03-11-2026): su `direccion` es el texto con el que se puso; si ya no es el escrito, al guardar
    // no va nada de él (Situar.loDelPunto).
    var punto by remember { mutableStateOf(inicial?.takeIf { it.lat != null }?.let { Sugerencia(direccion, it.cp, it.localidad, it.lat, it.lng) }) }
    var sugerencias by remember { mutableStateOf<List<Sugerencia>>(emptyList()) }
    // Lo leído de una etiqueta se comprueba al abrir (antes, con CP o población se daba por bueno sin mirar).
    var elegida by remember { mutableStateOf(editar != null || punto != null) }
    /** Lo que dice el servidor de la dirección escrita: "" (sin mirar), «buscando», «portal», «calle», «no» o «sinred». */
    var estadoDir by remember { mutableStateOf(editar?.let { Situar.estadoDe(it) } ?: if (punto != null) "portal" else "") }
    var ubicado by remember { mutableStateOf<Ubicado?>(null) }
    /** La persona ha escrito en la dirección: las sugerencias salen siempre; si no, solo si no se encuentra. */
    var tocada by remember { mutableStateOf(false) }
    var situarAbierto by remember { mutableStateOf(false) }
    val foco = remember { FocusRequester() }
    val teclado = LocalSoftwareKeyboardController.current
    var leyendo by remember { mutableStateOf(false) }
    var guardando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var aviso by remember {
        mutableStateOf(when {
            inicial == null || editar != null -> null
            // Del escáner sin nada legible (la barra sola y la letra fuera del encuadre): decirlo, no «revisa lo leído».
            inicial.direccion.isBlank() && inicial.cliente.isBlank() && inicial.telefono.isBlank() ->
                tx("El código no trae la dirección y no se ha podido leer de la etiqueta. Escríbela, o pulsa «Leer la etiqueta con una foto» con la etiqueta entera en la foto.")
            // El nombre o el teléfono sí, la dirección no (02-11-2026): decirlo claro, no «revisa lo leído».
            inicial.direccion.isBlank() ->
                tx("No se ha podido leer la dirección de la etiqueta: escríbela, o pulsa «Leer la etiqueta con una foto».")
            else -> tx("Revisa lo leído de la etiqueta antes de guardar.")
        })
    }
    BackHandler { alCerrar(false) }
    // Sin la dirección de la etiqueta, el cursor ya en la dirección y el teclado fuera (02-11-2026).
    LaunchedEffect(Unit) {
        if (editar == null && inicial != null && inicial.direccion.isBlank()) {
            delay(300)
            runCatching { foco.requestFocus() }
            teclado?.show()
        }
    }
    val cercaPunto = cerca?.let { Punto(it.first, it.second) }
    // El CP y la población de la etiqueta (o de la sugerencia) solo mientras sigan escritos en la dirección: si se ha
    // cambiado de pueblo a mano, no se busca con los de antes.
    val escrita = Calle.sinAcentos(direccion)
    val cpConsulta = (punto?.cp?.takeIf { it.isNotBlank() } ?: inicial?.cp.orEmpty()).takeIf { Calle.sinAcentos(it) in escrita }.orEmpty()
    val locConsulta = (punto?.localidad?.takeIf { it.isNotBlank() } ?: inicial?.localidad.orEmpty()).takeIf { Calle.sinAcentos(it) in escrita }.orEmpty()

    // Sugerencias mientras escribe (con una pausa, para no preguntar en cada letra). Con 8 letras o más, además, lo que
    // dice el servidor (POST /reparto/ubicar: «En el mapa», «Calle encontrada…», «No la encuentro») y el móvil.
    LaunchedEffect(direccion, elegida) {
        val q = direccion.trim()
        if (elegida) { sugerencias = emptyList(); return@LaunchedEffect }
        if (q.length < 4) { sugerencias = emptyList(); estadoDir = ""; ubicado = null; return@LaunchedEffect }
        delay(350)
        // Las suyas con su precisión (03-11-2026: «calle» si la última vez quedó en la calle, y así se vuelve a mandar).
        val suyas = runCatching { repo.direccionesConocidas(q) }.getOrDefault(emptyList()).map { Situar.deSuya(it) }
        val osm = withContext(Dispatchers.IO) { buscarEnMapa(repo.api.http, q, pais, cerca) }
        // En la ficha, lo buscado y la dirección de la parada son lo mismo: lo escrito (Situar.ordenar, 03-11-2026), con
        // el CP y la población de la etiqueta mientras sigan escritos (el mismo sitio: «Otra calle» si es otro).
        sugerencias = Situar.ordenar(emptyList(), suyas, emptyList(), osm, buscado = q, cp = cpConsulta, localidad = locConsulta)
        if (q.length < 8) { estadoDir = ""; ubicado = null; return@LaunchedEffect }
        estadoDir = "buscando"
        delay(350)
        var sinRed = false
        val u = try { repo.ubicar(q, cpConsulta, locConsulta) } catch (_: ErrorApi) { sinRed = true; null }
        val movil = GeoMovil.buscar(ctx, Situar.consulta(q, cpConsulta, locConsulta, GeoMovil.nombrePais(pais)), cercaPunto)
            ?.mapNotNull { Situar.deMovil(it, pais, q, cpConsulta, locConsulta) }.orEmpty()
        ubicado = u
        estadoDir = when { u != null -> Situar.estado(u.encontrada, u.precision); sinRed -> "sinred"; else -> "" }
        sugerencias = Situar.ordenar(u?.candidatos.orEmpty().mapNotNull { Situar.deServidor(it) }, suyas, movil, osm, buscado = q,
            cp = cpConsulta, localidad = locConsulta)
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
                aviso = tx("No se ha podido leer la etiqueta. Prueba con más luz y la etiqueta recta, o escríbelo.")
                return@launch
            }
            if (l.direccion.isNotBlank()) {
                direccion = listOf(l.direccion, l.cp, l.localidad).filter { it.isNotBlank() }.joinToString(", "); elegida = false; punto = null
                estadoDir = ""
            }
            if (cliente.isBlank()) cliente = l.cliente
            if (telefono.isBlank() && (l.telefonoRotulado || !Regex("\\b[A-Z]{1,4}\\d{6,}\\b", RegexOption.IGNORE_CASE).containsMatchIn(texto))) telefono = l.telefono
            aviso = tx("Revisa lo leído de la etiqueta antes de guardar.")
        }
    }

    fun guardar() {
        if (direccion.trim().length < 4) {
            error = tx("Escribe la dirección: calle, número y población.")
            runCatching { foco.requestFocus() }
            return
        }
        guardando = true; error = null
        ambito.launch {
            val c = buildMap<String, JsonElement> {
                put("direccion", JsonPrimitive(direccion.trim()))
                put("cliente", JsonPrimitive(cliente.trim())); put("telefono", JsonPrimitive(telefono.trim()))
                put("notas", JsonPrimitive(notas.trim())); put("bultos", JsonPrimitive(bultos))
                put("cobrar", JsonPrimitive(cobrar.replace(',', '.').trim())); put("tipo", JsonPrimitive(tipo))
                put("prioridad", JsonPrimitive(urgente))
                put("contenido", JsonPrimitive(contenido.trim())); put("horario", JsonPrimitive(horario.trim())); put("hueco", JsonPrimitive(hueco))
                // El punto y de dónde sale (02-11-2026): puesto en el mapa, o una sugerencia elegida (los de la etiqueta,
                // sin origen); y la calle sin el portal, con "precision": "calle" (03-11-2026: si no, el servidor la
                // dejaba «manual» y al reabrirla decía «En el mapa», como la puerta). Situar.cuerpoPunto. Con su CP y su
                // población solo si es el punto de lo escrito (03-11-2026, Situar.loDelPunto): si no, el servidor busca
                // la dirección escrita.
                putAll(Situar.loDelPunto(direccion, punto))
                if (editar == null && inicial != null) {
                    if (inicial.codigo.isNotBlank()) put("codigo", JsonPrimitive(inicial.codigo))
                    if (inicial.codigos.isNotEmpty()) put("codigos", JsonArray(inicial.codigos.map { JsonPrimitive(it) }))
                    put("de_ticket", JsonPrimitive(true))
                }
            }
            try {
                val p = if (editar != null) repo.editarParada(editar.id, JsonObject(c)) else repo.nuevaParada(JsonObject(c))
                alGuardada(p)
            } catch (e: ErrorApi) {
                error = if (e.sinRed) tx("Sin conexión: para guardar una parada nueva hace falta red.") else e.message
            } finally { guardando = false }
        }
    }

    if (situarAbierto) {
        // Dónde empieza el mapa: el punto elegido, lo que encontró el servidor, el de la parada, o donde se reparte.
        val inicio = punto?.let { s -> if (s.lat != null && s.lng != null) Punto(s.lat, s.lng) to 18.0 else null }
            ?: ubicado?.let { u -> if (u.lat != null && u.lng != null) Punto(u.lat, u.lng) to (if (u.precision == "zona") 15.0 else 17.0) else null }
            ?: editar?.let { Situar.centro(it, null, emptyList()) }
            ?: cercaPunto?.let { it to 14.0 }
        SituarPantalla(
            direccion = direccion.trim(), cp = cpConsulta, localidad = locConsulta, cliente = cliente.trim(),
            inicio = inicio, pais = pais, cerca = cercaPunto,
            onCerrar = { situarAbierto = false },
            onElegir = { pt, origen, s ->
                situarAbierto = false
                // Con una sugerencia bajo la chincheta, lo que ella sea (02-11-2026, visto en el emulador: una «Sin el
                // portal» dejaba «En el mapa» y la dirección sin el número). UN SOLO SITIO QUE DECIDE (03-11-2026):
                // Situar.alElegir con lo escrito en la ficha (D, no lo del buscador de «Situar»), venga de donde venga:
                // también una del servidor de otra calle (antes dejaba lo escrito con su punto) y una de las suyas
                // (antes ni pasaba por aquí: ahora, tal cual, con su cliente y su teléfono si faltaban). Puesto a mano en
                // el mapa, es la puerta y lo escrito no cambia.
                val el = if (origen == "sugerencia" && s != null) Situar.alElegir(direccion, s, cpConsulta, locConsulta) else null
                if (el != null) {
                    direccion = el.direccion
                    if (s?.fuente == "suya") {
                        if (cliente.isBlank()) cliente = s.cliente
                        if (telefono.isBlank()) telefono = s.telefono
                    }
                }
                val escritaAhora = Calle.sinAcentos(direccion)
                fun siEsta(x: String?) = x.orEmpty().takeIf { it.isNotBlank() && Calle.sinAcentos(it) in escritaAhora }.orEmpty()
                val precision = el?.precision ?: "portal"
                punto = Sugerencia(direccion.trim(), el?.cp ?: siEsta(s?.cp), el?.localidad ?: siEsta(s?.localidad), pt.lat, pt.lng,
                    precision = precision, fuente = origen)
                elegida = true; sugerencias = emptyList(); estadoDir = precision
            },
        )
    }

    var quitar by remember { mutableStateOf(false) }
    // «Más datos» (07-11-2026, §5.9): cerrado salvo que algo de dentro ya tenga datos.
    var masDatos by remember { mutableStateOf(contenido.isNotBlank() || horario.isNotBlank() || hueco.isNotBlank() || bultos != 1 || urgente || tipo != "entrega" || cobrar.isNotBlank()) }
    val c = MaterialTheme.colorScheme
    val titulo = when { editar != null -> tx("Editar parada"); inicial != null -> tx("Revisa la parada"); else -> tx("Nueva parada") }
    Scaffold(
        topBar = {
            Cabecera(titulo, alVolver = { alCerrar(false) }, cerrar = true, acciones = {
                if (editar != null && alQuitar != null) Menu(listOf(Opcion(tx("Quitar de la ruta"), Icons.Default.Delete, peligro = true) { quitar = true }))
            })
        },
        containerColor = c.background,
    ) { pad ->
        // EL DISEÑO COMPACTO (07-11-2026, §5.9): el pie va fijo y sube con el teclado; solo se desplaza lo de arriba, así
        // que el botón de guardar está siempre a la vista (antes quedaba unos 1.300 dp más abajo).
        Column(Modifier.padding(pad).fillMaxSize().imePadding()) {
            Column(
                Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = Esp.l).padding(top = Esp.xs, bottom = Esp.l),
                verticalArrangement = Arrangement.spacedBy(Esp.m),
            ) {
                if (editar == null) {
                    Column {
                        BotonNormal(if (leyendo) tx("Leyendo…") else tx("Foto etiqueta"), hacerFoto, icono = Icons.Default.PhotoCamera, tono = Tono.NEUTRO,
                            enabled = !leyendo, modifier = Modifier.fillMaxWidth())
                        Text(tx("Se lee en el móvil"), style = MaterialTheme.typography.bodySmall, color = c.onSurfaceVariant,
                            modifier = Modifier.padding(start = Esp.m, top = Esp.xs))
                    }
                }
                aviso?.let { Aviso(it, icono = Icons.Default.Info, maxLineas = 6) }
                Column(verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
                    CampoTexto(
                        valor = direccion, alCambiar = {
                            direccion = it; tocada = true
                            // AL CAMBIAR EL TEXTO (escribir o dictar), FUERA EL PUNTO, VENGA DE DONDE VENGA (03-11-2026, la
                            // revisión): el de la lista, el de «Situar la parada» con una sugerencia y el puesto a mano en el mapa,
                            // con el CP, la población, el origen y la precisión que vinieron con él (van en `punto`). Antes el de
                            // «Situar» se quedaba: «Rúa Brétema Mariñeira 23» reescrita se guardaba con el punto de Oleiros,
                            // «sugerencia», «calle», 15179 y Oleiros. Al guardar, el servidor busca lo escrito.
                            elegida = false; punto = null; estadoDir = ""
                        },
                        icono = Icons.Default.Place, ejemplo = tx("Dirección completa"), nombre = tx("Dirección"),
                        teclado = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                        modifier = Modifier.fillMaxWidth().focusRequester(foco),
                    )
                    EstadoDireccion(estadoDir, alSituar = { situarAbierto = true })
                    // Lo leído de una etiqueta que el servidor ya encuentra no abre la lista: solo si no la encuentra o si se escribe.
                    if (sugerencias.isNotEmpty() && (tocada || estadoDir != "portal")) {
                        Surface(color = c.surfaceContainerHigh, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
                            Column {
                                // Cinco como mucho (07-11-2026, §5.9); Situar.ordenar ya las trae en su orden.
                                sugerencias.take(5).forEachIndexed { i, s ->
                                    if (i > 0) HorizontalDivider(color = c.outlineVariant)
                                    FilaSugerencia(s, alElegir = {
                                        // Lo que da un buscador no trae el piso: el de lo escrito se conserva (02-11-2026). Y si no
                                        // trae el portal escrito («Sin el portal», u otro número), se toman sus coordenadas pero lo
                                        // escrito no se pisa: sigue con su número y queda «Calle encontrada, sin el portal». Una de
                                        // otra calle pone su dirección (03-11-2026): nunca lo escrito con el punto de otra calle,
                                        // venga de donde venga (también del servidor), y una suya, tal cual con su precisión.
                                        val el = Situar.alElegir(direccion, s, cpConsulta, locConsulta)
                                        direccion = el.direccion
                                        punto = s.copy(direccion = el.direccion, cp = el.cp, localidad = el.localidad, precision = el.precision); elegida = true; sugerencias = emptyList()
                                        estadoDir = if (s.lat == null) "" else el.precision
                                        if (cliente.isBlank()) cliente = s.cliente
                                        if (telefono.isBlank()) telefono = s.telefono
                                    })
                                }
                                // De dónde salen (CartoCiudad es CC BY 4.0: hay que decirlo donde se enseña).
                                ubicado?.atribucion?.takeIf { it.isNotBlank() && sugerencias.any { s -> s.fuente == "servidor" } }?.let {
                                    Text(it, style = MaterialTheme.typography.labelSmall, color = c.onSurfaceVariant,
                                        modifier = Modifier.padding(horizontal = Esp.m, vertical = 6.dp))
                                }
                            }
                        }
                    }
                }
                // «Cliente» y «Teléfono», en dos columnas desde 360 dp; en un móvil más estrecho, uno debajo del otro.
                val ancho = with(LocalDensity.current) { LocalWindowInfo.current.containerSize.width.toDp() }
                val campoCliente: @Composable (Modifier) -> Unit = { m ->
                    CampoTexto(cliente, { cliente = it }, icono = Icons.Default.Person, ejemplo = tx("Cliente"),
                        teclado = KeyboardOptions(capitalization = KeyboardCapitalization.Words), modifier = m)
                }
                val campoTelefono: @Composable (Modifier) -> Unit = { m ->
                    CampoTexto(telefono, { telefono = it }, icono = Icons.Default.Call, ejemplo = tx("Teléfono"),
                        teclado = KeyboardOptions(keyboardType = KeyboardType.Phone), modifier = m)
                }
                if (ancho >= 360.dp) {
                    Row(horizontalArrangement = Arrangement.spacedBy(Esp.s)) { campoCliente(Modifier.weight(1f)); campoTelefono(Modifier.weight(1f)) }
                } else {
                    campoCliente(Modifier.fillMaxWidth()); campoTelefono(Modifier.fillMaxWidth())
                }
                CampoTexto(notas, { notas = it }, icono = Icons.AutoMirrored.Filled.StickyNote2, ejemplo = tx("Notas (portal, piso…)"), unaLinea = false, modifier = Modifier.fillMaxWidth())
                // «Más datos» (48): qué lleva, el horario, el hueco, los bultos, urgente, entrega o recogida y el cobro.
                Column {
                    Row(
                        Modifier.fillMaxWidth().clickable(role = Role.Button) { masDatos = !masDatos }.heightIn(min = Alto.boton),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(tx("Más datos"), style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
                        Icon(if (masDatos) Icons.Default.ExpandLess else Icons.Default.ExpandMore, contentDescription = null, tint = c.onSurfaceVariant)
                    }
                    if (masDatos) {
                        Column(verticalArrangement = Arrangement.spacedBy(Esp.m)) {
                            CampoTexto(contenido, { contenido = it }, icono = Icons.Default.Inventory2, ejemplo = tx("Qué lleva"), nombre = tx("Qué lleva (opcional)"), modifier = Modifier.fillMaxWidth())
                            // El horario del cliente: la ruta lo respeta y avisa si se llega tarde. Con atajos: un toque en vez de escribirlo.
                            Column(verticalArrangement = Arrangement.spacedBy(Esp.s)) {
                                CampoTexto(horario, { horario = it }, icono = Icons.Default.Schedule, ejemplo = tx("Horario"), nombre = tx("Horario del cliente (ej. de 10 a 12)"), modifier = Modifier.fillMaxWidth())
                                FilaDeChips { ATAJOS_HORARIO.forEach { (t, h) -> ChipOpcion(t, elegido = horario == h, onClick = { horario = if (horario == h) "" else h }) } }
                            }
                            Column(verticalArrangement = Arrangement.spacedBy(Esp.s)) {
                                Text(tx("¿Dónde va en la furgoneta?"), style = MaterialTheme.typography.labelMedium, color = c.onSurfaceVariant)
                                RejillaHuecos(hueco, alElegir = { hueco = if (hueco == it) "" else it })
                            }
                            // Los bultos y «Urgente», en una fila de 48 (con la letra grande, en dos).
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(Esp.l), verticalArrangement = Arrangement.spacedBy(Esp.s)) {
                                Row(Modifier.heightIn(min = Alto.boton), verticalAlignment = Alignment.CenterVertically) {
                                    Text(tx("Bultos"), style = MaterialTheme.typography.bodyMedium)
                                    Spacer(Modifier.width(Esp.s))
                                    BotonIcono(Icons.Default.Remove, tx("Uno menos"), { if (bultos > 1) bultos -= 1 }, relleno = true)
                                    Text("$bultos", style = MaterialTheme.typography.titleMedium.merge(TextoNumero), modifier = Modifier.padding(horizontal = Esp.m))
                                    BotonIcono(Icons.Default.Add, tx("Uno más"), { if (bultos < 99) bultos += 1 }, relleno = true)
                                }
                                Row(Modifier.heightIn(min = Alto.boton).toggleable(urgente, role = Role.Switch) { urgente = it }, verticalAlignment = Alignment.CenterVertically) {
                                    Text(tx("Urgente"), style = MaterialTheme.typography.bodyMedium)
                                    Spacer(Modifier.width(Esp.s))
                                    Switch(checked = urgente, onCheckedChange = null)
                                }
                            }
                            // «Entrega | Recogida» y «A cobrar», en otra.
                            Row(horizontalArrangement = Arrangement.spacedBy(Esp.s), verticalAlignment = Alignment.CenterVertically) {
                                val tipos = listOf("entrega", "recogida")
                                Segmentado(listOf(tx("Entrega"), tx("Recogida")), elegida = tipos.indexOf(tipo).coerceAtLeast(0), alElegir = { tipo = tipos[it] }, modifier = Modifier.weight(1f))
                                CampoTexto(cobrar, { cobrar = it }, icono = Icons.Default.Payments, ejemplo = tx("A cobrar ({moneda})", "moneda" to Region.simbolo),
                                    nombre = tx("A cobrar ({moneda}, opcional)", "moneda" to Region.simbolo),
                                    teclado = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
            // El pie fijo: el error, si lo hay, y «Añadir a mi ruta» / «Guardar cambios» (52).
            HorizontalDivider(color = c.outlineVariant)
            Column(Modifier.fillMaxWidth().padding(Esp.m)) {
                error?.let { Text(it, color = c.error, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(bottom = Esp.s)) }
                BotonPrincipal(if (editar != null) tx("Guardar cambios") else tx("Añadir a mi ruta"), ::guardar, cargando = guardando, modifier = Modifier.fillMaxWidth())
            }
        }
    }
    if (quitar && editar != null) {
        AlertDialog(
            onDismissRequest = { quitar = false },
            title = { Text(tx("¿Quitar esta parada?"), style = MaterialTheme.typography.titleLarge) },
            text = { Text(tx("{n} sale de tu ruta de hoy.", "n" to editar.cliente.ifBlank { editar.direccion }), style = MaterialTheme.typography.bodyMedium) },
            confirmButton = { BotonTexto(tx("Quitar"), { quitar = false; alQuitar?.invoke() }, tono = Tono.PELIGRO) },
            dismissButton = { BotonTexto(tx("Cancelar"), { quitar = false }, tono = Tono.NEUTRO) },
            shape = MaterialTheme.shapes.large,
        )
    }
}

private fun fotoEtiqueta(ctx: Context): Uri {
    val f = File(ctx.cacheDir, "fotos").apply { mkdirs() }.resolve("etiqueta.jpg")
    return FileProvider.getUriForFile(ctx, "${ctx.packageName}.fotos", f)
}

/** EL PRIMER PAQUETE BIEN SITUADO (02-11-2026): lo que dice el servidor de la dirección, debajo de ella, y el botón
 *  para ponerla a mano en el mapa. En una línea con «…» (07-11-2026, §5.9; el texto entero queda para el lector de
 *  pantalla) y «Situar» a la derecha, que sigue llamándose «Situar en el mapa». Sus textos no cambian. */
@Composable
private fun EstadoDireccion(estado: String, alSituar: () -> Unit) {
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        val (icono, color, texto) = when (estado) {
            "buscando" -> Triple(null, c.onSurfaceVariant, tx("Comprobando la dirección…"))
            "portal" -> Triple(Icons.Default.CheckCircle, x.entregadoTexto, tx("En el mapa"))
            "calle" -> Triple(Icons.Default.Place, c.tertiary, tx("Calle encontrada, sin el portal"))
            "no" -> Triple(Icons.Default.LocationOff, c.error, tx("No la encuentro: elige una sugerencia o sitúala en el mapa"))
            "sinred" -> Triple(Icons.Default.LocationOff, c.onSurfaceVariant, tx("Sin conexión: no puedo comprobarla ahora."))
            else -> Triple(null, c.onSurfaceVariant, "")
        }
        if (estado == "buscando") CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
        else if (icono != null) Icon(icono, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
        if (texto.isNotEmpty()) Spacer(Modifier.width(Esp.s))
        Text(texto, style = MaterialTheme.typography.bodyMedium, color = color, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        BotonTexto(tx("Situar"), alSituar, nombre = tx("Situar en el mapa"))
    }
}

/** Una sugerencia de dirección, en la ficha y en «Situar» (07-11-2026, §5.9 y §5.10): fila de 48 como mínimo con el
 *  icono de 18 (↺ si ya estuvo allí), la dirección en `texto` y debajo, en `sec`, «Ya estuviste aquí · 4 veces» (con el
 *  cliente si `conCliente`), «Otra calle» (en peligro) o «Sin el portal». */
@Composable
internal fun FilaSugerencia(s: Sugerencia, alElegir: () -> Unit, conCliente: Boolean = true, modifier: Modifier = Modifier) {
    val c = MaterialTheme.colorScheme
    val detalle = when {
        s.veces > 0 -> tx("Ya estuviste aquí") + " · ${s.veces} ${if (s.veces == 1) tx("vez") else tx("veces")}" +
            (s.cliente.takeIf { conCliente && it.isNotBlank() }?.let { " · $it" } ?: "")
        s.otraCalle -> tx("Otra calle")            // no es la escrita (02-11-2026, Situar.ordenar): va al final y se dice
        s.precision == "calle" -> tx("Sin el portal")
        else -> ""
    }
    Row(
        modifier.fillMaxWidth().clickable(onClick = alElegir).heightIn(min = Alto.boton).padding(horizontal = Esp.m, vertical = Esp.s),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(if (s.veces > 0) Icons.Default.History else Icons.Default.Place, contentDescription = null, tint = c.onSurfaceVariant, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(Esp.m))
        Column(Modifier.weight(1f)) {
            Text(s.direccion, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (detalle.isNotEmpty()) {
                Text(detalle, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    color = when { s.veces > 0 -> c.secondary; s.otraCalle -> c.error; else -> c.onSurfaceVariant })
            }
        }
    }
}

/** «¿Dónde va en la furgoneta?» (07-11-2026, §5.9): los seis huecos en celdas de 48 (dos columnas, tres filas), radio 8
 *  y el borde de control; la elegida, en tinte de marca con el borde de énfasis. Volver a tocarla la quita. */
@Composable
private fun RejillaHuecos(elegido: String, alElegir: (String) -> Unit) {
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    Column(verticalArrangement = Arrangement.spacedBy(Esp.s)) {
        HUECOS.chunked(2).forEach { fila ->
            Row(horizontalArrangement = Arrangement.spacedBy(Esp.s)) {
                fila.forEach { h ->
                    val sel = h == elegido
                    Surface(
                        selected = sel, onClick = { alElegir(h) }, shape = MaterialTheme.shapes.small,
                        color = if (sel) c.primaryContainer else c.surfaceContainerLow, contentColor = if (sel) c.onPrimaryContainer else c.onSurface,
                        border = BorderStroke(if (sel) 2.dp else 1.dp, if (sel) x.enfasis else c.outline),
                        modifier = Modifier.weight(1f),
                    ) {
                        Box(Modifier.fillMaxWidth().heightIn(min = Alto.boton).padding(horizontal = Esp.s), contentAlignment = Alignment.Center) {
                            Text(h, style = MaterialTheme.typography.labelLarge, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
                        }
                    }
                }
            }
        }
    }
}

/** El buscador de direcciones de OpenStreetMap (Photon, sin clave), como en la web. Sin red: nada. También lo usa
 *  «Situar la parada» (02-11-2026). Sin cortar (03-11-2026): Situar.ordenar quita las que no tocan y luego deja
 *  Situar.TOPE_MAPA. `q` es lo buscado tal cual: el piso lo quita urlPhoton. */
internal fun buscarEnMapa(http: okhttp3.OkHttpClient, q: String, pais: String, cerca: Pair<Double, Double>?): List<Sugerencia> = runCatching {
    http.newCall(Request.Builder().url(urlPhoton(q, cerca)).header("User-Agent", "FDS-Android").build()).execute().use { r ->
        if (!r.isSuccessful) return emptyList()
        leerPhoton(r.body?.string().orEmpty(), pais)
    }
}.getOrDefault(emptyList())

/** Lo que se le pide a Photon (03-11-2026, igual que la web): hasta Situar.PIDE_MAPA resultados y, para ordenarlos por
 *  cercanía, el punto de donde se reparte redondeado a 2 decimales (≈1 km): para eso no le hace falta más.
 *  SIN EL PISO (C, 03-11-2026, el emulador): Photon toma el piso por el portal («Trav. de Meicende nº50 2 B» daba
 *  «Travesía de Meicende 2B», a 380 m del 50), así que va Situar.paraBuscar(q) (o q, si queda vacío). Al servidor y al
 *  móvil, como hasta ahora; lo que se quita y se marca sigue mirando lo buscado y D (Situar.ordenar). */
internal fun urlPhoton(q: String, cerca: Pair<Double, Double>?): HttpUrl =
    "https://photon.komoot.io/api/".toHttpUrl().newBuilder().addQueryParameter("q", Situar.paraBuscar(q).ifBlank { q })
        .addQueryParameter("limit", "${Situar.PIDE_MAPA}")
        .apply { cerca?.let { (la, lo) -> addQueryParameter("lat", dosDecimales(la)); addQueryParameter("lon", dosDecimales(lo)) } }.build()

private fun dosDecimales(x: Double): String = String.format(Locale.ROOT, "%.2f", x)

/** Lo que contesta Photon como sugerencias: las del país de la cuenta y con calle (o con nombre), sin repetir. La
 *  población, como en la web (03-11-2026, la revisión): city, town o village; district solo va en el texto
 *  (lib/direcciones.js, etiqueta). Con district de población, la app guardaba «Rúa Real 5, 15179 Santa Cristina» con
 *  «Santa Cristina» y la web, con la misma respuesta, «Rúa Real 5, 15179» sin población. */
internal fun leerPhoton(texto: String, pais: String): List<Sugerencia> {
    val j = com.flotadsp.fds.data.JSON.parseToJsonElement(texto).jsonObject
    return j["features"]?.jsonArray.orEmpty().mapNotNull { f ->
        val p = f.jsonObject["properties"]?.jsonObject ?: return@mapNotNull null
        val c = f.jsonObject["geometry"]?.jsonObject?.get("coordinates")?.jsonArray ?: return@mapNotNull null
        fun t(k: String) = p[k]?.jsonPrimitive?.contentOrNull.orEmpty()
        val cc = t("countrycode").lowercase()
        if (pais.isNotBlank() && cc.isNotBlank() && cc != pais) return@mapNotNull null
        val calle = t("street").ifBlank { t("name") }
        if (calle.isBlank()) return@mapNotNull null
        val pueblo = t("city").ifBlank { t("town") }.ifBlank { t("village") }
        val linea1 = listOf(calle, t("housenumber")).filter { it.isNotBlank() }.joinToString(" ")
        val linea2 = listOf(t("postcode"), pueblo.ifBlank { t("district") }).filter { it.isNotBlank() }.joinToString(" ")
        Sugerencia(listOf(linea1, linea2).filter { it.isNotBlank() }.joinToString(", "), t("postcode"), pueblo,
            c.getOrNull(1)?.jsonPrimitive?.doubleOrNull, c.getOrNull(0)?.jsonPrimitive?.doubleOrNull,
            precision = if (t("housenumber").isNotBlank()) "portal" else "calle", fuente = "photon")
    }.distinctBy { it.direccion }
}
