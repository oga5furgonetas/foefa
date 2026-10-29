package com.flotadsp.fds.data

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.ui.Notificaciones
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.concurrent.TimeUnit

/** Un aviso a esta persona: turno aprobado o rechazado, vacante para trabajar más, inspección pendiente, la ruta de
 *  la mañana. Los campos, como los manda el servidor (GET /avisos/mios). */
@Serializable
data class Aviso(
    val id: String,
    val titulo: String = "",
    val cuerpo: String = "",
    val url: String = "/conductor",
    val creado_en: String = "",
    val leido_en: String? = null,
)

@Serializable
data class Avisos(val avisos: List<Aviso> = emptyList(), val sin_leer: Int = 0)

/* LOS AVISOS LLEGAN AUNQUE LA APP ESTÉ CERRADA (29-10-2026). Cada 15 minutos (lo mínimo que deja Android) se le
   pregunta al servidor por la bandeja y lo nuevo se enseña como notificación. Si la app lleva su proyecto de
   Firebase, además llegan al instante por FCM (Fcm.kt); esto es la red de seguridad y lo que funciona sin configurar
   nada. Dani (18-10): «mejor notificación de la propia app que WhatsApp». */
class AvisosWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as FdsApp
        app.cuenta.cargar()
        if (app.cuenta.token.value == null) return Result.success()
        return try {
            mostrarNuevos(app)
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        /** Pide la bandeja, enseña como notificación lo que aún no se había enseñado y recuerda hasta dónde. */
        suspend fun mostrarNuevos(app: FdsApp): Avisos {
            val desde = app.cuenta.ultimoAviso()
            val r = app.repo.avisos(desde)
            // La primera vez (sin marca) solo lo de las últimas 24 h: no se avisa de una bandeja vieja de golpe.
            val tope = desde ?: Instant.now().minus(24, ChronoUnit.HOURS).toString()
            r.avisos.filter { it.leido_en == null && it.creado_en > tope }.sortedBy { it.creado_en }
                .forEach { Notificaciones.mostrar(app, it) }
            r.avisos.maxOfOrNull { it.creado_en }?.let { if (desde == null || it > desde) app.cuenta.guardarUltimoAviso(it) }
            return r
        }

        private fun conRed() = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        /** Cada 15 min mientras haya sesión (KEEP: si ya está programado no se duplica). */
        fun programar(ctx: Context) {
            val pedido = PeriodicWorkRequestBuilder<AvisosWorker>(15, TimeUnit.MINUTES)
                .setConstraints(conRed())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 60, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("fds-avisos", ExistingPeriodicWorkPolicy.KEEP, pedido)
        }

        fun parar(ctx: Context) {
            WorkManager.getInstance(ctx).cancelUniqueWork("fds-avisos")
        }
    }
}
