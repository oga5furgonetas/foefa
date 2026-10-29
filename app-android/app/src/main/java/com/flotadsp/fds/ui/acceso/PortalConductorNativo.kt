package com.flotadsp.fds.ui.acceso

import android.Manifest
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Route
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.Fcm
import com.flotadsp.fds.data.AvisosWorker
import com.flotadsp.fds.ui.Notificaciones
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.etiqueta.Lectura
import com.flotadsp.fds.ui.Region
import com.flotadsp.fds.ui.escaner.EscanerPantalla
import com.flotadsp.fds.ui.escaner.VueltaDeRevisar
import com.flotadsp.fds.ui.hoy.HoyPantalla
import com.flotadsp.fds.ui.hoy.RutaVM
import com.flotadsp.fds.ui.parada.FichaParada
import kotlinx.coroutines.launch
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

/** Entrada nativa del portal de conductor de empresa. Cada acción usa el token de esa ficha. */
@Composable
fun PortalConductorNativo(alCerrar: () -> Unit, abrir: String? = null, alAbierto: () -> Unit = {}) {
    val ctx = LocalContext.current
    val app = ctx.applicationContext as FdsApp
    val obligatoria by app.cuenta.configurarCuenta.collectAsState()
    var pantalla by rememberSaveable { mutableStateOf("inicio") }
    var aviso by rememberSaveable { mutableStateOf<String?>(null) }
    // Cerrar sesión pregunta antes (29-10-2026): el icono está arriba a la derecha y un toque de más dejaba al
    // conductor fuera, a escribir otra vez la contraseña que a lo mejor no se sabe.
    var confirmarSalir by remember { mutableStateOf(false) }
    val salir = { confirmarSalir = true }
    LaunchedEffect(pantalla) { app.repo.vista("/conductor/p/$pantalla") }
    // AVISOS (29-10-2026): el permiso (Android 13+), la comprobación cada 15 min aunque la app esté cerrada y este
    // móvil apuntado en el servidor (con token de FCM si la app lo lleva). Y cuántos hay sin leer, para la tarjeta.
    val pedirAvisos = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    var sinLeer by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33 && !Notificaciones.permitidas(ctx)) pedirAvisos.launch(Manifest.permission.POST_NOTIFICATIONS)
        AvisosWorker.programar(ctx)
        app.repo.registrarMovil(Fcm.token())
    }
    LaunchedEffect(pantalla) { if (pantalla == "inicio") runCatching { app.repo.avisos() }.onSuccess { sinLeer = it.sin_leer } }
    // Un aviso tocado en la barra de notificaciones abre lo que toca.
    LaunchedEffect(abrir) { if (abrir != null) { pantalla = destinoDeAviso(abrir); alAbierto() } }
    if (confirmarSalir) AlertDialog(
        onDismissRequest = { confirmarSalir = false },
        title = { Text("¿Cerrar sesión?") },
        text = { Text("Para volver a entrar necesitarás tu correo y tu contraseña.") },
        confirmButton = { TextButton(onClick = { confirmarSalir = false; alCerrar() }) { Text("Cerrar sesión") } },
        dismissButton = { TextButton(onClick = { confirmarSalir = false }) { Text("Seguir dentro") } },
    )

    if (obligatoria) {
        CambiarClaveConductor(obligatoria = true, alVolver = {}, alGuardada = {
            pantalla = "correo"
        })
        return
    }

    when (pantalla) {
        "auditoria" -> AuditoriaConductorNativa(
            alVolver = { pantalla = "inicio" },
            alCompletar = { pantalla = "inicio"; aviso = "Auditoría enviada correctamente." },
        )
        "avisos" -> AvisosConductorNativo(alVolver = { pantalla = "inicio" }, alAbrir = { a -> pantalla = destinoDeAviso(a.url, a.titulo).takeIf { it != "avisos" } ?: "avisos" })
        "turnos" -> TurnosConductorNativo(alVolver = { pantalla = "inicio" })
        "extras" -> ExtrasConductorNativos(alVolver = { pantalla = "inicio" })
        "referidos" -> ReferidosConductorNativo(alVolver = { pantalla = "inicio" })
        "ruta" -> {
            val vm: RutaVM = viewModel()
            RutaConductorNativa(vm, alVolver = { pantalla = "inicio" })
        }
        "clave" -> CambiarClaveConductor(obligatoria = false,
            alVolver = { pantalla = "cuenta" }, alGuardada = { pantalla = "cuenta" })
        "correo" -> CorreoRecuperacionConductor(alVolver = { pantalla = "inicio" })
        "telefono" -> TelefonoConductorNativo(alVolver = { pantalla = "cuenta" }, alGuardado = { pantalla = "cuenta" })
        "cuenta" -> CuentaConductorNativa(
            alVolver = { pantalla = "inicio" },
            alCambiarClave = { pantalla = "clave" },
            alCorreo = { pantalla = "correo" },
            alTelefono = { pantalla = "telefono" },
            alCerrar = salir,
        )
        else -> {
            val vm: RutaVM = viewModel()
            InicioConductorNativo(
                nombre = app.cuenta.nombre.collectAsState().value,
                estadoRuta = vm.estado.collectAsState().value,
                alRuta = { if (vm.estado.value.error != null) vm.cargar(); pantalla = "ruta" },
                alAuditoria = { aviso = null; pantalla = "auditoria" },
                alTurnos = { pantalla = "turnos" },
                alExtras = { pantalla = "extras" },
                alReferidos = { pantalla = "referidos" },
                alCuenta = { pantalla = "cuenta" },
                alAvisos = { pantalla = "avisos" },
                sinLeer = sinLeer,
                alCerrar = salir,
                aviso = aviso,
            )
        }
    }
}

@Composable
private fun InicioConductorNativo(
    nombre: String,
    estadoRuta: com.flotadsp.fds.ui.hoy.EstadoRuta,
    alRuta: () -> Unit,
    alAuditoria: () -> Unit,
    alTurnos: () -> Unit,
    alExtras: () -> Unit,
    alReferidos: () -> Unit,
    alCuenta: () -> Unit,
    alAvisos: () -> Unit,
    sinLeer: Int,
    alCerrar: () -> Unit,
    aviso: String?,
) {
    val pendientes = estadoRuta.pendientes.size
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Hola, ${nombre.substringBefore(' ').ifBlank { "conductor" }}", fontWeight = FontWeight.SemiBold)
                        Text("Portal de conductor", style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                actions = {
                    IconButton(onClick = alCerrar) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Cerrar sesión")
                    }
                },
            )
        },
    ) { inset ->
        Column(
            Modifier.fillMaxSize().padding(inset).verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            aviso?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium) }
            // La bandeja de avisos (29-10-2026): turnos aprobados, vacantes para trabajar más, inspección pendiente.
            Card(onClick = alAvisos, colors = CardDefaults.cardColors(containerColor = if (sinLeer > 0) MaterialTheme.colorScheme.primaryContainer
                else MaterialTheme.colorScheme.surfaceContainerLowest)) {
                Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Icon(Icons.Default.Notifications, contentDescription = null,
                        tint = if (sinLeer > 0) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.primary)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(if (sinLeer > 0) "Tienes $sinLeer ${if (sinLeer == 1) "aviso nuevo" else "avisos nuevos"}" else "Avisos", fontWeight = FontWeight.SemiBold)
                        Text("Turnos aprobados, vacantes para trabajar más y lo que te pida la oficina",
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (sinLeer > 0) Badge { Text("$sinLeer") }
                }
            }
            // «Mi ruta» solo en empresas que reparten con la app: lo dice el servidor (`activo` en reparto/mi-ruta),
            // igual que el portal web. En una flota que reparte para Amazon (OGA5, DGA1, DGA2) la ruta va por otro
            // lado y esta tarjeta solo confundía (Dani, 29-10-2026, probando la 2.2.3 en su móvil).
            if (estadoRuta.ruta?.activo == true) Card(
                onClick = alRuta,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
            ) {
                Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.Route, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                    Text("Mi ruta", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer)
                    Text(
                        if (pendientes == 0) "No tienes entregas pendientes."
                        else "$pendientes ${if (pendientes == 1) "entrega pendiente" else "entregas pendientes"}",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Button(onClick = alRuta, modifier = Modifier.fillMaxWidth()) { Text("Abrir mi ruta") }
                }
            }

            Card(onClick = alAuditoria, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.onSecondaryContainer)
                    Column(Modifier.weight(1f)) {
                        Text("Auditoría del vehículo", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSecondaryContainer)
                        Text("Fotos, kilómetros y revisión antes de salir", style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSecondaryContainer)
                    }
                    Text("Abrir", color = MaterialTheme.colorScheme.onSecondaryContainer, fontWeight = FontWeight.SemiBold)
                }
            }

            AccesoConductorCard(
                icono = Icons.Default.CalendarMonth,
                titulo = "Mis turnos y días libres",
                detalle = "Consulta el calendario y solicita un cambio",
                alPulsar = alTurnos,
            )

            AccesoConductorCard(
                icono = Icons.Default.CalendarMonth,
                titulo = "Trabajar más",
                detalle = "Vacantes y turnos extra confirmados",
                alPulsar = alExtras,
            )

            AccesoConductorCard(
                icono = Icons.Default.CardGiftcard,
                titulo = "Invita y gana",
                detalle = "Comparte tu enlace y consulta tu cartera",
                alPulsar = alReferidos,
            )

            AccesoConductorCard(
                icono = Icons.Default.Lock,
                titulo = "Mi cuenta",
                detalle = "Contraseña y correo personal de recuperación",
                alPulsar = alCuenta,
            )
        }
    }
}

@Composable
private fun AccesoConductorCard(icono: androidx.compose.ui.graphics.vector.ImageVector, titulo: String,
                                detalle: String, alPulsar: () -> Unit) {
    Card(onClick = alPulsar) {
        Row(Modifier.fillMaxWidth().padding(18.dp), horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Icon(icono, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(titulo, fontWeight = FontWeight.SemiBold)
                Text(detalle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

private sealed interface CapaRutaConductor {
    data class Escaner(val vuelta: VueltaDeRevisar? = null) : CapaRutaConductor
    /** `desdeEscaner`: al cerrar la ficha se vuelve al escáner, que sigue con el mismo escaneo (como en la cuenta
     *  de reparto; hasta el 29-10-2026 el conductor de empresa caía en «Hoy» y tenía que volver a abrirlo). */
    data class Ficha(val inicial: Lectura? = null, val editar: Parada? = null, val desdeEscaner: Boolean = false) : CapaRutaConductor
}

@Composable
private fun RutaConductorNativa(vm: RutaVM, alVolver: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val e by vm.estado.collectAsState()
    val navegar by app.cuenta.navegar.collectAsState()
    var capa by remember { mutableStateOf<CapaRutaConductor?>(null) }
    BackHandler(enabled = capa == null, onBack = alVolver)
    val pais = e.ruta?.pais?.takeIf { it.isNotBlank() } ?: app.repo.paisDelMovil() ?: "es"
    LaunchedEffect(pais) { Region.pais = pais }
    val cerca = e.ruta?.base?.let { b -> if (b.lat != null && b.lng != null) b.lat to b.lng else null }
        ?: e.paradas.firstOrNull { it.ubicada }?.let { it.lat!! to it.lng!! }

    when (val actual = capa) {
        is CapaRutaConductor.Escaner -> EscanerPantalla(
            pais = pais,
            vuelta = actual.vuelta,
            alCerrar = { cambios -> capa = null; if (cambios) vm.refrescarSinRuido() },
            alRevisar = { lectura -> capa = CapaRutaConductor.Ficha(inicial = lectura, desdeEscaner = true) },
        )
        is CapaRutaConductor.Ficha -> FichaParada(
            pais = pais,
            cerca = cerca,
            inicial = actual.inicial,
            editar = actual.editar,
            alCerrar = { guardada ->
                if (guardada) vm.refrescarSinRuido()
                if (guardada && !actual.desdeEscaner) vm.avisar(if (actual.editar != null) "Cambios guardados." else "Añadida a tu ruta.")
                capa = if (actual.desdeEscaner) CapaRutaConductor.Escaner(VueltaDeRevisar(guardada)) else null
            },
        )
        null -> HoyPantalla(
            vm = vm,
            navegarCon = navegar,
            alEscanear = { capa = CapaRutaConductor.Escaner() },
            alAnadir = { capa = CapaRutaConductor.Ficha() },
            alEditar = { parada -> capa = CapaRutaConductor.Ficha(editar = parada) },
        )
    }
}

@Composable
private fun CuentaConductorNativa(alVolver: () -> Unit, alCambiarClave: () -> Unit,
                                  alCorreo: () -> Unit, alTelefono: () -> Unit, alCerrar: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val ambito = rememberCoroutineScope()
    val navegar by app.cuenta.navegar.collectAsState()
    val tema by app.cuenta.tema.collectAsState()
    Scaffold(topBar = { TopAppBar(
        title = { Text("Mi cuenta") },
        navigationIcon = { IconButton(onClick = alVolver) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver") } },
    ) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            AccesoConductorCard(Icons.Default.Lock, "Cambiar contraseña", "Solo tú conoces tu contraseña", alCambiarClave)
            AccesoConductorCard(Icons.Default.MailOutline, "Correo personal de recuperación", "Recibe ahí la verificación de tu cuenta", alCorreo)
            AccesoConductorCard(Icons.Default.Phone, "Teléfono de contacto", "La oficina puede localizarte si hay una incidencia", alTelefono)
            // Los mismos ajustes que tiene la cuenta de reparto (29-10-2026): el conductor de empresa con «Mi ruta»
            // también navega, y el tema es del móvil, no de la cuenta.
            Spacer(Modifier.height(8.dp))
            Text("Navegar con", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf("google" to "Google Maps", "waze" to "Waze").forEachIndexed { i, (k, t) ->
                    SegmentedButton(selected = navegar == k, onClick = { ambito.launch { app.cuenta.elegirNavegador(k) } },
                        shape = SegmentedButtonDefaults.itemShape(i, 2)) { Text(t) }
                }
            }
            Text("Aspecto", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf("sistema" to "Automático", "claro" to "Claro", "oscuro" to "Oscuro").forEachIndexed { i, (k, t) ->
                    SegmentedButton(selected = tema == k, onClick = { ambito.launch { app.cuenta.elegirTema(k) } },
                        shape = SegmentedButtonDefaults.itemShape(i, 3)) { Text(t) }
                }
            }
            Spacer(Modifier.height(16.dp))
            TextButton(onClick = alCerrar, modifier = Modifier.fillMaxWidth()) { Text("Cerrar sesión") }
        }
    }
}

@Composable
private fun TelefonoConductorNativo(alVolver: () -> Unit, alGuardado: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val scope = rememberCoroutineScope()
    var telefono by rememberSaveable { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var guardando by remember { mutableStateOf(false) }
    // El que ya tiene en su ficha, para corregirlo y no escribirlo de cero (29-10-2026).
    LaunchedEffect(Unit) {
        if (telefono.isBlank()) runCatching { app.repo.fichaConductor() }.onSuccess { f ->
            telefono = (f["telefono"] ?: f["phone"])?.jsonPrimitive?.contentOrNull.orEmpty()
        }
    }
    Scaffold(topBar = { TopAppBar(
        title = { Text("Teléfono de contacto") },
        navigationIcon = { IconButton(onClick = alVolver) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver") } },
    ) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Añade o actualiza el número para que la oficina pueda llamarte si hay una incidencia. Solo se guarda en tu ficha.")
            OutlinedTextField(telefono, { telefono = it.filter { c -> c.isDigit() || c == '+' || c == ' ' }.take(18); error = null }, label = { Text("Teléfono") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(onClick = {
                guardando = true; error = null
                scope.launch {
                    try { app.repo.guardarTelefonoConductor(telefono); alGuardado() }
                    catch (e: ErrorApi) { error = e.message }
                    finally { guardando = false }
                }
            }, enabled = !guardando && telefono.count(Char::isDigit) in 9..15, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                if (guardando) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Guardar teléfono")
            }
        }
    }
}

@Composable
private fun CambiarClaveConductor(obligatoria: Boolean, alVolver: () -> Unit, alGuardada: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val scope = rememberCoroutineScope()
    var nueva by rememberSaveable { mutableStateOf("") }
    var repetir by rememberSaveable { mutableStateOf("") }
    var actual by rememberSaveable { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var guardando by remember { mutableStateOf(false) }
    val nombre = app.cuenta.nombre.collectAsState().value
    Scaffold(topBar = { TopAppBar(
        title = { Text(if (obligatoria) "Elige tu contraseña" else "Cambiar contraseña") },
        navigationIcon = if (obligatoria) ({}) else ({ IconButton(onClick = alVolver) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver") } }),
    ) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).padding(24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(if (obligatoria) "Hola, ${nombre.substringBefore(' ').ifBlank { "conductor" }}. Este acceso temporal solo sirve para entrar una vez." else "La contraseña nueva debe tener al menos 6 caracteres.",
                style = MaterialTheme.typography.bodyLarge)
            if (!obligatoria) CampoClave(actual, { actual = it; error = null }, "Contraseña actual") {}
            CampoClave(nueva, { nueva = it; error = null }, "${if (obligatoria) "Tu contraseña" else "Nueva contraseña"} (6 caracteres o más)") {}
            CampoClave(repetir, { repetir = it; error = null }, "Repite la contraseña") {}
            // Por qué el botón sigue apagado. Sin esto, con tres letras escritas se quedaba gris sin decir nada y
            // parecía roto (Dani, 29-10-2026, probando la 2.2.3 en su móvil).
            val pista = when {
                nueva.isNotEmpty() && nueva.length < 6 -> "Faltan ${6 - nueva.length}: la contraseña tiene que tener 6 caracteres o más."
                nueva.length >= 6 && repetir.isNotEmpty() && !nueva.startsWith(repetir) -> "Las dos contraseñas no coinciden."
                !obligatoria && nueva.length >= 6 && nueva == repetir && actual.isBlank() -> "Escribe también tu contraseña actual."
                else -> null
            }
            pista?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(
                onClick = {
                    guardando = true
                    scope.launch {
                        try {
                            app.repo.cambiarClaveConductor(actual, nueva)
                            if (obligatoria) app.cuenta.marcarCuentaConfigurada()
                            nueva = ""; repetir = ""; actual = ""
                            alGuardada()
                        } catch (e: ErrorApi) { error = e.message }
                        finally { guardando = false }
                    }
                },
                enabled = !guardando && nueva.length >= 6 && nueva == repetir && (obligatoria || actual.isNotBlank()),
                modifier = Modifier.fillMaxWidth().height(54.dp),
            ) {
                if (guardando) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                else Text(if (obligatoria) "Guardar y continuar" else "Guardar contraseña")
            }
        }
    }
}

@Composable
private fun CorreoRecuperacionConductor(alVolver: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val scope = rememberCoroutineScope()
    var correo by rememberSaveable { mutableStateOf("") }
    var correoVerificado by remember { mutableStateOf<String?>(null) }
    var correoPendiente by remember { mutableStateOf<String?>(null) }
    var mensaje by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var enviando by remember { mutableStateOf(false) }
    var cargando by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        try {
            val estado = app.repo.estadoCorreoRecuperacion()
            correoVerificado = estado["email"]?.jsonPrimitive?.contentOrNull
                ?.takeIf { estado["vinculado"]?.jsonPrimitive?.contentOrNull == "true" }
            correoPendiente = estado["pendiente"]?.jsonPrimitive?.contentOrNull
            mensaje = when {
                correoVerificado != null -> "Tu correo ${correoVerificado} está verificado."
                correoPendiente != null -> "Hay una verificación pendiente para ${correoPendiente}. Revisa ese correo personal."
                else -> null
            }
        } catch (e: ErrorApi) {
            error = e.message
        } finally {
            cargando = false
        }
    }
    Scaffold(topBar = { TopAppBar(
        title = { Text("Correo de recuperación") },
        navigationIcon = { IconButton(onClick = alVolver) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver") } },
    ) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Añade tu correo personal. El acceso seguirá usando el correo de empresa; este correo sirve para recuperar la cuenta.",
                style = MaterialTheme.typography.bodyLarge)
            if (cargando) CircularProgressIndicator()
            else {
                OutlinedTextField(correo, { correo = it; error = null }, label = { Text("Tu correo personal") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth())
                mensaje?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                Button(onClick = {
                    enviando = true; error = null
                    scope.launch {
                        try {
                            val r = app.repo.solicitarCorreoRecuperacion(correo)
                            if (r["vinculado"]?.jsonPrimitive?.contentOrNull == "true") {
                                correoVerificado = r["email"]?.jsonPrimitive?.contentOrNull
                                correoPendiente = null
                                mensaje = "Ese correo ya está verificado."
                            } else {
                                correoPendiente = r["email"]?.jsonPrimitive?.contentOrNull
                                mensaje = "Te hemos enviado un enlace a ${correoPendiente.orEmpty()}. Ábrelo desde tu correo personal para confirmar."
                            }
                            correo = ""
                        } catch (e: ErrorApi) { error = e.message }
                        finally { enviando = false }
                    }
                }, enabled = !enviando && correo.contains('@'), modifier = Modifier.fillMaxWidth().height(54.dp)) {
                    if (enviando) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                    else Text("Enviar verificación")
                }
                TextButton(onClick = alVolver, modifier = Modifier.fillMaxWidth()) { Text("Lo haré más tarde") }
            }
        }
    }
}
