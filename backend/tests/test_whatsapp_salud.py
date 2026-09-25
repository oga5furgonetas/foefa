# -*- coding: utf-8 -*-
"""Que el panel diga POR QUE no salen los avisos, preguntandoselo a Meta.

El 20-09-2026, la unica forma de saber si Meta ya dejaba enviar era mandarle un
mensaje de prueba a alguien y mirarle el movil. Y el motivo que viaja con el
mensaje fallido MIENTE: dice «Business eligibility payment issue» cuando lo que
falta es la verificacion de la empresa (gotcha 84). `health_status` es la unica
fuente que dice que eslabon —numero, cuenta, negocio o app— esta parando el
envio, con su codigo y su solucion.

Lo que se protege aqui: que esa respuesta se lea bien, que el ruido fijo no tape
lo importante, y que un fallo de red no se lea como «ya no pasa nada».
"""
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import whatsapp                                                    # noqa: E402

# La respuesta REAL de Meta el 20-09-2026, copiada tal cual.
_REAL = {
    "can_send_message": "LIMITED",
    "entities": [
        {"entity_type": "PHONE_NUMBER", "id": "1389067567613664",
         "can_send_message": "LIMITED", "can_receive_call_sip": "BLOCKED",
         "errors": [{"error_code": 138024,
                     "error_description": "WhatsApp Business calling cannot use SIP because it is not enabled",
                     "possible_solution": "Configure SIP using {PHONE_NUMBER_ID}/settings API"}]},
        {"entity_type": "WABA", "id": "943532135460989", "can_send_message": "AVAILABLE"},
        {"entity_type": "BUSINESS", "id": "4032493453714064", "can_send_message": "LIMITED",
         "errors": [{"error_code": 141010,
                     "error_description": "The Business has not passed business verification.",
                     "possible_solution": "Visit business settings and start or resolve the business verification request."}]},
        {"entity_type": "APP", "id": "1606237354480463", "can_send_message": "AVAILABLE"},
    ],
}


def test_dice_el_eslabon_que_bloquea_y_no_los_demas():
    r = whatsapp._salud_leer(_REAL)
    assert r["puede_enviar"] == "LIMITED"
    assert "solo en parte" in r["que_significa"]
    # UN solo freno de verdad: el negocio. La WABA y la app estan bien y no son
    # noticia; el de SIP es ruido fijo.
    assert len(r["frenos"]) == 1
    f = r["frenos"][0]
    assert f["entidad"] == "BUSINESS"
    assert f["codigo"] == 141010
    assert "business verification" in f["es"]
    assert "business settings" in f["hacer"]


def test_el_ruido_de_las_llamadas_sip_no_tapa_lo_importante():
    """Un aviso que sale siempre deja de leerse."""
    solo_sip = {"can_send_message": "LIMITED", "entities": [
        {"entity_type": "PHONE_NUMBER", "can_send_message": "LIMITED",
         "errors": [{"error_code": 138025, "error_description": "SIP", "possible_solution": "x"}]}]}
    assert whatsapp._salud_leer(solo_sip)["frenos"] == []


def test_cuando_meta_desbloquee_se_nota():
    """Es el dia que Dani esta esperando: tiene que verse sin mandar pruebas."""
    r = whatsapp._salud_leer({"can_send_message": "AVAILABLE", "entities": [
        {"entity_type": "BUSINESS", "can_send_message": "AVAILABLE"}]}, "verified")
    assert r["puede_enviar"] == "AVAILABLE"
    assert r["frenos"] == []
    assert r["verificacion_es"] == "Empresa verificada."


def test_pending_no_se_puede_leer_como_aprobado():
    """`pending` es «entregado y en cola», no «ya esta». Es la duda exacta que
    tuvo Dani el 20-09: cambio el estado y seguia sin llegar."""
    r = whatsapp._salud_leer(_REAL, "pending")
    assert r["verificacion"] == "pending"
    assert "revisión" in r["verificacion_es"]
    assert "14 días laborables" in r["verificacion_es"]
    # Y el freno sigue ahi: el texto no puede sonar a resuelto.
    assert r["frenos"][0]["codigo"] == 141010


def test_cada_estado_de_verificacion_dice_que_hacer():
    for estado, pista in (("pending_need_more_info", "Centro de seguridad"),
                          ("pending_submission", "ni siquiera"),
                          ("rejected", "RECHAZADO"),
                          ("not_verified", "no está verificada")):
        r = whatsapp._salud_leer(_REAL, estado)
        assert pista in r["verificacion_es"], (estado, r["verificacion_es"])


def test_una_respuesta_rara_no_tumba_la_pantalla():
    """Configuración se abre cien veces al día: no puede caerse por esto."""
    for basura in ({}, None, [], "LIMITED", {"entities": "no soy una lista"},
                   {"can_send_message": "LIMITED", "entities": [None, 3, "x"]},
                   {"can_send_message": "LIMITED",
                    "entities": [{"entity_type": "BUSINESS", "can_send_message": "LIMITED",
                                  "errors": ["no soy un dict"]}]}):
        r = whatsapp._salud_leer(basura)
        assert isinstance(r.get("frenos"), list)


def test_un_estado_que_meta_invente_no_se_traduce_a_lo_loco():
    """Mejor sin frase que con una frase inventada."""
    r = whatsapp._salud_leer({"can_send_message": "ALGO_NUEVO"}, "algo_nuevo")
    assert r["puede_enviar"] == "ALGO_NUEVO"
    assert not r["que_significa"]
    assert r["verificacion_es"] is None


def test_sin_credenciales_no_se_inventa_un_estado():
    import asyncio
    guardado = {k: __import__("os").environ.pop(k, None)
                for k in ("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID",
                          "WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_VERIFY_TOKEN")}
    try:
        assert asyncio.run(whatsapp.salud()) == {}
    finally:
        for k, v in guardado.items():
            if v is not None:
                __import__("os").environ[k] = v
