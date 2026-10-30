package com.flotadsp.fds

import com.flotadsp.fds.etiqueta.Lectura
import com.flotadsp.fds.etiqueta.LectorEtiqueta
import com.google.common.truth.Truth.assertWithMessage
import org.junit.Test

/* LOS MISMOS CASOS QUE LA WEB: scripts/check-leer-etiqueta.mjs (etiquetas de 8 países y códigos) y
   scripts/check-escaneo-2d.mjs (SEUR/DPD, GLS, UPS, GS1, QR). Si la app lee distinto que la web, falla aquí. */
class LectorEtiquetaTest {
    private val GS = "\u001d"
    private val RS = "\u001e"
    private val US = "\u001f"
    private val EOT = "\u0004"

    private fun comprobar(nombre: String, r: Lectura, esperado: Map<String, Any?>) {
        for ((k, v) in esperado) {
            val real: Any? = when (k) {
                "codigo" -> r.codigo; "cliente" -> r.cliente; "telefono" -> r.telefono; "direccion" -> r.direccion
                "cp" -> r.cp; "localidad" -> r.localidad; "lat" -> r.lat; "lng" -> r.lng; "completa" -> r.completa
                else -> error("campo $k")
            }
            if (v is Double) assertWithMessage("$nombre · $k").that(real as Double?).isWithin(1e-6).of(v)
            else assertWithMessage("$nombre · $k").that(real).isEqualTo(v)
        }
    }

    @Test fun etiquetasDeCadaPais() {
        val casos = listOf(
            // EL NÚMERO Y EL PISO (30-10-2026): «2 1º B» leído como «21º B» o «2 1 B».
            Triple("es", "Cliente: Marta Río\nRúa Real 21º B\n15003 A Coruña\n698 112 233",
                mapOf("direccion" to "Rúa Real 2, 1º B", "cp" to "15003", "localidad" to "A Coruña", "telefono" to "698112233")),
            Triple("es", "Avenida de Mahía 2 1 B\n15220 Bertamiráns\n600 000 000",
                mapOf("direccion" to "Avenida de Mahía 2, 1º B", "cp" to "15220", "localidad" to "Bertamiráns")),
            Triple("es", "C/ Mayor 2 1º B\n28013 Madrid", mapOf("direccion" to "C/ Mayor 2, 1º B", "cp" to "28013", "localidad" to "Madrid")),
            Triple("es", "Plaza Mayor 12º\n28012 Madrid", mapOf("direccion" to "Plaza Mayor 12º", "cp" to "28012")),
            // OTROS PAÍSES (30-10-2026).
            Triple("gb", "Deliver to: Jane Doe\n12 High Street\nFlat 3\nLondon\nSW1A 1AA\nPhone: 020 7946 0958",
                mapOf("direccion" to "12 High Street, Flat 3", "cp" to "SW1A 1AA", "localidad" to "London", "telefono" to "02079460958", "cliente" to "Jane Doe")),
            Triple("fr", "Destinataire : Marie Dupont\n12 rue de la Paix\n2e étage\n75002 Paris\nTél : 06 12 34 56 78",
                mapOf("direccion" to "12 rue de la Paix, 2e étage", "cp" to "75002", "localidad" to "Paris", "telefono" to "0612345678")),
            Triple("de", "Lieferadresse: Hans Müller\nHauptstraße 12\n2. OG\n10115 Berlin\nTel. 030 1234567",
                mapOf("direccion" to "Hauptstraße 12, 2. OG", "cp" to "10115", "localidad" to "Berlin", "telefono" to "0301234567")),
            Triple("nl", "Keizersgracht 123\n1015 CJ Amsterdam\n06 12345678",
                mapOf("direccion" to "Keizersgracht 123", "cp" to "1015 CJ", "localidad" to "Amsterdam", "telefono" to "612345678")),
            Triple("it", "Destinatario: Luca Bianchi\nVia Roma 12\n00184 Roma\n+39 333 123 4567",
                mapOf("direccion" to "Via Roma 12", "cp" to "00184", "localidad" to "Roma", "telefono" to "3331234567", "cliente" to "Luca Bianchi")),
            Triple("co", "Destinatario: Ana Gómez\nCarrera 7 # 32-16 Apto 501\nBogotá 110311\nCel: 310 555 1234",
                mapOf("direccion" to "Carrera 7 # 32-16 Apto 501", "cp" to "110311", "localidad" to "Bogotá", "telefono" to "3105551234")),
            Triple("es", "SEUR\nDestinatario: María López García\nC/ Mayor 12\n3º B\n15001 A Coruña\nTel: 612 345 678\nPedido: AB123456",
                mapOf("telefono" to "612345678", "direccion" to "C/ Mayor 12, 3º B", "cp" to "15001", "localidad" to "A Coruña", "cliente" to "María López García", "codigo" to "AB123456")),
            Triple("es", "Cliente: Pepe Pérez\nRúa do Vilar 5\n15705 Santiago\n+34 981 55 44 33",
                mapOf("telefono" to "981554433", "direccion" to "Rúa do Vilar 5", "cp" to "15705", "localidad" to "Santiago")),
            Triple("es", "Entregar al vecino si no está\nAvda. de Galicia 40\n36202 Vigo\n699112233",
                mapOf("direccion" to "Avda. de Galicia 40", "cp" to "36202", "localidad" to "Vigo", "telefono" to "699112233")),
            Triple("mx", "Destinatario: Juan Pérez\nCalle Hidalgo 245 Int. 3\nCol. Centro\nC.P. 64000 Monterrey, N.L.\nTel. 81 1234 5678\nGuía: 1Z999AA10123456784",
                mapOf("telefono" to "8112345678", "direccion" to "Calle Hidalgo 245 Int. 3, Col. Centro", "cp" to "64000", "localidad" to "Monterrey, N.L.", "cliente" to "Juan Pérez")),
            Triple("mx", "DESTINATARIO JOSEFINA RUIZ\nAV. INSURGENTES SUR 1602\nCOL. CREDITO CONSTRUCTOR\n03940 CIUDAD DE MEXICO\n+52 1 55 9876 5432",
                mapOf("telefono" to "5598765432", "direccion" to "AV. INSURGENTES SUR 1602, COL. CREDITO CONSTRUCTOR", "cp" to "03940", "localidad" to "CIUDAD DE MEXICO")),
            Triple("br", "DESTINATÁRIO: João da Silva\nRua das Flores, 123 - Apto 45\nBairro Jardim América\n01310-100 São Paulo - SP\nTel: (11) 98765-4321",
                mapOf("telefono" to "11987654321", "direccion" to "Rua das Flores, 123 - Apto 45, Bairro Jardim América", "cp" to "01310-100", "localidad" to "São Paulo - SP", "cliente" to "João da Silva")),
            Triple("br", "Nome: Ana Souza\nAv. Brasil 2000 Bloco B\nCEP 20040-002 Rio de Janeiro/RJ\n+55 21 3456-7890",
                mapOf("telefono" to "2134567890", "direccion" to "Av. Brasil 2000 Bloco B", "cp" to "20040-002", "cliente" to "Ana Souza")),
            Triple("co", "Destinatario: Ana Gómez\nCarrera 7 # 32-16 Apto 501\nBogotá D.C.\nCel: 310 555 1234",
                mapOf("telefono" to "3105551234", "direccion" to "Carrera 7 # 32-16 Apto 501", "cliente" to "Ana Gómez")),
            Triple("ar", "Destinatario: Lucas Fernández\nAv. Corrientes 1234 Piso 5 Dto B\nC1043AAZ CABA\nTel: 11 15 2345 6789",
                mapOf("telefono" to "1123456789", "direccion" to "Av. Corrientes 1234 Piso 5 Dto B", "cp" to "C1043AAZ", "localidad" to "CABA")),
            Triple("pe", "Cliente: Rosa Quispe\nJr. de la Unión 456\nLima 15001\n987 654 321",
                mapOf("telefono" to "987654321", "direccion" to "Jr. de la Unión 456", "cp" to "15001")),
            Triple("pt", "Destinatário: Rui Costa\nRua Augusta 100, 2º Esq\n1100-053 Lisboa\nTelemóvel: 912 345 678",
                mapOf("telefono" to "912345678", "direccion" to "Rua Augusta 100, 2º Esq", "cp" to "1100-053", "localidad" to "Lisboa", "cliente" to "Rui Costa")),
            Triple("us", "SHIP TO: John Smith\n123 Main St. Apt 4\nSpringfield, IL 62701\nPhone: (217) 555-0123",
                mapOf("telefono" to "2175550123", "direccion" to "123 Main St. Apt 4", "cp" to "62701", "localidad" to "Springfield, IL", "cliente" to "John Smith")),
            Triple("es", "Astelerios Triñanes Domínguez\nIN : Ladeira, Chazo 33 AZ 00\nAbanqueiro, Boiro\nBoiro A Coruña\n15938 Boiro A Coruña\nES263683 0253\nCYCLE 1\n0.10 kgs\n636830253",
                mapOf("direccion" to "Ladeira, Chazo 33", "cp" to "15938", "localidad" to "Boiro A Coruña", "telefono" to "")),
        )
        for ((pais, texto, esperado) in casos) comprobar("$pais · ${texto.lines()[1]}", LectorEtiqueta.leerTexto(texto, pais), esperado)
    }

    @Test fun telefonosQueNoSonTelefonos() {
        assertWithMessage("seguimiento mx").that(LectorEtiqueta.telefonoDe("Guía: 1Z999AA10123456784", "mx")).isEmpty()
        assertWithMessage("CP + cifras de otra línea").that(LectorEtiqueta.telefonoDe("15001\n612 345", "es")).isEmpty()
        assertWithMessage("país desconocido").that(LectorEtiqueta.telefonoDe("Tel 0612 345 6789", "xx")).isEqualTo("06123456789")
    }

    @Test fun codigosDeLaWeb() {
        comprobar("GS1 DataMatrix", LectorEtiqueta.datosDeCodigos(listOf(
            "0038412345000000001742028013${GS}4301Maria Lopez${GS}4302Gran Via 32 3B${GS}4305Madrid${GS}4308+34612345678${GS}430913042030003562950000"), "es"),
            mapOf("codigo" to "384123450000000017", "cliente" to "Maria Lopez", "telefono" to "612345678", "direccion" to "Gran Via 32 3B",
                "cp" to "28013", "localidad" to "Madrid", "lat" to 40.4203, "lng" to -3.705, "completa" to true))
        comprobar("GS1 legible", LectorEtiqueta.datosDeCodigos(listOf("(00)384123450000000017(420)15001(4302)Rúa Real 5(4305)A Coruña"), "es"),
            mapOf("codigo" to "384123450000000017", "direccion" to "Rúa Real 5", "cp" to "15001", "localidad" to "A Coruña"))
        comprobar("barra + 2D separado", LectorEtiqueta.datosDeCodigos(listOf("ZX81234567", "ES|28013|MADRID|MARIA LOPEZ|GRAN VIA 32|612345678"), "es"),
            mapOf("codigo" to "ZX81234567", "cliente" to "MARIA LOPEZ", "telefono" to "612345678", "direccion" to "GRAN VIA 32", "cp" to "28013",
                "localidad" to "MADRID", "completa" to true))
        comprobar("ANSI", LectorEtiqueta.datosDeCodigos(listOf(
            "[)>${RS}01${GS}96841706672${GS}840${GS}001${GS}1Z12345675${GS}UPSN${GS}12345E${GS}089${GS}${GS}1/1${GS}10.1${GS}Y${GS}634 MAIN ST${GS}YORK${GS}PA$RS$EOT"), "us"),
            mapOf("direccion" to "634 MAIN ST", "cp" to "84170", "localidad" to "YORK, PA"))
        comprobar("GS1 Reino Unido (legible)", LectorEtiqueta.datosDeCodigos(listOf("(4302)12 High Street(4305)London(420)SW1A1AA(4308)+442079460958"), "gb"),
            mapOf("direccion" to "12 High Street", "localidad" to "London", "cp" to "SW1A1AA", "telefono" to "2079460958", "completa" to true))
        comprobar("solo la barra", LectorEtiqueta.datosDeCodigos(listOf("ZX81234567"), "es"), mapOf("codigo" to "ZX81234567", "direccion" to "", "completa" to false))
        comprobar("EAN", LectorEtiqueta.datosDeCodigos(listOf("8412345678905"), "es"), mapOf("codigo" to "8412345678905", "direccion" to ""))
        val g = LectorEtiqueta.geoGS1("13042030003562950000")!!
        assertWithMessage("4309").that(g.first).isWithin(1e-9).of(40.4203)
        assertWithMessage("4309").that(g.second).isWithin(1e-9).of(-3.705)
    }

    private fun geopost(cp: String, bulto: String, calle: String, poblacion: String, pais: String = "724", empresa: String = "",
                        contacto: String = "", tel: String = "", numero: String = "", linea2: String = "", gps: Pair<String, String>? = null) =
        "[)>${RS}01${GS}03${GS}$cp${GS}$pais${GS}101${GS}$bulto${GS}GEOP${GS}${GS}298${GS}${GS}001/001${GS}01.50KG${GS}N${GS}" +
            "$calle${GS}$poblacion${GS}${GS}$empresa$RS" +
            "07${GS}G03${GS}0${GS}0${GS}1${GS}${listOf("", "", contacto, tel, "", "", "", numero, linea2).joinToString(US)}${GS}${GS}$RS" +
            (gps?.let { "07${GS}S081${GS}${it.first}${GS}${it.second}${GS}1${GS}G$RS" } ?: "") + EOT

    @Test fun etiquetasPorEmpresa() {
        comprobar("SEUR con GPS", LectorEtiqueta.datosDeCodigos(listOf(
            geopost("15003", "05123456789012", "Rúa Real", "A Coruña", contacto = "María López", tel = "+34612345678", numero = "5", linea2 = "2º B",
                gps = "+43.3712" to "-008.3990"), "%0015003051234567890121017240"), "es"),
            mapOf("direccion" to "Rúa Real 5, 2º B", "localidad" to "A Coruña", "cp" to "15003", "cliente" to "María López", "telefono" to "612345678",
                "lat" to 43.3712, "lng" to -8.399, "codigo" to "05123456789012", "completa" to true))
        comprobar("SEUR solo ISO", LectorEtiqueta.datosDeCodigos(listOf(
            geopost("15705", "05999999999999", "Calle del Villar 12", "Santiago de Compostela", empresa = "Bar O Peto")), "es"),
            mapOf("direccion" to "Calle del Villar 12", "localidad" to "Santiago de Compostela", "cp" to "15705", "cliente" to "Bar O Peto", "completa" to true))
        comprobar("DPD Portugal", LectorEtiqueta.datosDeCodigos(listOf(
            geopost("4000-322", "07123456789012", "Rua de Santa Catarina 120", "Porto", pais = "620", contacto = "Ana Sousa", tel = "912345678")), "pt"),
            mapOf("direccion" to "Rua de Santa Catarina 120", "localidad" to "Porto", "cp" to "4000-322", "cliente" to "Ana Sousa", "completa" to true))
        comprobar("GLS", LectorEtiqueta.datosDeCodigos(listOf("AES 700ES 7001234567890 1234567890 TEST1234AA 3esa123465760 02320001001",
            "A|María López|Calle Mayor 12|Santiago de Compostela|| 612345678| 1234567|"), "es"),
            mapOf("direccion" to "Calle Mayor 12", "localidad" to "Santiago de Compostela", "cliente" to "María López", "telefono" to "612345678", "completa" to true))
        comprobar("GLS literal", LectorEtiqueta.datosDeCodigos(listOf("A|Hr. Test|Teststraße 42|Rostock-Brinckmansdorf|| 987654321| 1234567|"), "es"),
            mapOf("direccion" to "Teststraße 42", "localidad" to "Rostock-Brinckmansdorf", "cliente" to "Hr. Test", "completa" to true))
        comprobar("UPS MaxiCode", LectorEtiqueta.datosDeCodigos(listOf(
            "[)>${RS}01${GS}9628001${GS}724${GS}011${GS}1Z12345675${GS}UPSN${GS}12345E${GS}298${GS}${GS}1/1${GS}2.0${GS}N${GS}CALLE ALCALA 45${GS}MADRID${GS}$RS$EOT",
            "1Z12345E6605272234"), "es"),
            mapOf("direccion" to "CALLE ALCALA 45", "localidad" to "MADRID", "cp" to "28001", "codigo" to "1Z12345E6605272234", "completa" to true))
        comprobar("GS1 S4T", LectorEtiqueta.datosDeCodigos(listOf(
            "00385123450000000016${GS}4301María López${GS}4302Calle Real 5${GS}4305A Coruña${GS}42015003${GS}4308612345678"), "es"),
            mapOf("direccion" to "Calle Real 5", "localidad" to "A Coruña", "cp" to "15003", "cliente" to "María López", "telefono" to "612345678", "completa" to true))
        comprobar("QR con |", LectorEtiqueta.datosDeCodigos(listOf("María López|Calle del Pez 3|28004|Madrid|612345678"), "es"),
            mapOf("direccion" to "Calle del Pez 3", "localidad" to "Madrid", "cp" to "28004", "completa" to true))
        comprobar("solo seguimiento", LectorEtiqueta.datosDeCodigos(listOf("02940800123456"), "es"), mapOf("codigo" to "02940800123456", "completa" to false))
        // Separadores «dibujados» por el lector.
        val dibujado = geopost("15003", "05123456789012", "Rúa Real", "A Coruña", contacto = "María López", numero = "5")
            .replace(GS, "␝").replace(RS, "␞").replace(US, "␟").replace(EOT, "␄").replace(" ", "␠")
        comprobar("dibujados", LectorEtiqueta.datosDeCodigos(listOf(dibujado), "es"),
            mapOf("direccion" to "Rúa Real 5", "localidad" to "A Coruña", "completa" to true))
    }

    @Test fun formaSinDatos() {
        assertWithMessage("forma").that(LectorEtiqueta.forma("MARIA LOPEZ|GRAN VIA 32|612345678")).isEqualTo("aaaaa aaaaa|aaaa aaa 99|999999999")
    }
}
