package com.flotadsp.fds.ui.acceso

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

/** Portal de empresa dentro de FDS. El correo identifica la empresa al iniciar sesión. */
@Composable
fun PortalEmpresa(slugInicial: String?, alCerrar: () -> Unit) {
    BackHandler(onBack = alCerrar)
    PortalWeb(slug = slugInicial.orEmpty(), alCerrar = alCerrar)
}

@Composable
private fun PortalWeb(slug: String, alCerrar: () -> Unit) {
    val ctx = LocalContext.current
    var fileCallback by remember { mutableStateOf<android.webkit.ValueCallback<Array<Uri>>?>(null) }
    val elegirArchivo = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        fileCallback?.onReceiveValue(uri?.let { arrayOf(it) }); fileCallback = null
    }
    var web by remember { mutableStateOf<WebView?>(null) }
    BackHandler(onBack = { if (web?.canGoBack() == true) web?.goBack() else alCerrar() })
    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().height(48.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = alCerrar) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver") }
            Text("Portal de empresa", style = MaterialTheme.typography.titleSmall)
        }
        AndroidView(Modifier.fillMaxSize(), factory = { context ->
            WebView(context).apply {
                web = this
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.cacheMode = WebSettings.LOAD_DEFAULT
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                settings.allowFileAccess = false
                settings.allowContentAccess = true
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
                loadUrl("${BuildConfig.WEB_URL}/conductor/#${Uri.encode(slug)}")
            }
        }, update = {}, onRelease = { view ->
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
