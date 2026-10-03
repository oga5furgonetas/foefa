# -*- coding: utf-8 -*-
"""Cobro con Google Play dentro de la app (04-10-2026): la compra se comprueba
con Google, es de esta cuenta y de nuestros productos, se acepta, se refresca
al caducar, y un regalo aplaza el cobro de Google."""
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

YO = {"sub": "a1", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_o1"}
TOKEN = "tok.AO-J1Oz_abcdefghijklmnopqrstuvwxyz0123456789"


def _iso(dias):
    return (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat()


def _sub(estado="SUBSCRIPTION_STATE_ACTIVE", dias=7, producto="repartidor_mensual", cuenta=None, prueba=True, aceptada=False):
    return {"subscriptionState": estado,
            "acknowledgementState": "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" if aceptada else "ACKNOWLEDGEMENT_STATE_PENDING",
            "externalAccountIdentifiers": {"obfuscatedExternalAccountId": cuenta or server._play_cuenta_org("o1")},
            "lineItems": [{"productId": producto, "expiryTime": _iso(dias).replace("+00:00", "Z"),
                           "autoRenewingPlan": {"autoRenewEnabled": True},
                           "offerPhase": {"freeTrial": {}} if prueba else {"basePrice": {}}}]}


@pytest.fixture
def base(monkeypatch):
    g = Db()
    g["organizations"] = Col([
        {"id": "o1", "name": "Pepe", "slug": "pepe", "account_type": "dsp", "status": "trial", "plan": "autonomo",
         "sector": "autonomo", "trial_ends": _iso(7), "prueba_con_tarjeta": True},
        {"id": "e1", "name": "Súper", "account_type": "dsp", "status": "active", "plan": "completo", "sector": "supermercado"},
    ])
    g["play_compras"] = Col([])
    g["regalos"] = Col([])
    monkeypatch.setattr(server, "global_db", g)

    async def org(_id):
        return await g.organizations.find_one({"id": _id}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)

    async def audit(*a, **k):
        return None
    monkeypatch.setattr(server, "_audit", audit)
    monkeypatch.setenv("GOOGLE_PLAY_CUENTA_SERVICIO", json.dumps({"client_email": "x@y.iam.gserviceaccount.com", "private_key": "k"}))
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    llamadas, respuestas = [], {}

    async def req(metodo, ruta, cuerpo=None):
        llamadas.append((metodo, ruta, cuerpo))
        r = respuestas.get(metodo)
        if isinstance(r, Exception):
            raise r
        return r if r is not None else {}
    monkeypatch.setattr(server, "_play_req", req)
    return SimpleNamespace(g=g, llamadas=llamadas, respuestas=respuestas, o1=g["organizations"].docs[0])


@pytest.mark.asyncio(loop_scope="session")
async def test_compra_buena_con_prueba_se_acepta_y_activa(base):
    assert server._falta_tarjeta(base.o1)                       # con Play listo, también se pide «tarjeta»
    base.respuestas["GET"] = _sub()
    r = await server.play_verificar({"token": TOKEN}, YO)
    assert r == {"ok": True, "vigente": True, "hasta": r["hasta"], "en_prueba": True, "intervalo": "mensual"}
    metodos = [(m, ruta) for m, ruta, _ in base.llamadas]
    assert ("POST", f"/purchases/subscriptions/repartidor_mensual/tokens/{TOKEN}:acknowledge") in metodos
    o = base.o1
    assert o["status"] == "active" and o["pago_proveedor"] == "play" and o["play_token"] == TOKEN and o["play_en_prueba"]
    assert not server._falta_tarjeta(o) and server._rep_bloqueo_pago(o) == ""
    assert base.g["play_compras"].docs[0]["org_id"] == "o1"


@pytest.mark.asyncio(loop_scope="session")
async def test_compras_que_no_valen(base):
    casos = [
        (_sub(cuenta="otra-cuenta"), YO, 403),                   # comprada con otra cuenta
        (_sub(producto="otra_cosa"), YO, 400),                    # no es nuestro producto
        (_sub(), {**YO, "org_id": "e1"}, 400),                    # una empresa
    ]
    for respuesta, usuario, codigo in casos:
        base.respuestas["GET"] = respuesta
        with pytest.raises(HTTPException) as e:
            await server.play_verificar({"token": TOKEN}, usuario)
        assert e.value.status_code == codigo
    with pytest.raises(HTTPException) as e:
        await server.play_verificar({"token": "corto"}, YO)
    assert e.value.status_code == 400
    # Un token ya ligado a otra cuenta.
    base.g["play_compras"].docs.append({"token": TOKEN, "org_id": "zz"})
    with pytest.raises(HTTPException) as e:
        await server.play_verificar({"token": TOKEN}, YO)
    assert e.value.status_code == 409
    for u in ({**YO, "demo": True}, {**YO, "imp": True}):
        with pytest.raises(HTTPException) as e:
            await server.play_verificar({"token": TOKEN}, u)
        assert e.value.status_code == 403
    assert base.o1["status"] == "trial"                           # nada de lo anterior la activó


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_configurar_no_se_cobra(base, monkeypatch):
    monkeypatch.delenv("GOOGLE_PLAY_CUENTA_SERVICIO")
    with pytest.raises(HTTPException) as e:
        await server.play_verificar({"token": TOKEN}, YO)
    assert e.value.status_code == 503
    assert not server._falta_tarjeta(base.o1)                    # sin Stripe ni Play, no se pide nada


@pytest.mark.asyncio(loop_scope="session")
async def test_caduca_y_se_refresca_con_google(base):
    base.respuestas["GET"] = _sub(aceptada=True)
    await server.play_verificar({"token": TOKEN}, YO)
    o = base.o1
    o["play_hasta"] = _iso(-1)                                    # según lo guardado, ya caducó
    assert server._org_billing(o)["status"] == "vencido_play" and "Google Play" in server._rep_bloqueo_pago(o)
    # Google dice que se ha renovado: se actualiza y deja de bloquear.
    base.respuestas["GET"] = _sub(dias=30, prueba=False, aceptada=True)
    o2 = await server._play_refrescar(o)
    assert server._rep_bloqueo_pago(o2) == "" and not o2["play_en_prueba"]
    # Cancelada de verdad: ya no vale.
    base.respuestas["GET"] = _sub(estado="SUBSCRIPTION_STATE_EXPIRED", dias=-2, aceptada=True)
    o2["play_mirado"] = _iso(-1)
    o3 = await server._play_refrescar(o2)
    assert server._org_billing(o3)["status"] == "vencido_play"
    # Si Google no contesta, se queda lo que había.
    base.respuestas["GET"] = HTTPException(502, "no")
    o3["play_mirado"] = _iso(-1)
    assert await server._play_refrescar(o3) == o3


def test_cancelada_pero_pagada_sigue_hasta_el_final():
    e = server._play_estado(_sub(estado="SUBSCRIPTION_STATE_CANCELED", dias=5, aceptada=True))
    assert e["vigente"] is True
    e = server._play_estado(_sub(estado="SUBSCRIPTION_STATE_ON_HOLD", dias=-1, aceptada=True))
    assert e["vigente"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_un_regalo_aplaza_el_cobro_de_google(base):
    base.respuestas["GET"] = _sub(aceptada=True, dias=10)
    await server.play_verificar({"token": TOKEN}, YO)
    base.g["regalos"].docs.append({"id": "r1", "codigo": "ABCDEFGH", "meses": 1, "estado": "pagado", "caduca_en": _iso(300)})
    r = await server.regalo_canjear({"codigo": "ABCDEFGH"}, YO)
    metodo, ruta, cuerpo = base.llamadas[-1]
    assert metodo == "POST" and ruta.endswith(f"/tokens/{TOKEN}:defer")
    info = cuerpo["deferralInfo"]
    assert int(info["desiredExpiryTimeMillis"]) > int(info["expectedExpiryTimeMillis"]) + 27 * 86400 * 1000
    assert "Google Play" in r["mensaje"]


@pytest.mark.asyncio(loop_scope="session")
async def test_la_firma_con_la_clave_de_google_funciona(monkeypatch):
    """Que python-jose firme RS256 con una clave de cuenta de servicio de verdad
    y que el intercambio por el token de acceso lleve lo que pide Google."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from jose import jwt as _jwt
    clave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = clave.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                              serialization.NoEncryption()).decode()
    publica = clave.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    monkeypatch.setenv("GOOGLE_PLAY_CUENTA_SERVICIO", json.dumps({"client_email": "sa@p.iam.gserviceaccount.com", "private_key": pem}))
    server._PLAY_TOKEN.update({"valor": None, "caduca": 0})
    vistos = []

    class Cliente:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, data=None):
            vistos.append((url, data))
            return SimpleNamespace(status_code=200, json=lambda: {"access_token": "ya29.x", "expires_in": 3599})
    import httpx
    monkeypatch.setattr(httpx, "AsyncClient", Cliente)
    assert await server._play_acceso() == "ya29.x"
    url, data = vistos[0]
    assert url == "https://oauth2.googleapis.com/token" and data["grant_type"].endswith("jwt-bearer")
    reclamos = _jwt.decode(data["assertion"], publica, algorithms=["RS256"], audience=url)
    assert reclamos["iss"] == "sa@p.iam.gserviceaccount.com" and reclamos["scope"].endswith("/androidpublisher")
    assert await server._play_acceso() == "ya29.x" and len(vistos) == 1   # se reutiliza
    server._PLAY_TOKEN.update({"valor": None, "caduca": 0})
