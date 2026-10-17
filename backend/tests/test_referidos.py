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
def sin_promo(monkeypatch):
    """Las reglas de siempre (5 € / 2,50 €): la promoción de 10 € del 14-10-2026 ya pasó."""
    monkeypatch.setattr(server, "_REF_PROMO_HASTA", datetime(2026, 10, 1, tzinfo=timezone.utc))


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


def _entregas(mundo, n, ejemplo=False, fecha=None, cada_min=25):
    """Entregas como las de verdad: cada una a una dirección distinta y repartidas en el día
    (cada `cada_min` minutos desde las 8:00). Con cada_min=0, todas «de golpe»."""
    hoy = fecha or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    inicio = datetime.fromisoformat(f"{hoy}T08:00:00+00:00")
    for i in range(n):
        k = len(mundo.t["reparto_pedidos"].docs)
        mundo.t["reparto_pedidos"].docs.append({"id": f"p{k}", "conductor_id": "c1", "direccion": f"Calle {k} nº {i}",
                                                "cerrado_en": (inicio + timedelta(minutes=i * cada_min)).isoformat(),
                                                "estado": "entregado", "fecha": hoy, **({"ejemplo": True} if ejemplo else {})})


def _dia(n):
    return (datetime.now(timezone.utc) + timedelta(days=n)).strftime("%Y-%m-%d")


SUPER = {"sub": "sa1", "role": "admin", "sa": True}


@pytest.mark.asyncio(loop_scope="session")
async def test_la_cartera_gana_5_euros_con_uso_real_en_dos_dias_y_solo_una_vez(mundo, sin_promo):
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
    _entregas(mundo, 3)                                             # otro día (3 entregas en 50 min): ya está
    await server._referido_premiar(inv, "c1")
    assert inv["ref_premiado"] is True
    o1 = mundo.g["organizations"].docs[0]
    assert o1["cartera_saldo"] == 500 and o1["cartera_ganado"] == 500
    r = await server.referidos_mios(YO)
    assert r["saldo"] == 500 and r["premiados"] == 1 and r["por_invitado"] == 500 and r["retirada_min"] == 6000
    assert "promo_hasta" not in r
    await server._referido_premiar(inv, "c1")                       # una sola vez
    assert o1["cartera_saldo"] == 500 and len(mundo.g["cartera_movimientos"].docs) == 1


@pytest.mark.asyncio(loop_scope="session")
async def test_desde_el_corte_cada_invitado_da_2_euros_50(mundo, sin_promo):
    """11-10-2026: las cuentas creadas desde el 12-10 (hora de Madrid) ganan 2,50 €."""
    mundo.g["organizations"].docs[0]["created_at"] = "2026-10-12T08:00:00+00:00"
    codigo = (await server.referidos_mios(YO))["codigo"]
    assert (await server.referidos_mios(YO))["por_invitado"] == 250
    await _alta(ref=codigo)
    inv = mundo.g["organizations"].docs[-1]
    inv["created_at"] = _iso(-2)
    _entregas(mundo, 20, fecha=_dia(-1))
    _entregas(mundo, 3)
    await server._referido_premiar(inv, "c1")
    o1 = mundo.g["organizations"].docs[0]
    assert inv["ref_premiado"] is True and o1["cartera_saldo"] == 250 and o1["cartera_ganado"] == 250
    assert mundo.g["cartera_movimientos"].docs[-1]["importe"] == 250


@pytest.mark.asyncio(loop_scope="session")
async def test_promocion_10_euros_por_invitado_dado_de_alta_hasta_el_31_de_octubre(mundo, monkeypatch):
    """14-10-2026 (Dani): 10 € por cada invitado que se registre hasta el 31-10-2026, en vez de 2,50 € (o 5 €).
    Manda la fecha de alta del invitado: si se registró en la promoción, cobra 10 € aunque las 20 entregas
    lleguen después; si se registra ya en noviembre, lo de siempre."""
    mundo.g["organizations"].docs[0]["created_at"] = "2026-10-12T08:00:00+00:00"
    r = await server.referidos_mios(YO)
    assert r["por_invitado"] == 1000 and r["promo_hasta"] == "2026-12-31" and r["promo_cent"] == 1000
    assert (await server.referidos_valido(r["codigo"]))["por_invitado"] == 1000
    await _alta(ref=r["codigo"])
    inv = mundo.g["organizations"].docs[-1]
    inv["created_at"] = _iso(-2)                                  # alta en la promoción
    _entregas(mundo, 20, fecha=_dia(-1))
    _entregas(mundo, 3)
    # Las entregas se completan cuando la promoción ya ha terminado: sigue valiendo su fecha de alta.
    monkeypatch.setattr(server, "_REF_PROMO_HASTA", datetime.now(timezone.utc) - timedelta(days=1))
    assert "promo_hasta" not in await server.referidos_mios(YO)
    await server._referido_premiar(inv, "c1")
    o1 = mundo.g["organizations"].docs[0]
    assert inv["ref_premiado"] is True and o1["cartera_saldo"] == 1000
    assert mundo.g["cartera_movimientos"].docs[-1]["importe"] == 1000
    # Otro invitado, dado de alta cuando ya no hay promoción (acabó hace 3 días; él se registró hace 2): 2,50 €.
    monkeypatch.setattr(server, "_REF_PROMO_HASTA", datetime.now(timezone.utc) - timedelta(days=3))
    await _alta(ref=r["codigo"], usuario="luis-reparte")
    inv2 = mundo.g["organizations"].docs[-1]
    inv2["created_at"] = _iso(-2)
    mundo.t["reparto_pedidos"].docs.clear()
    _entregas(mundo, 20, fecha=_dia(-1))
    _entregas(mundo, 3)
    await server._referido_premiar(inv2, "c1")
    assert o1["cartera_saldo"] == 1250 and mundo.g["cartera_movimientos"].docs[-1]["importe"] == 250


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
    o1["cartera_saldo"] = 4500
    datos = {"titular": "Pepe Pérez", "metodo": "bizum", "destino": "+34 612 345 678"}
    with pytest.raises(HTTPException) as e:                     # menos del mínimo (60 €): el mensaje dice cuánto falta
        await server.cartera_retirar(datos, YO)
    assert e.value.status_code == 400 and "60 €" in e.value.detail and "15 €" in e.value.detail
    o1["cartera_saldo"] = 6000
    for malo in ({**datos, "destino": "912345678"}, {**datos, "titular": "Pepe"},
                 {**datos, "metodo": "iban", "destino": "ES91 2100 0418 4502 0005 1333"}, {**datos, "metodo": "paypal"}):
        with pytest.raises(HTTPException):
            await server.cartera_retirar(malo, YO)
    r = await server.cartera_retirar(datos, YO)
    assert r["retirada"]["importe"] == 6000 and r["retirada"]["destino"] == "•••• 5678"
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
    assert o1["cartera_saldo"] == 6000
    with pytest.raises(HTTPException):
        await server.admin_retirada_pagada(ret["id"], SUPER)    # ya no está pendiente
    # Otra vez, ahora por transferencia, y se paga.
    r = await server.cartera_retirar({"titular": "Pepe Pérez", "metodo": "iban", "destino": "ES91 2100 0418 4502 0005 1332"}, YO)
    await server.admin_retirada_pagada(r["retirada"]["id"], SUPER)
    assert mundo.g["cartera_retiradas"].docs[-1]["estado"] == "pagada" and o1["cartera_saldo"] == 0
    assert any(a.startswith("Te hemos pagado 60") for _, a in correos)
    mis = await server.referidos_mios(YO)
    assert sorted(x["estado"] for x in mis["retiradas"]) == ["pagada", "rechazada"]
    assert mis["retiradas"][0]["destino"].startswith("•••• ")


@pytest.mark.asyncio(loop_scope="session")
async def test_fuera_de_espana_se_cobra_por_paypal_y_en_china_no_hay(mundo, sin_promo):
    """11-10-2026: en Latinoamérica también se gana; se cobra por PayPal (Bizum e IBAN son de España)."""
    o1 = mundo.g["organizations"].docs[0]
    o1["pais"] = "mx"
    o1["created_at"] = "2026-10-12T08:00:00+00:00"
    r = await server.referidos_mios(YO)
    assert r["cartera"] is True and r["metodos"] == ["paypal"] and r["por_invitado"] == 250
    codigo = r["codigo"]
    await _alta(ref=codigo)
    inv = mundo.g["organizations"].docs[-1]
    inv["created_at"] = _iso(-2)
    _entregas(mundo, 20, fecha=_dia(-1))
    _entregas(mundo, 3)
    await server._referido_premiar(inv, "c1")
    assert inv["ref_premiado"] is True
    o1["cartera_saldo"] = 6000
    with pytest.raises(HTTPException) as e:
        await server.cartera_retirar({"titular": "Pepe Pérez", "metodo": "bizum", "destino": "+34 612 345 678"}, YO)
    assert e.value.status_code == 400
    with pytest.raises(HTTPException):
        await server.cartera_retirar({"titular": "Pepe Pérez", "metodo": "paypal", "destino": "no-es-un-correo"}, YO)
    r = await server.cartera_retirar({"titular": "Pepe Pérez", "metodo": "paypal", "destino": "Pepe.Perez@Gmail.com"}, YO)
    assert r["retirada"]["destino"] == "p•••@gmail.com"
    assert mundo.g["cartera_retiradas"].docs[-1]["destino"] == "pepe.perez@gmail.com"
    # China: no hay cómo pagar.
    o1["pais"] = "cn"
    assert (await server.referidos_mios(YO))["cartera"] is False


@pytest.mark.asyncio(loop_scope="session")
async def test_bono_de_bienvenida_por_la_primera_ruta_real_y_una_sola_vez(mundo):
    """17-10-2026 (Dani): 10 € para quien reparte solo cuando hace su primera ruta de verdad (20 entregas
    reales en 2 días distintos), no por registrarse. A su propia cartera y una sola vez."""
    o1 = mundo.g["organizations"].docs[0]
    o1["created_at"] = _iso(-2)
    b = await server._bono_estado(o1, "c1")
    assert b["pagado"] is False and b["cent"] == 1000 and b["hasta"] == "2026-12-31" and b["entregas"] == 0
    assert b["objetivo"] == 20 and b["dias_objetivo"] == 2
    _entregas(mundo, 30, ejemplo=True)                              # las de ejemplo no cuentan
    _entregas(mundo, 12, fecha=_dia(-1))
    b = await server._bono_estado(o1, "c1")
    assert b["pagado"] is False and b["entregas"] == 12 and b["dias"] == 1
    r = await server.referidos_mios(YO)
    assert r["bono"]["pagado"] is False and r["saldo"] == 0
    _entregas(mundo, 8)                                             # otro día: 20 en 2 días
    b = await server._bono_estado(o1, "c1")
    assert b["pagado"] is True and b.get("nuevo") is True
    assert o1["bono_pagado"] is True and o1["cartera_saldo"] == 1000 and o1["cartera_ganado"] == 1000
    mov = mundo.g["cartera_movimientos"].docs[-1]
    assert mov["tipo"] == "bienvenida" and mov["importe"] == 1000 and mov["org_id"] == "o1"
    b = await server._bono_estado(o1, "c1")                          # una sola vez
    assert b["pagado"] is True and not b.get("nuevo") and o1["cartera_saldo"] == 1000
    assert len(mundo.g["cartera_movimientos"].docs) == 1
    assert (await server.referidos_mios(YO))["bono"] == {"cent": 1000, "pagado": True, "pagado_en": o1["bono_pagado_en"]}


@pytest.mark.asyncio(loop_scope="session")
async def test_bono_ni_de_golpe_ni_recien_creada_ni_para_empresas_ni_en_china(mundo):
    o1 = mundo.g["organizations"].docs[0]
    o1["created_at"] = _iso(-2)
    _entregas(mundo, 20, fecha=_dia(-1), cada_min=0)                 # 40 «entregadas» de golpe: no es repartir
    _entregas(mundo, 20, cada_min=0)
    assert (await server._bono_estado(o1, "c1"))["pagado"] is False
    mundo.t["reparto_pedidos"].docs.clear()
    _entregas(mundo, 20, fecha=_dia(-1))
    _entregas(mundo, 5)
    o1["created_at"] = _iso(-0.5)                                    # cuenta de menos de 24 h
    assert (await server._bono_estado(o1, "c1"))["pagado"] is False
    o1["created_at"] = _iso(-2)
    for cambio in ({"sector": "mensajeria", "plan": "pro"}, {"pais": "cn"}, {"demo": True}, {"account_type": "owner"}):
        assert await server._bono_estado({**o1, **cambio}, "c1") is None
    # Dada de alta cuando ya no hay promoción: no le toca.
    assert await server._bono_estado({**o1, "created_at": "2027-01-02T10:00:00+00:00"}, "c1") is None
    # De antes del bono y con su mes ya pasado: tampoco.
    assert server._bono_resumen({**o1, "created_at": "2026-10-03T10:00:00+00:00"},
                                datetime(2026, 11, 17, tzinfo=timezone.utc)) is None
    assert not o1.get("bono_pagado") and not mundo.g["cartera_movimientos"].docs


@pytest.mark.asyncio(loop_scope="session")
async def test_bono_desde_la_misma_red_que_otra_que_ya_lo_cobro_se_revisa(mundo):
    red = server._huella_red("198.51.100.7")
    mundo.g["organizations"].docs.append({"id": "o2", "name": "Otra", "sector": "autonomo", "alta_red": red,
                                          "bono_pagado": True, "created_at": _iso(-5)})
    o1 = mundo.g["organizations"].docs[0]
    o1.update(created_at=_iso(-2), alta_red=red)
    _entregas(mundo, 15, fecha=_dia(-1))
    _entregas(mundo, 10)
    b = await server._bono_estado(o1, "c1")
    assert b["pagado"] is False and b["revisar"] is True and o1["bono_sospechoso"] == "misma_red"
    assert not o1.get("cartera_saldo")


@pytest.mark.asyncio(loop_scope="session")
async def test_veinte_entregas_de_golpe_no_cuentan(mundo):
    """Marcar 20 «entregadas» en dos minutos (o todas a la misma dirección) no es usar la app."""
    codigo = (await server.referidos_mios(YO))["codigo"]
    await _alta(ref=codigo)
    inv = mundo.g["organizations"].docs[-1]
    inv["created_at"] = _iso(-2)
    _entregas(mundo, 20, fecha=_dia(-1), cada_min=0)
    _entregas(mundo, 20, cada_min=0)
    await server._referido_premiar(inv, "c1")
    assert not inv.get("ref_premiado")
    # Repartidas en el día pero todas a la misma puerta: tampoco.
    for p in mundo.t["reparto_pedidos"].docs:
        p["direccion"] = "Calle Falsa 123"
    assert server._ref_uso_real([{**p, "cerrado_en": p["cerrado_en"]} for p in mundo.t["reparto_pedidos"].docs])[0] <= 2
