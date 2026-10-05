# -*- coding: utf-8 -*-
"""Gente que BAJA de otros centros y parejas que libran juntas: las dos órdenes del cuadrante
se guardan, se leen para el motor y se pueden quitar."""
import pytest
from fastapi import HTTPException

import server
from base_de_mentira import Col, Db

YO = {"sub": "a1", "role": "admin", "name": "Dani", "org_id": "o1", "email": "d@x.es"}


@pytest.fixture
def mundo(monkeypatch):
    t = Db()
    t["cuadrante_ajustes"] = Col([])
    t["drivers"] = Col([{"id": "d1", "name": "Ana"}, {"id": "d2", "name": "Luis"}])
    monkeypatch.setattr(server, "db", t)
    monkeypatch.setattr(server, "_cua_acceso", lambda *a, **k: None)
    monkeypatch.setattr(server, "_cua_centro", lambda c: c)

    class Cambio:
        def __init__(self, *a, **k): pass
        async def antes(self, *a, **k): pass
        async def guardar(self, *a, **k): pass
    monkeypatch.setattr(server, "_CuaCambio", Cambio)
    return t


@pytest.mark.asyncio(loop_scope="session")
async def test_refuerzo_se_guarda_se_cambia_y_con_cero_se_quita(mundo):
    col = mundo[server._CUA_AJUSTES]
    await server.cuadrante_ajuste({"center": "SANTIAGO", "tipo": "refuerzo_dia", "fecha": "2026-10-09", "refuerzo": 4}, YO)
    assert [(a["fecha"], a["refuerzo"]) for a in col.docs] == [("2026-10-09", 4)]
    await server.cuadrante_ajuste({"center": "SANTIAGO", "tipo": "refuerzo_dia", "fecha": "2026-10-09", "refuerzo": 6}, YO)
    assert len(col.docs) == 1 and col.docs[0]["refuerzo"] == 6              # no duplica
    await server.cuadrante_ajuste({"center": "SANTIAGO", "tipo": "refuerzo_dia", "fecha": "2026-10-09", "refuerzo": 0}, YO)
    assert col.docs == []                                                   # 0 = quitar
    with pytest.raises(HTTPException) as e:
        await server.cuadrante_ajuste({"center": "SANTIAGO", "tipo": "refuerzo_dia", "fecha": "2026-10-09", "refuerzo": 99}, YO)
    assert e.value.status_code == 400


@pytest.mark.asyncio(loop_scope="session")
async def test_pareja_que_libra_junta_se_guarda_ordenada_y_sin_duplicar(mundo):
    col = mundo[server._CUA_AJUSTES]
    await server.cuadrante_ajuste({"center": "SANTIAGO", "tipo": "libran_juntos", "driver_a": "d2", "driver_b": "d1"}, YO)
    await server.cuadrante_ajuste({"center": "SANTIAGO", "tipo": "libran_juntos", "driver_a": "d1", "driver_b": "d2"}, YO)
    assert len(col.docs) == 1 and col.docs[0]["driver_ids"] == ["d1", "d2"]
    for malo in ({"driver_a": "d1", "driver_b": "d1"}, {"driver_a": "d1", "driver_b": "nadie"}, {"driver_a": "", "driver_b": "d2"}):
        with pytest.raises(HTTPException) as e:
            await server.cuadrante_ajuste({"center": "SANTIAGO", "tipo": "libran_juntos", **malo}, YO)
        assert e.value.status_code == 400
