package com.flotadsp.fds.ui.escaner

import com.flotadsp.fds.ui.tx
import android.app.Application
import android.graphics.Bitmap
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.etiqueta.Lectura
import com.flotadsp.fds.etiqueta.LectorEtiqueta
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** El escáner, de vuelta de la ficha donde se revisó una etiqueta: si se guardó la parada o no. */
data class VueltaDeRevisar(val guardada: Boolean)

/** Lo que pasó con la última etiqueta, para enseñarlo abajo (y sonar o vibrar). */
data class Resultado(val tipo: String, val texto: String, val n: Long = System.nanoTime())

data class EstadoEscaner(
    val anadidas: Int = 0,
    val yaEstaban: Int = 0,
    val ultimo: Resultado? = null,
    val trabajando: Boolean = false,
    /** Etiqueta sin la dirección completa en sus códigos: se abre la ficha para revisarla (la foto ya leída). */
    val revisar: Lectura? = null,
)

/* ESCANEAR SEGUIDO, COMO UN LECTOR DE ALMACÉN (25-10-2026). La cámara no se cierra: se juntan los códigos de una
   etiqueta (la barra y los 2D no siempre salen en el mismo fotograma), y:
   · si el paquete ya está en la ruta → «Ya estaba: parada N»;
   · si sus códigos traen la dirección completa (DPD/SEUR, GLS, GS1, QR) → la parada entra sola;
   · si no → se lee el TEXTO de la etiqueta en el mismo fotograma (ML Kit, en el móvil) y se abre la ficha para
     revisarla: es un OCR, no se guarda nada sin que lo vea la persona.
   La misma etiqueta delante de la cámara no se cuenta dos veces. */
class EscanerVM(app: Application) : AndroidViewModel(app) {
    private val repo = (app as FdsApp).repo
    private val _e = MutableStateFlow(EstadoEscaner())
    val estado: StateFlow<EstadoEscaner> = _e
    private val ocr = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private val vistos = LinkedHashMap<String, Long>()     // código ya tratado → la última vez que la cámara lo vio
    private val contados = HashMap<String, Long>()         // parada ya contada en este escaneo → cuándo
    /** En pausa desde que se manda una etiqueta a revisar hasta que se vuelve al escáner. Sin esto, una lectura que
     *  llegaba mientras se abría la ficha (la cámara tarda un segundo en cerrarse) dejaba OTRA revisión pendiente,
     *  y al volver de la ficha se abría sola (visto en el emulador: un segundo OCR con la ficha ya abierta). */
    private var pausado = false
    var pais: String = "es"

    init {
        // El OCR tarda en arrancar la primera vez (25 s en el emulador, sin GPU; bastante menos en un móvil): se
        // arranca al abrir el escáner con una imagen en blanco, para que la primera etiqueta sin dirección no espere.
        viewModelScope.launch {
            runCatching { ocr.process(InputImage.fromBitmap(Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888), 0)).await() }
        }
    }

    /** Los contadores son de PAQUETES, no de lecturas: la misma parada no suma dos veces. Si vuelve enseguida (la
     *  otra mitad de la misma etiqueta), ni se avisa; si se vuelve a pasar más tarde, se avisa sin sumar. */
    private fun yaContada(id: String): Long? = contados[id]?.let { System.currentTimeMillis() - it }

    /** ¿Algo de esto es nuevo? Un código ya tratado no cuenta mientras siga delante de la cámara; se olvida cuando
     *  lleva 2,5 s sin verse. Antes se olvidaba a los 6 s de tratarlo y, con la etiqueta quieta delante, sumaba un
     *  «ya estaba» cada 6 s (visto en el emulador: «1 añadidas · 2 ya estaban» con un solo paquete). */
    fun hayNuevo(codigos: Collection<String>): Boolean {
        val ahora = System.currentTimeMillis()
        vistos.entries.removeAll { ahora - it.value > 2500 }
        codigos.forEach { if (it in vistos) vistos[it] = ahora }
        return codigos.any { it !in vistos }
    }

    fun tratar(codigos: List<String>, fotograma: Bitmap?, giro: Int) {
        if (pausado || _e.value.trabajando || _e.value.revisar != null || !hayNuevo(codigos)) return
        val ahora = System.currentTimeMillis()
        codigos.forEach { vistos[it] = ahora }
        _e.value = _e.value.copy(trabajando = true)
        viewModelScope.launch {
            val l = LectorEtiqueta.datosDeCodigos(codigos, pais)
            try {
                val esc = repo.escanear(l.codigos.ifEmpty { codigos })
                if (esc.encontrado) {
                    val p = esc.pedido
                    val hace = p?.id?.let { yaContada(it) }
                    if (hace != null && hace < 3000) return@launch
                    if (p != null && hace == null) contados[p.id] = System.currentTimeMillis()
                    _e.value = _e.value.copy(yaEstaban = _e.value.yaEstaban + (if (hace == null) 1 else 0), ultimo = Resultado("ya",
                        tx("Ya estaba") + (p?.orden?.let { ": " + tx("parada") + " $it" } ?: "") + " · ${p?.cliente?.ifBlank { p.direccion } ?: ""}"))
                } else if (l.completa) {
                    val nueva = repo.nuevaParada(cuerpo(l))
                    contados[nueva.id] = System.currentTimeMillis()
                    _e.value = _e.value.copy(anadidas = _e.value.anadidas + 1, ultimo = Resultado("nueva",
                        tx("Añadida: {d}", "d" to listOf(l.direccion, l.localidad).filter { it.isNotBlank() }.joinToString(", "))))
                } else {
                    // Lo que el código no dice, de la foto de la etiqueta (sin pisar lo que sí venía en el código).
                    val leido = fotograma?.let { runCatching { ocr.process(InputImage.fromBitmap(it, giro)).await().text }.getOrNull() }
                    val t = leido?.let { LectorEtiqueta.leerTexto(it, pais) } ?: Lectura()
                    val junta = l.copy(
                        cliente = l.cliente.ifBlank { t.cliente }, telefono = l.telefono.ifBlank { t.telefono },
                        direccion = l.direccion.ifBlank { t.direccion }, cp = l.cp.ifBlank { t.cp },
                        localidad = l.localidad.ifBlank { t.localidad }, codigo = l.codigo.ifBlank { t.codigo },
                    )
                    // De los 2D que no se entienden, solo su forma (sin un dato de nadie): para aprender a leerlos.
                    val largos = codigos.filter { it.length >= 20 && !LectorEtiqueta.esCodigoSimple(it) }.map { LectorEtiqueta.forma(it) }
                    if (largos.isNotEmpty()) launch { repo.formasDeCodigo(largos, pais) }
                    _e.value = _e.value.copy(revisar = junta)
                }
            } catch (e: ErrorApi) {
                codigos.forEach { vistos.remove(it) }      // que se pueda volver a intentar
                _e.value = _e.value.copy(ultimo = Resultado("error",
                    if (e.sinRed) tx("Sin conexión: para meter paradas nuevas hace falta red.") else e.message ?: tx("No se ha podido")))
            } finally {
                _e.value = _e.value.copy(trabajando = false)
            }
        }
    }

    fun revisada() { pausado = true; _e.value = _e.value.copy(revisar = null) }

    /** Un escaneo nuevo (desde «Hoy»): sin lo del anterior. El ViewModel vive con la app, no con la pantalla. */
    fun empezar() {
        vistos.clear(); contados.clear(); pausado = false
        _e.value = EstadoEscaner()
    }

    /** De vuelta de la ficha de revisar: lo leído cuenta como «aún delante» (si se canceló con la etiqueta delante,
     *  no se vuelve a abrir la ficha sola) y, si se guardó, suma una añadida. */
    fun reanudar(guardada: Boolean) {
        val ahora = System.currentTimeMillis()
        vistos.replaceAll { _, _ -> ahora }
        pausado = false
        _e.value = _e.value.copy(revisar = null, trabajando = false)
        if (guardada) _e.value = _e.value.copy(anadidas = _e.value.anadidas + 1, ultimo = Resultado("nueva", tx("Añadida a tu ruta.")))
    }

    override fun onCleared() { ocr.close() }

    companion object {
        /** La parada para el servidor, como la manda la web: la dirección junta con el CP y la población. */
        fun cuerpo(l: Lectura): JsonObject = JsonObject(buildMap<String, JsonElement> {
            put("direccion", JsonPrimitive(listOf(l.direccion, l.cp, l.localidad).filter { it.isNotBlank() }.joinToString(", ")))
            if (l.cp.isNotBlank()) put("cp", JsonPrimitive(l.cp))
            if (l.localidad.isNotBlank()) put("localidad", JsonPrimitive(l.localidad))
            if (l.cliente.isNotBlank()) put("cliente", JsonPrimitive(l.cliente))
            if (l.telefono.isNotBlank()) put("telefono", JsonPrimitive(l.telefono))
            if (l.codigo.isNotBlank()) put("codigo", JsonPrimitive(l.codigo))
            if (l.codigos.isNotEmpty()) put("codigos", JsonArray(l.codigos.map { JsonPrimitive(it) }))
            if (l.lat != null && l.lng != null) { put("lat", JsonPrimitive(l.lat)); put("lng", JsonPrimitive(l.lng)) }
            put("bultos", JsonPrimitive(1))
        })
    }
}
