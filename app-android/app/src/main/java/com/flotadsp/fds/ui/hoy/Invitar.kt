package com.flotadsp.fds.ui.hoy

import com.flotadsp.fds.data.MiRuta
import com.flotadsp.fds.ui.Idioma
import com.flotadsp.fds.ui.tx

/* LA INVITACIÓN TRAS LA PRIMERA ENTREGA (02-11-2026). Dani: «consigue que todo el mundo utilice la app… viralización».
   El embudo real era 32 registros → 0 días de reparto, y quien acaba de entregar su primera parada del día es quien
   mejor puede traer a otro repartidor. En Hoy, con la cuenta de quien reparte por su cuenta y al menos una entrega,
   sale la tarjeta «Gana 10 € por cada compañero que reparta con FDS» con WhatsApp y el compartir del móvil; «Ahora no»
   la quita ese día. Aquí va lo que se prueba sin Android: cuándo sale, el enlace y el mensaje (el MISMO que manda la
   web desde «Invita y gana», frontend/src/lib/compartir.js textoInvitar: las frases ya están traducidas allí). */
object Invitar {
    /** El bono de bienvenida del invitado (29-10-2026: 25 €), el mismo _BONO_CENT de server.py y BONO_CENT de
     *  precios.js; solo se usa si el servidor no manda el importe en la ruta ni en /referidos. */
    const val BONO_CENT = 2500

    /** El enlace de invitación: el de la web con el código, y UTM para saber que vino de la tarjeta de Hoy. */
    fun enlace(web: String, codigo: String?): String {
        val ref = codigo?.takeIf { it.isNotBlank() }?.let { "ref=${java.net.URLEncoder.encode(it, "UTF-8")}&" } ?: ""
        return "$web/invita?${ref}utm_source=referido&utm_medium=app_android&utm_campaign=primera_entrega"
    }

    /** El mensaje de WhatsApp y de compartir: la promoción («gratis y sin límite hasta el {fecha}», con `gratisHasta` ya
     *  escrita, p. ej. «31 de diciembre», o la frase de probar gratis si no la hay), lo que gana el invitado con su
     *  primera ruta (`bonoCent`, 0 si no hay promoción) y lo que gana quien invita (`porInvitado`). */
    fun texto(enlace: String, gratisHasta: String?, bonoCent: Int, porInvitado: Int): String {
        val base = if (!gratisHasta.isNullOrBlank())
            tx("Uso FDS para ordenar mi ruta de reparto y navegar parada a parada. Es gratis y sin límite hasta el {fecha}, solo registrarte:", "fecha" to gratisHasta)
        else tx("Uso FDS para ordenar mi ruta de reparto y navegar parada a parada. Pruébala gratis, sin tarjeta:")
        val suyo = if (bonoCent > 0) "\n\n" + tx("Y tú ganas {euros} con tu primera ruta real (20 entregas en 2 días).", "euros" to importe(bonoCent)) else ""
        val premio = if (porInvitado > 0) "\n\n" + tx("Si te registras con mi enlace y completas 20 entregas a direcciones distintas en 2 días diferentes, repartidas durante el día y dentro de tus primeros 30 días, gano {euros}.", "euros" to importe(porInvitado)) else ""
        return "$base $enlace$suyo$premio"
    }

    /** Cuándo sale la tarjeta en Hoy: la cuenta de quien reparte por su cuenta (no la de prueba), al menos una
     *  entrega hoy, el enlace ya cargado (sin red no hay código) y sin «Ahora no» ese mismo día de ruta. */
    fun seEnsena(ruta: MiRuta?, entregadas: Int, codigo: String?, ocultoEl: String?, dia: String): Boolean =
        ruta != null && ruta.autonomo && !ruta.prueba && entregadas >= 1 && !codigo.isNullOrBlank() && ocultoEl != dia

    /** «10 €» o «7,50 €»: siempre en euros, como el bono (lo paga FDS en euros sea cual sea el país de la cuenta). */
    fun importe(cent: Int): String =
        if (cent % 100 == 0) "${cent / 100} €" else "${"%.2f".format(Idioma.locale, cent / 100.0)} €"
}
