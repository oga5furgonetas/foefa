// La app de Android de Flota para Play Store (03-10-2026).
//
// Es una «Trusted Web Activity»: la propia web (flotadsp.com) abierta a
// pantalla completa por Chrome, sin barra de direcciones, con icono y nombre
// propios. No hay otra copia del código: lo que se despliega en la web es lo
// que ve la app al instante, sin pasar por la tienda. Para que Chrome quite
// la barra, la web publica /.well-known/assetlinks.json con la huella de la
// clave que firma esta app (y la de Play App Signing cuando exista).
plugins {
    id("com.android.application") version "8.13.1" apply false
}
