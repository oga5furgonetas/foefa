package com.flotadsp.fds.data

import android.content.Context
import android.telephony.TelephonyManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.File
import java.time.Instant
import java.util.Locale
import java.util.TimeZone

/** Lo hecho sin cobertura, guardado en el móvil hasta poder mandarlo (en orden, con la hora a la que se hizo). */
@Serializable
data class Pendiente(
    val quien: String,
    val id: String,
    val estado: String,
    val cuerpo: JsonObject,
    val hechoEn: String,
)

@Serializable
private data class Copia(val quien: String, val dia: String, val guardadaEn: Long, val ruta: MiRuta)

/* TODO LO DE LA RUTA, CON EL MÓVIL SIN COBERTURA EN CUENTA.
   · La última ruta se guarda en el móvil: la app abre con ella al momento y sin red (`rutaGuardada`).
   · Entregar / no entregar sin red se apunta y se manda solo al volver la red (EnvioWorker), con su hora real.
   · Nada se guarda en la copia de seguridad de Google (reglas_copia.xml). */
class Repositorio(private val ctx: Context, val cuenta: Cuenta, val api: Api) {
    private val dir = File(ctx.filesDir, "fds").apply { mkdirs() }
    private val fCopia = File(dir, "ruta.json")
    private val fCola = File(dir, "pendientes.json")
    private val candado = Mutex()

    private val _pendientes = MutableStateFlow<List<Pendiente>>(emptyList())
    val pendientes: StateFlow<List<Pendiente>> = _pendientes

    /** Dónde reparte: el país de la SIM y, sin SIM, el de la red; el idioma del móvil, lo último. Un móvil en inglés
     *  con SIM española es de España: con el idioma, la cuenta salía de EE. UU. (visto en el emulador) y ni los
     *  teléfonos de 9 cifras ni las direcciones de su zona se leían. Sin permisos: la SIM y la red los da Android. */
    fun paisDelMovil(): String? {
        val tm = ctx.getSystemService(TelephonyManager::class.java)
        return listOfNotNull(runCatching { tm?.simCountryIso }.getOrNull(), runCatching { tm?.networkCountryIso }.getOrNull(), Locale.getDefault().country)
            .map { it.lowercase(Locale.ROOT) }.firstOrNull { it.length == 2 }
    }

    init { _pendientes.value = leerCola() }

    // ── Sesión ──────────────────────────────────────────────────────────────────────────────────────────────

    suspend fun entrar(correo: String, clave: String): Sesion {
        val r = api.post("auth/app-login", buildJsonObject { put("identifier", correo.trim()); put("password", clave) })
        val s = leer<Sesion>(r)
        when (s.app_destino) {
            "reparto" -> {
                cuenta.guardar(s, correo.trim().lowercase(Locale.ROOT))
                _pendientes.value = leerCola()
            }
            "empresa", "conductor" -> Unit // La app abrirá el portal web correspondiente con esta sesión.
            else -> throw ErrorApi(0, "El servidor no indicó a qué portal pertenece esta cuenta. Actualiza FDS.")
        }
        return s
    }

    /** La oferta del plan del repartidor, la MISMA que enseñan la web y los anuncios (GET /billing/planes, público):
     *  «gratis y sin límite hasta…» mientras dure la promoción, y las paradas gratis al día después. */
    suspend fun oferta(): Oferta {
        val planes = api.get("billing/planes").jsonObject["planes"]?.jsonArray.orEmpty()
        val p = planes.map { it.jsonObject }.firstOrNull { it["clave"]?.jsonPrimitive?.contentOrNull == "autonomo" }
        return Oferta(gratisHasta = p?.get("gratis_hasta")?.jsonPrimitive?.contentOrNull,
            paradasGratis = p?.get("paradas_gratis")?.jsonPrimitive?.intOrNull ?: 15)
    }

    suspend fun crearCuenta(nombre: String, correo: String, clave: String, ref: String?) {
        val c = correo.trim().lowercase(Locale.ROOT)
        val slug = nombre.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]+"), "-").trim('-').take(24).ifBlank { "reparto" }
        val r = api.post("auth/register", buildJsonObject {
            put("org_name", nombre.trim()); put("username", c); put("password", clave); put("email", c)
            put("slug", "$slug-${(1000..9999).random()}"); put("center", "")
            put("plan", "autonomo"); put("sector", "autonomo"); put("desde_app", true)
            put("zona_horaria", TimeZone.getDefault().id)
            paisDelMovil()?.let { put("pais", it) }
            put("idioma", Locale.getDefault().language)
            if (!ref.isNullOrBlank()) put("ref", ref)
        })
        cuenta.guardar(leer<Sesion>(r), c)
    }

    /** La sesión dura un mes y se renueva al usar la app: quien reparte cada día no vuelve a entrar. */
    suspend fun renovarSiToca() {
        val t = cuenta.token.value ?: return
        if (Cuenta.quedan(t) > 25L * 86400) return
        runCatching { cuenta.guardar(leer<Sesion>(api.post("auth/renovar"))) }
    }

    suspend fun salir() {
        cuenta.cerrar()
        withContext(Dispatchers.IO) { fCopia.delete() }   // direcciones y teléfonos de clientes: fuera del móvil
    }

    suspend fun borrarCuenta(clave: String) {
        api.post("auth/borrar-cuenta", buildJsonObject { put("password", clave) })
        salir()
        withContext(Dispatchers.IO) { fCola.delete() }
        _pendientes.value = emptyList()
    }

    // ── La ruta ─────────────────────────────────────────────────────────────────────────────────────────────

    /** La ruta guardada en el móvil, si es de esta cuenta y de hoy. */
    fun rutaGuardada(): Pair<MiRuta, Long>? = runCatching {
        if (!fCopia.exists()) return null
        val c = JSON.decodeFromString(Copia.serializer(), fCopia.readText())
        if (c.quien != cuenta.quien() || c.dia != hoy()) null else aplicarPendientes(c.ruta) to c.guardadaEn
    }.getOrNull()

    suspend fun miRuta(): MiRuta {
        val r = leer<MiRuta>(api.get("reparto/mi-ruta"))
        withContext(Dispatchers.IO) {
            if (!r.prueba) runCatching {
                fCopia.writeText(JSON.encodeToString(Copia.serializer(), Copia(cuenta.quien(), hoy(), System.currentTimeMillis(), r)))
            }
        }
        return aplicarPendientes(r)
    }

    /** Lo hecho sin red se ve ya hecho, aunque el servidor aún no lo sepa. */
    private fun aplicarPendientes(r: MiRuta): MiRuta {
        val mias = _pendientes.value.filter { it.quien == cuenta.quien() }
        if (mias.isEmpty()) return r
        val ult = mias.associateBy { it.id }
        return r.copy(pedidos = r.pedidos.map { p -> ult[p.id]?.let { p.copy(estado = it.estado, cerradoEn = it.hechoEn) } ?: p })
    }

    /** Entregado / no entregado. Sin red se guarda y se manda solo después: devuelve false en ese caso. */
    suspend fun cambiarEstado(id: String, estado: String, cuerpo: JsonObject): Boolean {
        val hechoEn = Instant.now().toString()
        val todo = JsonObject(cuerpo + ("estado" to kotlinx.serialization.json.JsonPrimitive(estado)) +
            ("hecho_en" to kotlinx.serialization.json.JsonPrimitive(hechoEn)))
        return try {
            api.post("reparto/pedidos/$id/estado", todo)
            true
        } catch (e: ErrorApi) {
            if (!e.sinRed) throw e
            candado.withLock {
                guardarCola(_pendientes.value + Pendiente(cuenta.quien(), id, estado, todo, hechoEn))
            }
            EnvioWorker.programar(ctx)
            false
        }
    }

    /** Manda lo guardado sin red. Devuelve (enviados, rechazados por el servidor). */
    suspend fun vaciarCola(): Pair<Int, Int> = candado.withLock {
        var enviados = 0
        var rechazados = 0
        val quedan = _pendientes.value.toMutableList()
        val it = quedan.iterator()
        while (it.hasNext()) {
            val p = it.next()
            if (p.quien != cuenta.quien()) continue
            try {
                api.post("reparto/pedidos/${p.id}/estado", p.cuerpo)
                enviados += 1
            } catch (e: ErrorApi) {
                if (e.sinRed || e.estado == 401) break
                rechazados += 1        // ya no existe o ya no es suya: no se reintenta
            }
            it.remove()
            guardarCola(quedan.toList())
        }
        enviados to rechazados
    }

    suspend fun escanear(codigos: List<String>): Escaneo =
        leer(api.post("reparto/escanear", buildJsonObject {
            put("codigos", buildJsonArray { codigos.forEach { add(kotlinx.serialization.json.JsonPrimitive(it)) } })
        }))

    suspend fun nuevaParada(datos: JsonObject): Parada = leer(api.post("reparto/mis-pedidos", datos))
    suspend fun editarParada(id: String, datos: JsonObject) { api.post("reparto/mis-pedidos/$id/editar", datos) }
    suspend fun quitarParada(id: String) { api.post("reparto/mis-pedidos/$id/quitar") }

    suspend fun ordenar(lat: Double?, lng: Double?): Ordenado = leer(
        api.post("reparto/mi-ruta/ordenar", buildJsonObject { if (lat != null && lng != null) { put("lat", lat); put("lng", lng) } }))

    suspend fun ordenAMano(ids: List<String>) {
        api.post("reparto/mi-ruta/orden", buildJsonObject {
            put("ids", buildJsonArray { ids.forEach { add(kotlinx.serialization.json.JsonPrimitive(it)) } })
        })
    }

    suspend fun direccionesConocidas(q: String): List<DireccionConocida> =
        leer<Direcciones>(api.get("reparto/mis-direcciones", mapOf("q" to q))).direcciones

    suspend fun formasDeCodigo(formas: List<String>, pais: String) {
        runCatching {
            api.post("reparto/formas-codigo", buildJsonObject {
                put("formas", buildJsonArray { formas.take(4).forEach { add(kotlinx.serialization.json.JsonPrimitive(it)) } })
                put("pais", pais)
            })
        }
    }

    // ── El resto ────────────────────────────────────────────────────────────────────────────────────────────

    suspend fun plan(): Plan = leer(api.get("org/billing"))
    suspend fun estadisticas(dias: Int = 30): Estadisticas = leer(api.get("reparto/estadisticas", mapOf("dias" to "$dias")))
    suspend fun paradasDelDia(fecha: String): List<Parada> =
        leer<PedidosDia>(api.get("reparto/pedidos", mapOf("fecha" to fecha))).pedidos
    suspend fun referidos(): Referidos = leer(api.get("referidos"))
    suspend fun ajustes(): Ajustes = api.get("reparto/ajustes").jsonObject

    /** PUT /reparto/ajustes sustituye TODOS los ajustes: se manda lo que había con los cambios encima. */
    suspend fun guardarAjustes(antes: Ajustes, cambios: Map<String, JsonElement>) {
        val base = antes["base"]?.let { runCatching { it.jsonObject["direccion"] }.getOrNull() }
        val cuerpo = JsonObject(antes - "base" + (base?.let { mapOf("base_direccion" to it) } ?: emptyMap()) + cambios)
        api.put("reparto/ajustes", cuerpo)
    }

    // ── Ficheros ────────────────────────────────────────────────────────────────────────────────────────────

    private fun leerCola(): List<Pendiente> = runCatching {
        if (fCola.exists()) JSON.decodeFromString(ListSerializer(Pendiente.serializer()), fCola.readText()) else emptyList()
    }.getOrDefault(emptyList())

    private fun guardarCola(l: List<Pendiente>) {
        runCatching { fCola.writeText(JSON.encodeToString(ListSerializer(Pendiente.serializer()), l)) }
        _pendientes.value = l
    }

    companion object {
        fun hoy(): String = java.time.LocalDate.now().toString()
    }
}
