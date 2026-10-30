package com.flotadsp.fds.data

import com.flotadsp.fds.ui.tx
import com.flotadsp.fds.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

val JSON = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    explicitNulls = false
    isLenient = true
}

/** Un fallo del servidor con su mensaje para la persona (el `detail` de FastAPI), o sin red (`sinRed`). */
class ErrorApi(val estado: Int, mensaje: String, val sinRed: Boolean = false) : Exception(mensaje) {
    /** Merece volver a intentarlo más tarde, en orden: sin red, o el servidor caído o saturado (5xx, 408, 429).
     *  Hasta el 29-10-2026 un 500 del servidor tiraba la entrega guardada en el móvil sin avisar. */
    val reintentable: Boolean get() = sinRed || estado == 408 || estado == 429 || estado in 500..599
}

/** Lo que manda el servidor, como modelo de la app. Si no encaja (un servidor más nuevo que la app), un ErrorApi que
 *  la pantalla enseña, no una excepción sin capturar que cierra la app. */
inline fun <reified T> leer(el: JsonElement): T = try {
    JSON.decodeFromJsonElement<T>(el)
} catch (_: SerializationException) {
    throw ErrorApi(0, tx("El servidor ha contestado algo que esta versión no entiende. Actualiza la app."))
}

private val TIPO_JSON = "application/json; charset=utf-8".toMediaType()

class Api(
    private val token: () -> String?,
    private val alCaducar: () -> Unit,
    base: String = BuildConfig.API_URL,
    cliente: OkHttpClient? = null,
) {
    private val base: HttpUrl = base.toHttpUrl()
    val http: OkHttpClient = cliente ?: OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    /** Las subidas de fotos (inspección, cuentakilómetros, etiqueta) esperan más: la lectura con IA del cuadro hace
     *  dos pasadas y puede tardar más de 30 s. Con el tiempo de las llamadas normales el móvil cortaba antes de la
     *  respuesta, la app decía «sin conexión» y el conductor se quedaba sin poder poner los km (29-10-2026). */
    private val httpLargo: OkHttpClient by lazy {
        http.newBuilder().readTimeout(120, TimeUnit.SECONDS).writeTimeout(120, TimeUnit.SECONDS).build()
    }

    fun url(ruta: String, params: Map<String, String> = emptyMap()): HttpUrl {
        val b = base.newBuilder()
        ruta.trim('/').split('/').filter { it.isNotEmpty() }.forEach { b.addPathSegment(it) }
        params.forEach { (k, v) -> b.addQueryParameter(k, v) }
        return b.build()
    }

    suspend fun get(ruta: String, params: Map<String, String> = emptyMap()): JsonElement =
        llamar(Request.Builder().url(url(ruta, params)).get())

    suspend fun post(ruta: String, cuerpo: JsonElement = JsonObject(emptyMap())): JsonElement =
        llamar(Request.Builder().url(url(ruta)).post(cuerpo.toString().toRequestBody(TIPO_JSON)))

    suspend fun put(ruta: String, cuerpo: JsonElement): JsonElement =
        llamar(Request.Builder().url(url(ruta)).put(cuerpo.toString().toRequestBody(TIPO_JSON)))

    suspend fun postMultipart(
        ruta: String,
        campos: Map<String, String>,
        archivos: List<ArchivoMultipart>,
    ): JsonElement {
        val cuerpo = MultipartBody.Builder().setType(MultipartBody.FORM).apply {
            campos.forEach { (k, v) -> addFormDataPart(k, v) }
            archivos.forEach { f ->
                addFormDataPart(f.campo, f.nombre, f.bytes.toRequestBody("image/jpeg".toMediaType()))
            }
        }.build()
        return llamar(Request.Builder().url(url(ruta)).post(cuerpo), httpLargo)
    }

    private suspend fun llamar(b: Request.Builder, cliente: OkHttpClient = http): JsonElement = withContext(Dispatchers.IO) {
        token()?.let { b.header("Authorization", "Bearer $it") }
        b.header("Accept", "application/json")
        b.header("X-FDS-App", "android-${BuildConfig.VERSION_NAME}")
        // El sistema sale del User-Agent en el servidor (analítica: cuántos vienen de Android); el de OkHttp no lo dice.
        b.header("User-Agent", "FDS-Android/${BuildConfig.VERSION_NAME} (Android ${android.os.Build.VERSION.RELEASE})")
        val r = try {
            cliente.newCall(b.build()).ejecutar()
        } catch (e: IOException) {
            throw ErrorApi(0, tx("Sin conexión. Se intentará otra vez solo."), sinRed = true)
        }
        r.use { resp ->
            val texto = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                if (resp.code == 401 && token() != null) alCaducar()
                throw ErrorApi(resp.code, mensajeDe(texto, resp.code), sinRed = resp.code in listOf(502, 503, 504))
            }
            if (texto.isBlank()) return@use JsonObject(emptyMap())
            // Una wifi que pide registrarse (almacenes, bares) contesta con su página en HTML y un 200: es como no
            // tener red (la entrega queda guardada y sale sola), no un motivo para que la app se cierre.
            try { JSON.parseToJsonElement(texto) } catch (_: SerializationException) {
                throw ErrorApi(resp.code, tx("Esta red no deja llegar al servidor (¿una wifi que pide registrarse?)."), sinRed = true)
            }
        }
    }

    companion object {
        /** El `detail` de FastAPI: un texto, o una lista de errores de validación con su `msg`. */
        fun mensajeDe(texto: String, codigo: Int): String {
            val d = runCatching { JSON.parseToJsonElement(texto).jsonObject["detail"] }.getOrNull()
            val m = when (d) {
                is JsonPrimitive -> d.contentOrNull
                is JsonArray -> d.mapNotNull { runCatching { it.jsonObject["msg"]?.jsonPrimitive?.contentOrNull }.getOrNull() }
                    .joinToString(". ").ifBlank { null }
                else -> null
            }
            return m ?: when (codigo) {
                401 -> tx("Tu sesión ha caducado: entra otra vez.")
                403 -> tx("No tienes permiso para esto.")
                404 -> tx("Ya no existe.")
                in 500..599 -> tx("El servidor no contesta ahora. Inténtalo en un momento.")
                else -> tx("No se ha podido hacer ({n}).", "n" to codigo)
            }
        }
    }
}

data class ArchivoMultipart(val campo: String, val nombre: String, val bytes: ByteArray)

private suspend fun Call.ejecutar(): Response = suspendCancellableCoroutine { c ->
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) = c.resume(response)
        override fun onFailure(call: Call, e: IOException) = c.resumeWithException(e)
    })
    c.invokeOnCancellation { runCatching { cancel() } }
}
