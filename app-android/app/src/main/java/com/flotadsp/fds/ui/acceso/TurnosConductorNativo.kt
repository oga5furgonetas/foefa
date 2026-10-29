package com.flotadsp.fds.ui.acceso

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.ui.ESPANOL
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

@Composable
fun TurnosConductorNativo(alVolver: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val scope = rememberCoroutineScope()
    val hoy = remember { LocalDate.now() }
    var mes by rememberSaveable { mutableStateOf(YearMonth.from(hoy).toString()) }
    val periodo = remember(mes) { YearMonth.parse(mes) }
    var seleccion by rememberSaveable { mutableStateOf(hoy.toString()) }
    var turnos by remember { mutableStateOf<JsonArray>(JsonArray(emptyList())) }
    var peticiones by remember { mutableStateOf<JsonArray>(JsonArray(emptyList())) }
    var bloqueos by remember { mutableStateOf<JsonArray>(JsonArray(emptyList())) }
    var suspendido by remember { mutableStateOf<JsonObject?>(null) }
    var cargando by remember { mutableStateOf(true) }
    var enviando by remember { mutableStateOf(false) }
    var nota by rememberSaveable { mutableStateOf("") }
    var motivo by rememberSaveable { mutableStateOf("asuntos") }
    var aviso by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var confirmar by remember { mutableStateOf<String?>(null) }

    fun cargar() {
        cargando = true; error = null
        scope.launch {
            try {
                val desde = periodo.atDay(1).toString()
                val hasta = periodo.atEndOfMonth().toString()
                val datos = app.repo.turnosConductor(desde, hasta)
                turnos = datos["shifts"]?.jsonArray ?: JsonArray(emptyList())
                peticiones = datos["requests"]?.jsonArray ?: JsonArray(emptyList())
                suspendido = datos["suspension"]?.takeUnless { it is kotlinx.serialization.json.JsonNull }?.jsonObject
                bloqueos = app.repo.bloqueosConductor()["bloqueos"]?.jsonArray ?: JsonArray(emptyList())
            } catch (e: ErrorApi) { error = e.message }
            finally { cargando = false }
        }
    }
    LaunchedEffect(mes) { seleccion = if (YearMonth.from(hoy) == periodo) hoy.toString() else periodo.atDay(1).toString(); cargar() }
    BackHandler(onBack = alVolver)

    val dias = (1..periodo.lengthOfMonth()).map { periodo.atDay(it) }
    val mapaTurnos = turnos.associateBy { runCatching { campo(it.jsonObject, "date") }.getOrDefault("") }
    val mapaPeticiones = peticiones.associateBy { runCatching { campo(it.jsonObject, "date") }.getOrDefault("") }
    val fechaSel = runCatching { LocalDate.parse(seleccion) }.getOrDefault(hoy)
    val turnoSel = mapaTurnos[seleccion]?.jsonObject
    val peticionSel = mapaPeticiones[seleccion]?.jsonObject
    LaunchedEffect(seleccion, campoSeguro(peticionSel, "status")) {
        val estadoLeido = campoSeguro(peticionSel, "status")
        val id = campoSeguro(peticionSel, "id")
        if (estadoLeido in listOf("aprobado", "rechazado") && id.isNotBlank()) {
            runCatching { app.repo.marcarRespuestasTurnosVistas(listOf(id)) }
        }
    }
    val bloqueoSel = bloqueos.firstOrNull { b ->
        runCatching { val o = b.jsonObject; seleccion >= campo(o, "desde") && seleccion <= campo(o, "hasta") }.getOrDefault(false)
    }?.jsonObject
    val suspensionSel = suspendido?.let { runCatching { seleccion >= campo(it, "desde") && seleccion <= campo(it, "hasta") }.getOrDefault(false) } == true
    val esLibre = tipoTurno(turnoSel) == "libre"
    val status = campoSeguro(peticionSel, "status")
    val puedePedir = fechaSel >= hoy && status.isBlank() && !suspensionSel && bloqueoSel == null && !esLibre

    Scaffold(topBar = { TopAppBar(
        title = { Text("Mis turnos") },
        navigationIcon = { IconButton(onClick = alVolver) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver") } },
    ) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            aviso?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { mes = periodo.minusMonths(1).toString() }, enabled = YearMonth.parse(mes).isAfter(YearMonth.from(hoy).minusMonths(2))) { Icon(Icons.Default.ChevronLeft, contentDescription = "Mes anterior") }
                        Text(periodo.atDay(1).format(DateTimeFormatter.ofPattern("MMMM yyyy", ESPANOL)).replaceFirstChar { it.titlecase(ESPANOL) }, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        IconButton(onClick = { mes = periodo.plusMonths(1).toString() }, enabled = YearMonth.parse(mes).isBefore(YearMonth.from(hoy).plusMonths(3))) { Icon(Icons.Default.ChevronRight, contentDescription = "Mes siguiente") }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) { listOf("L", "M", "X", "J", "V", "S", "D").forEach { Text(it, Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
                    val huecos = periodo.atDay(1).dayOfWeek.value - 1
                    val celdas = List(huecos) { null } + dias
                    celdas.chunked(7).forEach { semana ->
                        Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                            semana.forEach { d ->
                                if (d == null) Spacer(Modifier.weight(1f).aspectRatio(1f)) else {
                                    val key = d.toString()
                                    val turno = mapaTurnos[key]?.jsonObject
                                    val tipo = tipoTurno(turno)
                                    val pet = mapaPeticiones[key]?.jsonObject
                                    val estado = campoSeguro(pet, "status")
                                    val elegido = seleccion == key
                                    val color = when { tipo == "susp" -> MaterialTheme.colorScheme.errorContainer; tipo == "extra" -> MaterialTheme.colorScheme.tertiaryContainer; tipo == "trabaja" -> MaterialTheme.colorScheme.primaryContainer; tipo == "libre" -> MaterialTheme.colorScheme.surface; else -> MaterialTheme.colorScheme.surfaceVariant }
                                    Card(onClick = { seleccion = key; aviso = null }, modifier = Modifier.weight(1f).aspectRatio(1f), colors = CardDefaults.cardColors(containerColor = if (elegido) MaterialTheme.colorScheme.secondaryContainer else color), border = if (d == hoy) androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.primary) else null) {
                                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text("${d.dayOfMonth}", fontWeight = if (d == hoy) FontWeight.Bold else FontWeight.Normal)
                                                if (estado.isNotBlank()) Text("•", color = when (estado) { "aprobado" -> Color(0xFF168444); "rechazado" -> MaterialTheme.colorScheme.error; else -> MaterialTheme.colorScheme.tertiary }, style = MaterialTheme.typography.labelSmall)
                                            }
                                        }
                                    }
                                }
                            }
                            repeat(7 - semana.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LeyendaTurno("Trabajas", MaterialTheme.colorScheme.primaryContainer)
                        LeyendaTurno("Libre", MaterialTheme.colorScheme.surface)
                        LeyendaTurno("Extra", MaterialTheme.colorScheme.tertiaryContainer)
                    }
                }
            }
            if (cargando) CircularProgressIndicator()
            else {
                Text(fechaSel.format(DateTimeFormatter.ofPattern("EEEE d MMMM", ESPANOL).withLocale(ESPANOL)).replaceFirstChar { it.titlecase(ESPANOL) }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                val textoTurno = when (tipoTurno(turnoSel)) {
                    "trabaja" -> "Tienes turno de trabajo${campoSeguro(turnoSel, "cod").takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""}."
                    "extra" -> "Tienes un turno extra confirmado."
                    "libre" -> "Tienes el día libre."
                    "susp" -> "Día bloqueado por suspensión."
                    else -> "No hay turno publicado para este día."
                }
                Text(textoTurno)
                when (status) {
                    "pendiente" -> Text("Solicitud pendiente de respuesta.", color = MaterialTheme.colorScheme.tertiary)
                    "aprobado" -> Text("Solicitud aprobada.", color = MaterialTheme.colorScheme.primary)
                    "rechazado" -> Text("Solicitud rechazada.", color = MaterialTheme.colorScheme.error)
                }
                bloqueoSel?.let { Text("No puedes solicitar este día: ${campoSeguro(it, "motivo").ifBlank { "bloqueado por la oficina" }}", color = MaterialTheme.colorScheme.error) }
                if (suspensionSel) Text("Este día está dentro de una suspensión.", color = MaterialTheme.colorScheme.error)
                if (puedePedir) {
                    Text("Solicitar un cambio", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text("La oficina revisará la solicitud. No se aprueba automáticamente.", style = MaterialTheme.typography.bodySmall)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("asuntos" to "Asuntos propios", "medico" to "Médico", "familia" to "Familia", "viaje" to "Viaje", "otro" to "Otro").forEach { (id, label) ->
                            FilterChip(selected = motivo == id, onClick = { motivo = id }, label = { Text(label) })
                        }
                    }
                    OutlinedTextField(nota, { if (it.length <= 300) nota = it }, label = { Text("Explica brevemente el motivo (obligatorio)") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                    Button(onClick = { confirmar = seleccion }, enabled = !enviando && nota.trim().length >= 4, modifier = Modifier.fillMaxWidth().height(50.dp)) {
                        if (enviando) CircularProgressIndicator(Modifier.height(20.dp)) else Text("Solicitar día libre")
                    }
                } else if (fechaSel >= hoy && status.isBlank() && (esLibre || suspensionSel || bloqueoSel != null)) {
                    Text("No se puede solicitar este día desde aquí.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.height(18.dp))
        }
    }
    confirmar?.let { fecha -> AlertDialog(
        onDismissRequest = { confirmar = null }, title = { Text("Enviar solicitud") },
        text = { Text("Pedirás el día ${diaLargo(fecha)} por ${motivoLabel(motivo)}. La oficina tendrá que aprobarlo.") },
        confirmButton = { TextButton(onClick = {
            confirmar = null; enviando = true; error = null; aviso = null
            scope.launch {
                try {
                    app.repo.solicitarDiaConductor(fecha, "libre", motivo, nota.trim())
                    aviso = "Solicitud enviada. La oficina te confirmará la respuesta aquí."
                    nota = ""; cargar()
                } catch (e: ErrorApi) { error = e.message }
                finally { enviando = false }
            }
        }) { Text("Enviar") } },
        dismissButton = { TextButton(onClick = { confirmar = null }) { Text("Revisar") } },
    ) }
}

@Composable
private fun LeyendaTurno(texto: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(Modifier.size(10.dp).background(color, MaterialTheme.shapes.small))
        Text(texto, style = MaterialTheme.typography.labelSmall)
    }
}

private fun campo(obj: JsonObject, clave: String): String = obj[clave]?.jsonPrimitive?.contentOrNull.orEmpty()
/** El tipo del día como lo pinta la web: `type` (trabaja / libre / extra) y, si el código es SUSP, «susp». */
private fun tipoTurno(turno: JsonObject?): String = if (campoSeguro(turno, "cod") == "SUSP") "susp" else campoSeguro(turno, "type")
private fun diaLargo(fecha: String): String = runCatching {
    LocalDate.parse(fecha).format(DateTimeFormatter.ofPattern("d 'de' MMMM", ESPANOL))
}.getOrDefault(fecha)
fun campoSeguro(obj: JsonObject?, clave: String): String = obj?.let { runCatching { campo(it, clave) }.getOrDefault("") }.orEmpty()
private fun motivoLabel(id: String): String = when (id) { "asuntos" -> "asuntos propios"; "medico" -> "médico"; "familia" -> "un asunto familiar"; "viaje" -> "un viaje"; else -> "otro motivo" }
