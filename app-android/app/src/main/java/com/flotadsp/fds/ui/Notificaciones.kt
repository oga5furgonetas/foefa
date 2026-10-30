package com.flotadsp.fds.ui

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.flotadsp.fds.MainActivity
import com.flotadsp.fds.R
import com.flotadsp.fds.data.Aviso

/** Las notificaciones de la app: un canal («Avisos») y cómo se pinta un aviso. Tocarla abre la app en lo que toca. */
object Notificaciones {
    const val CANAL = "avisos"
    const val EXTRA_URL = "aviso_url"
    const val EXTRA_ID = "aviso_id"

    fun canal(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CANAL) == null) {
            nm.createNotificationChannel(NotificationChannel(CANAL, tx("Avisos"), NotificationManager.IMPORTANCE_HIGH).apply {
                description = tx("Turnos aprobados, vacantes para trabajar más, inspección pendiente y la ruta del día")
            })
        }
    }

    /** En Android 13+ hay que pedir permiso; antes, se pueden mostrar sin más. */
    fun permitidas(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 33 || ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun mostrar(ctx: Context, a: Aviso) {
        if (!permitidas(ctx)) return
        canal(ctx)
        // Sin `data` en el intent: un enlace /conductor abriría el portal web de empresa (MainActivity.leerEnlace);
        // lo que toca abrir va en los extras y lo decide la pantalla.
        val abrir = Intent(ctx, MainActivity::class.java).apply {
            putExtra(EXTRA_URL, a.url)
            putExtra(EXTRA_ID, a.id)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendiente = PendingIntent.getActivity(ctx, a.id.hashCode(), abrir,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(ctx, CANAL)
            .setSmallIcon(R.drawable.ic_launcher_mono)
            .setContentTitle(a.titulo.ifBlank { "FDS" })
            .setContentText(a.cuerpo)
            .setStyle(NotificationCompat.BigTextStyle().bigText(a.cuerpo))
            .setContentIntent(pendiente)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        // El mismo aviso (por FCM y por la comprobación de cada 15 min) usa el mismo id: no sale dos veces.
        try { NotificationManagerCompat.from(ctx).notify(a.id.hashCode(), n) } catch (_: SecurityException) { }
    }
}
