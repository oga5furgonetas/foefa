package com.flotadsp.fds.data

import kotlinx.serialization.Serializable

/* «MIS DNR» (11-11-2026, tanda 2; para la próxima versión de Play). Lo que contesta GET /diarios/mias, la misma ruta que
   usa el portal web (MisDnr.jsx): las DNR del conductor que llama, de las 4 últimas semanas de Amazon (domingo a sábado),
   de la más nueva a la más vieja, también las vacías. De cada una, lo MÍNIMO: el día, el código del paquete y su estado.
   Ni cliente ni euros: el servidor no los manda y aquí no hay sitio para ellos. Los campos, como los escribe el servidor
   (sin @SerialName, como Aviso); lo que llegue de más se ignora (Json { ignoreUnknownKeys = true }). */

/** Una DNR: `dia` (la fecha de concesión, AAAA-MM-DD), `paquete` (el código) y `estado`: «cuenta», «no_cuenta» o
 *  «sin_clasificar» (Amazon aún no la ha revisado). */
@Serializable
data class UnaDnr(val dia: String = "", val paquete: String = "", val estado: String = "sin_clasificar")

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

/** GET /diarios/mias. Devuelve null si la empresa no tiene la DNR diaria: el servidor contesta 404, como una ruta que
 *  no existe, y la app hace como si «Mis DNR» no existiera (ni fila en el inicio ni pantalla). Cualquier otro fallo
 *  (sin red, 5xx, 403) sube como ErrorApi, para que la pantalla diga que no ha podido cargarlas. Fuera del Repositorio
 *  para poder probarlo con un servidor de mentira sin un Context. */
suspend fun misDnrDe(api: Api): MisDnr? = try {
    leer<MisDnr>(api.get("diarios/mias"))
} catch (e: ErrorApi) {
    if (e.estado == 404) null else throw e
}
