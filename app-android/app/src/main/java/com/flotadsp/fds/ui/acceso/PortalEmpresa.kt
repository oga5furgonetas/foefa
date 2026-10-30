package com.flotadsp.fds.ui.acceso

import com.flotadsp.fds.ui.tx
import android.content.Intent
import android.net.Uri
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.flotadsp.fds.BuildConfig
import com.flotadsp.fds.data.Sesion
import org.json.JSONArray
import org.json.JSONObject

/** Portal de empresa dentro de FDS. El correo identifica la empresa al iniciar sesión. */
@Composable
fun PortalEmpresa(slugInicial: String?, alCerrar: () -> Unit) {
    BackHandler(onBack = alCerrar)
    PortalWeb(titulo = tx("Portal de conductor"), ruta = "/conductor/#${Uri.encode(slugInicial.orEmpty())}",
        sesion = null, alCerrar = alCerrar)
}

@Composable
fun PortalAcceso(sesion: Sesion, alCerrar: () -> Unit) {
    val conductor = sesion.app_destino == "conductor"
    BackHandler(onBack = alCerrar)
    PortalWeb(
        titulo = if (conductor) tx("Portal de conductor") else tx("Portal de empresa"),
        ruta = if (conductor) "/conductor/" else "/panel/login",
        sesion = sesion,
        alCerrar = alCerrar,
    )
}

@Composable
private fun PortalWeb(titulo: String, ruta: String, sesion: Sesion?, alCerrar: () -> Unit) {
    val ctx = LocalContext.current
    var fileCallback by remember { mutableStateOf<android.webkit.ValueCallback<Array<Uri>>?>(null) }
    val elegirArchivo = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        fileCallback?.onReceiveValue(uri?.let { arrayOf(it) }); fileCallback = null
    }
    var web by remember { mutableStateOf<WebView?>(null) }
    BackHandler(onBack = { if (web?.canGoBack() == true) web?.goBack() else alCerrar() })
    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().height(48.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = alCerrar) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = tx("Volver")) }
            Text(titulo, style = MaterialTheme.typography.titleSmall)
        }
        AndroidView(factory = { context ->
            WebView(context).apply {
                web = this
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.cacheMode = WebSettings.LOAD_DEFAULT
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                settings.allowFileAccess = false
                settings.allowContentAccess = true
                var sesionInyectada = false
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                        val uri = request.url
                        if (uri.scheme == "https" && uri.host == Uri.parse(BuildConfig.WEB_URL).host) return false
                        if (uri.scheme == "https" || uri.scheme == "mailto" || uri.scheme == "tel") {
                            runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                            return true
                        }
                        return true
                    }

                    override fun onPageFinished(view: WebView, url: String) {
                        val acceso = sesion ?: return
                        if (sesionInyectada || Uri.parse(url).host != Uri.parse(BuildConfig.WEB_URL).host) return
                        sesionInyectada = true
                        val conductor = acceso.app_destino == "conductor"
                        val datos = JSONObject()
                        if (conductor) {
                            datos.put("id", acceso.id)
                            datos.put("name", acceso.name)
                            datos.put("email", acceso.email.orEmpty())
                            datos.put("center", acceso.center ?: JSONObject.NULL)
                            datos.put("configurar_cuenta", acceso.configurar_cuenta)
                        } else {
                            datos.put("name", acceso.name)
                            datos.put("role", acceso.role)
                            datos.put("id", acceso.id)
                            datos.put("account_type", acceso.account_type ?: JSONObject.NULL)
                            datos.put("slug", acceso.slug ?: JSONObject.NULL)
                            datos.put("super_admin", acceso.super_admin)
                            datos.put("permissions", acceso.permissions?.let { JSONArray(it) } ?: JSONObject.NULL)
                            datos.put("allowed_centers", acceso.allowed_centers?.let { JSONArray(it) } ?: JSONObject.NULL)
                            datos.put("centers", acceso.centers?.let { JSONArray(it) } ?: JSONArray())
                            datos.put("admin_role", acceso.admin_role ?: JSONObject.NULL)
                        }
                        val payload = JSONObject()
                            .put("access_token", acceso.token)
                            .put("data", datos)
                        val jsPayload = JSONObject.quote(payload.toString())
                        val js = if (conductor) {
                            """(function(){const p=JSON.parse($jsPayload);localStorage.removeItem('flota_token');localStorage.removeItem('flota_admin');localStorage.removeItem('flota_acceso');localStorage.removeItem('flota_sesion_previa');localStorage.setItem('flota_driver_token',p.access_token);localStorage.setItem('flota_driver',JSON.stringify(p.data));window.location.replace('/conductor/')})()"""
                        } else {
                            """(function(){const p=JSON.parse($jsPayload);localStorage.removeItem('flota_driver_token');localStorage.removeItem('flota_driver');localStorage.removeItem('flota_acceso');localStorage.removeItem('flota_sesion_previa');localStorage.setItem('flota_token',p.access_token);localStorage.setItem('flota_admin',JSON.stringify(p.data));window.location.replace('/panel')})()"""
                        }
                        view.evaluateJavascript(js, null)
                    }
                }
                webChromeClient = object : WebChromeClient() {
                    override fun onShowFileChooser(view: WebView, callback: android.webkit.ValueCallback<Array<Uri>>,
                        params: FileChooserParams): Boolean {
                        fileCallback?.onReceiveValue(null)
                        fileCallback = callback
                        elegirArchivo.launch("image/*")
                        return true
                    }
                }
                loadUrl(BuildConfig.WEB_URL + ruta)
            }
        }, modifier = Modifier.fillMaxSize(), update = {}, onRelease = { view ->
            fileCallback?.onReceiveValue(null)
            fileCallback = null
            view.stopLoading()
            view.webChromeClient = null
            view.webViewClient = WebViewClient()
            view.destroy()
            web = null
        })
    }
}
