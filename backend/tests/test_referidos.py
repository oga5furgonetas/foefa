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


def _entregas(mundo, n, ejemplo=False, fecha=None):
    hoy = fecha or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for i in range(n):
        mundo.t["reparto_pedidos"].docs.append({"id": f"p{len(mundo.t['reparto_pedidos'].docs)}", "conductor_id": "c1",
                                                "estado": "entregado", "fecha": hoy, **({"ejemplo": True} if ejemplo else {})})


def _dia(n):
    return (datetime.now(timezone.utc) + timedelta(days=n)).strftime("%Y-%m-%d")


SUPER = {"sub": "sa1", "role": "admin", "sa": True}


@pytest.mark.asyncio(loop_scope="session")
async def test_la_cartera_gana_5_euros_con_uso_real_en_dos_dias_y_solo_una_vez(mundo):
    """10-10-2026: por cada invitado que la usa de verdad (20 entregas reales en 2 días
    distintos, en su primer mes), 5 € en la cartera de quien invitó. Desde el 11-10 son
    2,50 €, pero esta cuenta se creó antes del corte (con los anuncios de 5 €): cobra 5 €."""
    mundo.g["organizations"].docs[0]["created_at"] = "2026-10-10T12:00:00+00:00"
    codigo = (await server.referidos_mios(YO))["codigo"]
    await _alta(ref=codigo)
    inv = mundo.g["organizations"].docs[-1]
    assert inv["alta_red"] and "198.51.100.7" not in str(inv)       # la huella, nunca la IP
    _entregas(mundo, 25)
    await server._referido_premiar(inv, "c1")                       # cuenta de menos de 24 h
    assert not inv.get("ref_premiado")
    inv["created_at"] = _iso(-2)
    mundo.t["reparto_pedidos"].docs.clear()
    _entregas(mundo, 30, ejemplo=True)
    _entregas(mundo, 20, fecha=_dia(-1))                            # 20 reales, pero en un solo día
    await server._referido_premiar(inv, "c1")
    assert not inv.get("ref_premiado")
    _entregas(mundo, 1)                                             # otro día: ya está
    await server._referido_premiar(inv, "c1")
    assert inv["ref_premiado"] is True
    o1 = mundo.g["organizations"].docs[0]
    assert o1["cartera_saldo"] == 500 and o1["cartera_ganado"] == 500
    r = await server.referidos_mios(YO)
    assert r["saldo"] == 500 and r["premiados"] == 1 and r["por_invitado"] == 500 and r["retirada_min"] == 1000
    await server._referido_premiar(inv, "c1")                       # una sola vez
    assert o1["cartera_saldo"] == 500 and len(mundo.g["cartera_movimientos"].docs) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_desde_el_corte_cada_invitado_da_2_euros_50(mundo):
    """11-10-2026: las cuentas creadas desde el 12-10 (hora de Madrid) ganan 2,50 €."""
    mundo.g["organizations"].docs[0]["created_at"] = "2026-10-12T08:00:00+00:00"
    codigo = (await server.referidos_mios(YO))["codigo"]
    assert (await server.referidos_mios(YO))["por_invitado"] == 250
    await _alta(ref=codigo)
    inv = mundo.g["organizations"].docs[-1]
    inv["created_at"] = _iso(-2)
    _entregas(mundo, 20, fecha=_dia(-1))
    _entregas(mundo, 1)
    await server._referido_premiar(inv, "c1")
    o1 = mundo.g["organizations"].docs[0]
    assert inv["ref_premiado"] is True and o1["cartera_saldo"] == 250 and o1["cartera_ganado"] == 250
    assert mundo.g["cartera_movimientos"].docs[-1]["importe"] == 250


@pytest.mark.asyncio(loop_scope="session")
async def test_desde_la_misma_red_no_se_paga_solo(mundo):
    mundo.g["organizations"].docs[0]["alta_red"] = server._huella_red("198.51.100.7")
    codigo = (await server.referidos_mios(YO))["codigo"]
    await _alta(ref=codigo)
    inv = mundo.g["organizations"].docs[-1]
    inv["created_at"] = _iso(-3)
    _entregas(mundo, 15, fecha=_dia(-1))
    _entregas(mundo, 10)
    await server._referido_premiar(inv, "c1")
    assert not inv.get("ref_premiado") and inv["ref_sospechoso"] == "misma_red"
    assert not mundo.g["organizations"].docs[0].get("cartera_saldo")


@pytest.mark.asyncio(loop_scope="session")
async def test_tope_de_invitados_premiados_al_mes(mundo):
    codigo = (await server.referidos_mios(YO))["codigo"]
    mes = datetime.now(timezone.utc).strftime("%Y-%m")
    for i in range(server._REF_TOPE_MES):
        mundo.g["cartera_movimientos"].docs.append({"id": f"m{i}", "org_id": "o1", "tipo": "referido", "mes": mes, "importe": 500})
    await _alta(ref=codigo, usuario="el-veintiuno")
    inv = mundo.g["organizations"].docs[-1]
    inv["created_at"] = _iso(-3)
    _entregas(mundo, 15, fecha=_dia(-1))
    _entregas(mundo, 10)
    await server._referido_premiar(inv, "c1")
    assert not inv.get("ref_premiado")


@pytest.mark.asyncio(loop_scope="session")
async def test_retirar_el_saldo_y_que_la_plataforma_lo_pague_o_lo_rechace(mundo, monkeypatch):
    correos = []

    async def correo(para, asunto, html, **k):
        correos.append((para, asunto))
        return True
    monkeypatch.setattr(server, "_enviar_email", correo)
    o1 = mundo.g["organizations"].docs[0]
    o1["cartera_saldo"] = 750
    datos = {"titular": "Pepe Pérez", "metodo": "bizum", "destino": "+34 612 345 678"}
    with pytest.raises(HTTPException) as e:                     # menos del mínimo (10 €)
        await server.cartera_retirar(datos, YO)
    assert e.value.status_code == 400
    o1["cartera_saldo"] = 1000
    for malo in ({**datos, "destino": "912345678"}, {**datos, "titular": "Pepe"},
                 {**datos, "metodo": "iban", "destino": "ES91 2100 0418 4502 0005 1333"}, {**datos, "metodo": "paypal"}):
        with pytest.raises(HTTPException):
            await server.cartera_retirar(malo, YO)
    r = await server.cartera_retirar(datos, YO)
    assert r["retirada"]["importe"] == 1000 and r["retirada"]["destino"] == "•••• 5678"
    assert o1["cartera_saldo"] == 0
    with pytest.raises(HTTPException) as e:                     # una en revisión cada vez
        await server.cartera_retirar(datos, YO)
    assert e.value.status_code in (400, 409)
    assert any("Retirada de cartera pendiente" in a for _, a in correos)
    # La plataforma la ve entera (para pagar) y la rechaza: el saldo vuelve.
    lista = await server.admin_cartera_retiradas("pendiente", SUPER)
    ret = lista["retiradas"][0]
    assert ret["destino"] == "612345678" and ret["titular"] == "Pepe Pérez"
    await server.admin_retirada_rechazar(ret["id"], {"motivo": "El móvil no tiene Bizum"}, SUPER)
    assert o1["cartera_saldo"] == 1000
    with pytest.raises(HTTPException):
        await server.admin_retirada_pagada(ret["id"], SUPER)    # ya no está pendiente
    # Otra vez, ahora por transferencia, y se paga.
    r = await server.cartera_retirar({"titular": "Pepe Pérez", "metodo": "iban", "destino": "ES91 2100 0418 4502 0005 1332"}, YO)
    await server.admin_retirada_pagada(r["retirada"]["id"], SUPER)
    assert mundo.g["cartera_retiradas"].docs[-1]["estado"] == "pagada" and o1["cartera_saldo"] == 0
    assert any(a.startswith("Te hemos pagado 10") for _, a in correos)
    mis = await server.referidos_mios(YO)
    assert sorted(x["estado"] for x in mis["retiradas"]) == ["pagada", "rechazada"]
    assert mis["retiradas"][0]["destino"].startswith("•••• ")


@pytest.mark.asyncio(loop_scope="session")
async def test_invita_y_gana_solo_en_espana(mundo):
    """11-10-2026: se paga por Bizum o a una cuenta española; una cuenta de México no lo tiene."""
    o1 = mundo.g["organizations"].docs[0]
    o1["pais"] = "mx"
    o1["cartera_saldo"] = 2000
    assert (await server.referidos_mios(YO))["cartera"] is False
    with pytest.raises(HTTPException) as e:
        await server.cartera_retirar({"titular": "Pepe Pérez", "metodo": "bizum", "destino": "+34 612 345 678"}, YO)
    assert e.value.status_code == 400
    codigo = (await server.referidos_mios(YO))["codigo"]
    await _alta(ref=codigo)
    inv = mundo.g["organizations"].docs[-1]
    inv["created_at"] = _iso(-2)
    _entregas(mundo, 20, fecha=_dia(-1))
    _entregas(mundo, 1)
    await server._referido_premiar(inv, "c1")
    assert not inv.get("ref_premiado") and o1["cartera_saldo"] == 2000
