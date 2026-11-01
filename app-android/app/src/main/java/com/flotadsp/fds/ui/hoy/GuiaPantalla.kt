package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.ui.tx
import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.DashPathEffect
import android.graphics.Matrix
import android.graphics.drawable.BitmapDrawable
import android.location.Location
import android.net.Uri
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.MotionEvent
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.RoundaboutLeft
import androidx.compose.material.icons.filled.TurnLeft
import androidx.compose.material.icons.filled.TurnRight
import androidx.compose.material.icons.filled.TurnSlightLeft
import androidx.compose.material.icons.filled.TurnSlightRight
import androidx.compose.material.icons.filled.UTurnLeft
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.ui.Acciones
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.Voz
import com.flotadsp.fds.ui.escaner.actividad
import com.google.android.gms.location.LocationAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.CustomZoomButtonsController
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Overlay
import org.osmdroid.views.overlay.Polyline
import kotlin.math.max
import kotlin.math.roundToInt

/* LA GUÍA DENTRO DE LA APP (01-11-2026), como la web (pages/driver/Navegacion.jsx): el mapa que te sigue, la próxima
   maniobra en grande y en voz alta, recalcula si te sales de la ruta, y al llegar: Entregado / No entregado y a la
   siguiente sin tocar nada más. Las cuentas y las reglas están en Guia.kt (Navegador y MotorGuia); aquí solo se pinta,
   se habla y se pide la ubicación. Sin tráfico en directo ni carriles: para eso, el botón de Google Maps sigue ahí.
   La ubicación se usa para guiar y NO se guarda. */

/** Una posición del móvil con su rumbo (grados desde el norte), si se sabe. */
private data class Posicion(val p: Punto, val rumbo: Double?)

private val VERDE_GUIA = Color(0xFF047857)
private val AMBAR_GUIA = Color(0xFFB45309)

@Composable
fun GuiaPantalla(
    parada: Parada, numero: Int, quedan: Int,
    /** El navegador de fuera («google» o «waze»), por si quiere tráfico en directo. */
    navegarFuera: String,
    /** Los avisos de Hoy («Entregado · Deshacer», un error al guardar): esta ventana los taparía, así que se pintan también aquí. */
    avisos: SnackbarHostState,
    onSalir: () -> Unit, onEntregar: (Parada) -> Unit, onNoEntregar: (Parada) -> Unit, onLlamar: (Parada) -> Unit, onLlegar: (Parada) -> Unit,
) {
    // Una ventana propia a pantalla completa: tapa la barra de pestañas de «Hoy», y las hojas de entregar y de no
    // entregado (ventanas que se abren después) quedan encima de la guía.
    Dialog(onDismissRequest = onSalir, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false, dismissOnClickOutside = false)) {
        Guiando(parada, numero, quedan, navegarFuera, avisos, onSalir, onEntregar, onNoEntregar, onLlamar, onLlegar)
    }
}

@Composable
private fun Guiando(
    parada: Parada, numero: Int, quedan: Int, navegarFuera: String, avisos: SnackbarHostState,
    onSalir: () -> Unit, onEntregar: (Parada) -> Unit, onNoEntregar: (Parada) -> Unit, onLlamar: (Parada) -> Unit, onLlegar: (Parada) -> Unit,
) {
    val ctx = LocalContext.current
    val app = ctx.applicationContext as FdsApp
    val ambito = rememberCoroutineScope()
    val actividad = remember(ctx) { ctx.actividad() }
    val voz by app.cuenta.guiaVoz.collectAsState()
    val motor = remember { MotorGuia() }
    val brujula = remember { RumboGps() }
    var pos by remember { mutableStateOf<Posicion?>(null) }
    var errPos by remember { mutableStateOf("") }
    var ruta by remember { mutableStateOf<RutaGuiada?>(null) }      // la del motor, como estado para repintar
    var errGuia by remember { mutableStateOf("") }
    var pidiendo by remember { mutableStateOf(false) }
    var llegado by remember { mutableStateOf<String?>(null) }       // la parada a la que se ha llegado
    var seguir by remember { mutableStateOf(true) }
    val destino = Punto(parada.lat ?: 0.0, parada.lng ?: 0.0)
    val lista = ruta?.takeIf { it.id == parada.id }
    val vista = remember(lista, pos, parada.id) { lista?.let { motor.vista(parada.id, pos?.p) } }
    var panelAlto by remember { mutableStateOf(0) }                 // el alto del panel de abajo, para los avisos
    val haLlegado = llegado == parada.id

    BackHandler(onBack = onSalir)   // el «atrás» del móvil sale de la guía, no de la app
    fun habla(t: String, cola: Boolean = false) { if (app.cuenta.guiaVoz.value) Voz.decir(ctx, t, cola) }

    // La pantalla encendida mientras se guía: en la ventana de la guía (la que está delante).
    val ventanaVista = LocalView.current
    val ciclo = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(Unit) {
        val ventana = (ventanaVista.parent as? DialogWindowProvider)?.window ?: actividad?.window
        ventana?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose { ventana?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) }
    }

    // El permiso de ubicación: se pide al entrar; denegado dos veces, solo queda llevarle a los permisos de la app.
    val permisos = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    val conPermiso = { permisos.any { ContextCompat.checkSelfPermission(ctx, it) == PackageManager.PERMISSION_GRANTED } }
    var permiso by remember { mutableStateOf(conPermiso()) }
    var bloqueado by remember { mutableStateOf(false) }
    val pedirPermiso = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        permiso = r.values.any { it }
        bloqueado = !permiso && actividad?.shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION) == false
    }
    LaunchedEffect(Unit) { if (!permiso) pedirPermiso.launch(permisos) }
    LifecycleResumeEffect(Unit) { if (!permiso && conPermiso()) permiso = true; onPauseOrDispose { } }

    // La posición, mientras esta pantalla está abierta (se deja de pedir al salir).
    LaunchedEffect(permiso) {
        if (!permiso) return@LaunchedEffect
        // Solo con la guía a la vista (01-11-2026): con Home o la pantalla bloqueada se suelta la petición, como promete
        // el manifiesto («solo con la app abierta»); al volver se vuelve a pedir.
        ciclo.repeatOnLifecycle(Lifecycle.State.STARTED) {
            posiciones(ctx).collect { l ->
                if (l == null) { errPos = tx("No llega la ubicación del móvil."); return@collect }
                val p = Punto(l.latitude, l.longitude)
                val rumbo = brujula.nueva(p, if (l.hasBearing()) l.bearing.toDouble() else null, if (l.hasSpeed()) l.speed.toDouble() else 0.0)
                errPos = ""
                pos = Posicion(p, rumbo)
            }
        }
    }

    // La ruta hasta la parada, desde donde está el móvil. Se dice adónde vamos (detrás del briefing, si lo hay) o
    // que se ha recalculado.
    fun pedir(p: Parada, desde: Punto, recalculo: Boolean) {
        motor.pedida(); pidiendo = true
        ambito.launch {
            try {
                val g = app.repo.navegar(p.id, desde.lat, desde.lng)
                motor.cargar(p.id, g)
                ruta = motor.ruta; errGuia = ""
                habla(if (recalculo) tx("Ruta recalculada.") else Navegador.fraseVamos(p.cliente.ifBlank { tx("la siguiente parada") }, g.metros), cola = true)
            } catch (e: ErrorApi) {
                motor.fallida(); errGuia = e.message ?: tx("No se pudo calcular la ruta")
            } finally { pidiendo = false }
        }
    }

    // Parada nueva (o la primera posición): ruta hasta ella. Tras un fallo, se vuelve a intentar a los 15 s.
    LaunchedEffect(parada.id, pos, pidiendo, errGuia) {
        val p = pos ?: return@LaunchedEffect
        if (motor.tocaPedir(parada.id, errGuia.isNotEmpty())) pedir(parada, p.p, recalculo = false)
    }

    // Cada posición: ¿has llegado?, ¿te has salido?, ¿toca anunciar algo?
    LaunchedEffect(pos, parada.id, ruta) {
        val p = pos ?: return@LaunchedEffect
        when (val d = motor.posicion(p.p, parada.id, destino)) {
            is Decision.Anunciar -> habla(d.frase)
            Decision.Llegado -> {
                llegado = parada.id
                onLlegar(parada)
                habla(Navegador.fraseLlegado(parada.cliente.ifBlank { tx("la parada") }, parada.hueco))
                Acciones.vibrar(ctx, 80)
            }
            Decision.Recalcular -> pedir(parada, p.p, recalculo = true)
            Decision.Nada -> Unit
        }
    }

    // EL MAPA: te sigue (si no lo arrastras), la ruta en azul gruesa como un navegador, tu punto azul con la flecha
    // hacia donde vas y la parada con su número. Norte arriba.
    val cian = MaterialTheme.colorScheme.primary.toArgb()
    val tinta = MaterialTheme.colorScheme.onPrimary.toArgb()
    val pin = remember(numero, cian, tinta) { chincheta(ctx, numero, cian, tinta, grande = true, zbe = false, dice = false) }
    val quieto = remember { puntoAzul(ctx, false) }
    val flecha = remember { puntoAzul(ctx, true) }
    // La flecha girada hacia donde se va, de 5 en 5 grados para no dibujarla a cada posición.
    val rumboRedondeado = pos?.rumbo?.let { (it / 5).roundToInt() * 5 }
    val yo = remember(rumboRedondeado) { if (rumboRedondeado == null) quieto else girada(flecha, rumboRedondeado.toFloat()) }
    // Arrastrar el mapa deja de seguirte, como en cualquier navegador; el botón «Seguirme» vuelve a centrarte.
    val toque = remember {
        object : Overlay() {
            override fun onTouchEvent(e: MotionEvent?, m: MapView?): Boolean { if (e?.action == MotionEvent.ACTION_MOVE) seguir = false; return false }
        }
    }
    val mapa = remember {
        MapView(ctx).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            zoomController.setVisibility(CustomZoomButtonsController.Visibility.NEVER)
            isTilesScaledToDpi = true
            minZoomLevel = 4.0
            maxZoomLevel = 19.0
            controller.setZoom(16.0)
            controller.setCenter(GeoPoint(destino.lat, destino.lng))
        }
    }
    DisposableEffect(ciclo) {
        val o = LifecycleEventObserver { _, ev ->
            when (ev) {
                Lifecycle.Event.ON_RESUME -> mapa.onResume()
                Lifecycle.Event.ON_PAUSE -> mapa.onPause()
                else -> Unit
            }
        }
        ciclo.addObserver(o)
        onDispose { ciclo.removeObserver(o); mapa.onDetach() }
    }
    LaunchedEffect(pos, seguir) {
        val p = pos ?: return@LaunchedEffect
        if (seguir) mapa.controller.animateTo(GeoPoint(p.p.lat, p.p.lng), max(mapa.zoomLevelDouble, 17.5), 600L)
    }
    // Sin ubicación todavía (sin permiso o sin GPS) nada mueve el mapa: la parada nueva se encuadra ella.
    LaunchedEffect(parada.id) { if (pos == null) mapa.controller.animateTo(GeoPoint(destino.lat, destino.lng), 16.0, 400L) }

    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        AndroidView(factory = { mapa }, modifier = Modifier.fillMaxSize(), update = { m ->
            m.overlays.clear()
            m.overlays.add(toque)
            lista?.let { r ->
                val puntos = r.prep.linea.map { GeoPoint(it.lat, it.lng) }
                if (puntos.size >= 2) {
                    val d = m.context.dp()
                    val porCalles = r.fuente == "carreteras"
                    m.overlays.add(Polyline(m).apply {
                        setPoints(puntos)
                        outlinePaint.set(trazo(AZUL_OSCURO, (if (porCalles) 10f else 6f) * d)); outlinePaint.alpha = 140
                        infoWindow = null
                    })
                    m.overlays.add(Polyline(m).apply {
                        setPoints(puntos)
                        outlinePaint.set(trazo(AZUL_RUTA, (if (porCalles) 6f else 3.5f) * d))
                        if (!porCalles) outlinePaint.pathEffect = DashPathEffect(floatArrayOf(10f * d, 8f * d), 0f)
                        infoWindow = null
                    })
                }
            }
            m.overlays.add(Marker(m).apply {
                position = GeoPoint(destino.lat, destino.lng)
                icon = BitmapDrawable(m.resources, pin)
                setAnchor(Marker.ANCHOR_CENTER, puntaChincheta(true))
                infoWindow = null
                setOnMarkerClickListener { _, _ -> true }
            })
            pos?.let { p ->
                m.overlays.add(Marker(m).apply {
                    position = GeoPoint(p.p.lat, p.p.lng)
                    icon = BitmapDrawable(m.resources, yo)
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    infoWindow = null
                    setOnMarkerClickListener { _, _ -> true }
                })
            }
            m.invalidate()
        })

        // ARRIBA: la próxima maniobra, en grande; o lo que falta para poder guiar.
        Column(Modifier.align(Alignment.TopCenter).fillMaxWidth().statusBarsPadding().padding(12.dp)) {
            when {
                !permiso -> {
                    Banda(ambar = true) {
                        Icon(Icons.Default.LocationOff, contentDescription = null, modifier = Modifier.size(30.dp)); Spacer(Modifier.width(12.dp))
                        Text(tx("Dale permiso de ubicación a la app para que te guíe."), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(8.dp))
                    FilledTonalButton(onClick = {
                        if (bloqueado) ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null)))
                        else pedirPermiso.launch(permisos)
                    }, modifier = Modifier.height(52.dp)) { Text(if (bloqueado) tx("Abrir los permisos") else tx("Reintentar")) }
                }
                // Sin ubicación y sin nada que enseñar: la banda entera. Con ruta y una posición de antes (un túnel, un
                // garaje), la maniobra se queda a la vista y el aviso va pequeño debajo (visto en el emulador, 01-11-2026).
                errPos.isNotEmpty() && (pos == null || vista == null) -> Banda(ambar = true) {
                    Icon(Icons.Default.LocationOff, contentDescription = null, modifier = Modifier.size(30.dp)); Spacer(Modifier.width(12.dp))
                    Text(errPos, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
                vista == null && errGuia.isNotEmpty() -> {
                    Banda(ambar = true) {
                        Icon(Icons.Default.CloudOff, contentDescription = null, modifier = Modifier.size(30.dp)); Spacer(Modifier.width(12.dp))
                        Text(errGuia, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilledTonalButton(onClick = { pos?.let { pedir(parada, it.p, recalculo = false) } }, enabled = pos != null && !pidiendo,
                            modifier = Modifier.height(52.dp)) { Text(tx("Reintentar")) }
                        FilledTonalButton(onClick = { Acciones.navegar(ctx, parada, navegarFuera) }, modifier = Modifier.height(52.dp)) { Text(nombreFuera(navegarFuera)) }
                    }
                }
                vista == null -> Banda {
                    CircularProgressIndicator(Modifier.size(28.dp), color = Color.White, strokeWidth = 3.dp); Spacer(Modifier.width(12.dp))
                    Text(tx("Calculando la ruta…"), fontSize = 17.sp, fontWeight = FontWeight.Bold)
                }
                haLlegado -> Banda {
                    Icon(Icons.Default.Flag, contentDescription = null, modifier = Modifier.size(34.dp)); Spacer(Modifier.width(12.dp))
                    Text(tx("Has llegado"), fontSize = 22.sp, fontWeight = FontWeight.Bold)
                }
                lista?.fuente == "linea_recta" -> Banda(ambar = true) {
                    val hacia = pos?.let { Navegador.rumbo(it.p, destino) } ?: 0.0
                    Icon(Icons.Default.Navigation, contentDescription = null, modifier = Modifier.size(34.dp).rotate(hacia.toFloat())); Spacer(Modifier.width(12.dp))
                    Column {
                        Text(Navegador.textoDistancia(vista.restante), fontSize = 24.sp, fontWeight = FontWeight.Bold, style = TextoNumero)
                        Text(tx("Sin indicaciones ahora: sigue la flecha hasta la parada"), fontSize = 14.sp)
                    }
                }
                else -> {
                    val paso = vista.paso?.paso
                    Banda {
                        Icon(iconoDe(paso?.icono), contentDescription = null, modifier = Modifier.size(52.dp)); Spacer(Modifier.width(12.dp))
                        Column {
                            Text(Navegador.textoDistancia(vista.falta), fontSize = 32.sp, lineHeight = 34.sp, fontWeight = FontWeight.Bold, style = TextoNumero)
                            Text(if (paso?.icono == "llegada") tx("Llegas a tu parada") else Navegador.textoPaso(paso), fontSize = 17.sp, lineHeight = 21.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    vista.luego?.takeIf { it.paso.icono != "llegada" }?.let { luego ->
                        Surface(color = Color(0xFF064E3B), contentColor = Color.White, shape = RoundedCornerShape(bottomStart = 12.dp, bottomEnd = 12.dp),
                            modifier = Modifier.padding(start = 12.dp)) {
                            Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(tx("Luego"), fontSize = 13.sp); Spacer(Modifier.width(6.dp))
                                Icon(iconoDe(luego.paso.icono), contentDescription = null, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(4.dp))
                                Text(Navegador.textoPaso(luego.paso), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            }
            if (pidiendo && vista != null) {
                Spacer(Modifier.height(8.dp))
                Surface(color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f), shape = CircleShape) {
                    Text(tx("Recalculando…"), style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp))
                }
            }
            if (errPos.isNotEmpty() && pos != null && vista != null) {
                Spacer(Modifier.height(8.dp))
                Surface(color = Color(0xFF9A3412), contentColor = Color.White, shape = CircleShape) {
                    Row(Modifier.padding(horizontal = 12.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.LocationOff, contentDescription = null, modifier = Modifier.size(14.dp)); Spacer(Modifier.width(6.dp))
                        Text(errPos, style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }

        // A la derecha: volver a seguirme cuando se ha movido el mapa.
        if (!seguir) {
            Surface(shape = CircleShape, shadowElevation = 3.dp, color = MaterialTheme.colorScheme.surface, contentColor = MaterialTheme.colorScheme.primary,
                modifier = Modifier.align(Alignment.CenterEnd).padding(12.dp)) {
                IconButton(onClick = { seguir = true }, modifier = Modifier.size(52.dp)) { Icon(Icons.Default.MyLocation, contentDescription = tx("Seguirme")) }
            }
        }

        // Los avisos de Hoy («Entregado · Deshacer», «No se ha podido guardar») también aquí: esta ventana taparía el
        // SnackbarHost de Hoy y el conductor no podría deshacer ni se enteraría del fallo (01-11-2026, revisión).
        SnackbarHost(avisos, Modifier.align(Alignment.BottomCenter).padding(bottom = with(LocalDensity.current) { panelAlto.toDp() } + 8.dp))

        // ABAJO: la parada y los botones grandes (se usan conduciendo).
        Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp), shadowElevation = 10.dp,
            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().onSizeChanged { panelAlto = it.height }) {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 12.dp).navigationBarsPadding()) {
                val x = LocalExtra.current
                Row(verticalAlignment = Alignment.Top) {
                    Numero(numero, grande = true)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        if (haLlegado) {
                            Text(tx("Parada {n}", "n" to numero) + (if (quedan > 1) " · " + tx("quedan {n}", "n" to quedan) else ""),
                                style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = x.entregado)
                        }
                        Text(parada.cliente.ifBlank { tx("Cliente") }, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(parada.direccion, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        vista?.let { v ->
                            Text(Navegador.textoDistancia(v.restante) + (v.minutos?.let { " · ${max(1, it.roundToInt())} min" } ?: ""),
                                style = MaterialTheme.typography.bodyMedium.merge(TextoNumero), color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        parada.clienteDice?.let { textoClienteDice(it) }?.takeIf { it.isNotBlank() }?.let {
                            Text(tx("El cliente dice: {t}", "t" to it), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.tertiary, maxLines = 4, overflow = TextOverflow.Ellipsis)
                        }
                        if (parada.hueco.isNotBlank()) {
                            Text(tx("Búscalo: {sitio}", "sitio" to tx(parada.hueco)), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { onNoEntregar(parada) }, modifier = Modifier.weight(1f).height(56.dp), contentPadding = PaddingValues(horizontal = 8.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                        Text(tx("No entregado"), maxLines = 1)
                    }
                    Button(onClick = { onEntregar(parada) }, modifier = Modifier.weight(1.2f).height(56.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = x.entregado, contentColor = x.enEntregado)) {
                        Icon(Icons.Default.Check, contentDescription = null); Spacer(Modifier.width(4.dp))
                        Text(if (parada.tipo == "recogida") tx("Recogido") else tx("Entregado"), maxLines = 1)
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (parada.telefono.isNotBlank()) {
                        FilledTonalButton(onClick = { onLlamar(parada) }, modifier = Modifier.size(52.dp), contentPadding = PaddingValues(0.dp)) {
                            Icon(Icons.Default.Call, contentDescription = tx("Llamar"))
                        }
                    }
                    // «YA HE LLEGADO» (01-11-2026, como la web): la puerta de verdad puede estar a 60-80 m del pin (la calle, el
                    // portal), y entonces el GPS nunca daría la llegada; el conductor manda y la guía deja de contar esa parada.
                    if (!haLlegado) {
                        FilledTonalButton(onClick = { llegado = parada.id; motor.llegadoAMano(parada.id); onLlegar(parada); Acciones.vibrar(ctx, 60) },
                            modifier = Modifier.weight(1f).height(52.dp), contentPadding = PaddingValues(horizontal = 10.dp)) {
                            Icon(Icons.Default.Flag, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(6.dp))
                            Text(tx("Ya he llegado"), maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
                        }
                    } else Spacer(Modifier.weight(1f))
                    // El mapa de fuera (Google Maps o Waze), por si quiere tráfico en directo.
                    FilledTonalButton(onClick = { Acciones.navegar(ctx, parada, navegarFuera) }, modifier = Modifier.size(52.dp), contentPadding = PaddingValues(0.dp)) {
                        Icon(Icons.Default.Map, contentDescription = nombreFuera(navegarFuera))
                    }
                    FilledTonalButton(onClick = { ambito.launch { app.cuenta.elegirGuiaVoz(!voz); if (voz) Voz.callar() } },
                        modifier = Modifier.size(52.dp), contentPadding = PaddingValues(0.dp)) {
                        Icon(if (voz) Icons.AutoMirrored.Filled.VolumeUp else Icons.AutoMirrored.Filled.VolumeOff,
                            contentDescription = if (voz) tx("Silenciar la voz") else tx("Activar la voz"))
                    }
                    OutlinedButton(onClick = onSalir, modifier = Modifier.size(52.dp), contentPadding = PaddingValues(0.dp)) {
                        Icon(Icons.Default.Close, contentDescription = tx("Salir"))
                    }
                }
                Text(tx("Tu ubicación se usa para guiarte y no se guarda."), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            }
        }
    }
}

/** La banda de arriba: verde (la maniobra) o ámbar (algo que falta o sin indicaciones), con letra blanca. */
@Composable
private fun Banda(ambar: Boolean = false, contenido: @Composable RowScope.() -> Unit) {
    Surface(color = if (ambar) AMBAR_GUIA else VERDE_GUIA, contentColor = Color.White, shape = RoundedCornerShape(18.dp), shadowElevation = 6.dp,
        modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, content = contenido)
    }
}

private fun nombreFuera(con: String): String = if (con == "waze") "Waze" else "Google Maps"

/** El icono de cada maniobra, con el mismo código que manda el servidor (y que usa la web). */
private fun iconoDe(icono: String?): ImageVector = when (icono) {
    "derecha" -> Icons.Default.TurnRight
    "izquierda" -> Icons.Default.TurnLeft
    "ligera-derecha" -> Icons.Default.TurnSlightRight
    "ligera-izquierda" -> Icons.Default.TurnSlightLeft
    "rotonda" -> Icons.Default.RoundaboutLeft
    "vuelta" -> Icons.Default.UTurnLeft
    "llegada" -> Icons.Default.Flag
    else -> Icons.Default.ArrowUpward
}

/** El punto azul con la flecha, girado hacia el rumbo (grados desde el norte, a derechas). */
private fun girada(b: Bitmap, grados: Float): Bitmap =
    Bitmap.createBitmap(b, 0, 0, b.width, b.height, Matrix().apply { postRotate(grados) }, true)

/** Las posiciones del proveedor «fused» de Google (GPS + wifi + red), cada 1,5 s y a partir de 3 m, solo mientras se
 *  recoge el flujo: al cerrar la guía se dejan de pedir. `null` cuando el móvil dice que no hay ubicación. */
@SuppressLint("MissingPermission")
private fun posiciones(ctx: Context): Flow<Location?> = callbackFlow {
    val cliente = LocationServices.getFusedLocationProviderClient(ctx)
    val oyente = object : LocationCallback() {
        override fun onLocationResult(r: LocationResult) { r.lastLocation?.let { trySend(it) } }
        override fun onLocationAvailability(a: LocationAvailability) { if (!a.isLocationAvailable) trySend(null) }
    }
    // La última posición que conoce el móvil solo si es de hace menos de 10 s: la de ayer (o la de la parada anterior)
    // pedía la ruta y decía «Vamos a…» desde donde ya no estás (01-11-2026, revisión).
    cliente.lastLocation.addOnSuccessListener { l -> if (l != null && SystemClock.elapsedRealtimeNanos() - l.elapsedRealtimeNanos < 10_000_000_000L) trySend(l) }
    val peticion = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1500L).build()
    cliente.requestLocationUpdates(peticion, oyente, Looper.getMainLooper())
    awaitClose { cliente.removeLocationUpdates(oyente) }
}
