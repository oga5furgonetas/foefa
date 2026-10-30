package com.flotadsp.fds.ui.cuenta

import com.flotadsp.fds.ui.tx
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.flotadsp.fds.BuildConfig
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.Ajustes
import com.flotadsp.fds.data.DiaEstadistica
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.ui.Region
import kotlin.math.roundToInt
import com.flotadsp.fds.data.Estadisticas
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.data.Plan
import com.flotadsp.fds.data.Referidos
import com.flotadsp.fds.ui.Acciones
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.LOCALE_APP
import com.flotadsp.fds.ui.patronFecha
import com.flotadsp.fds.ui.hoy.Fila
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private fun dia(f: String): String = runCatching {
    LocalDate.parse(f).format(DateTimeFormatter.ofPattern(patronFecha("EEEE d 'de' MMMM"), LOCALE_APP)).replaceFirstChar { it.uppercase() }
}.getOrDefault(f)

// ── HISTORIAL ───────────────────────────────────────────────────────────────────────────────────────────────

@Composable
fun HistorialPantalla() {
    val repo = (LocalContext.current.applicationContext as FdsApp).repo
    var est by remember { mutableStateOf<Estadisticas?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var abierto by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        runCatching { repo.estadisticas(30) }.onSuccess { est = it }.onFailure { error = (it as? ErrorApi)?.message ?: "No se ha podido cargar" }
    }
    abierto?.let { f -> DiaPantalla(f) { abierto = null }; return }
    Scaffold(topBar = { TopAppBar(title = { Text(tx("Historial")) }) }, containerColor = MaterialTheme.colorScheme.background) { pad ->
        val e = est
        when {
            e == null && error == null -> Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            e == null -> Text(error ?: "", modifier = Modifier.padding(pad).padding(24.dp))
            else -> LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest), shape = MaterialTheme.shapes.large) {
                        Row(Modifier.fillMaxWidth().padding(18.dp)) {
                            Dato("${e.entregados}", if (e.entregados == 1) "entrega en 30 días" else "entregas en 30 días", Modifier.weight(1f))
                            Dato(e.tasa?.let { "$it %" } ?: "—", "entregadas a la primera", Modifier.weight(1f))
                        }
                    }
                }
                val dias = e.porDia.filter { it.total > 0 }.sortedByDescending { it.fecha }
                if (dias.isEmpty()) item { Text(tx("Aún no hay días con paradas."), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(8.dp)) }
                items(dias, key = { it.fecha }) { d -> DiaFila(d) { abierto = d.fecha } }
            }
        }
    }
}

@Composable
private fun Dato(valor: String, texto: String, modifier: Modifier) {
    Column(modifier) {
        Text(valor, style = MaterialTheme.typography.headlineMedium.merge(TextoNumero))
        Text(texto, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun DiaFila(d: DiaEstadistica, alTocar: () -> Unit) {
    Surface(onClick = alTocar, color = MaterialTheme.colorScheme.surfaceContainerLowest, shape = MaterialTheme.shapes.medium) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(dia(d.fecha), style = MaterialTheme.typography.titleMedium)
                Text(tx("{a} de {b} entregadas", "a" to d.entregados, "b" to d.total) + (if (d.fallidos > 0) " · " + tx("{n} sin entregar", "n" to d.fallidos) else ""),
                    style = MaterialTheme.typography.bodyMedium.merge(TextoNumero), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null)
        }
    }
}

@Composable
private fun DiaPantalla(fecha: String, alVolver: () -> Unit) {
    val repo = (LocalContext.current.applicationContext as FdsApp).repo
    var paradas by remember { mutableStateOf<List<Parada>?>(null) }
    BackHandler(onBack = alVolver)
    LaunchedEffect(fecha) { paradas = runCatching { repo.paradasDelDia(fecha) }.getOrDefault(emptyList()) }
    Scaffold(
        topBar = { TopAppBar(title = { Text(dia(fecha)) }, navigationIcon = { IconButton(onClick = alVolver) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = tx("Volver")) } }) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { pad ->
        val ps = paradas
        if (ps == null) Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        else LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(ps.sortedBy { it.cerradoEn ?: "z" }, key = { it.id }) { p -> Fila(p, numero = p.orden, alTocar = {}) }
        }
    }
}

// ── AJUSTES ─────────────────────────────────────────────────────────────────────────────────────────────────

@Composable
fun AjustesPantalla(alGuardar: () -> Unit = {}) {
    val app = LocalContext.current.applicationContext as FdsApp
    val ambito = rememberCoroutineScope()
    val navegar by app.cuenta.navegar.collectAsState()
    val tema by app.cuenta.tema.collectAsState()
    var ajustes by remember { mutableStateOf<Ajustes?>(null) }
    var base by remember { mutableStateOf("") }
    var salida by remember { mutableStateOf("09:00") }
    var volver by remember { mutableStateOf(false) }
    var pais by remember { mutableStateOf("") }
    // «Mi dinero hoy» (30-10-2026): la tarifa en euros con coma, como la web; se guarda en céntimos (PUT /reparto/ganancias).
    var pagoParada by remember { mutableStateOf("") }
    var pagoDia by remember { mutableStateOf("") }
    var costeKm by remember { mutableStateOf("") }
    var guardandoTarifa by remember { mutableStateOf(false) }
    var mensajeTarifa by remember { mutableStateOf<String?>(null) }
    var eligiendoHora by remember { mutableStateOf(false) }
    var guardando by remember { mutableStateOf(false) }
    var mensaje by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        runCatching { app.repo.ajustes() }.onSuccess { a ->
            ajustes = a
            base = runCatching { a["base"]?.jsonObject?.get("direccion")?.jsonPrimitive?.contentOrNull }.getOrNull().orEmpty()
            salida = a["hora_salida"]?.jsonPrimitive?.contentOrNull ?: "09:00"
            volver = a["volver"]?.jsonPrimitive?.booleanOrNull ?: false
            pais = a["pais"]?.jsonPrimitive?.contentOrNull.orEmpty()
            pagoParada = deCent(a["pago_parada"]?.jsonPrimitive?.intOrNull)
            pagoDia = deCent(a["pago_dia"]?.jsonPrimitive?.intOrNull)
            costeKm = deCent(a["coste_km"]?.jsonPrimitive?.intOrNull?.let { if (Region.unidades == "mi") Math.round(it * Region.KM_POR_MILLA).toInt() else it })   // en millas se enseña por milla
        }.onFailure { mensaje = tx("Sin conexión: los ajustes de la ruta se cargan con red.") }
    }
    // Los países donde funciona, con sus husos, como los da el servidor (ordenados por nombre).
    val paises = remember(ajustes) {
        runCatching {
            ajustes?.get("paises")?.jsonObject?.map { (k, v) ->
                Triple(k, v.jsonObject["nombre"]?.jsonPrimitive?.contentOrNull ?: k, v.jsonObject["zonas"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull }.orEmpty())
            }?.sortedWith(compareBy(java.text.Collator.getInstance(LOCALE_APP)) { it.second })   // «Bélgica» antes que «Brasil»
        }.getOrNull().orEmpty()
    }
    if (eligiendoHora) {
        val (h, m) = salida.split(":").let { (it.getOrNull(0)?.toIntOrNull() ?: 9) to (it.getOrNull(1)?.toIntOrNull() ?: 0) }
        val reloj = rememberTimePickerState(initialHour = h.coerceIn(0, 23), initialMinute = m.coerceIn(0, 59), is24Hour = true)
        AlertDialog(
            onDismissRequest = { eligiendoHora = false },
            title = { Text(tx("Hora de salida")) },
            text = { TimePicker(reloj) },
            confirmButton = { TextButton(onClick = { salida = "%02d:%02d".format(reloj.hour, reloj.minute); eligiendoHora = false }) { Text(tx("Aceptar")) } },
            dismissButton = { TextButton(onClick = { eligiendoHora = false }) { Text(tx("Cancelar")) } },
        )
    }
    Scaffold(topBar = { TopAppBar(title = { Text(tx("Ajustes")) }) }, containerColor = MaterialTheme.colorScheme.background) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Seccion(tx("Navegar con")) {
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    listOf("google" to "Google Maps", "waze" to "Waze").forEachIndexed { i, (k, t) ->
                        SegmentedButton(selected = navegar == k, onClick = { ambito.launch { app.cuenta.elegirNavegador(k) } },
                            shape = SegmentedButtonDefaults.itemShape(i, 2)) { Text(t) }
                    }
                }
            }
            Seccion(tx("Aspecto")) {
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    listOf("sistema" to tx("Automático"), "claro" to tx("Claro"), "oscuro" to tx("Oscuro")).forEachIndexed { i, (k, t) ->
                        SegmentedButton(selected = tema == k, onClick = { ambito.launch { app.cuenta.elegirTema(k) } },
                            shape = SegmentedButtonDefaults.itemShape(i, 3)) { Text(t) }
                    }
                }
            }
            Seccion(tx("Tu ruta")) {
                OutlinedTextField(base, { base = it }, label = { Text(tx("Desde dónde sales (nave, almacén o casa)")) }, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                // Con el reloj de Android: en el teclado de números de muchos móviles no hay «:» para escribir «09:00».
                CampoElegir(tx("Hora de salida"), salida, alPulsar = { eligiendoHora = true })
                if (paises.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    ElegirPais(pais, paises) { pais = it }
                }
                Spacer(Modifier.height(6.dp))
                Row(Modifier.fillMaxWidth().toggleable(volver, role = Role.Switch) { volver = it }.padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Text(tx("Volver a la base al acabar"), style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    Switch(checked = volver, onCheckedChange = null)
                }
                Spacer(Modifier.height(8.dp))
                Button(onClick = {
                    val a = ajustes ?: return@Button
                    guardando = true; mensaje = null
                    ambito.launch {
                        try {
                            val cambios = mutableMapOf<String, kotlinx.serialization.json.JsonElement>("base_direccion" to JsonPrimitive(base.trim()),
                                "hora_salida" to JsonPrimitive(salida.trim()), "volver" to JsonPrimitive(volver))
                            if (pais.isNotEmpty()) {
                                // Con el país, su huso: el del móvil si es de ese país; si no, el principal del país.
                                val zonas = paises.firstOrNull { it.first == pais }?.third.orEmpty()
                                val movil = java.util.TimeZone.getDefault().id
                                cambios["pais"] = JsonPrimitive(pais)
                                (if (movil in zonas) movil else zonas.firstOrNull())?.let { cambios["zona_horaria"] = JsonPrimitive(it) }
                            }
                            app.repo.guardarAjustes(a, cambios)
                            ajustes = app.repo.ajustes()
                            mensaje = tx("Guardado.")
                            alGuardar()
                        } catch (e: ErrorApi) { mensaje = e.message } finally { guardando = false }
                    }
                }, enabled = ajustes != null && !guardando, modifier = Modifier.fillMaxWidth()) { Text(tx("Guardar")) }
                mensaje?.let { Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp)) }
            }
            Seccion(tx("Mi dinero hoy")) {
                Text(tx("Pon cómo te pagan y en «Hoy» verás cuánto llevas ganado y lo que pierdes con cada entrega que no sale."),
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(pagoParada, { pagoParada = it }, label = { Text(tx("Te pagan por cada entrega ({moneda})", "moneda" to Region.simbolo)) }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(pagoDia, { pagoDia = it }, label = { Text(tx("Fijo por día, si te pagan así ({moneda})", "moneda" to Region.simbolo)) }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(costeKm, { costeKm = it }, label = { Text(if (Region.unidades == "mi") tx("Gasolina por milla ({moneda})", "moneda" to Region.simbolo) else tx("Gasolina por km ({moneda})", "moneda" to Region.simbolo)) }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(8.dp))
                Button(onClick = {
                    guardandoTarifa = true; mensajeTarifa = null
                    ambito.launch {
                        try {
                            app.repo.guardarGanancias(aCent(pagoParada), aCent(pagoDia), if (Region.unidades == "mi") Math.round(aCent(costeKm) / Region.KM_POR_MILLA).toInt() else aCent(costeKm))
                            mensajeTarifa = tx("Guardado: lo verás en «Hoy».")
                            alGuardar()
                        } catch (e: ErrorApi) { mensajeTarifa = e.message } finally { guardandoTarifa = false }
                    }
                }, enabled = ajustes != null && !guardandoTarifa, modifier = Modifier.fillMaxWidth()) { Text(tx("Guardar la tarifa")) }
                mensajeTarifa?.let { Text(it, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp)) }
            }
            Text(tx("La ruta se ordena por el tiempo que se tarda por carretera, contando el tráfico típico de cada hora, el rato en cada portal y el horario de cada cliente."),
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Un dato que se elige (no se escribe): parece un campo y, al tocarlo, abre su selector. Para TalkBack es UN botón
 *  con su nombre y su valor («Hora de salida: 09:00»). */
@Composable
private fun CampoElegir(etiqueta: String, valor: String, alPulsar: () -> Unit) {
    Box {
        OutlinedTextField(valor, {}, readOnly = true, label = { Text(etiqueta) }, singleLine = true,
            trailingIcon = { Icon(Icons.Default.ArrowDropDown, contentDescription = null) },
            modifier = Modifier.fillMaxWidth().clearAndSetSemantics { })
        Box(Modifier.matchParentSize().semantics { contentDescription = "$etiqueta: $valor" }
            .clickable(role = Role.Button, onClickLabel = "Cambiar", onClick = alPulsar))
    }
}

/** El país donde reparte: con él se leen los teléfonos de las etiquetas y se buscan las direcciones de su zona. */
@Composable
private fun ElegirPais(pais: String, paises: List<Triple<String, String, List<String>>>, alElegir: (String) -> Unit) {
    var abierto by remember { mutableStateOf(false) }
    CampoElegir(tx("País donde repartes"), paises.firstOrNull { it.first == pais }?.second ?: pais.uppercase(Locale.ROOT), alPulsar = { abierto = true })
    if (abierto) {
        AlertDialog(
            onDismissRequest = { abierto = false },
            title = { Text(tx("País donde repartes")) },
            text = {
                LazyColumn(Modifier.heightIn(max = 440.dp)) {
                    items(paises, key = { it.first }) { (k, nombre, _) ->
                        Row(Modifier.fillMaxWidth().selectable(k == pais, role = Role.RadioButton) { alElegir(k); abierto = false }
                            .padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = k == pais, onClick = null)
                            Spacer(Modifier.width(12.dp))
                            Text(nombre, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { abierto = false }) { Text(tx("Cerrar")) } },
        )
    }
}

@Composable
private fun Seccion(titulo: String, contenido: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest), shape = MaterialTheme.shapes.large) {
        Column(Modifier.padding(16.dp)) {
            Text(titulo, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(10.dp))
            contenido()
        }
    }
}

/** La tarifa: «1,10» ↔ 110 céntimos. Lo que no es un número, 0. */
internal fun aCent(t: String): Int = ((t.replace(',', '.').trim().toDoubleOrNull() ?: 0.0) * 100).roundToInt().coerceAtLeast(0)
internal fun deCent(c: Int?): String = if (c == null || c <= 0) "" else "%.2f".format(LOCALE_APP, c / 100.0)

// ── CUENTA ──────────────────────────────────────────────────────────────────────────────────────────────────

@Composable
fun CuentaPantalla() {
    val ctx = LocalContext.current
    val app = ctx.applicationContext as FdsApp
    val ambito = rememberCoroutineScope()
    val nombre by app.cuenta.nombre.collectAsState()
    val correo by app.cuenta.correo.collectAsState()
    var plan by remember { mutableStateOf<Plan?>(null) }
    var ref by remember { mutableStateOf<Referidos?>(null) }
    var borrar by remember { mutableStateOf(false) }
    var salir by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        plan = runCatching { app.repo.plan() }.getOrNull()
        ref = runCatching { app.repo.referidos() }.getOrNull()
    }
    Scaffold(topBar = { TopAppBar(title = { Text(tx("Cuenta")) }) }, containerColor = MaterialTheme.colorScheme.background) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest), shape = MaterialTheme.shapes.large,
                modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth().padding(18.dp)) {
                    Text(nombre.ifBlank { "Tu cuenta" }, style = MaterialTheme.typography.titleLarge)
                    if (correo.isNotBlank()) Text(correo, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(10.dp))
                    Text(textoPlan(plan), style = MaterialTheme.typography.bodyLarge)
                }
            }
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer), shape = MaterialTheme.shapes.large) {
                Column(Modifier.padding(18.dp)) {
                    Text(tx("Invita a un compañero"), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    val r = ref
                    if (r != null && r.porInvitado > 0) {
                        Text(tx("Ganas {x} por cada uno que la use de verdad (20 entregas en 2 días). Invitados: {n} · ya la usan: {m}.", "x" to "${"%.2f".format(LOCALE_APP, r.porInvitado / 100.0)} €", "n" to r.invitados, "m" to r.premiados),
                            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                    Spacer(Modifier.height(10.dp))
                    Button(onClick = {
                        val enlace = "${BuildConfig.WEB_URL}/invita?${ref?.codigo?.takeIf { it.isNotBlank() }?.let { "ref=$it&" } ?: ""}utm_source=referido&utm_medium=app_android"
                        Acciones.compartir(ctx, "Uso FDS para ordenar mi ruta de reparto y navegar parada a parada. Pruébala: $enlace")
                    }) { Icon(Icons.Default.Share, contentDescription = null); Spacer(Modifier.width(8.dp)); Text(tx("Compartir mi enlace")) }
                }
            }
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest), shape = MaterialTheme.shapes.large) {
                Column {
                    Opcion(Icons.Default.Mail, "Escribir a soporte") { Acciones.abrirWeb(ctx, "mailto:contacto@flotadsp.com?subject=FDS%20Android") }
                    HorizontalDivider()
                    Opcion(Icons.Default.Shield, "Privacidad") { Acciones.abrirWeb(ctx, "${BuildConfig.WEB_URL}/privacidad") }
                    HorizontalDivider()
                    Opcion(Icons.Default.Description, "Términos") { Acciones.abrirWeb(ctx, "${BuildConfig.WEB_URL}/terminos") }
                    HorizontalDivider()
                    Opcion(Icons.AutoMirrored.Filled.Logout, "Cerrar sesión") { salir = true }
                    HorizontalDivider()
                    Opcion(Icons.Default.DeleteForever, "Borrar mi cuenta", peligro = true) { borrar = true }
                }
            }
            Text("FDS ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.CenterHorizontally))
        }
    }
    if (salir) {
        AlertDialog(onDismissRequest = { salir = false }, title = { Text(tx("¿Cerrar sesión?")) },
            text = { Text(tx("Para volver a entrar necesitarás tu correo y tu contraseña.")) },
            confirmButton = { TextButton(onClick = { salir = false; ambito.launch { app.repo.salir() } }) { Text(tx("Cerrar sesión")) } },
            dismissButton = { TextButton(onClick = { salir = false }) { Text(tx("Cancelar")) } })
    }
    if (borrar) BorrarCuenta(alCerrar = { borrar = false })
}

private fun textoPlan(p: Plan?): String = when {
    p == null -> tx("Cargando tu plan…")
    p.promo?.activa == true && p.gratis?.activo != true ->
        p.promo.hasta?.let { "Gratis y sin límite hasta el ${dia(it).substringAfter(' ')}." } ?: "Gratis y sin límite durante la promoción."
    p.status == "active" -> tx("Plan sin tope de paradas: activo.")
    p.gratis?.activo == true -> tx("Plan gratis: hasta {n} paradas nuevas al día.", "n" to (p.gratis.tope ?: 15))
    p.status == "trial" && p.diasQuedan != null -> "Prueba gratis: ${if (p.diasQuedan == 1) "queda 1 día" else "quedan ${p.diasQuedan} días"}."
    else -> tx("Plan Repartidor.")
}

@Composable
private fun Opcion(icono: androidx.compose.ui.graphics.vector.ImageVector, texto: String, peligro: Boolean = false, alTocar: () -> Unit) {
    ListItem(
        headlineContent = { Text(texto, color = if (peligro) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface) },
        leadingContent = { Icon(icono, contentDescription = null, tint = if (peligro) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant) },
        colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
        modifier = Modifier.clickable(onClick = alTocar),
    )
}

@Composable
private fun BorrarCuenta(alCerrar: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val ambito = rememberCoroutineScope()
    var clave by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var trabajando by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = alCerrar,
        title = { Text(tx("Borrar tu cuenta")) },
        text = {
            Column {
                Text(tx("Tu cuenta se desactiva ahora mismo y borramos tus datos (tus rutas y las de tus clientes) en un plazo máximo de 30 días. No se puede deshacer."))
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(clave, { clave = it }, label = { Text(tx("Tu contraseña")) }, singleLine = true,
                    visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 6.dp)) }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                trabajando = true; error = null
                ambito.launch {
                    try { app.repo.borrarCuenta(clave) } catch (e: ErrorApi) { error = e.message } finally { trabajando = false }
                }
            }, enabled = clave.isNotBlank() && !trabajando) { Text(tx("Borrar mi cuenta"), color = MaterialTheme.colorScheme.error) }
        },
        dismissButton = { TextButton(onClick = alCerrar) { Text(tx("Cancelar")) } },
    )
}
