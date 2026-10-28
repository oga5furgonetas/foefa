package com.flotadsp.fds.ui.acceso

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
import com.flotadsp.fds.ui.ESPANOL
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/* ENTRAR O CREAR LA CUENTA: lo primero que ve quien instala FDS. Nada de portada web: el logo, qué hace la app
   en una frase, y entrar. */
@Composable
fun Acceso(ref: String?, alAbrirPortal: (Sesion) -> Unit) {
    val app = LocalContext.current.applicationContext as FdsApp
    var paso by rememberSaveable { mutableStateOf("inicio") }
    // La oferta, la misma que dicen la web y los anuncios (Spotify: «sin tarjeta y sin límite hasta fin de año»).
    val oferta by produceState<Oferta?>(null) { value = runCatching { app.repo.oferta() }.getOrNull() }
    when (paso) {
        "entrar" -> Entrar(alVolver = { paso = "inicio" }, alAbrirPortal = alAbrirPortal)
        "alta" -> Alta(ref, oferta, alVolver = { paso = "inicio" })
        else -> Inicio(oferta, alEntrar = { paso = "entrar" }, alCrear = { paso = "alta" })
    }
}

/** El día hasta el que es gratis y sin límite («31 de diciembre»), si la promoción sigue. */
private fun promoHasta(o: Oferta?): String? = o?.gratisHasta?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
    ?.takeIf { !LocalDate.now().isAfter(it) }?.format(DateTimeFormatter.ofPattern("d 'de' MMMM", ESPANOL))

/** Lo que cuesta, con las mismas palabras que la web de registro. Sin red, lo que vale siempre. */
private fun textoOferta(o: Oferta?): String {
    val p = o?.paradasGratis ?: 15
    return promoHasta(o)?.let { "Sin tarjeta. Gratis y sin límite hasta el $it; después, gratis hasta $p paradas al día." }
        ?: "Sin tarjeta. Gratis hasta $p paradas al día; sin tope, el plan Repartidor."
}

@Composable
private fun Logo(tam: Int = 72) {
    Image(painterResource(R.drawable.logo), contentDescription = "FDS", modifier = Modifier.size(tam.dp).clip(RoundedCornerShape((tam / 4.5).dp)))
}

@Composable
private fun Inicio(oferta: Oferta?, alEntrar: () -> Unit, alCrear: () -> Unit) {
    Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(24.dp)) {
        Spacer(Modifier.weight(1f))
        Logo()
        Spacer(Modifier.height(24.dp))
        Text("Tu ruta de reparto, ordenada sola.", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(12.dp))
        listOf(
            "Escanea los paquetes: la dirección entra sola.",
            "La ruta se ordena por tiempo, con el tráfico.",
            "Navega con Google Maps o Waze y marca cada entrega.",
            "Funciona sin cobertura: lo hecho se envía al volver la red.",
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
                Text("Gratis y sin límite hasta el $hasta · sin tarjeta", style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
            }
        }
        Spacer(Modifier.weight(1.2f))
        Button(onClick = alCrear, modifier = Modifier.fillMaxWidth().height(56.dp)) { Text("Crear mi cuenta gratis") }
        Spacer(Modifier.height(10.dp))
        OutlinedButton(onClick = alEntrar, modifier = Modifier.fillMaxWidth().height(56.dp)) { Text("Ya tengo cuenta") }
        Spacer(Modifier.height(8.dp))
        Text("Entra con el correo y la contraseña de tu cuenta. FDS abrirá el portal de empresa, conductor o reparto que te corresponde.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun Cabecera(titulo: String, alVolver: () -> Unit) {
    BackHandler(onBack = alVolver)
    Row(verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = alVolver) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver") }
    }
    Spacer(Modifier.height(8.dp))
    Logo(56)
    Spacer(Modifier.height(16.dp))
    Text(titulo, style = MaterialTheme.typography.headlineMedium)
    Spacer(Modifier.height(20.dp))
}

@Composable
private fun CampoClave(valor: String, alCambiar: (String) -> Unit, etiqueta: String, alListo: () -> Unit) {
    var ver by remember { mutableStateOf(false) }
    OutlinedTextField(
        valor, alCambiar, label = { Text(etiqueta) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
        visualTransformation = if (ver) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { alListo() }),
        trailingIcon = {
            IconButton(onClick = { ver = !ver }) {
                Icon(if (ver) Icons.Default.VisibilityOff else Icons.Default.Visibility, contentDescription = if (ver) "Ocultar la contraseña" else "Ver la contraseña")
            }
        },
    )
}

@Composable
private fun Entrar(alVolver: () -> Unit, alAbrirPortal: (Sesion) -> Unit) {
    val ctx = LocalContext.current
    val repo = (ctx.applicationContext as FdsApp).repo
    val ambito = rememberCoroutineScope()
    var correo by rememberSaveable { mutableStateOf("") }
    var clave by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var trabajando by remember { mutableStateOf(false) }
    var codigoVisible by rememberSaveable { mutableStateOf(false) }
    if (codigoVisible) {
        CodigoConductorNativo(alVolver = { codigoVisible = false }, alAbrirPortal = alAbrirPortal)
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
                    error = if (e.sinRed) "Sin conexión. Revisa la red y vuelve a intentarlo." else e.message
                } finally { trabajando = false }
            }
        }
    }
    Column(Modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 8.dp)) {
        Cabecera("Entrar", alVolver)
        OutlinedTextField(correo, { correo = it }, label = { Text("Correo o usuario") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next))
        Spacer(Modifier.height(12.dp))
        CampoClave(clave, { clave = it }, "Contraseña", alListo = entrar)
        error?.let { Spacer(Modifier.height(10.dp)); Text(it, color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(20.dp))
        Button(onClick = entrar, enabled = !trabajando && correo.isNotBlank() && clave.isNotBlank(), modifier = Modifier.fillMaxWidth().height(56.dp)) {
            if (trabajando) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary) else Text("Entrar")
        }
        TextButton(onClick = { codigoVisible = true }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text("Entrar con un código en mi correo personal")
        }
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
        Cabecera("Entrar con código", alVolver)
        Text("Usa el correo personal que vinculaste en tu cuenta. El código se enviará a ese correo, no al buzón de empresa.", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(correo, { correo = it; error = null }, label = { Text("Tu correo personal") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next), modifier = Modifier.fillMaxWidth())
        if (solicitado) {
            Spacer(Modifier.height(12.dp))
            Text("Si ese correo está vinculado a una cuenta, recibirás un código de 6 cifras. Puede tardar unos minutos.", style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(codigo, { codigo = it.filter(Char::isDigit).take(6); error = null }, label = { Text("Código de 6 cifras") }, singleLine = true,
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
                        mensaje = "Solicitud enviada. Mira la bandeja y el spam del correo personal."
                    } else {
                        val sesion = app.repo.entrarConCodigoConductor(correo, codigo)
                        alAbrirPortal(sesion)
                    }
                } catch (e: ErrorApi) { error = e.message }
                finally { ocupado = false }
            }
        }, enabled = !ocupado && emailValido(correo) && (!solicitado || codigo.length == 6), modifier = Modifier.fillMaxWidth().height(54.dp)) {
            if (ocupado) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            else Text(if (!solicitado) "Enviar código" else "Entrar")
        }
        if (solicitado) TextButton(onClick = {
            ocupado = true; error = null
            scope.launch {
                try { app.repo.solicitarCodigoConductor(correo); codigo = ""; mensaje = "Hemos solicitado otro código." }
                catch (e: ErrorApi) { error = e.message }
                finally { ocupado = false }
            }
        }, enabled = !ocupado, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Reenviar código") }
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
            nombre.isBlank() -> "Dinos tu nombre."
            !Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(correo.trim()) -> "Escribe un correo válido."
            clave.length < 8 -> "La contraseña debe tener al menos 8 caracteres."
            !acepto -> "Para continuar, acepta los Términos y la Política de Privacidad."
            else -> null
        }
        if (error == null && !trabajando) {
            trabajando = true
            ambito.launch {
                try { repo.crearCuenta(nombre, correo, clave, ref) } catch (e: ErrorApi) {
                    error = if (e.sinRed) "Sin conexión. Revisa la red y vuelve a intentarlo." else e.message
                } finally { trabajando = false }
            }
        }
    }
    Column(Modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 8.dp)) {
        Cabecera("Crea tu cuenta gratis", alVolver)
        OutlinedTextField(nombre, { nombre = it }, label = { Text("Tu nombre") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(correo, { correo = it }, label = { Text("Tu correo") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next))
        Spacer(Modifier.height(12.dp))
        CampoClave(clave, { clave = it }, "Contraseña (8 caracteres o más)", alListo = crear)
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth().toggleable(acepto, role = Role.Checkbox) { acepto = it }.padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = acepto, onCheckedChange = null, modifier = Modifier.padding(end = 8.dp))
            Text("Acepto los Términos y la Política de Privacidad", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        }
        Row(Modifier.padding(start = 40.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            TextButton(onClick = { Acciones.abrirWeb(ctx, "${BuildConfig.WEB_URL}/terminos") }) { Text("Términos") }
            TextButton(onClick = { Acciones.abrirWeb(ctx, "${BuildConfig.WEB_URL}/privacidad") }) { Text("Privacidad") }
        }
        error?.let { Spacer(Modifier.height(6.dp)); Text(it, color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(16.dp))
        Button(onClick = crear, enabled = !trabajando, modifier = Modifier.fillMaxWidth().height(56.dp)) {
            if (trabajando) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary) else Text("Crear mi cuenta")
        }
        Spacer(Modifier.height(10.dp))
        Surface(color = MaterialTheme.colorScheme.surfaceContainer, shape = MaterialTheme.shapes.small) {
            Text(textoOferta(oferta), style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(12.dp))
        }
        Spacer(Modifier.height(24.dp))
    }
}
