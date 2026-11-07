// diseño compacto
package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.ui.tx
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.ui.Alto
import com.flotadsp.fds.ui.Ayuda
import com.flotadsp.fds.ui.BotonNormal
import com.flotadsp.fds.ui.BotonPrincipal
import com.flotadsp.fds.ui.Cabecera
import com.flotadsp.fds.ui.ChipAccion
import com.flotadsp.fds.ui.ContenedorLista
import com.flotadsp.fds.ui.Esp
import com.flotadsp.fds.ui.Etiqueta
import com.flotadsp.fds.ui.LetraMax
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.Segmentado
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.Tono
import com.flotadsp.fds.ui.escaner.EscanerVM
import kotlinx.coroutines.launch

/* LA CARGA GUIADA (01-11-2026), como en la web (CargaGuiada.jsx). En la nave, con la ruta ya ordenada: la furgoneta
   por huecos con cuántos paquetes van en cada uno, «Escanear» (el escáner en modo carga: cada paquete se marca como
   metido y se dice su hueco, en grande y por voz) y, para quien carga sin escanear, la lista por hueco con una casilla
   por paquete. El hueco se lo puso el servidor a cada parada al ordenar: lo primero que se entrega, junto a la puerta
   por la que se carga (Ajustes › «Cargo la furgoneta por»); lo último, al fondo.
   EL DISEÑO COMPACTO (07-11-2026, §5.6): la cabecera de 56 con el chip «{a}/{b}» y el «?» (ahí va la explicación de
   cómo se carga), el segmentado, lo último escaneado ARRIBA (antes iba al final y en un móvil pequeño quedaba fuera de
   la vista), la furgoneta plana con celdas de 64, el chip «{n} sin hueco» y la barra de abajo con «Escanear» de 52. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CargaPantalla(vm: RutaVM, alEscanear: () -> Unit, alCerrar: () -> Unit) {
    val ctx = LocalContext.current
    val app = ctx.applicationContext as FdsApp
    val e by vm.estado.collectAsState()
    val escaner: EscanerVM = viewModel()
    val ee by escaner.estado.collectAsState()
    val ambito = rememberCoroutineScope()
    val c = MaterialTheme.colorScheme
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
    // Cómo se carga, detrás del «?» (antes, un párrafo y una línea bajo la furgoneta; las mismas claves).
    val ayuda = tx("La ruta ya está ordenada: lo primero que se entrega va junto a la puerta y lo último, al fondo.") + " " +
        (if (lateral) tx("Cargas por la puerta lateral.") + " " + tx("Lo de delante se entrega primero.")
        else tx("Cargas por las puertas traseras.") + " " + tx("Lo de detrás se entrega primero."))

    Scaffold(
        topBar = {
            Cabecera(tx("Cargar la furgoneta"), alVolver = alCerrar) {
                Etiqueta("$cargados/$total", Tono.OK, modifier = Modifier.semantics(mergeDescendants = true) {
                    contentDescription = tx("{a} de {b} cargados", "a" to cargados, "b" to total)
                })
                Spacer(Modifier.width(Esp.xs))
                Ayuda(tx("Cargar la furgoneta"), ayuda)
            }
        },
        bottomBar = {
            Surface(color = c.surfaceContainerLow) {
                Column {
                    HorizontalDivider(color = c.outlineVariant)
                    Row(Modifier.fillMaxWidth().padding(Esp.m).navigationBarsPadding(), horizontalArrangement = Arrangement.spacedBy(Esp.s),
                        verticalAlignment = Alignment.CenterVertically) {
                        BotonPrincipal(tx("Escanear"), alEscanear, icono = Icons.Default.QrCodeScanner, tono = Tono.OK,
                            nombre = tx("Escanear para cargar"), modifier = Modifier.weight(1f))
                        BotonNormal(if (faltan > 0) tx("Salir ({n} faltan)", "n" to faltan) else tx("Todo cargado"), alCerrar,
                            tono = Tono.NEUTRO, contorno = true)
                    }
                }
            }
        },
        containerColor = c.background,
    ) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(Esp.l), verticalArrangement = Arrangement.spacedBy(Esp.m)) {
            Segmentado(listOf(tx("Furgoneta"), tx("Lista por hueco")), if (vista == "lista") 1 else 0, { vista = if (it == 1) "lista" else "furgoneta" })
            // Tras escanear, arriba: el paquete que acaba de entrar y su hueco, en grande.
            ultimo?.let { u ->
                Surface(color = c.surfaceContainerLow, shape = MaterialTheme.shapes.medium, border = BorderStroke(2.dp, x.entregado), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(Esp.m)) {
                        Text(u.texto, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text("→ " + (ultimoHueco?.let { tx(it) } ?: tx("Sin hueco")), style = MaterialTheme.typography.headlineMedium,
                            color = x.entregadoTexto, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            if (vista == "furgoneta") {
                Furgoneta(porHueco, lateral, ultimoHueco)
                if (sinHueco.isNotEmpty()) {
                    ChipAccion(tx("{n} sin hueco", "n" to sinHueco.size) + " ›", { vista = "lista" }, tono = Tono.AVISO,
                        nombre = tx("{n} sin hueco", "n" to sinHueco.size))
                }
            } else {
                ListaPorHueco(porHueco, sinHueco, cargaPor, marcando, marcar)
            }
            error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = c.error) }
        }
    }
}

/** La furgoneta vista desde arriba (§5.6): una superficie de radio 12 y relleno 8; «Cabina» en `sec`, sin caja; las
 *  celdas de 64 en 2 × 3, con el sitio en `etiqueta` y «{a}/{b}» en `titulo` (radio 8 y borde 1; la del último
 *  escaneado, borde 2 ok; las que llevan algo, en tinte de marca); y la puerta por la que se carga, en `sec`. Cada celda
 *  se llama «{hueco}: {a} de {b} cargados». La letra, topada a 1,3 (§3.8). */
@Composable
private fun Furgoneta(porHueco: Map<String, List<Parada>>, lateral: Boolean, ultimoHueco: String?) {
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    Surface(color = c.surfaceContainerLow, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(Esp.s), verticalArrangement = Arrangement.spacedBy(Esp.s)) {
            Text(tx("Cabina"), style = MaterialTheme.typography.bodySmall, color = c.onSurfaceVariant, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth())
            if (lateral) Text("← " + tx("Puerta lateral"), style = MaterialTheme.typography.bodySmall, color = c.onSurfaceVariant)
            LetraMax(1.3f) {
                Column(verticalArrangement = Arrangement.spacedBy(Esp.s)) {
                    Carga.FILAS.forEach { fila ->
                        Row(horizontalArrangement = Arrangement.spacedBy(Esp.s)) {
                            fila.forEach { h ->
                                val l = porHueco[h].orEmpty()
                                val cargados = l.count { it.cargada }
                                val activo = h == ultimoHueco
                                val nombre = tx(h) + ": " + tx("{a} de {b} cargados", "a" to cargados, "b" to l.size)
                                Surface(
                                    shape = MaterialTheme.shapes.small,
                                    color = if (l.isNotEmpty()) c.primaryContainer else c.surfaceContainerLow,
                                    contentColor = if (l.isNotEmpty()) c.onPrimaryContainer else c.onSurface,
                                    border = BorderStroke(if (activo) 2.dp else 1.dp, if (activo) x.entregado else c.outlineVariant),
                                    modifier = Modifier.weight(1f).semantics(mergeDescendants = true) { contentDescription = nombre },
                                ) {
                                    Column(Modifier.fillMaxWidth().heightIn(min = 64.dp).padding(Esp.s), horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center) {
                                        Text(tx(h), style = MaterialTheme.typography.labelMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text("$cargados/${l.size}", style = MaterialTheme.typography.titleLarge.merge(TextoNumero), maxLines = 1)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (!lateral) Text("↓ " + tx("Puertas traseras"), style = MaterialTheme.typography.bodySmall, color = c.onSurfaceVariant,
                textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        }
    }
}

/** Una sección por hueco, en el orden en que se carga (§5.6): la cabecera en `etiqueta` y las filas de 56, con una
 *  casilla de 48, en un ContenedorLista; al final, lo que no tiene hueco. */
@Composable
private fun ListaPorHueco(porHueco: Map<String, List<Parada>>, sinHueco: List<Parada>, cargaPor: String?, marcando: String?, alMarcar: (Parada) -> Unit) {
    val c = MaterialTheme.colorScheme
    val secciones = Carga.filasEnOrden(cargaPor).flatten().map { h -> tx(h) to porHueco[h].orEmpty() } + listOf(tx("Sin hueco") to sinHueco)
    secciones.filter { it.second.isNotEmpty() }.forEach { (titulo, l) ->
        Column(verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
            Text("$titulo · ${l.size}", style = MaterialTheme.typography.labelMedium.merge(TextoNumero), color = c.onSurfaceVariant,
                modifier = Modifier.padding(start = Esp.xs))
            ContenedorLista(l.size) { i ->
                val p = l[i]
                Row(
                    Modifier.fillMaxWidth().toggleable(p.cargada, role = Role.Checkbox, enabled = marcando == null) { alMarcar(p) }
                        .heightIn(min = Alto.fila).padding(horizontal = Esp.m, vertical = Esp.xs),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(Alto.boton), contentAlignment = Alignment.Center) {
                        if (marcando == p.id) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Checkbox(checked = p.cargada, onCheckedChange = null)
                    }
                    Spacer(Modifier.width(Esp.m))
                    Column(Modifier.weight(1f)) {
                        Text((p.orden?.let { "$it. " } ?: "") + p.cliente.ifBlank { p.direccion }, style = MaterialTheme.typography.titleMedium,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                        val detalle = listOfNotNull(p.direccion.takeIf { p.cliente.isNotBlank() }, p.bultos.takeIf { it > 1 }?.let { tx("{n} bultos", "n" to it) })
                        if (detalle.isNotEmpty()) Text(detalle.joinToString(" · "), style = MaterialTheme.typography.bodySmall,
                            color = c.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}
