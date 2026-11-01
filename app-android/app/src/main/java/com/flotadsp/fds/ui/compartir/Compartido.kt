package com.flotadsp.fds.ui.compartir

import android.net.Uri

/** «COMPARTIR CON FDS» (01-11-2026): lo que llega por «Compartir» desde otra app: el texto (una lista, un WhatsApp del
 *  jefe) o los ficheros (fotos, capturas, un PDF de la hoja de la agencia). Los ficheros se leen en el móvil (el mismo
 *  lector de texto que las etiquetas) y el servidor decide qué líneas son paradas (reparto.paradas_de_hoja). */
data class Compartido(val texto: String? = null, val uris: List<Uri> = emptyList(), val tipo: String = "")

/** Las reglas sin Android, para poder probarlas. */
object Compartir {
    fun esPdf(mime: String?, nombre: String? = null): Boolean =
        mime?.startsWith("application/pdf") == true || nombre?.lowercase()?.endsWith(".pdf") == true

    fun esImagen(mime: String?): Boolean = mime?.startsWith("image/") == true

    /** El texto de varias páginas o fotos, una tras otra, sin líneas vacías ni espacios de más. */
    fun juntar(partes: List<String>): String = partes
        .flatMap { it.replace("\r", "").split("\n") }
        .map { it.replace(Regex("\\s+"), " ").trim() }
        .filter { it.isNotEmpty() }
        .joinToString("\n")

    /** Lo compartido como texto (una lista) va tal cual al servidor; lo leído de fotos o PDF, como hoja (solo las
     *  líneas que son paradas). */
    fun esHoja(ficheros: Int): Boolean = ficheros > 0

    /** Cuántas páginas de un PDF se leen (una hoja de ruta rara vez pasa de unas pocas). */
    const val PAGINAS_MAX = 10
}
