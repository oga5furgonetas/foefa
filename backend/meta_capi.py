# -*- coding: utf-8 -*-
"""API de conversiones de Meta (02-11-2026).

POR QUÉ. Los anuncios de Facebook e Instagram se optimizan por lo que Meta ve, y el píxel de la web solo ve el
registro: así la puja aprende a traer registros baratos que nunca reparten (23-10: 32 registros, 0 rutas). Desde
el servidor se le cuenta lo que pasa DESPUÉS del registro: «CompleteRegistration» (el mismo `event_id` que manda
el píxel, para que no cuente dos veces), «app_login» (entró en la app) y «primera_ruta» (valor 25 €, el único
evento que mide repartidores). Con eso cada anuncio se juzga por repartidores y no por registros, y se puede montar
la conversión «registro cualificado» (docs/anuncios/CANALES-02-11.md, §2.2).

CÓMO. POST https://graph.facebook.com/v21.0/{píxel}/events, con los datos de la persona en SHA-256 como exige
Meta (correo en minúsculas y sin espacios; teléfono en E.164, solo dígitos). Entorno: META_PIXEL_ID y
META_CAPI_TOKEN (sin cualquiera de las dos no se hace NADA, sin ruido en los logs) y META_TEST_EVENT_CODE (los
eventos salen en «Probar eventos» del Administrador de eventos). Nunca lanza: medir no puede romper un alta ni un
login. El módulo no toca la base: el servidor decide cuándo y marca que ya lo mandó.
"""
import hashlib
import logging
import os
import re
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

VERSION_API = "v21.0"
TIEMPO_MAX = 8.0
PAQUETE_ANDROID = "com.flotadsp.flota"       # el paquete de la app de Play (nombre interno, ver CLAUDE.md)
ORIGENES = ("website", "app")


def _pixel() -> str:
    return (os.environ.get("META_PIXEL_ID") or "").strip()


def _token() -> str:
    return (os.environ.get("META_CAPI_TOKEN") or "").strip()


def configurado() -> bool:
    """Hay píxel y token: se puede mandar."""
    return bool(_pixel() and _token())


def normalizar_correo(correo) -> str:
    """Como lo quiere Meta antes de hacer el hash: minúsculas y sin ningún espacio."""
    return re.sub(r"\s+", "", str(correo or "")).lower()


def normalizar_telefono(telefono) -> str:
    """E.164 sin «+»: solo dígitos y sin el «00» internacional. Con menos de 8 dígitos no es un teléfono."""
    d = re.sub(r"\D", "", str(telefono or ""))
    if d.startswith("00"):
        d = d[2:]
    return d if len(d) >= 8 else ""


def _sha(valor: str) -> str:
    return hashlib.sha256(valor.encode("utf-8")).hexdigest()


def datos_usuario(correo=None, telefono=None, ip=None, agente=None, fbp=None, fbc=None, id_externo=None) -> dict:
    """`user_data` como lo quiere Meta: lo personal en SHA-256 y el resto tal cual. Solo lo que hay."""
    u = {}
    c = normalizar_correo(correo)
    if c and "@" in c:
        u["em"] = [_sha(c)]
    t = normalizar_telefono(telefono)
    if t:
        u["ph"] = [_sha(t)]
    if id_externo:
        u["external_id"] = [_sha(str(id_externo))]
    if ip and ip != "?":
        u["client_ip_address"] = str(ip)
    if agente:
        u["client_user_agent"] = str(agente)[:512]
    if fbp:
        u["fbp"] = str(fbp)
    if fbc:
        u["fbc"] = str(fbc)
    return u


def _app_data(version_app: str = "") -> dict:
    """Lo que Meta exige en los eventos con action_source «app». La app no lleva el SDK de Meta, así que va lo
    mínimo: Android («a2»), el paquete y la versión que manda la cabecera X-FDS-App; los 16 huecos de `extinfo`,
    todos cadenas y "" lo que no se sabe (02-11-2026: así lo pide Meta; antes iban enteros). Meta solo acepta eventos
    «app» de un dataset enlazado a la app (Administrador de eventos → Datasets → Conectar app); el servidor no los
    manda sin META_APP_EVENTS=1 (server.py, _meta_enviar)."""
    v = str(version_app or "")
    extinfo = ["a2", PAQUETE_ANDROID, v, v] + [""] * 12
    return {"advertiser_tracking_enabled": False, "application_tracking_enabled": True, "extinfo": extinfo}


def evento(nombre: str, event_id: str, *, correo=None, telefono=None, valor=None, moneda: str = "EUR",
           action_source: str = "website", url: Optional[str] = None, ip: Optional[str] = None,
           agente: Optional[str] = None, fbp: Optional[str] = None, fbc: Optional[str] = None,
           id_externo: Optional[str] = None, version_app: str = "", ahora=None, datos: Optional[dict] = None) -> dict:
    """UN evento tal cual va dentro de `data`, para verlo y probarlo sin red."""
    origen = action_source if action_source in ORIGENES else "website"
    e = {"event_name": str(nombre), "event_time": int(ahora if ahora is not None else time.time()),
         "event_id": str(event_id), "action_source": origen,
         "user_data": datos_usuario(correo, telefono, ip, agente, fbp, fbc, id_externo)}
    if url and origen == "website":
        e["event_source_url"] = str(url)[:1024]
    if origen == "app":
        e["app_data"] = _app_data(version_app)
    custom = dict(datos or {})
    if valor is not None:
        custom.update(value=float(valor), currency=(moneda or "EUR").upper())
    if custom:
        e["custom_data"] = custom
    return e


async def enviar_evento(nombre: str, event_id: str, **datos) -> bool:
    """Manda UN evento a Meta. False si no está configurado, si Meta no lo acepta o si algo falla: nunca lanza.
    Los argumentos son los de `evento` (correo, telefono, valor, moneda, action_source, url, ip, agente, fbp, fbc,
    id_externo, version_app)."""
    if not configurado():
        return False
    try:
        ev = evento(nombre, event_id, **datos)
        cuerpo = {"data": [ev], "access_token": _token()}
        prueba = (os.environ.get("META_TEST_EVENT_CODE") or "").strip()
        if prueba:
            cuerpo["test_event_code"] = prueba
        url = f"https://graph.facebook.com/{VERSION_API}/{_pixel()}/events"
        async with httpx.AsyncClient(timeout=TIEMPO_MAX) as cli:
            r = await cli.post(url, json=cuerpo)
        if r.status_code >= 300:
            # La respuesta no lleva el token; el cuerpo que se mandó, sí, y por eso no se escribe. Un evento «app»
            # rechazado suele ser el dataset sin enlazar a la app (02-11-2026): error y no aviso, para que se vea.
            log = logger.error if ev.get("action_source") == "app" else logger.warning
            log("Meta CAPI %s (%s): %s %s", nombre, event_id, r.status_code, (r.text or "")[:200])
            return False
        return True
    except Exception as e:                                       # noqa: BLE001
        logger.warning("Meta CAPI %s (%s): %s", nombre, event_id, type(e).__name__)
        return False
