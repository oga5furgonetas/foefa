# -*- coding: utf-8 -*-
"""Envio de WhatsApp por la Cloud API de Meta, sin intermediarios.

POR QUE DIRECTO Y NO POR UN PROVEEDOR. Meta cobra por PLANTILLA enviada fuera de
una conversacion abierta; las de tipo "utility" —que es todo lo nuestro: ITV
vencida, incidencia grave, resumen del dia— salen a 0,015-0,02 EUR en Espana y
son gratis si la persona ha escrito en las ultimas 24 h. No hay cuota fija. Un
proveedor de bandeja anadiria su mensualidad ENCIMA de eso y un intermediario
mas que depurar, y solo compensaria si hiciera falta una bandeja compartida para
contestar a mano. Ya hace falta (19-09-2026) y se hizo en casa: la pantalla de
Conversaciones junta lo que llega por el webhook (`whatsapp_mensajes`) con lo que
se manda (`whatsapp_envios`) y contesta con `enviar_texto`.

LAS CREDENCIALES VIVEN EN EL ENTORNO, NUNCA EN LA BASE NI EN EL CODIGO. Se
ponen con `fly secrets set` sobre `flotadsp-backend`:

    WHATSAPP_ACCESS_TOKEN        token permanente de system user
    WHATSAPP_PHONE_NUMBER_ID     id del numero emisor
    WHATSAPP_BUSINESS_ACCOUNT_ID cuenta de WhatsApp Business (para las plantillas)
    WHATSAPP_VERIFY_TOKEN        cadena que elegimos nosotros, para el webhook

Lo que SI vive en la base es el interruptor de cada aviso (`whatsapp_config`),
igual que con Telegram: eso lo cambia la oficina desde el panel y no es secreto.

TODO ENVIO SE APUNTA en `whatsapp_envios`, salga bien o mal. Un canal de avisos
que falla en silencio es peor que no tenerlo: se da por hecho que la gente esta
avisada cuando no lo esta. Hoy mismo se perdio un dia entero de datos de Cortex
por un fallo silencioso, y no se repite aqui.
"""
import logging
import os
import re
from datetime import datetime, timedelta, timezone

import aiohttp

logger = logging.getLogger(__name__)

API = "https://graph.facebook.com/v21.0"
COLECCION_ENVIOS = "whatsapp_envios"
# Lo que ESCRIBEN las personas. Lo que se les manda va en `whatsapp_envios`; el
# hilo de Conversaciones junta las dos.
COLECCION_MENSAJES = "whatsapp_mensajes"
COLECCION_CONFIG = "whatsapp_config"

# Prefijo por defecto para los numeros que se guardaron sin el. Toda la
# plantilla esta en Espana; si algun dia hay otro pais, el numero tendra que
# venir ya con su prefijo y este valor no lo tocara.
PREFIJO_POR_DEFECTO = os.environ.get("WHATSAPP_PREFIJO_PAIS", "34")


def configurado() -> bool:
    """Si estan las tres credenciales que hacen falta para enviar."""
    return bool(os.environ.get("WHATSAPP_ACCESS_TOKEN")
                and os.environ.get("WHATSAPP_PHONE_NUMBER_ID"))


def estado() -> dict:
    """Que hay puesto y que falta. Sin devolver NUNCA el token."""
    faltan = [k for k in ("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID",
                          "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_VERIFY_TOKEN")
              if not os.environ.get(k)]
    return {
        "configurado": configurado(),
        "faltan": faltan,
        "phone_number_id": os.environ.get("WHATSAPP_PHONE_NUMBER_ID") or None,
        "business_account_id": os.environ.get("WHATSAPP_BUSINESS_ACCOUNT_ID") or None,
    }


def normaliza_telefono(tel) -> str:
    """A E.164 sin el '+', que es como lo quiere la Cloud API.

    Los telefonos estan escritos a mano y llegan de seis maneras: '639448263',
    '+34 639 44 82 63', '0034639448263'. Un numero mal montado no da error al
    enviar: Meta responde 200 y el mensaje no llega a nadie, que es el peor de
    los dos fallos posibles. Devuelve '' si no se puede montar, y entonces no
    se envia.
    """
    s = re.sub(r"[^0-9+]", "", str(tel or ""))
    if not s:
        return ""
    if s.startswith("00"):
        s = "+" + s[2:]
    if s.startswith("+"):
        s = s[1:]
    elif len(s) == 9:
        # Nueve digitos y sin prefijo: es un movil espanol.
        s = PREFIJO_POR_DEFECTO + s
    return s if 9 <= len(s) <= 15 and s.isdigit() else ""


async def _apunta(db, doc: dict):
    try:
        ahora = datetime.now(timezone.utc)
        doc["at"] = ahora.isoformat()
        # 90 dias y caduca solo: es un registro de operacion, no un historico, y
        # una coleccion de avisos sin techo crece hasta que alguien la descubre.
        # Va como datetime y no como texto: el indice TTL de Mongo solo entiende
        # fechas (el mismo detalle que ya mordio en `cortex_packages`).
        doc["expira_en"] = ahora + timedelta(days=90)
        # UNA COPIA, no el propio dict. `insert_one` le mete dentro el `_id` que
        # acaba de generar, y este mismo dict es el que se devuelve al que llamó
        # — FastAPI no sabe serializar un ObjectId y la respuesta entera se
        # convierte en un 500. La prueba desde el panel fallaba exactamente asi:
        # el mensaje se apuntaba bien y el error llegaba al final, donde parece
        # que lo roto es el envio.
        await db[COLECCION_ENVIOS].insert_one(dict(doc))
    except Exception as e:                                   # noqa: BLE001
        logger.debug("whatsapp: no se pudo apuntar el envio: %s", e)


# QUE HACER CON CADA ERROR DE META, en cristiano.
#
# Medido en produccion el 19-09-2026: de 45 envios, 41 fallaron y NINGUNO por
# el texto del mensaje. 21 eran permisos de la cuenta, 9 el numero fuera de la
# lista de pruebas y 9 una plantilla sin aprobar. El codigo de Meta es exacto
# pero no dice que hacer: en pantalla quedaba «(#132001) Template name does not
# exist in the translation», que no se parece en nada a «Meta todavia esta
# revisando esa plantilla».
QUE_HACER = {
    132001: ("Esa plantilla no esta aprobada todavia en Meta (o no existe en "
             "este idioma). En cuanto la aprueben, sale sola."),
    131030: ("Ese numero no esta en la lista de prueba de Meta. Mientras la "
             "cuenta este en pruebas solo salen los numeros dados de alta ahi."),
    200: ("El token no tiene permiso sobre esta cuenta de WhatsApp. Hay que "
          "generarlo de nuevo con los permisos de la cuenta de la empresa."),
    133010: "El numero de la empresa no esta registrado todavia en WhatsApp Business.",
    131047: ("Han pasado mas de 24 h desde el ultimo mensaje de esa persona: "
             "solo se le puede escribir con una plantilla aprobada."),
}


# QUE DICE META DE SI PODEMOS ENVIAR, EN CRISTIANO.
#
# `can_send_message` no es un si/no nuestro: es el veredicto de Meta sobre toda
# la cadena —numero, cuenta, negocio y app— y cada eslabon trae su codigo y su
# solucion. Es la unica fuente que dice POR QUE no sale un aviso; el motivo que
# viaja con el mensaje fallido miente (dice «payment issue» cuando el problema
# es la verificacion de la empresa: medido el 20-09-2026, gotcha 84).
#
# Sin esto, la unica forma de saber si Meta ya ha desbloqueado era mandar un
# mensaje de prueba a alguien y mirarle el movil. Ahora lo dice la pantalla.
_ESTADOS_LEGIBLES = {
    "AVAILABLE": "Meta deja enviar con normalidad.",
    "LIMITED": "Meta deja enviar solo en parte: hay algo a medias.",
    "BLOCKED": "Meta NO deja enviar.",
}
_VERIFICACION_LEGIBLE = {
    "verified": "Empresa verificada.",
    "pending": "Verificación ENTREGADA y en revisión por Meta. Puede tardar hasta "
               "14 días laborables; no hay nada más que hacer por tu parte.",
    "pending_need_more_info": "Meta ha pedido MÁS INFORMACIÓN para verificar la "
                              "empresa. Hay un caso abierto esperándote en "
                              "business.facebook.com → Centro de seguridad.",
    "pending_submission": "La verificación de la empresa ni siquiera se ha enviado.",
    "rejected": "Meta ha RECHAZADO la verificación de la empresa.",
    "failed": "La verificación de la empresa ha fallado.",
    "not_verified": "La empresa no está verificada.",
}

# La respuesta de Meta se guarda un rato: la pantalla de Configuracion se abre
# muchas veces al dia y esto no cambia de un minuto para otro. Si la llamada
# falla se devuelve lo ultimo bueno antes que nada: un hueco en blanco se lee
# como «ya no pasa nada», que es justo lo contrario de lo que significa.
_SALUD_CACHE: dict = {"at": None, "dato": None}
_SALUD_MINUTOS = 10


def _salud_leer(hs: dict, verificacion: str = "") -> dict:
    """Traduce la respuesta de Meta. Puro a proposito: asi se puede probar."""
    hs = hs if isinstance(hs, dict) else {}
    puede = hs.get("can_send_message")
    out = {"puede_enviar": puede, "que_significa": _ESTADOS_LEGIBLES.get(puede or "")}
    frenos = []
    for e in hs.get("entities") or []:
        # Los eslabones que estan bien no son noticia.
        if not isinstance(e, dict) or e.get("can_send_message") == "AVAILABLE":
            continue
        for err in e.get("errors") or []:
            if not isinstance(err, dict):
                continue
            # Las llamadas por SIP no las usamos: su error es ruido fijo que
            # aparece SIEMPRE, y un aviso que sale siempre deja de leerse.
            if str(err.get("error_code") or "").startswith("1380"):
                continue
            frenos.append({"entidad": e.get("entity_type"),
                           "codigo": err.get("error_code"),
                           "es": err.get("error_description"),
                           "hacer": err.get("possible_solution")})
    out["frenos"] = frenos
    if verificacion:
        out["verificacion"] = verificacion
        out["verificacion_es"] = _VERIFICACION_LEGIBLE.get(verificacion)
    return out


async def salud(forzar: bool = False) -> dict:
    """El veredicto de Meta sobre si podemos enviar, y que lo impide."""
    if not configurado():
        return {}
    ahora = datetime.now(timezone.utc)
    if (not forzar and _SALUD_CACHE["at"] and _SALUD_CACHE["dato"] is not None
            and ahora - _SALUD_CACHE["at"] < timedelta(minutes=_SALUD_MINUTOS)):
        return _SALUD_CACHE["dato"]

    pid = os.environ["WHATSAPP_PHONE_NUMBER_ID"]
    waba = os.environ.get("WHATSAPP_BUSINESS_ACCOUNT_ID") or ""
    out: dict = {}
    try:
        # `trust_env=False` a proposito: nada de proxies del entorno para una
        # llamada que lleva el token.
        async with aiohttp.ClientSession(trust_env=False) as s:
            async with s.get("%s/%s" % (API, pid),
                             params={"fields": "health_status",
                                     "access_token": os.environ["WHATSAPP_ACCESS_TOKEN"]},
                             timeout=aiohttp.ClientTimeout(total=8)) as r:
                d = await r.json(content_type=None)
            verif = ""
            if waba:
                async with s.get("%s/%s" % (API, waba),
                                 params={"fields": "business_verification_status",
                                         "access_token": os.environ["WHATSAPP_ACCESS_TOKEN"]},
                                 timeout=aiohttp.ClientTimeout(total=8)) as r2:
                    d2 = await r2.json(content_type=None)
                verif = (d2 or {}).get("business_verification_status") or ""
            out = _salud_leer((d or {}).get("health_status") or {}, verif)
    except Exception as e:                                   # noqa: BLE001
        logger.warning("whatsapp: no se pudo leer la salud: %s", type(e).__name__)
        return _SALUD_CACHE["dato"] or {"error": True}
    _SALUD_CACHE.update({"at": ahora, "dato": out})
    return out


# QUE HACER CUANDO META ACEPTA EL MENSAJE Y LUEGO NO LO ENTREGA.
#
# Son dos cosas distintas y se confundian: la API contesta 200 con su `wamid`
# —aceptado— y el acuse de VERDAD llega despues por el webhook. El 20-09-2026,
# tres pruebas seguidas al movil de Dani: las tres «Enviada», las tres
# `failed` seis segundos mas tarde con el mismo motivo.
QUE_HACER_ENTREGA = {
    "Business eligibility payment issue": (
        "La cuenta de WhatsApp Business no tiene metodo de pago valido, o la "
        "verificacion de empresa esta a medias. Meta acepta el mensaje y lo "
        "rechaza al entregarlo. Se arregla en business.facebook.com: anadir "
        "una tarjeta a la cuenta y terminar la verificacion del negocio."),
    "Re-engagement message": (
        "Han pasado mas de 24 h desde el ultimo mensaje de esa persona: solo "
        "se le puede escribir con una plantilla aprobada."),
    "Message Undeliverable": (
        "Ese numero no tiene WhatsApp, o lo tiene con otro numero. "
        "Comprueba el telefono en la ficha."),
    "Template Paused": (
        "Meta ha pausado esa plantilla porque la gente la marca como spam. "
        "Hay que revisar el texto en el WhatsApp Manager."),
    "Account locked": (
        "Meta ha bloqueado la cuenta. Hay que mirar el aviso en el Business "
        "Manager antes de poder mandar nada."),
}


async def enviar_plantilla(db, telefono: str, plantilla: str,
                           parametros: list = None, motivo: str = "",
                           idioma: str = "es") -> dict:
    """Manda una plantilla aprobada. NUNCA lanza: devuelve el resultado.

    No lanza a proposito. Esto se llama desde dentro de flujos que ya estaban
    funcionando —guardar una incidencia, cerrar el dia— y un WhatsApp que no
    sale no puede tumbar la operacion que lo dispara.
    """
    destino = normaliza_telefono(telefono)
    # `texto` es lo que la persona lee de verdad: la pantalla de Conversaciones
    # lo enseña en el hilo, y un hilo que solo dice "pre_dnr" no sirve de nada.
    base = {"plantilla": plantilla, "motivo": motivo, "tipo": "plantilla",
            "telefono": destino or str(telefono or "")[:24],
            "texto": render_plantilla(plantilla, parametros)[:1500]}

    if not destino:
        r = {**base, "ok": False, "error": "telefono_invalido"}
        await _apunta(db, r)
        return r
    if not configurado():
        r = {**base, "ok": False, "error": "sin_credenciales"}
        await _apunta(db, r)
        return r

    cuerpo = {
        "messaging_product": "whatsapp",
        "to": destino,
        "type": "template",
        "template": {
            "name": plantilla,
            "language": {"code": idioma},
        },
    }
    if parametros:
        cuerpo["template"]["components"] = [{
            "type": "body",
            "parameters": [{"type": "text", "text": str(p)[:900]} for p in parametros],
        }]

    url = f"{API}/{os.environ['WHATSAPP_PHONE_NUMBER_ID']}/messages"
    cab = {"Authorization": f"Bearer {os.environ['WHATSAPP_ACCESS_TOKEN']}",
           "Content-Type": "application/json"}
    try:
        async with aiohttp.ClientSession() as s:
            async with s.post(url, json=cuerpo, headers=cab,
                              timeout=aiohttp.ClientTimeout(total=15)) as resp:
                datos = await resp.json(content_type=None)
                if resp.status >= 400:
                    # El error de Meta se guarda TAL CUAL. "plantilla no
                    # aprobada" y "numero no valido" se arreglan de formas
                    # distintas, y un "fallo al enviar" generico no dice cual es.
                    err = (datos or {}).get("error") or {}
                    codigo = err.get("code")
                    r = {**base, "ok": False, "http": resp.status,
                         "error": str(err.get("message") or datos)[:300],
                         "codigo": codigo,
                         # Lo que hay que HACER para arreglarlo, que es lo que
                         # se busca de verdad al leer un error en pantalla.
                         "que_hacer": QUE_HACER.get(codigo)}
                    logger.warning("WhatsApp %s -> %s: %s", plantilla, resp.status, r["error"])
                    await _apunta(db, r)
                    return r
                mid = ((datos.get("messages") or [{}])[0]).get("id")
                r = {**base, "ok": True, "message_id": mid}
                await _apunta(db, r)
                return r
    except Exception as e:                                   # noqa: BLE001
        r = {**base, "ok": False, "error": f"{type(e).__name__}: {e}"[:300]}
        logger.warning("WhatsApp %s: %s", plantilla, r["error"])
        await _apunta(db, r)
        return r


async def enviar_texto(db, telefono: str, texto: str, motivo: str = "respuesta") -> dict:
    """Texto libre a UNA persona. Solo lo admite WhatsApp dentro de las 24 h
    siguientes a que ella escriba; quien llama comprueba la ventana (aqui no se
    sabe) y, si Meta la da por cerrada, su error sale tal cual.

    NUNCA lanza, igual que `enviar_plantilla`, y se apunta en `whatsapp_envios`
    con `tipo: "texto"` para que salga en el hilo de Conversaciones.
    """
    destino = normaliza_telefono(telefono)
    texto = (texto or "").strip()[:4000]
    base = {"plantilla": "", "motivo": motivo, "tipo": "texto",
            "telefono": destino or str(telefono or "")[:24], "texto": texto[:1500]}
    if not destino:
        r = {**base, "ok": False, "error": "telefono_invalido"}
        await _apunta(db, r)
        return r
    if not texto:
        return {**base, "ok": False, "error": "texto_vacio"}
    if not configurado():
        r = {**base, "ok": False, "error": "sin_credenciales"}
        await _apunta(db, r)
        return r
    cuerpo = {"messaging_product": "whatsapp", "to": destino, "type": "text",
              "text": {"preview_url": False, "body": texto}}
    url = f"{API}/{os.environ['WHATSAPP_PHONE_NUMBER_ID']}/messages"
    cab = {"Authorization": f"Bearer {os.environ['WHATSAPP_ACCESS_TOKEN']}",
           "Content-Type": "application/json"}
    try:
        async with aiohttp.ClientSession() as s:
            async with s.post(url, json=cuerpo, headers=cab,
                              timeout=aiohttp.ClientTimeout(total=15)) as resp:
                datos = await resp.json(content_type=None)
                if resp.status >= 400:
                    err = (datos or {}).get("error") or {}
                    codigo = err.get("code")
                    r = {**base, "ok": False, "http": resp.status,
                         "error": str(err.get("message") or datos)[:300],
                         "codigo": codigo,
                         # Lo que hay que HACER para arreglarlo, que es lo que
                         # se busca de verdad al leer un error en pantalla.
                         "que_hacer": QUE_HACER.get(codigo)}
                    logger.warning("WhatsApp texto -> %s: %s", resp.status, r["error"])
                    await _apunta(db, r)
                    return r
                mid = ((datos.get("messages") or [{}])[0]).get("id")
                r = {**base, "ok": True, "message_id": mid}
                await _apunta(db, r)
                return r
    except Exception as e:                                   # noqa: BLE001
        r = {**base, "ok": False, "error": f"{type(e).__name__}: {e}"[:300]}
        logger.warning("WhatsApp texto: %s", r["error"])
        await _apunta(db, r)
        return r


async def plantillas(db=None) -> dict:
    """Las plantillas de la cuenta y en que estado las tiene Meta.

    Se pregunta a Meta en vez de mantener la lista a mano: una plantilla
    rechazada sigue existiendo en nuestro codigo y el unico sitio donde consta
    que no se puede usar es la respuesta de Meta. Si no hay credenciales, se
    dice, en vez de devolver una lista vacia que parece "no hay ninguna".
    """
    cuenta = os.environ.get("WHATSAPP_BUSINESS_ACCOUNT_ID")
    if not (cuenta and os.environ.get("WHATSAPP_ACCESS_TOKEN")):
        return {"ok": False, "error": "sin_credenciales", "plantillas": []}
    url = f"{API}/{cuenta}/message_templates?limit=50"
    cab = {"Authorization": f"Bearer {os.environ['WHATSAPP_ACCESS_TOKEN']}"}
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(url, headers=cab,
                             timeout=aiohttp.ClientTimeout(total=15)) as resp:
                datos = await resp.json(content_type=None)
                if resp.status >= 400:
                    err = (datos or {}).get("error") or {}
                    return {"ok": False, "error": str(err.get("message") or datos)[:300],
                            "plantillas": []}
                return {"ok": True, "plantillas": [
                    {"nombre": t.get("name"), "estado": t.get("status"),
                     "idioma": t.get("language"), "categoria": t.get("category")}
                    for t in (datos.get("data") or [])]}
    except Exception as e:                                   # noqa: BLE001
        return {"ok": False, "error": f"{type(e).__name__}: {e}"[:200], "plantillas": []}


# ---------------------------------------------------------------------------
# ALTA DE LAS PLANTILLAS POR API
# ---------------------------------------------------------------------------
# Se pueden crear a mano en el WhatsApp Manager, pero hay tres formas de que
# salga mal y ninguna avisa a tiempo: el nombre tiene que coincidir LETRA POR
# LETRA con el que manda el codigo (si no, "template not found" el dia que se
# active), la categoria tiene que ser "utility" (como "marketing" cuesta mas
# por mensaje y ademas Meta las rechaza, porque no venden nada) y cada variable
# necesita un ejemplo concreto o la revision la tumba por "ejemplos poco
# claros". Escritas aqui una vez, se suben de un boton y las tres cosas salen
# bien por construccion.
#
# El texto va con {{1}}, {{2}}... y el ORDEN es el mismo con el que llaman los
# disparadores en server.py. Cambiar el orden aqui sin cambiarlo alli manda la
# matricula donde va la fecha, y Meta lo acepta: son dos textos cualesquiera.
PLANTILLAS_BASE = [
    {
        "name": "itv_vencida",
        "language": "es",
        "category": "UTILITY",
        "components": [{
            "type": "BODY",
            "text": ("La furgoneta {{1}} tiene la ITV vencida desde hace {{2}} "
                     "días. No puede salir a ruta hasta pasarla."),
            "example": {"body_text": [["1234 ABC", "12"]]},
        }],
    },
    {
        "name": "incidencia_critica",
        "language": "es",
        "category": "UTILITY",
        "components": [{
            "type": "BODY",
            "text": ("Nueva incidencia grave en {{1}}: {{2}}. Revisar antes de "
                     "la próxima ruta."),
            "example": {"body_text": [["1234 ABC", "frenos con ruido al pisar"]]},
        }],
    },
    {
        "name": "taller_seguimiento",
        "language": "es",
        "category": "UTILITY",
        "components": [{
            "type": "BODY",
            "text": ("Hola, ¿cómo va la {{1}}? Lleva {{2}} días sin novedades. "
                     "Con un toque aquí nos decís el estado y así no os llamamos: {{3}}. "
                     "Gracias."),
            "example": {"body_text": [["1234 ABC", "5", "https://flotadsp.com/taller/abc123"]]},
        }],
    },
    {
        "name": "resumen_diario",
        "language": "es",
        "category": "UTILITY",
        "components": [{
            "type": "BODY",
            # Termina en texto fijo a propósito: Meta rechaza las plantillas con
            # una variable al principio o al final.
            "text": ("Resumen del día en {{1}}: {{2}} vehículos revisados, "
                     "{{3}} golpes nuevos en la flota y checklist {{4}}. "
                     "Tienes el detalle en el panel."),
            "example": {"body_text": [["Sede Norte 28/08", "38 de 41", "2",
                                       "mañana 20/21 · tarde 18/20"]]},
        }],
    },
]


def render_plantilla(nombre: str, parametros: list = None) -> str:
    """El texto de una plantilla con sus variables puestas, tal como lo lee la
    persona. Es lo que se ensena en la pantalla de Conversaciones: sin esto el
    hilo diria "itv_vencida" y nadie sabria que se le mando exactamente."""
    for pl in PLANTILLAS_BASE:
        if pl["name"] == nombre:
            t = pl["components"][0]["text"]
            for i, p in enumerate(parametros or [], start=1):
                t = t.replace("{{%d}}" % i, str(p))
            return t
    return ""


async def crear_plantillas(db=None) -> dict:
    """Da de alta en Meta las tres plantillas. Se puede llamar mil veces.

    Idempotente a proposito: si una ya existe no se reenvia, porque Meta
    responde con un error ("template name already exists") que en el panel se
    leeria como que algo fallo cuando lo que pasa es que ya estaba hecho.
    """
    cuenta = os.environ.get("WHATSAPP_BUSINESS_ACCOUNT_ID")
    if not (cuenta and os.environ.get("WHATSAPP_ACCESS_TOKEN")):
        return {"ok": False, "error": "sin_credenciales", "resultados": []}

    ya = await plantillas()
    if not ya.get("ok"):
        # Sin poder leer lo que hay no se sube nada: a ciegas se duplicarian
        # las que existan y el resultado seria una lista de errores.
        return {"ok": False, "error": ya.get("error") or "no_se_pudo_leer",
                "resultados": []}
    existentes = {p.get("nombre") for p in (ya.get("plantillas") or [])}

    url = f"{API}/{cuenta}/message_templates"
    cab = {"Authorization": f"Bearer {os.environ['WHATSAPP_ACCESS_TOKEN']}",
           "Content-Type": "application/json"}
    salida = []
    async with aiohttp.ClientSession() as s:
        for pl in PLANTILLAS_BASE:
            if pl["name"] in existentes:
                salida.append({"plantilla": pl["name"], "ok": True,
                               "estado": "ya_existia"})
                continue
            try:
                async with s.post(url, json=pl, headers=cab,
                                  timeout=aiohttp.ClientTimeout(total=20)) as resp:
                    datos = await resp.json(content_type=None)
                    if resp.status >= 400:
                        err = (datos or {}).get("error") or {}
                        # `error_user_msg` es el mensaje en cristiano que Meta
                        # escribe para la persona; `message` es el tecnico.
                        salida.append({
                            "plantilla": pl["name"], "ok": False,
                            "error": str(err.get("error_user_msg")
                                         or err.get("message") or datos)[:300]})
                    else:
                        salida.append({"plantilla": pl["name"], "ok": True,
                                       "estado": datos.get("status") or "PENDING"})
            except Exception as e:                           # noqa: BLE001
                salida.append({"plantilla": pl["name"], "ok": False,
                               "error": f"{type(e).__name__}: {e}"[:200]})
    logger.info("WhatsApp alta de plantillas: %s", salida)
    return {"ok": all(r["ok"] for r in salida), "resultados": salida}


async def config(db) -> dict:
    """Que avisos estan encendidos. Por defecto TODO APAGADO.

    Apagado de entrada a proposito: en cuanto se pongan las credenciales, esto
    empieza a escribir a numeros de personas reales. Que se encienda a mano y
    cuando alguien lo decida, no por el hecho de haber pegado un token.
    """
    doc = await db[COLECCION_CONFIG].find_one({}, {"_id": 0}) or {}
    centros = doc.get("predn_centros")
    return {
        "activo": bool(doc.get("activo", False)),
        "avisar_itv": bool(doc.get("avisar_itv", False)),
        "avisar_incidencia": bool(doc.get("avisar_incidencia", False)),
        "avisar_resumen": bool(doc.get("avisar_resumen", False)),
        # Las pre-DNR. Dos interruptores generales para poder probar por partes
        # (primero solo el aviso al conductor, luego tambien la respuesta a
        # Amazon) y UNA casilla por nave, apagada de entrada: hay naves donde
        # no interesa automatizar, y un cliente nuevo no debe heredar el
        # automatismo de otro.
        "avisar_predn": bool(doc.get("avisar_predn", False)),
        "dnr_auto_amazon": bool(doc.get("dnr_auto_amazon", False)),
        "predn_centros": ({str(k): bool(v) for k, v in centros.items()}
                          if isinstance(centros, dict) else {}),
        "plantilla_itv": doc.get("plantilla_itv") or "itv_vencida",
        "plantilla_incidencia": doc.get("plantilla_incidencia") or "incidencia_critica",
        "plantilla_resumen": doc.get("plantilla_resumen") or "resumen_diario",
        "plantilla_predn": doc.get("plantilla_predn") or "pre_dnr",
    }


async def puede_avisar(db, clave: str) -> bool:
    """Si ese aviso concreto puede salir ahora mismo. Tres condiciones."""
    if not configurado():
        return False
    c = await config(db)
    return bool(c.get("activo") and c.get(clave))
