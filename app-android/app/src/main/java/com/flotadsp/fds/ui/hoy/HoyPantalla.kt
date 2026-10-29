package com.flotadsp.fds.ui.hoy

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Route
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.ui.Acciones
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.Region
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.ESPANOL
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun HoyPantalla(
    vm: RutaVM,
    navegarCon: String,
    alEscanear: () -> Unit,
    alAnadir: () -> Unit,
    alEditar: (Parada) -> Unit,
) {
    val e by vm.estado.collectAsState()
    val pendientesEnvio by vm.pendientesDeEnvio.collectAsState()
    val ctx = LocalContext.current
    val avisos = remember { SnackbarHostState() }
    val ambito = rememberCoroutineScope()
    var verMapa by rememberSaveable { mutableStateOf(false) }
    var abierta by remember { mutableStateOf<Parada?>(null) }
    var entregando by remember { mutableStateOf<Parada?>(null) }
    var fallando by remember { mutableStateOf<Parada?>(null) }
    val prefijo = e.ruta?.prefijo ?: "34"

    LaunchedEffect(Unit) {
        vm.avisos.collect { a ->
            avisos.currentSnackbarData?.dismiss()
            val r = avisos.showSnackbar(a.texto, actionLabel = a.accion, withDismissAction = a.accion == null,
                duration = if (a.accion != null) SnackbarDuration.Long else SnackbarDuration.Short)
            if (r == SnackbarResult.ActionPerformed) a.alPulsar?.invoke()
        }
    }

    // «Ordenar ruta» desde donde estás: se pide la ubicación (solo con la app abierta). Sin permiso, desde tu base.
    val pedirUbicacion = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        ambito.launch {
            val ok = r.values.any { it }
            val p = if (ok) Acciones.dondeEstoy(ctx) else null
            vm.ordenar(p?.first, p?.second)
        }
    }
    val ordenar = {
        if (vm.empezarAOrdenar()) pedirUbicacion.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    }
    val entregarRapido: (Parada) -> Unit = { p ->
        Acciones.vibrar(ctx)
        if (p.porCobrar) entregando = p else vm.entregar(p)
    }

    val barra = TopAppBarDefaults.enterAlwaysScrollBehavior()
    Scaffold(
        modifier = Modifier.nestedScroll(barra.nestedScrollConnection),
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Hoy", style = MaterialTheme.typography.titleLarge)
                        Text(fechaLarga(e.ruta?.fecha), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                actions = {
                    if (e.paradas.isNotEmpty()) {
                        IconButton(onClick = { verMapa = !verMapa }) {
                            Icon(if (verMapa) Icons.AutoMirrored.Filled.List else Icons.Default.Map,
                                contentDescription = if (verMapa) "Ver la lista" else "Ver el mapa")
                        }
                    }
                    IconButton(onClick = alAnadir) { Icon(Icons.Default.Add, contentDescription = "Añadir una parada") }
                },
                scrollBehavior = barra,
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background,
                    scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer),
            )
        },
        floatingActionButton = {
            // Con su contenido a mano: la variante text/icon dejaba el botón SIN nombre para TalkBack (NAF en el
            // árbol de accesibilidad, visto en el emulador).
            ExtendedFloatingActionButton(
                onClick = alEscanear,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) {
                Icon(Icons.Default.QrCodeScanner, contentDescription = null)
                Spacer(Modifier.width(12.dp))
                Text("Escanear")
            }
        },
        snackbarHost = { SnackbarHost(avisos) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { pad ->
        PullToRefreshBox(isRefreshing = e.refrescando, onRefresh = { vm.cargar(tirando = true) }, modifier = Modifier.padding(pad).fillMaxSize()) {
            when {
                e.cargando && e.ruta == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                e.ruta == null -> SinRuta(e.error ?: "No se ha podido cargar tu ruta.") { vm.cargar() }
                verMapa -> MapaRuta(e.pendientes, e.ruta?.base, alTocar = { abierta = it }, modifier = Modifier.fillMaxSize())
                else -> LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 104.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    item { Resumen(e, ocupado = e.ocupado == "ordenar", alOrdenar = ordenar) }
                    if (e.guardadaEn != null || pendientesEnvio.isNotEmpty()) {
                        item { SinCobertura(e.guardadaEn, pendientesEnvio.size) }
                    }
                    if (e.paradas.isEmpty()) {
                        item { Vacia(alEscanear, alAnadir) }
                    } else if (e.pendientes.isEmpty()) {
                        item { Terminada(e.entregadas, e.paradas.size) }
                    }
                    e.pendientes.firstOrNull()?.let { sig ->
                        item(key = "sig-${sig.id}") {
                            Siguiente(
                                p = sig, numero = sig.orden ?: 1,
                                alNavegar = { Acciones.navegar(ctx, sig, navegarCon) },
                                alLlamar = { Acciones.llamar(ctx, sig.telefono) },
                                alWhatsapp = { Acciones.whatsapp(ctx, sig.telefono, prefijo, "Hola, soy tu repartidor: llego en unos minutos con tu pedido.") },
                                alEntregar = { entregarRapido(sig) },
                                alFallar = { fallando = sig },
                                alAbrir = { abierta = sig },
                            )
                        }
                    }
                    val resto = e.pendientes.drop(1)
                    if (resto.isNotEmpty()) {
                        item { Titulo("Por entregar · ${resto.size}") }
                        // Sin ordenar todavía, el número es su puesto en la lista (la siguiente es la 1). Si la ruta ya está
                        // ordenada, la que se añade después no se inventa un número: espera a «Ordenar ruta».
                        val hayOrden = e.pendientes.any { it.orden != null }
                        itemsIndexed(resto, key = { _, p -> p.id }) { i, p ->
                            Fila(p, numero = p.orden ?: (if (hayOrden) null else i + 2), alTocar = { abierta = p })
                        }
                    }
                    if (e.hechas.isNotEmpty()) {
                        item(key = "hechas") { Hechas(e.hechas, alTocar = { abierta = it }) }
                    }
                }
            }
        }
    }

    abierta?.let { p ->
        ParadaHoja(
            p = p, prefijo = prefijo, navegarCon = navegarCon,
            alCerrar = { abierta = null },
            alEntregar = { abierta = null; entregando = p },
            alFallar = { abierta = null; fallando = p },
            alDeshacer = { abierta = null; vm.deshacer(p) },
            alEditar = { abierta = null; alEditar(p) },
            alQuitar = { abierta = null; vm.quitar(p) },
        )
    }
    entregando?.let { p ->
        EntregaHoja(p = p, alCerrar = { entregando = null }, alConfirmar = { cuerpo -> entregando = null; vm.entregar(p, cuerpo) })
    }
    fallando?.let { p ->
        NoEntregadoHoja(alCerrar = { fallando = null }, alConfirmar = { motivo, nota -> fallando = null; vm.noEntregado(p, motivo, nota) })
    }
}

/** El día de la RUTA (el del servidor, en la zona de la cuenta), no el del reloj del móvil: pasada la medianoche o
 *  con el móvil en otro huso, la cabecera decía un día y la lista era de otro (visto en el emulador). */
private fun fechaLarga(fecha: String?): String =
    (fecha?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: LocalDate.now()).format(DateTimeFormatter.ofPattern("EEEE, d 'de' MMMM", ESPANOL)).replaceFirstChar { it.uppercase() }

@Composable
private fun Titulo(t: String) {
    Text(t.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 8.dp, start = 4.dp))
}

@Composable
private fun Resumen(e: EstadoRuta, ocupado: Boolean, alOrdenar: () -> Unit) {
    val total = e.paradas.size
    val hechas = e.hechas.size
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest), shape = MaterialTheme.shapes.large) {
      Column(Modifier.padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(64.dp).semantics { contentDescription = "$hechas de $total hechas" }) {
                CircularProgressIndicator(
                    progress = { if (total == 0) 0f else hechas / total.toFloat() },
                    modifier = Modifier.size(64.dp), strokeWidth = 6.dp, strokeCap = StrokeCap.Round,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )
                Text("$hechas/$total", style = MaterialTheme.typography.titleSmall.merge(TextoNumero), fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f)) {
                val q = e.pendientes.size
                Text(when (q) { 0 -> if (total == 0) "Sin paradas todavía" else "Todo entregado"; 1 -> "Queda 1 parada"; else -> "Quedan $q paradas" },
                    style = MaterialTheme.typography.titleMedium)
                val r = e.ruta?.ruta
                val partes = listOfNotNull(r?.fin?.let { "Acabas ≈ $it" }, r?.km?.takeIf { it > 0 }?.let { "${"%.1f".format(ESPANOL, it)} km" })
                if (partes.isNotEmpty() && q > 0) {
                    Text(partes.joinToString(" · "), style = MaterialTheme.typography.bodyMedium.merge(TextoNumero),
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        if (e.pendientes.size >= 2) {
            Spacer(Modifier.height(12.dp))
            FilledTonalButton(onClick = alOrdenar, enabled = !ocupado, modifier = Modifier.fillMaxWidth().height(48.dp)) {
                if (ocupado) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Icon(Icons.Default.Route, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(if (ocupado) "Ordenando por tiempo…" else "Ordenar ruta")
            }
        }
      }
    }
}

@Composable
private fun SinCobertura(guardadaEn: Long?, pendientes: Int) {
    val x = LocalExtra.current
    Surface(color = x.aviso, contentColor = x.enAviso, shape = MaterialTheme.shapes.medium) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.CloudOff, contentDescription = null)
            Spacer(Modifier.width(12.dp))
            val hora = guardadaEn?.let { java.text.SimpleDateFormat("HH:mm", ESPANOL).format(java.util.Date(it)) }
            Text(buildString {
                if (hora != null) append("Sin conexión: es tu ruta de las $hora. ")
                append(when (pendientes) {
                    0 -> "Se pone al día sola al volver la red."
                    1 -> "1 cambio guardado en el móvil: se envía solo al volver la red."
                    else -> "$pendientes cambios guardados en el móvil: se envían solos al volver la red."
                })
            }, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun Vacia(alEscanear: () -> Unit, alAnadir: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest), shape = MaterialTheme.shapes.large) {
        Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.Inventory2, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(48.dp))
            Spacer(Modifier.height(12.dp))
            Text("Carga tus paradas de hoy", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.height(6.dp))
            Text("Escanea la etiqueta de cada paquete: si su código trae la dirección, la parada entra sola. Si no, la lee de la foto.",
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(18.dp))
            Button(onClick = alEscanear, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                Icon(Icons.Default.QrCodeScanner, contentDescription = null); Spacer(Modifier.width(8.dp)); Text("Escanear paquetes")
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = alAnadir, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                Icon(Icons.Default.Add, contentDescription = null); Spacer(Modifier.width(8.dp)); Text("Escribir una dirección")
            }
        }
    }
}

@Composable
private fun Terminada(entregadas: Int, total: Int) {
    val x = LocalExtra.current
    Surface(color = MaterialTheme.colorScheme.tertiaryContainer, shape = MaterialTheme.shapes.large) {
        Column(Modifier.fillMaxWidth().padding(20.dp)) {
            Icon(Icons.Default.Check, contentDescription = null, tint = x.entregado)
            Text("Ruta terminada", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onTertiaryContainer)
            Text("$entregadas de $total entregadas hoy.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onTertiaryContainer)
        }
    }
}

@Composable
private fun Numero(n: Int?, grande: Boolean = false, hecho: Boolean = false) {
    val tam = if (grande) 40.dp else 32.dp
    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(tam).background(
        if (hecho) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.primary, CircleShape)) {
        Text(n?.toString() ?: "·", style = (if (grande) MaterialTheme.typography.titleMedium else MaterialTheme.typography.labelLarge).merge(TextoNumero),
            fontWeight = FontWeight.Bold,
            color = if (hecho) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onPrimary)
    }
}

@Composable
fun Etiquetas(p: Parada) {
    val x = LocalExtra.current
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        p.eta?.let { Chip("≈ $it", MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.onSecondaryContainer) }
        if (p.porCobrar) Chip("Cobrar ${Region.importe(p.cobrar ?: 0.0)}", x.cobrar, x.enCobrar)
        if (p.prioridad) Chip("Urgente", MaterialTheme.colorScheme.errorContainer, MaterialTheme.colorScheme.onErrorContainer)
        if (p.bultos > 1) Chip("${p.bultos} bultos", MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant)
        if (!p.ubicada && p.pendiente) Chip("Sin ubicar", MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun Chip(t: String, fondo: androidx.compose.ui.graphics.Color, tinta: androidx.compose.ui.graphics.Color) {
    Surface(color = fondo, contentColor = tinta, shape = RoundedCornerShape(8.dp)) {
        Text(t, style = MaterialTheme.typography.labelMedium.merge(TextoNumero), modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
    }
}

@Composable
private fun Siguiente(
    p: Parada, numero: Int,
    alNavegar: () -> Unit, alLlamar: () -> Unit, alWhatsapp: () -> Unit, alEntregar: () -> Unit, alFallar: () -> Unit, alAbrir: () -> Unit,
) {
    val x = LocalExtra.current
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
        shape = MaterialTheme.shapes.large,
        border = androidx.compose.foundation.BorderStroke(2.dp, MaterialTheme.colorScheme.primary),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text("SIGUIENTE PARADA", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
            Spacer(Modifier.height(8.dp))
            Row(Modifier.clickable(onClick = alAbrir), verticalAlignment = Alignment.Top) {
                Numero(numero, grande = true)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(p.cliente.ifBlank { p.direccion }, style = MaterialTheme.typography.titleLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    if (p.cliente.isNotBlank()) Text(p.direccion, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (p.notas.isNotBlank()) Text(p.notas, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(6.dp))
                    Etiquetas(p)
                }
            }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = alNavegar, modifier = Modifier.weight(1f).height(52.dp)) {
                    Icon(Icons.Default.Navigation, contentDescription = null); Spacer(Modifier.width(6.dp)); Text("Navegar")
                }
                FilledTonalButton(onClick = alLlamar, enabled = p.telefono.isNotBlank(), modifier = Modifier.height(52.dp)) {
                    Icon(Icons.Default.Call, contentDescription = "Llamar")
                }
                FilledTonalButton(onClick = alWhatsapp, enabled = p.telefono.isNotBlank(), modifier = Modifier.height(52.dp)) {
                    Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "WhatsApp")
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = alFallar, modifier = Modifier.weight(1f).height(56.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                    Text("No entregado", maxLines = 1)
                }
                Button(onClick = alEntregar, modifier = Modifier.weight(1.2f).height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = x.entregado, contentColor = x.enEntregado)) {
                    Icon(Icons.Default.Check, contentDescription = null); Spacer(Modifier.width(4.dp)); Text("Entregado")
                }
            }
        }
    }
}

@Composable
fun Fila(p: Parada, numero: Int?, alTocar: () -> Unit) {
    Surface(onClick = alTocar, color = MaterialTheme.colorScheme.surfaceContainerLowest, shape = MaterialTheme.shapes.medium) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Numero(numero, hecho = !p.pendiente)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(p.cliente.ifBlank { p.direccion }, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (p.cliente.isNotBlank()) {
                    Text(p.direccion, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                if (p.pendiente && (p.eta != null || p.porCobrar || p.prioridad || !p.ubicada)) { Spacer(Modifier.height(4.dp)); Etiquetas(p) }
                if (!p.pendiente) {
                    Text(if (p.estado == "entregado") "Entregado" else "No entregado${p.motivo?.let { " · $it" } ?: ""}",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (p.estado == "entregado") LocalExtra.current.entregado else MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@Composable
private fun Hechas(hechas: List<Parada>, alTocar: (Parada) -> Unit) {
    var abierto by rememberSaveable { mutableStateOf(false) }
    Column {
        Row(Modifier.fillMaxWidth().clickable { abierto = !abierto }.padding(vertical = 10.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("HECHAS HOY · ${hechas.size}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f))
            Icon(if (abierto) Icons.Default.ExpandLess else Icons.Default.ExpandMore, contentDescription = if (abierto) "Ocultar" else "Ver")
        }
        AnimatedVisibility(abierto) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { hechas.forEach { Fila(it, numero = it.orden, alTocar = { alTocar(it) }) } }
        }
    }
}

@Composable
private fun SinRuta(error: String, alReintentar: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.CloudOff, contentDescription = null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(12.dp))
        Text(error, style = MaterialTheme.typography.bodyLarge)
        Spacer(Modifier.height(16.dp))
        Button(onClick = alReintentar) { Text("Reintentar") }
    }
}
