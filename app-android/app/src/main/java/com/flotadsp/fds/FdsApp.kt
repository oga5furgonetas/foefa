package com.flotadsp.fds

import android.app.Application
import com.flotadsp.fds.data.Api
import com.flotadsp.fds.data.Cuenta
import com.flotadsp.fds.data.Repositorio
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import org.osmdroid.config.Configuration

class FdsApp : Application() {
    val ambito = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    lateinit var cuenta: Cuenta
    lateinit var repo: Repositorio

    // Avisa a la pantalla de que la sesión ha caducado (401): vuelve a la de entrar.
    private val _caducada = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val caducada: SharedFlow<Unit> = _caducada

    override fun onCreate() {
        super.onCreate()
        cuenta = Cuenta(this)
        val api = Api(token = { cuenta.token.value }, alCaducar = {
            ambito.launch { cuenta.cerrar(); _caducada.tryEmit(Unit) }
        })
        repo = Repositorio(this, cuenta, api)
        // El mapa (OpenStreetMap) pide que cada app se identifique y guarda sus teselas en la caché de la app.
        Configuration.getInstance().apply {
            userAgentValue = "FDS-Android/${BuildConfig.VERSION_NAME} (contacto: flotadsp.com)"
            osmdroidBasePath = cacheDir
            osmdroidTileCache = cacheDir.resolve("teselas")
        }
    }
}
