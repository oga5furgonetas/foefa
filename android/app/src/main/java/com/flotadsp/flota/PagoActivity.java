package com.flotadsp.flota;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import androidx.browser.trusted.Token;
import androidx.browser.trusted.TokenStore;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.google.androidbrowserhelper.playbilling.provider.MethodData;
import com.google.androidbrowserhelper.playbilling.provider.PaymentResult;
import com.google.androidbrowserhelper.trusted.SharedPreferencesTokenStore;

import org.json.JSONObject;

import java.util.Collections;
import java.util.List;

/**
 * EL PAGO CON GOOGLE PLAY (04-10-2026).
 *
 * La web pide pagar con PaymentRequest («https://play.google.com/billing») y
 * Chrome abre esta pantalla. Es la de androidbrowserhelper con DOS cambios:
 *
 *  1. Elige la oferta de PRUEBA GRATIS si el cliente tiene derecho a ella. La
 *     de la librería coge la primera de la lista, y Google no garantiza el
 *     orden: podía cobrar el primer día a quien venía a probar 7 días gratis.
 *  2. Liga la compra a la cuenta (obfuscatedAccountId, que manda la web): el
 *     servidor rechaza un token de compra que no sea de esa cuenta.
 *
 * Solo atiende a la web verificada de esta app (el mismo control que la
 * librería): otra app no puede lanzar cobros a través de nosotros.
 */
public class PagoActivity extends Activity {
    private static final String TAG = "PagoFDS";
    private static final String METODO = "https://play.google.com/billing";

    private BillingClient cliente;
    private MethodData datos;
    private String cuenta;
    private boolean terminado = false;

    @Override
    public void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        ComponentName quien = getCallingActivity();
        if (quien == null) { fallo("Hay que abrirla con startActivityForResult."); return; }
        if (!navegadorVerificado(quien.getPackageName())) { fallo("La app que pide el pago no está verificada."); return; }
        datos = MethodData.fromIntent(getIntent());
        if (datos == null || datos.sku == null) { fallo("No llega el producto."); return; }
        if (datos.isPriceChangeConfirmation) { fallo("Confirmar cambios de precio no está soportado."); return; }
        cuenta = cuentaDeLaWeb(getIntent());

        cliente = BillingClient.newBuilder(this)
                .setListener(this::alTerminarCompra)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
        cliente.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) buscarProducto();
                else fallo("Google Play no responde: " + r.getResponseCode());
            }
            @Override public void onBillingServiceDisconnected() { fallo("Se ha cortado la conexión con Google Play."); }
        });
    }

    /** Lo mismo que PaymentVerifier: el que llama es el navegador que verificó la web al abrir la app. */
    private boolean navegadorVerificado(String paquete) {
        TokenStore almacen = new SharedPreferencesTokenStore(this);
        Token token = almacen.load();
        if (token == null) { Log.w(TAG, "Sin navegador verificado."); return false; }
        return token.matches(paquete, getPackageManager());
    }

    /** El campo «cuenta» que la web añade a los datos del pago (lo demás lo lee MethodData). */
    private static String cuentaDeLaWeb(Intent intent) {
        try {
            Bundle b = intent.getBundleExtra("methodData");
            String json = b == null ? null : b.getString(METODO);
            if (json == null) return null;
            String c = new JSONObject(json).optString("cuenta", "");
            return c.isEmpty() || c.length() > 64 ? null : c;
        } catch (Exception e) {
            return null;
        }
    }

    private void buscarProducto() {
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(datos.sku).setProductType(BillingClient.ProductType.SUBS).build()))
                .build();
        cliente.queryProductDetailsAsync(params, (r, resultado) -> runOnUiThread(() -> {
            List<ProductDetails> lista = resultado.getProductDetailsList();
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK || lista == null || lista.isEmpty()) {
                fallo("Google Play no encuentra el producto " + datos.sku + ".");
                return;
            }
            lanzar(lista.get(0));
        }));
    }

    /** La oferta: la que tenga una fase gratis (la prueba), si no la del plan base, si no la primera. */
    static ProductDetails.SubscriptionOfferDetails elegirOferta(List<ProductDetails.SubscriptionOfferDetails> ofertas) {
        if (ofertas == null || ofertas.isEmpty()) return null;
        for (ProductDetails.SubscriptionOfferDetails o : ofertas) {
            for (ProductDetails.PricingPhase f : o.getPricingPhases().getPricingPhaseList()) {
                if (f.getPriceAmountMicros() == 0) return o;
            }
        }
        for (ProductDetails.SubscriptionOfferDetails o : ofertas) {
            if (o.getOfferId() == null) return o;
        }
        return ofertas.get(0);
    }

    private void lanzar(ProductDetails producto) {
        ProductDetails.SubscriptionOfferDetails oferta = elegirOferta(producto.getSubscriptionOfferDetails());
        if (oferta == null) { fallo("El producto no tiene ningún plan disponible."); return; }
        BillingFlowParams.Builder flujo = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(producto).setOfferToken(oferta.getOfferToken()).build()));
        if (cuenta != null) flujo.setObfuscatedAccountId(cuenta);
        BillingResult r = cliente.launchBillingFlow(this, flujo.build());
        if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            fallo("No se pudo abrir el pago (¿ya tienes esta suscripción?): " + r.getResponseCode());
        }
    }

    private void alTerminarCompra(BillingResult r, List<Purchase> compras) {
        runOnUiThread(() -> {
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && compras != null && !compras.isEmpty()) {
                terminar(PaymentResult.paymentSuccess(compras.get(0).getPurchaseToken()));
            } else {
                fallo("El pago ha terminado sin compra: " + r.getResponseCode());
            }
        });
    }

    private void fallo(String motivo) {
        Log.w(TAG, motivo);
        terminar(PaymentResult.failure(motivo));
    }

    private void terminar(PaymentResult resultado) {
        if (terminado) return;
        terminado = true;
        Intent vuelta = new Intent();
        vuelta.putExtra("methodName", METODO);
        vuelta.putExtra("details", resultado.getDetails());
        setResult(resultado.getActivityResult(), vuelta);
        finish();
    }

    @Override
    protected void onDestroy() {
        if (cliente != null) cliente.endConnection();
        super.onDestroy();
    }
}
