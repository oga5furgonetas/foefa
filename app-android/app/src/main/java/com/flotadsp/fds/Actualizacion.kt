package com.flotadsp.fds

import com.flotadsp.fds.ui.tx
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.flotadsp.fds.data.Repositorio
import com.flotadsp.fds.ui.Acciones
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

/* LA APP SE ACTUALIZA SOLA (29-10-2026, Dani: «que les pida la actualización»).
   · La de Google Play: la propia tienda (In-App Updates). Al abrir la app, si Play tiene una versión más nueva,
     Play pregunta y la descarga en segundo plano; cuando está, un aviso abajo con «Reiniciar». Si la versión se
     publicó como urgente (prioridad 4 o 5 en Play Console), se actualiza a pantalla completa antes de seguir.
   · La que se instaló desde la web (paquete .web, fuera de Play): Play no la conoce. Pregunta al servidor
     (GET /app/version, lo que diga APP_ANDROID_WEB) y, si hay una más nueva, un aviso con «Descargar». Android
     no deja instalar nada sin que la persona lo acepte: el aviso lleva a la página de instalar. */
class Actualizacion(private val activity: ComponentActivity) {
    private val play: AppUpdateManager = AppUpdateManagerFactory.create(activity)
    private val lanzador: ActivityResultLauncher<IntentSenderRequest> =
        activity.registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) {}
    private var escuchando = false
    private val oyente = InstallStateUpdatedListener { st -> if (st.installStatus() == InstallStatus.DOWNLOADED) lista = true }

    /** La descarga de Play ya está: solo falta reiniciar. */
    var lista by mutableStateOf(false)
        private set
    /** Hay una versión más nueva para descargar de la web (su nombre); solo en la app instalada fuera de Play. */
    var enLaWeb by mutableStateOf<String?>(null)
        private set

    /** La de Play es la que no lleva sufijo de paquete: la .web viene de la web y la .debug, del PC. */
    val desdePlay: Boolean get() = BuildConfig.APPLICATION_ID == "com.flotadsp.flota"

    /** Al abrir y al volver a la app: ¿hay una versión nueva en Play? */
    fun comprobar() {
        if (!desdePlay) return
        if (!escuchando) { play.registerListener(oyente); escuchando = true }
        play.appUpdateInfo.addOnSuccessListener { info ->
            when {
                info.installStatus() == InstallStatus.DOWNLOADED -> lista = true
                info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE -> {
                    val tipo = when {
                        info.updatePriority() >= 4 && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) -> AppUpdateType.IMMEDIATE
                        info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> AppUpdateType.FLEXIBLE
                        else -> return@addOnSuccessListener
                    }
                    runCatching { play.startUpdateFlowForResult(info, lanzador, AppUpdateOptions.newBuilder(tipo).build()) }
                }
                // Una urgente que se quedó a medias (la persona salió de la pantalla de Play): se retoma.
                info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS ->
                    runCatching { play.startUpdateFlowForResult(info, lanzador, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()) }
            }
        }
    }

    /** La instalada desde la web: pregunta al servidor si hay otra más nueva. Sin red o sin aviso, nada. */
    suspend fun comprobarEnLaWeb(repo: Repositorio) {
        if (desdePlay) return
        val v = runCatching { repo.versionWeb() }.getOrNull() ?: return
        if (v.code > BuildConfig.VERSION_CODE) enLaWeb = v.nombre
    }

    fun instalar() { play.completeUpdate() }
    fun soltar() { if (escuchando) runCatching { play.unregisterListener(oyente) }; escuchando = false }
}

/** El aviso de abajo: «Actualización descargada · Reiniciar» o «Hay una versión nueva · Descargar». */
@Composable
fun AvisoActualizacion(a: Actualizacion, modifier: Modifier = Modifier) {
    val ctx = LocalContext.current
    val texto = when {
        a.lista -> tx("Actualización de FDS descargada.")
        a.enLaWeb != null -> tx("Hay una versión nueva de FDS ({v}).", "v" to a.enLaWeb)
        else -> return
    }
    Surface(color = MaterialTheme.colorScheme.inverseSurface, contentColor = MaterialTheme.colorScheme.inverseOnSurface,
        shape = MaterialTheme.shapes.medium, modifier = modifier.navigationBarsPadding().padding(16.dp)) {
        Row(Modifier.padding(start = 16.dp, top = 4.dp, bottom = 4.dp, end = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(texto, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            TextButton(
                onClick = { if (a.lista) a.instalar() else Acciones.abrirWeb(ctx, "${BuildConfig.WEB_URL}/app") },
                colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.inversePrimary),
            ) { Text(if (a.lista) "Reiniciar" else "Descargar") }
        }
    }
}
