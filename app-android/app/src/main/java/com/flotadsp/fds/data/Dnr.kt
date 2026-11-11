package com.flotadsp.fds.data

import kotlinx.serialization.Serializable

/* «MIS DNR» (11-11-2026, tanda 2; para la próxima versión de Play). Lo que contesta GET /diarios/mias, la misma ruta que
   usa el portal web (MisDnr.jsx): las DNR del conductor que llama, de las 4 últimas semanas de Amazon (domingo a sábado),
   de la más nueva a la más vieja, también las vacías. Ni cliente (salvo el código postal) ni euros ni el ID de reparto: el
   servidor no los manda y aquí no hay sitio para ellos. Los campos, como los escribe el servidor (sin @SerialName, como
   Aviso); lo que llegue de más se ignora (Json { ignoreUnknownKeys = true }), también `sin_interpretar`, que es solo
   para diagnóstico. */

/** Una DNR: `dia` (la fecha de concesión, AAAA-MM-DD), `paquete` (el código) y `estado`: «cuenta», «no_cuenta» o
 *  «sin_clasificar» (Amazon aún no la ha revisado).
 *
 *  CÓMO FUE LA ENTREGA (11-11-2026, segunda vuelta): lo que el servidor ha entendido del Daily Report, ya interpretado en
 *  una clave corta. Todo puede venir a null (no se sabe con seguridad) o no venir (un servidor de antes): entonces la
 *  pantalla no dice nada de eso. Un valor que esta versión no conozca (un servidor más nuevo) tampoco se dice: lo decide
 *  DnrConductor.quePaso, que nunca pinta un código crudo.
 *  - `cp`: el código postal del informe («15704»); la dirección no viene.
 *  - `como`: cómo lo marcó (puerta, puerta_trasera, buzon, en_mano, familiar, recepcion, conserjeria, vecino, locker,
 *    comercio, jardin, lugar_seguro, garaje, cobertizo).
 *  - `lejos`: true = lo marcó a 25 m o más del sitio; false = a menos.
 *  - `llamada`: «si» (con `segundos` > 0) o «no» (el informe dice con todas las letras que no llamó).
 *  - `fallo_contacto`: true si está en la tabla de fallos de contacto (nunca false: que no esté no prueba nada).
 *  - `foto`: «mal» (no pasó la revisión, con `foto_motivo` si se entiende) o «bien». */
@Serializable
data class UnaDnr(
    val dia: String = "",
    val paquete: String = "",
    val estado: String = "sin_clasificar",
    val cp: String? = null,
    val como: String? = null,
    val lejos: Boolean? = null,
    val llamada: String? = null,
    val segundos: Int? = null,
    val fallo_contacto: Boolean? = null,
    val foto: String? = null,
    val foto_motivo: String? = null,
)

/** Una semana de Amazon: `semana` es su domingo y `hasta` su sábado; los tres recuentos los hace el servidor. */
@Serializable
data class SemanaDnr(
    val semana: String = "",
    val hasta: String = "",
    val cuentan: Int = 0,
    val no_cuentan: Int = 0,
    val sin_clasificar: Int = 0,
    val dnr: List<UnaDnr> = emptyList(),
)

/** `tiene_id`: la oficina le ha casado algún ID de reparto (sin él, `semanas` va vacía). `en_revision`: alguno de sus
 *  ID está en duda y sus DNR no se enseñan. `datos_hasta`: el último día de reporte subido de su centro. */
@Serializable
data class MisDnr(
    val tiene_id: Boolean = false,
    val en_revision: Boolean = false,
    val datos_hasta: String? = null,
    val semanas: List<SemanaDnr> = emptyList(),
)

/** GET /diarios/mias. Devuelve null cuando «Mis DNR» no es para quien llama y la app hace como si no existiera (ni fila
 *  en el inicio ni pantalla, y sin volver a pedirla en bucle):
 *  - 404: la empresa no tiene la DNR diaria (el servidor contesta como una ruta que no existe);
 *  - 403: «Tu ficha está de baja» (11-11-2026, revisión de seguridad D4) o «Solo para conductores».
 *  Cualquier otro fallo (sin red, 5xx) sube como ErrorApi, para que la pantalla diga que no ha podido cargarlas. Fuera del
 *  Repositorio para poder probarlo con un servidor de mentira sin un Context. */
suspend fun misDnrDe(api: Api): MisDnr? = try {
    leer<MisDnr>(api.get("diarios/mias"))
} catch (e: ErrorApi) {
    if (e.estado == 404 || e.estado == 403) null else throw e
}
