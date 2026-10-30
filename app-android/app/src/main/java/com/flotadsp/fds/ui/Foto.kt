package com.flotadsp.fds.ui

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat

val SIN_CAMARA: String get() = tx("Sin permiso de cámara no se puede hacer la foto. Actívalo en Ajustes › Aplicaciones › FDS › Permisos.")

/* HACER UNA FOTO CON LA CÁMARA DEL MÓVIL (25-10-2026).
   La app declara el permiso de cámara (lo usa el escáner) y, entonces, Android NO deja abrir la cámara del sistema
   sin él: con la cámara denegada, «Foto de la entrega» y «Leer la etiqueta con una foto» daban SecurityException y la
   app se cerraba (visto en el emulador). Aquí se pide el permiso antes y, si no lo da, se avisa en vez de cerrarse. */
@Composable
fun rememberHacerFoto(uri: Uri, alAvisar: (String) -> Unit, alHacer: (Boolean) -> Unit): () -> Unit {
    val ctx = LocalContext.current
    val avisar by rememberUpdatedState(alAvisar)
    val camara = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture(), alHacer)
    val abrir = {
        try { camara.launch(uri) } catch (_: ActivityNotFoundException) { avisar(tx("Este móvil no tiene una app de cámara para hacer la foto.")) }
    }
    val permiso = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> if (ok) abrir() else avisar(SIN_CAMARA) }
    return remember(uri) {
        {
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) abrir()
            else permiso.launch(Manifest.permission.CAMERA)
        }
    }
}
