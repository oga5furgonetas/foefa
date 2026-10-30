package com.flotadsp.fds.data

import com.flotadsp.fds.ui.tx

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
import kotlinx.serialization.json.JsonNull
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
    /** Cómo se llama la parada, para decírselo a la persona si el servidor lo rechaza (29-10-2026). */
    val nombre: String = "",
    /** Veces que el servidor ha contestado mal (5xx): tras MAX_INTENTOS se avisa y se deja de insistir. */
    val intentos: Int = 0,
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
    /** Lo que el servidor ha rechazado al vaciar la cola, para avisar (se vacía al leerlo). */
    private val _rechazos = MutableStateFlow<List<String>>(emptyList())
    fun tomarRechazos(): List<String> = _rechazos.value.also { _rechazos.value = emptyList() }
    /** Una clave de sesión para la analítica anónima (muere con el proceso, como la pestaña en la web). */
    private val sidAnalitica = java.util.UUID.randomUUID().toString().replace("-", "").take(24)

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
            "conductor" -> {
                cuenta.guardar(s, correo.trim().lowercase(Locale.ROOT))
                _pendientes.value = leerCola()
            }
            "empresa" -> Unit // La app abre el panel de oficina con esta sesión en memoria.
            else -> throw ErrorApi(0, tx("El servidor no indicó a qué portal pertenece esta cuenta. Actualiza FDS."))
        }
        return s
    }

    suspend fun solicitarCodigoConductor(correo: String) {
        api.post("auth/driver-lookup", buildJsonObject { put("email", correo.trim().lowercase(Locale.ROOT)) })
    }

    /** «He olvidado mi contraseña» (29-10-2026): el servidor manda un enlace al correo de la cuenta si existe
     *  (siempre contesta bien, sin decir si existe). Solo para cuentas de quien reparte por su cuenta; un conductor
     *  de empresa entra con el código de su correo personal. */
    suspend fun recuperarClave(correo: String) {
        api.post("auth/forgot-password", buildJsonObject { put("email", correo.trim().lowercase(Locale.ROOT)) })
    }

    /** La versión que hay para descargar de la web, o null si el servidor no anuncia ninguna (público). */
    suspend fun versionWeb(): VersionApp? =
        api.get("app/version").jsonObject["web"]?.takeUnless { it is JsonNull }?.let { leer<VersionApp>(it) }

    /** Una pantalla vista, para la analítica propia y anónima (la misma que la web): nunca falla hacia fuera. */
    suspend fun vista(ruta: String) {
        runCatching {
            api.post("analitica/evento", buildJsonObject {
                put("sid", sidAnalitica); put("tipo", "vista"); put("ruta", ruta); put("disp", "movil")
            })
        }
    }

    suspend fun entrarConCodigoConductor(correo: String, codigo: String): Sesion {
        val s = leer<Sesion>(api.post("auth/driver-code/verify", buildJsonObject {
            put("email", correo.trim().lowercase(Locale.ROOT)); put("code", codigo.trim())
        }))
        val conductor = s.copy(app_destino = "conductor")
        cuenta.guardar(conductor, correo.trim().lowercase(Locale.ROOT))
        _pendientes.value = leerCola()
        return conductor
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

    /** La sesión dura un mes y se renueva al usar la app: quien reparte cada día no vuelve a entrar. Desde el
     *  29-10-2026 también la del conductor de empresa (auth/renovar la renueva con su ficha, si sigue activa). */
    suspend fun renovarSiToca() {
        val destino = cuenta.destino.value
        if (destino != "reparto" && destino != "conductor") return
        val t = cuenta.token.value ?: return
        if (Cuenta.quedan(t) > 25L * 86400) return
        runCatching {
            val s = leer<Sesion>(api.post("auth/renovar"))
            // La renovación no trae a qué portal va: se conserva el de la sesión que se renueva.
            cuenta.guardar(if (s.app_destino == null) s.copy(app_destino = destino) else s)
        }
    }

    suspend fun salir() {
        runCatching { api.post("push/fcm-token/quitar") }   // que los avisos no sigan llegando a este móvil (29-10-2026)
        AvisosWorker.parar(ctx)
        cuenta.cerrar()
        withContext(Dispatchers.IO) { fCopia.delete() }   // direcciones y teléfonos de clientes: fuera del móvil
    }

    suspend fun borrarCuenta(clave: String) {
        api.post("auth/borrar-cuenta", buildJsonObject { put("password", clave) })
        salir()
        withContext(Dispatchers.IO) { fCola.delete() }
        _pendientes.value = emptyList()
    }

    suspend fun cambiarClaveConductor(actual: String, nueva: String) {
        api.post("auth/change-my-password", buildJsonObject {
            put("current_password", actual)
            put("new_password", nueva)
        })
    }

    suspend fun estadoCorreoRecuperacion(): JsonObject =
        api.get("portal/mi-correo-personal").jsonObject

    suspend fun solicitarCorreoRecuperacion(correo: String): JsonObject =
        api.post("portal/mi-correo-personal", buildJsonObject { put("email", correo.trim()) }).jsonObject

    suspend fun vehiculosPortal(): JsonObject = api.get("vehicles/portal").jsonObject
    suspend fun vehiculoAsignado(): JsonObject = api.get("auth/me/assigned-vehicle").jsonObject
    suspend fun fichaConductor(): JsonObject = api.get("portal/mi-ficha").jsonObject
    suspend fun guardarTelefonoConductor(telefono: String) {
        api.post("portal/mi-telefono", buildJsonObject { put("telefono", telefono) })
    }
    suspend fun validarFotoInspeccion(vehicleId: String, zona: String, bytes: ByteArray): JsonObject =
        api.postMultipart("inspections/validate-photo", mapOf("vehicle_id" to vehicleId, "expected_zone" to zona),
            listOf(ArchivoMultipart("file", "check.jpg", bytes))).jsonObject
    suspend fun leerOdometroInspeccion(vehicleId: String, bytes: ByteArray): JsonObject =
        api.postMultipart("vehicles/$vehicleId/odometer-photo", emptyMap(),
            listOf(ArchivoMultipart("file", "odometro.jpg", bytes))).jsonObject
    suspend fun subirInspeccion(vehicleId: String, notas: String, fotos: List<ArchivoMultipart>): JsonObject =
        api.postMultipart("inspections/upload", mapOf(
            "vehicle_id" to vehicleId,
            "driver_id" to cuenta.quien(),
            "notes" to notas,
        ), fotos).jsonObject
    suspend fun turnosConductor(desde: String, hasta: String): JsonObject =
        api.get("shifts/mine", mapOf("desde" to desde, "hasta" to hasta)).jsonObject
    suspend fun bloqueosConductor(): JsonObject = api.get("shift-blocks/mios").jsonObject
    suspend fun solicitarDiaConductor(fecha: String, tipo: String, motivo: String, nota: String): JsonObject =
        api.post("shift-requests", buildJsonObject {
            put("date", fecha); put("type", tipo); put("motivo", motivo); put("note", nota)
        }).jsonObject
    suspend fun marcarRespuestasTurnosVistas(ids: List<String>) {
        if (ids.isEmpty()) return
        api.post("shift-requests/vistas", buildJsonObject { put("ids", buildJsonArray { ids.forEach { add(kotlinx.serialization.json.JsonPrimitive(it)) } }) })
    }
    suspend fun trabajarMasConductor(): JsonObject = api.get("trabajar-mas").jsonObject
    suspend fun solicitarDiaExtra(fecha: String, nota: String): JsonObject =
        api.post("trabajar-mas/$fecha/solicitar", buildJsonObject { put("nota", nota) }).jsonObject
    suspend fun retirarSolicitudExtra(refuerzoId: String) { api.post("refuerzos/$refuerzoId/desapuntarme") }
    suspend fun cancelarDiaExtra(id: String): JsonObject =
        api.post("shift-requests/mias/cancelar", buildJsonObject {
            put("ids", buildJsonArray { add(kotlinx.serialization.json.JsonPrimitive(id)) })
        }).jsonObject
    suspend fun referidosConductor(): JsonObject = api.get("conductor/referidos").jsonObject
    suspend fun retirarReferidosConductor(titular: String, metodo: String, destino: String): JsonObject =
        api.post("conductor/referidos/retirar", buildJsonObject { put("titular", titular); put("metodo", metodo); put("destino", destino) }).jsonObject

    // ── Avisos al móvil (29-10-2026) ────────────────────────────────────────────────────────────────────────

    /** La bandeja de avisos de esta persona (los más nuevos primero); `desde`: solo lo posterior a esa fecha ISO. */
    suspend fun avisos(desde: String? = null): Avisos =
        leer(api.get("avisos/mios", if (desde.isNullOrBlank()) emptyMap() else mapOf("desde" to desde)))

    suspend fun avisosLeidos(ids: List<String>) {
        if (ids.isEmpty()) return
        api.post("avisos/leidos", buildJsonObject { put("ids", buildJsonArray { ids.forEach { add(kotlinx.serialization.json.JsonPrimitive(it)) } }) })
    }

    /** Apunta este móvil para los avisos: con el token de FCM (al instante) o sin él (la app pregunta cada 15 min). */
    suspend fun registrarMovil(token: String?) {
        runCatching {
            api.post("push/fcm-token", buildJsonObject {
                put("token", token.orEmpty()); put("plataforma", "android"); put("app", com.flotadsp.fds.BuildConfig.VERSION_NAME)
            })
        }
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

    /** Entregado / no entregado. Sin red (o con el servidor caído) se guarda y se manda solo después: devuelve
     *  false en ese caso. Si ya hay algo de esa parada esperando a salir, esto va DETRÁS, en orden: mandarlo ahora
     *  adelantaría al cambio anterior y el servidor acabaría con el estado viejo (29-10-2026). */
    suspend fun cambiarEstado(id: String, estado: String, cuerpo: JsonObject, nombre: String = ""): Boolean {
        val hechoEn = Instant.now().toString()
        val todo = JsonObject(cuerpo + ("estado" to kotlinx.serialization.json.JsonPrimitive(estado)) +
            ("hecho_en" to kotlinx.serialization.json.JsonPrimitive(hechoEn)))
        val yaEspera = _pendientes.value.any { it.quien == cuenta.quien() && it.id == id }
        if (!yaEspera) {
            try {
                api.post("reparto/pedidos/$id/estado", todo)
                return true
            } catch (e: ErrorApi) {
                if (!e.reintentable) throw e
            }
        }
        candado.withLock {
            guardarCola(_pendientes.value + Pendiente(cuenta.quien(), id, estado, todo, hechoEn, nombre))
        }
        EnvioWorker.programar(ctx)
        return false
    }

    /** Manda lo guardado sin red, en orden. Devuelve (enviados, rechazados por el servidor); los rechazos quedan
     *  en `tomarRechazos()` para avisar a la persona. */
    suspend fun vaciarCola(): Pair<Int, Int> = candado.withLock {
        var enviados = 0
        var rechazados = 0
        val quedan = _pendientes.value.toMutableList()
        val it = quedan.listIterator()
        while (it.hasNext()) {
            val p = it.next()
            if (p.quien != cuenta.quien()) continue
            try {
                api.post("reparto/pedidos/${p.id}/estado", p.cuerpo)
                enviados += 1
            } catch (e: ErrorApi) {
                // Sin red o sesión caducada: se para y se sigue más tarde, en orden. Un servidor que contesta mal
                // (5xx, 408, 429) también, pero contando: el que lo hace MAX_INTENTOS veces ya no es un apagón.
                val contesta = e.estado >= 400 && e.estado != 401
                if (e.estado == 401 || (e.reintentable && (!contesta || p.intentos < MAX_INTENTOS))) {
                    if (contesta) { it.set(p.copy(intentos = p.intentos + 1)); guardarCola(quedan.toList()) }
                    break
                }
                rechazados += 1        // ya no existe, ya no es suya, o el servidor no lo acepta: se avisa y fuera
                _rechazos.value = _rechazos.value + "No se ha podido guardar ${p.nombre.ifBlank { "una parada" }}: ${e.message}"
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

    /** Las paradas de días anteriores sin cerrar pasan a hoy (solo quien reparte por su cuenta). Devuelve cuántas. */
    suspend fun traerPrevias(): Int = api.post("reparto/mi-ruta/traer-previas").jsonObject["traidas"]?.jsonPrimitive?.intOrNull ?: 0

    /** El camino por las calles de lo que queda, para el mapa: [[lat, lng], …] (recto si no hay servidor de rutas). */
    suspend fun trazado(lat: Double?, lng: Double?): Trazado = leer(
        api.post("reparto/mi-ruta/trazado", buildJsonObject { if (lat != null && lng != null) put("desde", buildJsonObject { put("lat", lat); put("lng", lng) }) }))

    /** Lo que dice la DGT cerca de la ruta de hoy (30-10-2026): cortes y obras, y zonas de bajas emisiones. */
    suspend fun incidencias(): Incidencias = leer(api.get("reparto/mi-ruta/incidencias"))
    suspend fun zbe(): Zbe = leer(api.get("reparto/mi-ruta/zbe"))

    /** La tarifa de «Mi dinero hoy», en céntimos de su moneda (PUT /reparto/ganancias, como la web). */
    suspend fun guardarGanancias(pagoParada: Int, pagoDia: Int, costeKm: Int) {
        api.put("reparto/ganancias", buildJsonObject { put("pago_parada", pagoParada); put("pago_dia", pagoDia); put("coste_km", costeKm) })
    }

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
        /** Reintentos de un envío que el servidor contesta mal (5xx) antes de darlo por rechazado y avisar. */
        const val MAX_INTENTOS = 12
    }
}
