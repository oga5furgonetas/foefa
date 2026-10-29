package com.flotadsp.fds.ui.hoy

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.flotadsp.fds.data.Base
import com.flotadsp.fds.data.Parada
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.CustomZoomButtonsController
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline

/* EL MAPA DE LA RUTA (OpenStreetMap, el mismo que la web): cada parada por entregar con su número, en orden,
   unidas por una línea; tocar una abre su ficha. Las teselas se guardan en la caché de la app. */
@Composable
fun MapaRuta(paradas: List<Parada>, base: Base?, trazado: List<Pair<Double, Double>> = emptyList(), alTocar: (Parada) -> Unit, modifier: Modifier = Modifier) {
    val ctx = LocalContext.current
    val ubicadas = paradas.filter { it.ubicada }
    // Se encuadra la ruta cuando CAMBIAN las paradas, no a cada repintado: hasta el 29-10-2026 cualquier cambio de
    // estado (un aviso abajo, el trazado que llega) volvía a centrar el mapa y no dejaba acercarse a una calle.
    val clave = ubicadas.joinToString(",") { "${it.id}:${it.orden}" }
    var encuadrada by remember { mutableStateOf("") }
    val cian = MaterialTheme.colorScheme.primary.toArgb()
    val tinta = MaterialTheme.colorScheme.onPrimary.toArgb()
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
    val ciclo = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(ciclo) {
        val o = LifecycleEventObserver { _, ev ->
            when (ev) { Lifecycle.Event.ON_RESUME -> mapa.onResume(); Lifecycle.Event.ON_PAUSE -> mapa.onPause(); else -> Unit }
        }
        ciclo.addObserver(o)
        onDispose { ciclo.removeObserver(o); mapa.onDetach() }
    }
    Box(modifier) {
        AndroidView(factory = { mapa }, modifier = Modifier, update = { m ->
            m.overlays.clear()
            val puntos = ubicadas.map { GeoPoint(it.lat!!, it.lng!!) }
            if (puntos.size >= 2) {
                // Por las calles si el servidor lo ha dado; si no, de parada a parada en línea recta.
                val camino = if (trazado.size >= 2) trazado.map { GeoPoint(it.first, it.second) } else puntos
                m.overlays.add(Polyline(m).apply {
                    setPoints(camino)
                    outlinePaint.color = cian; outlinePaint.strokeWidth = if (camino === puntos) 6f else 9f; outlinePaint.alpha = 170
                })
            }
            ubicadas.forEachIndexed { i, p ->
                m.overlays.add(Marker(m).apply {
                    position = GeoPoint(p.lat!!, p.lng!!)
                    icon = BitmapDrawable(m.resources, numero(m.context, p.orden ?: (i + 1), cian, tinta))
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    title = p.cliente.ifBlank { p.direccion }
                    setOnMarkerClickListener { _, _ -> alTocar(p); true }
                })
            }
            base?.let { b ->
                if (b.lat != null && b.lng != null) m.overlays.add(Marker(m).apply {
                    position = GeoPoint(b.lat, b.lng); title = "Tu base"; setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                })
            }
            if (encuadrada != clave) {
                encuadrada = clave
                when {
                    puntos.size >= 2 -> m.post { m.zoomToBoundingBox(BoundingBox.fromGeoPointsSafe(puntos).increaseByScale(1.3f), false) }
                    puntos.size == 1 -> { m.controller.setZoom(16.0); m.controller.setCenter(puntos[0]) }
                    else -> { m.controller.setZoom(6.0); m.controller.setCenter(GeoPoint(40.4, -3.7)) }
                }
            }
            m.invalidate()
        })
        if (ubicadas.size < paradas.size) {
            Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = MaterialTheme.shapes.small,
                modifier = Modifier.align(Alignment.TopCenter).padding(12.dp)) {
                Text("${paradas.size - ubicadas.size} sin ubicar en el mapa: edítalas para corregir la dirección.",
                    style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
            }
        }
        Text("© OpenStreetMap", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.align(Alignment.BottomStart).padding(8.dp))
    }
}

/** El círculo con el número de la parada. */
private fun numero(ctx: Context, n: Int, fondo: Int, tinta: Int): Bitmap {
    val d = ctx.resources.displayMetrics.density
    val tam = (34 * d).toInt()
    val bmp = Bitmap.createBitmap(tam, tam, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    p.color = android.graphics.Color.WHITE
    c.drawCircle(tam / 2f, tam / 2f, tam / 2f, p)
    p.color = fondo
    c.drawCircle(tam / 2f, tam / 2f, tam / 2f - 2.5f * d, p)
    p.color = tinta; p.textSize = 14 * d; p.typeface = Typeface.DEFAULT_BOLD; p.textAlign = Paint.Align.CENTER
    c.drawText(n.toString(), tam / 2f, tam / 2f - (p.descent() + p.ascent()) / 2, p)
    return bmp
}
