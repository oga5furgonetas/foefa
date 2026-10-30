package com.flotadsp.fds.ui.acceso

import com.flotadsp.fds.ui.tx
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.flotadsp.fds.BuildConfig
import com.flotadsp.fds.FdsApp
import com.flotadsp.fds.R
import com.flotadsp.fds.data.ErrorApi
import com.flotadsp.fds.data.Sesion
import com.flotadsp.fds.ui.Acciones
import kotlinx.coroutines.launch
import androidx.compose.runtime.produceState
import com.flotadsp.fds.data.Oferta
import com.flotadsp.fds.ui.LOCALE_APP
import com.flotadsp.fds.ui.patronFecha
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/* ENTRAR O CREAR LA CUENTA: lo primero que ve quien instala FDS. Nada de portada web: el logo, qué hace la app
   en una frase, y entrar. */
@Composable
fun Acceso(ref: String?, alAbrirPortal: (Sesion) -> Unit, aviso: String? = null) {
    val app = LocalContext.current.applicationContext as FdsApp
    var paso by rememberSaveable { mutableStateOf("inicio") }
    // La oferta, la misma que dicen la web y los anuncios (Spotify: «sin tarjeta y sin límite hasta fin de año»).
    val oferta by produceState<Oferta?>(null) { value = runCatching { app.repo.oferta() }.getOrNull() }
    when (paso) {
        "entrar" -> Entrar(aviso, alVolver = { paso = "inicio" }, alAbrirPortal = alAbrirPortal)
        "alta" -> Alta(ref, oferta, alVolver = { paso = "inicio" })
        else -> Inicio(oferta, aviso, alEntrar = { paso = "entrar" }, alCrear = { paso = "alta" })
    }
}

/** El día hasta el que es gratis y sin límite («31 de diciembre»), si la promoción sigue. */
private fun promoHasta(o: Oferta?): String? = o?.gratisHasta?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    ?.takeIf { !LocalDate.now().isAfter(it) }?.format(DateTimeFormatter.ofPattern(patronFecha("d 'de' MMMM"), LOCALE_APP))

/** Lo que cuesta, con las mismas palabras que la web de registro. Sin red, lo que vale siempre. */
private fun textoOferta(o: Oferta?): String {
    val p = o?.paradasGratis ?: 15
    return promoHasta(o)?.let { tx("Sin tarjeta. Gratis y sin límite hasta el {fecha}; después, gratis hasta {p} paradas al día.", "fecha" to it, "p" to p) }
        ?: tx("Sin tarjeta. Gratis hasta {p} paradas al día; sin tope, el plan Repartidor.", "p" to p)
}

@Composable
private fun Logo(tam: Int = 72) {
    Image(painterResource(R.drawable.logo), contentDescription = "FDS", modifier = Modifier.size(tam.dp).clip(RoundedCornerShape((tam / 4.5).dp)))
}

/** Un aviso arriba (la sesión ha caducado, por ejemplo), para que se entienda por qué se está otra vez aquí. */
@Composable
private fun Aviso(texto: String?) {
    if (texto == null) return
    Surface(color = MaterialTheme.colorScheme.secondaryContainer, contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
        Text(texto, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp))
    }
    Spacer(Modifier.height(16.dp))
}

@Composable
private fun Inicio(oferta: Oferta?, aviso: String?, alEntrar: () -> Unit, alCrear: () -> Unit) {
    Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(24.dp)) {
        Spacer(Modifier.weight(1f))
        Aviso(aviso)
        Logo()
        Spacer(Modifier.height(24.dp))
        Text(tx("Tu ruta de reparto, ordenada sola."), style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(12.dp))
        listOf(
            tx("Escanea los paquetes: la dirección entra sola."),
            tx("La ruta se ordena por tiempo, con el tráfico."),
            tx("Navega con Google Maps o Waze y marca cada entrega."),
            tx("Funciona sin cobertura: lo hecho se envía al volver la red."),
        ).forEach {
            Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.Top) {
                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(10.dp))
                Text(it, style = MaterialTheme.typography.bodyLarge)
            }
        }
        promoHasta(oferta)?.let { hasta ->
            Spacer(Modifier.height(14.dp))
            Surface(color = MaterialTheme.colorScheme.primaryContainer, contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                shape = MaterialTheme.shapes.small) {
                Text(tx("Gratis y sin límite hasta el {fecha} · sin tarjeta", "fecha" to hasta), style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
            }
        }
        Spacer(Modifier.weight(1.2f))
        Button(onClick = alCrear, modifier = Modifier.fillMaxWidth().height(56.dp)) { Text(tx("Crear mi cuenta gratis")) }
        Spacer(Modifier.height(10.dp))
        OutlinedButton(onClick = alEntrar, modifier = Modifier.fillMaxWidth().height(56.dp)) { Text(tx("Ya tengo cuenta")) }
        Spacer(Modifier.height(8.dp))
        Text(tx("Entra con el correo y la contraseña de tu cuenta. FDS abrirá el portal de empresa, conductor o reparto que te corresponde."),
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun Cabecera(titulo: String, alVolver: () -> Unit) {
    BackHandler(onBack = alVolver)
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = alVolver) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = tx("Volver")) }
    }
    Spacer(Modifier.height(8.dp))
    Logo(56)
    Spacer(Modifier.height(16.dp))
    Text(titulo, style = MaterialTheme.typography.headlineMedium)
    Spacer(Modifier.height(20.dp))
}

/** Campo de contraseña con el ojo para verla. Lo usan la entrada y la pantalla de elegir contraseña del conductor. */
@Composable
internal fun CampoClave(valor: String, alCambiar: (String) -> Unit, etiqueta: String, alListo: () -> Unit) {
    var ver by remember { mutableStateOf(false) }
    OutlinedTextField(
        valor, alCambiar, label = { Text(etiqueta) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
        visualTransformation = if (ver) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { alListo() }),
        trailingIcon = {
            IconButton(onClick = { ver = !ver }) {
                Icon(if (ver) Icons.Default.VisibilityOff else Icons.Default.Visibility, contentDescription = if (ver) tx("Ocultar la contraseña") else tx("Ver la contraseña"))
            }
        },
    )
}

@Composable
private fun Entrar(aviso: String?, alVolver: () -> Unit, alAbrirPortal: (Sesion) -> Unit) {
    val ctx = LocalContext.current
    val repo = (ctx.applicationContext as FdsApp).repo
    val ambito = rememberCoroutineScope()
    var correo by rememberSaveable { mutableStateOf("") }
    var clave by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var trabajando by remember { mutableStateOf(false) }
    var codigoVisible by rememberSaveable { mutableStateOf(false) }
    var recuperarVisible by rememberSaveable { mutableStateOf(false) }
    if (codigoVisible) {
        CodigoConductorNativo(alVolver = { codigoVisible = false }, alAbrirPortal = alAbrirPortal)
        return
    }
    if (recuperarVisible) {
        RecuperarClave(correo, alVolver = { recuperarVisible = false }, alCodigo = { recuperarVisible = false; codigoVisible = true })
        return
    }
    val entrar = {
        if (!trabajando && correo.isNotBlank() && clave.isNotBlank()) {
            trabajando = true; error = null
            ambito.launch {
                try {
                    val sesion = repo.entrar(correo, clave)
                    if (sesion.app_destino == "conductor" || sesion.app_destino == "empresa") {
                        alAbrirPortal(sesion)
                    }
                } catch (e: ErrorApi) {
                    error = if (e.sinRed) tx("Sin conexión. Revisa la red y vuelve a intentarlo.") else e.message
                } finally { trabajando = false }
            }
        }
    }
    Column(Modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 8.dp)) {
        Cabecera(tx("Entrar"), alVolver)
        Aviso(aviso)
        OutlinedTextField(correo, { correo = it }, label = { Text(tx("Correo o usuario")) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next))
        Spacer(Modifier.height(12.dp))
        CampoClave(clave, { clave = it }, tx("Contraseña"), alListo = entrar)
        error?.let { Spacer(Modifier.height(10.dp)); Text(it, color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(20.dp))
        Button(onClick = entrar, enabled = !trabajando && correo.isNotBlank() && clave.isNotBlank(), modifier = Modifier.fillMaxWidth().height(56.dp)) {
            if (trabajando) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary) else Text(tx("Entrar"))
        }
        TextButton(onClick = { codigoVisible = true }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text(tx("Entrar con un código en mi correo personal"))
        }
        TextButton(onClick = { recuperarVisible = true }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text(tx("He olvidado mi contraseña"))
        }
    }
}

/** «He olvidado mi contraseña» (29-10-2026). Quien reparte por su cuenta recibe un enlace en su correo; a un
 *  conductor de empresa su contraseña se la pone la oficina, y entra con el código de su correo personal. */
@Composable
private fun RecuperarClave(correoInicial: String, alVolver: () -> Unit, alCodigo: () -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val ambito = rememberCoroutineScope()
    var correo by rememberSaveable { mutableStateOf(correoInicial) }
    var enviado by rememberSaveable { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var trabajando by remember { mutableStateOf(false) }
    val valido = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(correo.trim())
    Column(Modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 8.dp)) {
        Cabecera(tx("Recuperar la contraseña"), alVolver)
        if (enviado) {
            Text(tx("Si {correo} tiene una cuenta de repartidor, te hemos mandado un enlace para crear una contraseña nueva. Mira también el spam.", "correo" to correo.trim()),
                style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(20.dp))
            Button(onClick = alVolver, modifier = Modifier.fillMaxWidth().height(56.dp)) { Text(tx("Volver a entrar")) }
        } else {
            Text(tx("Escribe el correo de tu cuenta y te mandamos un enlace para crear una contraseña nueva."), style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(14.dp))
            OutlinedTextField(correo, { correo = it; error = null }, label = { Text(tx("Tu correo")) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Done))
            error?.let { Spacer(Modifier.height(10.dp)); Text(it, color = MaterialTheme.colorScheme.error) }
            Spacer(Modifier.height(20.dp))
            Button(onClick = {
                trabajando = true; error = null
                ambito.launch {
                    try { app.repo.recuperarClave(correo); enviado = true } catch (e: ErrorApi) {
                        error = if (e.sinRed) tx("Sin conexión. Revisa la red y vuelve a intentarlo.") else e.message
                    } finally { trabajando = false }
                }
            }, enabled = !trabajando && valido, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                if (trabajando) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary) else Text(tx("Mandarme el enlace"))
            }
        }
        Spacer(Modifier.height(16.dp))
        Text(tx("¿Eres conductor de una empresa? Tu contraseña te la da la oficina. Si vinculaste tu correo personal, puedes entrar con un código."),
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        TextButton(onClick = alCodigo, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text(tx("Entrar con un código en mi correo personal")) }
    }
}

@Composable
private fun CodigoConductorNativo(alVolver: () -> Unit, alAbrirPortal: (Sesion) -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    val scope = rememberCoroutineScope()
    var correo by rememberSaveable { mutableStateOf("") }
    var codigo by rememberSaveable { mutableStateOf("") }
    var solicitado by rememberSaveable { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var mensaje by remember { mutableStateOf<String?>(null) }
    var ocupado by remember { mutableStateOf(false) }
    fun emailValido(valor: String) = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(valor.trim())
    Column(Modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 8.dp)) {
        Cabecera(tx("Entrar con código"), alVolver)
        Text(tx("Usa el correo personal que vinculaste en tu cuenta. El código se enviará a ese correo, no al buzón de empresa."), style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(correo, { correo = it; error = null }, label = { Text(tx("Tu correo personal")) }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next), modifier = Modifier.fillMaxWidth())
        if (solicitado) {
            Spacer(Modifier.height(12.dp))
            Text(tx("Si ese correo está vinculado a una cuenta, recibirás un código de 6 cifras. Puede tardar unos minutos."), style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(codigo, { codigo = it.filter(Char::isDigit).take(6); error = null }, label = { Text(tx("Código de 6 cifras")) }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done), modifier = Modifier.fillMaxWidth())
        }
        mensaje?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(16.dp))
        Button(onClick = {
            ocupado = true; error = null; mensaje = null
            scope.launch {
                try {
                    if (!solicitado) {
                        app.repo.solicitarCodigoConductor(correo)
                        solicitado = true
                        mensaje = tx("Solicitud enviada. Mira la bandeja y el spam del correo personal.")
                    } else {
                        val sesion = app.repo.entrarConCodigoConductor(correo, codigo)
                        alAbrirPortal(sesion)
                    }
                } catch (e: ErrorApi) { error = e.message }
                finally { ocupado = false }
            }
        }, enabled = !ocupado && emailValido(correo) && (!solicitado || codigo.length == 6), modifier = Modifier.fillMaxWidth().height(54.dp)) {
            if (ocupado) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            else Text(if (!solicitado) tx("Enviar código") else tx("Entrar"))
        }
        if (solicitado) TextButton(onClick = {
            ocupado = true; error = null
            scope.launch {
                try { app.repo.solicitarCodigoConductor(correo); codigo = ""; mensaje = tx("Hemos solicitado otro código.") }
                catch (e: ErrorApi) { error = e.message }
                finally { ocupado = false }
            }
        }, enabled = !ocupado, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text(tx("Reenviar código")) }
    }
}

@Composable
private fun Alta(ref: String?, oferta: Oferta?, alVolver: () -> Unit) {
    val ctx = LocalContext.current
    val repo = (ctx.applicationContext as FdsApp).repo
    val ambito = rememberCoroutineScope()
    var nombre by rememberSaveable { mutableStateOf("") }
    var correo by rememberSaveable { mutableStateOf("") }
    var clave by remember { mutableStateOf("") }
    var acepto by rememberSaveable { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var trabajando by remember { mutableStateOf(false) }
    val crear = {
        error = when {
            nombre.isBlank() -> tx("Dinos tu nombre.")
            !Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(correo.trim()) -> tx("Escribe un correo válido.")
            clave.length < 8 -> tx("La contraseña debe tener al menos 8 caracteres.")
            !acepto -> tx("Para continuar, acepta los Términos y la Política de Privacidad.")
            else -> null
        }
        if (error == null && !trabajando) {
            trabajando = true
            ambito.launch {
                try { repo.crearCuenta(nombre, correo, clave, ref) } catch (e: ErrorApi) {
                    error = if (e.sinRed) tx("Sin conexión. Revisa la red y vuelve a intentarlo.") else e.message
                } finally { trabajando = false }
            }
        }
    }
    Column(Modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 8.dp)) {
        Cabecera(tx("Crea tu cuenta gratis"), alVolver)
        OutlinedTextField(nombre, { nombre = it }, label = { Text(tx("Tu nombre")) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(correo, { correo = it }, label = { Text(tx("Tu correo")) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next))
        Spacer(Modifier.height(12.dp))
        CampoClave(clave, { clave = it }, tx("Contraseña (8 caracteres o más)"), alListo = crear)
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth().toggleable(acepto, role = Role.Checkbox) { acepto = it }.padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = acepto, onCheckedChange = null, modifier = Modifier.padding(end = 8.dp))
            Text(tx("Acepto los Términos y la Política de Privacidad"), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        }
        Row(Modifier.padding(start = 40.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            TextButton(onClick = { Acciones.abrirWeb(ctx, "${BuildConfig.WEB_URL}/terminos") }) { Text(tx("Términos")) }
            TextButton(onClick = { Acciones.abrirWeb(ctx, "${BuildConfig.WEB_URL}/privacidad") }) { Text(tx("Privacidad")) }
        }
        error?.let { Spacer(Modifier.height(6.dp)); Text(it, color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(16.dp))
        Button(onClick = crear, enabled = !trabajando, modifier = Modifier.fillMaxWidth().height(56.dp)) {
            if (trabajando) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary) else Text(tx("Crear mi cuenta"))
        }
        Spacer(Modifier.height(10.dp))
        Surface(color = MaterialTheme.colorScheme.surfaceContainer, shape = MaterialTheme.shapes.small) {
            Text(textoOferta(oferta), style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(12.dp))
        }
        Spacer(Modifier.height(24.dp))
    }
}
