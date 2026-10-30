package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.ui.tx
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.Incidencias
import com.flotadsp.fds.data.MiRuta
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.data.Zbe
import com.flotadsp.fds.ui.Acciones
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
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
) {
    val paradas get() = ruta?.pedidos.orEmpty()
    val pendientes get() = paradas.filter { it.pendiente }.sortedWith(compareBy<Parada>({ it.orden ?: Int.MAX_VALUE }, { it.cliente }))
    val hechas get() = paradas.filter { !it.pendiente }.sortedByDescending { it.cerradoEn ?: "" }
    val entregadas get() = paradas.count { it.estado == "entregado" }
}

/** Un aviso para la persona (abajo, como en cualquier app), con una acción opcional («Deshacer»). */
data class Aviso(val texto: String, val accion: String? = null, val alPulsar: (() -> Unit)? = null)

class RutaVM(app: Application) : AndroidViewModel(app) {
    private val repo = (app as FdsApp).repo
    private val _e = MutableStateFlow(EstadoRuta())
    val estado: StateFlow<EstadoRuta> = _e
    private val _avisos = Channel<Aviso>(Channel.BUFFERED)
    val avisos = _avisos.receiveAsFlow()
    val pendientesDeEnvio = repo.pendientes

    init {
        // Al momento, la ruta guardada en el móvil; después, la del servidor.
        repo.rutaGuardada()?.let { (r, en) -> _e.value = EstadoRuta(ruta = r, guardadaEn = en, cargando = false) }
        cargar()
        viewModelScope.launch { repo.renovarSiToca() }
    }

    fun avisar(t: String) { _avisos.trySend(Aviso(t)) }

    /** Una pantalla vista, para la analítica anónima (como la web): no bloquea ni falla. */
    fun vista(ruta: String) { viewModelScope.launch { repo.vista(ruta) } }

    fun cargar(tirando: Boolean = false) {
        viewModelScope.launch {
            if (tirando) _e.value = _e.value.copy(refrescando = true)
            try {
                repo.vaciarCola()
                repo.tomarRechazos().forEach { avisar(it) }
                val r = repo.miRuta()
                _e.value = _e.value.copy(ruta = r, guardadaEn = null, cargando = false, refrescando = false, error = null)
                if (!r.prueba && r.pedidos.any { it.pendiente }) { cargarZbe(); cargarIncidencias() }
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
            try {
                val extras = buildMap<String, JsonElement> {
                    if (estado != "pendiente") intentoDe(p)?.let { put("intento", it) }
                    // LA PUERTA APRENDIDA (30-10-2026): la posición del móvil al entregar, con su precisión; el servidor
                    // la guarda si es precisa y cercana, y la próxima vez en esa dirección el pin es la puerta de verdad.
                    if (estado == "entregado") Acciones.posicionPrecisa(getApplication())?.let { (la, lo, prec) ->
                        put("posicion", buildJsonObject { put("lat", la); put("lng", lo); put("precision", prec) })
                    }
                }
                val enviado = repo.cambiarEstado(p.id, estado, JsonObject(cuerpo + extras), p.cliente.ifBlank { p.direccion })
                if (estado != "pendiente") intentos.remove(p.id)
                val t = if (enviado) texto else "$texto " + tx("Sin cobertura: se envía solo al volver la red.")
                _avisos.send(if (conDeshacer) Aviso(t, "Deshacer") { deshacer(p) } else Aviso(t))
                if (enviado) refrescarSinRuido()
            } catch (e: ErrorApi) {
                _e.value = _e.value.copy(ruta = antes)
                _avisos.send(Aviso(e.message ?: tx("No se ha podido guardar")))
            }
        }
    }

    fun entregar(p: Parada, cuerpo: JsonObject = JsonObject(emptyMap())) =
        marcar(p, "entregado", cuerpo, tx("Entregado: {n}.", "n" to p.cliente.ifBlank { p.direccion }), conDeshacer = true)

    fun noEntregado(p: Parada, motivo: String, nota: String) = marcar(
        p, "fallido", JsonObject(mapOf("motivo" to kotlinx.serialization.json.JsonPrimitive(motivo),
            "nota" to kotlinx.serialization.json.JsonPrimitive(nota))), tx("Marcado como no entregado."), conDeshacer = true)

    fun deshacer(p: Parada) = marcar(p, "pendiente", JsonObject(emptyMap()), tx("Vuelve a estar por entregar."), conDeshacer = false)

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
        viewModelScope.launch {
            runCatching { repo.miRuta() }.onSuccess { _e.value = _e.value.copy(ruta = it, guardadaEn = null, error = null) }
        }
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
