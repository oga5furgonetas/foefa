// diseño compacto
package com.flotadsp.fds.ui.hoy

/* «HOY» EN EL DISEÑO COMPACTO (07-11-2026, §5.1 de la especificación): la cabecera de 56 con la fecha corta al lado y
   «Escanear» dentro (fuera el flotante, que tapaba la tarjeta y el buscador), un solo aviso, el resumen del día plano
   con sus chips, la tarjeta de la siguiente (la única tarjeta), una promo, la lista en una sola superficie (FilaParada)
   y «Hechas hoy», que se abre sola si hay fallidas. Todo con las piezas de ui/Componentes.kt: aquí no va ningún tamaño
   de letra, color a mano ni altura fija (lo vigila scripts/check-tokens-nativa.mjs). La lógica (RutaVM, Situar, la
   guía, lo que se manda al servidor) no cambia. */

import com.flotadsp.fds.ui.tx
import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EditLocationAlt
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.LocationOff
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.PriorityHigh
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Route
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.flotadsp.fds.BuildConfig
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.Bono
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.Furgo
import com.flotadsp.fds.data.Invitacion
import com.flotadsp.fds.data.Parada
import com.flotadsp.fds.data.Referidos
import com.flotadsp.fds.data.Repositorio
import com.flotadsp.fds.ui.AccionIcono
import com.flotadsp.fds.ui.Acciones
import com.flotadsp.fds.ui.Alto
import com.flotadsp.fds.ui.Aviso
import com.flotadsp.fds.ui.AvisoFlotante
import com.flotadsp.fds.ui.BotonIcono
import com.flotadsp.fds.ui.BotonNormal
import com.flotadsp.fds.ui.BotonPrincipal
import com.flotadsp.fds.ui.BotonTexto
import com.flotadsp.fds.ui.Cabecera
import com.flotadsp.fds.ui.CampoTexto
import com.flotadsp.fds.ui.ChipAccion
import com.flotadsp.fds.ui.ContenedorLista
import com.flotadsp.fds.ui.Esp
import com.flotadsp.fds.ui.EstadoNumero
import com.flotadsp.fds.ui.Etiqueta
import com.flotadsp.fds.ui.FilaCierre
import com.flotadsp.fds.ui.FilaDeChips
import com.flotadsp.fds.ui.FilaDeLista
import com.flotadsp.fds.ui.FilaParada
import com.flotadsp.fds.ui.Hoja
import com.flotadsp.fds.ui.LOCALE_APP
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.Menu
import com.flotadsp.fds.ui.NotasPuerta
import com.flotadsp.fds.ui.NumeroParada
import com.flotadsp.fds.ui.Opcion
import com.flotadsp.fds.ui.Pastilla
import com.flotadsp.fds.ui.Promo
import com.flotadsp.fds.ui.Region
import com.flotadsp.fds.ui.TamNumero
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.Tono
import com.flotadsp.fds.ui.Voz
import com.flotadsp.fds.ui.patronFecha
import com.flotadsp.fds.ui.parada.Sugerencia
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

@Composable
fun HoyPantalla(
    vm: RutaVM,
    navegarCon: String,
    alEscanear: () -> Unit,
    alAnadir: () -> Unit,
    alEditar: (Parada) -> Unit,
    /** LA CARGA GUIADA (01-11-2026): la furgoneta por huecos. */
    alCargar: () -> Unit = {},
    /** En el portal del conductor (07-11-2026): «Mi ruta» con la flecha de volver; se lo pasa RutaConductorNativa. */
    alVolver: (() -> Unit)? = null,
) {
    val e by vm.estado.collectAsState()
    val pendientesEnvio by vm.pendientesDeEnvio.collectAsState()
    val revisar by vm.revisar.collectAsState()
    val ctx = LocalContext.current
    val app = ctx.applicationContext as FdsApp
    val furgo by app.cuenta.furgo.collectAsState()
    val avisos = remember { SnackbarHostState() }
    val ambito = rememberCoroutineScope()
    var verMapa by rememberSaveable { mutableStateOf(false) }
    var buscador by rememberSaveable { mutableStateOf(false) }       // el 🔍 abierto (07-11-2026): el campo en vez de la cabecera de la lista
    var buscar by rememberSaveable { mutableStateOf("") }
    var dinero by remember { mutableStateOf(false) }                  // la hoja «Mi dinero hoy» (07-11-2026)
    var abierta by remember { mutableStateOf<Parada?>(null) }
    var entregando by remember { mutableStateOf<Parada?>(null) }
    var fallando by remember { mutableStateOf<Parada?>(null) }
    var memoriaDe by remember { mutableStateOf<Parada?>(null) }     // la memoria de la calle (01-11-2026)
    var avisando by remember { mutableStateOf(false) }               // «Avisar a todos por WhatsApp» (01-11-2026)
    val avisados by vm.avisados.collectAsState()
    val prefijo = e.ruta?.prefijo ?: "34"
    val paisMovil = remember { app.repo.paisDelMovil() ?: "es" }
    val pais = e.ruta?.pais?.takeIf { it.isNotBlank() } ?: paisMovil
    val empresa = e.ruta?.takeIf { !it.autonomo }?.empresa.orEmpty()
    // LA INVITACIÓN TRAS LA PRIMERA ENTREGA (02-11-2026): con la cuenta de quien reparte por su cuenta y ≥1 entrega hoy,
    // la promo de «Invita y gana» debajo de la siguiente parada (o de «Ruta terminada»); «Ahora no» la quita ese día.
    val invitarOculto by app.cuenta.invitarOculto.collectAsState()
    val diaRuta = e.ruta?.fecha?.takeIf { it.isNotBlank() } ?: LocalDate.now().toString()
    val invitacion = e.invitacion?.takeIf { Invitar.seEnsena(e.ruta, e.entregadasReales, it.referidos.codigo, invitarOculto, diaRuta) }
    val textoInvitar: (Invitacion) -> String = { i ->
        // Lo que gana el invitado con su primera ruta, solo mientras dura la promoción (promo_hasta viene solo entonces).
        val bono = if (i.referidos.promoHasta != null) (e.ruta?.bono?.cent ?: i.referidos.bono?.cent ?: Invitar.BONO_CENT) else 0
        Invitar.texto(Invitar.enlace(BuildConfig.WEB_URL, i.referidos.codigo), fechaGratis(i.gratisHasta), bono, i.referidos.porInvitado)
    }
    // «Mi dinero hoy» (solo quien reparte por su cuenta y ha puesto su tarifa): lo entregado por su precio por parada,
    // más el día si ha entregado algo, y lo que no se cobra por no entregar (30-10-2026). En céntimos, como lo manda el
    // servidor. En «Hoy» es un chip con la cifra; el desglose, en su hoja (§5.1 j).
    val dineroHoy = e.ruta?.ganancias?.let { g ->
        val cent = e.entregadas * g.pagoParada + (if (e.entregadas > 0) g.pagoDia else 0)
        val fallidas = e.hechas.count { it.estado == "fallido" }
        val perdido = fallidas * g.pagoParada
        if (cent > 0 || perdido > 0) DineroHoy(cent, fallidas, perdido) else null
    }

    LaunchedEffect(Unit) { vm.vista("/ruta") }
    // LA RUTA SE REFRESCA SOLA (01-11-2026): al volver a primer plano y cada minuto mientras esta pantalla se ve
    // (RutaVM pone las condiciones); en segundo plano se para y al volver arranca de nuevo.
    val ciclo = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(ciclo) {
        ciclo.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            while (true) { vm.refrescarSiToca(); delay(60_000) }
        }
    }
    // El camino por las calles, al abrir el mapa y cuando cambia lo que queda.
    val clavePendientes = e.pendientes.joinToString(",") { "${it.id}:${it.orden}" }
    LaunchedEffect(verMapa, clavePendientes) {
        if (verMapa && e.pendientes.size >= 2) vm.cargarTrazado()
        if (verMapa) vm.cargarIncidencias()      // lo que dice la DGT, con el mapa abierto (30-10-2026)
    }

    LaunchedEffect(Unit) {
        vm.avisos.collect { a ->
            avisos.currentSnackbarData?.dismiss()
            val r = avisos.showSnackbar(a.texto, actionLabel = a.accion, withDismissAction = a.accion == null,
                duration = if (a.accion != null) SnackbarDuration.Long else SnackbarDuration.Short)
            if (r == SnackbarResult.ActionPerformed) a.alPulsar?.invoke()
        }
    }

    // «Ordenar ruta» desde donde estás: se pide la ubicación (solo con la app abierta). Sin permiso, desde tu base.
    val pedirUbicacion = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        ambito.launch {
            val ok = r.values.any { it }
            val p = if (ok) Acciones.dondeEstoy(ctx) else null
            vm.ordenar(p?.first, p?.second)
        }
    }
    val ordenar = {
        if (vm.empezarAOrdenar()) pedirUbicacion.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    }
    val entregarRapido: (Parada) -> Unit = { p ->
        Acciones.vibrar(ctx)
        if (p.porCobrar) entregando = p else vm.entregar(p)
    }

    // LA GUÍA DENTRO DE LA APP (01-11-2026): «Ir» con «Esta app» abre la guía (GuiaPantalla) a esa parada; con
    // Google Maps o Waze elegidos, como siempre.
    // EL PRIMER PAQUETE BIEN SITUADO (02-11-2026): una parada sin situar ya NO se manda a Google Maps (Dani: «eso es un
    // pedazo de mierda, hazlo bien»). Primero el geocodificador del móvil, con «Buscando la dirección…» y sin bloquear
    // la pantalla: si acierta, se guarda (geo_origen «movil») y se va. Si no, «Situar la parada» (SituarPantalla), con
    // Google Maps solo en su botón pequeño. Igual desde la ficha, el mapa y la guía al pasar sola a la siguiente.
    // Revisión del 02-11-2026: solo el PORTAL del móvil se guarda y se va; la calle sola abre «Situar» con ella la
    // primera (A2), y si la pasada de fondo ya está buscando esa parada, se espera a esa búsqueda (A7).
    var guiando by remember { mutableStateOf<String?>(null) }
    var buscandoDe by remember { mutableStateOf<String?>(null) }    // «Buscando la dirección…» de esta parada
    var situando by remember { mutableStateOf<Parada?>(null) }       // la pantalla «Situar la parada»
    var primeraSituar by remember { mutableStateOf<Sugerencia?>(null) }   // lo que encontró el móvil (solo la calle)
    var guardandoPunto by remember { mutableStateOf(false) }
    var errorPunto by remember { mutableStateOf<String?>(null) }
    // La parada recién situada, hasta que la ruta que se ve (estado del VM) la traiga ya con su punto: sin esto, en el
    // fotograma entre medias la guía la vería aún sin situar y volvería a buscarla.
    var recien by remember { mutableStateOf<Parada?>(null) }
    val fuera = if (navegarCon == "waze") "waze" else "google"
    val nombreFuera = if (fuera == "waze") "Waze" else "Google Maps"
    val situar: (Parada) -> Unit = { p -> errorPunto = null; primeraSituar = null; situando = p }
    /** Con la parada ya situada: nuestra guía, o el navegador elegido. */
    val ir: (Parada) -> Unit = { p -> if (navegarCon == "app") { recien = p; guiando = p.id } else Acciones.navegar(ctx, p, navegarCon) }
    val navegarA: (Parada) -> Unit = { p ->
        when {
            // Una parada ya cerrada (reintentar una fallida al final del día) no se guía ni se sitúa: el servidor no lo
            // deja. Fuera, como siempre.
            !p.pendiente -> Acciones.navegar(ctx, p, fuera)
            p.ubicada -> ir(p)
            buscandoDe != null -> Unit
            else -> {
                buscandoDe = p.id
                ambito.launch {
                    val r = vm.situarConMovil(p)
                    buscandoDe = null
                    when (r) {
                        is RutaVM.DelMovil.Portal -> ir(r.parada)
                        is RutaVM.DelMovil.SoloCalle -> { situar(p); primeraSituar = r.sugerencia }
                        else -> situar(p)
                    }
                }
            }
        }
    }
    // La guía va a la parada elegida y, al entregarla, a la siguiente por entregar (en orden); si esa no está situada,
    // se cierra y se busca como al pulsar «Ir». Se cierra sola cuando no queda nada. La elegida NO se re-apunta a
    // la siguiente: si la entrega se deshace o el servidor la rechaza, vuelve a estar pendiente y la guía vuelve a ella
    // (01-11-2026, revisión).
    val siguienteGuia = guiando?.let { id ->
        e.pendientes.firstOrNull { it.id == id }?.let { p -> recien?.takeIf { r -> r.id == p.id && r.ubicada && !p.ubicada } ?: p }
            ?: e.pendientes.firstOrNull()
    }
    val objetivo = siguienteGuia?.takeIf { it.ubicada }
    LaunchedEffect(siguienteGuia?.id, objetivo == null) {
        val s = siguienteGuia
        if (guiando == null) return@LaunchedEffect
        if (s == null) guiando = null
        else if (objetivo == null) { guiando = null; navegarA(s) }
    }

    val barra = TopAppBarDefaults.enterAlwaysScrollBehavior()
    Scaffold(
        modifier = Modifier.nestedScroll(barra.nestedScrollConnection),
        topBar = {
            // a) La cabecera de 56: «Hoy» (en el portal, «Mi ruta» con ←) y la fecha corta al lado; el mapa y el «+» solo
            // con paradas; «Escanear paquetes» aquí, que el flotante tapaba el final de la tarjeta y el buscador.
            Cabecera(
                titulo = if (alVolver != null) tx("Mi ruta") else tx("Hoy"), subtitulo = fechaCorta(e.ruta?.fecha),
                alVolver = alVolver, scrollBehavior = barra,
            ) {
                if (e.paradas.isNotEmpty()) {
                    BotonIcono(if (verMapa) Icons.AutoMirrored.Filled.List else Icons.Default.Map,
                        if (verMapa) tx("Ver la lista") else tx("Ver el mapa"), { verMapa = !verMapa })
                }
                BotonIcono(Icons.Default.QrCodeScanner, tx("Escanear paquetes"), alEscanear)
                if (e.paradas.isNotEmpty()) BotonIcono(Icons.Default.Add, tx("Añadir una parada"), alAnadir)
            }
        },
        snackbarHost = { AvisoFlotante(avisos) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { pad ->
        PullToRefreshBox(isRefreshing = e.refrescando, onRefresh = { vm.cargar(tirando = true) }, modifier = Modifier.padding(pad).fillMaxSize()) {
            when {
                e.cargando && e.ruta == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                e.ruta == null -> SinRuta(e.error ?: tx("No se ha podido cargar tu ruta.")) { vm.cargar() }
                verMapa -> MapaRuta(e.pendientes, e.ruta?.base, trazado = e.trazado, hechas = e.paradas.filter { !it.pendiente },
                    incidencias = e.incidencias?.incidencias.orEmpty(), zbe = e.zbe?.zonas.orEmpty(), enZbe = e.zbe?.paradas?.keys.orEmpty(),
                    fuente = e.incidencias?.fuente.orEmpty(), tipoZona = e.zbe?.tipo ?: "ZBE",
                    furgo = furgo, alNavegar = navegarA, alTocar = { abierta = it }, alSituar = situar,
                    alAparcarEn = { lat, lng -> ambito.launch { app.cuenta.aparcar(lat, lng) } },
                    alQuitarFurgo = { ambito.launch { app.cuenta.quitarFurgo() } }, modifier = Modifier.fillMaxSize())
                else -> LazyColumn(
                    // Margen de 16, 12 entre bloques (Bloque) y abajo 24: la barra de pestañas ya la aparta MainActivity.
                    contentPadding = PaddingValues(start = Esp.l, end = Esp.l, top = Esp.xs, bottom = Esp.xl),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    // b) Un solo aviso, el primero que toque: cambios sin enviar, sin conexión, la placa que hoy no circula
                    // (la que sí circula y la norma sin placa ya no salen en «Hoy») y las paradas de otros días.
                    val sinEnviar = pendientesEnvio.size
                    val guardadaEn = e.guardadaEn
                    val placa = e.incidencias?.avisos?.firstOrNull { it.hoy == true }
                    val previas = e.ruta?.previas ?: 0
                    if (sinEnviar > 0 || guardadaEn != null || placa != null || previas > 0) item(key = "aviso") {
                        Bloque {
                            when {
                                sinEnviar > 0 -> Aviso(if (sinEnviar == 1) tx("1 sin enviar") else tx("{n} sin enviar", "n" to sinEnviar),
                                    tono = Tono.AVISO, icono = Icons.Default.CloudOff)
                                guardadaEn != null -> Aviso(tx("Sin conexión · ruta de las {h}", "h" to java.text.SimpleDateFormat("HH:mm", LOCALE_APP).format(java.util.Date(guardadaEn))),
                                    tono = Tono.AVISO, icono = Icons.Default.CloudOff)
                                // RESTRICCIONES POR PLACA (30-10-2026): rodízio, Hoy No Circula, pico y placa… solo el día que le toca.
                                placa != null -> Aviso(tx("Hoy tu placa no puede circular."), tono = Tono.PELIGRO, icono = Icons.Default.PriorityHigh,
                                    accion = tx("Fuente oficial").takeIf { placa.url.isNotBlank() }, alAccion = { Acciones.abrirWeb(ctx, placa.url) })
                                // Paradas de días anteriores sin cerrar (29-10-2026): la ruta es la del día y lo que quedó se iba de «Hoy».
                                else -> Aviso(if (previas == 1) tx("1 parada de otro día") else tx("{n} paradas de otros días", "n" to previas),
                                    icono = Icons.Default.History, accion = tx("Traer a hoy"), alAccion = { vm.traerPrevias() })
                            }
                        }
                    }
                    // c) El resumen del día, plano, con los chips de lo que toca.
                    val ordenada = e.ruta?.ruta?.fin != null
                    val conTelefono = e.pendientes.filter { it.telefono.isNotBlank() }
                    item(key = "resumen") {
                        Bloque {
                            ResumenDia(
                                e, ocupado = e.ocupado == "ordenar", alOrdenar = ordenar,
                                // LA CARGA GUIADA (01-11-2026): con la ruta ordenada y paquetes aún fuera de la furgoneta.
                                carga = if (ordenada && e.pendientes.any { !it.cargada }) Carga.cargadas(e.pendientes) to e.pendientes.size else null,
                                alCargar = alCargar,
                                // EL CLIENTE AVISADO (01-11-2026): con la ruta ordenada, el WhatsApp a cada cliente con móvil.
                                avisar = if (ordenada && conTelefono.isNotEmpty()) conTelefono.count { it.id in avisados } to conTelefono.size else null,
                                alAvisar = { avisando = true },
                                dinero = dineroHoy?.let { Region.importe(it.cent / 100.0) }, alDinero = { dinero = true },
                                furgo = furgo,
                                alAparcar = { ambito.launch {
                                    val p = Acciones.dondeEstoy(ctx)
                                    if (p == null) vm.avisar(tx("No llega la ubicación del móvil: dale permiso a la app.")) else app.cuenta.aparcar(p.first, p.second)
                                } },
                                alQuitarFurgo = { ambito.launch { app.cuenta.quitarFurgo() } },
                                alIrAPie = { furgo?.let { Acciones.irAPie(ctx, it.lat, it.lng) } },
                            )
                        }
                    }
                    // La ruta vacía, la ruta terminada o la tarjeta de la siguiente; y debajo, una promo.
                    if (e.paradas.isEmpty()) {
                        item(key = "vacia") { Bloque { Vacia(alEscanear, alAnadir) } }
                    } else if (e.pendientes.isEmpty()) {
                        item(key = "terminada") { Bloque { Terminada(e.entregadas, e.paradas.size) } }
                    }
                    e.pendientes.firstOrNull()?.let { sig ->
                        item(key = "sig-${sig.id}") {
                            Bloque {
                                TarjetaSiguiente(
                                    p = sig, numero = sig.orden ?: 1, enZbe = e.zbe?.paradas?.get(sig.id)?.tipo.orEmpty(),
                                    alNavegar = { navegarA(sig) }, buscando = buscandoDe == sig.id, alSituar = { situar(sig) },
                                    alLlamar = { vm.apuntar(sig, "llamada"); Acciones.llamar(ctx, sig.telefono) },
                                    alWhatsapp = { vm.apuntar(sig, "whatsapp"); Acciones.whatsapp(ctx, sig.telefono, prefijo, textoWhatsapp(sig, empresa)) },
                                    alEntregar = { entregarRapido(sig) },
                                    alFallar = { fallando = sig },
                                    alAbrir = { abierta = sig },
                                    alEscuchar = { Voz.decir(ctx, Briefing.texto(sig)) },
                                    alMemoria = { memoriaDe = sig },
                                    alEditar = { alEditar(sig) },
                                )
                            }
                        }
                    }
                    // e) La promo, una a la vez: el bono hasta ganarlo (o recién ganado); si no, invitar tras la primera
                    // entrega del día. Nunca encima de la tarjeta: lo primero sigue siendo repartir.
                    val bono = e.ruta?.bono?.takeIf { !it.pagado || it.nuevo }
                    if (bono != null) {
                        item(key = "bono") { Bloque { PromoBono(bono) } }
                    } else invitacion?.let { i ->
                        item(key = "invitar") {
                            Bloque {
                                PromoInvitar(i.referidos,
                                    alWhatsapp = { Acciones.whatsappLibre(ctx, textoInvitar(i)) },
                                    alCompartir = { Acciones.compartir(ctx, textoInvitar(i)) },
                                    alAhoraNo = { ambito.launch { app.cuenta.ocultarInvitar(diaRuta) } })
                            }
                        }
                    }
                    // f) «Por entregar» y la lista: la cabecera de 40 (o el buscador en su lugar) y las filas, sin hueco
                    // entre ellas, en una sola superficie con la forma de su sitio (ContenedorLista en un LazyColumn).
                    val resto = e.pendientes.drop(1)
                    if (resto.isNotEmpty()) {
                        item(key = "por-entregar") {
                            Bloque {
                                // EL BUSCADOR (30-10-2026): con muchas paradas y un cliente al teléfono, encontrarlo por su nombre,
                                // la calle, el teléfono o el código, como la web a partir de 5 paradas. Detrás del 🔍 (07-11-2026).
                                CabeceraLista(n = resto.size, conBuscador = e.pendientes.size > 5, abierto = buscador, buscar = buscar,
                                    alAbrir = { buscador = true }, alCambiar = { buscar = it }, alCerrar = { buscador = false; buscar = "" })
                            }
                        }
                        // Sin ordenar todavía, el número es su puesto en la lista (la siguiente es la 1). Si la ruta ya está
                        // ordenada, la que se añade después no se inventa un número: espera a «Ordenar ruta».
                        val hayOrden = e.pendientes.any { it.orden != null }
                        val visibles = resto.withIndex().filter { Calle.coincide(it.value, buscar) }
                        if (visibles.isEmpty()) item(key = "sin-resultados") {
                            Text(tx("Sin resultados"), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(Esp.s))
                        }
                        itemsIndexed(visibles, key = { _, iv -> iv.value.id }) { i, iv ->
                            val p = iv.value
                            FilaDeLista(i, visibles.size) {
                                FilaParada(p, numero = p.orden ?: (if (hayOrden) null else iv.index + 2), enZbe = e.zbe?.paradas?.get(p.id)?.tipo.orEmpty(),
                                    alTocar = { abierta = p })
                            }
                        }
                    }
                    // g) «Hechas hoy».
                    if (e.hechas.isNotEmpty()) item(key = "hechas") { Bloque { Hechas(e.hechas, alTocar = { abierta = it }) } }
                }
            }
            // «Buscando la dirección…» (02-11-2026): el geocodificador del móvil trabajando tras pulsar «Ir»; no bloquea.
            if (buscandoDe != null) Pastilla(tx("Buscando la dirección…"), modifier = Modifier.align(Alignment.TopCenter).padding(top = Esp.s))
        }
    }

    abierta?.let { p ->
        ParadaHoja(
            p = p, prefijo = prefijo, empresa = empresa,
            alCerrar = { abierta = null },
            alNavegar = { abierta = null; navegarA(p) },
            alEntregar = { abierta = null; entregando = p },
            alFallar = { abierta = null; fallando = p },
            alDeshacer = { abierta = null; vm.deshacer(p) },
            alEditar = { abierta = null; alEditar(p) },
            alQuitar = { abierta = null; vm.quitar(p) },
            alApuntar = { vm.apuntar(p, it) },
            alRepetirFoto = { abierta = null; vm.pedirRevisar(p) },
            alMemoria = { abierta = null; memoriaDe = p },
            alSituar = { abierta = null; situar(p) },
        )
    }
    entregando?.let { p ->
        EntregaHoja(p = p, alCerrar = { entregando = null }, alConfirmar = { cuerpo -> entregando = null; vm.entregar(p, cuerpo) })
    }
    fallando?.let { p ->
        NoEntregadoHoja(alCerrar = { fallando = null }, alConfirmar = { motivo, nota -> fallando = null; vm.noEntregado(p, motivo, nota) })
    }
    if (avisando) {
        AvisarHoja(paradas = e.pendientes.filter { it.telefono.isNotBlank() }, avisados = avisados,
            alAvisar = { p -> Acciones.whatsapp(ctx, p.telefono, prefijo, textoWhatsapp(p, empresa)); vm.avisado(p) }, alCerrar = { avisando = false })
    }
    memoriaDe?.let { p ->
        MemoriaHoja(p, alCerrar = { memoriaDe = null }, alGuardar = { portal, dejar, acceso -> memoriaDe = null; vm.guardarMemoria(p, portal, dejar, acceso) })
    }
    if (dinero && dineroHoy != null) MiDineroHoja(dineroHoy, alCerrar = { dinero = false })
    // LA ENTREGA VERIFICADA (01-11-2026): la IA pide mirar la foto que se acaba de hacer (o la de una entregada, desde su ficha).
    revisar?.let { r -> RevisarFotoDialogo(r, alRepetir = { vm.repetirFoto(r, it) }, alCerrar = { vm.revisado() }) }
    // «Situar la parada» (02-11-2026): «Es aquí» guarda el punto (sin red, en el móvil) y abre la guía.
    situando?.let { p0 ->
        val p = e.paradas.firstOrNull { it.id == p0.id } ?: p0
        val base = e.ruta?.base
        SituarPantalla(
            direccion = p.direccion, cp = p.cp, localidad = p.localidad, cliente = p.cliente,
            inicio = Situar.centro(p, base, e.paradas), pais = pais,
            cerca = Situar.dondeReparte(p, base, e.paradas).firstOrNull(),
            primera = primeraSituar,
            textoFuera = tx("Abrir en {app}", "app" to nombreFuera),
            onFuera = { situando = null; Acciones.navegar(ctx, p, fuera) },
            ocupado = guardandoPunto, error = errorPunto,
            onCerrar = { situando = null; errorPunto = null; primeraSituar = null },
            onElegir = { punto, origen, sugerida ->
                guardandoPunto = true; errorPunto = null
                // UN SOLO SITIO QUE DECIDE (03-11-2026, visto en el emulador: «Rúa Brétema, 15179 Oleiros · Otra calle» +
                // «Es aquí» dejaba la parada en «Rúa Brétema Mariñeira 23, 15011 A Coruña» con el punto de Oleiros, y la
                // guía llevaba a Oleiros). Con la chincheta donde la puso una sugerencia, la regla de Situar.alElegir con la
                // dirección GUARDADA de la parada (no lo escrito en el buscador de «Situar»): «calle» si sale la calle (el
                // servidor la deja «aprox») y, si cambia, la dirección nueva con su CP y su población, que se guardan con
                // el punto (sin red, también: van en la cola). Movida a mano, la puerta y la dirección de siempre. Con el CP
                // y la población guardados de la parada (03-11-2026): la misma calle en otro sitio es otra calle.
                val cambio = Situar.esAqui(p.direccion, origen, sugerida, p.cp, p.localidad)
                ambito.launch {
                    try {
                        when (val s = vm.guardarPunto(p, punto.lat, punto.lng, origen, cambio)) {
                            is Repositorio.Situado.Hecha -> { situando = null; ir(s.parada) }
                            Repositorio.Situado.EnElMovil -> {
                                situando = null
                                vm.avisar(tx("Sin conexión: el punto queda guardado en el móvil y se envía al volver la red."))
                                ir(Situar.situada(p, punto.lat, punto.lng, origen, cambio))
                            }
                            // Un servidor anterior a esto no guarda el punto: al menos se va a ese punto, no a la dirección.
                            Repositorio.Situado.NoGuardado -> {
                                situando = null
                                vm.avisar(tx("No se ha podido guardar el punto en el servidor: se abre en {app}.", "app" to nombreFuera))
                                Acciones.navegar(ctx, Situar.situada(p, punto.lat, punto.lng, origen, cambio), fuera)
                            }
                        }
                    } catch (er: ErrorApi) {
                        errorPunto = er.message ?: tx("No se ha podido guardar")
                    } finally {
                        guardandoPunto = false
                    }
                }
            },
        )
    }
    // La guía, encima de todo (una ventana propia); las hojas de entregar y de no entregado se abren encima de ella.
    objetivo?.let { p ->
        GuiaPantalla(
            parada = p, numero = p.orden ?: 1, quedan = e.pendientes.size, navegarFuera = "google", avisos = avisos,
            onSalir = { guiando = null },
            onEntregar = entregarRapido,
            onNoEntregar = { fallando = it },
            onLlamar = { vm.apuntar(it, "llamada"); Acciones.llamar(ctx, it.telefono) },
            onLlegar = { vm.apuntar(it, "llegada") },
        )
    }
}

/** Lo que se lleva hoy (céntimos), las fallidas y lo que no se cobra por ellas: el chip del resumen y su hoja. */
private class DineroHoy(val cent: Int, val fallidas: Int, val perdido: Int)

/** Un bloque de «Hoy»: 12 por encima, lo que va entre bloques (§3.2); las filas de la lista van sin hueco. */
@Composable
private fun Bloque(contenido: @Composable () -> Unit) {
    Box(Modifier.fillMaxWidth().padding(top = Esp.m)) { contenido() }
}

/** La fecha corta de la cabecera («mar 3 nov»), sin los puntos de las abreviaturas. El día de la RUTA (el del servidor,
 *  en la zona de la cuenta), no el del reloj del móvil: pasada la medianoche o con el móvil en otro huso, la cabecera
 *  decía un día y la lista era de otro (visto en el emulador). */
private fun fechaCorta(fecha: String?): String =
    (fecha?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: LocalDate.now())
        .format(DateTimeFormatter.ofPattern(patronFecha("EEE d MMM"), LOCALE_APP)).replace(".", "")

/** «31 de diciembre» en el idioma de la app, para el mensaje de invitar (02-11-2026): hasta cuándo es gratis y sin
 *  límite el plan (/billing/planes). Null si no hay promoción o ya pasó: el mensaje dice entonces «pruébala gratis». */
private fun fechaGratis(iso: String?): String? = iso?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    ?.takeIf { !LocalDate.now().isAfter(it) }?.format(DateTimeFormatter.ofPattern(patronFecha("d 'de' MMMM"), LOCALE_APP))

/** «+8 min» o «+1 h 15 min»: el retraso de la siguiente parada, en la etiqueta del resumen. */
private fun textoRetraso(min: Int): String = if (min >= 60) "+${min / 60} h ${min % 60} min" else "+$min min"

/** El resumen del día (§5.1 c), plano: «Quedan {n} paradas» con el retraso al lado, «Acabas ≈ {fin} · {km}», la barra
 *  de 4 y una fila de chips que se desliza (ordenar, cargar, avisar, el dinero y la furgoneta), solo los que tocan.
 *  Fuera el anillo, «con tráfico típico», los minutos y la caja del dinero. */
@Composable
private fun ResumenDia(
    e: EstadoRuta, ocupado: Boolean, alOrdenar: () -> Unit,
    carga: Pair<Int, Int>?, alCargar: () -> Unit, avisar: Pair<Int, Int>?, alAvisar: () -> Unit,
    dinero: String?, alDinero: () -> Unit,
    /** DÓNDE APARQUÉ (30-10-2026): el punto de la furgoneta, y el camino a pie hasta ella. */
    furgo: Furgo?, alAparcar: () -> Unit, alQuitarFurgo: () -> Unit, alIrAPie: () -> Unit,
) {
    val c = MaterialTheme.colorScheme
    val total = e.paradas.size
    val hechas = e.hechas.size
    val q = e.pendientes.size
    val r = e.ruta?.ruta
    // EL RETRASO (30-10-2026): la hora prevista de la siguiente parada frente a la de ahora, solo con la ruta de hoy.
    val retraso = if (e.ruta?.fecha == LocalDate.now().toString()) Calle.retraso(e.pendientes.firstOrNull()?.eta, LocalTime.now().let { "%02d:%02d".format(it.hour, it.minute) }) else 0
    Column(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(when (q) { 0 -> if (total == 0) tx("Sin paradas todavía") else tx("Todo entregado"); 1 -> tx("Queda 1 parada"); else -> tx("Quedan {n} paradas", "n" to q) },
                style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            if (retraso > 5) { Spacer(Modifier.width(Esp.s)); Etiqueta(textoRetraso(retraso), Tono.PELIGRO) }
        }
        // De noche la ruta sale a la hora de salida, y sin «Sales a las» las horas no se entendían (30-10-2026). Sin los minutos.
        val partes = listOfNotNull(
            r?.salida?.takeIf { r.programada == true }?.let { tx("Sales a las {h}", "h" to it) },
            r?.fin?.let { tx("Acabas ≈") + " $it" },
            r?.km?.takeIf { it > 0 }?.let { Region.distancia(it) },
        )
        if (partes.isNotEmpty() && q > 0) {
            Text(partes.joinToString(" · "), style = MaterialTheme.typography.bodySmall.merge(TextoNumero), color = c.onSurfaceVariant,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (total > 0) {
            Spacer(Modifier.height(Esp.s))
            LinearProgressIndicator(
                progress = { hechas / total.toFloat() }, color = c.primary, trackColor = c.surfaceVariant,
                strokeCap = StrokeCap.Butt, gapSize = 0.dp, drawStopIndicator = {},
                modifier = Modifier.fillMaxWidth().height(4.dp).clip(MaterialTheme.shapes.extraSmall)
                    .semantics { contentDescription = tx("{a} de {b} hechas", "a" to hechas, "b" to total) },
            )
        }
        if (q > 0 || dinero != null) {
            val reordenar = retraso > 15 && q > 1
            Spacer(Modifier.height(Esp.m))
            FilaDeChips {
                if (q >= 2) {
                    // «Ordenar ruta»: relleno mientras no está ordenada, de contorno si ya lo está; con más de 15 min de
                    // retraso, «Reordenar» en aviso: un toque recalcula desde donde estás (30-10-2026). La misma acción.
                    ChipAccion(
                        when { ocupado -> tx("Ordenando por tiempo…"); reordenar -> tx("Reordenar"); else -> tx("Ordenar ruta") }, alOrdenar,
                        icono = Icons.Default.Route, tono = when { reordenar -> Tono.AVISO; r?.fin == null -> Tono.MARCA; else -> Tono.NEUTRO },
                        nombre = if (reordenar && !ocupado) tx("Reordenar desde aquí") else null, enabled = !ocupado, cargando = ocupado,
                    )
                }
                carga?.let { (a, b) -> ChipAccion(tx("Cargar") + " $a/$b", alCargar, icono = Icons.Default.LocalShipping, nombre = tx("Cargar la furgoneta")) }
                avisar?.let { (a, b) -> ChipAccion(tx("Avisar") + " $a/$b", alAvisar, icono = Icons.AutoMirrored.Filled.Chat, nombre = tx("Avisar a todos por WhatsApp")) }
                dinero?.let { ChipAccion(it, alDinero, icono = Icons.Default.Payments, nombre = tx("Mi dinero hoy")) }
                // DÓNDE APARQUÉ (30-10-2026): el punto de la furgoneta al bajarte; aparcada, su menú (a pie, quitar). Solo en el móvil.
                if (q > 0) {
                    if (furgo == null) ChipAccion(tx("Aparcada aquí"), alAparcar, icono = Icons.Default.LocalShipping)
                    else Menu(
                        listOf(
                            Opcion(tx("Volver a la furgoneta a pie"), Icons.AutoMirrored.Filled.DirectionsWalk, alPulsar = alIrAPie),
                            Opcion(tx("Quitar"), Icons.Default.Close, alPulsar = alQuitarFurgo),
                        ),
                        nombre = tx("Furgoneta aparcada"),
                        ancla = { abrir -> ChipAccion(tx("Furgoneta aparcada"), abrir, icono = Icons.Default.LocalShipping) },
                    )
                }
            }
        }
    }
}

/** Las etiquetas de una parada en el orden de §5.1 d: cobrar, horario, urgente, recogida, puerta conocida, ZBE, el hueco
 *  y los bultos (si hay más de uno). La tarjeta enseña 3 y «+N»; la hoja, todas. La hora ya no es un chip. */
private fun etiquetasDe(p: Parada, enZbe: String): List<Triple<String, Tono, ImageVector?>> = listOfNotNull(
    if (p.porCobrar) Triple(tx("Cobrar") + " " + Region.importe(p.cobrar ?: 0.0), Tono.AVISO, Icons.Default.Payments) else null,
    if (p.ventanaDesde != null) Triple("${p.ventanaDesde}–${p.ventanaHasta.orEmpty()}", Tono.NEUTRO, Icons.Default.Schedule) else null,
    if (p.prioridad) Triple(tx("Urgente"), Tono.PELIGRO, Icons.Default.PriorityHigh) else null,
    if (p.tipo == "recogida") Triple(tx("Recogida"), Tono.NEUTRO, null) else null,
    if (p.geo == "puerta" && p.pendiente) Triple(tx("Puerta conocida"), Tono.OK, null) else null,
    if (enZbe.isNotBlank() && p.pendiente) Triple(enZbe, Tono.ZONA, null) else null,
    if (p.hueco.isNotBlank()) Triple(tx(p.hueco), Tono.NEUTRO, Icons.Default.Inventory2) else null,
    if (p.bultos > 1) Triple(tx("{n} bultos", "n" to p.bultos), Tono.NEUTRO, null) else null,
)

/** La tarjeta de la siguiente parada (§5.1 d), la única tarjeta de «Hoy»: borde de énfasis de 2, radio 16, relleno 12.
 *  Arriba, lo que abre la hoja (número de 40, nombre en una línea, hora con «+{n}» en peligro si llega tarde y «›»);
 *  la dirección en dos líneas; las etiquetas en una línea (3 y «+N») con el chip de situar si no tiene sitio; las notas
 *  de la puerta en dos líneas; «Ir» con «Llamar» y «WhatsApp» solo con teléfono y el ⋮ (escuchar, memoria, editar); y
 *  el cierre de 52. Fuera el rótulo «SIGUIENTE PARADA» (queda como nombre de la región), el altavoz, la banda «Sin
 *  situar en el mapa» y los botones grises sin teléfono. */
@Composable
private fun TarjetaSiguiente(
    p: Parada, numero: Int, enZbe: String = "",
    alNavegar: () -> Unit, alLlamar: () -> Unit, alWhatsapp: () -> Unit, alEntregar: () -> Unit, alFallar: () -> Unit, alAbrir: () -> Unit,
    alEscuchar: () -> Unit, alMemoria: () -> Unit, alEditar: () -> Unit,
    /** El móvil está buscando la dirección (02-11-2026), y «Situar» para ponerla a mano. */
    buscando: Boolean = false, alSituar: () -> Unit = {},
) {
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    val nombreRegion = tx("Siguiente parada")
    val eta = p.eta
    val tarde = (p.tardeMin ?: 0) > 0
    Surface(
        color = c.surfaceContainerLow, shape = MaterialTheme.shapes.large, border = BorderStroke(2.dp, x.enfasis),
        modifier = Modifier.fillMaxWidth().semantics { stateDescription = nombreRegion },
    ) {
        Column(Modifier.padding(Esp.m)) {
            Row(Modifier.fillMaxWidth().clickable(onClick = alAbrir).semantics(mergeDescendants = true) {}, verticalAlignment = Alignment.Top) {
                NumeroParada(numero, TamNumero.GRANDE, EstadoNumero.SIGUIENTE)
                Spacer(Modifier.width(Esp.m))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(p.cliente.ifBlank { p.direccion }, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f))
                        if (!eta.isNullOrBlank()) {
                            Spacer(Modifier.width(Esp.s))
                            Text(if (tarde) "$eta +${p.tardeMin}" else eta, style = MaterialTheme.typography.labelLarge.merge(TextoNumero),
                                color = if (tarde) c.error else c.onSurfaceVariant, maxLines = 1)
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = c.onSurfaceVariant, modifier = Modifier.size(20.dp))
                    }
                    if (p.cliente.isNotBlank()) {
                        Text(p.direccion, style = MaterialTheme.typography.bodyMedium, color = c.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            // Una línea de etiquetas (3 como mucho y «+N») y, sin sitio, el chip que abre «Situar la parada»: «Sin situar ·
            // Situar» sin punto, o «Situar en el mapa» con solo la calle (geo «aprox»).
            val etiquetas = etiquetasDe(p, enZbe)
            val sinSituar = Situar.sinSituar(p)
            val soloCalle = p.pendiente && p.geo == "aprox"
            if (etiquetas.isNotEmpty() || sinSituar || soloCalle) {
                Spacer(Modifier.height(Esp.s))
                FilaDeChips {
                    etiquetas.take(3).forEach { (t, tono, i) -> Etiqueta(t, tono, i) }
                    if (etiquetas.size > 3) Etiqueta("+${etiquetas.size - 3}")
                    if (sinSituar) ChipAccion(tx("Sin situar") + " · " + tx("Situar"), alSituar, icono = Icons.Default.LocationOff, tono = Tono.AVISO)
                    else if (soloCalle) ChipAccion(tx("Situar en el mapa"), alSituar, icono = Icons.Default.EditLocationAlt)
                }
            }
            NotasPuerta(p, maxLines = 2, modifier = Modifier.padding(top = Esp.s))
            Spacer(Modifier.height(Esp.m))
            Row(horizontalArrangement = Arrangement.spacedBy(Esp.s), verticalAlignment = Alignment.CenterVertically) {
                BotonNormal(tx("Ir"), alNavegar, icono = Icons.Default.Navigation, tono = Tono.MARCA, enabled = !buscando, modifier = Modifier.weight(1f))
                if (p.telefono.isNotBlank()) {
                    BotonIcono(Icons.Default.Call, tx("Llamar"), alLlamar, relleno = true)
                    BotonIcono(Icons.AutoMirrored.Filled.Chat, tx("WhatsApp"), alWhatsapp, relleno = true)
                }
                // EL BRIEFING POR VOZ (01-11-2026), la memoria de la calle y «Editar», en el ⋮ (riesgo 9 f).
                Menu(listOf(
                    Opcion(tx("Escuchar"), Icons.AutoMirrored.Filled.VolumeUp, nombre = tx("Escuchar la siguiente parada"), alPulsar = alEscuchar),
                    Opcion(tx("Memoria de la puerta"), Icons.Default.Key, alPulsar = alMemoria),
                    Opcion(tx("Editar"), Icons.Default.Edit, alPulsar = alEditar),
                ))
            }
            Spacer(Modifier.height(Esp.s))
            FilaCierre(recogida = p.tipo == "recogida", alFallar = alFallar, alEntregar = alEntregar)
        }
    }
}

/** El bono de bienvenida como promo (§5.1 e): «{euros} por tu primera ruta real» con «{a}/{b}» y la barra de 2 (o «¡Has
 *  ganado {euros}!» en ok, recién pagado); tocarla abre las condiciones. Siempre en euros, como la web (eurosRef): el
 *  bono lo paga FDS en euros sea cual sea el país de la cuenta (30-10-2026). */
@Composable
private fun PromoBono(b: Bono) {
    val euros = "${"%.2f".format(LOCALE_APP, b.cent / 100.0)} €"
    if (b.pagado) {
        Promo(tx("¡Has ganado {euros}!", "euros" to euros), Icons.Default.CardGiftcard, tono = Tono.OK)
    } else {
        var condiciones by remember { mutableStateOf(false) }
        val texto = tx("{euros} por tu primera ruta real", "euros" to euros)
        Promo(texto, Icons.Default.CardGiftcard, tono = Tono.AVISO, cifra = "${b.entregas}/${b.objetivo}",
            progreso = if (b.objetivo > 0) b.entregas / b.objetivo.toFloat() else 0f, alTocar = { condiciones = true },
            pista = if (b.revisar) tx("Lo estamos revisando: te avisamos en cuanto esté.") else null)
        if (condiciones) {
            DialogoAyuda(
                texto,
                tx("{n} entregas en {d} días distintos", "n" to b.objetivo, "d" to b.diasObjetivo) +
                    (b.limite?.let { " " + tx("antes del {f}", "f" to "${it.takeLast(2)}/${it.substring(5, 7)}") } ?: "") + ". " +
                    tx("Llevas {n} {e} en {d} {dd}.", "n" to b.entregas, "e" to (if (b.entregas == 1) tx("entrega") else tx("entregas")),
                        "d" to b.dias, "dd" to (if (b.dias == 1) tx("día") else tx("días"))),
                alCerrar = { condiciones = false },
            )
        }
    }
}

/** LA INVITACIÓN TRAS LA PRIMERA ENTREGA (02-11-2026), como promo: «Gana {euros} por compañero» (sin premio, «Invita a
 *  un compañero…»), el botón de WhatsApp con el mensaje puesto y «Ahora no» hasta mañana; tocar el texto abre las
 *  condiciones, con «Compartir» (el compartir del móvil). */
@Composable
private fun PromoInvitar(r: Referidos, alWhatsapp: () -> Unit, alCompartir: () -> Unit, alAhoraNo: () -> Unit) {
    var condiciones by remember { mutableStateOf(false) }
    val texto = if (r.porInvitado > 0) tx("Gana {euros} por compañero", "euros" to Invitar.importe(r.porInvitado)) else tx("Invita a un compañero a repartir con FDS")
    Promo(texto, Icons.Default.CardGiftcard, tono = Tono.OK, alTocar = { condiciones = true },
        accion = AccionIcono(Icons.AutoMirrored.Filled.Chat, tx("Invitar por WhatsApp"), alWhatsapp), alCerrar = alAhoraNo, nombreCerrar = tx("Ahora no"))
    if (condiciones) {
        DialogoAyuda(
            texto,
            tx("Lo cobras en tu cartera cuando haga {n} entregas en {d} días distintos. Mándale tu enlace: se registra y empieza hoy.", "n" to r.entregasCartera, "d" to r.diasDistintos),
            alCerrar = { condiciones = false }, accion = tx("Compartir"), alAccion = { condiciones = false; alCompartir() },
        )
    }
}

/** La explicación larga de una promo, al tocarla: el mismo diálogo que abre el «?» (Ayuda), con «Entendido» y, si hace
 *  falta, una acción más («Compartir»). */
@Composable
private fun DialogoAyuda(titulo: String, texto: String, alCerrar: () -> Unit, accion: String? = null, alAccion: () -> Unit = {}) {
    val otra: (@Composable () -> Unit)? = if (accion != null) { { BotonTexto(accion, alAccion) } } else null
    AlertDialog(
        onDismissRequest = alCerrar,
        confirmButton = { BotonTexto(tx("Entendido"), alCerrar) },
        dismissButton = otra,
        title = { Text(titulo, style = MaterialTheme.typography.titleLarge) },
        text = { Text(texto, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.verticalScroll(rememberScrollState())) },
        shape = MaterialTheme.shapes.large,
    )
}

/** La ruta vacía (§5.1 h): el título, una línea y «Escanear» + «A mano» en una fila; fuera el icono grande y los párrafos. */
@Composable
private fun Vacia(alEscanear: () -> Unit, alAnadir: () -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        Text(tx("Carga tus paradas de hoy"), style = MaterialTheme.typography.titleLarge)
        Text(tx("Escanea los paquetes o comparte la hoja de la agencia"), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(Esp.m))
        Row(horizontalArrangement = Arrangement.spacedBy(Esp.s)) {
            BotonPrincipal(tx("Escanear"), alEscanear, icono = Icons.Default.QrCodeScanner, modifier = Modifier.weight(1f))
            BotonNormal(tx("A mano"), alAnadir, icono = Icons.Default.Edit, nombre = tx("Añadir una parada"), modifier = Modifier.weight(1f).heightIn(min = Alto.principal))
        }
    }
}

/** La ruta terminada (§5.1 i): plano, con tinte ok y radio 12; «Ruta terminada» y «{a} de {b} entregadas hoy.». */
@Composable
private fun Terminada(entregadas: Int, total: Int) {
    val c = MaterialTheme.colorScheme
    Surface(color = c.tertiaryContainer, contentColor = c.onTertiaryContainer, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(Esp.m)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(Esp.s))
                Text(tx("Ruta terminada"), style = MaterialTheme.typography.titleLarge)
            }
            Text(tx("{a} de {b} entregadas hoy.", "a" to entregadas, "b" to total), style = MaterialTheme.typography.bodyMedium.merge(TextoNumero))
        }
    }
}

/** La cabecera de la lista (§5.1 f): «Por entregar · {n}» con el 🔍 a la derecha (con más de 5 paradas); abierto, el
 *  buscador de 48 en su lugar, con la ✕ que lo cierra y lo vacía. Filtra la lista, no la tarjeta. */
@Composable
private fun CabeceraLista(n: Int, conBuscador: Boolean, abierto: Boolean, buscar: String, alAbrir: () -> Unit, alCambiar: (String) -> Unit, alCerrar: () -> Unit) {
    if (abierto) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            CampoTexto(buscar, alCambiar, icono = Icons.Default.Search, ejemplo = tx("Buscar"), nombre = tx("Buscar en la ruta"), modifier = Modifier.weight(1f))
            Spacer(Modifier.width(Esp.xs))
            BotonIcono(Icons.Default.Close, tx("Cerrar"), alCerrar)
        }
    } else {
        Row(Modifier.fillMaxWidth().heightIn(min = 40.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(tx("Por entregar") + " · $n", style = MaterialTheme.typography.labelMedium.merge(TextoNumero), color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(start = Esp.xs))
            if (conBuscador) BotonIcono(Icons.Default.Search, tx("Buscar en la ruta"), alAbrir)
        }
    }
}

/** «Hechas hoy» (§5.1 g): una fila de 48 con la flecha, «Hechas hoy · {n}» y « · {m} sin entregar» en peligro; se abre
 *  sola si hay fallidas (como la web, riesgo 9 h); dentro, las hechas en una sola superficie, y tocar una abre su hoja. */
@Composable
private fun Hechas(hechas: List<Parada>, alTocar: (Parada) -> Unit) {
    val c = MaterialTheme.colorScheme
    val fallidas = hechas.count { it.estado == "fallido" }
    val hayFallidas = fallidas > 0
    var abierto by rememberSaveable(hayFallidas) { mutableStateOf(hayFallidas) }
    Column {
        Row(Modifier.fillMaxWidth().clickable { abierto = !abierto }.heightIn(min = Alto.boton).padding(horizontal = Esp.xs), verticalAlignment = Alignment.CenterVertically) {
            Text(buildAnnotatedString {
                append(tx("Hechas hoy") + " · ${hechas.size}")
                if (hayFallidas) withStyle(SpanStyle(color = c.error)) { append(" · " + tx("{n} sin entregar", "n" to fallidas)) }
            }, style = MaterialTheme.typography.labelMedium.merge(TextoNumero), color = c.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f))
            Icon(if (abierto) Icons.Default.ExpandLess else Icons.Default.ExpandMore, contentDescription = if (abierto) tx("Ocultar") else tx("Ver"), tint = c.onSurfaceVariant)
        }
        AnimatedVisibility(abierto) {
            ContenedorLista(hechas.size, modifier = Modifier.padding(top = Esp.xs)) { i ->
                val p = hechas[i]
                FilaParada(p, numero = p.orden, alTocar = { alTocar(p) })
            }
        }
    }
}

/** «Mi dinero hoy» (§5.1 j), solo lectura: lo que llevas y lo que no se cobra por no entregar; la tarifa sigue en Ajustes. */
@Composable
private fun MiDineroHoja(d: DineroHoy, alCerrar: () -> Unit) {
    Hoja(titulo = tx("Mi dinero hoy"), alCerrar = alCerrar) {
        Text(tx("Hoy llevas {x}", "x" to Region.importe(d.cent / 100.0)), style = MaterialTheme.typography.titleMedium.merge(TextoNumero))
        if (d.perdido > 0) {
            Spacer(Modifier.height(Esp.xs))
            Text(
                if (d.fallidas == 1) tx("1 sin entregar = {euros} sin cobrar", "euros" to Region.importe(d.perdido / 100.0))
                else tx("{n} sin entregar = {euros} sin cobrar", "n" to d.fallidas, "euros" to Region.importe(d.perdido / 100.0)),
                style = MaterialTheme.typography.bodyMedium.merge(TextoNumero), color = MaterialTheme.colorScheme.error,
            )
        }
        Spacer(Modifier.height(Esp.s))
    }
}

/** EL PRIMER PAQUETE BIEN SITUADO (02-11-2026): una parada sin punto en el mapa lo dice claro, con «Situar». En «Hoy»
 *  ya lo hace el chip de la tarjeta; la hoja de la parada (Hojas.kt) sigue usándolo hasta que pase a la Hoja común. */
@Composable
internal fun AvisoSinSituar(alSituar: () -> Unit) {
    Aviso(tx("Sin situar en el mapa"), tono = Tono.AVISO, icono = Icons.Default.LocationOff, accion = tx("Situar"), alAccion = alSituar)
}

/** El número de parada de antes, sobre la pieza NumeroParada (07-11-2026): lo usa la guía hasta que pase a la pieza. */
@Composable
internal fun Numero(n: Int?, grande: Boolean = false, hecho: Boolean = false) {
    NumeroParada(n, if (grande) TamNumero.GRANDE else TamNumero.FILA, if (hecho) EstadoNumero.HECHA else EstadoNumero.SIGUIENTE)
}

/** Las etiquetas de una parada (todas, con `Etiqueta`), como las usan la hoja de la parada y la tarjeta del mapa hasta
 *  que pasen a las piezas: sin la hora (ya va al lado del nombre) y, sin sitio, «Sin situar · Situar» con `alSituar`. */
@Composable
fun Etiquetas(
    p: Parada, enZbe: String = "",
    /** Sin situar (02-11-2026): con esto, el chip es «Sin situar · Situar» y abre «Situar la parada». */
    alSituar: (() -> Unit)? = null,
    /** El aviso de sin situar ya va aparte (AvisoSinSituar): sin chip. */
    avisoAparte: Boolean = false,
) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(Esp.s), verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
        etiquetasDe(p, enZbe).forEach { (t, tono, i) -> Etiqueta(t, tono, i) }
        if (Situar.sinSituar(p) && !avisoAparte) {
            if (alSituar != null) ChipAccion(tx("Sin situar") + " · " + tx("Situar"), alSituar, icono = Icons.Default.LocationOff, tono = Tono.AVISO)
            else Etiqueta(tx("Sin situar"), Tono.AVISO, Icons.Default.LocationOff)
        }
    }
}

/** La fila de una parada, con la firma de siempre (la usa el Historial, Pestanas.kt) y el cuerpo de la pieza FilaParada
 *  (07-11-2026). `alSituar` ya no pinta nada: «Situar» va en la hoja de la parada. */
@Composable
fun Fila(p: Parada, numero: Int?, enZbe: String = "", alTocar: () -> Unit, @Suppress("UNUSED_PARAMETER") alSituar: (() -> Unit)? = null) {
    FilaParada(p, numero, enZbe, alTocar)
}

@Composable
private fun SinRuta(error: String, alReintentar: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.CloudOff, contentDescription = null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(Esp.m))
        Text(error, style = MaterialTheme.typography.bodyLarge)
        Spacer(Modifier.height(Esp.l))
        BotonNormal(tx("Reintentar"), alReintentar)
    }
}
