// diseño compacto
package com.flotadsp.fds.ui.acceso

import android.widget.Toast
import com.flotadsp.fds.ui.tx
import com.flotadsp.fds.ui.coloresCampo
import com.flotadsp.fds.ui.coloresBotonTexto
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Route
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.Fcm
import com.flotadsp.fds.data.AvisosWorker
import com.flotadsp.fds.ui.Notificaciones
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.etiqueta.Lectura
import com.flotadsp.fds.ui.Aviso
import com.flotadsp.fds.ui.BotonIcono
import com.flotadsp.fds.ui.BotonPrincipal
import com.flotadsp.fds.ui.BotonTexto
import com.flotadsp.fds.ui.Cabecera
import com.flotadsp.fds.ui.ContenedorLista
import com.flotadsp.fds.ui.Esp
import com.flotadsp.fds.ui.Region
import com.flotadsp.fds.ui.Segmentado
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.Tono
import com.flotadsp.fds.ui.cuenta.FilaOpcion
import com.flotadsp.fds.ui.cuenta.Seccion
import com.flotadsp.fds.ui.escaner.EscanerPantalla
import com.flotadsp.fds.ui.escaner.VueltaDeRevisar
import com.flotadsp.fds.ui.hoy.HoyPantalla
import com.flotadsp.fds.ui.hoy.RutaVM
import com.flotadsp.fds.ui.parada.FichaParada
import kotlinx.coroutines.launch
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import kotlinx.serialization.json.booleanOrNull

/* EL DISEÑO COMPACTO (07-11-2026, §5.11 de la especificación): el portal del conductor solo con el tema y las piezas de
   ui/Componentes.kt: «Mi ruta» en una tarjeta de 72 sin botón dentro, las demás opciones como filas de una lista con
   relleno 12 y sin subtítulo, y «Mi ruta» abre «Hoy» con su flecha de volver. */

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
        title = { Text(tx("¿Cerrar sesión?")) },
        text = { Text(tx("Para volver a entrar necesitarás tu correo y tu contraseña.")) },
        confirmButton = { TextButton(onClick = { confirmarSalir = false; alCerrar() }, colors = coloresBotonTexto()) { Text(tx("Cerrar sesión")) } },
        dismissButton = { TextButton(onClick = { confirmarSalir = false }, colors = coloresBotonTexto()) { Text(tx("Seguir dentro")) } },
    )

    if (obligatoria) {
        CambiarClaveConductor(obligatoria = true, alVolver = {}, alGuardada = {
            pantalla = "inicio"  // 02-11-2026 (Dani): directo dentro; el correo de recuperación sigue en Cuenta
        }, alSalir = salir)
        return
    }

    when (pantalla) {
        "auditoria" -> AuditoriaConductorNativa(
            alVolver = { pantalla = "inicio" },
            alCompletar = { pantalla = "inicio"; aviso = tx("Auditoría enviada correctamente.") },
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

/** El inicio del portal: la cabecera con el saludo, «Mi ruta» en su tarjeta y lo demás como filas de una lista. */
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
            Cabecera(tx("Hola, {n}", "n" to nombre.substringBefore(' ').ifBlank { tx("conductor") }), subtitulo = tx("Portal de conductor")) {
                BotonIcono(Icons.AutoMirrored.Filled.Logout, tx("Cerrar sesión"), alCerrar)
            }
        },
    ) { inset ->
        Column(
            Modifier.fillMaxSize().padding(inset).verticalScroll(rememberScrollState()).padding(Esp.l),
            verticalArrangement = Arrangement.spacedBy(Esp.m),
        ) {
            aviso?.let { Aviso(it, tono = Tono.OK, icono = Icons.Default.CheckCircle) }
            // «Mi ruta» solo en empresas que reparten con la app: lo dice el servidor (`activo` en reparto/mi-ruta),
            // igual que el portal web. En una flota que reparte para Amazon (OGA5, DGA1, DGA2) la ruta va por otro
            // lado y esta tarjeta solo confundía (Dani, 29-10-2026, probando la 2.2.3 en su móvil).
            if (estadoRuta.ruta?.activo == true) TarjetaMiRuta(pendientes, alRuta)
            // La bandeja de avisos (29-10-2026): turnos aprobados, vacantes para trabajar más, inspección pendiente.
            val filas = listOf<@Composable () -> Unit>(
                { FilaOpcion(Icons.Default.Notifications, if (sinLeer == 1) tx("Tienes 1 aviso nuevo") else if (sinLeer > 1) tx("Tienes {n} avisos nuevos", "n" to sinLeer) else tx("Avisos"), flecha = true, insignia = sinLeer, alTocar = alAvisos) },
                { FilaOpcion(Icons.Default.CheckCircle, tx("Auditoría del vehículo"), flecha = true, alTocar = alAuditoria) },
                { FilaOpcion(Icons.Default.CalendarMonth, tx("Mis turnos y días libres"), flecha = true, alTocar = alTurnos) },
                { FilaOpcion(Icons.Default.CalendarMonth, tx("Trabajar más"), flecha = true, alTocar = alExtras) },
                { FilaOpcion(Icons.Default.CardGiftcard, tx("Invita y gana"), flecha = true, alTocar = alReferidos) },
                { FilaOpcion(Icons.Default.Lock, tx("Mi cuenta"), flecha = true, alTocar = alCuenta) },
            )
            ContenedorLista(filas.size, separadorDesde = 48.dp) { filas[it]() }
        }
    }
}

/** «Mi ruta» (§5.11): una tarjeta de 72 con tinte de marca, sin botón dentro; toda ella abre la ruta. */
@Composable
private fun TarjetaMiRuta(pendientes: Int, alRuta: () -> Unit) {
    val c = MaterialTheme.colorScheme
    Surface(onClick = alRuta, color = c.primaryContainer, contentColor = c.onPrimaryContainer, shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth().heightIn(min = 72.dp)) {
        Row(Modifier.padding(Esp.m), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Route, contentDescription = null, modifier = Modifier.size(24.dp))
            Spacer(Modifier.width(Esp.m))
            Column(Modifier.weight(1f)) {
                Text(tx("Mi ruta"), style = MaterialTheme.typography.titleLarge)
                Text(
                    if (pendientes == 0) tx("No tienes entregas pendientes.")
                    else if (pendientes == 1) tx("1 entrega pendiente") else tx("{n} entregas pendientes", "n" to pendientes),
                    style = MaterialTheme.typography.bodyMedium.merge(TextoNumero),
                )
            }
            Icon(Icons.Default.ChevronRight, contentDescription = null)
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
        is CapaRutaConductor.Ficha -> {
            // Guardada sin punto en el mapa (02-11-2026): se dice, y el móvil la intenta solo (RutaVM).
            fun cerrada(guardada: Boolean, sinSituar: Boolean) {
                if (guardada) vm.refrescarSinRuido()
                if (guardada && !actual.desdeEscaner) vm.avisar(when {
                    sinSituar && actual.editar != null -> tx("Cambios guardados, sin situar: la sitúo al navegar.")
                    sinSituar -> tx("Añadida, sin situar: la sitúo al navegar.")
                    actual.editar != null -> tx("Cambios guardados.")
                    else -> tx("Añadida a tu ruta.")
                })
                capa = if (actual.desdeEscaner) CapaRutaConductor.Escaner(VueltaDeRevisar(guardada, sinSituar)) else null
            }
            FichaParada(
                pais = pais,
                cerca = cerca,
                inicial = actual.inicial,
                editar = actual.editar,
                alCerrar = { guardada -> cerrada(guardada, sinSituar = false) },
                alGuardada = { p -> cerrada(true, sinSituar = p != null && p.pendiente && !p.ubicada) },
                // «Quitar de la ruta» en el ⋮ de «Editar parada» (07-11-2026, §5.9): lo mismo que la hoja de la parada
                // (vm.quitar) y se cierra la ficha. Solo al editar: al crear no hay nada que quitar.
                alQuitar = actual.editar?.let { p -> ({ vm.quitar(p); capa = null }) },
            )
        }
        // «Mi ruta» con la flecha de volver en la cabecera (07-11-2026): HoyPantalla la pinta si le llega alVolver.
        null -> HoyPantalla(
            vm = vm,
            navegarCon = navegar,
            alEscanear = { capa = CapaRutaConductor.Escaner() },
            alAnadir = { capa = CapaRutaConductor.Ficha() },
            alEditar = { parada -> capa = CapaRutaConductor.Ficha(editar = parada) },
            alVolver = alVolver,
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
    Scaffold(topBar = { Cabecera(tx("Mi cuenta"), alVolver = alVolver) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).verticalScroll(rememberScrollState()).padding(Esp.l), verticalArrangement = Arrangement.spacedBy(Esp.m)) {
            // Aquí cada fila conserva su línea de explicación (§5.11 solo quita el subtítulo del inicio): la del teléfono
            // dice para qué se pide.
            val filas = listOf<@Composable () -> Unit>(
                { FilaOpcion(Icons.Default.Lock, tx("Cambiar contraseña"), detalle = tx("Solo tú conoces tu contraseña"), flecha = true, alTocar = alCambiarClave) },
                { FilaOpcion(Icons.Default.MailOutline, tx("Correo personal de recuperación"), detalle = tx("Recibe ahí la verificación de tu cuenta"), flecha = true, alTocar = alCorreo) },
                { FilaOpcion(Icons.Default.Phone, tx("Teléfono de contacto"), detalle = tx("La oficina puede localizarte si hay una incidencia"), flecha = true, alTocar = alTelefono) },
            )
            ContenedorLista(filas.size, separadorDesde = 48.dp) { filas[it]() }
            // Los mismos ajustes que tiene la cuenta de reparto (29-10-2026): el conductor de empresa con «Mi ruta»
            // también navega, y el tema es del móvil, no de la cuenta.
            Seccion(tx("Navegar con")) {
                val navegadores = listOf("app" to tx("Esta app"), "google" to "Google Maps", "waze" to "Waze")
                Segmentado(navegadores.map { it.second }, navegadores.indexOfFirst { it.first == navegar }, alElegir = { i -> ambito.launch { app.cuenta.elegirNavegador(navegadores[i].first) } })
            }
            Seccion(tx("Aspecto")) {
                val temas = listOf("sistema" to tx("Automático"), "claro" to tx("Claro"), "oscuro" to tx("Oscuro"))
                Segmentado(temas.map { it.second }, temas.indexOfFirst { it.first == tema }, alElegir = { i -> ambito.launch { app.cuenta.elegirTema(temas[i].first) } })
            }
            BotonTexto(tx("Cerrar sesión"), alCerrar, modifier = Modifier.fillMaxWidth())
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
    Scaffold(topBar = { Cabecera(tx("Teléfono de contacto"), alVolver = alVolver) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).padding(Esp.l), verticalArrangement = Arrangement.spacedBy(Esp.m)) {
            Text(tx("Añade o actualiza el número para que la oficina pueda llamarte si hay una incidencia. Solo se guarda en tu ficha."))
            OutlinedTextField(telefono, { telefono = it.filter { c -> c.isDigit() || c == '+' || c == ' ' }.take(18); error = null }, label = { Text(tx("Teléfono")) }, singleLine = true,
                shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth(), colors = coloresCampo())
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            BotonPrincipal(tx("Guardar teléfono"), onClick = {
                guardando = true; error = null
                scope.launch {
                    try { app.repo.guardarTelefonoConductor(telefono); alGuardado() }
                    catch (e: ErrorApi) { error = e.message }
                    finally { guardando = false }
                }
            }, enabled = telefono.count(Char::isDigit) in 9..15, cargando = guardando, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun CambiarClaveConductor(obligatoria: Boolean, alVolver: () -> Unit, alGuardada: () -> Unit, alSalir: (() -> Unit)? = null) {
    val ctx = LocalContext.current
    val app = ctx.applicationContext as FdsApp
    val scope = rememberCoroutineScope()
    var nueva by rememberSaveable { mutableStateOf("") }
    var repetir by rememberSaveable { mutableStateOf("") }
    var actual by rememberSaveable { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var guardando by remember { mutableStateOf(false) }
    // SIN SABER LA ACTUAL (02-11-2026, María: «no les deja cambiar la contraseña en la app… creo que inician desde
    // Google»): quien entró con la contraseña que le rellena Google, o con el código del correo, no sabe la actual, y
    // esta pantalla se la pedía sin otra salida. Nada más entrar (15 min) el servidor la cambia sin ella; si no, con un
    // código a su correo. La ficha dice cuál vale ahora (clave_sin_actual) y adónde iría el código (codigo_a).
    var sinActual by remember { mutableStateOf(false) }
    var codigoA by remember { mutableStateOf<String?>(null) }
    var conCodigo by rememberSaveable { mutableStateOf(false) }
    var codigo by rememberSaveable { mutableStateOf("") }
    var enviadoA by rememberSaveable { mutableStateOf<String?>(null) }
    var pidiendo by remember { mutableStateOf(false) }
    val nombre = app.cuenta.nombre.collectAsState().value
    LaunchedEffect(Unit) {
        runCatching { app.repo.fichaConductor() }.getOrNull()?.let { f ->
            // LA MARCA VIEJA (03-11-2026, José Arturo, OGA5: «no pueden pedir para trabajar mañana… les da problemas con
            // la contraseña»): la que guardó este móvil el día que entró con la temporal se quita en cuanto la ficha dice
            // que ya no hace falta; si no, se quedaba aquí y el servidor le rechazaba el cambio una y otra vez.
            if (obligatoria) {
                if (f["configurar_cuenta"]?.jsonPrimitive?.booleanOrNull == false) { app.cuenta.marcarCuentaConfigurada(); alGuardada() }
                return@let
            }
            sinActual = f["clave_sin_actual"]?.jsonPrimitive?.booleanOrNull == true
            codigoA = f["codigo_a"]?.jsonPrimitive?.contentOrNull
        }
    }
    val pedirCodigo: () -> Unit = {
        pidiendo = true; error = null
        scope.launch {
            try {
                val r = app.repo.pedirCodigoClave()
                enviadoA = r["enviado_a"]?.jsonPrimitive?.contentOrNull ?: codigoA
                conCodigo = true; codigo = ""
            } catch (e: ErrorApi) { error = e.message }
            finally { pidiendo = false }
        }
    }
    val sinLaActual = obligatoria || sinActual
    Scaffold(topBar = {
        Cabecera(if (obligatoria) tx("Elige tu contraseña") else tx("Cambiar contraseña"), alVolver = if (obligatoria) null else alVolver)
    }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).padding(Esp.l).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Esp.m)) {
            Text(if (obligatoria) tx("Hola, {n}. Este acceso temporal solo sirve para entrar una vez.", "n" to nombre.substringBefore(' ').ifBlank { tx("conductor") }) else tx("La contraseña nueva debe tener al menos 6 caracteres."),
                style = MaterialTheme.typography.bodyLarge)
            when {
                obligatoria -> {}
                // En el color de texto de la marca (07-11-2026): el cian sobre el papel no se leía.
                sinActual -> Text(tx("Acabas de entrar: no hace falta tu contraseña actual."), color = MaterialTheme.colorScheme.secondary,
                    style = MaterialTheme.typography.bodyMedium)
                conCodigo -> {
                    Text(tx("Te hemos mandado un código a {c}. Mira también el spam.", "c" to (enviadoA ?: codigoA ?: "")),
                        style = MaterialTheme.typography.bodyMedium)
                    OutlinedTextField(codigo, { codigo = it.filter(Char::isDigit).take(6); error = null }, label = { Text(tx("Código de 6 cifras")) },
                        singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth(), colors = coloresCampo())
                    TextButton(onClick = pedirCodigo, enabled = !pidiendo, colors = coloresBotonTexto()) { Text(tx("Reenviar código")) }
                }
                else -> {
                    CampoClave(actual, { actual = it; error = null }, tx("Contraseña actual")) {}
                    codigoA?.let { c ->
                        TextButton(onClick = pedirCodigo, enabled = !pidiendo, colors = coloresBotonTexto()) { Text(tx("¿No la sabes? Te mando un código a {c}", "c" to c)) }
                    }
                }
            }
            CampoClave(nueva, { nueva = it; error = null }, (if (obligatoria) tx("Tu contraseña") else tx("Nueva contraseña")) + " " + tx("(6 caracteres o más)")) {}
            CampoClave(repetir, { repetir = it; error = null }, tx("Repite la contraseña")) {}
            // Por qué el botón sigue apagado. Sin esto, con tres letras escritas se quedaba gris sin decir nada y
            // parecía roto (Dani, 29-10-2026, probando la 2.2.3 en su móvil).
            val pista = when {
                nueva.isNotEmpty() && nueva.length < 6 -> tx("Faltan {n}: la contraseña tiene que tener 6 caracteres o más.", "n" to 6 - nueva.length)
                nueva.length >= 6 && repetir.isNotEmpty() && !nueva.startsWith(repetir) -> tx("Las dos contraseñas no coinciden.")
                conCodigo && !sinLaActual && nueva.length >= 6 && nueva == repetir && codigo.length < 6 -> tx("Escribe el código de 6 cifras del correo.")
                !sinLaActual && !conCodigo && nueva.length >= 6 && nueva == repetir && actual.isBlank() -> tx("Escribe también tu contraseña actual.")
                else -> null
            }
            pista?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            BotonPrincipal(
                if (obligatoria) tx("Guardar y continuar") else tx("Guardar contraseña"),
                onClick = {
                    guardando = true
                    scope.launch {
                        try {
                            app.repo.cambiarClaveConductor(if (conCodigo) "" else actual, nueva, if (conCodigo && !sinLaActual) codigo else "")
                            if (obligatoria) app.cuenta.marcarCuentaConfigurada()
                            nueva = ""; repetir = ""; actual = ""; codigo = ""
                            // Antes volvía a «Mi cuenta» sin decir nada y parecía que no se había guardado (02-11-2026).
                            Toast.makeText(ctx, if (obligatoria) tx("Contraseña guardada.") else tx("Contraseña cambiada. La próxima vez entra con la nueva."),
                                Toast.LENGTH_LONG).show()
                            alGuardada()
                        } catch (e: ErrorApi) {
                            // Y si al guardarla el servidor dice que ya la tiene (la eligió en otro móvil, o la temporal era de
                            // antes de la suya), se entra, diciéndole que la que ha escrito no se ha guardado.
                            val yaLaTiene = obligatoria && e.estado == 400 &&
                                runCatching { app.repo.fichaConductor()["configurar_cuenta"]?.jsonPrimitive?.booleanOrNull }.getOrNull() == false
                            if (yaLaTiene) {
                                app.cuenta.marcarCuentaConfigurada()
                                Toast.makeText(ctx, tx("Ya tenías tu contraseña puesta: sigue entrando con ella. La que has escrito no se ha guardado."),
                                    Toast.LENGTH_LONG).show()
                                alGuardada()
                            } else error = e.message
                        }
                        finally { guardando = false }
                    }
                },
                enabled = nueva.length >= 6 && nueva == repetir &&
                    (sinLaActual || (conCodigo && codigo.length == 6) || actual.isNotBlank()),
                cargando = guardando,
                modifier = Modifier.fillMaxWidth(),
            )
            if (!sinLaActual) Text(tx("¿Sin acceso a tu correo? Sal de la cuenta y vuelve a entrar: nada más entrar podrás cambiarla sin la actual. O pide a la oficina una contraseña temporal."),
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            // SIEMPRE CON SALIDA (03-11-2026): la de elegirla no tenía ni «Volver» ni «Cerrar sesión», y si guardar
            // fallaba por lo que fuera, el conductor no salía de aquí.
            if (obligatoria && alSalir != null) TextButton(onClick = alSalir, modifier = Modifier.fillMaxWidth(), colors = coloresBotonTexto()) { Text(tx("Cerrar sesión")) }
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
                correoVerificado != null -> tx("Tu correo {c} está verificado.", "c" to correoVerificado)
                correoPendiente != null -> tx("Hay una verificación pendiente para {c}. Revisa ese correo personal.", "c" to correoPendiente)
                else -> null
            }
        } catch (e: ErrorApi) {
            error = e.message
        } finally {
            cargando = false
        }
    }
    Scaffold(topBar = { Cabecera(tx("Correo de recuperación"), alVolver = alVolver) }) { inset ->
        Column(Modifier.fillMaxSize().padding(inset).padding(Esp.l), verticalArrangement = Arrangement.spacedBy(Esp.m)) {
            Text(tx("Añade tu correo personal. El acceso seguirá usando el correo de empresa; este correo sirve para recuperar la cuenta."),
                style = MaterialTheme.typography.bodyLarge)
            if (cargando) CircularProgressIndicator()
            else {
                OutlinedTextField(correo, { correo = it; error = null }, label = { Text(tx("Tu correo personal")) }, singleLine = true,
                    shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth(), colors = coloresCampo())
                // En el color de texto de la marca (07-11-2026): el cian sobre el papel no se leía.
                mensaje?.let { Text(it, color = MaterialTheme.colorScheme.secondary) }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                BotonPrincipal(tx("Enviar verificación"), onClick = {
                    enviando = true; error = null
                    scope.launch {
                        try {
                            val r = app.repo.solicitarCorreoRecuperacion(correo)
                            if (r["vinculado"]?.jsonPrimitive?.contentOrNull == "true") {
                                correoVerificado = r["email"]?.jsonPrimitive?.contentOrNull
                                correoPendiente = null
                                mensaje = tx("Ese correo ya está verificado.")
                            } else {
                                correoPendiente = r["email"]?.jsonPrimitive?.contentOrNull
                                mensaje = tx("Te hemos enviado un enlace a {c}. Ábrelo desde tu correo personal para confirmar.", "c" to correoPendiente.orEmpty())
                            }
                            correo = ""
                        } catch (e: ErrorApi) { error = e.message }
                        finally { enviando = false }
                    }
                }, enabled = correo.contains('@'), cargando = enviando, modifier = Modifier.fillMaxWidth())
                TextButton(onClick = alVolver, modifier = Modifier.fillMaxWidth(), colors = coloresBotonTexto()) { Text(tx("Lo haré más tarde")) }
            }
        }
    }
}
