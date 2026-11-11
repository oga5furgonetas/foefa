# -*- coding: utf-8 -*-
"""Tanda 2, zona «día» (11-11-2026), contra el servidor de verdad (server.app) con una base de
mentira en memoria: no hace falta Mongo.

- D2 (dia-12 / historia-9): Furgonetas fijas ya tiene la casilla «Furgonetas que no debe llevar».
  El servidor ya guardaba `vetadas`; ahora además no deja que la de RESERVA esté vetada, apunta
  las vetadas en el historial de cambios y una vetada que luego se da de baja no impide guardar
  lo demás de ese conductor.
- D3 (dia-9): «Como ayer» en Aparcamiento. `/parking/last-known` solo contaba las plazas
  confirmadas (y nadie confirma: ningún conductor reporta). Con `incluir_asignadas` cuenta también
  las asignadas y con `antes_de` solo mira los días anteriores. Sin ellos, lo de siempre (la web
  vieja en caché no las manda).
"""
import time

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import server
from base_de_mentira import Db

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest_asyncio.fixture(loop_scope="session")
async def cliente():
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://testserver") as c:
        yield c


@pytest.fixture
def base(monkeypatch):
    b = Db()
    monkeypatch.setattr(server, "db", b)
    monkeypatch.setattr(server, "global_db", Db())
    server._ADMIN_EXISTS_CACHE.clear()
    yield b
    server._ADMIN_EXISTS_CACHE.clear()


def _cab(uid="u-ofi", nombre="Oficina", centros=None, cuenta="owner"):
    """Un usuario de oficina que existe (la caché de _admin_cacheado hace de base)."""
    server._ADMIN_EXISTS_CACHE[uid] = (time.time() + 600, True, centros, None, None)
    tok = server.create_token(uid, "admin", nombre, org_id="o1", account_type=cuenta)
    return {"Authorization": f"Bearer {tok}"}


def _flota(base):
    base.drivers.docs.append({"id": "d1", "name": "ANA PÉREZ", "center": "OGA5"})
    for vid, mat, st in (("v1", "1234ABC", "active"), ("v2", "5678DEF", "active"), ("v3", "9012GHI", "active")):
        base.vehicles.docs.append({"id": vid, "license_plate": mat, "status": st, "center": "OGA5"})


# ── D2 · vetadas ───────────────────────────────────────────────────────────────

async def test_la_de_reserva_no_puede_estar_vetada(cliente, base):
    _flota(base)
    cab = _cab()
    r = await cliente.put("/api/afinidad/conductor/d1", headers=_cab(), json={"secundaria": "v2", "vetadas": ["v2"]})
    assert r.status_code == 400, r.text
    assert "reserva" in r.json()["detail"]
    # Ni vetándola después de ponerla de reserva.
    r = await cliente.put("/api/afinidad/conductor/d1", headers=cab, json={"secundaria": "v2"})
    assert r.status_code == 200, r.text
    r = await cliente.put("/api/afinidad/conductor/d1", headers=cab, json={"vetadas": ["v2"]})
    assert r.status_code == 400, r.text
    # Otra que no es la suya, sí.
    r = await cliente.put("/api/afinidad/conductor/d1", headers=cab, json={"vetadas": ["v3"]})
    assert r.status_code == 200, r.text
    assert r.json()["fija"]["vetadas"] == ["v3"]


async def test_el_historial_apunta_las_vetadas(cliente, base):
    _flota(base)
    r = await cliente.put("/api/afinidad/conductor/d1", headers=_cab(), json={"principal": "v1", "vetadas": ["v3"]})
    assert r.status_code == 200, r.text
    ficha = base[server._AFIN_COL].docs[0]
    assert ficha["vetadas"] == ["v3"]
    assert ficha["historial"][-1]["vetadas"] == ["v3"]
    r = await cliente.put("/api/afinidad/conductor/d1", headers=_cab(), json={"vetadas": []})
    assert r.status_code == 200, r.text
    assert [h["vetadas"] for h in base[server._AFIN_COL].docs[0]["historial"]] == [["v3"], []]


async def test_una_vetada_que_se_da_de_baja_no_impide_guardar_lo_demas(cliente, base):
    _flota(base)
    cab = _cab()
    r = await cliente.put("/api/afinidad/conductor/d1", headers=cab, json={"vetadas": ["v3"]})
    assert r.status_code == 200, r.text
    base.vehicles.docs[2]["status"] = "baja"
    # Cambiar la nota (u otra cosa) ya no da «Esa furgoneta no existe o está de baja».
    r = await cliente.put("/api/afinidad/conductor/d1", headers=cab, json={"responsabilidad": 7})
    assert r.status_code == 200, r.text
    assert r.json()["fija"]["vetadas"] == ["v3"]
    # Pero vetar una NUEVA que no existe o está de baja sigue sin admitirse.
    r = await cliente.put("/api/afinidad/conductor/d1", headers=cab, json={"vetadas": ["v3", "no-existe"]})
    assert r.status_code == 400, r.text


async def test_la_principal_vetada_sigue_sin_admitirse(cliente, base):
    _flota(base)
    r = await cliente.put("/api/afinidad/conductor/d1", headers=_cab(), json={"principal": "v1", "vetadas": ["v1"]})
    assert r.status_code == 400, r.text


# ── D3 · «Como ayer» ───────────────────────────────────────────────────────────

def _plazas(base):
    filas = [
        # v1: confirmada el 08, asignada el 09 (la última es la del 09).
        ("v1", "OGA5", "2026-11-08", "3", "confirmada"),
        ("v1", "OGA5", "2026-11-09", "4", "asignada"),
        # v2: solo asignada (nadie la confirma: es lo normal).
        ("v2", "OGA5", "2026-11-09", "7", "asignada"),
        # v3: denegada no cuenta nunca.
        ("v3", "OGA5", "2026-11-09", "9", "denegada"),
        # Lo del día que se está colocando (y los siguientes) no cuenta con `antes_de`.
        ("v2", "OGA5", "2026-11-10", "12", "asignada"),
        # Otra nave.
        ("v9", "DGA1", "2026-11-09", "1", "asignada"),
    ]
    for vid, c, d, spot, st in filas:
        base.parking_assignments.docs.append({"vehicle_id": vid, "center": c, "day": d, "spot": spot, "status": st})


async def test_sin_parametros_solo_las_confirmadas_como_siempre(cliente, base):
    _plazas(base)
    r = await cliente.get("/api/parking/last-known?center=OGA5", headers=_cab())
    assert r.status_code == 200, r.text
    assert r.json()["vehicles"] == [{"vehicle_id": "v1", "spot": "3", "day": "2026-11-08", "center": "OGA5"}]


async def test_con_asignadas_y_antes_de_da_la_ultima_plaza_de_cada_una(cliente, base):
    _plazas(base)
    r = await cliente.get("/api/parking/last-known?center=OGA5&incluir_asignadas=true&antes_de=2026-11-10", headers=_cab())
    assert r.status_code == 200, r.text
    por = {v["vehicle_id"]: (v["spot"], v["day"]) for v in r.json()["vehicles"]}
    assert por == {"v1": ("4", "2026-11-09"), "v2": ("7", "2026-11-09")}


async def test_antes_de_con_formato_malo_se_rechaza(cliente, base):
    r = await cliente.get("/api/parking/last-known?center=OGA5&antes_de=10/11/2026", headers=_cab())
    assert r.status_code == 400, r.text
