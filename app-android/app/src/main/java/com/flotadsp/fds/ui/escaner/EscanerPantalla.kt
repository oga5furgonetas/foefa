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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
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
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

@Composable
fun EscanerPantalla(
    pais: String, vuelta: VueltaDeRevisar?, alCerrar: (cambios: Boolean) -> Unit, alRevisar: (Lectura) -> Unit, vm: EscanerVM = viewModel(),
) {
    val ctx = LocalContext.current
    val actividad = remember(ctx) { ctx.actividad() }
    vm.pais = pais
    // Abierto desde «Hoy»: contadores a cero. De vuelta de revisar una etiqueta: sigue el mismo escaneo.
    LaunchedEffect(Unit) { if (vuelta == null) vm.empezar() else vm.reanudar(vuelta.guardada) }
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
    val cerrar = { alCerrar(e.anadidas > 0 || e.yaEstaban > 0) }
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
            "nueva" -> { tono?.startTone(ToneGenerator.TONE_PROP_ACK, 150); Acciones.vibrar(ctx, 60) }
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
            Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.PhotoCamera, contentDescription = null, tint = Color.White, modifier = Modifier.size(48.dp))
                Spacer(Modifier.height(16.dp))
                Text(tx("Para escanear hace falta la cámara"), style = MaterialTheme.typography.titleLarge, color = Color.White, textAlign = TextAlign.Center)
                Spacer(Modifier.height(8.dp))
                Text(
                    if (bloqueado) tx("Actívala en Permisos › Cámara. Solo se usa mientras escaneas y las imágenes no salen del móvil.")
                    else tx("Solo se usa mientras escaneas y las imágenes no salen del móvil."),
                    color = Color.White.copy(alpha = .8f), textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(24.dp))
                Button(onClick = {
                    if (bloqueado) ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null)))
                    else pedir.launch(Manifest.permission.CAMERA)
                }) { Text(if (bloqueado) tx("Abrir los permisos") else tx("Permitir la cámara")) }
            }
        }
        Arriba(alCerrar = cerrar, linterna = permiso)
        Abajo(e, alTerminar = cerrar, modifier = Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
private fun Arriba(alCerrar: () -> Unit, linterna: Boolean) {
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = alCerrar, colors = IconButtonDefaults.iconButtonColors(contentColor = Color.White)) {
            Icon(Icons.Default.Close, contentDescription = tx("Cerrar el escáner"))
        }
        Text(tx("Apunta a la etiqueta"), color = Color.White, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
        if (linterna) Linterna()
    }
}

private tailrec fun Context.actividad(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.actividad()
    else -> null
}

private var camaraActual: Camera? = null

private val FORMATOS_2D = setOf(Barcode.FORMAT_QR_CODE, Barcode.FORMAT_DATA_MATRIX, Barcode.FORMAT_PDF417, Barcode.FORMAT_AZTEC)

@Composable
private fun Linterna() {
    var encendida by remember { mutableStateOf(false) }
    IconButton(onClick = { encendida = !encendida; camaraActual?.cameraControl?.enableTorch(encendida) },
        colors = IconButtonDefaults.iconButtonColors(contentColor = Color.White)) {
        Icon(if (encendida) Icons.Default.FlashOn else Icons.Default.FlashOff, contentDescription = if (encendida) tx("Apagar la linterna") else tx("Encender la linterna"))
    }
}

@Composable
private fun Abajo(e: EstadoEscaner, alTerminar: () -> Unit, modifier: Modifier) {
    Surface(color = Color(0xEE111114), contentColor = Color.White, shape = MaterialTheme.shapes.extraLarge,
        modifier = modifier.fillMaxWidth().navigationBarsPadding().padding(12.dp)) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (e.trabajando) { CircularProgressIndicator(Modifier.height(18.dp).width(18.dp), strokeWidth = 2.dp, color = Color.White); Spacer(Modifier.width(10.dp)) }
                val u = e.ultimo
                Text(
                    when { e.trabajando -> tx("Leyendo la etiqueta…"); u != null -> u.texto; else -> tx("Pasa las etiquetas una tras otra: cada paquete entra en tu ruta.") },
                    style = MaterialTheme.typography.bodyLarge, fontWeight = if (u != null) FontWeight.SemiBold else FontWeight.Normal,
                    color = when (u?.tipo) { "nueva" -> Color(0xFF6EE7B7); "error" -> Color(0xFFFCA5A5); else -> Color.White },
                    modifier = Modifier.weight(1f),
                )
            }
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${e.anadidas} ${if (e.anadidas == 1) tx("añadida") else tx("añadidas")} · ${e.yaEstaban} ${if (e.yaEstaban == 1) tx("ya estaba") else tx("ya estaban")}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = .8f), modifier = Modifier.weight(1f))
                Button(onClick = alTerminar) { Text(tx("Listo")) }
            }
        }
    }
}

/** El recuadro donde poner la etiqueta, con el resto oscurecido. */
@Composable
private fun Ventana() {
    Canvas(Modifier.fillMaxSize().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }) {
        drawRect(Color(0x99000000))
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
