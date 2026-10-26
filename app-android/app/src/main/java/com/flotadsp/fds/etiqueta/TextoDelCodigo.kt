package com.flotadsp.fds.etiqueta

import com.google.mlkit.vision.barcode.common.Barcode
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction

/* EL TEXTO DE UN CÓDIGO LEÍDO POR ML KIT (25-10-2026).
   Probado en el emulador (LecturaEnElMovilTest): ML Kit DETECTA los 2D con tildes o eñes («María», «Rúa», «Coruña»)
   pero devuelve `rawValue = null` cuando el contenido no es UTF-8, y las impresoras de etiquetas escriben en Latin-1
   (ISO-8859-1). Sin esto, la etiqueta de una calle con tilde no daba nada. `rawBytes` trae el contenido tal cual,
   separadores (GS, RS, US) incluidos: se lee como UTF-8 si lo es y, si no, como Latin-1. `displayValue` no sirve:
   ML Kit lo «arregla» para enseñarlo (cambia los «|» por saltos de línea). */
object TextoDelCodigo {
    fun de(b: Barcode): String? {
        b.rawValue?.takeIf { it.isNotEmpty() }?.let { return it }
        val bytes = b.rawBytes ?: return null
        if (bytes.isEmpty()) return null
        return deBytes(bytes)
    }

    fun deBytes(bytes: ByteArray): String {
        val utf8 = Charsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
        return try {
            utf8.decode(ByteBuffer.wrap(bytes)).toString()
        } catch (_: CharacterCodingException) {
            String(bytes, Charsets.ISO_8859_1)
        }
    }
}
