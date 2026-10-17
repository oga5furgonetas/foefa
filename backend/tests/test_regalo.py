# -*- coding: utf-8 -*-
"""Regalo de saldo (17-10-2026). Dani: «añádeles 10 € de saldo a todo el mundo para que vea que es real».
Lo que se vigila: que llegue a cada cuenta del plan Repartidor una sola vez (aunque se repita la orden), que no
llegue a quien no puede cobrarlo (China, demo, la cuenta del dueño, las empresas), que el bono de la primera
ruta siga aparte, y que se vea: en la cartera, en el correo de opinión y en Negocio al revisar un cobro."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import ciclo_correos as cc
import server
from base_de_mentira import Col, Db

YO = {"sub": "a1", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_o1", "email": "pepe@x.es"}


def _iso(dias):
    return (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat()


def _rep(id_, **extra):
    o = {"id": id_, "name": id_, "account_type": "dsp", "db_name": f"dsp_{id_}", "status": "trial",
         "plan": "autonomo", "sector": "autonomo", "email": f"{id_}@x.es", "pais": "es", "created_at": _iso(-3)}
    o.update(extra)
    return o


@pytest.fixture
def mundo(monkeypatch):
    g = Db()
    g["organizations"] = Col([
        _rep("o1"), _rep("o2", cartera_saldo=2000, cartera_ganado=2000),
        _rep("cn", pais="cn"), _rep("demo", demo=True), _rep("dueno", account_type="owner"),
        _rep("empresa", plan="completo", sector="supermercado"),
        _rep("plan_solo", sector=""),                                   # plan autónomo sin sector: también
    ])
    g["cartera_movimientos"] = Col([])
    g["cartera_retiradas"] = Col([])
    t = Db()
    t["reparto_pedidos"] = Col([])
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "_ensure_tenant_indexes", lambda *a, **k: _nada())

    async def org(_id):
        return await g.organizations.find_one({"id": _id}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)
    return SimpleNamespace(g=g, t=t)


async def _nada():
    return None


def _org(mundo, id_):
    return next(o for o in mundo.g["organizations"].docs if o["id"] == id_)


@pytest.mark.asyncio(loop_scope="session")
async def test_diez_euros_a_cada_repartidor_una_sola_vez(mundo):
    r = await server._regalo_a_todos("2026-10-17", 1000)
    assert r == {"cuentas": 3, "ya_tenian": 0, "dados": 3, "cent": 1000}
    assert _org(mundo, "o1")["cartera_saldo"] == 1000 and _org(mundo, "o1")["cartera_ganado"] == 1000
    assert _org(mundo, "o2")["cartera_saldo"] == 3000                      # se suma a lo que ya tenía
    assert _org(mundo, "plan_solo")["cartera_saldo"] == 1000
    for nadie in ("cn", "demo", "dueno", "empresa"):
        assert "cartera_saldo" not in _org(mundo, nadie) and "regalos" not in _org(mundo, nadie)
    movs = mundo.g["cartera_movimientos"].docs
    assert len(movs) == 3 and {m["tipo"] for m in movs} == {"regalo"} and {m["importe"] for m in movs} == {1000}
    # La misma orden otra vez no da nada (ni aunque se lance dos veces).
    r2 = await server._regalo_a_todos("2026-10-17", 1000)
    assert r2["dados"] == 0 and r2["ya_tenian"] == 3
    assert _org(mundo, "o1")["cartera_saldo"] == 1000 and len(mundo.g["cartera_movimientos"].docs) == 3


@pytest.mark.asyncio(loop_scope="session")
async def test_simular_solo_cuenta(mundo):
    r = await server._regalo_a_todos("2026-10-17", 1000, simular=True)
    assert r["simulado"] is True and r["cuentas"] == 3 and r["dados"] == 0
    assert "cartera_saldo" not in _org(mundo, "o1") and mundo.g["cartera_movimientos"].docs == []


@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("clave,cent", [("2026-10-17", 0), ("2026-10-17", 2001), ("x", 1000), ("Con espacios", 1000)])
async def test_un_error_al_teclear_no_regala_nada(mundo, clave, cent):
    with pytest.raises(HTTPException) as e:
        await server.admin_cartera_regalo({"clave": clave, "cent": cent}, {})
    assert e.value.status_code == 400 and mundo.g["cartera_movimientos"].docs == []


@pytest.mark.asyncio(loop_scope="session")
async def test_la_cartera_lo_dice_y_el_bono_sigue_aparte(mundo):
    await server._regalo_a_todos("2026-10-17", 1000)
    r = await server.referidos_mios(YO)
    assert r["saldo"] == 1000 and r["regalo"] == 1000 and r["regalo_clave"] == "2026-10-17"
    assert r["bono"] and r["bono"]["pagado"] is False                    # la primera ruta sigue dando su bono
    _org(mundo, "o2").pop("regalos")
    r2 = await server.referidos_mios({**YO, "org_id": "o2"})
    assert r2["regalo"] == 0 and r2["regalo_clave"] == ""


@pytest.mark.asyncio(loop_scope="session")
async def test_negocio_ve_que_parte_del_saldo_no_viene_de_invitar(mundo):
    await server._regalo_a_todos("2026-10-17", 1000)
    _org(mundo, "o1").update(bono_pagado=True, bono_cent=1000)
    mundo.g["cartera_retiradas"].docs.append({"id": "r1", "org_id": "o1", "org": "o1", "estado": "pendiente",
                                              "importe": 6000, "creada": _iso(0)})
    r = (await server.admin_cartera_retiradas("pendiente", {}))["retiradas"][0]
    assert r["sin_invitar"] == [{"que": "Regalo", "cent": 1000}, {"que": "Bono de bienvenida", "cent": 1000}]


@pytest.mark.parametrize("idioma", cc.IDIOMAS)
def test_el_correo_de_opinion_dice_el_regalo(idioma):
    org = {"id": "o1", "name": "Pepe", "sector": "autonomo", "plan": "autonomo", "status": "trial",
           "email": "p@x.es", "pais": "es", "idioma": idioma, "created_at": "2026-10-08T08:00:00+00:00"}
    ahora = datetime(2026, 10, 18, 8, 0, tzinfo=timezone.utc)
    kw = dict(marca="FDS", base="https://flotadsp.com", baja="https://b", mensual=9.99, anual=99, con_respuesta=True,
              opinion_url="https://flotadsp.com/opinion?o=o1&t=abc")
    con = cc.correo("opinion", org, {"paradas": 0}, ahora, regalo_cent=1000, **kw)["texto"]
    sin = cc.correo("opinion", org, {"paradas": 0}, ahora, **kw)["texto"]
    assert "10 €" in con and "10 €" not in sin and "{" not in con
    assert con.index("10 €") > con.index("m=otro")                         # después de las opciones
