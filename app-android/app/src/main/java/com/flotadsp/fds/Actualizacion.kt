package com.flotadsp.fds

import com.flotadsp.fds.ui.tx
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
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
import androidx.compose.ui.window.DialogProperties
import com.flotadsp.fds.data.Repositorio
import com.flotadsp.fds.ui.Acciones
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

/* LA APP PIDE ACTUALIZARSE (29-10-2026, Dani: «que les pida la actualización»; 30-10: «que al entrar les salte
   "actualización disponible" con un botón que los lleve a Google Play»).
   · Al abrir la app, si hay una versión más nueva, un DIÁLOGO en el centro: «Actualización disponible», con el botón
     «Actualizar en Google Play» (la de Play) o «Descargar la nueva» (la instalada desde la web) y «Ahora no». Si el
     servidor exige esa versión (APP_ANDROID_MIN) o Play la publicó como urgente (prioridad 4 o 5), sin «Ahora no».
   · La de Google Play: lo dice la propia tienda (In-App Updates) y, además, el servidor (APP_ANDROID_PLAY, que Dani
     pone cuando Play ya la sirve). «Actualizar» abre la actualización de Play a pantalla completa (descarga, instala
     y reinicia sin salir de la app); si Play no la ofrece, la ficha de la app en la tienda.
   · La que se instaló desde la web (paquete .web, fuera de Play): Play no la conoce. El servidor dice qué versión
     hay (APP_ANDROID_WEB) y «Descargar» lleva a la página de instalar. Android no instala nada sin que la persona
     lo acepte.
   · Abajo queda el aviso pequeño de siempre: «Actualización descargada · Reiniciar» (Play, descarga en segundo
     plano) o «Hay una versión nueva · Descargar» (web), para quien dijo «Ahora no». */
class Actualizacion(private val activity: ComponentActivity) {
    private val play: AppUpdateManager = AppUpdateManagerFactory.create(activity)
    private val lanzador: ActivityResultLauncher<IntentSenderRequest> =
        activity.registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) {}
    private var escuchando = false
    private val oyente = InstallStateUpdatedListener { st -> if (st.installStatus() == InstallStatus.DOWNLOADED) lista = true }
    private var infoPlay: AppUpdateInfo? = null
    /** El diálogo salta una vez por arranque: al volver a abrir la app, otra vez (hasta que actualice). */
    private var avisada = false

    /** La descarga de Play ya está: solo falta reiniciar. */
    var lista by mutableStateOf(false)
        private set
    /** Hay una versión más nueva para descargar de la web (su nombre); solo en la app instalada fuera de Play. */
    var enLaWeb by mutableStateOf<String?>(null)
        private set
    /** El diálogo de entrada: el nombre de la versión nueva ("" si no se sabe), o null si no hay nada que avisar. */
    var disponible by mutableStateOf<String?>(null)
        private set
    /** Sin «Ahora no»: el servidor exige una versión más nueva (APP_ANDROID_MIN) o Play la publicó como urgente. */
    var obligatoria by mutableStateOf(false)
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
                    infoPlay = info
                    if (info.updatePriority() >= 4) obligatoria = true
                    avisar("")
                }
                // Una urgente que se quedó a medias (la persona salió de la pantalla de Play): se retoma.
                info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS ->
                    runCatching { play.startUpdateFlowForResult(info, lanzador, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()) }
            }
        }
    }

    /** Lo que anuncia el servidor: la versión de la web, la de Play y la mínima que admite. Sin red, nada. */
    suspend fun comprobarEnElServidor(repo: Repositorio) {
        val v = runCatching { repo.versiones() }.getOrNull() ?: return
        val vieja = v.min?.let { masVieja(BuildConfig.VERSION_NAME, it) } == true
        if (desdePlay) {
            // Solo se exige cuando Play ya la ofrece: si no, no habría forma de actualizar y la persona se quedaría fuera.
            if (vieja && infoPlay != null) obligatoria = true
            v.play?.takeIf { it.code > BuildConfig.VERSION_CODE }?.let { avisar(it.nombre) }
            return
        }
        val w = v.web?.takeIf { it.code > BuildConfig.VERSION_CODE } ?: return
        enLaWeb = w.nombre
        if (vieja) obligatoria = true
        avisar(w.nombre)
    }

    /** El botón del diálogo: la actualización de Play (a pantalla completa si se puede), la tienda, o la web. */
    fun actualizar(ctx: Context) {
        if (desdePlay) {
            val info = infoPlay
            val tipo = when {
                info == null -> null
                info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) -> AppUpdateType.IMMEDIATE
                info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> AppUpdateType.FLEXIBLE
                else -> null
            }
            val lanzada = info != null && tipo != null &&
                runCatching { play.startUpdateFlowForResult(info, lanzador, AppUpdateOptions.newBuilder(tipo).build()) }.isSuccess
            if (!lanzada) abrirTienda(ctx)
        } else {
            Acciones.abrirWeb(ctx, "${BuildConfig.WEB_URL}/app")
        }
        if (!obligatoria) disponible = null
    }

    fun descartar() { disponible = null }
    fun instalar() { play.completeUpdate() }
    fun soltar() { if (escuchando) runCatching { play.unregisterListener(oyente) }; escuchando = false }

    private fun avisar(nombre: String) {
        if (avisada) return
        avisada = true
        disponible = nombre
    }

    private fun abrirTienda(ctx: Context) {
        val id = BuildConfig.APPLICATION_ID
        val tienda = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$id")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { ctx.startActivity(tienda) }
            .onFailure { Acciones.abrirWeb(ctx, "https://play.google.com/store/apps/details?id=$id") }
    }

    private fun tupla(v: String): List<Int> = Regex("\\d+").findAll(v).map { it.value.toInt() }.take(4).toList()

    /** «2.4.0-debug» es más vieja que «2.4.1»; sin números, no se sabe y no se exige nada. */
    private fun masVieja(actual: String, minima: String): Boolean {
        val a = tupla(actual)
        val m = tupla(minima)
        if (a.isEmpty() || m.isEmpty()) return false
        for (i in 0 until maxOf(a.size, m.size)) {
            val x = a.getOrElse(i) { 0 }
            val y = m.getOrElse(i) { 0 }
            if (x != y) return x < y
        }
        return false
    }
}

/** El diálogo de entrada: «Actualización disponible», con el botón a Google Play (o a la descarga) y «Ahora no». */
@Composable
fun DialogoActualizacion(a: Actualizacion) {
    val v = a.disponible ?: return
    val ctx = LocalContext.current
    val texto = buildString {
        append(if (v.isNotBlank()) tx("FDS {v} ya está lista.", "v" to v) else tx("Hay una versión nueva de FDS."))
        append(' ')
        append(tx("Actualiza para tener las mejoras y que todo siga funcionando."))
        if (a.obligatoria) { append(' '); append(tx("Esta versión ya no sirve: hace falta actualizar para seguir.")) }
    }
    val ahoraNo: (@Composable () -> Unit)? = if (a.obligatoria) null else {
        { TextButton(onClick = { a.descartar() }) { Text(tx("Ahora no")) } }
    }
    AlertDialog(
        onDismissRequest = { if (!a.obligatoria) a.descartar() },
        properties = DialogProperties(dismissOnBackPress = !a.obligatoria, dismissOnClickOutside = !a.obligatoria),
        icon = { Icon(Icons.Default.SystemUpdate, contentDescription = null) },
        title = { Text(tx("Actualización disponible")) },
        text = { Text(texto) },
        confirmButton = {
            Button(onClick = { a.actualizar(ctx) }) { Text(if (a.desdePlay) tx("Actualizar en Google Play") else tx("Descargar la nueva")) }
        },
        dismissButton = ahoraNo,
    )
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
            ) { Text(if (a.lista) tx("Reiniciar") else tx("Descargar")) }
        }
    }
}
