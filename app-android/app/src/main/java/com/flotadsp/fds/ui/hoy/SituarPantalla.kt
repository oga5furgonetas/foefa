package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.ui.tx
import android.Manifest
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.PointF
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.ui.Acciones
import com.flotadsp.fds.ui.esNoche
import com.flotadsp.fds.ui.parada.Sugerencia
import com.flotadsp.fds.ui.parada.buscarEnMapa
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.gestures.MoveGestureDetector
import org.maplibre.android.gestures.StandardScaleGestureDetector
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapLibreMapOptions
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.layers.PropertyFactory.iconAllowOverlap
import org.maplibre.android.style.layers.PropertyFactory.iconIgnorePlacement
import org.maplibre.android.style.layers.PropertyFactory.iconImage
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.Point
import kotlin.math.ceil

/* SITUAR LA PARADA (02-11-2026). Lo que ni el servidor ni el geocodificador del móvil encuentran se pone a mano en
   NUESTRO mapa, el mismo de la guía (MapLibre con assets/mapa/guia-dia.json y guia-noche.json): arriba la dirección,
   que se puede corregir, con las sugerencias del servidor (POST /reparto/ubicar), las suyas, las del móvil y las de
   Photon; en el centro una chincheta fija («Mueve el mapa hasta la puerta») y abajo «Es aquí», que devuelve el punto.
   Quien llama lo guarda: «Hoy» en el servidor (editar con lat/lng, geo_origen «mapa» o «sugerencia») y abre la guía;
   la ficha de una parada, en el formulario. Google Maps solo si se pulsa el botón pequeño de abajo. Sin red se dice:
   el punto se puede poner igual (el mapa que ya estaba en la caché, o «Mi ubicación» estando en la puerta).
   LA SUGERENCIA SIGUE SIÉNDOLO AL ACERCAR (03-11-2026, la revisión): tras elegir «Rúa Brétema, 15179 Oleiros · Otra
   calle», un pellizco o un doble toque contaban como mover el mapa a mano y «Es aquí» salía «mapa», con D y un punto
   de Oleiros. Ahora el zoom no mueve la chincheta (CapasSituar.listo) y la sugerencia solo se olvida con el centro a
   más de 3 m de ella (Situar.sigueEnElla), como la web. Y la posición del móvil que llega tarde al abrir (hasta 6 s) ya
   no quita la sugerencia elegida ni mueve un mapa ya tocado (irAMiPosicion); «Mi ubicación», siempre.
   NI AL ALEJAR (03-11-2026, el emulador): alejar con pellizcos, con el toque con dos dedos o con dos pellizcos fuertes
   la olvidaba hacia el zoom 12-13 (cada zoom desviaba el centro menos de un píxel, y se sumaba), y al volver a acercar
   «Es aquí» mandaba el punto de Oleiros como la puerta de la parada de A Coruña. Ahora solo la olvida un arrastre de
   verdad (a más de 3 m y de 8 dp: Situar.sigueEnElla), el foco del zoom es el centro de verdad de MapLibre
   (CapasSituar.centroPx) y, al pararse el mapa, vuelve a centrarse en ella sin animar (Situar.alPararse). */
@Composable
fun SituarPantalla(
    /** La parada: D, su dirección (nunca lo escrito en el buscador de aquí), y su CP y su población, con los que se busca
     *  al abrir y se decide «Otra calle» (el mismo sitio, Situar.ordenar: 03-11-2026). */
    direccion: String, cp: String = "", localidad: String = "", cliente: String = "",
    /** Dónde empieza el mapa y con qué zoom (Situar.centro); null = donde está el móvil. */
    inicio: Pair<Punto, Double>?,
    pais: String,
    /** Dónde se reparte (la zona o la base), para que las sugerencias de cerca salgan antes. */
    cerca: Punto?,
    /** Lo que ya encontró el móvil al pulsar «Navegar» cuando solo es la calle (02-11-2026, revisión A2): va la primera
     *  de las sugerencias, sin darla por buena (en segundo plano ya no se guarda sola). */
    primera: Sugerencia? = null,
    /** «Abrir en Google Maps» (o Waze), pequeño; null = sin ese botón (desde la ficha). */
    textoFuera: String? = null, onFuera: () -> Unit = {},
    /** Guardando el punto: el botón espera. */
    ocupado: Boolean = false,
    /** Lo que ha fallado al guardar: se dice aquí (los avisos de «Hoy» quedan debajo de esta ventana). */
    error: String? = null,
    onCerrar: () -> Unit,
    /** «Es aquí»: el punto, «mapa» o «sugerencia», y la sugerencia elegida si la hubo: solo si la chincheta sigue donde
     *  ella la puso (al arrastrar el mapa a más de 3 m y de 8 dp se olvida y es «mapa»; acercar o alejar, nunca). Quien
     *  llama decide con ella y con `direccion` (D), `cp` y `localidad` qué queda (Situar.alElegir, Situar.esAqui:
     *  03-11-2026), nunca con lo escrito en el buscador de aquí. */
    onElegir: (Punto, String, Sugerencia?) -> Unit,
) {
    // Una ventana propia a pantalla completa, como la guía: tapa las pestañas de «Hoy» y la ficha.
    Dialog(onDismissRequest = onCerrar, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false, dismissOnClickOutside = false)) {
        Situando(direccion, cp, localidad, cliente, inicio, pais, cerca, primera, textoFuera, onFuera, ocupado, error, onCerrar, onElegir)
    }
}

@Composable
private fun Situando(
    direccion: String, cp: String, localidad: String, cliente: String, inicio: Pair<Punto, Double>?, pais: String, cerca: Punto?,
    primera: Sugerencia?, textoFuera: String?, onFuera: () -> Unit, ocupado: Boolean, error: String?, onCerrar: () -> Unit,
    onElegir: (Punto, String, Sugerencia?) -> Unit,
) {
    val ctx = LocalContext.current
    val app = ctx.applicationContext as FdsApp
    val ambito = rememberCoroutineScope()
    val teclado = LocalSoftwareKeyboardController.current
    val foco = LocalFocusManager.current
    val tema by app.cuenta.tema.collectAsState()
    val noche = esNoche(tema)
    var texto by remember { mutableStateOf(direccion) }
    var tocado by remember { mutableStateOf(false) }                 // la dirección se ha corregido aquí
    var sugerencias by remember { mutableStateOf(listOfNotNull(primera)) }
    var verLista by remember { mutableStateOf(true) }
    var buscando by remember { mutableStateOf(false) }
    var sinRed by remember { mutableStateOf(false) }
    var atribucion by remember { mutableStateOf<String?>(null) }
    var elegida by remember { mutableStateOf<Sugerencia?>(null) }   // la sugerencia que está bajo la chincheta
    var centro by remember { mutableStateOf(inicio?.first) }          // lo que hay bajo la chincheta
    var zoom by remember { mutableDoubleStateOf(inicio?.second ?: 5.0) }
    var debajo by remember { mutableStateOf<String?>(null) }          // su calle y número, del móvil
    var errMapa by remember { mutableStateOf("") }
    var yo by remember { mutableStateOf<Punto?>(null) }
    var buscandoYo by remember { mutableStateOf(false) }
    var avisoYo by remember { mutableStateOf("") }
    // Ya se eligió una sugerencia, se tocó el mapa o se pulsó «Mi ubicación» (03-11-2026, como la web): la posición del
    // móvil que llega tarde y la primera sugerencia ya no mueven el mapa.
    var mapaTocado by remember { mutableStateOf(false) }
    val capas = remember { CapasSituar(ctx) }
    BackHandler(onBack = onCerrar)

    val mapa = remember {
        MapLibre.getInstance(ctx)   // una vez por proceso; antes de crear la vista
        val (p0, z0) = inicio ?: (Punto(40.4168, -3.7038) to 5.0)
        val opciones = MapLibreMapOptions.createFromAttributes(ctx)
            .camera(CameraPosition.Builder().target(LatLng(p0.lat, p0.lng)).zoom(z0).build())
            .compassEnabled(false).logoEnabled(false).attributionEnabled(false)   // «© OpenStreetMap» lo pone esta pantalla
            .tiltGesturesEnabled(false).rotateGesturesEnabled(false)              // norte arriba: se busca una puerta
            .textureMode(true)                                                    // dentro de un Dialog, como la guía
            .foregroundLoadColor(if (noche) FONDO_NOCHE else FONDO_DIA)
        MapView(ctx, opciones).also { v ->
            v.getMapAsync { m ->
                capas.listo(v, m,
                    alTocar = { verLista = false; mapaTocado = true },
                    // La sugerencia solo la olvida un ARRASTRE que deje la chincheta lejos de ella (a más de 3 m y de 8 dp
                    // con el zoom de ese momento: Situar.sigueEnElla); acercar o alejar, nunca, y al pararse el mapa
                    // vuelve a centrarse en ella (Situar.alPararse, 03-11-2026).
                    alArrastrar = { p, z -> elegida?.let { s -> if (!Situar.sigueEnElla(s, p, z)) { elegida = null; debajo = null } } },
                    alParar = { p, z, arrastre ->
                        centro = p; zoom = z
                        val a = Situar.alPararse(elegida, p, z, arrastre)
                        if (a.olvidar) { elegida = null; debajo = null }
                        a.centrarEn
                    })
            }
            v.addOnDidFailLoadingMapListener { errMapa = tx("No se ha podido cargar el mapa.") }
            v.addOnDidFinishLoadingStyleListener { errMapa = "" }
        }
    }
    // El ciclo de vida que pide MapLibre, colgado del de la actividad (como en la guía); al cerrar, se baja a mano.
    val ciclo = LocalLifecycleOwner.current.lifecycle
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
            if (ciclo.currentState != Lifecycle.State.DESTROYED) {
                if (ciclo.currentState.isAtLeast(Lifecycle.State.RESUMED)) mapa.onPause()
                if (ciclo.currentState.isAtLeast(Lifecycle.State.STARTED)) mapa.onStop()
                mapa.onDestroy()
            }
        }
    }
    LaunchedEffect(noche) { capas.estilo(if (noche) "guia-noche" else "guia-dia") }

    // Dónde está el móvil: el punto azul y, si no se sabe nada de la parada, el sitio donde empezar.
    val permisos = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    val conPermiso = { permisos.any { ContextCompat.checkSelfPermission(ctx, it) == PackageManager.PERMISSION_GRANTED } }
    // LA POSICIÓN QUE LLEGA TARDE (03-11-2026, la revisión; como la web): al abrir sin punto de partida, la del móvil
    // tarda hasta 6 s y quitaba la sugerencia ya elegida y movía el mapa («Es aquí» guardaba la posición del móvil como
    // «manual», con D). Ahora la del arranque solo pone el punto azul si ya se eligió una sugerencia o se tocó el mapa;
    // «Mi ubicación» (`boton`), como siempre: va allí y deja de ser la sugerencia.
    fun irAMiPosicion(centrar: Boolean, boton: Boolean = false) {
        buscandoYo = true; avisoYo = ""
        if (boton) mapaTocado = true
        ambito.launch {
            val p = Acciones.dondeEstoy(ctx)?.let { Punto(it.first, it.second) }
            buscandoYo = false
            if (p == null) { if (centrar) avisoYo = tx("No llega la ubicación del móvil: dale permiso a la app."); return@launch }
            yo = p
            if (centrar && (boton || !mapaTocado)) { elegida = null; capas.mover(p, 18.0, animar = true) }
        }
    }
    val pedirPermiso = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        if (r.values.any { it }) irAMiPosicion(centrar = true, boton = true) else avisoYo = tx("No llega la ubicación del móvil: dale permiso a la app.")
    }
    LaunchedEffect(Unit) { if (conPermiso()) irAMiPosicion(centrar = inicio == null) }

    // Las sugerencias: al abrir, con la dirección de la parada; después, con lo que se escriba (con una pausa).
    LaunchedEffect(texto) {
        val q = texto.trim()
        if (q.length < 4) { sugerencias = emptyList(); buscando = false; return@LaunchedEffect }
        if (tocado) delay(500)
        buscando = true
        val cpQ = if (tocado) "" else cp
        val locQ = if (tocado) "" else localidad
        try {
            var conRed = true
            val servidor = try { app.repo.ubicar(q, cpQ, locQ) } catch (_: ErrorApi) { conRed = false; null }
            val suyas = runCatching { app.repo.direccionesConocidas(q) }.getOrDefault(emptyList())
                .filter { it.lat != null && it.lng != null }
                .map { Situar.deSuya(it) }
            // La precisión del móvil, la de lo que quedará al elegirla: con D, la dirección de la parada (03-11-2026).
            val movil = GeoMovil.buscar(ctx, Situar.consulta(q, cpQ, locQ, GeoMovil.nombrePais(pais)), cerca)
                ?.mapNotNull { Situar.deMovil(it, pais, direccion, cp, localidad) }.orEmpty()
            // A Photon, lo buscado sin el piso (urlPhoton, C: 03-11-2026); al servidor y al móvil, como hasta ahora.
            val photon = withContext(Dispatchers.IO) { buscarEnMapa(app.repo.api.http, q, pais, cerca?.let { it.lat to it.lng }) }
            sinRed = !conRed && movil.isEmpty() && photon.isEmpty()
            atribucion = servidor?.atribucion
            // Lo que ya encontró el móvil al pulsar «Navegar» va delante, mientras no se corrija la dirección. Con dos
            // textos (Situar.ordenar, 03-11-2026): lo buscado aquí quita las del móvil y Photon que ni comparten el
            // nombre; la dirección de la parada marca, de cualquier fuente menos las suyas, las de otra calle, que van
            // al final con «Otra calle» (elegirla cambia la dirección de la parada a la suya).
            sugerencias = Situar.ordenar(listOfNotNull(primera?.takeIf { !tocado }) + servidor?.candidatos.orEmpty().mapNotNull { Situar.deServidor(it) },
                suyas, movil, photon, buscado = q, direccion = direccion, cp = cp, localidad = localidad)
        } finally {
            buscando = false      // también si se escribe otra cosa a mitad de la búsqueda
        }
        if (tocado) verLista = true
        // Sin nada con qué empezar (ni la zona, ni la base, ni el móvil): el mapa va a la primera, sin darla por buena
        // (una de otra calle, no); y no si ya se eligió una o se tocó el mapa (03-11-2026).
        val laPrimera = sugerencias.firstOrNull { !it.otraCalle }
        if (!tocado && !mapaTocado && inicio == null && yo == null && laPrimera?.lat != null && laPrimera.lng != null) capas.mover(Punto(laPrimera.lat, laPrimera.lng), 16.0, animar = false)
    }
    // La calle y el número de lo que hay bajo la chincheta, al parar el mapa.
    LaunchedEffect(centro, elegida) {
        val c = centro ?: return@LaunchedEffect
        if (elegida != null || zoom < ZOOM_PUERTA) return@LaunchedEffect
        delay(700)
        debajo = GeoMovil.inverso(ctx, c.lat, c.lng)
    }

    fun elegir(s: Sugerencia) {
        val la = s.lat ?: return
        val lo = s.lng ?: return
        elegida = s; debajo = s.direccion; verLista = false; mapaTocado = true
        teclado?.hide(); foco.clearFocus()
        capas.mover(Punto(la, lo), if (s.precision == "calle") 17.0 else 18.0, animar = true)
    }

    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        // ARRIBA: qué parada es y su dirección, que se puede corregir para buscar.
        Surface(color = MaterialTheme.colorScheme.surface, shadowElevation = 4.dp) {
            Column(Modifier.fillMaxWidth().statusBarsPadding().padding(start = 4.dp, end = 12.dp, top = 4.dp, bottom = 10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onCerrar) { Icon(Icons.Default.Close, contentDescription = tx("Cerrar")) }
                    Column(Modifier.weight(1f)) {
                        Text(tx("Situar la parada"), style = MaterialTheme.typography.titleLarge)
                        if (cliente.isNotBlank()) Text(cliente, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                OutlinedTextField(
                    value = texto, onValueChange = { texto = it; tocado = true; verLista = true }, singleLine = true,
                    label = { Text(tx("Dirección")) }, placeholder = { Text(tx("Calle, número y población")) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    trailingIcon = { if (buscando) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) },
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { teclado?.hide() }),
                    modifier = Modifier.fillMaxWidth().padding(start = 12.dp),
                )
            }
        }

        // EL MAPA, con la chincheta fija en el centro: se mueve el mapa, no la chincheta.
        Box(Modifier.weight(1f).fillMaxWidth()) {
            AndroidView(factory = { mapa }, modifier = Modifier.fillMaxSize(), update = { capas.yo(yo) })
            Chincheta(Modifier.align(Alignment.Center))
            Column(Modifier.align(Alignment.TopCenter).fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (verLista && sugerencias.isNotEmpty()) {
                    Lista(sugerencias, atribucion, alElegir = ::elegir, alCerrar = { verLista = false })
                } else {
                    Pildora(tx("Mueve el mapa hasta la puerta"))
                }
                if (sinRed) Pildora(tx("Sin conexión: no puedo buscar la dirección. Si estás en la puerta, pulsa «Mi ubicación» y «Es aquí»."), aviso = true)
                // «Esa dirección» es la buscada aquí (03-11-2026): las marcas de «Otra calle» ya son con la de la parada.
                else if (!buscando && tocado && sugerencias.none { Situar.deLaBuscada(texto.trim(), it) } && texto.trim().length >= 4) Pildora(tx("No encuentro esa dirección: mueve el mapa hasta la puerta."))
                if (errMapa.isNotEmpty()) Pildora(errMapa, aviso = true)
                if (avisoYo.isNotEmpty()) Pildora(avisoYo, aviso = true)
            }
            Surface(shape = CircleShape, shadowElevation = 3.dp, color = MaterialTheme.colorScheme.surface, contentColor = MaterialTheme.colorScheme.primary,
                modifier = Modifier.align(Alignment.BottomEnd).padding(12.dp)) {
                IconButton(onClick = { if (conPermiso()) irAMiPosicion(centrar = true, boton = true) else pedirPermiso.launch(permisos) }, modifier = Modifier.size(52.dp)) {
                    if (buscandoYo) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                    else Icon(Icons.Default.MyLocation, contentDescription = tx("Mi ubicación"))
                }
            }
            Surface(color = MaterialTheme.colorScheme.surface.copy(alpha = 0.85f), shape = RoundedCornerShape(6.dp),
                modifier = Modifier.align(Alignment.BottomStart).padding(8.dp)) {
                Text(tx("© OpenStreetMap · OpenMapTiles"), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.clickable { runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, "https://www.openstreetmap.org/copyright".toUri())) } }
                        .padding(horizontal = 6.dp, vertical = 2.dp))
            }
        }

        // ABAJO: lo que hay bajo la chincheta y el botón grande.
        Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp), shadowElevation = 10.dp) {
            Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 8.dp).navigationBarsPadding()) {
                // De lejos la chincheta no está en ninguna puerta (el centro del CP, el país entero): primero, acercarse.
                val lejos = elegida == null && zoom < ZOOM_PUERTA
                Text(if (lejos) tx("Acerca el mapa hasta ver la puerta") else (elegida?.direccion ?: debajo)?.let { tx("Aquí: {d}", "d" to it) } ?: tx("Mueve el mapa hasta la puerta"),
                    style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (direccion.isNotBlank()) Text(direccion, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 4.dp)) }
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = {
                        val s = elegida
                        val p = if (s?.lat != null && s.lng != null) Punto(s.lat, s.lng) else capas.centro() ?: centro
                        if (p != null) onElegir(p, if (s != null) "sugerencia" else "mapa", s)
                    },
                    enabled = !ocupado && (elegida != null || (centro != null && zoom >= ZOOM_PUERTA)),
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                ) {
                    if (ocupado) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                    else { Icon(Icons.Default.Check, contentDescription = null); Spacer(Modifier.width(8.dp)); Text(tx("Es aquí"), style = MaterialTheme.typography.titleMedium) }
                }
                if (textoFuera != null) {
                    TextButton(onClick = onFuera, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                        Text(textoFuera, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

/** La chincheta fija del centro: la punta en el centro exacto del mapa (el dibujo de Place la tiene a 22/24 de alto). */
@Composable
private fun Chincheta(modifier: Modifier) {
    Box(modifier) {
        Box(Modifier.align(Alignment.Center).size(6.dp).background(Color(0x99000000), CircleShape))
        Icon(Icons.Default.Place, contentDescription = null, tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.align(Alignment.Center).offset(y = (-20).dp).size(48.dp))
    }
}

@Composable
private fun Pildora(texto: String, aviso: Boolean = false) {
    Surface(color = if (aviso) Color(0xFF9A3412) else MaterialTheme.colorScheme.surface.copy(alpha = 0.94f),
        contentColor = if (aviso) Color.White else MaterialTheme.colorScheme.onSurface, shape = RoundedCornerShape(14.dp), shadowElevation = 2.dp) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (aviso) { Icon(Icons.Default.CloudOff, contentDescription = null, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(8.dp)) }
            Text(texto, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

/** Las sugerencias encima del mapa (las del servidor primero, Situar.ordenar), con de dónde salen los datos. */
@Composable
private fun Lista(sugerencias: List<Sugerencia>, atribucion: String?, alElegir: (Sugerencia) -> Unit, alCerrar: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(14.dp), shadowElevation = 4.dp) {
        Column(Modifier.heightIn(max = 300.dp).verticalScroll(rememberScrollState())) {
            Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(tx("¿Es alguna de estas?"), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                IconButton(onClick = alCerrar) { Icon(Icons.Default.Close, contentDescription = tx("Cerrar")) }
            }
            sugerencias.forEachIndexed { i, s ->
                if (i > 0) HorizontalDivider()
                Row(Modifier.fillMaxWidth().clickable { alElegir(s) }.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (s.veces > 0) Icons.Default.History else Icons.Default.Place, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(s.direccion, style = MaterialTheme.typography.bodyLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        val detalle = when {
                            s.veces > 0 -> tx("Ya estuviste aquí") + " · ${s.veces} ${if (s.veces == 1) tx("vez") else tx("veces")}"
                            s.otraCalle -> tx("Otra calle")            // no es la escrita (02-11-2026): va al final
                            s.precision == "calle" -> tx("Sin el portal")
                            else -> ""
                        }
                        if (detalle.isNotEmpty()) Text(detalle, style = MaterialTheme.typography.bodySmall,
                            color = if (s.otraCalle && s.veces == 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary)
                    }
                }
            }
            atribucion?.takeIf { it.isNotBlank() && sugerencias.any { it.fuente == "servidor" } }?.let {
                Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp))
            }
        }
    }
}

/** Lo cerca que tiene que estar el mapa para que «Es aquí» valga sin una sugerencia: a zoom 16 la chincheta cae en un
 *  portal; más lejos, en una manzana o en el centro del código postal. */
private const val ZOOM_PUERTA = 16.0

/** El fondo de los dos estilos (assets/mapa/guia-*.json, como en GuiaPantalla), mientras carga el mapa. */
private val FONDO_DIA = 0xFFF2F0E9.toInt()
private val FONDO_NOCHE = 0xFF0E1726.toInt()

/* LAS CAPAS DE «SITUAR»: el estilo de la guía y el punto azul del móvil; la chincheta es de Compose (fija en el
   centro). Lo que se mueve es la cámara: su centro es el punto elegido. Todo espera a que el mapa esté listo. */
private class CapasSituar(ctx: Context) {
    private val quieto = puntoAzul(ctx, false)
    private var mapa: MapLibreMap? = null
    private var vista: MapView? = null
    private var estilo = ""
    private var fuenteYo: GeoJsonSource? = null
    private var yo: Punto? = null
    private var pendiente: (() -> Unit)? = null
    /** Desde la última parada, el mapa se ha movido con la inercia de un arrastre (onFling). */
    private var volando = false
    /** La parada que viene es la del moveCamera que volvió a centrar el mapa en la sugerencia: esa ya no lo repite. */
    private var recentrado = false

    /** El mapa ya está. `alTocar`: un gesto de la persona (arrastrar, pellizcar, el doble toque). `alArrastrar`: lo que
     *  hay bajo la chincheta y el zoom mientras se arrastra. `alParar`: el centro y el zoom al pararse la cámara, y si
     *  se movía con la inercia de un arrastre; devuelve dónde volver a centrar el mapa (la sugerencia elegida) o null.
     *  ACERCAR O ALEJAR NO MUEVE LA CHINCHETA (03-11-2026, la revisión; la web lo hace con touchZoom «center»): en
     *  MapLibre 11.13.5 el pellizco y el doble toque acercan hacia el punto del gesto y avisan como un gesto (onScale →
     *  onCameraMoveStarted(1)); tras elegir una sugerencia, cualquier zoom la olvidaba. Ahora el foco del zoom es el
     *  centro de la cámara (uiSettings.focalPoint, que usan el pellizco, su inercia, el doble toque, el toque con dos
     *  dedos y el zoom rápido con un dedo) y, mientras se pellizca, el mapa no se arrastra (como hace MapLibre en el zoom
     *  con un dedo): el centro no se mueve. Arrastrar sí lo mueve.
     *  NI ALEJAR (03-11-2026, el emulador): el foco era el centro de la vista, y el de MapLibre queda hasta medio dp más
     *  allá (centroPx): cada zoom desviaba el centro un poco y, sumado, a zoom 12-13 pasaba de 3 m. Ahora el foco es su
     *  centro, la sugerencia solo la olvida un arrastre (onMove y, tras su inercia, la parada) y, al pararse, el mapa
     *  vuelve a centrarse en ella sin animar (Situar.alPararse), una vez por parada. */
    fun listo(v: MapView, m: MapLibreMap, alTocar: () -> Unit, alArrastrar: (Punto, Double) -> Unit, alParar: (Punto, Double, Boolean) -> Punto?) {
        mapa = m; vista = v
        m.setMinZoomPreference(4.0); m.setMaxZoomPreference(20.0)
        fun foco() { centroPx()?.let { m.uiSettings.focalPoint = it } }
        foco()
        v.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> foco() }
        m.addOnScaleListener(object : MapLibreMap.OnScaleListener {
            override fun onScaleBegin(detector: StandardScaleGestureDetector) { alTocar(); m.gesturesManager.moveGestureDetector.isEnabled = false }
            override fun onScale(detector: StandardScaleGestureDetector) = Unit
            override fun onScaleEnd(detector: StandardScaleGestureDetector) { m.gesturesManager.moveGestureDetector.isEnabled = true }
        })
        m.addOnMoveListener(object : MapLibreMap.OnMoveListener {
            override fun onMoveBegin(detector: MoveGestureDetector) = alTocar()
            override fun onMove(detector: MoveGestureDetector) { bajoLaChincheta()?.let { alArrastrar(it, m.cameraPosition.zoom) } }
            override fun onMoveEnd(detector: MoveGestureDetector) = Unit
        })
        m.addOnFlingListener { volando = true }
        m.addOnCameraMoveStartedListener { motivo ->
            if (motivo == MapLibreMap.OnCameraMoveStartedListener.REASON_API_GESTURE) { recentrado = false; alTocar() }
        }
        fun parado() {
            val c = m.cameraPosition
            val t = c.target ?: return
            // Con un dedo aún en el mapa, ni se juzga la inercia ni se centra: eso, al soltarlo.
            val g = m.gesturesManager
            val suelto = listOf(g.moveGestureDetector, g.standardScaleGestureDetector, g.rotateGestureDetector, g.shoveGestureDetector).none { it.isInProgress }
            val vuelo = volando && suelto
            if (suelto) volando = false
            val aqui = alParar(Punto(t.latitude, t.longitude), c.zoom, vuelo)
            if (aqui == null || !suelto || recentrado) { recentrado = false; return }
            recentrado = true
            m.moveCamera(CameraUpdateFactory.newCameraPosition(CameraPosition.Builder().target(LatLng(aqui.lat, aqui.lng)).zoom(c.zoom).bearing(0.0).tilt(0.0).build()))
        }
        m.addOnCameraIdleListener { parado() }
        if (estilo.isNotEmpty()) cargar()
        pendiente?.invoke(); pendiente = null
        parado()
    }

    /** Lo que hay ahora mismo bajo la chincheta (el centro de la cámara), también a mitad de un arrastre: cameraPosition
     *  sigue con lo de antes hasta que el gesto acaba. */
    private fun bajoLaChincheta(): Punto? {
        val m = mapa ?: return null
        val c = centroPx() ?: return centro()
        return m.projection.fromScreenLocation(c).let { Punto(it.latitude, it.longitude) }
    }

    /** El centro de la cámara en la pantalla, en px (03-11-2026): MapLibre redondea el tamaño de la vista a dp enteros
     *  hacia arriba (NativeMapView.resizeView) y su centro es el de ese tamaño, hasta medio dp más allá que el de la
     *  vista. null si la vista aún no tiene tamaño. */
    private fun centroPx(): PointF? {
        val v = vista ?: return null
        if (v.width <= 0 || v.height <= 0) return null
        val r = v.pixelRatio
        fun mitad(px: Int) = (ceil((px.toFloat() / r).toDouble()) * r / 2).toFloat()
        return PointF(mitad(v.width), mitad(v.height))
    }

    fun estilo(nombre: String) { if (nombre != estilo) { estilo = nombre; cargar() } }

    private fun cargar() {
        val m = mapa ?: return
        fuenteYo = null
        m.setStyle(Style.Builder().fromUri("asset://mapa/$estilo.json")) { montar(it) }
    }

    private fun montar(s: Style) {
        if (s.getSource("yo") != null) return   // dos setStyle seguidos: el segundo sobra
        s.addImage("quieto", quieto)
        fuenteYo = GeoJsonSource("yo").also { s.addSource(it) }
        s.addLayer(SymbolLayer("yo", "yo").withProperties(iconImage("quieto"), iconAllowOverlap(true), iconIgnorePlacement(true)))
        pintarYo()
    }

    fun yo(p: Punto?) { if (p != yo) { yo = p; pintarYo() } }

    private fun pintarYo() {
        fuenteYo?.setGeoJson(FeatureCollection.fromFeatures(listOfNotNull(yo?.let { Feature.fromGeometry(Point.fromLngLat(it.lng, it.lat)) })))
    }

    fun mover(p: Punto, zoom: Double, animar: Boolean) {
        // Con el mapa aún sin cargar, sin animar (03-11-2026): al estar listo ya está ahí, y lo que hay bajo la chincheta
        // (alParar) es ya ese punto, no el de antes. La parada que venga de aquí puede volver a centrarlo (recentrado).
        recentrado = false
        val m = mapa ?: run { pendiente = { mover(p, zoom, animar = false) }; return }
        val c = CameraUpdateFactory.newCameraPosition(CameraPosition.Builder().target(LatLng(p.lat, p.lng)).zoom(zoom).bearing(0.0).tilt(0.0).build())
        if (animar) m.easeCamera(c, 500) else m.moveCamera(c)
    }

    fun centro(): Punto? = mapa?.cameraPosition?.target?.let { Punto(it.latitude, it.longitude) }
}
