# -*- coding: utf-8 -*-
"""El cobro del plan Repartidor (04-10-2026): la prueba vence de verdad, la
prueba con tarjeta, el bloqueo (solo a quien reparte solo), pasar a anual y
los regalos con todas sus vueltas."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import server
from base_de_mentira import Col, Db

YO = {"sub": "a1", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_o1", "email": "pepe@x.es"}
OTRO = {"sub": "b1", "role": "admin", "name": "Ana", "org_id": "o2", "db_name": "dsp_o2", "email": "ana@x.es"}


def _iso(dias):
    return (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat()


@pytest.fixture
def base(monkeypatch):
    g = Db()
    g["organizations"] = Col([
        {"id": "o1", "name": "Pepe", "account_type": "dsp", "db_name": "dsp_o1", "status": "trial",
         "plan": "autonomo", "sector": "autonomo", "email": "pepe@x.es", "trial_ends": _iso(5)},
        {"id": "o2", "name": "Ana", "account_type": "dsp", "db_name": "dsp_o2", "status": "trial",
         "plan": "autonomo", "sector": "autonomo", "email": "ana@x.es", "trial_ends": _iso(6)},
        {"id": "e1", "name": "Súper", "account_type": "dsp", "db_name": "dsp_e1", "status": "trial",
         "plan": "completo", "sector": "supermercado", "trial_ends": _iso(-3)},
    ])
    g["regalos"] = Col([])
    monkeypatch.setattr(server, "global_db", g)

    async def org(_id):
        return await g.organizations.find_one({"id": _id}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)

    async def audit(*a, **k):
        return None
    monkeypatch.setattr(server, "_audit", audit)
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.setenv("STRIPE_PRICE_AUTONOMO", "price_mes")
    monkeypatch.setenv("STRIPE_PRICE_AUTONOMO_ANNUAL", "price_ano")
    llamadas = []
    respuestas = {}

    async def req(metodo, ruta, datos=None):
        llamadas.append((metodo, ruta, datos))
        r = respuestas.get((metodo, ruta))
        if isinstance(r, Exception):
            raise r
        return r if r is not None else {"id": "cs_1", "url": "https://checkout.stripe.com/c/cs_1"}
    monkeypatch.setattr(server, "_stripe_req", req)
    return SimpleNamespace(g=g, llamadas=llamadas, respuestas=respuestas, org=lambda i: next(o for o in g["organizations"].docs if o["id"] == i))


# ── La prueba vence de verdad ────────────────────────────────────────────────
def test_la_prueba_vencida_se_nota_y_bloquea_solo_al_repartidor(base):
    o = base.org("o1")
    o["trial_ends"] = _iso(-0.1)
    b = server._org_billing(o)
    assert b["required"] is True and b["days_left"] == 0
    assert "prueba gratis ha terminado" in server._rep_bloqueo_pago(o)
    assert server._rep_bloqueo_pago(base.org("e1")) == ""          # una empresa no se bloquea por aquí
    o["trial_ends"] = _iso(2)
    assert server._org_billing(o)["required"] is False and server._rep_bloqueo_pago(o) == ""


def test_prueba_con_tarjeta_pide_tarjeta_hasta_tenerla(base, monkeypatch):
    o = base.org("o1")
    o["prueba_con_tarjeta"] = True
    assert server._falta_tarjeta(o) and "Añade tu tarjeta" in server._rep_bloqueo_pago(o)
    o["pagado_hasta"] = _iso(20)                                   # un regalo vale como tarjeta
    assert not server._falta_tarjeta(o)
    o.pop("pagado_hasta")
    o["stripe_subscription"] = "sub_1"
    assert not server._falta_tarjeta(o)
    o.pop("stripe_subscription")
    monkeypatch.delenv("STRIPE_PRICE_AUTONOMO")
    monkeypatch.delenv("STRIPE_PRICE_AUTONOMO_ANNUAL")
    assert not server._falta_tarjeta(o)                            # sin Stripe listo no se deja fuera a nadie


@pytest.mark.asyncio(loop_scope="session")
async def test_el_bloqueo_salta_al_escribir_en_el_reparto_y_no_al_leer(base, monkeypatch):
    async def ficha(sub):
        return sub
    monkeypatch.setattr(server, "_ficha_activa_de", ficha)
    base.org("o1")["trial_ends"] = _iso(-1)
    token = server.create_token("d1", "driver", "Pepe", org_id="o1", db_name="dsp_o1", account_type="dsp")
    cred = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    def peticion(metodo, ruta):
        return SimpleNamespace(method=metodo, url=SimpleNamespace(path=ruta), headers={}, client=None)
    with pytest.raises(HTTPException) as e:
        await server.get_current_user(peticion("POST", "/api/reparto/mis-pedidos"), cred)
    assert e.value.status_code == 402 and "Suscríbete" in e.value.detail
    u = await server.get_current_user(peticion("GET", "/api/reparto/mi-ruta"), cred)
    assert u["sub"] == "d1"
    # Una empresa con la prueba vencida no se bloquea por aquí.
    t2 = server.create_token("d2", "driver", "Luis", org_id="e1", db_name="dsp_e1", account_type="dsp")
    u2 = await server.get_current_user(peticion("POST", "/api/reparto/mis-pedidos"),
                                       HTTPAuthorizationCredentials(scheme="Bearer", credentials=t2))
    assert u2["sub"] == "d2"


# ── Suscribirse respeta prueba y regalo ──────────────────────────────────────
@pytest.mark.asyncio(loop_scope="session")
async def test_suscribirse_con_regalo_en_vigor_cobra_al_acabar_el_regalo(base):
    o = base.org("o1")
    o.update({"status": "active", "pago_proveedor": "regalo", "pagado_hasta": _iso(40)})
    await server.stripe_suscripcion({"plan": "autonomo", "anual": True}, YO)
    d = base.llamadas[-1][2]
    assert d["line_items[0][price]"] == "price_ano"
    assert abs(d["subscription_data[trial_end]"] - (datetime.now(timezone.utc) + timedelta(days=40)).timestamp()) < 60
    # Con menos de 48 h de prueba por delante, se cobra al suscribirse.
    o.update({"status": "trial", "trial_ends": _iso(1), "pagado_hasta": None})
    await server.stripe_suscripcion({"plan": "autonomo"}, YO)
    assert "subscription_data[trial_end]" not in base.llamadas[-1][2]
    assert server._stripe_inicio_cobro(o) is None


@pytest.mark.asyncio(loop_scope="session")
async def test_pasar_de_mensual_a_anual(base):
    base.org("o1").update({"status": "active", "pago_proveedor": "stripe", "stripe_subscription": "sub_1"})
    base.respuestas[("GET", "/subscriptions/sub_1")] = {"id": "sub_1", "status": "active",
                                                        "items": {"data": [{"id": "si_1", "price": {"id": "price_mes"}}]}}
    base.respuestas[("POST", "/subscriptions/sub_1")] = {
        "id": "sub_1", "status": "active", "items": {"data": [{"id": "si_1", "price": {"id": "price_ano", "recurring": {"interval": "year"}},
                                                               "current_period_end": 1893456000}]}}
    r = await server.stripe_cambiar_plan({"anual": True}, YO)
    _, ruta, d = base.llamadas[-1]
    assert ruta == "/subscriptions/sub_1" and d["items[0][price]"] == "price_ano" and d["proration_behavior"] == "create_prorations"
    assert r["stripe_intervalo"] == "anual" and base.org("o1")["stripe_proximo_cobro"].startswith("2030-01-01")
    base.respuestas[("GET", "/subscriptions/sub_1")]["items"]["data"][0]["price"]["id"] = "price_ano"
    with pytest.raises(HTTPException) as e:
        await server.stripe_cambiar_plan({"anual": True}, YO)
    assert e.value.status_code == 400


# ── Regalos ──────────────────────────────────────────────────────────────────
async def _regalo_pagado(base, meses=1):
    r = await server.regalo_comprar({"meses": meses}, YO)
    _, ruta, d = base.llamadas[-1]
    assert ruta == "/checkout/sessions" and d["mode"] == "payment"
    assert d["line_items[0][price_data][unit_amount]"] == (999 if meses == 1 else 9900)
    assert d["metadata[tipo]"] == "regalo" and d["success_url"].endswith(f"/ruta?regalo={r['id']}")
    reg = base.g["regalos"].docs[-1]
    assert reg["estado"] == "pendiente_pago"
    # Sin pagar no vale.
    assert (await server.regalo_ver(reg["codigo"]))["estado"] == "no_existe"
    ev = {"type": "checkout.session.completed", "data": {"object": {
        "mode": "payment", "payment_status": "paid", "payment_intent": "pi_1",
        "metadata": {"tipo": "regalo", "regalo_id": r["id"], "org_id": "o1"}}}}
    assert (await server._stripe_aplicar_evento(ev))["aplicado"] is True
    assert (await server._stripe_aplicar_evento(ev))["aplicado"] is False   # el aviso repetido no hace nada
    return reg


@pytest.mark.asyncio(loop_scope="session")
async def test_regalar_un_mes_y_canjearlo_sin_tarjeta(base):
    reg = await _regalo_pagado(base)
    codigo = reg["codigo"]
    assert len(codigo) == 8 and not set(codigo) & set("01IO")
    assert await server.regalo_ver(codigo.lower()) == {"estado": "pagado", "meses": 1}
    mios = (await server.regalo_mios(YO))["regalos"]
    assert mios[0]["codigo"] == codigo and mios[0]["estado"] == "pagado"
    # Ana, en prueba con 6 días, lo canjea (con guion y minúsculas): pagado hasta fin de prueba + 1 mes.
    fin_prueba = server._fecha_utc(base.org("o2")["trial_ends"])
    r = await server.regalo_canjear({"codigo": f"{codigo[:4].lower()}-{codigo[4:]}"}, OTRO)
    o2 = base.org("o2")
    assert o2["status"] == "active" and o2["pago_proveedor"] == "regalo"
    assert server._fecha_utc(o2["pagado_hasta"]) == server._sumar_meses(fin_prueba, 1)
    assert "pagada hasta" in r["mensaje"]
    assert server._rep_bloqueo_pago(o2) == ""
    # Segunda vez: ya usado. Y el comprador ve que se ha usado (no por quién).
    with pytest.raises(HTTPException) as e:
        await server.regalo_canjear({"codigo": codigo}, YO)
    assert e.value.status_code == 409
    mio = (await server.regalo_mios(YO))["regalos"][0]
    assert mio["estado"] == "canjeado" and "canjeado_por" not in mio
    # Pasado el regalo, se acaba.
    o2["pagado_hasta"] = _iso(-1)
    assert server._org_billing(o2)["status"] == "vencido" and "regalo ha terminado" in server._rep_bloqueo_pago(o2)


@pytest.mark.asyncio(loop_scope="session")
async def test_canjes_que_no_valen(base):
    for codigo, esperado in (("", 404), ("ZZZZZZZZ", 404)):
        with pytest.raises(HTTPException) as e:
            await server.regalo_canjear({"codigo": codigo}, YO)
        assert e.value.status_code == esperado
    reg = await _regalo_pagado(base)
    # Una empresa (no Repartidor) no lo puede usar.
    with pytest.raises(HTTPException) as e:
        await server.regalo_canjear({"codigo": reg["codigo"]}, {**YO, "org_id": "e1"})
    assert e.value.status_code == 400
    # Caducado.
    reg["caduca_en"] = _iso(-1)
    assert (await server.regalo_ver(reg["codigo"]))["estado"] == "caducado"
    with pytest.raises(HTTPException) as e:
        await server.regalo_canjear({"codigo": reg["codigo"]}, YO)
    assert e.value.status_code == 410
    # Demo y plataforma no compran ni canjean.
    for u in ({**YO, "demo": True}, {**YO, "imp": True}):
        with pytest.raises(HTTPException):
            await server.regalo_comprar({"meses": 1}, u)
        with pytest.raises(HTTPException):
            await server.regalo_canjear({"codigo": "X"}, u)
    with pytest.raises(HTTPException):
        await server.regalo_comprar({"meses": 3}, YO)


@pytest.mark.asyncio(loop_scope="session")
async def test_canjear_con_tarjeta_retrasa_el_proximo_cobro(base):
    reg = await _regalo_pagado(base, meses=12)
    base.org("o2").update({"status": "active", "pago_proveedor": "stripe", "stripe_subscription": "sub_9"})
    prox = int((datetime.now(timezone.utc) + timedelta(days=10)).timestamp())
    base.respuestas[("GET", "/subscriptions/sub_9")] = {"id": "sub_9", "status": "active", "current_period_end": prox}
    base.respuestas[("POST", "/subscriptions/sub_9")] = {"id": "sub_9", "status": "trialing", "trial_end": prox + 365 * 86400}
    r = await server.regalo_canjear({"codigo": reg["codigo"]}, OTRO)
    _, ruta, d = base.llamadas[-1]
    esperado = server._sumar_meses(datetime.fromtimestamp(prox, tz=timezone.utc), 12)
    assert ruta == "/subscriptions/sub_9" and d["trial_end"] == int(esperado.timestamp()) and d["proration_behavior"] == "none"
    assert "próximo cobro" in r["mensaje"] and base.org("o2")["stripe_status"] == "trialing"


@pytest.mark.asyncio(loop_scope="session")
async def test_si_stripe_falla_el_regalo_no_se_pierde(base):
    reg = await _regalo_pagado(base)
    base.org("o2").update({"status": "active", "pago_proveedor": "stripe", "stripe_subscription": "sub_9"})
    base.respuestas[("GET", "/subscriptions/sub_9")] = HTTPException(502, "Stripe no responde")
    with pytest.raises(HTTPException):
        await server.regalo_canjear({"codigo": reg["codigo"]}, OTRO)
    assert reg["estado"] == "pagado" and "canjeado_por" not in reg


@pytest.mark.asyncio(loop_scope="session")
async def test_acabar_la_suscripcion_no_corta_un_regalo_en_vigor(base):
    o = base.org("o1")
    o.update({"status": "active", "pago_proveedor": "stripe", "stripe_customer": "cus_1", "pagado_hasta": _iso(30)})
    await server._stripe_aplicar_evento({"type": "customer.subscription.deleted",
                                         "data": {"object": {"id": "sub_1", "customer": "cus_1"}}})
    assert o["status"] == "active" and o["pago_proveedor"] == "regalo"
    o["pagado_hasta"] = None
    await server._stripe_aplicar_evento({"type": "customer.subscription.deleted",
                                         "data": {"object": {"id": "sub_1", "customer": "cus_1"}}})
    assert o["status"] == "suspended"


def test_sumar_meses_respeta_fin_de_mes():
    d = datetime(2026, 1, 31, tzinfo=timezone.utc)
    assert server._sumar_meses(d, 1) == datetime(2026, 2, 28, tzinfo=timezone.utc)
    assert server._sumar_meses(d, 12) == datetime(2027, 1, 31, tzinfo=timezone.utc)
    assert server._sumar_meses(datetime(2026, 11, 15, tzinfo=timezone.utc), 3) == datetime(2027, 2, 15, tzinfo=timezone.utc)


@pytest.mark.asyncio(loop_scope="session")
async def test_un_regalo_devuelto_deja_de_valer(base):
    reg = await _regalo_pagado(base)
    assert reg["stripe_pago"] == "pi_1"
    await server._stripe_aplicar_evento({"type": "charge.refunded", "data": {"object": {"payment_intent": "pi_1"}}})
    assert reg["estado"] == "anulado"
    assert (await server.regalo_ver(reg["codigo"]))["estado"] == "no_existe"
    with pytest.raises(HTTPException) as e:
        await server.regalo_canjear({"codigo": reg["codigo"]}, OTRO)
    assert e.value.status_code == 404


@pytest.mark.asyncio(loop_scope="session")
async def test_pagar_el_anio_de_una_vez_para_uno_mismo(base):
    """China (Alipay/WeChat Pay sin cobro mensual): el año de una vez es un
    regalo para la propia cuenta; vuelve con ?regalo_propio= y se canjea."""
    r = await server.regalo_comprar({"meses": 12, "para_mi": True}, YO)
    _, ruta, d = base.llamadas[-1]
    assert ruta == "/checkout/sessions" and d["mode"] == "payment" and d["locale"] == "auto"
    assert d["success_url"].endswith(f"/ruta?regalo_propio={r['id']}")
    assert "Regalo" not in d["line_items[0][price_data][product_data][name]"]
    reg = base.g["regalos"].docs[-1]
    assert reg["para_mi"] is True and reg["meses"] == 12
    ev = {"type": "checkout.session.completed", "data": {"object": {
        "mode": "payment", "payment_status": "paid", "payment_intent": "pi_9",
        "metadata": {"tipo": "regalo", "regalo_id": r["id"], "org_id": "o1"}}}}
    assert (await server._stripe_aplicar_evento(ev))["aplicado"] is True
    hecho = await server.regalo_canjear({"codigo": reg["codigo"]}, YO)
    assert hecho["ok"] is True


# ── PRUEBA SIN TARJETA POR DEFECTO (04-10-2026) ─────────────────────────────
# Con tarjeta, 400 visitas de anuncio dieron 0 altas. Ahora quien reparte solo
# entra directo; la tarjeta se pide al acabar los 7 días (el muro de siempre).

async def _alta_autonomo(monkeypatch, env):
    g = Db()
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "_ensure_tenant_indexes", lambda *a, **k: _nada())
    if env is None:
        monkeypatch.delenv("PRUEBA_CON_TARJETA", raising=False)
    else:
        monkeypatch.setenv("PRUEBA_CON_TARJETA", env)
    monkeypatch.setattr(server, "_stripe_suscripciones_listo", lambda: True)
    req = SimpleNamespace(headers={}, client=SimpleNamespace(host="198.51.100.7"))
    datos = server.RegisterRequest(org_name="Rosa Reparte", username="rosa-reparte", password="12345678",
                                   slug="rosa-reparte", sector="autonomo", email="rosa@x.es")
    out = await server.register_dsp(datos, req)
    org = g["organizations"].docs[0]
    return out, org


async def _nada():
    return None


@pytest.mark.asyncio(loop_scope="session")
async def test_alta_de_repartidor_ya_no_pide_tarjeta_por_defecto(monkeypatch):
    out, org = await _alta_autonomo(monkeypatch, None)
    assert out.access_token
    assert org["status"] == "trial" and org["plan"] == "autonomo"
    assert not org.get("prueba_con_tarjeta")
    # Entra directo: ni muro de tarjeta ni bloqueo, y tiene sus días de prueba.
    assert server._falta_tarjeta(org) is False
    assert server._rep_bloqueo_pago(org) == ""
    fin = datetime.fromisoformat(org["trial_ends"])
    assert 6 <= (fin - datetime.now(timezone.utc)).days <= 7


@pytest.mark.asyncio(loop_scope="session")
async def test_la_prueba_sin_tarjeta_se_corta_al_acabar_los_dias(monkeypatch):
    _, org = await _alta_autonomo(monkeypatch, None)
    org["trial_ends"] = _iso(-1)     # el día 8
    assert "prueba gratis ha terminado" in server._rep_bloqueo_pago(org)


@pytest.mark.asyncio(loop_scope="session")
async def test_con_el_interruptor_la_tarjeta_vuelve(monkeypatch):
    _, org = await _alta_autonomo(monkeypatch, "1")
    assert org["prueba_con_tarjeta"] is True
    assert server._falta_tarjeta(org) is True
