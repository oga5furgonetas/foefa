// diseño compacto
package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.ui.tx
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.PriorityHigh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.flotadsp.fds.data.Base
import com.flotadsp.fds.data.Furgo
import com.flotadsp.fds.data.Incidencia
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.data.ZonaZbe
import com.flotadsp.fds.ui.Acciones
import com.flotadsp.fds.ui.Alto
import com.flotadsp.fds.ui.Atribucion
import com.flotadsp.fds.ui.BotonIcono
import com.flotadsp.fds.ui.BotonMapa
import com.flotadsp.fds.ui.BotonNormal
import com.flotadsp.fds.ui.BotonTexto
import com.flotadsp.fds.ui.Esp
import com.flotadsp.fds.ui.EstadoNumero
import com.flotadsp.fds.ui.Etiqueta
import com.flotadsp.fds.ui.FilaDeChips
import com.flotadsp.fds.ui.Idioma
import com.flotadsp.fds.ui.LetraMax
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.NotasPuerta
import com.flotadsp.fds.ui.NumeroParada
import com.flotadsp.fds.ui.Pastilla
import com.flotadsp.fds.ui.Region
import com.flotadsp.fds.ui.TamNumero
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.Tono
import com.flotadsp.fds.ui.ZoomMapa
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.events.MapListener
import org.osmdroid.events.ScrollEvent
import org.osmdroid.events.ZoomEvent
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.CustomZoomButtonsController
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polygon
import org.osmdroid.views.overlay.Polyline
import org.osmdroid.views.overlay.mylocation.IMyLocationConsumer
import org.osmdroid.views.overlay.mylocation.IMyLocationProvider
import org.osmdroid.views.overlay.mylocation.MyLocationNewOverlay
import android.annotation.SuppressLint
import android.location.Location
import android.os.Looper
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/* EL MAPA DE LA RUTA (OpenStreetMap, el mismo que la web): cada parada por entregar con su número, en orden, unidas
   por una línea; las hechas, un círculo con ✓ o ✕. Las teselas se guardan en la caché de la app.

   LOS ICONOS Y LO QUE SE TOCA (30-10-2026, «mejora los emoticonos e interacciones con el mapa»): todo dibujado a
   mano con las mismas formas que la web (frontend/src/panel/components/MapaReparto.jsx), nada de emojis (cada
   móvil pinta el suyo). La parada es una chincheta con el número (la siguiente, más grande y con halo; borde morado
   si cae en una ZBE; un globo verde si el cliente contestó), la carretera cortada un disco rojo con la barra, las
   obras un rombo ámbar, la retención un coche, el tiempo una nube, la furgoneta una furgoneta, la base una nave, y
   el móvil un punto azul con la flecha hacia donde mira. Tocar cualquier cosa abre una tarjeta abajo con lo que es
   y qué hacer: ir, llamar o abrir la parada; ver la incidencia en Google Maps; la web de la ZBE; volver a pie a la
   furgoneta o quitarla. Mantener pulsado el mapa deja la furgoneta ahí. Arriba a la derecha: seguirme, centrar la
   ruta y el zoom; arriba a la izquierda, lo que dice la DGT (un toque lleva allí).

   EL DISEÑO COMPACTO (07-11-2026, §5.7 de la especificación): lo de encima del mapa va con las piezas de
   ui/Componentes.kt (Pastilla, BotonMapa, ZoomMapa, Atribucion, NumeroParada, Etiqueta, NotasPuerta y los botones); el
   motor y los dibujos no cambian. */

/** Lo que está tocado en el mapa: una parada, una incidencia, una ZBE, la furgoneta o un punto (mantener pulsado). */
sealed class Tocado {
    data class Una(val p: Parada) : Tocado()
    data class Inc(val i: Incidencia) : Tocado()
    data class Zona(val z: ZonaZbe) : Tocado()
    object LaFurgo : Tocado()
    data class Punto(val lat: Double, val lng: Double) : Tocado()
}

@Composable
fun MapaRuta(
    paradas: List<Parada>, base: Base?, trazado: List<Pair<Double, Double>> = emptyList(), hechas: List<Parada> = emptyList(),
    incidencias: List<Incidencia> = emptyList(), zbe: List<ZonaZbe> = emptyList(), enZbe: Set<String> = emptySet(),
    /** La fuente de los cortes de ese país (DGT, Bison Futé, NDW, WZDx…) y el tipo de zona (ZBE, ZFE, ULEZ…), del servidor. */
    fuente: String = "", tipoZona: String = "ZBE",
    furgo: Furgo? = null,
    /** «Ir» en la tarjeta de una parada: la guía de la app o el navegador elegido, lo decide «Hoy» (01-11-2026). */
    alNavegar: (Parada) -> Unit = {},
    alTocar: (Parada) -> Unit, alAparcarEn: (Double, Double) -> Unit = { _, _ -> }, alQuitarFurgo: () -> Unit = {},
    /** Las que no están en el mapa (02-11-2026): tocar su aviso abre «Situar la parada» con la primera. */
    alSituar: (Parada) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val ctx = LocalContext.current
    val ubicadas = paradas.filter { it.ubicada }
    // Se encuadra la ruta cuando CAMBIAN las paradas, no a cada repintado: hasta el 29-10-2026 cualquier cambio de
    // estado (un aviso abajo, el trazado que llega) volvía a centrar el mapa y no dejaba acercarse a una calle.
    val clave = ubicadas.joinToString(",") { "${it.id}:${it.orden}" }
    var encuadrada by remember { mutableStateOf("") }
    var tocado by remember { mutableStateOf<Tocado?>(null) }
    var siguiendo by remember { mutableStateOf(false) }
    val cian = MaterialTheme.colorScheme.primary.toArgb()
    val tinta = MaterialTheme.colorScheme.onPrimary.toArgb()
    // Los dibujos se hacen una vez y se reutilizan: el mapa se repinta a cada cambio de estado.
    val iconos = remember { HashMap<String, Bitmap>() }
    fun icono(k: String, dibuja: () -> Bitmap): Bitmap = iconos.getOrPut(k, dibuja)
    val mapa = remember {
        MapView(ctx).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            zoomController.setVisibility(CustomZoomButtonsController.Visibility.NEVER)
            isTilesScaledToDpi = true
            minZoomLevel = 4.0
            maxZoomLevel = 19.0
        }
    }
    // El punto azul: dónde está el móvil, con la flecha hacia donde mira. Solo con permiso de ubicación; un toque
    // en el mapa deja de seguirlo (lo hace osmdroid solo).
    val ubicacion = remember {
        val quieto = puntoAzul(ctx, false)
        MyLocationNewOverlay(ProveedorFused(ctx), mapa).apply {
            setPersonIcon(quieto)
            setPersonHotspot(quieto.width / 2f, quieto.height / 2f)
            setDirectionArrow(quieto, puntoAzul(ctx, true))
            setEnableAutoStop(true)
        }
    }
    fun conPermiso() = ctx.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ctx.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val pedirPermiso = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        if (r.values.any { it }) { ubicacion.enableMyLocation(); ubicacion.enableFollowLocation(); siguiendo = true }
    }
    fun seguir() {
        if (!conPermiso()) {
            pedirPermiso.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        } else if (ubicacion.isFollowLocationEnabled) {
            ubicacion.disableFollowLocation(); siguiendo = false
        } else {
            ubicacion.enableMyLocation(); ubicacion.enableFollowLocation(); siguiendo = true
            ubicacion.myLocation?.let { mapa.controller.animateTo(it) }
        }
    }
    val ciclo = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(ciclo) {
        if (conPermiso()) ubicacion.enableMyLocation()
        val oyente = object : MapListener {
            override fun onScroll(event: ScrollEvent?): Boolean { siguiendo = ubicacion.isFollowLocationEnabled; return false }
            override fun onZoom(event: ZoomEvent?): Boolean = false
        }
        mapa.addMapListener(oyente)
        val o = LifecycleEventObserver { _, ev ->
            when (ev) {
                Lifecycle.Event.ON_RESUME -> { mapa.onResume(); if (conPermiso()) ubicacion.enableMyLocation() }
                Lifecycle.Event.ON_PAUSE -> { ubicacion.disableMyLocation(); mapa.onPause() }
                else -> Unit
            }
        }
        ciclo.addObserver(o)
        onDispose { ciclo.removeObserver(o); mapa.removeMapListener(oyente); ubicacion.disableMyLocation(); mapa.onDetach() }
    }
    LaunchedEffect(furgo) { if (furgo == null && tocado is Tocado.LaFurgo) tocado = null }

    Box(modifier) {
        AndroidView(factory = { mapa }, modifier = Modifier, update = { m ->
            m.overlays.clear()
            // Tocar el mapa vacío cierra la tarjeta; mantener pulsado deja la furgoneta ahí. Va debajo de todo para
            // que las chinchetas se lleven el toque primero.
            m.overlays.add(MapEventsOverlay(object : MapEventsReceiver {
                override fun singleTapConfirmedHelper(p: GeoPoint?): Boolean { tocado = null; return false }
                override fun longPressHelper(p: GeoPoint?): Boolean {
                    if (p == null) return false
                    tocado = Tocado.Punto(p.latitude, p.longitude)
                    return true
                }
            }))
            // Las ZBE: el polígono que publica la DGT, con la etiqueta «ZBE» en el centro; tocarlos cuenta qué dice el ayuntamiento.
            zbe.forEach { z ->
                z.poligonos.forEach { pol ->
                    val esquinas = pol.filter { it.size >= 2 }.map { GeoPoint(it[0], it[1]) }
                    if (esquinas.size < 3) return@forEach
                    m.overlays.add(Polygon(m).apply {
                        points = esquinas
                        outlinePaint.color = MORADO; outlinePaint.strokeWidth = 4f
                        outlinePaint.pathEffect = DashPathEffect(floatArrayOf(14f, 10f), 0f)
                        fillPaint.color = 0x1F7C3AED
                        infoWindow = null
                        setOnClickListener { _, _, _ -> tocado = Tocado.Zona(z); true }
                    })
                    Calle.centroide(pol)?.let { c ->
                        m.overlays.add(Marker(m).apply {
                            position = GeoPoint(c.first, c.second)
                            icon = BitmapDrawable(m.resources, icono("zbe:${z.tipo}") { etiquetaZbe(m.context, z.tipo.ifBlank { tipoZona }) })
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                            infoWindow = null
                            setOnMarkerClickListener { _, _ -> tocado = Tocado.Zona(z); true }
                        })
                    }
                }
            }
            val puntos = ubicadas.map { GeoPoint(it.lat!!, it.lng!!) }
            if (puntos.size >= 2) {
                // Por las calles si el servidor lo ha dado; si no, de parada a parada en línea recta.
                val camino = if (trazado.size >= 2) trazado.map { GeoPoint(it.first, it.second) } else puntos
                // Como un navegador (30-10-2026, Dani: «la línea se ve un poco mal»): un borde azul oscuro fino y la
                // línea azul encima, con las puntas y las esquinas redondas y en dp (antes, píxeles y borde blanco,
                // que sobre las calles blancas del mapa no se veía y dejaba una salchicha plana).
                val d = m.context.dp()
                val porCalles = camino !== puntos
                m.overlays.add(Polyline(m).apply {
                    setPoints(camino)
                    outlinePaint.set(trazo(AZUL_OSCURO, (if (porCalles) 8f else 5.5f) * d)); outlinePaint.alpha = 140
                    infoWindow = null
                })
                m.overlays.add(Polyline(m).apply {
                    setPoints(camino)
                    outlinePaint.set(trazo(AZUL_RUTA, (if (porCalles) 4.5f else 3f) * d))
                    if (!porCalles) outlinePaint.pathEffect = DashPathEffect(floatArrayOf(10f * d, 8f * d), 0f)
                    infoWindow = null
                })
            }
            hechas.filter { it.ubicada }.forEach { p ->
                m.overlays.add(Marker(m).apply {
                    position = GeoPoint(p.lat!!, p.lng!!)
                    icon = BitmapDrawable(m.resources, icono("hecha:${p.estado}") { hecha(m.context, p.estado == "fallido") })
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    infoWindow = null
                    setOnMarkerClickListener { _, _ -> tocado = Tocado.Una(p); true }
                })
            }
            ubicadas.forEachIndexed { i, p ->
                val n = p.orden ?: (i + 1)
                val grande = i == 0
                val zona = p.id in enZbe
                val dice = p.clienteDice != null
                m.overlays.add(Marker(m).apply {
                    position = GeoPoint(p.lat!!, p.lng!!)
                    icon = BitmapDrawable(m.resources, icono("pin:$n:$grande:$zona:$dice") { chincheta(m.context, n, cian, tinta, grande, zona, dice) })
                    setAnchor(Marker.ANCHOR_CENTER, puntaChincheta(grande))
                    infoWindow = null
                    setOnMarkerClickListener { _, _ -> tocado = Tocado.Una(p); true }
                })
            }
            base?.let { b ->
                if (b.lat != null && b.lng != null) m.overlays.add(Marker(m).apply {
                    position = GeoPoint(b.lat, b.lng)
                    icon = BitmapDrawable(m.resources, icono("base") { nave(m.context) })
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    infoWindow = null
                    setOnMarkerClickListener { _, _ -> true }
                })
            }
            // Cortes, obras y retenciones de la DGT, cada una con su forma; tocarla dice qué, dónde y a cuánto de qué
            // parada. Si es un tramo, la línea a rayas hasta donde acaba.
            incidencias.forEach { i ->
                val color = Calle.colorIncidencia(i.clase).toInt()
                if (i.lat2 != null && i.lng2 != null) m.overlays.add(Polyline(m).apply {
                    setPoints(listOf(GeoPoint(i.lat, i.lng), GeoPoint(i.lat2, i.lng2)))
                    outlinePaint.color = color; outlinePaint.strokeWidth = 7f; outlinePaint.alpha = 190
                    outlinePaint.pathEffect = DashPathEffect(floatArrayOf(6f, 12f), 0f)
                    infoWindow = null
                })
                m.overlays.add(Marker(m).apply {
                    position = GeoPoint(i.lat, i.lng)
                    icon = BitmapDrawable(m.resources, icono("inc:${i.clase}") { incidencia(m.context, i.clase) })
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    infoWindow = null
                    setOnMarkerClickListener { _, _ -> tocado = Tocado.Inc(i); true }
                })
            }
            furgo?.let { f ->
                m.overlays.add(Marker(m).apply {
                    position = GeoPoint(f.lat, f.lng)
                    icon = BitmapDrawable(m.resources, icono("furgo") { furgoneta(m.context) })
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    infoWindow = null
                    setOnMarkerClickListener { _, _ -> tocado = Tocado.LaFurgo; true }
                })
            }
            m.overlays.add(ubicacion)
            if (encuadrada != clave) {
                encuadrada = clave
                encuadra(m, puntos, animar = false)
            }
            m.invalidate()
        })

        // ENCIMA DEL MAPA (07-11-2026, diseño compacto, §5.7). Arriba a la izquierda, pastillas de una línea: «{n} sin
        // situar» (un toque sitúa la primera), lo que dice la DGT y la ZBE; con el tope de letra, para que con la letra
        // grande no tapen el mapa. Dejan sitio a la derecha para los botones.
        Column(Modifier.align(Alignment.TopStart).padding(start = Esp.m, top = Esp.m, end = Esp.m + Alto.boton + Esp.s),
            verticalArrangement = Arrangement.spacedBy(Esp.s)) {
            LetraMax(1.3f) {
                if (ubicadas.size < paradas.size) {
                    val sin = paradas.size - ubicadas.size
                    Pastilla(if (sin == 1) tx("1 sin situar") else tx("{n} sin situar", "n" to sin), Tono.AVISO, Icons.Default.LocationOff,
                        onClick = { paradas.firstOrNull { !it.ubicada }?.let(alSituar) })
                }
                if (incidencias.isNotEmpty()) {
                    Pastilla("${fuente.substringBefore(" · ").ifBlank { "DGT" }} · ${incidencias.size}", Tono.AVISO, onClick = {
                        val i = incidencias.first()
                        ubicacion.disableFollowLocation(); mapa.controller.animateTo(GeoPoint(i.lat, i.lng))
                        tocado = Tocado.Inc(i)
                    })
                }
                zbe.firstOrNull()?.let { z ->
                    Pastilla("${z.tipo.ifBlank { tipoZona }} · ${z.nombre}", Tono.ZONA, onClick = {
                        Calle.centroide(z.poligonos.firstOrNull().orEmpty())?.let { c ->
                            ubicacion.disableFollowLocation(); mapa.controller.animateTo(GeoPoint(c.first, c.second))
                        }
                        tocado = Tocado.Zona(z)
                    })
                }
            }
        }
        // Arriba a la derecha: seguirme, centrar la ruta (botones de 48) y el zoom en una píldora (a algunos les cuesta el
        // pellizco con guantes).
        Column(Modifier.align(Alignment.TopEnd).padding(Esp.m), verticalArrangement = Arrangement.spacedBy(Esp.s)) {
            LetraMax(1.3f) {
                BotonMapa(Icons.Default.MyLocation, if (siguiendo) tx("Dejar de seguirme") else tx("Seguirme"), activo = siguiendo, onClick = { seguir() })
                BotonMapa(Icons.Default.CenterFocusStrong, tx("Centrar la ruta"), onClick = {
                    ubicacion.disableFollowLocation(); siguiendo = false
                    encuadra(mapa, ubicadas.map { GeoPoint(it.lat!!, it.lng!!) }, animar = true)
                })
                ZoomMapa(alAcercar = { mapa.controller.zoomIn() }, alAlejar = { mapa.controller.zoomOut() })
            }
        }
        // Abajo, en una columna: la tarjeta de lo tocado y, debajo, la atribución (F3, 08-11-2026: a 16 del borde la tarjeta
        // tapaba a medias «© OpenStreetMap», que tiene que verse siempre).
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth()) {
            // La tarjeta de lo tocado: radio 16, relleno 12, a 16 de los lados (antes a 84 del borde, por el flotante de escanear,
            // que ya no está). En una parada, la cabecera lleva su número y la hora prevista, y tocarla abre su hoja (sale «Abrir»);
            // la ✕ la cierra.
            tocado?.let { t ->
                val p = (t as? Tocado.Una)?.p
                Surface(
                    color = MaterialTheme.colorScheme.surfaceContainerLow, shape = MaterialTheme.shapes.large, shadowElevation = 6.dp,
                    modifier = Modifier.fillMaxWidth().padding(start = Esp.l, end = Esp.l, top = Esp.l),
                ) {
                    Column(Modifier.padding(Esp.m)) {
                        Row(
                            Modifier.fillMaxWidth().then(if (p != null) Modifier.clickable { alTocar(p); tocado = null } else Modifier),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (p != null) {
                                NumeroParada(p.orden, TamNumero.FILA, estadoDe(p, siguiente = p.id == paradas.firstOrNull()?.id))
                                Spacer(Modifier.width(Esp.m))
                            }
                            Text(tituloDe(t), style = MaterialTheme.typography.titleMedium, maxLines = if (p != null) 1 else 2,
                                overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                            if (p != null) {
                                // La hora prevista, junto al nombre como en la fila («10:05 +8» en peligro si llega tarde).
                                val tarde = p.pendiente && (p.tardeMin ?: 0) > 0
                                if (p.pendiente && !p.eta.isNullOrBlank()) {
                                    Spacer(Modifier.width(Esp.s))
                                    Text(if (tarde) "${p.eta} +${p.tardeMin}" else p.eta, style = MaterialTheme.typography.labelMedium.merge(TextoNumero),
                                        color = if (tarde) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                                }
                                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(24.dp))
                            }
                            BotonIcono(Icons.Default.Close, tx("Cerrar"), { tocado = null })
                        }
                        when (t) {
                            is Tocado.Una -> TarjetaParada(t.p, enZbe = if (t.p.id in enZbe) tipoZona else "", alNavegar = { alNavegar(t.p) })
                            is Tocado.Inc -> TarjetaIncidencia(t.i, fuente)
                            is Tocado.Zona -> TarjetaZbe(t.z, tipoZona)
                            Tocado.LaFurgo -> furgo?.let { f -> TarjetaFurgo(f, ubicacion.myLocation, alQuitar = { alQuitarFurgo(); tocado = null }) }
                            is Tocado.Punto -> TarjetaPunto { alAparcarEn(t.lat, t.lng); tocado = null }
                        }
                    }
                }
            }
            Atribucion(tx("© OpenStreetMap"), Modifier.padding(Esp.s))
        }
    }
}

private fun tituloDe(t: Tocado): String = when (t) {
    is Tocado.Una -> t.p.cliente.ifBlank { t.p.direccion }
    is Tocado.Inc -> Calle.queIncidencia(t.i.que).replaceFirstChar { it.uppercase() }
    is Tocado.Zona -> "${t.z.tipo.ifBlank { "ZBE" }} ${t.z.nombre}"
    Tocado.LaFurgo -> tx("Tu furgoneta")
    is Tocado.Punto -> tx("¿Dejar aquí la furgoneta?")
}

/** El número de la tarjeta (07-11-2026): la siguiente en relleno de marca, las pendientes en su tinte, las hechas en
 *  gris y las fallidas en peligro, como en la lista de «Hoy». */
private fun estadoDe(p: Parada, siguiente: Boolean): EstadoNumero = when {
    p.estado == "fallido" -> EstadoNumero.FALLIDA
    !p.pendiente -> EstadoNumero.HECHA
    siguiente -> EstadoNumero.SIGUIENTE
    else -> EstadoNumero.PENDIENTE
}

/** Las etiquetas de una parada pendiente en su tarjeta (07-11-2026): las de la tarjeta de la siguiente de «Hoy», sin
 *  la hora (va junto al nombre) ni «Sin situar» (en el mapa solo hay situadas); «{n} bultos» solo con más de uno. */
private fun etiquetasDe(p: Parada, enZbe: String): List<Triple<String, Tono, ImageVector?>> = listOfNotNull(
    if (p.porCobrar) Triple(tx("Cobrar") + " " + Region.importe(p.cobrar ?: 0.0), Tono.AVISO, Icons.Default.Payments) else null,
    p.ventanaDesde?.let { Triple("$it–${p.ventanaHasta.orEmpty()}", Tono.NEUTRO, Icons.Default.Schedule) },
    if (p.prioridad) Triple(tx("Urgente"), Tono.AVISO, Icons.Default.PriorityHigh) else null,
    if (p.tipo == "recogida") Triple(tx("Recogida"), Tono.NEUTRO, null) else null,
    if (p.geo == "puerta") Triple(tx("Puerta conocida"), Tono.OK, null) else null,
    if (enZbe.isNotBlank()) Triple(enZbe, Tono.ZONA, null) else null,
    if (p.hueco.isNotBlank()) Triple(tx(p.hueco), Tono.NEUTRO, Icons.Default.Inventory2) else null,
    if (p.bultos > 1) Triple("${p.bultos} " + tx("bultos"), Tono.NEUTRO, null) else null,
)

private fun encuadra(m: MapView, puntos: List<GeoPoint>, animar: Boolean) {
    when {
        puntos.size >= 2 -> m.post { m.zoomToBoundingBox(BoundingBox.fromGeoPointsSafe(puntos).increaseByScale(1.3f), animar) }
        puntos.size == 1 -> { m.controller.setZoom(16.0); m.controller.setCenter(puntos[0]) }
        else -> { m.controller.setZoom(6.0); m.controller.setCenter(GeoPoint(40.4, -3.7)) }
    }
}

/** La tarjeta de una parada (07-11-2026, diseño compacto): una línea de detalle, las etiquetas en una fila que se
 *  desliza, las notas de la puerta en dos líneas (lo que dice el cliente, primero), y «Ir» (48, el resto) con «Llamar» de icono si hay teléfono.
 *  Hecha: «Entregado · 11:02» en verde (o «No entregado · 11:02 · motivo» en peligro) y sin botones. */
@Composable
private fun TarjetaParada(p: Parada, enZbe: String, alNavegar: () -> Unit) {
    val ctx = LocalContext.current
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    // El detalle: la dirección (si el título es el cliente) y, hecha, la hora prevista. «1 bulto» ya no se dice.
    val detalle = listOfNotNull(p.direccion.takeIf { p.cliente.isNotBlank() && it.isNotBlank() }, p.eta?.takeIf { !p.pendiente }?.let { "≈ $it" }).joinToString(" · ")
    if (detalle.isNotBlank()) {
        Text(detalle, style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = Esp.xs))
    }
    if (!p.pendiente) {
        val cuando = Calle.hora(p.cerradoEn).takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""
        val motivo = p.motivo?.takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""
        val recogida = p.tipo == "recogida"   // «Recogido» / «No recogido» en las recogidas, como su fila (07-11-2026)
        Text(if (p.estado == "fallido") (if (recogida) tx("No recogido") else tx("No entregado")) + cuando + motivo
            else (if (recogida) tx("Recogido") else tx("Entregado")) + cuando,
            style = MaterialTheme.typography.bodyMedium.merge(TextoNumero), color = if (p.estado == "fallido") c.error else x.entregadoTexto,
            maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = Esp.xs))
    } else {
        val etiquetas = etiquetasDe(p, enZbe)
        if (etiquetas.isNotEmpty()) FilaDeChips(Modifier.padding(top = Esp.s)) { etiquetas.forEach { (t, tono, i) -> Etiqueta(t, tono, i) } }
    }
    // RN, 08-11-2026: dos líneas como en «Hoy», con lo que dice el cliente primero: en una se cortaba el portal («Portal: 452…»).
    NotasPuerta(p, maxLines = 2, modifier = Modifier.padding(top = Esp.s))
    if (p.pendiente) {
        Row(Modifier.padding(top = Esp.m), horizontalArrangement = Arrangement.spacedBy(Esp.s), verticalAlignment = Alignment.CenterVertically) {
            BotonNormal(tx("Ir"), alNavegar, icono = Icons.Default.Navigation, modifier = Modifier.weight(1f))
            if (p.telefono.isNotBlank()) BotonIcono(Icons.Default.Call, tx("Llamar"), { Acciones.llamar(ctx, p.telefono) }, relleno = true)
        }
    }
}

@Composable
private fun TarjetaIncidencia(i: Incidencia, fuente: String) {
    val ctx = LocalContext.current
    val c = MaterialTheme.colorScheme
    if (i.texto.isNotBlank()) Text(i.texto, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = Esp.xs))
    Text(Calle.dondeIncidencia(i), style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceVariant)
    Text(tx("{f}: cortes y obras declarados, no el tráfico en tiempo real.", "f" to fuente.ifBlank { "DGT" }), style = MaterialTheme.typography.bodySmall,
        color = c.onSurfaceVariant, modifier = Modifier.padding(top = Esp.xs))
    BotonNormal(tx("Ver en Google Maps"), { Acciones.abrirWeb(ctx, "https://www.google.com/maps/search/?api=1&query=${i.lat},${i.lng}") },
        icono = Icons.Default.OpenInNew, modifier = Modifier.fillMaxWidth().padding(top = Esp.m))
}

@Composable
private fun TarjetaZbe(z: ZonaZbe, tipoZona: String) {
    val ctx = LocalContext.current
    val c = MaterialTheme.colorScheme
    val fuente = mapOf("dgt" to "DGT", "bnzfe" to "BNZFE (data.gouv.fr)", "ndw" to "NDW", "gla" to "TfL", "osm" to "OpenStreetMap")[z.fuente] ?: z.fuente.ifBlank { "DGT" }
    if (z.descripcion.isNotBlank()) Text(z.descripcion, style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceVariant, modifier = Modifier.padding(top = Esp.xs))
    if (z.etiquetas.isNotEmpty()) Text(tx("Etiquetas") + ": ${z.etiquetas.joinToString(", ")}", style = MaterialTheme.typography.bodySmall,
        color = c.onSurfaceVariant, modifier = Modifier.padding(top = Esp.xs))
    if (z.version.isNotBlank()) Text(tx("Según {f}, a {v}", "f" to fuente, "v" to z.version), style = MaterialTheme.typography.bodySmall, color = c.onSurfaceVariant)
    if (z.url.isNotBlank()) {
        BotonNormal(tx("Más información"), { Acciones.abrirWeb(ctx, z.url) }, icono = Icons.Default.OpenInNew, modifier = Modifier.fillMaxWidth().padding(top = Esp.m))
    }
}

@Composable
private fun TarjetaFurgo(f: Furgo, yo: GeoPoint?, alQuitar: () -> Unit) {
    val ctx = LocalContext.current
    Text(yo?.let { tx("A {d} de ti, en línea recta.", "d" to Calle.distancia(Calle.metros(it.latitude, it.longitude, f.lat, f.lng), Region.unidades == "mi", Idioma.locale)) } ?: tx("Donde la dejaste al bajarte."),
        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = Esp.xs))
    Row(Modifier.padding(top = Esp.m), horizontalArrangement = Arrangement.spacedBy(Esp.s), verticalAlignment = Alignment.CenterVertically) {
        BotonNormal(tx("Volver a pie"), { Acciones.irAPie(ctx, f.lat, f.lng) }, icono = Icons.Default.DirectionsWalk, modifier = Modifier.weight(1f))
        BotonTexto(tx("Quitar"), alQuitar)
    }
}

@Composable
private fun TarjetaPunto(alAparcar: () -> Unit) {
    Text(tx("Para volver a ella a pie sin dar vueltas. Se queda solo en este móvil."), style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = Esp.xs))
    BotonNormal(tx("Aparcada aquí"), alAparcar, modifier = Modifier.fillMaxWidth().padding(top = Esp.m))
}

/** La posición para el punto azul, del proveedor «fused» de Google (GPS + wifi + red, el que usan todas las apps):
 *  el de osmdroid lee el GPS en bruto y en interiores o entre edificios se queda a oscuras. Pide un fix cada 2 s
 *  solo con el mapa abierto. */
private class ProveedorFused(ctx: Context) : IMyLocationProvider {
    private val cliente = LocationServices.getFusedLocationProviderClient(ctx)
    private var consumidor: IMyLocationConsumer? = null
    private var ultima: Location? = null
    private val oyente = object : LocationCallback() {
        override fun onLocationResult(r: LocationResult) {
            r.lastLocation?.let { l -> ultima = l; consumidor?.onLocationChanged(l, this@ProveedorFused) }
        }
    }

    @SuppressLint("MissingPermission")
    override fun startLocationProvider(c: IMyLocationConsumer?): Boolean {
        consumidor = c
        return runCatching {
            cliente.lastLocation.addOnSuccessListener { l -> if (l != null && ultima == null) { ultima = l; consumidor?.onLocationChanged(l, this) } }
            val peticion = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2000L).setMinUpdateDistanceMeters(2f).build()
            cliente.requestLocationUpdates(peticion, oyente, Looper.getMainLooper())
            true
        }.getOrDefault(false)
    }

    override fun stopLocationProvider() { runCatching { cliente.removeLocationUpdates(oyente) }; consumidor = null }
    override fun getLastKnownLocation(): Location? = ultima
    override fun destroy() { stopLocationProvider() }
}

/* LOS DIBUJOS. Las mismas formas y colores que la web; medidas en dp. La guía (GuiaPantalla, con MapLibre) reutiliza
   la chincheta de la parada y el punto azul (lo `internal`); su ruta son capas de MapLibre. */

private const val BLANCO = -1
private val NOCHE = 0xFF0F172A.toInt()
internal val AZUL_RUTA = 0xFF3B82F6.toInt()
internal val AZUL_OSCURO = 0xFF1E3A8A.toInt()

/** El trazo de la línea de la ruta: suave, con las puntas y las esquinas redondas. */
internal fun trazo(color: Int, grosor: Float) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    this.color = color; style = Paint.Style.STROKE; strokeWidth = grosor; strokeJoin = Paint.Join.ROUND; strokeCap = Paint.Cap.ROUND
}
private val MORADO = 0xFF7C3AED.toInt()
private val VERDE = 0xFF059669.toInt()
private val VERDE_HECHA = 0xFF16A34A.toInt()
private val ROJO = 0xFFDC2626.toInt()
private val AZUL = 0xFF2563EB.toInt()

internal fun Context.dp() = resources.displayMetrics.density

private fun pintura(color: Int, estilo: Paint.Style = Paint.Style.FILL, grosor: Float = 0f) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    this.color = color; style = estilo; strokeWidth = grosor; strokeJoin = Paint.Join.ROUND; strokeCap = Paint.Cap.ROUND
}

/** El borde blanco con una sombra suave, como en la web. */
private fun borde(d: Float, color: Int = BLANCO, grosor: Float = 2.2f) =
    pintura(color, Paint.Style.STROKE, grosor * d).apply { setShadowLayer(2.5f * d, 0f, 1.2f * d, 0x73000000) }

private fun letra(color: Int, tam: Float) = pintura(color).apply { textSize = tam; typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.CENTER }

private fun lienzo(ctx: Context, anchoDp: Float, altoDp: Float): Pair<Bitmap, Canvas> {
    val d = ctx.dp()
    val bmp = Bitmap.createBitmap((anchoDp * d).toInt().coerceAtLeast(1), (altoDp * d).toInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
    return bmp to Canvas(bmp)
}

/** Texto centrado en (x, y). */
private fun Canvas.texto(s: String, x: Float, y: Float, p: Paint) = drawText(s, x, y - (p.descent() + p.ascent()) / 2, p)

/** Las medidas de la chincheta, en dp: radio de la cabeza, radio del halo, ancho, centro de la cabeza, punta y alto. */
private fun medidas(grande: Boolean): FloatArray {
    val r = if (grande) 16f else 12.5f
    val halo = if (grande) r * 1.9f else r
    val cy = halo + 3
    val punta = cy + 2 * r
    return floatArrayOf(r, halo, halo * 2 + 6, cy, punta, punta + 3)
}

/** Dónde cae la punta dentro del dibujo (0..1 de su alto), para clavarla en el sitio. */
internal fun puntaChincheta(grande: Boolean): Float = medidas(grande).let { it[4] / it[5] }

/** La chincheta con el número: la siguiente más grande y con halo; borde morado si la parada cae en una ZBE; un globo
 *  verde si el cliente contestó. */
internal fun chincheta(ctx: Context, n: Int, fondo: Int, tinta: Int, grande: Boolean, zbe: Boolean, dice: Boolean): Bitmap {
    val m = medidas(grande)
    val r = m[0]; val halo = m[1]; val w = m[2]; val cy = m[3]; val punta = m[4]; val h = m[5]
    val d = ctx.dp()
    val (bmp, c) = lienzo(ctx, w, h)
    val x = w / 2 * d; val y = cy * d; val rr = r * d
    if (grande) c.drawCircle(x, y, halo * d, pintura((fondo and 0x00FFFFFF) or 0x38000000))
    val forma = Path().apply { moveTo(x, punta * d); arcTo(RectF(x - rr, y - rr, x + rr, y + rr), 30f, -240f); close() }
    c.drawPath(forma, borde(d, if (zbe) MORADO else BLANCO, if (zbe) 2.8f else 2.2f))
    c.drawPath(forma, pintura(fondo))
    c.texto(n.toString(), x, y, letra(tinta, (if (n >= 100) 10.5f else if (grande) 15f else 13f) * d))
    if (dice) {
        val bx = x + rr * 0.85f; val by = y - rr * 0.85f
        c.drawCircle(bx, by, 6.3f * d, pintura(BLANCO)); c.drawCircle(bx, by, 5f * d, pintura(VERDE))
        for (k in -1..1) c.drawCircle(bx + k * 2.6f * d, by, 1f * d, pintura(BLANCO))
    }
    return bmp
}

/** Una parada hecha: círculo verde con ✓ (entregada) o rojo con ✕ (no se pudo). */
private fun hecha(ctx: Context, fallido: Boolean): Bitmap {
    val d = ctx.dp()
    val (bmp, c) = lienzo(ctx, 26f, 26f)
    val x = 13f * d
    c.drawCircle(x, x, 10.4f * d, borde(d)); c.drawCircle(x, x, 10.4f * d, pintura(if (fallido) ROJO else VERDE_HECHA))
    val p = pintura(BLANCO, Paint.Style.STROKE, 2.6f * d)
    if (fallido) {
        c.drawLine(x - 3.6f * d, x - 3.6f * d, x + 3.6f * d, x + 3.6f * d, p); c.drawLine(x + 3.6f * d, x - 3.6f * d, x - 3.6f * d, x + 3.6f * d, p)
    } else {
        c.drawPath(Path().apply { moveTo(x - 4.8f * d, x + 0.4f * d); lineTo(x - 1.6f * d, x + 3.6f * d); lineTo(x + 5f * d, x - 2.8f * d) }, p)
    }
    return bmp
}

/** Una incidencia de la DGT con la forma de lo que pasa (ver Calle.formaIncidencia). */
private fun incidencia(ctx: Context, clase: String): Bitmap {
    val d = ctx.dp()
    val (bmp, c) = lienzo(ctx, 32f, 32f)
    val x = 16f * d
    val color = Calle.colorIncidencia(clase).toInt()
    val fondo = pintura(color)
    fun excl(tinta: Int, y: Float) {
        c.drawRoundRect(x - 1.5f * d, y - 5f * d, x + 1.5f * d, y + 3.5f * d, 1.3f * d, 1.3f * d, pintura(tinta))
        c.drawCircle(x, y + 6.3f * d, 1.7f * d, pintura(tinta))
    }
    when (Calle.formaIncidencia(clase)) {
        "disco" -> {
            c.drawCircle(x, x, 12.5f * d, borde(d)); c.drawCircle(x, x, 12.5f * d, fondo)
            c.drawRoundRect(x - 7.8f * d, x - 1.9f * d, x + 7.8f * d, x + 1.9f * d, 1.3f * d, 1.3f * d, pintura(BLANCO))
        }
        "triangulo" -> {
            val t = Path().apply { moveTo(x, 2.6f * d); lineTo(x + 12.8f * d, x + 10.8f * d); lineTo(x - 12.8f * d, x + 10.8f * d); close() }
            c.drawPath(t, borde(d)); c.drawPath(t, fondo)
            excl(if (clase == "accidente") BLANCO else NOCHE, x + 2f * d)
        }
        "rombo" -> {
            val t = Path().apply { moveTo(x, 2f * d); lineTo(x + 13f * d, x); lineTo(x, x + 13f * d); lineTo(x - 13f * d, x); close() }
            c.drawPath(t, borde(d)); c.drawPath(t, fondo)
            excl(NOCHE, x - 0.5f * d)
        }
        "coche" -> {
            val caja = RectF(3f * d, 3f * d, 29f * d, 29f * d)
            c.drawRoundRect(caja, 6f * d, 6f * d, borde(d)); c.drawRoundRect(caja, 6f * d, 6f * d, fondo)
            val cuerpo = Path().apply {
                moveTo(x - 8.5f * d, x + 6f * d); lineTo(x - 8.5f * d, x + 1f * d); lineTo(x - 6.5f * d, x - 4f * d)
                lineTo(x + 6.5f * d, x - 4f * d); lineTo(x + 8.5f * d, x + 1f * d); lineTo(x + 8.5f * d, x + 6f * d); close()
            }
            c.drawPath(cuerpo, pintura(BLANCO))
            val ventana = Path().apply { moveTo(x - 5.2f * d, x + 0.4f * d); lineTo(x - 4f * d, x - 2.8f * d); lineTo(x + 4f * d, x - 2.8f * d); lineTo(x + 5.2f * d, x + 0.4f * d); close() }
            c.drawPath(ventana, fondo)
            for (k in intArrayOf(-1, 1)) {
                c.drawCircle(x + k * 4.5f * d, x + 6.3f * d, 2.2f * d, pintura(BLANCO))
                c.drawCircle(x + k * 4.5f * d, x + 6.3f * d, 2.2f * d, pintura(color, Paint.Style.STROKE, 1.2f * d))
            }
        }
        "nube" -> {
            c.drawCircle(x, x, 12.5f * d, borde(d)); c.drawCircle(x, x, 12.5f * d, fondo)
            val b = pintura(BLANCO)
            c.drawCircle(x - 3.5f * d, x + 0.5f * d, 3.6f * d, b); c.drawCircle(x + 0.5f * d, x - 2.2f * d, 4.6f * d, b); c.drawCircle(x + 4.5f * d, x + 0.8f * d, 3.2f * d, b)
            c.drawRoundRect(x - 7f * d, x - 0.5f * d, x + 7.5f * d, x + 3.6f * d, 2f * d, 2f * d, b)
            val g = pintura(BLANCO, Paint.Style.STROKE, 1.6f * d)
            for (k in -1..1) c.drawLine(x + k * 3.6f * d, x + 5.6f * d, x + k * 3.6f * d - 0.9f * d, x + 7.8f * d, g)
        }
        else -> {
            c.drawCircle(x, x, 12.5f * d, borde(d)); c.drawCircle(x, x, 12.5f * d, fondo)
            c.drawCircle(x, x - 5.6f * d, 1.7f * d, pintura(BLANCO))
            c.drawRoundRect(x - 1.5f * d, x - 2.4f * d, x + 1.5f * d, x + 6.6f * d, 1.3f * d, 1.3f * d, pintura(BLANCO))
        }
    }
    return bmp
}

/** La furgoneta aparcada (dónde aparqué): una furgoneta blanca en un cuadrado oscuro. */
private fun furgoneta(ctx: Context): Bitmap {
    val d = ctx.dp()
    val (bmp, c) = lienzo(ctx, 36f, 36f)
    val caja = RectF(3f * d, 3f * d, 33f * d, 33f * d)
    c.drawRoundRect(caja, 8f * d, 8f * d, borde(d)); c.drawRoundRect(caja, 8f * d, 8f * d, pintura(NOCHE))
    val x = 18f * d
    val cuerpo = Path().apply {
        moveTo(x - 11f * d, x + 5.5f * d); lineTo(x - 11f * d, x - 4.5f * d); lineTo(x + 1.5f * d, x - 4.5f * d)
        lineTo(x + 6.5f * d, x + 0.5f * d); lineTo(x + 11f * d, x + 0.5f * d); lineTo(x + 11f * d, x + 5.5f * d); close()
    }
    c.drawPath(cuerpo, pintura(BLANCO))
    c.drawPath(Path().apply { moveTo(x - 0.5f * d, x - 2.5f * d); lineTo(x + 1.6f * d, x - 2.5f * d); lineTo(x + 4.6f * d, x + 0.5f * d); lineTo(x - 0.5f * d, x + 0.5f * d); close() }, pintura(NOCHE))
    for (k in intArrayOf(-6, 6)) {
        c.drawCircle(x + k * d, x + 5.8f * d, 2.6f * d, pintura(NOCHE))
        c.drawCircle(x + k * d, x + 5.8f * d, 2.6f * d, pintura(BLANCO, Paint.Style.STROKE, 1.8f * d))
    }
    return bmp
}

/** La base (el almacén): una nave blanca en un cuadrado oscuro. */
private fun nave(ctx: Context): Bitmap {
    val d = ctx.dp()
    val (bmp, c) = lienzo(ctx, 32f, 32f)
    val caja = RectF(3f * d, 3f * d, 29f * d, 29f * d)
    c.drawRoundRect(caja, 7f * d, 7f * d, borde(d)); c.drawRoundRect(caja, 7f * d, 7f * d, pintura(NOCHE))
    val x = 16f * d
    c.drawPath(Path().apply { moveTo(x - 8.5f * d, x - 1.5f * d); lineTo(x, x - 8.5f * d); lineTo(x + 8.5f * d, x - 1.5f * d); lineTo(x + 8.5f * d, x + 7f * d); lineTo(x - 8.5f * d, x + 7f * d); close() }, pintura(BLANCO))
    c.drawRect(x - 2f * d, x + 1f * d, x + 2f * d, x + 7f * d, pintura(NOCHE))
    return bmp
}

/** El móvil: punto azul con halo; con `flecha`, además la cuña hacia donde mira (la guía la gira con el rumbo). */
internal fun puntoAzul(ctx: Context, flecha: Boolean): Bitmap {
    val d = ctx.dp()
    val (bmp, c) = lienzo(ctx, 44f, 44f)
    val x = 22f * d
    c.drawCircle(x, x, 20f * d, pintura(0x332563EB))
    if (flecha) c.drawPath(Path().apply { moveTo(x, 2f * d); lineTo(x + 6f * d, x - 6f * d); lineTo(x - 6f * d, x - 6f * d); close() }, pintura(AZUL))
    c.drawCircle(x, x, 9.5f * d, pintura(BLANCO).apply { setShadowLayer(2.5f * d, 0f, 1f * d, 0x66000000) })
    c.drawCircle(x, x, 7f * d, pintura(AZUL))
    return bmp
}

/** La etiqueta «ZBE» del centro de una zona de bajas emisiones. */
private fun etiquetaZbe(ctx: Context, texto: String = "ZBE"): Bitmap {
    val d = ctx.dp()
    val tipo = letra(BLANCO, 10f * d)
    val ancho = (tipo.measureText(texto) / d + 16f).coerceIn(40f, 120f)
    val (bmp, c) = lienzo(ctx, ancho + 4f, 22f)
    val caja = RectF(2f * d, 2f * d, (ancho + 2f) * d, 20f * d)
    c.drawRoundRect(caja, 9f * d, 9f * d, borde(d, grosor = 1.5f)); c.drawRoundRect(caja, 9f * d, 9f * d, pintura(MORADO))
    c.texto(texto, (ancho + 4f) / 2 * d, 11f * d, tipo)
    return bmp
}
