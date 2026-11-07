// diseño compacto
package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.ui.tx
import android.Manifest
import android.annotation.SuppressLint
import android.content.ComponentCallbacks2
import android.content.Context
import android.animation.ValueAnimator
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Bitmap
import android.location.Location
import android.net.Uri
import android.view.animation.LinearInterpolator
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Forum
import androidx.compose.material.icons.filled.Inventory2
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
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
import com.flotadsp.fds.ui.Atribucion
import com.flotadsp.fds.ui.AvisoFlotante
import com.flotadsp.fds.ui.BotonIcono
import com.flotadsp.fds.ui.BotonMapa
import com.flotadsp.fds.ui.BotonNormal
import com.flotadsp.fds.ui.Esp
import com.flotadsp.fds.ui.EstadoNumero
import com.flotadsp.fds.ui.FilaCierre
import com.flotadsp.fds.ui.LetraMax
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.NumeroParada
import com.flotadsp.fds.ui.Pastilla
import com.flotadsp.fds.ui.TamNumero
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.Voz
import com.flotadsp.fds.ui.esNoche
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
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapLibreMapOptions
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory.iconAllowOverlap
import org.maplibre.android.style.layers.PropertyFactory.iconAnchor
import org.maplibre.android.style.layers.PropertyFactory.iconIgnorePlacement
import org.maplibre.android.style.layers.PropertyFactory.iconImage
import org.maplibre.android.style.layers.PropertyFactory.iconOffset
import org.maplibre.android.style.layers.PropertyFactory.iconPitchAlignment
import org.maplibre.android.style.layers.PropertyFactory.iconRotate
import org.maplibre.android.style.layers.PropertyFactory.iconRotationAlignment
import org.maplibre.android.style.layers.PropertyFactory.lineCap
import org.maplibre.android.style.layers.PropertyFactory.lineColor
import org.maplibre.android.style.layers.PropertyFactory.lineDasharray
import org.maplibre.android.style.layers.PropertyFactory.lineJoin
import org.maplibre.android.style.layers.PropertyFactory.lineOpacity
import org.maplibre.android.style.layers.PropertyFactory.lineWidth
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.LineString
import org.maplibre.geojson.Point
import kotlin.math.max
import kotlin.math.roundToInt

/* LA GUÍA DENTRO DE LA APP (01-11-2026), como la web (pages/driver/Navegacion.jsx): el mapa que te sigue, la próxima
   maniobra en grande y en voz alta, recalcula si te sales de la ruta, y al llegar: Entregado / No entregado y a la
   siguiente sin tocar nada más. Las cuentas y las reglas están en Guia.kt (Navegador y MotorGuia); aquí solo se pinta,
   se habla y se pide la ubicación. Sin tráfico en directo ni carriles: para eso, el botón de Google Maps sigue ahí.
   La ubicación se usa para guiar y NO se guarda. */

/** Una posición del móvil con su rumbo (grados desde el norte), si se sabe, y su velocidad (m/s; 0 si no la da). */
private data class Posicion(val p: Punto, val rumbo: Double?, val velocidad: Double)

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
    var errMapa by remember { mutableStateOf("") }                   // el estilo del mapa no cargó (sin red la primera vez)
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
                val velocidad = if (l.hasSpeed()) l.speed.toDouble() else 0.0
                val rumbo = brujula.nueva(p, if (l.hasBearing()) l.bearing.toDouble() else null, velocidad)
                errPos = ""
                pos = Posicion(p, rumbo, velocidad)
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

    // EL MAPA (01-11-2026, Dani: «no tan clásico, que la navegación se vea mejor y más bonita»): MapLibre con un estilo
    // propio de navegador (assets/mapa/guia-dia.json y guia-noche.json, sobre las teselas vectoriales de OpenFreeMap):
    // calles claras y marcadas con su jerarquía, edificios en volumen, nombres solo de cerca, sin iconos de comercios.
    // Te sigue con el rumbo hacia arriba e inclinado, con tu flecha en el tercio de abajo; la ruta en azul gruesa y la
    // parada con su número. Hasta hoy era osmdroid con las teselas de serie de OpenStreetMap, norte arriba.
    val cian = MaterialTheme.colorScheme.primary.toArgb()
    val tinta = MaterialTheme.colorScheme.onPrimary.toArgb()
    val pin = remember(numero, cian, tinta) { chincheta(ctx, numero, cian, tinta, grande = true, zbe = false, dice = false) }
    val tema by app.cuenta.tema.collectAsState()
    val noche = esNoche(tema)
    val capas = remember { CapasGuia(ctx) }
    val mapa = remember {
        MapLibre.getInstance(ctx)   // una vez por proceso (si ya existe, la devuelve); tiene que ir antes de crear la vista
        val opciones = MapLibreMapOptions.createFromAttributes(ctx)
            .camera(CameraPosition.Builder().target(LatLng(destino.lat, destino.lng)).zoom(16.0).build())
            .compassEnabled(false).logoEnabled(false).attributionEnabled(false)   // «© OpenStreetMap» lo pone esta pantalla
            .tiltGesturesEnabled(false)   // la inclinación la pone la guía; pellizcar, arrastrar y girar sí
            .textureMode(true)            // se compone como cualquier vista: dentro de la ventana de la guía (un Dialog) no se arriesga una superficie aparte
            .foregroundLoadColor(if (noche) FONDO_NOCHE else FONDO_DIA)
        // Arrastrar o girar el mapa deja de seguirte, como en cualquier navegador; el botón «Seguirme» vuelve a centrarte.
        MapView(ctx, opciones).also { v ->
            v.getMapAsync { m -> capas.listo(m, alArrastrar = { seguir = false }) }
            // Si el estilo no llega (sin red la primera vez), que no se quede un fondo mudo (revisión 01-11-2026).
            v.addOnDidFailLoadingMapListener { errMapa = tx("No se ha podido cargar el mapa.") }
            v.addOnDidFinishLoadingStyleListener { errMapa = "" }
        }
    }
    // El ciclo de vida que exige MapLibre (crear, arrancar, reanudar, pausar, parar, destruir y la memoria baja), colgado
    // del de la actividad; al cerrar la guía con la app en marcha se baja la vista a mano.
    DisposableEffect(ciclo) {
        val o = LifecycleEventObserver { _, ev ->
            when (ev) {
                Lifecycle.Event.ON_CREATE -> mapa.onCreate(null)
                Lifecycle.Event.ON_START -> mapa.onStart()
                Lifecycle.Event.ON_RESUME -> mapa.onResume()
                Lifecycle.Event.ON_PAUSE -> mapa.onPause()
                Lifecycle.Event.ON_STOP -> mapa.onStop()
                Lifecycle.Event.ON_DESTROY -> mapa.onDestroy()
                else -> Unit
            }
        }
        ciclo.addObserver(o)
        val memoria = object : ComponentCallbacks2 {
            override fun onLowMemory() = mapa.onLowMemory()
            override fun onTrimMemory(nivel: Int) = Unit
            override fun onConfigurationChanged(c: Configuration) = Unit
        }
        ctx.registerComponentCallbacks(memoria)
        onDispose {
            ciclo.removeObserver(o); ctx.unregisterComponentCallbacks(memoria)
            capas.soltar()
            if (ciclo.currentState != Lifecycle.State.DESTROYED) {
                if (ciclo.currentState.isAtLeast(Lifecycle.State.RESUMED)) mapa.onPause()
                if (ciclo.currentState.isAtLeast(Lifecycle.State.STARTED)) mapa.onStop()
                mapa.onDestroy()
            }
        }
    }
    // El estilo de día o de noche según el ajuste de la app («sistema» = el del móvil); cambia al vuelo.
    LaunchedEffect(noche) { capas.estilo(if (noche) "guia-noche" else "guia-dia") }
    LaunchedEffect(pos, seguir, panelAlto) { val p = pos ?: return@LaunchedEffect; if (seguir) capas.seguir(p, panelAlto) }
    // Sin ubicación todavía (sin permiso o sin GPS) nada mueve el mapa: la parada nueva se encuadra ella.
    LaunchedEffect(parada.id) { if (pos == null) capas.encuadrar(destino) }

    val x = LocalExtra.current
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        AndroidView(factory = { mapa }, modifier = Modifier.fillMaxSize(), update = {
            capas.ruta(lista); capas.puntos(destino, pos); capas.chincheta(pin)
        })

        // ARRIBA: la próxima maniobra, en grande; o lo que falta para poder guiar. (07-11-2026, diseño compacto, §5.8:
        // la banda con radio 16 y relleno 12, el icono de 40, la distancia en `guia`, la instrucción en `nombre` a dos
        // líneas y «Luego» en `sec`; los tamaños, del tema, y los colores, de Extra.)
        Column(Modifier.align(Alignment.TopCenter).fillMaxWidth().statusBarsPadding().padding(Esp.m)) {
            when {
                !permiso -> {
                    Banda(ambar = true) {
                        Icon(Icons.Default.LocationOff, contentDescription = null, modifier = Modifier.size(40.dp)); Spacer(Modifier.width(Esp.m))
                        Text(tx("Dale permiso de ubicación a la app para que te guíe."), style = MaterialTheme.typography.titleMedium)
                    }
                    Spacer(Modifier.height(Esp.s))
                    BotonNormal(if (bloqueado) tx("Abrir los permisos") else tx("Reintentar"), {
                        if (bloqueado) ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null)))
                        else pedirPermiso.launch(permisos)
                    })
                }
                // Sin ubicación y sin nada que enseñar: la banda entera. Con ruta y una posición de antes (un túnel, un
                // garaje), la maniobra se queda a la vista y el aviso va en una pastilla debajo (visto en el emulador, 01-11-2026).
                errPos.isNotEmpty() && (pos == null || vista == null) -> Banda(ambar = true) {
                    Icon(Icons.Default.LocationOff, contentDescription = null, modifier = Modifier.size(40.dp)); Spacer(Modifier.width(Esp.m))
                    Text(errPos, style = MaterialTheme.typography.titleMedium)
                }
                vista == null && errGuia.isNotEmpty() -> {
                    Banda(ambar = true) {
                        Icon(Icons.Default.CloudOff, contentDescription = null, modifier = Modifier.size(40.dp)); Spacer(Modifier.width(Esp.m))
                        Text(errGuia, style = MaterialTheme.typography.titleMedium)
                    }
                    Spacer(Modifier.height(Esp.s))
                    Row(horizontalArrangement = Arrangement.spacedBy(Esp.s)) {
                        BotonNormal(tx("Reintentar"), { pos?.let { pedir(parada, it.p, recalculo = false) } }, enabled = pos != null && !pidiendo)
                        BotonNormal(nombreFuera(navegarFuera), { Acciones.navegar(ctx, parada, navegarFuera) })
                    }
                }
                vista == null -> Banda {
                    CircularProgressIndicator(Modifier.size(28.dp), color = Color.White, strokeWidth = 3.dp); Spacer(Modifier.width(Esp.m))
                    Text(tx("Calculando la ruta…"), style = MaterialTheme.typography.titleMedium)
                }
                haLlegado -> Banda {
                    Icon(Icons.Default.Flag, contentDescription = null, modifier = Modifier.size(40.dp)); Spacer(Modifier.width(Esp.m))
                    Text(tx("Has llegado"), style = MaterialTheme.typography.titleLarge)
                }
                lista?.fuente == "linea_recta" -> Banda(ambar = true) {
                    val hacia = pos?.let { Navegador.rumbo(it.p, destino) } ?: 0.0
                    Icon(Icons.Default.Navigation, contentDescription = null, modifier = Modifier.size(40.dp).rotate(hacia.toFloat())); Spacer(Modifier.width(Esp.m))
                    Column {
                        Text(Navegador.textoDistancia(vista.restante), style = MaterialTheme.typography.displaySmall)
                        Text(tx("Sigue la flecha"), style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
                else -> {
                    val paso = vista.paso?.paso
                    Banda {
                        Icon(iconoDe(paso?.icono), contentDescription = null, modifier = Modifier.size(40.dp)); Spacer(Modifier.width(Esp.m))
                        Column {
                            Text(Navegador.textoDistancia(vista.falta), style = MaterialTheme.typography.displaySmall)
                            Text(if (paso?.icono == "llegada") tx("Llegas a tu parada") else Navegador.textoPaso(paso),
                                style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    vista.luego?.takeIf { it.paso.icono != "llegada" }?.let { luego ->
                        LetraMax(1.3f) {
                            Surface(color = x.guiaLuego, contentColor = Color.White, shape = RoundedCornerShape(bottomStart = 12.dp, bottomEnd = 12.dp),
                                modifier = Modifier.padding(start = Esp.m)) {
                                Row(Modifier.padding(horizontal = Esp.m, vertical = Esp.xs), verticalAlignment = Alignment.CenterVertically) {
                                    Text(tx("Luego"), style = MaterialTheme.typography.bodySmall); Spacer(Modifier.width(Esp.xs))
                                    Icon(iconoDe(luego.paso.icono), contentDescription = null, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(Esp.xs))
                                    Text(Navegador.textoPaso(luego.paso), style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                            }
                        }
                    }
                }
            }
            if (pidiendo && vista != null) { Spacer(Modifier.height(Esp.s)); PastillaGuia(tx("Recalculando…")) }
            if (errPos.isNotEmpty() && pos != null && vista != null) { Spacer(Modifier.height(Esp.s)); PastillaGuia(errPos, Icons.Default.LocationOff, aviso = true) }
            if (errMapa.isNotEmpty()) { Spacer(Modifier.height(Esp.s)); PastillaGuia(errMapa, Icons.Default.CloudOff, aviso = true) }
        }

        // A LA DERECHA, sobre el panel (07-11-2026, diseño compacto): la voz, el mapa de fuera (Google Maps o Waze, por
        // si quiere tráfico en directo) y, si se ha movido el mapa, «Seguirme». Botones de 48, a 12 por encima del panel;
        // hasta hoy iban en la fila de cinco del panel.
        val panelDp = with(LocalDensity.current) { panelAlto.toDp() }
        Column(Modifier.align(Alignment.BottomEnd).padding(end = Esp.m, bottom = panelDp + Esp.m), verticalArrangement = Arrangement.spacedBy(Esp.s)) {
            BotonMapa(if (voz) Icons.AutoMirrored.Filled.VolumeUp else Icons.AutoMirrored.Filled.VolumeOff,
                if (voz) tx("Silenciar la voz") else tx("Activar la voz"), activo = voz,
                onClick = { ambito.launch { app.cuenta.elegirGuiaVoz(!voz); if (voz) Voz.callar() } })
            BotonMapa(Icons.Default.Map, nombreFuera(navegarFuera), onClick = { Acciones.navegar(ctx, parada, navegarFuera) })
            if (!seguir) BotonMapa(Icons.Default.MyLocation, tx("Seguirme"), onClick = { seguir = true })
        }

        // De dónde salen los datos del mapa (OpenStreetMap, por OpenFreeMap): pequeño, sobre el panel de abajo.
        Atribucion(tx("© OpenStreetMap · OpenMapTiles"), Modifier.align(Alignment.BottomStart).padding(start = Esp.s, bottom = panelDp + Esp.s)
            .clickable { runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.openstreetmap.org/copyright"))) } })

        // Los avisos de Hoy («Entregado · Deshacer», «No se ha podido guardar») también aquí: esta ventana taparía el
        // SnackbarHost de Hoy y el conductor no podría deshacer ni se enteraría del fallo (01-11-2026, revisión). A 8 del panel.
        AvisoFlotante(avisos, Modifier.align(Alignment.BottomCenter).padding(bottom = panelDp + Esp.s))

        // ABAJO: el panel (07-11-2026, diseño compacto, §5.8): radio 16 arriba y relleno 12. El número de 40, el nombre en
        // una línea, «Llamar» de icono y la ✕ «Salir»; «Llegas ≈ 09:34 · 810 m · 2 min»; las notas en una línea (el hueco
        // y lo que dice el cliente, cada uno con su icono y su frase entera de nombre); antes de llegar, «Ya he llegado» a
        // lo ancho; y, como hasta hoy, siempre No entregado / Entregado. La frase de la ubicación se queda, en una línea:
        // ni la ficha de Play ni docs/REVISION_LEGAL.md dicen aún que la guía usa la ubicación (riesgo 16).
        Surface(color = MaterialTheme.colorScheme.surfaceContainerLow, shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp), shadowElevation = 10.dp,
            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().onSizeChanged { panelAlto = it.height }) {
            Column(Modifier.padding(Esp.m).navigationBarsPadding()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    NumeroParada(numero, TamNumero.GRANDE, EstadoNumero.SIGUIENTE)
                    Spacer(Modifier.width(Esp.m))
                    Column(Modifier.weight(1f)) {
                        if (haLlegado) {
                            Text(tx("Parada {n}", "n" to numero) + (if (quedan > 1) " · " + tx("quedan {n}", "n" to quedan) else ""),
                                style = MaterialTheme.typography.labelMedium.merge(TextoNumero), color = x.entregadoTexto, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Text(parada.cliente.ifBlank { parada.direccion.ifBlank { tx("Cliente") } }, style = MaterialTheme.typography.titleLarge,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    if (parada.telefono.isNotBlank()) BotonIcono(Icons.Default.Call, tx("Llamar"), { onLlamar(parada) })
                    BotonIcono(Icons.Default.Close, tx("Salir"), onSalir)
                }
                vista?.let { v ->
                    val minutos = v.minutos?.let { max(1, it.roundToInt()) }
                    Text(buildAnnotatedString {
                        if (minutos != null) {
                            append(tx("Llegas") + " ")
                            withStyle(SpanStyle(color = x.entregadoTexto)) { append("≈ " + horaMas(minutos)) }
                            append(" · ")
                        }
                        append(Navegador.textoDistancia(v.restante))
                        if (minutos != null) append(" · $minutos min")
                    }, style = MaterialTheme.typography.bodyMedium.merge(TextoNumero), color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = Esp.xs))
                }
                val dice = parada.clienteDice?.let { textoClienteDice(it) }?.takeIf { it.isNotBlank() }
                if (parada.hueco.isNotBlank() || dice != null) {
                    Row(Modifier.padding(top = Esp.xs), verticalAlignment = Alignment.CenterVertically) {
                        if (parada.hueco.isNotBlank()) {
                            val sitio = tx(parada.hueco)
                            Row(Modifier.semantics(mergeDescendants = true) { contentDescription = tx("En la furgoneta: {sitio}", "sitio" to sitio) },
                                verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Inventory2, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(Esp.xs))
                                Text(sitio, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                            }
                            if (dice != null) Text(" · ", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (dice != null) {
                            Row(Modifier.weight(1f).semantics(mergeDescendants = true) { contentDescription = tx("El cliente dice: {t}", "t" to dice) },
                                verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Forum, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(Esp.xs))
                                Text(dice, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
                // «YA HE LLEGADO» (01-11-2026, como la web): la puerta de verdad puede estar a 60-80 m del pin (la calle, el
                // portal), y entonces el GPS nunca daría la llegada; el conductor manda y la guía deja de contar esa parada.
                if (!haLlegado) {
                    Spacer(Modifier.height(Esp.m))
                    BotonNormal(tx("Ya he llegado"), { llegado = parada.id; motor.llegadoAMano(parada.id); onLlegar(parada); Acciones.vibrar(ctx, 60) },
                        icono = Icons.Default.Flag, modifier = Modifier.fillMaxWidth())
                }
                Spacer(Modifier.height(Esp.m))
                FilaCierre(recogida = parada.tipo == "recogida", alFallar = { onNoEntregar(parada) }, alEntregar = { onEntregar(parada) })
                Text(tx("Tu ubicación se usa para guiarte y no se guarda."), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.fillMaxWidth().padding(top = Esp.s))
            }
        }
    }
}

/** La banda de arriba (07-11-2026, diseño compacto): radio 16 y relleno 12, en el verde de la guía (ámbar si falta algo
 *  o no hay indicaciones) con letra blanca, y el tope de letra de 1,3: se mira conduciendo, grande pero sin desbordar. */
@Composable
private fun Banda(ambar: Boolean = false, contenido: @Composable RowScope.() -> Unit) {
    val x = LocalExtra.current
    LetraMax(1.3f) {
        Surface(color = if (ambar) x.guiaAviso else x.guia, contentColor = Color.White, shape = MaterialTheme.shapes.large, shadowElevation = 6.dp,
            modifier = Modifier.fillMaxWidth()) {
            Row(Modifier.padding(Esp.m), verticalAlignment = Alignment.CenterVertically, content = contenido)
        }
    }
}

/** Una pastilla bajo la banda («Recalculando…», sin ubicación, sin mapa): la de aviso, en el naranja de la guía con letra blanca. */
@Composable
private fun PastillaGuia(texto: String, icono: ImageVector? = null, aviso: Boolean = false) {
    val x = LocalExtra.current
    LetraMax(1.3f) {
        if (aviso) Pastilla(texto, icono = icono, color = x.guiaPildora, contentColor = Color.White)
        else Pastilla(texto, icono = icono)
    }
}

/** La hora de llegada prevista: la de ahora más los minutos que quedan, como la web («Llegas ≈ 09:34»). */
private fun horaMas(minutos: Int): String = java.time.LocalTime.now().plusMinutes(minutos.toLong()).let { "%02d:%02d".format(it.hour, it.minute) }

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

/** El fondo de los dos estilos (assets/mapa/guia-*.json), para la vista mientras carga el mapa. */
private val FONDO_DIA = 0xFFF2F0E9.toInt()
private val FONDO_NOCHE = 0xFF0E1726.toInt()
/** La primera capa de nombres del estilo: la ruta va justo debajo (se lee por qué calle vas) y encima de todo lo demás. */
private const val PRIMERA_ETIQUETA = "nombres_calles_menores"
// Lo que tarda la cámara en llegar a cada posición (llegan cada 1,5 s): la flecha se desliza lo mismo, para ir juntas.
private const val DURACION_CAMARA = 1400L
// La ruta de noche con otros azules: la de día (#3B82F6 con borde #1E3A8A) casi no se distinguía de las calles grises
// y marrones del estilo nocturno (revisión 01-11-2026).
private val RUTA_NOCHE = 0xFF60A5FA.toInt()
private val RUTA_NOCHE_BORDE = 0xFFBFDBFE.toInt()

/* LAS CAPAS DE LA GUÍA sobre el mapa de MapLibre: la ruta (un borde azul oscuro ancho y el azul de la app encima; más
   fina y a rayas si es en línea recta), la parada con su chincheta y el conductor (el punto azul; con rumbo, la flecha
   girada hacia donde va). Se montan una vez por estilo (día o noche) y después solo cambian los datos de sus fuentes
   GeoJSON: nada se rehace a cada posición. La cámara va aquí también. Todo espera a que el mapa esté listo. */
private class CapasGuia(ctx: Context) {
    private val densidad = ctx.dp()
    private val flecha = puntoAzul(ctx, true)
    private val quieto = puntoAzul(ctx, false)
    private var mapa: MapLibreMap? = null
    private var estilo = ""
    private var fuenteRuta: GeoJsonSource? = null
    private var fuentePuntos: GeoJsonSource? = null
    private var pin: Bitmap? = null
    private var pinPuesto: Bitmap? = null
    private var ruta: RutaGuiada? = null
    private var parada: Punto? = null
    private var yo: Posicion? = null
    private var yoPintado: Posicion? = null              // lo que se pinta: va deslizándose hacia `yo` al ritmo de la cámara
    private var animador: ValueAnimator? = null
    private var camaraPendiente: (() -> Unit)? = null

    fun listo(m: MapLibreMap, alArrastrar: () -> Unit) {
        mapa = m
        m.setMinZoomPreference(4.0); m.setMaxZoomPreference(20.0)   // ni el mundo entero ni teselas de z14 estiradas
        m.addOnCameraMoveStartedListener { motivo -> if (motivo == MapLibreMap.OnCameraMoveStartedListener.REASON_API_GESTURE) alArrastrar() }
        if (estilo.isNotEmpty()) cargar()
        camaraPendiente?.invoke(); camaraPendiente = null
    }

    /** El estilo («guia-dia» o «guia-noche», en assets/mapa); al cambiarlo se vuelven a montar las capas. */
    fun estilo(nombre: String) { if (nombre != estilo) { estilo = nombre; cargar() } }

    private fun cargar() {
        val m = mapa ?: return
        fuenteRuta = null; fuentePuntos = null; pinPuesto = null   // las del estilo anterior mueren con él
        m.setStyle(Style.Builder().fromUri("asset://mapa/$estilo.json")) { montar(it) }
    }

    private fun montar(s: Style) {
        // Dos setStyle seguidos (cambiar de tema antes de que cargue el primero) llaman a los dos montar() sobre el mismo
        // estilo: el segundo sobra (addSource lanzaría «Source ruta already exists»).
        if (s.getSource("ruta") != null) return
        val noche = estilo == "guia-noche"
        val relleno = if (noche) RUTA_NOCHE else AZUL_RUTA
        val borde = if (noche) RUTA_NOCHE_BORDE else AZUL_OSCURO
        s.addImage("flecha", flecha); s.addImage("quieto", quieto)
        fuenteRuta = GeoJsonSource("ruta").also { s.addSource(it) }
        fuentePuntos = GeoJsonSource("puntos").also { s.addSource(it) }
        fun bajoNombres(capa: LineLayer) = if (s.getLayer(PRIMERA_ETIQUETA) != null) s.addLayerBelow(capa, PRIMERA_ETIQUETA) else s.addLayer(capa)
        val porCalles = Expression.eq(Expression.get("tipo"), "calles")
        val recta = Expression.eq(Expression.get("tipo"), "recta")
        bajoNombres(LineLayer("ruta-borde", "ruta").withFilter(porCalles).withProperties(
            lineColor(borde), lineOpacity(0.6f), lineWidth(anchoRuta(5.5f, 8.5f, 12.5f, 20f)), lineCap(Property.LINE_CAP_ROUND), lineJoin(Property.LINE_JOIN_ROUND)))
        bajoNombres(LineLayer("ruta", "ruta").withFilter(porCalles).withProperties(
            lineColor(relleno), lineWidth(anchoRuta(3f, 5f, 8f, 14f)), lineCap(Property.LINE_CAP_ROUND), lineJoin(Property.LINE_JOIN_ROUND)))
        // En línea recta (sin calles que seguir): más fina y a rayas, como en el mapa de la ruta.
        bajoNombres(LineLayer("recta-borde", "ruta").withFilter(recta).withProperties(
            lineColor(borde), lineOpacity(0.6f), lineWidth(anchoRuta(3.5f, 5f, 7f, 11f)), lineCap(Property.LINE_CAP_ROUND), lineJoin(Property.LINE_JOIN_ROUND)))
        bajoNombres(LineLayer("recta", "ruta").withFilter(recta).withProperties(
            lineColor(relleno), lineWidth(anchoRuta(2f, 3f, 4.5f, 7f)), lineDasharray(arrayOf(1.8f, 1.6f)), lineCap(Property.LINE_CAP_ROUND), lineJoin(Property.LINE_JOIN_ROUND)))
        s.addLayer(SymbolLayer("parada", "puntos").withFilter(Expression.eq(Expression.get("que"), "parada")).withProperties(
            iconImage("parada"), iconAnchor(Property.ICON_ANCHOR_BOTTOM), iconAllowOverlap(true), iconIgnorePlacement(true)))
        // La flecha gira con el rumbo sobre el mapa (con la cámara detrás, siempre apunta arriba) pero se ve de frente.
        s.addLayer(SymbolLayer("yo", "puntos").withFilter(Expression.eq(Expression.get("que"), "yo")).withProperties(
            iconImage(Expression.get("icono")), iconRotate(Expression.get("rumbo")), iconRotationAlignment(Property.ICON_ROTATION_ALIGNMENT_MAP),
            iconPitchAlignment(Property.ICON_PITCH_ALIGNMENT_VIEWPORT), iconAllowOverlap(true), iconIgnorePlacement(true)))
        pintarRuta(); pintarPuntos(); pintarChincheta()
    }

    /** El ancho (dp) de la línea por zoom: más fina de lejos, como las calles del estilo. */
    private fun anchoRuta(z12: Float, z15: Float, z17: Float, z20: Float): Expression = Expression.interpolate(
        Expression.exponential(1.5f), Expression.zoom(), Expression.stop(12, z12), Expression.stop(15, z15), Expression.stop(17, z17), Expression.stop(20, z20))

    fun ruta(r: RutaGuiada?) { if (r !== ruta) { ruta = r; pintarRuta() } }
    fun puntos(parada: Punto, yo: Posicion?) {
        if (parada != this.parada) { this.parada = parada; pintarPuntos() }
        if (yo == this.yo) return
        val desde = yoPintado ?: this.yo
        this.yo = yo
        animador?.cancel()
        if (yo == null || desde == null) { yoPintado = yo; pintarPuntos(); return }
        // La flecha se desliza hasta la posición nueva lo mismo que tarda la cámara: si saltara al momento iría por
        // delante y bajaría sola hasta su sitio en cada posición (diente de sierra; revisión 01-11-2026).
        val r0 = desde.rumbo ?: yo.rumbo
        val r1 = yo.rumbo ?: desde.rumbo
        val giro = if (r0 != null && r1 != null) ((r1 - r0 + 540.0) % 360.0) - 180.0 else 0.0   // por el arco corto
        animador = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = DURACION_CAMARA; interpolator = LinearInterpolator()
            addUpdateListener { a ->
                val t = (a.animatedValue as Float).toDouble()
                val lat = desde.p.lat + (yo.p.lat - desde.p.lat) * t
                val lng = desde.p.lng + (yo.p.lng - desde.p.lng) * t
                val rumbo = r0?.let { (((it + giro * t) % 360.0) + 360.0) % 360.0 } ?: yo.rumbo
                yoPintado = Posicion(Punto(lat, lng), rumbo, yo.velocidad); pintarPuntos()
            }
            start()
        }
    }
    /** Al cerrar la guía: que la flecha no siga moviéndose sobre un mapa que ya no existe. */
    fun soltar() { animador?.cancel(); animador = null }
    fun chincheta(b: Bitmap) { if (b !== pin) { pin = b; pintarChincheta() } }

    private fun pintarRuta() {
        val r = ruta?.takeIf { it.prep.linea.size >= 2 }
        fuenteRuta?.setGeoJson(FeatureCollection.fromFeatures(listOfNotNull(r?.let {
            Feature.fromGeometry(LineString.fromLngLats(it.prep.linea.map { p -> Point.fromLngLat(p.lng, p.lat) }))
                .apply { addStringProperty("tipo", if (it.fuente == "carreteras") "calles" else "recta") }
        })))
    }

    private fun pintarPuntos() {
        fuentePuntos?.setGeoJson(FeatureCollection.fromFeatures(listOfNotNull(
            parada?.let { Feature.fromGeometry(Point.fromLngLat(it.lng, it.lat)).apply { addStringProperty("que", "parada") } },
            yoPintado?.let {
                Feature.fromGeometry(Point.fromLngLat(it.p.lng, it.p.lat)).apply {
                    addStringProperty("que", "yo")
                    addStringProperty("icono", if (it.rumbo == null) "quieto" else "flecha")
                    addNumberProperty("rumbo", it.rumbo ?: 0.0)
                }
            },
        )))
    }

    private fun pintarChincheta() {
        val s = mapa?.style?.takeIf { it.isFullyLoaded } ?: return
        val p = pin?.takeIf { it !== pinPuesto } ?: return
        s.addImage("parada", p); pinPuesto = p
        // La punta no está en el borde de abajo del dibujo: se baja lo que sobra (dp) para clavarla en el sitio.
        s.getLayer("parada")?.setProperties(iconOffset(arrayOf(0f, (1 - puntaChincheta(true)) * p.height / densidad)))
    }

    /** La cámara detrás del conductor: el rumbo hacia arriba (sin rumbo, el de antes), inclinada, y él en el tercio de
     *  abajo (se centra en lo que queda entre el 45 % de arriba y el panel). Más cerca cuanto más despacio: zoom 18 parado
     *  o a paso de peatón, 17 a partir de 36 km/h. Las posiciones llegan cada 1,5 s y el movimiento dura casi eso, lineal,
     *  para que el mapa vaya seguido y no a saltos. */
    fun seguir(p: Posicion, panelAlto: Int) {
        val m = mapa ?: run { camaraPendiente = { seguir(p, panelAlto) }; return }
        val rumbo = p.rumbo ?: m.cameraPosition.bearing
        val zoom = 18.0 - ((p.velocidad - 2.0) / 8.0).coerceIn(0.0, 1.0)
        // Con el móvil apaisado (o un panel muy alto) el hueco de arriba se acorta para que siempre quede mapa a la vista.
        val arriba = minOf(m.height * 0.45, (m.height - panelAlto) * 0.6)
        val camara = CameraPosition.Builder().target(LatLng(p.p.lat, p.p.lng)).zoom(zoom).bearing(rumbo).tilt(55.0)
            .padding(0.0, arriba, 0.0, panelAlto.toDouble()).build()
        m.easeCamera(CameraUpdateFactory.newCameraPosition(camara), DURACION_CAMARA.toInt(), false)
    }

    /** Sin posición: la parada de frente, norte arriba y sin inclinar. */
    fun encuadrar(p: Punto) {
        val m = mapa ?: run { camaraPendiente = { encuadrar(p) }; return }
        val camara = CameraPosition.Builder().target(LatLng(p.lat, p.lng)).zoom(16.0).bearing(0.0).tilt(0.0).padding(0.0, 0.0, 0.0, 0.0).build()
        m.easeCamera(CameraUpdateFactory.newCameraPosition(camara), 400)
    }
}

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
