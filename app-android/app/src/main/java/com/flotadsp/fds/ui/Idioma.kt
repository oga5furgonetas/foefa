package com.flotadsp.fds.ui

import java.util.Locale

/* LA APP EN EL IDIOMA DEL MÓVIL (30-10-2026, expansión fuera de España; docs/EXPANSION-INTERNACIONAL-30-10.md).
   Como en la web (frontend/src/lib/idioma.js): la CLAVE es el propio texto en español, tx("Quedan {n} paradas",
   "n" to 3) devuelve el texto en el idioma elegido (en, pt, fr, it, de) y, si falta la traducción, el español:
   nunca una clave rara ni un hueco. Las traducciones las genera scripts/nativa-idioma.mjs en Traducciones.kt a
   partir del diccionario de la web y de app-android/traducciones-nativa.json.

   El idioma: el del móvil al arrancar la app (Idioma.arrancar en FdsApp); si el móvil está en uno que no tenemos,
   inglés. En Latinoamérica el español cambia las palabras que allí suenan de fuera (celular, camioneta, toma una
   foto) y en Brasil el portugués (senha, celular, parada), igual que la web: solo sustantivos y verbos que no
   cambian el género ni la frase. */
object Idioma {
    val IDIOMAS = listOf("es", "en", "pt", "fr", "it", "de")
    private val ORDEN = listOf("en", "pt", "fr", "it", "de")
    private val LATAM = setOf("mx", "ar", "co", "cl", "pe", "ve", "ec", "bo", "py", "uy", "cr", "pa", "gt", "hn", "sv", "ni", "do", "pr", "cu", "us")

    @Volatile var actual: String = "es"
        private set
    @Volatile var latam: Boolean = false
        private set
    @Volatile var brasil: Boolean = false
        private set

    /** Para fechas y números en pantalla: el idioma elegido con la región del móvil cuando casa. */
    val locale: Locale
        get() = when (actual) {
            "es" -> Locale.forLanguageTag(if (latam) "es-419" else "es-ES")
            "pt" -> Locale.forLanguageTag(if (brasil) "pt-BR" else "pt-PT")
            "en" -> Locale.forLanguageTag(if (Locale.getDefault().country == "US") "en-US" else "en-GB")
            "fr" -> Locale.forLanguageTag("fr-FR")
            "it" -> Locale.forLanguageTag("it-IT")
            "de" -> Locale.forLanguageTag("de-DE")
            else -> Locale.forLanguageTag("es-ES")
        }

    /** Al arrancar la app: `elegido` (si algún día se elige en Cuenta) o el idioma del móvil; `pais` el de la SIM. */
    fun arrancar(elegido: String? = null, pais: String? = null) {
        val d = Locale.getDefault()
        val lengua = elegido?.takeIf { it in IDIOMAS } ?: d.language.lowercase(Locale.ROOT).takeIf { it in IDIOMAS } ?: "en"
        val region = (pais?.takeIf { it.length == 2 } ?: d.country).lowercase(Locale.ROOT)
        actual = lengua
        brasil = lengua == "pt" && (region == "br" || d.toLanguageTag().equals("pt-BR", ignoreCase = true))
        latam = lengua == "es" && region in LATAM
    }

    fun tx(es: String): String {
        val base = when (actual) {
            "es" -> es
            else -> Traducciones.MAPA[es]?.getOrNull(ORDEN.indexOf(actual))?.takeIf { it.isNotBlank() } ?: es
        }
        return when {
            actual == "es" && latam -> aLatam(base)
            actual == "pt" && brasil -> aBrasil(base)
            else -> base
        }
    }

    /** Con variables: tx("Quedan {n} paradas", "n" to 3). */
    fun tx(es: String, vararg vars: Pair<String, Any?>): String {
        var t = tx(es)
        for ((k, v) in vars) t = t.replace("{$k}", v?.toString() ?: "")
        return t
    }

    /* Las palabras que cambian en Latinoamérica y en Brasil (las mismas listas que idioma.js). Las frases largas
       antes que las cortas; se respeta la mayúscula inicial. */
    private val PALABRAS_LATAM = mapOf(
        "haz una foto" to "toma una foto", "hazle una foto" to "tómale una foto", "haces una foto" to "tomas una foto",
        "hacer una foto" to "tomar una foto", "hacerle una foto" to "tomarle una foto",
        "móvil" to "celular", "móviles" to "celulares", "furgoneta" to "camioneta", "furgonetas" to "camionetas",
        "el ordenador" to "la computadora", "un ordenador" to "una computadora", "del ordenador" to "de la computadora",
    )
    private val PALABRAS_BR = mapOf(
        "palavra-passe" to "senha", "palavras-passe" to "senhas", "paragem" to "parada", "paragens" to "paradas",
        "telemóvel" to "celular", "telemóveis" to "celulares", "registo" to "cadastro", "registos" to "cadastros",
        "registar" to "cadastrar", "registe" to "cadastre", "registado" to "cadastrado", "registada" to "cadastrada",
        "equipa" to "equipe", "equipas" to "equipes", "utilizador" to "usuário", "utilizadores" to "usuários",
        "partilhar" to "compartilhar", "partilhe" to "compartilhe", "partilhado" to "compartilhado", "descarregar" to "baixar",
        "descarregue" to "baixe", "ficheiro" to "arquivo", "ficheiros" to "arquivos", "contacto" to "contato", "contactos" to "contatos",
        "estafeta" to "entregador", "estafetas" to "entregadores",
    )
    private fun cambiador(mapa: Map<String, String>): Regex =
        Regex("\\b(" + mapa.keys.sortedByDescending { it.length }.joinToString("|") { Regex.escape(it) } + ")\\b", RegexOption.IGNORE_CASE)
    private val reLatam = cambiador(PALABRAS_LATAM)
    private val reBr = cambiador(PALABRAS_BR)
    private fun cambia(s: String, re: Regex, mapa: Map<String, String>): String = re.replace(s) { m ->
        val r = mapa[m.value.lowercase(Locale.ROOT)] ?: m.value
        if (m.value.first().isUpperCase()) r.replaceFirstChar { it.uppercase(Locale.ROOT) } else r
    }
    fun aLatam(s: String) = cambia(s, reLatam, PALABRAS_LATAM)
    fun aBrasil(s: String) = cambia(s, reBr, PALABRAS_BR)
}

/** El texto en el idioma de la app; las pantallas lo usan a secas: Text(tx("Hoy")). */
fun tx(es: String): String = Idioma.tx(es)
fun tx(es: String, vararg vars: Pair<String, Any?>): String = Idioma.tx(es, *vars)
