package com.flotadsp.fds.ui

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.widget.Toast
import com.flotadsp.fds.data.Parada
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

/* LO QUE LA APP PIDE A OTRAS APPS DEL MÓVIL: navegar (Google Maps o Waze, como Circuit o Spoke), llamar,
   WhatsApp y compartir. Si la app no está, se dice; nunca se queda el botón sin hacer nada. */
object Acciones {
    fun navegar(ctx: Context, p: Parada, con: String) {
        val destino = if (p.ubicada) "${p.lat},${p.lng}" else listOf(p.direccion, p.cp, p.localidad).filter { it.isNotBlank() }.joinToString(", ")
        val intento = if (con == "waze") {
            val q = if (p.ubicada) "ll=${p.lat},${p.lng}" else "q=${Uri.encode(destino)}"
            Intent(Intent.ACTION_VIEW, Uri.parse("https://waze.com/ul?$q&navigate=yes")).setPackage("com.waze")
        } else {
            Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=${Uri.encode(destino)}&mode=d")).setPackage("com.google.android.apps.maps")
        }
        try {
            ctx.startActivity(intento.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: ActivityNotFoundException) {
            // Sin esa app: cualquier mapa del móvil (geo:), y si no hay ninguno, se dice.
            try {
                ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${Uri.encode(destino)}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (_: ActivityNotFoundException) {
                Toast.makeText(ctx, tx("No hay ninguna app de mapas en el móvil."), Toast.LENGTH_LONG).show()
            }
        }
    }

    fun llamar(ctx: Context, telefono: String) {
        runCatching { ctx.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$telefono")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            .onFailure { Toast.makeText(ctx, tx("Este móvil no puede llamar."), Toast.LENGTH_LONG).show() }
    }

    /** WhatsApp al cliente, con el prefijo del país si el número no lo trae. */
    fun whatsapp(ctx: Context, telefono: String, prefijo: String, texto: String) {
        val num = telefono.filter { it.isDigit() }.let { if (telefono.trim().startsWith("+") || it.length > 10) it else "$prefijo$it" }
        try {
            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$num?text=${Uri.encode(texto)}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(ctx, tx("WhatsApp no está instalado."), Toast.LENGTH_LONG).show()
        }
    }

    fun compartir(ctx: Context, texto: String) {
        val i = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto)
        ctx.startActivity(Intent.createChooser(i, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun abrirWeb(ctx: Context, url: String) {
        runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }

    /** Una vibración corta al leer un código o entregar: se nota con el móvil en la mano y sin mirar. */
    fun vibrar(ctx: Context, ms: Long = 40) {
        val v: Vibrator? = if (Build.VERSION.SDK_INT >= 31) (ctx.getSystemService(VibratorManager::class.java))?.defaultVibrator
        else @Suppress("DEPRECATION") ctx.getSystemService(Vibrator::class.java)
        runCatching { v?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)) }
    }

    /** DÓNDE APARQUÉ (30-10-2026): el camino a pie hasta la furgoneta, en Google Maps o en la app de mapas que haya. */
    fun irAPie(ctx: Context, lat: Double, lng: Double) {
        val maps = Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=$lat,$lng&mode=w")).setPackage("com.google.android.apps.maps")
        val cualquiera = Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lng?q=$lat,$lng(Tu furgoneta)"))
        try { ctx.startActivity(maps) } catch (_: ActivityNotFoundException) {
            try { ctx.startActivity(cualquiera) } catch (_: ActivityNotFoundException) { Toast.makeText(ctx, tx("No hay ninguna app de mapas en el móvil."), Toast.LENGTH_LONG).show() }
        }
    }

    /** La posición con su precisión en metros, en 3,5 s como mucho: para la puerta aprendida al entregar (30-10-2026).
     *  Sin permiso o sin GPS, null, y la entrega sale igual. */
    @SuppressLint("MissingPermission")
    suspend fun posicionPrecisa(ctx: Context): Triple<Double, Double, Float>? = withTimeoutOrNull(3500) {
        runCatching {
            val c = LocationServices.getFusedLocationProviderClient(ctx)
            val l = c.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token).await()
                ?: c.lastLocation.await()
            l?.let { Triple(it.latitude, it.longitude, if (it.hasAccuracy()) it.accuracy else 9999f) }
        }.getOrNull()
    }

    /** Dónde está el móvil ahora (solo si dio permiso), en 6 s como mucho; si no, null (se ordena desde su base). */
    @SuppressLint("MissingPermission")
    suspend fun dondeEstoy(ctx: Context): Pair<Double, Double>? = withTimeoutOrNull(6000) {
        runCatching {
            val c = LocationServices.getFusedLocationProviderClient(ctx)
            val l = c.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, CancellationTokenSource().token).await()
                ?: c.lastLocation.await()
            l?.let { it.latitude to it.longitude }
        }.getOrNull()
    }
}
