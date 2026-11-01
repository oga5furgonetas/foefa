package com.flotadsp.fds.ui.compartir

import com.flotadsp.fds.ui.tx
import android.app.Application
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.PlaylistAdd
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.exifinterface.media.ExifInterface
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.FilaPegada
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.File

/* «COMPARTIR CON FDS» (01-11-2026, docs/SIGUIENTE-NIVEL-01-11.md §9): la hoja de la agencia compartida desde cualquier
   app (el PDF del correo, la captura del WhatsApp del jefe, una foto, la lista en texto) entra como paradas. Las fotos y
   el PDF se leen AQUÍ, en el móvil (ML Kit, el mismo lector que las etiquetas; el PDF se pinta página a página); el
   texto va al servidor, que dice qué líneas son paradas (/reparto/pegar con `hoja`), se enseñan, y «Añadir» las crea. */

data class EstadoCompartido(
    val leyendo: Boolean = true,
    val filas: List<FilaPegada> = emptyList(),
    val texto: String = "",
    val error: String? = null,
    val anadiendo: Boolean = false,
    /** (creadas, repetidas) cuando ya se han añadido: la pantalla se cierra. */
    val hecho: Pair<Int, Int>? = null,
)

class CompartidoVM(app: Application) : AndroidViewModel(app) {
    private val repo = (app as FdsApp).repo
    private val _e = MutableStateFlow(EstadoCompartido())
    val estado: StateFlow<EstadoCompartido> = _e
    private val ocr = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private var leido: Compartido? = null
    private var hoja = false
    private var pais = "es"

    fun leer(c: Compartido, pais: String) {
        if (leido == c) return
        leido = c
        this.pais = pais
        _e.value = EstadoCompartido()
        viewModelScope.launch {
            try {
                val ctx = getApplication<Application>()
                val partes = mutableListOf<String>()
                c.texto?.let { partes += it }
                for (uri in c.uris.take(Compartir.PAGINAS_MAX)) {
                    val mime = ctx.contentResolver.getType(uri) ?: c.tipo
                    partes += withContext(Dispatchers.IO) {
                        if (Compartir.esPdf(mime, uri.lastPathSegment)) textoDePdf(ctx, uri) else textoDeImagen(ctx, uri)
                    }
                }
                hoja = Compartir.esHoja(c.uris.size)
                val texto = Compartir.juntar(partes)
                if (texto.isBlank()) {
                    _e.value = EstadoCompartido(leyendo = false, error = tx("No veo ninguna parada en lo compartido."))
                    return@launch
                }
                val r = repo.pegar(texto, hoja, pais, confirmar = false)
                _e.value = EstadoCompartido(leyendo = false, filas = r.filas, texto = texto)
            } catch (e: ErrorApi) {
                _e.value = EstadoCompartido(leyendo = false, error = if (e.sinRed) tx("Sin conexión: para meter paradas nuevas hace falta red.") else e.message ?: tx("No se ha podido"))
            } catch (e: Exception) {                      // un fichero que no se puede abrir, un PDF roto…
                _e.value = EstadoCompartido(leyendo = false, error = tx("No se ha podido leer lo compartido."))
            }
        }
    }

    fun anadir() {
        val e = _e.value
        if (e.anadiendo || e.leyendo || e.filas.isEmpty()) return
        _e.value = e.copy(anadiendo = true)
        viewModelScope.launch {
            try {
                val r = repo.pegar(e.texto, hoja, pais, confirmar = true)
                _e.value = _e.value.copy(anadiendo = false, hecho = r.creados to r.repetidos)
            } catch (ex: ErrorApi) {
                _e.value = _e.value.copy(anadiendo = false, error = if (ex.sinRed) tx("Sin conexión: para meter paradas nuevas hace falta red.") else ex.message ?: tx("No se ha podido"))
            }
        }
    }

    private suspend fun textoDeImagen(ctx: Context, uri: Uri): String {
        val bmp = bitmapDe(ctx, uri) ?: return ""
        return runCatching { ocr.process(InputImage.fromBitmap(bmp, 0)).await().text }.getOrDefault("")
    }

    /** El PDF, página a página, pintado a 1600 px de ancho y leído como una foto. Al caché primero: PdfRenderer
     *  necesita un fichero de verdad y lo compartido puede venir por una tubería. */
    private suspend fun textoDePdf(ctx: Context, uri: Uri): String {
        val f = File(ctx.cacheDir, "compartido-${System.currentTimeMillis()}.pdf")
        try {
            ctx.contentResolver.openInputStream(uri)?.use { entrada -> f.outputStream().use { entrada.copyTo(it) } } ?: return ""
            val paginas = mutableListOf<String>()
            ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
                PdfRenderer(pfd).use { r ->
                    for (i in 0 until minOf(r.pageCount, Compartir.PAGINAS_MAX)) {
                        r.openPage(i).use { pg ->
                            val esc = 1600f / pg.width
                            val bmp = Bitmap.createBitmap((pg.width * esc).toInt(), (pg.height * esc).toInt(), Bitmap.Config.ARGB_8888)
                            bmp.eraseColor(Color.WHITE)
                            pg.render(bmp, null, Matrix().apply { setScale(esc, esc) }, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                            paginas += runCatching { ocr.process(InputImage.fromBitmap(bmp, 0)).await().text }.getOrDefault("")
                        }
                    }
                }
            }
            return Compartir.juntar(paginas)
        } finally {
            f.delete()
        }
    }

    override fun onCleared() { ocr.close() }
}

/** La foto o la captura, con su giro del EXIF y a 2000 px como mucho: lo que el lector de texto necesita. */
private fun bitmapDe(ctx: Context, uri: Uri): Bitmap? = runCatching {
    val opc = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    ctx.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opc) }
    var muestra = 1
    while (maxOf(opc.outWidth, opc.outHeight) / muestra > 2000) muestra *= 2
    val leida = ctx.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = muestra }) } ?: return null
    val grados = when (ctx.contentResolver.openInputStream(uri)?.use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
    }
    if (grados == 0f) leida else Bitmap.createBitmap(leida, 0, 0, leida.width, leida.height, Matrix().apply { postRotate(grados) }, true)
}.getOrNull()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompartidoPantalla(datos: Compartido, pais: String, alCerrar: (creadas: Int?) -> Unit) {
    val vm: CompartidoVM = viewModel()
    val e by vm.estado.collectAsState()
    LaunchedEffect(datos) { vm.leer(datos, pais) }
    LaunchedEffect(e.hecho) { e.hecho?.let { alCerrar(it.first) } }
    BackHandler { alCerrar(null) }
    val n = e.filas.size
    val error = e.error
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(tx("Lo que has compartido")) },
                navigationIcon = { IconButton(onClick = { alCerrar(null) }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = tx("Cerrar")) } },
            )
        },
        bottomBar = {
            Surface(tonalElevation = 2.dp) {
                Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp).navigationBarsPadding()) {
                    Button(onClick = { vm.anadir() }, enabled = n > 0 && !e.anadiendo && !e.leyendo, modifier = Modifier.fillMaxWidth().height(54.dp)) {
                        if (e.anadiendo) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Icon(Icons.AutoMirrored.Filled.PlaylistAdd, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (n == 1) tx("Añadir 1 parada") else tx("Añadir {n} paradas", "n" to n))
                    }
                    TextButton(onClick = { alCerrar(null) }, modifier = Modifier.fillMaxWidth()) { Text(tx("Cancelar")) }
                }
            }
        },
        contentWindowInsets = WindowInsets(0),
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize().padding(horizontal = 16.dp)) {
            when {
                e.leyendo -> Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 24.dp)) {
                    CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(12.dp))
                    Text(tx("Leyendo lo compartido…"))
                }
                error != null -> Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 24.dp))
                else -> {
                    Text(if (n == 1) tx("1 parada en lo compartido") else tx("{n} paradas en lo compartido", "n" to n),
                        style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
                    Text(tx("Comprueba lo que ha leído antes de añadirlo; lo que falte lo puedes meter después a mano."),
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(8.dp))
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 16.dp)) {
                        itemsIndexed(e.filas) { i, f ->
                            Surface(shape = MaterialTheme.shapes.medium, color = MaterialTheme.colorScheme.surfaceContainer, modifier = Modifier.fillMaxWidth()) {
                                Row(Modifier.padding(12.dp)) {
                                    Text("${i + 1}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.width(28.dp))
                                    Column {
                                        if (f.cliente.isNotBlank()) Text(f.cliente, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                                        Text(f.direccion, style = MaterialTheme.typography.bodyMedium)
                                        val extra = listOfNotNull(f.telefono.takeIf { it.isNotBlank() }, f.codigo.takeIf { it.isNotBlank() }).joinToString(" · ")
                                        if (extra.isNotBlank()) Text(extra, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
