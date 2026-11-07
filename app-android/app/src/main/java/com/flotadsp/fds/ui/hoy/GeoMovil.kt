package com.flotadsp.fds.ui.hoy

import android.content.Context
import android.location.Address
import android.location.Geocoder
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.ui.Idioma
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale
import kotlin.coroutines.resume

/* EL GEOCODIFICADOR DEL MÓVIL (02-11-2026): android.location.Geocoder, que en casi todos los Android es el de Google y
   encuentra las calles en gallego o en catalán, con abreviaturas o con faltas, que el servidor no sabe situar. Sin
   clave, sin coste y sin permisos; necesita red. Solo sale la DIRECCIÓN (nunca el cliente ni el teléfono). Las reglas
   para fiarse de lo que contesta están en Situar.aceptar, probadas sin Android (SituarTest). */
object GeoMovil {
    /** Lo que se espera al geocodificador antes de darlo por perdido. */
    private const val ESPERA_MS = 6000L

    /** ¿Tiene este móvil geocodificador? (Sin los servicios de Google, a veces no.) */
    fun hay(): Boolean = runCatching { Geocoder.isPresent() }.getOrDefault(false)

    /** ¿Hay red? Sin ella el geocodificador no contesta y solo se haría esperar a la persona. */
    fun hayRed(ctx: Context): Boolean = runCatching {
        val cm = ctx.getSystemService(ConnectivityManager::class.java)
        cm?.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }.getOrDefault(true)

    /** Lo que dice el móvil de una parada: la mejor respuesta aceptable con su precisión, que no la encuentra, o que no
     *  contesta (sin red o sin geocodificador: entonces se puede volver a probar más tarde). */
    sealed interface Respuesta {
        data class Situada(val r: ResultadoMovil, val precision: String) : Respuesta
        data object NoEncontrada : Respuesta
        data object SinRespuesta : Respuesta
    }

    /** El nombre del país en el idioma de la app («España»), para la consulta; vacío si el código no vale. */
    fun nombrePais(pais: String): String =
        runCatching { Locale.Builder().setRegion(pais.uppercase(Locale.ROOT)).build().getDisplayCountry(Idioma.locale) }.getOrDefault("")

    /** Las direcciones que da el móvil para `consulta`. Con `cerca`, primero dentro de una caja de unos 40 km a su
     *  alrededor («Rúa Real 5» hay en cien pueblos) y, si ahí no hay nada, en todas partes. null si no hay
     *  geocodificador o no contesta (sin red). */
    suspend fun buscar(ctx: Context, consulta: String, cerca: Punto? = null, max: Int = 5): List<ResultadoMovil>? {
        if (consulta.isBlank() || !hay() || !hayRed(ctx)) return null
        val g = Geocoder(ctx, Idioma.locale)
        if (cerca != null) {
            val caja = doubleArrayOf((cerca.lat - 0.35).coerceIn(-90.0, 90.0), (cerca.lng - 0.45).coerceIn(-180.0, 180.0),
                (cerca.lat + 0.35).coerceIn(-90.0, 90.0), (cerca.lng + 0.45).coerceIn(-180.0, 180.0))
            // Sin respuesta en la caja, tampoco la habrá fuera: no se hace esperar otra vez.
            val enCaja = pedir(g, consulta, max, caja) ?: return null
            if (enCaja.isNotEmpty()) return enCaja.mapNotNull(::resultado)
        }
        return pedir(g, consulta, max, null)?.mapNotNull(::resultado)
    }

    /** La mejor respuesta aceptable del móvil para una parada (Situar.aceptar), con su precisión. */
    suspend fun paraParada(ctx: Context, p: Parada, pais: String, cerca: List<Punto>, dondeReparte: List<Punto>): Respuesta {
        val q = Situar.consulta(p.direccion, p.cp, p.localidad, nombrePais(pais))
        if (q.length < 6) return Respuesta.NoEncontrada
        val rs = buscar(ctx, q, cerca.firstOrNull() ?: dondeReparte.firstOrNull()) ?: return Respuesta.SinRespuesta
        return Situar.mejor(rs, pais, p.direccion, p.cp, p.localidad, cerca, dondeReparte)?.let { (r, precision) -> Respuesta.Situada(r, precision) }
            ?: Respuesta.NoEncontrada
    }

    /** La calle y el número de un punto (lo que hay debajo de la chincheta de «Situar la parada»), o null. */
    suspend fun inverso(ctx: Context, lat: Double, lng: Double): String? {
        if (!hay() || !hayRed(ctx)) return null
        val g = Geocoder(ctx, Idioma.locale)
        val l = withTimeoutOrNull(ESPERA_MS) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                suspendCancellableCoroutine<List<Address>?> { c ->
                    val oyente = object : Geocoder.GeocodeListener {
                        override fun onGeocode(direcciones: MutableList<Address>) { if (c.isActive) c.resume(direcciones) }
                        override fun onError(mensaje: String?) { if (c.isActive) c.resume(null) }
                    }
                    runCatching { g.getFromLocation(lat, lng, 1, oyente) }.onFailure { if (c.isActive) c.resume(null) }
                }
            } else conTope {
                @Suppress("DEPRECATION")
                val r = g.getFromLocation(lat, lng, 1)
                r
            }
        }
        val a = l?.firstOrNull() ?: return null
        val calle = listOf(a.thoroughfare.orEmpty(), a.subThoroughfare.orEmpty()).filter { it.isNotBlank() }.joinToString(" ")
        return calle.ifBlank { runCatching { a.getAddressLine(0) }.getOrNull() }?.takeIf { it.isNotBlank() }
    }

    /** Una búsqueda: en Android 13 o más, con el aviso de vuelta (sin bloquear); antes, la llamada que espera, aparte
     *  y con un tope de verdad (conTope). Con un tope de espera: sin red, null. */
    private suspend fun pedir(g: Geocoder, q: String, max: Int, caja: DoubleArray?): List<Address>? = withTimeoutOrNull(ESPERA_MS) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            suspendCancellableCoroutine<List<Address>?> { c ->
                val oyente = object : Geocoder.GeocodeListener {
                    override fun onGeocode(direcciones: MutableList<Address>) { if (c.isActive) c.resume(direcciones) }
                    override fun onError(mensaje: String?) { if (c.isActive) c.resume(null) }
                }
                runCatching {
                    if (caja != null) g.getFromLocationName(q, max, caja[0], caja[1], caja[2], caja[3], oyente)
                    else g.getFromLocationName(q, max, oyente)
                }.onFailure { if (c.isActive) c.resume(null) }
            }
        } else conTope {
            @Suppress("DEPRECATION")
            val r = if (caja != null) g.getFromLocationName(q, max, caja[0], caja[1], caja[2], caja[3]) else g.getFromLocationName(q, max)
            r
        }
    }

    /** La llamada que espera (Android 12 o menos) con un tope de verdad (02-11-2026, revisión A6): withTimeoutOrNull no
     *  corta una llamada bloqueante (withContext espera a que acabe, y el Geocoder puede tardar lo que quiera), y la
     *  píldora «Buscando la dirección…» y el «Navegar» apagado seguían sin fin. Se lanza aparte y solo se espera hasta
     *  `tope`; lo que conteste después se tira. Lo que falle (sin red, IOException), null. */
    internal suspend fun <T> conTope(tope: Long = ESPERA_MS, llamada: () -> T?): T? {
        val d = CoroutineScope(Dispatchers.IO).async { runCatching { llamada() }.getOrNull() }
        try {
            return withTimeoutOrNull(tope) { d.await() }
        } finally {
            d.cancel()          // ya acabada, no hace nada; si no, que no se espere a nadie
        }
    }

    /** La población, nunca la provincia (03-11-2026, visto en el emulador): sin `locality`, antes iba `subAdminArea`, y
     *  con Oleiros se guardó «A Coruña» con el CP 15179. Ahora, lo que va detrás del CP en la línea, o nada
     *  (Situar.localidadDe). */
    private fun resultado(a: Address): ResultadoMovil? {
        if (!a.hasLatitude() || !a.hasLongitude()) return null
        val linea = runCatching { a.getAddressLine(0) }.getOrNull().orEmpty()
        val cp = a.postalCode.orEmpty()
        return ResultadoMovil(
            lat = a.latitude, lng = a.longitude, pais = a.countryCode.orEmpty(), calle = a.thoroughfare.orEmpty(),
            numero = a.subThoroughfare.orEmpty(), cp = cp, localidad = Situar.localidadDe(a.locality, linea, cp),
            texto = linea,
        )
    }
}
