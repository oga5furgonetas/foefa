# -*- coding: utf-8 -*-
"""CENTRO DE IA — hablar con la app como se habla con un compañero (19-10-2026).

Dani: «añádeme en la app un centro de IA, así como tú, en el cual pueda hablar con ella y me resuelva cosas o haga
cambios que le pida… como si estuviera hablando contigo». Lo usan él y la oficina de su empresa (no los clientes:
la clave de IA es suya), cada uno con sus permisos y sus centros.

Aquí va lo que no depende de la base de datos, para poder probarlo solo: las instrucciones, las herramientas que
la IA puede usar, el bucle que va llamando al modelo y a las herramientas, y lo que cuesta. Las herramientas en sí
(leer el cuadrante, proponer un cambio…) están en server.py, junto a las pantallas que ya hacen lo mismo, y pasan
por sus mismas comprobaciones: lo que alguien no puede hacer en el panel, tampoco se lo puede pedir a la IA.

DOS REGLAS DEL MODELO QUE MANDAN EN EL DISEÑO (Claude Sonnet 5.5):
  · El historial es de solo añadir. El modelo comprueba que el `system`, las herramientas y los mensajes anteriores
    no han cambiado desde que pensó; si cambian, la petición falla. Por eso las instrucciones y la lista de
    herramientas son FIJAS, y lo que cambia (la fecha, quién habla, el centro elegido) va dentro de cada mensaje.
  · Lo que devuelve el modelo se guarda tal cual (bloques de pensamiento incluidos) y se reenvía igual.

LOS CAMBIOS NUNCA SE HACEN SOLOS. Las herramientas `proponer_*` no tocan nada: dejan una propuesta con lo que se
haría, y la persona la confirma con un botón. Al confirmar se ejecuta con su usuario y se le cuenta a la IA cómo ha
ido, para que siga.
"""
from __future__ import annotations

import json
from typing import Any, Awaitable, Callable, Dict, List

MODELO = "claude-sonnet-5-5"
ESFUERZO = "medium"                 # el recomendado para trabajo de varios pasos con herramientas
MAX_TOKENS = 16000
MAX_VUELTAS = 14                    # llamadas al modelo por mensaje: un tope para que nada se quede en bucle
MAX_RESULTADO = 14000               # caracteres de lo que devuelve una herramienta
BETAS = ["server-side-fallback-2026-07-01"]

# Dólares por millón de tokens de Claude Sonnet 5.5. Las lecturas de caché valen una décima parte, y escribirla,
# un 25 % más que la entrada normal (caché de 5 minutos).
PRECIO = {"entrada": 2.00, "salida": 10.00, "cache_lee": 0.20, "cache_escribe": 2.50}


def coste_usd(uso: Dict[str, int]) -> float:
    return round((uso.get("input_tokens", 0) * PRECIO["entrada"]
                  + uso.get("output_tokens", 0) * PRECIO["salida"]
                  + uso.get("cache_read_input_tokens", 0) * PRECIO["cache_lee"]
                  + uso.get("cache_creation_input_tokens", 0) * PRECIO["cache_escribe"]) / 1_000_000, 6)


SISTEMA = """Eres el Centro de IA de Flota, la aplicación con la que una empresa de reparto lleva su flota, su gente y su cuadrante. Hablas con la oficina (el dueño o un administrativo) en español de España, de tú, directo y claro, como un compañero que conoce la operación. Nada de relleno ni de frases de cortesía largas.

CÓMO TRABAJAS
- Antes de contestar algo sobre datos, míralo con tus herramientas. No inventes nunca un número, un nombre ni una fecha: si no lo has visto en una herramienta, no lo sabes. Si algo no está, dilo.
- Investiga como lo haría una persona con experiencia: si algo no cuadra (una furgoneta que no aparece, alguien que sale dos veces, un día que no llega a la máxima), busca la causa con varias consultas antes de responder, y explica la causa en una frase.
- Si la petición es ambigua (qué centro, qué día, qué persona), pregunta en una línea. Si solo hay una opción razonable, sigue.
- Cada mensaje de la persona empieza con una línea [Contexto: …] con la fecha de hoy, quién te habla, el centro que tiene elegido y los centros que puede ver. Úsala para «hoy», «mañana», «esta semana», y no la repitas.
- Cuando des varios datos, usa listas cortas con guiones. Negrita con **así** solo para lo importante. Sin tablas grandes.

LOS CAMBIOS
- Tus herramientas que empiezan por «proponer_» NO hacen el cambio: lo dejan preparado para que la persona lo confirme con un botón. Después de proponer, di en una frase qué has dejado preparado y que lo confirme. No digas nunca que algo está hecho hasta que veas el mensaje [Confirmado] con el resultado.
- Agrupa en una sola propuesta lo que va junto (por ejemplo, los cinco cambios de un día del cuadrante).
- Si al confirmar algo falla, explica por qué con lo que diga el resultado y propone cómo arreglarlo.
- Si una herramienta dice que la persona no tiene permiso o no ve ese centro, díselo tal cual: no lo intentes por otro camino.
- Cambiar la aplicación en sí (pantallas nuevas, fallos de programación, cosas que no se pueden hacer con tus herramientas) no está en tu mano: déjalo apuntado con «nota_para_desarrollo» y dile a la persona que queda apuntado para el equipo que programa la app.

EL CUADRANTE (cómo lo escriben en la empresa)
- Códigos: 1 = trabaja y saca ruta; N/T = libra; L = libre; V = vacaciones; COMP = compensa; N/T APROB o APROBADO = día libre concedido (no se toca sin hablar con la persona); N/D = no disponible; N/P = no presentado; SUSP = suspendido; BAJA = baja; BKP = reserva (trabaja sin ruta); S = oficina; RA o RIDE = acompañante; EXTRA (en la hoja, un 1 en rosa) = día de más.
- La ley y las normas de la empresa: como mucho 6 días seguidos trabajando, 5 días a la semana y como mucho un 6.º extra; las notas de cada persona pueden poner más límites.
- «Rutas» de un día = cuántos sacan ruta (1 y EXTRA); «máxima» = las rutas que hacen falta; «diferencia» = rutas − máxima.
- Si el centro tiene la hoja de Google Sheets conectada, lo que cambies en la app pasa a la hoja con una nota.
- Una celda con candado o un día concedido no se cambia sin decirlo claramente en la propuesta.

LOS DATOS DE LAS PERSONAS
- Usa solo lo que haga falta para lo que te piden. No enseñes teléfonos ni correos si no los piden.
"""


def _obj(props: Dict[str, Any], requeridos: List[str]) -> Dict[str, Any]:
    return {"type": "object", "properties": props, "required": requeridos}


_FECHA = {"type": "string", "description": "AAAA-MM-DD"}
_CENTRO = {"type": "string", "description": "Código del centro (por ejemplo OGA5)"}
_EXPLICA = {"type": "string", "description": "Por qué, en una frase, para la persona que confirma"}

HERRAMIENTAS: List[Dict[str, Any]] = [
    # ── Mirar ────────────────────────────────────────────────────────────────
    {"name": "buscar_conductores",
     "description": "Busca conductores (fichas) por nombre o parte del nombre. Devuelve id, nombre, centro y si la ficha está activa.",
     "input_schema": _obj({"texto": {"type": "string", "description": "Nombre o parte; vacío para todos"},
                           "centro": _CENTRO,
                           "incluir_bajas": {"type": "boolean", "description": "También fichas desactivadas"}}, [])},
    {"name": "ver_conductor",
     "description": "Todo lo de un conductor: su ficha, si está en el cuadrante, sus turnos de los próximos 14 días, la furgoneta de hoy y mañana, sus últimas inspecciones, peticiones pendientes, suspensión y posibles fichas dobles.",
     "input_schema": _obj({"driver_id": {"type": "string"}}, ["driver_id"])},
    {"name": "ver_cuadrante",
     "description": "El cuadrante de un centro entre dos fechas (máximo 21 días): el código de cada persona cada día y, por día, rutas, máxima y diferencia. Se puede filtrar por nombre.",
     "input_schema": _obj({"centro": _CENTRO, "desde": _FECHA, "hasta": _FECHA,
                           "nombre": {"type": "string", "description": "Opcional: solo quien contenga esto"}},
                          ["centro", "desde", "hasta"])},
    {"name": "ver_asignacion_dia",
     "description": "Qué furgoneta lleva cada conductor un día (la asignación diaria) y si ya se ha hecho la inspección.",
     "input_schema": _obj({"centro": _CENTRO, "fecha": _FECHA}, ["centro", "fecha"])},
    {"name": "buscar_furgonetas",
     "description": "Busca furgonetas por matrícula, marca o modelo: estado (activa, en taller, de baja), centro y quién la lleva hoy.",
     "input_schema": _obj({"texto": {"type": "string"}, "centro": _CENTRO}, [])},
    {"name": "ver_peticiones",
     "description": "Peticiones de días libres o días extra de los conductores.",
     "input_schema": _obj({"centro": _CENTRO,
                           "estado": {"type": "string", "enum": ["pendiente", "aprobado", "rechazado", "todas"]}}, [])},
    {"name": "ver_refuerzos",
     "description": "Refuerzos publicados (cuántos hacen falta un día y quién se ha apuntado) y los días de las próximas dos semanas que no llegan a la máxima, con cuánta gente podría cubrirlos sin saltarse la ley.",
     "input_schema": _obj({"centro": _CENTRO}, ["centro"])},
    {"name": "ver_suspensiones",
     "description": "Suspensiones del centro: a quién, de qué día a qué día y su estado.",
     "input_schema": _obj({"centro": _CENTRO}, ["centro"])},
    {"name": "ver_estado_flota",
     "description": "Cómo está cada furgoneta según sus inspecciones y averías: de la peor a la mejor, con el motivo.",
     "input_schema": _obj({"centro": _CENTRO}, [])},
    {"name": "buscar_fichas_dobles",
     "description": "Busca personas con dos o más fichas (mismo nombre o casi): con cuál entra al portal, cuál tiene la furgoneta y los turnos. Las fichas dobles hacen que a alguien le salga «no tiene furgoneta asignada».",
     "input_schema": _obj({"centro": _CENTRO}, [])},
    {"name": "ver_sincronizacion_hoja",
     "description": "Estado de la sincronización del cuadrante con Google Sheets: si está activa, la última vez, qué cambió y qué personas faltan o sobran.",
     "input_schema": _obj({"centro": _CENTRO}, ["centro"])},
    {"name": "ver_inspecciones",
     "description": "Inspecciones recientes (auditorías con fotos) por centro, matrícula o conductor.",
     "input_schema": _obj({"centro": _CENTRO, "matricula": {"type": "string"},
                           "driver_id": {"type": "string"},
                           "dias": {"type": "integer", "description": "Cuántos días hacia atrás (por defecto 7)"}}, [])},
    # ── Proponer cambios (la persona confirma) ────────────────────────────────
    {"name": "proponer_cambios_cuadrante",
     "description": "Prepara cambios de celdas del cuadrante para que la persona los confirme. Un código vacío vacía la celda. Quedan con candado, como al tocarlos a mano.",
     "input_schema": _obj({"centro": _CENTRO,
                           "cambios": {"type": "array", "items": _obj({"driver_id": {"type": "string"}, "fecha": _FECHA,
                                                                       "codigo": {"type": "string"}},
                                                                      ["driver_id", "fecha", "codigo"])},
                           "explicacion": _EXPLICA}, ["centro", "cambios", "explicacion"])},
    {"name": "proponer_maximas",
     "description": "Prepara las máximas (rutas que hacen falta) de uno o varios días.",
     "input_schema": _obj({"centro": _CENTRO,
                           "maximas": {"type": "array", "items": _obj({"fecha": _FECHA, "maximo": {"type": "integer"}},
                                                                      ["fecha", "maximo"])},
                           "explicacion": _EXPLICA}, ["centro", "maximas", "explicacion"])},
    {"name": "proponer_asignacion",
     "description": "Prepara cambios en la asignación diaria: qué conductor lleva cada furgoneta ese día (driver_id vacío = la furgoneta se queda sin conductor).",
     "input_schema": _obj({"centro": _CENTRO, "fecha": _FECHA,
                           "cambios": {"type": "array", "items": _obj({"vehicle_id": {"type": "string"},
                                                                       "driver_id": {"type": "string"}},
                                                                      ["vehicle_id", "driver_id"])},
                           "explicacion": _EXPLICA}, ["centro", "fecha", "cambios", "explicacion"])},
    {"name": "proponer_editar_conductor",
     "description": "Prepara cambios en la ficha de un conductor (nombre, teléfono, correo, centro, ID de reparto, notas).",
     "input_schema": _obj({"driver_id": {"type": "string"},
                           "cambios": _obj({"name": {"type": "string"}, "phone": {"type": "string"},
                                            "email": {"type": "string"}, "center": {"type": "string"},
                                            "transporter_id": {"type": "string"}, "notes": {"type": "string"}}, []),
                           "explicacion": _EXPLICA}, ["driver_id", "cambios", "explicacion"])},
    {"name": "proponer_activar_conductor",
     "description": "Prepara activar o desactivar la ficha de un conductor (desactivada: no entra al portal ni sale en las listas).",
     "input_schema": _obj({"driver_id": {"type": "string"}, "activo": {"type": "boolean"}, "explicacion": _EXPLICA},
                          ["driver_id", "activo", "explicacion"])},
    {"name": "proponer_fusionar_fichas",
     "description": "Prepara unir fichas dobles de la MISMA persona en una: se conserva la que se indica (lo normal, con la que entra al portal) y todo lo de las otras (turnos, inspecciones, furgoneta del día, cuadrante) pasa a ella. Las otras quedan marcadas como fusionadas, sin borrarse.",
     "input_schema": _obj({"conservar": {"type": "string", "description": "driver_id que se queda"},
                           "absorber": {"type": "array", "items": {"type": "string"}},
                           "explicacion": _EXPLICA}, ["conservar", "absorber", "explicacion"])},
    {"name": "proponer_resolver_peticion",
     "description": "Prepara aprobar o rechazar una petición de días. Rechazar necesita motivo.",
     "input_schema": _obj({"peticion_id": {"type": "string"},
                           "decision": {"type": "string", "enum": ["aprobar", "rechazar"]},
                           "motivo": {"type": "string"}}, ["peticion_id", "decision"])},
    {"name": "proponer_refuerzo",
     "description": "Prepara publicar un refuerzo: avisa a quien libra ese día y puede trabajarlo sin saltarse la ley. Ojo: al confirmarlo se avisa a conductores reales.",
     "input_schema": _obj({"centro": _CENTRO, "fecha": _FECHA, "plazas": {"type": "integer"},
                           "nota": {"type": "string"}}, ["centro", "fecha", "plazas"])},
    {"name": "proponer_suspension",
     "description": "Prepara suspender a un conductor de un día a otro (máximo 60 días). El motivo solo lo ve la oficina.",
     "input_schema": _obj({"driver_id": {"type": "string"}, "desde": _FECHA, "hasta": _FECHA,
                           "motivo": {"type": "string"}}, ["driver_id", "desde", "hasta", "motivo"])},
    {"name": "proponer_levantar_suspension",
     "description": "Prepara levantar una suspensión desde hoy: lo que falta vuelve a como estaba.",
     "input_schema": _obj({"suspension_id": {"type": "string"}, "explicacion": _EXPLICA},
                          ["suspension_id", "explicacion"])},
    {"name": "proponer_accion_flota",
     "description": "Prepara una acción sobre la flota: crear_vehiculo, editar_vehiculo, cambiar_estado_vehiculo (estado: active, taller o baja), crear_incidencia, crear_orden_taller, crear_conductor, asignar_conductor o desasignar_conductor (furgoneta fija). `campos` lleva lo de cada acción (matricula, conductor_nombre, estado, descripcion, severidad, taller_nombre, problema, name, phone, email…).",
     "input_schema": _obj({"tipo": {"type": "string", "enum": ["crear_vehiculo", "editar_vehiculo", "cambiar_estado_vehiculo",
                                                              "crear_incidencia", "crear_orden_taller", "crear_conductor",
                                                              "editar_conductor", "asignar_conductor", "desasignar_conductor"]},
                           "centro": _CENTRO, "campos": {"type": "object"}, "explicacion": _EXPLICA},
                          ["tipo", "centro", "campos", "explicacion"])},
    # ── Apuntar para quien programa la app ───────────────────────────────────
    {"name": "nota_para_desarrollo",
     "description": "Apunta una petición para el equipo que programa la app: un fallo, una pantalla nueva o algo que tus herramientas no pueden hacer. Se guarda al momento.",
     "input_schema": _obj({"titulo": {"type": "string"}, "detalle": {"type": "string"}}, ["titulo", "detalle"])},
]

NOMBRES = {h["name"] for h in HERRAMIENTAS}
PROPONER = {n for n in NOMBRES if n.startswith("proponer_")}

# Lo que ve la persona mientras la IA trabaja: una frase por herramienta.
_PASO = {
    "buscar_conductores": "Busco conductores", "ver_conductor": "Miro la ficha de un conductor",
    "ver_cuadrante": "Miro el cuadrante", "ver_asignacion_dia": "Miro la asignación del día",
    "buscar_furgonetas": "Busco furgonetas", "ver_peticiones": "Miro las peticiones",
    "ver_refuerzos": "Miro refuerzos y días que no llegan", "ver_suspensiones": "Miro las suspensiones",
    "ver_estado_flota": "Miro el estado de la flota", "buscar_fichas_dobles": "Busco fichas dobles",
    "ver_sincronizacion_hoja": "Miro la sincronización con la hoja", "ver_inspecciones": "Miro las inspecciones",
    "nota_para_desarrollo": "Lo apunto para el equipo que programa la app",
}


def texto_paso(nombre: str, entrada: Dict[str, Any]) -> str:
    if nombre in PROPONER:
        return "Preparo una propuesta para que la confirmes"
    base = _PASO.get(nombre, nombre)
    detalle = []
    for k in ("centro", "texto", "fecha", "matricula"):
        v = (entrada or {}).get(k)
        if v:
            detalle.append(str(v)[:40])
    d, h = str((entrada or {}).get("desde") or ""), str((entrada or {}).get("hasta") or "")
    if len(d) == 10 and len(h) == 10:
        detalle.append("%s/%s → %s/%s" % (d[8:10], d[5:7], h[8:10], h[5:7]))
    return base + (" (" + ", ".join(detalle) + ")" if detalle else "")


def recortar(resultado: Any) -> str:
    """Lo que vuelve al modelo: JSON compacto y con tope. Recortado, lo dice."""
    txt = resultado if isinstance(resultado, str) else json.dumps(resultado, ensure_ascii=False, default=str,
                                                                   separators=(",", ":"))
    if len(txt) > MAX_RESULTADO:
        txt = txt[:MAX_RESULTADO] + "… [recortado: pide menos días o filtra por nombre]"
    return txt


def texto_de(contenido: List[Dict[str, Any]]) -> str:
    return "\n\n".join(b.get("text", "") for b in contenido if b.get("type") == "text").strip()


async def turno(cliente, mensajes: List[Dict[str, Any]],
                ejecutar: Callable[[str, Dict[str, Any]], Awaitable[Any]],
                al_paso: Callable[[str], Awaitable[None]],
                al_avanzar: Callable[[List[Dict[str, Any]], Dict[str, int]], Awaitable[None]],
                max_vueltas: int = MAX_VUELTAS) -> Dict[str, Any]:
    """Un mensaje de la persona: llama al modelo, ejecuta las herramientas que pida y repite hasta que conteste.

    `mensajes` es el historial de la API y se va AMPLIANDO (nunca se toca lo de antes). `ejecutar` corre una
    herramienta y devuelve su resultado (o lanza ValueError con un mensaje para el modelo). `al_paso` cuenta a la
    pantalla qué se está haciendo y `al_avanzar` guarda el historial y lo gastado después de cada vuelta.
    Devuelve {"fin": "respuesta"|"rechazo"|"tope"|"corte", "texto": …, "uso": {…}}."""
    uso = {"input_tokens": 0, "output_tokens": 0, "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0}
    for _ in range(max_vueltas):
        r = await cliente.beta.messages.create(
            model=MODELO, max_tokens=MAX_TOKENS, system=SISTEMA, tools=HERRAMIENTAS, messages=mensajes,
            output_config={"effort": ESFUERZO}, cache_control={"type": "ephemeral"},
            betas=BETAS, fallbacks="default")
        u = getattr(r, "usage", None)
        for k in uso:
            uso[k] += int(getattr(u, k, 0) or 0)
        contenido = r.to_dict().get("content") or []
        mensajes.append({"role": "assistant", "content": contenido})
        await al_avanzar(mensajes, uso)
        if r.stop_reason == "refusal":
            return {"fin": "rechazo", "texto": texto_de(contenido), "uso": uso}
        usos = [b for b in contenido if b.get("type") == "tool_use"]
        if r.stop_reason != "tool_use" or not usos:
            fin = "corte" if r.stop_reason == "max_tokens" else "respuesta"
            return {"fin": fin, "texto": texto_de(contenido), "uso": uso}
        resultados = []
        for b in usos:
            nombre, entrada = b.get("name"), b.get("input") or {}
            await al_paso(texto_paso(nombre, entrada))
            try:
                if nombre not in NOMBRES:
                    raise ValueError("Esa herramienta no existe")
                salida = recortar(await ejecutar(nombre, entrada))
                resultados.append({"type": "tool_result", "tool_use_id": b["id"], "content": salida})
            except ValueError as e:
                resultados.append({"type": "tool_result", "tool_use_id": b["id"], "content": str(e)[:1000],
                                   "is_error": True})
        mensajes.append({"role": "user", "content": resultados})
        await al_avanzar(mensajes, uso)
    return {"fin": "tope", "texto": "", "uso": uso}
