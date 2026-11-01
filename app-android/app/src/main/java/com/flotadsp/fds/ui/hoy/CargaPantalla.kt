package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.ui.tx
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.ui.LOCALE_APP
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.escaner.EscanerVM
import kotlinx.coroutines.launch

/* LA CARGA GUIADA (01-11-2026), como en la web (CargaGuiada.jsx). En la nave, con la ruta ya ordenada: la furgoneta
   por huecos con cuántos paquetes van en cada uno, «Escanear para cargar» (el escáner en modo carga: cada paquete se
   marca como metido y se dice su hueco, en grande y por voz) y, para quien carga sin escanear, la lista por hueco con
   una casilla por paquete. El hueco se lo puso el servidor a cada parada al ordenar: lo primero que se entrega, junto
   a la puerta por la que se carga (Ajustes › «Cargo la furgoneta por»); lo último, al fondo. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CargaPantalla(vm: RutaVM, alEscanear: () -> Unit, alCerrar: () -> Unit) {
    val ctx = LocalContext.current
    val app = ctx.applicationContext as FdsApp
    val e by vm.estado.collectAsState()
    val escaner: EscanerVM = viewModel()
    val ee by escaner.estado.collectAsState()
    val ambito = rememberCoroutineScope()
    val x = LocalExtra.current
    var vista by rememberSaveable { mutableStateOf("furgoneta") }
    var marcando by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val pendientes = e.pendientes
    val cargaPor = e.ruta?.ruta?.cargaPor
    val lateral = cargaPor == "lateral"
    val porHueco = remember(pendientes) { Carga.porHueco(pendientes) }
    val sinHueco = remember(pendientes) { Carga.sinHueco(pendientes) }
    val cargados = Carga.cargadas(pendientes)
    val total = pendientes.size
    val faltan = total - cargados
    // Lo último que se escaneó en modo carga: su hueco se enciende en la furgoneta al volver del escáner.
    val ultimo = ee.ultimo?.takeIf { it.tipo == "carga" }
    val ultimoHueco = ultimo?.let { ee.hueco }?.takeIf { it.isNotBlank() }
    BackHandler(onBack = alCerrar)

    val marcar: (Parada) -> Unit = { p ->
        marcando = p.id; error = null
        ambito.launch {
            try { app.repo.cargado(p.id, !p.cargada); vm.refrescarSinRuido() }
            catch (ex: ErrorApi) { error = ex.message ?: tx("No se ha podido") }
            finally { marcando = null }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(tx("Cargar la furgoneta"), style = MaterialTheme.typography.titleLarge)
                        Text(tx("{a} de {b} cargados", "a" to cargados, "b" to total), style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                navigationIcon = { IconButton(onClick = alCerrar) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = tx("Volver")) } },
            )
        },
        bottomBar = {
            Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
                Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = alEscanear, modifier = Modifier.weight(1f).height(52.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = x.entregado, contentColor = x.enEntregado)) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = null); Spacer(Modifier.width(8.dp)); Text(tx("Escanear para cargar"))
                    }
                    OutlinedButton(onClick = alCerrar, modifier = Modifier.height(52.dp)) {
                        Text(if (faltan > 0) tx("Salir ({n} faltan)", "n" to faltan) else tx("Todo cargado"))
                    }
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                tx("La ruta ya está ordenada: lo primero que se entrega va junto a la puerta y lo último, al fondo.") + " " +
                    (if (lateral) tx("Cargas por la puerta lateral.") else tx("Cargas por las puertas traseras.")),
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf("furgoneta" to tx("Furgoneta"), "lista" to tx("Lista por hueco")).forEachIndexed { i, (k, t) ->
                    SegmentedButton(selected = vista == k, onClick = { vista = k }, shape = SegmentedButtonDefaults.itemShape(i, 2)) { Text(t) }
                }
            }
            if (vista == "furgoneta") Furgoneta(porHueco, lateral, ultimoHueco, sinHueco.size)
            else ListaPorHueco(porHueco, sinHueco, cargaPor, marcando, marcar)
            ultimo?.let { u ->
                Card(border = BorderStroke(2.dp, x.entregado), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
                    shape = MaterialTheme.shapes.large) {
                    Column(Modifier.padding(14.dp)) {
                        Text(tx("Escaneado").uppercase(LOCALE_APP), style = MaterialTheme.typography.labelMedium, color = x.entregado)
                        Text(u.texto, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text("→ " + (ultimoHueco?.let { tx(it) } ?: tx("Sin hueco")), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    }
                }
            }
            error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error) }
        }
    }
}

/** La furgoneta vista desde arriba: la cabina, las tres filas de dos huecos y la puerta por la que se carga. */
@Composable
private fun Furgoneta(porHueco: Map<String, List<Parada>>, lateral: Boolean, ultimoHueco: String?, sinHueco: Int) {
    val x = LocalExtra.current
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest), shape = MaterialTheme.shapes.extraLarge) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
                Text(tx("Cabina"), style = MaterialTheme.typography.labelMedium, textAlign = TextAlign.Center, modifier = Modifier.padding(6.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (lateral) Text("← " + tx("Puerta lateral"), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Carga.FILAS.forEach { fila ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    fila.forEach { h ->
                        val l = porHueco[h].orEmpty()
                        val activo = h == ultimoHueco
                        Card(
                            modifier = Modifier.weight(1f),
                            border = if (activo) BorderStroke(2.dp, x.entregado) else null,
                            colors = CardDefaults.cardColors(containerColor = when {
                                activo -> x.entregado.copy(alpha = 0.15f)
                                l.isNotEmpty() -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
                                else -> MaterialTheme.colorScheme.surfaceContainerLow
                            }),
                            shape = MaterialTheme.shapes.large,
                        ) {
                            Column(Modifier.fillMaxWidth().padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(tx(h), style = MaterialTheme.typography.labelLarge)
                                Text("${l.size}", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                                Text(tx("{a} cargados", "a" to l.count { it.cargada }), style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
            Text(
                if (lateral) tx("Lo de delante se entrega primero.") else tx("Puertas traseras") + " ↓ · " + tx("Lo de detrás se entrega primero."),
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            if (sinHueco > 0) Text(tx("{n} paradas sin hueco (sin ubicar o sin ordenar): salen en «Lista por hueco».", "n" to sinHueco),
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.tertiary)
        }
    }
}

/** Una sección por hueco, en el orden en que se carga, con una casilla por paquete; al final, lo que no tiene hueco. */
@Composable
private fun ListaPorHueco(porHueco: Map<String, List<Parada>>, sinHueco: List<Parada>, cargaPor: String?, marcando: String?, alMarcar: (Parada) -> Unit) {
    val secciones = Carga.filasEnOrden(cargaPor).flatten().map { h -> tx(h) to porHueco[h].orEmpty() } + listOf(tx("Sin hueco") to sinHueco)
    secciones.filter { it.second.isNotEmpty() }.forEach { (titulo, l) ->
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest), shape = MaterialTheme.shapes.large) {
            Column(Modifier.padding(12.dp)) {
                Text("$titulo · ${l.size}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                l.forEach { p ->
                    Row(
                        Modifier.fillMaxWidth().toggleable(p.cargada, role = Role.Checkbox, enabled = marcando == null) { alMarcar(p) }.padding(vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (marcando == p.id) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Checkbox(checked = p.cargada, onCheckedChange = null)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text((p.orden?.let { "$it. " } ?: "") + p.cliente.ifBlank { p.direccion }, style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            val detalle = listOfNotNull(p.direccion.takeIf { p.cliente.isNotBlank() }, p.bultos.takeIf { it > 1 }?.let { tx("{n} bultos", "n" to it) })
                            if (detalle.isNotEmpty()) Text(detalle.joinToString(" · "), style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
    }
}
