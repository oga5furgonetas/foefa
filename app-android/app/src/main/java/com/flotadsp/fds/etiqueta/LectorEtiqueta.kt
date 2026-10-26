package com.flotadsp.fds.etiqueta

/* DE LA ETIQUETA A UNA PARADA, en el móvil y sin red.
   Es la MISMA lógica que la web (frontend/src/lib/interpretaEtiqueta.js y codigoEtiqueta.js), pasada a Kotlin
   regla por regla, y se comprueba con los MISMOS casos (LectorEtiquetaTest: los de
   scripts/check-leer-etiqueta.mjs y scripts/check-escaneo-2d.mjs). Si se cambia una regla aquí, va también allí.

   · `telefonoDe`, `leerTexto`: del texto (la foto leída con ML Kit) a teléfono, dirección, CP, población…
   · `datosDeCodigos`: de los códigos de barras y 2D de la etiqueta (GS1, DPD/SEUR, GLS, UPS/FedEx, trozos). */

data class Lectura(
    var codigo: String = "",
    var cliente: String = "",
    var telefono: String = "",
    var direccion: String = "",
    var cp: String = "",
    var localidad: String = "",
    var lat: Double? = null,
    var lng: Double? = null,
    var codigos: List<String> = emptyList(),
    var telefonoRotulado: Boolean = false,
) {
    /** Calle Y dónde (CP, población o GPS): la parada puede entrar sola. */
    val completa get() = direccion.isNotBlank() && (cp.isNotBlank() || localidad.isNotBlank() || lat != null)
}

object LectorEtiqueta {
    private val I = setOf(RegexOption.IGNORE_CASE)

    val VIA = Regex(
        "(^|\\s)(c/|cl\\.?|calle|r[uú]a|r/|avda\\.?|av\\.?|avenida|plaza|praza|pza\\.?|paseo|p[ºo]\\.?|traves[ií]a|trav\\.?|camino|" +
            "carretera|ctra\\.?|lugar|lg\\.?|urb\\.?|urbanizaci[oó]n|ronda|glorieta|pol[ií]gono|pol\\.?|estrada|camiño|rueiro|bloque|" +
            "carrera|cra\\.?|kr\\.?|diagonal|dg\\.?|transversal|tv\\.|autopista|jir[oó]n|jr\\.?|pasaje|psje\\.?|calzada|calz\\.?|" +
            "privada|priv\\.?|cerrada|andador|boulevard|bulevar|blvd\\.?|prolongaci[oó]n|prol\\.?|rodovia|rod\\.?|alameda|al\\.|" +
            "travessa|largo|pra[cç]a|street|st\\.|avenue|ave\\.?|road|rd\\.|drive|dr\\.|lane|ln\\.|rue|chemin|via|viale|piazza|corso|" +
            "stra(ss|ß)e|str\\.|weg|platz|allee|ladeira)[\\s,]+", I)

    private val SIGUE = Regex(
        "^(\\d+\\s*[ºª°%o]|bajo|entlo|piso|puerta|esc\\.?|portal|apto\\.?|apt\\.?|apartamento|depto\\.?|dpto\\.?|departamento|" +
            "int\\.?|interior|casa|bloco|torre|col\\.?|colonia|fracc\\.?|fraccionamiento|barrio|bairro|b[º°]\\.?|villa|" +
            "urbanizaci[oó]n|conjunto|sector)(?=[\\s,.:]|$)", I)

    private class TelPais(val pref: String, val largos: List<Int>, val inicio: Regex? = null)

    private val TEL_PAIS = mapOf(
        "es" to TelPais("34", listOf(9), Regex("^[6789]")), "pt" to TelPais("351", listOf(9), Regex("^[29]")),
        "mx" to TelPais("52", listOf(10)), "br" to TelPais("55", listOf(10, 11)), "ar" to TelPais("54", listOf(10)),
        "co" to TelPais("57", listOf(10), Regex("^(3|60)")), "cl" to TelPais("56", listOf(9)),
        "pe" to TelPais("51", listOf(9), Regex("^9")), "us" to TelPais("1", listOf(10), Regex("^[2-9]")),
        "ec" to TelPais("593", listOf(9, 10)), "ve" to TelPais("58", listOf(10)), "uy" to TelPais("598", listOf(8, 9)),
        "py" to TelPais("595", listOf(9, 10)), "bo" to TelPais("591", listOf(8)), "gt" to TelPais("502", listOf(8)),
        "cr" to TelPais("506", listOf(8)), "pa" to TelPais("507", listOf(7, 8)), "do" to TelPais("1", listOf(10)),
        "fr" to TelPais("33", listOf(9, 10)), "it" to TelPais("39", listOf(9, 10)), "de" to TelPais("49", listOf(10, 11)),
        "gb" to TelPais("44", listOf(10, 11)),
    )

    private val CP_PAIS = mapOf(
        "es" to Regex("\\b((?:0[1-9]|[1-4]\\d|5[0-2])\\d{3})\\b"),
        "pt" to Regex("\\b(\\d{4}-\\d{3})\\b"),
        "br" to Regex("\\b(\\d{5}-\\d{3}|\\d{8})\\b"),
        "mx" to Regex("\\b(\\d{5})\\b"), "us" to Regex("\\b(\\d{5})(?:-\\d{4})?\\b"), "pe" to Regex("\\b(\\d{5})\\b"),
        "fr" to Regex("\\b(\\d{5})\\b"), "it" to Regex("\\b(\\d{5})\\b"), "de" to Regex("\\b(\\d{5})\\b"),
        "ar" to Regex("\\b([A-Z]\\d{4}[A-Z]{3})\\b"),
    )
    private val CP_CON_RETULO = Regex("\\b(?:c\\.?\\s?p\\.?|cep|c[oó]digo postal|zip|postal)\\s*[:.-]?\\s*([A-Z]?\\d{4,7}(?:-\\d{3,4})?[A-Z]{0,3})\\b", I)

    private val ETIQ_CLIENTE = Regex(
        "\\b(?:cliente|nombre|nome|destinatari[oa]|destinat[aá]rio|recebedor|sr\\.?|sra\\.?|d\\.|dña\\.?|ship to|deliver to|to)\\s*[:.-]\\s*(.{3,60})" +
            "|\\b(?:cliente|nombre|nome|destinatari[oa]|destinat[aá]rio|sr\\.?|sra\\.?|dña\\.?)\\s+(.{3,60})", I)
    private val ETIQ_CODIGO = Regex(
        "\\b(?:ticket|tique|n[ºo°]\\.?\\s*(?:de\\s*)?(?:ticket|pedido|factura)?|pedido|factura\\s+simplificada|albar[aá]n|gu[ií]a|rastreo|" +
            "tracking|c[oó]digo de rastreio|pedido n[ºo°]?)\\s*[:#.-]?\\s*([A-Z0-9][A-Z0-9/-]{3,25})", I)
    private val LINEA_LOGISTICA = Regex("\\b(?:cycle|ciclo|kg|kgs|weight|peso|tnw|awb|tracking|rastreo|shipment|envio)\\b", I)
    private val ROTULO_TELEFONO = Regex("\\b(?:t[1il]f|tel(?:[ée]fono)?|telefone|phone|mobile|movil|cel|whatsapp)", I)
    private val TIRA_TEL = Regex("(^|[^A-Za-z0-9])(\\+?\\(?\\d[\\d \\t().-]{6,18}\\d)(?![A-Za-z0-9])", RegexOption.MULTILINE)
    private val NO_CIFRA = Regex("\\D")

    /** El teléfono: una tira de cifras sin prefijo del país, con un largo y una primera cifra de las de ese país. */
    fun telefonoDe(texto: String, pais: String = "es"): String {
        val t = TEL_PAIS[pais] ?: TelPais("", listOf(9, 10, 11))
        for (m in TIRA_TEL.findAll(texto)) {
            var d = m.groupValues[2].replace(NO_CIFRA, "")
            if (t.pref.isNotEmpty() && d.startsWith(t.pref) && d.length !in t.largos) {
                val sin = d.substring(t.pref.length)
                val conMovil = sin.length == 11 && ((pais == "mx" && sin[0] == '1') || (pais == "ar" && sin[0] == '9'))
                if (sin.length in t.largos || conMovil) d = sin
            }
            if (pais == "mx" && d.length == 11 && d.startsWith("1")) d = d.substring(1)
            if (pais == "ar" && d.length == 11 && d.startsWith("9")) d = d.substring(1)
            if (pais == "ar" && Regex("^0?\\d{2,4}15\\d{6,8}$").matches(d) && d.length > 10) {
                d = d.replaceFirst(Regex("^0"), "").replaceFirst(Regex("^(\\d{2,4})15"), "$1")
            }
            if (d.startsWith("0") && d.length !in t.largos && (d.length - 1) in t.largos) d = d.substring(1)
            if (d.length in t.largos && (t.inicio == null || t.inicio.containsMatchIn(d))) return d
        }
        return ""
    }

    /** Del texto leído (OCR de la foto) a parada. Lo que no se encuentra se deja vacío: se revisa antes de guardar. */
    fun leerTexto(texto: String, pais: String = "es"): Lectura {
        val lineas = texto.split(Regex("\\r?\\n")).map { it.replace(Regex("\\s+"), " ").trim() }.filter { it.isNotEmpty() }
        val todo = lineas.joinToString("\n")
        val out = Lectura()

        out.telefonoRotulado = lineas.any { ROTULO_TELEFONO.containsMatchIn(it) }
        val etiquetaLogistica = LINEA_LOGISTICA.containsMatchIn(todo) || Regex("\\b[A-Z]{1,4}\\d{6,}\\b", I).containsMatchIn(todo)
        val lineasTelefono = lineas.filter { !etiquetaLogistica || !Regex("^[+\\d\\s()./-]+$").matches(it) }
        out.telefono = telefonoDe(lineasTelefono.joinToString("\n"), pais)

        var iVia = lineas.indexOfFirst { VIA.containsMatchIn(" $it ") }
        if (iVia < 0) {
            val cpRe = CP_PAIS[pais] ?: CP_PAIS.getValue("es")
            val calleSinTipo = Regex("\\b[A-ZÁÉÍÓÚÑ][\\p{L}.'’-]+(?:\\s*,?\\s+[\\p{L}.'’-]+){0,4}\\s+\\d{1,4}[A-Z]?\\b", I)
            iVia = lineas.indices.firstOrNull { i ->
                val l = lineas[i]
                !LINEA_LOGISTICA.containsMatchIn(l) && !Regex("\\b\\d{1,2}/\\d{1,2}\\b").containsMatchIn(l) &&
                    calleSinTipo.containsMatchIn(l) &&
                    lineas.subList(i + 1, minOf(lineas.size, i + 4)).any { cpRe.containsMatchIn(it) || CP_CON_RETULO.containsMatchIn(it) }
            } ?: -1
        }
        if (iVia >= 0) {
            val linea = lineas[iVia]
            val via = VIA.find(" $linea ")
            var direccion = linea
            if (via != null && via.range.first > 0) {
                val antes = linea.substring(0, maxOf(0, minOf(linea.length, via.range.first + via.groupValues[1].length - 1)))
                if (Regex("[:：]\\s*$").containsMatchIn(antes)) direccion = linea.substring(antes.length)
            }
            direccion = direccion.replaceFirst(Regex("^(direcci[oó]n|domicilio|dir\\.?|endere[cç]o|address)\\s*[:.-]?\\s*", I), "").trim()
            val conNumero = Regex("^(.+?\\b\\d{1,4}[A-Z]?\\b)(.*)$", I).find(direccion)
            val basura = conNumero != null && Regex("^\\s+(?:[A-Z]{1,4}\\s+){1,2}\\d{1,4}\\s*$", I).matches(conNumero.groupValues[2])
            out.direccion = if (basura) conNumero!!.groupValues[1] else direccion
            val sig = lineas.getOrElse(iVia + 1) { "" }
            if (SIGUE.containsMatchIn(sig) && telefonoDe(sig, pais).isEmpty()) out.direccion += ", $sig"
        }

        val forma = CP_PAIS[pais] ?: CP_PAIS.getValue("es")
        val cerca = if (iVia >= 0) lineas.withIndex().sortedBy { kotlin.math.abs(it.index - iVia) }.map { it.value } else lineas
        for (l in cerca) {
            val indice = lineas.indexOf(l)
            val contexto = lineas.subList(maxOf(0, indice - 1), minOf(lineas.size, indice + 2)).joinToString(" ")
            if (LINEA_LOGISTICA.containsMatchIn(l) || Regex("\\d\\s*/\\s*\\d").containsMatchIn(l) || LINEA_LOGISTICA.containsMatchIn(contexto)) continue
            val conRotulo = CP_CON_RETULO.find(l)
            if (etiquetaLogistica && conRotulo == null && Regex("^[A-Z]?\\d[\\d-]{3,9}[A-Z]{0,3}$", I).matches(l.trim())) continue
            val m = conRotulo ?: forma.find(l) ?: continue
            val cp = m.groupValues[1]
            if (conRotulo == null && telefonoDe(l, pais).isNotEmpty() && telefonoDe(l.replaceFirst(cp, " "), pais).isEmpty()) continue
            out.cp = cp
            val resto = l.substring(l.indexOf(cp) + cp.length).replaceFirst(Regex("^[\\s,.-]+"), "").trim()
            if (resto.isNotEmpty() && resto.length < 40 && !Regex("\\d{3,}").containsMatchIn(resto)) {
                out.localidad = resto
            } else {
                val antes = l.substring(0, maxOf(0, l.indexOf(m.value))).replace(Regex("[\\s,.-]+$"), "").trim()
                if (antes.isNotEmpty() && antes.length < 40 && !Regex("\\d{3,}").containsMatchIn(antes) && !VIA.containsMatchIn(" $antes ")) {
                    out.localidad = antes
                } else {
                    val previa = lineas.getOrElse(lineas.indexOf(l) - 1) { "" }
                    if (previa.isNotEmpty() && previa.length < 40 && Regex("\\p{L}{3,}").containsMatchIn(previa) &&
                        !Regex("\\d{3,}").containsMatchIn(previa) && !LINEA_LOGISTICA.containsMatchIn(previa) && !VIA.containsMatchIn(" $previa ")
                    ) out.localidad = previa
                }
            }
            break
        }
        ETIQ_CLIENTE.find(todo)?.let { c ->
            out.cliente = c.groupValues[1].ifEmpty { c.groupValues[2] }.replaceFirst(Regex("\\+?\\(?\\d[\\d \\t().-]{6,18}\\d"), "").trim()
        }
        ETIQ_CODIGO.find(todo)?.let { out.codigo = it.groupValues[1].replace(Regex("\\s+"), "").uppercase() }
        return out
    }

    // ── Los códigos de la etiqueta ──────────────────────────────────────────────────────────────────────────

    private const val GS = '\u001d'
    private const val RS = '\u001e'
    private const val US = '\u001f'

    /** Lectores que dan los separadores «dibujados» (␝ ␞ ␟ ␄ ␠ o «<GS>»): se devuelven a lo que son. */
    fun normaliza(v: String): String = v
        .replace(Regex("␝|<GS>"), "$GS").replace(Regex("␞|<RS>"), "$RS").replace(Regex("␟|<US>"), "$US")
        .replace(Regex("␄|<EOT>"), "\u0004").replace("␠", " ")

    private fun largoAI(s: String): Int = when {
        Regex("^(0[0-4]|1\\d|2[0-2]|30|37|9\\d)").containsMatchIn(s) -> 2
        Regex("^(2[3-5]|4[0-2])").containsMatchIn(s) -> 3
        else -> 4
    }

    private val FIJOS = mapOf("00" to 18, "01" to 14, "02" to 14, "03" to 14, "04" to 16, "11" to 6, "12" to 6, "13" to 6, "14" to 6,
        "15" to 6, "16" to 6, "17" to 6, "18" to 6, "19" to 6, "20" to 2, "31" to 6, "32" to 6, "33" to 6, "34" to 6, "35" to 6, "36" to 6, "41" to 13)

    /** Del texto de un código a {AI: valor}; null si no parece GS1. */
    fun camposGS1(texto: String): Map<String, String>? {
        var s = texto
        val out = LinkedHashMap<String, String>()
        if (Regex("^\\(\\d{2,4}\\)").containsMatchIn(s)) {
            for (m in Regex("\\((\\d{2,4})\\)([^(]*)").findAll(s)) out[m.groupValues[1]] = m.groupValues[2].trim()
            return out.ifEmpty { null }
        }
        val marcado = Regex("^\\][dQCe]\\d").containsMatchIn(s)
        s = s.replaceFirst(Regex("^\\][dQCe]\\d"), "").replaceFirst(Regex("^\u001d+"), "")
        if (!marcado && !s.contains(GS) && !Regex("^(00\\d{18}|01\\d{14})").containsMatchIn(s)) return null
        var i = 0
        while (i < s.length) {
            if (s[i] == GS) { i += 1; continue }
            val n = largoAI(s.substring(i, minOf(s.length, i + 2)))
            if (i + n > s.length) return null
            val ai = s.substring(i, i + n)
            if (!ai.all { it.isDigit() }) return null
            i += n
            val fijo = FIJOS[ai.take(2)]
            val valor: String
            if (fijo != null) {
                valor = s.substring(i, minOf(s.length, i + fijo)); i += fijo
            } else {
                val fin = s.indexOf(GS, i)
                valor = s.substring(i, if (fin < 0) s.length else fin)
                i = if (fin < 0) s.length else fin + 1
            }
            out[ai] = valor
        }
        return out.ifEmpty { null }
    }

    /** 4309: veinte cifras, latitud y longitud. */
    fun geoGS1(v: String?): Pair<Double, Double>? {
        if (v == null || !Regex("^\\d{20}$").matches(v)) return null
        val lat = v.substring(0, 10).toLong() / 1e7 - 90
        var lng = v.substring(10).toLong() / 1e7
        if (lng > 180) lng -= 360
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
        return Math.round(lat * 1e6) / 1e6 to Math.round(lng * 1e6) / 1e6
    }

    private fun deGS1(c: Map<String, String>, pais: String): Lectura {
        val r = Lectura()
        r.cliente = c["4301"] ?: c["4300"] ?: ""
        r.direccion = listOf(c["4302"], c["4303"], c["4304"]).map { (it ?: "").trim() }.filter { it.isNotEmpty() }.joinToString(", ")
        r.localidad = c["4305"] ?: ""
        if (c["420"] != null) r.cp = c.getValue("420") else if (c["421"] != null) r.cp = c.getValue("421").drop(3)
        c["4308"]?.let { r.telefono = telefonoDe(it, pais).ifEmpty { it.replace(Regex("[^\\d+]"), "") } }
        geoGS1(c["4309"])?.let { (la, lo) -> r.lat = la; r.lng = lo }
        r.codigo = c["00"] ?: c["401"] ?: c["402"] ?: ""
        return r
    }

    /** DPD / SEUR (Geopost): Aztec ISO 15434 de la especificación «Geolabel» 6.0. */
    private fun deGeopost(texto: String, pais: String): Lectura? {
        if (!texto.startsWith("[)>")) return null
        val bloques = texto.split(RS).map { it.split(GS) }
        val iso = bloques.firstOrNull {
            it.getOrNull(0) == "01" && Regex("^0\\d$").matches(it.getOrNull(1) ?: "") && Regex("^[A-Z]{4}$").matches(it.getOrNull(6) ?: "")
        } ?: return null
        if (iso.size < 15) return null
        val r = Lectura(cp = iso[2].trim(), codigo = iso[5].trim(), direccion = iso[13].trim(), localidad = iso[14].trim(),
            cliente = (iso.getOrNull(16) ?: "").trim())
        bloques.firstOrNull { it.getOrNull(0) == "07" && Regex("^G\\d\\d$").matches(it.getOrNull(1) ?: "") }?.let { g ->
            val sub = (g.getOrNull(5) ?: "").split(US).map { it.trim() }
            val contacto = sub.getOrElse(2) { "" }; val tel1 = sub.getOrElse(3) { "" }; val tel2 = sub.getOrElse(4) { "" }
            val movil = sub.getOrElse(5) { "" }; val numero = sub.getOrElse(7) { "" }; val linea2 = sub.getOrElse(8) { "" }
            if (contacto.isNotEmpty()) r.cliente = contacto
            listOf(movil, tel1, tel2).firstOrNull { it.isNotEmpty() }?.let { r.telefono = telefonoDe(it, pais).ifEmpty { it.replace(Regex("[^\\d+]"), "") } }
            if (numero.isNotEmpty() && r.direccion.isNotEmpty() &&
                !Regex("\\b${Regex.escape(numero.replace(Regex("[^\\w]"), ""))}\\b").containsMatchIn(r.direccion)
            ) r.direccion += " $numero"
            val resto = listOf(linea2, (g.getOrNull(6) ?: "").trim()).filter { it.isNotEmpty() }
            if (resto.isNotEmpty() && r.direccion.isNotEmpty()) r.direccion += ", ${resto.joinToString(", ")}"
        }
        bloques.firstOrNull { it.getOrNull(0) == "07" && (it.getOrNull(1) ?: "").startsWith("S08") }?.let { gps ->
            val la = gps.getOrNull(2)?.trim()?.toDoubleOrNull(); val lo = gps.getOrNull(3)?.trim()?.toDoubleOrNull()
            if (la != null && lo != null && kotlin.math.abs(la) <= 90 && kotlin.math.abs(lo) <= 180 && (la != 0.0 || lo != 0.0)) { r.lat = la; r.lng = lo }
        }
        return r
    }

    /** GLS: el segundo DataMatrix, «A|nombre|calle con número|población||teléfono|…». */
    private fun deGLS(texto: String, pais: String): Lectura? {
        val f = texto.split('|')
        if (f[0] != "A" || f.size < 4 || !Regex("\\p{L}{2,}").containsMatchIn(f.getOrElse(2) { "" })) return null
        val r = Lectura(cliente = f[1].trim(), direccion = f[2].trim(), localidad = f[3].trim())
        f.drop(4).map { it.trim() }.firstOrNull { telefonoDe(it, pais).isNotEmpty() }?.let { r.telefono = telefonoDe(it, pais) }
        return r
    }

    /** ANSI MH10.8.3 (UPS, FedEx): tras el «Y/N» de dirección validada vienen dirección, ciudad y estado. */
    private fun deANSI(texto: String, pais: String): Lectura? {
        if (!texto.startsWith("[)>")) return null
        val campos = texto.split(Regex("[\u001d\u001e\u0004]")).map { it.trim() }
        val r = Lectura()
        val iSN = campos.indices.firstOrNull { it > 3 && Regex("^[YN]$").matches(campos[it]) } ?: -1
        if (iSN > 0) {
            r.direccion = campos.getOrElse(iSN + 1) { "" }
            r.localidad = listOf(campos.getOrNull(iSN + 2), campos.getOrNull(iSN + 3)).filter { !it.isNullOrEmpty() }.joinToString(", ")
        }
        for (x in campos.subList(minOf(1, campos.size), minOf(4, campos.size))) {
            var v = x.replaceFirst(Regex("^(?:01|02|96)(?=\\w{4,})"), "")
            if (Regex("^\\d{9}$").matches(v) && pais == "us") v = v.take(5)
            val cp = leerTexto("Calle x\n$v", pais).cp
            if (cp.isNotEmpty()) { r.cp = cp; break }
        }
        (campos.firstOrNull { Regex("^1Z[0-9A-Z]{16}$").matches(it) } ?: campos.firstOrNull { Regex("^\\d{12,22}$").matches(it) })?.let { r.codigo = it }
        return r
    }

    private val SOLO_LETRAS = Regex("^[\\p{L} .'-]{2,60}$")
    private val PARECE_CODIGO = Regex("^[A-Z0-9-]{6,}$")

    /** El resto: trozos separados por «|», «;», «^»… Cada trozo se clasifica por su forma. */
    private fun deTrozos(texto: String, pais: String): Lectura? {
        val trozos = texto.split(Regex("[|^~;\\t\\r\\n\u001d\u001e]+")).map { it.replace(Regex("\\s+"), " ").trim() }.filter { it.isNotEmpty() }
        if (trozos.size < 3) return null
        val r = leerTexto(trozos.joinToString("\n"), pais)
        val iCP = trozos.indexOfFirst { leerTexto("Calle x\n$it", pais).cp == it }
        if (r.cp.isEmpty() && iCP >= 0) r.cp = trozos[iCP]
        if (r.direccion.isEmpty()) {
            val i = trozos.indices.firstOrNull { k ->
                val x = trozos[k]
                k != iCP && Regex("\\p{L}{3,}").containsMatchIn(x) && Regex("\\d").containsMatchIn(x) && x.contains(' ') &&
                    telefonoDe(x, pais).isEmpty() && !Regex("\\d{8,}").containsMatchIn(x) && !PARECE_CODIGO.matches(x)
            }
            if (i != null) r.direccion = trozos[i]
        }
        if (r.localidad.isEmpty() && iCP >= 0) {
            listOf(trozos.getOrNull(iCP + 1), trozos.getOrNull(iCP - 1))
                .firstOrNull { it != null && SOLO_LETRAS.matches(it) && it != r.direccion }?.let { r.localidad = it }
        }
        if (r.cliente.isEmpty() && r.direccion.isNotEmpty()) {
            val iDir = trozos.indexOf(r.direccion.split(',')[0])
            trozos.subList(0, if (iDir < 0) trozos.size else iDir)
                .firstOrNull { SOLO_LETRAS.matches(it) && it.trim().contains(' ') && it != r.localidad }?.let { r.cliente = it }
        }
        return r
    }

    /** El número de seguimiento de siempre: un código corto sin separadores. */
    fun esCodigoSimple(v: String): Boolean {
        val s = v.trim()
        return s.length in 4..40 && !Regex("[\u001d\u001e|;^~\\s]").containsMatchIn(s) && !Regex("^https?:", I).containsMatchIn(s)
    }

    /** La forma de un código, sin un dato de nadie: letras → «a», cifras → «9». */
    fun forma(v: String): String = v.take(300).replace(Regex("\\p{L}"), "a").replace(Regex("\\p{N}"), "9")

    /** Todos los códigos leídos en la etiqueta → una parada. Por fiabilidad: primero lo que sigue una norma. */
    fun datosDeCodigos(valores: List<String>, pais: String = "es"): Lectura {
        val lista = valores.map { normaliza(it) }.filter { it.isNotEmpty() }.distinct()
        val out = Lectura()
        fun poner(r: Lectura?) {
            if (r == null) return
            if (out.codigo.isEmpty()) out.codigo = r.codigo
            if (out.cliente.isEmpty()) out.cliente = r.cliente
            if (out.telefono.isEmpty()) out.telefono = r.telefono
            if (out.direccion.isEmpty()) out.direccion = r.direccion
            if (out.cp.isEmpty()) out.cp = r.cp
            if (out.localidad.isEmpty()) out.localidad = r.localidad
            if (out.lat == null && r.lat != null) { out.lat = r.lat; out.lng = r.lng }
        }
        for (v in lista) camposGS1(v)?.let { poner(deGS1(it, pais)) }
        for (v in lista) poner(deGeopost(v, pais))
        for (v in lista) poner(deGLS(v, pais))
        for (v in lista) poner(deANSI(v, pais))
        for (v in lista) if (camposGS1(v) == null && !v.startsWith("[)>") && deGLS(v, pais) == null) poner(deTrozos(v, pais))
        val simples = lista.filter { esCodigoSimple(it) }
        if (out.codigo.isEmpty()) out.codigo = simples.firstOrNull() ?: (if (lista.size == 1 && lista[0].length <= 60) lista[0] else "")
        out.codigos = (listOf(out.codigo) + simples).filter { it.isNotEmpty() }.distinct()
        return out
    }
}
