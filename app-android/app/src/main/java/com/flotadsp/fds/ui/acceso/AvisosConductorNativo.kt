package com.flotadsp.fds.ui.acceso

import com.flotadsp.fds.ui.tx
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.Aviso
import com.flotadsp.fds.ui.LOCALE_APP
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

/** La bandeja de avisos del conductor (29-10-2026): lo que la oficina y el servidor le han dicho, con su fecha.
 *  Al abrirla, lo que había sin leer queda leído (y la tarjeta de inicio deja de marcarlo). */
@Composable
fun AvisosConductorNativo(alVolver: () -> Unit, alAbrir: (Aviso) -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    var lista by remember { mutableStateOf<List<Aviso>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var intento by remember { mutableStateOf(0) }
    BackHandler(onBack = alVolver)
    LaunchedEffect(intento) {
        error = null
        runCatching { app.repo.avisos() }.onSuccess { r ->
            lista = r.avisos
            val sinLeer = r.avisos.filter { it.leido_en == null }.map { it.id }
            runCatching { app.repo.avisosLeidos(sinLeer) }
        }.onFailure { error = it.message ?: tx("No se han podido cargar los avisos.") }
    }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(tx("Avisos")) },
                navigationIcon = { IconButton(onClick = alVolver) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = tx("Volver")) } },
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { pad ->
        val l = lista
        when {
            error != null -> Column(Modifier.fillMaxSize().padding(pad).padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center) {
                Text(error.orEmpty(), style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.height(16.dp))
                Button(onClick = { intento++ }) { Text(tx("Reintentar")) }
            }
            l == null -> Box(Modifier.fillMaxSize().padding(pad), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            l.isEmpty() -> Column(Modifier.fillMaxSize().padding(pad).padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center) {
                Icon(Icons.Default.NotificationsNone, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                Text(tx("Sin avisos todavía"), style = MaterialTheme.typography.titleMedium)
                Text(tx("Aquí verás los turnos que te aprueben, las vacantes para trabajar más y lo que te pida la oficina."),
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            else -> LazyColumn(
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxSize().padding(pad),
            ) {
                items(l, key = { it.id }) { a ->
                    Card(
                        onClick = { alAbrir(a) },
                        colors = CardDefaults.cardColors(containerColor = if (a.leido_en == null) MaterialTheme.colorScheme.primaryContainer
                            else MaterialTheme.colorScheme.surfaceContainerLowest),
                    ) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(a.titulo, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleMedium)
                            if (a.cuerpo.isNotBlank()) Text(a.cuerpo, style = MaterialTheme.typography.bodyMedium)
                            Text(fechaDeAviso(a.creado_en), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}

/** «29 oct, 18:20» en la hora del móvil; si la fecha no se entiende, tal cual. */
internal fun fechaDeAviso(iso: String): String = runCatching {
    OffsetDateTime.parse(iso).atZoneSameInstant(java.time.ZoneId.systemDefault())
        .format(DateTimeFormatter.ofPattern("d MMM, HH:mm", LOCALE_APP))
}.getOrDefault(iso)

/** A qué pantalla del portal lleva un aviso, por su título o por su enlace (el mismo que usa la web). */
internal fun destinoDeAviso(url: String, titulo: String = ""): String = when {
    titulo.contains("Inspecci", ignoreCase = true) -> "auditoria"
    titulo.contains("Refuerzo", ignoreCase = true) || titulo.contains("Día extra", ignoreCase = true) || url.contains("vista=extra") -> "extras"
    url.contains("vista=ruta") || url.startsWith("/ruta") -> "ruta"
    titulo.contains("petici", ignoreCase = true) -> "turnos"
    else -> "avisos"
}
