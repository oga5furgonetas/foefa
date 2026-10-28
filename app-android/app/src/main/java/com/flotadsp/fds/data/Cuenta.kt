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
    private val kNavegar = stringPreferencesKey("navegar")
    private val kTema = stringPreferencesKey("tema")

    private val _token = MutableStateFlow<String?>(null)
    val token: StateFlow<String?> = _token
    private val _nombre = MutableStateFlow("")
    val nombre: StateFlow<String> = _nombre
    private val _correo = MutableStateFlow("")
    val correo: StateFlow<String> = _correo
    private val _navegar = MutableStateFlow("google")
    val navegar: StateFlow<String> = _navegar
    private val _tema = MutableStateFlow("sistema")
    val tema: StateFlow<String> = _tema
    private val _cargada = MutableStateFlow(false)
    val cargada: StateFlow<Boolean> = _cargada

    suspend fun cargar() {
        val p = ctx.almacen.data.first()
        val guardado = p[kToken]?.takeIf { !caducado(it) }
        val claims = guardado?.let { claims(it) }
        val rol = claims?.get("role")?.jsonPrimitive?.contentOrNull
        val destino = claims?.get("app_destino")?.jsonPrimitive?.contentOrNull
        // Las versiones anteriores guardaban cualquier cuenta admin en la sesión nativa. Al actualizar, vuelve
        // a pedir credenciales una vez y la API la enviará al portal que le corresponde.
        val tokenDeReparto = guardado?.takeIf { rol == "admin" && destino == "reparto" }
        if (guardado != null && tokenDeReparto == null) {
            ctx.almacen.edit { it.remove(kToken) }
        }
        _token.value = tokenDeReparto
        _nombre.value = p[kNombre].orEmpty()
        _correo.value = p[kCorreo].orEmpty()
        _navegar.value = p[kNavegar] ?: "google"
        _tema.value = p[kTema] ?: "sistema"
        _cargada.value = true
    }

    suspend fun guardar(s: Sesion, correo: String? = null) {
        ctx.almacen.edit {
            it[kToken] = s.token
            it[kNombre] = s.name
            if (correo != null) it[kCorreo] = correo
        }
        _token.value = s.token
        _nombre.value = s.name
        if (correo != null) _correo.value = correo
    }

    suspend fun cerrar() {
        ctx.almacen.edit { it.remove(kToken) }
        _token.value = null
    }

    suspend fun elegirNavegador(v: String) { ctx.almacen.edit { it[kNavegar] = v }; _navegar.value = v }
    suspend fun elegirTema(v: String) { ctx.almacen.edit { it[kTema] = v }; _tema.value = v }

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
