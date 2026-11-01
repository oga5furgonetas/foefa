package com.flotadsp.fds.ui

import android.content.Context
import android.speech.tts.TextToSpeech

/* LA VOZ DE LA APP (01-11-2026): el briefing de la siguiente parada (RutaVM) y el hueco de cada paquete al cargar
   (EscanerVM en modo carga), como la web (frontend/src/lib/voz.js). El motor de voz de Android tarda un momento en
   arrancar: lo que se diga mientras tanto se guarda y sale al estar listo. Se apaga en Ajustes («Briefing por voz»),
   y quien lo llama lo comprueba antes (Cuenta.voz). */
object Voz {
    private var tts: TextToSpeech? = null
    private var lista = false
    private var pendiente: Pair<String, Boolean>? = null
    private var n = 0

    /** Dice `texto` en el idioma de la app. Corta lo que estuviera diciendo, salvo con `cola` (el briefing espera). */
    @Synchronized
    fun decir(ctx: Context, texto: String, cola: Boolean = false) {
        if (texto.isBlank()) return
        if (tts == null) {
            pendiente = texto to cola
            tts = runCatching {
                TextToSpeech(ctx.applicationContext) { estado -> arrancado(estado == TextToSpeech.SUCCESS) }
            }.getOrNull()
            return
        }
        if (!lista) { pendiente = texto to cola; return }
        hablar(texto, cola)
    }

    @Synchronized
    private fun arrancado(ok: Boolean) {
        lista = ok
        val p = pendiente
        pendiente = null
        if (ok && p != null) hablar(p.first, p.second)
    }

    private fun hablar(texto: String, cola: Boolean) {
        val t = tts ?: return
        runCatching { t.language = Idioma.locale }      // por si cambió el idioma del móvil
        runCatching { t.speak(texto, if (cola) TextToSpeech.QUEUE_ADD else TextToSpeech.QUEUE_FLUSH, null, "fds-${n++}") }
    }

    @Synchronized
    fun callar() { pendiente = null; runCatching { tts?.stop() } }
}
