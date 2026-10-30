package com.flotadsp.fds.ui.acceso

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
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Share
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.ui.Acciones
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

@Composable
fun ReferidosConductorNativo(alVolver: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var datos by remember { mutableStateOf<JsonObject?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var aviso by remember { mutableStateOf<String?>(null) }
    var cargando by remember { mutableStateOf(true) }
    var dialogo by remember { mutableStateOf(false) }
    var enviando by remember { mutableStateOf(false) }
    var titular by rememberSaveable { mutableStateOf("") }
    var destino by rememberSaveable { mutableStateOf("") }
    var metodo by rememberSaveable { mutableStateOf("") }
    fun cargar() {
        scope.launch {
            try { datos = app.repo.referidosConductor(); error = null }
            catch (e: ErrorApi) { error = e.message }
            finally { cargando = false }
        }
    }
    LaunchedEffect(Unit) { cargar() }
    BackHandler(onBack = alVolver)
    val d = datos
    val metodos = d?.get("metodos")?.jsonArray.orEmpty().mapNotNull { it.jsonPrimitive.contentOrNull }
    val min = d?.let { campoSeguro(it, "retirada_min").toIntOrNull() } ?: 0
    val saldo = d?.let { campoSeguro(it, "saldo").toIntOrNull() } ?: 0
    val enlace = d?.let { campoSeguro(it, "enlace") }.orEmpty()

    Scaffold(topBar = { TopAppBar(
        title = { Text(tx("Invita y gana")) },
        navigationIcon = { IconButton(onClick = alVolver) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = tx("Volver")) } },
    ) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).verticalScroll(rememberScrollState()).padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (cargando) CircularProgressIndicator()
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            d?.let {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                    Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(Icons.Default.CardGiftcard, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                        Text(tx("Comparte FDS con otros repartidores"), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        val pago = campoSeguro(it, "por_invitado").toIntOrNull() ?: 0
                        Text("Ganas ${euros(pago)} si se registran con tu enlace y completan ${campoSeguro(it, "entregas_cartera").ifBlank { "20" }} entregas reales en ${campoSeguro(it, "dias_distintos").ifBlank { "2" }} días distintos, dentro de ${campoSeguro(it, "ventana_dias").ifBlank { "30" }} días.", color = MaterialTheme.colorScheme.onPrimaryContainer)
                        val promo = campoSeguro(it, "promo_hasta")
                        if (promo.isNotBlank()) Text("Promoción hasta $promo: ${euros(campoSeguro(it, "promo_cent").toIntOrNull() ?: pago)} por invitación elegible.", color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Button(onClick = {
                            if (enlace.isNotBlank()) Acciones.compartir(ctx, "Estoy usando FDS para organizar repartos. Pruébala: $enlace\n\nSi te registras con mi enlace y completas ${campoSeguro(it, "entregas_cartera").ifBlank { "20" }} entregas reales en varios días, puedo ganar ${euros(pago)}. Es una invitación personal, no vinculada a mi empresa.")
                        }, enabled = enlace.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
                            Icon(Icons.Default.Share, contentDescription = null); Text(tx("  Compartir mi enlace"))
                        }
                    }
                }
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                    Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Text(tx("Tu cartera personal"), style = MaterialTheme.typography.titleMedium)
                        Text(euros(saldo), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                        Text("${campoSeguro(it, "invitados")} invitados · ${campoSeguro(it, "premiados")} válidos", style = MaterialTheme.typography.bodyMedium)
                        Text("Saldo mínimo para retirar: ${euros(min)}. Se revisa cada solicitud antes de realizar el pago.", style = MaterialTheme.typography.bodySmall)
                        Button(onClick = { dialogo = true; metodo = metodos.firstOrNull().orEmpty() }, enabled = saldo >= min && !isPendiente(it), modifier = Modifier.fillMaxWidth()) {
                            Text(if (isPendiente(it)) "Retirada pendiente" else "Solicitar retirada")
                        }
                    }
                }
                val retiradas = it["retiradas"]?.jsonArray ?: JsonArray(emptyList())
                if (retiradas.isNotEmpty()) {
                    Text(tx("Solicitudes anteriores"), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    retiradas.take(10).forEach { r ->
                        val o = r.jsonObject
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                            Column(Modifier.fillMaxWidth().padding(13.dp)) {
                                Text("${euros(campoSeguro(o, "importe").toIntOrNull() ?: 0)} · ${campoSeguro(o, "estado")}", fontWeight = FontWeight.SemiBold)
                                Text("${campoSeguro(o, "metodo")} · ${campoSeguro(o, "destino")}", style = MaterialTheme.typography.bodySmall)
                                campoSeguro(o, "motivo").takeIf { s -> s.isNotBlank() }?.let { s -> Text(s, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
                            }
                        }
                    }
                }
            }
            aviso?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
            Spacer(Modifier.height(12.dp))
        }
    }
    if (dialogo) AlertDialog(
        onDismissRequest = { if (!enviando) dialogo = false },
        title = { Text(tx("Solicitar pago")) },
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(tx("Elige cómo cobrar. Los datos los recibe únicamente la oficina que procesa el pago."))
            OutlinedTextField(titular, { titular = it }, label = { Text(tx("Nombre y apellidos del titular")) }, singleLine = true)
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) { metodos.forEach { m -> FilterChip(selected = metodo == m, onClick = { metodo = m }, label = { Text(when (m) { "iban" -> "Transferencia"; else -> m.replaceFirstChar(Char::uppercase) }) }) } }
            OutlinedTextField(destino, { destino = it }, label = { Text(when (metodo) { "bizum" -> "Móvil de Bizum"; "iban" -> "IBAN"; else -> "Correo de PayPal" }) }, singleLine = true)
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        } },
        confirmButton = { TextButton(onClick = {
            enviando = true; error = null
            scope.launch {
                try {
                    app.repo.retirarReferidosConductor(titular, metodo, destino)
                    dialogo = false; aviso = "Solicitud enviada. La revisarán y te avisarán por correo."; titular = ""; destino = ""; cargar()
                } catch (e: ErrorApi) { error = e.message }
                finally { enviando = false }
            }
        }, enabled = !enviando && titular.trim().length >= 5 && metodo.isNotBlank() && destino.isNotBlank()) { if (enviando) CircularProgressIndicator() else Text(tx("Enviar solicitud")) } },
        dismissButton = { TextButton(onClick = { dialogo = false }) { Text(tx("Cancelar")) } },
    )
}

private fun isPendiente(datos: JsonObject): Boolean = campoSeguro(datos, "pendiente") == "true"
private fun euros(centimos: Int): String = "${"%.2f".format(java.util.Locale.forLanguageTag("es-ES"), centimos / 100.0)} €"
