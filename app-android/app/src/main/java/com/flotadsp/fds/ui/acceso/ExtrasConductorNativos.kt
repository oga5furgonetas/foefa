package com.flotadsp.fds.ui.acceso

import com.flotadsp.fds.ui.patronFecha
import com.flotadsp.fds.ui.tx
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun ExtrasConductorNativos(alVolver: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val scope = rememberCoroutineScope()
    var datos by remember { mutableStateOf<JsonArray?>(null) }
    var extras by remember { mutableStateOf<JsonArray>(JsonArray(emptyList())) }
    var vacantes by remember { mutableStateOf<JsonArray>(JsonArray(emptyList())) }
    var notas by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var ocupado by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var aviso by remember { mutableStateOf<String?>(null) }
    var confirmar by remember { mutableStateOf<Pair<String, String>?>(null) }

    fun cargar() {
        scope.launch {
            error = null
            try {
                val r = app.repo.trabajarMasConductor()
                vacantes = r["vacantes"]?.jsonArray ?: JsonArray(emptyList())
                extras = r["extras"]?.jsonArray ?: JsonArray(emptyList())
                datos = vacantes
            } catch (e: ErrorApi) { error = e.message; datos = JsonArray(emptyList()) }
        }
    }
    LaunchedEffect(Unit) { cargar() }
    BackHandler(onBack = alVolver)

    Scaffold(topBar = { TopAppBar(
        title = { Text(tx("Trabajar más")) },
        navigationIcon = { androidx.compose.material3.IconButton(onClick = alVolver) { androidx.compose.material3.Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = tx("Volver")) } },
    ) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).verticalScroll(rememberScrollState()).padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(tx("Solicita un turno extra en los días que la empresa necesita refuerzo. La oficina confirma cada solicitud."), style = MaterialTheme.typography.bodyMedium)
            aviso?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            if (datos == null) CircularProgressIndicator()
            else if (vacantes.isEmpty()) {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                    Text(tx("Ahora mismo no hay vacantes disponibles para ti."), Modifier.padding(16.dp))
                }
            } else {
                Text(tx("Vacantes"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                vacantes.forEach { entry ->
                    val v = entry.jsonObject
                    val fecha = campoSeguro(v, "date")
                    val estado = campoSeguro(v, "mi_estado")
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                androidx.compose.material3.Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                Column(Modifier.weight(1f)) {
                                    Text(campoSeguro(v, "dia").ifBlank { fechaBonita(fecha) }, fontWeight = FontWeight.Bold)
                                    Text(if (estado == "pendiente") "Solicitud pendiente" else "${campoSeguro(v, "quedan").ifBlank { "1" }} plaza(s) disponible(s)", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            campoSeguro(v, "nota").takeIf { it.isNotBlank() }?.let { Text("Nota de oficina: $it", style = MaterialTheme.typography.bodySmall) }
                            if (estado == "pendiente") {
                                Text(tx("La oficina te confirmará si queda aprobado."), color = MaterialTheme.colorScheme.tertiary)
                                val refuerzo = campoSeguro(v, "refuerzo_id")
                                if (refuerzo.isNotBlank()) TextButton(onClick = { confirmar = refuerzo to "retirar" }, enabled = ocupado == null) { Text(tx("Retirar solicitud")) }
                            } else if (estado.isBlank()) {
                                OutlinedTextField(notas[fecha].orEmpty(), { value -> if (value.length <= 200) notas = notas + (fecha to value) }, label = { Text(tx("Nota para la oficina (opcional)")) }, modifier = Modifier.fillMaxWidth())
                                Button(onClick = { confirmar = fecha to "pedir" }, enabled = ocupado == null, modifier = Modifier.fillMaxWidth().height(48.dp)) { Text(tx("Solicitar turno extra")) }
                            }
                        }
                    }
                }
            }
            if (extras.isNotEmpty()) {
                Text(tx("Turnos extra confirmados"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                extras.forEach { entry ->
                    val x = entry.jsonObject
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
                        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("${fechaBonita(campoSeguro(x, "date"))} · EXTRA", fontWeight = FontWeight.Bold)
                            Text(if (campoSeguro(x, "en_cuadrante") == "false") "La oficina ha cambiado el cuadrante después de confirmarlo. Consúltalo antes de desplazarte." else "Turno extra confirmado.", style = MaterialTheme.typography.bodySmall)
                            val id = campoSeguro(x, "id")
                            if (campoSeguro(x, "puede_soltar") == "true" && id.isNotBlank()) TextButton(onClick = { confirmar = id to "cancelar" }, enabled = ocupado == null) { Text(tx("Avisar que no puedo ir")) }
                        }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
    }
    confirmar?.let { (clave, accion) -> AlertDialog(
        onDismissRequest = { confirmar = null },
        title = { Text(when (accion) { "pedir" -> "Solicitar turno"; "retirar" -> "Retirar solicitud"; else -> "Cancelar turno extra" }) },
        text = { Text(when (accion) { "pedir" -> "La oficina recibirá tu solicitud para el ${fechaBonita(clave)}."; "retirar" -> "La solicitud pendiente se retirará."; else -> "Se avisará a la oficina de que no puedes ir al turno extra." }) },
        confirmButton = { TextButton(onClick = {
            confirmar = null; ocupado = clave; error = null; aviso = null
            scope.launch {
                try {
                    var resultado: kotlinx.serialization.json.JsonObject? = null
                    when (accion) {
                        "pedir" -> resultado = app.repo.solicitarDiaExtra(clave, notas[clave].orEmpty())
                        "retirar" -> app.repo.retirarSolicitudExtra(clave)
                        else -> resultado = app.repo.cancelarDiaExtra(clave)
                    }
                    val noPudo = resultado?.get("no")?.let { runCatching { it.jsonArray.firstOrNull()?.jsonObject?.get("motivo")?.jsonPrimitive?.contentOrNull }.getOrNull() }
                    if (!noPudo.isNullOrBlank()) error = "No se ha podido completar: $noPudo"
                    else aviso = when (accion) { "pedir" -> "Solicitud enviada a la oficina."; "retirar" -> "Solicitud retirada."; else -> "Aviso enviado a la oficina." }
                    cargar()
                } catch (e: ErrorApi) { error = e.message }
                finally { ocupado = null }
            }
        }) { Text(tx("Confirmar")) } },
        dismissButton = { TextButton(onClick = { confirmar = null }) { Text(tx("Volver")) } },
    ) }
}

private fun fechaBonita(fecha: String): String = runCatching {
    LocalDate.parse(fecha).format(DateTimeFormatter.ofPattern("EEEE d 'de' MMMM", com.flotadsp.fds.ui.LOCALE_APP)).replaceFirstChar { it.titlecase(com.flotadsp.fds.ui.LOCALE_APP) }
}.getOrDefault(fecha)
