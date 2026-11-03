package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.ui.tx
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.EntregaIa
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.Incidencias
import com.flotadsp.fds.data.Invitacion
import com.flotadsp.fds.data.JSON
import com.flotadsp.fds.data.MiRuta
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.data.Repositorio
import com.flotadsp.fds.data.Zbe
import com.flotadsp.fds.ui.Acciones
import com.flotadsp.fds.ui.Voz
import com.flotadsp.fds.ui.parada.Sugerencia
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

data class EstadoRuta(
    val ruta: MiRuta? = null,
    /** La ruta que se ve es la guardada en el móvil (sin red): de cuándo es. */
    val guardadaEn: Long? = null,
    val cargando: Boolean = true,
    val refrescando: Boolean = false,
    val error: String? = null,
    val ocupado: String = "",
    /** El camino por las calles de lo que queda (para el mapa); vacío = tramos rectos. */
    val trazado: List<Pair<Double, Double>> = emptyList(),
    /** Lo que dice la DGT cerca de la ruta (30-10-2026): las ZBE con la ruta (los chips), las incidencias al abrir el mapa. */
    val incidencias: Incidencias? = null,
    val zbe: Zbe? = null,
    /** LA INVITACIÓN TRAS LA PRIMERA ENTREGA (02-11-2026): el código de «Invita y gana» y la promoción, cargados una
     *  vez (Repositorio.invitacion); null hasta tenerlos (sin red, la tarjeta no sale). */
    val invitacion: Invitacion? = null,
) {
    val paradas get() = ruta?.pedidos.orEmpty()
    val pendientes get() = paradas.filter { it.pendiente }.sortedWith(compareBy<Parada>({ it.orden ?: Int.MAX_VALUE }, { it.cliente }))
    val hechas get() = paradas.filter { !it.pendiente }.sortedByDescending { it.cerradoEn ?: "" }
    val entregadas get() = paradas.count { it.estado == "entregado" }
    /** Las entregas de verdad: sin las paradas de ejemplo («Verlo en acción»), que no cuentan para invitar ni para el bono. */
    val entregadasReales get() = paradas.count { it.estado == "entregado" && !it.ejemplo }
}

/** Un aviso para la persona (abajo, como en cualquier app), con una acción opcional («Deshacer»). */
data class Aviso(val texto: String, val accion: String? = null, val alPulsar: (() -> Unit)? = null)

/** LA ENTREGA VERIFICADA (01-11-2026): la IA pide mirar la foto de entrega de esta parada; `metodo`, cómo cobró, para
 *  volver a mandar «entregado» con la foto nueva. */
data class Revisar(val parada: Parada, val ia: EntregaIa, val metodo: String?)

class RutaVM(app: Application) : AndroidViewModel(app) {
    private val repo = (app as FdsApp).repo
    private val _e = MutableStateFlow(EstadoRuta())
    val estado: StateFlow<EstadoRuta> = _e
    private val _avisos = Channel<Aviso>(Channel.BUFFERED)
    val avisos = _avisos.receiveAsFlow()
    val pendientesDeEnvio = repo.pendientes
    private val _revisar = MutableStateFlow<Revisar?>(null)
    /** LA ENTREGA VERIFICADA (01-11-2026): la parada cuya foto pide mirar la IA (un diálogo en Hoy), o null. */
    val revisar: StateFlow<Revisar?> = _revisar
    fun revisado() { _revisar.value = null }
    /** Desde la ficha de una parada entregada con aviso: volver a preguntar. */
    fun pedirRevisar(p: Parada) { p.entregaIa?.let { _revisar.value = Revisar(p, it, p.cobradoMetodo) } }
    /** La foto nueva: la parada sigue entregada; el servidor la vuelve a mirar. */
    fun repetirFoto(r: Revisar, foto: String) {
        _revisar.value = null
        entregar(r.parada, buildJsonObject { put("foto", foto); if (r.parada.porCobrar) put("metodo", r.metodo ?: "pagado") })
    }
    private val cuenta = (app as FdsApp).cuenta
    /** Cuándo se pidió la ruta por última vez y cuántos cambios de estado van de camino (para refrescarSiToca). */
    private var cargadaEn = 0L
    private var mandando = 0
    private var refrescoPendiente = false      // un aviso llegó con algo en vuelo: se refresca al acabar
    // EL PRIMER PAQUETE BIEN SITUADO (02-11-2026): lo probado con el móvil en esta sesión (Situar.clave), lo que se está
    // buscando ahora (una búsqueda por parada: quien llega con una en marcha la espera, EnVuelo), lo añadido sin punto
    // que quizá aún no está en la ruta cargada, y si la pasada de fondo va ya.
    private val probadas = HashSet<String>()
    private val enVuelo = EnVuelo<String, DelMovil>(viewModelScope)
    private val recienSinSituar = ArrayDeque<Parada>()
    private var fondoEnMarcha = false

    init {
        // Al momento, la ruta guardada en el móvil; después, la del servidor.
        repo.rutaGuardada()?.let { (r, en) -> _e.value = EstadoRuta(ruta = r, guardadaEn = en, cargando = false) }
        cargar()
        viewModelScope.launch { repo.renovarSiToca() }
        viewModelScope.launch { _e.collect { briefing(it) } }
        // Un aviso al móvil que habla de la ruta (lo que contesta el cliente en su enlace): se vuelve a leer al momento,
        // salvo con un cambio de estado en vuelo o la ruta ordenándose (la del servidor pisaría lo optimista y el
        // briefing repetiría la parada): entonces queda pendiente y sale al acabar, en marcar().
        viewModelScope.launch {
            repo.rutaCambio.collect { if (mandando == 0 && _e.value.ocupado.isEmpty()) refrescarSinRuido() else refrescoPendiente = true }
        }
        // OTRA CUENTA EN EL MISMO MÓVIL (01-11-2026, visto en el emulador): este ViewModel vive con la Activity y
        // sobrevive a cerrar sesión, así que quien entraba después veía la ruta de la cuenta anterior (o «Sin paradas»
        // si venía del portal) hasta tirar para refrescar. Al cerrar sesión se vacía; al entrar, se carga.
        viewModelScope.launch {
            cuenta.token.map { it != null }.distinctUntilChanged().drop(1).collect { dentro ->
                if (dentro) { _e.value = EstadoRuta(); cargar() } else _e.value = EstadoRuta()
            }
        }
        // EL PRIMER PAQUETE BIEN SITUADO (02-11-2026): lo que se acaba de añadir (escáner, ficha) y el servidor no ha
        // sabido situar se prueba con el móvil al momento, aunque aún no esté en la ruta que se ve.
        viewModelScope.launch { repo.sinSituar.collect { p -> recienSinSituar.removeAll { it.id == p.id }; recienSinSituar.addLast(p); situarEnFondo() } }
    }

    /* EL BRIEFING POR VOZ (01-11-2026), como la web: cada vez que cambia la siguiente parada (se hizo la anterior, o se
       acaba de ordenar) se dice en una frase lo que hay que saber (Briefing.texto). Nunca al abrir la app: la ruta ya
       se ve. Solo con la ruta ordenada y el ajuste «Briefing por voz» encendido. */
    private var briefingDe: String? = null
    private var briefingVisto = false
    private var briefingTrasOrdenar = false
    private fun briefing(e: EstadoRuta) {
        val r = e.ruta ?: return
        val sig = e.pendientes.firstOrNull()
        val antes = briefingDe
        val primera = !briefingVisto
        val trasOrdenar = briefingTrasOrdenar
        briefingDe = sig?.id; briefingVisto = true; briefingTrasOrdenar = false
        if (sig == null || r.ruta?.fin == null) return
        if (!trasOrdenar && (primera || antes == sig.id)) return
        if (cuenta.voz.value) Voz.decir(getApplication(), Briefing.texto(sig), cola = true)
    }

    fun avisar(t: String) { _avisos.trySend(Aviso(t)) }

    /** Una pantalla vista, para la analítica anónima (como la web): no bloquea ni falla. */
    fun vista(ruta: String) { viewModelScope.launch { repo.vista(ruta) } }

    fun cargar(tirando: Boolean = false) {
        cargadaEn = System.currentTimeMillis()
        viewModelScope.launch {
            if (tirando) _e.value = _e.value.copy(refrescando = true)
            try {
                repo.vaciarCola()
                repo.tomarRechazos().forEach { avisar(it) }
                val r = repo.miRuta()
                _e.value = _e.value.copy(ruta = r, guardadaEn = null, cargando = false, refrescando = false, error = null)
                if (!r.prueba && r.pedidos.any { it.pendiente }) { cargarZbe(); cargarIncidencias() }
                pedirInvitacion()
                situarEnFondo()
            } catch (e: ErrorApi) {
                _e.value = if (_e.value.ruta != null && e.sinRed) {
                    _e.value.copy(cargando = false, refrescando = false, guardadaEn = _e.value.guardadaEn ?: System.currentTimeMillis())
                } else _e.value.copy(cargando = false, refrescando = false, error = e.message)
                if (tirando && e.sinRed) avisar(tx("Sin conexión: sigues con la ruta guardada en el móvil."))
            }
        }
    }

    /* EL REGISTRO DEL INTENTO (30-10-2026): a qué hora se llamó o se escribió desde la parada (y se llegó, si lo
       dice la guía). Va con «Entregado» o «No entregado», y el cliente ve en su enlace que se llamó y se esperó:
       defiende al repartidor ante un «ausente» (docs/NECESIDADES-REPARTIDOR-30-10.md, 1.8). */
    private class Intento(var llegada: String? = null, var llamada: String? = null, var whatsapp: String? = null, var llamadas: Int = 0)
    private val intentos = mutableMapOf<String, Intento>()

    fun apuntar(p: Parada, que: String) {
        val i = intentos.getOrPut(p.id) { Intento() }
        val ahora = java.time.Instant.now().toString()
        when (que) {
            "llegada" -> i.llegada = ahora
            "llamada" -> { i.llamada = ahora; i.llamadas += 1 }
            "whatsapp" -> i.whatsapp = ahora
        }
    }

    private fun intentoDe(p: Parada): JsonObject? {
        val i = intentos[p.id] ?: return null
        val primero = listOfNotNull(i.llegada, i.llamada, i.whatsapp).minOrNull() ?: return null
        val espera = ((System.currentTimeMillis() - java.time.Instant.parse(primero).toEpochMilli()) / 1000).coerceIn(0, 3600)
        return buildJsonObject {
            i.llegada?.let { put("llegada", it) }; i.llamada?.let { put("llamada", it) }; i.whatsapp?.let { put("whatsapp", it) }
            put("espera_s", espera); put("llamadas", i.llamadas)
        }
    }

    /** Cambia el estado en pantalla al momento (como una app) y lo manda; sin red queda guardado. */
    private fun marcar(p: Parada, estado: String, cuerpo: JsonObject, texto: String, conDeshacer: Boolean) {
        val antes = _e.value.ruta ?: return
        _e.value = _e.value.copy(ruta = antes.copy(pedidos = antes.pedidos.map {
            if (it.id == p.id) it.copy(estado = estado, cerradoEn = java.time.Instant.now().toString()) else it
        }))
        viewModelScope.launch {
            mandando += 1
            try {
                val extras = buildMap<String, JsonElement> {
                    if (estado != "pendiente") intentoDe(p)?.let { put("intento", it) }
                    // LA PUERTA APRENDIDA (30-10-2026): la posición del móvil al entregar, con su precisión; el servidor
                    // la guarda si es precisa y cercana, y la próxima vez en esa dirección el pin es la puerta de verdad.
                    if (estado == "entregado") Acciones.posicionPrecisa(getApplication())?.let { (la, lo, prec) ->
                        put("posicion", buildJsonObject { put("lat", la); put("lng", lo); put("precision", prec) })
                    }
                }
                val respuesta = repo.cambiarEstado(p.id, estado, JsonObject(cuerpo + extras), p.cliente.ifBlank { p.direccion })
                val enviado = respuesta != null
                // LA ENTREGA VERIFICADA (01-11-2026): si la IA pide mirar la foto, se pregunta ahí mismo (nunca bloquea).
                if (estado == "entregado" && cuerpo.containsKey("foto")) respuesta?.get("entrega_ia")?.let { ia ->
                    runCatching { JSON.decodeFromJsonElement<EntregaIa>(ia) }.getOrNull()?.takeIf { it.nivel == "revisar" }?.let {
                        _revisar.value = Revisar(p, it, respuesta["cobrado_metodo"]?.jsonPrimitive?.contentOrNull)
                    }
                }
                if (estado != "pendiente") intentos.remove(p.id)
                val t = if (enviado) texto else "$texto " + tx("Sin cobertura: se envía solo al volver la red.")
                _avisos.send(if (conDeshacer) Aviso(t, "Deshacer") { deshacer(p) } else Aviso(t))
                if (enviado) refrescarSinRuido()
                // La tarjeta de invitar sale con la primera entrega: si al abrir no había red para el enlace, ahora sí.
                if (enviado && estado == "entregado") pedirInvitacion()
            } catch (e: ErrorApi) {
                _e.value = _e.value.copy(ruta = antes)
                _avisos.send(Aviso(e.message ?: tx("No se ha podido guardar")))
            } finally {
                mandando -= 1
                if (mandando == 0 && refrescoPendiente) { refrescoPendiente = false; refrescarSinRuido() }
            }
        }
    }

    fun entregar(p: Parada, cuerpo: JsonObject = JsonObject(emptyMap())) =
        marcar(p, "entregado", cuerpo, tx("Entregado: {n}.", "n" to p.cliente.ifBlank { p.direccion }), conDeshacer = true)

    fun noEntregado(p: Parada, motivo: String, nota: String) = marcar(
        p, "fallido", JsonObject(mapOf("motivo" to kotlinx.serialization.json.JsonPrimitive(motivo),
            "nota" to kotlinx.serialization.json.JsonPrimitive(nota))), tx("Marcado como no entregado."), conDeshacer = true)

    fun deshacer(p: Parada) = marcar(p, "pendiente", JsonObject(emptyMap()), tx("Vuelve a estar por entregar."), conDeshacer = false)

    /** EL CLIENTE AVISADO (01-11-2026): a quién se mandó ya el WhatsApp de «voy de camino» (mientras la app viva). */
    private val _avisados = MutableStateFlow<Set<String>>(emptySet())
    val avisados: StateFlow<Set<String>> = _avisados
    fun avisado(p: Parada) { _avisados.value = _avisados.value + p.id; apuntar(p, "whatsapp") }

    /** LA MEMORIA DE LA CALLE (01-11-2026): lo apuntado para la próxima vez en esa puerta; todo vacío la borra. */
    fun guardarMemoria(p: Parada, portal: String, dejar: String, acceso: String) {
        viewModelScope.launch {
            try {
                repo.memoria(p.id, portal, dejar, acceso)
                avisar(if (portal.isBlank() && dejar.isBlank() && acceso.isBlank()) tx("Borrado.") else tx("Guardado para la próxima vez en esta puerta."))
                refrescarSinRuido()
            } catch (e: ErrorApi) {
                avisar(e.message ?: tx("No se ha podido guardar"))
            }
        }
    }

    /** LA INVITACIÓN TRAS LA PRIMERA ENTREGA (02-11-2026): el enlace de «Invita y gana», solo para la cuenta de quien
     *  reparte por su cuenta (la de empresa no tiene /referidos) y una sola vez: el Repositorio lo guarda en memoria.
     *  Sin red, nada y sin aviso: la tarjeta no sale y se vuelve a pedir al cargar o al entregar. */
    private fun pedirInvitacion() {
        val r = _e.value.ruta ?: return
        if (!r.autonomo || r.prueba || _e.value.invitacion != null) return
        viewModelScope.launch {
            repo.invitacion()?.let { i -> if (_e.value.invitacion == null) _e.value = _e.value.copy(invitacion = i) }
        }
    }

    /** Lo que dice la DGT (30-10-2026): sin red o sin DGT, nada (no se avisa: es un extra del mapa). */
    fun cargarZbe() { viewModelScope.launch { runCatching { repo.zbe() }.onSuccess { _e.value = _e.value.copy(zbe = it) } } }
    fun cargarIncidencias() { viewModelScope.launch { runCatching { repo.incidencias() }.onSuccess { _e.value = _e.value.copy(incidencias = it) } } }

    /** Se dice que se está ordenando desde que se toca (antes incluso de tener la ubicación). */
    fun empezarAOrdenar(): Boolean {
        if (_e.value.ocupado.isNotEmpty()) return false
        _e.value = _e.value.copy(ocupado = "ordenar")
        return true
    }

    fun ordenar(lat: Double?, lng: Double?) {
        _e.value = _e.value.copy(ocupado = "ordenar")
        viewModelScope.launch {
            try {
                val r = repo.ordenar(lat, lng)
                val fin = r.ruta?.fin
                avisar(if (fin != null) tx("Ruta ordenada: {n} paradas, acabas ≈ {fin}.", "n" to r.ordenados, "fin" to fin) else tx("Ruta ordenada: {n} paradas.", "n" to r.ordenados))
                briefingTrasOrdenar = true
                _e.value = _e.value.copy(ruta = repo.miRuta(), guardadaEn = null)
            } catch (e: ErrorApi) {
                avisar(if (e.sinRed) tx("Sin conexión: para ordenar la ruta hace falta red.") else e.message ?: tx("No se ha podido ordenar"))
            } finally {
                _e.value = _e.value.copy(ocupado = "")
            }
        }
    }

    fun quitar(p: Parada) {
        viewModelScope.launch {
            try {
                repo.quitarParada(p.id)
                avisar(tx("Parada quitada de tu ruta."))
                refrescarSinRuido()
            } catch (e: ErrorApi) { avisar(e.message ?: tx("No se ha podido quitar")) }
        }
    }

    fun refrescarSinRuido() {
        cargadaEn = System.currentTimeMillis()
        viewModelScope.launch {
            runCatching { repo.miRuta() }.onSuccess { _e.value = _e.value.copy(ruta = it, guardadaEn = null, error = null); situarEnFondo() }
        }
    }

    /* EL PRIMER PAQUETE BIEN SITUADO (02-11-2026). Dani: «el primer paquete que escaneo no encuentra la dirección y
       tiene que ir por Maps». Lo que el servidor no sitúa se prueba con el geocodificador del móvil (GeoMovil, el de
       Google en casi todos): en segundo plano al cargar la ruta y al añadir una parada (de una en una, como mucho
       Situar.TOPE_FONDO cada vez, cada parada una sola vez por sesión con esa dirección, y nunca con un cambio de
       estado en vuelo, la ruta ordenándose o algo de esa parada esperando a salir), y al pulsar «Navegar». El PORTAL
       que el móvil acierta se guarda en el servidor (geo_origen «movil»); la calle sola no (revisión del 02-11-2026:
       el servidor la dejaría «manual», como la puerta), y lo que no encuentra se sitúa a mano (SituarPantalla). Lo
       que guardan está arriba, antes del init. */
    private fun paisRuta(): String = _e.value.ruta?.pais?.takeIf { it.isNotBlank() } ?: repo.paisDelMovil() ?: "es"

    /** La parada con su punto nuevo en la ruta que se ve, sin volver a pedirla (no pisa lo que va de camino); si aún no
     *  estaba (recién añadida), la ruta se vuelve a leer cuando no haya nada en vuelo. Con la dirección que «Es aquí»
     *  haya cambiado (03-11-2026: Situar.conPuntoDe). */
    private fun poner(p: Parada) {
        val r = _e.value.ruta ?: return
        if (r.pedidos.none { it.id == p.id }) { if (mandando == 0) refrescarSinRuido() else refrescoPendiente = true; return }
        _e.value = _e.value.copy(ruta = r.copy(pedidos = r.pedidos.map { if (it.id == p.id) Situar.conPuntoDe(it, p) else it }))
    }

    /** Lo que saca el móvil de una parada sin situar (02-11-2026). */
    sealed interface DelMovil {
        /** El portal (el número de la etiqueta, en esa calle y en ese sitio: Situar.aceptar), guardado y en la ruta. */
        data class Portal(val parada: Parada) : DelMovil
        /** Solo la calle: NO se guarda (revisión A2: el servidor la dejaría «manual», como la puerta, y la guía
         *  llevaría al medio de la calle sin avisar); al navegar se ofrece la primera en «Situar la parada». */
        data class SoloCalle(val sugerencia: Sugerencia) : DelMovil
        /** No la encuentra, lo que contesta no es esa calle o ese sitio, o no se ha podido guardar. */
        data object Nada : DelMovil
        /** Sin respuesta (sin red o sin geocodificador): no cuenta como probada y se vuelve a probar más tarde. */
        data object SinRespuesta : DelMovil
    }

    /** Prueba el geocodificador del móvil con una parada sin situar (Situar.aceptar). El portal se guarda con
     *  geo_origen «movil» y se pone en la ruta; la calle sola se devuelve sin guardar. Si esa parada ya se está
     *  buscando (la pasada de fondo), se espera a esa búsqueda (revisión A7: «Navegar» abría «Situar» y, un segundo
     *  después, el móvil la situaba debajo). */
    suspend fun situarConMovil(p: Parada): DelMovil =
        if (!GeoMovil.hay()) DelMovil.SinRespuesta else enVuelo.una(p.id) { buscarConMovil(p) }

    private suspend fun buscarConMovil(p: Parada): DelMovil {
        try {
            val antes = repo.cambiosDe(p.id)
            val ruta = _e.value.ruta
            val pais = paisRuta()
            val dice = GeoMovil.paraParada(getApplication(), p, pais, Situar.cerca(p, ruta?.base),
                Situar.dondeReparte(p, ruta?.base, _e.value.paradas))
            // Sin respuesta (sin red) no cuenta como probada: se vuelve a probar en la próxima carga.
            if (dice is GeoMovil.Respuesta.SinRespuesta) return DelMovil.SinRespuesta
            probadas += Situar.clave(p)
            val (r, precision) = (dice as? GeoMovil.Respuesta.Situada)?.let { it.r to it.precision } ?: return DelMovil.Nada
            if (precision != "portal") return Situar.deMovil(r, pais, p.direccion, p.cp, p.localidad)?.let { DelMovil.SoloCalle(it) } ?: DelMovil.Nada
            return when (val s = repo.situar(p.id, r.lat, r.lng, "movil", p.cliente.ifBlank { p.direccion }, siNoCambia = antes)) {
                is Repositorio.Situado.Hecha -> { poner(s.parada); DelMovil.Portal(s.parada) }
                Repositorio.Situado.EnElMovil -> Repositorio.conPunto(p, r.lat, r.lng, "movil").let { poner(it); DelMovil.Portal(it) }
                Repositorio.Situado.NoGuardado -> DelMovil.Nada
            }
        } catch (_: ErrorApi) {
            return DelMovil.Nada
        }
    }

    /** «Es aquí» en «Situar la parada»: el punto se guarda en el servidor y se pone en la ruta; sin red se queda en el
     *  móvil (sale solo al volver la red) y la ruta ya la ve situada. `cambio` (Situar.esAqui, 03-11-2026): la precisión
     *  «calle» (la calle sin el portal, «aprox» y no «manual») y, si la sugerencia elegida la cambia, la dirección nueva
     *  con su CP y su población, que van con el punto (también en la cola) y se ven ya en la ruta. Lo que el servidor
     *  rechace, como ErrorApi. */
    suspend fun guardarPunto(p: Parada, lat: Double, lng: Double, origen: String, cambio: Situar.Cambio = Situar.Cambio()): Repositorio.Situado {
        probadas += Situar.clave(p)
        val s = repo.situar(p.id, lat, lng, origen, p.cliente.ifBlank { p.direccion }, precision = cambio.precision,
            direccion = cambio.direccion, cp = cambio.cp, localidad = cambio.localidad)
        when (s) {
            is Repositorio.Situado.Hecha -> poner(s.parada)
            Repositorio.Situado.EnElMovil -> poner(Situar.situada(p, lat, lng, origen, cambio))
            Repositorio.Situado.NoGuardado -> Unit
        }
        return s
    }

    /** En segundo plano y sin molestar: las recién añadidas sin punto y las pendientes sin punto de la ruta (sin las de
     *  geo «pendiente», que aún está ubicando el servidor: Situar.porSituar). Solo se guarda el portal. */
    private fun situarEnFondo() {
        if (fondoEnMarcha || !GeoMovil.hay()) return
        fondoEnMarcha = true
        viewModelScope.launch {
            try {
                var hechas = 0
                while (hechas < Situar.TOPE_FONDO) {
                    if (mandando > 0 || _e.value.ocupado.isNotEmpty()) break
                    val actuales = _e.value.paradas.associateBy { it.id }
                    val candidatas = recienSinSituar.map { actuales[it.id] ?: it } + _e.value.paradas
                    val ocupadas = repo.pendientes.value.map { it.id }.toSet() + enVuelo.claves
                    val p = Situar.porSituar(candidatas, probadas, ocupadas, tope = 1).firstOrNull() ?: break
                    recienSinSituar.removeAll { it.id == p.id }
                    hechas += 1
                    if (situarConMovil(p) == DelMovil.SinRespuesta) break   // sin red: las demás, en la próxima carga
                    probadas += Situar.clave(p)               // aunque fallara al guardar: una vez por sesión
                }
                recienSinSituar.removeAll { r -> _e.value.paradas.any { it.id == r.id && !Situar.sinSituar(it) } || Situar.clave(r) in probadas }
            } finally {
                fondoEnMarcha = false
            }
        }
    }

    /* LA RUTA SE REFRESCA SOLA (01-11-2026): lo que contesta el cliente en su enlace («El cliente dice») tiene que
       verse en «Siguiente parada» sin tirar hacia abajo. Hoy llama a esto al volver a primer plano y cada minuto: se
       vuelve a leer en silencio (sin indicador ni avisos) si hace ≥20 s de la última carga y queda algo por entregar.
       Nunca con un cambio de camino ni mientras se ordena: la ruta del servidor volvería a pintar lo de antes (y el
       briefing por voz lo repetiría). */
    fun refrescarSiToca() {
        val e = _e.value
        // Con el día terminado (hay paradas y ninguna pendiente) no hace falta; con la ruta vacía o sin cargar, sí.
        if (mandando > 0 || e.ocupado.isNotEmpty() || (e.paradas.isNotEmpty() && e.pendientes.isEmpty())) return
        if (System.currentTimeMillis() - cargadaEn < 20_000) return
        refrescarSinRuido()
    }

    /** Las paradas de días anteriores sin cerrar, a hoy (quedan sin orden: después, «Ordenar ruta»). */
    fun traerPrevias() {
        viewModelScope.launch {
            try {
                val n = repo.traerPrevias()
                avisar(if (n == 1) tx("1 parada traída a hoy. Pulsa «Ordenar ruta».") else tx("{n} paradas traídas a hoy. Pulsa «Ordenar ruta».", "n" to n))
                refrescarSinRuido()
            } catch (e: ErrorApi) { avisar(if (e.sinRed) tx("Sin conexión: para traer paradas hace falta red.") else e.message ?: tx("No se ha podido")) }
        }
    }

    /** El camino por las calles para el mapa; si no se puede, se queda con los tramos rectos. */
    fun cargarTrazado(lat: Double? = null, lng: Double? = null) {
        viewModelScope.launch {
            val t = runCatching { repo.trazado(lat, lng) }.getOrNull() ?: return@launch
            _e.value = _e.value.copy(trazado = t.linea.mapNotNull { if (it.size >= 2) it[0] to it[1] else null })
        }
    }
}

/** UNA BÚSQUEDA POR PARADA (02-11-2026, revisión A7): quien llega con una en marcha (pulsar «Navegar» mientras la
 *  pasada de fondo busca esa misma parada) espera esa, en vez de darla por no encontrada o de empezar otra. Todo en el
 *  hilo principal (el de viewModelScope y el de la pantalla): sin candados. La búsqueda va en `ambito`, no en quien
 *  la pide: si este se va (se cierra la pantalla), la búsqueda acaba igual y guarda lo que encuentre. */
internal class EnVuelo<K, V>(private val ambito: CoroutineScope) {
    private val enMarcha = HashMap<K, Deferred<V>>()

    /** Lo que se está buscando ahora mismo. */
    val claves: Set<K> get() = enMarcha.keys.toSet()

    suspend fun una(clave: K, buscar: suspend () -> V): V {
        // LAZY: se apunta antes de empezar, y así lo de quitarla al acabar no puede ir antes que lo de apuntarla.
        val d = enMarcha[clave] ?: ambito.async(start = CoroutineStart.LAZY) {
            try { buscar() } finally { enMarcha.remove(clave) }
        }.also { enMarcha[clave] = it }
        return d.await()
    }
}
