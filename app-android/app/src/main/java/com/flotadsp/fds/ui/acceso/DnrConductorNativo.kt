// diseño compacto
package com.flotadsp.fds.ui.acceso

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.MisDnr
import com.flotadsp.fds.data.SemanaDnr
import com.flotadsp.fds.data.UnaDnr
import com.flotadsp.fds.ui.Alto
import com.flotadsp.fds.ui.Aviso
import com.flotadsp.fds.ui.Cabecera
import com.flotadsp.fds.ui.ContenedorLista
import com.flotadsp.fds.ui.Esp
import com.flotadsp.fds.ui.Etiqueta
import com.flotadsp.fds.ui.LOCALE_APP
import com.flotadsp.fds.ui.LocalExtra
import com.flotadsp.fds.ui.SeparadorLista
import com.flotadsp.fds.ui.TextoNumero
import com.flotadsp.fds.ui.Tono
import com.flotadsp.fds.ui.tx
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/* «MIS DNR» EN LA APP (11-11-2026, tanda 2; para la próxima versión de Play, no se publica ahora). La misma pantalla que el
   portal web (frontend/src/pages/driver/MisDnr.jsx), con la misma ruta (GET /diarios/mias) y las mismas frases, montada
   como la quiere Dani: «que le ponga por ejemplo "esta semana llevas 1 DNR" y cuál es, o "llevas 5" o así, y que esté bien
   montado». En este orden:
     1. Arriba y en grande, la frase de ESTA semana con su número (todas las DNR de la semana, le cuenten o no), o «Esta
        semana no llevas ninguna» con su ✓ verde. Debajo, el desglose (solo con 2 o más) y hasta qué día hay reportes: sin
        eso, «ninguna» no se distingue de «aún no se ha subido».
     2. Justo debajo, cuáles son: el paquete, el día, si le cuenta, no le cuenta o Amazon aún no la ha clasificado, y la
        marca «Nueva» o «Actualizada».
     3. Las semanas anteriores, discretas: una línea por semana con su recuento, que se abre al tocarla.
     4. Qué es cada estado, al final, para no empujar la frase grande fuera de la primera pantalla.
   SIN euros, nunca (Dani, 11-11): el servidor no los manda y aquí no hay dónde ponerlos. Solo con las piezas de
   ui/Componentes.kt y los tokens de ui/Tema.kt (lo vigila scripts/check-tokens-nativa.mjs). */

/** Lo nuevo desde la última vez que abrió la pantalla en este móvil: lo que no estaba, o lo que cambió de estado. */
internal enum class MarcaDnr { NUEVA, ACTUALIZADA }

/** Lo que se calcula sin pintar nada, aparte para probarlo (DnrConductorTest): las frases con su singular y su plural,
 *  las fechas y qué hay de nuevo. */
internal object DnrConductor {
    /** El sitio del número en la frase grande: se traduce con este hueco y el número se pinta aparte, más grande, así cada
     *  idioma lo pone donde le toca (como la web). */
    const val HUECO = "\u0001"

    /** La frase grande partida por el número: lo de antes y lo de después. El singular lleva su propia clave ({uno}):
     *  en español se escribe igual, pero en inglés y en alemán no («1 DNR» / «5 DNRs»). Con 0, la frase entera y nada
     *  después: no hay número que destacar. */
    fun partesFrase(n: Int): Pair<String, String> {
        if (n <= 0) return tx("Esta semana no llevas ninguna") to ""
        val f = if (n == 1) tx("Esta semana llevas {uno} DNR", "uno" to HUECO) else tx("Esta semana llevas {n} DNR", "n" to HUECO)
        val p = f.split(HUECO, limit = 2)
        return p[0] to p.getOrElse(1) { "" }
    }

    /** La frase grande entera: «Esta semana llevas 1 DNR», «… 5 DNR», «Esta semana no llevas ninguna». */
    fun fraseSemana(n: Int): String {
        val (antes, despues) = partesFrase(n)
        return if (n <= 0) antes else antes + n + despues
    }

    /** El desglose de la semana («1 te cuenta · 1 sin clasificar»): solo lo que hay, con su singular y su plural. */
    fun desglose(s: SemanaDnr): String {
        val c = s.dnr.count { it.estado == "cuenta" }
        val nc = s.dnr.count { it.estado == "no_cuenta" }
        val sc = s.dnr.size - c - nc
        return listOfNotNull(
            if (c == 0) null else if (c == 1) tx("1 te cuenta") else tx("{n} te cuentan", "n" to c),
            if (nc == 0) null else if (nc == 1) tx("1 no te cuenta") else tx("{n} no te cuentan", "n" to nc),
            if (sc == 0) null else if (sc == 1) tx("1 sin clasificar") else tx("{n} sin clasificar", "n" to sc),
        ).joinToString(" · ")
    }

    /** Cuántas tuvo una semana anterior: «1 DNR», «3 DNR» o «Ninguna». */
    fun cuantas(n: Int): String = when {
        n <= 0 -> tx("Ninguna")
        n == 1 -> tx("1 DNR")
        else -> tx("{n} DNR", "n" to n)
    }

    /** «1 nueva», «3 nuevas»; null si no hay ninguna (la cabecera no lleva subtítulo). */
    fun nuevas(n: Int): String? = when {
        n <= 0 -> null
        n == 1 -> tx("1 nueva")
        else -> tx("{n} nuevas", "n" to n)
    }

    /** La línea de la fila del inicio, como la casilla de la web: «Esta semana: 2» o «Esta semana: ninguna». */
    fun lineaInicio(d: MisDnr): String? {
        val n = d.semanas.firstOrNull()?.dnr?.size ?: return null
        return if (n == 0) tx("Esta semana: ninguna") else tx("Esta semana: {n}", "n" to n)
    }

    fun textoMarca(m: MarcaDnr): String = if (m == MarcaDnr.NUEVA) tx("Nueva") else tx("Actualizada")

    /** Los tres estados, en su orden, con lo que quieren decir; lo que no se conozca (un servidor más nuevo), como «sin
     *  clasificar». */
    val ESTADOS = listOf("cuenta", "no_cuenta", "sin_clasificar")
    fun textoEstado(estado: String): String = when (estado) {
        "cuenta" -> tx("Te cuenta")
        "no_cuenta" -> tx("No te cuenta")
        else -> tx("Sin clasificar")
    }
    fun explicaEstado(estado: String): String = when (estado) {
        "cuenta" -> tx("Amazon te la apunta como fallo.")
        "no_cuenta" -> tx("Amazon la revisó y no te la apunta.")
        else -> tx("Amazon aún no la ha revisado; suele tardar unos días.")
    }

    private fun fecha(iso: String, patron: String): String = runCatching {
        LocalDate.parse(iso).format(DateTimeFormatter.ofPattern(patron, LOCALE_APP))
    }.getOrDefault(iso)

    /** «Del 9/11 al 15/11» (la semana de Amazon va de domingo a sábado). */
    fun rango(s: SemanaDnr): String = tx("Del {desde} al {hasta}", "desde" to fecha(s.semana, "d/M"), "hasta" to fecha(s.hasta, "d/M"))

    /** El día de una DNR: «Mar. 10/11». */
    fun dia(iso: String): String = fecha(iso, "EEE d/M").replaceFirstChar { it.titlecase(LOCALE_APP) }

    /** Hasta qué día ha subido la oficina los reportes («Reportes subidos hasta el martes 10/11.»). */
    fun hastaCuando(datosHasta: String?): String =
        if (datosHasta.isNullOrBlank()) tx("La oficina aún no ha subido ningún reporte.")
        else tx("Reportes subidos hasta el {fecha}.", "fecha" to fecha(datosHasta, "EEEE d/M"))

    /** Lo que se apunta al abrir la pantalla: cada paquete con su estado (de las 4 semanas). */
    fun vistasDe(d: MisDnr): Map<String, String> =
        d.semanas.flatMap { it.dnr }.filter { it.paquete.isNotBlank() }.associate { it.paquete to it.estado }

    /** Lo nuevo frente a lo que vio la última vez (`vistas`; null = nunca abrió la pantalla en este móvil, y entonces
     *  todas son nuevas, como en la web): lo que no estaba, «nueva»; lo que cambió de estado, «actualizada». */
    fun novedades(d: MisDnr, vistas: Map<String, String>?): Map<String, MarcaDnr> {
        val out = LinkedHashMap<String, MarcaDnr>()
        for (x in d.semanas.flatMap { it.dnr }) {
            if (x.paquete.isBlank()) continue
            when {
                vistas == null || !vistas.containsKey(x.paquete) -> out[x.paquete] = MarcaDnr.NUEVA
                vistas[x.paquete] != x.estado -> out[x.paquete] = MarcaDnr.ACTUALIZADA
            }
        }
        return out
    }
}

/** El color y el icono de cada estado (el color solo no se distingue al sol ni sin ver colores): le cuenta, en peligro;
 *  no le cuenta, en ok; sin clasificar, en aviso. Como la web. */
private fun tonoEstado(estado: String): Pair<Tono, ImageVector> = when (estado) {
    "cuenta" -> Tono.PELIGRO to Icons.Default.Warning
    "no_cuenta" -> Tono.OK to Icons.Default.Check
    else -> Tono.AVISO to Icons.Default.Schedule
}

/** La pantalla. Con 404 (la empresa no tiene la DNR diaria) vuelve sin enseñar nada: para la app, no existe. */
@Composable
fun DnrConductorNativo(alVolver: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    var datos by remember { mutableStateOf<MisDnr?>(null) }
    var marcas by remember { mutableStateOf<Map<String, MarcaDnr>>(emptyMap()) }
    var error by remember { mutableStateOf(false) }
    var intento by remember { mutableIntStateOf(0) }
    BackHandler(onBack = alVolver)
    LaunchedEffect(intento) {
        error = false
        try {
            val d = app.repo.misDnr()
            if (d == null) { alVolver(); return@LaunchedEffect }
            // Lo nuevo se calcula con lo apuntado la vez anterior y, al momento, se apunta lo de ahora: la marca se ve
            // esta vez y la próxima ya no (como la web). Si el móvil no lo puede guardar, solo saldrán otra vez como nuevas.
            marcas = DnrConductor.novedades(d, runCatching { app.cuenta.dnrVistas() }.getOrNull())
            runCatching { app.cuenta.guardarDnrVistas(DnrConductor.vistasDe(d)) }
            datos = d
        } catch (_: ErrorApi) {
            error = true
        }
    }
    Scaffold(
        topBar = { Cabecera(tx("Mis DNR"), subtitulo = DnrConductor.nuevas(marcas.size), alVolver = alVolver) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { inset ->
        val d = datos
        when {
            d == null && error -> Column(Modifier.fillMaxSize().padding(inset).padding(Esp.l)) {
                Aviso(tx("No se han podido cargar tus DNR."), tono = Tono.PELIGRO, accion = tx("Reintentar"), alAccion = { intento++ })
            }
            d == null -> Box(Modifier.fillMaxSize().padding(inset), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            else -> Column(
                Modifier.fillMaxSize().padding(inset).verticalScroll(rememberScrollState()).padding(horizontal = Esp.l)
                    .padding(top = Esp.s, bottom = Esp.xl),
                verticalArrangement = Arrangement.spacedBy(Esp.xl),
            ) {
                if (!d.tiene_id) Aviso(tx("La oficina aún no ha enlazado tu ID de reparto. Cuando lo haga, aquí verás tus DNR."),
                    icono = Icons.Default.Inventory2, maxLineas = 4)
                if (d.en_revision) Aviso(
                    if (d.semanas.isEmpty()) tx("La oficina está revisando tu ID de reparto. Cuando lo confirme, aquí verás tus DNR.")
                    else tx("La oficina está revisando uno de tus ID de reparto: puede que aquí falte alguna."),
                    tono = Tono.AVISO, icono = Icons.Default.Schedule, maxLineas = 4)
                d.semanas.firstOrNull()?.let { EstaSemana(it, marcas, DnrConductor.hastaCuando(d.datos_hasta)) }
                val anteriores = d.semanas.drop(1)
                if (anteriores.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(Esp.s)) {
                        TituloBloque(tx("Semanas anteriores"))
                        ContenedorLista(anteriores.size, separadorDesde = 0.dp) { i -> SemanaAnterior(anteriores[i], i + 1, marcas) }
                    }
                }
                if (d.semanas.isNotEmpty()) QueEsCadaEstado()
            }
        }
    }
}

/** La cabecera de un bloque, en `etiqueta` gris (como las secciones de Ajustes y la web). */
@Composable
private fun TituloBloque(texto: String) {
    Text(texto, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = Esp.xs).semantics { heading() })
}

/** ESTA semana: las fechas, la frase grande, el desglose, hasta cuándo hay reportes y, justo debajo, cuáles son. */
@Composable
private fun EstaSemana(s: SemanaDnr, marcas: Map<String, MarcaDnr>, hasta: String) {
    val c = MaterialTheme.colorScheme
    val n = s.dnr.size
    Column(verticalArrangement = Arrangement.spacedBy(Esp.m)) {
        Column(Modifier.padding(horizontal = Esp.xs), verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
            Text(DnrConductor.rango(s), style = MaterialTheme.typography.bodySmall.merge(TextoNumero), color = c.onSurfaceVariant)
            if (n > 0) FraseSemana(n, cuentan = s.dnr.any { it.estado == "cuenta" })
            else Row(verticalAlignment = Alignment.CenterVertically) {
                // Sin ninguna, el ✓ en su círculo verde: que se vea de un vistazo que no hay nada de qué preocuparse.
                Surface(shape = CircleShape, color = LocalExtra.current.entregado, contentColor = LocalExtra.current.enEntregado) {
                    Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.padding(Esp.s).size(24.dp))
                }
                Spacer(Modifier.width(Esp.m))
                Text(DnrConductor.fraseSemana(0), style = MaterialTheme.typography.headlineMedium, modifier = Modifier.semantics { heading() })
            }
            if (n > 1) Text(DnrConductor.desglose(s), style = MaterialTheme.typography.bodyMedium.merge(TextoNumero), color = c.onSurfaceVariant)
            Text(hasta, style = MaterialTheme.typography.bodySmall, color = c.onSurfaceVariant)
        }
        if (n > 0) ContenedorLista(n, separadorDesde = Esp.m) { i -> FilaDnr(s.dnr[i], marcas[s.dnr[i].paquete]) }
    }
}

/** «Esta semana llevas N DNR» en la letra `cifra`, con el número en la de la guía (más grande): en rojo si alguna le
 *  cuenta; si no, en el color del texto (una sin clasificar o que no cuenta no es para alarmarse). La línea toma el alto
 *  del número, para que, si la frase salta de línea, el número no pise la de arriba. */
@Composable
private fun FraseSemana(n: Int, cuentan: Boolean) {
    val grande = MaterialTheme.typography.displaySmall
    val color = if (cuentan) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
    val (antes, despues) = DnrConductor.partesFrase(n)
    val texto = buildAnnotatedString {
        append(antes)
        withStyle(grande.toSpanStyle().copy(color = color)) { append(n.toString()) }
        append(despues)
    }
    Text(texto, style = MaterialTheme.typography.headlineMedium.copy(lineHeight = grande.lineHeight), modifier = Modifier.semantics { heading() })
}

/** Una DNR: el paquete entero (es lo que se busca en el reporte) y el día; a la derecha, su estado y, si lo es, «Nueva». */
@Composable
private fun FilaDnr(x: UnaDnr, marca: MarcaDnr?) {
    val (tono, icono) = tonoEstado(x.estado)
    Row(
        Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}.heightIn(min = Alto.boton)
            .padding(horizontal = Esp.m, vertical = Esp.s),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(x.paquete, style = MaterialTheme.typography.bodyMedium.merge(TextoNumero))
            Text(DnrConductor.dia(x.dia), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.width(Esp.s))
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(Esp.xs)) {
            marca?.let { Etiqueta(DnrConductor.textoMarca(it), tono = Tono.MARCA) }
            Etiqueta(DnrConductor.textoEstado(x.estado), tono = tono, icono = icono)
        }
    }
}

/** Una semana anterior: una línea con su recuento que se abre al tocarla. La que no tuvo ninguna lo dice en esa línea, en
 *  verde, y no se abre (no hay nada que ver). */
@Composable
private fun SemanaAnterior(s: SemanaDnr, i: Int, marcas: Map<String, MarcaDnr>) {
    val c = MaterialTheme.colorScheme
    val x = LocalExtra.current
    val n = s.dnr.size
    var abierta by rememberSaveable(s.semana) { mutableStateOf(false) }
    val nuevasAqui = s.dnr.count { marcas.containsKey(it.paquete) }
    val tocar = if (n > 0) Modifier.clickable(onClickLabel = if (abierta) tx("Cerrar") else tx("Abrir"), role = Role.Button) { abierta = !abierta } else Modifier
    Column {
        Row(
            Modifier.fillMaxWidth().then(tocar).semantics(mergeDescendants = true) {}.heightIn(min = Alto.boton)
                .padding(horizontal = Esp.m, vertical = Esp.s),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(if (i == 1) tx("La semana pasada") else DnrConductor.rango(s), style = MaterialTheme.typography.bodyMedium.merge(TextoNumero))
                if (i == 1) Text(DnrConductor.rango(s), style = MaterialTheme.typography.bodySmall.merge(TextoNumero), color = c.onSurfaceVariant)
            }
            Spacer(Modifier.width(Esp.s))
            if (n == 0) {
                Icon(Icons.Default.Check, contentDescription = null, tint = x.entregadoTexto, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(Esp.xs))
                Text(DnrConductor.cuantas(0), style = MaterialTheme.typography.labelLarge, color = x.entregadoTexto)
            } else {
                DnrConductor.nuevas(nuevasAqui)?.let { Etiqueta(it, tono = Tono.MARCA); Spacer(Modifier.width(Esp.s)) }
                Text(DnrConductor.cuantas(n), style = MaterialTheme.typography.labelLarge.merge(TextoNumero))
                Spacer(Modifier.width(Esp.xs))
                Icon(if (abierta) Icons.Default.ExpandLess else Icons.Default.ExpandMore, contentDescription = null,
                    tint = c.onSurfaceVariant, modifier = Modifier.size(20.dp))
            }
        }
        // Abierta, sus DNR sobre el fondo de la pantalla, para que se vea que son de esa semana.
        if (abierta && n > 0) Column(Modifier.fillMaxWidth().background(c.background)) {
            s.dnr.forEachIndexed { k, d ->
                SeparadorLista(desde = if (k == 0) 0.dp else Esp.m)
                FilaDnr(d, marcas[d.paquete])
            }
        }
    }
}

/** Qué quiere decir cada estado: al final, con la etiqueta tal cual se ve en las filas y su frase al lado. */
@Composable
private fun QueEsCadaEstado() {
    Column(verticalArrangement = Arrangement.spacedBy(Esp.s)) {
        TituloBloque(tx("Qué es cada estado"))
        DnrConductor.ESTADOS.forEach { e ->
            val (tono, icono) = tonoEstado(e)
            Row(Modifier.padding(horizontal = Esp.xs).semantics(mergeDescendants = true) {}, verticalAlignment = Alignment.CenterVertically) {
                Etiqueta(DnrConductor.textoEstado(e), tono = tono, icono = icono)
                Spacer(Modifier.width(Esp.m))
                Text(DnrConductor.explicaEstado(e), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f))
            }
        }
    }
}
