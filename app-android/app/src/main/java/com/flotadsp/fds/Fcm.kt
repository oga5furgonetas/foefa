package com.flotadsp.fds

import android.content.Context
import com.flotadsp.fds.data.Aviso
import com.flotadsp.fds.ui.Notificaciones
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/* AVISOS AL INSTANTE (FCM), SOLO SI LA APP LLEVA SU PROYECTO DE FIREBASE (29-10-2026). Sin `google-services.json`:
   los cuatro datos del proyecto entran al compilar (-PfcmAppId… o FDS_FCM_APP_ID, FDS_FCM_API_KEY, FDS_FCM_PROJECT_ID
   y FDS_FCM_SENDER_ID; en el CI, secretos del repositorio) y Firebase se arranca a mano. Sin ellos no se arranca nada
   y la app sigue preguntando por su bandeja cada 15 min (AvisosWorker): las dos vías pintan el mismo aviso con el mismo
   id, así que nunca sale dos veces. En el servidor hace falta FCM_SERVICE_ACCOUNT_JSON. */
object Fcm {
    val disponible: Boolean
        get() = BuildConfig.FCM_APP_ID.isNotBlank() && BuildConfig.FCM_PROJECT_ID.isNotBlank() && BuildConfig.FCM_API_KEY.isNotBlank()

    fun iniciar(ctx: Context) {
        if (!disponible || FirebaseApp.getApps(ctx).isNotEmpty()) return
        runCatching {
            FirebaseApp.initializeApp(ctx, FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.FCM_APP_ID)
                .setApiKey(BuildConfig.FCM_API_KEY)
                .setProjectId(BuildConfig.FCM_PROJECT_ID)
                .setGcmSenderId(BuildConfig.FCM_SENDER_ID)
                .build())
        }
    }

    /** El token de este móvil, o null si FCM no está disponible (o Google no contesta). */
    suspend fun token(): String? =
        if (!disponible) null else runCatching { FirebaseMessaging.getInstance().token.await() }.getOrNull()
}

class FdsMessaging : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        val app = application as FdsApp
        app.ambito.launch {
            app.cuenta.cargar()
            if (app.cuenta.token.value != null) app.repo.registrarMovil(token)
        }
    }

    override fun onMessageReceived(m: RemoteMessage) {
        val d = m.data
        val app = application as FdsApp
        val aviso = Aviso(
            id = d["id"] ?: m.messageId ?: System.currentTimeMillis().toString(),
            titulo = d["titulo"] ?: m.notification?.title.orEmpty(),
            cuerpo = d["cuerpo"] ?: m.notification?.body.orEmpty(),
            url = d["url"] ?: "/conductor",
            creado_en = d["creado_en"].orEmpty(),
        )
        Notificaciones.mostrar(this, aviso)
        // Que la comprobación de cada 15 min no lo vuelva a enseñar.
        if (aviso.creado_en.isNotBlank()) app.ambito.launch {
            app.cuenta.cargar()
            val ultimo = app.cuenta.ultimoAviso()
            if (ultimo == null || aviso.creado_en > ultimo) app.cuenta.guardarUltimoAviso(aviso.creado_en)
        }
    }
}
