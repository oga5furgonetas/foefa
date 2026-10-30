package com.flotadsp.fds

import com.flotadsp.fds.ui.tx

import android.Manifest
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Alignment
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Route
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.data.Sesion
import com.flotadsp.fds.etiqueta.Lectura
import com.flotadsp.fds.ui.Region
import com.flotadsp.fds.ui.TemaFds
import com.flotadsp.fds.ui.acceso.Acceso
import com.flotadsp.fds.ui.cuenta.AjustesPantalla
import com.flotadsp.fds.ui.cuenta.CuentaPantalla
import com.flotadsp.fds.ui.cuenta.HistorialPantalla
import com.flotadsp.fds.ui.escaner.EscanerPantalla
import com.flotadsp.fds.ui.escaner.VueltaDeRevisar
import com.flotadsp.fds.ui.hoy.HoyPantalla
import com.flotadsp.fds.ui.hoy.RutaVM
import com.flotadsp.fds.ui.parada.FichaParada
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var ref by mutableStateOf<String?>(null)
    private var empresaSlug by mutableStateOf<String?>(null)
    private var sesionPortal by mutableStateOf<Sesion?>(null)
    // El aviso tocado en la barra de notificaciones (29-10-2026): su enlace, hasta que la pantalla lo atiende.
    private var abrirAviso by mutableStateOf<String?>(null)
    private lateinit var actualizacion: Actualizacion

    override fun onCreate(savedInstanceState: Bundle?) {
        val app = application as FdsApp
        val arranque = installSplashScreen()
        super.onCreate(savedInstanceState)
        // La pantalla de arranque se queda hasta tener la sesión leída: sin parpadeo de «entrar» a «tu ruta».
        arranque.setKeepOnScreenCondition { !app.cuenta.cargada.value }
        lifecycleScope.launch { app.cuenta.cargar() }
        leerEnlace(intent)
        // Antes de que la actividad arranque del todo (el lanzador de Play se registra en onCreate).
        actualizacion = Actualizacion(this)
        lifecycleScope.launch { actualizacion.comprobarEnLaWeb(app.repo) }
        setContent {
            val tema by app.cuenta.tema.collectAsState()
            val noche = when (tema) { "oscuro" -> true; "claro" -> false; else -> isSystemInDarkTheme() }
            LaunchedEffect(noche) {
                // Barras del sistema transparentes, con iconos oscuros sobre la app clara (y claros de noche).
                enableEdgeToEdge(
                    statusBarStyle = if (noche) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
                    navigationBarStyle = if (noche) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
                )
            }
            TemaFds(tema) {
                Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
                    Box(Modifier.fillMaxSize()) {
                        Raiz(app, ref, empresaSlug, sesionPortal, abrirAviso, alAvisoAbierto = { abrirAviso = null },
                            alAbrirPortal = { if (it.app_destino == "empresa") sesionPortal = it },
                            alCerrarEmpresa = { empresaSlug = null; sesionPortal = null })
                        AvisoActualizacion(actualizacion, Modifier.align(Alignment.BottomCenter))
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        actualizacion.comprobar()
    }

    override fun onDestroy() {
        actualizacion.soltar()
        super.onDestroy()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        leerEnlace(intent)
    }

    /** El enlace de invitación (…?ref=CODIGO) se guarda para el alta. */
    private fun leerEnlace(i: Intent?) {
        i?.getStringExtra(com.flotadsp.fds.ui.Notificaciones.EXTRA_URL)?.let { abrirAviso = it }
        val uri = i?.data ?: return
        uri.getQueryParameter("ref")?.takeIf { it.isNotBlank() }?.let { ref = it }
        if (uri.path?.startsWith("/conductor") == true) {
            val slug = uri.fragment?.removePrefix("/")?.takeIf { it.matches(Regex("[a-zA-Z0-9-]{1,60}")) }
                ?: uri.getQueryParameter("slug")?.takeIf { it.matches(Regex("[a-zA-Z0-9-]{1,60}")) }
            empresaSlug = slug ?: ""
        }
    }
}

@Composable
private fun Raiz(app: FdsApp, ref: String?, empresaSlug: String?, sesionPortal: Sesion?, abrirAviso: String?,
                 alAvisoAbierto: () -> Unit, alAbrirPortal: (Sesion) -> Unit, alCerrarEmpresa: () -> Unit) {
    if (empresaSlug != null) {
        key(empresaSlug) {
            com.flotadsp.fds.ui.acceso.PortalEmpresa(empresaSlug.ifBlank { null }, alCerrarEmpresa)
        }
        return
    }
    if (sesionPortal != null) {
        key(sesionPortal.token) {
            com.flotadsp.fds.ui.acceso.PortalAcceso(sesionPortal, alCerrarEmpresa)
        }
        return
    }
    val token by app.cuenta.token.collectAsState()
    val destino by app.cuenta.destino.collectAsState()
    val cargada by app.cuenta.cargada.collectAsState()
    // La sesión caducó (un 401 del servidor): se vuelve a «entrar» y se DICE por qué. Hasta el 29-10-2026 el aviso
    // se emitía y nadie lo escuchaba: la app saltaba a la pantalla de entrar sin explicación.
    var caducada by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { app.caducada.collect { caducada = true } }
    LaunchedEffect(token) { if (token != null) caducada = false }
    if (!cargada) return
    AnimatedContent(targetState = token != null, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "sesion") { dentro ->
        if (dentro && destino == "conductor") {
            com.flotadsp.fds.ui.acceso.PortalConductorNativo(
                alCerrar = { app.ambito.launch { app.repo.salir() } },
                abrir = abrirAviso, alAbierto = alAvisoAbierto,
            )
        } else if (dentro) Principal(abrirAviso, alAvisoAbierto) else Acceso(ref, alAbrirPortal, aviso = if (caducada) tx("Tu sesión ha caducado: entra otra vez.") else null)
    }
}

/** Lo que tapa las pestañas: el escáner o la ficha de una parada. */
private sealed interface Capa {
    /** `vuelta`: null si se abre desde «Hoy»; si no, de vuelta de revisar una etiqueta (sigue el mismo escaneo). */
    data class Escaner(val vuelta: VueltaDeRevisar? = null) : Capa
    data class Ficha(val inicial: Lectura? = null, val editar: Parada? = null, val desdeEscaner: Boolean = false) : Capa
}

@Composable
private fun Principal(abrir: String?, alAbierto: () -> Unit) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val app = ctx.applicationContext as FdsApp
    val ruta: RutaVM = viewModel()
    // Los avisos (la ruta de la mañana, el bono) también para quien reparte por su cuenta (29-10-2026): permiso en
    // Android 13+, la comprobación cada 15 min y este móvil apuntado en el servidor.
    val pedirAvisos = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33 && !com.flotadsp.fds.ui.Notificaciones.permitidas(ctx)) pedirAvisos.launch(Manifest.permission.POST_NOTIFICATIONS)
        com.flotadsp.fds.data.AvisosWorker.programar(ctx)
        app.repo.registrarMovil(Fcm.token())
    }
    val navegar by app.cuenta.navegar.collectAsState()
    val estado by ruta.estado.collectAsState()
    var pestana by rememberSaveable { mutableStateOf("hoy") }
    var capa by remember { mutableStateOf<Capa?>(null) }
    // Un aviso tocado en la barra de notificaciones: a «Hoy», con la ruta al día.
    LaunchedEffect(abrir) { if (abrir != null) { pestana = "hoy"; capa = null; ruta.refrescarSinRuido(); alAbierto() } }
    val paisMovil = remember { app.repo.paisDelMovil() ?: "es" }
    val pais = estado.ruta?.pais?.takeIf { it.isNotBlank() } ?: paisMovil
    LaunchedEffect(pais) { Region.pais = pais }      // la moneda de los cobros, la del país de la ruta
    // Dónde reparte: su base, o la primera parada situada (para que el buscador sugiera direcciones de su zona).
    val cerca = estado.ruta?.base?.let { b -> if (b.lat != null && b.lng != null) b.lat to b.lng else null }
        ?: estado.paradas.firstOrNull { it.ubicada }?.let { it.lat!! to it.lng!! }

    // Como en cualquier app de Android: desde otra pestaña, «atrás» vuelve a «Hoy» (y desde «Hoy», sale).
    BackHandler(enabled = capa == null && pestana != "hoy") { pestana = "hoy" }

    when (val c = capa) {
        is Capa.Escaner -> {
            EscanerPantalla(pais = pais, vuelta = c.vuelta,
                alCerrar = { cambios -> capa = null; if (cambios) ruta.refrescarSinRuido() },
                alRevisar = { l -> capa = Capa.Ficha(inicial = l, desdeEscaner = true) })
            return
        }
        is Capa.Ficha -> {
            FichaParada(pais = pais, cerca = cerca, inicial = c.inicial, editar = c.editar, alCerrar = { guardada ->
                if (guardada) ruta.refrescarSinRuido()
                // Desde el escáner, el aviso lo da el propio escáner (y suma la añadida); si no, abajo en «Hoy».
                if (guardada && !c.desdeEscaner) ruta.avisar(if (c.editar != null) tx("Cambios guardados.") else tx("Añadida a tu ruta."))
                capa = if (c.desdeEscaner) Capa.Escaner(VueltaDeRevisar(guardada)) else null
            })
            return
        }
        null -> Unit
    }

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainerLow) {
                listOf(
                    Triple("hoy", tx("Hoy"), Icons.Default.Route), Triple("historial", tx("Historial"), Icons.Default.History),
                    Triple("ajustes", tx("Ajustes"), Icons.Default.Settings), Triple("cuenta", tx("Cuenta"), Icons.Default.Person),
                ).forEach { (k, t, i) ->
                    NavigationBarItem(selected = pestana == k, onClick = { pestana = k }, icon = { Icon(i, contentDescription = null) }, label = { Text(t) })
                }
            }
        },
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
    ) { pad ->
        Box(Modifier.padding(pad)) {
            when (pestana) {
                "historial" -> HistorialPantalla()
                "ajustes" -> AjustesPantalla(alGuardar = { ruta.refrescarSinRuido() })
                "cuenta" -> CuentaPantalla()
                else -> HoyPantalla(
                    vm = ruta, navegarCon = navegar,
                    alEscanear = { capa = Capa.Escaner() },
                    alAnadir = { capa = Capa.Ficha() },
                    alEditar = { p -> capa = Capa.Ficha(editar = p) },
                )
            }
        }
    }
}
