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
    val app_destino: String? = null,
    val account_type: String? = null,
    val slug: String? = null,
    val center: String? = null,
    val email: String? = null,
    val configurar_cuenta: Boolean = false,
    val super_admin: Boolean = false,
    val permissions: List<String>? = null,
    val allowed_centers: List<String>? = null,
    val centers: List<String>? = null,
    val admin_role: String? = null,
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
    /** LA CARGA GUIADA (01-11-2026): cuándo se metió en la furgoneta (null = aún fuera). Y el horario escrito a mano. */
    @SerialName("cargado_en") val cargadoEn: String? = null,
    val horario: String = "",
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
    /** LA ENTREGA VERIFICADA (01-11-2026): lo que dijo la IA de la foto de entrega (null = sin IA o sin foto). */
    @SerialName("entrega_ia") val entregaIa: EntregaIa? = null,
    val ejemplo: Boolean = false,
    val escaneos: Int = 0,
    /** El enlace de seguimiento del cliente (token de /s/…), para el WhatsApp. */
    val seguimiento: String? = null,
    /** La última vez en esa puerta (dónde se dejó, la nota, o que no se pudo y por qué). */
    val antes: Antes? = null,
    /** Lo que contestó el cliente en su enlace (30-10-2026): si estará, dónde dejarlo, el portal, una franja. */
    @SerialName("cliente_dice") val clienteDice: ClienteDice? = null,
    /** LA MEMORIA DE LA CALLE (01-11-2026): lo que la empresa sabe de ese portal (el código, dónde dejar, cómo se entra). */
    val memoria: Memoria? = null,
    /** LA VALORACIÓN DEL CLIENTE (01-11-2026): las estrellas que puso en su enlace, ya entregado. */
    val valoracion: Valoracion? = null,
    /** Minutos que se llega tarde a su horario, según la ruta ordenada. */
    @SerialName("tarde_min") val tardeMin: Int? = null,
    /** EL PRIMER PAQUETE BIEN SITUADO (02-11-2026): de dónde salió el punto puesto desde la app («mapa», «movil» o
     *  «sugerencia»), y el centro de la zona (el CP o el pueblo) cuando el servidor solo encontró eso: geo «zona» va SIN
     *  lat/lng (la 2.4.4 y anteriores guiarían al centro del código postal como si fuera la puerta) y sirve para ordenar
     *  la ruta y para centrar el mapa de «Situar la parada». */
    @SerialName("geo_origen") val geoOrigen: String? = null,
    @SerialName("zona_lat") val zonaLat: Double? = null,
    @SerialName("zona_lng") val zonaLng: Double? = null,
) {
    val pendiente get() = estado == "pendiente" || estado == "en_ruta"
    /** Con punto para navegar. Una en «zona» nunca, aunque un servidor le pusiera lat/lng: sería el centro del CP. */
    val ubicada get() = lat != null && lng != null && geo != "zona"
    val porCobrar get() = (cobrar ?: 0.0) > 0.0
    val cargada get() = !cargadoEn.isNullOrBlank()
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
    /** El orden lo puso el repartidor a mano («A mano» en la web). */
    val manual: Boolean? = null,
    /** Por dónde se carga la furgoneta (01-11-2026): «traseras» o «lateral»; decide qué fila es la de la puerta. */
    @SerialName("carga_por") val cargaPor: String? = null,
)

@Serializable
data class Base(val direccion: String? = null, val lat: Double? = null, val lng: Double? = null)

@Serializable
data class Antes(val fecha: String = "", val estado: String = "", val nota: String = "", val donde: String = "", val motivo: String = "")

/** LA ENTREGA VERIFICADA (01-11-2026): lo que dijo la IA de la foto de entrega. `nivel`: verificada, parcial, revisar o
 *  pendiente; `aviso`, un código (personas, sin_paquete, otro_numero, sin_numero) que la app convierte en frase. */
@Serializable
data class EntregaIa(val nivel: String = "", val aviso: String? = null, val numero: String? = null, val portal: String? = null, val lugar: String? = null)

/** EL CLIENTE TE AYUDA ANTES DE LLEGAR (30-10-2026): lo que contestó en su enlace. Mismas claves que el servidor. */
@Serializable
data class ClienteDice(val estare: String = "", val dejar: String = "", val franja: List<String>? = null, val portal: String = "", val nota: String = "")

/** LA MEMORIA DE LA CALLE (01-11-2026): el código del portal, dónde dejar (una de DONDE) y cómo se entra; quién lo apuntó. */
@Serializable
data class Memoria(val portal: String = "", val dejar: String = "", val acceso: String = "", val por: String = "", val actualizado: String? = null)

@Serializable
data class Valoracion(val estrellas: Int = 0, val cuando: String? = null)

/* LO QUE DICE LA DGT CERCA DE LA RUTA (30-10-2026): cortes, obras, accidentes y retenciones (GET /reparto/mi-ruta/incidencias)
   y las zonas de bajas emisiones con sus polígonos y qué paradas caen dentro (GET /reparto/mi-ruta/zbe). */
@Serializable
data class Incidencia(
    val id: String = "", val clase: String = "", val que: String = "", val gravedad: String = "", val carretera: String = "",
    val pk: String = "", val municipio: String = "", val lat: Double, val lng: Double, val lat2: Double? = null, val lng2: Double? = null,
    @SerialName("distancia_km") val distanciaKm: Double? = null, val parada: Int? = null,
    /** Lo que escribe el gestor de la vía, en su idioma (Bison Futé, NDW, WZDx); la DGT no lo trae. */
    val texto: String = "",
)

@Serializable
data class Incidencias(
    val incidencias: List<Incidencia> = emptyList(), val publicado: String = "", val incompleto: Boolean = false,
    /** La fuente de ese país (DGT, Bison Futé, NDW, WZDx…), o nada si no hay (30-10-2026); `aplica` dice si hay fuente. */
    val fuente: String? = null, val aplica: Boolean = true,
    /** Las restricciones por placa de la ciudad de la ruta (rodízio, Hoy No Circula, pico y placa…). */
    val avisos: List<AvisoPlaca> = emptyList(),
)

/** Una restricción por placa para hoy: `hoy` true si la placa de Ajustes no puede circular, false si puede, null si no se sabe. */
@Serializable
data class AvisoPlaca(val ciudad: String = "", val titulo: String = "", val texto: String = "", val url: String = "", val hoy: Boolean? = null,
                 val digitos: List<String> = emptyList())

@Serializable
data class ZonaZbe(
    val id: String = "", val ciudad: String = "", val nombre: String = "", val descripcion: String = "", val estado: String = "",
    val url: String = "", val version: String = "", val etiquetas: List<String> = emptyList(),
    val poligonos: List<List<List<Double>>> = emptyList(),
    /** ZBE, ZFE, ULEZ, LEZ, ZES, Umweltzone, ZTL… y de dónde sale (dgt, bnzfe, ndw, gla, osm). */
    val tipo: String = "ZBE", val fuente: String = "",
)

@Serializable
data class ZonaParada(val id: String = "", val nombre: String = "", val tipo: String = "ZBE")

@Serializable
data class Zbe(val zonas: List<ZonaZbe> = emptyList(), val paradas: Map<String, ZonaParada> = emptyMap(), val incompleto: Boolean = false,
               val fuente: String? = null, val aplica: Boolean = true, val tipo: String = "ZBE")

/** DÓNDE APARQUÉ (30-10-2026): el punto de la furgoneta al bajarse; vive solo en el móvil. */
@Serializable
data class Furgo(val lat: Double, val lng: Double, val en: Long)

/** El bono de bienvenida de quien reparte por su cuenta: `objetivo` entregas en `diasObjetivo` días antes de `limite`. */
@Serializable
data class Bono(
    val cent: Int = 0,
    val pagado: Boolean = false,
    val nuevo: Boolean = false,
    val limite: String? = null,
    val objetivo: Int = 20,
    @SerialName("dias_objetivo") val diasObjetivo: Int = 2,
    val entregas: Int = 0,
    val dias: Int = 0,
    val revisar: Boolean = false,
)

/** La tarifa de quien reparte por su cuenta, en céntimos: por parada entregada y por día con entregas. */
@Serializable
data class Ganancias(
    @SerialName("pago_parada") val pagoParada: Int = 0,
    @SerialName("pago_dia") val pagoDia: Int = 0,
    @SerialName("coste_km") val costeKm: Int = 0,
    /** LA PROPINA (01-11-2026): el móvil de Bizum, que el cliente ve en su enlace cuando ya tiene el paquete. */
    val bizum: String = "",
)

/** La versión de la app que hay para descargar de la web (GET /app/version → `web`), para la instalada fuera de Play. */
@Serializable
data class VersionApp(val code: Int = 0, val nombre: String = "")

/** Lo que anuncia el servidor (GET /app/version): la versión que hay en la web, la publicada en Play y la mínima que exige. */
@Serializable
data class VersionesApp(val web: VersionApp? = null, val play: VersionApp? = null, val min: String? = null)

@Serializable
data class Trazado(val linea: List<List<Double>> = emptyList(), val fuente: String? = null, val km: Double? = null, val minutos: Int? = null)

/* LA GUÍA DENTRO DE LA APP (01-11-2026): lo que contesta POST /reparto/mi-ruta/navegar para UNA parada: el camino por
   las calles ([[lat, lng], …]), los metros y minutos, y cada maniobra con su punto sobre la línea y la maniobra en
   bruto de OSRM (tipo, modificador, salida), que la app escribe en su idioma (Navegador.textoPaso). `fuente`
   «carreteras» o «linea_recta» (sin servidor de rutas: un solo paso, «Ve hacia la parada»). */
@Serializable
data class Guia(val fuente: String = "", val linea: List<List<Double>> = emptyList(), val metros: Int = 0, val minutos: Double? = null,
                val pasos: List<PasoGuia> = emptyList())

@Serializable
data class PasoGuia(val texto: String = "", val icono: String = "", val punto: List<Double> = emptyList(), val calle: String = "",
                    val metros: Int = 0, val maniobra: ManiobraGuia? = null)

@Serializable
data class ManiobraGuia(val tipo: String = "", val mod: String? = null, val salida: Int? = null)

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
    val bono: Bono? = null,
    /** Paradas de los últimos días sin cerrar, que se pueden traer a hoy. */
    val previas: Int = 0,
    val ganancias: Ganancias? = null,
)

@Serializable
data class Escaneo(val encontrado: Boolean = false, val codigo: String = "", val pedido: Parada? = null,
                   /** En modo carga (01-11-2026): cuántas paradas van ya en la furgoneta, de cuántas. */
                   val cargados: Int? = null, val total: Int? = null)

/** POST /reparto/mi-ruta/cargado (01-11-2026): marcar a mano una parada como cargada, o quitarle la marca. */
@Serializable
data class Cargados(val ok: Boolean = true, val cargados: Int = 0, val total: Int = 0)

/** «COMPARTIR CON FDS» (01-11-2026): lo que contesta /reparto/pegar: las filas que ve (sin confirmar) o lo creado. */
@Serializable
data class FilaPegada(val codigo: String = "", val cliente: String = "", val direccion: String = "", val telefono: String = "")

@Serializable
data class Pegado(val filas: List<FilaPegada> = emptyList(), val n: Int = 0, val creados: Int = 0, val repetidos: Int = 0,
                  @SerialName("sin_hueco") val sinHueco: Int = 0)

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
    /** LAS SUYAS CON SU PRECISIÓN (03-11-2026): «calle» si la última vez quedó en la calle sin el portal (geo «aprox»),
     *  «portal» si en la puerta. Un servidor de antes no lo manda (""): «portal», como hasta ahora (Situar.alElegir). */
    val precision: String = "",
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
    /** La vara del premio (02-11-2026): entregas reales en días distintos; el servidor las manda con /referidos. */
    @SerialName("entregas_cartera") val entregasCartera: Int = 20,
    @SerialName("dias_distintos") val diasDistintos: Int = 2,
    /** Solo mientras dura la promoción (el servidor no lo manda después): el invitado también gana su bono. */
    @SerialName("promo_hasta") val promoHasta: String? = null,
    val bono: Bono? = null,
)

/** LA INVITACIÓN TRAS LA PRIMERA ENTREGA (02-11-2026): lo que hace falta para el mensaje de «Invita y gana» desde
 *  Hoy: el código del enlace (y la vara del premio) y hasta cuándo es gratis el plan (/billing/planes). */
data class Invitacion(val referidos: Referidos, val gratisHasta: String? = null)

/** EL PRIMER PAQUETE BIEN SITUADO (02-11-2026): un sitio que propone POST /reparto/ubicar para una dirección.
 *  `precision`: «portal», «calle» o «zona» (solo el CP o el pueblo). */
@Serializable
data class CandidatoUbicar(val lat: Double? = null, val lng: Double? = null, val precision: String? = null, val direccion: String? = null)

/** Lo que contesta POST /reparto/ubicar (no guarda nada): dónde cae la dirección, con qué precisión, los candidatos
 *  (el mejor primero, como mucho 6) y de dónde salen los datos, que hay que enseñar (CartoCiudad es CC BY 4.0). */
@Serializable
data class Ubicado(
    val encontrada: Boolean = false, val lat: Double? = null, val lng: Double? = null, val precision: String? = null,
    val direccion: String? = null, val candidatos: List<CandidatoUbicar> = emptyList(), val atribucion: String? = null,
)

/* Los ajustes se guardan ENTEROS (PUT /reparto/ajustes sustituye todo): se guarda el objeto tal cual vino. */
typealias Ajustes = JsonObject
