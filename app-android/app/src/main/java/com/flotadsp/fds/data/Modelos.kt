package com.flotadsp.fds.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/* Lo que contesta el servidor de FDS (backend/server.py). Solo los campos que usa la app; el resto se ignora
   (Json { ignoreUnknownKeys = true }), así un campo nuevo en el servidor no rompe la app. */

@Serializable
data class Sesion(
    @SerialName("access_token") val token: String,
    val role: String = "",
    val name: String = "",
    val id: String = "",
)

@Serializable
data class Parada(
    val id: String,
    val codigo: String = "",
    val codigos: List<String> = emptyList(),
    val cliente: String = "",
    val telefono: String = "",
    val direccion: String = "",
    val cp: String = "",
    val localidad: String = "",
    val contenido: String = "",
    val notas: String = "",
    val bultos: Int = 1,
    val tipo: String = "entrega",
    val cobrar: Double? = null,
    val hueco: String = "",
    val prioridad: Boolean = false,
    val estado: String = "pendiente",
    val orden: Int? = null,
    val eta: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val geo: String? = null,
    val motivo: String? = null,
    @SerialName("cerrado_en") val cerradoEn: String? = null,
    @SerialName("ventana_desde") val ventanaDesde: String? = null,
    @SerialName("ventana_hasta") val ventanaHasta: String? = null,
    @SerialName("cobrado_importe") val cobradoImporte: Double? = null,
    @SerialName("cobrado_metodo") val cobradoMetodo: String? = null,
    @SerialName("entrega_donde") val entregaDonde: String? = null,
    @SerialName("entrega_recibe") val entregaRecibe: String? = null,
    @SerialName("entrega_nota") val entregaNota: String? = null,
    val ejemplo: Boolean = false,
    val escaneos: Int = 0,
) {
    val pendiente get() = estado == "pendiente" || estado == "en_ruta"
    val ubicada get() = lat != null && lng != null
    val porCobrar get() = (cobrar ?: 0.0) > 0.0
}

@Serializable
data class ResumenRuta(
    val salida: String? = null,
    val fin: String? = null,
    val minutos: Int? = null,
    val km: Double? = null,
    val paradas: Int? = null,
    @SerialName("sin_ubicar") val sinUbicar: Int? = null,
    val trafico: Boolean? = null,
    val fuente: String? = null,
    val programada: Boolean? = null,
)

@Serializable
data class Base(val direccion: String? = null, val lat: Double? = null, val lng: Double? = null)

@Serializable
data class MiRuta(
    val activo: Boolean = false,
    val autonomo: Boolean = false,
    val empresa: String = "",
    val fecha: String = "",
    val pais: String? = null,
    val prefijo: String? = null,
    val pedidos: List<Parada> = emptyList(),
    val ruta: ResumenRuta? = null,
    val base: Base? = null,
    val prueba: Boolean = false,
)

@Serializable
data class Escaneo(val encontrado: Boolean = false, val codigo: String = "", val pedido: Parada? = null)

@Serializable
data class Ordenado(val ordenados: Int = 0, val ruta: ResumenRuta? = null)

@Serializable
data class DiaEstadistica(val fecha: String, val total: Int = 0, val entregados: Int = 0, val fallidos: Int = 0)

@Serializable
data class Estadisticas(
    val total: Int = 0,
    val entregados: Int = 0,
    @SerialName("tasa_entrega") val tasa: Int? = null,
    @SerialName("por_dia") val porDia: List<DiaEstadistica> = emptyList(),
)

@Serializable
data class PedidosDia(val pedidos: List<Parada> = emptyList())

@Serializable
data class DireccionConocida(
    val direccion: String = "",
    val cp: String = "",
    val localidad: String = "",
    val lat: Double? = null,
    val lng: Double? = null,
    val cliente: String = "",
    val telefono: String = "",
    val veces: Int = 0,
)

@Serializable
data class Direcciones(val direcciones: List<DireccionConocida> = emptyList())

@Serializable
data class Gratis(val activo: Boolean = false, val tope: Int? = null, val usadas: Int? = null)

/** La oferta del plan del repartidor (de /billing/planes): `gratisHasta` «2026-12-31» mientras dure la promoción. */
data class Oferta(val gratisHasta: String? = null, val paradasGratis: Int = 15)

@Serializable
data class Promo(val activa: Boolean = false, val hasta: String? = null)

@Serializable
data class Plan(
    val status: String? = null,
    val plan: String? = null,
    @SerialName("days_left") val diasQuedan: Int? = null,
    val gratis: Gratis? = null,
    val promo: Promo? = null,
    val bloqueo: String? = null,
    val suscrita: Boolean? = null,
)

@Serializable
data class Referidos(
    val codigo: String = "",
    val invitados: Int = 0,
    val premiados: Int = 0,
    val saldo: Int = 0,
    @SerialName("por_invitado") val porInvitado: Int = 0,
)

/* Los ajustes se guardan ENTEROS (PUT /reparto/ajustes sustituye todo): se guarda el objeto tal cual vino. */
typealias Ajustes = JsonObject
