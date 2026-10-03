# -*- coding: utf-8 -*-
"""La demo de reparto: se prepara sola cada día, deja entrar a la oficina y a
tres repartidores, y solo permite escribir en lo del reparto."""
from types import SimpleNamespace

import pytest

import server
from base_de_mentira import Db


class _Peticion:
    def __init__(self, path="/api/auth/demo-reparto", method="POST"):
        self.url = SimpleNamespace(path=path)
        self.method = method
        self.headers = {}
        self.client = SimpleNamespace(host="1.2.3.4")


@pytest.fixture
def base(monkeypatch):
    bases = {}

    class Cliente(dict):
        def __getitem__(self, nombre):
            return bases.setdefault(nombre, Db())

    dia = {"hoy": "2026-10-03"}
    monkeypatch.setattr(server, "client", Cliente())
    monkeypatch.setattr(server, "global_db", Db())
    monkeypatch.setattr(server, "_dia_negocio", lambda: dia["hoy"])
    monkeypatch.setattr(server, "_rl_public_action", lambda *a, **k: None)
    return SimpleNamespace(bases=bases, dia=dia)


@pytest.mark.asyncio(loop_scope="session")
async def test_la_demo_se_prepara_una_vez_al_dia(base):
    r = await server.demo_reparto_login(_Peticion(), {})
    assert r["role"] == "admin" and r["demo"]
    ddb = base.bases["dsp_demo_reparto"]
    assert len(ddb["reparto_pedidos"].docs) == len(server._DEMO_REP_PEDIDOS)
    assert len(ddb["drivers"].docs) == 3
    org = await server.global_db.organizations.find_one({"id": "demo-reparto"})
    assert "reparto" in org["modulos"] and org["sector"] == "supermercado"
    # Lo que haga un visitante se queda hasta el día siguiente...
    ddb["reparto_pedidos"].docs[0]["estado"] = "entregado"
    await server.demo_reparto_login(_Peticion(), {"rol": "conductor", "n": 2})
    assert ddb["reparto_pedidos"].docs[0]["estado"] == "entregado"
    # ...y al cambiar de día vuelve a empezar.
    base.dia["hoy"] = "2026-10-04"
    await server.demo_reparto_login(_Peticion(), {})
    assert {p["estado"] for p in ddb["reparto_pedidos"].docs} == {"pendiente"}
    assert {p["fecha"] for p in ddb["reparto_pedidos"].docs} == {"2026-10-04"}


@pytest.mark.asyncio(loop_scope="session")
async def test_el_repartidor_de_prueba_lleva_su_token(base):
    r = await server.demo_reparto_login(_Peticion(), {"rol": "conductor", "n": 3})
    p = server.decode_token(r["access_token"])
    assert p["role"] == "driver" and p["sub"] == "demo-r3" and p["demo"]
    assert p["db_name"] == "dsp_demo_reparto"
