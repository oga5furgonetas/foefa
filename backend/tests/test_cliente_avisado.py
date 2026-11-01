# -*- coding: utf-8 -*-
"""EL CLIENTE AVISADO, LA PROPINA Y LA VALORACIÓN (01-11-2026, §6): el Bizum del repartidor en su tarifa (solo quien
reparte por su cuenta), que el cliente ve en su enlace SOLO con el paquete entregado; y la valoración de 1 a 5 estrellas
desde el enlace, solo entregado, que el repartidor y la oficina ven."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import reparto
import server
from test_reparto_api import ANA, OFICINA, base  # noqa: F401  (la base de mentira y los usuarios de siempre)

PETICION = SimpleNamespace(headers={}, client=SimpleNamespace(host="1.1.1.1"))


def test_la_valoracion_son_estrellas_de_1_a_5_y_nada_mas():
    assert reparto.valoracion_sanea({"estrellas": 5, "comentario": "x"}) == ({"estrellas": 5}, "")
    assert reparto.valoracion_sanea({"estrellas": "3"}) == ({"estrellas": 3}, "")
    for malo in ({"estrellas": 0}, {"estrellas": 6}, {"estrellas": "muchas"}, {}, "nada", None):
        v, error = reparto.valoracion_sanea(malo)
        assert v is None and error


async def _autonomo(monkeypatch):
    async def org_autonomo(_id):
        return {"id": "o1", "account_type": "dsp", "sector": "autonomo", "modulos": ["dashboard", "reparto", "configuracion"]}
    monkeypatch.setattr(server, "get_org", org_autonomo)
    return {"sub": "a9", "role": "admin", "name": "Pepe", "org_id": "o1", "db_name": "dsp_x"}


@pytest.mark.asyncio(loop_scope="session")
async def test_el_bizum_va_con_la_tarifa_y_el_cliente_lo_ve_solo_entregado(base, monkeypatch):
    yo = await _autonomo(monkeypatch)
    with pytest.raises(HTTPException) as e:
        await server.reparto_ganancias_put({"pago_parada": 150, "bizum": "12345"}, yo)
    assert e.value.status_code == 400
    r = await server.reparto_ganancias_put({"pago_parada": 150, "bizum": "+34 612 345 678"}, yo)
    assert r["bizum"] == "612345678" and r["pago_parada"] == 150
    # Guardar los ajustes de la ruta no lo borra; la ruta lo trae con la tarifa.
    await server.reparto_ajustes_put({"base_direccion": ""}, yo)
    assert base.db["reparto_ajustes"].docs[0]["bizum"] == "612345678"
    mia = await server.reparto_mi_ruta(yo)
    assert mia["ganancias"]["bizum"] == "612345678" and mia["ganancias"]["pago_parada"] == 150
    # El cliente, en su enlace: nada mientras está en camino; el Bizum cuando ya lo tiene.
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "telefono": "612345678"}, yo)
    token = (await server.reparto_enlace(p["id"], yo))["token"]
    # La empresa del enlace (la que el servidor apunta al crearlo) es de quien reparte por su cuenta.
    base.globales["organizations"].docs.append({"id": "o1", "db_name": base.globales["reparto_enlaces"].docs[0]["db_name"],
                                                "name": "Pepe reparte", "sector": "autonomo"})
    pub = await server.seguimiento_publico(token, PETICION)
    assert pub["empresa"] == "Pepe reparte" and pub["bizum"] == "" and pub["puede_valorar"] is False and pub["valoracion"] is None
    await server.reparto_estado(p["id"], {"estado": "entregado"}, yo)
    pub = await server.seguimiento_publico(token, PETICION)
    assert pub["bizum"] == "612345678" and pub["puede_valorar"] is True
    # Vacío lo quita.
    assert (await server.reparto_ganancias_put({"pago_parada": 150, "bizum": ""}, yo))["bizum"] == ""
    assert (await server.seguimiento_publico(token, PETICION))["bizum"] == ""


@pytest.mark.asyncio(loop_scope="session")
async def test_el_cliente_valora_solo_con_el_paquete_en_la_mano(base):
    p = await server.reparto_mis_pedidos({"direccion": "Rúa Real 5", "telefono": "612345678", "cliente": "Bea"}, ANA)
    token = (await server.reparto_enlace(p["id"], ANA))["token"]
    with pytest.raises(HTTPException) as e:
        await server.seguimiento_valoracion(token, PETICION, {"estrellas": 5})
    assert e.value.status_code == 409
    await server.reparto_estado(p["id"], {"estado": "entregado"}, ANA)
    with pytest.raises(HTTPException) as e:
        await server.seguimiento_valoracion(token, PETICION, {"estrellas": 9})
    assert e.value.status_code == 400
    r = await server.seguimiento_valoracion(token, PETICION, {"estrellas": 4, "comentario": "no se guarda"})
    assert r["ok"] and r["valoracion"]["estrellas"] == 4 and "comentario" not in r["valoracion"] and r["valoracion"]["cuando"]
    # El cliente la ve en su enlace; el repartidor, en lo hecho; la oficina, en la lista.
    assert (await server.seguimiento_publico(token, PETICION))["valoracion"]["estrellas"] == 4
    assert (await server.reparto_mi_ruta(ANA))["pedidos"][0]["valoracion"]["estrellas"] == 4
    assert (await server.reparto_pedidos("", OFICINA))["pedidos"][0]["valoracion"]["estrellas"] == 4
    # Se puede cambiar mientras el enlace viva; un enlace falso, no.
    assert (await server.seguimiento_valoracion(token, PETICION, {"estrellas": 5}))["valoracion"]["estrellas"] == 5
    with pytest.raises(HTTPException):
        await server.seguimiento_valoracion("no-existe-este-token-xx", PETICION, {"estrellas": 5})
    # Para una empresa (sin «sector autónomo») no sale ningún Bizum aunque lo hubiera.
    base.db["reparto_ajustes"].docs.append({"id": "ajustes", "bizum": "612345678"})
    assert (await server.seguimiento_publico(token, PETICION))["bizum"] == ""
