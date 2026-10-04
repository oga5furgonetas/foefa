# -*- coding: utf-8 -*-
"""«Invita a un compañero» (05-10-2026): el invitado entra con 14 días; el que
invita gana 1 mes cuando el invitado la usa de verdad (5 entregas, >24 h), con
tope, una sola vez por invitado y sin que cuenten las paradas de ejemplo."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

YO = {"sub": "a1", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_o1", "email": "pepe@x.es"}


def _iso(dias):
    return (datetime.now(timezone.utc) + timedelta(days=dias)).isoformat()


async def _nada():
    return None


@pytest.fixture
def mundo(monkeypatch):
    g = Db()
    g["organizations"] = Col([
        {"id": "o1", "name": "Pepe", "account_type": "dsp", "db_name": "dsp_o1", "status": "trial",
         "plan": "autonomo", "sector": "autonomo", "email": "pepe@x.es", "trial_ends": _iso(3)},
    ])
    t = Db()
    t["reparto_pedidos"] = Col([])
    monkeypatch.setattr(server, "global_db", g)
    monkeypatch.setattr(server, "db", t)
    yield_clear = server._public_actions.clear
    yield_clear()
    monkeypatch.setattr(server, "_ensure_tenant_indexes", lambda *a, **k: _nada())

    async def org(_id):
        return await g.organizations.find_one({"id": _id}, {"_id": 0})
    monkeypatch.setattr(server, "get_org", org)
    return SimpleNamespace(g=g, t=t)


async def _alta(ref=None, sector="autonomo", usuario="rosa-reparte"):
    server._public_actions.clear()      # el límite de altas por IP no es lo que se prueba aquí
    req = SimpleNamespace(headers={}, client=SimpleNamespace(host="198.51.100.7"))
    datos = server.RegisterRequest(org_name="Rosa Reparte", username=usuario, password="12345678",
                                   slug=usuario, sector=sector, email=f"{usuario}@x.es", ref=ref)
    await server.register_dsp(datos, req)


@pytest.mark.asyncio(loop_scope="session")
async def test_mi_enlace_se_crea_una_vez_y_el_codigo_valida(mundo):
    r = await server.referidos_mios(YO)
    assert len(r["codigo"]) == 6 and r["invitados"] == 0 and r["tope"] == 6 and r["dias_extra"] == 7
    assert (await server.referidos_mios(YO))["codigo"] == r["codigo"]
    assert (await server.referidos_valido(r["codigo"].lower()))["valido"] is True
    assert (await server.referidos_valido("NOEXISTE"))["valido"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_el_invitado_entra_con_14_dias_y_queda_ligado(mundo):
    codigo = (await server.referidos_mios(YO))["codigo"]
    await _alta(ref=codigo)
    nuevo = mundo.g["organizations"].docs[-1]
    assert nuevo["referido_por"] == "o1"
    dias = (datetime.fromisoformat(nuevo["trial_ends"]) - datetime.now(timezone.utc)).total_seconds() / 86400
    assert 13.9 < dias < 14.1
    assert (await server.referidos_mios(YO))["invitados"] == 1
    # Sin código o con uno falso: 7 días y sin ligar a nadie. Un código no vale para una empresa.
    await _alta(ref="FALSO1", usuario="otro-uno")
    sin = mundo.g["organizations"].docs[-1]
    assert "referido_por" not in sin
    assert 6.9 < (datetime.fromisoformat(sin["trial_ends"]) - datetime.now(timezone.utc)).total_seconds() / 86400 < 7.1
    await _alta(ref=codigo, sector="supermercado", usuario="super-uno")
    assert "referido_por" not in mundo.g["organizations"].docs[-1]


def _entregas(mundo, n, ejemplo=False):
    for i in range(n):
        mundo.t["reparto_pedidos"].docs.append({"id": f"p{len(mundo.t['reparto_pedidos'].docs)}", "conductor_id": "c1",
                                                "estado": "entregado", **({"ejemplo": True} if ejemplo else {})})


@pytest.mark.asyncio(loop_scope="session")
async def test_el_mes_se_gana_con_uso_real_y_solo_una_vez(mundo):
    codigo = (await server.referidos_mios(YO))["codigo"]
    await _alta(ref=codigo)
    inv = mundo.g["organizations"].docs[-1]
    antes = mundo.g["organizations"].docs[0]["trial_ends"]
    # Cuenta nueva (menos de 24 h): aunque haya 5 entregas, aún no.
    _entregas(mundo, 5)
    await server._referido_premiar(inv, "c1")
    assert not inv.get("ref_premiado")
    # Pasadas 24 h pero con entregas de ejemplo: no cuentan.
    inv["created_at"] = _iso(-2)
    mundo.t["reparto_pedidos"].docs.clear()
    _entregas(mundo, 9, ejemplo=True)
    _entregas(mundo, 4)
    await server._referido_premiar(inv, "c1")
    assert not inv.get("ref_premiado")
    # 5 reales: gana el mes (la cuenta de quien invitó pasa a pagada, +1 mes sobre su prueba).
    _entregas(mundo, 1)
    await server._referido_premiar(inv, "c1")
    assert inv["ref_premiado"] is True
    o1 = mundo.g["organizations"].docs[0]
    assert o1["status"] == "active" and o1["pago_proveedor"] == "regalo" and o1["ref_meses"] == 1
    assert datetime.fromisoformat(o1["pagado_hasta"]) > datetime.fromisoformat(antes) + timedelta(days=27)
    assert (await server.referidos_mios(YO))["premiados"] == 1
    # Una sola vez por invitado.
    hasta = o1["pagado_hasta"]
    await server._referido_premiar(inv, "c1")
    assert o1["pagado_hasta"] == hasta and o1["ref_meses"] == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_tope_de_meses_por_persona(mundo):
    codigo = (await server.referidos_mios(YO))["codigo"]
    for i in range(server._REF_TOPE):
        mundo.g["organizations"].docs.append({"id": f"x{i}", "referido_por": "o1", "ref_premiado": True})
    await _alta(ref=codigo, usuario="el-septimo")
    inv = mundo.g["organizations"].docs[-1]
    inv["created_at"] = _iso(-3)
    _entregas(mundo, 8)
    await server._referido_premiar(inv, "c1")
    assert not inv.get("ref_premiado") and "ref_meses" not in mundo.g["organizations"].docs[0]


@pytest.mark.asyncio(loop_scope="session")
async def test_si_falla_sumar_el_mes_se_reintenta(mundo, monkeypatch):
    codigo = (await server.referidos_mios(YO))["codigo"]
    await _alta(ref=codigo)
    inv = mundo.g["organizations"].docs[-1]
    inv["created_at"] = _iso(-3)
    _entregas(mundo, 6)

    async def roto(*a, **k):
        raise HTTPException(502, "Stripe no contesta")
    monkeypatch.setattr(server, "_aplicar_meses", roto)
    await server._referido_premiar(inv, "c1")
    assert not inv.get("ref_premiado")          # queda sin premiar: la próxima vez lo vuelve a intentar
