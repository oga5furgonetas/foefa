# -*- coding: utf-8 -*-
"""Plan gratis del repartidor (10-10-2026): sin pagar, la app sigue con un tope de paradas
nuevas al día; las de ejemplo no cuentan; pagando, o siendo empresa, no hay tope.
Y la promoción: hasta REP_GRATIS_HASTA nadie tiene tope (las pruebas del tope la apagan)."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

YO = {"sub": "a1", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_o1"}
HOY = "2026-10-10"


def _iso(dias):
    return (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat()


@pytest.fixture(autouse=True)
def sin_promocion(monkeypatch):
    """Lo de después de la promoción: el tope de siempre."""
    monkeypatch.setattr(server, "REP_GRATIS_HASTA", "")


@pytest.fixture
def base(monkeypatch):
    g = Db()
    g["organizations"] = Col([
        {"id": "o1", "name": "Pepe", "account_type": "dsp", "db_name": "dsp_o1", "status": "trial",
         "plan": "autonomo", "sector": "autonomo", "trial_ends": _iso(-1)},            # prueba acabada
        {"id": "e1", "name": "Súper", "account_type": "dsp", "db_name": "dsp_e1", "status": "trial",
         "plan": "reparto", "sector": "supermercado", "trial_ends": _iso(-3)},
    ])
    monkeypatch.setattr(server, "global_db", g)
    t = Db()
    t["reparto_pedidos"] = Col([])
    t["reparto_ajustes"] = Col([])
    t["reparto_zonas"] = Col([])
    t["drivers"] = Col([])
    monkeypatch.setattr(server, "db", t)

    async def org(_id):
        return await g.organizations.find_one({"id": _id}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)
    monkeypatch.setattr(server, "REP_GRATIS_PARADAS_DIA", 3)

    async def sin_mapa(*a, **k):
        return None
    monkeypatch.setattr(server, "_rep_ubicar", sin_mapa)
    return g, t


def _org(g, i):
    return next(o for o in g["organizations"].docs if o["id"] == i)


@pytest.mark.asyncio(loop_scope="session")
async def test_sin_pagar_entran_las_paradas_del_tope_y_la_siguiente_no(base):
    g, t = base
    for n in range(3):
        await server._rep_nuevo({"direccion": f"Rúa Real {n + 1}"}, YO, "conductor", HOY)
    with pytest.raises(HTTPException) as e:
        await server._rep_nuevo({"direccion": "Rúa Real 9"}, YO, "conductor", HOY)
    assert e.value.status_code == 402 and e.value.detail == server.REP_TOPE_MENSAJE
    assert await t.reparto_pedidos.count_documents({}) == 3
    # Otro día vuelve a tener sus paradas gratis.
    await server._rep_nuevo({"direccion": "Rúa Real 9"}, YO, "conductor", "2026-10-11")


@pytest.mark.asyncio(loop_scope="session")
async def test_las_de_ejemplo_no_cuentan(base):
    g, t = base
    await t.reparto_pedidos.insert_one({"id": "x1", "fecha": HOY, "ejemplo": True})
    await t.reparto_pedidos.insert_one({"id": "x2", "fecha": HOY, "ejemplo": True})
    assert await server._rep_quedan_gratis(YO, HOY) == 3


@pytest.mark.asyncio(loop_scope="session")
async def test_en_prueba_pagando_o_siendo_empresa_no_hay_tope(base):
    g, t = base
    o = _org(g, "o1")
    o["trial_ends"] = _iso(3)                                       # aún en la prueba
    assert await server._rep_quedan_gratis(YO, HOY) is None
    o.update({"status": "active", "pago_proveedor": "stripe", "stripe_subscription": "sub_1"})
    assert await server._rep_quedan_gratis(YO, HOY) is None
    empresa = {"sub": "b1", "role": "admin", "org_id": "e1"}
    assert await server._rep_quedan_gratis(empresa, HOY) is None    # el súper no va por aquí
    assert await server._rep_quedan_gratis({**YO, "imp": True}, HOY) is None


@pytest.mark.asyncio(loop_scope="session")
async def test_un_regalo_vencido_tambien_pasa_al_plan_gratis(base):
    g, t = base
    _org(g, "o1").update({"status": "active", "pago_proveedor": "regalo", "pagado_hasta": _iso(-2)})
    assert await server._rep_quedan_gratis(YO, HOY) == 3


@pytest.mark.asyncio(loop_scope="session")
async def test_pegar_una_lista_entra_hasta_el_tope_y_dice_cuantas_se_quedan(base, monkeypatch):
    g, t = base

    async def autonomo(_u):
        return True

    async def conductor(_u):
        return {"id": "d1", "name": "Pepe"}

    async def nada(*a, **k):
        return None
    monkeypatch.setattr(server, "_rep_es_autonomo", autonomo)
    monkeypatch.setattr(server, "_rep_conductor", conductor)
    monkeypatch.setattr(server, "_rep_ubicar_pendientes", nada)
    monkeypatch.setattr(server, "_rep_ve_datos", lambda u: True)
    monkeypatch.setattr(server, "_dia_negocio", lambda: HOY)
    texto = "Cliente;Dirección\nA;Rúa Real 1\nB;Rúa Real 2\nC;Rúa Real 3\nD;Rúa Real 4\nE;Rúa Real 5\n"
    r = await server.reparto_pegar({"texto": texto, "confirmar": True, "fecha": HOY}, YO)
    assert r["creados"] == 3 and r["sin_hueco"] == 2
    with pytest.raises(HTTPException) as e:
        await server.reparto_pegar({"texto": texto, "confirmar": True, "fecha": HOY}, YO)
    assert e.value.status_code == 402


def test_el_plan_dice_lo_del_gratis():
    assert server._rep_sin_ilimitado({"plan": "autonomo", "status": "trial", "trial_ends": _iso(-1)})
    assert not server._rep_sin_ilimitado({"plan": "autonomo", "status": "trial", "trial_ends": _iso(2)})
    assert not server._rep_sin_ilimitado({"plan": "completo", "status": "trial", "trial_ends": _iso(-1)})
    assert not server._rep_sin_ilimitado({"plan": "autonomo", "account_type": "owner"})


@pytest.mark.asyncio(loop_scope="session")
async def test_con_la_promocion_nadie_tiene_tope_y_la_app_lo_sabe(base, monkeypatch):
    """«Gratis y sin límite hasta el 31 de diciembre»: ni tope de paradas ni plan gratis; el
    día siguiente vuelve el tope."""
    monkeypatch.setattr(server, "REP_GRATIS_HASTA", "2099-12-31")
    acabada = {"plan": "autonomo", "status": "trial", "trial_ends": _iso(-1)}
    assert server._rep_sin_ilimitado(acabada) is False
    assert await server._rep_quedan_gratis(YO, HOY) is None
    for i in range(5):                                          # más que el tope (3)
        await server._rep_nuevo({"direccion": f"Rúa Real {i}"}, YO, "conductor", HOY)
    b = await server.org_billing(YO)
    assert b["promo"] == {"activa": True, "hasta": "2099-12-31"} and b["gratis"]["activo"] is False
    monkeypatch.setattr(server, "REP_GRATIS_HASTA", "2000-01-01")
    assert server._rep_sin_ilimitado(acabada) is True
    assert (await server.org_billing(YO))["promo"]["activa"] is False


def test_la_fecha_de_la_promocion_se_dice_en_castellano():
    assert server._fecha_larga("2026-12-31") == "31 de diciembre"
