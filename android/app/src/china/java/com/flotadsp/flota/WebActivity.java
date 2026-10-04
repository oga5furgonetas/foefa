package com.flotadsp.flota;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * LA APP PARA CHINA (04-10-2026). Allí no hay Google Play y casi ningún móvil
 * trae Chrome, así que la app de Play (una TWA, que necesita Chrome) no sirve:
 * esta abre la web en un WebView propio. Lo que la web necesita y el WebView
 * de serie no da, se da aquí:
 *  - ubicación (jornada y navegación) con el permiso del sistema,
 *  - cámara para el escáner (getUserMedia) con el permiso del sistema,
 *  - el selector de fotos (foto de la etiqueta, prueba de entrega), con la
 *    opción de hacer la foto en el momento.
 * Lo que es de la web (flotadsp.com) y el pago (Stripe, Alipay, WeChat) se
 * abre dentro; lo demás (llamar, SMS, Amap, Baidu, correo…) en su app.
 * La web sabe que no es la app de Play: el referrer no es android-app://.
 */
public class WebActivity extends Activity {
    private static final String INICIO = "https://flotadsp.com/app";
    private static final int PEDIR_UBICACION = 1, PEDIR_CAMARA = 2, ELEGIR_FOTO = 3;
    private static final String[] DENTRO = {
        "flotadsp.com", "stripe.com", "stripe.network", "alipay.com", "alipayobjects.com",
        "alipay.hk", "wechat.com", "weixin.qq.com", "tenpay.com",
    };

    private WebView web;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigen;
    private PermissionRequest camaraPeticion;
    private ValueCallback<Uri[]> fotoCallback;
    private Uri fotoCamara;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0b0d10"));
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " FDSChina/1.0");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return fuera(r.getUrl());
            }
        });
        web.setWebChromeClient(new Cromo());
        Uri entrada = getIntent() != null ? getIntent().getData() : null;
        if (estado != null) web.restoreState(estado);
        else web.loadUrl(entrada != null && esDentro(entrada) ? entrada.toString() : INICIO);
    }

    /** true = lo abre otra app; false = se queda en el WebView. */
    private boolean fuera(Uri u) {
        String esquema = u.getScheme() == null ? "" : u.getScheme();
        if ((esquema.equals("https") || esquema.equals("http")) && esDentro(u)) return false;
        try {
            Intent i = esquema.equals("intent")
                ? Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME)
                : new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException | java.net.URISyntaxException e) {
            // Sin app que lo abra (p. ej. Alipay no instalada): nada que hacer.
        }
        return true;
    }

    private static boolean esDentro(Uri u) {
        String h = u.getHost() == null ? "" : u.getHost().toLowerCase();
        for (String d : DENTRO) if (h.equals(d) || h.endsWith("." + d)) return true;
        return false;
    }

    private boolean tiene(String permiso) {
        return Build.VERSION.SDK_INT < 23 || checkSelfPermission(permiso) == PackageManager.PERMISSION_GRANTED;
    }

    private class Cromo extends WebChromeClient {
        @Override
        public void onGeolocationPermissionsShowPrompt(String origen, GeolocationPermissions.Callback cb) {
            if (tiene(Manifest.permission.ACCESS_FINE_LOCATION)) { cb.invoke(origen, true, false); return; }
            geoCallback = cb;
            geoOrigen = origen;
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, PEDIR_UBICACION);
        }

        @Override
        public void onPermissionRequest(PermissionRequest p) {
            boolean pideCamara = false;
            for (String r : p.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) pideCamara = true;
            if (!pideCamara) { p.deny(); return; }
            if (tiene(Manifest.permission.CAMERA)) { p.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}); return; }
            camaraPeticion = p;
            requestPermissions(new String[]{Manifest.permission.CAMERA}, PEDIR_CAMARA);
        }

        @Override
        public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
            if (fotoCallback != null) fotoCallback.onReceiveValue(null);
            fotoCallback = cb;
            List<Intent> extra = new ArrayList<>();
            if (tiene(Manifest.permission.CAMERA)) {
                try {
                    File dir = new File(getCacheDir(), "fotos");
                    //noinspection ResultOfMethodCallIgnored
                    dir.mkdirs();
                    File f = File.createTempFile("foto", ".jpg", dir);
                    fotoCamara = FileProvider.getUriForFile(WebActivity.this, getPackageName() + ".fileprovider", f);
                    Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    cam.putExtra(MediaStore.EXTRA_OUTPUT, fotoCamara);
                    cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    extra.add(cam);
                } catch (Exception e) {
                    fotoCamara = null;
                }
            }
            Intent abrir;
            if (params.isCaptureEnabled() && !extra.isEmpty()) {
                abrir = extra.get(0);                       // <input capture>: directo a la cámara
            } else {
                abrir = Intent.createChooser(params.createIntent(), null);
                if (!extra.isEmpty()) abrir.putExtra(Intent.EXTRA_INITIAL_INTENTS, extra.toArray(new Intent[0]));
            }
            try {
                startActivityForResult(abrir, ELEGIR_FOTO);
            } catch (ActivityNotFoundException e) {
                fotoCallback = null;
                return false;
            }
            return true;
        }
    }

    @Override
    public void onRequestPermissionsResult(int codigo, String[] permisos, int[] res) {
        boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
        if (codigo == PEDIR_UBICACION && geoCallback != null) {
            geoCallback.invoke(geoOrigen, ok, false);
            geoCallback = null;
        } else if (codigo == PEDIR_CAMARA && camaraPeticion != null) {
            if (ok) camaraPeticion.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else camaraPeticion.deny();
            camaraPeticion = null;
        }
    }

    @Override
    protected void onActivityResult(int codigo, int resultado, Intent datos) {
        if (codigo != ELEGIR_FOTO || fotoCallback == null) { super.onActivityResult(codigo, resultado, datos); return; }
        Uri[] elegidas = null;
        if (resultado == RESULT_OK) {
            if (datos != null && datos.getClipData() != null) {
                elegidas = new Uri[datos.getClipData().getItemCount()];
                for (int i = 0; i < elegidas.length; i++) elegidas[i] = datos.getClipData().getItemAt(i).getUri();
            } else if (datos != null && datos.getData() != null) {
                elegidas = new Uri[]{datos.getData()};
            } else if (fotoCamara != null) {
                elegidas = new Uri[]{fotoCamara};   // la cámara no devuelve datos: la foto está donde se le dijo
            }
        }
        fotoCallback.onReceiveValue(elegidas);
        fotoCallback = null;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (i != null && i.getData() != null && esDentro(i.getData())) web.loadUrl(i.getData().toString());
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
