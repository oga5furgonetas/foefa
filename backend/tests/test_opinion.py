# -*- coding: utf-8 -*-
"""Opinión de quien ya usa la app (05-10-2026): se pregunta una vez, solo a quien
la ha usado de verdad (entregas reales, más de 20 h de cuenta), y queda guardada."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

YO = {"sub": "a1", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_o1", "email": "pepe@x.es"}


def _iso(dias):
    return (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat()


@pytest.fixture
def mundo(monkeypatch):
    g = Db()
    g["organizations"] = Col([{"id": "o1", "name": "Pepe", "account_type": "dsp", "db_name": "dsp_o1", "status": "trial",
                               "plan": "autonomo", "sector": "autonomo", "email": "pepe@x.es", "created_at": _iso(-2)}])
    g["opiniones_repartidores"] = Col([])
    t = Db()
    t["reparto_pedidos"] = Col([])
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "db", t)

    async def org(_id):
        return await g.organizations.find_one({"id": _id}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)
    return SimpleNamespace(g=g, t=t)


def _entregas(mundo, n, ejemplo=False):
    for _ in range(n):
        mundo.t["reparto_pedidos"].docs.append({"id": f"p{len(mundo.t['reparto_pedidos'].docs)}", "estado": "entregado",
                                                **({"ejemplo": True} if ejemplo else {})})


@pytest.mark.asyncio(loop_scope="session")
async def test_solo_se_pregunta_a_quien_la_usa_de_verdad(mundo):
    assert (await server.opinion_estado(YO))["pedir"] is False            # sin entregas
    _entregas(mundo, 5, ejemplo=True)
    assert (await server.opinion_estado(YO))["pedir"] is False            # las de ejemplo no cuentan
    _entregas(mundo, 2)
    assert (await server.opinion_estado(YO))["pedir"] is True
    mundo.g["organizations"].docs[0]["created_at"] = _iso(0)              # cuenta de hoy mismo
    assert (await server.opinion_estado(YO))["pedir"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_se_guarda_y_no_se_vuelve_a_preguntar(mundo):
    _entregas(mundo, 3)
    assert (await server.opinion_estado(YO))["pedir"] is True
    await server.opinion_enviar({"valor": 4, "texto": "  Me falta poder importar un Excel  "}, YO)
    d = mundo.g["opiniones_repartidores"].docs[0]
    assert d["valor"] == 4 and d["texto"] == "Me falta poder importar un Excel" and d["entregas"] == 3 and d["org_id"] == "o1"
    assert (await server.opinion_estado(YO))["pedir"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_saltar_no_guarda_nada_y_no_insiste(mundo):
    _entregas(mundo, 3)
    await server.opinion_enviar({"saltar": True}, YO)
    assert mundo.g["opiniones_repartidores"].docs == []
    assert (await server.opinion_estado(YO))["pedir"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_vacio_o_demo_se_rechaza(mundo):
    with pytest.raises(HTTPException) as e:
        await server.opinion_enviar({"texto": "   ", "valor": 9}, YO)
    assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e2:
        await server.opinion_enviar({"texto": "hola"}, {**YO, "demo": True})
    assert e2.value.status_code == 403
    assert (await server.opinion_estado({**YO, "demo": True}))["pedir"] is False
