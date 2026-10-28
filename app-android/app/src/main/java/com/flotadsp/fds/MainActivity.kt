package com.flotadsp.fds

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
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

    override fun onCreate(savedInstanceState: Bundle?) {
        val app = application as FdsApp
        val arranque = installSplashScreen()
        super.onCreate(savedInstanceState)
        // La pantalla de arranque se queda hasta tener la sesión leída: sin parpadeo de «entrar» a «tu ruta».
        arranque.setKeepOnScreenCondition { !app.cuenta.cargada.value }
        lifecycleScope.launch { app.cuenta.cargar() }
        leerEnlace(intent)
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
                    Raiz(app, ref, empresaSlug, alCerrarEmpresa = { empresaSlug = null })
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        leerEnlace(intent)
    }

    /** El enlace de invitación (…?ref=CODIGO) se guarda para el alta. */
    private fun leerEnlace(i: Intent?) {
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
private fun Raiz(app: FdsApp, ref: String?, empresaSlug: String?, alCerrarEmpresa: () -> Unit) {
    if (empresaSlug != null) {
        key(empresaSlug) {
            com.flotadsp.fds.ui.acceso.PortalEmpresa(empresaSlug.ifBlank { null }, alCerrarEmpresa)
        }
        return
    }
    val token by app.cuenta.token.collectAsState()
    val cargada by app.cuenta.cargada.collectAsState()
    if (!cargada) return
    AnimatedContent(targetState = token != null, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "sesion") { dentro ->
        if (dentro) Principal() else Acceso(ref)
    }
}

/** Lo que tapa las pestañas: el escáner o la ficha de una parada. */
private sealed interface Capa {
    /** `vuelta`: null si se abre desde «Hoy»; si no, de vuelta de revisar una etiqueta (sigue el mismo escaneo). */
    data class Escaner(val vuelta: VueltaDeRevisar? = null) : Capa
    data class Ficha(val inicial: Lectura? = null, val editar: Parada? = null, val desdeEscaner: Boolean = false) : Capa
}

@Composable
private fun Principal() {
    val app = androidx.compose.ui.platform.LocalContext.current.applicationContext as FdsApp
    val ruta: RutaVM = viewModel()
    val navegar by app.cuenta.navegar.collectAsState()
    val estado by ruta.estado.collectAsState()
    var pestana by rememberSaveable { mutableStateOf("hoy") }
    var capa by remember { mutableStateOf<Capa?>(null) }
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
                if (guardada && !c.desdeEscaner) ruta.avisar(if (c.editar != null) "Cambios guardados." else "Añadida a tu ruta.")
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
                    Triple("hoy", "Hoy", Icons.Default.Route), Triple("historial", "Historial", Icons.Default.History),
                    Triple("ajustes", "Ajustes", Icons.Default.Settings), Triple("cuenta", "Cuenta", Icons.Default.Person),
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
