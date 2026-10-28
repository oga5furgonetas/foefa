package com.flotadsp.fds.ui.acceso

import androidx.activity.compose.BackHandler
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
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Route
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flotadsp.fds.FdsApp
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
fun PortalConductorNativo(alCerrar: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val obligatoria by app.cuenta.configurarCuenta.collectAsState()
    var pantalla by rememberSaveable { mutableStateOf("inicio") }
    var aviso by rememberSaveable { mutableStateOf<String?>(null) }

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
            alCerrar = alCerrar,
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
                alCerrar = alCerrar,
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
            Card(
                onClick = alRuta,
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
            ) {
                Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon(Icons.Default.Route, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                    Text("Mi ruta", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer)
                    Text(
                        when {
                            estadoRuta.cargando -> "Cargando la ruta de hoy…"
                            estadoRuta.error != null -> "No se ha podido cargar. Toca para volver a intentarlo."
                            estadoRuta.ruta?.activo != true -> "Hoy no hay una ruta activa asignada."
                            pendientes == 0 -> "No tienes entregas pendientes."
                            else -> "$pendientes ${if (pendientes == 1) "entrega pendiente" else "entregas pendientes"}"
                        },
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
    data class Ficha(val inicial: Lectura? = null, val editar: Parada? = null) : CapaRutaConductor
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
            alRevisar = { lectura -> capa = CapaRutaConductor.Ficha(inicial = lectura) },
        )
        is CapaRutaConductor.Ficha -> FichaParada(
            pais = pais,
            cerca = cerca,
            inicial = actual.inicial,
            editar = actual.editar,
            alCerrar = { guardada -> if (guardada) vm.refrescarSinRuido(); capa = null },
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
    Scaffold(topBar = { TopAppBar(
        title = { Text("Mi cuenta") },
        navigationIcon = { IconButton(onClick = alVolver) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver") } },
    ) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            AccesoConductorCard(Icons.Default.Lock, "Cambiar contraseña", "Solo tú conoces tu contraseña", alCambiarClave)
            AccesoConductorCard(Icons.Default.MailOutline, "Correo personal de recuperación", "Recibe ahí la verificación de tu cuenta", alCorreo)
            AccesoConductorCard(Icons.Default.Phone, "Teléfono de contacto", "La oficina puede localizarte si hay una incidencia", alTelefono)
            Spacer(Modifier.weight(1f))
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
            if (!obligatoria) OutlinedTextField(actual, { actual = it }, label = { Text("Contraseña actual") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            OutlinedTextField(nueva, { nueva = it; error = null }, label = { Text("${if (obligatoria) "Tu contraseña" else "Nueva contraseña"} (6 caracteres o más)") },
                singleLine = true, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            OutlinedTextField(repetir, { repetir = it; error = null }, label = { Text("Repite la contraseña") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
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
