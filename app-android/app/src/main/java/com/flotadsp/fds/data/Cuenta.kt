package com.flotadsp.fds.data

import android.content.Context
import android.util.Base64
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

private val Context.almacen by preferencesDataStore(name = "fds")

/* LA SESIÓN EN EL MÓVIL. El token se guarda en el almacén privado de la app (fuera de la copia de seguridad de
   Google: reglas_copia.xml). Se carga una vez al arrancar y queda en memoria para cada petición. */
class Cuenta(private val ctx: Context) {
    private val kToken = stringPreferencesKey("token")
    private val kNombre = stringPreferencesKey("nombre")
    private val kCorreo = stringPreferencesKey("correo")
    private val kCentro = stringPreferencesKey("centro")
    private val kDestino = stringPreferencesKey("destino")
    private val kConfigurarCuenta = androidx.datastore.preferences.core.booleanPreferencesKey("configurar_cuenta")
    private val kNavegar = stringPreferencesKey("navegar")
    private val kTema = stringPreferencesKey("tema")
    private val kUltimoAviso = stringPreferencesKey("ultimo_aviso")
    private val kFurgo = stringPreferencesKey("furgo")

    private val _token = MutableStateFlow<String?>(null)
    val token: StateFlow<String?> = _token
    private val _nombre = MutableStateFlow("")
    val nombre: StateFlow<String> = _nombre
    private val _correo = MutableStateFlow("")
    val correo: StateFlow<String> = _correo
    private val _centro = MutableStateFlow("")
    val centro: StateFlow<String> = _centro
    private val _destino = MutableStateFlow<String?>(null)
    val destino: StateFlow<String?> = _destino
    private val _configurarCuenta = MutableStateFlow(false)
    val configurarCuenta: StateFlow<Boolean> = _configurarCuenta
    private val _navegar = MutableStateFlow("google")
    val navegar: StateFlow<String> = _navegar
    private val _tema = MutableStateFlow("sistema")
    val tema: StateFlow<String> = _tema
    private val _cargada = MutableStateFlow(false)
    val cargada: StateFlow<Boolean> = _cargada
    /** DÓNDE APARQUÉ (30-10-2026): el punto de la furgoneta; se olvida a las 12 horas. Solo en el móvil. */
    private val _furgo = MutableStateFlow<Furgo?>(null)
    val furgo: StateFlow<Furgo?> = _furgo

    suspend fun cargar() {
        val p = ctx.almacen.data.first()
        val guardado = p[kToken]?.takeIf { !caducado(it) }
        val claims = guardado?.let { claims(it) }
        val rol = claims?.get("role")?.jsonPrimitive?.contentOrNull
        val destinoToken = claims?.get("app_destino")?.jsonPrimitive?.contentOrNull
        // Los tokens de conductor no incluyen app_destino; se conserva el destino validado
        // que devolvió /auth/app-login junto a la sesión guardada.
        val destino = p[kDestino] ?: destinoToken
        // Las versiones anteriores guardaban cualquier cuenta admin en la sesión nativa. Al actualizar, vuelve
        // a pedir credenciales una vez y la API la enviará al portal que le corresponde.
        val tokenValido = guardado?.takeIf {
            (rol == "admin" && destino == "reparto") || (rol == "driver" && destino == "conductor")
        }
        if (guardado != null && tokenValido == null) {
            ctx.almacen.edit { it.remove(kToken); it.remove(kDestino); it.remove(kConfigurarCuenta); it.remove(kCentro) }
        }
        _token.value = tokenValido
        _destino.value = if (tokenValido != null) destino else null
        _configurarCuenta.value = tokenValido != null && p[kConfigurarCuenta] == true
        _nombre.value = p[kNombre].orEmpty()
        _correo.value = p[kCorreo].orEmpty()
        _centro.value = p[kCentro].orEmpty()
        _navegar.value = p[kNavegar] ?: "google"
        _tema.value = p[kTema] ?: "sistema"
        _furgo.value = p[kFurgo]?.let { runCatching { JSON.decodeFromString(Furgo.serializer(), it) }.getOrNull() }
            ?.takeIf { System.currentTimeMillis() - it.en < 12 * 3600_000L }
        _cargada.value = true
    }

    suspend fun aparcar(lat: Double, lng: Double) {
        val f = Furgo(lat, lng, System.currentTimeMillis())
        ctx.almacen.edit { it[kFurgo] = JSON.encodeToString(Furgo.serializer(), f) }
        _furgo.value = f
    }

    suspend fun quitarFurgo() { ctx.almacen.edit { it.remove(kFurgo) }; _furgo.value = null }

    suspend fun guardar(s: Sesion, correo: String? = null) {
        ctx.almacen.edit {
            it[kToken] = s.token
            s.app_destino?.let { destino -> it[kDestino] = destino }
            it[kConfigurarCuenta] = s.configurar_cuenta
            it[kNombre] = s.name
            it[kCentro] = s.center.orEmpty()
            if (correo != null) it[kCorreo] = correo
        }
        _token.value = s.token
        _destino.value = s.app_destino ?: claims(s.token)?.get("app_destino")?.jsonPrimitive?.contentOrNull
        _configurarCuenta.value = s.configurar_cuenta
        _nombre.value = s.name
        _centro.value = s.center.orEmpty()
        if (correo != null) _correo.value = correo
    }

    suspend fun cerrar() {
        ctx.almacen.edit { it.remove(kToken); it.remove(kDestino); it.remove(kConfigurarCuenta); it.remove(kCentro); it.remove(kUltimoAviso) }
        _token.value = null
        _destino.value = null
        _configurarCuenta.value = false
        _centro.value = ""
    }

    suspend fun marcarCuentaConfigurada() {
        ctx.almacen.edit { it[kConfigurarCuenta] = false }
        _configurarCuenta.value = false
    }

    suspend fun elegirNavegador(v: String) { ctx.almacen.edit { it[kNavegar] = v }; _navegar.value = v }
    suspend fun elegirTema(v: String) { ctx.almacen.edit { it[kTema] = v }; _tema.value = v }

    /** Hasta qué aviso (su `creado_en`) se ha enseñado ya como notificación (AvisosWorker, Fcm). */
    suspend fun ultimoAviso(): String? = ctx.almacen.data.first()[kUltimoAviso]
    suspend fun guardarUltimoAviso(v: String) { ctx.almacen.edit { it[kUltimoAviso] = v } }

    /** Para que dos cuentas en el mismo móvil no compartan la ruta guardada ni lo pendiente de enviar. */
    fun quien(): String = _token.value?.let { claims(it)?.get("sub")?.jsonPrimitive?.content } ?: ""

    companion object {
        fun claims(token: String) = runCatching {
            val parte = token.split('.')[1]
            val bytes = Base64.decode(parte, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
            JSON.parseToJsonElement(String(bytes, Charsets.UTF_8)).jsonObject
        }.getOrNull()

        /** Segundos que le quedan al token (0 si no se puede leer). */
        fun quedan(token: String): Long {
            val exp = claims(token)?.get("exp")?.jsonPrimitive?.longOrNull ?: return 0
            return exp - System.currentTimeMillis() / 1000
        }

        fun caducado(token: String) = quedan(token) <= 60
    }
}
