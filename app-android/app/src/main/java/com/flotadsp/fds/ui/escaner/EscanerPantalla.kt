// diseño compacto
package com.flotadsp.fds.ui.escaner

import com.flotadsp.fds.ui.tx
import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flotadsp.fds.etiqueta.Lectura
import com.flotadsp.fds.etiqueta.TextoDelCodigo
import com.flotadsp.fds.ui.Acciones
import com.flotadsp.fds.ui.Alto
import com.flotadsp.fds.ui.BotonIcono
import com.flotadsp.fds.ui.BotonNormal
import com.flotadsp.fds.ui.Esp
import com.flotadsp.fds.ui.LetraMax
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.Pastilla
import com.flotadsp.fds.ui.TextoNumero
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

/* EL ESCÁNER DEL DISEÑO COMPACTO (07-11-2026, §5.5 de la especificación): arriba, la ✕ y la linterna de 48 sobre un
   fondo redondo y la píldora «Apunta al código»; abajo, una barra de radio 16 y relleno 12 con el último resultado (su
   icono además del color), en la carga el hueco en grande y, si el paquete ya estaba, su número de parada en grande para
   buscarlo sin cerrar el escáner; en reposo solo el contador y «Listo». Los colores salen de Extra (ui/Tema.kt). Lo que
   hace el escáner no cambia: EscanerVM. */
@Composable
fun EscanerPantalla(
    pais: String, vuelta: VueltaDeRevisar?, alCerrar: (cambios: Boolean) -> Unit, alRevisar: (Lectura) -> Unit,
    /** «carga» (01-11-2026): desde «Cargar la furgoneta», cada paquete se marca como metido y se dice su hueco. */
    modo: String = "", vm: EscanerVM = viewModel(),
) {
    val ctx = LocalContext.current
    val actividad = remember(ctx) { ctx.actividad() }
    vm.pais = pais
    // Abierto desde «Hoy»: contadores a cero. De vuelta de revisar una etiqueta: sigue el mismo escaneo.
    LaunchedEffect(Unit) { if (vuelta == null) vm.empezar(modo) else vm.reanudar(vuelta.guardada, vuelta.sinSituar) }
    val e by vm.estado.collectAsState()
    val tienePermiso = { ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED }
    var permiso by remember { mutableStateOf(tienePermiso()) }
    // «No permitir» una vez: se puede volver a preguntar. Dos veces (o «no volver a preguntar»): Android ya no enseña
    // el diálogo y solo queda llevarle a los permisos de la app.
    var bloqueado by remember { mutableStateOf(false) }
    val pedir = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        permiso = ok
        bloqueado = !ok && actividad?.shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) == false
    }
    LaunchedEffect(Unit) { if (!permiso) pedir.launch(Manifest.permission.CAMERA) }
    // Al volver de los ajustes con el permiso dado, la cámara se enciende sola.
    LifecycleResumeEffect(Unit) { if (!permiso && tienePermiso()) permiso = true; onPauseOrDispose { } }
    val cerrar = { alCerrar(e.anadidas > 0 || e.yaEstaban > 0 || (e.cargados ?: 0) > 0) }
    BackHandler(onBack = cerrar)

    // Sobre la cámara (negro), los iconos de la barra de estado van claros aunque la app esté en tema claro.
    val vista = LocalView.current
    DisposableEffect(actividad) {
        val ctl = actividad?.window?.let { WindowCompat.getInsetsController(it, vista) }
        val antes = ctl?.let { it.isAppearanceLightStatusBars to it.isAppearanceLightNavigationBars }
        ctl?.isAppearanceLightStatusBars = false
        ctl?.isAppearanceLightNavigationBars = false
        onDispose { if (ctl != null && antes != null) { ctl.isAppearanceLightStatusBars = antes.first; ctl.isAppearanceLightNavigationBars = antes.second } }
    }

    // Suena y vibra con cada etiqueta: con el paquete en la mano no se mira la pantalla.
    val tono = remember { runCatching { ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80) }.getOrNull() }
    DisposableEffect(Unit) { onDispose { tono?.release() } }
    LaunchedEffect(e.ultimo) {
        val u = e.ultimo ?: return@LaunchedEffect
        when (u.tipo) {
            "nueva", "carga" -> { tono?.startTone(ToneGenerator.TONE_PROP_ACK, 150); Acciones.vibrar(ctx, 60) }
            "ya" -> { tono?.startTone(ToneGenerator.TONE_PROP_BEEP, 120); Acciones.vibrar(ctx, 30) }
            else -> { tono?.startTone(ToneGenerator.TONE_PROP_NACK, 250); Acciones.vibrar(ctx, 200) }
        }
    }
    LaunchedEffect(e.revisar) { e.revisar?.let { tono?.startTone(ToneGenerator.TONE_PROP_PROMPT, 150); alRevisar(it); vm.revisada() } }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (permiso) {
            Camara(alLeer = { codigos, bmp, giro -> vm.tratar(codigos, bmp, giro) }, esNuevo = { vm.hayNuevo(it) },
                ocupado = { vm.estado.value.trabajando })
            Ventana()
        } else {
            Permiso(bloqueado,
                alPedir = { pedir.launch(Manifest.permission.CAMERA) },
                alAjustes = { ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null))) })
        }
        Arriba(alCerrar = cerrar, linterna = permiso)
        Abajo(e, modo = modo, alTerminar = cerrar, modifier = Modifier.align(Alignment.BottomCenter))
    }
}

/** Sin permiso de cámara (§5.5): el icono de 40, el título, una línea y el botón de 48. La explicación de dónde activarla
 *  ya no hace falta: el botón abre los permisos de la app. */
@Composable
private fun Permiso(bloqueado: Boolean, alPedir: () -> Unit, alAjustes: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(Esp.xl), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.PhotoCamera, contentDescription = null, tint = Color.White, modifier = Modifier.size(40.dp))
        Spacer(Modifier.height(Esp.l))
        Text(tx("Para escanear hace falta la cámara"), style = MaterialTheme.typography.titleLarge, color = Color.White, textAlign = TextAlign.Center)
        Spacer(Modifier.height(Esp.s))
        Text(tx("Solo se usa mientras escaneas y las imágenes no salen del móvil."), style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = .8f), textAlign = TextAlign.Center)
        Spacer(Modifier.height(Esp.xl))
        BotonNormal(if (bloqueado) tx("Abrir los permisos") else tx("Permitir la cámara"), if (bloqueado) alAjustes else alPedir)
    }
}

/** Arriba (§5.5): la ✕ y la linterna de 48, blancas sobre negro al 40 %, y en el centro la píldora «Apunta al código»
 *  (negro al 60 %). Sin linterna (sin permiso), un hueco de 48 para que la píldora siga centrada. */
@Composable
private fun Arriba(alCerrar: () -> Unit, linterna: Boolean) {
    val x = LocalExtra.current
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(Esp.s), verticalAlignment = Alignment.CenterVertically) {
        SobreCamara { BotonIcono(Icons.Default.Close, tx("Cerrar el escáner"), alCerrar) }
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            Pastilla(tx("Apunta al código"), color = x.escaner.copy(alpha = 0.6f), contentColor = Color.White)
        }
        if (linterna) Linterna() else Spacer(Modifier.size(Alto.boton))
    }
}

/** El fondo redondo de un botón sobre la cámara: el negro del escáner al 40 %, con el icono en blanco. */
@Composable
private fun SobreCamara(contenido: @Composable () -> Unit) {
    Surface(shape = CircleShape, color = LocalExtra.current.escaner.copy(alpha = 0.4f), contentColor = Color.White, content = contenido)
}

internal tailrec fun Context.actividad(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.actividad()
    else -> null
}

private var camaraActual: Camera? = null

private val FORMATOS_2D = setOf(Barcode.FORMAT_QR_CODE, Barcode.FORMAT_DATA_MATRIX, Barcode.FORMAT_PDF417, Barcode.FORMAT_AZTEC)

@Composable
private fun Linterna() {
    var encendida by remember { mutableStateOf(false) }
    SobreCamara {
        BotonIcono(
            if (encendida) Icons.Default.FlashOn else Icons.Default.FlashOff,
            if (encendida) tx("Apagar la linterna") else tx("Encender la linterna"),
            { encendida = !encendida; camaraActual?.cameraControl?.enableTorch(encendida) },
        )
    }
}

/** La barra de abajo (§5.5): radio 16, relleno 12, el negro del escáner. Con un resultado, su icono además del color
 *  (✓ nueva, ↺ ya estaba, ⚠ revisar, ✗ error) y el texto en dos líneas; en la carga, «→ {hueco}» en `cifra`; si el
 *  paquete ya estaba, «Parada {n}» en `cifra`. Debajo, el contador y «Listo», con la letra topada a 1,3 (§3.8). */
@Composable
private fun Abajo(e: EstadoEscaner, modo: String, alTerminar: () -> Unit, modifier: Modifier) {
    val x = LocalExtra.current
    Surface(color = x.escaner, contentColor = Color.White, shape = MaterialTheme.shapes.large,
        modifier = modifier.fillMaxWidth().navigationBarsPadding().padding(Esp.m)) {
        Column(Modifier.padding(Esp.m), verticalArrangement = Arrangement.spacedBy(Esp.s)) {
            val u = e.ultimo
            if (e.trabajando) {
                Linea(null, tx("Leyendo…"), Color.White, cargando = true)
            } else if (u != null) {
                val (icono, color) = when {
                    u.tipo == "error" -> Icons.Default.Close to x.escanerError
                    u.aviso -> Icons.Default.Warning to x.escanerAviso
                    u.tipo == "ya" -> Icons.Default.Replay to Color.White
                    else -> Icons.Default.Check to x.escanerOk
                }
                Linea(icono, u.texto, color)
                // LA CARGA GUIADA (01-11-2026): el hueco del último paquete, en grande (por voz lo dice el ViewModel).
                if (modo == "carga" && u.tipo == "carga") Cifra("→ " + (e.hueco?.takeIf { it.isNotBlank() }?.let { tx(it) } ?: tx("Sin hueco")))
                // El número de parada de un paquete que ya estaba (07-11-2026): para buscarlo sin cerrar el escáner.
                else if (u.tipo == "ya" && u.parada != null) Cifra(tx("Parada {n}", "n" to u.parada))
            }
            LetraMax(1.3f) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (modo == "carga") tx("{a} de {b} cargados", "a" to (e.cargados ?: 0), "b" to (e.total ?: 0))
                        else "${e.anadidas} ${if (e.anadidas == 1) tx("añadida") else tx("añadidas")} · ${e.yaEstaban} ${if (e.yaEstaban == 1) tx("ya estaba") else tx("ya estaban")}",
                        style = MaterialTheme.typography.bodySmall.merge(TextoNumero), color = Color.White.copy(alpha = .8f),
                        maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    Spacer(Modifier.width(Esp.s))
                    BotonNormal(tx("Listo"), alTerminar)
                }
            }
        }
    }
}

/** Una línea de la barra: el icono (o el círculo mientras lee) de 20 y el texto en `boton`, dos líneas como mucho. */
@Composable
private fun Linea(icono: ImageVector?, texto: String, color: Color, cargando: Boolean = false) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (cargando) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = color)
        else if (icono != null) Icon(icono, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(Esp.s))
        Text(texto, style = MaterialTheme.typography.labelLarge, color = color, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
    }
}

/** Lo que se lee de un vistazo con el paquete en la mano: el hueco o el número de parada, en `cifra` y en verde. */
@Composable
private fun Cifra(texto: String) {
    Text(texto, style = MaterialTheme.typography.headlineMedium, color = LocalExtra.current.escanerOk, maxLines = 1, overflow = TextOverflow.Ellipsis)
}

/** El recuadro donde poner la etiqueta, con el resto oscurecido (el negro del escáner al 60 %). */
@Composable
private fun Ventana() {
    val sombra = LocalExtra.current.escaner.copy(alpha = 0.6f)
    Canvas(Modifier.fillMaxSize().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }) {
        drawRect(sombra)
        val ancho = size.width * 0.84f
        val alto = minOf(size.height * 0.36f, ancho * 0.8f)
        val esquina = Offset((size.width - ancho) / 2, size.height * 0.42f - alto / 2)
        drawRoundRect(Color.Transparent, esquina, Size(ancho, alto), CornerRadius(28f, 28f), blendMode = BlendMode.Clear)
        drawRoundRect(Color.White, esquina, Size(ancho, alto), CornerRadius(28f, 28f), style = Stroke(width = 5f))
    }
}

// `img.image` (el fotograma tal cual, para ML Kit) es API «experimental» de CameraX: estable en la práctica y la que
// usa la guía oficial de ML Kit con CameraX.
@androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
@Composable
private fun Camara(alLeer: (List<String>, Bitmap?, Int) -> Unit, esNuevo: (Collection<String>) -> Boolean, ocupado: () -> Boolean) {
    val ctx = LocalContext.current
    val ciclo = LocalLifecycleOwner.current
    val hilo = remember { Executors.newSingleThreadExecutor() }
    val lector = remember {
        BarcodeScanning.getClient(BarcodeScannerOptions.Builder().setBarcodeFormats(
            Barcode.FORMAT_CODE_128, Barcode.FORMAT_CODE_39, Barcode.FORMAT_CODE_93, Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8,
            Barcode.FORMAT_ITF, Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E, Barcode.FORMAT_CODABAR, Barcode.FORMAT_QR_CODE,
            Barcode.FORMAT_DATA_MATRIX, Barcode.FORMAT_PDF417, Barcode.FORMAT_AZTEC,
        ).build())
    }
    // La cámara va atada a la actividad: al salir del escáner hay que soltarla a mano. Sin esto seguía encendida con
    // la ficha abierta o de vuelta en «Hoy» (cliente de cámara activo en el emulador: el punto verde y la batería).
    val enlace = remember {
        object { var proveedor: ProcessCameraProvider? = null; var vivo = true; var preview: Preview? = null; var analisis: ImageAnalysis? = null }
    }
    DisposableEffect(Unit) {
        onDispose { enlace.vivo = false; enlace.proveedor?.unbindAll(); lector.close(); hilo.shutdown(); camaraActual = null }
    }
    // Al girar el móvil la actividad no se recrea (configChanges): la cámara se entera aquí. Sin la rotación buena, el
    // OCR de la etiqueta recibe el fotograma de lado y no lee nada.
    val orientacion = LocalConfiguration.current.orientation
    val vistaRaiz = LocalView.current
    LaunchedEffect(orientacion) {
        val giro = vistaRaiz.display?.rotation ?: return@LaunchedEffect
        enlace.preview?.targetRotation = giro
        enlace.analisis?.targetRotation = giro
    }
    AndroidView(factory = { c ->
        val vista = PreviewView(c).apply { scaleType = PreviewView.ScaleType.FILL_CENTER }
        val futuro = ProcessCameraProvider.getInstance(c)
        futuro.addListener({
            if (!enlace.vivo) return@addListener      // se cerró antes de que la cámara estuviera lista
            val proveedor = futuro.get()
            enlace.proveedor = proveedor
            val preview = Preview.Builder().build().also { it.surfaceProvider = vista.surfaceProvider }
            // 1280×720 como pide ML Kit para leer de lejos: con los 640×480 de serie, un Aztec de SEUR a un palmo
            // se queda en dos píxeles por módulo y no siempre sale.
            val analisis = ImageAnalysis.Builder()
                .setResolutionSelector(ResolutionSelector.Builder()
                    .setResolutionStrategy(ResolutionStrategy(android.util.Size(1280, 720), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER))
                    .build())
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
            enlace.preview = preview
            enlace.analisis = analisis
            // Los códigos de UNA etiqueta: la barra y el 2D no siempre salen en el mismo fotograma. Con un 2D (el que
            // trae la dirección) se trata a los 0,3 s; con solo barras se espera hasta 0,9 s a que salga el 2D. En el
            // emulador, tratar a los 0,45 s pasara lo que pasara contaba la barra y el Aztec como dos paquetes.
            var junto = linkedSetOf<String>()
            var con2D = false
            var desde = 0L
            analisis.setAnalyzer(hilo) { img: ImageProxy ->
                val media = img.image
                // Mientras se trata una etiqueta (servidor, OCR) no se buscan más códigos: el OCR va solo y antes.
                if (media == null || ocupado()) { img.close(); return@setAnalyzer }
                val giro = img.imageInfo.rotationDegrees
                lector.process(InputImage.fromMediaImage(media, giro))
                    .addOnSuccessListener { lista ->
                        val ahora = System.currentTimeMillis()
                        // Con tildes o eñes (Latin-1), ML Kit no da el texto: se saca de los bytes (TextoDelCodigo).
                        val leidos = lista.mapNotNull { b -> TextoDelCodigo.de(b)?.takeIf { it.isNotBlank() }?.let { b.format to it } }
                        if (leidos.isNotEmpty()) {
                            if (junto.isEmpty()) desde = ahora
                            leidos.forEach { (formato, v) -> junto.add(v); if (formato in FORMATOS_2D) con2D = true }
                        }
                        if (junto.isNotEmpty() && ahora - desde >= (if (con2D) 300 else 900)) {
                            // La misma etiqueta aún delante de la cámara no se vuelve a tratar (ni se copia el fotograma).
                            if (esNuevo(junto)) alLeer(junto.toList(), runCatching { img.toBitmap() }.getOrNull(), giro)
                            junto = linkedSetOf()
                            con2D = false
                        }
                    }
                    .addOnCompleteListener { img.close() }
            }
            runCatching {
                proveedor.unbindAll()
                camaraActual = proveedor.bindToLifecycle(ciclo, CameraSelector.DEFAULT_BACK_CAMERA, preview, analisis)
            }
        }, ContextCompat.getMainExecutor(c))
        vista
    }, modifier = Modifier.fillMaxSize())
}
