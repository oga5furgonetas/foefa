// diseño compacto
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
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
import com.flotadsp.fds.ui.Alto
import com.flotadsp.fds.ui.Ayuda
import com.flotadsp.fds.ui.BotonPrincipal
import com.flotadsp.fds.ui.Cabecera
import com.flotadsp.fds.ui.ContenedorLista
import com.flotadsp.fds.ui.Esp
import com.flotadsp.fds.ui.FilaDeLista
import com.flotadsp.fds.ui.Segmentado
import com.flotadsp.fds.ui.Voz
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

/* EL DISEÑO COMPACTO (07-11-2026, §5.11 de la especificación): Historial, Ajustes y Cuenta solo con el tema y las piezas
   de ui/Componentes.kt; las cabeceras de 56, las listas en una superficie con separadores, las filas de 48 y 56, sin
   tarjetas ni textos nuevos. */

private fun dia(f: String): String = runCatching {
    LocalDate.parse(f).format(DateTimeFormatter.ofPattern(patronFecha("EEEE d 'de' MMMM"), LOCALE_APP)).replaceFirstChar { it.uppercase() }
}.getOrDefault(f)

// ── HISTORIAL ───────────────────────────────────────────────────────────────────────────────────────────────

/** Las dos cifras en `cifra` sobre una superficie plana y los días como filas de 56 en una sola lista. */
@Composable
fun HistorialPantalla() {
    val repo = (LocalContext.current.applicationContext as FdsApp).repo
    var est by remember { mutableStateOf<Estadisticas?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var abierto by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        runCatching { repo.estadisticas(30) }.onSuccess { est = it }.onFailure { error = (it as? ErrorApi)?.message ?: tx("No se ha podido cargar") }
    }
    abierto?.let { f -> DiaPantalla(f) { abierto = null }; return }
    Scaffold(topBar = { Cabecera(tx("Historial")) }, containerColor = MaterialTheme.colorScheme.background) { pad ->
        val e = est
        when {
            e == null && error == null -> Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            e == null -> Text(error ?: "", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(pad).padding(Esp.xl))
            else -> LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(start = Esp.l, end = Esp.l, top = Esp.xs, bottom = Esp.xl)) {
                item(key = "cifras") {
                    Surface(color = MaterialTheme.colorScheme.surfaceContainerLow, shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth().padding(bottom = Esp.m)) {
                        Row(Modifier.fillMaxWidth().padding(Esp.m)) {
                            Dato("${e.entregados}", if (e.entregados == 1) tx("entrega en 30 días") else tx("entregas en 30 días"), Modifier.weight(1f))
                            Dato(e.tasa?.let { "$it %" } ?: "—", tx("entregadas a la primera"), Modifier.weight(1f))
                        }
                    }
                }
                val dias = e.porDia.filter { it.total > 0 }.sortedByDescending { it.fecha }
                if (dias.isEmpty()) item { Text(tx("Aún no hay días con paradas."), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(Esp.s)) }
                itemsIndexed(dias, key = { _, d -> d.fecha }) { i, d -> FilaDeLista(i, dias.size, separadorDesde = Esp.m) { DiaFila(d) { abierto = d.fecha } } }
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

/** Un día del historial: fila de 56 con el día en `nombre` y «{a} de {b} entregadas · {n} sin entregar» en gris; la flecha
 *  dice que se abre. */
@Composable
private fun DiaFila(d: DiaEstadistica, alTocar: () -> Unit) {
    val c = MaterialTheme.colorScheme
    Row(Modifier.fillMaxWidth().clickable(onClick = alTocar).heightIn(min = Alto.fila).padding(horizontal = Esp.m, vertical = Esp.s),
        verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(dia(d.fecha), style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(tx("{a} de {b} entregadas", "a" to d.entregados, "b" to d.total) + (if (d.fallidos > 0) " · " + tx("{n} sin entregar", "n" to d.fallidos) else ""),
                style = MaterialTheme.typography.bodyMedium.merge(TextoNumero), color = c.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = c.onSurfaceVariant)
    }
}

@Composable
private fun DiaPantalla(fecha: String, alVolver: () -> Unit) {
    val repo = (LocalContext.current.applicationContext as FdsApp).repo
    var paradas by remember { mutableStateOf<List<Parada>?>(null) }
    BackHandler(onBack = alVolver)
    LaunchedEffect(fecha) { paradas = runCatching { repo.paradasDelDia(fecha) }.getOrDefault(emptyList()) }
    Scaffold(topBar = { Cabecera(dia(fecha), alVolver = alVolver) }, containerColor = MaterialTheme.colorScheme.background) { pad ->
        val ps = paradas
        if (ps == null) Box(Modifier.padding(pad).fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        else {
            // Las paradas del día en una sola lista, como «Hechas hoy».
            val lista = remember(ps) { ps.sortedBy { it.cerradoEn ?: "z" } }
            LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(start = Esp.l, end = Esp.l, top = Esp.xs, bottom = Esp.xl)) {
                itemsIndexed(lista, key = { _, p -> p.id }) { i, p -> FilaDeLista(i, lista.size) { Fila(p, numero = p.orden, alTocar = {}) } }
            }
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
    val voz by app.cuenta.voz.collectAsState()
    var ajustes by remember { mutableStateOf<Ajustes?>(null) }
    var base by remember { mutableStateOf("") }
    var salida by remember { mutableStateOf("09:00") }
    var volver by remember { mutableStateOf(false) }
    var cargaPor by remember { mutableStateOf("traseras") }
    var pais by remember { mutableStateOf("") }
    var placa by remember { mutableStateOf("") }
    // «Mi dinero hoy» (30-10-2026): la tarifa en euros con coma, como la web; se guarda en céntimos (PUT /reparto/ganancias).
    var pagoParada by remember { mutableStateOf("") }
    var pagoDia by remember { mutableStateOf("") }
    var costeKm by remember { mutableStateOf("") }
    var bizum by remember { mutableStateOf("") }      // la propina (01-11-2026)
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
            cargaPor = a["carga_por"]?.jsonPrimitive?.contentOrNull ?: "traseras"
            pais = a["pais"]?.jsonPrimitive?.contentOrNull.orEmpty()
            placa = a["placa"]?.jsonPrimitive?.contentOrNull.orEmpty()
            pagoParada = deCent(a["pago_parada"]?.jsonPrimitive?.intOrNull)
            pagoDia = deCent(a["pago_dia"]?.jsonPrimitive?.intOrNull)
            costeKm = deCent(a["coste_km"]?.jsonPrimitive?.intOrNull?.let { if (Region.unidades == "mi") Math.round(it * Region.KM_POR_MILLA).toInt() else it })   // en millas se enseña por milla
            bizum = a["bizum"]?.jsonPrimitive?.contentOrNull.orEmpty()
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
    Scaffold(topBar = { Cabecera(tx("Ajustes")) }, containerColor = MaterialTheme.colorScheme.background) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(Esp.l), verticalArrangement = Arrangement.spacedBy(Esp.m)) {
            // LA GUÍA DENTRO DE LA APP (01-11-2026): «Esta app» guía giro a giro sin salir; Google Maps y Waze siguen ahí.
            Seccion(tx("Navegar con")) {
                val navegadores = listOf("app" to tx("Esta app"), "google" to "Google Maps", "waze" to "Waze")
                Segmentado(navegadores.map { it.second }, navegadores.indexOfFirst { it.first == navegar }, alElegir = { i -> ambito.launch { app.cuenta.elegirNavegador(navegadores[i].first) } })
            }
            Seccion(tx("Aspecto")) {
                val temas = listOf("sistema" to tx("Automático"), "claro" to tx("Claro"), "oscuro" to tx("Oscuro"))
                Segmentado(temas.map { it.second }, temas.indexOfFirst { it.first == tema }, alElegir = { i -> ambito.launch { app.cuenta.elegirTema(temas[i].first) } })
            }
            // EL BRIEFING POR VOZ (01-11-2026): como la guía por voz de la web; también dice el hueco al cargar.
            Seccion(tx("Voz")) {
                FilaInterruptor(tx("Briefing por voz"), voz, detalle = tx("Al avanzar, te dice la siguiente parada: dirección, hora, lo que dijo el cliente, el hueco, el cobro y la nota.")) { v ->
                    ambito.launch { app.cuenta.elegirVoz(v); if (!v) Voz.callar() }
                }
            }
            Seccion(tx("Tu ruta")) {
                OutlinedTextField(base, { base = it }, label = { Text(tx("Desde dónde sales (nave, almacén o casa)")) }, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
                // Con el reloj de Android: en el teclado de números de muchos móviles no hay «:» para escribir «09:00».
                CampoElegir(tx("Hora de salida"), salida, alPulsar = { eligiendoHora = true })
                if (paises.isNotEmpty()) ElegirPais(pais, paises) { pais = it }
                // LA PLACA (30-10-2026): en las ciudades con restricción por placa (São Paulo, CDMX, Quito, San José…) Hoy dice
                // si le toca. Opcional; solo la matrícula.
                OutlinedTextField(placa, { placa = it.uppercase(Locale.ROOT).take(12) }, label = { Text(tx("Matrícula / placa (opcional)")) }, singleLine = true,
                    supportingText = { Text(tx("Para avisarte de las restricciones por placa (rodízio, Hoy No Circula, pico y placa).")) },
                    shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
                FilaInterruptor(tx("Volver a la base al acabar"), volver) { volver = it }
                // LA CARGA GUIADA (01-11-2026): por dónde se carga decide qué fila de la furgoneta es la de la puerta.
                Text(tx("Cargo la furgoneta por"), style = MaterialTheme.typography.titleMedium)
                val puertas = listOf("traseras" to tx("Puertas traseras"), "lateral" to tx("Puerta lateral"))
                Segmentado(puertas.map { it.second }, puertas.indexOfFirst { it.first == cargaPor }, alElegir = { cargaPor = puertas[it].first })
                BotonPrincipal(tx("Guardar"), onClick = {
                    ajustes?.let { a ->
                        guardando = true; mensaje = null
                        ambito.launch {
                            try {
                                val cambios = mutableMapOf<String, kotlinx.serialization.json.JsonElement>("base_direccion" to JsonPrimitive(base.trim()),
                                    "hora_salida" to JsonPrimitive(salida.trim()), "volver" to JsonPrimitive(volver), "carga_por" to JsonPrimitive(cargaPor), "placa" to JsonPrimitive(placa.trim().uppercase(Locale.ROOT)))
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
                    }
                }, enabled = ajustes != null, cargando = guardando, modifier = Modifier.fillMaxWidth())
                mensaje?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            }
            Seccion(tx("Mi dinero hoy")) {
                Text(tx("Pon cómo te pagan y en «Hoy» verás cuánto llevas ganado y lo que pierdes con cada entrega que no sale."),
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(pagoParada, { pagoParada = it }, label = { Text(tx("Te pagan por cada entrega ({moneda})", "moneda" to Region.simbolo)) }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(pagoDia, { pagoDia = it }, label = { Text(tx("Fijo por día, si te pagan así ({moneda})", "moneda" to Region.simbolo)) }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(costeKm, { costeKm = it }, label = { Text(if (Region.unidades == "mi") tx("Gasolina por milla ({moneda})", "moneda" to Region.simbolo) else tx("Gasolina por km ({moneda})", "moneda" to Region.simbolo)) }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
                if (Region.pais == "es") {
                    // LA PROPINA (01-11-2026): el Bizum, que el cliente ve en su enlace cuando ya tiene el paquete.
                    OutlinedTextField(bizum, { bizum = it.filter { c -> c.isDigit() || c == '+' || c == ' ' }.take(20) }, label = { Text(tx("Tu móvil de Bizum, para la propina (opcional)")) },
                        singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth())
                    Text(tx("Cuando el cliente ya tiene el paquete, su enlace le dice «¿Le invitas a un café?» con tu Bizum. Lo que te manden es un ingreso tuyo."),
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                BotonPrincipal(tx("Guardar la tarifa"), onClick = {
                    guardandoTarifa = true; mensajeTarifa = null
                    ambito.launch {
                        try {
                            app.repo.guardarGanancias(aCent(pagoParada), aCent(pagoDia), if (Region.unidades == "mi") Math.round(aCent(costeKm) / Region.KM_POR_MILLA).toInt() else aCent(costeKm), bizum.trim())
                            mensajeTarifa = tx("Guardado: lo verás en «Hoy».")
                            alGuardar()
                        } catch (e: ErrorApi) { mensajeTarifa = e.message } finally { guardandoTarifa = false }
                    }
                }, enabled = ajustes != null, cargando = guardandoTarifa, modifier = Modifier.fillMaxWidth())
                mensajeTarifa?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            }
            Text(tx("La ruta se ordena por el tiempo que se tarda por carretera, contando el tráfico típico de cada hora, el rato en cada portal y el horario de cada cliente."),
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Una fila con interruptor, de 48 (§5.11; antes 40): el texto en `nombre`, el detalle en `sec` y el interruptor a la
 *  derecha. Toda la fila cambia el ajuste. */
@Composable
private fun FilaInterruptor(texto: String, activo: Boolean, detalle: String? = null, alCambiar: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().toggleable(activo, role = Role.Switch, onValueChange = alCambiar).heightIn(min = Alto.boton).padding(vertical = Esp.xs),
        verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(texto, style = MaterialTheme.typography.titleMedium)
            if (detalle != null) Text(detalle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.width(Esp.s))
        Switch(checked = activo, onCheckedChange = null)
    }
}

/** Un dato que se elige (no se escribe): parece un campo y, al tocarlo, abre su selector. Para TalkBack es UN botón
 *  con su nombre y su valor («Hora de salida: 09:00»). */
@Composable
private fun CampoElegir(etiqueta: String, valor: String, alPulsar: () -> Unit) {
    Box {
        OutlinedTextField(valor, {}, readOnly = true, label = { Text(etiqueta) }, singleLine = true,
            trailingIcon = { Icon(Icons.Default.ArrowDropDown, contentDescription = null) }, shape = MaterialTheme.shapes.medium,
            modifier = Modifier.fillMaxWidth().clearAndSetSemantics { })
        Box(Modifier.matchParentSize().semantics { contentDescription = "$etiqueta: $valor" }
            .clickable(role = Role.Button, onClickLabel = tx("Cambiar"), onClick = alPulsar))
    }
}

/** El país donde reparte: con él se leen los teléfonos de las etiquetas y se buscan las direcciones de su zona. */
/** El nombre del país en el idioma de la app (Android los tiene todos); si no lo sabe, el que manda el servidor. */
internal fun nombrePais(codigo: String, delServidor: String = ""): String =
    Locale("", codigo.uppercase(Locale.ROOT)).getDisplayCountry(LOCALE_APP).takeIf { it.isNotBlank() && it != codigo.uppercase(Locale.ROOT) }
        ?: delServidor.ifBlank { codigo.uppercase(Locale.ROOT) }

@Composable
private fun ElegirPais(pais: String, paisesServidor: List<Triple<String, String, List<String>>>, alElegir: (String) -> Unit) {
    var abierto by remember { mutableStateOf(false) }
    val paises = remember(paisesServidor) {
        paisesServidor.map { Triple(it.first, nombrePais(it.first, it.second), it.third) }
            .sortedWith(compareBy(java.text.Collator.getInstance(LOCALE_APP)) { it.second })
    }
    CampoElegir(tx("País donde repartes"), paises.firstOrNull { it.first == pais }?.second ?: nombrePais(pais), alPulsar = { abierto = true })
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

/** Una sección de Ajustes (§5.11), sin tarjeta: la cabecera en `etiqueta` y lo suyo en una superficie plana de radio 12
 *  con relleno 12 y 8 entre filas. La usa también «Mi cuenta» del portal. */
@Composable
internal fun Seccion(titulo: String, contenido: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        Text(titulo, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = Esp.xs, bottom = Esp.s))
        Surface(color = MaterialTheme.colorScheme.surfaceContainerLow, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(Esp.m), verticalArrangement = Arrangement.spacedBy(Esp.s)) { contenido() }
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
    Scaffold(topBar = { Cabecera(tx("Cuenta")) }, containerColor = MaterialTheme.colorScheme.background) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(Esp.l), verticalArrangement = Arrangement.spacedBy(Esp.m)) {
            Surface(color = MaterialTheme.colorScheme.surfaceContainerLow, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth().padding(Esp.m)) {
                    Text(nombre.ifBlank { tx("Tu cuenta") }, style = MaterialTheme.typography.titleLarge)
                    if (correo.isNotBlank()) Text(correo, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(Esp.s))
                    Text(textoPlan(plan), style = MaterialTheme.typography.bodyMedium)
                }
            }
            // INVITAR (§5.11): la tarjeta de invitar, como una fila más; tocarla comparte el enlace, y lo que se gana y
            // cuántos la usan va detrás del «?» con su misma frase.
            val r = ref
            val condiciones = r?.takeIf { it.porInvitado > 0 }?.let {
                tx("Ganas {x} por cada uno que la use de verdad (20 entregas en 2 días). Invitados: {n} · ya la usan: {m}.", "x" to "${"%.2f".format(LOCALE_APP, it.porInvitado / 100.0)} €", "n" to it.invitados, "m" to it.premiados)
            }
            val filas = listOf<@Composable () -> Unit>(
                {
                    FilaOpcion(Icons.Default.Share, tx("Invita a un compañero"), ayuda = condiciones, nombreAccion = tx("Compartir mi enlace")) {
                        val enlace = "${BuildConfig.WEB_URL}/invita?${ref?.codigo?.takeIf { it.isNotBlank() }?.let { "ref=$it&" } ?: ""}utm_source=referido&utm_medium=app_android"
                        Acciones.compartir(ctx, tx("Uso FDS para ordenar mi ruta de reparto y navegar parada a parada. Pruébala: {enlace}", "enlace" to enlace))
                    }
                },
                { FilaOpcion(Icons.Default.Mail, tx("Escribir a soporte")) { Acciones.abrirWeb(ctx, "mailto:contacto@flotadsp.com?subject=FDS%20Android") } },
                { FilaOpcion(Icons.Default.Shield, tx("Privacidad")) { Acciones.abrirWeb(ctx, "${BuildConfig.WEB_URL}/privacidad") } },
                { FilaOpcion(Icons.Default.Description, tx("Términos")) { Acciones.abrirWeb(ctx, "${BuildConfig.WEB_URL}/terminos") } },
                { FilaOpcion(Icons.AutoMirrored.Filled.Logout, tx("Cerrar sesión")) { salir = true } },
                { FilaOpcion(Icons.Default.DeleteForever, tx("Borrar mi cuenta"), peligro = true) { borrar = true } },
            )
            ContenedorLista(filas.size, separadorDesde = 48.dp) { filas[it]() }
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
        p.promo.hasta?.let { tx("Gratis y sin límite hasta el {f}.", "f" to dia(it).substringAfter(' ')) } ?: tx("Gratis y sin límite durante la promoción.")
    p.status == "active" -> tx("Plan sin tope de paradas: activo.")
    p.gratis?.activo == true -> tx("Plan gratis: hasta {n} paradas nuevas al día.", "n" to (p.gratis.tope ?: 15))
    p.status == "trial" && p.diasQuedan != null -> tx("Prueba gratis: {q}.", "q" to (if (p.diasQuedan == 1) tx("queda 1 día") else tx("quedan {n} días", "n" to p.diasQuedan)))
    else -> tx("Plan Repartidor.")
}

/** Una fila de menú o de ajustes (§3.3): 48 como mínimo (56 con dos líneas o con el «?»), relleno 12, icono de 24 y el
 *  texto en `nombre`. `detalle` es la segunda línea en `sec` (la de «Mi cuenta» del portal, que no se borra). A la
 *  derecha, la insignia con lo pendiente, el «?» con la explicación larga o la flecha si lleva a otra pantalla. Lo que
 *  borra va en peligro. `nombreAccion` es lo que hace al tocarla, para TalkBack («Compartir mi enlace»). La usan Cuenta
 *  y el portal del conductor. */
@Composable
internal fun FilaOpcion(
    icono: ImageVector, texto: String, peligro: Boolean = false, flecha: Boolean = false, insignia: Int = 0,
    ayuda: String? = null, nombreAccion: String? = null, detalle: String? = null, alTocar: () -> Unit,
) {
    val c = MaterialTheme.colorScheme
    Row(
        Modifier.fillMaxWidth().clickable(onClickLabel = nombreAccion, onClick = alTocar).heightIn(min = Alto.boton)
            .padding(horizontal = Esp.m, vertical = Esp.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icono, contentDescription = null, tint = if (peligro) c.error else c.onSurfaceVariant, modifier = Modifier.size(24.dp))
        Spacer(Modifier.width(Esp.m))
        Column(Modifier.weight(1f)) {
            Text(texto, style = MaterialTheme.typography.titleMedium, color = if (peligro) c.error else c.onSurface, maxLines = 2,
                overflow = TextOverflow.Ellipsis)
            if (detalle != null) Text(detalle, style = MaterialTheme.typography.bodySmall, color = c.onSurfaceVariant, maxLines = 2,
                overflow = TextOverflow.Ellipsis)
        }
        when {
            insignia > 0 -> Badge { Text("$insignia") }
            ayuda != null -> Ayuda(texto, ayuda)
            flecha -> Icon(Icons.Default.ChevronRight, contentDescription = null, tint = c.onSurfaceVariant)
        }
    }
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
                OutlinedTextField(clave, { clave = it }, label = { Text(tx("Tu contraseña")) }, singleLine = true, shape = MaterialTheme.shapes.medium,
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
