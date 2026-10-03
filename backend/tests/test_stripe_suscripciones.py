# -*- coding: utf-8 -*-
"""Suscripciones con Stripe: la sesión de pago lleva lo que tiene que llevar y
el webhook activa o suspende la empresa; sin firma, nada."""
import hashlib
import hmac
import json
import time
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

OFICINA = {"sub": "a1", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_o1", "email": "pepe@x.es"}


@pytest.fixture
def base(monkeypatch):
    g = Db()
    g["organizations"] = Col([{"id": "o1", "name": "Pepe Repartos", "account_type": "dsp", "db_name": "dsp_o1",
                               "status": "trial", "plan": "autonomo", "email": "pepe@x.es",
                               "trial_ends": "2099-01-01T00:00:00+00:00"}])
    monkeypatch.setattr(server, "global_db", g)

    async def org(_id):
        return await g.organizations.find_one({"id": _id}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)

    async def audit(*a, **k):
        return None
    monkeypatch.setattr(server, "_audit", audit)
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.setenv("STRIPE_PRICE_AUTONOMO", "price_mensual")
    monkeypatch.setenv("STRIPE_PRICE_AUTONOMO_ANNUAL", "price_anual")
    llamadas = []

    async def req(metodo, ruta, datos=None):
        llamadas.append((metodo, ruta, datos))
        return {"id": "cs_1", "url": "https://checkout.stripe.com/c/cs_1"}
    monkeypatch.setattr(server, "_stripe_req", req)
    return SimpleNamespace(g=g, llamadas=llamadas)


@pytest.mark.asyncio(loop_scope="session")
async def test_checkout_del_autonomo_respeta_la_prueba(base):
    r = await server.stripe_suscripcion({"plan": "autonomo", "anual": True}, OFICINA)
    assert r["url"].startswith("https://checkout.stripe.com/")
    _, ruta, d = base.llamadas[0]
    assert ruta == "/checkout/sessions" and d["mode"] == "subscription"
    assert d["line_items[0][price]"] == "price_anual" and d["line_items[0][quantity]"] == 1
    assert d["metadata[org_id]"] == "o1" and d["metadata[plan]"] == "autonomo"
    assert d["subscription_data[trial_end]"] > time.time() + 48 * 3600   # paga al acabar la prueba
    assert d["success_url"].endswith("/panel?pago=ok")


@pytest.mark.asyncio(loop_scope="session")
async def test_demo_y_plataforma_no_contratan(base):
    for u in ({**OFICINA, "demo": True}, {**OFICINA, "imp": True}):
        with pytest.raises(HTTPException) as e:
            await server.stripe_suscripcion({}, u)
        assert e.value.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_el_webhook_activa_y_suspende(base):
    ev = {"id": "evt_1", "type": "checkout.session.completed", "data": {"object": {
        "mode": "subscription", "customer": "cus_1", "subscription": "sub_1",
        "metadata": {"org_id": "o1", "plan": "autonomo"}}}}
    assert (await server._stripe_aplicar_evento(ev))["aplicado"]
    o = base.g["organizations"].docs[0]
    assert o["status"] == "active" and o["stripe_customer"] == "cus_1" and o["pago_proveedor"] == "stripe"
    # Impago: se suspende; vuelve a pagar: activa.
    await server._stripe_aplicar_evento({"id": "evt_2", "type": "customer.subscription.updated",
                                         "data": {"object": {"id": "sub_1", "customer": "cus_1", "status": "past_due"}}})
    assert o["status"] == "suspended"
    await server._stripe_aplicar_evento({"id": "evt_3", "type": "customer.subscription.updated",
                                         "data": {"object": {"id": "sub_1", "customer": "cus_1", "status": "active",
                                                             "cancel_at_period_end": True}}})
    assert o["status"] == "active" and o["cancela_al_final"] is True
    await server._stripe_aplicar_evento({"id": "evt_4", "type": "customer.subscription.deleted",
                                         "data": {"object": {"id": "sub_1", "customer": "cus_1"}}})
    assert o["status"] == "suspended"
    # Un aviso de una empresa desconocida no toca nada.
    r = await server._stripe_aplicar_evento({"id": "evt_5", "type": "checkout.session.completed",
                                             "data": {"object": {"mode": "subscription", "metadata": {"org_id": "nadie"}}}})
    assert r == {"ok": True, "aplicado": False}


class _Req:
    def __init__(self, raw, firma):
        self._raw = raw
        self.headers = {"Stripe-Signature": firma}

    async def body(self):
        return self._raw


def _firma(raw, secreto):
    ts = int(time.time())
    mac = hmac.new(secreto.encode(), str(ts).encode() + b"." + raw, hashlib.sha256).hexdigest()
    return "t=%d,v1=%s" % (ts, mac)


@pytest.mark.asyncio(loop_scope="session")
async def test_webhook_sin_firma_no_y_repetido_no_aplica_dos_veces(base, monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET_SUSCRIPCIONES", "whsec_test")
    raw = json.dumps({"id": "evt_9", "type": "checkout.session.completed", "data": {"object": {
        "mode": "subscription", "customer": "cus_9", "subscription": "sub_9", "metadata": {"org_id": "o1"}}}}).encode()
    with pytest.raises(HTTPException) as e:
        await server.stripe_suscripciones_webhook(_Req(raw, "t=1,v1=mal"))
    assert e.value.status_code == 401
    r = await server.stripe_suscripciones_webhook(_Req(raw, _firma(raw, "whsec_test")))
    assert r["aplicado"] is True

    class ColUnica(Col):
        async def insert_one(self, doc):
            if any(d.get("_id") == doc.get("_id") for d in self.docs):
                raise Exception("duplicado")
            return await super().insert_one(doc)
    base.g["stripe_events"] = ColUnica(base.g["stripe_events"].docs)
    r = await server.stripe_suscripciones_webhook(_Req(raw, _firma(raw, "whsec_test")))
    assert r == {"ok": True, "repetido": True}
