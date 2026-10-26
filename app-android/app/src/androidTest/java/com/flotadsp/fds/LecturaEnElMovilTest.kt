package com.flotadsp.fds

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.flotadsp.fds.etiqueta.LectorEtiqueta
import com.flotadsp.fds.etiqueta.TextoDelCodigo
import com.google.android.gms.tasks.Tasks
import com.google.common.truth.Truth.assertWithMessage
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.junit.Test
import org.junit.runner.RunWith

/* LAS ETIQUETAS, LEÍDAS EN EL MÓVIL (25-10-2026). Los códigos de cada empresa (pruebas/generar-etiquetas.mjs, con
   los formatos que publican) se pegan en una «etiqueta» con su texto alrededor, recta y torcida, y los lee el lector de
   Google que usa la app (ML Kit, con los mismos formatos que el escáner). Lo leído pasa por LectorEtiqueta: así se
   comprueba lo que la prueba de JVM no puede, que ML Kit entrega los separadores de los 2D (GS, RS, US) tal cual. */
@RunWith(AndroidJUnit4::class)
class LecturaEnElMovilTest {
    private val ctx = InstrumentationRegistry.getInstrumentation().context
    private val lector = BarcodeScanning.getClient(BarcodeScannerOptions.Builder().setBarcodeFormats(
        Barcode.FORMAT_CODE_128, Barcode.FORMAT_CODE_39, Barcode.FORMAT_CODE_93, Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8,
        Barcode.FORMAT_ITF, Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E, Barcode.FORMAT_CODABAR, Barcode.FORMAT_QR_CODE,
        Barcode.FORMAT_DATA_MATRIX, Barcode.FORMAT_PDF417, Barcode.FORMAT_AZTEC,
    ).build())

    private fun png(n: String): Bitmap = ctx.assets.open("etiquetas/$n.png").use { BitmapFactory.decodeStream(it) }

    /** Una etiqueta de 100×150 mm: los códigos y letra alrededor, como sale de la impresora térmica. */
    private fun etiqueta(vararg codigos: String, giro: Float = 0f): Bitmap {
        val b = Bitmap.createBitmap(1200, 1800, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        c.drawColor(Color.WHITE)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 40f }
        listOf("DESTINATARIO", "ENTREGA 24H · 1/1 · 1,50 KG", "REF 298 · CLASSIC").forEachIndexed { i, t -> c.drawText(t, 60f, 90f + i * 56, p) }
        var y = 300f
        for (n in codigos) {
            val img = png(n)
            val escala = minOf(1f, 1000f / img.width)
            val w = (img.width * escala).toInt()
            val h = (img.height * escala).toInt()
            c.drawBitmap(Bitmap.createScaledBitmap(img, w, h, false), 100f, y, null)
            y += h + 80
        }
        c.drawText("No dejar en conserjería.", 60f, 1740f, p)
        if (giro == 0f) return b
        return Bitmap.createBitmap(b, 0, 0, b.width, b.height, Matrix().apply { postRotate(giro) }, true)
    }

    // Igual que el escáner de la app: el texto de cada código con TextoDelCodigo (los bytes si ML Kit no da el texto).
    private fun leer(b: Bitmap): List<String> =
        Tasks.await(lector.process(InputImage.fromBitmap(b, 0))).mapNotNull { TextoDelCodigo.de(it) }

    private fun comprobar(nombre: String, b: Bitmap, pais: String, esperado: Map<String, Any?>) {
        val leido = leer(b)
        val r = LectorEtiqueta.datosDeCodigos(leido, pais)
        for ((k, v) in esperado) {
            val real: Any? = when (k) {
                "direccion" -> r.direccion; "localidad" -> r.localidad; "cp" -> r.cp; "cliente" -> r.cliente
                "telefono" -> r.telefono; "codigo" -> r.codigo; "lat" -> r.lat; "lng" -> r.lng; "completa" -> r.completa
                else -> error(k)
            }
            if (v is Double) assertWithMessage("$nombre · $k (leído: $leido)").that(real as Double?).isWithin(1e-6).of(v)
            else assertWithMessage("$nombre · $k (leído: $leido)").that(real).isEqualTo(v)
        }
    }

    @Test fun seurDpdAztecConSuBarra() {
        val esperado = mapOf("direccion" to "Rúa Real 5, 2º B", "localidad" to "A Coruña", "cp" to "15003", "cliente" to "María López",
            "telefono" to "612345678", "lat" to 43.3712, "lng" to -8.399, "codigo" to "05123456789012", "completa" to true)
        comprobar("SEUR recta", etiqueta("seur-aztec", "seur-barra"), "es", esperado)
        comprobar("SEUR torcida", etiqueta("seur-aztec", "seur-barra", giro = 9f), "es", esperado)
    }

    @Test fun glsDataMatrixConSuBarra() {
        comprobar("GLS", etiqueta("gls-matriz", "gls-barra"), "es", mapOf("direccion" to "Calle Mayor 12",
            "localidad" to "Santiago de Compostela", "cliente" to "María López", "telefono" to "612345678", "codigo" to "61234567890", "completa" to true))
    }

    @Test fun gs1DataMatrix() {
        comprobar("GS1", etiqueta("gs1-matriz"), "es", mapOf("direccion" to "Calle Real 5", "localidad" to "A Coruña", "cp" to "15003",
            "cliente" to "María López", "telefono" to "612345678", "completa" to true))
    }

    @Test fun gs1ConFnc1ComoLaNorma() {
        // Una etiqueta GS1 de verdad: FNC1 delante y de separador (opción «gs1» del escritor), solo letras sin tilde (la norma).
        comprobar("GS1 FNC1", etiqueta("gs1-fnc1"), "es", mapOf("direccion" to "Calle Real 5", "localidad" to "A Coruna", "cp" to "15003",
            "cliente" to "Maria Lopez", "telefono" to "612345678", "completa" to true))
    }

    @Test fun qrConTrozos() {
        comprobar("QR", etiqueta("qr-trozos"), "es", mapOf("direccion" to "Calle del Pez 3", "localidad" to "Madrid", "cp" to "28004", "completa" to true))
    }

    @Test fun soloLaBarraPideLaFoto() {
        comprobar("solo barra", etiqueta("solo-barra"), "es", mapOf("codigo" to "02940800123456", "completa" to false))
    }

    /** Lo que hace el escáner con una etiqueta de solo barra: leer su TEXTO con el OCR de ML Kit (el de la app). */
    @Test fun soloBarraSeLeeDelTexto() {
        val b = Bitmap.createBitmap(1200, 1600, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        c.drawColor(Color.WHITE)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 60f; isFakeBoldText = true }
        listOf("DESTINATARIO:", "Juan Pérez García", "Calle de la Paz 12, 3º A", "28012 Madrid", "Tel. 612 345 678")
            .forEachIndexed { i, t -> c.drawText(t, 70f, 120f + i * 80, p) }
        val barra = png("solo-barra")
        c.drawBitmap(barra, ((1200 - barra.width) / 2).toFloat(), 600f, null)
        val ocr = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        val texto = Tasks.await(ocr.process(InputImage.fromBitmap(b, 0))).text
        val l = LectorEtiqueta.leerTexto(texto, "es")
        val m = "(texto: ${texto.replace("\n", " ⏎ ")})"
        // El OCR lee el ordinal «º» como «°» (grado): para la dirección da igual.
        assertWithMessage("dirección $m").that(l.direccion.replace('°', 'º')).isEqualTo("Calle de la Paz 12, 3º A")
        assertWithMessage("cp $m").that(l.cp).isEqualTo("28012")
        assertWithMessage("localidad $m").that(l.localidad).isEqualTo("Madrid")
        assertWithMessage("cliente $m").that(l.cliente).isEqualTo("Juan Pérez García")
        assertWithMessage("teléfono $m").that(l.telefono).isEqualTo("612345678")
    }
}
