package com.flotadsp.fds.data

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.flotadsp.fds.FdsApp
import java.util.concurrent.TimeUnit

/* LO HECHO SIN COBERTURA SE ENVÍA SOLO, aunque la app esté cerrada: Android lo lanza en cuanto vuelve la red
   (WorkManager, con la condición «hay red»). Si el servidor no contesta, lo reintenta más tarde. */
class EnvioWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val repo = (applicationContext as FdsApp).repo
        repo.cuenta.cargar()
        return try {
            repo.vaciarCola()
            if (repo.pendientes.value.any { it.quien == repo.cuenta.quien() }) Result.retry() else Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        fun programar(ctx: Context) {
            val pedido = OneTimeWorkRequestBuilder<EnvioWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(ctx).enqueueUniqueWork("fds-envio", ExistingWorkPolicy.KEEP, pedido)
        }
    }
}
